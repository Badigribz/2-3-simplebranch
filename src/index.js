// src/index.js
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { createLeaves } from "./scene/leaves.js";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/* ---------------------------
  Family Data (your names)
--------------------------- */
const familyMap = {
  "Zahra Rajab": ["Yunus Habib", "Mustafa Habib", "Elly Sirunya"],
  "Yunus Habib": ["Nuryat Habib", "Zahra Habib"],
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
scene.background = new THREE.Color(0x050510);
scene.fog = new THREE.FogExp2(0x090b1a, 0.035); // Spirit mist

const myBarkURL = new URL('./assets/mybark.glb', import.meta.url).href;

const loader = new GLTFLoader();
loader.load(myBarkURL,
  gltf => {
    console.log("✅ GLB REALLY LOADED");
    const trunk = gltf.scene;
    trunk.scale.set(1.5, 1.5, 1.5);
    trunk.position.set(0, 0, 0);

    // ✅ Calculate REAL top of trunk
    const box = new THREE.Box3().setFromObject(trunk);
    const topY = box.max.y;

    // ✅ Create invisible anchor at top
    const trunkAnchor = new THREE.Object3D();
    trunkAnchor.position.set(0, topY, 0);
    trunk.add(trunkAnchor);

    // ✅ SAVE GLOBALLY SO WE CAN GROW FROM IT
    window.trunkAnchor = trunkAnchor;

    scene.add(trunk);
  },
  undefined,
  err => console.error("❌ GLTF ERROR:", err)
);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 6, 18);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.target.set(0, 3, 0);
controls.update();

/* lights */
scene.add(new THREE.AmbientLight(0xffffff, 0.12));
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
// -----------------------------
// ✅ PARCEL-SAFE FULL PBR BARK
// -----------------------------
const textureLoader = new THREE.TextureLoader();

// ✅ Parcel-safe URLs
const barkColorURL    = new URL('./assets/bark/Bark001_4K-PNG_Color.png', import.meta.url).href;
const barkNormalURL   = new URL('./assets/bark/Bark001_4K-PNG_NormalGL.png', import.meta.url).href;
const barkRoughURL    = new URL('./assets/bark/Bark001_4K-PNG_Roughness.png', import.meta.url).href;

// ✅ Load textures
const barkColorTex = textureLoader.load(barkColorURL, tex => {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 6);
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 16;
  renderer.outputEncoding = THREE.sRGBEncoding;
  console.log("✅ Bark Color Loaded");
});

const barkNormalTex = textureLoader.load(barkNormalURL, tex => {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 6);
  tex.anisotropy = 16;
  console.log("✅ Bark Normal Loaded");
});

const barkRoughTex = textureLoader.load(barkRoughURL, tex => {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 6);
  tex.anisotropy = 16;
  console.log("✅ Bark Roughness Loaded");
});

// ✅ Real PBR Material
const barkMaterialPromise = Promise.resolve(
  new THREE.MeshStandardMaterial({
    map: barkColorTex,
    normalMap: barkNormalTex,
    roughnessMap: barkRoughTex,

    roughness: 0.85,
    metalness: 0.0,

    normalScale: new THREE.Vector2(2.2, 2.2), // ✅ MUCH DEEPER BARK
    flatShading: false
  })
);


// Utility: create a cylinder segment between two points with given radii
function createSegment(p0, p1, r0, r1, material) {
  const dir = new THREE.Vector3().subVectors(p1, p0);
  const len = dir.length();
  if (len <= 0.0001) return null;
  const radialSegments = 32;
  const heightSegments = Math.max(4, Math.floor(len * 4));
  const geom = new THREE.CylinderGeometry(
    r1,
    r0,
    len,
    radialSegments,
    heightSegments,
    true
  );

  // ✅ ADD ORGANIC SURFACE NOISE
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const n = (Math.sin(y * 12 + x * 6) + Math.cos(z * 10)) * 0.015;

    pos.setXYZ(
      i,
      x + x * n,
      y,
      z + z * n
    );
  }
  geom.computeVertexNormals();


  geom.applyMatrix4(new THREE.Matrix4().makeTranslation(0, -len/2 - 0.05, 0));
  const mesh = new THREE.Mesh(geom, material);
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
  mesh.quaternion.copy(q);
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
    const t0 = i / (n - 1);
    const t1 = (i + 1) / (n - 1);
    const r0 = THREE.MathUtils.lerp(baseRadius, tipRadius, t0);
    const r1 = THREE.MathUtils.lerp(baseRadius, tipRadius, t1);
    const seg = createSegment(p0, p1, r0, r1, material);
    if (seg) group.add(seg);
  }
  return group;
}

