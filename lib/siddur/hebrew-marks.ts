/** Render only supplied Hebrew niqqud and te'amim; never synthesize marks. */
export const HAS_CANTILLATION = /[\u0591-\u05AF]/u;
export function displayHebrewMarks(source:string,vowels:boolean,cantillation:boolean):string {
 let text=cantillation?source:source.replace(/[\u0591-\u05AF]/gu,'');
 if(!vowels)text=text.replace(/[\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/gu,'');
 return text;
}
/** Overlay provenance-checked te'amim on canonical Hebrew letters, keeping the source intact. */
export type VerseAccents = Array<[number,string]> | null;
export interface CantillationChapter { source:string; verses:VerseAccents[]; }
const LETTER=/[\u05D0-\u05EA]/u;
export function applyCantillationAccents(source:string, accents:VerseAccents):string {
 if(!accents?.length)return source;
 const map=new Map(accents);
 let ordinal=0;
 let output='';
 // Append after the original letter's combining marks rather than in the middle
 // of a Hebrew grapheme; NFC/NFD reorders the resulting marks canonically.
 const chars=Array.from(source);
 for(let i=0;i<chars.length;i++) {
  const char=chars[i]; output+=char;
  if(LETTER.test(char)) {
   const mark=map.get(ordinal++);
   if(mark && /^[\u0591-\u05AF]+$/u.test(mark)) {
    // The following original combining marks belong to this letter.
    while(i+1<chars.length && /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/u.test(chars[i+1])) output+=chars[++i];
    output+=mark;
   }
  }
 }
 return output.normalize('NFD');
}
