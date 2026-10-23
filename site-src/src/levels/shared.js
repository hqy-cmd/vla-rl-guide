import {Scene,Box3,HemisphereLight,DirectionalLight,BufferGeometry,Line,LineBasicMaterial,LineDashedMaterial} from 'three';
import {createKit,createTable,createArm,createTrajectory,getFitPoints,v} from '../stage3d/parts.js';
export {v};
export function line(points,color,{dashed=false,opacity=1}={}) {
  const material=dashed?new LineDashedMaterial({color,dashSize:.09,gapSize:.065,transparent:true,opacity}):new LineBasicMaterial({color,transparent:true,opacity});
  const node=new Line(new BufferGeometry().setFromPoints(points),material);
  if(dashed)node.computeLineDistances();return node;
}
export function replaceLine(node,points) {
  node.geometry.dispose();node.geometry=new BufferGeometry().setFromPoints(points.length>1?points:[v(0,1,0),v(0,1,0)]);
  if(node.material.isLineDashedMaterial)node.computeLineDistances();
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
