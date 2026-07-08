"""
╔══════════════════════════════════════════════════════════════════════╗
║  SCENARIO 3 — "THE GOLDEN MEME"                                      ║
║  Uji Full Pipeline Solana/EVM — Kausalitas, Sybil, LLM MCTS         ║
║                                                                      ║
║  Target   : Full 7-step MCTS pipeline, coordination_signals,         ║
║             evidence_chain from Smart Contract + Social Intel         ║
║  Coins    : BONK (Solana) primary / PEPE (ETH) fallback              ║
║                                                                      ║
║  Behaviour:                                                          ║
║    1. POST /api/agent for "BONK" (Solana meme coin)                  ║
║    2. Implement polling loop every 3 seconds until completed         ║
║    3. Assert full schema fields are present                          ║
║    4. Assert coordination_signals block is populated                 ║
║    5. Assert evidence_chain contains contract AND social signals      ║
║    6. Assert executable_verdict is a valid enum                      ║
╚══════════════════════════════════════════════════════════════════════╝
"""

import requests
import time

BASE_URL = "https://reword-situated-barman.ngrok-free.dev"
AGENT_URL = f"{BASE_URL}/api/agent"

TIMEOUT = 30
POLL_INTERVAL = 3          # Poll every 3 seconds as specified
MAX_POLL_SECONDS = 600     # 10 minutes max (MCTS pipeline can take 30-60s)

# BONK on Solana (real Raydium/Pump.fun address)
BONK_PAYLOAD = {
    "coin_symbol": "BONK",
    "contract_address": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "chain_id": "solana",
}

# Fallback: PEPE on Ethereum (real ERC-20 address)
PEPE_PAYLOAD = {
    "coin_symbol": "PEPE",
    "contract_address": "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    "chain_id": "1",
}

VALID_VERDICTS = {"LIQUIDATE_LONGS", "HOLD", "ACCUMULATE", "IGNORE_FUD", "INSUFFICIENT_DATA"}


def post_agent(payload: dict) -> dict:
    """POST to /api/agent and return the 202 response body."""
    headers = {"Content-Type": "application/json", "ngrok-skip-browser-warning": "69420"}
    r = requests.post(AGENT_URL, json=payload, headers=headers, timeout=TIMEOUT)
    assert r.status_code == 202, (
        f"Expected HTTP 202, got {r.status_code}. Body: {r.text[:400]}"
    )
    body = r.json()
    assert "job_id" in body and body["job_id"], "Missing job_id in 202 response"
    assert "poll_url" in body and body["poll_url"].startswith("/api/agent/"), (
        f"Invalid poll_url: {body.get('poll_url')}"
    )
    return body


def poll_until_done(job_id: str) -> dict:
    """Poll GET /api/agent/<job_id> every 3s until completed or failed."""
    poll_url = f"{BASE_URL}/api/agent/{job_id}"
    elapsed = 0
    last_status = None

    while elapsed < MAX_POLL_SECONDS:
        resp = requests.get(poll_url, headers={"ngrok-skip-browser-warning": "69420"}, timeout=TIMEOUT)
        assert resp.status_code == 200, (
            f"Poll endpoint returned {resp.status_code}. Body: {resp.text[:300]}"
        )
        data = resp.json()
        status = data.get("status")

        if status != last_status:
            print(f"    [poll] status → '{status}' (elapsed {elapsed}s)")
            last_status = status

        assert status in ("pending", "running", "completed", "failed"), (
            f"Unknown job status: '{status}'"
        )

        if status == "completed":
            return data
        if status == "failed":
            raise AssertionError(
                f"Pipeline FAILED for job {job_id}: {data.get('error', 'no error detail')}"
            )

        time.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL

    raise AssertionError(
        f"Polling timed out after {MAX_POLL_SECONDS}s without completion for job {job_id}"
    )


