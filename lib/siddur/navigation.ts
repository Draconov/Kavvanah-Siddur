import type {PrayerSection} from './types.ts';
export const PRAYER_SHORTCUTS:Record<string,{category:string;label:string;match:RegExp}>={
 dawn:{category:'Morning',label:'Morning blessings',match:/Morning Blessings/},
 talit:{category:'Morning',label:'Tallit & tefillin',match:/^(Tallit|Order of Talit)$/},
 sunrise:{category:'Morning',label:'Shacharit',match:/^(Modeh Ani|Morning Prayer)$/},
 shema:{category:'Morning',label:'Shema',match:/^(Shema|The Shema)$/},
 shacharit:{category:'Morning',label:'Shacharit',match:/^(Patriarchs|Amidah?)$/},
 mincha:{category:'Afternoon',label:'Mincha',match:/^(Ashrei|Amidah?)$/},
 'mincha-ketana':{category:'Afternoon',label:'Mincha',match:/^(Ashrei|Amidah?)$/},
 plag:{category:'Afternoon',label:'Mincha',match:/^(Ashrei|Amidah?)$/},
 sunset:{category:'Evening',label:'Maariv',match:/^(Barchu|The Shema|Shema and its Blessings)$/},
 nightfall:{category:'Evening',label:'Maariv',match:/^(Barchu|The Shema|Shema and its Blessings)$/},
};
export function prayerForTime(timeId:string,sections:PrayerSection[]):PrayerSection|null{
 const target=PRAYER_SHORTCUTS[timeId];if(!target)return null;
 const service=sections.filter(s=>s.category===target.category&&!s.path.some(p=>/bedtime|shabbat/i.test(p)));
 return service.find(s=>target.match.test(s.title))??service[0]??null;
}
