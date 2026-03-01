import * as THREE from 'three';
import { GLTFLoader }    from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader }    from 'three/examples/jsm/loaders/RGBELoader.js';   // ← IBL

// ─────────────────────────────────────────────
// SCENE
// ─────────────────────────────────────────────
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x060b1a, 0.038);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(5, 5, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled       = true;
renderer.shadowMap.type          = THREE.PCFSoftShadowMap;
renderer.toneMapping             = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure     = 1.2;
renderer.useLegacyLights  = false;               // modern physically correct lighting
renderer.outputColorSpace = THREE.SRGBColorSpace; // correct colour space (replaces outputEncoding)
document.body.appendChild(renderer.domElement);

// ─────────────────────────────────────────────
// IBL — HDRI IMAGE BASED LIGHTING
// Loads your moonrise sky and uses it to light
// every surface from every angle simultaneously
// ─────────────────────────────────────────────
const hdrURL = new URL('./assets/qwantani_moonrise_puresky_1k.hdr', import.meta.url).href;

new RGBELoader()
  .setDataType(THREE.HalfFloatType)   // most compatible across GPUs
  .load(
    hdrURL,
    (hdriTexture) => {
      hdriTexture.mapping = THREE.EquirectangularReflectionMapping;

      // IBL: lights every surface from every angle using the HDRI
      scene.environment = hdriTexture;

      // Dark cinematic background — HDRI lights the scene but sky stays dark
      // To show the actual moonrise sky instead, comment the line below and
      // uncomment: scene.background = hdriTexture;
      scene.background = new THREE.Color(0x060b1a);

      console.log('HDRI loaded successfully ✓');
    },
    undefined,   // onProgress — not needed
    (err) => {
      console.error('HDRI failed to load:', err);
      // Fallback: plain dark background if HDRI missing
      scene.background = new THREE.Color(0x060b1a);
    }
  );

// ─────────────────────────────────────────────
// ORBIT CONTROLS — fully unlocked
// ─────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping      = true;
controls.dampingFactor      = 0.07;
controls.screenSpacePanning = true;
controls.minDistance        = 0.4;
controls.maxDistance        = 140;
controls.zoomSpeed          = 1.4;
controls.panSpeed           = 0.9;
controls.rotateSpeed        = 0.75;

// ─────────────────────────────────────────────
// CAMERA TRAVEL — smooth cinematic fly-to
// ─────────────────────────────────────────────
const camTravel = {
  active:     false,
  fromPos:    new THREE.Vector3(),
  fromTarget: new THREE.Vector3(),
  toPos:      new THREE.Vector3(),
  toTarget:   new THREE.Vector3(),
  progress:   0,
  duration:   1.2,
};

const OVERVIEW = {
  pos:    new THREE.Vector3(5, 5, 10),
  target: new THREE.Vector3(0, 3, 0),
};

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function flyTo(worldTarget, arrivalDistance = 1.6) {
  camTravel.fromPos.copy(camera.position);
  camTravel.fromTarget.copy(controls.target);

  const dir = new THREE.Vector3()
    .subVectors(camera.position, worldTarget)
    .normalize();

  if (dir.lengthSq() < 0.0001) dir.set(0.2, 0.5, 1).normalize();

  camTravel.toTarget.copy(worldTarget);
  camTravel.toPos.copy(worldTarget).addScaledVector(dir, arrivalDistance);
  camTravel.progress = 0;
  camTravel.active   = true;
}

function flyToOverview() {
  camTravel.fromPos.copy(camera.position);
  camTravel.fromTarget.copy(controls.target);
  camTravel.toPos.copy(OVERVIEW.pos);
  camTravel.toTarget.copy(OVERVIEW.target);
  camTravel.progress = 0;
  camTravel.active   = true;
}

function tickCamTravel(delta) {
  if (!camTravel.active) return;

  camTravel.progress += delta / camTravel.duration;
  if (camTravel.progress >= 1) {
    camTravel.progress = 1;
    camTravel.active   = false;
  }

  const t = smoothstep(camTravel.progress);
  camera.position.lerpVectors(camTravel.fromPos,    camTravel.toPos,    t);
  controls.target.lerpVectors(camTravel.fromTarget, camTravel.toTarget, t);
  controls.update();
}

// ─────────────────────────────────────────────
// WASD / ARROW KEY FREE-FLY
// ─────────────────────────────────────────────
const keys = {};

window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Escape') flyToOverview();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

const _fwdDir   = new THREE.Vector3();
const _rightDir = new THREE.Vector3();
const _worldUp  = new THREE.Vector3(0, 1, 0);

function tickKeyboardFly(delta) {
  if (camTravel.active) return;

  const turbo = keys['ShiftLeft'] || keys['ShiftRight'];
  const speed = (turbo ? 12 : 4.5) * delta;

  camera.getWorldDirection(_fwdDir);
  _fwdDir.y = 0;
  if (_fwdDir.lengthSq() < 0.0001) _fwdDir.set(0, 0, -1);
  _fwdDir.normalize();

  _rightDir.crossVectors(_fwdDir, _worldUp).normalize();

  const fwd   = (keys['KeyW'] || keys['ArrowUp'])    ?  1 : (keys['KeyS'] || keys['ArrowDown'])  ? -1 : 0;
  const right = (keys['KeyD'] || keys['ArrowRight']) ?  1 : (keys['KeyA'] || keys['ArrowLeft'])  ? -1 : 0;
  const up    = (keys['KeyE'] || keys['PageUp'])      ?  1 : (keys['KeyQ'] || keys['PageDown'])   ? -1 : 0;

  if (fwd === 0 && right === 0 && up === 0) return;

  const move = new THREE.Vector3()
    .addScaledVector(_fwdDir,   fwd   * speed)
    .addScaledVector(_rightDir, right * speed)
    .addScaledVector(_worldUp,  up    * speed);

  camera.position.add(move);
  controls.target.add(move);
}

// ─────────────────────────────────────────────
// LIGHTING
// Note: useLegacyLights=false means physically correct lighting, so intensities
// are in real lumens — divided down from before
// ─────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x0d1f3c, 0.6));  // reduced — IBL handles ambient now

const dirLight = new THREE.DirectionalLight(0x7ab8f5, 0.5);  // reduced
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far  = 60;
scene.add(dirLight);

const fillLight = new THREE.PointLight(0x3a1a00, 0.4, 18);  // reduced
fillLight.position.set(0, -1, 2);
scene.add(fillLight);

const glowLight = new THREE.PointLight(0x1a5fff, 0.6, 35);  // reduced
glowLight.position.set(0, 8, 3);
scene.add(glowLight);

const rimLight = new THREE.DirectionalLight(0x4488ff, 0.25);  // reduced
rimLight.position.set(-8, 6, -6);
scene.add(rimLight);

// ─────────────────────────────────────────────
// BACKGROUND DEPTH PLANES
// ─────────────────────────────────────────────
[
  { z: -18, opacity: 0.18, color: 0x0b2a55, size: 80 },
  { z: -12, opacity: 0.22, color: 0x091e40, size: 60 },
  { z: -6,  opacity: 0.14, color: 0x061530, size: 40 },
].forEach(({ z, opacity, color, size }) => {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
  );
  mesh.position.set(0, 6, z);
  scene.add(mesh);
});

