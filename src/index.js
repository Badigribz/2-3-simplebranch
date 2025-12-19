import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ─────────────────────────────────────────────
// BASIC SCENE SETUP
// ─────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(5, 5, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// ─────────────────────────────────────────────
// LABEL SPRITE (STAGE 6)
// ─────────────────────────────────────────────
function createLabelSprite(text) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = 256;
  canvas.height = 64;

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = "28px Arial";
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.4, 0.35, 1);

  return sprite;
}

// ─────────────────────────────────────────────
// INTERACTION (STAGE 5)
// ─────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const INTERACTIVE_NODES = [];
let SELECTED_NODE = null;

// ─────────────────────────────────────────────
// FAMILY NODE FACTORY (STAGE 4 → 7)
// ─────────────────────────────────────────────
function createFamilyNode({ name }) {
  const group = new THREE.Group();

  const orbMaterial = new THREE.MeshStandardMaterial({
    color: 0x88ccff,
    emissive: 0x3366ff,
    emissiveIntensity: 0.8,
    roughness: 0.25
  });

  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 20, 20),
    orbMaterial
  );

  const label = createLabelSprite(name);
  label.position.set(0, 0.45, 0);

  group.add(orb);
  group.add(label);

  const anchor = new THREE.Object3D();
  anchor.position.set(0, 0.25, 0);
  group.add(anchor);

  group.userData = {
    type: "family-node",
    name,
    orb,
    label,
    anchor
  };

  INTERACTIVE_NODES.push(orb);

  return group;
}

// ─────────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────────
const loader = new GLTFLoader();

const trunkURL = new URL('./assets/mybark.glb', import.meta.url).href;
const branchURL = new URL('./assets/branch.glb', import.meta.url).href;

let TRUNK_ANCHOR = null;
let BRANCH_MODEL = null;
let branchesAttached = false;

// ─────────────────────────────────────────────
// LOAD TRUNK
// ─────────────────────────────────────────────
loader.load(trunkURL, (gltf) => {
  const trunk = gltf.scene;
  trunk.scale.set(1.5, 1.5, 1.5);
  scene.add(trunk);

  trunk.updateWorldMatrix(true, true);

  const bbox = new THREE.Box3().setFromObject(trunk);
  const topLocal = new THREE.Vector3(
    (bbox.min.x + bbox.max.x) / 2,
    bbox.max.y,
    (bbox.min.z + bbox.max.z) / 2
  );

  trunk.worldToLocal(topLocal);

  TRUNK_ANCHOR = new THREE.Object3D();
  TRUNK_ANCHOR.position.copy(topLocal);
  trunk.add(TRUNK_ANCHOR);

  // 🌳 ROOT PERSON
  const rootPerson = createFamilyNode({ name: "Mother" });
  TRUNK_ANCHOR.add(rootPerson);

  const center = new THREE.Vector3();
  bbox.getCenter(center);
  controls.target.copy(center);
  controls.update();

  tryAttachBranches();
});

// ─────────────────────────────────────────────
// LOAD BRANCH TEMPLATE
// ─────────────────────────────────────────────
loader.load(branchURL, (gltf) => {
  BRANCH_MODEL = gltf.scene;
  tryAttachBranches();
});

// ─────────────────────────────────────────────
// ATTACH INITIAL BRANCHES
// ─────────────────────────────────────────────
function tryAttachBranches() {
  if (!TRUNK_ANCHOR || !BRANCH_MODEL || branchesAttached) return;
  branchesAttached = true;

  const angles = [-0.5, 0, 0.5];

  angles.forEach((angle, i) => {
    const branch = BRANCH_MODEL.clone(true);

    branch.scale.setScalar(0.9 + i * 0.1);
    branch.rotation.z = angle;
    branch.rotation.y = i * 0.8;

    TRUNK_ANCHOR.add(branch);
    addBranchTipAnchor(branch, `Child ${i + 1}`);
  });
}

// ─────────────────────────────────────────────
// BRANCH TIP + CHILD NODE
// ─────────────────────────────────────────────
function addBranchTipAnchor(branch, name = "Child") {
  let mesh = null;

  branch.traverse(obj => {
    if (obj.isMesh) mesh = obj;
  });

  if (!mesh) return;

  if (!mesh.geometry.boundingBox) {
    mesh.geometry.computeBoundingBox();
  }

  const bbox = mesh.geometry.boundingBox;
  const tipLocal = new THREE.Vector3(
    (bbox.min.x + bbox.max.x) / 2,
    bbox.max.y,
    (bbox.min.z + bbox.max.z) / 2
  );

  tipLocal.multiply(mesh.scale);

  const tipAnchor = new THREE.Object3D();
  tipAnchor.position.copy(tipLocal);

  const childNode = createFamilyNode({ name });
  tipAnchor.add(childNode);

  mesh.add(tipAnchor);
}

// ─────────────────────────────────────────────
// ADD CHILD TO SELECTED NODE
// ─────────────────────────────────────────────
function addChildToSelected(name = "New Child") {
  if (!SELECTED_NODE || !BRANCH_MODEL) return;

  const anchor = SELECTED_NODE.userData.anchor;
  if (!anchor) return;

  const branch = BRANCH_MODEL.clone(true);
  branch.scale.setScalar(0.8);
  branch.rotation.z = (Math.random() - 0.5);
  branch.rotation.y = Math.random() * Math.PI * 2;

  anchor.add(branch);
  addBranchTipAnchor(branch, name);
}

// ─────────────────────────────────────────────
// CLICK HANDLING
// ─────────────────────────────────────────────
window.addEventListener("pointerdown", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(INTERACTIVE_NODES, false);

  if (hits.length > 0) {
    selectNode(hits[0].object);
  } else {
    clearSelection();
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "n") {
    addChildToSelected("Child " + Math.floor(Math.random() * 100));
  }
});

function selectNode(orb) {
  if (SELECTED_NODE) {
    SELECTED_NODE.userData.orb.material.emissiveIntensity = 0.8;
    SELECTED_NODE.scale.set(1, 1, 1);
  }

  SELECTED_NODE = orb.parent;
  SELECTED_NODE.userData.orb.material.emissiveIntensity = 1.8;
  SELECTED_NODE.scale.set(1.3, 1.3, 1.3);

  console.log("🧬 Selected:", SELECTED_NODE.userData.name);
}

function clearSelection() {
  if (!SELECTED_NODE) return;

  SELECTED_NODE.userData.orb.material.emissiveIntensity = 0.8;
  SELECTED_NODE.scale.set(1, 1, 1);
  SELECTED_NODE = null;
}

// ─────────────────────────────────────────────
// RENDER LOOP
// ─────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
