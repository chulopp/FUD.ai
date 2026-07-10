"""
╔══════════════════════════════════════════════════════════════════════╗
║  SCENARIO 5 — DEMO QUOTA & RATE LIMIT SYNC                           ║
║  Uji Sinkronisasi Kuota & Batas Penggunaan                           ║
║                                                                      ║
║  Target   : TC009 - TC016 (Quota System & Rate Limit Sync)           ║
║                                                                      ║
║  Behaviour:                                                          ║
║    1. Generate a random fingerprint to simulate a fresh browser session║
1. Query GET /api/agent and assert usageCount is 0, limit is 2     ║
║    3. Fire first POST /api/agent, assert 202 Accepted.               ║
║    4. Fire second POST /api/agent, assert 202 Accepted.              ║
║    5. Fire third POST /api/agent, assert 403 Forbidden.              ║
║    6. Query GET /api/agent again, assert usageCount is 2, limit is 2.║
╚══════════════════════════════════════════════════════════════════════╝
"""

import requests
import random
import time

try:
    BASE_URL = TARGET_URL
except NameError:
    BASE_URL = "https://fud-ai.vercel.app"
API_URL = f"{BASE_URL}/api/agent"

def run_quota_sync_test():
    print("\n" + "=" * 60)
    print("SCENARIO 5 — DEMO QUOTA & RATE LIMIT SYNC TEST")
    print("=" * 60)

    # 1. Generate unique fingerprint
    fingerprint = f"test-fp-{random.randint(1000000, 9999999)}-{int(time.time())}"
    headers = {
        "Content-Type": "application/json",
        "X-Demo-Fingerprint": fingerprint
    }
    print(f"\n[Step 1] Simulated Browser Fingerprint: {fingerprint}")

    # 2. Check initial quota (fresh user)
    print("\n[Step 2] Querying initial quota state via GET...")
    resp = requests.get(API_URL, headers=headers, timeout=15)
    assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}"
    data = resp.json()
    print("Initial quota response:", data)
    assert data.get("usageCount") == 0, f"Expected 0 usageCount, got {data.get('usageCount')}"
    assert data.get("limit") == 2, f"Expected limit 2, got {data.get('limit')}"
    print("  [PASS] Fresh user usageCount is 0, limit is 2")

    # 3. First usage
    print("\n[Step 3] Firing first POST request (usage 1/2)...")
    payload = {"coin_symbol": "BTC"}
    resp = requests.post(API_URL, json=payload, headers=headers, timeout=15)
    assert resp.status_code == 202, f"Expected 202 Accepted, got {resp.status_code}"
    print("First usage response: 202 Accepted")
    print("  [PASS] First usage accepted")

    # 4. Second usage
    print("\n[Step 4] Firing second POST request (usage 2/2)...")
    payload = {"coin_symbol": "ETH"}
    resp = requests.post(API_URL, json=payload, headers=headers, timeout=15)
    assert resp.status_code == 202, f"Expected 202 Accepted, got {resp.status_code}"
    print("Second usage response: 202 Accepted")
    print("  [PASS] Second usage accepted")

    # 5. Third usage (Should be blocked by server rate limits)
    print("\n[Step 5] Firing third POST request (exceeding limit)...")
    payload = {"coin_symbol": "SOL"}
    resp = requests.post(API_URL, json=payload, headers=headers, timeout=15)
    assert resp.status_code == 403, f"Expected 403 Forbidden, got {resp.status_code}"
    data = resp.json()
    print("Third usage response (Blocked):", data)
    assert "error" in data, "Response body does not contain 'error' key"
    assert "limit reached" in data["error"].lower(), f"Unexpected error message: {data['error']}"
    print("  [PASS] Third usage was successfully blocked by rate limits")

    # 6. Verify quota count synced to 2 on server
    print("\n[Step 6] Querying updated quota state via GET...")
    resp = requests.get(API_URL, headers=headers, timeout=15)
    assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}"
    data = resp.json()
    print("Updated quota response:", data)
    assert data.get("usageCount") == 2, f"Expected 2 usageCount, got {data.get('usageCount')}"
    assert data.get("limit") == 2, f"Expected limit 2, got {data.get('limit')}"
    print("  [PASS] Server-side usageCount updated to 2, limit is 2")

    print("\n" + "=" * 60)
    print("SCENARIO 5 - ALL QUOTA ASSERTIONS PASSED")
    print("=" * 60)

if __name__ == "__main__":
    run_quota_sync_test()
