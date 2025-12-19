import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ─────────────────────────────────────────────
// BASIC SCENE SETUP
// ─────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
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

  // 🔴 debug
  trunkAnchor.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  ));

  trunk.add(trunkAnchor);

  TRUNK = trunk;
  TRUNK_ANCHOR = trunkAnchor;

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

    // ✅ Correct tip anchor
    branch.userData.tipAnchor = addBranchTipAnchor(branch);
  });
}

// ─────────────────────────────────────────────
// ✅ STAGE 3 – CORRECT BRANCH TIP ANCHOR
// ─────────────────────────────────────────────
function addBranchTipAnchor(branch) {
  let mesh = null;

  branch.traverse(child => {
    if (child.isMesh) mesh = child;
  });

  if (!mesh) return null;

  // ✅ Ensure geometry bbox exists
  if (!mesh.geometry.boundingBox) {
    mesh.geometry.computeBoundingBox();
  }

  const bbox = mesh.geometry.boundingBox;

  // ✅ Tip in LOCAL GEOMETRY space
  const tipLocal = new THREE.Vector3(
    (bbox.min.x + bbox.max.x) / 2,
    bbox.max.y,
    (bbox.min.z + bbox.max.z) / 2
  );

  // ⚠️ IMPORTANT: account for mesh scale
  tipLocal.multiply(mesh.scale);

  const tipAnchor = new THREE.Object3D();
  tipAnchor.position.copy(tipLocal);

  // 🔴 debug orb
  const debugSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  );
  tipAnchor.add(debugSphere);

  mesh.add(tipAnchor); // 👈 parent to MESH, not branch

  return tipAnchor;
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