/* ---------------------------
  Deterministic (seeded) randomness
--------------------------- */
// simple string hash -> 32-bit int
function hashStringToInt(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
// mulberry32 PRNG
function seededRng(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/* Create a curved path from start direction and length, using deterministic randomness via rng */
function makeCurve(startPos, dir, length, steps = 6, randomness = 0.25, rng = Math.random) {
  const points = [];
  const baseDir = dir.clone().normalize();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const forward = baseDir.clone().multiplyScalar(length * (t));
    // deterministic wobble using rng
    const wobbleAxis = new THREE.Vector3(rng() - 0.5, rng() * 0.5, rng() - 0.5).normalize();
    const wobbleMag = Math.sin(t * Math.PI) * randomness * (rng() - 0.5) * length * 0.4;
    const wobble = wobbleAxis.multiplyScalar(wobbleMag);
    const pt = startPos.clone().add(forward).add(wobble);
    points.push(pt);
  }
  return points;
}

/* Recursive generator, now using rng for determinism */
function generateFamilyTree(name, position, direction, depth, material) {
  const children = familyMap[name] || [];
  const group = new THREE.Group();

  // ✅ Generation-based scaling
  const length = 2.6 - depth * 0.35 + Math.random() * 0.4;
  const baseRadius = Math.max(
    0.1,
    0.45 - depth * 0.09 + (Math.random() - 0.5) * 0.05
  );

  const tipRadius = 0.05;

  // ✅ Controlled organic curve
  const path = makeCurve(
    position,
    direction,
    length,
    7,
    0.12, // LOW randomness = readable but natural
    () => 0.5
  );

  const branchMesh = buildTaperedBranch(path, baseRadius, tipRadius, material);
  group.add(branchMesh);

  // ✅ Tip of this person
  const tip = path[path.length - 1].clone();

  // ✅ Visible node (person)
  const nodeGeo = new THREE.SphereGeometry(0.14, 16, 16);
  const nodeMat = new THREE.MeshStandardMaterial({ 
  color: 0x88ccff,
  emissive: 0x4499ff,
  emissiveIntensity: 1.4,
  roughness: 0.2
  });
  const node = new THREE.Mesh(nodeGeo, nodeMat);
  node.position.copy(tip);
  node.castShadow = true;
  group.add(node);

  // ✅ Name label
  const div = document.createElement("div");
  div.className = "label visible spirit-label";
  div.textContent = name;
  const label = new CSS2DObject(div);
  label.position.set(0, 0.35, 0);
  node.add(label);

  // ✅ Even fan-out of children (this is the KEY FIX)
  if (children.length > 0) {
    const spread = Math.PI / 2.6; // width of fan
    const start = -spread / 2;

    children.forEach((child, i) => {
      const ratio = children.length === 1 ? 0.5 : i / (children.length - 1);
      const angle = start + ratio * spread;

      const childDir = direction.clone()
        .applyAxisAngle(new THREE.Vector3(0, 0, 1), angle)
        .normalize();

      // ✅ slight upward bias = no drooping branches
      childDir.y += 0.18;
      childDir.normalize();

      const childBranch = generateFamilyTree(
        child,
        tip,
        childDir,
        depth + 1,
        material
      );

      group.add(childBranch);
    });
  }

  return group;
}


/* Convert branch data tree into meshes and add to branchRoot using provided material */
function buildBranchMeshes(branchData, material) {
  const group = new THREE.Group();
  const branchMesh = buildTaperedBranch(branchData.path, branchData.baseRadius, branchData.tipRadius, material);
  group.add(branchMesh);
  for (const child of branchData.children) {
    const childGroup = buildBranchMeshes(child, material);
    group.add(childGroup);
  }
  return group;
}

/* Collect tips by pre-order traversal */
function collectTips(branchData, tips = []) {
  tips.push({ point: branchData.path[branchData.path.length - 1].clone(), node: branchData });
  for (const c of branchData.children) collectTips(c, tips);
  return tips;
}

/* Stable mapping function for labels: lays-out nodes in readable positions instead of purely using tip points.
   We still collect real tip points to create branches, but for label placement we use a deterministic, easy-to-follow
   layout so parent/child relationships are easy to trace visually. This preserves "follow parent → child → grandchild".
*/
function stableNodePosition(index, totalTips, heightOffset = 2.0) {
  // simple layout: spread horizontally by index, height increment for generation (approx.)
  const spacing = 1.8;
  const x = (index - (totalTips - 1) / 2) * spacing;
  const y = heightOffset; // keep labels around crown region; actual branch tip spheres remain on branches
  const z = 0;
  return new THREE.Vector3(x, y, z);
}

/* Build a full tree for the family data deterministically:
   seed is derived from rootName so same name => same tree.
*/
async function createProceduralTree(rootName = "Zahra Rajab", maxDepth = 3) {
  // clear previous meshes & labels
  while (branchRoot.children.length) {
    const o = branchRoot.children[0];
    branchRoot.remove(o);
    if (o.geometry) { try{o.geometry.dispose();}catch(e){} }
    if (o.material) { try{ Array.isArray(o.material)?o.material.forEach(m=>m.dispose()):o.material.dispose(); }catch(e){} }
  }
  // clear CSS2D labels DOM (prevents duplicates)
  const labelsContainer = document.getElementById("labels");
  if (labelsContainer) labelsContainer.innerHTML = "";

  // use seed derived from rootName
  const seed = hashStringToInt(rootName + "|familyTreeV1");
  const rng = seededRng(seed);

  const material = await barkMaterialPromise;

  // trunk (deterministic length based on rng)
  const trunkLen = 3.8 + rng() * 1.2;
  const trunk = generateBranchData(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), trunkLen, maxDepth, rng, {
    minSteps: 6, maxSteps: 9, baseRadius: 0.6, tipRadius: 0.12
  });

  // build meshes and add to scene
  const trunkGroup = buildBranchMeshes(trunk, material);
  branchRoot.add(trunkGroup);

  // collect tips for mapping (these are used to place tiny tip spheres too)
  const tips = collectTips(trunk);

  // generate name queue in a deterministic order: root -> first gen left-to-right -> second gen...
  const nameQueue = [rootName];
  const firstGen = familyMap[rootName] || [];
  nameQueue.push(...firstGen);
  for (const c of firstGen) {
    (familyMap[c] || []).forEach(n => nameQueue.push(n));
  }

  // place small spheres at the *actual* tip positions, and attach labels (CSS2D) to them.
  // Before we used tips directly; to make parent-child visually clear we also compute a stable horizontal position
  // for the label and keep the sphere at its real tip to show relation; label offsets help readability.
  const nodeSphereMat = new THREE.MeshStandardMaterial({ color: 0xff8b6b, roughness: 0.6 });
const nodeGeo = new THREE.SphereGeometry(0.12, 10, 10);
const labelNodes = [];

for (let i = 0; i < tips.length && i < nameQueue.length; i++) {
    const tip = tips[i];

    // ✔ small visible node at tree tip
    const ns = new THREE.Mesh(nodeGeo, nodeSphereMat);
    ns.position.copy(tip.point);
    ns.castShadow = true;
    branchRoot.add(ns);

    // ✔ name label attached directly to node (NO spreading)
    const div = document.createElement("div");
    div.className = "label";
    div.textContent = nameQueue[i];

    const label = new CSS2DObject(div);

    // small offset so text floats cleanly above node
    label.position.set(0, 0.3, 0);
    ns.add(label);

    div.classList.add("visible"); // show immediately

    labelNodes.push({
        mesh: ns,
        label,
        name: nameQueue[i]
    });
}

return { trunkData: trunk, tipNodes: labelNodes, branchGroup: trunkGroup };
}

