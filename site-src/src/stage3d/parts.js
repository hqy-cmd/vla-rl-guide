import {
  BackSide, BufferGeometry, CanvasTexture, CylinderGeometry,
  DataTexture, DoubleSide, Float32BufferAttribute, Group, LineBasicMaterial,
  LineSegments, Mesh, MeshBasicMaterial, MeshToonMaterial, NearestFilter,
  PerspectiveCamera, PlaneGeometry, RGBAFormat, RingGeometry, SphereGeometry,
  TorusGeometry, Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const colors = {
  wood: '#d9c3a0', edge: '#c4a982', arm: '#efe6d6', teal: '#1aa3a1',
  link: '#5a5f6a', cup: '#a9553f', plate: '#f3ede2', cloth: '#3d7396',
  navy: '#18213d', outline: '#3a3f4a',
};
const Y = new Vector3(0, 1, 0);
export const v = (x, y, z) => new Vector3(x, y, z);

// Every scene owns its materials/textures; thumbnails and live scenes can be disposed independently.
export function createKit() {
  const gradient = new DataTexture(new Uint8Array([
    90,90,90,255, 150,150,150,255, 210,210,210,255, 255,255,255,255,
  ]), 4, 1, RGBAFormat);
  gradient.minFilter = gradient.magFilter = NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  const materials = new Map();
  const outline = new MeshBasicMaterial({ color: colors.outline, side: BackSide });
  function material(color) {
    if (!materials.has(color)) materials.set(color, new MeshToonMaterial({ color, gradientMap: gradient }));
    return materials.get(color);
  }
  function mesh(geometry, color, parent, position, edged = true) {
    const body = new Mesh(geometry, material(color));
    body.castShadow = true;
    if (position) body.position.copy(position);
    if (edged) {
      // Inflate along normals in model units, rather than scaling a long link's ends.
      const shellGeometry = geometry.clone();
      const p = shellGeometry.attributes.position, n = shellGeometry.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        p.setXYZ(i, p.getX(i) + n.getX(i) * .023,
          p.getY(i) + n.getY(i) * .023, p.getZ(i) + n.getZ(i) * .023);
      }
      const shell = new Mesh(shellGeometry, outline);
      shell.userData.outline = true;
      body.add(shell);
    }
    parent?.add(body);
    return body;
  }
  const box = (w, h, d, color, parent, position, radius = .035) => mesh(
    new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)), color, parent, position);
  return { mesh, box, material };
}

export function createTable(kit) {
  const root = new Group();
  const top = kit.box(5.4, .18, 3.4, colors.wood, root, v(0, .9, 0), .065);
  top.receiveShadow = true;
  kit.box(5.2, .13, 3.2, colors.edge, root, v(0, .75, 0));
  for (const x of [-2.23, 2.23]) for (const z of [-1.23, 1.23])
    kit.box(.22, .64, .22, colors.edge, root, v(x, .36, z));
  // A soft ellipse beneath the table, with no shadow-receiving floor.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 5, 64, 64, 64);
  g.addColorStop(0, '#3a3f4a25'); g.addColorStop(.65, '#3a3f4a10'); g.addColorStop(1, '#3a3f4a00');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const shadow = new Mesh(new PlaneGeometry(7.3, 4.6), new MeshBasicMaterial({
    map: new CanvasTexture(canvas), transparent: true, depthWrite: false,
  }));
  shadow.name = 'contact-shadow';
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .015; root.add(shadow);
  return root;
}

