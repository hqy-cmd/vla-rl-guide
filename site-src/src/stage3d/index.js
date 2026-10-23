import { OrthographicCamera, PCFShadowMap, Vector3, WebGLRenderer } from 'three';
import { disposeScene, v } from './parts.js';
import { el } from '../ui/dom.js';

export function createRenderer(canvas, options = {}) {
  // Probe before constructing: Three's constructor logs an error when no context is available.
  const context = canvas.getContext('webgl2', {alpha: true, antialias: true, ...options});
  if (!context) return null;
  const renderer = new WebGLRenderer({canvas, context, alpha: true, antialias: true, ...options});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  // r186 removed PCFSoftShadowMap. PCF is the supported filtered-shadow path.
  renderer.shadowMap.type = PCFShadowMap;
  return renderer;
}
export function boxCorners(box) {
  const result = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y])
    for (const z of [box.min.z, box.max.z]) result.push(v(x, y, z));
  return result;
}
export function projectBox(box, project) {
  const points = (Array.isArray(box) ? box : boxCorners(box)).map(project);
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
  return {x, y, width: Math.max(...points.map(p => p.x)) - x,
    height: Math.max(...points.map(p => p.y)) - y};
}
export function frameCamera(camera, bounds, width, height, angle = Math.PI / 4, padding = {}) {
  const top = padding.top || 0, bottom = padding.bottom || 0;
  const side = padding.side || 0;
  const focus = Array.isArray(bounds) ? v(0, 1.55, .1) : bounds.getCenter(new Vector3());
  const elevation = Math.PI / 6, distance = 12;
  camera.position.copy(focus).add(v(Math.sin(angle) * Math.cos(elevation), Math.sin(elevation), Math.cos(angle) * Math.cos(elevation)).multiplyScalar(distance));
  camera.lookAt(focus);
  const aspect = width / height;
  Object.assign(camera, {left: -5 * aspect, right: 5 * aspect, top: 5, bottom: -5, zoom: 1});
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  const project = point => {const p = point.clone().project(camera); return {x: (p.x+1)*width/2, y: (1-p.y)*height/2};};
  let rect = projectBox(bounds, project);
  camera.zoom = Math.min((width-side*2) / rect.width, (height-top-bottom) / rect.height) * .96;
  camera.updateProjectionMatrix();
  rect = projectBox(bounds, project);
  const units = 10 / (camera.zoom * height);
  camera.position.add(v(1, 0, 0).applyQuaternion(camera.quaternion).multiplyScalar((rect.x + rect.width/2 - width/2)*units));
  camera.position.add(v(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(((top + height-bottom)/2 - rect.y - rect.height/2)*units));
  camera.updateMatrixWorld(true);
}

export function mountStage3D(surface, buildLevel, options) {
  const canvas = el('canvas', 'stage-canvas');
  canvas.setAttribute('aria-label', options.content.title);
  surface.append(canvas);
  const renderer = createRenderer(canvas);
  let flatCanvas, ctx;
  if (!renderer) {
    canvas.remove(); flatCanvas = el('canvas', 'stage-canvas fallback-canvas');
    surface.append(flatCanvas); ctx = flatCanvas.getContext('2d');
    if (options.content.id === 1) surface.append(el('p', 'webgl-fallback', '当前浏览器无法显示 3D，已换成平面图'));
    surface.dataset.fallback = 'true';
  }
  const camera = new OrthographicCamera(-5, 5, 5, -5, .1, 50);
  let frame = 0, previous = 0, disposed = false, angle = 0, dragging = false, pointerX = 0;
  let renderCount = 0;
  const listeners = new Set();
  function invalidate() {
    if (!disposed && !document.hidden && !frame) frame = requestAnimationFrame(render);
  }
  const model = buildLevel({...options, surface, invalidate});
  let width = 1, height = 1;
  const project = object => {
    model.scene.updateMatrixWorld(true);
    const point = object.isObject3D ? object.getWorldPosition(new Vector3()) : object.clone();
    if (!renderer) return flatProject(point);
    point.project(camera);
    return {x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2};
  };
  function flatProject(point) {
    const scale = Math.min((width - 90) / 7, (height - 200) / 4.2);
    return {x: width / 2 + (point.x - point.z * .48) * scale,
      y: height * .66 + (point.z * .3 - point.y) * scale};
  }
  function fit() {
    const side = width < 600 ? 22 : Math.min(155, width * .17);
    frameCamera(camera, model.fitPoints || model.bounds, width, height, (model.angle ?? Math.PI / 4) + angle,
      model.padding ? {...model.padding, side: width < 600 ? 18 : model.padding.side} : {top: 127, bottom: 64, side});
  }
  function resize() {
    width = Math.max(1, surface.clientWidth); height = Math.max(1, surface.clientHeight);
    if (renderer) {
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
    }
    else {
      flatCanvas.width = width * Math.min(devicePixelRatio || 1, 2);
      flatCanvas.height = height * Math.min(devicePixelRatio || 1, 2);
    }
    fit(); invalidate();
  }
  function drawFlat() {
    const ratio = flatCanvas.width / width;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
    if (model.drawFlat) {model.drawFlat(ctx, flatProject); return;}
    const path = points => {ctx.beginPath(); points.forEach((p, i) => {const q = flatProject(p); i ? ctx.lineTo(q.x,q.y) : ctx.moveTo(q.x,q.y);});};
    path([v(-2.7, .9, -1.7), v(2.7, .9, -1.7), v(2.7, .9, 1.7), v(-2.7,.9,1.7),v(-2.7,.9,-1.7)]);
    ctx.fillStyle='#d9c3a0'; ctx.strokeStyle='#3a3f4a'; ctx.lineWidth=2; ctx.fill(); ctx.stroke();
    path(model.arm.joints.map(j => j.position)); ctx.lineWidth=13; ctx.strokeStyle='#5a5f6a'; ctx.lineCap='round'; ctx.stroke();
    path(model.arm.joints.map(j => j.position)); ctx.lineWidth=8; ctx.strokeStyle='#efe6d6'; ctx.stroke();
    for(const j of model.arm.joints) {const p=flatProject(j.position); ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.fillStyle='#1aa3a1';ctx.fill();}
    for(const [obj,color,size] of [[model.plate,'#f3ede2',18],[model.cloth,'#3d7396',18],[model.cup,'#a9553f',11]]) {
      const p=flatProject(obj.position);ctx.fillStyle=color;ctx.strokeStyle='#3a3f4a';ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(p.x,p.y,size,size*.55,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
    for(const point of model.trajectory.points) if(point.visible) {
      const p=flatProject(point.position);ctx.globalAlpha=point.material.opacity;ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);
      ctx.strokeStyle=ctx.fillStyle='#1aa3a1';point.geometry.type==='SphereGeometry'?ctx.fill():ctx.stroke();
    }
    ctx.globalAlpha=1;
    for(const obj of [model.front.housing, model.arm.wristCam.housing]) {
      const p=flatProject(obj.getWorldPosition(new Vector3()));
      ctx.fillStyle='#18213d';ctx.fillRect(p.x-9,p.y-6,18,12);
      ctx.fillStyle='#1aa3a1';ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();
    }
  }
  function render(now) {
    frame = 0;
    if (disposed || document.hidden) return;
    const dt = previous ? Math.min(.05, (now - previous) / 1000) : 0;
    previous = now;
    const animating = model.update(dt);
    let returning = false;
    if (!dragging && Math.abs(angle) > .0004) {
      angle *= Math.exp(-dt * 4.5); if(Math.abs(angle)<.0004) angle = 0;
      fit(); returning = angle !== 0;
    }
    model.scene.updateMatrixWorld(true);
    if (renderer) {
      model.arm.indicator.quaternion.copy(camera.quaternion);
      renderer.setScissorTest(false); renderer.setViewport(0,0,width,height);
      renderer.setClearColor('#000000', 0); renderer.clear(); renderer.render(model.scene, camera);
      renderer.setScissorTest(true);
      const parent = surface.getBoundingClientRect();
      for (const {frame: pip, camera: view} of model.views) {
        const r = pip.getBoundingClientRect();
        const x = r.x-parent.x, y = height-(r.bottom-parent.y);
        view.aspect = r.width/r.height; view.updateProjectionMatrix();
        renderer.setViewport(x,y,r.width,r.height); renderer.setScissor(x,y,r.width,r.height);
        renderer.setClearColor('#e9dcca', 1); renderer.clear(); renderer.render(model.scene, view);
      }
      renderer.setScissorTest(false);
    } else drawFlat();
    surface.dataset.renders = String(++renderCount);
    listeners.forEach(fn => fn());
    if (animating || returning) invalidate();
    else previous = 0;
  }
  const observer = new ResizeObserver(resize); observer.observe(surface);
  const interaction = renderer ? canvas : flatCanvas;
  const down = event => {if(event.button && event.button !== 0)return; dragging=true;pointerX=event.clientX;interaction.setPointerCapture(event.pointerId);invalidate();};
  const move = event => {if(!dragging)return;angle=Math.max(-25*Math.PI/180,Math.min(25*Math.PI/180,angle+(event.clientX-pointerX)*.003));pointerX=event.clientX;fit();invalidate();};
  const up = () => {
    dragging=false;
    if(matchMedia("(prefers-reduced-motion: reduce)").matches){angle=0;fit();}
    invalidate();
  };
  const visibility = () => {
    if(document.hidden){cancelAnimationFrame(frame);frame=0;previous=0;}else invalidate();
  };
  interaction.addEventListener('pointerdown', down); interaction.addEventListener('pointermove', move);
  interaction.addEventListener('pointerup', up); interaction.addEventListener('pointercancel', up);
  document.addEventListener('visibilitychange', visibility);
  resize();
  return {
    project, getAnchors: () => model.getAnchors(project),
    getAvoidRects: () => model.getAvoidRects(box => projectBox(box, project)),
    onFrame(fn) {listeners.add(fn);return () => listeners.delete(fn);},
    onControl(id,value) {model.control(id,value);},
    dispose() {
      disposed=true;cancelAnimationFrame(frame);observer.disconnect(); listeners.clear();
      document.removeEventListener('visibilitychange',visibility);
      interaction.removeEventListener('pointerdown',down);interaction.removeEventListener('pointermove',move);
      interaction.removeEventListener('pointerup',up);interaction.removeEventListener('pointercancel',up);
      model.dispose?.();
      disposeScene(model.scene); renderer?.dispose(); renderer?.forceContextLoss();
    },
  };
}
