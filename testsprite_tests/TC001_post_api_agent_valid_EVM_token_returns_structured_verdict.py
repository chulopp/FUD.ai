import requests

def test_post_api_agent_valid_evm_token_returns_structured_verdict():
    base_url = "http://localhost:3000"
    endpoint = "/api/agent"
    url = base_url + endpoint

    headers = {
        "Content-Type": "application/json"
    }

    payload = {
        "coin_symbol": "DOGE",
        "contract_address": "0x4128d9511a07f40019a49aa8d90211597ac03199",
        "chain_id": "1"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=120)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Validate presence and types of required fields
    assert "request_id" in data and isinstance(data["request_id"], str) and data["request_id"], "Missing or invalid request_id"
    assert "coin_symbol" in data and data["coin_symbol"] == payload["coin_symbol"], "coin_symbol mismatch or missing"
    assert "drama_index" in data and isinstance(data["drama_index"], (int, float)) and 0 <= data["drama_index"] <= 100, "Invalid drama_index"
    assert "dominant_branch" in data and isinstance(data["dominant_branch"], str) and data["dominant_branch"], "Invalid dominant_branch"
    assert "branch_probabilities" in data and isinstance(data["branch_probabilities"], dict), "Missing or invalid branch_probabilities"
    assert "evidence_chain" in data and isinstance(data["evidence_chain"], list), "Missing or invalid evidence_chain"
    assert "executable_verdict" in data and data["executable_verdict"] in {"LIQUIDATE_LONGS", "HOLD", "ACCUMULATE", "IGNORE_FUD"}, "Invalid executable_verdict"
    assert "served_from_cache" in data and data["served_from_cache"] is False, "served_from_cache should be false"
    # fallback should be absent or false
    assert "fallback" not in data or data["fallback"] is False, "fallback should be absent or false"

test_post_api_agent_valid_evm_token_returns_structured_verdict()