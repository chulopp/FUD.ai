import { computeCoordinationSignals, type SocialPost } from '../app/lib/ingestion/sybil_detector';

// Scenario 1: High Sybil / Coordinated Bot Network
// 20 posts with low unique author count (3 authors) and near-identical copy-paste texts.
const highSybilPosts: SocialPost[] = [];
const baseText = "ALERT: $FUD token is about to dump hard! Dev wallet has moved funds. Sell now before it reaches zero! 🚨⚠️";
const authors = ["bot_account_1", "bot_account_2", "bot_account_3"];
const baseTime = Date.now();

for (let i = 0; i < 20; i++) {
  // Minor variations that keep Jaccard > 70%
  let text = baseText;
  if (i % 3 === 0) text = baseText + " !";
  if (i % 3 === 1) text = baseText.replace("ALERT:", "WARNING:") + " !!!";
  if (i % 3 === 2) text = baseText.toLowerCase();

  highSybilPosts.push({
    text,
    author_id: authors[i % authors.length],
    timestamp: baseTime + i * 15000, // spaced 15s apart (total 5 minutes window)
    username: authors[i % authors.length]
  });
}

// Scenario 2: Organic Chatter
// 20 completely unique posts by 20 unique users, spread out in time.
const organicPosts: SocialPost[] = [];
const organicTexts = [
  "Just read the FUD.ai docs. Interesting MCTS approach to pipeline evaluation.",
  "Is the Sol contract address verified yet? Couldn't find it on GoPlus.",
  "Price is holding support at 0.05. Volume is declining though.",
  "Can anyone explain the difference between heavy and light LLM engines in this project?",
  "Seems like Telegram sentiment is slightly more bullish than Twitter today.",
  "Looking at DexScreener liquidity, it has $120k USD. Not bad for a 2-day-old launch.",
  "GoPlus check says open source: true, mintable: false. Looks relatively safe.",
  "Bybit order book has some major sell walls. Might take a while to break through.",
  "Is this a utility token or just governance? Let me check the gitbook.",
  "The MCTS Reflexion critic step is what makes this pipeline different from general agents.",
  "Anyone testing the API locally? GET /api/agent/[job_id] returns 200 with completed payload.",
  "We need more data categories integrated. Maybe DefiLlama TVL data?",
  "FUD claims about the unlocked owner wallet were false. Checked RugCheck score.",
  "Accumulating some more spot here. High risk but potential is high.",
  "Is there any discord link? The telegram channel has too much noise.",
  "I like that the spam filter drops RT-giveaway bot signatures before LLM analysis.",
  "What is the current chatter level and drama index computed by the agent?",
  "The extreme verdict gate prevents unnecessary liquidated longs. Smart design.",
  "Just ran the verification test suite. Tests are 100% green.",
  "Interesting project, following the updates closely."
];

for (let i = 0; i < 20; i++) {
  organicPosts.push({
    text: organicTexts[i],
    author_id: `organic_user_${i}`,
    timestamp: baseTime + i * 3600000, // spaced 1 hour apart (total 20 hours window)
    username: `organic_user_${i}`
  });
}

// Scenario 3: Mixed (10 Sybil / Coordinated + 10 Organic posts)
const mixedPosts: SocialPost[] = [
  ...highSybilPosts.slice(0, 10),
  ...organicPosts.slice(0, 10)
];

// Run validation
console.log("==========================================");
console.log("COORDINATION & SYBIL DETECTOR MATH TESTING");
console.log("==========================================\n");

function runTest(name: string, posts: SocialPost[]) {
  console.log(`[TEST] ${name}`);
  console.log(`Total Posts: ${posts.length}`);
  
  const start = Date.now();
  const signals = computeCoordinationSignals(posts);
  const elapsed = Date.now() - start;
  
  console.log(`Execution Time: ${elapsed}ms`);
  console.log(`Metrics Output:`, JSON.stringify(signals, null, 2));
  console.log("------------------------------------------\n");
  return signals;
}

const highSybilResult = runTest("HIGH SYBIL SCENARIO", highSybilPosts);
const organicResult = runTest("ORGANIC CHATTER SCENARIO", organicPosts);
const mixedResult = runTest("MIXED CHATTER SCENARIO", mixedPosts);

