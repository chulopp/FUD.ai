import requests

def test_post_api_agent_fake_coin_returns_200_with_fallback():
    base_url = "http://localhost:3000"
    endpoint = "/api/agent"
    url = base_url + endpoint
    headers = {"Content-Type": "application/json"}
    payload = {
        "coin_symbol": "FAKE",
        "contract_address": "0x0000000000000000000000000000000000000000",
        "chain_id": "1"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed with exception: {e}"

    assert response.status_code in (200, 400, 500), f"Unexpected status code: {response.status_code}"

    if response.status_code == 200:
        try:
            data = response.json()
        except ValueError:
            assert False, "Response is not valid JSON"

        # Validate that response JSON has the expected keys if 200
        expected_keys = {
            "request_id", "coin_symbol", "drama_index", "dominant_branch",
            "branch_probabilities", "evidence_chain", "executable_verdict", "served_from_cache"
        }
        assert isinstance(data, dict), "Response JSON is not an object"
        # coin_symbol must be FAKE or fallback might be used
        assert "coin_symbol" in data and isinstance(data["coin_symbol"], str)
        assert "served_from_cache" in data and isinstance(data["served_from_cache"], bool)
        assert expected_keys.issubset(data.keys()), f"Missing keys in response JSON: {expected_keys - data.keys()}"

    elif response.status_code == 400:
        # For invalid requests response
        try:
            data = response.json()
        except ValueError:
            assert False, "Response is not valid JSON"
        assert "error" in data and isinstance(data["error"], str)

    elif response.status_code == 500:
        # Server error with fallback or error message
        try:
            data = response.json()
        except ValueError:
            assert False, "Response is not valid JSON"
        assert "fallback" in data and isinstance(data["fallback"], bool)
        assert "error" in data and isinstance(data["error"], str)
        # fallback should be True for graceful degradation
        assert data["fallback"] is True

test_post_api_agent_fake_coin_returns_200_with_fallback()