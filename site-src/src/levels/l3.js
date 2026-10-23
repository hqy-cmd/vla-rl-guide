import {Box3,Group} from 'three';
import {baseScene,line,replaceLine,elementRect,placeArm,v} from './shared.js';
import {createDot} from '../stage3d/parts.js';
import {el} from '../ui/dom.js';
const TOTAL=150;
const target=t=>{const u=Math.min(1,Math.max(0,t/TOTAL));return v(-1.9+3.8*u,1.045,.65*Math.sin(2*Math.PI*u)+.27);};
const hash=k=>{let s=Math.imul(k+79,0x45d9f3b);s=Math.imul(s^(s>>>16),0x45d9f3b);return ((s^(s>>>16))>>>0)/4294967296;};

// Adapted from v3/w5's plan-map, pending observation and frozen-prefix model.
// Wall-clock steps and curve progress are distinct: waiting never skips the goal.
export function simulate(mode='停下等',d=8,H=25) {
  const plans=new Map(),chunks=[],windows=[],seams=[],frames=[];
  function predict(start,k){
    return Array.from({length:50},(_,j)=>{
      const p=target(start+j),fade=Math.sin(Math.PI*Math.min(1,(start+j)/TOTAL));
      p.z+=d/12*fade*((hash(k*319+97)-.5)*.8+(hash(k*701+72)-.5)*.25*j/50);
      return p;
    });
  }
  let q=0,k=0,clock=0,next=H,pending=null,hold=target(0);
  const first=predict(0,k++);first.forEach((p,j)=>plans.set(j,p));
  chunks.push({start:0,arrive:0,values:first,progress:0});
  while(q<=TOTAL&&clock<400){
    if(clock===next&&q<TOTAL){
      const start=q,raw=predict(start,k++),values=raw.map(p=>p.clone());
      if(mode==='RTC')for(let j=0;j<50;j++){
        const old=plans.get(start+j);if(!old)continue;
        if(j<d)values[j].copy(old); // hard-frozen prefix during inference
        else {const u=Math.min(1,(j-d)/Math.max(1,50-H-d-1));const w=(Math.exp(-4*u)-Math.exp(-4))/(1-Math.exp(-4));values[j].lerp(old,w);}
      }
      pending={start:clock,progress:start,arrive:clock+d,values};
      if(d)windows.push({start:clock,end:clock+d});
      next=mode==='停下等'?clock+d+H:clock+H;
    }
    let seam=false;
    if(pending&&clock===pending.arrive){
      if(mode==='停下等'&&d>0)pending.values.forEach((p,j)=>{if(pending.progress+j<TOTAL)p.lerp(hold,Math.exp(-j/5));});
      pending.values.forEach((p,j)=>{if(pending.progress+j>=q)plans.set(pending.progress+j,p);});
      chunks.push(pending);pending=null;seam=true;
    }
    const waiting=mode==='停下等'&&pending!==null;
    const point=waiting?hold.clone():(plans.get(q)||target(q)).clone();
    const preview=Array.from({length:50},(_,i)=>plans.get(q+i)?.clone()).filter(Boolean);
    if(seam)seams.push({time:clock,from:hold.clone(),to:point.clone(),jump:hold.distanceTo(point)});
    frames.push({p:point,q,waiting,chunk:chunks.length-1,preview,seam});
    hold=point;if(!waiting)q++;clock++;
  }
  return {frames,chunks,windows,seams};
}
function buildScene() {
  const m=baseScene(),goal=Array.from({length:151},(_,i)=>target(i));
  m.padding={top:94,bottom:108,side:110,elevation:.78};m.angle=.04;
  placeArm(m.arm,v(-.65,0,-.55));
  m.scene.add(line(goal,'#736b60',{dashed:true,width:3}));
  m.arm.moveTo(target(0));m.goal=goal;return m.finishFit();
}
export function buildThumbScene(){
  const m=buildScene(),result=simulate('RTC',8,25);m.scene.add(line(result.frames.map(f=>f.p),'#1aa3a1'));
  m.arm.moveTo(result.frames[80].p);return m;
}
export function mountLevel({surface,content,onBusy,onComplete,invalidate}) {
  const model=buildScene(),{scene,arm,trajectory}=model;
  const ink=line([target(0),target(0)],'#3d7396',{width:4,overlay:true});scene.add(ink);
  const markers=new Group();scene.add(markers);
  const timeline=el('div','chunk-timeline');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-label',content.callouts[0].title);timeline.append(svg);surface.append(timeline);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let mode=content.controls.items[0].options[0],d=8,H=25,result,clock=0,startedAt=0,step=0,running=false,trail=[],seamPoint=target(25),pointer,chunkRects=[],thinkingRects=[];
  const drawSvg=(tag,attrs,parent=svg)=>{const node=document.createElementNS(svg.namespaceURI,tag);Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,value));parent.append(node);return node;};
  function clearMarkers(){for(const child of [...markers.children]){child.geometry?.dispose();child.material.map?.dispose();child.material.dispose();markers.remove(child);}}
  function buildTimeline(){
    svg.replaceChildren();svg.setAttribute('viewBox','0 0 1000 70');svg.setAttribute('preserveAspectRatio','none');
    const defs=drawSvg('defs',{}),pattern=drawSvg('pattern',{id:'thinking-hatch',patternUnits:'userSpaceOnUse',width:6,height:6},defs);
    drawSvg('path',{d:'M-1 1L5 7M2 -2L8 4',stroke:'#8d8376','stroke-width':1.5},pattern);
    const scale=960/(result.frames.length+50),rowHeight=Math.min(9,49/result.chunks.length);
    chunkRects=[];thinkingRects=[];
    result.chunks.forEach((chunk,i)=>{
      const y=13+i*rowHeight,x=20+chunk.arrive*scale;
      for(let j=0;j<50;j++)drawSvg('rect',{x:x+j*scale,y,width:Math.max(.8,scale-.7),height:rowHeight-2,rx:.4,fill:j<H?ink.material.color.getStyle():'#d7cbbc',opacity:j<H?.9:.5});
      chunkRects.push({x,y,width:50*scale,height:rowHeight});
    });
    result.windows.forEach((w,i)=>{
      const r={x:20+w.start*scale,y:13+Math.min(i,result.chunks.length-1)*rowHeight,width:d*scale,height:rowHeight};
      drawSvg('rect',{...r,fill:'url(#thinking-hatch)',stroke:'#9a8d7b','stroke-width':.5});thinkingRects.push(r);
    });
    // No synthetic numeric axis readouts; cell count and pointer convey timing.
    drawSvg('path',{d:'M20 64H980',stroke:'#cec0ad'});
    pointer=drawSvg('path',{stroke:'#18213d','stroke-width':1.4});
    svg.dataset.scale=String(scale);
  }
  function reset(){
    result=simulate(mode,d,H);trail=[];clock=0;step=0;clearMarkers();trajectory.reset();
    trajectory.points.forEach(p=>p.visible=false);arm.moveTo(target(0));seamPoint=target(H);
    ink.material.color.set(mode==='RTC'?'#1aa3a1':'#3d7396');
    replaceLine(ink,[target(0),target(0)]);buildTimeline();apply(0);
    surface.dataset.state='idle';surface.dataset.mode=mode;surface.dataset.delay=String(d);surface.dataset.execute=String(H);
    surface.dataset.jumps=String(result.seams.filter(s=>mode==='直接换'&&s.jump>.06).length);
    surface.dataset.waits=String(result.frames.filter(f=>f.waiting).length);
    surface.dataset.maxJump=String(Math.max(0,...result.seams.map(s=>s.jump)));invalidate();
  }
  function mark(i){
    const f=result.frames[i];trail.push(f.p);
    if(f.waiting){const dot=createDot('#3d7396',8);
      const pauseIndex=result.frames.slice(0,i).filter(frame=>frame.waiting&&frame.q===f.q).length;
      dot.position.copy(f.p).add(v((pauseIndex%3-1)*.1,.025,Math.floor(pauseIndex/3)*.10));markers.add(dot);}
    if(f.seam){
      const s=result.seams.find(s=>s.time===i);seamPoint=f.p.clone();
      if(mode==='直接换'&&d>0){markers.add(line([s.from,s.to],'#a9553f',{width:6,overlay:true}));
        const a=f.p.clone().add(v(-.13,.035,-.13)),b=f.p.clone().add(v(.13,.035,.13)),c=f.p.clone().add(v(-.13,.035,.13)),e=f.p.clone().add(v(.13,.035,-.13));
        markers.add(line([a,b],'#a9553f',{width:3.5,overlay:true}),line([c,e],'#a9553f',{width:3.5,overlay:true}));}
    }
  }
  function apply(index,fraction=0){
    const f=result.frames[index],next=result.frames[Math.min(index+1,result.frames.length-1)];
    // Direct switching stays discontinuous; all other movement interpolates.
    arm.moveTo(f.p.clone().lerp(next.p,mode==='直接换'&&next.seam?0:fraction));
    trajectory.points.forEach((point,i)=>{point.visible=running&&i<f.preview.length; if(point.visible){point.position.copy(f.preview[i]).add(v(0,.06,0));point.material.opacity=.65;}});
    const x=20+(index+fraction)*Number(svg.dataset.scale);pointer.setAttribute('d',`M${x} 8V65`);
    surface.dataset.step=String(index);
  }
  function finish(){running=false;trajectory.points.forEach(p=>p.visible=false);surface.dataset.state='complete';onBusy(false);onComplete();invalidate();}
  reset();
  model.flatPaths=()=>[{points:model.goal,color:'#736b60',dashed:true},{points:trail,color:ink.material.color.getStyle(),width:4}];
  model.flatMarkers=()=>trajectory.points.filter(p=>p.visible).map(p=>({p:p.position,color:ink.material.color.getStyle(),r:2}));
  return {...model,
    control(id,value){if(running)return;if(id==='mode')mode=value;if(id==='delay')d=Number(value);if(id==='hat')H=parseInt(value,10);
      if(id!=='run')reset();else {reset();running=true;startedAt=performance.now();surface.dataset.state='running';onBusy(true);invalidate();}},
    update(dt){if(!running)return false;clock=(performance.now()-startedAt)/1000;
      const position=reduced.matches?result.frames.length-1:Math.min(result.frames.length-1,clock/7.2*(result.frames.length-1));
      const index=Math.floor(position),previousStep=step;while(step<=index){mark(step++);}
      if(previousStep!==step)replaceLine(ink,trail);apply(index,position-index);
      if(index===result.frames.length-1)finish();return running;},
    getAnchors(project){
      const width=timeline.clientWidth,height=surface.clientHeight,r=chunkRects[result.frames[Math.min(step,result.frames.length-1)].chunk]||chunkRects[0];
      const w=thinkingRects.find(r=>r.x>20+(step*Number(svg.dataset.scale)))||thinkingRects.at(-1)||{x:20+H*Number(svg.dataset.scale),y:13,width:0};
      return {chunk:{x:(r.x+r.width*.4)/1000*width,y:height-76+r.y+4},executed:project(trail[Math.floor(trail.length/2)]||target(12)),thinking:{x:(w.x+w.width/2)/1000*width,y:height-76+w.y+4},seam:project(seamPoint)};
    },
    getAvoidRects(projectBox){return [elementRect(timeline,surface,6),projectBox(new Box3().setFromObject(arm.root)),
      projectBox(new Box3(v(-2,1,-.55),v(2,1.15,1.05)))];},
    dispose(){timeline.remove();},
  };
}
