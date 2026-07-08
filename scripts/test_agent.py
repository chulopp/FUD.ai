import os
import requests
import json
import sys

def main():
    # TestSprite passes the target URL via TARGET_URL or BASE_URL
    target_url = os.environ.get("TARGET_URL") or os.environ.get("BASE_URL")
    
    if not target_url:
        print("ERROR: No target URL provided in environment.")
        sys.exit(1)
        
    endpoint = f"{target_url.rstrip('/')}/api/agent"
    print(f"Testing endpoint: {endpoint}")
    
    payload = {
        "tweet": "$SOL is going to zero, absolute garbage tech",
        "market_context": "Overall market is slightly bearish"
    }
    
    try:
        response = requests.post(endpoint, json=payload, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        # Assert status code
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print(f"Response JSON: {json.dumps(data, indent=2)}")
        
        # Validate the EXACT VERDICT schema from PRD_ERD.md
        assert "request_id" in data, "Missing 'request_id'"
        assert "coin_symbol" in data, "Missing 'coin_symbol'"
        
        assert "drama_index" in data, "Missing 'drama_index'"
        assert isinstance(data["drama_index"], (int, float)), "drama_index must be a number"
        
        assert "confidence" in data, "Missing 'confidence'"
        assert isinstance(data["confidence"], (int, float)), "confidence must be a number"
        
        assert "dominant_branch" in data, "Missing 'dominant_branch'"
        
        assert "branch_probabilities" in data, "Missing 'branch_probabilities'"
        assert isinstance(data["branch_probabilities"], dict), "branch_probabilities must be an object"
        
        assert "evidence_chain" in data, "Missing 'evidence_chain'"
        assert isinstance(data["evidence_chain"], list), "evidence_chain must be a list"
        
        assert "executable_verdict" in data, "Missing 'executable_verdict'"
        assert data["executable_verdict"] in ["LIQUIDATE_LONGS", "HOLD", "ACCUMULATE", "IGNORE_FUD"], f"Invalid executable_verdict: {data['executable_verdict']}"
        
        assert "served_from_cache" in data, "Missing 'served_from_cache'"
        assert isinstance(data["served_from_cache"], bool), "served_from_cache must be boolean"
        
        print("PASS: Schema validation successful.")
        sys.exit(0)
    except Exception as e:
        print(f"FAIL: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
