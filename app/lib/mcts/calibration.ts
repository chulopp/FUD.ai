/**
 * P2: Calibrated Confidence via Statistical Ground Truth
 *
 * This module implements an active Bayesian calibration loop backed by Redis.
 *
 * Flow:
 *   1. recordPrediction()         — called fire-and-forget from the pipeline; stores a
 *                                    pending evaluation entry in a Redis ZSET sorted by
 *                                    the target evaluation timestamp.
 *   2. evaluateMaturePredictions() — called by the weekly cron job; fetches current price,
 *                                    scores each matured prediction as WIN/LOSS, and
 *                                    updates per-bucket counters in a Redis Hash.
 *   3. getCalibratedConfidence()  — replaces raw LLM confidence with the historically
 *                                    calibrated accuracy once ≥50 samples exist in a bucket.
 *
 * Redis key schema:
 *   predictions:pending              ZSET  score = target_eval_timestamp (ms epoch)
 *                                          member = JSON string of PendingPrediction
 *   calibration:bucket:<name>        Hash  fields: total (int), wins (int)
 *
 * Bucket naming: 10-point wide intervals e.g. "0-10", "10-20" … "90-100"
 * representing the raw confidence × 100 floored to the nearest 10.
 */

import { redis } from '../redis/client';
import { fetchCoinGeckoMarkets } from '../ingestion/market';
import type { VerdictResult } from './pipeline';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const PENDING_ZSET_KEY = 'predictions:pending';
const BUCKET_HASH_PREFIX = 'calibration:bucket:';

/** Minimum sample count before calibrated accuracy replaces raw confidence. */
const MIN_SAMPLES_THRESHOLD = 50;

/** Sequential delay (ms) between CoinGecko price fetches during evaluation to
 *  respect the free-tier rate limit (~10–30 req/min). */
const PRICE_FETCH_DELAY_MS = 200;

// Market cap category → evaluation window offset in milliseconds
const EVAL_OFFSET_MS: Record<NonNullable<VerdictResult['market_cap_category']>, number> = {
  meme: 24 * 60 * 60 * 1_000,       //  24 h
  low:  72 * 60 * 60 * 1_000,       //  72 h
  mid:  120 * 60 * 60 * 1_000,      // 120 h
  big:  168 * 60 * 60 * 1_000,      // 168 h
};

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface PendingPrediction {
  coinSymbol: string;
  predictedVerdict: VerdictResult['executable_verdict'];
  initialPrice: number;
  rawConfidence: number;
  marketCapCategory: NonNullable<VerdictResult['market_cap_category']>;
  target_eval_timestamp: number; // ms epoch
  recorded_at: number;           // ms epoch
}

// ─────────────────────────────────────────────────────────────
// Bucket helpers
// ─────────────────────────────────────────────────────────────

/**
 * Returns the bucket name for a given raw confidence value.
 * e.g. 0.87 → "80-90"  |  1.0 → "90-100"  |  0.0 → "0-10"
 */
function getBucketName(rawConfidence: number): string {
  const pct = Math.max(0, Math.min(1, rawConfidence)) * 100;
  // Floor to the nearest 10, cap so 100 falls into "90-100" bucket
  const lower = Math.min(90, Math.floor(pct / 10) * 10);
  const upper = lower + 10;
  return `${lower}-${upper}`;
}

function bucketKey(bucketName: string): string {
  return `${BUCKET_HASH_PREFIX}${bucketName}`;
}

// ─────────────────────────────────────────────────────────────
// Step 1: Record a new prediction into the pending ZSET
// ─────────────────────────────────────────────────────────────

/**
 * Stores a prediction for future evaluation.
 * Called fire-and-forget from the analysis pipeline.
 *
 * @param coinSymbol          Ticker symbol (e.g. "BTC")
 * @param predictedVerdict    The executable verdict emitted by the pipeline
 * @param initialPrice        Current price at prediction time (USD)
 * @param rawConfidence       Raw LLM confidence (0–1)
 * @param marketCapCategory   LLM-classified market cap tier
 */
