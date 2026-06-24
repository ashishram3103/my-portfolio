import Lenis from "./vendor/lenis.mjs";
import * as THREE from "three";
import { EffectComposer } from "jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "jsm/postprocessing/UnrealBloomPass.js";

/* The "js" class disables the static no-script fallback in styles.css, so it
   must be added before anything below can throw. */
document.documentElement.classList.add("js");

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (a, b, amount) => a + (b - a) * amount;
const map = (value, inMin, inMax, outMin, outMax) =>
  outMin + (outMax - outMin) * clamp((value - inMin) / (inMax - inMin));
const easeOut = value => 1 - Math.pow(1 - clamp(value), 3);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouch = window.matchMedia("(pointer: coarse)").matches;
const forceNoWebGL = new URLSearchParams(window.location.search).has("no-webgl");

/* Loader */
const loader = document.getElementById("loader");
const loaderBar = document.getElementById("loader-bar");
const loaderCount = document.getElementById("loader-count");
const loaderStatus = document.getElementById("loader-status");
let loadTimer = 0;

if (loader && loaderBar && loaderCount && loaderStatus) {
  let loadValue = 0;
  loadTimer = window.setInterval(() => {
    if (!loader.isConnected) {
      // The inline failsafe in index.html removes the loader after 8s.
      window.clearInterval(loadTimer);
      return;
    }
    loadValue = Math.min(94, loadValue + Math.ceil(Math.random() * 8));
    loaderBar.style.transform = `scaleX(${loadValue / 100})`;
    loaderCount.textContent = String(loadValue).padStart(3, "0");
    if (loadValue > 55) loaderStatus.textContent = "SYNCHRONIZING";
  }, 90);
}

function finishLoader() {
  if (!loader || loader.dataset.finished === "true") return;
  loader.dataset.finished = "true";
  window.clearTimeout(window.__arcLoaderFailsafe);
  window.clearInterval(loadTimer);
  if (!loader.isConnected) return;
  if (typeof loader.animate !== "function") {
    loader.remove();
    return;
  }
  if (loaderBar) loaderBar.style.transform = "scaleX(1)";
  if (loaderCount) loaderCount.textContent = "100";
  if (loaderStatus) loaderStatus.textContent = "SYSTEM READY";
  const animation = loader.animate(
    [
      { clipPath: "inset(0 0 0 0)" },
      { clipPath: "inset(0 0 100% 0)" }
    ],
    { duration: reduceMotion ? 1 : 950, delay: 260, easing: "cubic-bezier(.77,0,.175,1)", fill: "forwards" }
  );
  animation.finished.then(
    () => { loader.remove(); document.documentElement.classList.add("is-loaded"); },
    () => { loader.remove(); document.documentElement.classList.add("is-loaded"); }
  );
}

if (document.readyState === "complete") finishLoader();
else window.addEventListener("load", finishLoader, { once: true });

/* Header clock */
const headerTime = document.getElementById("header-time");
if (headerTime) {
  try {
    const clockFormat = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "Asia/Kolkata"
    });
    const tick = () => {
      headerTime.textContent = `INDIA // ${clockFormat.format(new Date())}`;
    };
    tick();
    window.setInterval(tick, 30000);
  } catch {
    // Keep the static markup time if the time zone data is unavailable.
  }
}

/* Smooth scroll */
let lenis = null;
if (!reduceMotion) {
  try {
    lenis = new Lenis({
      lerp: 0.06,
      smoothWheel: true,
      wheelMultiplier: 0.8,
      touchMultiplier: 1.4,
      syncTouch: false,
      autoRaf: false
    });
  } catch (error) {
    console.warn("ARC/01 smooth scroll unavailable, using native scrolling.", error);
  }
}

/* Persistent scene */
const canvas = document.getElementById("performance-canvas");
let renderer;
let scene;
let camera;
let core;
let shell;
let wire;
let rings = [];
let stars;
let starPositions;
let webglReady = false;
let composer;
let torusGroup;
let torusFragments = [];
let torusRcMesh;
const torusHover = { point: new THREE.Vector3(), active: 0 };
const torusMouse = new THREE.Vector2(-999, -999);
const torusRaycaster = new THREE.Raycaster();
const _torusLocalHover = new THREE.Vector3();

