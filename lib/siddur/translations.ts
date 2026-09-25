import type { Language, Paragraph, SiddurData, Source } from './types.ts';

export type SiddurTranslationRecord = string | {
  text: string;
  ref?: string;
  edition?: string;
  note?: 'combined';
} | null;

export interface SiddurTranslationSection {
  sourceHash: string;
  paragraphs: SiddurTranslationRecord[];
}

export interface SiddurTranslationCorpus {
  sources: Source[];
  sections: Record<string, SiddurTranslationSection>;
}

export interface SiddurTranslationFile {
  schema: 1;
  language: Language;
  corpora: Partial<Record<'ashkenaz' | 'edot', SiddurTranslationCorpus>>;
}

export function applySiddurTranslation(base: SiddurData, bundle: SiddurTranslationFile): SiddurData {
  if (bundle.schema !== 1) throw new Error('Unsupported Siddur translation schema');
  const language = bundle.language;
  const corpus = bundle.corpora[base.nusach];
  if (!corpus) return base;
  const sectionTranslations = corpus.sections;
  const sections = base.sections.map(section => {
    const translation = sectionTranslations[section.id];
    if (!translation) return section;
    const records = translation.paragraphs;
    if (records.length !== section.paragraphs.length) {
      throw new Error(`Translation paragraph count changed for ${base.nusach}:${section.id}`);
    }
    const paragraphs = section.paragraphs.map((paragraph, index) => {
      const record = records[index];
      if (record == null) return paragraph;
      const meta = typeof record === 'string' ? null : record;
      const text = typeof record === 'string' ? record : record.text;
      if (!text?.trim()) throw new Error(`Empty ${language} translation in ${base.nusach}:${section.id}:${index}`);
      const next: Paragraph = { ...paragraph, [language]: text };
      if (meta?.ref) next.translationRefs = { ...next.translationRefs, [language]: meta.ref };
      if (meta?.edition) next.translationEditions = { ...next.translationEditions, [language]: meta.edition };
      if (meta?.note) next.translationNotes = { ...next.translationNotes, [language]: meta.note };
      return next;
    });
    return { ...section, paragraphs };
  });
  return { ...base, sections, sources: [...base.sources, ...corpus.sources] };
}
