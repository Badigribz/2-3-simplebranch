// src/leaves.js  — copy/paste into your project, then call createLeaves(scene, camera, renderer)
import * as THREE from 'three';
import { InstancedMesh } from 'three';
import SimplexNoise from 'simplex-noise';

/*
  createLeaves(scene, options)
  - scene: THREE.Scene
  - options: { count, areaRadius, leafTextureURL, windStrength }
  returns: { instancedMesh, update(dt) }
*/
export function createLeaves(scene, options = {}) {
  const {
    count = 1200,
    areaRadius = 6,
    leafTextureURL = '/src/assets/leaf.png',
    windStrength = 1.0
  } = options;

  // simple leaf plane geometry (two-sided)
  const leafGeo = new THREE.PlaneGeometry(0.28, 0.48, 6, 6);

  // vertex shader to apply sway/displacement
  const vertexShader = `
    uniform float time;
    uniform float windStrength;
    uniform vec3 offset; // per-instance offset packed into attribute
    attribute vec3 instanceOffset;
    attribute float instanceScale;
    attribute float instanceRot;
    varying vec2 vUv;
    varying float vFog;

    // 2D pseudo-noise (if you want better noise, pass a texture)
    float hash(float n) { return fract(sin(n)*43758.5453); }
    float noise(vec2 x) {
      vec2 p = floor(x);
      vec2 f = fract(x);
      f = f*f*(3.0-2.0*f);
      float n = p.x + p.y*57.0;
      float res = mix(mix(hash(n+0.0), hash(n+1.0), f.x),
                      mix(hash(n+57.0), hash(n+58.0), f.x), f.y);
      return res;
    }

    void main() {
      vUv = uv;

      // instance transform: scale and rotation (z-axis)
      float s = instanceScale;
      float r = instanceRot;
      mat3 rot = mat3(
        cos(r), -sin(r), 0,
        sin(r),  cos(r), 0,
        0,       0,      1
      );
      vec3 pos = position * s;
      pos = rot * pos;

      // world position (before displacement)
      vec3 worldPos = instanceOffset + pos;

      // compute sway: depend on vertex's height and instance offset
      float swayBase = noise(vec2(instanceOffset.x*0.15 + time*0.2, instanceOffset.z*0.15));
      float sway = (swayBase - 0.5) * 2.0; // -1..1
      // make tip move more than base: use y (plane's local Y)
      float tipFactor = smoothstep(-0.25, 0.25, position.y*2.0);
      float angle = sway * 0.5 * windStrength * tipFactor;

      // Apply small bending by rotating around local X
      float bend = angle * (1.0 - position.y*0.5);
      float c = cos(bend), si = sin(bend);
      mat3 bendRot = mat3(
        1.0, 0.0,  0.0,
        0.0, c,   -si,
        0.0, si,   c
      );
      worldPos = instanceOffset + bendRot * (rot * (position * s));

      // gl_Position
      vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // fog factor for later (optional)
      vFog = 1.0 - smoothstep(6.0, 12.0, length(mvPosition.xyz));
    }
  `;

  const fragmentShader = `
    uniform sampler2D map;
    varying vec2 vUv;
    varying float vFog;
    void main() {
      vec4 c = texture2D(map, vUv);
      if (c.a < 0.1) discard;
      gl_FragColor = c;
      // slight ambient darkening
      gl_FragColor.rgb *= mix(0.9, 1.0, vFog);
    }
  `;

  // texture
  const loader = new THREE.TextureLoader();
  const leafMap = loader.load(leafTextureURL);
  leafMap.encoding = THREE.sRGBEncoding;
  leafMap.flipY = false;

  const uniforms = {
    time: { value: 0 },
    windStrength: { value: windStrength },
    map: { value: leafMap }
  };

  const shaderMat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  // InstancedMesh
  const mesh = new InstancedMesh(leafGeo, shaderMat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // We'll add per-instance attributes: offset (vec3), scale (float), rot (float)
  const instanceOffset = new Float32Array(count * 3);
  const instanceScale = new Float32Array(count);
  const instanceRot = new Float32Array(count);

  // random placement around center, biased toward y-levels where leaves attach
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * areaRadius;
    const x = Math.cos(theta) * r + (Math.random() - 0.5) * 0.6;
    const z = Math.sin(theta) * r + (Math.random() - 0.5) * 0.6;
    const y = 0.6 + Math.random() * 3.6; // spread vertically around branches
    instanceOffset[i*3+0] = x;
    instanceOffset[i*3+1] = y;
    instanceOffset[i*3+2] = z;

    instanceScale[i] = 0.6 + Math.random() * 0.9;
    instanceRot[i] = Math.random() * Math.PI * 2;
  }

  mesh.geometry.setAttribute('instanceOffset', new THREE.InstancedBufferAttribute(instanceOffset, 3));
  mesh.geometry.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(instanceScale, 1));
  mesh.geometry.setAttribute('instanceRot', new THREE.InstancedBufferAttribute(instanceRot, 1));

  mesh.frustumCulled = false; // rely on instance culling later (optional)
  scene.add(mesh);

  // update function
  const update = (dt, t) => {
    uniforms.time.value = t * 0.001;
    // optionally vary windStrength over time
    // uniforms.windStrength.value = windStrength + Math.sin(t*0.0006)*0.3;
  };

  return { instancedMesh: mesh, update };
}
