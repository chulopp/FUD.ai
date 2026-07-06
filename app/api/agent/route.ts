import { NextRequest, NextResponse } from 'next/server';
import { executeFudAnalysis } from '../../lib/mcts/pipeline';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    // Parse the incoming request
    const body = await req.json().catch(() => ({}));
    const { coin_symbol, contract_address, chain_id } = body;

    // Validate required fields
    if (!coin_symbol) {
      return NextResponse.json(
        { error: "Missing required parameter: coin_symbol is required." },
        { status: 400 }
      );
    }

    // Execute the MCTS pipeline
    const verdict = await executeFudAnalysis(
      coin_symbol,
      contract_address,
      chain_id || '1'
    );

    // Merge request_id and coin_symbol into the final response to match schema
    const finalResponse = {
      request_id: body.request_id || crypto.randomUUID(),
      coin_symbol,
      ...verdict
    };

    return NextResponse.json(finalResponse, { status: 200 });

  } catch (error) {
    console.error('[API Route] Fatal error in /api/agent:', error);
    
    // Return a safe fallback payload on fatal errors
    return NextResponse.json(
      {
        drama_index: 0,
        executable_verdict: "IGNORE_FUD",
        error: "Internal Pipeline Error",
        fallback: true
      },
      { status: 500 }
    );
  }
}
