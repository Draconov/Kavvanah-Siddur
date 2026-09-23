/** Corpus-backed reading aid only. Never assign the return value to source Hebrew. */
export function readingCorrectionKey(word: string): string {
  return word.normalize('NFKD')
    // Cantillation, meteg/stress, rafe, upper/lower dots; NEVER remove niqqud.
    .replace(/[\u0591-\u05AF\u05BD\u05BF\u05C4\u05C5]/gu, '')
    .replace(/\u05BA/gu, '\u05B9');
}
export function restorePointing(word: string, corrections: Readonly<Record<string, string>>): string {
  const original = word.normalize('NFKD');
  const target = corrections[readingCorrectionKey(original)];
  if (!target) return original;
  const clusters = target.match(/[א-ת][^א-ת]*/gu) ?? [];
  const existing = original.match(/[א-ת][^א-ת]*/gu) ?? [];
  if (clusters.length !== existing.length || clusters.some((c,i) => c[0] !== existing[i][0])) return original;
  let index = 0;
  return original.replace(/[א-ת][^א-ת]*/gu, cluster => {
    const supplied = readingCorrectionKey(cluster);
    const required = clusters[index++];
    // Only add absent vowel or shin/sin marks. Never infer a stop/fricative
    // distinction by adding or removing dagesh, and never remove a source mark.
    const additions = [...required].filter(mark => /[\u05B0-\u05BB\u05C1\u05C2\u05C7]/u.test(mark) && !supplied.includes(mark));
    return (cluster + additions.join('')).normalize('NFKD');
  });
}
/** Apply only to a completed Ukrainian transliteration token, never to source text. */
export function ukrainianIotation(reading: string): string {
  const lower: Record<string,string> = {а:'я',у:'ю',е:'є',і:'ї'};
  return reading.replace(/([бвгґджзклмнпрстфхцчшщ])й(?=[ауеі])/giu, '$1’й').replace(/([йЙ])([ауеі])/gu, (_,y: string,v: string) => y === 'Й' ? lower[v].toUpperCase() : lower[v]);
}
