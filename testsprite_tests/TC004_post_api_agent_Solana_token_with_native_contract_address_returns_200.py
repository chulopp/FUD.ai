import requests
import time

BASE_URL = "http://localhost:3000"
TIMEOUT = 30
POLL_INTERVAL = 5

def test_post_api_agent_solana_token_native_contract_address():
    post_url = f"{BASE_URL}/api/agent"
    headers = {"Content-Type": "application/json"}
    payload = {
        "coin_symbol": "SOL",
        "contract_address": "native"
    }
    try:
        # Step 1: POST /api/agent with specified payload
        post_resp = requests.post(post_url, json=payload, headers=headers, timeout=TIMEOUT)
        assert post_resp.status_code == 202, f"Expected status 202, got {post_resp.status_code}"
        post_data = post_resp.json()

        # Validate presence of job_id and poll_url
        job_id = post_data.get("job_id")
        poll_url = post_data.get("poll_url")
        assert isinstance(job_id, str) and len(job_id) > 0, "Missing or invalid job_id"
        assert isinstance(poll_url, str) and poll_url.startswith("/api/agent/"), "Invalid poll_url"

        # Step 2: Poll GET /api/agent/[job_id] until status is 'completed'
        get_url = f"{BASE_URL}{poll_url}"
        max_polls = 60  # max 5 minutes
        for _ in range(max_polls):
            get_resp = requests.get(get_url, timeout=TIMEOUT)
            assert get_resp.status_code == 200, f"Expected 200 on GET, got {get_resp.status_code}"
            get_data = get_resp.json()
            status = get_data.get("status")
            if status == "completed":
                # Validate final response schema fields
                # required fields: request_id (string), coin_symbol (matches request),
                # drama_index (0-100 number), dominant_branch (non-empty string),
                # branch_probabilities (object), evidence_chain (array),
                # executable_verdict (one of LIQUIDATE_LONGS|HOLD|ACCUMULATE|IGNORE_FUD),
                # served_from_cache (boolean), fallback (boolean or absent),
                # pipeline_elapsed_ms (number)
                request_id = get_data.get("request_id")
                coin_symbol = get_data.get("coin_symbol")
                drama_index = get_data.get("drama_index")
                dominant_branch = get_data.get("dominant_branch")
                branch_probabilities = get_data.get("branch_probabilities")
                evidence_chain = get_data.get("evidence_chain")
                executable_verdict = get_data.get("executable_verdict")
                served_from_cache = get_data.get("served_from_cache")
                fallback = get_data.get("fallback", False)
                pipeline_elapsed_ms = get_data.get("pipeline_elapsed_ms")

                assert isinstance(request_id, str) and len(request_id) > 0, "Missing or invalid request_id"
                assert coin_symbol == "SOL", f"coin_symbol mismatch: expected 'SOL', got {coin_symbol}"
                assert isinstance(drama_index, (int, float)) and 0 <= drama_index <= 100, "Invalid drama_index"
                assert isinstance(dominant_branch, str) and len(dominant_branch) > 0, "Missing dominant_branch"
                assert isinstance(branch_probabilities, dict) and len(branch_probabilities) > 0, "Invalid branch_probabilities"
                assert isinstance(evidence_chain, list), "evidence_chain should be a list"
                valid_verdicts = {"LIQUIDATE_LONGS", "HOLD", "ACCUMULATE", "IGNORE_FUD"}
                assert executable_verdict in valid_verdicts, f"Invalid executable_verdict: {executable_verdict}"
                assert isinstance(served_from_cache, bool), "served_from_cache should be boolean"
                assert isinstance(fallback, bool), "fallback should be boolean"
                assert isinstance(pipeline_elapsed_ms, (int, float)) and pipeline_elapsed_ms >= 0, "Invalid pipeline_elapsed_ms"
                return
            elif status in ("pending", "running"):
                time.sleep(POLL_INTERVAL)
            else:
                assert False, f"Unexpected status: {status}"
        assert False, "Polling timed out before job completion"
    except requests.RequestException as e:
        assert False, f"HTTP request failed: {e}"

test_post_api_agent_solana_token_native_contract_address()