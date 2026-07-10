"""
╔══════════════════════════════════════════════════════════════════════╗
║  SCENARIO 1 — "THE BOUNCER"                                          ║
║  Uji Ketahanan Server & Gatekeeper                                   ║
║                                                                      ║
║  Target   : TC-1.03 (Concurrency 429) + TC-1.12 (Malformed 400)     ║
║  Audit Ref: MEDIUM-10                                                ║
║                                                                      ║
║  Behaviour:                                                          ║
║    1. Fire 6 POST /api/agent requests CONCURRENTLY using asyncio     ║
║       + aiohttp.                                                     ║
║    2. Assert exactly 5 return HTTP 202 (accepted into queue).        ║
║    3. Assert exactly 1 returns HTTP 429 (Too Many Requests).         ║
║    4. Send one additional malformed body → assert HTTP 400.          ║
╚══════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import aiohttp
try:
    BASE_URL = TARGET_URL
except NameError:
    BASE_URL = "https://reword-situated-barman.ngrok-free.dev"
POST_URL = f"{BASE_URL}/api/agent"
REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=30)

# 6 distinct symbols so each fires a real separate pipeline request
CONCURRENT_SYMBOLS = [
    {"coin_symbol": "BTC"},
    {"coin_symbol": "ETH"},
    {"coin_symbol": "SOL"},
    {"coin_symbol": "DOGE"},
    {"coin_symbol": "PEPE"},
    {"coin_symbol": "BONK"},   # This one (or another) should get 429
]


async def post_agent(session: aiohttp.ClientSession, payload: dict) -> dict:
    """Fire a single POST /api/agent and return status + body."""
    try:
        async with session.post(
            POST_URL,
            json=payload,
            headers={"Content-Type": "application/json", "ngrok-skip-browser-warning": "69420"},
            timeout=REQUEST_TIMEOUT,
        ) as resp:
            body = await resp.json(content_type=None)
            return {"status": resp.status, "body": body, "symbol": payload.get("coin_symbol")}
    except Exception as exc:
        return {"status": -1, "body": {}, "symbol": payload.get("coin_symbol"), "error": str(exc)}


async def post_malformed(session: aiohttp.ClientSession) -> dict:
    """Fire a POST with a raw non-JSON string body to trigger 400."""
    try:
        async with session.post(
            POST_URL,
            data="this is not json at all",
            headers={"Content-Type": "text/plain", "ngrok-skip-browser-warning": "69420"},
            timeout=REQUEST_TIMEOUT,
        ) as resp:
            body = await resp.json(content_type=None)
            return {"status": resp.status, "body": body}
    except Exception as exc:
        return {"status": -1, "body": {}, "error": str(exc)}


async def run_bouncer_test():
    print("\n" + "=" * 60)
    print("SCENARIO 1 — THE BOUNCER (Concurrency + Malformed)")
    print("=" * 60)

    connector = aiohttp.TCPConnector(limit=20)
    async with aiohttp.ClientSession(connector=connector) as session:

        # ── Phase A: Fire 6 concurrent POSTs ─────────────────────────
        print(f"\n[Phase A] Firing {len(CONCURRENT_SYMBOLS)} concurrent POST requests…")
        t0 = time.perf_counter()
        tasks = [post_agent(session, payload) for payload in CONCURRENT_SYMBOLS]
        results = await asyncio.gather(*tasks)
        elapsed = time.perf_counter() - t0
        print(f"         All {len(results)} responses received in {elapsed:.2f}s")

        # Tally statuses
        status_202 = [r for r in results if r["status"] == 202]
        status_429 = [r for r in results if r["status"] == 429]
        other      = [r for r in results if r["status"] not in (202, 429)]

        print(f"\n  HTTP 202 count : {len(status_202)}")
        print(f"  HTTP 429 count : {len(status_429)}")
        print(f"  Other statuses : {[(r['status'], r['symbol']) for r in other]}")

        # ── ASSERTION 1: 5 requests must be 202 ──────────────────────
        assert len(status_202) == 5, (
            f"Expected exactly 5 HTTP 202 responses, got {len(status_202)}. "
            f"Full status breakdown: {[r['status'] for r in results]}"
        )
        print("  ✅  PASS — Exactly 5 requests returned HTTP 202 Accepted")

        # ── ASSERTION 2: 1 request must be 429 ───────────────────────
        assert len(status_429) == 1, (
            f"Expected exactly 1 HTTP 429 response, got {len(status_429)}. "
            f"Full status breakdown: {[r['status'] for r in results]}"
        )
        print("  ✅  PASS — Exactly 1 request returned HTTP 429 Too Many Requests")

        # ── ASSERTION 3: 429 body contains the expected error message ─
        rejected_body = status_429[0]["body"]
        assert "error" in rejected_body, "429 response missing 'error' key"
        assert "concurrent" in rejected_body["error"].lower() or "retry" in rejected_body["error"].lower(), (
            f"429 error message unexpected: {rejected_body['error']}"
        )
        print(f"  ✅  PASS — 429 body contains expected rate-limit message: \"{rejected_body['error']}\"")

        # ── ASSERTION 4: 202 bodies include job_id and poll_url ───────
        for r in status_202:
            body = r["body"]
            sym  = r["symbol"]
            assert "job_id" in body and body["job_id"], f"[{sym}] 202 missing job_id"
            assert "poll_url" in body and body["poll_url"].startswith("/api/agent/"), (
                f"[{sym}] 202 missing or invalid poll_url: {body.get('poll_url')}"
            )
        print("  ✅  PASS — All 202 bodies contain valid job_id and poll_url")

        # ── Phase B: Malformed body → must return 400 ─────────────────
        print("\n[Phase B] Sending malformed (non-JSON) body…")
        mal_result = await post_malformed(session)
        print(f"  Malformed request HTTP status: {mal_result['status']}")

        # ── ASSERTION 5: malformed body returns 400 ───────────────────
        assert mal_result["status"] == 400, (
            f"Expected HTTP 400 for malformed body, got {mal_result['status']}. "
            f"Body: {mal_result.get('body')}"
        )
        print(f"  ✅  PASS — Malformed body returned HTTP 400: {mal_result['body']}")

        print("\n" + "=" * 60)
        print("SCENARIO 1 — THE BOUNCER ✅  ALL ASSERTIONS PASSED")
        print("=" * 60)


def test_the_bouncer():
    asyncio.run(run_bouncer_test())


# Allow direct execution
test_the_bouncer()
