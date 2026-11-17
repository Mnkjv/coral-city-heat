// Coral City Heat — pedestrians.
// Walkers follow the sidewalk grid (straight along a kerb line, turning at
// corners), flee from speeding cars and gunfire, and fall when hit. Guards
// and police officers are the same Ped with different flags, so combat and
// the wanted system treat everyone uniformly.

import * as THREE from 'three';
import { CITY } from './config.js';
import { rand, randRange, pickRandom } from './random.js';
import { collideWithBuildings } from './city.js';

const skinTones = [0xe8b88a, 0xc98d5f, 0x8a5a34, 0xf0c8a0];
const shirtColors = [0xd64541, 0x3f7fbf, 0xe8b13a, 0x59b06a, 0xe8e2d4, 0x8e6fc0, 0xef7d3c, 0x3fbfae];

const bodyGeo = new THREE.CylinderGeometry(0.26, 0.34, 1.05, 8);
const headGeo = new THREE.SphereGeometry(0.24, 10, 8);
const legGeo = new THREE.BoxGeometry(0.16, 0.55, 0.16);

export function buildPedMesh(shirtColor, skinColor) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: shirtColor }));
  body.position.y = 0.95;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: skinColor }));
  head.position.y = 1.72;
  group.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2c313a });
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.14, 0.28, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.14, 0.28, 0);
  group.add(legR);
  return { group, legL, legR };
}

let nextPedId = 1;

export class Ped {
  constructor(scene, x, z, options = {}) {
    this.id = nextPedId++;
    this.isGuard = options.isGuard === true;
    this.isOfficer = options.isOfficer === true;
    const shirt = options.shirt !== undefined ? options.shirt : pickRandom(shirtColors);
    const built = buildPedMesh(shirt, pickRandom(skinTones));
    this.mesh = built.group;
    this.legL = built.legL;
    this.legR = built.legR;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = rand() * Math.PI * 2;
    this.speed = 0;
    this.walkSpeed = randRange(1.6, 2.6);
    this.state = 'walk'; // walk | flee | fallen | dead | guard | chase
    this.health = this.isGuard || this.isOfficer ? 60 : 30;
    this.fleeTimer = 0;
    this.fallenTimer = 0;
    this.walkPhase = rand() * 6;
    this.shootCooldown = randRange(0.5, 1.5);
    this.postX = x;
    this.postZ = z;
    // Sidewalk following: walk along `axis` at fixed kerb coordinate.
    this.axis = rand() < 0.5 ? 'x' : 'z';
    this.fixed = this.snapToKerb(this.axis === 'x' ? z : x);
    this.dir = rand() < 0.5 ? 1 : -1;
    if (this.isGuard) this.state = 'guard';
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);
    this.scene = scene;
  }

  snapToKerb(value) {
    let best = CITY.roads[0] + CITY.walkHalf;
    let bestDist = Infinity;
    for (const r of CITY.roads) {
      for (const off of [-CITY.walkHalf, CITY.walkHalf]) {
        const candidate = r + off;
        const d = Math.abs(candidate - value);
        if (d < bestDist) { bestDist = d; best = candidate; }
      }
    }
    return best;
  }

  fallDown(lethal) {
    if (this.state === 'dead') return;
    this.state = lethal ? 'dead' : 'fallen';
    this.fallenTimer = lethal ? Infinity : randRange(2.5, 4.5);
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.position.y = 0.25;
  }

  getUp() {
    this.state = 'flee';
    this.fleeTimer = 2;
    this.mesh.rotation.x = 0;
    this.mesh.position.y = 0;
  }

  removeFromScene() {
    this.scene.remove(this.mesh);
  }
}

export class PedestrianSystem {
  constructor(scene) {
    this.scene = scene;
    this.peds = [];
  }

  spawnPed(x, z, options) {
    const ped = new Ped(this.scene, x, z, options);
    this.peds.push(ped);
    return ped;
  }

  spawnCrowd(count) {
    for (let i = 0; i < count; i++) {
      const roadX = pickRandom(CITY.roads);
      const roadZ = pickRandom(CITY.roads);
      const x = roadX + pickRandom([-CITY.walkHalf, CITY.walkHalf]) + randRange(-2, 2);
      const z = roadZ + randRange(-150, 150);
      this.spawnPed(x, Math.max(-168, Math.min(168, z)));
    }
  }

