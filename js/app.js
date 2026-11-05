import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ------------------------------------------------------------------
   PDF.js setup
------------------------------------------------------------------ */
const pdfjsReady = typeof window.pdfjsLib !== 'undefined';
if (pdfjsReady) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/* ------------------------------------------------------------------
   Renderer / Scene / Camera
------------------------------------------------------------------ */
// Estimate device capability so weaker phones and older computers get a lighter preview.
const lowEndDevice = (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
  (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
const renderer = new THREE.WebGLRenderer({ antialias: !lowEndDevice });
// Keep the live preview crisp; applySize upgrades this to the selected
// recording dimensions when the viewport is smaller than the output.
const PREVIEW_PIXEL_RATIO = Math.min(window.devicePixelRatio || 1, lowEndDevice ? 1.15 : 1.5);
// Recording renders at the exact requested output dimensions. A 1:1 drawing
// buffer avoids browser resampling while keeping the same renderer, lighting,
// tone mapping, colour space, shadows, and anti-aliasing as the live preview.
const RECORD_PIXEL_RATIO = 1;
renderer.setPixelRatio(PREVIEW_PIXEL_RATIO);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e1d6);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 60);
camera.position.set(0.3, 1.8, 2.7);
scene.add(camera); // so overlays (fade / caption) attached to the camera render

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.85, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.4;
controls.maxDistance = 4.6;
controls.maxPolarAngle = 1.45;
controls.update();
let controlsBusyUntil = 0;
controls.addEventListener('change', () => { controlsBusyUntil = performance.now() + 350; });

const MAX_ANISO = Math.min(renderer.capabilities.getMaxAnisotropy(), lowEndDevice ? 3 : 6);

/* ------------------------------------------------------------------
   Helpers
------------------------------------------------------------------ */
function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = MAX_ANISO;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = THREE.MathUtils.clamp;
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/* ------------------------------------------------------------------
   Procedural textures
------------------------------------------------------------------ */
const floorTex = canvasTexture(1024, 1024, (g, w, h) => {
  const rows = 8, ph = h / rows;
  for (let r = 0; r < rows; r++) {
    let x = -Math.random() * 250;
    while (x < w) {
      const len = 260 + Math.random() * 320;
      const l = 30 + Math.random() * 12;
      g.fillStyle = `hsl(${26 + Math.random() * 6},${40 + Math.random() * 10}%,${l}%)`;
      g.fillRect(x, r * ph, len, ph);
      for (let i = 0; i < 16; i++) {
        g.strokeStyle = `rgba(45,22,8,${0.05 + Math.random() * 0.12})`;
        g.lineWidth = 0.8 + Math.random() * 2;
        const y = r * ph + Math.random() * ph;
        g.beginPath();
        g.moveTo(x, y);
        g.bezierCurveTo(x + len * 0.3, y + (Math.random() - 0.5) * 10,
                        x + len * 0.7, y + (Math.random() - 0.5) * 10, x + len, y);
        g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x, r * ph, 2, ph);
      x += len;
    }
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(0, r * ph, w, 2);
  }
}, [3, 2.4]);

const tableWoodTex = canvasTexture(1024, 512, (g, w, h) => {
  g.fillStyle = '#8a5a36';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) {
    g.strokeStyle = `rgba(${50 + Math.random() * 40},${25 + Math.random() * 20},10,${0.08 + Math.random() * 0.18})`;
    g.lineWidth = 0.6 + Math.random() * 2.5;
    const y = Math.random() * h;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 6 + (Math.random() - 0.5) * 3);
    g.stroke();
  }
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, 'rgba(255,220,180,0.06)');
  grd.addColorStop(1, 'rgba(0,0,0,0.08)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});

const plasterTex = canvasTexture(512, 512, (g, w, h) => {
  g.fillStyle = '#efe5d8';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) {
    const v = Math.random() > 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.035})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
}, [4, 2]);

const skyTex = canvasTexture(512, 340, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#8fc3ec');
  grd.addColorStop(0.7, '#cfe6f5');
  grd.addColorStop(1, '#f5efe0');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  const sun = g.createRadialGradient(w * 0.25, h * 0.3, 5, w * 0.25, h * 0.3, 160);
  sun.addColorStop(0, 'rgba(255,250,225,1)');
  sun.addColorStop(1, 'rgba(255,250,225,0)');
  g.fillStyle = sun; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i++) {
    const cx = Math.random() * w, cy = h * 0.15 + Math.random() * h * 0.45, r = 25 + Math.random() * 45;
    const cg = g.createRadialGradient(cx, cy, 2, cx, cy, r);
    cg.addColorStop(0, 'rgba(255,255,255,0.75)');
    cg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = cg; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  g.fillStyle = '#9fbf8f';
  g.beginPath(); g.moveTo(0, h);
  for (let x = 0; x <= w; x += 20) g.lineTo(x, h * 0.86 - Math.sin(x * 0.02) * 12 - Math.random() * 6);
  g.lineTo(w, h); g.fill();
});

