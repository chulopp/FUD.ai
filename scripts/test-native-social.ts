/**
 * FUD.ai — Native Social Layer Isolation Test
 *
 * Verifies the POST-PIVOT ingestion layer (no MCP) for Telegram + Twitter:
 *   - scrapeTelegramChannel('whale_alert_io')   (axios + cheerio web scraper)
 *   - searchTwitterSentiment('$BONK')            (agent-twitter-client)
 *
 * Run with:  npx tsx test-native-social.ts
 */

import { scrapeTelegramChannel, DEFAULT_TELEGRAM_CHANNELS } from '../app/lib/ingestion/telegram';
import { searchTwitterRapidAPI as searchTwitterSentiment } from '../app/lib/ingestion/rapidapi_twitter';

const line = '━'.repeat(80);
function banner(title: string) {
  console.log(`\n${line}\n${title}\n${line}`);
}
const pretty = (obj: unknown) => JSON.stringify(obj, null, 2);

async function main() {
  console.log(line);
  console.log('🧪 FUD.ai — Native Social Layer Isolation Test (POST-MCP-PIVOT)');
  console.log(line);
  console.log(`Telegram engine : axios + cheerio  (t.me/s/{username})`);
  console.log(`Twitter engine  : RapidAPI (Twitter API 45)`);
  console.log(`Default TG list : ${DEFAULT_TELEGRAM_CHANNELS.length} channels`);
  console.log(
    `Twitter auth    : ${
      process.env.RAPIDAPI_KEY
        ? 'RapidAPI key loaded'
        : 'no RapidAPI key (will fallback/fail)'
    }`
  );
  console.log(line);

  const result: { telegram?: { ok?: boolean; count?: number; messages?: unknown[]; error?: string }; twitter?: { ok?: boolean; count?: number; tweets?: unknown[]; error?: string } } = {};

  // ── STEP 1: Telegram — scrape a single channel ───────────────────────────
  banner('[1/2] Telegram — scrapeTelegramChannel("whale_alert_io")');
  try {
    const tgStart = Date.now();
    const messages = await scrapeTelegramChannel('whale_alert_io', 5);
    const dt = ((Date.now() - tgStart) / 1000).toFixed(2);
    console.log(`✅ Scraped ${messages.length} messages in ${dt}s`);
    if (messages.length > 0) {
      console.log('— FIRST 5 MESSAGES —');
      console.log(pretty(messages));
    } else {
      console.log('⚠️  No messages returned (channel may be empty or rate-limited).');
    }
    result.telegram = { ok: true, count: messages.length, messages };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Telegram scrape threw: ${msg}`);
    result.telegram = { ok: false, error: msg };
  }

  // ── STEP 2: Twitter — searchTwitterSentiment("$BONK") ─────────────────────
  banner('[2/2] Twitter — searchTwitterSentiment("$BONK"), limit 10');
  try {
    const twStart = Date.now();
    const searchRes = await searchTwitterSentiment('$BONK', 10);
    const tweets = searchRes.status === 'ok' ? searchRes.tweets : [];
    const dt = ((Date.now() - twStart) / 1000).toFixed(2);
    console.log(`✅ Retrieved ${tweets.length} tweets in ${dt}s`);
    if (tweets.length > 0) {
      console.log('— TWEETS —');
      console.log(pretty(tweets));
    } else {
      console.log('⚠️  No tweets returned (guest rate-limit likely — set TWITTER_USERNAME/PASSWORD or check API status). Status: ' + searchRes.status);
    }
    result.twitter = { ok: tweets.length > 0, count: tweets.length, tweets };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Twitter search threw: ${msg}`);
    result.twitter = { ok: false, error: msg };
  }

  // ── Verdict ──────────────────────────────────────────────────────────────
  banner('🏁 FINAL VERDICT');
  const tgOk = !!result.telegram?.ok && (result.telegram?.count || 0) > 0;
  const twOk = result.twitter?.ok === true && (result.twitter?.count || 0) > 0;
  console.log(`Telegram scraper : ${tgOk ? '✅ WORKS — ' + result.telegram?.count + ' msgs' : '❌ EMPTY / FAILED'}`);
  console.log(`Twitter scraper  : ${twOk ? '✅ WORKS — ' + result.twitter?.count + ' tweets' : '⚠️  EMPTY (probably guest rate-limit; set TWITTER creds)'}`);

  const fs = await import('fs');
  fs.writeFileSync('./test-native-social-result.json', pretty(result));
  console.log('\n💾 Full results written to test-native-social-result.json');
}

main().catch((e) => {
  console.error('Fatal error in test runner:', e);
  process.exit(1);
});