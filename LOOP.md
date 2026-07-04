# TestSprite Verification Loop

Last Checked: 2026-07-04T11:33:20Z
Endpoint: https://reword-situated-barman.ngrok-free.dev/api/agent
Method: POST

### Native TestSprite Results
- **Test ID**: `c603e19e-33b9-4782-9adf-78f656ce1f14`
- **Dashboard**: [TestSprite Result](https://www.testsprite.com/dashboard/tests/efd7c80f-4eb2-421b-9f92-c1a629004147/test/c603e19e-33b9-4782-9adf-78f656ce1f14)
- **Status**: ✅ PASS
- **Verified Fields**: `sentiment` (enum), `confidence` (number), `reasoning` (string)

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
