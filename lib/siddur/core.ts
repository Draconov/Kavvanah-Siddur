import { HDate, HebrewCalendar, Location, GeoLocation, Zmanim } from '@hebcal/core';
import type { Place, Settings } from './types.ts';
export { HDate };

export const PLACES: Place[] = [
 {name:'Jerusalem',latitude:31.778,longitude:35.235,timeZone:'Asia/Jerusalem',elevation:754,israel:true},
 {name:'Ashkelon',latitude:31.6688,longitude:34.5743,timeZone:'Asia/Jerusalem',elevation:40,israel:true},
 {name:'Tel Aviv',latitude:32.0853,longitude:34.7818,timeZone:'Asia/Jerusalem',elevation:5,israel:true},
 {name:'Haifa',latitude:32.794,longitude:34.9896,timeZone:'Asia/Jerusalem',elevation:0,israel:true},
 ...[
  ['Ashdod',31.8014,34.6435,27],['Beersheba',31.252,34.7915,260],
  ['Rishon LeZion',31.973,34.7925,50],['Petah Tikva',32.084,34.8878,35],
  ['Netanya',32.3215,34.8532,30],['Holon',32.0158,34.7874,30],
  ['Bnei Brak',32.0807,34.8338,30],['Ramat Gan',32.0684,34.8248,50],
  ['Rehovot',31.8948,34.8113,50],['Bat Yam',32.0238,34.7519,20],
  ['Herzliya',32.1663,34.8433,30],['Kfar Saba',32.175,34.9069,70],
  ['Hadera',32.434,34.9196,20],['Modiin',31.8969,35.0087,200],
  ['Beit Shemesh',31.748,34.988,300],['Kiryat Gat',31.61,34.7642,125],
  ['Sderot',31.525,34.5969,90],['Netivot',31.4222,34.5892,140],
  ['Ofakim',31.3141,34.6203,150],['Dimona',31.068,35.0339,550],
  ['Eilat',29.5581,34.9482,10],['Nahariya',33.0085,35.0981,10],
  ['Akko',32.9281,35.082,10],['Afula',32.6076,35.2891,60],
  ['Tiberias',32.794,35.5322,0],['Safed',32.9646,35.496,850],
  ['Karmiel',32.9171,35.305,250],['Nazareth',32.6996,35.3035,350],
  ['Lod',31.9518,34.8888,50],['Ramla',31.9292,34.8656,80],
 ] .map(([name,latitude,longitude,elevation])=>({name:String(name),latitude:Number(latitude),longitude:Number(longitude),elevation:Number(elevation),timeZone:'Asia/Jerusalem',israel:true})),
 {name:'New York',latitude:40.7128,longitude:-74.006,timeZone:'America/New_York',elevation:10,israel:false},
 {name:'London',latitude:51.5074,longitude:-0.1278,timeZone:'Europe/London',elevation:11,israel:false},
 {name:'Paris',latitude:48.8566,longitude:2.3522,timeZone:'Europe/Paris',elevation:35,israel:false},
 {name:'Kyiv',latitude:50.4501,longitude:30.5234,timeZone:'Europe/Kyiv',elevation:179,israel:false},
 {name:'Berlin',latitude:52.52,longitude:13.405,timeZone:'Europe/Berlin',elevation:34,israel:false},
 {name:'Los Angeles',latitude:34.0522,longitude:-118.2437,timeZone:'America/Los_Angeles',elevation:71,israel:false},
 {name:'Toronto',latitude:43.6532,longitude:-79.3832,timeZone:'America/Toronto',elevation:76,israel:false},
 {name:'Sydney',latitude:-33.8688,longitude:151.2093,timeZone:'Australia/Sydney',elevation:58,israel:false},
 {name:'Buenos Aires',latitude:-34.6037,longitude:-58.3816,timeZone:'America/Argentina/Buenos_Aires',elevation:25,israel:false},
];

export const DEFAULT_SETTINGS: Settings = {uiLanguage:'en',prayerLinks:true,accent:'blue',calendarMode:'hebrew',clockFormat:'24h',theme:'light',nusach:'ashkenaz',pronunciation:'sephardi',transliterationLanguage:'en',translationLanguage:'en',layers:['hebrew','transliteration','translation'],layout:'columns',textSize:26,font:'serif',vowels:true,place:PLACES[0],zmanMethod:'gra',nightfall:'8.5',candleMinutes:18,useElevation:false};

export function distanceKm(lat1:number,lon1:number,lat2:number,lon2:number):number{
 const r=Math.PI/180,a=(lat2-lat1)*r,b=(lon2-lon1)*r;
 return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(a/2)**2+Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(b/2)**2)));
}
export function placeFromCoordinates(latitude:number,longitude:number,deviceZone:string,altitude:number|null):Place{
 const nearest=PLACES.map(place=>({place,distance:distanceKm(latitude,longitude,place.latitude,place.longitude)})).sort((a,b)=>a.distance-b.distance)[0];
 // A nearby city is only a label, not a country or time-zone lookup. In
 // particular, proximity to Eilat must not relabel a GPS fix in Aqaba.
 const city=nearest.distance<=18&&nearest.place.timeZone===deviceZone?nearest.place:null;
 return {name:city?.name??'My location',latitude,longitude,timeZone:deviceZone,elevation:Math.min(9000,Math.max(0,Math.round(altitude??city?.elevation??0))),israel:deviceZone==='Asia/Jerusalem'};
}

