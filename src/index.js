// src/index.js
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { createLeaves } from "./scene/leaves.js";

/* ---------------------------
  Family Data (your names)
--------------------------- */
const familyMap = {
  "Zahra Rajab": ["Yunus Habib", "Mustafa Habib", "Elly Sirunya"],
  "Yunus Habib": ["Nuriat Habib", "Zahra Habib"],
  "Mustafa Habib": ["Humail Mustafa"],
  "Elly Sirunya": [],
  "Nuriat Habib": [],
  "Zahra Habib": [],
  "Humail Mustafa": []
};

/* ---------------------------
  Renderer, scene, camera, label renderer
--------------------------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.id = "labels";
document.body.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b0b);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 6, 18);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.target.set(0, 3, 0);
controls.update();

/* lights */
scene.add(new THREE.AmbientLight(0xffffff, 0.28));
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(8, 20, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 100;
sun.shadow.camera.left = -20;
sun.shadow.camera.right = 20;
sun.shadow.camera.top = 20;
sun.shadow.camera.bottom = -20;
scene.add(sun);

/* ground */
const groundMat = new THREE.MeshStandardMaterial({ color: 0x0f120f, roughness: 1 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), groundMat);
ground.rotation.x = -Math.PI/2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);

/* ---------------------------
  Branch system (tapered cylinders)
--------------------------- */

// Group holding all branch meshes so we can clear/recreate easily
const branchRoot = new THREE.Group();
scene.add(branchRoot);

// optional bark texture (place a file at src/assets/bark.jpg) - otherwise fallback color
const textureLoader = new THREE.TextureLoader();
let barkMaterialPromise = textureLoader.loadAsync ? textureLoader.loadAsync('./src/assets/bark.jpg').then(tex => {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  tex.encoding = THREE.sRGBEncoding;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0.05 });
}).catch(err => {
  console.warn('Bark texture not found or failed to load; using fallback material.', err);
  return new THREE.MeshStandardMaterial({ color: 0x6b4b35, roughness: 1 });
}) : Promise.resolve(new THREE.MeshStandardMaterial({ color: 0x6b4b35, roughness: 1 }));

// Utility: create a cylinder segment between two points with given radii
function createSegment(p0, p1, r0, r1, material) {
  const dir = new THREE.Vector3().subVectors(p1, p0);
  const len = dir.length();
  if (len <= 0.0001) return null;
  // Create a cylinder aligned on Y, then rotate/position it
  const radialSegments = 8;
  const geom = new THREE.CylinderGeometry(r1, r0, len, radialSegments, 1, true);
  geom.applyMatrix4(new THREE.Matrix4().makeTranslation(0, -len/2, 0)); // align base at origin for easier rotation

  const mesh = new THREE.Mesh(geom, material);
  // orientation: find quaternion that rotates (0,1,0) to dir.normalize()
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
  mesh.quaternion.copy(q);

  // position: place at p0
  mesh.position.copy(p0);

  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Turn a smooth path (array of Vector3) into tapered segments
function buildTaperedBranch(pathPoints, baseRadius = 0.5, tipRadius = 0.05, material) {
  const group = new THREE.Group();
  const n = pathPoints.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pathPoints[i].clone();
    const p1 = pathPoints[i + 1].clone();
    // linear interpolation of radius along the path
    const t0 = i / (n - 1);
    const t1 = (i + 1) / (n - 1);
    const r0 = THREE.MathUtils.lerp(baseRadius, tipRadius, t0);
    const r1 = THREE.MathUtils.lerp(baseRadius, tipRadius, t1);
    const seg = createSegment(p0, p1, r0, r1, material);
    if (seg) group.add(seg);
  }
  return group;
}

// Create a curved path from start direction and length, with randomness
function makeCurve(startPos, dir, length, steps = 6, randomness = 0.25) {
  const points = [];
  const baseDir = dir.clone().normalize();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // progressive forward
    const forward = baseDir.clone().multiplyScalar(length * (t));
    // add some perpendicular wobble
    const wobbleAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.5, Math.random() - 0.5).normalize();
    const wobbleMag = Math.sin(t * Math.PI) * randomness * (Math.random() - 0.5) * length * 0.4;
    const wobble = wobbleAxis.multiplyScalar(wobbleMag);
    const pt = startPos.clone().add(forward).add(wobble);
    points.push(pt);
  }
  return points;
}

