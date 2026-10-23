import {Box3,BufferGeometry,Float32BufferAttribute,Points,ShaderMaterial,Color,Mesh,MeshBasicMaterial,PlaneGeometry,DoubleSide,CylinderGeometry,TubeGeometry,CatmullRomCurve3,ConeGeometry,CanvasTexture,Sprite,SpriteMaterial,SRGBColorSpace} from 'three';
import {baseScene,line,placeArm,v} from './shared.js';
import {createDot,disposeScene} from '../stage3d/parts.js';
import {samplePaths,MEANS,SIGMA} from './flow-math.js';
const BLUE='#3d7396',SAGE='#6e8b5b',BRICK='#a9553f';
// Action coordinates encode a whole open start-to-finish curve, not joint angles.
export function actionPoint(action,s) {
  return v(action[0]*Math.sin(Math.PI*s)+.12*(action[1]-1)*Math.sin(2*Math.PI*s),1.085,
    1.42-2.84*s+.35*(action[1]-1)*Math.sin(Math.PI*s));
}
const curve=a=>Array.from({length:81},(_,i)=>actionPoint(a,i/80));
const sampleWorld=(x,t)=>v(x[0]*(.78+.22*t),1.10+(1-t)*1.45,(x[1]-1)*.44);
function collisionAt(action){
  for(let i=0;i<=200;i++){const p=actionPoint(action,i/200);if(Math.abs(p.x)<.35&&Math.abs(p.z)<.33)return i/200;}
  return null;
}
function pointColor(x){return collisionAt(x)!==null?BRICK:x[0]<0?BLUE:SAGE;}
function endpointLabel(text,position){
  const canvas=document.createElement('canvas');canvas.width=144;canvas.height=64;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fffcf6';ctx.beginPath();ctx.roundRect(2,2,140,60,14);ctx.fill();
  ctx.strokeStyle='#839b95';ctx.lineWidth=2;ctx.stroke();ctx.font='bold 30px GuideSansSC';ctx.fillStyle='#18213d';ctx.textAlign='center';ctx.fillText(text,72,43);
  const map=new CanvasTexture(canvas);map.colorSpace=SRGBColorSpace;
  const label=new Sprite(new SpriteMaterial({map,depthTest:false,depthWrite:false}));label.position.copy(position);
  label.userData.pixelSize=50;label.userData.pixelHeight=23;label.renderOrder=20;return label;
}
function buildScene() {
  const m=baseScene(),{scene,kit,arm}=m;
  m.padding={top:100,bottom:98,side:135,elevation:.85};m.angle=.035;
  placeArm(arm,v(-1.65,0,-.58));
  const obstacle=kit.box(.62,.32,.56,BRICK,scene,v(0,1.16,0));
  obstacle.material=obstacle.material.clone();m.obstacle=obstacle;
  const disk=kit.mesh(new CylinderGeometry(.18,.18,.035,32),'#1aa3a1',scene,v(0,1.025,1.42),false);
  // The endpoint flag is always legible above the far edge and the robot.
  const pole=kit.box(.035,.68,.035,'#3a3f4a',scene,v(0,1.34,-1.42));
  const flag=kit.box(.36,.22,.035,'#1aa3a1',scene,v(.18,1.58,-1.42),.01);
  for(const node of [disk,pole,flag])node.traverse(child=>{if(child.userData.outline){child.visible=false;return;}if(child.material){const side=child.material.side;child.material=new MeshBasicMaterial({transparent:true,side,color:child.userData.outline?'#3a3f4a':node===pole?'#3a3f4a':'#1aa3a1',depthTest:false,depthWrite:false});child.renderOrder=16;}});
  scene.add(endpointLabel('起点',v(.48,1.06,1.47)),endpointLabel('终点',v(.78,1.65,-1.42)));
  const demonstrations=[];
  for(const side of [-1,1])for(let i=0;i<7;i++){
    const a=[side*(1.5+(i-3)*.047),1+Math.sin(i*2.3)*.16],points=curve(a);
    demonstrations.push({points,color:side<0?BLUE:SAGE});scene.add(line(points,side<0?BLUE:SAGE,{opacity:.65,width:1.6}));
  }
  // Direction arrowheads on both bundles prevent the pair reading as a closed loop.
  for(const side of [-1,1])for(const s of [.25,.72]){
    const arrow=new Mesh(new ConeGeometry(.085,.24,3),new MeshBasicMaterial({color:side<0?BLUE:SAGE,depthTest:false}));
    const p=actionPoint([side*1.5,1],s),tangent=actionPoint([side*1.5,1],s+.01).sub(p).normalize();
    arrow.position.copy(p).add(v(0,.025,0));arrow.quaternion.setFromUnitVectors(v(0,1,0),tangent);arrow.renderOrder=8;scene.add(arrow);
  }
  const plane=new Mesh(new PlaneGeometry(4.8,2.1),new MeshBasicMaterial({color:BLUE,transparent:true,opacity:.07,side:DoubleSide,depthWrite:false}));
  plane.rotation.x=-Math.PI/2;plane.position.set(0,2.55,-.35);scene.add(plane);
  scene.add(line([v(-2.4,2.55,-1.4),v(2.4,2.55,-1.4),v(2.4,2.55,.7),v(-2.4,2.55,.7),v(-2.4,2.55,-1.4)],'#7d9ba6',{opacity:.4,width:1.5}));
  arm.moveTo(v(-1.9,1.48,-.35));Object.assign(m,{demonstrations,plane,disk,flag});return m.finishFit();
}
export function buildThumbScene(){const m=buildScene();m.scene.add(line(curve([-1.5,1]),BLUE));m.arm.moveTo(actionPoint([-1.5,1],.65));return m;}
function particleCloud(paths) {
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(paths.length*3),3));
  geometry.setAttribute('color',new Float32BufferAttribute(new Float32Array(paths.length*3),3));
  const material=new ShaderMaterial({vertexColors:true,transparent:true,depthWrite:false,depthTest:false,
    uniforms:{diameter:{value:6.5},fade:{value:1}},
    vertexShader:`uniform float diameter; varying vec3 dotColor;
      void main(){dotColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=diameter;}`,
    fragmentShader:`uniform float fade;varying vec3 dotColor;
      void main(){float r=length(gl_PointCoord-vec2(.5));if(r>.5)discard;
      vec3 ink=mix(vec3(.025,.035,.05),dotColor,1.-smoothstep(.30,.40,r));
      gl_FragColor=vec4(ink,fade*(1.-smoothstep(.44,.5,r)));
      #include <colorspace_fragment>
      }`});
  material.userData.pointPixels=6.5;const points=new Points(geometry,material);points.renderOrder=11;return points;
}
export function mountLevel({surface,onBusy,onComplete,invalidate}) {
  const model=buildScene(),{scene,arm,obstacle}=model;
  const average=line(curve([0,1]),BRICK,{dashed:true,width:5,overlay:true});average.visible=false;scene.add(average);
  const chosen=new Mesh(new TubeGeometry(new CatmullRomCurve3(curve([-1.5,1])),80,.04,6,false),new MeshBasicMaterial({color:BLUE,depthTest:false,depthWrite:false}));chosen.visible=false;chosen.renderOrder=9;scene.add(chosen);
  const highlight=createDot('#1aa3a1',12);highlight.visible=false;highlight.renderOrder=14;scene.add(highlight);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let steps=5,batches=[],active=null,clock=0,startedAt=0,operation=null,selectedAction=[-1.5,1],collision=false,hitAt=null,showProgress=0,serial=0;
  surface.dataset.state='idle';surface.dataset.samples='0';surface.dataset.batches='0';surface.dataset.particles='150';
  function setCloud(batch,position){
    const index=Math.min(batch.steps,Math.floor(position)),fraction=position-index;
    const positions=batch.points.geometry.attributes.position,colors=batch.points.geometry.attributes.color;
    batch.paths.forEach((p,i)=>{
      const a=p[index],b=p[Math.min(batch.steps,index+1)],x=a.map((n,j)=>n+(b[j]-n)*fraction);
      const q=sampleWorld(x,position/batch.steps);positions.setXYZ(i,q.x,q.y,q.z);
      const color=new Color(position>=batch.steps?pointColor(p.at(-1)):'#7a969c');colors.setXYZ(i,color.r,color.g,color.b);
    });
    positions.needsUpdate=true;colors.needsUpdate=true;batch.points.geometry.computeBoundingSphere();batch.index=position;
  }
  const previewPaths=samplePaths(steps),preview={paths:previewPaths,steps,points:particleCloud(previewPaths),index:0};
  scene.add(preview.points);setCloud(preview,0);
  function makeBatch(){
    // All 150 genuine Gaussian samples follow the unchanged analytic Euler solver.
    const paths=samplePaths(steps);active={paths,points:particleCloud(paths),steps,index:0};scene.add(active.points);batches.push(active);preview.points.visible=false;
    if(batches.length>3){const old=batches.shift();scene.remove(old.points);disposeScene(old.points);}
    batches.forEach((batch,i)=>batch.points.material.opacity=i===batches.length-1?1:i===batches.length-2?.3:.12);
    active.selected=paths.findIndex(p=>Math.abs(p.at(-1)[0])>.95&&Math.abs(p.at(-1)[0])<1.8);
    if(active.selected<0)active.selected=0;
    selectedAction=paths[active.selected].at(-1);hitAt=collisionAt(selectedAction);
    collision=false;showProgress=0;highlight.visible=true;chosen.visible=false;
    chosen.geometry.dispose();chosen.geometry=new TubeGeometry(new CatmullRomCurve3(curve(selectedAction)),80,.04,6,false);chosen.geometry.setDrawRange(0,0);
    displayStep(0);surface.dataset.samples=String(++serial);surface.dataset.batches=String(batches.length);surface.dataset.steps=String(steps);
    surface.dataset.inPeaks=String(paths.filter(p=>MEANS.some(m=>Math.hypot(p.at(-1)[0]-m[0],p.at(-1)[1]-m[1])<=2*SIGMA)).length);
    surface.dataset.center=String(paths.filter(p=>Math.abs(p.at(-1)[0])<.4).length);
  }
  function displayStep(position){
    setCloud(active,position);
    const index=Math.floor(position),fraction=position-index,p=active.paths[active.selected];
    const x=p[index].map((n,j)=>n+(p[Math.min(active.steps,index+1)][j]-n)*fraction);
    highlight.position.copy(sampleWorld(x,position/active.steps));surface.dataset.denoise=position.toFixed(3);
  }
  function flash(t){obstacle.position.x=Math.sin(t*65)*.045*Math.exp(-t*5);obstacle.material.color.set(Math.sin(t*32)>0?'#f17253':BRICK);}
  function finish(){operation=null;obstacle.position.x=0;obstacle.material.color.set(BRICK);onBusy(false);surface.dataset.state='complete';invalidate();}
  function start(kind){
    if(operation)return;clock=0;startedAt=performance.now();operation=kind;collision=false;showProgress=0;arm.moveTo(actionPoint([0,1],0));
    obstacle.position.x=0;obstacle.material.color.set(BRICK);surface.dataset.state='running';onBusy(true);
    if(kind==='average'){chosen.visible=false;average.visible=true;highlight.visible=false;selectedAction=[0,1];hitAt=collisionAt(selectedAction);}
    else makeBatch();invalidate();
  }
  model.flatPaths=()=>[...model.demonstrations,
    ...(average.visible?[{points:curve([0,1]),color:BRICK,dashed:true,width:5}]:[]),
    ...(chosen.visible?[{points:curve(selectedAction).slice(0,Math.ceil(showProgress*80)+1),color:pointColor(selectedAction),width:4}]:[])];
  model.flatMarkers=()=>[...(preview.points.visible?[preview]:[]),...batches].flatMap(b=>b.paths.map((p,i)=>({p:v().fromBufferAttribute(b.points.geometry.attributes.position,i),color:b.index>=b.steps?pointColor(p.at(-1)):'#7a969c',r:3.25,opacity:b.points.material.opacity})));
  return {...model,
    control(id,value){if(operation)return;if(id==='steps'){steps=Number(value);invalidate();}if(id==='average')start('average');if(id==='run')start('sample');},
    update(){
      if(!operation)return false;clock=(performance.now()-startedAt)/1000;const time=reduced.matches?4:clock;
      const sampling=operation==='sample',denoiseDuration=1.7;
      if(sampling){
        displayStep(Math.min(active.steps,time/denoiseDuration*active.steps));
        if(time<denoiseDuration)return true;
        chosen.visible=true;chosen.material.color.set(pointColor(selectedAction));
      }
      const progress=Math.min(1,(sampling?time-denoiseDuration:time)/1.35),stop=hitAt??1;
      showProgress=Math.min(progress,stop);const tip=actionPoint(selectedAction,showProgress);arm.moveTo(tip);
      if(sampling){chosen.geometry.setDrawRange(0,Math.ceil(showProgress*80)*6*6);highlight.position.copy(tip).add(v(0,.045,0));}
      if(progress>=stop&&hitAt!==null){collision=true;flash((sampling?time-denoiseDuration:time)-stop*1.35);}
      surface.dataset.collision=String(collision);surface.dataset.pathProgress=String(showProgress);
      if(time>=(sampling?3.7:1.8)){const completedSample=sampling;finish();if(completedSample)onComplete();}
      return operation!==null;
    },
    getAnchors(project){return {obstacle:project(obstacle),left:project(actionPoint([-1.5,1],.48)),right:project(actionPoint([1.5,1],.48)),noise:project(v(-.6,2.55,-.15)),average:project(v(0,average.visible?1.09:1.75,0))};},
    getAvoidRects(projectBox){return [projectBox(new Box3().setFromObject(arm.root)),projectBox(new Box3(v(-1.9,1,-1.5),v(1.9,1.85,1.5))),projectBox(new Box3(v(-2.4,2.5,-1.4),v(2.4,2.6,.7)))];},
  };
}
