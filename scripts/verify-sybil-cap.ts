/**
 * verify-sybil-cap.ts — Task 3: Sybil Volume Stress Test (CRITICAL-05 Fix)
 *
 * Generate 200 synthetic posts (30 near-duplicate cluster + 170 random unique),
 * panggil findLargestCluster dan computeCoordinationSignals langsung,
 * ukur execution time, dan verifikasi 100-post cap diterapkan.
 *
 * Pass criteria:
 *   - Execution time < 2000ms untuk 200 post
 *   - clusterSize mencerminkan cap 100 (bukan 200 post)
 *   - Tidak ada RangeError (stack-safe reduce digunakan)
 *
 * Run: npx tsx scripts/verify-sybil-cap.ts
 */

import { findLargestCluster, calculateBurstWindowMinutes, MAX_POSTS_FOR_CLUSTERING } from '../app/lib/ingestion/text_similarity';
import { computeCoordinationSignals, type SocialPost } from '../app/lib/ingestion/sybil_detector';

// ──────────────────────────────────────────────────────────────
// Synthetic post generator
// ──────────────────────────────────────────────────────────────

function randomWord(): string {
  const words = ['crypto', 'fud', 'moon', 'dump', 'scam', 'whale', 'pump', 'sell', 'buy', 'hold',
    'token', 'defi', 'yield', 'liquidity', 'rug', 'hack', 'exploit', 'ponzi', 'shill', 'bear'];
  return words[Math.floor(Math.random() * words.length)];
}

function randomSentence(length: number = 12): string {
  const parts: string[] = [];
  for (let i = 0; i < length; i++) parts.push(randomWord());
  return parts.join(' ');
}

/**
 * Generate nearDuplicateCount near-duplicate posts based on a template,
 * plus uniqueCount completely unique random posts.
 */
function generateSyntheticPosts(nearDuplicateCount: number, uniqueCount: number): SocialPost[] {
  const posts: SocialPost[] = [];
  const baseTimestamp = Date.now() - 3600_000; // 1 hour ago

  // Near-duplicate cluster: slight variations of the same core message
  const clusterTemplate = 'URGENT SELL NOW this token is a total scam and rug pull dump it immediately before you lose everything';
  for (let i = 0; i < nearDuplicateCount; i++) {
    // Minor variation: insert a random word at a random position
    const words = clusterTemplate.split(' ');
    const insertAt = Math.floor(Math.random() * words.length);
    words.splice(insertAt, 0, randomWord());
    posts.push({
      text: words.join(' '),
      username: `bot_${Math.floor(Math.random() * 5)}`, // only 5 unique authors
      author_id: `author_${Math.floor(Math.random() * 5)}`,
      timestamp: baseTimestamp + i * 60_000, // 1 minute apart
    });
  }

  // Unique random posts: completely different content
  for (let i = 0; i < uniqueCount; i++) {
    posts.push({
      text: `${randomSentence(8)} ${randomWord()} ${Date.now()}_${i}`, // inject uniquifier
      username: `user_${nearDuplicateCount + i}`,
      author_id: `unique_author_${i}`,
      timestamp: baseTimestamp + (nearDuplicateCount + i) * 30_000,
    });
  }

  // Shuffle so cluster posts are interspersed with unique ones
  for (let i = posts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [posts[i], posts[j]] = [posts[j], posts[i]];
  }

  return posts;
}

// ──────────────────────────────────────────────────────────────
// Main stress test
// ──────────────────────────────────────────────────────────────

