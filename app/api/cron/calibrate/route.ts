/**
 * P2: Calibration Cron Job — Route Handler
 *
 * Endpoint: GET /api/cron/calibrate
 *
 * Authentication — accepts requests when ANY of the following is true:
 *   1. The "x-vercel-cron" header equals "1"  (automated Vercel cron invocation)
 *   2. The "?secret=" query param matches the CRON_SECRET environment variable
 *      (safe manual trigger during local development)
 *
 * Schedule (configured in vercel.json): every Sunday at 00:00 UTC.
 *
 * The route calls evaluateMaturePredictions(), which:
 *   - Fetches all predictions in the Redis ZSET whose target_eval_timestamp ≤ NOW
 *   - Compares initial vs. current price to determine WIN / LOSS
 *   - Increments per-bucket counters in Redis Hashes
 *   - Removes evaluated entries from the ZSET
 */

import { NextRequest, NextResponse } from 'next/server';
import { evaluateMaturePredictions } from '../../../lib/mcts/calibration';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── Auth check ──────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[CronCalibrate] CRON_SECRET environment variable is not configured.');
    return NextResponse.json(
      { ok: false, error: 'Cron endpoint is not configured (missing CRON_SECRET).' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const providedSecret = searchParams.get('secret') || request.headers.get('x-cron-secret');

  if (providedSecret !== cronSecret) {
    console.warn('[CronCalibrate] Unauthorized access attempt blocked. Provided secret does not match CRON_SECRET.');
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const trigger = request.headers.get('x-cron-secret') ? 'vercel-cron-header' : 'manual';
  console.log(`[CronCalibrate] Starting calibration evaluation (trigger: ${trigger})...`);

  // ── Run evaluation ──────────────────────────────────────────────────────────
  try {
    const { processed } = await evaluateMaturePredictions();

    console.log(`[CronCalibrate] Done. Processed ${processed} predictions.`);

    return NextResponse.json(
      { ok: true, processed, trigger },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CronCalibrate] evaluateMaturePredictions threw:', message);

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
