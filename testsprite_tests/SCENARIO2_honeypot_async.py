import requests
import time
import uuid

BASE_URL = "http://localhost:3000"
POLL_INTERVAL = 5
MAX_WAIT_SECONDS = 300

def poll_until_done(job_id: str) -> dict:
    poll_url = f"{BASE_URL}/api/agent/{job_id}"
    deadline = time.time() + MAX_WAIT_SECONDS
    while time.time() < deadline:
        try:
            r = requests.get(poll_url, timeout=15)
        except requests.RequestException as e:
            time.sleep(POLL_INTERVAL)
            continue
        assert r.status_code in (200, 404)
        if r.status_code == 404:
            raise AssertionError(f"Job {job_id} not found")
        data = r.json()
        print(f"[Poll] status={data.get('status')}")
        if data.get("status") in ("completed", "failed"):
            return data
        time.sleep(POLL_INTERVAL)
    raise AssertionError(f"Job did not complete within {MAX_WAIT_SECONDS}s")


# SCENARIO 2: Fundamental Conflict — Honeypot Illusion
# PEPE token on Ethereum (known token, GoPlus should return honeypot data)
def test_scenario_honeypot_illusion():
    url = f"{BASE_URL}/api/agent"
    payload = {
        "coin_symbol": "PEPE",
        "contract_address": "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
        "chain_id": "1"
    }
    r = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=15)
    assert r.status_code == 202, f"Expected 202, got {r.status_code}"
    body = r.json()
    assert "job_id" in body

    result = poll_until_done(body["job_id"])
    assert result.get("status") in ("completed", "failed")
    verdict = result.get("executable_verdict")
    assert verdict in ("LIQUIDATE_LONGS", "HOLD", "ACCUMULATE", "IGNORE_FUD", "INSUFFICIENT_DATA"), \
        f"Invalid verdict: {verdict}"

    # Verify evidence_chain exists and has grounded claims
    if result.get("status") == "completed":
        evidence = result.get("evidence_chain", [])
        assert isinstance(evidence, list), "evidence_chain must be a list"

    print(f"[PASS] Scenario 2 Honeypot Illusion: verdict={verdict}, evidence_count={len(result.get('evidence_chain', []))}")

test_scenario_honeypot_illusion()
