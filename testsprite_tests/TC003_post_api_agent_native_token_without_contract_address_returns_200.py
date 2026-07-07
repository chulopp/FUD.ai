import requests
import time

BASE_URL = "http://localhost:3000"
TIMEOUT = 30
POLL_INTERVAL = 5

def test_post_api_agent_native_token_no_contract_address_returns_200():
    post_url = f"{BASE_URL}/api/agent"
    headers = {"Content-Type": "application/json"}
    payload = {
        "coin_symbol": "BTC"
        # contract_address intentionally omitted for native token test
    }

    # Step 1: POST /api/agent with coin_symbol=BTC, no contract_address
    try:
        response = requests.post(post_url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"POST request to /api/agent failed: {e}"

    assert response.status_code == 202, f"Expected status code 202, got {response.status_code}"
    json_resp = response.json()
    assert "job_id" in json_resp and json_resp["job_id"], "Response missing job_id"
    assert "poll_url" in json_resp and json_resp["poll_url"], "Response missing poll_url"
    assert json_resp.get("coin_symbol") == "BTC", f"Expected coin_symbol 'BTC', got {json_resp.get('coin_symbol')}"

    job_id = json_resp["job_id"]
    poll_url = f"{BASE_URL}/api/agent/{job_id}"

    # Step 2: Poll GET /api/agent/[job_id] every 5 seconds until status is completed
    max_poll_attempts = 60  # rather safe upper bound ~5 minutes
    completed_response = None
    for _ in range(max_poll_attempts):
        try:
            poll_resp = requests.get(poll_url, timeout=TIMEOUT)
        except requests.RequestException as e:
            assert False, f"GET request to {poll_url} failed: {e}"

        assert poll_resp.status_code == 200, f"Polling returned unexpected status {poll_resp.status_code}"
        poll_json = poll_resp.json()

        status = poll_json.get("status")
        assert status in ("pending", "running", "completed", "failed"), f"Unexpected status value: {status}"

        if status == "completed":
            completed_response = poll_json
            break
        elif status == "failed":
            assert False, f"Job failed with error: {poll_json.get('error')}"
        # else pending or running -> wait and retry
        time.sleep(POLL_INTERVAL)

    assert completed_response is not None, "Test timed out waiting for job to complete"

    # Step 3: Verify required schema fields in completed response
    required_fields = [
        "request_id",
        "coin_symbol",
        "drama_index",
        "dominant_branch",
        "branch_probabilities",
        "evidence_chain",
        "executable_verdict",
        "served_from_cache"
    ]
    for field in required_fields:
        assert field in completed_response, f"Field '{field}' missing in completed response"

    # Additional type and value checks
    assert isinstance(completed_response["request_id"], str) and completed_response["request_id"], "Invalid request_id"
    assert completed_response["coin_symbol"] == "BTC", f"Expected completed coin_symbol 'BTC', got {completed_response['coin_symbol']}"
    assert isinstance(completed_response["drama_index"], (int, float)), "drama_index must be a number"
    assert 0 <= completed_response["drama_index"] <= 100, "drama_index out of range 0-100"
    assert isinstance(completed_response["dominant_branch"], str) and completed_response["dominant_branch"], "dominant_branch invalid"
    assert isinstance(completed_response["branch_probabilities"], dict), "branch_probabilities must be a dict"
    assert isinstance(completed_response["evidence_chain"], list), "evidence_chain must be a list"
    assert completed_response["executable_verdict"] in {"LIQUIDATE_LONGS", "HOLD", "ACCUMULATE", "IGNORE_FUD"}, "Invalid executable_verdict"
    assert isinstance(completed_response["served_from_cache"], bool), "served_from_cache must be a boolean"

    # Step 4: Verify Coordination & Sybil Detection module fields in coordination_signals
    coord = completed_response.get("coordination_signals")
    assert isinstance(coord, dict), "coordination_signals must be present as a dict when status is completed"
    expected_coord_fields = {
        "unique_author_ratio",
        "duplicate_text_cluster_size",
        "cross_platform_burst_window_minutes"
    }
    missing_coord_fields = expected_coord_fields - coord.keys()
    assert not missing_coord_fields, f"coordination_signals missing fields: {missing_coord_fields}"

    # Optional: Validate types of coordination_signals fields
    assert isinstance(coord["unique_author_ratio"], (int, float)), "unique_author_ratio must be a number"
    assert isinstance(coord["duplicate_text_cluster_size"], (int, float)), "duplicate_text_cluster_size must be a number"
    assert isinstance(coord["cross_platform_burst_window_minutes"], (int, float)), "cross_platform_burst_window_minutes must be a number"

test_post_api_agent_native_token_no_contract_address_returns_200()