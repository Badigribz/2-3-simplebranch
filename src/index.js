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

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// ─────────────────────────────────────────────
// GLOBAL STATE (IMPORTANT)
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
  console.log("🌳 Trunk loaded");

  const trunk = gltf.scene;
  trunk.scale.set(1.5, 1.5, 1.5);
  trunk.position.set(0, 0, 0);
  scene.add(trunk);

  // Ensure transforms are updated
  trunk.updateWorldMatrix(true, true);

  // Compute bounding box
  const bbox = new THREE.Box3().setFromObject(trunk);

  // World-space top center
  const topWorld = new THREE.Vector3(
    (bbox.min.x + bbox.max.x) / 2,
    bbox.max.y,
    (bbox.min.z + bbox.max.z) / 2
  );

  // Convert WORLD → LOCAL
  trunk.worldToLocal(topWorld);

  // Create anchor
  const trunkAnchor = new THREE.Object3D();
  trunkAnchor.position.copy(topWorld);

  // Debug anchor sphere (RED)
  const anchorSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  );
  trunkAnchor.add(anchorSphere);

  trunk.add(trunkAnchor);

  // Save globally
  TRUNK = trunk;
  TRUNK_ANCHOR = trunkAnchor;

  // Controls focus
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  controls.target.copy(center);
  controls.update();

  console.log("✅ Trunk anchor correctly placed");

  tryAttachBranches();
});

// ─────────────────────────────────────────────
// LOAD BRANCH TEMPLATE (ONCE)
// ─────────────────────────────────────────────
loader.load(branchURL, (gltf) => {
  BRANCH_MODEL = gltf.scene;
  console.log("🌿 Branch template ready");

  tryAttachBranches();
});

// ─────────────────────────────────────────────
// ATTACH BRANCHES (SAFE + DETERMINISTIC)
// ─────────────────────────────────────────────
function tryAttachBranches() {
  if (!TRUNK_ANCHOR || !BRANCH_MODEL) return;
  if (branchesAttached) return;

  branchesAttached = true;

  const angles = [-0.5, 0, 0.5];

  angles.forEach((angle, i) => {
    const branch = BRANCH_MODEL.clone(true);

    branch.scale.setScalar(0.9 + i * 0.1);
    branch.rotation.z = angle;
    branch.rotation.y = i * 0.8;
    branch.position.set(0, 0, 0);

    TRUNK_ANCHOR.add(branch);
  });

  console.log("🌳 Branches attached cleanly");
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
