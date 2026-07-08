import requests
import time

BASE_URL = "https://reword-situated-barman.ngrok-free.dev"
POST_AGENT_ENDPOINT = "/api/agent"
GET_AGENT_JOB_ENDPOINT_TEMPLATE = "/api/agent/{}"
REQUEST_TIMEOUT = 30
POLL_INTERVAL = 5
MAX_POLL_TIME = 300  # 5 minutes max polling to avoid endless waits

def test_post_api_agent_simulated_sybil_and_injection_returns_security_signals():
    post_url = BASE_URL + POST_AGENT_ENDPOINT
    headers = {
        "Content-Type": "application/json",
        "Bypass-Tunnel-Reminder": "true",
        "ngrok-skip-browser-warning": "69420"
    }
    payload = {
        "coin_symbol": "TESTFUD1"
    }

    try:
        # Step 1: POST /api/agent with coin_symbol=TESTFUD1
        post_resp = requests.post(post_url, json=payload, headers=headers, timeout=REQUEST_TIMEOUT)
        assert post_resp.status_code == 202, f"Expected 202 Accepted, got {post_resp.status_code}"
        post_json = post_resp.json()
        assert "job_id" in post_json, "Response missing job_id"
        assert "poll_url" in post_json, "Response missing poll_url"
        job_id = post_json["job_id"]
        poll_url_path = post_json["poll_url"]

        # Step 2: Poll GET /api/agent/[job_id] every 5 seconds until status=completed
        get_url = BASE_URL + GET_AGENT_JOB_ENDPOINT_TEMPLATE.format(job_id)
        start_time = time.time()
        while True:
            get_resp = requests.get(get_url, headers=headers, timeout=REQUEST_TIMEOUT)
            assert get_resp.status_code == 200, f"Polling returned unexpected status code {get_resp.status_code}"
            get_json = get_resp.json()
            status = get_json.get("status")
            if status == "completed":
                # Completed - break to assertions
                break
            elif status in ["pending", "running"]:
                elapsed = time.time() - start_time
                assert elapsed < MAX_POLL_TIME, "Polling timed out after max wait time"
                time.sleep(POLL_INTERVAL)
            else:
                raise AssertionError(f"Unexpected job status during polling: {status}")

        # Step 3: Verify evidence_chain existence and type
        evidence_chain = get_json.get("evidence_chain")
        assert isinstance(evidence_chain, list), "evidence_chain missing or not a list"

    except (requests.RequestException, AssertionError) as e:
        raise AssertionError(f"Test case TC007 failed: {e}")

test_post_api_agent_simulated_sybil_and_injection_returns_security_signals()
