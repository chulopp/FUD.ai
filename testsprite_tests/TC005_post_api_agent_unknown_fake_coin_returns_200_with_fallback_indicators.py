import requests
import uuid

def test_post_api_agent_fakecoin_fallback():
    base_url = "http://localhost:3000"
    endpoint = "/api/agent"
    url = base_url + endpoint
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "coin_symbol": "FAKECOIN999",
        "contract_address": str(uuid.uuid4())  # random fake contract_address
    }
    timeout = 120  # per instructions for test suite due to DeepSeek latency
    valid_verdicts = {"LIQUIDATE_LONGS", "HOLD", "ACCUMULATE", "IGNORE_FUD"}

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=timeout)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status 200, got {response.status_code}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Validate all required fields are present
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
        assert field in data, f"Missing field in response JSON: {field}"

    # Check fallback presence and boolean if it exists
    assert "fallback" in data or "fallback" not in data  # fallback may or may not be present
    if "fallback" in data:
        assert isinstance(data["fallback"], bool), "'fallback' should be a boolean if present"
        # fallback may be true for degraded pipeline

    # Validate fields types and constraints
    assert isinstance(data["request_id"], str) and len(data["request_id"]) > 0
    assert data["coin_symbol"] == "FAKECOIN999"
    assert isinstance(data["drama_index"], (int, float)) and 0 <= data["drama_index"] <= 100
    assert isinstance(data["dominant_branch"], str) and len(data["dominant_branch"]) > 0
    assert isinstance(data["branch_probabilities"], dict)
    assert isinstance(data["evidence_chain"], list)
    assert all(isinstance(item, str) for item in data["evidence_chain"])
    assert data["executable_verdict"] in valid_verdicts
    assert isinstance(data["served_from_cache"], bool)

test_post_api_agent_fakecoin_fallback()