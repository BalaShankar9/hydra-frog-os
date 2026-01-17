/**
 * Check if a URL is internal to the given base domain.
 *
 * Rules:
 * - baseDomain is the project.domain (e.g., "example.com")
 * - Internal if hostname equals baseDomain
 * - Internal if hostname ends with "." + baseDomain (only if includeSubdomains is true)
 */
export function isInternalUrl(
  candidateUrl: string,
  baseDomain: string,
  includeSubdomains: boolean
): boolean {
  try {
    const url = new URL(candidateUrl);
    const hostname = url.hostname.toLowerCase();
    const domain = baseDomain.toLowerCase();

    // Exact match
    if (hostname === domain) {
      return true;
    }

    // Subdomain match (only if enabled)
    if (includeSubdomains && hostname.endsWith('.' + domain)) {
      return true;
    }

    return false;
  } catch {
    // Invalid URL
    return false;
  }
}

/**
 * Extract the domain from a URL.
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}
