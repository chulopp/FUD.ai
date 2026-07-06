import requests

def test_post_api_agent_solana_token_native_contract():
    base_url = "http://localhost:3000"
    endpoint = "/api/agent"
    url = base_url + endpoint
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "coin_symbol": "SOL",
        "contract_address": "native"
    }
    timeout = 120

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=timeout)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status 200, got {response.status_code}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Validate required fields presence and types
    required_fields = {
        "request_id": str,
        "coin_symbol": str,
        "drama_index": (int, float),
        "dominant_branch": str,
        "branch_probabilities": dict,
        "evidence_chain": list,
        "executable_verdict": str,
        "served_from_cache": bool
    }
    for field, field_type in required_fields.items():
        assert field in data, f"Missing field in response JSON: {field}"
        assert isinstance(data[field], field_type), f"Field {field} has incorrect type: expected {field_type}, got {type(data[field])}"

    # Validate coin_symbol matches the request
    assert data["coin_symbol"].upper() == "SOL", f"coin_symbol mismatch: expected 'SOL', got '{data['coin_symbol']}'"

    # Validate drama_index range 0-100
    drama_index = data["drama_index"]
    assert 0 <= drama_index <= 100, f"drama_index out of range 0-100: got {drama_index}"

    # Validate dominant_branch is non-empty string
    assert len(data["dominant_branch"].strip()) > 0, "dominant_branch is empty"

    # Validate branch_probabilities values are between 0 and 1
    for branch, prob in data["branch_probabilities"].items():
        assert isinstance(branch, str), f"Branch name is not string: {branch}"
        assert isinstance(prob, (int,float)), f"Probability is not numeric for branch {branch}"
        assert 0 <= prob <= 1, f"Probability for branch {branch} out of 0-1 range: {prob}"

    # Validate evidence_chain is list of strings (can be empty)
    assert all(isinstance(item, str) for item in data["evidence_chain"]), "evidence_chain must be array of strings"

    # Validate executable_verdict is one of allowed values
    valid_verdicts = {"LIQUIDATE_LONGS", "HOLD", "ACCUMULATE", "IGNORE_FUD"}
    assert data["executable_verdict"] in valid_verdicts, f"Invalid executable_verdict: {data['executable_verdict']}"

    # served_from_cache is boolean, no specific value required here

    # fallback is optional - if present, must be boolean
    if "fallback" in data:
        assert isinstance(data["fallback"], bool), "fallback field must be boolean if present"

test_post_api_agent_solana_token_native_contract()