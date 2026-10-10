import type { Language } from './types.ts';

/** Paths to generated *reader* assets; the original JSON remains canonical. */
export function siddurReaderPath(language: Language, nusach: 'ashkenaz' | 'edot'): string {
  return `/texts/translations/optimized/siddur/${language}-${nusach}.json`;
}
export function tanakhReaderPath(edition: string, bookId: string): string {
  if (!/^[a-z0-9-]+$/.test(edition) || !/^[a-z-]+$/.test(bookId)) throw Error('Invalid translation edition or book');
  return `/texts/translations/optimized/tanakh/${edition}/${bookId}.json`;
}

// Bounded in-memory cache, shared across readers, editions and navigation.
// Cache pending requests too; an unmounted reader cannot abort a request that
// another reader is already awaiting. Failures are evicted so Retry works.
const MAX_CACHED_REQUESTS = 12;
const pending = new Map<string, Promise<unknown>>();
export function loadReaderJson<T>(url: string): Promise<T> {
  const existing = pending.get(url);
  if (existing) {
    pending.delete(url);
    pending.set(url, existing); // simple LRU
    return existing as Promise<T>;
  }
  const request: Promise<T> = fetch(url).then(async response => {
    if (!response.ok) throw Error(`Unable to load reader asset: ${url} (${response.status})`);
    return await response.json() as T;
  }).catch(error => {
    if (pending.get(url) === request) pending.delete(url);
    throw error;
  });
  pending.set(url, request);
  while (pending.size > MAX_CACHED_REQUESTS) pending.delete(pending.keys().next().value!);
  return request;
}
