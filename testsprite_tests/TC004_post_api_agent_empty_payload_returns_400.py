import requests

def test_post_api_agent_empty_payload_returns_400():
    url = "http://localhost:3000/api/agent"
    headers = {'Content-Type': 'application/json'}
    try:
        response = requests.post(url, headers=headers, json={}, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    assert response.status_code == 400, f"Expected status 400 but got {response.status_code}"
    try:
        body = response.json()
    except ValueError:
        assert False, "Response is not a valid JSON"
    assert "error" in body, "Response JSON does not contain 'error' field"
    assert isinstance(body["error"], str) and body["error"], "'error' field must be a non-empty string"

test_post_api_agent_empty_payload_returns_400()