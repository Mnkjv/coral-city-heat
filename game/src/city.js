// Coral City Heat — city construction.
// Builds the whole static world into the scene: a painted ground canvas
// (roads, lane dashes, sidewalks, sand), instanced streetlights and palms,
// window-textured buildings, the beach and the water, plus landmark sites
// (hospital, wash garage, chop shop, marina, Marlin warehouse). Every solid
// building registers an AABB in `colliders` for physics to test against.

import * as THREE from 'three';
import { CITY, PLACES } from './config.js';
import { rand, randRange, pickRandom } from './random.js';

function makeWindowTexture(baseColor, litRatio) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 64, 128);
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 5; col++) {
      const lit = rand() < litRatio;
      ctx.fillStyle = lit ? '#ffd98a' : '#2b3542';
      ctx.fillRect(5 + col * 12, 6 + row * 10, 8, 6);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGroundTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const world = 420; // texture spans -210..210 on both axes
  const toPx = (v) => ((v + 210) / world) * size;
  ctx.fillStyle = '#8f979c';
  ctx.fillRect(0, 0, size, size);
  // Block interiors get a slightly varied pavement tint.
  for (let i = 0; i < CITY.roads.length - 1; i++) {
    for (let j = 0; j < CITY.roads.length - 1; j++) {
      const x0 = CITY.roads[i] + CITY.roadHalf;
      const x1 = CITY.roads[i + 1] - CITY.roadHalf;
      const z0 = CITY.roads[j] + CITY.roadHalf;
      const z1 = CITY.roads[j + 1] - CITY.roadHalf;
      ctx.fillStyle = pickRandom(['#98a0a2', '#a8a49a', '#93a295', '#a29aa0']);
      ctx.fillRect(toPx(x0), toPx(z0), toPx(x1) - toPx(x0), toPx(z1) - toPx(z0));
    }
  }
  // Roads: asphalt strips both directions.
  ctx.fillStyle = '#33373d';
  for (const r of CITY.roads) {
    ctx.fillRect(toPx(r - CITY.roadHalf), toPx(-CITY.half), (CITY.roadHalf * 2 / world) * size, (CITY.half * 2 / world) * size);
    ctx.fillRect(toPx(-CITY.half), toPx(r - CITY.roadHalf), (CITY.half * 2 / world) * size, (CITY.roadHalf * 2 / world) * size);
  }
  // Lane dashes down the centre of every road.
  ctx.fillStyle = '#e8c85a';
  for (const r of CITY.roads) {
    for (let d = -CITY.half; d < CITY.half; d += 8) {
      ctx.fillRect(toPx(r) - 1, toPx(d), 2, 10);
      ctx.fillRect(toPx(d), toPx(r) - 1, 10, 2);
    }
  }
  // Sidewalk rims.
  ctx.strokeStyle = '#c9ced1';
  ctx.lineWidth = 2;
  for (const r of CITY.roads) {
    ctx.strokeRect(toPx(r - CITY.walkHalf), toPx(-CITY.half), (CITY.walkHalf * 2 / world) * size, (CITY.half * 2 / world) * size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeLabelSprite(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(12, 3, 1);
  return sprite;
}

export function buildCity(scene) {
  const colliders = [];
  const addCollider = (cx, cz, w, d) => {
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  };

  scene.background = new THREE.Color(0x87b8d9);
  scene.fog = new THREE.Fog(0x9fc3dd, 180, 520);
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.9);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(sun.target);

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Beach sand and water on the east edge.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 420),
    new THREE.MeshLambertMaterial({ color: 0xe6cf9a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CITY.beachX + 22, 0.02, 0);
  scene.add(sand);
  const waterCanvas = document.createElement('canvas');
  waterCanvas.width = 64;
  waterCanvas.height = 64;
  const wctx = waterCanvas.getContext('2d');
  wctx.fillStyle = '#2d7fb8';
  wctx.fillRect(0, 0, 64, 64);
  wctx.strokeStyle = '#7fc4ea';
  for (let i = 0; i < 8; i++) {
    wctx.beginPath();
    wctx.moveTo(0, i * 8 + 4);
    wctx.lineTo(64, i * 8 + 4);
    wctx.stroke();
  }
  const waterTex = new THREE.CanvasTexture(waterCanvas);
  waterTex.wrapS = THREE.RepeatWrapping;
  waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(6, 30);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 420),
    new THREE.MeshLambertMaterial({ map: waterTex }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(CITY.waterX + 58, 0.05, 0);
  scene.add(water);

  // Buildings: one shared unit box, a handful of window materials.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const facadeColors = ['#d8d2c4', '#b9c4cc', '#e3c9b0', '#c2b6d9', '#aebfc0', '#e0b7b0'];
  const materials = facadeColors.map((color) => new THREE.MeshLambertMaterial({ map: makeWindowTexture(color, 0.4) }));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a5f66 });

  function addBuilding(cx, cz, w, h, d, mat) {
    const mesh = new THREE.Mesh(boxGeo, mat || pickRandom(materials));
    mesh.scale.set(w, h, d);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const roof = new THREE.Mesh(boxGeo, roofMat);
    roof.scale.set(w + 0.4, 0.5, d + 0.4);
    roof.position.set(cx, h + 0.25, cz);
    scene.add(roof);
    addCollider(cx, cz, w, d);
    return mesh;
  }

  const warehouseBlock = { i: 7, j: 7 }; // block between roads 120..160 on both axes
  for (let i = 0; i < CITY.roads.length - 1; i++) {
    for (let j = 0; j < CITY.roads.length - 1; j++) {
      if (i === warehouseBlock.i && j === warehouseBlock.j) continue;
      const cx = (CITY.roads[i] + CITY.roads[i + 1]) / 2;
      const cz = (CITY.roads[j] + CITY.roads[j + 1]) / 2;
      const layout = rand();
      if (layout < 0.45) {
        addBuilding(cx, cz, randRange(16, 22), randRange(14, 46), randRange(16, 22));
      } else if (layout < 0.8) {
        addBuilding(cx - 7, cz - 7, 11, randRange(8, 30), 11);
        addBuilding(cx + 7, cz + 7, 11, randRange(8, 34), 11);
        if (rand() < 0.6) addBuilding(cx + 7, cz - 7, 11, randRange(6, 18), 11);
      } else {
        addBuilding(cx - 7, cz, 11, randRange(20, 52), 22);
        addBuilding(cx + 8, cz, 9, randRange(6, 14), 9);
      }
    }
  }

  // Landmarks: distinctive low buildings with floating labels.
  function addLandmark(place, w, h, d, color, label, labelColor) {
    const mesh = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color }));
    mesh.scale.set(w, h, d);
    mesh.position.set(place.x, h / 2, place.z);
    mesh.castShadow = true;
    scene.add(mesh);
    addCollider(place.x, place.z, w, d);
    const sprite = makeLabelSprite(label, labelColor || '#ffffff');
    sprite.position.set(place.x, h + 4, place.z);
    scene.add(sprite);
    return mesh;
  }
  addLandmark(PLACES.hospital, 22, 10, 16, 0xf4f6f8, 'HOSPITAL', '#ff5a5a');
  addLandmark(PLACES.washGarage, 16, 6, 14, 0x3f8fbf, 'SPARKLE WASH', '#7fd4ff');
  addLandmark(PLACES.chopShop, 18, 7, 14, 0x8a6a45, 'CHOP SHOP', '#ffd98a');
  addLandmark(PLACES.marina, 14, 5, 10, 0xd9e6ea, 'MARINA', '#3fbfae');
  // The Marlin warehouse fills its block; the M5 marker stands on its street corner.
  const warehouse = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x707a84 }));
  warehouse.scale.set(26, 11, 24);
  warehouse.position.set(142, 5.5, 142);
  warehouse.castShadow = true;
  scene.add(warehouse);
  addCollider(142, 142, 26, 24);
  const whLabel = makeLabelSprite('MARLIN FREIGHT', '#ff8a7a');
  whLabel.position.set(142, 14, 142);
  scene.add(whLabel);

  // Streetlights: instanced poles + emissive heads at intersection corners.
  const lightPositions = [];
  for (let i = 0; i < CITY.roads.length; i += 2) {
    for (let j = 0; j < CITY.roads.length; j += 2) {
      lightPositions.push([CITY.roads[i] + 7.5, CITY.roads[j] + 7.5]);
      lightPositions.push([CITY.roads[i] - 7.5, CITY.roads[j] - 7.5]);
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 5.4, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a4046 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lightPositions.length);
  const headGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, lightPositions.length);
  const dummy = new THREE.Object3D();
  lightPositions.forEach(([x, z], idx) => {
    dummy.position.set(x, 2.7, z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    poles.setMatrixAt(idx, dummy.matrix);
    dummy.position.y = 5.5;
    dummy.updateMatrix();
    heads.setMatrixAt(idx, dummy.matrix);
  });
  scene.add(poles);
  scene.add(heads);

  // Palm trees: instanced trunks and leaf cones, thick along the beach.
  const palmPositions = [];
  for (let z = -170; z <= 170; z += 17) palmPositions.push([CITY.beachX - 4, z + randRange(-3, 3)]);
  for (let i = 0; i < 26; i++) {
    palmPositions.push([pickRandom(CITY.roads) + 8, randRange(-165, 165)]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 5.5, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmPositions.length);
  const leafGeo = new THREE.ConeGeometry(2.6, 1.6, 7);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, palmPositions.length);
  palmPositions.forEach(([x, z], idx) => {
    dummy.position.set(x, 2.75, z);
    dummy.rotation.set(randRange(-0.06, 0.06), rand() * Math.PI, randRange(-0.06, 0.06));
    dummy.updateMatrix();
    trunks.setMatrixAt(idx, dummy.matrix);
    dummy.position.y = 5.9;
    dummy.rotation.set(Math.PI, 0, 0);
    dummy.updateMatrix();
    leaves.setMatrixAt(idx, dummy.matrix);
  });
  scene.add(trunks);
  scene.add(leaves);

  // Beach umbrellas and warehouse crates: small props for the eye.
  const umbrellaGeo = new THREE.ConeGeometry(1.6, 0.8, 8);
  const umbrellaMats = [0xef6a5a, 0x3f8fbf, 0xe8b13a, 0x59b06a].map((c) => new THREE.MeshLambertMaterial({ color: c }));
  for (let i = 0; i < 9; i++) {
    const um = new THREE.Mesh(umbrellaGeo, pickRandom(umbrellaMats));
    um.position.set(CITY.beachX + randRange(2, 12), 1.6, randRange(-160, 160));
    scene.add(um);
  }
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xa9834f });
  for (let i = 0; i < 10; i++) {
    const crate = new THREE.Mesh(boxGeo, crateMat);
    const s = randRange(1.2, 2.2);
    crate.scale.set(s, s, s);
    crate.position.set(126 + randRange(0, 8), s / 2, 126 + randRange(0, 26));
    crate.rotation.y = rand() * Math.PI;
    scene.add(crate);
  }

  // Mission marker beacon: a glowing pillar the systems move around.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.visible = false;
  scene.add(beacon);

  let elapsed = 0;
  function updateCity(dt) {
    elapsed += dt;
    waterTex.offset.y = (elapsed * 0.02) % 1;
    waterTex.offset.x = Math.sin(elapsed * 0.3) * 0.02;
    beacon.material.opacity = 0.28 + Math.sin(elapsed * 3) * 0.1;
  }

  return { colliders, beacon, sun, updateCity };
}

// Circle-vs-buildings push-out used by the player and every car.
export function collideWithBuildings(pos, radius, colliders) {
  for (const c of colliders) {
    const nearX = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nearZ = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nearX;
    const dz = pos.z - nearZ;
    const distSq = dx * dx + dz * dz;
    if (distSq > radius * radius) continue;
    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      pos.x = nearX + (dx / dist) * radius;
      pos.z = nearZ + (dz / dist) * radius;
    } else {
      // Centre inside the box: push out along the smallest penetration axis.
      const left = pos.x - c.minX;
      const right = c.maxX - pos.x;
      const top = pos.z - c.minZ;
      const bottom = c.maxZ - pos.z;
      const minPen = Math.min(left, right, top, bottom);
      if (minPen === left) pos.x = c.minX - radius;
      else if (minPen === right) pos.x = c.maxX + radius;
      else if (minPen === top) pos.z = c.minZ - radius;
      else pos.z = c.maxZ + radius;
    }
  }
}
