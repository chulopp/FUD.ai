import { redis } from './client';

// ─────────────────────────────────────────────────────────────
// Shared Pipeline Concurrency Limiter
//
// Used by BOTH:
//   - POST /api/agent  (HTTP route — returns 429 if full)
//   - CROO Provider Worker (queues paid orders — never rejects)
//
// All instances share the same Redis counter so the combined
// in-flight pipeline count is always globally bounded.
// ─────────────────────────────────────────────────────────────

export const MAX_CONCURRENT_PIPELINES = 5;
export const ACTIVE_COUNT_KEY = 'pipeline:active_count';

// Auto-expire the active count key to clean up stale counts
// (e.g., from crashed workers/servers that didn't decrement).
const COUNT_EXPIRE_SECONDS = 120;

/**
 * Atomically acquires a pipeline slot.
 *
 * Returns `true` if the slot was acquired (counter incremented and below limit).
 * Returns `false` if the system is at capacity (counter is decremented back).
 *
 * Always call `releasePipelineSlot()` in a finally block if this returns `true`.
 */
export async function acquirePipelineSlot(): Promise<boolean> {
  try {
    const activeCount = await redis.incr(ACTIVE_COUNT_KEY);
    // Refresh the TTL so stale counts don't pile up
    await redis.expire(ACTIVE_COUNT_KEY, COUNT_EXPIRE_SECONDS);

    if (activeCount > MAX_CONCURRENT_PIPELINES) {
      await redis.decr(ACTIVE_COUNT_KEY);
      return false;
    }
    return true;
  } catch (err) {
    // If Redis is unavailable, warn but allow the request through to avoid
    // blocking legitimate traffic. Capacity protection is best-effort.
    console.warn('[Concurrency] acquirePipelineSlot failed (non-blocking):', err);
    return true;
  }
}

/**
 * Releases a previously acquired pipeline slot.
 * Safe to call even if Redis is temporarily unavailable.
 */
export async function releasePipelineSlot(): Promise<void> {
  try {
    await redis.decr(ACTIVE_COUNT_KEY);
  } catch (err) {
    console.warn('[Concurrency] releasePipelineSlot failed (non-blocking):', err);
  }
}

/**
 * Polls until a pipeline slot is available or the timeout is reached.
 * Intended for the CROO worker — paid orders must not be dropped.
 *
 * Returns `true` if a slot was acquired, `false` on timeout.
 * Always call `releasePipelineSlot()` in a finally block if this returns `true`.
 *
 * @param timeoutMs    Maximum wait time in milliseconds.
 * @param pollIntervalMs  How often to retry. Default: 2000ms.
 */
export async function waitForPipelineSlot(
  timeoutMs: number,
  pollIntervalMs = 2_000
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const acquired = await acquirePipelineSlot();
    if (acquired) return true;

    console.log(
      `[Concurrency] All ${MAX_CONCURRENT_PIPELINES} slots occupied. ` +
      `Retrying in ${pollIntervalMs}ms (${Math.ceil((deadline - Date.now()) / 1000)}s left)...`
    );

    // Wait before retrying — but clamp to remaining time
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await sleep(Math.min(pollIntervalMs, remaining));
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