export async function recordPrediction(
  coinSymbol: string,
  predictedVerdict: VerdictResult['executable_verdict'],
  initialPrice: number,
  rawConfidence: number,
  marketCapCategory: NonNullable<VerdictResult['market_cap_category']>
): Promise<void> {
  const now = Date.now();
  const offset = EVAL_OFFSET_MS[marketCapCategory];
  const target_eval_timestamp = now + offset;

  const prediction: PendingPrediction = {
    coinSymbol,
    predictedVerdict,
    initialPrice,
    rawConfidence,
    marketCapCategory,
    target_eval_timestamp,
    recorded_at: now,
  };

  const member = JSON.stringify(prediction);

  await redis.zadd(PENDING_ZSET_KEY, {
    score: target_eval_timestamp,
    member,
  });

  console.log(
    `[Calibration] Recorded prediction for ${coinSymbol}: verdict=${predictedVerdict}, ` +
    `rawConf=${rawConfidence.toFixed(3)}, category=${marketCapCategory}, ` +
    `evalAt=${new Date(target_eval_timestamp).toISOString()}`
  );
}

// ─────────────────────────────────────────────────────────────
// Step 2: Evaluate all predictions whose target time has elapsed
// ─────────────────────────────────────────────────────────────

/**
 * Fetches all mature predictions (score ≤ NOW), evaluates correctness against the
 * current price, updates Redis calibration buckets, and removes evaluated entries.
 *
 * Designed to be called from the weekly cron job.
 * Uses a sequential 200 ms delay between price fetches to stay within
 * CoinGecko free-tier rate limits.
 *
 * @returns Number of predictions successfully evaluated.
 */
export async function evaluateMaturePredictions(): Promise<{ processed: number }> {
  const now = Date.now();

  // Fetch all members whose score (target_eval_timestamp) is ≤ NOW
  // @upstash/redis does not expose zrangebyscore directly — use zrange with byScore option.
  const rawMembers = await redis.zrange(
    PENDING_ZSET_KEY,
    0,       // min score
    now,     // max score = now
    { byScore: true }
  );


  if (!rawMembers || rawMembers.length === 0) {
    console.log('[Calibration] No mature predictions to evaluate.');
    return { processed: 0 };
  }

  console.log(`[Calibration] Found ${rawMembers.length} mature prediction(s) to evaluate.`);

  let processed = 0;

  for (const raw of rawMembers) {
    let prediction: PendingPrediction;

    try {
      prediction = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw)) as PendingPrediction;
    } catch (err) {
      console.warn('[Calibration] Skipping malformed prediction JSON:', raw);
      // Remove corrupt entry so it doesn't block future runs
      await redis.zrem(PENDING_ZSET_KEY, raw as string).catch(() => {});
      continue;
    }

    // ── Fetch current price ───────────────────────────────
    let currentPrice: number | null = null;
    try {
      const priceResult = await fetchCoinGeckoMarkets(prediction.coinSymbol);
      if (priceResult.status === 'ok' && priceResult.data) {
        currentPrice = priceResult.data.current_price;
      }
    } catch (err) {
      console.warn(`[Calibration] Price fetch failed for ${prediction.coinSymbol}:`, err);
    }

    if (currentPrice === null || currentPrice <= 0) {
      console.warn(
        `[Calibration] Cannot evaluate ${prediction.coinSymbol} — price unavailable. ` +
        `Skipping (will retry on next cron run).`
      );
      // Intentionally do NOT remove — leave in ZSET for the next run
      // Apply delay before continuing to next entry
      await delay(PRICE_FETCH_DELAY_MS);
      continue;
    }

    // ── Determine correctness ─────────────────────────────
    // LIQUIDATE_LONGS (bearish) = WIN if price dropped from initialPrice
    // All other verdicts (HOLD, ACCUMULATE, IGNORE_FUD) = WIN if price held or rose
    let isWin: boolean;
    if (prediction.predictedVerdict === 'LIQUIDATE_LONGS') {
      isWin = currentPrice < prediction.initialPrice;
    } else {
      isWin = currentPrice >= prediction.initialPrice;
    }

    const priceChangePct =
      prediction.initialPrice > 0
        ? (((currentPrice - prediction.initialPrice) / prediction.initialPrice) * 100).toFixed(2)
        : 'N/A';

    console.log(
      `[Calibration] Evaluating ${prediction.coinSymbol}: ` +
      `verdict=${prediction.predictedVerdict}, ` +
      `initialPrice=${prediction.initialPrice}, currentPrice=${currentPrice}, ` +
      `change=${priceChangePct}%, result=${isWin ? 'WIN' : 'LOSS'}`
    );

    // ── Update calibration bucket ─────────────────────────
    const bucket = getBucketName(prediction.rawConfidence);
    const key = bucketKey(bucket);

    try {
      // Increment total count
      await redis.hincrby(key, 'total', 1);
      // Increment wins if correct
      if (isWin) {
        await redis.hincrby(key, 'wins', 1);
      }
      console.log(`[Calibration] Updated bucket "${bucket}": +1 total, ${isWin ? '+1 wins' : '+0 wins'}`);
    } catch (err) {
      console.error(`[Calibration] Failed to update bucket "${bucket}":`, err);
      // Still remove the prediction — don't double-count on retry
    }

    // ── Remove from ZSET ──────────────────────────────────
    try {
      await redis.zrem(PENDING_ZSET_KEY, typeof raw === 'string' ? raw : JSON.stringify(raw));
    } catch (err) {
      console.warn(`[Calibration] Failed to remove evaluated prediction from ZSET:`, err);
    }

    processed++;

    // Sequential delay to respect CoinGecko rate limits
    await delay(PRICE_FETCH_DELAY_MS);
  }

  console.log(`[Calibration] Evaluation complete. Processed ${processed}/${rawMembers.length} predictions.`);
  return { processed };
}

