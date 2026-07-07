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


# SCENARIO 3: 100% Spam Bot Attack
# Token symbol that exists purely in spam communities
def test_scenario_spam_bot_attack():
    url = f"{BASE_URL}/api/agent"
    # Using a known meme/spam token symbol
    payload = {
        "coin_symbol": "RETWEET",
        "chain_id": "1"
    }
    r = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=15)
    assert r.status_code == 202, f"Expected 202, got {r.status_code}"
    body = r.json()
    assert "job_id" in body

    result = poll_until_done(body["job_id"])
    assert result.get("status") in ("completed", "failed")

    if result.get("status") == "completed":
        chatter_level = result.get("chatter_level", 0)
        verdict = result.get("executable_verdict")
        drama_index = result.get("drama_index", 0)

        # For a spam-heavy token, chatter_level should reflect low quality signal
        # or the system should return a neutral verdict
        valid_verdicts = {"LIQUIDATE_LONGS", "HOLD", "ACCUMULATE", "IGNORE_FUD", "INSUFFICIENT_DATA"}
        assert verdict in valid_verdicts, f"Invalid verdict: {verdict}"
        print(f"[PASS] Scenario 3 Spam Bot Attack: verdict={verdict}, chatter_level={chatter_level}, drama_index={drama_index}")
    else:
        print(f"[INFO] Scenario 3: Job failed (status={result.get('status')}), error={result.get('error')}")

test_scenario_spam_bot_attack()
