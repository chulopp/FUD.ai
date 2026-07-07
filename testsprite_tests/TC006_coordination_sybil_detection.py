import requests
import time

BASE_URL = "http://localhost:3000"
ENDPOINT = "/api/agent"
TIMEOUT = 30
POLL_INTERVAL = 5
MAX_POLL_TIME = 300  # 5 minutes

def test_coordination_sybil_detection():
    url = f"{BASE_URL}{ENDPOINT}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "coin_symbol": "PEPE",
        "contract_address": "0x6982508145554ce3b5901a7778ad28a500216222",
        "chain_id": "1"
    }

    # Step 1: POST to start analysis
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"HTTP request failed: {e}"

    assert response.status_code == 202, f"Expected status code 202 but got {response.status_code}"
    json_resp = response.json()
    assert "job_id" in json_resp and json_resp["job_id"], "Response missing or empty job_id"
    assert "poll_url" in json_resp and json_resp["poll_url"], "Response missing or empty poll_url"

    job_id = json_resp["job_id"]
    poll_url = f"{BASE_URL}/api/agent/{job_id}"

    # Step 2: Poll GET /api/agent/<job_id> until status is 'completed'
    start_time = time.time()
    final_result = None
    while True:
        elapsed = time.time() - start_time
        if elapsed > MAX_POLL_TIME:
            assert False, f"Polling timeout after {MAX_POLL_TIME} seconds waiting for job completion"

        try:
            poll_resp = requests.get(poll_url, timeout=TIMEOUT)
        except requests.RequestException as e:
            assert False, f"Polling GET request failed: {e}"

        assert poll_resp.status_code == 200, f"Polling returned unexpected status code {poll_resp.status_code}"
        poll_json = poll_resp.json()

        status = poll_json.get("status")
        if status == "completed":
            final_result = poll_json
            break
        elif status == "failed":
            assert False, f"API job failed during processing: {poll_json.get('error')}"
        else:
            time.sleep(POLL_INTERVAL)

    assert final_result is not None, "Final response is None after polling"

    # Step 3: Validate coordination_signals is present and populated
    assert "coordination_signals" in final_result, "Missing 'coordination_signals' in response JSON"
    signals = final_result["coordination_signals"]
    assert isinstance(signals, dict), "coordination_signals should be an object"

    # Validate specific mathematical fields are present and typed correctly
    assert "unique_author_ratio" in signals, "Missing 'unique_author_ratio' in coordination_signals"
    assert "duplicate_text_cluster_size" in signals, "Missing 'duplicate_text_cluster_size' in coordination_signals"
    assert "cross_platform_burst_window_minutes" in signals, "Missing 'cross_platform_burst_window_minutes' in coordination_signals"

    assert isinstance(signals["unique_author_ratio"], (int, float)), "unique_author_ratio should be a number"
    assert isinstance(signals["duplicate_text_cluster_size"], (int, float)), "duplicate_text_cluster_size should be a number"
    assert isinstance(signals["cross_platform_burst_window_minutes"], (int, float)), "cross_platform_burst_window_minutes should be a number"

    print("Success: coordination_signals verified successfully!", signals)

test_coordination_sybil_detection()
