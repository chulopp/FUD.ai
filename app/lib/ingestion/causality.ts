/**
 * causality.ts — Lead-lag causal ordering: social narrative vs price action.
 *
 * CRITICAL-01 fix: fetchBybitKline() now uses fetchWithTimeout() (10s).
 * CRITICAL-05 fix: duplicated Jaccard/BFS code removed. Imports findLargestCluster
 *   from text_similarity.ts (shared with sybil_detector.ts).
 */

import crypto from 'crypto';
import { type SocialPost } from './sybil_detector';
import { type CausalityResult } from './types';
import { findLargestCluster, calculateBurstWindowMinutes } from './text_similarity';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

const BYBIT_BASE_URL = process.env.BYBIT_BASE_URL || 'https://api.bytick.com';

/**
 * Helper to fetch kline list from Bybit API (SPOT or LINEAR).
 * CRITICAL-01: uses fetchWithTimeout (10s) instead of bare fetch().
 */
async function fetchBybitKline(symbol: string): Promise<any[] | null> {
  const apiKey = process.env.BYBIT_API_KEY;
  const apiSecret = process.env.BYBIT_API_SECRET;

  // Try linear (perpetual) first, then spot
  for (const category of ['linear', 'spot']) {
    const qs = `category=${category}&symbol=${symbol.toUpperCase()}USDT&interval=1&limit=180`;
    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (apiKey && apiSecret) {
      const signPayload = timestamp + apiKey + recvWindow + qs;
      const signature = crypto.createHmac('sha256', apiSecret).update(signPayload).digest('hex');
      headers = {
        ...headers,
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-SIGN': signature,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
      };
    }

    try {
      const response = await fetchWithTimeout(
        `${BYBIT_BASE_URL}/v5/market/kline?${qs}`,
        { headers },
        10_000 // 10s timeout
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.retCode === 0 && data.result?.list && data.result.list.length > 0) {
          return data.result.list;
        }
      }
    } catch (e) {
      console.warn(`[Causality] Failed to fetch kline for ${symbol} in category ${category}:`, e);
    }
  }
  return null;
}

/**
 * Pure math implementation to detect causality metrics from a candle list and a social posts array.
 * Separated for easy deterministic mocking/offline testing.
 */
export function computeCausalityMetrics(
  candles: any[],
  posts: SocialPost[]
): CausalityResult | null {
  if (candles.length === 0) {
    return null;
  }

  // 1. Find the timestamp of the largest negative price delta in the last 3 hours
  let price_drop_timestamp_ms = 0;
  let maxNegativeDelta = 0; // Negative value representing price drop %

  for (const candle of candles) {
    // Bybit V5 structure: [startTime, openPrice, highPrice, lowPrice, closePrice, volume, turnover]
    const open = parseFloat(candle[1]);
    const close = parseFloat(candle[4]);
    const timestamp = parseInt(candle[0]);

    if (isNaN(open) || isNaN(close) || open === 0 || close === 0 || isNaN(timestamp)) {
      continue;
    }

    const deltaPct = ((close - open) / open) * 100;
    if (deltaPct < maxNegativeDelta) {
      maxNegativeDelta = deltaPct;
      price_drop_timestamp_ms = timestamp;
    }
  }

  // HIGH-08 fix: If no candle had a negative delta (purely rising market),
  // do NOT force the least-positive candle into a "price drop" role.
  // A rising market has no meaningful price drop — return null.
  if (price_drop_timestamp_ms === 0) {
    console.log('[Causality] No negative price delta found in candle window (rising market) — skipping causality.');
    return null;
  }

  // 2. Find the timestamp of the first major social narrative burst
  // We use posts with valid timestamps
  const validPosts = posts.filter((p): p is SocialPost & { timestamp: number } =>
    typeof p.timestamp === 'number' && !isNaN(p.timestamp)
  );

  if (validPosts.length === 0) {
    return null;
  }

  // Try cluster burst detection via shared module (100-post cap enforced inside)
  const { indices: clusterIndices } = findLargestCluster(validPosts);
  let social_burst_timestamp_ms = 0;
  let isClusterMethod = false;

  if (clusterIndices.length >= 3) {
    const clusterTimestamps = clusterIndices
      .map(idx => validPosts[idx].timestamp)
      .filter((t): t is number => typeof t === 'number' && !isNaN(t));

    if (clusterTimestamps.length > 0) {
      // Use calculateBurstWindowMinutes helper for stack-safe min extraction
      const minTs = clusterTimestamps.reduce((a, b) => (b < a ? b : a), clusterTimestamps[0]);
      social_burst_timestamp_ms = minTs;
      isClusterMethod = true;
    }
  }

  // Fallback to earliest post timestamp (stack-safe reduce)
  if (social_burst_timestamp_ms === 0) {
    const allTimestamps = validPosts.map(p => p.timestamp);
    social_burst_timestamp_ms = allTimestamps.reduce((a, b) => (b < a ? b : a), allTimestamps[0]);
  }

  const narrative_precedes_price_action = social_burst_timestamp_ms < price_drop_timestamp_ms;
  const rawLagMinutes = (price_drop_timestamp_ms - social_burst_timestamp_ms) / 60_000;

  // HIGH-09 fix: clamp lag_minutes to [-180, +180].
  // Values outside this range indicate epoch mismatches, not real causality signals.
  const lag_minutes = Math.max(-180, Math.min(180, rawLagMinutes));

  if (rawLagMinutes !== lag_minutes) {
    console.warn(`[Causality] lag_minutes clamped from ${rawLagMinutes.toFixed(2)} to ${lag_minutes} — possible epoch mismatch in social timestamps.`);
  }

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (candles.length >= 120) {
    if (isClusterMethod) {
      confidence = 'high';
    } else {
      confidence = 'medium';
    }
  } else if (candles.length > 30) {
    confidence = 'medium';
  }

  return {
    narrative_precedes_price_action,
    lag_minutes,
    social_burst_timestamp_ms,
    price_drop_timestamp_ms,
    price_drop_pct: maxNegativeDelta,
    confidence,
    analysis_window_hours: 3,
  };
}

/**
 * Main module function to compute price vs social causality metrics.
 */
export async function computeCausality(
  coinSymbol: string,
  posts: SocialPost[]
): Promise<CausalityResult | null> {
  try {
    const candles = await fetchBybitKline(coinSymbol);
    if (!candles || candles.length === 0) {
      console.log(`[Causality] No candle data retrieved from Bybit for ${coinSymbol}`);
      return null;
    }

    return computeCausalityMetrics(candles, posts);
  } catch (err) {
    console.warn(`[Causality] Error running causality analysis for ${coinSymbol}:`, err);
    return null;
  }
}
