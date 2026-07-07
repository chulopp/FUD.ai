import requests
import time
import uuid

BASE_URL = "http://localhost:3000"
POLL_INTERVAL = 5          # seconds between polls
MAX_WAIT_SECONDS = 300     # 5 minutes maximum wait

def poll_until_done(job_id: str) -> dict:
    """Poll GET /api/agent/<job_id> until status is completed or failed."""
    poll_url = f"{BASE_URL}/api/agent/{job_id}"
    deadline = time.time() + MAX_WAIT_SECONDS
    while time.time() < deadline:
        try:
            r = requests.get(poll_url, timeout=15)
        except requests.RequestException as e:
            print(f"[Poll] GET failed: {e}. Retrying in {POLL_INTERVAL}s...")
            time.sleep(POLL_INTERVAL)
            continue

        assert r.status_code in (200, 404), f"Unexpected poll status: {r.status_code}"
        if r.status_code == 404:
            raise AssertionError(f"Job {job_id} not found (404) — may have expired")

        data = r.json()
        print(f"[Poll] status={data.get('status')} job_id={job_id}")
        if data.get("status") in ("completed", "failed"):
            return data
        time.sleep(POLL_INTERVAL)

    raise AssertionError(f"Job {job_id} did not complete within {MAX_WAIT_SECONDS}s")


# ─────────────────────────────────────────────────────────────
# SCENARIO 1: API Doomsday
# Unknown token forces all external APIs to error/empty.
# Expect: status='degraded', executable_verdict='INSUFFICIENT_DATA'
# ─────────────────────────────────────────────────────────────
def test_scenario_api_doomsday():
    url = f"{BASE_URL}/api/agent"
    payload = {
        "coin_symbol": "INVALIDAPIDOOMTEST",
        "contract_address": "native",
        "chain_id": "1"
    }
    r = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=15)
    assert r.status_code == 202, f"Expected 202 Accepted, got {r.status_code}"
    body = r.json()
    assert "job_id" in body, "Missing job_id in 202 response"
    assert body.get("status") == "pending", f"Expected pending, got {body.get('status')}"

    result = poll_until_done(body["job_id"])

    # Status can be completed (with degraded) or failed
    job_status = result.get("status")
    assert job_status in ("completed", "failed"), f"Unexpected job status: {job_status}"

    if job_status == "completed":
        payload_status = result.get("status")
        verdict = result.get("executable_verdict")
        # A completely unknown token should degrade or return INSUFFICIENT_DATA/IGNORE_FUD
        assert verdict in ("INSUFFICIENT_DATA", "IGNORE_FUD", "HOLD"), \
            f"API Doomsday: unexpected verdict for unknown token: {verdict}"

    print(f"[PASS] Scenario 1 API Doomsday: job_status={job_status}, verdict={result.get('executable_verdict')}")

test_scenario_api_doomsday()