/* Recursive generator: creates branch data (not meshes). We'll create meshes after building structure.
   - origin: Vector3
   - dir: Vector3 (unit)
   - length: number
   - depth: remaining recursion depth
   - branchingFactor: how many children possible
*/
function generateBranchData(origin, dir, length, depth, options = {}) {
  const { minSteps = 5, maxSteps = 9, baseRadius = 0.35, tipRadius = 0.06 } = options;
  const steps = THREE.MathUtils.randInt(minSteps, maxSteps);
  const path = makeCurve(origin, dir, length, steps, 0.28 * (1 + (Math.random() - 0.5) * 0.6));
  const branch = {
    path,
    baseRadius,
    tipRadius,
    length,
    children: [],
    name: null
  };

  if (depth > 0) {
    // generate 1..3 children (biased)
    const childCount = Math.random() < 0.6 ? 2 : (Math.random() < 0.7 ? 1 : 3);
    for (let i = 0; i < childCount; i++) {
      const attachT = 0.45 + Math.random() * 0.45; // attach somewhere along the outer half
      const attachPoint = path[Math.floor(attachT * (path.length - 1))].clone();

      // child direction: rotate parent dir by some angle
      const angle = (Math.PI / 6) + Math.random() * (Math.PI / 6); // 30-60 degrees
      const axis = new THREE.Vector3(0, 0, 1);
      // random left or right
      const sign = Math.random() < 0.5 ? 1 : -1;
      const childDir = dir.clone().applyAxisAngle(axis, sign * angle).normalize();
      // tilt child slightly upward
      childDir.y += 0.15 * Math.random();
      childDir.normalize();

      const childLen = length * (0.45 + Math.random() * 0.35);
      // radius scales down with depth
      const childBaseR = branch.baseRadius * (0.55 + Math.random() * 0.25);
      const childTipR = Math.max(0.02, childBaseR * 0.15);

      const child = generateBranchData(attachPoint, childDir, childLen, depth - 1, {
        minSteps: Math.max(3, minSteps - 1),
        maxSteps: Math.max(5, maxSteps - 2),
        baseRadius: childBaseR,
        tipRadius: childTipR
      });
      branch.children.push(child);
    }
  }

  return branch;
}

// Convert branch data tree into meshes and add to branchRoot using provided material
function buildBranchMeshes(branchData, material) {
  const group = new THREE.Group();

  // build this branch geometry
  const branchMesh = buildTaperedBranch(branchData.path, branchData.baseRadius, branchData.tipRadius, material);
  group.add(branchMesh);

  // recursively build children and attach to group root
  for (const child of branchData.children) {
    const childGroup = buildBranchMeshes(child, material);
    group.add(childGroup);
  }

  return group;
}

/* Assign names (your family) onto branch tips by mapping the recursion order to the family tree.
   We'll do a simple pre-order traversal and attach names to the tip spheres later (in drawLabels()).
*/
function collectTips(branchData, tips = []) {
  // tip = last point in path
  tips.push({ point: branchData.path[branchData.path.length - 1].clone(), node: branchData });
  for (const c of branchData.children) collectTips(c, tips);
  return tips;
}

