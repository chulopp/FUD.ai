import { NextRequest, NextResponse } from 'next/server';
import { executeFudAnalysis } from '../../lib/mcts/pipeline';
import { createJob, updateJob } from '../../lib/redis/job-store';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// POST /api/agent
//
// Async Polling Pattern (Option A — waitUntil)
//
// 1. Validates input.
// 2. Generates a unique job_id.
// 3. Writes { status: 'pending' } to Redis.
// 4. Returns HTTP 202 Accepted immediately with job_id + poll_url.
// 5. Uses waitUntil() to keep the function alive while the MCTS
//    pipeline runs in the background, updating Redis when done.
//
// Poll the result via:  GET /api/agent/<job_id>
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { coin_symbol, contract_address, chain_id, request_id } = body;

    // Validate required fields
    if (!coin_symbol) {
      return NextResponse.json(
        { error: 'Missing required parameter: coin_symbol is required.' },
        { status: 400 }
      );
    }

    // Generate unique job ID
    const job_id = crypto.randomUUID();
    const resolvedRequestId = request_id || crypto.randomUUID();

    // Write pending job to Redis
    await createJob(job_id, coin_symbol);

    console.log(`[API Route] Job ${job_id} created for ${coin_symbol}. Returning 202.`);

    // ── waitUntil: keep the serverless function alive for the background pipeline ──
    // NextRequest.waitUntil() is supported in Next.js App Router (Node + Edge).
    // If running on a plain Node.js server, this schedules the async work
    // against the process event loop after the response is flushed.
    const backgroundPipeline = (async () => {
      const pipelineStart = Date.now();
      try {
        // Mark job as running
        await updateJob(job_id, { status: 'running' });

        const verdict = await executeFudAnalysis(
          coin_symbol,
          contract_address,
          chain_id || '1'
        );

        const elapsed = Date.now() - pipelineStart;
        console.log(`[API Route] Job ${job_id} completed in ${elapsed}ms. Verdict: ${verdict.executable_verdict}`);

        // Merge final response shape (mirrors the old synchronous response)
        const finalPayload = {
          request_id: resolvedRequestId,
          coin_symbol,
          status: verdict.status,
          executable_verdict: verdict.executable_verdict,
          confidence: verdict.confidence,
          drama_index: verdict.drama_index,
          chatter_level: verdict.chatter_level,
          risk_score: verdict.risk_score,
          dominant_branch: verdict.dominant_branch,
          branch_probabilities: verdict.branch_probabilities,
          evidence_chain: verdict.evidence_chain,
          served_from_cache: verdict.served_from_cache,
          fallback: verdict.fallback ?? false,
          reason: verdict.reason,
          step_summary: verdict.step_summary,
          coordination_signals: verdict.coordination_signals,
          pipeline_elapsed_ms: elapsed,
        };

        await updateJob(job_id, { status: 'completed', payload: finalPayload as any });
      } catch (error: any) {
        const elapsed = Date.now() - pipelineStart;
        console.error(`[API Route] Job ${job_id} FAILED after ${elapsed}ms:`, error?.message);
        await updateJob(job_id, {
          status: 'failed',
          error: error?.message || 'Unknown pipeline error',
        });
      }
    })();

    // Schedule background work — survives the 202 response on Vercel/Edge
    if (typeof (req as any).waitUntil === 'function') {
      (req as any).waitUntil(backgroundPipeline);
    } else {
      // Local Node.js dev fallback: attach to the Promise to prevent unhandled rejection
      backgroundPipeline.catch(console.error);
    }

    // Return 202 immediately
    return NextResponse.json(
      {
        job_id,
        status: 'pending',
        coin_symbol,
        poll_url: `/api/agent/${job_id}`,
        message: 'Analysis job accepted. Poll poll_url for results.',
      },
      { status: 202 }
    );

  } catch (error) {
    console.error('[API Route] Fatal error in POST /api/agent:', error);
    return NextResponse.json(
      { error: 'Internal server error', status: 'degraded' },
      { status: 500 }
    );
  }
}
