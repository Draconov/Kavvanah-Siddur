import type { Language } from './types.ts';

/** Paths to generated *reader* assets; the original JSON remains canonical. */
export function siddurIndexPath(nusach:'ashkenaz'|'edot'):string {
 return `/texts/optimized/siddur/${nusach}/index.json`;
}
export function siddurCategoryPath(nusach:'ashkenaz'|'edot',category:string):string {
 if(!/^[a-zA-Z]+$/.test(category))throw Error('Invalid Siddur category');
 return `/texts/optimized/siddur/${nusach}/${category.toLowerCase()}.json`;
}
export function siddurTranslationCategoryPath(language:Language,nusach:'ashkenaz'|'edot',category:string):string {
 if(!['en','ru','uk'].includes(language)||!/^[a-zA-Z]+$/.test(category))throw Error('Invalid Siddur translation category');
 return `/texts/translations/optimized/siddur-categories/${language}/${nusach}/${category.toLowerCase()}.json`;
}

/** Single-chapter immutable build assets. The original per-book sources are retained. */
export function tanakhChapterPath(bookId: string, chapter: number): string {
  if (!/^[a-z-]+$/.test(bookId) || !Number.isInteger(chapter) || chapter < 1 || chapter > 999) throw Error('Invalid Tanakh chapter');
  return `/texts/optimized/tanakh/${bookId}/${chapter}.json`;
}
export function tanakhTranslationChapterPath(edition: string, bookId: string, chapter: number): string {
  if (!/^[a-z0-9-]+$/.test(edition) || !/^[a-z-]+$/.test(bookId) || !Number.isInteger(chapter) || chapter < 1 || chapter > 999) throw Error('Invalid translation chapter');
  return `/texts/translations/optimized/tanakh-chapters/${edition}/${bookId}/${chapter}.json`;
}

// Memory LRU stores both in-flight requests and successful parsed JSON responses.
// The persistent Cache API is owned by the service worker, not duplicated here.
// Cache pending requests too; an unmounted reader cannot abort a request that
// another reader is already awaiting. Failures are evicted so Retry works.
const MAX_CACHED_REQUESTS = 80;
const MAX_BYTES = 12 * 1024 * 1024;
const sizes = new Map<string, number>();
let usedBytes = 0;
const sizeOf = (value: unknown) => JSON.stringify(value).length * 2;
function evict() {
  while ((pending.size > MAX_CACHED_REQUESTS || usedBytes > MAX_BYTES) && pending.size > 1) {
    const oldest = pending.keys().next().value!;
    const removed = sizes.get(oldest) ?? 0;
    usedBytes -= removed;
    sizes.delete(oldest);
    pending.delete(oldest);
  }
}
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
    const value = await response.json() as T;
    if (pending.get(url) === request) {
      const bytes = sizeOf(value);
      usedBytes += bytes;
      sizes.set(url, bytes);
      evict();
    }
    return value;
  }).catch(error => {
    if (pending.get(url) === request) {pending.delete(url); usedBytes -= sizes.get(url) ?? 0; sizes.delete(url);}
    throw error;
  });
  pending.set(url, request);
  evict();
  return request;
}

/** Best-effort speculative load; never interrupts reading on errors. */
export function prefetchReaderJson(url: string): void {
  if (typeof document !== 'undefined' && (document.hidden || (navigator as Navigator & {connection?: {saveData?: boolean}}).connection?.saveData)) return;
  void loadReaderJson(url).catch(() => {});
}