// ─────────────────────────────────────────────
// GROUND
// ─────────────────────────────────────────────
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ color: 0x060f24, roughness: 0.15, metalness: 0.7 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const mistMesh = new THREE.Mesh(
  new THREE.CircleGeometry(8, 64),
  new THREE.MeshBasicMaterial({ color: 0x1a3a7a, transparent: true, opacity: 0.18, depthWrite: false })
);
mistMesh.rotation.x = -Math.PI / 2;
mistMesh.position.y = 0.02;
scene.add(mistMesh);

// ─────────────────────────────────────────────
// PARTICLES
// ─────────────────────────────────────────────
const PARTICLE_COUNT    = 320;
const particleGeo       = new THREE.BufferGeometry();
const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
const particleSpeeds    = [];

for (let i = 0; i < PARTICLE_COUNT; i++) {
  particlePositions[i * 3]     = (Math.random() - 0.5) * 22;
  particlePositions[i * 3 + 1] = Math.random() * 14;
  particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 22;
  particleSpeeds.push(0.003 + Math.random() * 0.006);
}

particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

const particleMat = new THREE.PointsMaterial({
  color: 0x5599ff,
  size: 0.045,
  transparent: true,
  opacity: 0.55,
  sizeAttenuation: true,
  depthWrite: false,
});

