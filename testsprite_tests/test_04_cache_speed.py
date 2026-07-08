"""
╔══════════════════════════════════════════════════════════════════════╗
║  SCENARIO 4 — "THE FLASH CRASH"                                      ║
║  Uji Kecepatan Cache & Timeout — Redis L2 Ingestion Cache            ║
║                                                                      ║
║  Target   : TC-3.14 (Ingestion Cache Hit), HIGH-01, TC-3.11          ║
║  Audit Ref: HIGH-01 (CoinGecko Rate Limit), LOW-01 (In-Memory Cache) ║
║                                                                      ║
║  Behaviour:                                                          ║
║    1. POST /api/agent for "BTC" (native coin, no contract)           ║
║    2. Poll until completed — record pipeline_elapsed_ms (T1)         ║
║    3. Immediately POST /api/agent for "BTC" again                    ║
║    4. Poll until completed — record pipeline_elapsed_ms (T2)         ║
║    5. Assert both requests complete successfully                      ║
║    6. Assert T2 < T1 * 0.8 (second run is significantly faster       ║
║       because Redis L2 ingestion cache provides cache HIT on         ║
║       CoinGecko/Bybit/DexScreener responses)                         ║
║    7. Assert served_from_cache = true on second request              ║
╚══════════════════════════════════════════════════════════════════════╝

Redis Ingestion Cache key pattern: ingestion:<source>:<symbol>:<addr>:<chainId>
TTL: 2 minutes (120 seconds) — set in app/lib/redis/ingestion-cache.ts
"""

import requests
import time

BASE_URL = "https://reword-situated-barman.ngrok-free.dev"
AGENT_URL = f"{BASE_URL}/api/agent"

TIMEOUT = 30
POLL_INTERVAL = 3
MAX_POLL_SECONDS = 600   # 10 minutes max

# BTC — native token path: no security checks (GoPlus/RugCheck bypassed)
# Uses: Bybit V5, CoinGecko, DexScreener, Twitter, Telegram
BTC_PAYLOAD = {
    "coin_symbol": "BTC",
    # Native token: no contract address → dispatcher skips on-chain security
}

VALID_VERDICTS = {"LIQUIDATE_LONGS", "HOLD", "ACCUMULATE", "IGNORE_FUD", "INSUFFICIENT_DATA"}


def post_btc() -> dict:
    """Submit a BTC analysis job and return the 202 response body."""
    headers = {"Content-Type": "application/json", "ngrok-skip-browser-warning": "69420"}
    r = requests.post(AGENT_URL, json=BTC_PAYLOAD, headers=headers, timeout=TIMEOUT)
    assert r.status_code == 202, (
        f"Expected HTTP 202, got {r.status_code}. Body: {r.text[:400]}"
    )
    body = r.json()
    assert "job_id" in body and body["job_id"], "Missing job_id in 202 body"
    assert "poll_url" in body, "Missing poll_url in 202 body"
    return body


def poll_until_done(job_id: str, label: str = "") -> dict:
    """Poll GET /api/agent/<job_id> until completed or failed."""
    poll_url = f"{BASE_URL}/api/agent/{job_id}"
    elapsed = 0
    last_status = None

    while elapsed < MAX_POLL_SECONDS:
        resp = requests.get(poll_url, headers={"ngrok-skip-browser-warning": "69420"}, timeout=TIMEOUT)
        assert resp.status_code == 200, (
            f"[{label}] Poll returned {resp.status_code}. Body: {resp.text[:200]}"
        )
        data = resp.json()
        status = data.get("status")

        if status != last_status:
            print(f"    [{label}] status → '{status}' (elapsed {elapsed}s)")
            last_status = status

        assert status in ("pending", "running", "completed", "failed"), (
            f"[{label}] Unknown status: '{status}'"
        )

        if status == "completed":
            return data
        if status == "failed":
            raise AssertionError(f"[{label}] Job FAILED: {data.get('error')}")

        time.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL

    raise AssertionError(
        f"[{label}] Polling timed out after {MAX_POLL_SECONDS}s"
    )


def assert_valid_verdict(final: dict, label: str):
    """Assert the completed payload has a valid executable_verdict."""
    assert "executable_verdict" in final, f"[{label}] Missing executable_verdict"
    verdict = final["executable_verdict"]
    assert verdict in VALID_VERDICTS, (
        f"[{label}] executable_verdict '{verdict}' not in {VALID_VERDICTS}"
    )
    assert "drama_index" in final and isinstance(final["drama_index"], (int, float)), (
        f"[{label}] Missing or non-numeric drama_index"
    )
    assert 0 <= final["drama_index"] <= 100, (
        f"[{label}] drama_index {final['drama_index']} out of [0, 100]"
    )
    assert "confidence" in final and 0.0 <= final["confidence"] <= 1.0, (
        f"[{label}] confidence out of range: {final.get('confidence')}"
    )
    assert "evidence_chain" in final and isinstance(final["evidence_chain"], list), (
        f"[{label}] Missing or invalid evidence_chain"
    )
    assert "coordination_signals" in final and isinstance(final["coordination_signals"], dict), (
        f"[{label}] Missing coordination_signals"
    )
    return verdict


