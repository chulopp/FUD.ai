/**
 * rapidapi_twitter.ts — Twitter/X intel via RapidAPI "Twitter API 45".
 *
 * CRITICAL-01 fix: fetch() replaced with fetchWithTimeout() (10s).
 */

import { DispatcherStrategy } from '../mcts/dispatcher';
import { type IngestionResult, type SocialIntelData, ok, empty, ingestionError, notCalled } from './types';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

export interface TweetResult {
  id: string;
  username: string;
  text: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  views?: number;
  createdAt?: string;
  url?: string;
}

/**
 * Searches recent tweets using the RapidAPI "Twitter API 45" by alexanderxbx.
 *
 * @param query Search query.
 * @param limit Max results to parse (default 20).
 */
export type TwitterSearchResult =
  | { status: 'ok'; tweets: TweetResult[] }
  | { status: 'error'; reason: string }
  | { status: 'empty' };

/**
 * Searches recent tweets using the RapidAPI "Twitter API 45" by alexanderxbx.
 *
 * @param query Search query.
 * @param limit Max results to parse (default 20).
 */
export async function searchTwitterRapidAPI(
  query: string,
  limit: number = 20
): Promise<TwitterSearchResult> {
  const apiKey = process.env.RAPIDAPI_KEY;
  const apiHost = process.env.RAPIDAPI_HOST || 'twitter-api45.p.rapidapi.com';

  if (!apiKey) {
    console.warn('[RapidAPI Twitter] RAPIDAPI_KEY is not defined. Returning empty status.');
    return { status: 'empty' };
  }

  const results: TweetResult[] = [];
  try {
    const url = `https://${apiHost}/search.php?query=${encodeURIComponent(query)}&search_type=Latest`;

    console.log(`[RapidAPI Twitter] Fetching tweets for query: "${query}"...`);
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': apiHost,
      },
    }, 10_000);

    if (!response.ok) {
      const errMsg = `Request failed with status ${response.status}: ${response.statusText}`;
      console.warn(`[RapidAPI Twitter] ${errMsg}`);
      return { status: 'error', reason: errMsg };
    }

    const data = await response.json();
    if (data.status !== 'ok' || !Array.isArray(data.timeline)) {
      const errMsg = `API response status is not ok or timeline is missing. Status: ${data?.status}`;
      console.warn(`[RapidAPI Twitter] ${errMsg}`, data);
      return { status: 'error', reason: errMsg };
    }

    for (const item of data.timeline) {
      if (results.length >= limit) break;
      if (item.type !== 'tweet') continue;

      const id = item.tweet_id ?? '';
      const username = item.screen_name ?? '';
      const likes = typeof item.favorites === 'number' ? item.favorites : undefined;
      const retweets = typeof item.retweets === 'number' ? item.retweets : undefined;
      const replies = typeof item.replies === 'number' ? item.replies : undefined;

      let views: number | undefined = undefined;
      if (item.views !== undefined && item.views !== null) {
        const parsedViews = parseInt(String(item.views).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsedViews)) views = parsedViews;
      }

      let createdAt: string | undefined = undefined;
      if (item.created_at) {
        try {
          createdAt = new Date(item.created_at).toISOString();
        } catch {
          // Keep undefined if date parsing fails
        }
      }

      results.push({
        id,
        username,
        text: item.text ?? '',
        likes,
        retweets,
        replies,
        views,
        createdAt,
        url: id && username ? `https://x.com/${username}/status/${id}` : undefined,
      });
    }

    console.log(`[RapidAPI Twitter] Successfully parsed ${results.length} tweets.`);
    if (results.length === 0) {
      return { status: 'empty' };
    }
    return { status: 'ok', tweets: results };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[RapidAPI Twitter] searchTwitterRapidAPI failed: ${msg}`);
    return { status: 'error', reason: msg };
  }
}

/**
 * Pipeline-compatible wrapper consumed by the MCTS pipeline.
 * Returns IngestionResult<SocialIntelData> so downstream can distinguish
 * "fetched but empty" from "was never called" from "errored".
 */
export async function fetchTwitterIntel(
  coinSymbol: string,
  strategy?: DispatcherStrategy
): Promise<IngestionResult<SocialIntelData>> {
  if (strategy && !strategy.social_rapidapi_twitter) {
    console.log('⏭️ [Ingestion] Skipping Twitter fetch (not requested by dispatcher)');
    return notCalled<SocialIntelData>();
  }

  try {
    const cleanSymbol = coinSymbol.replace(/^[$]/, '').toUpperCase();
    const query = `$${cleanSymbol} OR ${cleanSymbol} crypto`;
    const searchRes = await searchTwitterRapidAPI(query, 20);

    if (searchRes.status === 'error') {
      return ingestionError<SocialIntelData>(searchRes.reason);
    }
    if (searchRes.status === 'empty' || !searchRes.tweets || searchRes.tweets.length === 0) {
      return empty<SocialIntelData>();
    }

    const posts = searchRes.tweets.map(t => {
      const timestamp = t.createdAt ? new Date(t.createdAt).getTime() : Date.now();
      return {
        username: t.username,
        text: t.text,
        likes: t.likes,
        retweets: t.retweets,
        createdAt: t.createdAt,
        author_id: t.username ? `twitter_${t.username}` : undefined,
        timestamp,
      };
    });

    return ok<SocialIntelData>({ posts });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Ingestion Error] fetchTwitterIntel failed for ${coinSymbol}:`, msg);
    return ingestionError<SocialIntelData>(msg);
  }
}