scene.add(new THREE.Points(particleGeo, particleMat));

// ─────────────────────────────────────────────
// ORB MATERIALS
// ─────────────────────────────────────────────
const ORB_CORE_MAT = new THREE.MeshStandardMaterial({
  color: 0xaaddff,
  emissive: new THREE.Color(0x2255dd),
  emissiveIntensity: 1.2,
  roughness: 0.1,
  metalness: 0.3,
  transparent: true,
  opacity: 0.95,
  envMapIntensity: 0.6,   // orbs pick up subtle moonrise reflection
});

const ORB_RIM_MAT = new THREE.MeshStandardMaterial({
  color: 0x1133aa,
  emissive: new THREE.Color(0x0a2280),
  emissiveIntensity: 0.8,
  roughness: 0.0,
  metalness: 0.0,
  transparent: true,
  opacity: 0.35,
  side: THREE.BackSide,
});

const ORB_SELECTED_MAT = new THREE.MeshStandardMaterial({
  color: 0xffd97a,
  emissive: new THREE.Color(0xff8800),
  emissiveIntensity: 1.8,
  roughness: 0.05,
  metalness: 0.4,
  transparent: true,
  opacity: 0.98,
  envMapIntensity: 0.8,
});

// ─────────────────────────────────────────────
// LABEL SPRITE
// ─────────────────────────────────────────────
function createLabelSprite(text, personId) {
  const W = 320, H = 72;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const r = 22;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(W - r, 0);
  ctx.quadraticCurveTo(W, 0, W, r);
  ctx.lineTo(W, H - r);
  ctx.quadraticCurveTo(W, H, W - r, H);
  ctx.lineTo(r, H);
  ctx.quadraticCurveTo(0, H, 0, H - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, 'rgba(20,45,100,0.82)');
  bg.addColorStop(1, 'rgba(8,20,55,0.88)');
  ctx.fillStyle = bg;
  ctx.fill();

  ctx.strokeStyle = 'rgba(80,160,255,0.75)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.font = 'bold 26px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(80,160,255,0.9)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#e8f4ff';
  ctx.fillText(text, W / 2, H / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const sprite  = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  );
  sprite.scale.set(1.7, 0.38, 1);
  sprite.userData = { isLabel: true, personId };
  return sprite;
}

// ─────────────────────────────────────────────
// TENDRILS
// ─────────────────────────────────────────────
const tendrils = [];

function createTendril(startPos, endPos) {
  const mid = new THREE.Vector3().lerpVectors(startPos, endPos, 0.5);
  mid.x += (Math.random() - 0.5) * 0.4;
  mid.y += 0.3;

  const curve = new THREE.QuadraticBezierCurve3(startPos, mid, endPos);
  const geo   = new THREE.BufferGeometry().setFromPoints(curve.getPoints(28));
  const mat   = new THREE.LineBasicMaterial({
    color: 0x4488ff, transparent: true, opacity: 0.28, depthWrite: false,
  });
  return new THREE.Line(geo, mat);
}

// ─────────────────────────────────────────────
// FAMILY NODE
// ─────────────────────────────────────────────
const allOrbs = [];