/* ---------------------------
  UI + controls
--------------------------- */
let builtTree = null;
let leavesObj = null;
let leavesEnabled = false;

// toggle leaves button
document.getElementById('toggle-leaves').addEventListener('click', async () => {
  if (!leavesObj) {
    try {
      if (typeof createLeaves === 'function') {
        leavesObj = createLeaves(scene, { 
          count: 1400, 
          areaRadius: 6, 
          leafTextureURL: new URL('./assets/leaf.png', import.meta.url).href, 
          windStrength: 1.0 
        });
      } else {
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
function animate(time) {
  const t = performance.now();
  const dt = t - last;
  last = t;

  if (leavesObj && typeof leavesObj.update === 'function') {
    leavesObj.update(dt, t);
  }

  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);

  requestAnimationFrame(animate);
}

// --- Generate the tree once at load ---
(async () => {
  const material = await barkMaterialPromise;

  // const familyTree = generateFamilyTree(
  //   "Zahra Rajab",
  //   new THREE.Vector3(0, 0, 0),   // root position
  //   new THREE.Vector3(0, 1, 0),   // upward direction
  //   0,
  //   material
  // );

  // branchRoot.add(familyTree);

  const growthStart = window.trunkAnchor
  ? window.trunkAnchor.getWorldPosition(new THREE.Vector3())
  : new THREE.Vector3(0, 0, 0);

  const familyTree = generateFamilyTree(
  "Zahra Rajab",
  growthStart,              // ✅ START AT REAL TRUNK TOP
  new THREE.Vector3(0, 1, 0),
  0,
  material
  );

// ✅ Attach branches directly onto trunk
  if (window.trunkAnchor) {
  window.trunkAnchor.add(familyTree);
  } else {
  branchRoot.add(familyTree);
  }

  requestAnimationFrame(animate);
})();

/* responsive */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});
