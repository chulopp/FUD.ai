import requests

def test_post_api_agent_native_token_btc_no_contract_address():
    base_url = "http://localhost:3000"
    url = f"{base_url}/api/agent"
    headers = {
        "Content-Type": "application/json",
    }
    payload = {
        "coin_symbol": "BTC"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=120)
        assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
        data = response.json()
        # Check required fields exist
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
            assert field in data, f"Missing field '{field}' in response JSON"
        # Validate types and content basics
        assert isinstance(data["request_id"], str) and data["request_id"], "request_id should be a non-empty string"
        assert data["coin_symbol"] == "BTC", f"coin_symbol should be 'BTC', got {data['coin_symbol']}"
        assert isinstance(data["drama_index"], (int, float)) and 0 <= data["drama_index"] <= 100, "drama_index should be number 0-100"
        assert isinstance(data["dominant_branch"], str) and data["dominant_branch"], "dominant_branch should be a non-empty string"
        assert isinstance(data["branch_probabilities"], dict), "branch_probabilities should be an object"
        assert isinstance(data["evidence_chain"], list), "evidence_chain should be an array"
        valid_verdicts = {"LIQUIDATE_LONGS", "HOLD", "ACCUMULATE", "IGNORE_FUD"}
        assert data["executable_verdict"] in valid_verdicts, f"executable_verdict must be one of {valid_verdicts}"
        assert isinstance(data["served_from_cache"], bool), "served_from_cache should be boolean"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    except ValueError:
        assert False, "Response is not a valid JSON"

test_post_api_agent_native_token_btc_no_contract_address()