function createFamilyNode({ name, id }) {
  const group = new THREE.Group();

  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.19, 32, 32), ORB_CORE_MAT.clone());
  orb.castShadow = true;
  group.add(orb);

  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.265, 32, 32), ORB_RIM_MAT.clone());
  group.add(halo);

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 128; glowCanvas.height = 128;
  const gc = glowCanvas.getContext('2d');
  const gr = gc.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0,   'rgba(60,120,255,0.55)');
  gr.addColorStop(0.4, 'rgba(30,80,200,0.20)');
  gr.addColorStop(1,   'rgba(10,30,100,0.00)');
  gc.fillStyle = gr;
  gc.fillRect(0, 0, 128, 128);

  const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowCanvas),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glowSprite.scale.set(0.9, 0.9, 1);
  group.add(glowSprite);

  allOrbs.push({ orb, halo, glowSprite, phase: Math.random() * Math.PI * 2 });

  const anchor = new THREE.Object3D();
  anchor.position.set(0, 0.28, 0);
  group.add(anchor);

  const label = createLabelSprite(name, id);
  label.position.set(0, 0.52, 0);
  group.add(label);

  group.userData = { id, name, anchor, orb, halo };
  return group;
}

// ─────────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────────
const loader = new GLTFLoader();

const trunkURL  = new URL('./assets/mybark.glb',  import.meta.url).href;
const branchURL = new URL('./assets/branch1.glb', import.meta.url).href;

let TRUNK_ANCHOR       = null;
let BRANCH_MODEL       = null;
let SELECTED_PERSON_ID = null;
let SELECTED_ORB_REF   = null;
const clock = new THREE.Clock();

// ─────────────────────────────────────────────
// LOAD BRANCH MODEL
// ─────────────────────────────────────────────
loader.load(branchURL, (gltf) => { BRANCH_MODEL = gltf.scene; });

// ─────────────────────────────────────────────
// BRANCH TIP ANCHOR
// ─────────────────────────────────────────────
function addBranchTipAnchor(branch) {
  let mesh = null;
  branch.traverse(obj => { if (obj.isMesh) mesh = obj; });
  if (!mesh) return null;

  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();

  const bbox     = mesh.geometry.boundingBox;
  const tipLocal = new THREE.Vector3(
    (bbox.min.x + bbox.max.x) / 2, bbox.max.y, (bbox.min.z + bbox.max.z) / 2
  );
  tipLocal.multiply(mesh.scale);

  const tipAnchor = new THREE.Object3D();
  tipAnchor.position.copy(tipLocal);
  mesh.add(tipAnchor);
  return tipAnchor;
}

// ─────────────────────────────────────────────
// RECURSIVE TREE BUILDER
// ─────────────────────────────────────────────
function buildTreeFromAPI(person, parentAnchor, depth = 0) {
  const node = createFamilyNode({ name: person.name, id: person.id });
  parentAnchor.add(node);

  if (depth > 0) {
    node.userData._needsTendril = true;
    node.userData._parentAnchor = parentAnchor;
  }

  if (!person.children_recursive?.length) return node;

  person.children_recursive.forEach((child, index) => {
    const branch = BRANCH_MODEL.clone(true);
    branch.scale.setScalar(0.8);
    branch.rotation.z = (index - (person.children_recursive.length - 1) / 2) * 0.35;

    branch.traverse(obj => {
      if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
    });

    node.userData.anchor.add(branch);
    const tipAnchor = addBranchTipAnchor(branch);
    if (tipAnchor) buildTreeFromAPI(child, tipAnchor, depth + 1);
  });

  return node;
}

