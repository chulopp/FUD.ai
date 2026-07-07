import requests
import time

BASE_URL = "http://localhost:3000"
TIMEOUT = 30
POLL_INTERVAL = 5

def test_post_api_agent_valid_evm_token_returns_structured_verdict():
    post_url = f"{BASE_URL}/api/agent"
    payload = {
        "coin_symbol": "DOGE",
        "contract_address": "0x9f6E3Bf85e609526110a4eE51cC6DCd9A171b831",
        "chain_id": "1"
    }
    headers = {
        "Content-Type": "application/json"
    }

    # POST /api/agent with valid EVM token info
    try:
        post_response = requests.post(post_url, json=payload, headers=headers, timeout=TIMEOUT)
    except Exception as e:
        assert False, f"POST request failed: {e}"

    assert post_response.status_code == 202, f"Expected HTTP 202, got {post_response.status_code}"
    post_json = post_response.json()
    assert "job_id" in post_json and isinstance(post_json["job_id"], str) and post_json["job_id"], "Missing or invalid job_id"
    assert "poll_url" in post_json and isinstance(post_json["poll_url"], str) and post_json["poll_url"].startswith("/api/agent/"), "Missing or invalid poll_url"
    assert post_json.get("coin_symbol") == "DOGE", "coin_symbol in response does not match request"

    job_id = post_json["job_id"]
    poll_url = f"{BASE_URL}/api/agent/{job_id}"

    # Poll until status is "completed"
    max_poll_time = 180  # 3 minutes max poll time
    elapsed_time = 0
    final_json = None

    while elapsed_time < max_poll_time:
        try:
            get_response = requests.get(poll_url, timeout=TIMEOUT)
        except Exception as e:
            assert False, f"GET request failed: {e}"

        assert get_response.status_code == 200, f"Expected HTTP 200, got {get_response.status_code}"
        get_json = get_response.json()

        status = get_json.get("status")
        assert status in ("pending", "running", "completed", "failed"), f"Unexpected status: {status}"

        if status == "completed":
            final_json = get_json
            break
        elif status == "failed":
            assert False, f"Job failed with error: {get_json.get('error')}"
        else:
            time.sleep(POLL_INTERVAL)
            elapsed_time += POLL_INTERVAL

    assert final_json is not None, "Polling timed out without completion status"

    # Validate required fields in completed response
    def assert_string_field(field):
        assert field in final_json and isinstance(final_json[field], str) and final_json[field], f"Missing or invalid string field: {field}"

    assert_string_field("request_id")
    assert "coin_symbol" in final_json and final_json["coin_symbol"] == "DOGE", "coin_symbol mismatch in completed response"
    assert "drama_index" in final_json and isinstance(final_json["drama_index"], (int, float)) and 0 <= final_json["drama_index"] <= 100, "drama_index invalid"
    assert "dominant_branch" in final_json and isinstance(final_json["dominant_branch"], str) and final_json["dominant_branch"].strip(), "dominant_branch missing or empty"
    assert "branch_probabilities" in final_json and isinstance(final_json["branch_probabilities"], dict), "branch_probabilities missing or invalid"
    assert "evidence_chain" in final_json and isinstance(final_json["evidence_chain"], list), "evidence_chain missing or invalid"
    assert "executable_verdict" in final_json and final_json["executable_verdict"] in {"LIQUIDATE_LONGS", "HOLD", "ACCUMULATE", "IGNORE_FUD"}, "executable_verdict invalid"
    assert "served_from_cache" in final_json and final_json["served_from_cache"] is False, "served_from_cache must be false"
    assert "fallback" not in final_json or final_json.get("fallback") is False, "fallback should be absent or false"

    # Verify coordination_signals field and subfields presence
    assert "coordination_signals" in final_json and isinstance(final_json["coordination_signals"], dict), "coordination_signals missing or invalid"
    cs = final_json["coordination_signals"]
    assert "unique_author_ratio" in cs, "coordination_signals.unique_author_ratio missing"
    assert "duplicate_text_cluster_size" in cs, "coordination_signals.duplicate_text_cluster_size missing"
    assert "cross_platform_burst_window_minutes" in cs, "coordination_signals.cross_platform_burst_window_minutes missing"

test_post_api_agent_valid_evm_token_returns_structured_verdict()