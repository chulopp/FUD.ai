import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '../../lib/redis/job-store';
import { enqueueDemoJob } from '../../lib/redis/job-store';
import { redis } from '../../lib/redis/client';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// POST /api/agent
//
// Queue Producer Pattern (Option B — Redis Queue)
//
// 1. Validates input.
// 2. Checks demo fingerprint + rate limits.
// 3. Generates a unique job_id.
// 4. Writes { status: 'pending' } to Redis job record.
// 5. LPUSH job to fud:demo:queue (Render worker will RPOP and execute).
// 6. Returns HTTP 202 Accepted immediately with job_id + poll_url.
//    (Total Vercel function time: ~100-300ms)
//
// The heavy pipeline runs in the Render worker (croo-provider-worker.ts).
// Poll the result via:  GET /api/agent/<job_id>
// ─────────────────────────────────────────────────────────────

// Rate limiting constants
const DEMO_WEEKLY_LIMIT = process.env.NODE_ENV === 'development' ? 9999 : 2;
const FINGERPRINT_RATE_KEY_PREFIX = 'demo:fp:';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { coin_symbol, contract_address, chain_id, request_id } = body;

    // Validate required fields
    if (!coin_symbol || typeof coin_symbol !== 'string') {
      return NextResponse.json(
        { error: 'Missing required parameter: coin_symbol is required.' },
        { status: 400 }
      );
    }

    const sym = coin_symbol.trim().toUpperCase();
    if (sym.length === 0 || sym.length > 20 || !/^[A-Za-z0-9]+$/.test(sym)) {
      return NextResponse.json(
        { error: 'Invalid coin_symbol: must be 1-20 alphanumeric characters.' },
        { status: 400 }
      );
    }

    // Demo fingerprint rate limiting (server-side guard)
    const fingerprint = req.headers.get('X-Demo-Fingerprint');
    if (fingerprint) {
      const fpKey = `${FINGERPRINT_RATE_KEY_PREFIX}${fingerprint}`;
      try {
        const currentCount = await redis.get<number>(fpKey) ?? 0;
        if (currentCount >= DEMO_WEEKLY_LIMIT) {
          return NextResponse.json(
            { error: `Demo limit reached (${DEMO_WEEKLY_LIMIT}/week). Integrate via CROO Agent Store for full access.` },
            { status: 403 }
          );
        }
        // Increment with 7-day TTL (604800s)
        await redis.set(fpKey, currentCount + 1, { ex: 604800 });
      } catch {
        // Redis rate-limit check failure — allow through (don't block demo)
        console.warn('[API Route] Redis rate-limit check failed, allowing through');
      }
    }

    // Check global concurrency — reject if too many in-flight jobs in queue
    try {
      const queueLen = await redis.llen('fud:demo:queue');
      if (queueLen >= 3) {
        return NextResponse.json(
          { error: 'Too many concurrent analyses in progress. Please retry in a moment.' },
          { status: 429 }
        );
      }
    } catch {
      // Redis queue check failure — allow through
    }

    // Generate unique job ID
    const job_id = crypto.randomUUID();
    const resolvedRequestId = request_id || crypto.randomUUID();

    // Write pending job to Redis
    await createJob(job_id, sym);

    // Enqueue to demo worker queue (Render worker will pick this up)
    await enqueueDemoJob({
      jobId: job_id,
      coinSymbol: sym,
      contractAddress: contract_address,
      chainId: chain_id || '1',
      enqueuedAt: new Date().toISOString(),
    });

    console.log(`[API Route] Job ${job_id} enqueued for ${sym}. Queue length will include this job.`);

    // Return 202 immediately — Vercel function completes in ~100-300ms
    return NextResponse.json(
      {
        job_id,
        status: 'pending',
        coin_symbol: sym,
        poll_url: `/api/agent/${job_id}`,
        message: 'Analysis job accepted. Poll poll_url for results.',
        request_id: resolvedRequestId,
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
