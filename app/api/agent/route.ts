import { NextResponse } from 'next/server';

export async function POST() {
  const dummyVerdict = {
    request_id: "req_abc123",
    coin_symbol: "MEME",
    drama_index: 85,
    confidence: 0.78,
    dominant_branch: "C_manipulasi_paus",
    branch_probabilities: {
      A_kiamat_nyata: 0.12,
      B_fud_palsu: 0.23,
      C_manipulasi_paus: 0.65,
    },
    evidence_chain: [
      "Channel 'Whale Alerts': transfer 2M token ke exchange terdeteksi",
      "MCP XActions: sell wall besar di Bybit tidak diikuti volume jual riil",
      "GoPlus Security: kontrak tidak mintable, liquidity terkunci 6 bulan",
    ],
    executable_verdict: "IGNORE_FUD",
    served_from_cache: false,
  };

  return NextResponse.json(dummyVerdict, { status: 200 });
}
