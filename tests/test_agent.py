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
        
        # Validate the VERDICT schema
        assert "sentiment" in data, "Missing 'sentiment'"
        assert data["sentiment"] in ["BULLISH", "BEARISH", "NEUTRAL"], f"Invalid sentiment: {data['sentiment']}"
        assert "confidence" in data, "Missing 'confidence'"
        assert isinstance(data["confidence"], (int, float)), "Confidence must be a number"
        assert "reasoning" in data, "Missing 'reasoning'"
        
        print("PASS: Schema validation successful.")
        sys.exit(0)
    except Exception as e:
        print(f"FAIL: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
