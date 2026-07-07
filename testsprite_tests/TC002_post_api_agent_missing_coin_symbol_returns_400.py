import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def test_post_api_agent_missing_coin_symbol_returns_400():
    url = f"{BASE_URL}/api/agent"
    payload = {}
    headers = {
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 400, f"Expected status code 400 but got {response.status_code}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert "error" in data, "Response JSON does not contain 'error' field"
    assert "coin_symbol" in data["error"].lower(), "Error message does not mention missing coin_symbol"

test_post_api_agent_missing_coin_symbol_returns_400()