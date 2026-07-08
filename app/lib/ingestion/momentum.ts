import { redis } from '../redis/client';
import { type MomentumResult } from './types';

export interface MomentumSnapshot {
  price_usd: number;
  post_count: number;
  timestamp_ms: number;
}


/**
 * Pushes a new snapshot to the coin's ZSET.
 * Also trims old snapshots (> 3 hours) to prevent Redis storage bloat.
 */
export async function pushMomentumSnapshot(
  coinSymbol: string,
  priceUsd: number,
  postCount: number
): Promise<void> {
  const key = `snapshot:${coinSymbol.toUpperCase()}`;
  const now = Date.now();
  const threeHoursAgo = now - 3 * 60 * 60 * 1000;

  const snapshot: MomentumSnapshot = {
    price_usd: priceUsd,
    post_count: postCount,
    timestamp_ms: now,
  };

  try {
    // 1. Enforce trim before push: remove any snapshot older than 3 hours
    await redis.zremrangebyscore(key, 0, threeHoursAgo);

    // 2. Add current snapshot to ZSET
    // In @upstash/redis, zadd accepts: zadd(key, { score, member })
    await redis.zadd(key, {
      score: now,
      member: JSON.stringify(snapshot),
    });

    // 3. Keep the key alive for 3 hours (10800 seconds)
    await redis.expire(key, 10800);

    console.log(`[Momentum] Snapshot pushed for ${coinSymbol.toUpperCase()}. Price: $${priceUsd}, Posts: ${postCount}`);
  } catch (err) {
    console.warn(`[Momentum] Failed to push snapshot for ${coinSymbol.toUpperCase()}:`, err);
  }
}

/**
 * Computes momentum metrics based on snapshots from the last 30-60 minutes.
 */
export async function computeMomentum(coinSymbol: string): Promise<MomentumResult | null> {
  const key = `snapshot:${coinSymbol.toUpperCase()}`;
  const now = Date.now();
  const sixtyMinutesAgo = now - 60 * 60 * 1000;

  try {
    // Fetch snapshots in the last 60 minutes
    // @upstash/redis does not expose zrangebyscore directly — use zrange with byScore option.
    const rawSnapshots = await redis.zrange<string[]>(key, sixtyMinutesAgo, now, { byScore: true });

    if (!rawSnapshots || rawSnapshots.length < 2) {
      console.log(`[Momentum] Insufficient snapshots for ${coinSymbol.toUpperCase()} (found ${rawSnapshots?.length || 0})`);
      return null;
    }

    // Parse the snapshots and sort by timestamp ascending
    const snapshots: MomentumSnapshot[] = rawSnapshots
      .map((item: string) => {
        try {
          return typeof item === 'string' ? JSON.parse(item) : item;
        } catch {
          return null;
        }
      })
      .filter((s: MomentumSnapshot | null): s is MomentumSnapshot => s !== null && typeof s.timestamp_ms === 'number')
      .sort((a: MomentumSnapshot, b: MomentumSnapshot) => a.timestamp_ms - b.timestamp_ms);

    if (snapshots.length < 2) {
      return null;
    }

    const oldest = snapshots[0];
    const newest = snapshots[snapshots.length - 1];

    const elapsedMs = newest.timestamp_ms - oldest.timestamp_ms;
    const elapsedMinutes = elapsedMs / (60 * 1000);

    // If elapsed time is less than 1 minute, return zero velocity to prevent noise spikes (HIGH-07)
    if (elapsedMinutes < 1.0) {
      return {
        price_velocity_pct_per_min: 0,
        sentiment_velocity_posts_per_min: 0,
        window_minutes: elapsedMinutes,
        snapshot_count: snapshots.length,
        computed_at: new Date().toISOString(),
      };
    }

    // price_velocity = % change in price per minute
    // Formula: ((newPrice - oldPrice) / oldPrice) * 100 / minutes
    const priceDiffPct = oldest.price_usd > 0
      ? ((newest.price_usd - oldest.price_usd) / oldest.price_usd) * 100
      : 0;
    const rawPriceVelocity = priceDiffPct / elapsedMinutes;
    // Clamp price velocity to ±20% per minute (HIGH-07)
    const price_velocity_pct_per_min = Math.max(-20, Math.min(20, rawPriceVelocity));

    // sentiment_velocity = change in post frequency per minute
    const postDiff = newest.post_count - oldest.post_count;
    const rawSentimentVelocity = postDiff / elapsedMinutes;
    // Clamp sentiment velocity to ±500 posts per minute (HIGH-07)
    const sentiment_velocity_posts_per_min = Math.max(-500, Math.min(500, rawSentimentVelocity));

    return {
      price_velocity_pct_per_min,
      sentiment_velocity_posts_per_min,
      window_minutes: elapsedMinutes,
      snapshot_count: snapshots.length,
      computed_at: new Date().toISOString(),
    };
  } catch (err) {
    console.warn(`[Momentum] Error computing momentum for ${coinSymbol.toUpperCase()}:`, err);
    return null;
  }
}