// ─────────────────────────────────────────────────────────────
// Step 3: Get the calibrated confidence for a given raw value
// ─────────────────────────────────────────────────────────────

/**
 * Returns the historically calibrated accuracy for a given raw confidence value.
 *
 * Strict rule:
 *   - If the bucket has < 50 total samples → returns rawConfidence as-is
 *     (insufficient statistical ground truth).
 *   - If the bucket has ≥ 50 total samples → returns wins / total
 *     (the empirically measured accuracy for predictions in this confidence range).
 *
 * @param rawConfidence  Raw LLM confidence (0–1). Returns null input unchanged as null.
 */
export async function getCalibratedConfidence(
  rawConfidence: number | null
): Promise<number | null> {
  if (rawConfidence === null) return null;

  const bucket = getBucketName(rawConfidence);
  const key = bucketKey(bucket);

  try {
    const stats = await redis.hgetall(key) as Record<string, string> | null;

    if (!stats || !stats.total) {
      // No data yet for this bucket — pass through raw confidence
      console.log(`[Calibration] Bucket "${bucket}": no data yet, returning rawConfidence=${rawConfidence.toFixed(3)}`);
      return rawConfidence;
    }

    const total = parseInt(stats.total, 10);
    const wins = parseInt(stats.wins ?? '0', 10);

    if (isNaN(total) || isNaN(wins)) {
      console.warn(`[Calibration] Bucket "${bucket}": invalid sample stats (total="${stats.total}", wins="${stats.wins}") — returning rawConfidence.`);
      return rawConfidence;
    }

    if (total < MIN_SAMPLES_THRESHOLD) {
      console.log(
        `[Calibration] Bucket "${bucket}": ${total} samples < threshold ${MIN_SAMPLES_THRESHOLD}, ` +
        `returning rawConfidence=${rawConfidence.toFixed(3)}`
      );
      return rawConfidence;
    }

    const calibrated = wins / total;
    console.log(
      `[Calibration] Bucket "${bucket}": ${wins}/${total} wins → ` +
      `calibrated=${calibrated.toFixed(3)} (was raw=${rawConfidence.toFixed(3)})`
    );
    return calibrated;

  } catch (err) {
    console.warn(`[Calibration] Redis read failed for bucket "${bucket}", falling back to rawConfidence:`, err);
    return rawConfidence;
  }
}

// ─────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