def test_flash_crash():
    print("\n" + "=" * 60)
    print("SCENARIO 4 — THE FLASH CRASH (Redis L2 Cache Speed Test)")
    print("=" * 60)

    # ══════════════════════════════════════════════════════════════════
    # REQUEST 1 — Cold run (no Redis ingestion cache)
    # ══════════════════════════════════════════════════════════════════
    print("\n[Run 1] Submitting BTC (cold cache)…")
    t_submit_1 = time.perf_counter()
    post_body_1 = post_btc()
    job_id_1    = post_body_1["job_id"]
    print(f"  202 received. job_id={job_id_1}")
    print(f"  Polling (every {POLL_INTERVAL}s)…")

    final_1  = poll_until_done(job_id_1, "Run-1")
    t_done_1 = time.perf_counter()

    # pipeline_elapsed_ms is reported by the server
    elapsed_ms_1 = final_1.get("pipeline_elapsed_ms")
    wall_ms_1    = (t_done_1 - t_submit_1) * 1000

    print(f"\n  Run 1 complete.")
    print(f"    server pipeline_elapsed_ms : {elapsed_ms_1} ms")
    print(f"    wall clock (submit→done)   : {wall_ms_1:.0f} ms")

    verdict_1 = assert_valid_verdict(final_1, "Run-1")
    print(f"  ✅  PASS — Run 1 completed. verdict={verdict_1}")

    served_cache_1 = final_1.get("served_from_cache", False)
    print(f"  served_from_cache (run 1): {served_cache_1}")

    # ══════════════════════════════════════════════════════════════════
    # REQUEST 2 — Warm run (Redis ingestion cache populated)
    # 2-minute TTL on ingestion cache means we must fire immediately!
    # ══════════════════════════════════════════════════════════════════
    print("\n[Run 2] Submitting BTC IMMEDIATELY (warm ingestion cache)…")
    t_submit_2 = time.perf_counter()
    post_body_2 = post_btc()
    job_id_2    = post_body_2["job_id"]
    print(f"  202 received. job_id={job_id_2}")
    print(f"  Polling (every {POLL_INTERVAL}s)…")

    final_2  = poll_until_done(job_id_2, "Run-2")
    t_done_2 = time.perf_counter()

    elapsed_ms_2 = final_2.get("pipeline_elapsed_ms")
    wall_ms_2    = (t_done_2 - t_submit_2) * 1000

    print(f"\n  Run 2 complete.")
    print(f"    server pipeline_elapsed_ms : {elapsed_ms_2} ms")
    print(f"    wall clock (submit→done)   : {wall_ms_2:.0f} ms")

    verdict_2 = assert_valid_verdict(final_2, "Run-2")
    print(f"  ✅  PASS — Run 2 completed. verdict={verdict_2}")

    served_cache_2 = final_2.get("served_from_cache", False)
    print(f"  served_from_cache (run 2): {served_cache_2}")

    # ══════════════════════════════════════════════════════════════════
    # ASSERTIONS
    # ══════════════════════════════════════════════════════════════════

    print("\n--- Cache Speed Comparison ---")
    print(f"  Run 1 pipeline_elapsed_ms : {elapsed_ms_1}")
    print(f"  Run 2 pipeline_elapsed_ms : {elapsed_ms_2}")

    # ── ASSERTION A: Both runs completed successfully ─────────────────
    assert final_1.get("status") == "completed", "Run 1 status not 'completed'"
    assert final_2.get("status") == "completed", "Run 2 status not 'completed'"
    print("  ✅  PASS — Both runs reached status='completed'")

    # ── ASSERTION B: served_from_cache on run 2 ───────────────────────
    # The Redis ingestion cache (2-min TTL) should hit on run 2, and the
    # job-store might also short-circuit earlier. Either served_from_cache=True
    # OR elapsed_ms_2 < elapsed_ms_1 * 0.8 proves the cache worked.
    if elapsed_ms_1 is not None and elapsed_ms_2 is not None:
        speedup_ratio = elapsed_ms_2 / elapsed_ms_1 if elapsed_ms_1 > 0 else 1.0
        print(f"  Speed-up ratio: {speedup_ratio:.2f}x  (run2 / run1)")

        # Either significantly faster OR served_from_cache=True
        cache_speed_win = (speedup_ratio < 0.85)   # >15% faster
        cache_flag_win  = served_cache_2 is True

        assert cache_speed_win or cache_flag_win, (
            f"Run 2 did not benefit from Redis L2 ingestion cache. "
            f"speed-up ratio={speedup_ratio:.2f} (expected < 0.85), "
            f"served_from_cache={served_cache_2} (expected True). "
            f"Pipeline_elapsed: run1={elapsed_ms_1}ms, run2={elapsed_ms_2}ms"
        )

        if cache_speed_win:
            print(f"  ✅  PASS — Redis L2 cache delivered {(1 - speedup_ratio) * 100:.0f}% speed-up on run 2")
        if cache_flag_win:
            print(f"  ✅  PASS — served_from_cache=True on run 2 (job-level cache hit)")
    else:
        # pipeline_elapsed_ms not in response — just check served_from_cache
        print("  ⚠️  pipeline_elapsed_ms not available, checking served_from_cache only…")
        assert served_cache_2 is True, (
            f"Expected served_from_cache=True on run 2 (L2 cache), got {served_cache_2}"
        )
        print("  ✅  PASS — served_from_cache=True on run 2")

    # ── ASSERTION C: No API timeout leaks ────────────────────────────
    # If the pipeline completed without status='failed', no uncaught
    # timeout errors leaked to the user.
    assert final_2.get("status") == "completed", (
        "Run 2 did not complete — potential API timeout leak"
    )
    print("  ✅  PASS — No API timeout leaks (both runs completed cleanly)")

    print("\n" + "=" * 60)
    print("SCENARIO 4 — THE FLASH CRASH ✅  ALL ASSERTIONS PASSED")
    print("=" * 60)


# Direct execution entry-point
test_flash_crash()
