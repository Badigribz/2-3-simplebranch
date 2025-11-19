// src/index.js
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

/* ---------------------------
  Family Data (your names)
--------------------------- */
const familyMap = {
  "Zahra Rajab": ["Yunus Habib", "Mustafa Habib", "Elly Sirunya"],
  "Yunus Habib": ["Nuriat Habib", "Zahra Habib"],
  "Mustafa Habib": ["Humail Mustafa"],
  "Elly Sirunya": [],
  "Nuriat Habib": [],
  "Zahra Habib": [],
  "Humail Mustafa": []
};

/* ---------------------------
  Setup renderer, scene, camera, label renderer
--------------------------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
document.body.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.id = "labels";
document.body.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 6, 14);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 2, 0);
controls.update();

/* lights */
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const dl = new THREE.DirectionalLight(0xffffff, 0.9);
dl.position.set(5, 10, 6);
scene.add(dl);

/* groups */
const branchGroup = new THREE.Group();
scene.add(branchGroup);

/* constants & state */
const MAX_GENERATIONS = 2;
const modes = ["A","B","C","D","E"];
let currentMode = "A";

/* keep arrays & label refs */
let branches = [];
let labelObjs = [];
let particles = []; // for mode C
let animStart = performance.now();

/* util easing */
const ease = t => 1 - Math.pow(1 - t, 3);

/* createBranch: unified factory (supports properties for different modes) */
function createBranch({ name, start, dir, maxLength, generation, style }) {
  // compute final end
  const finalEnd = start.clone().add(dir.clone().multiplyScalar(maxLength));
  // control for curves (used by B and D/E)
  const perp = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,0,1));
  if (perp.length() < 0.1) perp.set(1,0,0);
  perp.normalize();
  const bendFactor = (0.3 + Math.random()*0.4) * (1 - generation*0.2);
  const control = start.clone().lerp(finalEnd, 0.5).add(perp.multiplyScalar(maxLength * bendFactor));

  return {
    name: name || "Unnamed",
    start: start.clone(),
    dir: dir.clone().normalize(),
    maxLength,
    generation: generation || 0,
    progress: 0,        // 0..1
    createdAt: performance.now(),
    hasSplit: false,
    finalEnd,
    control
  };
}

/* initialize basic tree (root) */
function resetTree() {
  branches = [];
  labelObjs.forEach(l => { if (l.parent) l.parent.remove(l); if (l.element && l.element.parentNode) l.element.parentNode.removeChild(l.element); });
  labelObjs = [];
  particles.forEach(p => { if (p.sprite && p.sprite.parent) p.sprite.parent.remove(p.sprite); });
  particles = [];
  branchGroup.clear();

  // trunk
  branches.push(createBranch({
    name: "Zahra Rajab",
    start: new THREE.Vector3(0,0,0),
    dir: new THREE.Vector3(0,1,0),
    maxLength: 3.0,
    generation: 0
  }));
  animStart = performance.now();
}

/* spawn children by familyMap: spread across span */
function spawnChildren(parent) {
  const childNames = familyMap[parent.name] || [];
  if (childNames.length === 0) return [];
  const span = Math.PI/2;
  const count = childNames.length;
  const startAngle = -span/2;
  const kids = [];
  for (let i=0;i<count;i++){
    const t = count === 1 ? 0.5 : i/(count-1);
    const angle = startAngle + t*span;
    const dir = parent.dir.clone().applyAxisAngle(new THREE.Vector3(0,0,1), angle).normalize();
    const startPt = parent.finalEnd.clone();
    const len = Math.max(1.0, parent.maxLength*0.7 - Math.random()*0.3);
    kids.push(createBranch({ name: childNames[i], start: startPt, dir, maxLength: len, generation: parent.generation + 1 }));
  }
  return kids;
}

/* helpers: quadratic bezier */
function bezierPoint(p0,c,p2,t){
  const t1 = 1 - t;
  return new THREE.Vector3(
    t1*t1*p0.x + 2*t1*t*c.x + t*t*p2.x,
    t1*t1*p0.y + 2*t1*t*c.y + t*t*p2.y,
    t1*t1*p0.z + 2*t1*t*c.z + t*t*p2.z
  );
}

/* draw routine -- will adapt to mode inside */
function draw() {
  // clear branchGroup (dispose)
  while (branchGroup.children.length) {
    const o = branchGroup.children[0];
    branchGroup.remove(o);
    if (o.geometry) { try{o.geometry.dispose();}catch(e){} }
    if (o.material) { try{ Array.isArray(o.material)?o.material.forEach(m=>m.dispose()):o.material.dispose(); }catch(e){} }
  }
  // remove old labels
  labelObjs.forEach(lo => {
    if (lo.element && lo.element.parentNode) lo.element.parentNode.removeChild(lo.element);
    if (lo.parent) lo.parent.remove(lo);
  });
  labelObjs = [];

  // render according to mode
  for (const br of branches) {
    // compute points for drawing depending on mode:
    // - A: straight partial line from start -> start + dir*progress*maxLength
    // - B: curved partial bezier
    // - C: like A but with particle effects
    // - D: cinematic (curved with staged delays)
    // - E: combination (smooth + camera)
    let points = [];
    const prog = br.progress;
    if (currentMode === "A" || currentMode === "C") {
      const end = br.start.clone().add(br.dir.clone().multiplyScalar(br.maxLength * prog));
      points = [br.start, end];
    } else { // B D E curves
      const segs = Math.max(4, Math.floor(12 * Math.max(0.5, prog)));
      for (let i=0;i<=segs;i++){
        const t = (i/segs) * prog;
        points.push(bezierPoint(br.start, br.control, br.finalEnd, t));
      }
    }

    // line
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0x9b6f3b, linewidth: 2 });
    const line = new THREE.Line(geom, mat);
    branchGroup.add(line);

    // tip and node
    const tip = (points.length ? points[points.length-1] : br.start.clone());
    const scale = Math.min(1, ease(prog));
    const sphGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const sphMat = new THREE.MeshStandardMaterial({ color: 0xff7b7b, roughness:0.6, metalness:0.12 });
    const sph = new THREE.Mesh(sphGeo, sphMat);
    sph.position.copy(tip);
    sph.scale.setScalar(Math.max(0.001, scale));
    branchGroup.add(sph);

    // label
    const div = document.createElement("div");
    div.className = "label";
    div.textContent = br.name || "Unnamed";

    const labelObj = new CSS2DObject(div);

    // attach label to sphere node
    labelObj.position.set(0, 0.6, 0);  
    sph.add(labelObj);

    labelObjs.push(labelObj);

    // fade-in
    setTimeout(() => div.classList.add("visible"), 80 + Math.floor(prog * 250));

    // particle spawn for mode C
    if (currentMode === "C" && prog >= 1 && !br._particlesSpawned) {
      br._particlesSpawned = true;
      spawnParticlesAt(tip, br.name);
    }
  }

  // add particles (sprites)
  for (const p of particles) {
    if (p.sprite && !p.sprite.parent) branchGroup.add(p.sprite);
  }
}

