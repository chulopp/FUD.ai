import { DispatcherStrategy } from '../mcts/dispatcher';

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
export async function searchTwitterRapidAPI(
  query: string,
  limit: number = 20
): Promise<TweetResult[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  const apiHost = process.env.RAPIDAPI_HOST || 'twitter-api45.p.rapidapi.com';

  if (!apiKey) {
    console.warn('[RapidAPI Twitter] RAPIDAPI_KEY is not defined. Returning empty array.');
    return [];
  }

  const results: TweetResult[] = [];
  try {
    const url = `https://${apiHost}/search.php?query=${encodeURIComponent(query)}&search_type=Latest`;
    
    console.log(`[RapidAPI Twitter] Fetching tweets for query: "${query}"...`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': apiHost,
      },
    });

    if (!response.ok) {
      console.warn(`[RapidAPI Twitter] Request failed with status ${response.status}: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    if (data.status !== 'ok' || !Array.isArray(data.timeline)) {
      console.warn('[RapidAPI Twitter] API response status is not ok or timeline is missing.', data);
      return [];
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
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[RapidAPI Twitter] searchTwitterRapidAPI failed: ${msg}`);
  }

  return results;
}

/**
 * Pipeline-compatible wrapper consumed by the MCTS Dispatcher.
 * Respects the `social_rapidapi_twitter` strategy gate.
 */
export async function fetchTwitterIntel(
  coinSymbol: string,
  strategy?: DispatcherStrategy
): Promise<{ text: string; fallback: boolean; skipped?: boolean }> {
  try {
    if (strategy && !strategy.social_rapidapi_twitter) {
      console.log(
        '⏭️ [Ingestion] Skipping Twitter fetch (not requested by dispatcher)'
      );
      return { text: '[]', fallback: false, skipped: true };
    }

    // Default query: cashtag + token name. The cashtag is the strongest sentiment signal.
    const cleanSymbol = coinSymbol.replace(/^[$]/, '').toUpperCase();
    const query = `$${cleanSymbol} OR ${cleanSymbol} crypto`;
    const tweets = await searchTwitterRapidAPI(query, 20);

    const payload = tweets.map((t) => ({
      username: t.username,
      text: t.text,
      likes: t.likes,
      retweets: t.retweets,
      createdAt: t.createdAt,
      url: t.url,
    }));

    return {
      text: JSON.stringify(payload, null, 2),
      fallback: payload.length === 0,
    };
  } catch (error) {
    console.error(
      `[Ingestion Error] fetchTwitterIntel failed for ${coinSymbol}:`,
      error
    );
    return { text: '[]', fallback: true };
  }
}
