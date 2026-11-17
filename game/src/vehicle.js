// Coral City Heat — a car: mesh, arcade physics, and the shared driving maths.
// The player, traffic AI and police all drive the same Vehicle; only the
// control inputs differ. Physics is deliberately arcade: speed along the
// heading, steering that bites harder at speed, a handbrake that breaks grip.

import * as THREE from 'three';
import { VEHICLE } from './config.js';
import { collideWithBuildings } from './city.js';

const bodyGeo = new THREE.BoxGeometry(1.9, 0.62, 4.3);
const cabinGeo = new THREE.BoxGeometry(1.66, 0.55, 2.1);
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x17181c });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x22303e });
const lightBarGeo = new THREE.BoxGeometry(1.5, 0.22, 0.5);

export function buildCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color }));
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(0, 1.1, -0.2);
  group.add(cabin);
  const wheelPositions = [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]];
  const wheels = [];
  for (const [x, z] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    group.add(wheel);
    wheels.push(wheel);
  }
  let lightBar = null;
  let lightRed = null;
  let lightBlue = null;
  if (isPolice) {
    lightBar = new THREE.Group();
    lightRed = new THREE.Mesh(lightBarGeo, new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    lightRed.scale.set(0.48, 1, 1);
    lightRed.position.x = -0.38;
    lightBlue = new THREE.Mesh(lightBarGeo, new THREE.MeshBasicMaterial({ color: 0x2a6aff }));
    lightBlue.scale.set(0.48, 1, 1);
    lightBlue.position.x = 0.38;
    lightBar.add(lightRed);
    lightBar.add(lightBlue);
    lightBar.position.set(0, 1.48, -0.2);
    group.add(lightBar);
  }
  return { group, wheels, lightRed, lightBlue };
}

export class Vehicle {
  constructor(scene, x, z, heading, color, options = {}) {
    this.isPolice = options.isPolice === true;
    const built = buildCarMesh(color, this.isPolice);
    this.mesh = built.group;
    this.wheels = built.wheels;
    this.lightRed = built.lightRed;
    this.lightBlue = built.lightBlue;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.radius = 1.7;
    this.occupied = false;      // a driver (player, traffic driver, officer) is in it
    this.driverIsPlayer = false;
    this.dead = false;
    this.flashPhase = Math.random() * Math.PI * 2;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
  }

  forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  // throttle -1..1, steer -1..1 (left positive), handbrake bool.
  drive(dt, throttle, steer, handbrake, colliders) {
    const accel = throttle > 0 ? VEHICLE.accel : VEHICLE.brake;
    if (throttle !== 0) {
      this.speed += throttle * accel * dt;
    } else {
      const drag = VEHICLE.drag * this.speed * dt + 0.6 * dt * Math.sign(this.speed);
      this.speed -= Math.abs(this.speed) < Math.abs(drag) ? this.speed : drag;
    }
    if (handbrake) this.speed -= this.speed * 2.4 * dt;
    this.speed = Math.max(-VEHICLE.reverseMax, Math.min(VEHICLE.maxSpeed, this.speed));
    const speedFactor = Math.min(1, Math.abs(this.speed) / 8);
    const turnRate = VEHICLE.gripTurn * speedFactor * (handbrake ? 1.7 : 1);
    this.heading += steer * turnRate * dt * (this.speed < 0 ? -1 : 1);
    this.steer = steer;
    const f = this.forward();
    this.pos.x += f.x * this.speed * dt;
    this.pos.z += f.z * this.speed * dt;
    // Cars stay on land: the shoreline at x=196 is the eastern limit.
    this.pos.x = Math.max(-235, Math.min(196, this.pos.x));
    this.pos.z = Math.max(-235, Math.min(235, this.pos.z));
    const beforeX = this.pos.x;
    const beforeZ = this.pos.z;
    collideWithBuildings(this.pos, this.radius, colliders);
    if (Math.abs(this.pos.x - beforeX) > 0.01 || Math.abs(this.pos.z - beforeZ) > 0.01) {
      this.speed *= 0.35; // scraping a building kills momentum
    }
    this.syncMesh(dt);
  }

  syncMesh(dt) {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * dt * 2.6;
    for (const wheel of this.wheels) wheel.rotation.x += spin;
    if (this.wheels[0]) this.wheels[0].rotation.y = this.steer * 0.4;
    if (this.wheels[1]) this.wheels[1].rotation.y = this.steer * 0.4;
    if (this.isPolice && this.lightRed) {
      const on = Math.sin(performance.now() * 0.02 + this.flashPhase) > 0;
      this.lightRed.material.color.setHex(on ? 0xff2a2a : 0x571010);
      this.lightBlue.material.color.setHex(on ? 0x102a57 : 0x2a6aff);
    }
  }

  distanceTo(x, z) {
    return Math.hypot(this.pos.x - x, this.pos.z - z);
  }
}

// Steer a vehicle toward a world point: returns {throttle, steer} for drive().
export function steerToward(vehicle, targetX, targetZ, desiredSpeed) {
  const f = vehicle.forward();
  const dx = targetX - vehicle.pos.x;
  const dz = targetZ - vehicle.pos.z;
  const dist = Math.hypot(dx, dz) || 0.001;
  const dotForward = (dx * f.x + dz * f.z) / dist;
  const cross = f.x * (dz / dist) - f.z * (dx / dist);
  // Positive steer turns the nose left (heading grows); the cross product
  // above is positive when the target sits to the right, hence the flip.
  let steer = Math.max(-1, Math.min(1, -cross * 2.2));
  let throttle;
  if (dotForward < -0.25) {
    throttle = vehicle.speed > 0.5 ? -1 : -0.7; // target behind: brake, then reverse-turn
    steer = -steer;
  } else {
    const speedError = desiredSpeed - vehicle.speed;
    throttle = Math.max(-1, Math.min(1, speedError * 0.25));
    if (Math.abs(steer) > 0.75 && vehicle.speed > 12) throttle = Math.min(throttle, 0.1);
  }
  return { throttle, steer };
}
