import requests
import time

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def test_post_api_agent_solana_token_native_contract_address():
    post_url = f"{BASE_URL}/api/agent"
    headers = {
        "Content-Type": "application/json"
    }
    post_payload = {
        "coin_symbol": "SOL",
        "contract_address": "native"
    }

    try:
        # Step 1: POST request to submit analysis job
        post_resp = requests.post(post_url, json=post_payload, headers=headers, timeout=TIMEOUT)
        assert post_resp.status_code == 202, f"Expected status 202 but got {post_resp.status_code}"
        post_data = post_resp.json()
        
        # Validate required fields in POST response
        assert "job_id" in post_data and isinstance(post_data["job_id"], str) and post_data["job_id"], "Missing or invalid job_id"
        assert "poll_url" in post_data and isinstance(post_data["poll_url"], str) and post_data["poll_url"], "Missing or invalid poll_url"
        assert post_data.get("status") in ("pending", "running"), f"Unexpected status '{post_data.get('status')}'"
        assert post_data.get("coin_symbol") == "SOL", f"Expected coin_symbol 'SOL', got '{post_data.get('coin_symbol')}'"

        job_id = post_data["job_id"]
        poll_url = f"{BASE_URL}{post_data['poll_url']}"

        # Step 2: Poll GET /api/agent/[job_id] every 5 seconds until status is completed or timeout after 5 mins
        max_poll_time_secs = 300
        poll_interval_secs = 5
        elapsed = 0
        final_response = None

        while elapsed < max_poll_time_secs:
            get_resp = requests.get(poll_url, timeout=TIMEOUT)
            assert get_resp.status_code == 200, f"Polling: Expected 200 but got {get_resp.status_code}"
            get_data = get_resp.json()
            status = get_data.get("status")
            assert get_data.get("job_id") == job_id, "Mismatched job_id in poll response"
            assert get_data.get("coin_symbol") == "SOL", "Mismatched coin_symbol in poll response"

            if status == "completed":
                final_response = get_data
                break
            elif status in ("pending", "running"):
                time.sleep(poll_interval_secs)
                elapsed += poll_interval_secs
            else:
                assert False, f"Unexpected status '{status}' during polling"

        assert final_response is not None, "Timeout polling for job completion"

        # Step 3: Verify required fields present in completed response JSON
        required_fields = [
            "job_id",
            "coin_symbol",
            "status",
            "drama_index",
            "dominant_branch",
            "branch_probabilities",
            "evidence_chain",
            "executable_verdict",
            "pipeline_elapsed_ms"
        ]

        for field in required_fields:
            assert field in final_response, f"Missing required field '{field}' in completed response"

        assert final_response["status"] == "completed", f"Final status is not completed but {final_response['status']}"
        
        # Validate specific field types and values
        assert isinstance(final_response["drama_index"], (int, float)) and 0 <= final_response["drama_index"] <= 100, "Invalid drama_index"
        assert isinstance(final_response["branch_probabilities"], dict) and len(final_response["branch_probabilities"]) > 0, "Invalid branch_probabilities"
        assert isinstance(final_response["evidence_chain"], list), "Invalid evidence_chain"
        assert final_response["executable_verdict"] in ["LIQUIDATE_LONGS", "HOLD", "ACCUMULATE", "IGNORE_FUD"], "Invalid executable_verdict"
        assert isinstance(final_response["pipeline_elapsed_ms"], (int, float)) and final_response["pipeline_elapsed_ms"] >= 0, "Invalid pipeline_elapsed_ms"
        # confidence is optional but if present must be between 0 and 1
        if "confidence" in final_response and final_response["confidence"] is not None:
            assert 0 <= final_response["confidence"] <= 1, "Invalid confidence value"

    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_post_api_agent_solana_token_native_contract_address()
