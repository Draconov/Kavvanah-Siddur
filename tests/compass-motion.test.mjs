import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeHeading,shortestHeadingDelta,dampHeading,headingChanged,shouldUseOrientationSource,COMPASS_MAX_FPS,COMPASS_FRAME_INTERVAL_MS,shouldRenderCompassFrame } from '../lib/siddur/compass-motion.ts';

const compass=readFileSync(new URL('../components/siddur/CompassView.tsx',import.meta.url),'utf8');

test('north crossing uses shortest circular path in both directions',()=>{
 assert.equal(normalizeHeading(-1),359);
 assert.equal(normalizeHeading(361),1);
 assert.equal(shortestHeadingDelta(359,1),2);
 assert.equal(shortestHeadingDelta(1,359),-2);
 assert.equal(shortestHeadingDelta(90,270),-180);
 assert.equal(shortestHeadingDelta(10,350),-20);
});
test('exponential damping follows the target without full rotation or overshoot',()=>{
 const a=dampHeading(359,1,33);
 assert.ok(a>359||a<1,`wrapped sample ${a}`);
 const b=dampHeading(1,359,33);
 assert.ok(b<1||b>359,`wrapped sample ${b}`);
 let value=90;
 for(let i=0;i<45;i++)value=dampHeading(value,200,33);
 assert.ok(Math.abs(shortestHeadingDelta(value,200))<.1);
});
test('framerate-independent smoothing clamps giant frame gaps',()=>{
 const a=dampHeading(0,90,80);
 assert.equal(dampHeading(0,90,1500),a);
 assert.equal(dampHeading(0,90,-1),0);
});
test('stationary sensor noise is filtered, real turns pass',()=>{
 assert.equal(headingChanged(null,0),true);
 assert.equal(headingChanged(359.8,0.3),false);
 assert.equal(headingChanged(359,2),true);
 assert.equal(headingChanged(20,20.7),false);
 assert.equal(headingChanged(20,22),true);
});
test('preferred absolute readings are not mixed with lower-quality deviceorientation data',()=>{
 assert.equal(shouldUseOrientationSource(3,1000,1,1200),false);
 assert.equal(shouldUseOrientationSource(3,1000,3,1100),true);
 assert.equal(shouldUseOrientationSource(3,1000,1,2900),true);
});
test('compass updates just two SVG groups, throttles React, and pauses in the background',()=>{
 assert.match(compass,/compassRose\.current\?\.setAttribute/);
 assert.match(compass,/compassPointer\.current\?\.setAttribute/);
 assert.match(compass,/requestAnimationFrame\(frameTick\)/);
 assert.match(compass,/shouldRenderCompassFrame\(now,lastPaintAt\)/);
 assert.match(compass,/now-lastTextAt>=350/);
 assert.match(compass,/document\.hidden/);
 assert.match(compass,/cancelAnimationFrame/);
 assert.match(compass,/isEink\(\)\?1000:reducedMotion\?\.matches\?125:40/);
 assert.match(compass,/prefers-reduced-motion: reduce/);
 assert.doesNotMatch(compass,/setHeading\(value\);setMagnetic/);
 assert.match(compass,/deviceorientationabsolute/);
 assert.match(compass,/webkitCompassHeading/);
});

test('compass renders up to 60 FPS, with 60 Hz tolerance and 120 Hz pacing',()=>{
 assert.equal(COMPASS_MAX_FPS,60);
 assert.ok(Math.abs(COMPASS_FRAME_INTERVAL_MS-16.6666667)<0.01);
 // Animation starts immediately with no previous frame.
 assert.equal(shouldRenderCompassFrame(100,0),true);
 // A 120 Hz panel provides a frame after ~8.33ms: wait until next VSync.
 assert.equal(shouldRenderCompassFrame(108.333,100),false);
 assert.equal(shouldRenderCompassFrame(116.666,100),true);
 // A real 60 Hz frame can arrive slightly ahead of the ideal boundary.
 assert.equal(shouldRenderCompassFrame(115.8,100),true);
 assert.equal(shouldRenderCompassFrame(114.9,100),false);
 // A paused animation can render immediately when revived.
 assert.equal(shouldRenderCompassFrame(4100,100),true);
});

test('frame-driven animation retains low-power behavior',()=>{
 assert.match(compass,/if\(isEink\(\)\|\|reducedMotion\?\.matches\)/);
 assert.match(compass,/frame=requestAnimationFrame\(frameTick\)/);
 assert.match(compass,/if\(document\.hidden/);
 assert.match(compass,/cancelAnimationFrame\(frame\)/);
 assert.match(compass,/if\(Math\.abs\(shortestHeadingDelta\(next,target\)\)\<0\.18\)/);
 assert.doesNotMatch(compass,/setInterval\(/);
});