  removePed(ped) {
    ped.removeFromScene();
    this.peds = this.peds.filter((p) => p !== ped);
  }

  // danger: {x, z, radius} of the thing scaring people this frame, or null.
  updatePeds(dt, game, danger) {
    const colliders = game.city.colliders;
    for (const ped of this.peds) {
      if (ped.state === 'dead') continue;
      if (ped.state === 'fallen') {
        ped.fallenTimer -= dt;
        if (ped.fallenTimer <= 0) ped.getUp();
        continue;
      }
      if (ped.state === 'guard' || ped.state === 'chase') continue; // combat drives these

      let moving = false;
      if (ped.state === 'flee') {
        ped.fleeTimer -= dt;
        if (danger) {
          ped.heading = Math.atan2(ped.pos.x - danger.x, ped.pos.z - danger.z);
        }
        ped.speed = 6.8;
        moving = true;
        if (ped.fleeTimer <= 0) {
          ped.state = 'walk';
          ped.axis = Math.abs(ped.pos.x - ped.snapToKerb(ped.pos.x)) < Math.abs(ped.pos.z - ped.snapToKerb(ped.pos.z)) ? 'z' : 'x';
          ped.fixed = ped.snapToKerb(ped.axis === 'x' ? ped.pos.z : ped.pos.x);
        }
      } else {
        // Walk the kerb line; maybe turn at the next corner crossing.
        if (danger && Math.hypot(ped.pos.x - danger.x, ped.pos.z - danger.z) < danger.radius) {
          ped.state = 'flee';
          ped.fleeTimer = randRange(1.5, 3);
          continue;
        }
        ped.speed = ped.walkSpeed;
        moving = true;
        const along = ped.axis === 'x' ? ped.pos.x : ped.pos.z;
        for (const r of CITY.roads) {
          for (const off of [-CITY.walkHalf, CITY.walkHalf]) {
            const cross = r + off;
            if (Math.abs(along + ped.dir * ped.speed * dt - cross) < 0.4 && Math.abs(along - cross) > 0.01) {
              if (rand() < 0.3) {
                // Turn the corner onto the crossing kerb line.
                if (ped.axis === 'x') { ped.pos.x = cross; ped.axis = 'z'; ped.fixed = cross; }
                else { ped.pos.z = cross; ped.axis = 'x'; ped.fixed = cross; }
                ped.dir = rand() < 0.5 ? 1 : -1;
              }
            }
          }
        }
        if (ped.axis === 'x') ped.heading = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        else ped.heading = ped.dir > 0 ? 0 : Math.PI;
        // Keep to the kerb line.
        if (ped.axis === 'x') ped.pos.z += (ped.fixed - ped.pos.z) * Math.min(1, dt * 4);
        else ped.pos.x += (ped.fixed - ped.pos.x) * Math.min(1, dt * 4);
      }

      if (moving) {
        ped.pos.x += Math.sin(ped.heading) * ped.speed * dt;
        ped.pos.z += Math.cos(ped.heading) * ped.speed * dt;
        ped.pos.x = Math.max(-CITY.worldEdge, Math.min(CITY.worldEdge, ped.pos.x));
        ped.pos.z = Math.max(-170, Math.min(170, ped.pos.z));
        collideWithBuildings(ped.pos, 0.5, colliders);
        ped.walkPhase += dt * ped.speed * 2.4;
      }
      ped.mesh.position.copy(ped.pos);
      ped.mesh.rotation.y = ped.heading;
      const swing = Math.sin(ped.walkPhase) * 0.5;
      ped.legL.rotation.x = swing;
      ped.legR.rotation.x = -swing;
    }

    // Cars hitting pedestrians (any car, any driver).
    for (const ped of this.peds) {
      if (ped.state === 'dead' || ped.state === 'fallen') continue;
      for (const vehicle of game.allVehicles()) {
        if (Math.abs(vehicle.speed) < 4) continue;
        if (vehicle.distanceTo(ped.pos.x, ped.pos.z) < 1.7) {
          const lethal = Math.abs(vehicle.speed) > 16 || ped.health <= 15;
          ped.health -= Math.abs(vehicle.speed) > 16 ? 30 : 15;
          ped.fallDown(lethal || ped.health <= 0);
          game.onPedHit(ped, vehicle);
          break;
        }
      }
    }
  }
}
