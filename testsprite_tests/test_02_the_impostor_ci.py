"""
╔══════════════════════════════════════════════════════════════════════╗
║  SCENARIO 2 — "THE IMPOSTOR" (CI-Safe Production Version)           ║
║  Uji Keamanan Cron Auth                                              ║
║                                                                      ║
║  Target   : TC-10.12/13 (Cron Auth)                                  ║
║  Audit Ref: MEDIUM-11, HIGH-02                                       ║
║                                                                      ║
║  Behaviour:                                                          ║
║    1. GET /api/cron/calibrate with NO secret → assert 401/503        ║
║    2. GET /api/cron/calibrate with WRONG secret → assert 401         ║
║                                                                      ║
║  Note: The fake coin polling test (KOINGAIB123) requires MCTS        ║
║  pipeline to complete which takes 30-90s and exceeds CI timeout.     ║
║  It is covered in the manual Phase 7 Run 2 verification in LOOP.md. ║
╚══════════════════════════════════════════════════════════════════════╝
"""

import requests

BASE_URL = "https://fud-ai.vercel.app"
CRON_URL = f"{BASE_URL}/api/cron/calibrate"
TIMEOUT = 15


def test_the_impostor():
    print("\n" + "=" * 60)
    print("SCENARIO 2 — THE IMPOSTOR (CI-Safe: Cron Auth checks)")
    print("=" * 60)

    # ── 1a. No secret → must return 401 or 503 ────────────────────────
    print("\n[1a] GET /api/cron/calibrate (no secret)…")
    r = requests.get(CRON_URL, timeout=TIMEOUT)
    print(f"  Status: {r.status_code}")
    assert r.status_code in (401, 503), (
        f"Expected 401 or 503 with no secret, got {r.status_code}. Body: {r.text[:300]}"
    )
    print(f"  ✅  PASS — No-secret correctly rejected with HTTP {r.status_code}")

    # ── 1b. Wrong secret → must return 401 ────────────────────────────
    print("\n[1b] GET /api/cron/calibrate?secret=TOTALLY_WRONG…")
    r2 = requests.get(f"{CRON_URL}?secret=TOTALLY_WRONG", timeout=TIMEOUT)
    print(f"  Status: {r2.status_code}")
    assert r2.status_code == 401, (
        f"Expected 401 with wrong secret, got {r2.status_code}. Body: {r2.text[:300]}"
    )
    body2 = r2.json()
    assert body2.get("ok") is False, "Expected ok=false in 401 body"
    assert "Unauthorized" in str(body2.get("error", "")), (
        f"401 body missing 'Unauthorized': {body2}"
    )
    print(f"  ✅  PASS — Wrong-secret correctly rejected with HTTP 401: {body2}")

    print("\n" + "=" * 60)
    print("SCENARIO 2 — THE IMPOSTOR ✅  ALL ASSERTIONS PASSED")
    print("=" * 60)


# Run the test
test_the_impostor()