export function createCamera(kit, { tripod = false } = {}) {
  const root = new Group();
  const housing = new Group(); root.add(housing);
  kit.box(.42, .28, .25, colors.navy, housing, v(0, 0, 0));
  const lens = kit.mesh(new CylinderGeometry(.105, .105, .12, 20), colors.teal, housing, v(0, 0, -.18));
  lens.rotation.x = Math.PI / 2;
  const glass = kit.mesh(new CylinderGeometry(.066, .066, .015, 20), colors.navy, housing, v(0, 0, -.25), false);
  glass.rotation.x = Math.PI / 2;
  const camera = new PerspectiveCamera(58, 1.5, .08, 10);
  camera.position.z = -.27; housing.add(camera);
  const frustum = new Group();
  const wire = [];
  const corners = [v(-.55, -.35, -1), v(.55, -.35, -1), v(.55, .35, -1), v(-.55, .35, -1)];
  for (let i = 0; i < 4; i++) wire.push(0, 0, -.25, ...corners[i].toArray(),
    ...corners[i].toArray(), ...corners[(i + 1) % 4].toArray());
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(wire, 3));
  const lines = new LineSegments(geometry, new LineBasicMaterial({ color: colors.teal, transparent: true, opacity: .3, depthWrite: false }));
  frustum.add(lines); housing.add(frustum);
  if (tripod) {
    housing.position.y = 1.55;
    for (const [x, z] of [[-.32, .2], [.32, .2], [0, -.34]]) {
      const leg = kit.mesh(new CylinderGeometry(.024, .032, 1, 8), colors.link, root);
      connect(leg, v(x, .06, z), v(0, 1.52, 0));
    }
  }
  function aimAt(point) {
    root.updateMatrixWorld(true);
    const from = housing.getWorldPosition(new Vector3());
    const localDirection = root.worldToLocal(point.clone()).sub(root.worldToLocal(from));
    housing.quaternion.setFromUnitVectors(v(0, 0, -1), localDirection.normalize());
  }
  return { root, housing, camera, frustum: lines, aimAt };
}

export function connect(mesh, a, b) {
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(Y, b.clone().sub(a).normalize());
  mesh.scale.y = a.distanceTo(b);
}

