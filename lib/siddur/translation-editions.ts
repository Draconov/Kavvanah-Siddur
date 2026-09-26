import registry from './translation-editions.json' with { type: 'json' };
import type { BookData, Language, Paragraph, Source } from './types.ts';

export interface TranslationEditionComponent {
  edition: string;
  categories?: string[];
  books?: string[];
}

export interface TranslationEdition {
  id: string;
  language: Language;
  label: string;
  description: string;
  builtin: boolean;
  available: boolean;
  availableBooks?: string[];
  selectable?: boolean;
  fallback?: string;
  path?: string;
  source: string[];
  provider?: string;
  providerVersionId?: number;
  abbreviation?: string;
  versificationSchemeId?: number;
  composite?: TranslationEditionComponent[];
}

export interface TranslationEditionRegistry {
  schema: 1;
  defaults: Record<Language, string>;
  editions: TranslationEdition[];
}

export type TanakhTranslationRecord = string | {
  text: string;
  ref?: string;
  edition?: string;
  note?: 'combined';
} | null;

export interface TanakhTranslationBook {
  chapters: TanakhTranslationRecord[][];
}

export interface TanakhTranslationFile {
  schema: 1;
  language: Language;
  edition: string;
  sources: Source[];
  books: Record<string, TanakhTranslationBook>;
}

export interface EditionResolution {
  preferred: TranslationEdition;
  intended: TranslationEdition;
  effective: TranslationEdition;
  usedFallback: boolean;
}

export const TRANSLATION_EDITIONS = registry as TranslationEditionRegistry;
export const DEFAULT_TRANSLATION_EDITIONS = TRANSLATION_EDITIONS.defaults;

function allEditionsForLanguage(language: Language): TranslationEdition[] {
  return TRANSLATION_EDITIONS.editions.filter(edition => edition.language === language);
}

export function editionsForLanguage(language: Language): TranslationEdition[] {
  return allEditionsForLanguage(language).filter(edition => edition.selectable !== false);
}

export function translationEdition(id: string | undefined, language?: Language): TranslationEdition | undefined {
  const edition = TRANSLATION_EDITIONS.editions.find(candidate => candidate.id === id);
  return edition && (!language || edition.language === language) ? edition : undefined;
}

export function preferredEdition(language: Language, id?: string): TranslationEdition {
  const requested = translationEdition(id, language);
  if (requested?.selectable !== false) return requested;
  const fallbackDefault = translationEdition(TRANSLATION_EDITIONS.defaults[language], language);
  if (fallbackDefault?.selectable !== false) return fallbackDefault;
  return editionsForLanguage(language)[0]!;
}

function resolveAvailable(language: Language, edition: TranslationEdition, seen = new Set<string>()): TranslationEdition {
  if (edition.available || edition.builtin) return edition;
  if (seen.has(edition.id)) return edition;
  seen.add(edition.id);
  const fallback = translationEdition(edition.fallback, language);
  return fallback ? resolveAvailable(language, fallback, seen) : edition;
}

export function effectiveEdition(language: Language, id?: string): { preferred: TranslationEdition; effective: TranslationEdition } {
  const preferred = preferredEdition(language, id);
  // Composite presets are resolved per Tanakh book; keeping the preset here prevents
  // Settings from collapsing an intentionally mixed edition into one global fallback.
  if (preferred.composite?.length) return {preferred, effective: preferred};
  return {preferred, effective: resolveAvailable(language, preferred)};
}

function componentForBook(edition: TranslationEdition, bookId: string, category: string): TranslationEdition | undefined {
  const component = edition.composite?.find(item =>
    (!item.books || item.books.includes(bookId)) &&
    (!item.categories || item.categories.includes(category))
  );
  return component ? translationEdition(component.edition, edition.language) : undefined;
}

export function resolveEditionForBook(language: Language, id: string | undefined, bookId: string, category: string): EditionResolution {
  const preferred = preferredEdition(language, id);
  const intended = componentForBook(preferred, bookId, category) ?? preferred;
  const bookAvailable = !intended.availableBooks || intended.availableBooks.includes(bookId);
  const effective = bookAvailable ? resolveAvailable(language, intended) : resolveAvailable(language, translationEdition(intended.fallback, language) ?? intended);
  return {preferred, intended, effective, usedFallback: effective.id !== intended.id};
}

export function editionHasMissingComponents(edition: TranslationEdition): boolean {
  if (!edition.composite?.length) return !(edition.available || edition.builtin);
  return edition.composite.some(component => {
    const source = translationEdition(component.edition, edition.language);
    return !source || !(source.available || source.builtin);
  });
}

export function applyTanakhTranslation(base: BookData, bundle: TanakhTranslationFile): BookData {
  if (bundle.schema !== 1) throw new Error('Unsupported Tanakh translation schema');
  const translated = bundle.books[base.id];
  if (!translated) return base;
  if (translated.chapters.length !== base.text.length) throw new Error(`Translation chapter count changed for ${base.id}`);
  const language = bundle.language;
  const text = base.text.map((chapter, chapterIndex) => {
    const records = translated.chapters[chapterIndex];
    if (records.length !== chapter.length) throw new Error(`Translation verse count changed for ${base.id}:${chapterIndex + 1}`);
    return chapter.map((paragraph, verseIndex) => {
      const record = records[verseIndex];
      if (record == null) return paragraph;
      const meta = typeof record === 'string' ? null : record;
      const value = typeof record === 'string' ? record : record.text;
      if (!value?.trim()) throw new Error(`Empty ${language} translation in ${base.id}:${chapterIndex + 1}:${verseIndex + 1}`);
      const next: Paragraph = {...paragraph, [language]: value};
      if (meta?.ref) next.translationRefs = {...next.translationRefs, [language]: meta.ref};
      if (meta?.edition) next.translationEditions = {...next.translationEditions, [language]: meta.edition};
      else next.translationEditions = {...next.translationEditions, [language]: bundle.edition};
      if (meta?.note) next.translationNotes = {...next.translationNotes, [language]: meta.note};
      return next;
    });
  });
  return {...base, text, sources:[...base.sources.filter(source => source.language !== language), ...bundle.sources]};
}
