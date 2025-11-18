import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 15);

const controls = new OrbitControls(camera, renderer.domElement);

// ----------------------------
// BRANCH DATA
// ----------------------------
let branchLength = 2;

// Start and end of branch
let start = new THREE.Vector3(0, 0, 0);
let end = new THREE.Vector3(0, branchLength, 0);

// Branch geometry (straight line)
let points = [start, end];
let branchGeometry = new THREE.BufferGeometry().setFromPoints(points);

let branchMaterial = new THREE.LineBasicMaterial({ color: 0x8b4513 }); // Brown branch color
let branch = new THREE.Line(branchGeometry, branchMaterial);
scene.add(branch);

// ----------------------------
// NODE (sphere at the end)
// ----------------------------
const nodeGeometry = new THREE.SphereGeometry(0.2, 16, 16);
const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const node = new THREE.Mesh(nodeGeometry, nodeMaterial);

node.position.copy(end);
scene.add(node);

// ----------------------------
// GROW FUNCTION
// ----------------------------
function growBranch(stepAmount = 1) {
  branchLength += stepAmount;

  // Update end point
  end = new THREE.Vector3(0, branchLength, 0);

  // Update line geometry
  let newPoints = [start, end];
  branch.geometry.setFromPoints(newPoints);

  // Move node
  node.position.copy(end);
}

// ----------------------------
// KEYBOARD INPUT
// ----------------------------
window.addEventListener("keydown", (e) => {
  if (e.key === "1") growBranch(1);
  if (e.key === "2") growBranch(2);
  if (e.key === "3") growBranch(3);
});

// ----------------------------
// ANIMATION LOOP
// ----------------------------
function animate() {
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