// ─────────────────────────────────────────────
// TENDRIL PASS
// ─────────────────────────────────────────────
function buildTendrils() {
  tendrils.forEach(t => scene.remove(t));
  tendrils.length = 0;
  scene.updateMatrixWorld(true);

  scene.traverse(obj => {
    if (!obj.userData?._needsTendril) return;
    const nodePos   = new THREE.Vector3();
    const parentPos = new THREE.Vector3();
    obj.getWorldPosition(nodePos);
    obj.userData._parentAnchor.getWorldPosition(parentPos);
    const line = createTendril(parentPos, nodePos);
    scene.add(line);
    tendrils.push(line);
  });
}

// ─────────────────────────────────────────────
// LOAD TRUNK + FETCH TREE
// ─────────────────────────────────────────────
loader.load(trunkURL, (gltf) => {
  const trunk = gltf.scene;
  trunk.scale.set(1.5, 1.5, 1.5);

  trunk.traverse(obj => {
    if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
  });

  scene.add(trunk);
  trunk.updateWorldMatrix(true, true);

  const bbox     = new THREE.Box3().setFromObject(trunk);
  const topLocal = new THREE.Vector3(
    (bbox.min.x + bbox.max.x) / 2, bbox.max.y, (bbox.min.z + bbox.max.z) / 2
  );
  trunk.worldToLocal(topLocal);

  TRUNK_ANCHOR = new THREE.Object3D();
  TRUNK_ANCHOR.position.copy(topLocal);
  trunk.add(TRUNK_ANCHOR);

  const treeCenter = new THREE.Vector3(
    (bbox.min.x + bbox.max.x) / 2,
    (bbox.min.y + bbox.max.y) / 2,
    (bbox.min.z + bbox.max.z) / 2
  );
  OVERVIEW.target.copy(treeCenter);
  OVERVIEW.pos.copy(treeCenter).add(new THREE.Vector3(5, 5, 10));

  reloadTree();
});

// ─────────────────────────────────────────────
// TREE RELOAD
// ─────────────────────────────────────────────
function reloadTree() {
  allOrbs.length = 0;

  while (TRUNK_ANCHOR.children.length) {
    TRUNK_ANCHOR.remove(TRUNK_ANCHOR.children[0]);
  }

  fetch('http://127.0.0.1:8000/api/tree')
    .then(res => res.json())
    .then(data => {
      buildTreeFromAPI(data, TRUNK_ANCHOR);
      requestAnimationFrame(() => {
        buildTendrils();
        updateInfoPanel(null);
      });
    });
}

// ─────────────────────────────────────────────
// UI PANEL
// ─────────────────────────────────────────────
const panel         = document.getElementById('info-panel');
const panelName     = document.getElementById('panel-name');
const panelId       = document.getElementById('panel-id');
const panelRename   = document.getElementById('btn-rename');
const panelAddChild = document.getElementById('btn-add-child');
const panelDelete   = document.getElementById('btn-delete');
const panelFocus    = document.getElementById('btn-focus');

function updateInfoPanel(personData) {
  if (!personData) { panel.classList.remove('visible'); return; }
  panelName.textContent = personData.name;
  panelId.textContent   = `ID: ${personData.id}`;
  panel.classList.add('visible');
}

panelRename?.addEventListener('click', async () => {
  if (!SELECTED_PERSON_ID) return;
  const newName = prompt('Rename person:');
  if (!newName?.trim()) return;
  await fetch(`http://127.0.0.1:8000/api/people/${SELECTED_PERSON_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ name: newName.trim() })
  });
  reloadTree();
});

panelAddChild?.addEventListener('click', async () => {
  if (!SELECTED_PERSON_ID) return;
  const name = prompt('Child name?');
  if (!name) return;
  await fetch('http://127.0.0.1:8000/api/people', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ name, parent_id: SELECTED_PERSON_ID })
  });
  reloadTree();
});

panelDelete?.addEventListener('click', async () => {
  if (!SELECTED_PERSON_ID) return;
  if (!confirm('Delete this person and all their descendants?')) return;
  await fetch(`http://127.0.0.1:8000/api/people/${SELECTED_PERSON_ID}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
  });
  SELECTED_PERSON_ID = null;
  SELECTED_ORB_REF   = null;
  updateInfoPanel(null);
  reloadTree();
});

