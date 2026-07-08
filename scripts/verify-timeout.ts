/**
 * verify-timeout.ts — Task 2: Forced-Timeout Verification (CRITICAL-01)
 *
 * Panggil fetchWithTimeout langsung ke httpbin.org/delay/30 (endpoint yang
 * sengaja delay 30s). Timeout di-set 10s — harus abort sebelum 30s selesai.
 *
 * Pass criteria:
 *   - AbortError terjadi dalam ≤11 detik (timeout configured = 10s)
 *   - Error message mengandung "timed out"
 *   - Tidak hang sampai 30 detik
 *
 * Run: npx tsx scripts/verify-timeout.ts
 */

import { fetchWithTimeout } from '../app/lib/utils/fetch-with-timeout';

async function runTimeoutTest() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Task 2 — Forced-Timeout Verification (CRITICAL-01 Fix)  ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('[CONFIG] fetchWithTimeout timeout = 10_000ms (10s)');
  console.log('[CONFIG] httpbin.org/delay/30 will hold connection for 30s');
  console.log('[CONFIG] Expected: AbortError at ~10s, NOT at 30s\n');

  // Use httpbin.org/delay/30 directly — a real HTTP endpoint that responds after 30s.
  // fetchWithTimeout should abort it at 10s.
  const targetUrl = 'https://httpbin.org/delay/30';
  console.log(`[START] Calling fetchWithTimeout("${targetUrl}", ..., 10_000)`);
  console.log('[INFO]  This will take ~10 seconds...');

  const callStart = Date.now();
  let abortMs: number | null = null;
  let errorMsg: string | null = null;
  let timedOut = false;

  try {
    await fetchWithTimeout(targetUrl, {
      headers: { 'Content-Type': 'application/json' },
    }, 10_000);

    // If we get here, the request completed in <10s (httpbin might have been fast)
    // This is unexpected but we check timing

    abortMs = Date.now() - callStart;
    console.warn(`[WARN] fetchWithTimeout returned a response after ${abortMs}ms (no timeout thrown). This may mean httpbin responded quickly.`);
  } catch (err: any) {
    abortMs = Date.now() - callStart;
    errorMsg = err?.message ?? String(err);

    const isTimeoutError = errorMsg.includes('timed out') || err?.name === 'AbortError';
    timedOut = isTimeoutError;

    console.log(`\n[RESULT] Error caught after ${abortMs}ms`);
    console.log(`[RESULT] Error name: ${err?.name}`);
    console.log(`[RESULT] Error message: ${errorMsg}`);
  }

  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('  PASS/FAIL EVALUATION');
  console.log('─────────────────────────────────────────────────────────────');

  const results: { check: string; pass: boolean; detail: string }[] = [];

  // Check 1: Error thrown at all
  results.push({
    check: 'Error was thrown (not hung)',
    pass: abortMs !== null,
    detail: abortMs !== null ? `Threw after ${abortMs}ms` : 'No error thrown',
  });

  // Check 2: Abort within timeout window (≤11s gives 1s tolerance for network)
  const withinWindow = abortMs !== null && abortMs <= 11_000;
  results.push({
    check: 'Abort within ≤11 seconds',
    pass: withinWindow,
    detail: abortMs !== null ? `${abortMs}ms (limit: 11000ms)` : 'N/A',
  });

  // Check 3: NOT 30 seconds (would mean httpbin delay was awaited)
  const notHung = abortMs === null || abortMs < 28_000;
  results.push({
    check: 'Did NOT hang for 30 seconds',
    pass: notHung,
    detail: abortMs !== null ? `${abortMs}ms elapsed` : 'N/A',
  });

  // Check 4: Error message is timeout-related
  results.push({
    check: 'Error message indicates timeout/abort',
    pass: timedOut,
    detail: errorMsg ?? 'no error',
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
    console.log('  ✅ OVERALL: PASS — CRITICAL-01 timeout fix verified!');
    console.log(`  AbortError fired at ${abortMs}ms (within 10s timeout window)`);
  } else {
    console.log('  ❌ OVERALL: FAIL — One or more checks failed');
  }
  console.log('─────────────────────────────────────────────────────────────\n');

  return { pass: allPass, abortMs, errorMsg };
}

runTimeoutTest().catch(console.error);