export function validateLocation(p:Place):string|null {
 if (!Number.isFinite(p.latitude)||Math.abs(p.latitude)>90) return 'Latitude must be between −90 and 90.';
 if (!Number.isFinite(p.longitude)||Math.abs(p.longitude)>180) return 'Longitude must be between −180 and 180.';
 if (!Number.isFinite(p.elevation)||p.elevation<0||p.elevation>9000) return 'Elevation must be between 0 and 9,000 metres.';
 try {new Intl.DateTimeFormat('en',{timeZone:p.timeZone}).format();} catch {return 'Enter a valid time zone, such as Asia/Jerusalem.';}
 return null;
}

export function dateKeyInZone(now:Date,timeZone:string):string {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=(type:string)=>parts.find(p=>p.type===type)?.value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
export function localDate(key:string):Date {const [y,m,d]=key.split('-').map(Number);const date=new Date(2000,0,1,12);date.setFullYear(y,m-1,d);return date;}
export function localKey(date:Date):string{return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function geo(p:Place){return new GeoLocation(p.name,p.latitude,p.longitude,p.elevation,p.timeZone);}

export function currentHebrewDate(now:Date,p:Place):HDate {
 const day=localDate(dateKeyInZone(now,p.timeZone));
 const hd=new HDate(day);
 const sunset=new Zmanim(geo(p),day,false).sunset();
 return Number.isFinite(sunset.getTime())&&now>=sunset?hd.next():hd;
}

export function jerusalemDirection(latitude:number,longitude:number){
 const rad=Math.PI/180,a=latitude*rad,b=31.7781*rad,delta=(35.2354-longitude)*rad;
 const y=Math.sin(delta)*Math.cos(b),x=Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(delta);
 const bearing=(Math.atan2(y,x)/rad+360)%360;
 const hav=Math.sin((b-a)/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(delta/2)**2;
 return {bearing,distanceKm:6371*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,hav))))};
}
export function headingLabel(deg:number){return ['N','NE','E','SE','S','SW','W','NW'][Math.round(deg/45)%8];}
export function formatTime(date:Date|null,timeZone:string):string {return date&&Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit'}).format(date):'Unavailable';}

export interface PrayerTime {id:string;title:string;he:string;detail:string;time:Date|null;}
export function calculateTimes(key:string,p:Place,settings:Partial<Settings>):PrayerTime[] {
 const z=new Zmanim(geo(p),localDate(key),settings.useElevation??false),mga=settings.zmanMethod==='mga';
 const result:[string,string,string,string,Date][]=[
 ['dawn','Alot hashachar','עלות השחר','Dawn · 16.1° below the horizon',z.alotHaShachar()],
 ['talit','Misheyakir','משיכיר','Earliest tallit & tefillin · 11.5°',z.misheyakir()],
 ['sunrise','Sunrise','הנץ החמה','Netz hachamah',z.sunrise()],
 ['shema','Latest Shema','סוף זמן שמע',mga?'Magen Avraham · 72-minute method':'Vilna Gaon · 3 seasonal hours',mga?z.sofZmanShmaMGA():z.sofZmanShma()],
 ['shacharit','Latest Shacharit','סוף זמן תפילה',mga?'Magen Avraham · 72-minute method':'Vilna Gaon · 4 seasonal hours',mga?z.sofZmanTfillaMGA():z.sofZmanTfilla()],
 ['midday','Chatzot','חצות היום','Halachic midday',z.chatzot()],
 ['mincha','Mincha gedolah','מנחה גדולה','Earliest Mincha · GRA 6½ seasonal hours',z.minchaGedola()],
 ['mincha-ketana','Mincha ketanah','מנחה קטנה','GRA 9½ seasonal hours',z.minchaKetana()],
 ['plag','Plag hamincha','פלג המנחה','GRA 10¾ seasonal hours',z.plagHaMincha()],
 ['sunset','Sunset','שקיעה','Shkiah',z.sunset()],
 ['nightfall','Nightfall','צאת הכוכבים',settings.nightfall==='72'?'72 minutes after sunset':`${settings.nightfall??'8.5'}° below the horizon`,settings.nightfall==='72'?z.tzeit72():z.tzeit(Number(settings.nightfall??8.5))],
 ];
 return result.map(([id,title,he,detail,time])=>({id,title,he,detail,time:Number.isFinite(time.getTime())?time:null}));
}

export function calendarEvents(year:number,p:Place,settings:Partial<Settings>={}) {
 // Keep the holiday regime in options.il. Hebcal otherwise treats an explicit
 // 18-minute offset as a city-default sentinel (40 in Jerusalem, 20 elsewhere).
 // A neutral Location preserves the user's actual selected candle offset.
 const location=new Location(p.latitude,p.longitude,false,p.timeZone,p.name,undefined,undefined,p.elevation);
 return HebrewCalendar.calendar({year,isHebrewYear:false,location,il:p.israel,candlelighting:true,candleLightingMins:settings.candleMinutes??18,havdalahMins:settings.nightfall==='72'?72:undefined,havdalahDeg:settings.nightfall==='72'?undefined:Number(settings.nightfall??8.5),sedrot:true,omer:true,addHebrewDates:false,useElevation:settings.useElevation??false});
}
