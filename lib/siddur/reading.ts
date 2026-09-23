import { transliterate, SBL, type Schema } from 'hebrew-transliteration';
import {restorePointing,readingCorrectionKey,ukrainianIotation} from './pointing.ts';
import {wordCorrections,contextCorrections} from './reading-corrections.ts';
import { sblSimple } from 'hebrew-transliteration/schemas';
import type { Language, Layer, Paragraph, PersonalTranslations } from './types.ts';

export const LANGUAGES = { en: 'English', ru: 'Русский', uk: 'Українська' };
export const LAYER_LABELS: Record<Layer, string> = { hebrew: 'Hebrew', transliteration: 'Transliteration', translation: 'Translation' };
export function withoutVowels(text: string) { return text.replace(/[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g, ''); }

type Pronunciation = 'sephardi' | 'ashkenazi';
type Marking = 'siddur' | 'tanakh';
// Match Hebrew words, including their marks and abbreviation signs, but leave
// Latin instructions, whitespace and punctuation outside the reading engine.
const HEBREW_WORD = /[א-ת\u05F2\uFB1D-\uFB4F][א-ת\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05F2\uFB1D-\uFB4F]*(?:['"׳״][א-ת\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]*)*/gu;
const VOWEL = /[\u05B0-\u05BB\u05C7]|וּ/u;
const schemaCache = new Map<string, Schema>();
const memo = new Map<string, string>();
const wordMemo = new Map<string, string>();
// The imported Lulav blessing has a sin dot on vav instead of a holam.
// Correct this exact pointing error for the aid only; source Hebrew is intact.
const readingCorrections = new Map([
  ['בְּמִצְוׂתָיו'.normalize('NFKD'), 'בְּמִצְוֹתָיו'.normalize('NFKD')],
]);

function nameAbbreviation(word: string): boolean {
  const bare = withoutVowels(word);
  return bare === 'יי' || bare === 'ײ' || /^ה['׳]$/u.test(bare);
}
function abbreviatedName(word: string, schema: Schema): string | null {
  if (nameAbbreviation(word)) return schema.DIVINE_NAME;
  const match = word.match(/^(.+?)(?:י[\u0591-\u05BD]*י[\u0591-\u05BD]*|ײ[\u0591-\u05BD]*|ה['׳])$/u);
  if (!match || !VOWEL.test(match[1]) || !/^(?:ו?[בכלמש]|ו)$/.test(withoutVowels(match[1]))) return null;
  try { return `${transliterate(match[1], schema)}-${schema.DIVINE_NAME}`; }
  catch { return null; }
}
function isUnpointed(word: string): boolean {
  if (nameAbbreviation(word) || withoutVowels(word).includes('יהוה')) return false;
  if (!VOWEL.test(word)) return true;
  if ((word.match(/ש[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]*/gu)??[]).some(cluster=>!/[\u05C1\u05C2]/u.test(cluster))) return true;
  const clusters = word.match(/[א-ת][\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]*/gu) ?? [];
  // A medial consonant needs a vowel or sheva, unless it is a possible mater
  // or its vowel is carried by the following vav (shuruq / holam). A single
  // supplied mark does not make an otherwise incomplete word pronounceable.
  return clusters.slice(0, -1).some((cluster, index) =>
    !VOWEL.test(cluster) && !/^[אוי]/.test(cluster)
      && !/^ו[\u0591-\u05BD]*[\u05B9\u05BA\u05BC]/u.test(clusters[index + 1]));
}

/** Missing vowels cannot be recovered reliably from spelling alone. */
function correctedWords(text:string):Map<number,string>{
 const matches=[...text.matchAll(HEBREW_WORD)];
 const bare=(index:number)=>matches[index]?.[0].replace(/[^א-ת]/g,'')??'';
 return new Map(matches.map((match,index)=>{
  const original=match[0].normalize('NFKD');
  const key=readingCorrectionKey(original),context=[-2,-1,0,1,2].map(n=>bare(index+n)).join('|');
  const target=contextCorrections[key+'|'+context];
  const corrected=restorePointing(original,target?{[key]:target}:wordCorrections);
  return [match.index,readingCorrections.get(corrected)??corrected];
 }));
}
export function unpointedWords(text: string): string[] {
 const corrected=correctedWords(text);
 return [...new Set([...text.matchAll(HEBREW_WORD)].filter(match=>isUnpointed(corrected.get(match.index)??match[0])).map(match=>match[0]))];
}

// Convert one schema sound at a time. Applying this regex to a finished Latin
// word would merge qof + he (kh), tav + shin (tsh), etc. across letter boundaries.
function scriptSound(sound: string, lang: Language): string {
  if (lang === 'en') return sound;
  const letters: Record<string, string> = {
    sh: 'ш', kh: 'х', ts: 'ц', a: 'а', b: 'б', v: 'в',
    g: lang === 'uk' ? 'ґ' : 'г', d: 'д', e: 'е',
    h: lang === 'uk' ? 'г' : 'х', z: 'з', t: 'т', y: 'й',
    k: 'к', l: 'л', m: 'м', n: 'н', s: 'с', f: 'ф', p: 'п',
    r: 'р', i: lang === 'uk' ? 'і' : 'и', o: 'о', u: 'у', q: 'к', w: 'в',
  };
  return sound.replace(/sh|kh|ts|[abvgdehztyklmnsfprioquw]/gi, part => {
    const result = letters[part.toLowerCase()];
    return part[0] === part[0].toUpperCase() ? result[0].toUpperCase() + result.slice(1) : result;
  });
}

function readingSchema(lang: Language, pronunciation: Pronunciation, marking: Marking): Schema {
  const key = `${lang}:${pronunciation}:${marking}`;
  const cached = schemaCache.get(key);
  if (cached) return cached;
  const ash = pronunciation === 'ashkenazi';
  // These are practical reading presets, not IPA or every community's accent.
  // Ashkenazi uses the common oy / ey tradition; Sephardi uses e for tsere,
  // with ey for tsere-yod, a common contemporary prayer-reading convention.
  const schema: Partial<Schema> = {
    ...sblSimple,
    // Metsudah uses this sign to mark stress. Reading it as biblical meteg
    // would incorrectly insert e in words such as שֶׁהֶחֱזַֽרְתָּ.
    shevaAfterMeteg: marking === 'tanakh',
    QOF: 'k', DAGESH_CHAZAQ: false,
    DIVINE_NAME: ash ? 'Adonoy' : 'Adonay',
    DIVINE_NAME_ELOHIM: ash ? 'Eloyhim' : 'Elohim',
    TAV: ash ? 's' : 't', TAV_DAGESH: 't',
    QAMATS: ash ? 'o' : 'a', QAMATS_HE: ash ? 'o' : 'a',
    SEGOL_HE: 'e', TSERE_HE: ash ? 'ey' : 'e',
    TSERE: ash ? 'ey' : 'e', TSERE_YOD: 'ey',
    HOLAM: ash ? 'oy' : 'o', HOLAM_HASER: ash ? 'oy' : 'o', HOLAM_VAV: ash ? 'oy' : 'o',
    MS_SUFX: ash ? 'ov' : 'av',
    // SBL's final -ah/-eh is orthographic; a reading aid must not pronounce
    // a silent final he. A mappiq-bearing he remains a consonant.
    ADDITIONAL_FEATURES: [{
      FEATURE: 'cluster', HEBREW: /^ה$/u,
      TRANSLITERATION: cluster => {
        const next = cluster.next?.value;
        const isFinal = !next || (next.text === '־' && !next.next);
        return isFinal && VOWEL.test(cluster.syllable?.word?.text ?? '') ? '' : cluster.text;
      },
    }],
  };
  for (const [property, value] of Object.entries(schema)) {
    if (/^[A-Z_]+$/.test(property) && typeof value === 'string') {
      (schema as Record<string, unknown>)[property] = scriptSound(value, lang);
    }
  }
  const compiled = new SBL(schema);
  schemaCache.set(key, compiled);
  return compiled;
}

export function transcription(text: string, lang: Language, pronunciation: Pronunciation, marking: Marking = 'siddur'): string {
  const key = `${lang}:${pronunciation}:${marking}:${text}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  const schema = readingSchema(lang, pronunciation, marking);
  const corrected=correctedWords(text);
  const out = text.replace(HEBREW_WORD, (original, offset: number) => {
    let word = corrected.get(offset)??original.normalize('NFKD');
    word = readingCorrections.get(word) ?? word;
    // Keep surrounding quotation marks, but do not pronounce the marks inside
    // pointed letter names and vocalized abbreviations (הֵ"א, וְתַרְיַ"ג).
    let closingQuote = '';
    if (!nameAbbreviation(word) && /['"׳״]$/.test(word)) {
      closingQuote = word.slice(-1);
      word = word.slice(0, -1);
    }
    word = word.replace(/["״](?=[א-ת])/g, '');
    const divineName = abbreviatedName(word, schema);
    if (divineName !== null) return divineName + closingQuote;
    // Never invent vowels or a b/v, k/kh, p/f distinction for unpointed text.
    // Retain the source word so the caller can show a review note or omit the
    // reading aid for instructions, using unpointedWords().
    if (isUnpointed(word)) return original;
    // A following maqaf affects qamats qatan and construct-state parsing.
    // Keep it inside the engine, but leave rendering of the original separator
    // to the outer replacement so unpointed neighbors remain untouched.
    const maqaf = text[offset + original.length] === '־' ? '־' : '';
    const wordKey = `${lang}:${pronunciation}:${marking}:${word}${maqaf}`;
    const found = wordMemo.get(wordKey);
    if (found !== undefined) return found + closingQuote;
    let reading: string;
    try {
      reading = transliterate(word + maqaf, schema);
      if(lang==='uk')reading=ukrainianIotation(reading);
      if (maqaf && reading.endsWith('-')) reading = reading.slice(0, -1);
      // Invalid source pointing must not leave an isolated Hebrew mark inside
      // a Cyrillic word. Keep the source token intact instead.
      if (/[\u0590-\u05FF]/u.test(reading)) return original;
    }
    catch { return original; }
    if (wordMemo.size > 12000) wordMemo.clear();
    wordMemo.set(wordKey, reading);
    return reading + closingQuote;
  }).replace(/־/g, '-').replace(/׃/g, ':').replace(/׀/g, '|').trim();
  if (memo.size > 1500) memo.clear();
  memo.set(key, out);
  return out;
}

export function translationFor(p: Paragraph, lang: Language, id: string, personal: PersonalTranslations): string | null {
  return personal[`${id}:${lang}`]?.trim() || p[lang]?.trim() || null;
}
export function moveLayer(layers: Layer[], layer: Layer, delta: number): Layer[] {
  const i = layers.indexOf(layer), j = i + delta;
  if (i < 0 || j < 0 || j >= layers.length) return layers;
  const out = [...layers];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** Explicitly reviewed spoken text overrides source typography metadata. */
export function isReadingInstruction(paragraph: Paragraph): boolean {
 return paragraph.kind === 'instruction' && paragraph.spoken !== true;
}