const starsTex = canvasTexture(512, 340, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`;
    const r = Math.random() < 0.1 ? 1.8 : 1;
    g.fillRect(Math.random() * w, Math.random() * h * 0.78, r, r);
  }
  g.fillStyle = 'rgba(255,250,230,0.95)';
  g.beginPath(); g.arc(w * 0.78, h * 0.22, 14, 0, Math.PI * 2); g.fill();
});

const rugTex = canvasTexture(1024, 640, (g, w, h) => {
  g.fillStyle = '#b9a184'; g.fillRect(0, 0, w, h);
  const bands = [['#8e5a3e', 18], ['#e8dcc8', 36], ['#5f6f60', 52], ['#e8dcc8', 66]];
  bands.forEach(([c, m]) => { g.strokeStyle = c; g.lineWidth = 8; g.strokeRect(m, m, w - m * 2, h - m * 2); });
  g.fillStyle = '#cdb698'; g.fillRect(90, 90, w - 180, h - 180);
  for (let x = 140; x < w - 120; x += 90) {
    for (let y = 140; y < h - 120; y += 90) {
      g.save(); g.translate(x, y); g.rotate(Math.PI / 4);
      g.strokeStyle = (x + y) % 180 === 0 ? '#8e5a3e' : '#5f6f60';
      g.lineWidth = 5; g.strokeRect(-18, -18, 36, 36);
      g.restore();
    }
  }
  for (let i = 0; i < 20000; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
});

function artTexture(variant) {
  return canvasTexture(512, 640, (g, w, h) => {
    if (variant === 0) {
      g.fillStyle = '#efe4d2'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c8693a'; g.beginPath(); g.arc(w * 0.38, h * 0.38, 120, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5f7f6a'; g.beginPath(); g.arc(w * 0.62, h * 0.62, 150, Math.PI, Math.PI * 2); g.fill();
      g.fillStyle = '#26384f'; g.fillRect(w * 0.18, h * 0.7, w * 0.64, 14);
      g.strokeStyle = '#d9a35b'; g.lineWidth = 10;
      g.beginPath(); g.arc(w * 0.5, h * 0.5, 210, -0.4, 1.2); g.stroke();
    } else {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#f3d9b8'); grd.addColorStop(1, '#e9b48a');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff3dc'; g.beginPath(); g.arc(w * 0.68, h * 0.3, 60, 0, Math.PI * 2); g.fill();
      const layers = ['#a7684a', '#7c4f3c', '#4f3a33'];
      layers.forEach((c, i) => {
        g.fillStyle = c; g.beginPath(); g.moveTo(0, h);
        for (let x = 0; x <= w; x += 8) g.lineTo(x, h * (0.5 + i * 0.13) - Math.sin(x * 0.012 + i * 2) * 50 - Math.sin(x * 0.04) * 10);
        g.lineTo(w, h); g.fill();
      });
    }
  });
}

const kbTex = canvasTexture(512, 160, (g, w, h) => {
  g.fillStyle = '#1f2227'; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 15; c++) {
      g.fillStyle = '#3a3f48';
      if (r === 4) { if (c === 3) g.fillRect(100, 8 + r * 30, 230, 24); continue; }
      g.fillRect(8 + c * 33.2, 8 + r * 30, 29, 24);
    }
  }
});

/* ------------------------------------------------------------------
   Shared materials
------------------------------------------------------------------ */
const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2d2723, metalness: 0.7, roughness: 0.35 });
const blackPlastic = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.5, metalness: 0.2 });

/* ------------------------------------------------------------------
   Room
------------------------------------------------------------------ */
const ROOM = { w: 9, d: 7, h: 3.4 };

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(ROOM.w, ROOM.d),
  new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.0 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const wallMat = new THREE.MeshStandardMaterial({ map: plasterTex, roughness: 0.95 });
function addWall(w, h, pos, rotY) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
  m.position.copy(pos); m.rotation.y = rotY; m.receiveShadow = true;
  scene.add(m);
  return m;
}
addWall(ROOM.w, ROOM.h, new THREE.Vector3(0, ROOM.h / 2, -ROOM.d / 2), 0);
addWall(ROOM.w, ROOM.h, new THREE.Vector3(0, ROOM.h / 2, ROOM.d / 2), Math.PI);
addWall(ROOM.d, ROOM.h, new THREE.Vector3(-ROOM.w / 2, ROOM.h / 2, 0), Math.PI / 2);
addWall(ROOM.d, ROOM.h, new THREE.Vector3(ROOM.w / 2, ROOM.h / 2, 0), -Math.PI / 2);

const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d),
  new THREE.MeshStandardMaterial({ color: 0xf7f3ee, roughness: 1 }));
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = ROOM.h;
scene.add(ceiling);

// Baseboards
const trimMat = new THREE.MeshStandardMaterial({ color: 0xfaf7f2, roughness: 0.5 });
[
  [ROOM.w, 0.12, 0.025, 0, 0.06, -ROOM.d / 2 + 0.0125],
  [ROOM.w, 0.12, 0.025, 0, 0.06, ROOM.d / 2 - 0.0125],
  [0.025, 0.12, ROOM.d, -ROOM.w / 2 + 0.0125, 0.06, 0],
  [0.025, 0.12, ROOM.d, ROOM.w / 2 - 0.0125, 0.06, 0],
].forEach(([w, h, d, x, y, z]) => {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
  b.position.set(x, y, z); scene.add(b);
});

// Window on back wall
const winGroup = new THREE.Group();
const WIN_W = 2.6, WIN_H = 1.7, WIN_Y = 1.85, WZ = -ROOM.d / 2 + 0.01;
const skyMesh = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, WIN_H), new THREE.MeshBasicMaterial({ map: skyTex }));
skyMesh.position.set(0, WIN_Y, WZ);
winGroup.add(skyMesh);
const starsMesh = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, WIN_H),
  new THREE.MeshBasicMaterial({ map: starsTex, transparent: true, opacity: 0, depthWrite: false }));
starsMesh.position.set(0, WIN_Y, WZ + 0.003);
starsMesh.visible = false;
winGroup.add(starsMesh);
const frameMat = new THREE.MeshStandardMaterial({ color: 0xfbf8f3, roughness: 0.4 });
const fT = 0.07;
[
  [WIN_W + fT * 2, fT, 0, WIN_Y + WIN_H / 2 + fT / 2],
  [WIN_W + fT * 2, fT, 0, WIN_Y - WIN_H / 2 - fT / 2],
  [fT, WIN_H, -WIN_W / 2 - fT / 2, WIN_Y],
  [fT, WIN_H, WIN_W / 2 + fT / 2, WIN_Y],
  [0.035, WIN_H, 0, WIN_Y],
  [WIN_W, 0.035, 0, WIN_Y + 0.25],
].forEach(([w, h, x, y]) => {
  const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), frameMat);
  f.position.set(x, y, WZ + 0.03); winGroup.add(f);
});
const sill = new THREE.Mesh(new THREE.BoxGeometry(WIN_W + 0.3, 0.04, 0.18), frameMat);
sill.position.set(0, WIN_Y - WIN_H / 2 - fT - 0.02, WZ + 0.09);
sill.castShadow = true;
winGroup.add(sill);
scene.add(winGroup);

// Curtains
function makeCurtain(x) {
  const geo = new THREE.PlaneGeometry(0.85, 2.7, 60, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 38) * 0.035);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xd9c7ad, roughness: 1, side: THREE.DoubleSide }));
  m.position.set(x, 1.62, -ROOM.d / 2 + 0.14);
  m.castShadow = true;
  scene.add(m);
}
makeCurtain(-1.85);
makeCurtain(1.85);
const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 4.6, 12),
  new THREE.MeshStandardMaterial({ color: 0x3b3029, metalness: 0.6, roughness: 0.4 }));
rod.rotation.z = Math.PI / 2;
rod.position.set(0, 3.0, -ROOM.d / 2 + 0.14);
scene.add(rod);

// Rug
const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.8),
  new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }));
rug.rotation.x = -Math.PI / 2;
rug.position.set(0, 0.004, 0.1);
rug.receiveShadow = true;
scene.add(rug);

// Wall art
function addArt(variant, pos, rotY) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.5 }));
  const art = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.98),
    new THREE.MeshStandardMaterial({ map: artTexture(variant), roughness: 0.8 }));
  art.position.z = 0.021;
  g.add(frame, art);
  g.position.copy(pos); g.rotation.y = rotY;
  scene.add(g);
}
addArt(0, new THREE.Vector3(-ROOM.w / 2 + 0.03, 1.75, -0.4), Math.PI / 2);
addArt(1, new THREE.Vector3(ROOM.w / 2 - 0.03, 1.75, -0.4), -Math.PI / 2);

// Floor lamp (moved to the left of the window)
const lamp = new THREE.Group();
const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.03, 32), darkMetal);
lampBase.position.y = 0.015;
const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.5, 12), darkMetal);
pole.position.y = 0.78;
const shadeMat = new THREE.MeshStandardMaterial({ color: 0xf6e7cf, emissive: 0xffc98a, emissiveIntensity: 0.7, side: THREE.DoubleSide, roughness: 1 });
const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.25, 0.32, 32, 1, true), shadeMat);
shade.position.y = 1.62;
lamp.add(lampBase, pole, shade);
[lampBase, pole].forEach(m => (m.castShadow = true));
const lampLight = new THREE.PointLight(0xffc68a, 6, 9, 2);
lampLight.position.y = 1.58;
lamp.add(lampLight);
lamp.position.set(-2.65, 0, -3.0);
lamp.userData.pick = 'lamp';
scene.add(lamp);

/* ------------------------------------------------------------------
   Lights
------------------------------------------------------------------ */
const hemi = new THREE.HemisphereLight(0xfff4e6, 0x8a7560, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.position.set(-2.2, 5.5, -6);
sun.target.position.set(0, 0.6, 0.4);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(lowEndDevice ? 768 : 1280);
sun.shadow.camera.left = -4; sun.shadow.camera.right = 4;
sun.shadow.camera.top = 4; sun.shadow.camera.bottom = -4;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 18;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

// Soft "key" light that fades in over the page during close-up holds
const keyLight = new THREE.PointLight(0xfff2e0, 0, 4, 2);
scene.add(keyLight);

/* ------------------------------------------------------------------
   Tables
------------------------------------------------------------------ */
const TABLE_H = 0.78;
const T1X = 0, T2X = 0;
const tableMat = new THREE.MeshStandardMaterial({ map: tableWoodTex, roughness: 0.45, metalness: 0.0 });
const legMat = new THREE.MeshStandardMaterial({ color: 0x5c3b24, roughness: 0.5 });

function createTable(x) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.9), tableMat);
  top.position.y = TABLE_H - 0.025;
  g.add(top);
  const legH = TABLE_H - 0.05;
  [[-0.92, -0.37], [0.92, -0.37], [-0.92, 0.37], [0.92, 0.37]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.02, legH, 16), legMat);
    leg.position.set(lx, legH / 2, lz);
    g.add(leg);
  });
  const apronF = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.08, 0.025), legMat);
  apronF.position.set(0, TABLE_H - 0.09, 0.37);
  const apronB = apronF.clone(); apronB.position.z = -0.37;
  const apronL = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.08, 0.72), legMat);
  apronL.position.set(-0.92, TABLE_H - 0.09, 0);
  const apronR = apronL.clone(); apronR.position.x = 0.92;
  g.add(apronF, apronB, apronL, apronR);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.x = x;
  g.userData.pick = 'play';
  scene.add(g);
  return g;
}
const table1 = createTable(T1X);


/* ------------------------------------------------------------------
   Plants & flower vases
------------------------------------------------------------------ */
const leafShape = new THREE.Shape();
leafShape.moveTo(0, 0);
leafShape.bezierCurveTo(0.065, 0.05, 0.075, 0.16, 0, 0.25);
leafShape.bezierCurveTo(-0.075, 0.16, -0.065, 0.05, 0, 0);
const leafGeo = new THREE.ShapeGeometry(leafShape, 14);
{
  const p = leafGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, Math.abs(x) * 0.35 - Math.pow(y / 0.25, 2) * 0.05);
  }
  leafGeo.computeVertexNormals();
}
const leafMats = [0x3f7d3a, 0x4d8f45, 0x356b33].map(c =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, side: THREE.DoubleSide }));
const stemMat = new THREE.MeshStandardMaterial({ color: 0x5a7f38, roughness: 0.7 });

function createPlant({ scale = 1, leaves = 16, potColor = 0xf3efe8 } = {}) {
  const g = new THREE.Group();
  const prof = [[0, 0], [0.07, 0], [0.085, 0.01], [0.1, 0.14], [0.108, 0.15], [0.1, 0.156], [0.092, 0.15], [0.084, 0.02], [0, 0.02]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const pot = new THREE.Mesh(new THREE.LatheGeometry(prof, 48),
    new THREE.MeshStandardMaterial({ color: potColor, roughness: 0.35, side: THREE.DoubleSide }));
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.01, 32),
    new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 1 }));
  soil.position.y = 0.13;
  g.add(pot, soil);
  for (let i = 0; i < leaves; i++) {
    const az = (i / leaves) * Math.PI * 2 + Math.random() * 0.5;
    const ts = 0.12 + Math.random() * 0.6;
    const L = 0.15 + Math.random() * 0.15;
    const end = new THREE.Vector3(-Math.sin(az) * Math.sin(ts) * L, Math.cos(ts) * L, -Math.cos(az) * Math.sin(ts) * L);
    const mid = new THREE.Vector3(end.x * 0.25, end.y * 0.75, end.z * 0.25);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), mid, end);
    const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.004, 5, false), stemMat);
    stem.position.y = 0.13;
    const leaf = new THREE.Mesh(leafGeo, leafMats[i % 3]);
    leaf.position.copy(end); leaf.position.y += 0.13;
    leaf.rotation.set(-Math.min(1.4, ts + 0.45 + Math.random() * 0.3), az, 0, 'YXZ');
    leaf.scale.setScalar(0.75 + Math.random() * 0.5);
    g.add(stem, leaf);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.scale.setScalar(scale);
  return g;
}
const tablePlant = createPlant({ scale: 1.15 });
tablePlant.position.set(-0.86, TABLE_H, -0.28);
table1.add(tablePlant);
const floorPlant = createPlant({ scale: 3.2, leaves: 22, potColor: 0xb8673f });
floorPlant.position.set(-3.75, 0, -2.8);
scene.add(floorPlant);

// Flower vase
const petalGeo = new THREE.SphereGeometry(1, 8, 6);
const centerMat = new THREE.MeshStandardMaterial({ color: 0xf2b632, roughness: 0.6 });
const flowerCols = [0xf08aa8, 0xffffff, 0xffd34d, 0xff7b5c, 0xc79bf0].map(c =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, side: THREE.DoubleSide }));

function createFlower(mat, size) {
  const f = new THREE.Group();
  const c = new THREE.Mesh(new THREE.SphereGeometry(0.011 * size, 10, 8), centerMat);
  c.position.y = 0.002;
  f.add(c);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.rotation.y = Math.PI / 2 - a;
    const tilt = new THREE.Group();
    tilt.rotation.x = -0.4;
    const petal = new THREE.Mesh(petalGeo, mat);
    petal.scale.set(0.0075 * size, 0.0018 * size, 0.017 * size);
    petal.position.z = 0.015 * size;
    tilt.add(petal); pivot.add(tilt); f.add(pivot);
  }
  return f;
}

function createVase({ scale = 1, color = 0x3f6f86, flowers = 7 } = {}) {
  const g = new THREE.Group();
  const prof = [[0, 0], [0.045, 0], [0.055, 0.01], [0.07, 0.06], [0.065, 0.11], [0.038, 0.16], [0.034, 0.2], [0.04, 0.215],
    [0.034, 0.215], [0.028, 0.2], [0.03, 0.16], [0.055, 0.11], [0.06, 0.06], [0.045, 0.012], [0, 0.012]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const vase = new THREE.Mesh(new THREE.LatheGeometry(prof, 40),
    new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.05, side: THREE.DoubleSide }));
  g.add(vase);
  for (let i = 0; i < flowers; i++) {
    const az = (i / flowers) * Math.PI * 2 + Math.random() * 0.6;
    const tilt = 0.12 + Math.random() * 0.5;
    const L = 0.22 + Math.random() * 0.16;
    const start = new THREE.Vector3(0, 0.2, 0);
    const end = new THREE.Vector3(Math.sin(az) * Math.sin(tilt) * L, 0.2 + Math.cos(tilt) * L, Math.cos(az) * Math.sin(tilt) * L);
    const mid = new THREE.Vector3(end.x * 0.3, 0.2 + (end.y - 0.2) * 0.65, end.z * 0.3);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.0026, 5, false), stemMat));
    const head = createFlower(flowerCols[i % flowerCols.length], 0.9 + Math.random() * 0.5);
    head.position.copy(end);
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(mid).normalize());
    g.add(head);
    if (i % 2 === 0) {
      const leaf = new THREE.Mesh(leafGeo, leafMats[i % 3]);
      leaf.position.copy(mid).multiplyScalar(0.7); leaf.position.y = 0.2 + (mid.y - 0.2) * 0.5;
      leaf.rotation.set(-0.9, az, 0, 'YXZ');
      leaf.scale.setScalar(0.45);
      g.add(leaf);
    }
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.scale.setScalar(scale);
  return g;
}
const vaseOnTable2 = createVase({ scale: 0.75, color: 0xb8673f, flowers: 6 });
vaseOnTable2.position.set(0.84, TABLE_H, -0.26);
table1.add(vaseOnTable2);

/* ------------------------------------------------------------------
   Video screens (PC + tablet)
------------------------------------------------------------------ */
function makeScreen(w, h, label, input) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = MAX_ANISO;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  return { canvas: c, ctx: c.getContext('2d'), tex, mat, w, h, label, input, video: null, url: null, src: null, name: '', uiUntil: 0, last: -1, mesh: null, dirty: true };
}
const pcScreen = makeScreen(1280, 720, 'PC', document.getElementById('pcVideo'));
const tabScreen = makeScreen(960, 640, 'Tablet', document.getElementById('tabVideo'));
const screens = [pcScreen, tabScreen];

/* ---------- Desk with PC, lamp, mug ---------- */
const DESK = { x: 3.2, z: -3.0, w: 1.9, d: 0.75, h: 0.74 };
const deskGroup = new THREE.Group();
deskGroup.position.set(DESK.x, 0, DESK.z);
{
  const top = new THREE.Mesh(new THREE.BoxGeometry(DESK.w, 0.04, DESK.d), tableMat);
  top.position.y = DESK.h - 0.02;
  deskGroup.add(top);
  const legGeo = new THREE.BoxGeometry(0.05, DESK.h - 0.04, 0.05);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const l = new THREE.Mesh(legGeo, legMat);
    l.position.set(sx * (DESK.w / 2 - 0.05), (DESK.h - 0.04) / 2, sz * (DESK.d / 2 - 0.05));
    deskGroup.add(l);
  });
  const back = new THREE.Mesh(new THREE.BoxGeometry(DESK.w - 0.1, 0.3, 0.02), legMat);
  back.position.set(0, DESK.h - 0.22, -DESK.d / 2 + 0.06);
  deskGroup.add(back);

  // Monitor
  const mon = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.015, 32), darkMetal);
  base.position.set(0, 0.0075, -0.02);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.2, 0.022), darkMetal);
  neck.position.set(0, 0.115, -0.03);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.4, 0.03), blackPlastic);
  bezel.position.set(0, 0.4, 0);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.36), pcScreen.mat);
  scr.position.set(0, 0.4, 0.0156);
  scr.userData.pick = 'screen'; scr.userData.screen = pcScreen;
  pcScreen.mesh = scr;
  mon.add(base, neck, bezel, scr);
  mon.position.set(-0.1, DESK.h, -0.15);
  [base, neck, bezel].forEach(m => (m.castShadow = true));
  deskGroup.add(mon);

  // Keyboard + mouse
  const kb = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.016, 0.14), blackPlastic);
  kb.position.set(-0.1, DESK.h + 0.008, 0.14);
  const kbTop = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13),
    new THREE.MeshStandardMaterial({ map: kbTex, roughness: 0.6 }));
  kbTop.rotation.x = -Math.PI / 2;
  kbTop.position.set(-0.1, DESK.h + 0.0165, 0.14);
  const mouse = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), blackPlastic);
  mouse.scale.set(0.03, 0.014, 0.05);
  mouse.position.set(0.24, DESK.h + 0.01, 0.14);
  kb.castShadow = mouse.castShadow = true;
  deskGroup.add(kb, kbTop, mouse);

  // Mug
  const mugMat = new THREE.MeshStandardMaterial({ color: 0xe9e2d6, roughness: 0.35, side: THREE.DoubleSide });
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.09, 24, 1, true), mugMat);
  mug.position.set(-0.62, DESK.h + 0.045, 0.1);
  const mugBottom = new THREE.Mesh(new THREE.CircleGeometry(0.036, 24), mugMat);
  mugBottom.rotation.x = -Math.PI / 2; mugBottom.position.set(-0.62, DESK.h + 0.003, 0.1);
  const mugHandle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 8, 16, Math.PI), mugMat);
  mugHandle.position.set(-0.58, DESK.h + 0.045, 0.1); mugHandle.rotation.z = -Math.PI / 2;
  mug.castShadow = true;
  deskGroup.add(mug, mugBottom, mugHandle);

  // Tower PC (under the desk)
  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.42), blackPlastic);
  tower.position.set(0.62, 0.21, 0.0);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x4dff88 }));
  led.position.set(0.62, 0.36, 0.212);
  tower.castShadow = true;
  deskGroup.add(tower, led);
}
const deskLamp = new THREE.Group();
const deskShadeMat = new THREE.MeshStandardMaterial({ color: 0xf2e6d2, emissive: 0xffc98a, emissiveIntensity: 0.1, side: THREE.DoubleSide, roughness: 0.8 });
const deskLight = new THREE.PointLight(0xffd09a, 0, 3.5, 2);
{
  deskLamp.position.set(0.8, DESK.h, -0.15);
  deskLamp.rotation.y = Math.PI; // arm reaches toward the monitor side (-x)
  const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 32), darkMetal);
  lb.position.y = 0.01;
  const arm1 = new THREE.Group(); arm1.position.y = 0.02; arm1.rotation.z = -0.35;
  const a1m = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.3, 0.012), darkMetal); a1m.position.y = 0.15;
  arm1.add(a1m);
  const j1 = new THREE.Group(); j1.position.y = 0.3; arm1.add(j1);
  const arm2 = new THREE.Group(); arm2.rotation.z = -0.9; j1.add(arm2);
  const a2m = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.28, 0.012), darkMetal); a2m.position.y = 0.14;
  arm2.add(a2m);
  const head = new THREE.Group(); head.position.y = 0.28; head.rotation.z = 1.6; arm2.add(head);
  const hs = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.07, 0.09, 24, 1, true), deskShadeMat);
  hs.position.y = -0.02;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff0cf }));
  bulb.position.y = -0.045;
  deskLight.position.set(0, -0.07, 0);
  head.add(hs, bulb, deskLight);
  deskLamp.add(lb, arm1);
  deskLamp.traverse(o => { if (o.isMesh) o.castShadow = true; });
  deskLamp.userData.pick = 'lamp';
  deskGroup.add(deskLamp);
}
deskGroup.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
scene.add(deskGroup);

// Soft glow from the PC screen at night
const pcGlow = new THREE.PointLight(0x9cc4ff, 0, 2.6, 2);
pcGlow.position.set(DESK.x - 0.1, DESK.h + 0.4, DESK.z + 0.25);
scene.add(pcGlow);

// Office chair
{
  const chair = new THREE.Group();
  const cm = new THREE.MeshStandardMaterial({ color: 0x2f3a46, roughness: 0.8 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.44), cm); seat.position.y = 0.48;
  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.48, 0.06), cm); backrest.position.set(0, 0.78, 0.22);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 12), darkMetal); post.position.y = 0.27;
  chair.add(seat, backrest, post);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.045), darkMetal);
    arm.position.set(Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15);
    arm.rotation.y = -a;
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), blackPlastic);
    wheel.position.set(Math.cos(a) * 0.29, 0.03, Math.sin(a) * 0.29);
    chair.add(arm, wheel);
  }
  chair.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  chair.position.set(DESK.x - 0.15, 0, DESK.z + 0.95);
  chair.rotation.y = 0.35;
  scene.add(chair);
}

/* ---------- Side table with tablet + flower vase ---------- */
{
  const side = new THREE.Group();
  const stop = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.035, 48), tableMat);
  stop.position.y = 0.56;
  const spole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.52, 16), legMat);
  spole.position.y = 0.28;
  const sbase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 32), legMat);
  sbase.position.y = 0.015;
  side.add(stop, spole, sbase);
  const topY = 0.5775;

  // Tablet leaning on a prop
  const tablet = new THREE.Group();
  tablet.position.set(-0.06, topY, 0.07);
  tablet.rotation.y = 0.6;
  const tilt = new THREE.Group();
  tilt.rotation.x = -0.32;
  const tbody = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.01), blackPlastic);
  tbody.position.y = 0.09;
  const tscr = new THREE.Mesh(new THREE.PlaneGeometry(0.244, 0.163), tabScreen.mat);
  tscr.position.set(0, 0.09, 0.0056);
  tscr.userData.pick = 'screen'; tscr.userData.screen = tabScreen;
  tabScreen.mesh = tscr;
  tilt.add(tbody, tscr);
  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.144, 0.006), darkMetal);
  prop.position.set(0, 0.06, -0.08);
  prop.rotation.x = 0.59;
  tablet.add(tilt, prop);
  tbody.castShadow = true; prop.castShadow = true;
  side.add(tablet);

  const sideVase = createVase({ scale: 1.0, color: 0x3f6f86, flowers: 8 });
  sideVase.position.set(0.17, topY, -0.12);
  side.add(sideVase);

  side.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  stop.castShadow = true;
  side.position.set(-3.0, 0, 0.6);
  scene.add(side);
}

/* ------------------------------------------------------------------
   Screen content drawing
------------------------------------------------------------------ */
function drawScreen(s, now) {
  const v = s.video;
  // Empty and paused screens are static. Redraw only after a state change;
  // active videos are refreshed at 24 fps rather than uploading every frame.
  if (!s.dirty && (!v || v.paused || now - s.last < 1 / 24)) return;
  const { ctx, w, h } = s;
  if (v && v.readyState >= 2 && v.videoWidth) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const sc = Math.min(w / v.videoWidth, h / v.videoHeight);
    const dw = v.videoWidth * sc, dh = v.videoHeight * sc;
    ctx.drawImage(v, (w - dw) / 2, (h - dh) / 2, dw, dh);
    if (v.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(w / 2, h / 2, h * 0.11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.moveTo(w / 2 - h * 0.035, h / 2 - h * 0.06); ctx.lineTo(w / 2 + h * 0.07, h / 2); ctx.lineTo(w / 2 - h * 0.035, h / 2 + h * 0.06); ctx.fill();
    }
    if (v.paused || now < s.uiUntil) {
      const prog = v.duration ? v.currentTime / v.duration : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, h - h * 0.075, w, h * 0.075);
      ctx.fillStyle = '#ff8a3d'; ctx.fillRect(0, h - h * 0.012, w * prog, h * 0.012);
      ctx.fillStyle = '#fff'; ctx.font = `${Math.round(h * 0.04)}px Segoe UI, sans-serif`; ctx.textAlign = 'left';
      ctx.fillText(s.name.slice(0, 48), w * 0.02, h - h * 0.028);
    }
  } else if (v) {
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ddd'; ctx.font = `${Math.round(h * 0.06)}px Segoe UI, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText('Loading video…', w / 2, h / 2);
  } else {
    const hue = s.label === 'PC' ? 213 : 158;
    const grd = ctx.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, `hsl(${hue},55%,22%)`);
    grd.addColorStop(1, `hsl(${(hue + 70) % 360},60%,12%)`);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) {
      const x = w * (0.5 + 0.38 * Math.sin(i * 1.7));
      const y = h * (0.5 + 0.34 * Math.cos(i * 2.3));
      const r = h * (0.18 + 0.05 * Math.sin(i));
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `hsla(${(hue + i * 40) % 360},80%,60%,0.35)`);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(h * 0.075)}px Segoe UI, sans-serif`;
    ctx.fillText(`${s.label} screen`, w / 2, h * 0.42);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = `${Math.round(h * 0.045)}px Segoe UI, sans-serif`;
    ctx.fillText('Click to load a video', w / 2, h * 0.52);
    rr(ctx, w / 2 - h * 0.13, h * 0.57, h * 0.26, h * 0.085, h * 0.04);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `${Math.round(h * 0.04)}px Segoe UI, sans-serif`;
    ctx.fillText('▶  Play', w / 2, h * 0.62);
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `${Math.round(h * 0.05)}px Segoe UI, sans-serif`;
    ctx.fillText('READY', w - w * 0.03, h - h * 0.04);
  }
  s.tex.needsUpdate = true;
  s.dirty = false;
  s.last = now;
}

function loadVideo(s, file) {
  if (!file) return;
  if (!file.type.startsWith('video/')) { setStatus('Please choose a video file.'); return; }
  if (s.url) URL.revokeObjectURL(s.url);
  s.url = URL.createObjectURL(file);
  if (!s.video) {
    const v = document.createElement('video');
    v.loop = true; v.playsInline = true; v.preload = 'auto'; v.muted = true;
    s.video = v;
  }
  s.video.src = s.url;
  s.video.load();
  s.name = file.name;
  s.dirty = true;
  hookVideoAudio(s);
  s.video.play().catch(() => {});
  s.uiUntil = lastNow + 3;
  setStatus(`${s.label} is playing “${file.name}”.`);
}
function hookVideoAudio(s) {
  if (!s.video) return;
  if (audio.ctx) {
    if (!s.src) {
      try {
        s.src = audio.ctx.createMediaElementSource(s.video);
        s.src.connect(audio.screenGain);
      } catch (e) { console.warn(e); }
    }
    if (s.src) s.video.muted = false;
  } else {
    s.video.muted = true;
  }
}
function screenClick(s) {
  ensureAudio();
  if (!s.video) { s.input.click(); return; }
  if (s.video.paused) s.video.play().catch(() => {}); else s.video.pause();
  s.uiUntil = lastNow + 3;
  s.dirty = true;
}

/* ------------------------------------------------------------------
   Lighting presets
------------------------------------------------------------------ */
const PRESETS = {
  day:     { label: '☀ Day',        bg: 0xe9e1d6, sun: 0xfff1dc, sunI: 2.6, sunPos: [-2.2, 5.5, -6],  hemiI: 0.55, hemiSky: 0xfff4e6, hemiGnd: 0x8a7560, exp: 1.0,  env: 1.0,  sky: 0xffffff, stars: 0,   night: 0,   lampStr: 0.6, lampsOn: false, amb: 'birds' },
  golden:  { label: '🌇 Golden',     bg: 0xd9b48a, sun: 0xff9d4d, sunI: 3.2, sunPos: [-6, 2.4, -4.5],  hemiI: 0.35, hemiSky: 0xffd2a0, hemiGnd: 0x6a4a38, exp: 1.0,  env: 0.6,  sky: 0xffb48a, stars: 0,   night: 0.2, lampStr: 0.8, lampsOn: true,  amb: 'birds' },
  evening: { label: '🌆 Evening',    bg: 0x3b3550, sun: 0x7f8fd8, sunI: 0.7, sunPos: [-3, 3.5, -6],    hemiI: 0.25, hemiSky: 0x8f98d0, hemiGnd: 0x3a3040, exp: 1.05, env: 0.3,  sky: 0x7a6aa0, stars: 0.2, night: 0.6, lampStr: 1.0, lampsOn: true,  amb: 'crickets' },
  night:   { label: '🌙 Night',      bg: 0x0b0d14, sun: 0x7d93d6, sunI: 0.35, sunPos: [-2.5, 5, -6],   hemiI: 0.1,  hemiSky: 0x6070a0, hemiGnd: 0x20202a, exp: 1.15, env: 0.1,  sky: 0x1c2442, stars: 1,   night: 1,   lampStr: 1.0, lampsOn: true,  amb: 'crickets' },
  studio:  { label: '💡 Studio',     bg: 0xdcdcdc, sun: 0xffffff, sunI: 2.2, sunPos: [0.5, 6, 5],      hemiI: 0.9,  hemiSky: 0xffffff, hemiGnd: 0xb0b0b0, exp: 1.1,  env: 1.1,  sky: 0xffffff, stars: 0,   night: 0,   lampStr: 0.5, lampsOn: false, amb: 'none' },
  cinema:  { label: '🎬 Cinematic',  bg: 0x1a1612, sun: 0xffe6c4, sunI: 3.4, sunPos: [-6, 3.6, -1.2],  hemiI: 0.1,  hemiSky: 0xaec0ff, hemiGnd: 0x2a1d14, exp: 1.0,  env: 0.22, sky: 0x8fa0c8, stars: 0,   night: 0.5, lampStr: 0.9, lampsOn: true,  amb: 'none' },
};
function lightState() {
  const c = h => new THREE.Color(h);
  return { bg: c(0xe9e1d6), sun: c(0xfff1dc), sunI: 2.6, sunPos: new THREE.Vector3(-2.2, 5.5, -6), hemiI: 0.55,
    hemiSky: c(0xfff4e6), hemiGnd: c(0x8a7560), exp: 1, env: 1, sky: c(0xffffff), stars: 0, night: 0 };
}
const L = lightState();   // current
const T = lightState();   // target
let lampStr = 0.6, lampNow = 0, lampsOn = false, ambKind = 'birds', lightName = 'day', keyAmt = 0;

const lightChips = document.getElementById('lightChips');
const lampsChk = document.getElementById('lampsOn');
Object.entries(PRESETS).forEach(([k, P]) => {
  const b = document.createElement('button');
  b.textContent = P.label; b.dataset.light = k;
  b.addEventListener('click', () => setLighting(k, false));
  lightChips.appendChild(b);
});

function setLighting(name, instant) {
  const P = PRESETS[name]; if (!P) return;
  lightName = name;
  T.bg.set(P.bg); T.sun.set(P.sun); T.sunI = P.sunI; T.sunPos.set(...P.sunPos);
  T.hemiI = P.hemiI; T.hemiSky.set(P.hemiSky); T.hemiGnd.set(P.hemiGnd);
  T.exp = P.exp; T.env = P.env; T.sky.set(P.sky); T.stars = P.stars; T.night = P.night;
  lampStr = P.lampStr; lampsOn = P.lampsOn; ambKind = P.amb;
  lampsChk.checked = lampsOn;
  [...lightChips.children].forEach(b => b.classList.toggle('on', b.dataset.light === name));
  if (instant) {
    L.bg.copy(T.bg); L.sun.copy(T.sun); L.sunPos.copy(T.sunPos); L.hemiSky.copy(T.hemiSky); L.hemiGnd.copy(T.hemiGnd); L.sky.copy(T.sky);
    ['sunI', 'hemiI', 'exp', 'env', 'stars', 'night'].forEach(k => (L[k] = T[k]));
    lampNow = lampsOn ? 1 : 0;
  }
}
function stepLighting(dt) {
  const k = 1 - Math.exp(-dt * 2.5);
  L.bg.lerp(T.bg, k); L.sun.lerp(T.sun, k); L.sunPos.lerp(T.sunPos, k);
  L.hemiSky.lerp(T.hemiSky, k); L.hemiGnd.lerp(T.hemiGnd, k); L.sky.lerp(T.sky, k);
  ['sunI', 'hemiI', 'exp', 'env', 'stars', 'night'].forEach(key => (L[key] += (T[key] - L[key]) * k));
  lampNow += ((lampsOn ? 1 : 0) - lampNow) * (1 - Math.exp(-dt * 4));

  scene.background.copy(L.bg);
  sun.color.copy(L.sun); sun.intensity = L.sunI; sun.position.copy(L.sunPos);
  hemi.color.copy(L.hemiSky); hemi.groundColor.copy(L.hemiGnd); hemi.intensity = L.hemiI;
  renderer.toneMappingExposure = L.exp;
  scene.environmentIntensity = L.env;
  skyMesh.material.color.copy(L.sky);
  starsMesh.material.opacity = L.stars; starsMesh.visible = L.stars > 0.01;

  const lk = lampNow * lampStr;
  lampLight.intensity = 7 * lk;
  deskLight.intensity = 2.4 * lk;
  shadeMat.emissiveIntensity = 0.06 + 0.8 * lampNow;
  deskShadeMat.emissiveIntensity = 0.06 + 0.9 * lampNow;
  pcGlow.intensity = 1.1 * L.night;
  keyLight.intensity = keyAmt * (0.4 + 1.2 * L.night);
}
lampsChk.addEventListener('change', () => (lampsOn = lampsChk.checked));
function toggleLamps() { lampsOn = !lampsOn; lampsChk.checked = lampsOn; }

/* ------------------------------------------------------------------
   Audio (all synthesized with Web Audio — no files needed)
------------------------------------------------------------------ */
const audio = { ctx: null, bus: null, monitor: null, recDest: null, noiseBuf: null, screenGain: null, ambGain: null,
  enabled: false, vol: 0.8, ambience: false, screen: false, critterTimer: null };

function ensureAudio() {
  if (audio.ctx) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  audio.ctx = ctx;
  audio.bus = ctx.createGain();
  audio.bus.gain.value = audio.enabled ? 1 : 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 3;
  audio.monitor = ctx.createGain();
  audio.monitor.gain.value = audio.vol;
  audio.bus.connect(comp);
  comp.connect(audio.monitor); audio.monitor.connect(ctx.destination);
  try { audio.recDest = ctx.createMediaStreamDestination(); comp.connect(audio.recDest); } catch (e) { audio.recDest = null; }
  audio.screenGain = ctx.createGain();
  audio.screenGain.gain.value = audio.screen ? 0.8 : 0;
  audio.screenGain.connect(audio.bus);

  const n = ctx.sampleRate * 2;
  audio.noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = audio.noiseBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

  startAmbience();
  screens.forEach(hookVideoAudio);
}

function noiseNode(t) {
  const s = audio.ctx.createBufferSource();
  s.buffer = audio.noiseBuf; s.loop = true;
  s.start(t, Math.random() * 1.5);
  return s;
}
function envGain(t, a, peak, d) {
  const g = audio.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  return g;
}
const panOf = x => clamp(x / 2.0, -0.9, 0.9);

function sfxPickup(x) {
  if (!audio.ctx || !audio.enabled) return;
  const ctx = audio.ctx, t = ctx.currentTime;
  const pan = ctx.createStereoPanner(); pan.pan.value = panOf(x); pan.connect(audio.bus);
  const n1 = noiseNode(t), bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.7;
  const g1 = envGain(t, 0.03, 0.14, 0.22);
  n1.connect(bp); bp.connect(g1); g1.connect(pan); n1.stop(t + 0.4);
  const n2 = noiseNode(t), lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 700;
  const g2 = envGain(t, 0.02, 0.1, 0.16);
  n2.connect(lp); lp.connect(g2); g2.connect(pan); n2.stop(t + 0.3);
}
function sfxFlight(dur, x0, x1) {
  if (!audio.ctx || !audio.enabled) return;
  const ctx = audio.ctx, t = ctx.currentTime;
  const src = noiseNode(t), bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(700, t);
  bp.frequency.linearRampToValueAtTime(2300, t + dur * 0.4);
  bp.frequency.linearRampToValueAtTime(900, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.2, t + dur * 0.3);
  g.gain.linearRampToValueAtTime(0.12, t + dur * 0.7);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 11;
  const lg = ctx.createGain(); lg.gain.value = 0.03;
  lfo.connect(lg); lg.connect(g.gain);
  const pan = ctx.createStereoPanner();
  pan.pan.setValueAtTime(panOf(x0), t);
  pan.pan.linearRampToValueAtTime(panOf(x1), t + dur);
  src.connect(bp); bp.connect(g); g.connect(pan); pan.connect(audio.bus);
  lfo.start(t); src.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
}
function sfxLand(x) {
  if (!audio.ctx || !audio.enabled) return;
  const ctx = audio.ctx, t = ctx.currentTime;
  const pan = ctx.createStereoPanner(); pan.pan.value = panOf(x); pan.connect(audio.bus);
  const n1 = noiseNode(t), lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(2200, t); lp.frequency.exponentialRampToValueAtTime(250, t + 0.18);
  const g1 = envGain(t, 0.004, 0.45, 0.16);
  n1.connect(lp); lp.connect(g1); g1.connect(pan); n1.stop(t + 0.3);
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
  const g2 = envGain(t, 0.004, 0.3, 0.12);
  o.connect(g2); g2.connect(pan); o.start(t); o.stop(t + 0.2);
  const n3 = noiseNode(t), hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 4000;
  const g3 = envGain(t, 0.005, 0.07, 0.12);
  n3.connect(hp); hp.connect(g3); g3.connect(pan); n3.stop(t + 0.25);
}

function startAmbience() {
  const ctx = audio.ctx;
  audio.ambGain = ctx.createGain();
  audio.ambGain.gain.value = audio.ambience ? 1 : 0;
  audio.ambGain.connect(audio.bus);
  // Room tone: brown noise, low-passed
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  const room = ctx.createBufferSource(); room.buffer = buf; room.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
  const rg = ctx.createGain(); rg.gain.value = 0.05;
  room.connect(lp); lp.connect(rg); rg.connect(audio.ambGain); room.start();
  // Soft air movement
  const air = noiseNode(ctx.currentTime);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.5;
  const ag = ctx.createGain(); ag.gain.value = 0.01;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lg = ctx.createGain(); lg.gain.value = 0.006;
  lfo.connect(lg); lg.connect(ag.gain); lfo.start();
  air.connect(bp); bp.connect(ag); ag.connect(audio.ambGain);
  scheduleCritter();
}
function scheduleCritter() {
  clearTimeout(audio.critterTimer);
  if (!audio.ctx) return;
  const wait = ambKind === 'crickets' ? 1500 + Math.random() * 2500 : 3000 + Math.random() * 7000;
  audio.critterTimer = setTimeout(() => {
    if (audio.ambience && audio.enabled && audio.ctx.state === 'running') {
      if (ambKind === 'birds') chirp(); else if (ambKind === 'crickets') cricket();
    }
    scheduleCritter();
  }, wait);
}
function chirp() {
  const ctx = audio.ctx; let t = ctx.currentTime + 0.05;
  const pan = ctx.createStereoPanner(); pan.pan.value = (Math.random() - 0.5) * 1.4; pan.connect(audio.ambGain);
  const base = 2600 + Math.random() * 1800, notes = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < notes; i++) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * (1.15 + Math.random() * 0.3), t + 0.07);
    const g = envGain(t, 0.01, 0.03, 0.08);
    o.connect(g); g.connect(pan); o.start(t); o.stop(t + 0.12);
    t += 0.1 + Math.random() * 0.05;
  }
}
function cricket() {
  const ctx = audio.ctx; let t = ctx.currentTime + 0.05;
  const pan = ctx.createStereoPanner(); pan.pan.value = (Math.random() - 0.5) * 1.6; pan.connect(audio.ambGain);
  const f = 4300 + Math.random() * 500;
  for (let i = 0; i < 8; i++) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = envGain(t, 0.004, 0.012, 0.014);
    o.connect(g); g.connect(pan); o.start(t); o.stop(t + 0.03);
    t += 0.04;
  }
}

/* ------------------------------------------------------------------
   Overlays attached to the camera: fade-to-black + page caption
------------------------------------------------------------------ */
const fadeMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }));
fadeMesh.scale.set(6, 6, 1); fadeMesh.position.z = -0.2; fadeMesh.renderOrder = 1001; fadeMesh.frustumCulled = false; fadeMesh.visible = false;
camera.add(fadeMesh);
const fade = { v: 0, target: 0, dur: 0.9 };

const capCanvas = document.createElement('canvas');
capCanvas.width = 1024; capCanvas.height = 160;
const capCtx = capCanvas.getContext('2d');
const capTex = new THREE.CanvasTexture(capCanvas);
capTex.colorSpace = THREE.SRGBColorSpace;
const capMat = new THREE.MeshBasicMaterial({ map: capTex, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
const capMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), capMat);
capMesh.renderOrder = 1000; capMesh.frustumCulled = false; capMesh.visible = false;
camera.add(capMesh);
let capAlpha = 0;
function drawCaption(title, sub) {
  const g = capCtx;
  g.clearRect(0, 0, 1024, 160);
  rr(g, 6, 6, 1012, 148, 40);
  g.fillStyle = 'rgba(22,18,14,0.78)'; g.fill();
  g.fillStyle = '#ff9d54'; g.fillRect(34, 34, 8, 92);
  g.textAlign = 'left'; g.fillStyle = '#ffffff';
  g.font = 'bold 54px "Segoe UI", system-ui, sans-serif';
  g.fillText(title, 62, 83);
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.font = '30px "Segoe UI", system-ui, sans-serif';
  g.fillText(sub, 62, 126);
  capTex.needsUpdate = true;
}
function layoutOverlays() {
  const dist = 0.6;
  const vh = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const vw = vh * camera.aspect;
  const cw = Math.min(vw * 0.46, vh * 1.25), ch = cw / 6.4;
  capMesh.scale.set(cw, ch, 1);
  capMesh.position.set(0, -vh / 2 + ch / 2 + vh * 0.05, -dist);
}

/* ------------------------------------------------------------------
   Frame size (locked to the selected output while recording)
------------------------------------------------------------------ */
let frameLock = null;
let previewOutput = { w: 1080, h: 1920 };
function applySize() {
  if (frameLock) {
    renderer.setPixelRatio(RECORD_PIXEL_RATIO);
    renderer.setSize(frameLock.w, frameLock.h, false);
    canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.objectFit = 'contain';
    camera.aspect = frameLock.w / frameLock.h;
  } else {
    canvas.style.objectFit = '';
    // Keep the live preview's drawing buffer at least as large as the
    // selected recording output in both axes. This prevents a sharp export
    // from looking softer than the preview on high-density/mobile screens.
    const vw = window.innerWidth, vh = window.innerHeight;
    const qualityRatio = Math.max(PREVIEW_PIXEL_RATIO, previewOutput.w / vw, previewOutput.h / vh);
    renderer.setPixelRatio(qualityRatio);
    renderer.setSize(vw, vh);
    camera.aspect = window.innerWidth / window.innerHeight;
  }
  camera.updateProjectionMatrix();
  layoutOverlays();
}
function viewRect() {
  const r = canvas.getBoundingClientRect();
  if (!frameLock) return r;
  const ca = frameLock.w / frameLock.h;
  let w = r.width, h = r.height;
  if (w / h > ca) w = h * ca; else h = w / ca;
  return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
}
layoutOverlays();

/* ------------------------------------------------------------------
   Timers, clock, shared state
------------------------------------------------------------------ */
const timers = [];
const clock = new THREE.Clock();
function after(sec, fn) { timers.push({ t: clock.getElapsedTime() + sec, fn }); }
let lastNow = 0, prevNow = 0;
let cineOn = true, capOn = false, cineActive = false;
const events = [];        // timing-sheet events
let tlT0 = 0;
const mmss = t => { t = Math.max(0, t); const m = Math.floor(t / 60); return String(m).padStart(2, '0') + ':' + (t - m * 60).toFixed(1).padStart(4, '0'); };
const $ = id => document.getElementById(id);
function getText() {
  return { title: $('tTitle').value.trim(), tag: $('tTag').value.trim(), offer: $('tOffer').value.trim(), cta: $('tCta').value.trim() };
}

/* ------------------------------------------------------------------
   Pages & stacks — ONE table: unviewed stack (left) → viewed pile (right)
------------------------------------------------------------------ */
const STACK_A = new THREE.Vector3(-0.38, 0, 0.08);
const STACK_B = new THREE.Vector3(0.38, 0, 0.08);
let THICK = 0.0012;
const BASE_Y = TABLE_H + 0.0006;
const TEX_W = 1536;

let pageW = 0.42, pageH = 0.594, texH = 2172;
let pages = [], flights = [], heroPage = null;
let renderFn = null, gen = 0;
let playing = false, finished = false, speed = 1, holdSec = 3, nextAt = 0, lastFlip = -10;
let featured = new Set();

const blockMat = new THREE.MeshStandardMaterial({ color: 0xeeeae1, roughness: 0.9 });
const blockA = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), blockMat);
const blockB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), blockMat);
[blockA, blockB].forEach(b => { b.castShadow = true; b.receiveShadow = true; b.userData.pick = 'play'; scene.add(b); });
const stackA = { pos: STACK_A, arr: [], block: blockA, incoming: 0 };
const stackB = { pos: STACK_B, arr: [], block: blockB, incoming: 0 };

function parseFeatured(str, n) {
  const set = new Set();
  String(str).split(/[,\s]+/).forEach(tok => {
    const m = tok.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) return;
    let a = +m[1], b = m[2] ? +m[2] : a;
    if (a > b) [a, b] = [b, a];
    for (let i = a; i <= b; i++) if (i >= 1 && i <= n) set.add(i - 1);
  });
  return set;
}
function refreshFeatured() {
  let s = parseFeatured($('feat').value, pages.length);
  if (!s.size) s = parseFeatured(`1-${Math.min(6, pages.length)}`, pages.length);
  featured = s;
}

function createPage(index) {
  const geo = new THREE.PlaneGeometry(pageW, pageH, 20, 6);
  const base = Float32Array.from(geo.attributes.position.array);
  const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.85, side: THREE.FrontSide, emissive: 0x000000, emissiveIntensity: 0 }));
  const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xebe7de, roughness: 0.9, side: THREE.BackSide }));
  front.receiveShadow = back.receiveShadow = true;
  const inner = new THREE.Group();
  inner.rotation.x = -Math.PI / 2;     // lies flat, front of the page facing up
  inner.add(front, back);
  const outer = new THREE.Group();
  outer.add(inner);
  outer.visible = false;
  outer.userData.pick = 'play';
  // Page objects are attached to the scene only while visible or in flight.
  return {
    index, outer, front, back, geo, base,
    jitter: { x: (Math.random() - 0.5) * 0.008, z: (Math.random() - 0.5) * 0.008, yaw: (Math.random() - 0.5) * 0.05 },
    tex: null, loading: false, wanted: false, flight: null, slot: -1,
  };
}
function flatten(p) {
  p.geo.attributes.position.array.set(p.base);
  p.geo.attributes.position.needsUpdate = true;
  p.geo.computeVertexNormals();
}
function bend(p, c, flutter, now) {
  const arr = p.geo.attributes.position.array, b = p.base, hw = pageW / 2, hh = pageH / 2;
  for (let i = 0; i < arr.length; i += 3) {
    const u = b[i] / hw, v = b[i + 1] / hh;
    arr[i + 2] = -c * u * u + flutter * Math.sin(v * 2.5 + now * 9 + u * 1.5);
  }
  p.geo.attributes.position.needsUpdate = true;
  p.geo.computeVertexNormals();
}
function restPose(p, pos, level) {
  p.outer.position.set(pos.x + p.jitter.x, BASE_Y + level * THICK, pos.z + p.jitter.z);
  p.outer.rotation.set(0, p.jitter.yaw, 0);
}
function setBlock(b, pos, h) {
  b.visible = h > 0.0001;
  b.scale.set(pageW * 0.995, Math.max(h, 0.0001), pageH * 0.995);
  b.position.set(pos.x, TABLE_H + h / 2, pos.z);
}
function disposePage(p) {
  scene.remove(p.outer);
  p.geo.dispose(); p.front.material.dispose(); p.back.material.dispose();
  if (p.tex) p.tex.dispose();
}
function resetStacks() {
  stackA.arr = [...pages].reverse();   // page 1 on top
  stackB.arr = [];
  stackA.incoming = stackB.incoming = 0;
  heroPage = null;
  refreshFeatured();
}
function buildPages(count, aspect, fn) {
  gen++;
  pages.forEach(disposePage);
  pages = []; flights = []; timers.length = 0;
  playing = false; finished = false;
  THICK = Math.min(0.0012, 0.1 / count);
  pageW = 0.42; pageH = pageW * aspect;
  if (pageH > 0.72) { pageH = 0.72; pageW = pageH / aspect; }
  if (pageW > 0.62) { pageW = 0.62; pageH = pageW * aspect; }
  texH = Math.round(TEX_W * aspect);
  renderFn = fn;
  for (let i = 0; i < count; i++) pages.push(createPage(i));
  resetStacks();
  updateStacks();
}

/* ---------- Lazy texture loading ---------- */
let renderQueue = Promise.resolve();
function refreshTextures() {
  const want = new Set([...stackA.arr.slice(-3), ...stackB.arr.slice(-2), ...flights]);
  for (const p of pages) {
    p.wanted = want.has(p);
    if (p.wanted && !p.tex && !p.loading) loadTex(p);
    else if (!p.wanted && p.tex) unloadTex(p);
  }
}
function loadTex(p) {
  p.loading = true;
  const myGen = gen;
  renderQueue = renderQueue.then(async () => {
    if (myGen !== gen) return;
    if (!p.wanted) { p.loading = false; return; }
    try {
      const cv = await renderFn(p.index);
      if (myGen !== gen) return;
      if (!p.wanted) { p.loading = false; return; }
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = MAX_ANISO;
      const m = p.front.material;
      m.map = tex; m.color.set(0xffffff);
      m.emissive.set(0xffffff); m.emissiveMap = tex; m.emissiveIntensity = 0.3;   // keeps text readable in any lighting
      m.needsUpdate = true;
      p.tex = tex;
    } catch (err) { console.error('Page render failed', err); }
    p.loading = false;
  });
}
function unloadTex(p) {
  const m = p.front.material;
  m.map = null; m.emissiveMap = null; m.emissive.set(0x000000); m.emissiveIntensity = 0;
  m.color.set(0xf4f1ea); m.needsUpdate = true;
  p.tex.dispose(); p.tex = null;
}

/* ---------- Page sources ---------- */
function demoRender(i) {
  const w = TEX_W, h = texH;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const rnd = mulberry32(i * 977 + 13);
  g.fillStyle = '#fffdf8'; g.fillRect(0, 0, w, h);
  const m = w * 0.09;
  const accents = ['#c8693a', '#4f7a5a', '#3b5b8a', '#9a4f7a'];
  g.fillStyle = accents[i % accents.length];
  g.fillRect(m, m, w * 0.12, 10);
  g.fillStyle = '#2b2622';
  g.font = `bold ${Math.round(w * 0.065)}px Georgia, serif`;
  g.fillText(`Sample Page ${i + 1}`, m, m + w * 0.1);
  g.font = `${Math.round(w * 0.028)}px Georgia, serif`;
  g.fillStyle = '#7a6d61';
  g.fillText('Upload your own PDF to replace these pages', m, m + w * 0.16);
  let y = m + w * 0.24;
  const hasImage = i % 2 === 0;
  while (y < h - m * 1.6) {
    if (hasImage && Math.abs(y - h * 0.5) < 10) {
      g.fillStyle = accents[(i + 1) % accents.length] + '33';
      g.fillRect(m, y, w - m * 2, h * 0.18);
      g.strokeStyle = accents[(i + 1) % accents.length];
      g.lineWidth = 4; g.strokeRect(m, y, w - m * 2, h * 0.18);
      y += h * 0.18 + 40;
      continue;
    }
    const lw = (w - m * 2) * (rnd() < 0.15 ? 0.4 + rnd() * 0.3 : 0.88 + rnd() * 0.12);
    g.fillStyle = '#cfc8bd';
    g.fillRect(m, y, lw, w * 0.012);
    y += w * 0.034;
    if (rnd() < 0.12) y += w * 0.03;
  }
  g.fillStyle = '#9b8f84';
  g.font = `${Math.round(w * 0.026)}px Georgia, serif`;
  g.textAlign = 'center';
  g.fillText(`— ${i + 1} —`, w / 2, h - m * 0.7);
  return c;
}
let pdfDoc = null;
async function pdfRender(i) {
  const page = await pdfDoc.getPage(i + 1);
  const vp1 = page.getViewport({ scale: 1 });
  const scale = Math.min(TEX_W / vp1.width, texH / vp1.height);
  const vp = page.getViewport({ scale });
  const c = document.createElement('canvas');
  c.width = TEX_W; c.height = texH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp, transform: [1, 0, 0, 1, (TEX_W - vp.width) / 2, (texH - vp.height) / 2] }).promise;
  return c;
}
async function loadPDF(file) {
  if (rec.active) { setStatus('Stop the recording before loading a new PDF.'); return; }
  if (!pdfjsReady) { setStatus('PDF.js failed to load. Check your internet connection.'); return; }
  if (!file || file.type !== 'application/pdf') { setStatus('Please choose a valid PDF file.'); return; }
  try {
    setStatus(`Loading “${file.name}”…`);
    const data = new Uint8Array(await file.arrayBuffer());
    pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    const first = await pdfDoc.getPage(1);
    const vp = first.getViewport({ scale: 1 });
    const count = Math.min(pdfDoc.numPages, 1000);
    buildPages(count, vp.height / vp.width, pdfRender);
    setStatus(`Loaded “${file.name}” — ${count} page${count > 1 ? 's' : ''}. Set which pages to feature, then press Start or Record.`);
  } catch (err) {
    console.error(err);
    setStatus('Could not read that PDF (it may be encrypted or corrupted).');
  }
}

/* ---------- Stack layout ---------- */
function updateStacks() {
  const tops = [];
  [stackA, stackB].forEach(st => {
    const n = st.arr.length;
    setBlock(st.block, st.pos, n > 0 ? (n - 1) * THICK : 0);
    if (n) { const top = st.arr[n - 1]; restPose(top, st.pos, n - 1); tops.push(top); }
  });
  pages.forEach(p => {
    const shouldShow = tops.includes(p) || !!p.flight;
    if (shouldShow) {
      if (p.outer.parent !== scene) scene.add(p.outer);
      p.outer.visible = true;
    } else {
      p.outer.visible = false;
      if (p.outer.parent === scene) scene.remove(p.outer);
    }
  });
  refreshTextures();
  updateUI();
}

/* ------------------------------------------------------------------
   Page animations
   hero: lift to a straight-on reading pose → hold → lay onto the viewed pile
   flip: quick flick from the stack to the pile
------------------------------------------------------------------ */
const _hp = new THREE.Vector3();
function heroPos(out) { return out.set(0, TABLE_H + 0.1 + pageH / 2, 0.30); }

function launchPage(now, type) {
  const p = stackA.arr.pop();
  const slot = stackB.arr.length + stackB.incoming;
  stackB.incoming++;
  p.slot = slot;
  const toRest = new THREE.Vector3(STACK_B.x + p.jitter.x, BASE_Y + slot * THICK, STACK_B.z + p.jitter.z);
  const from = p.outer.position.clone();
  if (type === 'hero') {
    p.flight = { type: 'hero', t0: now, phase: 'lift', liftDur: 1.15 / speed, putDur: 1.0 / speed, hold: holdSec,
      from, toRest, yaw0: p.outer.rotation.y, yaw1: p.jitter.yaw, holdStart: 0 };
    heroPage = p;
    sfxPickup(STACK_A.x); sfxFlight(1.15 / speed, STACK_A.x, 0);
  } else {
    p.flight = { type: 'flip', t0: now, dur: 0.5 / speed, from, to: toRest, yaw0: p.outer.rotation.y, yaw1: p.jitter.yaw,
      arc: 0.22 + Math.random() * 0.08, spin: (Math.random() - 0.5) * 0.6 };
    const last = events[events.length - 1];
    if (last && last.type === 'flip' && last.to === p.index) last.to = p.index + 1;
    else events.push({ t: now - tlT0, type: 'flip', from: p.index + 1, to: p.index + 1 });
    sfxFlight(0.5 / speed, STACK_A.x, STACK_B.x);
  }
  p.front.castShadow = p.back.castShadow = true;
  flights.push(p);
  updateStacks();
}

function updateHero(p, now) {
  const f = p.flight;
  const el = now - f.t0;
  heroPos(_hp);
  if (el < f.liftDur) {
    const t = el / f.liftDur, e = easeInOut(t), s = Math.sin(Math.PI * e);
    p.outer.position.lerpVectors(f.from, _hp, e);
    p.outer.position.y += s * 0.10;
    p.outer.rotation.set(e * Math.PI / 2, f.yaw0 * (1 - e), s * 0.18);
    bend(p, 0.10 * s, 0.012 * s, now);
    f.phase = 'lift';
    return;
  }
  if (!f.holdStart) {
    p.outer.position.copy(_hp); p.outer.rotation.set(Math.PI / 2, 0, 0);
    if (!p.tex && el < f.liftDur + 5) return;          // wait (max 5 s) until the page image is ready
    f.holdStart = now; flatten(p);
    events.push({ t: now - tlT0, type: 'hero', page: p.index + 1, hold: f.hold });
    if (capOn) drawCaption(`Page ${p.index + 1} of ${pages.length}`, getText().title || 'Preview');
  }
  const held = now - f.holdStart;
  if (held < f.hold) {
    f.phase = 'hold';
    p.outer.position.set(_hp.x, _hp.y + Math.sin(now * 1.1) * 0.004, _hp.z);
    p.outer.rotation.set(Math.PI / 2, 0, Math.sin(now * 0.6) * 0.004);
    return;
  }
  f.phase = 'put';
  const t = (held - f.hold) / f.putDur;
  if (t >= 1) { land(p, now); return; }
  if (t <= 0.02 && !f.putSfx) { f.putSfx = true; sfxFlight(f.putDur, 0, STACK_B.x); }
  const e = easeInOut(t), s = Math.sin(Math.PI * e);
  p.outer.position.lerpVectors(_hp, f.toRest, e);
  p.outer.position.y += s * 0.06;
  p.outer.rotation.set((1 - e) * Math.PI / 2, f.yaw1 * e, -s * 0.15);
  bend(p, 0.08 * s, 0.012 * s, now);
}

function updateFlip(p, now) {
  const f = p.flight;
  const t = (now - f.t0) / f.dur;
  if (t >= 1) { land(p, now); return; }
  const e = easeInOut(Math.max(0, t)), s = Math.sin(Math.PI * e);
  p.outer.position.lerpVectors(f.from, f.to, e);
  p.outer.position.y += s * f.arc;
  p.outer.position.z += s * 0.1;
  p.outer.rotation.set(Math.sin(t * Math.PI * 3) * 0.05 * s, THREE.MathUtils.lerp(f.yaw0, f.yaw1, e) + s * f.spin, Math.sin(2 * Math.PI * e) * 0.35);
  bend(p, Math.sin(2 * Math.PI * e) * 0.06, 0.014 * s, now);
}

function land(p, now) {
  const wasHero = p.flight && p.flight.type === 'hero';
  p.flight = null;
  flatten(p);
  p.front.castShadow = p.back.castShadow = false;
  stackB.incoming--;
  stackB.arr.push(p);
  restPose(p, STACK_B, stackB.arr.length - 1);
  flights = flights.filter(f => f !== p);
  if (p === heroPage) heroPage = null;
  if (wasHero) nextAt = now + 0.15;
  sfxLand(STACK_B.x);
  updateStacks();
}

function resetAll(silent) {
  playing = false; finished = false;
  timers.length = 0;
  flights.forEach(p => (p.flight = null));
  flights = [];
  pages.forEach(p => { flatten(p); p.front.castShadow = p.back.castShadow = false; p.slot = -1; });
  resetStacks();
  updateStacks();
  if (!silent) setStatus('Pages reset to the unviewed stack.');
}

function startTransfer() {
  refreshFeatured();
  playing = true; finished = false;
  nextAt = lastNow + 0.4;
  if (!rec.active) { events.length = 0; tlT0 = lastNow; }
  setStatus(`Showing ${featured.size} page${featured.size === 1 ? '' : 's'} in close-up${featured.size < pages.length ? ', the rest flip past' : ''}…`);
  updateUI();
}
function togglePlay() {
  if (!pages.length || rec.active) return;
  if (audio.enabled) ensureAudio();
  if (finished || (!stackA.arr.length && !flights.length)) { resetAll(true); startTransfer(); return; }
  if (playing) { playing = false; setStatus('Paused. Click again to continue.'); }
  else startTransfer();
  updateUI();
}
function finishTransfer() {
  playing = false; finished = true;
  setStatus('Preview complete. Press Replay, or Record to capture it.');
  updateUI();
  if (rec.active && rec.phase === 'run') endRecording(false);
}

/* ------------------------------------------------------------------
   Click hint
------------------------------------------------------------------ */
const hint = new THREE.Group();
const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 24),
  new THREE.MeshStandardMaterial({ color: 0xff8a3d, emissive: 0xff6a1a, emissiveIntensity: 0.9 }));
arrow.rotation.x = Math.PI;
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.006, 12, 64),
  new THREE.MeshBasicMaterial({ color: 0xffa45c, transparent: true, opacity: 0.8 }));
ring.rotation.x = -Math.PI / 2;
hint.add(arrow, ring);
hint.userData.pick = 'play';
scene.add(hint);
const clickLabel = $('clickLabel');

/* ------------------------------------------------------------------
   Interaction
------------------------------------------------------------------ */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let downPos = null;
function pick(e) {
  const r = viewRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const targets = [pcScreen.mesh, tabScreen.mesh, deskLamp, lamp, table1, blockA, blockB];
  if (hint.visible) targets.push(hint);
  [stackA, stackB].forEach(s => { if (s.arr.length) targets.push(s.arr[s.arr.length - 1].outer); });
  flights.forEach(p => targets.push(p.outer));
  const hits = raycaster.intersectObjects(targets, true);
  if (!hits.length) return null;
  let o = hits[0].object;
  while (o) { if (o.userData && o.userData.pick) return o; o = o.parent; }
  return null;
}
canvas.addEventListener('pointerdown', e => (downPos = { x: e.clientX, y: e.clientY }));
canvas.addEventListener('pointerup', e => {
  if (!downPos) return;
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  downPos = null;
  if (moved >= 6) return;
  const o = pick(e);
  if (!o) return;
  if (o.userData.pick === 'play') togglePlay();
  else if (o.userData.pick === 'screen') screenClick(o.userData.screen);
  else if (o.userData.pick === 'lamp') toggleLamps();
});
canvas.addEventListener('pointermove', e => {
  if (e.buttons) return;
  canvas.style.cursor = pick(e) ? 'pointer' : 'grab';
});

/* ------------------------------------------------------------------
   Manual camera views
------------------------------------------------------------------ */
const VIEWS = {
  overview: { pos: [0.3, 1.7, 2.6], look: [0, 0.9, 0] },
  table:    { pos: [0.0, 1.3, 1.5], look: [0, 0.85, 0.05] },
  top:      { pos: [0.0, 2.9, 0.5], look: [0, 0.8, 0.05] },
  side:     { pos: [2.7, 1.3, 1.4], look: [0, 0.8, 0] },
  desk:     { pos: [1.2, 1.5, -0.4], look: [3.2, 0.95, -3.0] },
};
let viewTween = null;
$('viewChips').addEventListener('click', e => {
  const k = e.target.dataset && e.target.dataset.view;
  if (!k) return;
  if (cineActive) { setStatus('Pause the preview or turn off the cinematic camera to move the camera manually.'); return; }
  const V = VIEWS[k];
  viewTween = { t0: lastNow, dur: 1.3, fp: camera.position.clone(), ft: controls.target.clone(),
    tp: new THREE.Vector3(...V.pos), tt: new THREE.Vector3(...V.look) };
});

/* ------------------------------------------------------------------
   Cinematic shots
------------------------------------------------------------------ */
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const shot = { pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), k: 2 };
function frameDist(needW, needH) {
  const tf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return Math.max(needH / (2 * tf), needW / (2 * tf * camera.aspect));
}
function wideShot(now, extra) {
  const d = clamp(frameDist(1.7, 1.3), 1.9, 3.3) + extra;
  shot.look.set(0, 0.95, 0.05);
  shot.pos.set(Math.sin(now * 0.2) * 0.25, 1.45, 0.05 + Math.min(d, 3.35));
  shot.k = 1.2;
  return shot;
}
function shotFor(now) {
  shot.up.set(0, 1, 0);

  // Professional recording opener: use a wider establishing view so the
  // tabletop plant and flower vase are visible together with the book, then
  // rise into a true overhead view before the existing cinematic sequence.
  if (rec.active && rec.phase === 'camera-front') {
    const topY = BASE_Y + Math.max(0, stackA.arr.length - 1) * THICK;
    const focusY = Math.min(topY, TABLE_H + 0.08);
    const openerW = Math.max(pageW * 1.12, 2.35); // include the full tabletop width
    const openerH = Math.max(pageH * 0.72, 1.45); // include the flowers above the table
    const d = frameDist(openerW, openerH) * 1.08; // framing margin around the props
    shot.look.set(T1X, focusY, 0);
    shot.pos.set(T1X, focusY + d * 0.65, d * 0.76);
    shot.k = 3.2;
    return shot;
  }
  if (rec.active && rec.phase === 'camera-top') {
    const topY = BASE_Y + Math.max(0, stackA.arr.length - 1) * THICK;
    const d = frameDist(pageW * 1.12, pageH * 1.12);
    shot.look.set(STACK_A.x, topY, STACK_A.z);
    shot.pos.set(STACK_A.x, topY + d, STACK_A.z);
    // Point the top of the page toward the top of the video frame.
    shot.up.set(0, 0, -1);
    shot.k = 3.2;
    return shot;
  }
  if (rec.active && rec.phase === 'intro') return wideShot(now, Math.max(0, 0.5 - 0.12 * (now - rec.phaseT)));
  if (rec.active && rec.phase === 'outro') return wideShot(now, Math.min(0.4, 0.15 * (now - rec.phaseT)));
  const nextP = stackA.arr[stackA.arr.length - 1];
  const heroMode = heroPage || (playing && nextP && featured.has(nextP.index));
  if (heroMode) {
    heroPos(_hp);
    let d = frameDist(pageW / 0.9, pageH / 0.9);
    const f = heroPage && heroPage.flight;
    if (f && f.holdStart) d *= 1 - 0.04 * clamp((now - f.holdStart) / Math.max(0.1, f.hold), 0, 1);   // slow push-in
    shot.look.copy(_hp);
    shot.pos.set(_hp.x + Math.sin(now * 0.5) * 0.01, _hp.y + 0.005, _hp.z + d);
    shot.k = 2.2;
    return shot;
  }
  const d = clamp(frameDist(1.5, 0.9), 1.1, 3.3);
  shot.look.set(0, TABLE_H + 0.1, 0.08);
  shot.pos.set(0, TABLE_H + 0.1 + d * 0.5, 0.08 + d * 0.87);
  shot.k = 1.8;
  return shot;
}

/* ------------------------------------------------------------------
   Title / closing card (drawn over the frame, so it is recorded)
------------------------------------------------------------------ */
const cardCanvas = document.createElement('canvas');
const cardCtx = cardCanvas.getContext('2d');
const cardMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
const cardMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cardMat);
cardMesh.renderOrder = 999; cardMesh.frustumCulled = false; cardMesh.visible = false; cardMesh.position.z = -0.5;
camera.add(cardMesh);
let cardAlpha = 0, cardTarget = 0, cardKind = '', cardAspect = 0;

function wrapText(g, text, cx, y, maxW, lineH) {
  const words = text.split(/\s+/); let line = '';
  const lines = [];
  words.forEach(w => {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  });
  if (line) lines.push(line);
  lines.forEach((l, i) => g.fillText(l, cx, y + i * lineH));
  return y + lines.length * lineH;
}
function drawCard(kind) {
  const asp = camera.aspect, tx = getText();
  const W = asp < 1 ? 1080 : Math.round(1080 * asp), H = asp < 1 ? Math.round(1080 / asp) : 1080;
  if (cardCanvas.width !== W || cardCanvas.height !== H) {
    cardCanvas.width = W; cardCanvas.height = H;
    if (cardMat.map) cardMat.map.dispose();
    cardMat.map = new THREE.CanvasTexture(cardCanvas);
    cardMat.map.colorSpace = THREE.SRGBColorSpace;
    cardMat.needsUpdate = true;
  }
  const g = cardCtx, u = Math.min(W, H) / 1080, cx = W / 2;
  g.clearRect(0, 0, W, H);
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, 'rgba(20,16,12,0.93)'); bg.addColorStop(1, 'rgba(44,31,22,0.93)');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const sans = '"Segoe UI", system-ui, sans-serif';
  if (kind === 'intro') {
    g.fillStyle = '#ff9d54'; g.fillRect(cx - 60 * u, H * 0.34, 120 * u, 8 * u);
    g.fillStyle = '#ffffff'; g.font = `bold ${104 * u}px ${sans}`;
    let y = wrapText(g, tx.title, cx, H * 0.34 + 150 * u, W * 0.82, 120 * u);
    if (tx.tag) { g.fillStyle = 'rgba(255,255,255,0.78)'; g.font = `${48 * u}px ${sans}`; y = wrapText(g, tx.tag, cx, y + 30 * u, W * 0.8, 62 * u); }
    g.fillStyle = '#ff9d54'; g.font = `600 ${38 * u}px ${sans}`;
    g.fillText(`${pages.length} page${pages.length === 1 ? '' : 's'} · preview`, cx, y + 70 * u);
  } else {
    let y = H * 0.30;
    if (tx.title) { g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = `600 ${58 * u}px ${sans}`; y = wrapText(g, tx.title, cx, y, W * 0.82, 72 * u); }
    if (tx.offer) { y += 40 * u; g.fillStyle = '#ffb36b'; g.font = `bold ${96 * u}px ${sans}`; y = wrapText(g, tx.offer, cx, y + 60 * u, W * 0.84, 112 * u); }
    if (tx.cta) {
      y += 50 * u;
      g.font = `bold ${56 * u}px ${sans}`;
      const tw = Math.min(W * 0.86, g.measureText(tx.cta).width + 110 * u), ph = 110 * u;
      rr(g, cx - tw / 2, y, tw, ph, ph / 2);
      g.fillStyle = '#ff8a3d'; g.fill();
      g.fillStyle = '#ffffff';
      g.fillText(tx.cta, cx, y + ph / 2 + 20 * u, W * 0.82);
    }
  }
  cardMat.map.needsUpdate = true;
  cardKind = kind; cardAspect = asp;
  const vh = 2 * 0.5 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  cardMesh.scale.set(vh * asp * 1.004, vh * 1.004, 1);
}

/* ------------------------------------------------------------------
   Recording (silent by default; video-only unless sound effects are on)
------------------------------------------------------------------ */
const rec = { active: false, phase: '', phaseT: 0, recorder: null, chunks: [], mime: '', stream: null, t0: 0, w: 1080, h: 1920, lastUI: 0, stopping: false };
const recBtn = $('recBtn'), recInfo = $('recInfo'), fmtSel = $('fmtSel'), prevFrame = $('prevFrame');

function selFrame() { const [w, h] = fmtSel.value.split('x').map(Number); return { w, h }; }
function restoreFrame() { frameLock = prevFrame.checked ? selFrame() : null; applySize(); }

function pickMime() {
  const list = ['video/mp4;codecs=avc1.640033,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return list.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

function recordingBitrate(w, h, fps) {
  // Use a generous pixel-rate budget so fine paper text and scene textures
  // retain the preview's clarity after MediaRecorder encoding.
  return clamp(Math.round(w * h * fps * 0.28), 8e6, 80e6);
}

function startRecording() {
  if (rec.active) { endRecording(true); return; }
  if (!window.MediaRecorder || !canvas.captureStream) { recInfo.textContent = 'Recording is not supported in this browser. Try Chrome, Edge or Safari 17+.'; return; }
  if (!pages.length) return;
  const { w, h } = selFrame();
  const fps = (w > h && h <= 1440) ? 60 : 30;
  const bps = recordingBitrate(w, h, fps);
  if (audio.enabled) ensureAudio();
  rec.mime = pickMime();
  resetAll(true);
  timers.length = 0; events.length = 0;
  const now0 = clock.getElapsedTime();
  rec.active = true; rec.phase = 'camera-front'; rec.phaseT = now0; rec.t0 = now0; tlT0 = now0;
  rec.w = w; rec.h = h; rec.chunks = []; rec.stopping = false;
  frameLock = { w, h }; applySize();
  document.body.classList.add('recording');
  fade.v = 1; fade.target = 0; fade.dur = 1.0;

  const stream = canvas.captureStream(fps);
  if (audio.enabled && audio.recDest) audio.recDest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  rec.stream = stream;
  const opts = { videoBitsPerSecond: bps };
  if (audio.enabled && audio.recDest) opts.audioBitsPerSecond = 192000;
  if (rec.mime) opts.mimeType = rec.mime;
  try { rec.recorder = new MediaRecorder(stream, opts); }
  catch (err) {
    console.error(err);
    try { rec.recorder = new MediaRecorder(stream); } catch (e2) { abortRecording('Could not start the recorder.'); return; }
  }
  rec.mime = rec.recorder.mimeType || rec.mime;
  rec.recorder.ondataavailable = e => { if (e.data && e.data.size) rec.chunks.push(e.data); };
  rec.recorder.onstop = finalizeRecording;
  rec.recorder.start(1000);

  recBtn.textContent = '⏹ Stop & save'; recBtn.classList.add('on');
  setStatus('Recording… keep this tab visible until it finishes.');

  const hasTitle = !!getText().title;
  const introT = hasTitle ? 2.6 : 1.2;
  const frontShotT = 1.35;
  const topShotT = 1.35; // time for the camera to rise and settle overhead
  const topHoldT = 3.0;  // keep the settled top view on screen for three full seconds

  // First show the pages from the front, then move overhead and hold there
  // for three seconds. Once the hold finishes, continue with the original
  // wide intro and page shots.
  after(frontShotT, () => {
    if (!rec.active || rec.stopping) return;
    rec.phase = 'camera-top';
    rec.phaseT = clock.getElapsedTime();
  });
  after(frontShotT + topShotT + topHoldT, () => {
    if (!rec.active || rec.stopping) return;
    rec.phase = 'intro';
    rec.phaseT = clock.getElapsedTime();
    if (hasTitle) {
      drawCard('intro'); cardAlpha = 1; cardTarget = 1;
      events.push({ t: clock.getElapsedTime() - rec.t0, type: 'card', text: 'Title card' });
      after(introT, () => (cardTarget = 0));
    }
    after(introT + 0.8, () => {
      if (!rec.active || rec.stopping) return;
      rec.phase = 'run';
      rec.phaseT = clock.getElapsedTime();
      startTransfer();
    });
  });
  updateUI();
}

function endRecording(fast) {
  if (!rec.active || rec.stopping) return;
  rec.stopping = true;
  playing = false;
  rec.phase = 'outro'; rec.phaseT = clock.getElapsedTime();
  const tx = getText();
  if (fast) { fade.dur = 0.8; fade.target = 1; after(1.0, stopRecorder); return; }
  if (tx.offer || tx.cta) {
    after(0.8, () => { drawCard('end'); cardTarget = 1; events.push({ t: clock.getElapsedTime() - rec.t0, type: 'card', text: 'Closing card' }); });
    after(4.6, () => { fade.dur = 0.9; fade.target = 1; });
    after(5.7, stopRecorder);
  } else {
    after(1.8, () => { fade.dur = 0.9; fade.target = 1; });
    after(2.9, stopRecorder);
  }
  setStatus('Wrapping up the recording…');
}
function stopRecorder() {
  if (rec.recorder && rec.recorder.state !== 'inactive') rec.recorder.stop();
  else finalizeRecording();
}
function abortRecording(msg) {
  rec.active = false; restoreFrame();
  document.body.classList.remove('recording');
  fade.v = 0; fade.target = 0; cardAlpha = 0; cardTarget = 0;
  recBtn.textContent = '⏺ Record preview video'; recBtn.classList.remove('on');
  recInfo.textContent = msg;
  updateUI();
}
function buildSheet(total) {
  const lines = ['PAGE PREVIEW — TIMING SHEET', `Video length ${mmss(total)} · ${rec.w}×${rec.h} · ${pages.length} pages · hold ${holdSec.toFixed(1)} s per featured page`, ''];
  events.forEach(ev => {
    if (ev.type === 'card') lines.push(`${mmss(ev.t)}  ${ev.text}`);
    else if (ev.type === 'hero') lines.push(`${mmss(ev.t)}  Page ${ev.page} on screen (${ev.hold.toFixed(1)} s)`);
    else if (ev.type === 'flip') lines.push(`${mmss(ev.t)}  ${ev.from === ev.to ? `Page ${ev.from} flips past` : `Fast flip of pages ${ev.from}–${ev.to}`}`);
  });
  lines.push('', 'Times are from the start of the video. Place your voiceover lines at these marks.');
  return lines.join('\n');
}
function finalizeRecording() {
  if (rec.stream) rec.stream.getTracks().forEach(t => t.stop());
  const total = clock.getElapsedTime() - rec.t0;
  const type = (rec.mime || 'video/webm').split(';')[0];
  const ext = type.includes('mp4') ? 'mp4' : 'webm';
  const blob = new Blob(rec.chunks, { type });
  const url = URL.createObjectURL(blob);
  const d = new Date(), p2 = n => String(n).padStart(2, '0');
  const base = `page-preview-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
  const name = `${base}.${ext}`;
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  events.push({ t: total, type: 'card', text: 'End of video' });
  const sUrl = URL.createObjectURL(new Blob([buildSheet(total)], { type: 'text/plain' }));
  recInfo.innerHTML = `Saved <b>${name}</b> (${(blob.size / 1048576).toFixed(1)} MB, ${rec.w}×${rec.h}${audio.enabled ? ', with sound' : ', no audio'}). <a href="${url}" download="${name}">Save again</a><br><a href="${sUrl}" download="${base}-timing.txt">Download timing sheet</a>`;
  rec.active = false; rec.phase = ''; rec.chunks = []; rec.recorder = null;
  restoreFrame();
  document.body.classList.remove('recording');
  fade.v = 0; fade.target = 0; cardAlpha = 0; cardTarget = 0;
  recBtn.textContent = '⏺ Record preview video'; recBtn.classList.remove('on');
  setStatus('Recording saved to your downloads.');
  updateUI();
}

