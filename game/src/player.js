// Coral City Heat — the player: Sol Vega on foot and behind the wheel.
// Owns the on-foot body, the third-person orbit camera, the chase camera,
// entering and leaving cars, and driving input. Health and cash live here;
// the wanted/mission/combat systems read and change them through the game.

import * as THREE from 'three';
import { PLAYER } from './config.js';
import { buildPedMesh } from './pedestrians.js';
import { collideWithBuildings } from './city.js';

export class Player {
  constructor(scene, saveData) {
    const built = buildPedMesh(0xb03030, 0xc98d5f); // Sol's red jacket
    this.mesh = built.group;
    this.legL = built.legL;
    this.legR = built.legR;
    this.pos = new THREE.Vector3(PLAYER.startPos.x, 0, PLAYER.startPos.z);
    if (saveData && saveData.pos) this.pos.set(saveData.pos.x, 0, saveData.pos.z);
    this.heading = 0;
    this.health = PLAYER.maxHealth;
    this.cash = saveData ? saveData.cash : PLAYER.startCash;
    this.inVehicle = null;
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.camPos = new THREE.Vector3(this.pos.x, 6, this.pos.z - 8);
    this.walkPhase = 0;
    this.dead = false;
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);
  }

  worldPos() {
    return this.inVehicle ? this.inVehicle.pos : this.pos;
  }

  speedNow() {
    return this.inVehicle ? Math.abs(this.inVehicle.speed) : 0;
  }

  enterVehicle(vehicle) {
    this.inVehicle = vehicle;
    vehicle.driverIsPlayer = true;
    vehicle.occupied = true;
    this.mesh.visible = false;
  }

  exitVehicle() {
    const vehicle = this.inVehicle;
    if (!vehicle) return;
    vehicle.driverIsPlayer = false;
    vehicle.occupied = false;
    vehicle.speed = 0;
    const side = { x: Math.cos(vehicle.heading), z: -Math.sin(vehicle.heading) };
    this.pos.set(vehicle.pos.x + side.x * 2.4, 0, vehicle.pos.z + side.z * 2.4);
    this.inVehicle = null;
    this.mesh.visible = true;
    this.mesh.position.copy(this.pos);
  }

  takeDamage(amount) {
    if (this.dead) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  healFull() {
    this.health = PLAYER.maxHealth;
    this.dead = false;
  }

  updatePlayer(dt, game, frame) {
    const input = game.input;
    this.camYaw -= frame.mouseDX * 0.0032;
    this.camPitch = Math.max(0.05, Math.min(1.1, this.camPitch + frame.mouseDY * 0.0028));

    if (this.inVehicle) {
      const v = this.inVehicle;
      const throttle = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) + (input.down('KeyS') || input.down('ArrowDown') ? -1 : 0);
      const steer = (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0) + (input.down('KeyD') || input.down('ArrowRight') ? -1 : 0);
      v.drive(dt, throttle, steer, input.down('Space'), game.city.colliders);
      this.pos.copy(v.pos);
      if (frame.interact) {
        this.exitVehicle();
        game.onPlayerExitedVehicle();
      }
    } else {
      const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
      const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      const forwardIn = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) + (input.down('KeyS') || input.down('ArrowDown') ? -1 : 0);
      const strafeIn = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) + (input.down('KeyA') || input.down('ArrowLeft') ? -1 : 0);
      if (forwardIn !== 0 || strafeIn !== 0) {
        const sin = Math.sin(this.camYaw);
        const cos = Math.cos(this.camYaw);
        // Camera looks toward -forward; move relative to the camera yaw.
        let mx = (-sin * forwardIn) + (cos * strafeIn);
        let mz = (-cos * forwardIn) + (-sin * strafeIn);
        const len = Math.hypot(mx, mz) || 1;
        mx = (mx / len) * speed * dt;
        mz = (mz / len) * speed * dt;
        this.pos.x += mx;
        this.pos.z += mz;
        this.heading = Math.atan2(mx, mz);
        this.walkPhase += dt * speed * 2.2;
      }
      this.pos.x = Math.max(-235, Math.min(196, this.pos.x));
      this.pos.z = Math.max(-175, Math.min(175, this.pos.z));
      collideWithBuildings(this.pos, PLAYER.radius, game.city.colliders);
      // Cars push the player aside (soft body-check, damage comes from ped-hit rules elsewhere).
      this.mesh.position.copy(this.pos);
      this.mesh.rotation.y = this.heading;
      const moving = forwardIn !== 0 || strafeIn !== 0;
      const swing = moving ? Math.sin(this.walkPhase) * 0.55 : 0;
      this.legL.rotation.x = swing;
      this.legR.rotation.x = -swing;

      if (frame.interact) {
        const nearest = game.nearestVehicleTo(this.pos.x, this.pos.z, 3.4);
        if (nearest) game.tryEnterVehicle(nearest);
      }
    }
    this.updateCamera(dt, game);
  }

  updateCamera(dt, game) {
    const camera = game.camera;
    let target;
    let look;
    if (this.inVehicle) {
      const v = this.inVehicle;
      const back = { x: Math.sin(v.heading), z: Math.cos(v.heading) };
      if (game.shotLookBack) {
        // Screenshot staging: camera ahead of the car, looking back at it,
        // so the pursuers behind the player are in frame.
        target = new THREE.Vector3(v.pos.x + back.x * 12, 3.4, v.pos.z + back.z * 12);
        look = new THREE.Vector3(v.pos.x - back.x * 8, 1.2, v.pos.z - back.z * 8);
        camera.position.copy(target);
        this.camPos.copy(target);
        camera.lookAt(look);
        return;
      }
      target = new THREE.Vector3(v.pos.x - back.x * 10.5, 4.2, v.pos.z - back.z * 10.5);
      look = new THREE.Vector3(v.pos.x + back.x * 7, 1.4, v.pos.z + back.z * 7);
      const blend = 1 - Math.pow(0.0001, dt);
      this.camPos.lerp(target, Math.min(1, blend));
    } else {
      const dist = 7.5;
      const cx = this.pos.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist;
      const cz = this.pos.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist;
      const cy = 1.6 + Math.sin(this.camPitch) * dist;
      target = new THREE.Vector3(cx, cy, cz);
      look = new THREE.Vector3(this.pos.x, 1.5, this.pos.z);
      const blend = 1 - Math.pow(0.0000001, dt);
      this.camPos.lerp(target, Math.min(1, blend));
    }
    camera.position.copy(this.camPos);
    camera.lookAt(look);
    // Keep the shadow frustum centred near the action.
    if (game.city.sun) {
      game.city.sun.position.set(this.camPos.x + 90, 170, this.camPos.z + 45);
      game.city.sun.target.position.set(this.camPos.x, 0, this.camPos.z);
    }
  }

  aimDirection(game) {
    const dir = new THREE.Vector3();
    game.camera.getWorldDirection(dir);
    return dir;
  }
}