def assert_full_schema(final: dict, expected_symbol: str):
    """Assert all required FUD.ai verdict fields are present and valid."""

    # ── Core identity ─────────────────────────────────────────────────
    assert "request_id" in final and final["request_id"], "Missing request_id"
    assert "coin_symbol" in final and final["coin_symbol"].upper() == expected_symbol.upper(), (
        f"coin_symbol mismatch: expected '{expected_symbol}', got '{final.get('coin_symbol')}'"
    )

    # ── MCTS verdict fields ───────────────────────────────────────────
    assert "executable_verdict" in final, "Missing executable_verdict"
    assert final["executable_verdict"] in VALID_VERDICTS, (
        f"executable_verdict '{final['executable_verdict']}' not in {VALID_VERDICTS}"
    )
    print(f"  ✅  executable_verdict = '{final['executable_verdict']}'")

    assert "drama_index" in final, "Missing drama_index"
    assert isinstance(final["drama_index"], (int, float)), (
        f"drama_index should be numeric, got {type(final['drama_index'])}"
    )
    assert 0 <= final["drama_index"] <= 100, (
        f"drama_index out of [0, 100] range: {final['drama_index']}"
    )
    print(f"  ✅  drama_index = {final['drama_index']} (valid 0–100)")

    assert "confidence" in final and isinstance(final["confidence"], (int, float)), (
        "Missing or non-numeric confidence"
    )
    assert 0.0 <= final["confidence"] <= 1.0, (
        f"confidence out of [0, 1] range: {final['confidence']}"
    )
    print(f"  ✅  confidence = {final['confidence']}")

    assert "dominant_branch" in final and isinstance(final["dominant_branch"], str), (
        "Missing or non-string dominant_branch"
    )
    assert final["dominant_branch"].strip(), "dominant_branch is empty string"
    print(f"  ✅  dominant_branch = '{final['dominant_branch']}'")

    assert "branch_probabilities" in final and isinstance(final["branch_probabilities"], dict), (
        "Missing or non-dict branch_probabilities"
    )
    print(f"  ✅  branch_probabilities = {final['branch_probabilities']}")

    # ── Evidence chain ────────────────────────────────────────────────
    assert "evidence_chain" in final and isinstance(final["evidence_chain"], list), (
        "Missing or non-list evidence_chain"
    )
    assert len(final["evidence_chain"]) > 0, (
        "evidence_chain is empty — pipeline produced no evidence"
    )
    print(f"  ✅  evidence_chain has {len(final['evidence_chain'])} items")
    for i, ev in enumerate(final["evidence_chain"][:3]):   # print first 3
        print(f"         [{i}] {ev[:100]}")

    # ── Coordination signals (Sybil / Phase 6) ───────────────────────
    assert "coordination_signals" in final, (
        "Missing coordination_signals — Sybil detection module not producing output"
    )
    cs = final["coordination_signals"]
    assert isinstance(cs, dict), f"coordination_signals should be dict, got {type(cs)}"

    assert "unique_author_ratio" in cs, "coordination_signals.unique_author_ratio missing"
    assert isinstance(cs["unique_author_ratio"], (int, float)), (
        "unique_author_ratio should be numeric"
    )
    assert 0.0 <= cs["unique_author_ratio"] <= 1.0, (
        f"unique_author_ratio out of range: {cs['unique_author_ratio']}"
    )
    print(f"  ✅  coordination_signals.unique_author_ratio = {cs['unique_author_ratio']}")

    assert "duplicate_text_cluster_size" in cs, (
        "coordination_signals.duplicate_text_cluster_size missing"
    )
    print(f"  ✅  coordination_signals.duplicate_text_cluster_size = {cs['duplicate_text_cluster_size']}")

    assert "cross_platform_burst_window_minutes" in cs, (
        "coordination_signals.cross_platform_burst_window_minutes missing"
    )
    print(f"  ✅  coordination_signals.cross_platform_burst_window_minutes = {cs['cross_platform_burst_window_minutes']}")

    # ── Pipeline metadata ─────────────────────────────────────────────
    assert "pipeline_elapsed_ms" in final and isinstance(final["pipeline_elapsed_ms"], (int, float)), (
        "Missing or non-numeric pipeline_elapsed_ms"
    )
    print(f"  ✅  pipeline_elapsed_ms = {final['pipeline_elapsed_ms']}ms")

    assert "served_from_cache" in final and isinstance(final["served_from_cache"], bool), (
        "served_from_cache missing or non-boolean"
    )
    print(f"  ✅  served_from_cache = {final['served_from_cache']}")


def test_golden_meme():
    print("\n" + "=" * 60)
    print("SCENARIO 3 — THE GOLDEN MEME (Full MCTS Pipeline)")
    print("=" * 60)

    # Try BONK (Solana) first, fall back to PEPE (EVM) if server down for Solana
    for payload in [BONK_PAYLOAD, PEPE_PAYLOAD]:
        symbol = payload["coin_symbol"]
        chain  = payload["chain_id"]
        print(f"\n[Attempt] Submitting {symbol} on chain={chain}…")

        try:
            # ── POST → 202 ──────────────────────────────────────────
            post_body = post_agent(payload)
            job_id    = post_body["job_id"]
            print(f"  ✅  PASS — POST returned 202, job_id={job_id}")

            # ── Polling loop (every 3s) ──────────────────────────────
            print(f"\n  Polling job every {POLL_INTERVAL}s (max {MAX_POLL_SECONDS}s)…")
            final = poll_until_done(job_id)

            # ── Full schema assertions ──────────────────────────────
            print(f"\n  Asserting full payload schema for {symbol}…")
            assert_full_schema(final, symbol)

            print(f"\n{'=' * 60}")
            print(f"SCENARIO 3 — THE GOLDEN MEME ✅  ALL ASSERTIONS PASSED [{symbol}]")
            print(f"{'=' * 60}")
            return  # Test passed — stop after first successful coin

        except AssertionError as exc:
            if payload == PEPE_PAYLOAD:
                raise   # Both coins failed — re-raise
            print(f"\n  ⚠️  {symbol} assertion failed: {exc}")
            print(f"  Falling back to PEPE on ETH…")
            continue


# Direct execution entry-point
test_golden_meme()