/* ------------------------------------------------------------------
   UI
------------------------------------------------------------------ */
const ui = $('ui'), showControlsBtn = $('showControls'), playBtn = $('playBtn'), resetBtn = $('resetBtn'), statusEl = $('status'), bar = $('bar'), countEl = $('count');
function setStatus(msg) { statusEl.textContent = msg; }
function setControlsHidden(hidden) {
  ui.classList.toggle('is-hidden', hidden);
  showControlsBtn.hidden = !hidden;
  showControlsBtn.setAttribute('aria-expanded', String(!hidden));
}
function updateUI() {
  const total = pages.length;
  playBtn.textContent = rec.active ? '⏺ Recording…' : (playing ? '⏸ Pause' : (finished ? '↺ Replay' : '▶ Start'));
  playBtn.disabled = rec.active; resetBtn.disabled = rec.active;
  bar.style.width = total ? `${(stackB.arr.length / total) * 100}%` : '0%';
  countEl.textContent = `Waiting: ${stackA.arr.length} · Moving: ${flights.length} · Viewed: ${stackB.arr.length} · Close-ups: ${featured.size}`;
}

playBtn.addEventListener('click', togglePlay);
resetBtn.addEventListener('click', () => resetAll(false));
$('pdfInput').addEventListener('change', e => { loadPDF(e.target.files[0]); e.target.value = ''; });
$('feat').addEventListener('input', () => { refreshFeatured(); updateUI(); });
$('speed').addEventListener('input', e => { speed = parseFloat(e.target.value); $('speedVal').textContent = speed.toFixed(1) + '×'; });
$('hold').addEventListener('input', e => { holdSec = parseFloat(e.target.value); $('holdVal').textContent = holdSec.toFixed(1) + ' s'; });
$('collapse').addEventListener('click', () => setControlsHidden(true));
showControlsBtn.addEventListener('click', () => setControlsHidden(false));
window.addEventListener('keydown', e => { if (e.key === 'Escape' && !ui.classList.contains('is-hidden')) setControlsHidden(true); });
$('cine').addEventListener('change', e => (cineOn = e.target.checked));
$('capOn').addEventListener('change', e => (capOn = e.target.checked));
recBtn.addEventListener('click', startRecording);
fmtSel.addEventListener('change', () => {
  previewOutput = selFrame();
  if (prevFrame.checked && !rec.active) restoreFrame(); else if (!rec.active) applySize();
});
prevFrame.addEventListener('change', () => { if (!rec.active) restoreFrame(); });