/* Build a full tree for the family data:
   - We'll convert familyMap into a small procedural tree where the trunk corresponds to root name
*/
async function createProceduralTree(rootName = "Zahra Rajab", maxDepth = 3) {
  // clear previous
  while (branchRoot.children.length) {
    const o = branchRoot.children[0];
    branchRoot.remove(o);
    if (o.geometry) { try{o.geometry.dispose();}catch(e){} }
    if (o.material) { try{ Array.isArray(o.material)?o.material.forEach(m=>m.dispose()):o.material.dispose(); }catch(e){} }
  }

  const material = await barkMaterialPromise;

  // trunk
  const trunkLen = 3.8 + Math.random() * 1.2;
  const trunk = generateBranchData(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), trunkLen, maxDepth, {
    minSteps: 6, maxSteps: 9, baseRadius: 0.6, tipRadius: 0.12
  });

  // build meshes and add to scene
  const trunkGroup = buildBranchMeshes(trunk, material);
  branchRoot.add(trunkGroup);

  // collect tips and map names (simple traversal order)
  const tips = collectTips(trunk);
  // simple assignment: map familyMap root + children in breadth-first order
  const nameQueue = [rootName].concat(familyMap[rootName] || []);
  // then grandchildren
  for (const c of familyMap[rootName] || []) {
    (familyMap[c] || []).forEach(n => nameQueue.push(n));
  }

  // attach simple label objects at tips matching as many names as we have
  // We'll create tiny spheres for nodes to help place labels
  const nodeSphereMat = new THREE.MeshStandardMaterial({ color: 0xff8b6b, roughness: 0.6 });
  const nodeGeo = new THREE.SphereGeometry(0.12, 10, 10);
  const labelNodes = [];
  for (let i = 0; i < tips.length && i < nameQueue.length; i++) {
    const tip = tips[i];
    // small sphere
    const ns = new THREE.Mesh(nodeGeo, nodeSphereMat);
    ns.position.copy(tip.point);
    ns.castShadow = true;
    branchRoot.add(ns);
    // label (CSS2D)
    const div = document.createElement("div");
    div.className = "label";
    div.textContent = nameQueue[i];
    const label = new CSS2DObject(div);
    // offset label a little above node
    label.position.set(0, 0.4, 0);
    ns.add(label);
    // make it visible immediately
    div.classList.add("visible");
    labelNodes.push({ mesh: ns, label, name: nameQueue[i] });
  }

  // return useful refs for later toggling etc.
  return { trunkData: trunk, tipNodes: labelNodes, branchGroup: trunkGroup };
}

/* ---------------------------
  UI + controls
--------------------------- */
let builtTree = null;
let leavesObj = null;
let leavesEnabled = false;

async function regen() {
  builtTree = await createProceduralTree("Zahra Rajab", 2); // depth 2 or 3
}
document.getElementById('regen').addEventListener('click', () => {
  regen();
});

// toggle leaves button (if you have createLeaves, we will show/hide)
document.getElementById('toggle-leaves').addEventListener('click', async () => {
  // If you imported createLeaves earlier, integrate here. Otherwise this toggles a placeholder group.
  if (!leavesObj) {
    // Try to create leaves if function exists
    try {
      if (typeof createLeaves === 'function') {
        leavesObj = createLeaves(scene, { count: 1400, areaRadius: 6, leafTextureURL: new URL('./assets/leaf.png', import.meta.url).href, windStrength: 1.0 });
      } else {
        // simple placeholder: a faint particle cloud at top
        const g = new THREE.Group();
        for (let i = 0; i < 160; i++) {
          const spr = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshStandardMaterial({ color: 0x3bb55b, roughness: 0.9 }));
          spr.position.set((Math.random()-0.5)*3, 2 + Math.random()*2.5, (Math.random()-0.5)*3);
          spr.castShadow = true;
          g.add(spr);
        }
        leavesObj = { instancedMesh: g, update: () => {} };
        scene.add(g);
      }
      leavesEnabled = true;
      document.getElementById('toggle-leaves').textContent = 'Hide Leaves';
    } catch (e) {
      console.error('Failed to create leaves:', e);
    }
  } else {
    // toggle visibility
    leavesEnabled = !leavesEnabled;
    if (leavesObj.instancedMesh) leavesObj.instancedMesh.visible = leavesEnabled;
    document.getElementById('toggle-leaves').textContent = leavesEnabled ? 'Hide Leaves' : 'Show Leaves';
  }
});

// reset camera
document.getElementById('reset-camera').addEventListener('click', () => {
  camera.position.set(0, 6, 18);
  controls.target.set(0, 3, 0);
  controls.update();
});

// key R to reset camera
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r') {
    camera.position.set(0, 6, 18);
    controls.target.set(0, 3, 0);
    controls.update();
  }
});

/* ---------------------------
  Animation loop
--------------------------- */
let last = performance.now();
async function animate(time) {
  const t = performance.now();
  const dt = t - last;
  last = t;

  // optionally update leaves
  if (leavesObj && typeof leavesObj.update === 'function') {
    leavesObj.update(dt, t);
  }

  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);

  requestAnimationFrame(animate);
}

// initial generation
regen();
requestAnimationFrame(animate);

/* responsive */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});
