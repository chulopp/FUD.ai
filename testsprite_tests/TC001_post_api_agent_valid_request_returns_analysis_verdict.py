import requests

def test_post_api_agent_valid_request_returns_analysis_verdict():
    base_url = "http://localhost:3000"
    endpoint = "/api/agent"
    url = f"{base_url}{endpoint}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "coin_symbol": "DOGE",
        "contract_address": "0x1234567890abcdef1234567890abcdef12345678",
        "chain_id": "1"
    }
    timeout = 30

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=timeout)
    except requests.RequestException as e:
        assert False, f"HTTP request failed: {e}"

    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Validate required fields in the response
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
        assert field in data, f"Missing '{field}' in response JSON"

    # Validate data types
    assert isinstance(data["request_id"], str), "request_id should be a string"
    assert data["coin_symbol"] == "DOGE", "coin_symbol in response should match the request"
    assert isinstance(data["drama_index"], (int, float)), "drama_index should be a number"
    assert isinstance(data["dominant_branch"], str), "dominant_branch should be a string"
    assert isinstance(data["branch_probabilities"], dict), "branch_probabilities should be an object"
    assert isinstance(data["evidence_chain"], list), "evidence_chain should be an array"
    assert isinstance(data["executable_verdict"], str), "executable_verdict should be a string"
    assert isinstance(data["served_from_cache"], bool), "served_from_cache should be a boolean"

test_post_api_agent_valid_request_returns_analysis_verdict()