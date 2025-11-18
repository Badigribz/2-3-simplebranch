// src/index.js
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

/*
  Family data (from you):
  Root: Zahra Rajab
  Children: Yunus, Mustafa, Elly
  Grandchildren:
    Yunus -> Nuriat, Zahra
    Mustafa -> Humail
    Elly -> none
*/
const familyMap = {
  "Zahra Rajab": ["Yunus Habib", "Mustafa Habib", "Elly Sirunya"],
  "Yunus Habib": ["Nuriat Habib", "Zahra Habib"],
  "Mustafa Habib": ["Humail Mustafa"],
  "Elly Sirunya": [],
  // grandchildren children are empty by default
  "Nuriat Habib": [],
  "Zahra Habib": [],
  "Humail Mustafa": []
};

// ----------------------------
// Basic Three.js setup
// ----------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
document.body.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.top = "0px";
labelRenderer.domElement.style.pointerEvents = "none";
document.body.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f4f8);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 6, 12);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2, 0);
controls.update();

// groups for safe cleanup
const branchGroup = new THREE.Group();
scene.add(branchGroup);

// ----------------------------
// Tree settings & initial branch
// ----------------------------
const MAX_GENERATIONS = 2;     // stop at second generation
const GROW_SPEED = 0.03;

let branches = [
  {
    // trunk (root)
    name: "Zahra Rajab",
    start: new THREE.Vector3(0, 0, 0),
    direction: new THREE.Vector3(0, 1, 0),
    length: 0.1,
    maxLength: 2.2,
    generation: 0,
    hasSplit: false
  }
];

// keep label objects to clear them each frame
let labelObjects = [];

// ----------------------------
// Helper: create children for a branch using familyMap
// returns an array of child branch objects
// ----------------------------
function createChildrenForBranch(parent) {
  const childrenNames = familyMap[parent.name] || [];
  const count = childrenNames.length;
  if (count === 0) return [];

  // spread angles across -45..45 deg (in radians)
  const span = Math.PI / 2; // 90deg total
  const startAngle = -span / 2;

  const children = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1); // normalized [0..1]
    const angle = startAngle + t * span;
    const dir = parent.direction.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), angle).normalize();

    const childName = childrenNames[i];
    children.push({
      name: childName,
      start: parent.start.clone().add(parent.direction.clone().multiplyScalar(parent.length)), // end point
      direction: dir,
      length: 0.08,
      maxLength: parent.maxLength * 0.7,
      generation: parent.generation + 1,
      hasSplit: false
    });
  }
  return children;
}

// ----------------------------
// Update branches: growth + split according to familyMap and MAX_GENERATIONS
// ----------------------------
function updateBranches() {
  const newBranches = [];

  for (let branch of branches) {
    // grow until near maxLength
    if (branch.length < branch.maxLength - 0.01) {
      branch.length = Math.min(branch.length + GROW_SPEED, branch.maxLength);
      continue;
    }

    // If already split or reached generation limit, do nothing further
    if (branch.hasSplit) continue;
    if (branch.generation >= MAX_GENERATIONS) continue;

    // mark as split so we only do this once
    branch.hasSplit = true;

    // create children if family map says so
    const children = createChildrenForBranch(branch);
    if (children.length > 0) {
      newBranches.push(...children);
    }
  }

  if (newBranches.length > 0) branches.push(...newBranches);
}

// ----------------------------
// Draw branches + nodes + labels
// we clear previous frame's branchGroup & labels safely
// ----------------------------
function drawBranchesAndLabels() {
  // clear branch meshes
  while (branchGroup.children.length) branchGroup.remove(branchGroup.children[0]);

  // remove old label DOM objects
  for (let lbl of labelObjects) {
    if (lbl.parent) lbl.parent.remove(lbl);
  }
  labelObjects = [];

  // draw each branch and its tip sphere + label
  for (let branch of branches) {
    const start = branch.start;
    const end = branch.start.clone().add(branch.direction.clone().multiplyScalar(branch.length));

    // line geometry
    const geom = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({ color: 0x8b4513, linewidth: 2 });
    const line = new THREE.Line(geom, mat);
    branchGroup.add(line);

    // node sphere at tip
    const sphereGeom = new THREE.SphereGeometry(0.12, 12, 12);
    const sphereMat = new THREE.MeshStandardMaterial({ color: 0xff6b6b, emissive: 0x220000, roughness: 0.7 });
    const sphere = new THREE.Mesh(sphereGeom, sphereMat);
    sphere.position.copy(end);
    branchGroup.add(sphere);

    // ---- label as HTML element via CSS2DObject ----
    const labelDiv = document.createElement("div");
    labelDiv.className = "label";
    labelDiv.textContent = branch.name || "Unnamed";
    // optional: show generation small
    // labelDiv.textContent += ` (g${branch.generation})`;

    const labelObj = new CSS2DObject(labelDiv);
    labelObj.position.copy(end);
    // add to scene (label renderer will handle overlay)
    scene.add(labelObj);
    labelObjects.push(labelObj);
  }
}

// ----------------------------
// Lighting (small, enough to see mesh shading)
 // ----------------------------
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(5, 10, 7);
scene.add(dir);

// ----------------------------
// Animation loop
// ----------------------------
function animate() {
  updateBranches();
  drawBranchesAndLabels();

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// ----------------------------
// Resize handling
// ----------------------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

// ----------------------------
// Small helper: camera reset (optional)
// ----------------------------
window.addEventListener("keydown", (e) => {
  if (e.key === "r") {
    camera.position.set(0, 6, 12);
    controls.target.set(0,2,0);
    controls.update();
  }
});
