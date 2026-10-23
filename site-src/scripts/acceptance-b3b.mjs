import {chromium} from '@playwright/test';
// Use Playwright's bundled PNG decoder for screenshot-level regression checks.
import pngUtils from '../node_modules/playwright-core/lib/utilsBundle.js';
const {PNG}=pngUtils;
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url)),shots=path.resolve(root,'../vla-rl-guide-shots');
await mkdir(shots,{recursive:true});
const report={browser:'Chrome headless'
  ,url:pathToFileURL(path.join(root,'index.html')).href,views:[],slowFrames:[],pixelChecks:[],checks:[],errors:[],warnings:[],external:[],screenshots:[]};
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
function track(page,label){
  page.on('console',m=>{if(m.type()==='error')report.errors.push(label+': '+m.text());if(m.type()==='warning')report.warnings.push(label+': '+m.text());});
  page.on('pageerror',e=>report.errors.push(label+': '+e.message));
  page.on('requestfailed',r=>report.errors.push(label+': '+r.url()+' '+r.failure()?.errorText));
  page.on('request',r=>{if(/^https?:/.test(r.url()))report.external.push(r.url());});
}
const data=page=>page.locator('.stage-surface').evaluate(n=>({...n.dataset}));
async function complete(page){await page.waitForFunction(()=>document.querySelector('.stage-surface').dataset.state==='complete',null,{timeout:16000});}
async function go(page,id){
  // The course strip is last on mobile; return to the stage after selecting a lesson.
  await page.locator(`.course-card[data-level="${id}"]`).click();
  await page.waitForFunction(id=>document.querySelector('.stage-surface').dataset.level===String(id),id);
  await page.waitForFunction(()=>+document.querySelector('.stage-surface').dataset.renders>0);
  if(page.viewportSize().width<768)await page.locator('#stage').scrollIntoViewIfNeeded();
}
async function geometry(page,label){
  const g=await page.evaluate(()=>{
    const box=n=>n.getBoundingClientRect().toJSON(),panel=document.querySelector('.tab-content');
    return {stage:box(document.querySelector('#stage')),panel:box(panel),info:box(document.querySelector('.info-card')),controls:box(document.querySelector('.controls-card')),course:box(document.querySelector('.coursebar')),
      overview:[...document.querySelectorAll('.tab-content h2,.tab-content .intro,.bullets li')].map(n=>({box:box(n),font:parseFloat(getComputedStyle(n).fontSize)})),
      calls:[...document.querySelectorAll('.callout')].map(box),timeline:document.querySelector('.chunk-timeline')?box(document.querySelector('.chunk-timeline')):null,
      buttons:[...document.querySelectorAll('.controls-card button')].map(box),scrollHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,
      panelScroll:panel.scrollHeight,panelHeight:panel.clientHeight,innerWidth,innerHeight};
  });
  assert.equal(g.overview.length,5,label+' overview title / intro / 3 bullets');
  assert(g.scrollWidth<=g.innerWidth,label+' horizontal scroll');
  if(g.innerWidth>=1024){
    assert(g.scrollHeight<=g.innerHeight,label+' desktop page scroll');
    assert(g.panelScroll<=g.panelHeight+1,label+' overview inner scrolling');
    for(const {box:b,font} of g.overview){assert(b.top>=g.panel.top-.5&&b.bottom<=g.panel.bottom+.5&&b.right<=g.panel.right+.5&&b.bottom<=g.innerHeight,label+' overview clipped');assert(font>=13,label+' body below 13px');}
    assert(g.controls.bottom<=g.stage.bottom+.5,label+' controls clipped');
    for(const b of g.buttons)assert(b.top>=g.controls.top&&b.bottom<=g.controls.bottom&&b.height>=24,label+' button clipped');
  }else{
    assert(g.stage.height<=g.innerHeight*.55+1,label+' stage exceeds 55vh');
    assert(g.info.top>=g.stage.bottom-1,label+' info precedes stage');
    assert(g.controls.top>=g.info.bottom-1,label+' controls precede info');
    assert(g.course.top>=g.controls.bottom-1,label+' course not last');
    assert(g.info.top-g.stage.bottom<=20,label+' info not directly below stage');
  }
  const overlaps=(a,b)=>a.x<b.right-.5&&b.x<a.right-.5&&a.y<b.bottom-.5&&b.y<a.bottom-.5;
  for(let i=0;i<g.calls.length;i++){
    const c=g.calls[i];assert(c.left>=g.stage.left&&c.right<=g.stage.right+.5&&c.top>=g.stage.top&&c.bottom<=g.stage.bottom+.5,label+' annotation clipped');
    for(const b of g.calls.slice(i+1))assert(!overlaps(c,b),label+' annotations overlap');
    if(g.timeline)assert(!overlaps(c,g.timeline),label+' timeline overlaps annotations');
  }
  return g;
}
async function shot(page,name){
  const file=`b3b_${name}.png`;
  // Desktop is a viewport shot. Mobile includes the complete vertical reading order.
  const buffer=await page.screenshot({path:path.join(shots,file),fullPage:page.viewportSize().width<768});report.screenshots.push(file);
  const mode=name.match(/_l3_(wait|switch|rtc)$/)?.[1];
  if(mode&&page.viewportSize().width>=1024){
    const png=PNG.sync.read(buffer),stage=await page.locator('#stage').boundingBox();
    const color={wait:[61,115,150],switch:[169,85,63],rtc:[26,163,161]}[mode];let pixels=0;
    for(let y=Math.ceil(stage.y+90);y<stage.y+stage.height-110;y++)for(let x=Math.ceil(stage.x+160);x<stage.x+stage.width-160;x++){
      const i=(y*png.width+x)*4;if(color.every((c,j)=>Math.abs(png.data[i+j]-c)<=2))pixels++;
    }
    report.pixelChecks.push({file,mode,pixels});
    assert(pixels>({wait:350,switch:150,rtc:500}[mode]),file+' missing rendered path / markers');
  }
}
async function run(page,button='.run-button'){
  await page.locator(button).click();const start=Date.now();assert(await page.locator('.run-button').isDisabled());await complete(page);
  assert(!(await page.locator('.run-button').isDisabled()));return Date.now()-start;
}
async function slider(page,n){await page.locator('input[type=range]').fill(String(n));await page.locator('input[type=range]').dispatchEvent('input');}
async function hoverPatch(page,n=4,index=5){
  await page.locator('#stage').scrollIntoViewIfNeeded();const canvas=await page.locator('.patch-canvas').boundingBox();
  const small=canvas.width<600,size=Math.min(canvas.width*(small?.46:.43),canvas.height-(small?205:220));
  await page.mouse.move(canvas.x+(small?14:28)+(index%n+.5)*size/n,canvas.y+(canvas.height-size)/2+(Math.floor(index/n)+.5)*size/n);
  await page.waitForFunction(index=>document.querySelector('.stage-surface').dataset.selected===String(index),index);
}
try{
 for(const viewport of [{width:1280,height:720},{width:1440,height:900},{width:390,height:844}]){
  const label=`${viewport.width}x${viewport.height}`,context=await browser.newContext({viewport});
  const page=await context.newPage();track(page,label);await page.goto(report.url);await page.waitForSelector('html[data-ready=true]');
  const view={label,geometry:[],runs:[]};
  await go(page,1);view.geometry.push({level:1,...await geometry(page,label+' l1 idle')});await shot(page,label+'_l1_idle');
  await page.locator('.run-button').click();const l1Start=Date.now();await page.waitForTimeout(1900);await shot(page,label+'_l1_running');await complete(page);const l1Ms=Date.now()-l1Start;assert(l1Ms<8200,label+' l1 exceeds 8 seconds');view.runs.push({level:1,ms:l1Ms,state:await data(page)});await shot(page,label+'_l1_done');
  await go(page,2);view.geometry.push({level:2,...await geometry(page,label+' l2 idle')});await hoverPatch(page);await shot(page,label+'_l2_hover');view.runs.push({level:2,ms:await run(page),state:await data(page)});await shot(page,label+'_l2_done');
  for(const [size,n] of [['中',8],['小',14],['大',4]]){await page.getByRole('button',{name:size,exact:true}).click();await page.waitForFunction(n=>document.querySelector('.stage-surface').dataset.grid===String(n),n);assert.equal(await page.locator('[data-readout=count]').textContent(),String(n*n+5));}
  await go(page,3);view.geometry.push({level:3,...await geometry(page,label+' l3 idle')});await shot(page,label+'_l3_idle');const modes=[];
  for(const [name,key] of [['停下等','wait'],['直接换','switch'],['RTC','rtc']]){
    await page.getByRole('button',{name,exact:true}).click();const ms=await run(page),state=await data(page);modes.push(state);view.runs.push({level:3,mode:key,ms,state});await geometry(page,label+' l3 '+key);await shot(page,label+'_l3_'+key);
  }
  assert(+modes[0].waits>0);assert.equal(modes[1].waits,'0');assert(+modes[1].jumps>0);assert(+modes[2].maxJump<+modes[1].maxJump*.5);
  await go(page,4);view.geometry.push({level:4,...await geometry(page,label+' l4 idle')});assert.equal((await data(page)).particles,'150');await shot(page,label+'_l4_noise');
  view.runs.push({level:4,kind:'average',ms:await run(page,'.secondary-button'),state:await data(page)});assert.equal((await data(page)).collision,'true');await shot(page,label+'_l4_average');
  view.runs.push({level:4,kind:'default5',ms:await run(page),state:await data(page)});await shot(page,label+'_l4_default5');
  for(const steps of [1,20]){
    await slider(page,steps);await page.locator('.run-button').click();const start=Date.now();await page.waitForTimeout(800);await shot(page,label+'_l4_steps'+steps+'_denoise');await complete(page);
    const state=await data(page);assert.equal(state.steps,String(steps));if(steps===1){assert.equal(state.center,'150');assert.equal(state.collision,'true');}else{assert(+state.inPeaks>120);assert.equal(state.collision,'false');assert.equal(state.pathProgress,'1');}
    view.runs.push({level:4,kind:'steps'+steps,ms:Date.now()-start,state});await geometry(page,label+' l4 '+steps);await shot(page,label+'_l4_steps'+steps);
  }
  await run(page);assert.equal((await data(page)).batches,'3');await shot(page,label+'_l4_recent3');
  assert.equal(await page.locator('.progress-number').textContent(),'4/9');await page.reload();await page.waitForSelector('html[data-ready=true]');assert.equal(await page.locator('.progress-number').textContent(),'4/9');
  await page.waitForFunction(()=>document.querySelectorAll('.thumbnail img').length===10);report.views.push(view);console.log(label+' passed');await context.close();
 }
 // Low frame-rate regression: every rAF callback is delayed by 180 ms to exercise real wall-clock timing at low frame rates.
 const context=await browser.newContext({viewport:{width:1280,height:720}});
 await context.addInitScript(()=>{const request=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>request(()=>setTimeout(()=>fn(performance.now()),180));});
 const page=await context.newPage();track(page,'slow');await page.goto(report.url);await page.waitForSelector('html[data-ready=true]');
 for(const id of [1,2,3,4]){await go(page,id);if(id===4)await slider(page,20);const ms=await run(page);assert(ms<({1:8200,2:3400,3:8200,4:4700}[id]),'slow frame run duration l'+id);report.slowFrames.push({level:id,ms});await shot(page,'slow_l'+id);}
 await context.close();
 // Preserve no-WebGL fallback, reduced motion, cancellation and alternate instruction behavior.
 const fallback=await browser.newContext({viewport:{width:1280,height:720},reducedMotion:'reduce'});
 await fallback.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl2'?null:get.call(this,kind,...args);};});
 const flat=await fallback.newPage();track(flat,'fallback');await flat.goto(report.url);await flat.waitForSelector('html[data-ready=true]');
 await go(flat,1);await flat.locator('select').selectOption({index:1});await run(flat);await go(flat,2);await run(flat);await go(flat,3);await run(flat);await go(flat,4);await run(flat);await shot(flat,'fallback');await fallback.close();
 report.checks.push('overview geometry and 13px text','mobile <=55vh / info-controls-course order','three RTC methods','average + 1/5/20 Euler steps','three retained sample batches','progress persistence','10 local preview images','180ms delayed frames / all four levels','reduced-motion / no-WebGL fallback');
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.warnings,[]);assert.deepEqual(report.external,[]);report.passed=true;console.log('All B3b checks passed.');
}finally{await writeFile(path.join(shots,'b3b_acceptance.json'),JSON.stringify(report,null,2));await browser.close();}
