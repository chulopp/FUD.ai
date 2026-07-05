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

## Phase 2 Fuzzing & Resilience Test (TestSprite MCP)
**Target**: `http://localhost:3000/api/agent` (Tested via TestSprite MCP Tunneling)
**Date**: 2026-07-05
**Objective**: Stress-test `/api/agent` to verify parameter validation, graceful degradation, and stability under load (no 500 server crashes).

### Execution Summary
- **Total Tests**: 5
- **Passed**: 5
- **Failed**: 0
- **Status**: ✅ 100% PASS

### Test Cases Details
1. **TC001 post api agent valid request returns analysis verdict**
   - **Endpoint**: `http://localhost:3000/api/agent`
   - **Status**: ✅ Passed
   - **Dashboard**: [TestSprite Result](https://www.testsprite.com/dashboard/mcp/tests/4fd382bb-67c1-476d-80e4-bb1ec70efc1f/414da688-fcea-4931-b525-9f790faaa84f)
   - **Response Check**: Confirms schema contains all required fields (`request_id`, `drama_index`, `dominant_branch`, `branch_probabilities`, `evidence_chain`, `executable_verdict`, etc.).

2. **TC002 post api agent missing coin_symbol returns 400**
   - **Endpoint**: `http://localhost:3000/api/agent`
   - **Status**: ✅ Passed
   - **Dashboard**: [TestSprite Result](https://www.testsprite.com/dashboard/mcp/tests/4fd382bb-67c1-476d-80e4-bb1ec70efc1f/280902c7-145a-4ceb-8251-ca9f41e9d85d)
   - **Response Check**: Confirms a clean 400 response with descriptive error message.

3. **TC003 post api agent missing contract_address returns 400**
   - **Endpoint**: `http://localhost:3000/api/agent`
   - **Status**: ✅ Passed
   - **Dashboard**: [TestSprite Result](https://www.testsprite.com/dashboard/mcp/tests/4fd382bb-67c1-476d-80e4-bb1ec70efc1f/ada02e85-e68e-48ca-b2b9-3f3d61173e54)
   - **Response Check**: Confirms a clean 400 response with descriptive error message.

4. **TC004 post api agent empty payload returns 400**
   - **Endpoint**: `http://localhost:3000/api/agent`
   - **Status**: ✅ Passed
   - **Dashboard**: [TestSprite Result](https://www.testsprite.com/dashboard/mcp/tests/4fd382bb-67c1-476d-80e4-bb1ec70efc1f/c71e5e77-a4b9-451c-bc42-82fe327c11c2)
   - **Response Check**: Rejects empty payloads with a 400 Bad Request response.

5. **TC005 post api agent fake coin returns 200 with fallback**
   - **Endpoint**: `http://localhost:3000/api/agent`
   - **Status**: ✅ Passed
   - **Dashboard**: [TestSprite Result](https://www.testsprite.com/dashboard/mcp/tests/4fd382bb-67c1-476d-80e4-bb1ec70efc1f/e300383e-af69-4e1f-9b36-7cbce052e7c5)
   - **Response Check**: Confirms graceful fallback returns a 200 response with `fallback: true` and all schema fields (including `branch_probabilities: {}` and `confidence: 0`) fully populated without causing any server crashes.
