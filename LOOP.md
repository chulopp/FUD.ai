# TestSprite Verification Loop

Last Checked: 2026-07-04T11:13:33.818Z
Endpoint: http://localhost:3000/api/agent
Method: POST

## Test Execution Status
- **Status:** PASS
- **Schema Validation:** SUCCESS

## Response Payload
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
    "Channel 'Whale Alerts': transfer 2M token ke exchange terdeteksi",
    "MCP XActions: sell wall besar di Bybit tidak diikuti volume jual riil",
    "GoPlus Security: kontrak tidak mintable, liquidity terkunci 6 bulan"
  ],
  "executable_verdict": "IGNORE_FUD",
  "served_from_cache": false
}
```

## Logs
- Successfully sent POST request to http://localhost:3000/api/agent
- Validated all 9 required keys
- Validated types for drama_index, confidence, evidence_chain, and branch_probabilities
