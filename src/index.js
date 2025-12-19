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
// FAMILY NODE FACTORY (STAGE 6 CORE)
// ─────────────────────────────────────────────
function createFamilyNode({ name }) {
  const group = new THREE.Group();

  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 20, 20),
    new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      emissive: 0x3366ff,
      emissiveIntensity: 0.9,
      roughness: 0.25
    })
  );
  group.add(orb);

  // Anchor for children
  const anchor = new THREE.Object3D();
  anchor.position.set(0, 0.25, 0);
  group.add(anchor);

  // Label
  const label = createLabelSprite(name);
  label.position.set(0, 0.45, 0);
  group.add(label);

  group.userData = {
    name,
    anchor,
    orb,
    label
  };

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
let SELECTED_NODE = null;

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

  // ROOT PERSON
  const root = createFamilyNode({ name: "Mother" });
  TRUNK_ANCHOR.add(root);

  SELECTED_NODE = root;

  const center = new THREE.Vector3();
  bbox.getCenter(center);
  controls.target.copy(center);
  controls.update();
});

// ─────────────────────────────────────────────
// LOAD BRANCH TEMPLATE
// ─────────────────────────────────────────────
loader.load(branchURL, (gltf) => {
  BRANCH_MODEL = gltf.scene;
});

// ─────────────────────────────────────────────
// ADD CHILD (STAGE 7)
// ─────────────────────────────────────────────
function addChildToSelected(name = "Child") {
  if (!SELECTED_NODE || !BRANCH_MODEL) return;

  const parentAnchor = SELECTED_NODE.userData.anchor;
  if (!parentAnchor) return;

  const branch = BRANCH_MODEL.clone(true);
  branch.scale.setScalar(0.8);
  branch.rotation.z = (Math.random() - 0.5);
  branch.rotation.y = Math.random() * Math.PI * 2;

  parentAnchor.add(branch);

  addBranchTipAnchor(branch, name);
}

// ─────────────────────────────────────────────
// BRANCH TIP + PERSON
// ─────────────────────────────────────────────
function addBranchTipAnchor(branch, childName) {
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
  mesh.add(tipAnchor);

  const childNode = createFamilyNode({ name: childName });
  tipAnchor.add(childNode);

  return childNode;
}

// ─────────────────────────────────────────────
// SELECTION (CLICK)
// ─────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener("click", (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(scene.children, true);

  for (const hit of hits) {
    let obj = hit.object;
    while (obj && !obj.userData?.anchor) {
      obj = obj.parent;
    }
    if (obj?.userData?.anchor) {
      SELECTED_NODE = obj;
      break;
    }
  }
});

// ─────────────────────────────────────────────
// KEYBOARD — ADD CHILD
// ─────────────────────────────────────────────
window.addEventListener("keydown", (e) => {
  if (e.key === "n") {
    addChildToSelected("Child");
  }
});

// ─────────────────────────────────────────────
// RENDER LOOP
// ─────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
