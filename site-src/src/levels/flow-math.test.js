import assert from 'node:assert/strict';
import {MEANS,SIGMA,velocity,integrate,randomSource,samplePaths} from './flow-math.js';
assert.deepEqual(velocity([0,0],0),[0,1]);
assert.deepEqual(integrate([2,-3],1).at(-1),[0,1]);
for (const t of [0,.1,.5,.95,1]) {
  const a=velocity([.7,.8],t), b=velocity([-.7,.8],t);
  assert(Math.abs(a[0]+b[0])<1e-10 && Math.abs(a[1]-b[1])<1e-10,'GMM symmetry');
}
// Radius 2 sigma (Euclidean, stricter than a coordinate-wise box). Fixed seeds
// make the test reproducible without selecting individual successful samples.
for(const seed of [77,12345,2026]) {
  const ends=samplePaths(20,10000,randomSource(seed)).map(p=>p.at(-1));
  const inside=ends.filter(x=>MEANS.some(m=>Math.hypot(x[0]-m[0],x[1]-m[1])<=2*SIGMA)).length/ends.length;
  assert(inside>.9,`20 Euler steps: ${inside} within 2 sigma`);
  assert(ends.filter(x=>x[0]<0).length/ends.length>.47 && ends.filter(x=>x[0]<0).length/ends.length<.53,'both modes represented');
  console.log(`seed ${seed}: ${(inside*100).toFixed(2)}% within a peak's 2 sigma`);
}
