import {Scene,Box3,HemisphereLight,DirectionalLight} from 'three';
import {createKit,createTable,createArm,createTrajectory,getFitPoints,v} from '../stage3d/parts.js';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
export {v};
export function line(points,color,{dashed=false,opacity=1,width=2.5,overlay=false}={}) {
  const material=new LineMaterial({color,linewidth:width,dashed,dashSize:.11,gapSize:.075,
    transparent:true,opacity,depthTest:!overlay,depthWrite:false});
  const node=new Line2(new LineGeometry().setPositions(points.flatMap(p=>p.toArray())),material);
  node.computeLineDistances();node.renderOrder=overlay?8:1;return node;
}
export function replaceLine(node,points) {
  // The renderer caches an instanced geometry's maximum instance count on first draw.
  // A growing path needs fresh geometry or only its original first segment is drawn.
  node.geometry.dispose();
  node.geometry=new LineGeometry().setPositions((points.length>1?points:[v(0,1,0),v(0,1,0)]).flatMap(p=>p.toArray()));
  node.computeLineDistances();
}
export function placeArm(arm,position) {
  arm.root.position.copy(position);const moveLocal=arm.moveTo;
  arm.moveTo=point=>{moveLocal(point.clone().sub(arm.root.position));arm.tip.copy(point);};
}
export function baseScene() {
  const scene=new Scene(),kit=createKit(),arm=createArm(kit),table=createTable(kit);
  scene.add(new HemisphereLight('#fff7e8','#9a9da3',1.15));
  const sun=new DirectionalLight('#fff7e8',1.5);sun.position.set(-3,7,5);scene.add(sun);
  scene.add(table,arm.root);arm.setGrip(.05);
  const trajectory=createTrajectory(kit,50,0);trajectory.points.forEach(p=>{p.rotation.x=-Math.PI/2;p.visible=false;});scene.add(trajectory.root);
  const model={scene,kit,arm,table,trajectory,views:[],bounds:new Box3(v(-2.8,0,-1.8),v(2.8,3.4,1.8)),
    padding:{top:108,bottom:116,side:165},angle:.15};
  model.drawFlat=(ctx,project)=>drawFlatModel(model,ctx,project);
  model.finishFit=()=>{model.fitPoints=getFitPoints(scene);return model;};
  return model;
}
// The same semantic geometry is visible when WebGL is unavailable; no explanatory copy.
function drawFlatModel(model,ctx,project) {
  const path=points=>{ctx.beginPath();points.forEach((p,i)=>{const q=project(p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});};
  path([v(-2.7,.99,-1.7),v(2.7,.99,-1.7),v(2.7,.99,1.7),v(-2.7,.99,1.7),v(-2.7,.99,-1.7)]);
  ctx.fillStyle='#d9c3a0';ctx.strokeStyle='#3a3f4a';ctx.lineWidth=2;ctx.fill();ctx.stroke();
  for(const points of model.flatPaths?.() || []) {
    path(points.points);ctx.strokeStyle=points.color;ctx.globalAlpha=points.opacity??1;ctx.lineWidth=points.width||2;ctx.setLineDash(points.dashed?[4,4]:[]);ctx.stroke();
  }
  ctx.setLineDash([]);ctx.globalAlpha=1;
  for(const marker of model.flatMarkers?.() || []) {
    const q=project(marker.p);ctx.fillStyle=marker.color;ctx.globalAlpha=marker.opacity??1;ctx.beginPath();ctx.arc(q.x,q.y,marker.r||3,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
  if(model.obstacle){const q=project(model.obstacle.position);ctx.fillStyle='#a9553f';ctx.fillRect(q.x-16,q.y-14,32,28);ctx.strokeStyle='#3a3f4a';ctx.strokeRect(q.x-16,q.y-14,32,28);}
  path(model.arm.joints.map(j=>j.position.clone().add(model.arm.root.position)));ctx.lineWidth=11;ctx.strokeStyle='#5a5f6a';ctx.lineCap='round';ctx.stroke();
  path(model.arm.joints.map(j=>j.position.clone().add(model.arm.root.position)));ctx.lineWidth=7;ctx.strokeStyle='#efe6d6';ctx.stroke();
  for(const j of model.arm.joints){const q=project(j.position.clone().add(model.arm.root.position));ctx.fillStyle='#1aa3a1';ctx.beginPath();ctx.arc(q.x,q.y,6,0,Math.PI*2);ctx.fill();}
}
export function elementRect(node,surface,margin=0) {
  const r=node.getBoundingClientRect(),s=surface.getBoundingClientRect();return {x:r.x-s.x-margin,y:r.y-s.y-margin,width:r.width+2*margin,height:r.height+2*margin};
}
