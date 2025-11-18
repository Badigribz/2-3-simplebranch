import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// ----------------------------
// BASIC SETUP
// ----------------------------
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 5, 15);

const controls = new OrbitControls(camera, renderer.domElement);

// Group to store branches safely
const branchGroup = new THREE.Group();
scene.add(branchGroup);

// ----------------------------
// TREE SETTINGS
// ----------------------------
const MAX_GENERATIONS = 2;   // <<< STOP after 2 generations
const GROW_SPEED = 0.03;

// ----------------------------
// INITIAL BRANCH (GENERATION 0)
// ----------------------------
let branches = [
  {
    start: new THREE.Vector3(0, 0, 0),
    direction: new THREE.Vector3(0, 1, 0), // always straight up for trunk
    length: 0.1,
    maxLength: 2,
    generation: 0,
    hasSplit: false
  }
];

// ----------------------------
// UPDATE BRANCH LOGIC
// ----------------------------
function updateBranches() {
  let newBranches = [];

  branches.forEach(branch => {

    // Grow until target length
    if (branch.length < branch.maxLength - 0.01) {
      branch.length += GROW_SPEED;
      return;
    }

    // Stop if branch already split
    if (branch.hasSplit) return;

    // Stop if max generations reached
    if (branch.generation >= MAX_GENERATIONS) return;

    branch.hasSplit = true;

    // Compute end of the branch
    const endPoint = branch.start.clone().add(
      branch.direction.clone().multiplyScalar(branch.length)
    );

    // -------- Left Child --------
    newBranches.push({
      start: endPoint.clone(),
      direction: branch.direction
        .clone()
        .applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 4), // 45° left
      length: 0.1,
      maxLength: branch.maxLength * 0.7,
      generation: branch.generation + 1,
      hasSplit: false
    });

    // -------- Right Child --------
    newBranches.push({
      start: endPoint.clone(),
      direction: branch.direction
        .clone()
        .applyAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 4), // 45° right
      length: 0.1,
      maxLength: branch.maxLength * 0.7,
      generation: branch.generation + 1,
      hasSplit: false
    });
  });

  // Add new branches (only once)
  if (newBranches.length > 0) {
    branches.push(...newBranches);
  }
}

// ----------------------------
// DRAW BRANCHES
// ----------------------------
function drawBranches() {
  // Prevent memory leak
  while (branchGroup.children.length > 0) {
    branchGroup.remove(branchGroup.children[0]);
  }

  branches.forEach(branch => {
    const start = branch.start;
    const end = branch.start
      .clone()
      .add(branch.direction.clone().multiplyScalar(branch.length));

    // Branch line
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({ color: 0x8b4513 });
    const line = new THREE.Line(geo, mat);
    branchGroup.add(line);

    // Node
    const sphereGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.copy(end);
    branchGroup.add(sphere);
  });
}

// ----------------------------
// ANIMATION LOOP
// ----------------------------
function animate() {
  updateBranches();
  drawBranches();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
