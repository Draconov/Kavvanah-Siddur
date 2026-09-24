'use client';
import { useUI } from '@/lib/siddur/i18n-context';
import { useEffect,useRef,useState } from 'react';
import { Compass,MapPin,Navigation,Smartphone } from 'lucide-react';
import { headingLabel,jerusalemDirection } from '@/lib/siddur/core';
import type { Settings } from '@/lib/siddur/types';

export function CompassView({settings,openSettings}:{settings:Settings;openSettings:()=>void}){
 const {t}=useUI();
 const {bearing,distanceKm}=jerusalemDirection(settings.place.latitude,settings.place.longitude);
 const [heading,setHeading]=useState<number|null>(null);
 const [active,setActive]=useState(false);
 const [message,setMessage]=useState('');
 const [magnetic,setMagnetic]=useState(false);
 const [showSensorHelp,setShowSensorHelp]=useState(false);
 const received=useRef(false);
 useEffect(()=>{
  if(!active)return;
  received.current=false;
  let events=0,relative=0,nullValues=0;
  const update=(event:Event)=>{
   const e=event as DeviceOrientationEvent&{webkitCompassHeading?:number};
   events++;
   if(typeof e.webkitCompassHeading==='number'&&Number.isFinite(e.webkitCompassHeading)){
    setHeading((e.webkitCompassHeading+360)%360);
    setMagnetic(true);
    received.current=true;
   }else if((e.absolute===true||event.type==='deviceorientationabsolute')&&typeof e.alpha==='number'&&Number.isFinite(e.alpha)){
    setHeading((360-e.alpha+(screen.orientation?.angle??0)+360)%360);
    setMagnetic(false);
    received.current=true;
   }else if(typeof e.alpha==='number'&&Number.isFinite(e.alpha)){
    // Relative orientation has an arbitrary zero: never represent it as true north.
    relative++;
   }else nullValues++;
  };
  window.addEventListener('deviceorientationabsolute',update);
  window.addEventListener('deviceorientation',update);
  const timeout=window.setTimeout(()=>{
   if(received.current)return;
   setActive(false);
   setHeading(null);
   setShowSensorHelp(true);
   setMessage(relative>0
    ?'Motion detected, but the browser supplied no absolute compass heading. Check motion-sensor permission or use the bearing below with a compass.'
    :events>0&&nullValues>0
     ?'The browser returned empty sensor readings. Check motion-sensor permission in your browser settings.'
     :'No compass readings arrived. Check motion-sensor permission and whether your device has a compass sensor.');
  },8000);
  return()=>{
   window.clearTimeout(timeout);
   window.removeEventListener('deviceorientationabsolute',update);
   window.removeEventListener('deviceorientation',update);
  };
 },[active]);
 async function enable(){
  setMessage('');setHeading(null);setShowSensorHelp(false);
  if(!window.isSecureContext){setMessage('Live compass requires HTTPS. Open the published website instead of a local file or insecure address.');return;}
  if(!('DeviceOrientationEvent' in window)){
   setMessage('A live compass is not available in this browser. The direction below is still calculated for your location.');
   setShowSensorHelp(true);return;
  }
  try{
   const orientation=window.DeviceOrientationEvent as unknown as {requestPermission?:(absolute?:boolean)=>Promise<string>};
   // On browsers requiring a gesture, request access directly from this click.
   if(typeof orientation.requestPermission==='function'){
    const permission=await orientation.requestPermission(true);
    if(permission!=='granted'){
     setMessage('Compass permission was not granted. You can still use the direction in degrees.');
     setShowSensorHelp(true);return;
    }
   }
   setActive(true);
  }catch{
   setMessage('The compass could not be started. Check your browser’s motion permissions.');
   setShowSensorHelp(true);
  }
 }
 const rotation=bearing-(heading??0);
 return <div className="compass-view"><div className="view-heading"><div><p className="eyebrow">{t("TURN TOWARD JERUSALEM")}</p><h1>{t("Mizrach")} <span className="heading-hebrew" lang="he">מזרח</span></h1></div><span className="pill"><MapPin size={14}/>{t(settings.place.name)}</span></div><section className="panel compass-panel"><div className="compass-intro"><span className="compass-symbol"><Compass size={25}/></span><h2>{t("A moment to find your direction.")}</h2><p>{t(heading!==null&&active?'Hold your phone flat and turn toward the pointer.':'North is at the top. The pointer shows the direction to Jerusalem.')}</p></div>
 <div className="compass-dial" role="img" aria-label={t('Jerusalem is {degrees} degrees from true north, {direction}',{degrees:Math.round(bearing),direction:t(headingLabel(bearing))})}><svg viewBox="0 0 360 360" aria-hidden="true"><circle cx="180" cy="180" r="155" className="dial-outer"/><circle cx="180" cy="180" r="113" className="dial-inner"/><g transform={`rotate(${-(heading??0)} 180 180)`}>{Array.from({length:72},(_,i)=><line key={i} x1="180" y1="33" x2="180" y2={i%6===0?'47':'40'} transform={`rotate(${i*5} 180 180)`} className={i%6===0?'major-tick':'minor-tick'}/>)}{[['N',180,69],['E',294,186],['S',180,301],['W',66,186]].map(([text,x,y])=><text key={text} x={x} y={y} className={`cardinal ${text==='N'?'north':''}`} textAnchor="middle">{t(String(text))}</text>)}</g><g transform={`rotate(${rotation} 180 180)`}><path d="M180 79 L166 180 L180 164 L194 180 Z" className="direction-arrow"/><path d="M180 273 L170 187 L180 201 L190 187 Z" className="direction-tail"/></g><circle cx="180" cy="180" r="8" className="direction-center"/></svg><span className="dial-label">{t(active&&heading!==null?'LIVE HEADING':'TRUE NORTH')}</span></div>
 <div className="compass-bearing"><strong>{bearing.toFixed(1)}<span>°</span></strong><span>{t(headingLabel(bearing))} {t("· toward Jerusalem")}</span></div><div className="compass-stats"><div><span>{t("Destination")}</span><strong>{t("Temple Mount, Jerusalem")}</strong></div><div><span>{t("Great-circle distance")}</span><strong>{distanceKm<1?'< 1':Math.round(distanceKm).toLocaleString()} {t("km")}</strong></div></div>
 <div className="compass-actions"><button className="button primary" onClick={()=>{if(active){setActive(false);setHeading(null);}else enable();}}><Navigation size={17}/>{t(active?'Stop live compass':'Enable live compass')}</button><button className="button subtle" onClick={openSettings}><MapPin size={17}/>{t("Set location")}</button></div>{active&&heading!==null&&<p className="compass-status">{t("Device heading:")} {heading.toFixed(0)}° {t(magnetic?'(magnetic north; it may differ from true north)':'(absolute orientation)')}</p>}{message&&<p className="notice" role="status">{t(message)}</p>}{showSensorHelp&&<p className="notice" role="status">{t("Brave on Android: open Settings → Site settings → Motion sensors, allow sensors for this site, then return and try again. If it still fails, test in Chrome to see whether the device supplies a compass heading.")}</p>}{distanceKm<0.1&&<p className="notice">{t("You are very close to the target; small location errors can substantially change the bearing.")}</p>}</section><p className="subtle-note"><Smartphone size={17}/>{t("Live direction needs a compatible phone, motion permission, and a calibrated sensor. Keep away from magnets and metal. The fixed bearing is measured clockwise from true north.")}</p></div>;
}
