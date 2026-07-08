import axios from 'axios';
import * as cheerio from 'cheerio';
import { DispatcherStrategy } from '../mcts/dispatcher';
import { type IngestionResult, type SocialIntelData, ok, empty, ingestionError, notCalled } from './types';

// ─────────────────────────────────────────────────────────────
// Native Telegram Web Scraper
// Replaces the chaindead/telegram-mcp (MTProto) server. This reads the public
// web preview at https://t.me/s/{username} which Telegram exposes for every
// public channel — no login, no API key, no rate-limited user session.
// ─────────────────────────────────────────────────────────────

export interface TelegramMessage {
  id: string;
  channel: string;
  datetime: string | null;
  text: string;
  views: string | null;
  media: string[];
}

/**
 * Default intel channel list (Option A) — general crypto FUD / sentiment sources.
 * Curated per FUD.ai social ingestion brief.
 */
export const DEFAULT_TELEGRAM_CHANNELS: string[] = [
  'whale_alert_io',
  'SM_News_24h',
  'Next100XGEMSchat',
  'CoingraphNews',
  'Coinglass',
  'sambelikanlabs',
  'binance_announcements',
  'cointelegraph',
  'tomketloversreborn',
  'Phantom_Solana_calls',
  'santiment_network',
  'vipdrprofit',
  'glassnode',
  'signalsbitcoinandethereum',
  'CryptoBotEN',
  'NEXT100XGEMS',
  'blumcrypto_memepad',
];

const axiosInstance = axios.create({
  timeout: 15000,
  maxRedirects: 5,
  headers: {
    // A realistic UA helps avoid the basic bot-quarantine interstitial.
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
  },
});

/**
 * Scrape the latest messages from a single public Telegram channel via the
 * web preview endpoint (https://t.me/s/{username}).
 *
 * @param username Telegram channel username (without the @).
 * @param limit    Maximum number of messages to return (default 10).
 */
export async function scrapeTelegramChannel(
  username: string,
  limit: number = 10
): Promise<TelegramMessage[]> {
  const cleanName = username.replace(/^@/, '').trim();
  if (!cleanName) return [];

  const url = `https://t.me/s/${cleanName}`;
  try {
    const { data: html } = await axiosInstance.get<string>(url, {
      responseType: 'text',
    });

    const $ = cheerio.load(html);
    const messages: TelegramMessage[] = [];

    $('.tgme_widget_message_wrap').each((_i, el) => {
      if (messages.length >= limit) return false;

      const $msg = $(el);
      const id =
        $msg.attr('data-post') ||
        $msg.find('.tgme_widget_message').attr('data-post') ||
        '';
      const datetime =
        $msg.find('.tgme_widget_message_date time').attr('datetime') || null;
      const $text = $msg.find('.tgme_widget_message_text');
      const text = $text.text().trim();
      const views =
        $msg.find('.tgme_widget_message_views').text().trim() || null;

      const media: string[] = [];
      $msg.find('.tgme_widget_message_photo_wrap, .tgme_widget_message_video').each((_j, m) => {
        const bg = $(m).css('background-image') || '';
        const urlMatch = bg.match(/url\(['"']?(.*?)['"']?\)/);
        if (urlMatch) media.push(urlMatch[1]);
        const vid = $(m).attr('src');
        if (vid) media.push(vid);
      });

      // Skip empty/system messages — keep only ones with actual text content.
      if (!text) return;
      messages.push({
        id,
        channel: cleanName,
        datetime,
        text,
        views,
        media,
      });
    });

    return messages;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[Telegram Scraper] Failed to scrape @${cleanName}: ${msg}`);
    return [];
  }
}

/**
 * Scan the default intel channel list for messages mentioning the target coin.
 * Returns IngestionResult<SocialIntelData> so callers can distinguish
 * "fetched but nothing relevant" (empty) vs "never called" (not_called).
 */
export async function fetchTelegramIntel(
  coinSymbol: string,
  strategy?: DispatcherStrategy,
  dynamicChannel?: string
): Promise<IngestionResult<SocialIntelData>> {
  if (strategy && !strategy.social_telegram) {
    console.log('⏭️ [Ingestion] Skipping Telegram scrape (not requested by dispatcher)');
    return notCalled<SocialIntelData>();
  }

  try {
    const channels = [...DEFAULT_TELEGRAM_CHANNELS];
    if (dynamicChannel && !channels.includes(dynamicChannel)) {
      channels.push(dynamicChannel);
    }

    const allMessages: TelegramMessage[] = [];
    const CONCURRENCY_LIMIT = 5;

    // Scrape channels in chunks of CONCURRENCY_LIMIT to avoid rate limits / socket exhaustion (HIGH-03)
    for (let i = 0; i < channels.length; i += CONCURRENCY_LIMIT) {
      const chunk = channels.slice(i, i + CONCURRENCY_LIMIT);
      const settled = await Promise.allSettled(
        chunk.map(c => scrapeTelegramChannel(c, 10))
      );
      settled.forEach(s => {
        if (s.status === 'fulfilled') allMessages.push(...s.value);
      });
    }


    // Filter for messages mentioning the coin symbol (case-insensitive whole-symbol match
    // to avoid false positives like "BONK" matching "BONKER").
    const symbolUpper = coinSymbol.toUpperCase();
    const coinRe = new RegExp(`\\$?${symbolUpper}\\b`, 'i');
    const filtered = allMessages.filter(m => coinRe.test(m.text));

    // Even if no coin-specific matches, return a small sample of recent headlines
    // so the Lightweight Engine can detect ambient FUD sentiment.
    const selected = filtered.length > 0 ? filtered : allMessages.slice(0, 10);

    if (selected.length === 0) {
      return empty<SocialIntelData>();
    }

    const posts = selected.map(m => {
      const timestamp = m.datetime ? new Date(m.datetime).getTime() : Date.now();
      return {
        channel: m.channel,
        text: m.text,
        views: m.views,
        createdAt: m.datetime,
        author_id: m.channel ? `telegram_${m.channel}` : undefined,
        timestamp,
      };
    });

    return ok<SocialIntelData>({ posts });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Ingestion Error] fetchTelegramIntel failed for ${coinSymbol}:`, msg);
    return ingestionError<SocialIntelData>(msg);
  }
}