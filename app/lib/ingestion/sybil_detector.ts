export interface SocialPost {
  username?: string;
  channel?: string;
  text: string;
  likes?: number;
  retweets?: number;
  views?: string | null;
  createdAt?: string | null;
  author_id?: string;
  timestamp?: number;
}

export interface CoordinationSignals {
  unique_author_ratio: number;
  duplicate_text_cluster_size: number;
  cross_platform_burst_window_minutes: number;
}

/**
 * Extracts character 3-grams from text for Jaccard similarity comparison.
 */
function get3Grams(text: string): Set<string> {
  const grams = new Set<string>();
  // Normalize whitespace and convert to lowercase
  const cleanText = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (cleanText.length < 3) {
    if (cleanText.length > 0) {
      grams.add(cleanText);
    }
    return grams;
  }
  for (let i = 0; i < cleanText.length - 2; i++) {
    grams.add(cleanText.substring(i, i + 3));
  }
  return grams;
}

/**
 * Calculates Jaccard similarity between two sets.
 */
function calculateJaccard(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersectionSize = 0;
  for (const elem of setA) {
    if (setB.has(elem)) {
      intersectionSize++;
    }
  }
  const unionSize = setA.size + setB.size - intersectionSize;
  if (unionSize === 0) return 0;
  return intersectionSize / unionSize;
}

/**
 * Computes coordination and Sybil detection metrics from raw social posts.
 * Pure heuristics based on unique authors, duplication Jaccard clustering, and time bursts.
 */
export function computeCoordinationSignals(posts: SocialPost[]): CoordinationSignals {
  if (posts.length === 0) {
    return {
      unique_author_ratio: 1.0,
      duplicate_text_cluster_size: 0,
      cross_platform_burst_window_minutes: 0,
    };
  }

  // 1. Unique author ratio
  // Extract all author_ids (fallback to channel or username or random string if missing)
  const authors = posts.map((p, idx) => p.author_id || p.username || p.channel || `unknown_${idx}`);
  const uniqueAuthors = new Set(authors);
  const unique_author_ratio = uniqueAuthors.size / posts.length;

  // 2. Pre-extract 3-grams for all posts
  const postGrams = posts.map(p => get3Grams(p.text));

  // 3. Build adjacency list of similar posts (>70% Jaccard similarity)
  const n = posts.length;
  const adj: number[][] = Array.from({ length: n }, () => []);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = calculateJaccard(postGrams[i], postGrams[j]);
      if (sim > 0.70) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }

  // 4. Find all connected components (clusters)
  const visited = new Uint8Array(n);
  const components: number[][] = [];

  for (let i = 0; i < n; i++) {
    if (visited[i] === 0) {
      const comp: number[] = [];
      const queue: number[] = [i];
      visited[i] = 1;

      while (queue.length > 0) {
        const curr = queue.shift()!;
        comp.push(curr);

        for (const neighbor of adj[curr]) {
          if (visited[neighbor] === 0) {
            visited[neighbor] = 1;
            queue.push(neighbor);
          }
        }
      }
      components.push(comp);
    }
  }

  // 5. Identify largest cluster (connected component)
  let largestComponent: number[] = [];
  let maxClusterSize = 0;

  for (const comp of components) {
    if (comp.length > maxClusterSize) {
      maxClusterSize = comp.length;
      largestComponent = comp;
    }
  }

  // 6. Calculate cross platform burst window for the largest cluster (in minutes)
  let cross_platform_burst_window_minutes = 0;
  if (largestComponent.length > 1) {
    const timestamps = largestComponent
      .map(idx => posts[idx].timestamp)
      .filter((t): t is number => typeof t === 'number' && !isNaN(t));

    if (timestamps.length > 1) {
      const minTs = Math.min(...timestamps);
      const maxTs = Math.max(...timestamps);
      cross_platform_burst_window_minutes = (maxTs - minTs) / 60000;
    }
  }

  return {
    unique_author_ratio,
    duplicate_text_cluster_size: maxClusterSize,
    cross_platform_burst_window_minutes,
  };
}
