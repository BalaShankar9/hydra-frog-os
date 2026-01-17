/**
 * Normalize a URL for deduplication and comparison.
 *
 * Rules:
 * - Return null if invalid or unsupported scheme
 * - Only allow http/https
 * - Lowercase hostname
 * - Remove fragment (#)
 * - Remove ignored params
 * - Sort remaining query params alphabetically
 * - Remove trailing slash except root "/"
 * - Remove default ports :80/:443
 */
export function normalizeUrl(rawUrl: string, ignoreParams: string[]): string | null {
  try {
    const url = new URL(rawUrl);

    // Only allow http/https
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    // Lowercase hostname
    url.hostname = url.hostname.toLowerCase();

    // Remove default ports
    if ((url.protocol === 'http:' && url.port === '80') ||
        (url.protocol === 'https:' && url.port === '443')) {
      url.port = '';
    }

    // Remove fragment
    url.hash = '';

    // Process query params: remove ignored, sort remaining
    const params = new URLSearchParams(url.search);
    const ignoreSet = new Set(ignoreParams.map(p => p.toLowerCase()));
    const filteredParams: [string, string][] = [];

    for (const [key, value] of params.entries()) {
      if (!ignoreSet.has(key.toLowerCase())) {
        filteredParams.push([key, value]);
      }
    }

    // Sort alphabetically by key
    filteredParams.sort((a, b) => a[0].localeCompare(b[0]));

    // Rebuild search string
    if (filteredParams.length > 0) {
      url.search = '?' + filteredParams.map(([k, v]) => {
        if (v === '') {
          return encodeURIComponent(k);
        }
        return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
      }).join('&');
    } else {
      url.search = '';
    }

    // Build the URL string
    let normalized = url.toString();

    // Remove trailing slash except for root path
    if (url.pathname !== '/' && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  } catch {
    // Invalid URL
    return null;
  }
}

/**
 * Resolve a potentially relative URL against a base URL, then normalize it.
 */
export function resolveAndNormalize(
  link: string,
  baseUrl: string,
  ignoreParams: string[]
): string | null {
  try {
    // Resolve relative URLs
    const resolved = new URL(link, baseUrl);
    return normalizeUrl(resolved.toString(), ignoreParams);
  } catch {
    return null;
  }
}
