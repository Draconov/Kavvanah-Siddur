/** Motion helpers for the Jerusalem compass. Keep this module browser/React-free. */
export function normalizeHeading(degrees:number):number {
 return ((degrees % 360) + 360) % 360;
}
/** Signed shortest turn in degrees; prevents a 359° → 1° full-circle spin. */
export function shortestHeadingDelta(from:number,to:number):number {
 return ((to-from+540)%360)-180;
}
/** A framerate-independent low-pass rotation. `elapsedMs` is clamped after stalls. */
export function dampHeading(from:number,to:number,elapsedMs:number,timeConstantMs=165):number {
 const dt=Math.max(0,Math.min(80,elapsedMs));
 const factor=1-Math.exp(-dt/timeConstantMs);
 return normalizeHeading(from+shortestHeadingDelta(from,to)*factor);
}
/** Do not chase tiny random magnetometer fluctuations when the phone is still. */
export function headingChanged(previous:number|null,next:number,deadband=1):boolean {
 return previous===null || Math.abs(shortestHeadingDelta(previous,next))>=deadband;
}

/** Prefer native compass readings over generic orientation events when both fire. */
export function shouldUseOrientationSource(currentPriority:number,lastReceivedAt:number,nextPriority:number,now:number):boolean {
 return nextPriority>=currentPriority || now-lastReceivedAt>1800;
}

/** VSync-based animation capped at 60 FPS; no fixed timer or idle loop. */
export const COMPASS_MAX_FPS=60;
export const COMPASS_FRAME_INTERVAL_MS=1000/COMPASS_MAX_FPS;
/** A small tolerance prevents skipping real 60 Hz frames due to timestamp jitter. */
export function shouldRenderCompassFrame(now:number,lastPaintAt:number):boolean {
 return lastPaintAt===0 || now-lastPaintAt>=COMPASS_FRAME_INTERVAL_MS-1;
}