async function runSybilStressTest() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Task 3 — Sybil Volume Stress Test (CRITICAL-05 Fix)     ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n[CONFIG] MAX_POSTS_FOR_CLUSTERING = ${MAX_POSTS_FOR_CLUSTERING}`);
  console.log('[CONFIG] Input: 200 posts (30 near-duplicate + 170 unique)');
  console.log('[CONFIG] Pass threshold: execution < 2000ms\n');

  const NEAR_DUPLICATE_COUNT = 30;
  const UNIQUE_COUNT = 170;
  const TOTAL = NEAR_DUPLICATE_COUNT + UNIQUE_COUNT;

  const posts = generateSyntheticPosts(NEAR_DUPLICATE_COUNT, UNIQUE_COUNT);
  console.log(`[GEN] Generated ${posts.length} synthetic posts (cluster: ${NEAR_DUPLICATE_COUNT}, unique: ${UNIQUE_COUNT})`);

  // ── Test A: findLargestCluster directly ───────────────────
  console.log('\n── Test A: findLargestCluster(200 posts) ──');
  const startA = performance.now();
  const clusterResult = findLargestCluster(posts);
  const elapsedA = performance.now() - startA;
  
  console.log(`[RESULT] Elapsed: ${elapsedA.toFixed(2)}ms`);
  console.log(`[RESULT] clusterSize: ${clusterResult.clusterSize}`);
  console.log(`[RESULT] Largest component indices count: ${clusterResult.indices.length}`);

  // ── Test B: computeCoordinationSignals (full function) ────
  console.log('\n── Test B: computeCoordinationSignals(200 posts) ──');
  const startB = performance.now();
  const coordResult = computeCoordinationSignals(posts);
  const elapsedB = performance.now() - startB;

  console.log(`[RESULT] Elapsed: ${elapsedB.toFixed(2)}ms`);
  console.log(`[RESULT] unique_author_ratio: ${coordResult.unique_author_ratio.toFixed(4)}`);
  console.log(`[RESULT] duplicate_text_cluster_size: ${coordResult.duplicate_text_cluster_size}`);
  console.log(`[RESULT] cross_platform_burst_window_minutes: ${coordResult.cross_platform_burst_window_minutes.toFixed(2)}`);

  // ── Test C: Verify cap is actually enforced ────────────────
  // The cap slices to first 100 posts sorted by timestamp desc.
  // So we verify the cluster size is bounded to ≤100 comparisons worth.
  console.log('\n── Test C: Cap enforcement verification ──');
  
  // Create posts where ALL 200 are near-duplicates — cap should still limit
  const allDupPosts = generateSyntheticPosts(200, 0);
  const startC = performance.now();
  const capResult = findLargestCluster(allDupPosts);
  const elapsedC = performance.now() - startC;
  
  console.log(`[RESULT] 200 near-dup posts elapsed: ${elapsedC.toFixed(2)}ms`);
  console.log(`[RESULT] clusterSize with 200 near-dups: ${capResult.clusterSize}`);
  console.log(`[RESULT] clusterSize should be ≤ MAX_POSTS_FOR_CLUSTERING (${MAX_POSTS_FOR_CLUSTERING})`);

  // ── PASS/FAIL EVALUATION ──────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('  PASS/FAIL EVALUATION');
  console.log('─────────────────────────────────────────────────────────────');

  const results: { check: string; pass: boolean; detail: string }[] = [];

  results.push({
    check: `Test A: findLargestCluster(200) < 2000ms`,
    pass: elapsedA < 2000,
    detail: `${elapsedA.toFixed(2)}ms`,
  });

  results.push({
    check: `Test B: computeCoordinationSignals(200) < 2000ms`,
    pass: elapsedB < 2000,
    detail: `${elapsedB.toFixed(2)}ms`,
  });

  results.push({
    check: `Test C: Cap enforced — 200 near-dup cluster ≤ ${MAX_POSTS_FOR_CLUSTERING}`,
    pass: capResult.clusterSize <= MAX_POSTS_FOR_CLUSTERING,
    detail: `clusterSize=${capResult.clusterSize}, max=${MAX_POSTS_FOR_CLUSTERING}`,
  });

  results.push({
    check: `Test C: 200 near-dup with cap still < 2000ms`,
    pass: elapsedC < 2000,
    detail: `${elapsedC.toFixed(2)}ms`,
  });

  results.push({
    check: `Test A: No RangeError (stack-safe reduce)`,
    pass: true, // if we got here, no RangeError was thrown
    detail: 'No exception thrown',
  });

  // Verify cluster detection is working (near-dups should form cluster)
  results.push({
    check: `Test A: Cluster detected from 30 near-dups (size > 0)`,
    pass: clusterResult.clusterSize > 0,
    detail: `clusterSize=${clusterResult.clusterSize}`,
  });

  let allPass = true;
  for (const r of results) {
    const icon = r.pass ? '✅' : '❌';
    console.log(`  ${icon} ${r.check}`);
    console.log(`     → ${r.detail}`);
    if (!r.pass) allPass = false;
  }

  console.log('\n─────────────────────────────────────────────────────────────');
  if (allPass) {
    console.log('  ✅ OVERALL: PASS — CRITICAL-05 O(n²) cap fix verified!');
    console.log(`  200 posts processed in ${elapsedA.toFixed(2)}ms (findLargestCluster)`);
    console.log(`  Cap at ${MAX_POSTS_FOR_CLUSTERING} posts enforced correctly`);
  } else {
    console.log('  ❌ OVERALL: FAIL — One or more checks failed');
  }
  console.log('─────────────────────────────────────────────────────────────\n');

  return {
    pass: allPass,
    testA: { elapsedMs: elapsedA, clusterSize: clusterResult.clusterSize },
    testB: { elapsedMs: elapsedB, coordResult },
    testC: { elapsedMs: elapsedC, clusterSize: capResult.clusterSize },
  };
}

runSybilStressTest().catch(console.error);