function initWebGL() {
  if (!canvas || reduceMotion || forceNoWebGL) {
    document.body.classList.add("no-webgl");
    if (canvas) canvas.hidden = true;
    return;
  }
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1 : 1.1));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x080808, 0.05);
    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 8.6);

    // Post-processing — bloom rendered at half resolution for GPU savings
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth * 0.5, window.innerHeight * 0.5),
      0.75, 0.4, 0.25
    );
    composer.addPass(bloomPass);

    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    const redLight = new THREE.PointLight(0xff2a18, 34, 20, 1.6);
    redLight.position.set(4, 1.5, 4);
    const whiteLight = new THREE.PointLight(0xece8df, 20, 18, 1.8);
    whiteLight.position.set(-4, -2, 3);
    scene.add(ambient, redLight, whiteLight);

    core = new THREE.Group();
    scene.add(core);

    const geometry = new THREE.IcosahedronGeometry(1.42, isTouch ? 2 : 4);
    shell = new THREE.Mesh(
      geometry,
      new THREE.MeshPhysicalMaterial({
        color: 0x121212,
        metalness: 0.92,
        roughness: 0.18,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
        transparent: true,
        opacity: 0.82
      })
    );
    wire = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0xff2a18,
        wireframe: true,
        transparent: true,
        opacity: 0.28
      })
    );
    wire.scale.setScalar(1.025);
    core.add(shell, wire);

    [1.95, 2.35, 2.75].forEach((radius, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.008 + index * 0.004, 8, 160),
        new THREE.MeshBasicMaterial({
          color: index === 1 ? 0xece8df : 0xff2a18,
          transparent: true,
          opacity: 0.34 - index * 0.07
        })
      );
      ring.rotation.set(Math.PI * (0.18 + index * 0.18), index * 0.8, index * 0.4);
      core.add(ring);
      rings.push(ring);
    });

    const starCount = isTouch ? 350 : 1000;
    starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const radius = 4 + Math.random() * 13;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = radius * Math.cos(phi);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: 0xff3825,
        size: isTouch ? 0.018 : 0.024,
        transparent: true,
        opacity: 0.5,
        sizeAttenuation: true
      })
    );
    scene.add(stars);

    // Voronoi-fragmented torus
    const V_R = 3.2, V_r = 0.3, FRAG_SCALE = 12;

    const hash2 = (px, py) => {
      const a = Math.sin(px * 127.1 + py * 311.7) * 43758.5453;
      const b = Math.sin(px * 269.5 + py * 183.3) * 43758.5453;
      return [a - Math.floor(a), b - Math.floor(b)];
    };
    const cellSeed = (u, v) => {
      const nx = Math.floor(u * FRAG_SCALE), ny = Math.floor(v * FRAG_SCALE);
      const fx = u * FRAG_SCALE - nx, fy = v * FRAG_SCALE - ny;
      let md = Infinity, bx = nx, by = ny;
      for (let j = -2; j <= 2; j++) {
        for (let i = -2; i <= 2; i++) {
          const [ox, oy] = hash2(nx + i, ny + j);
          const dx = i + ox - fx, dy = j + oy - fy;
          const d = dx * dx + dy * dy;
          if (d < md) { md = d; bx = nx + i + ox; by = ny + j + oy; }
        }
      }
      return [bx / FRAG_SCALE, by / FRAG_SCALE];
    };

    torusGroup = new THREE.Group();
    torusGroup.rotation.set(Math.PI * 0.12, 0.3, 0.1);
    core.add(torusGroup);

    // Barycentric wireframe inner torus
    const baryGeo = (() => {
      const g = new THREE.TorusGeometry(V_R, V_r, 80, 80).toNonIndexed();
      const count = g.attributes.position.count;
      const bary = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 3) {
        bary[i*3]=1; bary[i*3+1]=0; bary[i*3+2]=0;
        bary[(i+1)*3]=0; bary[(i+1)*3+1]=1; bary[(i+1)*3+2]=0;
        bary[(i+2)*3]=0; bary[(i+2)*3+1]=0; bary[(i+2)*3+2]=1;
      }
      g.setAttribute("barycentric", new THREE.BufferAttribute(bary, 3));
      return g;
    })();
    const wireMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */`
        attribute vec3 barycentric;
        varying vec3 vBary;
        void main() {
          vBary = barycentric;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vBary;
        float wireMask(vec3 b, float t) {
          vec3 d = fwidth(b);
          vec3 a = smoothstep(vec3(0.0), d * t, b);
          return 1.0 - min(a.x, min(a.y, a.z));
        }
        void main() {
          float wf = wireMask(vBary, 1.6);
          vec3 col = mix(vec3(0.04, 0.0, 0.0), vec3(1.0, 0.16, 0.09), wf);
          col = mix(col, vec3(1.0, 0.75, 0.5) * 2.0, wf * 0.5);
          gl_FragColor = vec4(col, 1.0);
        }`,
      side: THREE.DoubleSide,
      extensions: { derivatives: true },
    });
    torusGroup.add(new THREE.Mesh(baryGeo, wireMat));

    // Voronoi fragment meshes (desktop only for performance)
    if (!isTouch) {
      const fragMat = new THREE.MeshStandardMaterial({ color: 0x150505, roughness: 0.82, metalness: 0.3, side: THREE.DoubleSide });
      const baseGeo = new THREE.TorusGeometry(V_R, V_r, 48, 64);
      const nonIndexed = baseGeo.toNonIndexed();
      baseGeo.dispose();
      const pos = nonIndexed.attributes.position.array;
      const nrm = nonIndexed.attributes.normal.array;
      const uvData = nonIndexed.attributes.uv.array;
      const tris = pos.length / 9;
      const cellMap = new Map();
      for (let t = 0; t < tris; t++) {
        const uc = (uvData[t*6] + uvData[t*6+2] + uvData[t*6+4]) / 3;
        const vc = (uvData[t*6+1] + uvData[t*6+3] + uvData[t*6+5]) / 3;
        const s = cellSeed(uc, vc);
        const k = `${s[0].toFixed(9)}_${s[1].toFixed(9)}`;
        if (!cellMap.has(k)) cellMap.set(k, { s, t: [] });
        cellMap.get(k).t.push(t);
      }
      const TWO_PI = Math.PI * 2;
      for (const { s: seed, t: triList } of cellMap.values()) {
        if (!triList.length) continue;
        const vc = triList.length * 3;
        const pArr = new Float32Array(vc * 3), nArr = new Float32Array(vc * 3), uvArr = new Float32Array(vc * 2);
        let vi = 0;
        for (const tri of triList) {
          for (let v = 0; v < 3; v++) {
            const sv = tri * 3 + v;
            pArr[vi*3]=pos[sv*3]; pArr[vi*3+1]=pos[sv*3+1]; pArr[vi*3+2]=pos[sv*3+2];
            nArr[vi*3]=nrm[sv*3]; nArr[vi*3+1]=nrm[sv*3+1]; nArr[vi*3+2]=nrm[sv*3+2];
            uvArr[vi*2]=uvData[sv*2]; uvArr[vi*2+1]=uvData[sv*2+1];
            vi++;
          }
        }
        const phi = seed[0] * TWO_PI, theta = seed[1] * TWO_PI;
        const cx = (V_R + V_r * Math.cos(theta)) * Math.cos(phi);
        const cy = (V_R + V_r * Math.cos(theta)) * Math.sin(phi);
        const cz = V_r * Math.sin(theta);
        const cellCenter = new THREE.Vector3(cx, cy, cz);
        const majorPt = new THREE.Vector3(V_R * Math.cos(phi), V_R * Math.sin(phi), 0);
        const cellNormal = cellCenter.clone().sub(majorPt).normalize();
        for (let i = 0; i < pArr.length; i += 3) {
          pArr[i]   = (pArr[i]   - cx) * 0.96;
          pArr[i+1] = (pArr[i+1] - cy) * 0.96;
          pArr[i+2] = (pArr[i+2] - cz) * 0.96;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pArr, 3));
        geo.setAttribute("normal",   new THREE.BufferAttribute(nArr, 3));
        geo.setAttribute("uv",       new THREE.BufferAttribute(uvArr, 2));
        const rnd = hash2(seed[0] * 137.53, seed[1] * 137.53);
        const up = Math.abs(cellNormal.z) < 0.9 ? new THREE.Vector3(0,0,1) : new THREE.Vector3(0,1,0);
        const tang  = new THREE.Vector3().crossVectors(cellNormal, up).normalize();
        const bitang = new THREE.Vector3().crossVectors(cellNormal, tang);
        const aa = rnd[0] * TWO_PI;
        const rotAxis = tang.clone().multiplyScalar(Math.cos(aa)).addScaledVector(bitang, Math.sin(aa)).normalize();
        const mesh = new THREE.Mesh(geo, fragMat);
        mesh.position.copy(cellCenter).addScaledVector(cellNormal, 0.015);
        mesh.userData = { cellCenter, cellNormal, rotAxis, maxAngle: 0.7 + rnd[1] * 0.9, lift: 0 };
        torusGroup.add(mesh);
        torusFragments.push(mesh);
      }
      nonIndexed.dispose();
      torusRcMesh = new THREE.Mesh(
        new THREE.TorusGeometry(V_R, V_r, 80, 80),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      torusGroup.add(torusRcMesh);
    }

    webglReady = true;
  } catch (error) {
    document.body.classList.add("no-webgl");
    canvas.hidden = true;
    console.warn("ARC/01 WebGL fallback active.", error);
  }
}
initWebGL();

