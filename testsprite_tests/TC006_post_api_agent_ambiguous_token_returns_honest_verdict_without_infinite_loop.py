import requests
import time

BASE_URL = "https://reword-situated-barman.ngrok-free.dev"
TIMEOUT = 30
HEADERS = {
    "Content-Type": "application/json",
    "Bypass-Tunnel-Reminder": "true",
    "ngrok-skip-browser-warning": "69420"
}


def test_post_api_agent_ambiguous_token_returns_honest_verdict_without_infinite_loop():
    post_url = f"{BASE_URL}/api/agent"
    payload = {
        "coin_symbol": "AI"
        # no contract_address field as per test case requirement
    }

    try:
        # Send POST request to initiate job
        post_resp = requests.post(post_url, json=payload, headers=HEADERS, timeout=TIMEOUT)
    except Exception as e:
        assert False, f"POST request failed with exception: {e}"

    assert post_resp.status_code == 202, f"Expected status 202, got {post_resp.status_code}"
    post_data = post_resp.json()
    job_id = post_data.get("job_id")
    poll_url = post_data.get("poll_url")

    assert job_id is not None and isinstance(job_id, str), "job_id missing or invalid in 202 response"
    assert poll_url is not None and isinstance(poll_url, str), "poll_url missing or invalid in 202 response"
    assert poll_url.endswith(job_id), "poll_url does not contain job_id"

    get_url = f"{BASE_URL}{poll_url}"

    total_poll_time = 0
    poll_interval = 5
    max_poll_time = 90
    final_response = None

    while total_poll_time < max_poll_time:
        try:
            get_resp = requests.get(get_url, timeout=TIMEOUT)
        except Exception as e:
            assert False, f"GET poll request failed with exception: {e}"

        assert get_resp.status_code == 200, f"Expected GET status 200, got {get_resp.status_code}"
        get_data = get_resp.json()
        status = get_data.get("status")
        if status in ("completed", "failed"):
            final_response = get_data
            break
        time.sleep(poll_interval)
        total_poll_time += poll_interval
    else:
        assert False, f"Job {job_id} did not complete within {max_poll_time} seconds, possible infinite loop"

    # Validate final completed or failed response
    assert "executable_verdict" in final_response, "executable_verdict missing in final response"
    verdict = final_response["executable_verdict"]

    # Allowed verdicts per PRD
    completed_verdicts = {"LIQUIDATE_LONGS", "HOLD", "ACCUMULATE", "IGNORE_FUD"}

    # Check verdict according to status
    if status == "failed":
        assert verdict == "INSUFFICIENT_DATA", "Failed job must have executable_verdict INSUFFICIENT_DATA"
        confidence = final_response.get("confidence")
        # Confidence should be null or None in failed
        assert confidence is None or confidence == 0 or confidence == 0.0, "Confidence should be null or 0 for failed status"
    else:
        # completed
        assert verdict in completed_verdicts, f"Unexpected executable_verdict: {verdict}"
        confidence = final_response.get("confidence")
        assert isinstance(confidence, (int, float)), "Confidence is not a number"
        assert 0.0 <= confidence <= 1.0, f"Confidence {confidence} outside valid range 0-1"

        # If completed, should contain expected fields (at minimum)
        assert "job_id" in final_response and final_response["job_id"] == job_id
        assert "coin_symbol" in final_response and final_response["coin_symbol"] == "AI"

    # Test passed successfully if reached here


test_post_api_agent_ambiguous_token_returns_honest_verdict_without_infinite_loop()
