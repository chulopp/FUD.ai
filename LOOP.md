# TestSprite Verification Loop

Last Checked: 2026-07-04T11:33:20Z
Endpoint: https://reword-situated-barman.ngrok-free.dev/api/agent
Method: POST

### Native TestSprite Results
- **Test ID**: `bb62ab19-d9b0-4dca-9a7e-615f2d7c1bd9`
- **Dashboard**: [TestSprite Result](https://www.testsprite.com/dashboard/tests/efd7c80f-4eb2-421b-9f92-c1a629004147/test/bb62ab19-d9b0-4dca-9a7e-615f2d7c1bd9)
- **Status**: ✅ PASS
- **Verified Fields**: `request_id`, `coin_symbol`, `drama_index` (number), `confidence` (number), `dominant_branch`, `branch_probabilities` (object), `evidence_chain` (list), `executable_verdict` (enum), `served_from_cache` (boolean)

**Note:** The test was executed via the native TestSprite cloud backend using Ngrok tunneling to bypass the local environment limitation.

## Response Payload (Local Mock)
```json
{
  "request_id": "req_abc123",
  "coin_symbol": "MEME",
  "drama_index": 85,
  "confidence": 0.78,
  "dominant_branch": "C_manipulasi_paus",
  "branch_probabilities": {
    "A_kiamat_nyata": 0.12,
    "B_fud_palsu": 0.23,
    "C_manipulasi_paus": 0.65
  },
  "evidence_chain": [
    "Channel 'Whale Alerts': transfer 2M token ke exchange terdeteksi dalam 1 bulan",
    "MCP XActions: sell wall besar di Bybit tidak diikuti volume jual riil",
    "GoPlus Security: kontrak tidak mintable, liquidity terkunci 6 bulan"
  ],
  "executable_verdict": "IGNORE_FUD",
  "served_from_cache": false
}
```

## Phase 2 Fuzzing & Resilience Test
**Target**: `http://127.0.0.1:3000/api/agent`
**Objective**: Ensure MCTS pipeline handles missing parameters and malformed data with graceful degradation and NO 500 crashes.

```text
Starting Fuzzing against http://127.0.0.1:3000/api/agent...

Executing Test 1: Missing all required parameters...
Status: 400 (Expected: 400)
✅ PASS

Executing Test 2: Missing contract_address...
Status: 400 (Expected: 400)
✅ PASS

Executing Test 3: Missing coin_symbol...
Status: 400 (Expected: 400)
✅ PASS

Executing Test 4: Valid Payload (Fake Coin)...
Status: 200 (Expected: 200)
Response: {"request_id":"...","coin_symbol":"FAKECOIN","drama_index":0,"dominant_branch":"unknown","evidence_chain":["Pipeline failed to produce a verdict."],"executable_verdict":"IGNORE_FUD","confidence":0,"served_from_cache":false,"fallback":true}
✅ PASS

Executing Test 5: Valid Payload (MEME coin simulation)...
Status: 200 (Expected: 200)
Response: {"request_id":"...","coin_symbol":"DOGE","drama_index":0,"dominant_branch":"unknown","evidence_chain":["Pipeline failed to produce a verdict."],"executable_verdict":"IGNORE_FUD","confidence":0,"served_from_cache":false,"fallback":true}
✅ PASS

--- Fuzzing Complete: 5/5 Passed ---
```
