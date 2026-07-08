#!/usr/bin/env node
/**
 * Shim runner — defers to `tsx test-native-social.ts` so the ESM TypeScript
 * ingestion modules resolve directly from source (no build step required).
 *
 * Usage: node test-native-social.js
 */
const { spawnSync } = require('child_process');
const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['tsx', 'test-native-social.ts'],
  { stdio: 'inherit', cwd: __dirname }
);
process.exit(result.status || 0);