export function createArm(kit) {
  const root = new Group();
  const origin = v(0, 1.25, -1.08);
  kit.mesh(new CylinderGeometry(.4, .48, .19, 32), colors.link, root, v(0, 1.08, -1.08));
  kit.mesh(new CylinderGeometry(.28, .34, .17, 32), colors.arm, root, v(0, 1.2, -1.08));
  const joints = Array.from({length: 3}, () => kit.mesh(new SphereGeometry(.19, 20, 12), colors.teal, root));
  const links = Array.from({length: 2}, () => {
    const body = kit.box(.25, 1, .29, colors.arm, root);
    // Long dark inset ties the otherwise light links together visually.
    kit.box(.095, .7, .304, colors.link, body, v(0, 0, 0), .025);
    return body;
  });
  const wrist = new Group(); root.add(wrist);
  kit.box(.31, .16, .28, colors.link, wrist, v(0, -.03, 0));
  const fingers = [-1, 1].map(sign => {
    const finger = new Group(); wrist.add(finger);
    kit.box(.065, .27, .09, colors.arm, finger, v(0, -.19, 0), .018);
    kit.box(.11, .055, .11, colors.link, finger, v(-sign * .03, -.3, 0), .015);
    return finger;
  });
  const wristCam = createCamera(kit);
  wristCam.root.position.set(.25, .25, -.3); wristCam.root.scale.setScalar(.65);
  wrist.add(wristCam.root);
  wristCam.housing.rotation.x = -2.1;
  wristCam.camera.fov = 70;
  const indicator = new Mesh(new RingGeometry(.245, .28, 48), new MeshBasicMaterial({
    color: colors.teal, transparent: true, opacity: 0, side: DoubleSide, depthTest: false,
  }));
  indicator.renderOrder = 5; root.add(indicator);
  const tip = v(0, 2.05, .3);
  const L1 = 1.52, L2 = 1.5;
  function setGrip(amount) {
    fingers.forEach((finger, i) => finger.position.x = (i ? 1 : -1) * (.09 + .13 * amount));
  }
  function moveTo(point) {
    // Analytic two-link IK in the radial vertical plane, with a yawing base.
    tip.copy(point);
    const end = point.clone().add(v(0, .31, 0));
    const delta = end.clone().sub(origin);
    const r = Math.hypot(delta.x, delta.z);
    const d = Math.max(.05, Math.min(L1 + L2 - .01, Math.hypot(r, delta.y)));
    const angle = Math.atan2(delta.y, r) + Math.acos(Math.max(-1, Math.min(1,
      (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
    const direction = v(delta.x / (r || 1), 0, delta.z / (r || 1));
    const elbow = origin.clone().addScaledVector(direction, Math.cos(angle) * L1);
    elbow.y += Math.sin(angle) * L1;
    joints[0].position.copy(origin); joints[1].position.copy(elbow); joints[2].position.copy(end);
    connect(links[0], origin, elbow); connect(links[1], elbow, end);
    wrist.position.copy(end);
    wrist.rotation.y = Math.atan2(delta.x, delta.z);
    indicator.position.copy(elbow);
  }
  moveTo(tip); setGrip(1);
  return { root, joints, wristCam, indicator, tip, moveTo, setGrip };
}

export function createCup(kit) {
  const root = new Group();
  // Open top: the smaller dark disk sits just below a cream rim.
  kit.mesh(new CylinderGeometry(.24, .21, .48, 32), colors.cup, root, v(0, .24, 0));
  const top = kit.mesh(new CylinderGeometry(.204, .204, .008, 32), colors.navy, root, v(0, .483, 0), false);
  top.material = new MeshToonMaterial({color: '#633b32'});
  const rim = kit.mesh(new TorusGeometry(.222, .022, 8, 32), colors.plate, root, v(0, .485, 0), false);
  rim.rotation.x = Math.PI / 2;
  kit.mesh(new TorusGeometry(.155, .045, 10, 24), colors.cup, root, v(.28, .27, 0));
  return root;
}
export function createPlate(kit) {
  const root = new Group();
  kit.mesh(new CylinderGeometry(.54, .48, .065, 40), colors.plate, root, v(0, .035, 0));
  const rim = kit.mesh(new TorusGeometry(.47, .025, 8, 40), colors.plate, root, v(0, .08, 0), false);
  rim.rotation.x = Math.PI / 2;
  return root;
}
export function createCloth(kit) {
  const geometry = new PlaneGeometry(.85, .68, 14, 12);
  geometry.rotateX(-Math.PI / 2);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, .025 + .025 * Math.sin(p.getX(i) * 18) * Math.cos(p.getZ(i) * 13));
  geometry.computeVertexNormals();
  const root = new Group();
  const cloth = kit.mesh(geometry, colors.cloth, root);
  cloth.material.side = DoubleSide;
  return root;
}

// Reusable ten-point chunk: first four solid, remaining six hollow; no allocations per frame.
export function createTrajectory(kit, count = 10, execute = 4) {
  const root = new Group();
  const points = Array.from({length: count}, (_, i) => {
    const solid = i < execute;
    const mesh = new Mesh(solid ? new SphereGeometry(.045, 12, 8) : new TorusGeometry(.058, .013, 6, 18),
      new MeshBasicMaterial({color: colors.teal, transparent: true, opacity: 1, depthTest: false}));
    mesh.renderOrder = 6; root.add(mesh); return mesh;
  });
  const trail = Array.from({length: 96}, () => {
    const mesh = new Mesh(new SphereGeometry(.021, 8, 6), new MeshBasicMaterial({color: '#83bbb1', transparent: true, opacity: .55}));
    mesh.visible = false; root.add(mesh); return mesh;
  });
  let used = 0;
  return { root, points, trail, mark(position) {
    const node = trail[used++ % trail.length]; node.position.copy(position); node.visible = true;
  }, reset() { used = 0; trail.forEach(p => p.visible = false); } };
}

export function disposeScene(scene) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  scene.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
    if (node.shadow) { node.shadow.map?.dispose(); node.shadow.mapPass?.dispose(); }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
}

// Tight fitting points keep empty corners of a world AABB from shrinking the actual scene.
export function getFitPoints(scene) {
  scene.updateMatrixWorld(true);
  const points = [];
  scene.traverse(node => {
    if (!node.isMesh || node.userData.outline || node.name === 'contact-shadow') return;
    node.geometry.computeBoundingBox();
    const b = node.geometry.boundingBox;
    for (const x of [b.min.x,b.max.x]) for (const y of [b.min.y,b.max.y])
      for (const z of [b.min.z,b.max.z]) points.push(v(x,y,z).applyMatrix4(node.matrixWorld));
  });
  return points;
}