$('sndOn').addEventListener('change', e => {
  audio.enabled = e.target.checked;
  if (audio.enabled) ensureAudio();
  if (audio.bus) audio.bus.gain.value = audio.enabled ? 1 : 0;
});
$('vol').addEventListener('input', e => {
  audio.vol = parseFloat(e.target.value);
  if (audio.monitor) audio.monitor.gain.value = audio.vol;
});
$('ambOn').addEventListener('change', e => {
  audio.ambience = e.target.checked;
  if (audio.ambience) ensureAudio();
  if (audio.ambGain) audio.ambGain.gain.value = audio.ambience ? 1 : 0;
});
$('scrAud').addEventListener('change', e => {
  audio.screen = e.target.checked;
  ensureAudio();
  if (audio.screenGain) audio.screenGain.gain.value = audio.screen ? 0.8 : 0;
});
$('pcBtn').addEventListener('click', () => pcScreen.input.click());
$('tabBtn').addEventListener('click', () => tabScreen.input.click());
pcScreen.input.addEventListener('change', e => { ensureAudio(); loadVideo(pcScreen, e.target.files[0]); e.target.value = ''; });
tabScreen.input.addEventListener('change', e => { ensureAudio(); loadVideo(tabScreen, e.target.files[0]); e.target.value = ''; });

