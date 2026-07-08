import { redis } from './client';

// ─────────────────────────────────────────────────────────────
// Granular Ingestion Cache
//
// Caches quantitative API data (Bybit, GoPlus, CoinGecko, DefiLlama)
// independently of the final verdict cache.
//
// Key pattern: ingestion:<source>:<coinSymbol>:<contractAddress|'native'>:<chainId>
// TTL: 2 minutes (crypto data is volatile; 2-min reuse is safe)
//
// NOT used for: DexScreener (real-time pair data), Twitter, Telegram
// (too volatile / timing-sensitive).
// ─────────────────────────────────────────────────────────────

const INGESTION_TTL_SECONDS = 120; // 2 minutes

export function buildIngestionKey(
  source: string,
  coinSymbol: string,
  contractAddress: string | undefined,
  chainId: string
): string {
  const addr = contractAddress?.toLowerCase() || 'native';
  const sym = coinSymbol.toUpperCase();
  return `ingestion:${source}:${sym}:${addr}:${chainId}`;
}

// ─────────────────────────────────────────────────────────────
// Get cached ingestion data — returns null on miss or parse error
// ─────────────────────────────────────────────────────────────

export async function getCachedIngestion<T>(key: string): Promise<T | null> {
  try {
    return await redis.get<T>(key);
  } catch (err) {
    console.warn(`[IngestionCache] Cache GET failed for key "${key}":`, err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Set ingestion data in cache
// ─────────────────────────────────────────────────────────────

export async function setCachedIngestion<T>(
  key: string,
  data: T,
  ttlSeconds: number = INGESTION_TTL_SECONDS
): Promise<void> {
  try {
    await redis.set(key, data, { ex: ttlSeconds });
    console.log(`[IngestionCache] Cached key "${key}" for ${ttlSeconds}s`);
  } catch (err) {
    // Non-fatal — cache failures should never break the pipeline
    console.warn(`[IngestionCache] Cache SET failed for key "${key}":`, err);
  }
}
