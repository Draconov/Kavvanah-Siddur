/** E Ink is not exposed consistently by Android/WebView; auto mode is conservative. */
import type { EinkMode } from './types';

// Match recognizable manufacturers/readers and a few distinctive model names.
// Do NOT infer E Ink from screen size, Android, dark mode, or reduced motion.
export const EINK_DEVICE_PATTERN = String.raw`\b(?:mudita|kompakt|boox|onyx|pocketbook|kindle|kobo|remarkable|reMarkable|meebook|bigme|inkpalm|dasung|tolino|inkbook|palma(?:\s*2)?|note\s*air\s*\d*|tab\s*ultra(?:\s*c|\s*pro)?|nova\s*air)\b`;

export function isEinkDevice({userAgent='',model='',monochrome=false}:{userAgent?:string;model?:string;monochrome?:boolean}={}):boolean {
  return monochrome || new RegExp(EINK_DEVICE_PATTERN,'i').test(`${userAgent} ${model}`);
}

export function einkEnabled(mode:EinkMode,detected:boolean):boolean {
  return mode==='on' || (mode==='auto'&&detected);
}

// Executed in <head> before the first paint so E Ink doesn't flash a
// shadow-heavy/colorful theme. Uses the exact same matcher and saved setting.
export const EINK_BOOTSTRAP = `(()=>{try{
  const saved=JSON.parse(localStorage.getItem('kavvanah.settings')||'{}');
  const mode=['auto','on','off'].includes(saved.einkMode)?saved.einkMode:'auto';
  const monochrome=typeof matchMedia==='function'&&matchMedia('(monochrome)').matches;
  const recognized=new RegExp(${JSON.stringify(EINK_DEVICE_PATTERN)},'i').test(navigator.userAgent||'');
  document.documentElement.dataset.eink=(mode==='on'||(mode==='auto'&&(monochrome||recognized)))?'true':'false';
}catch{document.documentElement.dataset.eink='false';}})();`;
