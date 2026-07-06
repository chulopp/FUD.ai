import requests

def test_post_api_agent_missing_coin_symbol_returns_400():
    base_url = "http://localhost:3000"
    endpoint = "/api/agent"
    url = base_url + endpoint
    headers = {"Content-Type": "application/json"}
    payload = {}

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=120)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 400, f"Expected status code 400, got {response.status_code}"

    try:
        json_resp = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert "error" in json_resp, "Response JSON does not contain 'error' field"
    assert isinstance(json_resp["error"], str) and "coin_symbol" in json_resp["error"].lower(), \
        "Error message does not mention missing 'coin_symbol' parameter"

test_post_api_agent_missing_coin_symbol_returns_400()