panelFocus?.addEventListener('click', () => {
  if (!SELECTED_ORB_REF?.orb) return;
  const worldPos = new THREE.Vector3();
  SELECTED_ORB_REF.orb.getWorldPosition(worldPos);
  flyTo(worldPos, 1.6);
});

// View Profile — navigate to dedicated profile page
const panelViewProfile = document.getElementById('btn-view-profile');
panelViewProfile?.addEventListener('click', () => {
  if (!SELECTED_PERSON_ID) return;
  window.location.href = `/person.html?id=${SELECTED_PERSON_ID}`;
});

// ─────────────────────────────────────────────
// CLICK / DOUBLE-CLICK RAYCASTING
// ─────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse     = new THREE.Vector2();

let lastClickTime = 0;
let lastClickedId = null;

window.addEventListener('click', async (e) => {
  if (e.target !== renderer.domElement) return;

  mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight)  * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(scene.children, true);

  for (const hit of hits) {
    let obj = hit.object;

    if (obj.userData?.isLabel) {
      const newName = prompt('Rename person:');
      if (!newName?.trim()) return;
      await fetch(`http://127.0.0.1:8000/api/people/${obj.userData.personId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ name: newName.trim() })
      });
      reloadTree();
      return;
    }

    while (obj && !obj.userData?.id) obj = obj.parent;

    if (obj?.userData?.id) {
      const now           = performance.now();
      const isDoubleClick = (now - lastClickTime < 350) && (lastClickedId === obj.userData.id);
      lastClickTime = now;
      lastClickedId = obj.userData.id;

      if (SELECTED_ORB_REF) SELECTED_ORB_REF.orb.material = ORB_CORE_MAT.clone();

      SELECTED_PERSON_ID = obj.userData.id;
      SELECTED_ORB_REF   = obj.userData;
      obj.userData.orb.material = ORB_SELECTED_MAT.clone();
      updateInfoPanel({ name: obj.userData.name, id: obj.userData.id });

      if (isDoubleClick) {
        const worldPos = new THREE.Vector3();
        obj.userData.orb.getWorldPosition(worldPos);
        flyTo(worldPos, 1.6);
      }
      return;
    }
  }

  if (SELECTED_ORB_REF) {
    SELECTED_ORB_REF.orb.material = ORB_CORE_MAT.clone();
    SELECTED_ORB_REF   = null;
    SELECTED_PERSON_ID = null;
    updateInfoPanel(null);
  }
});

// ─────────────────────────────────────────────
// RESIZE
// ─────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─────────────────────────────────────────────
// RENDER LOOP
// ─────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const t     = clock.getElapsedTime();

  tickCamTravel(delta);
  tickKeyboardFly(delta);

  allOrbs.forEach(({ orb, halo, glowSprite, phase }) => {
    orb.material.emissiveIntensity  = 0.85 + 0.35 * Math.sin(t * 1.4 + phase);
    halo.material.opacity           = 0.2  + 0.18 * Math.sin(t * 1.4 + phase + 0.5);
    glowSprite.material.opacity     = 0.75 + 0.28 * Math.sin(t * 1.4 + phase + 1.0);
  });

  tendrils.forEach((line, i) => {
    line.material.opacity = 0.18 + 0.12 * Math.sin(t * 0.9 + i * 0.7);
  });

  const pos = particleGeo.attributes.position;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    pos.array[i * 3 + 1] += particleSpeeds[i];
    if (pos.array[i * 3 + 1] > 14) pos.array[i * 3 + 1] = 0;
  }
  pos.needsUpdate = true;

  glowLight.position.x = Math.sin(t * 0.3) * 1.5;
  glowLight.position.z = 3 + Math.cos(t * 0.2) * 1.0;

  if (!camTravel.active) controls.update();

  renderer.render(scene, camera);
}
animate();