// Assertions
console.log("=== MATHEMATICAL VALIDATION ASSERTIONS ===");

let passed = true;

// High Sybil Assertions
if (highSybilResult.unique_author_ratio !== (3 / 20)) {
  console.error(`❌ FAIL: High Sybil unique_author_ratio should be 0.15, got ${highSybilResult.unique_author_ratio}`);
  passed = false;
} else {
  console.log(`✅ PASS: High Sybil unique_author_ratio is exactly 0.15`);
}

if (highSybilResult.duplicate_text_cluster_size !== 20) {
  console.error(`❌ FAIL: High Sybil duplicate_text_cluster_size should be 20, got ${highSybilResult.duplicate_text_cluster_size}`);
  passed = false;
} else {
  console.log(`✅ PASS: High Sybil duplicate_text_cluster_size is exactly 20`);
}

// Spaced 15s apart for 20 posts -> 19 intervals of 15s = 285s = 4.75 minutes
const expectedBurst = (19 * 15 * 1000) / 60000;
if (Math.abs(highSybilResult.cross_platform_burst_window_minutes - expectedBurst) > 0.01) {
  console.error(`❌ FAIL: High Sybil burst window should be ${expectedBurst} minutes, got ${highSybilResult.cross_platform_burst_window_minutes}`);
  passed = false;
} else {
  console.log(`✅ PASS: High Sybil burst window is exactly ${expectedBurst} minutes`);
}

// Organic Assertions
if (organicResult.unique_author_ratio !== 1.0) {
  console.error(`❌ FAIL: Organic unique_author_ratio should be 1.0, got ${organicResult.unique_author_ratio}`);
  passed = false;
} else {
  console.log(`✅ PASS: Organic unique_author_ratio is exactly 1.0`);
}

if (organicResult.duplicate_text_cluster_size !== 1) {
  console.error(`❌ FAIL: Organic duplicate_text_cluster_size should be 1 (no duplicates), got ${organicResult.duplicate_text_cluster_size}`);
  passed = false;
} else {
  console.log(`✅ PASS: Organic duplicate_text_cluster_size is exactly 1`);
}

if (organicResult.cross_platform_burst_window_minutes !== 0) {
  console.error(`❌ FAIL: Organic burst window should be 0 (no duplicate cluster), got ${organicResult.cross_platform_burst_window_minutes}`);
  passed = false;
} else {
  console.log(`✅ PASS: Organic burst window is exactly 0`);
}

// Mixed Assertions
if (mixedResult.unique_author_ratio !== (13 / 20)) {
  console.error(`❌ FAIL: Mixed unique_author_ratio should be 0.65 (3 bot + 10 organic / 20), got ${mixedResult.unique_author_ratio}`);
  passed = false;
} else {
  console.log(`✅ PASS: Mixed unique_author_ratio is exactly 0.65`);
}

if (mixedResult.duplicate_text_cluster_size !== 10) {
  console.error(`❌ FAIL: Mixed duplicate_text_cluster_size should be 10 (the 10 bots), got ${mixedResult.duplicate_text_cluster_size}`);
  passed = false;
} else {
  console.log(`✅ PASS: Mixed duplicate_text_cluster_size is exactly 10`);
}

const expectedMixedBurst = (9 * 15 * 1000) / 60000;
if (Math.abs(mixedResult.cross_platform_burst_window_minutes - expectedMixedBurst) > 0.01) {
  console.error(`❌ FAIL: Mixed burst window should be ${expectedMixedBurst} minutes, got ${mixedResult.cross_platform_burst_window_minutes}`);
  passed = false;
} else {
  console.log(`✅ PASS: Mixed burst window is exactly ${expectedMixedBurst} minutes`);
}

if (passed) {
  console.log("\n🎉 ALL MATHEMATICAL VALIDATION TESTS PASSED PERFECTLY!");
  process.exit(0);
} else {
  console.log("\n❌ SOME TESTS FAILED. CHECK MATH LOGIC.");
  process.exit(1);
}