/* Scroll chapters */
const chapterElements = [...document.querySelectorAll("[data-chapter]")];
const chapterState = [];
let totalScroll = 1;
let scrollY = 0;
let smoothVelocity = 0;
let lastY = window.scrollY;

function measure() {
  chapterState.length = 0;
  chapterElements.forEach((element, index) => {
    const top = element.offsetTop;
    const height = element.offsetHeight;
    const distance = Math.max(1, height - window.innerHeight);
    chapterState.push({ element, index, top, height, distance, progress: 0, lastWritten: -1, live: false });
  });
  totalScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  if (renderer && camera) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1 : 1.1));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    if (composer) {
      composer.setSize(window.innerWidth, window.innerHeight);
    }
  }
}

/* One preset per [data-chapter] section, in document order:
   entry, scan, method, coaching, recovery, arena, proof, network, membership. */
const presets = [
  { x: 2.7, y: 0, z: 0, scale: 1, camera: 8.6, ring: 1, opacity: .75 },
  { x: -2.4, y: .2, z: 0, scale: .7, camera: 7.2, ring: 1.35, opacity: .75 },
  { x: 0, y: 0, z: 0, scale: 1.18, camera: 6.4, ring: 1.9, opacity: .95 },
  { x: 2.8, y: -1.4, z: -1, scale: .55, camera: 7.8, ring: .7, opacity: .42 },
  { x: -2.4, y: .8, z: -1, scale: .75, camera: 6.9, ring: 1.3, opacity: .55 },
  { x: 0, y: 0, z: 1.3, scale: 1.45, camera: 5.6, ring: 2.4, opacity: .7 },
  { x: 2.3, y: 0, z: 0, scale: .62, camera: 7.5, ring: 1.1, opacity: .55 },
  { x: 0, y: 0, z: 0, scale: 1.1, camera: 6.4, ring: 2, opacity: .85 },
  { x: 0, y: 0, z: 0, scale: 1.1, camera: 6.4, ring: 2, opacity: .85 }
];

function getActiveChapter() {
  let best = null;
  let bestDistance = Infinity;
  const vh = window.innerHeight;
  const viewTop = scrollY;
  const viewBottom = scrollY + vh;
  // Only touch sections within ~1.5 viewports of what's on screen. Far-off
  // sections keep their last --p (frozen), so we never invalidate their style.
  const near = vh * 1.5;

  for (let i = 0; i < chapterState.length; i++) {
    const state = chapterState[i];
    const inRange = state.top - near < viewBottom && state.top + state.height + near > viewTop;

    if (inRange) {
      state.progress = clamp((scrollY - state.top) / state.distance);
      // Only write the CSS var when it actually changed at our precision.
      const rounded = Math.round(state.progress * 1000);
      if (rounded !== state.lastWritten) {
        state.element.style.setProperty("--p", (rounded / 1000).toFixed(3));
        state.lastWritten = rounded;
      }
      // Promote only the on-screen section to its own GPU layer.
      const onScreen = state.top < viewBottom && state.top + state.height > viewTop;
      if (onScreen !== state.live) {
        state.element.classList.toggle("is-live", onScreen);
        state.live = onScreen;
      }
    } else if (state.live) {
      state.element.classList.remove("is-live");
      state.live = false;
    }

    const centerDistance = Math.abs(scrollY + vh * .5 - (state.top + state.height * .5));
    if (centerDistance < bestDistance) {
      bestDistance = centerDistance;
      best = state;
    }
  }
  return best;
}

