/**
 * fetchWithTimeout — wraps native fetch() with a hard AbortController timeout.
 *
 * Fixes CRITICAL-01: every external HTTP call in the ingestion and LLM layers
 * now has a bounded lifetime. A hanging upstream API can no longer starve the
 * entire serverless process forever.
 *
 * @param url        The request URL (string or URL object)
 * @param options    Standard RequestInit options (headers, method, body, …)
 * @param timeoutMs  Maximum milliseconds to wait before aborting.
 *                   Default: 10 000 ms (10 s) — suitable for data APIs.
 *                   Pass 30 000 ms for LLM inference calls.
 * @throws {Error}  'Request timed out after Xms: <url>' on timeout.
 *                  All other network errors propagate unchanged.
 */
export async function fetchWithTimeout(
  url: string | URL,
  options?: RequestInit,
  timeoutMs: number = 10_000
): Promise<Response> {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    // AbortError is thrown when our timer fires
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
