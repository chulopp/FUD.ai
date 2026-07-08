process.env.UPSTASH_REDIS_REST_URL = "https://dummy-redis.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "dummy_token";

import { computeCausalityMetrics } from '../app/lib/ingestion/causality';
import { type SocialPost } from '../app/lib/ingestion/sybil_detector';

console.log("==================================================");
console.log("P1 TEMPORAL MOMENTUM & LEAD-LAG CAUSALITY MATH VALIDATION");
console.log("==================================================\n");

let passed = true;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    passed = false;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

// Base timestamp: 10:00 AM on July 7, 2026
const BASE_TIME = new Date("2026-07-07T10:00:00Z").getTime();

// Helper to make a mock Bybit candle
// Format: [startTime, openPrice, highPrice, lowPrice, closePrice, volume, turnover]
function makeCandle(offsetMinutes: number, open: number, close: number): any[] {
  const ts = BASE_TIME + offsetMinutes * 60 * 1000;
  return [
    ts.toString(),
    open.toString(),
    open.toString(), // high
    close.toString(), // low
    close.toString(),
    "100", // volume
    "1000" // turnover
  ];
}

// Create a series of 180 candles (3 hours)
// Default flat price: 100
function makeCandleSeries(): any[][] {
  const list = [];
  for (let i = 0; i < 180; i++) {
    list.push(makeCandle(i, 100, 100));
  }
  return list;
}

// ─────────────────────────────────────────────────────────────
// 1. Case A: Coordinated Pre-emptive FUD Campaign (Social Panic Precedes Price Drop)
// ─────────────────────────────────────────────────────────────
console.log("--- Test Case A: Coordinated Pre-emptive FUD Campaign ---");

// Price drops 20% at offset 30 (10:30 AM)
const candlesA = makeCandleSeries();
candlesA[30] = makeCandle(30, 100, 80); // Open = 100, Close = 80 (-20%)

// Coordinated FUD posts at offset 15 (10:15 AM)
// Using duplicate posts to trigger the Sybil clustering
const postsA: SocialPost[] = [
  { text: "This token is a scam! Dev is dumping tokens!", timestamp: BASE_TIME + 15 * 60 * 1000 },
  { text: "This token is a scam! Dev is dumping tokens!", timestamp: BASE_TIME + 16 * 60 * 1000 },
  { text: "This token is a scam! Dev is dumping tokens!", timestamp: BASE_TIME + 17 * 60 * 1000 },
  { text: "Organic tweet about market", timestamp: BASE_TIME + 2 * 60 * 1000 }
];

const resultA = computeCausalityMetrics(candlesA, postsA);

assert(resultA !== null, "Result should not be null");
if (resultA) {
  assert(resultA.narrative_precedes_price_action === true, "Narrative should precede price action (10:15 < 10:30)");
  assert(resultA.lag_minutes === 15, `Lag minutes should be 15, got ${resultA.lag_minutes}`);
  assert(resultA.price_drop_pct === -20, `Price drop should be -20%, got ${resultA.price_drop_pct}%`);
  assert(resultA.confidence === 'high', `Confidence should be high due to cluster method, got ${resultA.confidence}`);
}

// ─────────────────────────────────────────────────────────────
// 2. Case B: Organic Panic Response (Price Drop Precedes Social Panic)
// ─────────────────────────────────────────────────────────────
console.log("\n--- Test Case B: Organic Panic Response ---");

// Price drops 15% at offset 30 (10:30 AM)
const candlesB = makeCandleSeries();
candlesB[30] = makeCandle(30, 100, 85);

// FUD posts at offset 45 (10:45 AM)
const postsB: SocialPost[] = [
  { text: "OMG token just crashed, did they rug?", timestamp: BASE_TIME + 45 * 60 * 1000 },
  { text: "OMG token just crashed, did they rug?", timestamp: BASE_TIME + 46 * 60 * 1000 },
  { text: "OMG token just crashed, did they rug?", timestamp: BASE_TIME + 47 * 60 * 1000 }
];

const resultB = computeCausalityMetrics(candlesB, postsB);

assert(resultB !== null, "Result should not be null");
if (resultB) {
  assert(resultB.narrative_precedes_price_action === false, "Narrative should NOT precede price action (10:45 > 10:30)");
  assert(resultB.lag_minutes === -15, `Lag minutes should be -15 (price first), got ${resultB.lag_minutes}`);
}

// ─────────────────────────────────────────────────────────────
// 3. Case C: Fallback to Earliest Post (No Cluster Identified)
// ─────────────────────────────────────────────────────────────
console.log("\n--- Test Case C: Fallback to Earliest Post (No Cluster) ---");

// Price drops at offset 30 (10:30 AM)
const candlesC = makeCandleSeries();
candlesC[30] = makeCandle(30, 100, 90);

// Under 3 duplicate posts, so clustering method is bypassed
const postsC: SocialPost[] = [
  { text: "First warning sign", timestamp: BASE_TIME + 10 * 60 * 1000 },
  { text: "Totally random text", timestamp: BASE_TIME + 25 * 60 * 1000 }
];

const resultC = computeCausalityMetrics(candlesC, postsC);

assert(resultC !== null, "Result should not be null");
if (resultC) {
  assert(resultC.narrative_precedes_price_action === true, "Narrative should precede price action (10:10 < 10:30)");
  assert(resultC.lag_minutes === 20, `Lag should be 20 minutes (10:30 - 10:10), got ${resultC.lag_minutes}`);
  assert(resultC.confidence === 'medium', `Confidence should fall back to medium, got ${resultC.confidence}`);
}

// ─────────────────────────────────────────────────────────────
// 4. Case D: Edge Cases and Null Guards
// ─────────────────────────────────────────────────────────────
console.log("\n--- Test Case D: Edge Cases & Null Guards ---");

// Empty candles
const resultD1 = computeCausalityMetrics([], postsA);
assert(resultD1 === null, "Empty candles should return null");

// Empty posts
const resultD2 = computeCausalityMetrics(candlesA, []);
assert(resultD2 === null, "Empty posts should return null");

// Posts without timestamps
const postsD3: SocialPost[] = [
  { text: "No timestamp post" }
];
const resultD3 = computeCausalityMetrics(candlesA, postsD3);
assert(resultD3 === null, "Posts without timestamps should return null");

console.log("\n==================================================");
if (passed) {
  console.log("🎉 ALL P1 CAUSALITY MATHEMATICAL TESTS PASSED!");
  process.exit(0);
} else {
  console.log("❌ SOME TESTS FAILED. CHECK INTEGRITY.");
  process.exit(1);
}
