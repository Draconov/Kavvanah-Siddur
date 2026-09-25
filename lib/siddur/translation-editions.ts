import registry from './translation-editions.json' with { type: 'json' };
import type { BookData, Language, Paragraph, Source } from './types.ts';

export interface TranslationEdition {
  id: string;
  language: Language;
  label: string;
  description: string;
  builtin: boolean;
  available: boolean;
  fallback?: string;
  path?: string;
  source: string[];
  provider?: string;
  providerVersionId?: number;
  abbreviation?: string;
  versificationSchemeId?: number;
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

export const TRANSLATION_EDITIONS = registry as TranslationEditionRegistry;
export const DEFAULT_TRANSLATION_EDITIONS = TRANSLATION_EDITIONS.defaults;

export function editionsForLanguage(language: Language): TranslationEdition[] {
  return TRANSLATION_EDITIONS.editions.filter(edition => edition.language === language);
}

export function translationEdition(id: string | undefined, language?: Language): TranslationEdition | undefined {
  const edition = TRANSLATION_EDITIONS.editions.find(candidate => candidate.id === id);
  return edition && (!language || edition.language === language) ? edition : undefined;
}

export function preferredEdition(language: Language, id?: string): TranslationEdition {
  return translationEdition(id, language)
    ?? translationEdition(TRANSLATION_EDITIONS.defaults[language], language)
    ?? editionsForLanguage(language)[0]!;
}

export function effectiveEdition(language: Language, id?: string): { preferred: TranslationEdition; effective: TranslationEdition } {
  const preferred = preferredEdition(language, id);
  if (preferred.available || preferred.builtin) return {preferred, effective: preferred};
  const fallback = translationEdition(preferred.fallback, language);
  return {preferred, effective: fallback ?? preferred};
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