/* The 3D scene is only the centerpiece in the hero ("entry") and "method"
   chapters. Everywhere else it's a faint background, so we fade the canvas out
   and stop the heavy per-frame work (bloom pass, fragment loop, raycaster)
   entirely. sceneVisible drives a CSS opacity; sceneActive gates rendering. */
const SCENE_CHAPTERS = new Set(["method"]);
let sceneOpacity = 1;
let sceneActive = true;

function updateScene(active, time) {
  if (!webglReady || !active) return;

  const wantVisible = SCENE_CHAPTERS.has(active.element.id);
  const targetCanvasOpacity = wantVisible ? 1 : 0;
  const prevOpacity = sceneOpacity;
  sceneOpacity = lerp(sceneOpacity, targetCanvasOpacity, .12);
  if (Math.abs(sceneOpacity - targetCanvasOpacity) < .01) sceneOpacity = targetCanvasOpacity;

  // Once faded out, stop all scene work until we scroll back into a scene chapter.
  if (!wantVisible && sceneOpacity === 0) {
    if (sceneActive) {
      sceneActive = false;
      canvas.style.opacity = "0";
    }
    return;
  }
  sceneActive = true;
  // Only touch the DOM when the opacity actually changed.
  if (sceneOpacity !== prevOpacity) canvas.style.opacity = sceneOpacity.toFixed(3);

  const current = presets[Math.min(active.index, presets.length - 1)];
  const next = presets[Math.min(active.index + 1, presets.length - 1)];
  const blend = easeOut(active.progress);
  const targetX = lerp(current.x, next.x, blend);
  const targetY = lerp(current.y, next.y, blend);
  const targetZ = lerp(current.z, next.z, blend);
  const targetScale = lerp(current.scale, next.scale, blend);
  const targetCamera = lerp(current.camera, next.camera, blend);
  const targetRing = lerp(current.ring, next.ring, blend);
  const targetOpacity = lerp(current.opacity, next.opacity, blend);

  core.position.x = lerp(core.position.x, targetX, .045);
  core.position.y = lerp(core.position.y, targetY, .045);
  core.position.z = lerp(core.position.z, targetZ, .045);
  const pulse = 1 + Math.sin(time * .0013) * .025;
  const sceneScale = targetScale * pulse;
  core.scale.setScalar(lerp(core.scale.x, sceneScale, .045));
  core.rotation.x += .0015 + Math.abs(smoothVelocity) * .000015;
  core.rotation.y += .0022 + Math.abs(smoothVelocity) * .000025;
  camera.position.z = lerp(camera.position.z, targetCamera, .04);
  wire.material.opacity = targetOpacity * .45;
  shell.material.opacity = targetOpacity;
  shell.material.roughness = clamp(.14 + Math.abs(smoothVelocity) * .0003, .14, .48);

  rings.forEach((ring, index) => {
    ring.scale.setScalar(lerp(ring.scale.x, targetRing * (1 + index * .08), .04));
    ring.rotation.x += (index + 1) * .0008;
    ring.rotation.y -= (index + 1) * .001;
    ring.material.opacity = targetOpacity * (.42 - index * .07);
  });

  stars.rotation.y += .00025 + Math.abs(smoothVelocity) * .000003;
  stars.rotation.x = Math.sin(time * .00012) * .12;
  stars.material.opacity = clamp(.25 + Math.abs(smoothVelocity) * .002, .25, .8);

  // Voronoi torus — raycaster + per-fragment animation only run while the
  // sphere is the centerpiece (method chapter) and there's hover energy to
  // resolve. When idle, we skip ~169 quaternion updates and the raycast.
  if (torusGroup) {
    torusGroup.rotation.z += 0.0018;
    const torusInteractive = active.element.id === "method" && torusFragments.length && torusRcMesh;
    if (torusInteractive) {
      torusRaycaster.setFromCamera(torusMouse, camera);
      const hits = torusRaycaster.intersectObject(torusRcMesh);
      if (hits.length > 0) {
        torusGroup.worldToLocal(_torusLocalHover.copy(hits[0].point));
        torusHover.point.copy(_torusLocalHover);
        torusHover.active = Math.min(torusHover.active + 0.06, 1);
      } else {
        torusHover.active = Math.max(torusHover.active - 0.025, 0);
      }
    } else if (torusHover.active > 0) {
      // Let any lifted fragments settle back down when we leave the chapter.
      torusHover.active = Math.max(torusHover.active - 0.05, 0);
    }
    // Only walk the fragment array while something is actually lifted.
    if (torusFragments.length && torusHover.active > 0.001) {
      for (const frag of torusFragments) {
        const { cellCenter, cellNormal, rotAxis, maxAngle } = frag.userData;
        let target = 0;
        if (torusHover.active > 0.01) {
          const dist = cellCenter.distanceTo(torusHover.point);
          const t = clamp((dist - 0.35) / 0.35);
          target = (1 - t * t * (3 - 2 * t)) * torusHover.active;
        }
        const speed = target > frag.userData.lift ? 0.15 : 0.06;
        frag.userData.lift = lerp(frag.userData.lift, target, speed);
        const lv = frag.userData.lift;
        frag.position.copy(cellCenter).addScaledVector(cellNormal, 0.015 + lv * 0.25);
        frag.quaternion.setFromAxisAngle(rotAxis, lv * maxAngle);
      }
    }
  }

  composer.render();
}

