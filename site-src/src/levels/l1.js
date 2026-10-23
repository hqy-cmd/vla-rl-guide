import { Box3, DirectionalLight, HemisphereLight, Scene, Vector3 } from 'three';
import { createArm, createCamera, createCloth, createCup, createKit, createPlate,
  createTable, createTrajectory, getFitPoints, v } from '../stage3d/parts.js';
import { el } from '../ui/dom.js';

export function buildScene({ variant = 1 } = {}) {
  const scene = new Scene();
  const kit = createKit();
  scene.add(new HemisphereLight('#fff7e8', '#9a9da3', 1.15));
  const sun = new DirectionalLight('#fff7e8', 1.5);
  sun.position.set(-3, 7, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(512, 512);
  Object.assign(sun.shadow.camera, {left: -4, right: 4, top: 4, bottom: -4, near: .5, far: 15});
  sun.shadow.radius = 2;
  sun.shadow.bias = -.001; sun.shadow.normalBias = .025;
  scene.add(sun, sun.target);
  const table = createTable(kit), arm = createArm(kit), front = createCamera(kit, {tripod: true});
  const cup = createCup(kit), plate = createPlate(kit), cloth = createCloth(kit);
  cup.position.set(-.85, 1, .42); plate.position.set(.86, 1, .18); cloth.position.set(-1.45, 1, -.45);
  front.root.position.set(2.35, 0, 2.25);
  scene.add(table, arm.root, front.root, cup, plate, cloth);
  front.aimAt(v(0, 1, 0));
  if (variant === 3) { cup.position.x = -1.6; cloth.position.x = .6; }
  if (variant === 4) { plate.position.x = -.8; cup.position.x = 1.3; cloth.position.z = .6; }
  scene.updateMatrixWorld(true);
  return { scene, arm, front, cup, plate, cloth, kit,
    bounds: new Box3(v(-3.15, 0, -2), v(3.15, 3.4, 2.7)),
    fitPoints: [...getFitPoints(scene), v(-.8, 3.2, -.5), v(.7, 3.2, -.5)] };
}
export const buildThumbScene = () => buildScene();

export function mountLevel({ surface, content, onBusy, onComplete, invalidate }) {
  const model = buildScene();
  const { scene, arm, front, cup, plate, cloth, kit } = model;
  const trajectory = createTrajectory(kit); scene.add(trajectory.root);
  const instruction = el('div', 'instruction-strip');
  const choices = content.controls.items.find(item => item.type === 'select').options;
  let selected = choices[0]; instruction.textContent = selected;
  const pips = el('div', 'camera-pips');
  const views = ['cam_front', 'cam_wrist'].map(target => {
    const frame = el('div', 'camera-pip');
    frame.dataset.camera = target;
    frame.append(el('span', '', content.callouts.find(c => c.target === target).title));
    pips.append(frame); return {frame, camera: target === 'cam_front' ? front.camera : arm.wristCam.camera};
  });
  surface.append(instruction, pips);
  const initialCup = cup.position.clone(), initialCloth = cloth.position.clone();
  const idle = v(.15, 2.05, .25);
  let running = false, clock = 0, step = 0, blockStart = 0, plan = [], block = [], serial = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let finishAt = 0, blockOrigin;

  function reset() {
    cup.position.copy(initialCup); cloth.position.copy(initialCloth);
    arm.moveTo(idle); arm.setGrip(1); trajectory.reset();
    serial = 0; step = 0; blockStart = 0; clock = 0;
    surface.dataset.task = selected === choices[0] ? 'cup' : 'cloth';
    surface.dataset.state = 'idle'; surface.dataset.replans = '0';
  }
  function makePlan() {
    const frames = [{p: idle.clone(), grip: 1, cup: initialCup.clone(), cloth: initialCloth.clone()}];
    function to(p, n, grip, cupPosition, clothPosition) {
      const from = frames.at(-1);
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        frames.push({p: from.p.clone().lerp(p, t), grip: from.grip + (grip - from.grip) * t,
          cup: from.cup.clone().lerp(cupPosition || from.cup, t),
          cloth: from.cloth.clone().lerp(clothPosition || from.cloth, t)});
      }
    }
    if (selected === choices[0]) {
      const grip = initialCup.clone().add(v(0, .36, 0));
      to(grip.clone().add(v(0, .55, 0)), 12, 1);
      to(grip, 8, 1); to(grip, 4, 0);
      to(grip.clone().add(v(0, .72, 0)), 8, 0, initialCup.clone().add(v(0, .72, 0)));
      const placed = plate.position.clone().add(v(0, .09, 0));
      to(placed.clone().add(v(0, 1.08, 0)), 16, 0, placed.clone().add(v(0, .72, 0)));
      to(placed.clone().add(v(0, .36, 0)), 8, 0, placed);
      to(placed.clone().add(v(0, .36, 0)), 4, 1);
      to(idle, 12, 1);
    } else {
      const side = initialCloth.clone().add(v(.54, .05, 0));
      to(side.clone().add(v(0, .65, 0)), 16, 1);
      to(side, 8, .15);
      to(side.clone().add(v(-.72, 0, 0)), 24, .15, null, initialCloth.clone().add(v(-.72, 0, 0)));
      to(side.clone().add(v(-.72, .65, 0)), 8, 1);
      to(idle, 12, 1);
    }
    plan = frames;
  }
  function chunk() {
    blockStart = step;
    blockOrigin = {...plan[step], p: arm.tip.clone()};
    serial++;
    // A new observation perturbs each future prediction. The first four are actually executed.
    // Amplitude vanishes at grasp/release and final keyframes, keeping contact physically coherent.
    block = Array.from({length: 10}, (_, i) => {
      const index = Math.min(plan.length - 1, step + i + 1);
      const frame = plan[index];
      const point = frame.p.clone();
      const contact = frame.p.y < 1.55;
      if (!contact && index < plan.length - 1) {
        point.x += Math.sin(serial * 1.7 + i * .7) * .055;
        point.z += Math.cos(serial * 1.3 + i * .8) * .045;
      }
      return {...frame, p: point};
    });
    trajectory.points.forEach((point, i) => {
      point.position.copy(block[i].p); point.visible = true; point.material.opacity = 1;
    });
    surface.dataset.replans = String(serial);
  }
  function preview() {
    makePlan(); step = 0; chunk();
  }
  function apply(frame) {
    arm.moveTo(frame.p); arm.setGrip(frame.grip);
    cup.position.copy(frame.cup); cloth.position.copy(frame.cloth);
    // The carried cup follows the executed (slightly noisy) prediction, too.
    if (frame.grip < .1 && frame.cup.y > 1.12) {
      cup.position.x = arm.tip.x; cup.position.z = arm.tip.z;
      cup.position.y = arm.tip.y - .36;
    }
  }
  function finish() {
    apply(plan.at(-1));
    running = false; onBusy(false); surface.dataset.state = 'complete';
    trajectory.points.forEach(p => p.visible = false);
    front.frustum.material.opacity = arm.wristCam.frustum.material.opacity = .3;
    arm.indicator.material.opacity = 0; instruction.style.transform = '';
    surface.classList.remove('observing');
    onComplete(); invalidate();
  }
  reset(); preview();
  return {
    ...model, views, instruction, pips, trajectory,
    control(id, value) {
      if (running) return;
      if (id === 'instruction') {
        selected = value; instruction.textContent = selected; reset(); preview(); invalidate();
      }
      if (id === 'run') {
        reset(); makePlan(); running = true; finishAt = .8 + (plan.length - 1) * .095;
        surface.dataset.state = 'running'; onBusy(true); invalidate();
      }
    },
    update(dt) {
      if (!running) return false;
      clock += dt;
      if (reduced.matches) {
        // A short sequence of task keyframes keeps the action readable, without interpolated motion.
        const index = Math.min(plan.length - 1, Math.floor(clock / .15) * 12);
        apply(plan[index]);
        if (index === plan.length - 1) finish();
        return running;
      }
      if (clock < .8) {
        surface.classList.add('observing');
        const pulse = Math.sin(clock / .8 * Math.PI);
        front.frustum.material.opacity = arm.wristCam.frustum.material.opacity = .3 + pulse * .6;
        instruction.style.transform = `translateX(-50%) scale(${1 + pulse * .035})`;
        arm.indicator.material.opacity = pulse;
        arm.indicator.rotation.z = clock * Math.PI * 2;
        arm.indicator.geometry.setDrawRange(0, Math.floor(clock / .8 * 48) * 6);
        return true;
      }
      surface.classList.remove('observing'); instruction.style.transform = '';
      front.frustum.material.opacity = arm.wristCam.frustum.material.opacity = .3;
      arm.indicator.material.opacity = 0;
      if (!step && !blockStart) { chunk(); blockStart = -1; }
      const position = Math.min(plan.length - 1, (clock - .8) / .095);
      const nextStep = Math.floor(position);
      while (step < nextStep) {
        apply(block[step % 4]);
        trajectory.mark(block[step % 4].p);
        step++;
        if (step % 4 === 0 && step < plan.length - 1) chunk();
      }
      const local = step % 4;
      const from = local ? block[local - 1] : blockOrigin;
      const to = block[local];
      const t = position - nextStep;
      const frame = {p: from.p.clone().lerp(to.p, t), grip: from.grip + (to.grip - from.grip) * t,
        cup: from.cup.clone().lerp(to.cup, t), cloth: from.cloth.clone().lerp(to.cloth, t)};
      apply(frame);
      trajectory.points.forEach((point, i) => {
        point.visible = i >= local;
        if (i >= 4) point.material.opacity = Math.max(0, 1 - (local + t) / 4);
      });
      if (clock >= finishAt) finish();
      return running;
    },
    getAnchors(project) {
      const strip = instruction.getBoundingClientRect(), box = surface.getBoundingClientRect();
      return { cam_front: project(front.housing), cam_wrist: project(arm.wristCam.housing),
        joints: project(arm.joints[1]), chunk: project(trajectory.points[4]),
        instruction: {x: strip.x - box.x + strip.width / 2, y: strip.bottom - box.y} };
    },
    getAvoidRects(projectBox) {
      return [projectBox(new Box3().setFromObject(arm.root)), ...[instruction, pips].map(node => {
        const r = node.getBoundingClientRect(), s = surface.getBoundingClientRect();
        return {x: r.x-s.x-8, y: r.y-s.y-8, width: r.width+16, height: r.height+16};
      })];
    },
  };
}
