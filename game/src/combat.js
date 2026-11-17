// Coral City Heat — gun combat.
// The player's pistol is hitscan: a ray from the camera, a tracer line, a
// muzzle flash and a synth gunshot. Guards and police officers shoot back
// on cooldowns with distance-based accuracy. Firing a gun is itself a crime.

import * as THREE from 'three';
import { CRIME_HEAT } from './config.js';

const PISTOL_DAMAGE = 34;
const PISTOL_RANGE = 70;

export class CombatSystem {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.tracers = [];
    this.flash = new THREE.PointLight(0xffc46b, 0, 18);
    scene.add(this.flash);
    this.flashTimer = 0;
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  }

  addTracer(from, to, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = color ? new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }) : this.tracerMat.clone();
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  muzzleFlashAt(pos) {
    this.flash.position.copy(pos).y += 1.4;
    this.flash.intensity = 26;
    this.flashTimer = 0.05;
  }

  playerShoot() {
    const game = this.game;
    const player = game.player;
    if (player.inVehicle || player.dead) return;
    const origin = game.camera.position.clone();
    const dir = player.aimDirection(game);
    game.audio.playGunshot();
    game.noteGunshot(player.pos.x, player.pos.z);
    game.wanted.addCrime(CRIME_HEAT.gunshot);

    // Muzzle at the player's hand, tracer to wherever the ray ends.
    const muzzle = player.pos.clone();
    muzzle.y += 1.35;
    muzzle.x += dir.x * 0.6;
    muzzle.z += dir.z * 0.6;
    this.muzzleFlashAt(muzzle);

    let bestPed = null;
    let bestDist = PISTOL_RANGE;
    for (const ped of game.peds.peds) {
      if (ped.state === 'dead') continue;
      const toPed = new THREE.Vector3(ped.pos.x - origin.x, 1.2 - origin.y, ped.pos.z - origin.z);
      const along = toPed.dot(dir);
      if (along < 1 || along > PISTOL_RANGE) continue;
      const closest = origin.clone().add(dir.clone().multiplyScalar(along));
      const miss = Math.hypot(closest.x - ped.pos.x, closest.z - ped.pos.z);
      if (miss < 0.85 && along < bestDist) {
        bestPed = ped;
        bestDist = along;
      }
    }
    const end = bestPed
      ? new THREE.Vector3(bestPed.pos.x, 1.2, bestPed.pos.z)
      : origin.clone().add(dir.clone().multiplyScalar(PISTOL_RANGE));
    this.addTracer(muzzle, end);

    if (bestPed) {
      bestPed.health -= PISTOL_DAMAGE;
      game.audio.playHitThud();
      if (bestPed.health <= 0 && bestPed.state !== 'dead') {
        bestPed.fallDown(true);
        if (bestPed.isOfficer) game.wanted.addCrime(CRIME_HEAT.policeKill);
        game.onPedKilled(bestPed);
      } else if (bestPed.isGuard || bestPed.isOfficer) {
        bestPed.state = bestPed.isOfficer ? 'chase' : 'guard';
      } else {
        bestPed.state = 'flee';
        bestPed.fleeTimer = 3;
      }
    }
  }

  enemyFireAt(shooter, dt) {
    const game = this.game;
    const player = game.player;
    if (player.dead) return;
    shooter.shootCooldown -= dt;
    const targetPos = player.worldPos();
    const dist = Math.hypot(shooter.pos.x - targetPos.x, shooter.pos.z - targetPos.z);
    const range = shooter.isGuard ? 42 : 36;
    if (dist > range) return;
    shooter.heading = Math.atan2(targetPos.x - shooter.pos.x, targetPos.z - shooter.pos.z);
    shooter.mesh.rotation.y = shooter.heading;
    if (shooter.shootCooldown > 0) return;
    shooter.shootCooldown = shooter.isGuard ? 0.85 + Math.random() * 0.5 : 1.1 + Math.random() * 0.6;
    const from = new THREE.Vector3(shooter.pos.x, 1.35, shooter.pos.z);
    const to = new THREE.Vector3(targetPos.x, 1.2, targetPos.z);
    this.addTracer(from, to, 0xff7a5a);
    this.muzzleFlashAt(from);
    if (dist < 30) game.audio.playGunshot();
    const hitChance = Math.max(0.08, 0.42 - dist * 0.008) * (player.inVehicle ? 0.7 : 1);
    if (Math.random() < hitChance) {
      player.takeDamage(shooter.isGuard ? 9 : 7);
      game.audio.playHurt();
      game.flashDamageVignette();
    }
  }

  updateCombat(dt) {
    const game = this.game;
    // Guards and officers return fire.
    for (const ped of game.peds.peds) {
      if (ped.state === 'dead' || ped.state === 'fallen') continue;
      if (ped.isGuard && ped.state === 'guard') this.enemyFireAt(ped, dt);
      else if (ped.isOfficer && ped.state === 'chase') this.enemyFireAt(ped, dt);
    }
    // Fade tracers and the muzzle light.
    for (const t of [...this.tracers]) {
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        this.tracers = this.tracers.filter((x) => x !== t);
      }
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flash.intensity = 0;
    }
  }
}
