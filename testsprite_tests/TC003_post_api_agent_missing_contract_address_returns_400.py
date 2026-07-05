import requests

def test_post_api_agent_missing_contract_address_returns_400():
    base_url = "http://localhost:3000"
    endpoint = "/api/agent"
    url = base_url + endpoint
    headers = {
        "Content-Type": "application/json"
    }
    # Missing contract_address in payload
    payload = {
        "coin_symbol": "DOGE",
        "chain_id": "1"
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 400, f"Expected status 400, got {response.status_code}"
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert "error" in data, "Response JSON missing 'error' key"
    assert isinstance(data["error"], str) and data["error"], "'error' should be a non-empty string"

test_post_api_agent_missing_contract_address_returns_400()