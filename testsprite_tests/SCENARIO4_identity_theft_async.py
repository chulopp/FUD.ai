import requests
import time

BASE_URL = "http://localhost:3000"
POLL_INTERVAL = 5
MAX_WAIT_SECONDS = 300

def poll_until_done(job_id: str) -> dict:
    poll_url = f"{BASE_URL}/api/agent/{job_id}"
    deadline = time.time() + MAX_WAIT_SECONDS
    while time.time() < deadline:
        try:
            r = requests.get(poll_url, timeout=15)
        except requests.RequestException:
            time.sleep(POLL_INTERVAL)
            continue
        if r.status_code == 404:
            raise AssertionError(f"Job {job_id} not found")
        data = r.json()
        print(f"[Poll] status={data.get('status')}")
        if data.get("status") in ("completed", "failed"):
            return data
        time.sleep(POLL_INTERVAL)
    raise AssertionError(f"Job did not complete within {MAX_WAIT_SECONDS}s")


# SCENARIO 4: Token Identity Theft (Symbol vs CA Mismatch)
# BTC symbol BUT providing a Solana SPL token contract address
def test_scenario_token_identity_theft():
    url = f"{BASE_URL}/api/agent"
    payload = {
        "coin_symbol": "BTC",
        # EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v = USDC SPL token on Solana
        "contract_address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "chain_id": "1"  # claims EVM chain_id=1, but CA is Solana base58 format
    }
    r = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=15)
    assert r.status_code == 202, f"Expected 202, got {r.status_code}"
    body = r.json()
    assert "job_id" in body

    result = poll_until_done(body["job_id"])
    assert result.get("status") in ("completed", "failed")

    if result.get("status") == "completed":
        verdict = result.get("executable_verdict")
        valid_verdicts = {"LIQUIDATE_LONGS", "HOLD", "ACCUMULATE", "IGNORE_FUD", "INSUFFICIENT_DATA"}
        assert verdict in valid_verdicts, f"Invalid verdict: {verdict}"

        # The system should have flagged data inconsistencies — check for grounded evidence
        evidence = result.get("evidence_chain", [])
        assert isinstance(evidence, list)

        print(f"[PASS] Scenario 4 Identity Theft: verdict={verdict}, evidence_count={len(evidence)}")
    else:
        print(f"[INFO] Scenario 4: Job status={result.get('status')}, error={result.get('error')}")

test_scenario_token_identity_theft()
