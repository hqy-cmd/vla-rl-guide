import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const shots=path.resolve(root,'../vla-rl-guide-shots');await mkdir(shots,{recursive:true});
const url=pathToFileURL(path.join(root,'index.html')).href;
const report={views:[],errors:[],warnings:[],external:[],checks:[],screenshots:[]};
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
function track(page,label){page.on('console',m=>{if(m.type()==='error')report.errors.push(label+': '+m.text());if(m.type()==='warning')report.warnings.push(label+': '+m.text());});page.on('pageerror',e=>report.errors.push(label+': '+e.message));page.on('requestfailed',r=>report.errors.push(label+': '+r.url()+' '+r.failure()?.errorText));page.on('request',r=>{if(/^https?:/.test(r.url()))report.external.push(r.url());});}
async function state(page,value='complete'){await page.waitForFunction(value=>document.querySelector('.stage-surface').dataset.state===value,value,{timeout:22000});}
async function go(page,id){await page.locator(`.course-card[data-level="${id}"]`).click();await page.waitForFunction(id=>document.querySelector('.stage-surface').dataset.level===String(id),id);await page.waitForFunction(()=>+document.querySelector('.stage-surface').dataset.renders>0);}
const dataset=page=>page.locator('.stage-surface').evaluate(n=>({...n.dataset}));
async function geometry(page,label,desktop){
 const g=await page.evaluate(()=>{
  const box=n=>n?.getBoundingClientRect().toJSON();return {stage:box(document.querySelector('#stage')),cards:[...document.querySelectorAll('.callout')].map(box),timeline:box(document.querySelector('.chunk-timeline')),right:box(document.querySelector('.right-column')),controls:box(document.querySelector('.controls-card')),scrollHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,innerWidth,innerHeight};
 });
 const overlaps=(a,b)=>a.x<b.right-.5&&b.x<a.right-.5&&a.y<b.bottom-.5&&b.y<a.bottom-.5;
 if(desktop){assert(g.scrollHeight<=g.innerHeight,label+' page scroll');assert(g.controls.bottom<=g.stage.bottom+.5,label+' controls overflow');}
 assert(g.scrollWidth<=g.innerWidth,label+' horizontal scroll');
 for(let i=0;i<g.cards.length;i++){
  const c=g.cards[i];assert(c.x>=g.stage.x&&c.y>=g.stage.y&&c.right<=g.stage.right+.5&&c.bottom<=g.stage.bottom+.5,label+' clipped card');
  for(const b of g.cards.slice(i+1))assert(!overlaps(c,b),label+' cards overlap');
  if(g.timeline)assert(!overlaps(c,g.timeline),label+' timeline occluded');
 }
 return g;
}
async function shot(page,name){const filename=`b3_${name}.png`;await page.screenshot({path:path.join(shots,filename),fullPage:page.viewportSize().width<768});report.screenshots.push(filename);}
async function run(page){await page.locator('.run-button').click();assert(await page.locator('.run-button').isDisabled());await state(page);assert(!(await page.locator('.run-button').isDisabled()));}
async function idle(page){await page.waitForTimeout(200);const a=(await dataset(page)).renders;await page.waitForTimeout(250);assert.equal((await dataset(page)).renders,a,'idle renderer');}
try{
 for(const viewport of [{width:1440,height:900},{width:1280,height:720},{width:390,height:844}]){
  const label=`${viewport.width}x${viewport.height}`,desktop=viewport.width>=1024;
  const context=await browser.newContext({viewport});
  const page=await context.newPage();track(page,label);await page.goto(url);await page.waitForSelector('html[data-ready=true]');
  const entries=[];
  await go(page,1);await run(page);await geometry(page,label+' l1',desktop);await shot(page,label+'_l1_done');
  await go(page,2);assert.equal(await page.locator('[data-readout="count"]').textContent(),'21');
  for(const [size,n] of [['大',4],['中',8],['小',14]]){
   await page.getByRole('button',{name:size,exact:true}).click();await page.waitForTimeout(200);assert.equal((await dataset(page)).grid,String(n));assert.equal(await page.locator('[data-readout="count"]').textContent(),String(n*n+5));
  }
  await page.locator('.run-button').click();assert.equal(await page.locator('.progress-number').textContent(),'1/9');await state(page);assert.equal(await page.locator('.progress-number').textContent(),'2/9');
  await geometry(page,label+' l2',desktop);await idle(page);await shot(page,label+'_l2_small_done');
  // Canvas coordinates for the first image patch, then the last queue cell: bidirectional hit testing.
  await page.locator('#stage').scrollIntoViewIfNeeded();
  const canvas=await page.locator('.patch-canvas').boundingBox();
  const size=Math.min(canvas.width*(desktop?.43:.46),canvas.height-(desktop?220:205)),imageY=(canvas.height-size)/2;
  await page.mouse.move(canvas.x+(desktop?28:14)+size/14*2.5,canvas.y+imageY+size/14*3.5);assert.equal((await datasetAfterFrame(page)).selected,'44');
  const qx=(desktop?28:14)+size+(desktop?52:20),qw=canvas.width-(desktop?28:14)-size-(desktop?80:34);
  const cols=Math.max(3,Math.ceil(Math.sqrt(196*qw/size))),cell=Math.min((qw-(cols-1)*3)/cols,(size-42)/Math.ceil(196/cols))-3;
  await page.mouse.click(canvas.x+qx+(195%cols)*(cell+3)+cell/2,canvas.y+imageY+Math.floor(195/cols)*(cell+3)+cell/2);assert.equal((await datasetAfterFrame(page)).selected,'195');
  entries.push({level:2,grids:[4,8,14],tokens:[21,69,201],bidirectional:true});
  await go(page,3);assert.equal(await page.getByRole('button',{name:'25 步',exact:true}).getAttribute('aria-pressed'),'true');
  const modes=[];
  for(const [mode,key] of [['停下等','wait'],['直接换','switch'],['RTC','rtc']]){
   await page.getByRole('button',{name:mode,exact:true}).click();await page.locator('.run-button').click();
   assert(await page.locator('input[type=range]').isDisabled());await page.waitForTimeout(1500);await geometry(page,label+' '+mode+' running',desktop);
   await state(page);await idle(page);await geometry(page,label+' '+mode,desktop);await shot(page,label+'_l3_'+key+'_done');modes.push(await dataset(page));
  }
  assert(+modes[0].waits>0);assert.equal(+modes[1].waits,0);assert(+modes[1].jumps>0);assert(+modes[2].maxJump<+modes[1].maxJump*.5,'RTC seam not smoother');
  assert.equal(await page.locator('.progress-number').textContent(),'3/9');entries.push({level:3,modes});
  await go(page,4);await page.getByRole('button',{name:'取平均',exact:true}).click();await state(page);assert.equal((await dataset(page)).collision,'true');assert.equal(await page.locator('.progress-number').textContent(),'3/9');await shot(page,label+'_l4_average_done');
  await run(page);await shot(page,label+'_l4_default5_done');
  for(const steps of [1,20]){
   await page.locator('input[type=range]').fill(String(steps));await page.locator('input[type=range]').dispatchEvent('input');
   await page.locator('.run-button').click();await page.waitForTimeout(750);if(steps===20){const a=(await dataset(page)).denoise;await page.waitForTimeout(125);assert.notEqual((await dataset(page)).denoise,a);}
   await state(page);await geometry(page,label+' flow '+steps,desktop);await idle(page);await shot(page,label+'_l4_steps'+steps+'_done');
   const sample=await dataset(page);assert.equal(sample.steps,String(steps));if(steps===1)assert.equal(sample.center,'150');if(steps===20){assert(+sample.inPeaks>120);assert.equal(sample.collision,'false');assert.equal(sample.pathProgress,'1');}entries.push({level:4,sample});
  }
  await run(page);assert.equal((await dataset(page)).batches,'3');
  assert.equal(await page.locator('.progress-number').textContent(),'4/9');
  await page.reload();await page.waitForSelector('html[data-ready=true]');assert.equal(await page.locator('.progress-number').textContent(),'4/9');
  await page.waitForFunction(()=>document.querySelectorAll('.thumbnail img').length===10);
  report.views.push({label,desktopNoScroll:desktop,progress:'4/9',thumbnails:10,entries});console.log(label+' passed');await context.close();
 }
 // Control extremes, reduced motion, no-WebGL rendering, cancellation and current instruction.
 for(const fallback of [false,true]){
  const context=await browser.newContext({viewport:{width:1280,height:720},reducedMotion:'reduce'});
  await context.addInitScript(fallback=>{localStorage.removeItem('vla-guide:done');if(fallback){const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl2'?null:original.call(this,kind,...args);};}},fallback);
  const page=await context.newPage();track(page,fallback?'fallback':'reduced');await page.goto(url);await page.waitForSelector('html[data-ready=true]');
  await go(page,1);await page.locator('select').selectOption({index:1});await run(page);
  await go(page,2);assert.equal(await page.locator('[data-readout="count"]').textContent(),'20');await run(page);
  await go(page,3);const zero=[];
  await page.locator('input[type=range]').fill('0');await page.locator('input[type=range]').dispatchEvent('input');
  for(const mode of ['停下等','直接换','RTC']){await page.getByRole('button',{name:mode,exact:true}).click();await run(page);zero.push(await dataset(page));}
  assert(zero.every(r=>r.waits==='0'));assert(Math.max(...zero.map(r=>+r.maxJump))-Math.min(...zero.map(r=>+r.maxJump))<1e-8);
  await page.getByRole('button',{name:'15 步',exact:true}).click();await page.locator('input[type=range]').fill('12');await page.locator('input[type=range]').dispatchEvent('input');await run(page);assert.equal((await dataset(page)).execute,'15');
  await go(page,4);await page.getByRole('button',{name:'取平均',exact:true}).click();await state(page);await run(page);await geometry(page,'reduced flow',true);
  assert.equal(await page.locator('.progress-number').textContent(),'4/9');await shot(page,fallback?'fallback':'reduced_motion');
  report.checks.push({fallback,reduced:true,delay0Identical:true,execute15Delay12:true,instructionCarried:true});await context.close();
 }
 const lifecycle=await browser.newContext({viewport:{width:1280,height:720}});
 const life=await lifecycle.newPage();track(life,'lifecycle');await life.goto(url);await life.waitForSelector('html[data-ready=true]');
 await go(life,2);await life.locator('.run-button').click();await life.waitForTimeout(180);
 await life.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 const before=(await dataset(life)).renders;await life.waitForTimeout(200);assert.equal((await dataset(life)).renders,before);
 await life.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await state(life);await life.locator('.run-button').click();await go(life,3);assert.equal(await life.locator('.controls-card').getAttribute('aria-busy'),'false');
 await life.locator('.run-button').click();await go(life,4);assert.equal(await life.locator('.controls-card').getAttribute('aria-busy'),'false');
 await life.getByRole('button',{name:'取平均',exact:true}).click();await go(life,2);await idle(life);assert.equal(await life.locator('.progress-number').textContent(),'1/9');
 report.checks.push({hidden2DPause:true,navigationCancelsAllNewLevels:true});await lifecycle.close();
 const js=(await readdir(path.join(root,'assets'))).filter(n=>n.endsWith('.js'));assert.equal(js.length,1);report.javascriptBytes=(await stat(path.join(root,'assets',js[0]))).size;assert(report.javascriptBytes<1000000);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.warnings,[]);assert.deepEqual(report.external,[]);report.passed=true;console.log(JSON.stringify(report,null,2));
}finally{await writeFile(path.join(shots,'b3_acceptance.json'),JSON.stringify(report,null,2));await browser.close();}
async function datasetAfterFrame(page){await page.waitForTimeout(50);return dataset(page);}