/* Reveal elements: driven by IntersectionObserver instead of per-frame getBoundingClientRect */
const revealElements = [...document.querySelectorAll(".reveal, .manifesto__line, .gate__rings")];

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.setProperty("--reveal", "1");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

revealElements.forEach(el => revealObserver.observe(el));

const networkArcs = document.querySelector(".network__arcs");
if (networkArcs) {
  new IntersectionObserver(([e]) => { if (e.isIntersecting) networkArcs.classList.add("is-revealed"); }, { threshold: 0.15 }).observe(document.getElementById("network"));
}

function updateReveal() { /* no-op — driven by IntersectionObserver */ }

const metricValues = [...document.querySelectorAll("[data-metric]")];
const proofValues  = [...document.querySelectorAll("[data-proof]")];
const proofPips    = [...document.querySelectorAll(".proof__pip")];
const modeCards = [...document.querySelectorAll(".mode")];
const modeCurrent = document.getElementById("mode-current");
const recoveryValue = document.getElementById("recovery-value");

function updateMetrics(active) {
  if (!active) return;
  if (active.element.id === "scan") {
    metricValues.forEach(element => {
      const value = Number(element.dataset.metric);
      element.textContent = String(Math.round(value * easeOut(active.progress))).padStart(2, "0");
    });
  } else if (active.element.id === "method") {
    const modeIndex = Math.min(2, Math.floor(active.progress * 3));
    modeCards.forEach((element, index) => {
      const isActive = index === modeIndex;
      const wasPrev = index < modeIndex;
      element.classList.toggle("is-active",   isActive);
      element.classList.toggle("was-active",  wasPrev && !isActive);
    });
    if (modeCurrent) modeCurrent.textContent = String(modeIndex + 1).padStart(2, "0");
  } else if (active.element.id === "recovery") {
    if (recoveryValue) recoveryValue.textContent = `+${(active.progress * 18.7).toFixed(1)}`;
  } else if (active.element.id === "proof") {
    // On touch, the proof section is a horizontal scroll-snap carousel whose
    // counters are driven by the track-scroll handler below — skip the
    // vertical-scroll driver so the two don't fight (it would reset to 0).
    if (isTouch) return;
    // Each panel owns a slice of --p. Counter only runs within that panel's window.
    // Panel 0: 0.00→0.38, Panel 1: 0.38→0.68, Panel 2: 0.68→1.00
    const panelWindows = [[0.00, 0.30], [0.30, 0.65], [0.65, 1.00]];
    const panelIndex = active.progress < 0.30 ? 0 : active.progress < 0.65 ? 1 : 2;
    proofValues.forEach((element, i) => {
      const [start, end] = panelWindows[i] || panelWindows[2];
      const localP = map(active.progress, start, end, 0, 1);
      const target = Number(element.dataset.proof);
      const value = target * easeOut(clamp(localP));
      element.textContent = target < 1 ? value.toFixed(2) : String(Math.round(value));
    });
    proofPips.forEach((pip, i) => {
      pip.style.background = i === panelIndex ? "var(--red)" : "rgba(238,234,225,.2)";
      pip.style.width = i === panelIndex ? "40px" : "24px";
    });
  }
}

const pageProgress = document.getElementById("page-progress");
const pageProgressValue = document.getElementById("page-progress-value");
const siteHeader = document.getElementById("site-header");
let lastProgressPct = -1;

