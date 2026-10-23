import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const shots=path.resolve(root,'../vla-rl-guide-shots');await mkdir(shots,{recursive:true});
const url=pathToFileURL(path.join(root,'index.html')).href+'#/see-act';
const report={views:[],errors:[],warnings:[],external:[],checks:[]};
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
function track(page,label){
  page.on('console',m=>{if(m.type()==='error')report.errors.push(label+': '+m.text());if(m.type()==='warning')report.warnings.push(label+': '+m.text());});
  page.on('pageerror',e=>report.errors.push(label+': '+e.message));
  page.on('requestfailed',r=>report.errors.push(label+': '+r.url()+' '+r.failure()?.errorText));
  page.on('request',r=>{if(/^https?:/.test(r.url()))report.external.push(r.url());});
}
async function ready(page){await page.waitForSelector('html[data-ready=true]');await page.waitForFunction(()=>Number(document.querySelector('.stage-surface').dataset.renders)>0);}
async function state(page,value){await page.waitForFunction(value=>document.querySelector('.stage-surface').dataset.state===value,value,{timeout:30000});}
async function geometry(page,label,desktop=true){
  const g=await page.evaluate(()=>{
    const box=n=>n.getBoundingClientRect().toJSON();
    const stage=box(document.querySelector('#stage'));
    const cards=[...document.querySelectorAll('.callout')].map(box);
    return {stage,cards,scrollHeight:document.documentElement.scrollHeight,innerHeight,
      right:box(document.querySelector('.right-column')),pip:[...document.querySelectorAll('.camera-pip')].map(box)};
  });
  if(desktop)assert(g.scrollHeight<=g.innerHeight,label+': page scroll');
  assert(g.stage.right<=g.right.x || !desktop,label+': right column overlap');
  g.cards.forEach((a,i)=>{
    assert(a.x>=g.stage.x&&a.y>=g.stage.y&&a.right<=g.stage.right&&a.bottom<=g.stage.bottom,label+': clipped callout');
    g.cards.slice(i+1).forEach(b=>assert(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,label+': card overlap'));
    g.pip.forEach(b=>assert(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,label+': pip overlap'));
  });return g;
}
async function stopped(page){
  await page.waitForTimeout(150);
  const before=await page.locator('.stage-surface').getAttribute('data-renders');
  const frames=await page.evaluate(()=>window.__rafCalls);
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.stage-surface').getAttribute('data-renders'),before,'idle renderer continues');
  assert.equal(await page.evaluate(()=>window.__rafCalls),frames,'idle RAF continues');
}
try{
  for(const viewport of [{width:1440,height:900},{width:1280,height:720}]){
    const label=`${viewport.width}x${viewport.height}`;
    const context=await browser.newContext({viewport});
    await context.addInitScript(()=>{
      localStorage.removeItem('vla-guide:done');
      window.__rafCalls=0;const raf=window.requestAnimationFrame;
      window.requestAnimationFrame=fn=>{window.__rafCalls++;return raf.call(window,fn);};
    });
    const page=await context.newPage();track(page,label);await page.goto(url);await ready(page);
    await page.waitForFunction(()=>document.querySelectorAll('.thumbnail img').length===10);
    const thumbs=await page.locator('.thumbnail img').evaluateAll(nodes=>nodes.map(n=>({src:n.src,width:n.naturalWidth,height:n.naturalHeight})));
    assert(thumbs.every(t=>/^(blob:|data:)/.test(t.src)&&t.width>0));
    assert.equal(await page.locator('.progress-number').textContent(),'0/9');
    const g=await geometry(page,label);await stopped(page);
    await page.screenshot({path:path.join(shots,`b2_${label}_idle.png`)});
    await page.locator('.coursebar').screenshot({path:path.join(shots,`b2_${label}_courses.png`)});
    const run=page.locator('.run-button');await run.click();
    assert(await run.isDisabled());assert(await page.locator('select').isDisabled());
    assert.equal(await run.innerText(),'运行中');
    assert.equal(await page.locator('.progress-number').textContent(),'0/9');
    await page.waitForTimeout(2200);
    const before=await page.locator('.callout-lines').innerHTML();await page.waitForTimeout(160);
    assert.notEqual(await page.locator('.callout-lines').innerHTML(),before,'anchors did not move');
    await geometry(page,label+' running');
    await page.screenshot({path:path.join(shots,`b2_${label}_running.png`)});
    await state(page,'complete');await stopped(page);
    assert.equal(await page.locator('.progress-number').textContent(),'1/9');
    assert((await page.locator('.stage-surface').getAttribute('data-replans'))>3);
    assert(!(await run.isDisabled()));
    await page.screenshot({path:path.join(shots,`b2_${label}_completed.png`)});
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('vla-guide:done'))),[1]);
    const cupCanvas=await page.locator('.stage-canvas').screenshot();
    await page.locator('select').selectOption({index:1});
    assert.equal(await page.locator('.instruction-strip').textContent(),'把布推到左边');
    assert.equal(await page.locator('.stage-surface').getAttribute('data-state'),'idle');
    await run.click();
    // Drive the same visibility event as a hidden tab, and confirm both the clock and RAF pause.
    await page.waitForTimeout(150);
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    const hiddenRenders=await page.locator('.stage-surface').getAttribute('data-renders');
    await page.waitForTimeout(450);
    assert.equal(await page.locator('.stage-surface').getAttribute('data-renders'),hiddenRenders,'hidden page rendered');
    assert.equal(await page.locator('.stage-surface').getAttribute('data-state'),'running');
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    await state(page,'complete');await stopped(page);
    assert.equal(await page.locator('.progress-number').textContent(),'1/9');
    assert(!cupCanvas.equals(await page.locator('.stage-canvas').screenshot()),'task end states identical');
    await page.screenshot({path:path.join(shots,`b2_${label}_cloth_completed.png`)});
    // Drag is bounded and the camera returns to its original projection after release.
    const anchors=await page.locator('.callout-lines circle').evaluateAll(nodes=>nodes.map(n=>[+n.getAttribute('cx'),+n.getAttribute('cy')]));
    const canvas=await page.locator('.stage-canvas').boundingBox();
    await page.mouse.move(canvas.x+canvas.width*.5,canvas.y+canvas.height*.6);await page.mouse.down();
    await page.mouse.move(canvas.x+canvas.width*.85,canvas.y+canvas.height*.6,{steps:8});await page.mouse.up();
    await page.waitForTimeout(2600);await stopped(page);
    const returned=await page.locator('.callout-lines circle').evaluateAll(nodes=>nodes.map(n=>[+n.getAttribute('cx'),+n.getAttribute('cy')]));
    anchors.forEach((a,i)=>assert(Math.hypot(a[0]-returned[i][0],a[1]-returned[i][1])<1,'camera did not return'));
    // Navigation during a run cancels it and leaves new controls usable.
    await run.click();await page.waitForTimeout(120);
    await page.locator('.course-card[data-level="2"]').click();
    await page.waitForFunction(()=>document.querySelector('.stage-surface').dataset.level==='2');
    assert.equal(await page.locator('.controls-card').getAttribute('aria-busy'),'false');
    await page.locator('.course-card[data-level="1"]').click();
    await page.waitForFunction(()=>document.querySelector('.stage-surface').dataset.level==='1');await ready(page);await stopped(page);
    assert.equal(await page.locator('.stage-surface').getAttribute('data-state'),'idle');
    report.views.push({label,scrollHeight:g.scrollHeight,innerHeight:g.innerHeight,thumbnails:thumbs.length,progress:'1/9',bothTasks:true,idleRAFStopped:true,hiddenPause:true,dragReturn:true,navigationCancellation:true});
    await context.close();
  }
  // Reduced motion and WebGL-unavailable paths both remain playable.
  for(const fallback of [false,true]){
    const context=await browser.newContext({viewport:{width:1280,height:720},reducedMotion:'reduce'});
    await context.addInitScript(fallback=>{
      localStorage.removeItem('vla-guide:done');
      if(fallback){const original=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl2'?null:original.call(this,kind,...args);};}
    },fallback);
    const page=await context.newPage();track(page,fallback?'fallback':'reduced');await page.goto(url);await ready(page);
    if(fallback){
      await page.getByText('当前浏览器无法显示 3D，已换成平面图').waitFor();
      await page.waitForFunction(()=>document.querySelectorAll('.thumbnail img').length===7);
      assert.equal(await page.locator('.course-card[data-level="1"] .thumbnail svg').count(),1);
    }
    for(const index of [0,1]){
      await page.locator('select').selectOption({index});await page.getByRole('button',{name:'运行',exact:true}).click();
      await state(page,'complete');assert.equal(await page.locator('.progress-number').textContent(),'1/9');
    }
    await page.screenshot({path:path.join(shots,`b2_${fallback?'fallback':'reduced_motion'}.png`)});
    report.checks.push({fallback,reducedMotion:true,bothTasks:true});await context.close();
  }
  const js=(await readdir(path.join(root,'assets'))).filter(n=>n.endsWith('.js'));
  assert.equal(js.length,1);const bytes=(await stat(path.join(root,'assets',js[0]))).size;
  assert(bytes<900000);report.javascriptBytes=bytes;
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.warnings,[]);assert.deepEqual(report.external,[]);
  report.passed=true;console.log(JSON.stringify(report,null,2));
}finally{await writeFile(path.join(shots,'b2_acceptance.json'),JSON.stringify(report,null,2));await browser.close();}
