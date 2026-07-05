import requests

def test_post_api_agent_missing_coin_symbol_returns_400():
    url = "http://localhost:3000/api/agent"
    headers = {
        "Content-Type": "application/json"
    }
    # Body with missing coin_symbol
    payload = {
        "contract_address": "0x1234567890abcdef1234567890abcdef12345678",
        "chain_id": "1"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 400, f"Expected status code 400 but got {response.status_code}"

    try:
        json_response = response.json()
    except ValueError:
        assert False, "Response is not JSON"

    assert "error" in json_response, "Response JSON should contain 'error' key"
    assert isinstance(json_response["error"], str) and len(json_response["error"]) > 0, "Error message should be a non-empty string"


test_post_api_agent_missing_coin_symbol_returns_400()