function frame(time) {
  if (lenis) lenis.raf(time);
  scrollY = window.scrollY;
  smoothVelocity = lerp(smoothVelocity, scrollY - lastY, .12);
  lastY = scrollY;

  const active = getActiveChapter();
  const progress = clamp(scrollY / totalScroll);
  if (pageProgress) pageProgress.style.transform = `scaleY(${progress})`;
  const pct = Math.round(progress * 100);
  if (pct !== lastProgressPct) {
    if (pageProgressValue) pageProgressValue.textContent = String(pct).padStart(3, "0");
    lastProgressPct = pct;
  }
  if (siteHeader) siteHeader.classList.toggle("is-scrolled", scrollY > 60);
  updateScene(active, time);
  updateReveal();
  updateMetrics(active);
  if (!isTouch && cursor) {
    cursorX = lerp(cursorX, cursorTargetX, .22);
    cursorY = lerp(cursorY, cursorTargetY, .22);
    cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0) translate(-50%, -50%)`;
    if (cursorRing) {
      ringX = lerp(ringX, cursorTargetX, .12);
      ringY = lerp(ringY, cursorTargetY, .12);
      cursorRing.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
    }
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

let resizeFrame = 0;
window.addEventListener("resize", () => {
  window.cancelAnimationFrame(resizeFrame);
  resizeFrame = window.requestAnimationFrame(measure);
}, { passive: true });
window.addEventListener("load", measure, { once: true });
if (document.fonts) document.fonts.ready.then(() => measure());
measure();

/* Navigation */
const menuToggle = document.querySelector(".menu-toggle");
const mobileMenu = document.getElementById("mobile-menu");

function closeMenu() {
  if (!menuToggle || !mobileMenu) return;
  menuToggle.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  mobileMenu.classList.remove("is-open");
  mobileMenu.setAttribute("aria-hidden", "true");
}

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener("click", () => {
    const open = !mobileMenu.classList.contains("is-open");
    menuToggle.classList.toggle("is-open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    mobileMenu.classList.toggle("is-open", open);
    mobileMenu.setAttribute("aria-hidden", String(!open));
  });
}

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener("click", event => {
    const href = anchor.getAttribute("href");
    if (!href || href === "#") return;
    const target = document.querySelector(href);
    if (!target) return;
    event.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.2 });
    else target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    closeMenu();
  });
});

/* Cursor and tactile cards — merged into main RAF loop via module-level state */
const cursor = document.getElementById("cursor");
const cursorRing = document.getElementById("cursor-ring");
let cursorX = innerWidth / 2, cursorY = innerHeight / 2;
let ringX = cursorX, ringY = cursorY;
let cursorTargetX = cursorX, cursorTargetY = cursorY;
if (!isTouch && cursor) {
  document.addEventListener("pointermove", event => {
    cursorTargetX = event.clientX;
    cursorTargetY = event.clientY;
  }, { passive: true });

  // HUD coordinate readout
  const hudReadout = document.getElementById("hud-readout");
  if (hudReadout) {
    document.addEventListener("pointermove", e => {
      const nx = ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3);
      const ny = (-(e.clientY / window.innerHeight) * 2 + 1).toFixed(3);
      hudReadout.innerHTML = `X: ${+nx >= 0 ? "+" : ""}${nx}<br>Y: ${+ny >= 0 ? "+" : ""}${ny}`;
    }, { passive: true });
  }

  document.querySelectorAll("button, a, .access-card").forEach(element => {
    element.addEventListener("mouseenter", () => cursor.classList.add("is-hover"));
    element.addEventListener("mouseleave", () => cursor.classList.remove("is-hover"));
  });
}

/* Torus raycaster mouse (module-level, works with cursor system) */
if (!isTouch) {
  document.addEventListener("pointermove", e => {
    torusMouse.x = (e.clientX / window.innerWidth)  *  2 - 1;
    torusMouse.y = (e.clientY / window.innerHeight)  * -2 + 1;
  }, { passive: true });
}

/* Section sidebar */
const sidebarDots = [...document.querySelectorAll(".section-sidebar__dot")];
if (sidebarDots.length) {
  const sidebarTargets = sidebarDots
    .map(d => document.getElementById(d.dataset.target))
    .filter(Boolean);
  const sidebarObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const idx = sidebarTargets.indexOf(entry.target);
        if (idx !== -1) sidebarDots.forEach((d, i) => d.classList.toggle("is-active", i === idx));
      }
    });
  }, { rootMargin: "-35% 0px -35% 0px", threshold: 0 });
  sidebarTargets.forEach(t => sidebarObs.observe(t));
  sidebarDots.forEach(dot => {
    dot.addEventListener("click", () => {
      const target = document.getElementById(dot.dataset.target);
      if (target) {
        if (lenis) lenis.scrollTo(target, { duration: 1.4 });
        else target.scrollIntoView({ behavior: "smooth" });
      }
    });
  });
}

/* Magnetic buttons â€” desktop only */
if (!isTouch) {
  document.querySelectorAll(".magnetic-button").forEach(btn => {
    btn.addEventListener("pointermove", e => {
      const r = btn.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width  - .5) * 28;
      const y = ((e.clientY - r.top)  / r.height - .5) * 16;
      btn.style.transform = `translate(${x}px, ${y}px)`;
    });
    btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
  });
}

/* Access cards */
const cardContainer = document.querySelector(".membership__cards");

if (isTouch && cardContainer) {
  /* ── Card data ── */
  const TIERS = [
    { idx: "A/01", tier: "FOUNDATION", title: "ARC<br>MEMBER",  desc: "Club access · quarterly assessment · performance dashboard", bg: "linear-gradient(145deg,#222,#080808 55%,#191919)", color: "#eeeae1" },
    { idx: "A/02", tier: "COACHED",    title: "ARC<br>PERFORM", desc: "Private coaching · live programming · recovery protocol",    bg: "linear-gradient(145deg,#302825,#130c0a 55%,#2a1510)",  color: "#eeeae1" },
    { idx: "A/03", tier: "INVITATION", title: "ARC<br>APEX",    desc: "Priority lab access · global network · elite performance",  bg: "linear-gradient(145deg,#b7b3ab,#5e5e5a 55%,#d5d0c7)", color: "#080808" },
  ];
  const N = TIERS.length;
  let activeIdx = 0;
  let autoTimer = null;
  let dragStartX = 0, dragStartT = 0, isDragging = false;
  let gyroRX = 0, gyroRY = 0;

  function mod(n, m) { return ((n % m) + m) % m; }

  /* ── Build card with two inner layers for true crossfade ── */
  function makeInner(t) {
    return `
      <div class="mc-inner">
        <span class="mc-index">${t.idx}</span>
        <div>
          <small class="mc-tier">${t.tier}</small>
          <h3 class="mc-title">${t.title}</h3>
        </div>
        <p class="mc-desc">${t.desc}</p>
        <button class="mc-cta" type="button" data-open-assessment>Request access — demo ↗</button>
      </div>`;
  }

  const card = document.createElement("div");
  card.className = "mc-card";
  card.innerHTML = `<div class="mc-bg"></div><div class="mc-shine"></div>` + makeInner(TIERS[0]);

  /* Peek cards — stacked behind the front card, never move */
  const peekBack = document.createElement("div");
  const peekMid  = document.createElement("div");
  peekBack.className = "mc-peek mc-peek--back";
  peekMid.className  = "mc-peek mc-peek--mid";
  cardContainer.appendChild(peekBack);
  cardContainer.appendChild(peekMid);
  cardContainer.appendChild(card);

  /* Dots */
  const dotsWrap = document.createElement("div");
  dotsWrap.className = "mc-dots";
  TIERS.forEach(() => { const d = document.createElement("div"); d.className = "mc-dot"; dotsWrap.appendChild(d); });
  cardContainer.after(dotsWrap);
  const dots = [...dotsWrap.querySelectorAll(".mc-dot")];

  const elBg    = card.querySelector(".mc-bg");
  const elShine = card.querySelector(".mc-shine");

  /* ── Apply gyro tilt ── */
  function applyTilt(rx, ry) {
    card.style.transform = `translateX(-50%) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    elShine.style.transform = `translateX(${(ry * 3.5).toFixed(1)}%) translateY(${(-rx * 3.5).toFixed(1)}%)`;
  }

  /* ── Update peek backgrounds ── */
  function updatePeeks() {
    peekBack.style.background = TIERS[mod(activeIdx - 1, N)].bg;
    peekMid.style.background  = TIERS[mod(activeIdx + 1, N)].bg;
  }

  /* ── True crossfade: two layers fade simultaneously ── */
  let transitioning = false;
  function goTo(idx) {
    if (transitioning) return;
    transitioning = true;
    activeIdx = mod(idx, N);
    const t = TIERS[activeIdx];

    const oldInner = card.querySelector(".mc-inner");
    if (!oldInner) { transitioning = false; return; }

    /* Build new layer */
    const newEl = document.createElement("div");
    newEl.className = "mc-inner";
    newEl.style.cssText = "position:absolute;inset:0;opacity:0;";
    newEl.innerHTML = `
      <span class="mc-index">${t.idx}</span>
      <div>
        <small class="mc-tier">${t.tier}</small>
        <h3 class="mc-title">${t.title}</h3>
      </div>
      <p class="mc-desc">${t.desc}</p>
      <button class="mc-cta" type="button" data-open-assessment>Request access — demo ↗</button>`;
    card.appendChild(newEl);


    /* swap bg */
    elBg.style.background = t.bg;
    card.style.color = t.color;
    dots.forEach((d, i) => d.classList.toggle("is-active", i === activeIdx));
    updatePeeks();

    /* double rAF so browser paints newEl at opacity:0 before transitioning */
    requestAnimationFrame(() => requestAnimationFrame(() => {
      newEl.style.transition = "opacity .55s ease";
      newEl.style.opacity = "1";
      oldInner.style.transition = "opacity .55s ease";
      oldInner.style.opacity = "0";
      setTimeout(() => {
        oldInner.remove();
        newEl.style.cssText = "";
        transitioning = false;
      }, 580);
    }));
  }

  function advance(dir = 1) { goTo(activeIdx + dir); }

  function startAuto() {
    stopAuto();
    autoTimer = setInterval(() => advance(1), 3500);
  }
  function stopAuto() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } }

  /* ── Gyroscope ── */
  if (window.DeviceOrientationEvent) {
    window.addEventListener("deviceorientation", e => {
      /* beta = front-back tilt, gamma = left-right tilt */
      const targetRX = Math.max(-18, Math.min(18, (e.beta  - 45) * 0.45));
      const targetRY = Math.max(-18, Math.min(18,  e.gamma        * 0.45));
      gyroRX += (targetRX - gyroRX) * 0.12;
      gyroRY += (targetRY - gyroRY) * 0.12;
      applyTilt(gyroRX, gyroRY);
    }, { passive: true });
  }

  /* ── Swipe ── */
  cardContainer.addEventListener("touchstart", e => {
    isDragging = true;
    dragStartX = e.touches[0].clientX;
    dragStartT = Date.now();
    stopAuto();
  }, { passive: true });

  cardContainer.addEventListener("touchend", e => {
    if (!isDragging) return;
    isDragging = false;
    const dx  = e.changedTouches[0].clientX - dragStartX;
    const dt  = Date.now() - dragStartT;
    const thr = window.innerWidth * 0.14;
    const flick = Math.abs(dx) > 28 && dt < 360;
    if      (dx < -thr || (flick && dx < 0)) advance(1);
    else if (dx >  thr || (flick && dx > 0)) advance(-1);
    startAuto();
  }, { passive: true });

  /* ── Init ── */
  const t0 = TIERS[0];
  elBg.style.background = t0.bg;
  card.style.color = t0.color;
  dots.forEach((d, i) => d.classList.toggle("is-active", i === 0));
  updatePeeks();
  startAuto();
} else {
  /* Desktop: click any card to toggle spread */
  document.querySelectorAll(".access-card").forEach(card => {
    card.addEventListener("click", () => {
      cardContainer && cardContainer.classList.toggle("is-spread");
    });
  });
}

