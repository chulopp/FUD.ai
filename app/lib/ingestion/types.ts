/**
 * Shared ingestion result wrapper.
 *
 * Every data source MUST return this wrapper so downstream components
 * (LLM prompts, grounding checks, evidence validators) can distinguish:
 *   "ok"        — data was fetched and is valid
 *   "empty"     — fetch succeeded but returned no data for this token
 *   "error"     — fetch was attempted but failed (timeout, 4xx, 5xx)
 *   "not_called"— source was intentionally skipped (dispatcher decision or not applicable)
 *
 * Passing raw zeros/false without a status is FORBIDDEN — it causes the LLM
 * to treat "was not checked" as "was checked and found safe".
 */

export type IngestionStatus = 'ok' | 'empty' | 'error' | 'not_called';

export interface IngestionResult<T> {
  status: IngestionStatus;
  data: T | null;
  error_detail?: string;
}

// ─────────────────────────────────────────────────────────────
// Strongly-typed data shapes returned by each ingestion module
// ─────────────────────────────────────────────────────────────

export interface DexScreenerData {
  priceUsd: string;
  volume24h: number;
  fdv: number;
  liquidityUsd: number;
  marketCap: number;
  priceChange24h: number;
  pairCreatedAt?: number; // unix ms — used to contextualise "rugged" flag
  txns24h?: { buys: number; sells: number };
}

export interface GoPlusData {
  isHoneypot: boolean;
  isMintable: boolean;
  isOpenSource: boolean;
  isProxy?: boolean;
  ownerAddress?: string;
  hiddenOwner?: boolean;
  buyTax?: string;
  sellTax?: string;
  holderCount?: string;
  isAntiWhale?: boolean;
}

export interface RugCheckData {
  score: number;
  isRug: boolean;
  rugged?: boolean;
  risks: string[];
  totalMarketLiquidity?: number;
  topHolders?: unknown[];
}

export interface BybitOrderBookData {
  b: [string, string][]; // [price, qty]
  a: [string, string][];
}

export interface BybitTickerData {
  lastPrice?: string;
  price24hPcnt?: string;
  volume24h?: string;
  bid1Price?: string;
  ask1Price?: string;
  openInterest?: string;
  fundingRate?: string;
}

export interface CoinGeckoMarketsData {
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number;
}

export interface CoinGeckoMacroData {
  community_data?: Record<string, unknown>;
  developer_data?: Record<string, unknown>;
  marketCap?: number;
  fdv?: number;
  volume24h?: number;
}

export interface DefiLlamaData {
  tvl?: number;
  change_1d?: number;
  change_7d?: number;
}

export interface SocialIntelData {
  posts: {
    username?: string;
    channel?: string;
    text: string;
    likes?: number;
    retweets?: number;
    views?: string | null;
    createdAt?: string | null;
    author_id?: string;
    timestamp?: number;
    injection_attempt_detected?: boolean;
  }[];
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

export function ok<T>(data: T): IngestionResult<T> {
  return { status: 'ok', data };
}

export function empty<T>(): IngestionResult<T> {
  return { status: 'empty', data: null };
}

export function ingestionError<T>(error_detail: string): IngestionResult<T> {
  return { status: 'error', data: null, error_detail };
}

export function notCalled<T>(): IngestionResult<T> {
  return { status: 'not_called', data: null };
}

// ─────────────────────────────────────────────────────────────
// P1 Temporal Momentum & Lead-Lag Causality types
// ─────────────────────────────────────────────────────────────

export interface MomentumResult {
  price_velocity_pct_per_min: number;
  sentiment_velocity_posts_per_min: number;
  window_minutes: number;
  snapshot_count: number;
  computed_at: string;
}

export interface CausalityResult {
  narrative_precedes_price_action: boolean;
  lag_minutes: number;
  social_burst_timestamp_ms: number;
  price_drop_timestamp_ms: number;
  price_drop_pct: number;
  confidence: 'high' | 'medium' | 'low';
  analysis_window_hours: number;
}

