import {Box3,BufferGeometry,Float32BufferAttribute,Points,PointsMaterial,Color,Mesh,MeshBasicMaterial,PlaneGeometry,DoubleSide,CylinderGeometry,SphereGeometry,TubeGeometry,CatmullRomCurve3} from 'three';
import {baseScene,line,v} from './shared.js';
import {disposeScene} from '../stage3d/parts.js';
import {samplePaths,MEANS,SIGMA} from './flow-math.js';
const BLUE='#3d7396',SAGE='#6e8b5b',BRICK='#a9553f';
// The two coordinates describe a whole curve: x clearance at the obstacle row,
// plus a modest forward/backward adjustment. They are not a robot's joint angles.
export function actionPoint(action,s) {
  return v(action[0]*Math.sin(Math.PI*s)+.12*(action[1]-1)*Math.sin(2*Math.PI*s),1.065,
    1.25-2.5*s+.35*(action[1]-1)*Math.sin(Math.PI*s));
}
const curve=a=>Array.from({length:81},(_,i)=>actionPoint(a,i/80));
const sampleWorld=(x,t)=>v(x[0],1.07+(1-t)*1.18,(x[1]-1)*.35);
function buildScene() {
  const m=baseScene(),{scene,kit,arm}=m;
  m.padding={top:112,bottom:114,side:175};m.angle=.12;
  // Offset the shared arm base so the endpoint flag stays visible. IK still receives world targets.
  arm.root.position.x=.65;const moveLocal=arm.moveTo;
  arm.moveTo=point=>{moveLocal(point.clone().sub(arm.root.position));arm.tip.copy(point);};
  const obstacle=kit.box(.78,.55,.68,BRICK,scene,v(0,1.29,0));
  // Independent material allows a collision flash without changing other brick objects.
  obstacle.material=obstacle.material.clone();m.obstacle=obstacle;
  const disk=kit.mesh(new CylinderGeometry(.13,.13,.035,24),'#1aa3a1',scene,v(0,1.025,1.25),false);
  kit.box(.035,.54,.035,'#5a5f6a',scene,v(0,1.28,-1.25));
  kit.box(.24,.14,.025,'#1aa3a1',scene,v(.12,1.46,-1.25),.01);
  const demonstrations=[];
  for(const side of [-1,1])for(let i=0;i<7;i++){
    const a=[side*(1.5+(i-3)*.047),1+Math.sin(i*2.3)*.16],points=curve(a);
    demonstrations.push({points,color:side<0?BLUE:SAGE});scene.add(line(points,side<0?BLUE:SAGE,{opacity:.5}));
  }
  const plane=new Mesh(new PlaneGeometry(4.8,1.85),new MeshBasicMaterial({color:'#3d7396',transparent:true,opacity:.065,side:DoubleSide,depthWrite:false}));
  plane.rotation.x=-Math.PI/2;plane.position.set(0,2.25,-.35);scene.add(plane);
  const rim=line([v(-2.4,2.25,-1.275),v(2.4,2.25,-1.275),v(2.4,2.25,.575),v(-2.4,2.25,.575),v(-2.4,2.25,-1.275)],'#7d9ba6',{opacity:.25});scene.add(rim);
  arm.moveTo(actionPoint([0,1],0));
  Object.assign(m,{demonstrations,plane,disk});return m.finishFit();
}
export function buildThumbScene(){const m=buildScene();m.scene.add(line(curve([-1.5,1]),BLUE));m.arm.moveTo(actionPoint([-1.5,1],.65));return m;}
export function mountLevel({surface,onBusy,onComplete,invalidate}) {
  const model=buildScene(),{scene,arm,obstacle}=model;
  const average=line(curve([0,1]),BRICK,{dashed:true,opacity:.8});average.visible=false;scene.add(average);
  const chosen=new Mesh(new TubeGeometry(new CatmullRomCurve3(curve([-1.5,1])),80,.022,6,false),new MeshBasicMaterial({color:BLUE}));chosen.visible=false;scene.add(chosen);
  const highlight=new Mesh(new SphereGeometry(.063,16,10),new MeshBasicMaterial({color:'#1aa3a1',depthTest:false}));highlight.visible=false;highlight.renderOrder=5;scene.add(highlight);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let steps=5,batches=[],active=null,clock=0,operation=null,selectedAction=[-1.5,1],collision=false,hitAt=null,showProgress=0,serial=0;
  surface.dataset.state='idle';surface.dataset.samples='0';
  function pointColor(x){return x[0]<0?BLUE:SAGE;}
  function makeBatch(){
    // Genuine standard Gaussian noise for every sample, with no endpoint clamping or resampling.
    const paths=samplePaths(steps),geometry=new BufferGeometry();
    geometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(paths.length*3),3));
    geometry.setAttribute('color',new Float32BufferAttribute(new Float32Array(paths.length*3),3));
    const points=new Points(geometry,new PointsMaterial({size:.052,vertexColors:true,transparent:true,opacity:.9,depthWrite:false,depthTest:false}));points.renderOrder=4;scene.add(points);
    active={paths,points,steps,index:-1};batches.push(active);
    if(batches.length>3){const old=batches.shift();scene.remove(old.points);disposeScene(old.points);}
    batches.forEach((batch,i)=>batch.points.material.opacity=i===batches.length-1?.9:i===batches.length-2?.3:.13);
    // Highlight the most representative sample of either mode; a one-step Euler
    // solution is exactly the mixture mean, and remains visibly in the obstacle.
    active.selected=paths.findIndex(p=>Math.abs(p.at(-1)[0])>.95&&Math.abs(p.at(-1)[0])<1.8);
    if(active.selected<0)active.selected=0;
    selectedAction=paths[active.selected].at(-1);hitAt=collisionAt(selectedAction);
    collision=false;showProgress=0;highlight.visible=true;chosen.visible=false;
    chosen.geometry.dispose();chosen.geometry=new TubeGeometry(new CatmullRomCurve3(curve(selectedAction)),80,.022,6,false);chosen.geometry.setDrawRange(0,0);
    displayStep(0);
    surface.dataset.samples=String(++serial);surface.dataset.batches=String(batches.length);surface.dataset.steps=String(steps);
    surface.dataset.inPeaks=String(paths.filter(p=>MEANS.some(m=>Math.hypot(p.at(-1)[0]-m[0],p.at(-1)[1]-m[1])<=2*SIGMA)).length);
    surface.dataset.center=String(paths.filter(p=>Math.abs(p.at(-1)[0])<.4).length);
  }
  function collisionAt(action){
    for(let i=0;i<=100;i++){const p=actionPoint(action,i/100);if(Math.abs(p.x)<.43&&Math.abs(p.z)<.39)return i/100;}
    return null;
  }
  function displayStep(index){
    if(active.index===index)return;active.index=index;
    const positions=active.points.geometry.attributes.position,colors=active.points.geometry.attributes.color;
    active.paths.forEach((p,i)=>{
      const q=sampleWorld(p[index],index/active.steps);positions.setXYZ(i,q.x,q.y,q.z);
      const color=new Color(index===active.steps?pointColor(p.at(-1)):'#7a969c');colors.setXYZ(i,color.r,color.g,color.b);
    });
    positions.needsUpdate=true;colors.needsUpdate=true;active.points.geometry.computeBoundingSphere();
    highlight.position.copy(sampleWorld(active.paths[active.selected][index],index/active.steps));
    surface.dataset.denoise=String(index);
  }
  function flash(t){
    obstacle.position.x=Math.sin(t*65)*.045*Math.exp(-t*5);obstacle.material.color.set(t<.32?'#e16c4b':BRICK);
  }
  function finish(){
    operation=null;obstacle.position.x=0;obstacle.material.color.set(BRICK);onBusy(false);surface.dataset.state='complete';invalidate();
  }
  function start(kind){
    if(operation)return;clock=0;operation=kind;collision=false;showProgress=0;arm.moveTo(actionPoint([0,1],0));
    obstacle.position.x=0;obstacle.material.color.set(BRICK);surface.dataset.state='running';onBusy(true);
    if(kind==='average'){chosen.visible=false;average.visible=true;highlight.visible=false;selectedAction=[0,1];hitAt=collisionAt(selectedAction);}
    else makeBatch();invalidate();
  }
  model.flatPaths=()=>[...model.demonstrations,
    ...(average.visible?[{points:curve([0,1]),color:BRICK,dashed:true}]:[]),
    ...(chosen.visible?[{points:curve(selectedAction).slice(0,Math.ceil(showProgress*80)+1),color:pointColor(selectedAction),width:3}]:[])];
  model.flatMarkers=()=>batches.flatMap(b=>b.paths.map(p=>({p:sampleWorld(p[b===active?Math.max(0,b.index):b.steps],b===active?Math.max(0,b.index)/b.steps:1),color:pointColor(p.at(-1)),r:2,opacity:b.points.material.opacity})));
  return {...model,
    control(id,value){if(operation)return;if(id==='steps'){steps=Number(value);invalidate();}if(id==='average')start('average');if(id==='run')start('sample');},
    update(dt){
      if(!operation)return false;clock+=dt;const time=reduced.matches?4:clock;
      const sampling=operation==='sample',denoiseDuration=1.7;
      if(sampling){
        // Discrete Euler updates deliberately hold still between visible steps.
        const index=Math.min(active.steps,Math.floor(time/denoiseDuration*active.steps));displayStep(index);
        if(time<denoiseDuration)return true;
        chosen.visible=true;chosen.material.color.set(pointColor(selectedAction));
      }
      const progress=Math.min(1,(sampling?time-denoiseDuration:time)/1.35),stop=hitAt??1;
      showProgress=Math.min(progress,stop);arm.moveTo(actionPoint(selectedAction,showProgress));
      if(sampling)chosen.geometry.setDrawRange(0,Math.ceil(showProgress*80)*6*6);
      if(progress>=stop&&hitAt!==null){collision=true;flash((progress-stop)*1.35);}
      surface.dataset.collision=String(collision);surface.dataset.pathProgress=String(showProgress);
      if(time>=(sampling?3.7:1.8)){
        const completedSample=sampling;finish();if(completedSample)onComplete();
      }
      return operation!==null;
    },
    getAnchors(project){return {obstacle:project(obstacle),left:project(actionPoint([-1.5,1],.48)),right:project(actionPoint([1.5,1],.48)),noise:project(v(-.6,2.25,-.15)),average:project(v(0,average.visible?1.09:1.75,0))};},
    getAvoidRects(projectBox){return [projectBox(new Box3().setFromObject(arm.root)),projectBox(new Box3(v(-1.9,1,-1.35),v(1.9,1.75,1.4))),projectBox(new Box3(v(-2.4,2.2,-1.27),v(2.4,2.3,.58)))];},
  };
}