window.addEventListener('keydown', e => {
  if (e.code === 'Space' && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)) { e.preventDefault(); togglePlay(); }
});
const dropOverlay = $('dropOverlay');
window.addEventListener('dragover', e => { e.preventDefault(); dropOverlay.style.display = 'flex'; });
window.addEventListener('dragleave', e => { if (e.relatedTarget === null) dropOverlay.style.display = 'none'; });
window.addEventListener('drop', e => {
  e.preventDefault();
  dropOverlay.style.display = 'none';
  const f = e.dataTransfer.files[0];
  if (f) loadPDF(f);
});
window.addEventListener('resize', () => { if (!frameLock) applySize(); });

/* ------------------------------------------------------------------
   Start with demo pages
------------------------------------------------------------------ */
buildPages(12, Math.SQRT2, demoRender);
setLighting('day', true);

/* ------------------------------------------------------------------
   Main loop
------------------------------------------------------------------ */
const tmpV = new THREE.Vector3();
let lastFrameMs = 0;
function animate() {
  requestAnimationFrame(animate);
  const frameMs = performance.now();
  const highMotion = playing || rec.active || cineActive || !!viewTween || flights.length > 0 || frameMs < controlsBusyUntil;
  if (!highMotion && frameMs - lastFrameMs < 1000 / 30) return;
  lastFrameMs = frameMs;
  const now = clock.getElapsedTime();
  lastNow = now;
  const dt = Math.min(0.1, now - prevNow);
  prevNow = now;

  for (let i = timers.length - 1; i >= 0; i--) {
    if (now >= timers[i].t) { const f = timers.splice(i, 1)[0].fn; f(); }
  }

  // Transfer engine: pages go one by one from the left stack to the right pile
  if (playing) {
    const nextP = stackA.arr[stackA.arr.length - 1];
    if (nextP) {
      if (featured.has(nextP.index)) {
        if (flights.length === 0 && now >= nextAt) launchPage(now, 'hero');
      } else if (!heroPage && now - lastFlip >= 0.14 / speed) {
        launchPage(now, 'flip'); lastFlip = now;
      }
    } else if (flights.length === 0) {
      finishTransfer();
    }
  }
  for (const p of [...flights]) {
    if (!p.flight) continue;
    if (p.flight.type === 'hero') updateHero(p, now); else updateFlip(p, now);
  }

  // Camera
  const cineWanted = cineOn && (playing || rec.active);
  if (cineWanted && !cineActive) {
    cineActive = true; controls.enabled = false; viewTween = null;
    camPos.copy(camera.position); camLook.copy(controls.target);
  } else if (!cineWanted && cineActive) {
    cineActive = false; controls.enabled = true;
    camera.up.set(0, 1, 0);
    controls.target.copy(camLook); controls.update();
  }
  if (cineActive) {
    const s = shotFor(now);
    const k = 1 - Math.exp(-dt * s.k);
    camPos.lerp(s.pos, k); camLook.lerp(s.look, k);
    camera.up.lerp(s.up, k).normalize();
    camera.position.copy(camPos);
    camera.position.x += Math.sin(now * 0.9) * 0.002;
    camera.position.y += Math.sin(now * 1.3) * 0.0015;
    camera.lookAt(camLook);
  } else {
    if (viewTween) {
      const t = Math.min(1, (now - viewTween.t0) / viewTween.dur), e = easeInOut(t);
      camera.position.lerpVectors(viewTween.fp, viewTween.tp, e);
      controls.target.lerpVectors(viewTween.ft, viewTween.tt, e);
      if (t >= 1) viewTween = null;
    }
    controls.update();
  }

  // Key light + optional page label while a page is being shown
  const hf = heroPage && heroPage.flight;
  const showing = !!(hf && hf.phase !== 'put');
  keyAmt += ((showing ? 0.8 : 0) - keyAmt) * (1 - Math.exp(-dt * 3));
  heroPos(_hp);
  keyLight.position.set(0, _hp.y + 0.45, _hp.z + 1.1);
  const capWant = (hf && hf.phase === 'hold' && capOn) ? 1 : 0;
  capAlpha += (capWant - capAlpha) * (1 - Math.exp(-dt * 6));
  capMat.opacity = capAlpha; capMesh.visible = capAlpha > 0.01;

  // Title / closing card and fade (both are part of the recorded frame)
  if (cardKind && Math.abs(camera.aspect - cardAspect) > 0.001) drawCard(cardKind);
  cardAlpha += (cardTarget - cardAlpha) * (1 - Math.exp(-dt * 5));
  cardMat.opacity = cardAlpha; cardMesh.visible = cardAlpha > 0.01 && !!cardMat.map;
  if (fade.v !== fade.target) {
    const step = dt / fade.dur;
    fade.v = fade.v < fade.target ? Math.min(fade.target, fade.v + step) : Math.max(fade.target, fade.v - step);
  }
  fadeMesh.material.opacity = fade.v; fadeMesh.visible = fade.v > 0.002;

  stepLighting(dt);
  screens.forEach(s => drawScreen(s, now));

  // Click hint
  const showHint = !playing && !rec.active && stackA.arr.length > 0 && flights.length === 0;
  hint.visible = showHint;
  const topY = BASE_Y + Math.max(0, stackA.arr.length - 1) * THICK;
  if (showHint) {
    hint.position.set(STACK_A.x, topY, STACK_A.z);
    arrow.position.y = 0.3 + Math.sin(now * 3.2) * 0.04;
    const k2 = (now * 0.8) % 1;
    ring.position.y = 0.004;
    ring.scale.setScalar(0.65 + k2 * 0.6);
    ring.material.opacity = 0.9 * (1 - k2);
    tmpV.set(STACK_A.x, topY + 0.4, STACK_A.z).project(camera);
    if (tmpV.z < 1 && tmpV.z > -1) {
      const r = viewRect();
      clickLabel.style.display = 'block';
      clickLabel.style.left = `${r.left + (tmpV.x * 0.5 + 0.5) * r.width}px`;
      clickLabel.style.top = `${r.top + (-tmpV.y * 0.5 + 0.5) * r.height}px`;
    } else clickLabel.style.display = 'none';
  } else {
    clickLabel.style.display = 'none';
  }

  if (rec.active && now - rec.lastUI > 0.5) {
    rec.lastUI = now;
    const s = Math.floor(now - rec.t0);
    recInfo.textContent = `● REC ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')} · ${rec.w}×${rec.h} · ${rec.mime.includes('mp4') ? 'MP4' : 'WebM'}${audio.enabled ? '' : ' · silent'}`;
  }

  tablePlant.rotation.z = Math.sin(now * 0.8) * 0.015;
  renderer.render(scene, camera);
}
animate();
