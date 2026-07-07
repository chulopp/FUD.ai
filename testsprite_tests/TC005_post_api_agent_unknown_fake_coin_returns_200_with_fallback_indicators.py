import requests
import time
import uuid

BASE_URL = "http://localhost:3000"
TIMEOUT = 30
POLL_INTERVAL = 5


def test_post_api_agent_unknown_fake_coin_returns_200_with_fallback_indicators():
    post_url = f"{BASE_URL}/api/agent"
    fake_coin_symbol = "FAKECOIN999"
    fake_contract_address = str(uuid.uuid4()).replace("-", "")  # random fake contract address

    headers = {
        "Content-Type": "application/json",
    }
    payload = {
        "coin_symbol": fake_coin_symbol,
        "contract_address": fake_contract_address
    }

    # Step 1: POST to start the job
    try:
        post_response = requests.post(post_url, json=payload, headers=headers, timeout=TIMEOUT)
        assert post_response.status_code == 202, f"Expected status code 202 but got {post_response.status_code}"
        post_json = post_response.json()
        # Validate POST response schema
        assert "job_id" in post_json and isinstance(post_json["job_id"], str) and len(post_json["job_id"]) > 0
        assert post_json["status"] in ("pending", "running")
        assert post_json.get("coin_symbol") == fake_coin_symbol
        assert "poll_url" in post_json and post_json["poll_url"].startswith("/api/agent/")
        assert "message" in post_json and isinstance(post_json["message"], str)

        job_id = post_json["job_id"]
        poll_url = f"{BASE_URL}{post_json['poll_url']}"

        # Step 2: Poll GET /api/agent/[job_id] every 5 seconds until status completed
        max_polls = 60  # max 5 minutes timeout
        final_response_json = None
        for _ in range(max_polls):
            get_response = requests.get(poll_url, timeout=TIMEOUT)
            assert get_response.status_code == 200, f"Polling GET returned unexpected status {get_response.status_code}"
            get_json = get_response.json()
            status = get_json.get("status")
            assert "job_id" in get_json and get_json["job_id"] == job_id
            assert "coin_symbol" in get_json and get_json["coin_symbol"] == fake_coin_symbol
            if status == "completed":
                final_response_json = get_json
                break
            elif status in ("pending", "running"):
                # still processing
                time.sleep(POLL_INTERVAL)
            else:
                # unexpected status
                assert False, f"Unexpected job status during polling: {status}"

        assert final_response_json is not None, "Polling timed out without job completing"

        # Step 3: Validate final completed JSON response fields
        comp_json = final_response_json

        # Required fields per completed response:
        # job_id:string UUID
        # coin_symbol:string
        # status:"completed"
        # request_id:string UUID
        # drama_index:number 0-100
        # dominant_branch:string non-empty
        # branch_probabilities:object with numeric 0-1 values
        # evidence_chain: array of strings
        # executable_verdict: one of LIQUIDATE_LONGS|HOLD|ACCUMULATE|IGNORE_FUD
        # confidence: number (0-1) optional
        # served_from_cache: boolean (bool)
        # fallback: boolean (bool)
        # pipeline_elapsed_ms: number

        assert comp_json["status"] == "completed"
        assert isinstance(comp_json.get("request_id"), str) and len(comp_json["request_id"]) > 0
        assert comp_json.get("coin_symbol") == fake_coin_symbol
        assert isinstance(comp_json.get("drama_index"), (int, float)) and 0 <= comp_json["drama_index"] <= 100
        assert isinstance(comp_json.get("dominant_branch"), str) and len(comp_json["dominant_branch"]) > 0
        branch_probs = comp_json.get("branch_probabilities")
        assert isinstance(branch_probs, dict) and len(branch_probs) > 0
        for v in branch_probs.values():
            assert isinstance(v, (int, float)) and 0 <= v <= 1
        evidence_chain = comp_json.get("evidence_chain")
        assert isinstance(evidence_chain, list)
        for item in evidence_chain:
            assert isinstance(item, str)
        assert comp_json.get("executable_verdict") in ("LIQUIDATE_LONGS", "HOLD", "ACCUMULATE", "IGNORE_FUD")
        confidence = comp_json.get("confidence")
        if confidence is not None:
            assert isinstance(confidence, (int, float)) and 0 <= confidence <= 1
        assert isinstance(comp_json.get("served_from_cache"), bool)
        assert isinstance(comp_json.get("fallback"), bool)
        assert isinstance(comp_json.get("pipeline_elapsed_ms"), (int, float))

        # Additional check as per instructions:
        # fallback should be true OR still returns a valid MCTS verdict (executable_verdict validated above)
        assert comp_json["fallback"] is True or comp_json["executable_verdict"] in ("LIQUIDATE_LONGS", "HOLD", "ACCUMULATE", "IGNORE_FUD")

        # Coordination & Sybil Detection module checks for coordination_signals field when completed
        coord_signals = comp_json.get("coordination_signals")
        assert isinstance(coord_signals, dict), "coordination_signals field missing or not a dictionary"
        # The coordination_signals must have these fields:
        assert "unique_author_ratio" in coord_signals and isinstance(coord_signals["unique_author_ratio"], (int, float))
        assert "duplicate_text_cluster_size" in coord_signals and isinstance(coord_signals["duplicate_text_cluster_size"], (int, float))
        assert "cross_platform_burst_window_minutes" in coord_signals and isinstance(coord_signals["cross_platform_burst_window_minutes"], (int, float))
    except requests.RequestException as e:
        assert False, f"HTTP request failed: {str(e)}"


test_post_api_agent_unknown_fake_coin_returns_200_with_fallback_indicators()