/* Access card shine + 3D tilt */
document.querySelectorAll(".access-card").forEach(card => {
  card.addEventListener("pointermove", event => {
    const rect = card.getBoundingClientRect();
    const mx = (event.clientX - rect.left) / rect.width  - .5;
    const my = (event.clientY - rect.top)  / rect.height - .5;
    card.style.setProperty("--mx", mx.toFixed(2));
    card.style.setProperty("--my", my.toFixed(2));
    const inner = card.querySelector(".access-card__inner");
    if (inner) {
      inner.style.setProperty("--rx", (my * -14).toFixed(1) + "deg");
      inner.style.setProperty("--ry", (mx *  20).toFixed(1) + "deg");
    }
  });
  card.addEventListener("pointerleave", () => {
    const inner = card.querySelector(".access-card__inner");
    if (inner) {
      inner.style.setProperty("--rx", "0deg");
      inner.style.setProperty("--ry", "0deg");
    }
  });
});

/* Mobile proof carousel — counter + swipe hint */
if (isTouch) {
  const proofTrack = document.querySelector(".proof__track");
  if (proofTrack) {
    const panels = [...proofTrack.querySelectorAll(".proof__panel")];
    const counters = [...proofTrack.querySelectorAll("[data-proof]")];
    let counted = new Set();

    function countUp(el) {
      const target = Number(el.dataset.proof);
      const isDecimal = target < 1;
      const duration = 1200;
      const start = performance.now();
      function tick(now) {
        const t = easeOut(Math.min((now - start) / duration, 1));
        const val = target * t;
        el.textContent = isDecimal ? val.toFixed(2) : String(Math.round(val));
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    proofTrack.addEventListener("scroll", () => {
      const w = proofTrack.clientWidth;
      panels.forEach((panel, i) => {
        const panelLeft = panel.offsetLeft;
        const scrollLeft = proofTrack.scrollLeft;
        const visible = scrollLeft >= panelLeft - w * 0.5 && scrollLeft < panelLeft + w * 0.5;
        if (visible && !counted.has(i) && counters[i]) {
          counted.add(i);
          countUp(counters[i]);
        }
      });
    }, { passive: true });

    // Trigger first panel immediately when section enters view
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !counted.has(0) && counters[0]) {
        counted.add(0);
        countUp(counters[0]);
      }
    }, { threshold: 0.4 }).observe(proofTrack);
  }
}

