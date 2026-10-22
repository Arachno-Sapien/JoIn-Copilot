import { SiteAdapter } from './types';
import { greenhouseAdapter } from './greenhouse';
import { leverAdapter } from './lever';
import { genericAdapter } from './generic';

export * from './types';
export * from './greenhouse';
export * from './lever';
export * from './generic';

const ADAPTERS: SiteAdapter[] = [greenhouseAdapter, leverAdapter];

/**
 * Returns the best matching SiteAdapter for a given URL, falling back to genericAdapter.
 */
export function getAdapterForUrl(url: URL): SiteAdapter {
  for (const adapter of ADAPTERS) {
    if (adapter.matches(url)) {
      return adapter;
    }
  }
  return genericAdapter;
}
