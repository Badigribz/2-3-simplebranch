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
camera.position.set(5, 5, 10);

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
// INTERACTION (STAGE 5)
// ─────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const INTERACTIVE_NODES = [];
let SELECTED_NODE = null;

// ─────────────────────────────────────────────
// FAMILY NODE FACTORY (STAGE 4 → 5)
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

  group.add(orb);

  // Anchor for children (future generations)
  const anchor = new THREE.Object3D();
  anchor.position.set(0, 0.25, 0);
  group.add(anchor);

  // Metadata
  group.userData = {
    type: "family-node",
    name,
    anchor,
    orb
  };

  INTERACTIVE_NODES.push(orb); // 👈 clickable surface

  return group;
}

// ─────────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────────
const loader = new GLTFLoader();

const trunkURL = new URL('./assets/mybark.glb', import.meta.url).href;
const branchURL = new URL('./assets/branch.glb', import.meta.url).href;

let TRUNK = null;
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

  const trunkAnchor = new THREE.Object3D();
  trunkAnchor.position.copy(topLocal);
  trunk.add(trunkAnchor);

  // 🌳 ROOT PERSON (MOTHER)
  const rootPerson = createFamilyNode({ name: "Mother" });
  trunkAnchor.add(rootPerson);

  TRUNK = trunk;
  TRUNK_ANCHOR = trunkAnchor;
  window.ROOT_PERSON = rootPerson;

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
// ATTACH BRANCHES
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

    addBranchTipAnchor(branch);
  });
}

// ─────────────────────────────────────────────
// STAGE 3 + 4 – BRANCH TIP + CHILD NODE
// ─────────────────────────────────────────────
function addBranchTipAnchor(branch) {
  let mesh = null;

  branch.traverse(child => {
    if (child.isMesh) mesh = child;
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

  // 👶 CHILD PERSON NODE
  const childNode = createFamilyNode({ name: "Child" });
  tipAnchor.add(childNode);

  mesh.add(tipAnchor);
}

// ─────────────────────────────────────────────
// CLICK HANDLING (STAGE 5)
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

function selectNode(orb) {
  if (SELECTED_NODE) {
    SELECTED_NODE.material.emissiveIntensity = 0.8;
    SELECTED_NODE.scale.set(1, 1, 1);
  }

  SELECTED_NODE = orb;
  orb.material.emissiveIntensity = 1.8;
  orb.scale.set(1.3, 1.3, 1.3);

  console.log("🧬 Selected:", orb.parent.userData.name);
}

function clearSelection() {
  if (!SELECTED_NODE) return;

  SELECTED_NODE.material.emissiveIntensity = 0.8;
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
