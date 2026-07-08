/**
 * verify-calibration-coldstart.ts — Task 4: Calibration Cold-Start Sanity Check
 *
 * Panggil getCalibratedConfidence() langsung dengan bucket Redis yang BELUM
 * punya sampel historis (fresh/empty state via mocked Redis).
 *
 * Pass criteria:
 *   - Return value adalah number valid di rentang [0,1]
 *   - Tidak crash, tidak return NaN/undefined
 *   - Fallback ke rawConfidence (pass-through) saat bucket kosong
 *
 * Run: npx tsx scripts/verify-calibration-coldstart.ts
 */

// ──────────────────────────────────────────────────────────────
// Mock Redis BEFORE any imports that pull in client.ts
// client.ts throws at import time if env vars missing,
// AND actual Redis calls would go to real Upstash — we mock those.
// ──────────────────────────────────────────────────────────────

// Ensure env vars exist so client.ts doesn't throw at module load
if (!process.env.UPSTASH_REDIS_REST_URL) {
  process.env.UPSTASH_REDIS_REST_URL = 'https://placeholder.upstash.io';
}
if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
  process.env.UPSTASH_REDIS_REST_TOKEN = 'placeholder-token';
}

// ──────────────────────────────────────────────────────────────
// We mock the redis module BEFORE importing calibration.ts
// Use module-level monkey-patching via dynamic import with env override.
// 
// Strategy: Override the redis client's hgetall to return null (empty bucket)
// ──────────────────────────────────────────────────────────────

// Import calibration module — redis client will be initialized with placeholder env
// We then mock the redis object's hgetall method directly
import * as calibrationModule from '../app/lib/mcts/calibration';
import * as redisClientModule from '../app/lib/redis/client';

// Monkey-patch redis.hgetall to simulate cold-start (empty bucket)
const originalHgetall = (redisClientModule.redis as any).hgetall?.bind(redisClientModule.redis);
let mockActive = false;
let mockReturnValue: null | Record<string, string> = null;

// Override hgetall on the actual redis object
(redisClientModule.redis as any).hgetall = async (key: string) => {
  if (mockActive) {
    console.log(`[MOCK] redis.hgetall("${key}") → ${JSON.stringify(mockReturnValue)} (cold-start simulation)`);
    return mockReturnValue;
  }
  return originalHgetall ? originalHgetall(key) : null;
};

async function runColdStartTest() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Task 4 — Calibration Cold-Start Sanity Check            ');
  console.log('═══════════════════════════════════════════════════════════');

  const TEST_CONFIDENCES = [0.0, 0.25, 0.50, 0.75, 0.87, 1.0];
  const testResults: {
    rawConf: number;
    returned: number | null;
    pass: boolean;
    reason: string;
  }[] = [];

  // ── Scenario A: bucket returns null (completely empty) ────
  console.log('\n── Scenario A: hgetall returns null (bucket never existed) ──');
  mockActive = true;
  mockReturnValue = null;

  for (const rawConf of TEST_CONFIDENCES) {
    let returned: number | null | undefined;
    let threw = false;
    let throwMsg = '';

    try {
      returned = await calibrationModule.getCalibratedConfidence(rawConf);
    } catch (err: any) {
      threw = true;
      throwMsg = err?.message ?? String(err);
    }

    const isValidNumber = !threw && typeof returned === 'number' && !isNaN(returned) && returned >= 0 && returned <= 1;
    const isPassthrough = Math.abs((returned ?? NaN) - rawConf) < 0.0001;

    const pass = isValidNumber && isPassthrough;
    const reason = threw
      ? `THREW: ${throwMsg}`
      : !isValidNumber
        ? `Invalid: returned ${returned}`
        : !isPassthrough
          ? `Not passthrough: got ${returned}, expected ${rawConf}`
          : `OK: returned ${returned} === rawConf ${rawConf}`;

    testResults.push({ rawConf, returned: returned ?? null, pass, reason });
    const icon = pass ? '✅' : '❌';
    console.log(`  ${icon} getCalibratedConfidence(${rawConf}) → ${returned} ${pass ? '' : `[FAIL: ${reason}]`}`);
  }

  // ── Scenario B: bucket returns object with no total field ──
  console.log('\n── Scenario B: hgetall returns {} (bucket exists but empty fields) ──');
  mockReturnValue = {} as Record<string, string>;

  for (const rawConf of [0.5, 0.8]) {
    let returned: number | null | undefined;
    let threw = false;

    try {
      returned = await calibrationModule.getCalibratedConfidence(rawConf);
    } catch (err: any) {
      threw = true;
    }

    const isValidNumber = !threw && typeof returned === 'number' && !isNaN(returned) && returned >= 0 && returned <= 1;
    const isPassthrough = Math.abs((returned ?? NaN) - rawConf) < 0.0001;
    const pass = isValidNumber && isPassthrough;

    testResults.push({ rawConf, returned: returned ?? null, pass, reason: pass ? `OK: passthrough ${returned}` : `Failed: threw=${threw}, returned=${returned}` });
    const icon = pass ? '✅' : '❌';
    console.log(`  ${icon} getCalibratedConfidence(${rawConf}) with empty {} → ${returned}`);
  }

  // ── Scenario C: null input ────────────────────────────────
  console.log('\n── Scenario C: null input (should return null) ──');
  let nullResult: any;
  let threw = false;
  try {
    nullResult = await calibrationModule.getCalibratedConfidence(null);
  } catch (err) {
    threw = true;
  }
  const nullPass = !threw && nullResult === null;
  console.log(`  ${nullPass ? '✅' : '❌'} getCalibratedConfidence(null) → ${nullResult} (expected: null)`);
  testResults.push({ rawConf: -1, returned: null, pass: nullPass, reason: nullPass ? 'null → null (correct)' : `Got ${nullResult}` });

  mockActive = false;

  // ── PASS/FAIL EVALUATION ──────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('  PASS/FAIL EVALUATION');
  console.log('─────────────────────────────────────────────────────────────');

  const allPass = testResults.every(r => r.pass);
  const failCount = testResults.filter(r => !r.pass).length;

  console.log(`  Total tests: ${testResults.length}`);
  console.log(`  Passed: ${testResults.filter(r => r.pass).length}`);
  console.log(`  Failed: ${failCount}`);

  if (failCount > 0) {
    console.log('\n  Failed cases:');
    for (const r of testResults.filter(r => !r.pass)) {
      console.log(`    ❌ rawConf=${r.rawConf}: ${r.reason}`);
    }
  }

  console.log('\n─────────────────────────────────────────────────────────────');
  if (allPass) {
    console.log('  ✅ OVERALL: PASS — Calibration cold-start verified!');
    console.log('  getCalibratedConfidence() safely passes through rawConfidence');
    console.log('  when no bucket data exists — no crash, no NaN, no exception.');
  } else {
    console.log('  ❌ OVERALL: FAIL — One or more checks failed');
  }
  console.log('─────────────────────────────────────────────────────────────\n');

  return { pass: allPass, results: testResults };
}

runColdStartTest().catch(console.error);
