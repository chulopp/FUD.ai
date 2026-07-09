import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '../../../lib/redis/job-store';

// ─────────────────────────────────────────────────────────────
// GET /api/agent/[job_id]
//
// Polling endpoint — clients call this after receiving a 202 from POST.
//
// Response shapes:
//   404  → Job not found (expired after 10 min, or invalid ID)
//   200  → { status: 'pending' | 'running', job_id, coin_symbol, poll_url }
//   200  → { status: 'completed', job_id, coin_symbol, ...verdictPayload }
//   200  → { status: 'failed', job_id, coin_symbol, error: '...' }
//
// Recommended polling interval: 3-5 seconds.
// ─────────────────────────────────────────────────────────────

interface RouteContext {
  params: Promise<{ job_id: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { job_id } = await context.params;

  if (!job_id) {
    return NextResponse.json({ error: 'Missing job_id' }, { status: 400 });
  }

  try {
    const record = await getJob(job_id);

    if (!record) {
      return NextResponse.json(
        { error: 'Job not found. It may have expired (TTL: 10 min) or the ID is invalid.', job_id },
        { status: 404 }
      );
    }

    if (record.status === 'completed' && record.payload) {
      const rawEvidence = record.payload.evidence_chain || [];
      const evidenceStrings = Array.isArray(rawEvidence)
        ? rawEvidence.map((item: any) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object' && 'evidence' in item) {
              return String(item.evidence);
            }
            return String(item);
          })
        : [];

      // Ensure dominant_branch is mathematically synchronized to the highest probability branch
      let dominant_branch = String(record.payload.dominant_branch || 'unknown');
      const probs = record.payload.branch_probabilities || {};
      let maxKey = '';
      let maxVal = -1;
      for (const [k, v] of Object.entries(probs)) {
        const val = Number(v);
        if (val > maxVal) {
          maxVal = val;
          maxKey = k;
        }
      }
      if (maxKey && maxVal > 0) {
        dominant_branch = maxKey;
      }

      return NextResponse.json(
        {
          job_id,
          coin_symbol: record.coin_symbol,
          ...record.payload,
          dominant_branch,
          evidence_chain: evidenceStrings,
          status: 'completed' as const,
        },
        { status: 200 }
      );
    }

    if (record.status === 'failed') {
      return NextResponse.json(
        {
          job_id,
          coin_symbol: record.coin_symbol,
          status: 'failed',
          error: record.error || 'Pipeline encountered a fatal error.',
          executable_verdict: 'INSUFFICIENT_DATA',
          confidence: 0,
        },
        { status: 200 }
      );
    }

    // Still pending or running — instruct client to poll again
    return NextResponse.json(
      {
        job_id,
        coin_symbol: record.coin_symbol,
        status: record.status,
        poll_url: `/api/agent/${job_id}`,
        message: 'Analysis in progress. Poll again in 3-5 seconds.',
      },
      { status: 200 }
    );

  } catch (error) {
    console.error(`[Poll Route] Error fetching job ${job_id}:`, error);
    return NextResponse.json(
      { error: 'Failed to retrieve job status', job_id },
      { status: 500 }
    );
  }
}