/* spawn simple particles (small sprites) at tip for mode C */
function spawnParticlesAt(pos, name){
  const texCanvas = document.createElement("canvas");
  texCanvas.width = texCanvas.height = 64;
  const ctx = texCanvas.getContext("2d");
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath(); ctx.arc(32,32,10,0,Math.PI*2); ctx.fill();
  const tex = new THREE.CanvasTexture(texCanvas);

  for (let i=0;i<12;i++){
    const sprMat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.95 });
    const spr = new THREE.Sprite(sprMat);
    spr.scale.setScalar(0.25 + Math.random()*0.4);
    spr.position.copy(pos).add(new THREE.Vector3((Math.random()-0.5)*0.6, (Math.random()-0.2)*0.6, (Math.random()-0.5)*0.6));
    particles.push({ sprite: spr, born: performance.now(), life: 900 + Math.random()*600 });
  }
}

/* update loop: progress branches and handle splits, camera cinematic for D/E */
let last = performance.now();
let cameraTween = null;

function update(time){
  const dt = Math.min(60, time - last);
  last = time;

  // progress each branch depending on currentMode timing rules
  for (const br of branches) {
    if (br.progress >= 1) continue;
    // base speed
    let base = 0.0045 * (currentMode === "D" || currentMode === "E" ? 0.8 : 1.0); // D/E slightly quicker per-branch
    if (currentMode === "A") base *= 1.0;
    if (currentMode === "B") base *= 0.85;
    if (currentMode === "C") base *= 1.1;
    // increment
    br.progress = Math.min(1, br.progress + base * (dt/16));
  }

  // handle finished branches splitting (with scheduling & generation limit)
  for (const br of branches) {
    if (br.progress >= 1 && !br.hasSplit && br.generation < MAX_GENERATIONS) {
      br.hasSplit = true;
      // timing variations per mode:
      const delay = (currentMode === "D" || currentMode === "E") ? 350 : 180;
      setTimeout(()=>{
        const kids = spawnChildren(br);
        if (kids.length) {
          branches.push(...kids);
          // if cinematic, tween camera outward slightly
          if (currentMode === "D" || currentMode === "E") {
            const ext = computeExtents();
            cameraTween = { from: camera.position.clone(), to: new THREE.Vector3(ext.x*1.2, ext.y*0.9+5, ext.z*1.6+6), start: performance.now(), dur: 1000 };
          }
        }
      }, delay + Math.random()*80);
    }
  }

  // animate particles
  for (let i = particles.length -1; i>=0; i--) {
    const p = particles[i];
    const age = time - p.born;
    const life = p.life;
    if (age > life) {
      if (p.sprite.parent) p.sprite.parent.remove(p.sprite);
      particles.splice(i,1);
      continue;
    }
    // float upward, fade
    p.sprite.position.y += 0.0015 * (dt/16);
    p.sprite.material.opacity = 1 - (age / life);
  }

  // camera tween
  if (cameraTween) {
    const t = Math.min(1, (time - cameraTween.start) / cameraTween.dur);
    const et = ease(t);
    camera.position.lerpVectors(cameraTween.from, cameraTween.to, et);
    controls.update();
    if (t >= 1) cameraTween = null;
  }

  // draw & render
  draw();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);

  requestAnimationFrame(update);
}

/* compute extents for camera framing */
function computeExtents(){
  const pts = [];
  for (const b of branches) { pts.push(b.start.clone()); pts.push(b.finalEnd.clone()); }
  const box = new THREE.Box3().setFromPoints(pts);
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);
  return { x: Math.max(6, size.x), y: Math.max(4, size.y), z: Math.max(6, size.z), center };
}

/* UI: mode toggle and reset */
const btns = document.querySelectorAll(".ui button[data-mode]");
btns.forEach(b=>{
  b.addEventListener("click", ()=>{
    btns.forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    currentMode = b.dataset.mode;
    resetTree();
  });
});
document.getElementById("reset").addEventListener("click", ()=> resetTree());

/* keyboard reset camera */
window.addEventListener("keydown", (e)=>{
  if (e.key === "r") {
    camera.position.set(0,6,14);
    controls.target.set(0,2,0);
    controls.update();
  }
});

/* resize */
window.addEventListener("resize", ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

/* start */
resetTree();
requestAnimationFrame(update);