/* Arena zones */
const zoneButtons = [...document.querySelectorAll(".arena__zones [data-zone]")];
zoneButtons.forEach(button => {
  button.addEventListener("click", () => {
    zoneButtons.forEach(other => {
      const selected = other === button;
      other.classList.toggle("is-selected", selected);
      other.setAttribute("aria-pressed", String(selected));
    });
  });
});

/* Assessment */
const assessment = document.getElementById("assessment");
const assessmentForm = document.getElementById("assessment-form");
const assessmentProgress = document.getElementById("assessment-progress");
const steps = [...document.querySelectorAll(".assessment-step")];
const result = document.getElementById("assessment-result");

if (assessment && assessmentForm && assessmentProgress && result && steps.length) {
  const answers = {};
  let currentStep = 1;
  let lastFocused = null;

  const showStep = step => {
    currentStep = clamp(step, 1, steps.length);
    let activeStep = null;
    steps.forEach(element => {
      const isActive = Number(element.dataset.step) === currentStep;
      element.classList.toggle("is-active", isActive);
      if (isActive) activeStep = element;
    });
    result.classList.remove("is-active");
    assessmentProgress.style.width = `${(currentStep / steps.length) * 100}%`;
    window.setTimeout(() => activeStep?.querySelector("button, input")?.focus(), 80);
  };

  const openAssessment = () => {
    lastFocused = document.activeElement;
    assessment.classList.add("is-open");
    assessment.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-locked");
    lenis?.stop();
    showStep(1);
  };

  const closeAssessment = () => {
    assessment.classList.remove("is-open");
    assessment.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-locked");
    lenis?.start();
    lastFocused?.focus();
  };

  document.querySelectorAll("[data-open-assessment]").forEach(button => button.addEventListener("click", openAssessment));
  /* delegation for dynamically injected [data-open-assessment] buttons (mc-card CTA) */
  document.addEventListener("click", e => { if (e.target.closest("[data-open-assessment]")) openAssessment(); });
  document.querySelectorAll("[data-close-assessment]").forEach(button => button.addEventListener("click", closeAssessment));
  document.querySelectorAll("[data-assessment-back]").forEach(button => button.addEventListener("click", () => showStep(currentStep - 1)));
  document.querySelectorAll("[data-answer]").forEach(button => {
    button.addEventListener("click", () => {
      answers[button.dataset.answer] = button.dataset.value;
      button.parentElement.querySelectorAll("button").forEach(option => option.classList.toggle("is-selected", option === button));
      // Advance from the step the button lives in, so rapid clicks on two
      // options cannot queue two advances and skip a step.
      const step = Number(button.closest(".assessment-step")?.dataset.step) || currentStep;
      window.setTimeout(() => showStep(step + 1), 180);
    });
  });

  assessmentForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!assessmentForm.reportValidity()) return;
    const profile = answers.format === "Integrated" ? "ARC APEX" : answers.format === "Coach-led" ? "ARC PERFORM" : "ARC MEMBER";
    document.getElementById("result-profile").textContent = profile;
    document.getElementById("result-goal").textContent = (answers.goal || "Build strength").replace("Perform at elite level", "Elite performance").toUpperCase();
    document.getElementById("result-frequency").textContent = (answers.frequency || "3 days").toUpperCase();
    document.getElementById("result-format").textContent = (answers.format || "Coach-led").toUpperCase();
    steps.forEach(step => step.classList.remove("is-active"));
    result.classList.add("is-active");
    assessmentProgress.style.width = "100%";
    result.querySelector("button")?.focus();
  });

  assessment.addEventListener("keydown", event => {
    if (event.key === "Escape") closeAssessment();
    if (event.key !== "Tab") return;
    const focusable = [...assessment.querySelectorAll("button:not([disabled]), input:not([disabled])")].filter(element => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}
