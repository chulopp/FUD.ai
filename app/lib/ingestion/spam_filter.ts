/**
 * Spam filter for social media posts.
 *
 * Applied BEFORE social data is passed to the LLM to prevent giveaway-bot
 * noise, airdrop spam, and multi-cashtag scam posts from contaminating the
 * evidence chain.
 *
 * Design: Regex-only for MVP (no ML classifier). Fast, deterministic,
 * zero latency overhead.
 */

// ─────────────────────────────────────────────────────────────
// Spam patterns — ordered roughly by signal strength
// ─────────────────────────────────────────────────────────────

const SPAM_PATTERNS: RegExp[] = [
  /\$RETWEET/i,                      // Classic RT-giveaway bot signature
  /\bairdrop\b/i,                    // Airdrop announcements
  /\bclaim\s+now\b/i,               // "Claim now" CTA
  /\bDM\s+me\b/i,                   // DM solicitations
  /send\s+\d+\s*(SOL|ETH|BNB|BTC|USDT)/i, // "Send 0.1 ETH" scams
  /\bfree\s+(token|nft|mint|coin)/i, // Free token giveaways
  /\bwhitelist\s+spot\b/i,          // Whitelist scam
  /\bfollow\s+\+\s*like\b/i,        // Follow + like engagement bait
  /\bpresale\s+now\b/i,             // Presale spam
  /click\s+(here|link\s+in\s+bio)/i, // Link-in-bio phishing
];

// Drop posts with more than this many distinct cashtags ($XXX) — signals
// cross-promotion bots, not genuine sentiment about the target token.
const MAX_DISTINCT_CASHTAGS = 3;

export interface SpammablePost {
  text: string;
  [key: string]: unknown;
}

/**
 * Returns only posts that pass all spam heuristics.
 *
 * @param posts  Array of post objects with at minimum a `text` field.
 * @returns      Filtered array — spam posts removed.
 */
export function filterSpamPosts<T extends SpammablePost>(posts: T[]): T[] {
  const before = posts.length;
  const filtered = posts.filter(post => {
    const text = post.text ?? '';

    // Check for known spam regex patterns
    if (SPAM_PATTERNS.some(re => re.test(text))) {
      return false;
    }

    // Check for excessive distinct cashtags
    const cashtags = new Set(
      (text.match(/\$[A-Z]{2,10}\b/gi) ?? []).map(t => t.toUpperCase())
    );
    if (cashtags.size > MAX_DISTINCT_CASHTAGS) {
      return false;
    }

    return true;
  });

  const dropped = before - filtered.length;
  if (dropped > 0) {
    console.log(`🚫 [SpamFilter] Dropped ${dropped}/${before} posts as spam/giveaway bot noise.`);
  }

  return filtered;
}
