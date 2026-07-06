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

## Phase 3 E2E Integration Grand Finale (TestSprite MCP Cloud)
**Target**: `http://localhost:3000/api/agent` (Fully integrated, tested via TestSprite MCP Cloud Tunneling)
**Date**: 2026-07-06
**Objective**: E2E verification of dynamic Dispatcher routing, ingestion merging, lightweight noise filtering, and heavyweight DeepSeek MCTS reasoning with ReAct loop capabilities.

### Execution Summary
- **Total Tests**: 5
- **Passed**: 5
- **Failed**: 0
- **Status**: ✅ 100% PASS (Executed via TestSprite MCP Tunnel)

### Test Cases Details
1. **TC001 post api agent valid EVM token returns structured verdict**
   - **Endpoint**: `/api/agent` (DOGE + contract_address + chain_id=1)
   - **Status**: ✅ Passed
   - **Dashboard**: [TestSprite Result](https://www.testsprite.com/dashboard/mcp/tests/0cdc5f2f-1860-4b0c-adc2-28c75f60cdde/a9ac7dba-859c-41e2-be94-e4ff4d7f8a39)
   - **Verification**: Fully validates the DeepSeek MCTS verdict schema.

2. **TC002 post api agent missing coin_symbol returns 400**
   - **Endpoint**: `/api/agent` (Empty payload)
   - **Status**: ✅ Passed
   - **Dashboard**: [TestSprite Result](https://www.testsprite.com/dashboard/mcp/tests/0cdc5f2f-1860-4b0c-adc2-28c75f60cdde/33e00523-aede-4910-acf6-d2b9287165e1)
   - **Verification**: Parameter validation checks and 400 Bad Request short-circuiting.

3. **TC003 post api agent native token without contract address returns 200**
   - **Endpoint**: `/api/agent` (BTC, contract_address omitted)
   - **Status**: ✅ Passed
   - **Dashboard**: [TestSprite Result](https://www.testsprite.com/dashboard/mcp/tests/0cdc5f2f-1860-4b0c-adc2-28c75f60cdde/6a5ccc11-071a-4ec6-a845-1bcbd383dc09)
   - **Verification**: Verifies dispatcher handles native tokens by bypassing on-chain DEX/security queries.

4. **TC004 post api agent Solana token with native contract address returns 200**
   - **Endpoint**: `/api/agent` (SOL, contract_address="native")
   - **Status**: ✅ Passed
   - **Dashboard**: [TestSprite Result](https://www.testsprite.com/dashboard/mcp/tests/0cdc5f2f-1860-4b0c-adc2-28c75f60cdde/c33e9775-1984-47e4-af2e-c43690c41b93)
   - **Verification**: Validates Solana native-token sentinel route routing and execution.

5. **TC005 post api agent unknown fake coin returns 200 with fallback indicators**
   - **Endpoint**: `/api/agent` (FAKECOIN999 + fake address)
   - **Status**: ✅ Passed
   - **Dashboard**: [TestSprite Result](https://www.testsprite.com/dashboard/mcp/tests/0cdc5f2f-1860-4b0c-adc2-28c75f60cdde/8a447f4f-8bee-4f58-a239-f7ca17768aa2)
   - **Verification**: Graceful fallback degradation schema verification.

### Sample E2E Verdict Response Payload (Live Output)
```json
{
  "request_id": "e5d54718-25a9-4a1e-af95-e4c75db08fd5",
  "coin_symbol": "DOGE",
  "drama_index": 20,
  "dominant_branch": "FUD irrelevant due to token mismatch",
  "branch_probabilities": {
    "FUD relevant": 0.1,
    "FUD irrelevant": 0.8,
    "Market sentiment spillover": 0.1
  },
  "evidence_chain": [
    "Token contract on Ethereum is not genuine DOGE (real DOGE is on its own blockchain)",
    "Order book spread extremely wide (bid 0.03508, ask 0.16282) indicating low liquidity",
    "DEX liquidity only $161k, volume $183k, suggesting a low-activity token",
    "CoinGecko price 0.00005214 and market cap 52k are inconsistent with real DOGE",
    "Security checks show no honeypot but open source false",
    "FUD claims reference real DOGE and broader market, not this specific token"
  ],
  "executable_verdict": "IGNORE_FUD",
  "confidence": 0.7,
  "served_from_cache": false,
  "fallback": false
}
```
