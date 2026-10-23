/**
 * Privacy-first presentation hints. These are not hardware identifiers.
 * Never persist or transmit the result; the browser can expose less than this.
 */
export type DeviceClass='phone'|'tablet'|'desktop'|'unknown';
export type InputMode='touch'|'pointer'|'hybrid'|'unknown';
export type DeviceOrientation='portrait'|'landscape';

export interface DeviceSignals {
  viewportWidth:number;
  viewportHeight:number;
  screenWidth:number;
  screenHeight:number;
  primaryCoarse:boolean;
  primaryFine:boolean;
  anyCoarse:boolean;
  anyFine:boolean;
  maxTouchPoints:number;
}
export interface DeviceProfile {
  deviceClass:DeviceClass;
  input:InputMode;
  orientation:DeviceOrientation;
}

export function classifyDevice(signals:DeviceSignals):DeviceProfile {
  const {viewportWidth,viewportHeight,screenWidth,screenHeight,primaryCoarse,primaryFine,anyCoarse,anyFine,maxTouchPoints}=signals;
  const touch=primaryCoarse||anyCoarse||maxTouchPoints>0;
  const precise=primaryFine||anyFine;
  const input:InputMode=touch&&precise?'hybrid':touch?'touch':precise?'pointer':'unknown';
  const minScreen=Math.min(screenWidth,screenHeight);
  // screen.* values are CSS pixel dimensions, NOT a hardware model. A desktop
  // browser resized to phone width should not suddenly become a phone.
  const hasScreen=Number.isFinite(minScreen)&&minScreen>0;
  let deviceClass:DeviceClass='unknown';
  if(touch && hasScreen && minScreen<600){
    deviceClass='phone';
  }else if(primaryCoarse && hasScreen && minScreen>=600){
    deviceClass='tablet';
  }else if(precise){
    deviceClass='desktop';
  }else if(touch && hasScreen && minScreen>=600){
    deviceClass='tablet';
  }
  return {deviceClass,input,orientation:viewportWidth>viewportHeight?'landscape':'portrait'};
}

/** Capability-only probe. No model/serial, high-entropy hints, geolocation or network. */
export function readDeviceSignals(win:Window):DeviceSignals {
  const matches=(query:string)=>{try{return win.matchMedia(query).matches;}catch{return false;}};
  return {
    viewportWidth:win.innerWidth,viewportHeight:win.innerHeight,
    screenWidth:win.screen?.width||0,screenHeight:win.screen?.height||0,
    primaryCoarse:matches('(pointer: coarse)'),primaryFine:matches('(pointer: fine)'),
    anyCoarse:matches('(any-pointer: coarse)'),anyFine:matches('(any-pointer: fine)'),
    maxTouchPoints:win.navigator.maxTouchPoints||0,
  };
}

/**
 * Publishes only categorical CSS hints. No React render, storage or telemetry.
 * Re-evaluates when a device rotates, folds or changes input peripherals.
 */
export function installDeviceProfile(win:Window=window):()=>void {
  const root=win.document.documentElement;
  const mediaQueries=['(pointer: coarse)','(pointer: fine)','(any-pointer: coarse)','(any-pointer: fine)'];
  const media=mediaQueries.map(q=>{try{return win.matchMedia(q);}catch{return null;}});
  let frame=0;
  let removed=false;
  const update=()=>{
    frame=0;
    if(removed)return;
    const profile=classifyDevice(readDeviceSignals(win));
    root.dataset.deviceClass=profile.deviceClass;
    root.dataset.deviceInput=profile.input;
    root.dataset.deviceOrientation=profile.orientation;
  };
  const schedule=()=>{
    if(removed||frame)return;
    frame=win.requestAnimationFrame(update);
  };
  // Immediate first update on hydration; CSS breakpoints remain the no-JS fallback.
  update();
  win.addEventListener('resize',schedule,{passive:true});
  win.screen?.orientation?.addEventListener?.('change',schedule);
  for(const item of media)item?.addEventListener?.('change',schedule);
  return()=>{
    removed=true;
    win.removeEventListener('resize',schedule);
    win.screen?.orientation?.removeEventListener?.('change',schedule);
    for(const item of media)item?.removeEventListener?.('change',schedule);
    if(frame)win.cancelAnimationFrame(frame);
    delete root.dataset.deviceClass;
    delete root.dataset.deviceInput;
    delete root.dataset.deviceOrientation;
  };
}
