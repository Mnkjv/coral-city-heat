// Coral City Heat — entry point and game orchestrator.
// Builds the world, wires every system together on one shared `game`
// object, owns the state machine (menu / playing / paused / game over),
// the per-frame update order, car-to-car bumps, the wash garage, theft,
// death and respawning, and the screenshot-scene frame counter.

import * as THREE from 'three';
import { PLACES, WANTED, CRIME_HEAT } from './config.js';
import { seedRandom, readSeedFromUrl, readShotFromUrl } from './random.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { buildCity } from './city.js';
import { Vehicle } from './vehicle.js';
import { TrafficSystem } from './traffic.js';
import { PedestrianSystem } from './pedestrians.js';
import { Player } from './player.js';
import { PoliceSystem } from './police.js';
import { WantedSystem } from './wanted.js';
import { CombatSystem } from './combat.js';
import { MissionSystem } from './missions.js';
import { Hud } from './hud.js';
import { hasSaveGame, loadSaveGame, writeSaveGame, clearSaveGame } from './save.js';
import { stageShotScene } from './shots.js';

const shotName = readShotFromUrl();
seedRandom(readSeedFromUrl());

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const game = {
  scene,
  camera,
  renderer,
  state: 'menu',
  elapsed: 0,
  freezeMissions: false,
  lastGunshot: null,
  policeHitCooldown: 0,
  extraVehicles: [],
  shotFrames: 0,

  playerWorldPos() {
    return this.player.worldPos();
  },
  allVehicles() {
    const list = [
      ...this.traffic.trafficVehicles(),
      ...this.traffic.parkedCars,
      ...this.police.cars,
      ...this.extraVehicles,
    ];
    return list.filter((v, i) => list.indexOf(v) === i);
  },
  registerVehicle(vehicle) {
    if (!this.extraVehicles.includes(vehicle)) this.extraVehicles.push(vehicle);
  },
  unregisterVehicle(vehicle) {
    this.extraVehicles = this.extraVehicles.filter((v) => v !== vehicle);
  },
  nearestVehicleTo(x, z, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const v of this.allVehicles()) {
      if (v.dead) continue;
      const d = v.distanceTo(x, z);
      if (d < bestDist) { bestDist = d; best = v; }
    }
    return best;
  },

  tryEnterVehicle(vehicle) {
    const wasOccupied = vehicle.occupied && !vehicle.driverIsPlayer;
    const wasPolice = vehicle.isPolice;
    if (wasOccupied) {
      // The civilian driver bails out and runs.
      const driver = this.peds.spawnPed(vehicle.pos.x + 2, vehicle.pos.z + 1);
      driver.state = 'flee';
      driver.fleeTimer = 4;
      this.traffic.releaseCar(vehicle);
      this.registerVehicle(vehicle);
    }
    if (vehicle.isParked) {
      this.traffic.releaseCar(vehicle);
      this.registerVehicle(vehicle);
    }
    this.player.enterVehicle(vehicle);
    if (wasOccupied || vehicle.isParked || wasPolice) {
      this.wanted.addCrime(wasPolice ? CRIME_HEAT.carTheft + 10 : CRIME_HEAT.carTheft);
      this.hud.showBanner(wasPolice ? 'Police car stolen!' : 'Vehicle stolen', 2);
    }
    this.missions.onPlayerEnteredVehicle(vehicle);
    this.audio.startOnFirstGesture();
  },

  onPlayerExitedVehicle() {},

  onPedHit(ped, vehicle) {
    if (!vehicle.driverIsPlayer) return;
    this.audio.playHitThud();
    this.flashDamageVignette();
    if (ped.isOfficer) this.wanted.addCrime(CRIME_HEAT.policeHit);
    else this.wanted.addCrime(CRIME_HEAT.pedHit);
    this.hud.showBanner(ped.state === 'dead' ? 'Pedestrian down!' : 'You hit a pedestrian!', 2);
  },

  onPedKilled(ped) {
    if (ped.isGuard) this.hud.showBanner('Syndicate guard down', 2);
  },

  noteGunshot(x, z) {
    this.lastGunshot = { x, z, at: this.elapsed };
  },

  flashDamageVignette() {
    this.hud.flashDamage();
  },

  spawnHotCar() {
    const car = new Vehicle(this.scene, PLACES.hotCar.x, PLACES.hotCar.z, Math.PI / 2, 0xe8b13a);
    car.isParked = true;
    this.registerVehicle(car);
    return car;
  },

  spawnWarehouseGuards() {
    const posts = [
      [128, 126], [156, 126], [128, 158], [156, 158], [142, 122],
    ];
    return posts.map(([x, z]) => {
      const guard = this.peds.spawnPed(x, z, { isGuard: true, shirt: 0x23272e });
      guard.state = 'guard';
      return guard;
    });
  },

  saveNow() {
    const p = this.playerWorldPos();
    writeSaveGame({
      cash: this.player.cash,
      missionIndex: this.missions.index,
      storyComplete: this.missions.storyComplete,
      pos: { x: p.x, z: p.z },
    });
  },

  startPlaying(fromShot) {
    this.state = 'playing';
    document.getElementById('menu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    this.input.wantsPointerLock = !fromShot;
    if (!fromShot) this.hud.showDialogue('Dario Fenn: "Sol Vega — welcome back to Coral City."', 4);
  },

  respawnAtHospital() {
    const fee = Math.min(this.player.cash, 150);
    this.player.cash -= fee;
    if (this.player.inVehicle) {
      this.player.inVehicle.driverIsPlayer = false;
      this.player.inVehicle = null;
      this.player.mesh.visible = true;
    }
    this.player.pos.set(PLACES.hospital.x, 0, PLACES.hospital.z + 13);
    this.player.healFull();
    this.wanted.clearWanted();
    for (const car of [...this.police.cars]) this.police.removeCar(car);
    for (const officer of [...this.police.officers]) this.police.removeOfficer(officer);
    document.getElementById('gameover').style.display = 'none';
    this.state = 'playing';
    this.hud.showBanner(`Coral General patched you up — $${fee} medical bill`, 4);
    this.saveNow();
  },
};

// --- Build the world -------------------------------------------------------
game.city = buildCity(scene);
game.input = new Input(canvas);
game.audio = new GameAudio();
game.hud = new Hud();
game.wanted = new WantedSystem(game);
game.peds = new PedestrianSystem(scene);
game.traffic = new TrafficSystem(scene);
game.traffic.spawnTraffic(16);
game.traffic.spawnParkedCars(22);
game.peds.spawnCrowd(46);

const existingSave = loadSaveGame();
game.player = new Player(scene, null);
game.police = new PoliceSystem(scene, game);
game.combat = new CombatSystem(scene, game);
game.missions = new MissionSystem(game, 0, false);

function applySave(save) {
  if (!save) return;
  game.player.cash = save.cash;
  game.player.pos.set(save.pos.x, 0, save.pos.z);
  game.player.mesh.position.copy(game.player.pos);
  game.missions = new MissionSystem(game, save.missionIndex, save.storyComplete);
}

// --- Menu / pause wiring ---------------------------------------------------
const menuEl = document.getElementById('menu');
const pauseEl = document.getElementById('pause');
const continueBtn = document.getElementById('continueBtn');
if (!hasSaveGame()) continueBtn.style.display = 'none';
document.getElementById('newGameBtn').addEventListener('click', () => {
  clearSaveGame();
  game.audio.startOnFirstGesture();
  game.startPlaying(false);
});
continueBtn.addEventListener('click', () => {
  applySave(loadSaveGame());
  game.audio.startOnFirstGesture();
  game.startPlaying(false);
});
document.getElementById('resumeBtn').addEventListener('click', () => {
  pauseEl.style.display = 'none';
  game.state = 'playing';
  game.input.lockPointer();
});
document.getElementById('restartBtn').addEventListener('click', () => window.location.reload());
document.getElementById('respawnBtn').addEventListener('click', () => game.respawnAtHospital());
window.addEventListener('pointerdown', () => game.audio.startOnFirstGesture(), { once: false });
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyM') game.audio.toggleMute();
  if ((event.code === 'Escape' || event.code === 'KeyP') && game.state === 'playing' && !shotName) {
    game.state = 'paused';
    pauseEl.style.display = 'flex';
    if (document.exitPointerLock) document.exitPointerLock();
  } else if (event.code === 'KeyP' && game.state === 'paused') {
    pauseEl.style.display = 'none';
    game.state = 'playing';
  }
});

// --- Per-frame systems ------------------------------------------------------
function currentDanger() {
  const p = game.player;
  if (p.inVehicle && Math.abs(p.inVehicle.speed) > 12) {
    return { x: p.inVehicle.pos.x, z: p.inVehicle.pos.z, radius: 15 };
  }
  if (game.lastGunshot && game.elapsed - game.lastGunshot.at < 1.4) {
    return { x: game.lastGunshot.x, z: game.lastGunshot.z, radius: 19 };
  }
  return null;
}

function updateCarBumps(dt) {
  game.policeHitCooldown = Math.max(0, game.policeHitCooldown - dt);
  const vehicles = game.allVehicles();
  for (let i = 0; i < vehicles.length; i++) {
    for (let j = i + 1; j < vehicles.length; j++) {
      const a = vehicles[i];
      const b = vehicles[j];
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3.3 && dist > 0.001) {
        const push = (3.3 - dist) / 2;
        const nx = dx / dist;
        const nz = dz / dist;
        if (!a.driverIsPlayer) { a.pos.x -= nx * push; a.pos.z -= nz * push; }
        if (!b.driverIsPlayer) { b.pos.x += nx * push; b.pos.z += nz * push; }
        const relSpeed = Math.abs(a.speed - b.speed);
        a.speed *= 0.82;
        b.speed *= 0.82;
        const playerInvolved = a.driverIsPlayer || b.driverIsPlayer;
        const policeInvolved = a.isPolice || b.isPolice;
        if (playerInvolved && policeInvolved && relSpeed > 3 && game.policeHitCooldown <= 0) {
          game.wanted.addCrime(CRIME_HEAT.policeHit);
          game.policeHitCooldown = 2.5;
          game.audio.playHitThud();
        } else if (playerInvolved && relSpeed > 6) {
          game.audio.playHitThud();
        }
      }
    }
  }
}

function updateWashGarage(frame) {
  const p = game.player;
  if (!p.inVehicle) return;
  const d = Math.hypot(p.inVehicle.pos.x - PLACES.washGarage.x, p.inVehicle.pos.z - PLACES.washGarage.z);
  if (d > 9) return;
  if (game.wanted.stars === 0) {
    game.hud.setPrompt('Sparkle Wash — you are clean, no wash needed');
    return;
  }
  if (p.cash < WANTED.washCost) {
    game.hud.setPrompt(`Sparkle Wash clears your record for $${WANTED.washCost} — you are short`);
    return;
  }
  game.hud.setPrompt(`Press E — wash the car and clear wanted for $${WANTED.washCost}`);
  if (frame.use) {
    p.cash -= WANTED.washCost;
    game.wanted.clearWanted();
    game.audio.playCashChime();
    game.hud.showBanner('Washed clean — the heat is off', 3);
  }
}

const clock = new THREE.Clock();
let menuOrbit = 0;

function runFrame() {
  requestAnimationFrame(runFrame);
  const dt = Math.min(0.05, clock.getDelta());
  const frame = game.input.consumeFrame();

  if (game.state === 'menu') {
    menuOrbit += dt * 0.05;
    camera.position.set(Math.sin(menuOrbit) * 130, 55, Math.cos(menuOrbit) * 130);
    camera.lookAt(0, 0, 0);
    game.city.updateCity(dt);
    renderer.render(scene, camera);
    countShotFrame();
    return;
  }
  if (game.state === 'paused' || game.state === 'gameover') {
    renderer.render(scene, camera);
    return;
  }

  game.elapsed += dt;
  if (frame.clicked) game.combat.playerShoot();
  game.player.updatePlayer(dt, game, frame);
  game.traffic.updateTraffic(dt, game);
  game.peds.updatePeds(dt, game, currentDanger());
  game.police.updatePolice(dt);
  game.wanted.updateWanted(dt, game.police.canSeePlayer());
  game.combat.updateCombat(dt);
  if (!game.freezeMissions) game.missions.updateMissions(dt);
  updateCarBumps(dt);
  updateWashGarage(frame);
  game.city.updateCity(dt);

  // Engine + siren mix.
  const playerSpeed = game.player.inVehicle ? Math.abs(game.player.inVehicle.speed) / 34 : 0;
  const nearestCop = game.police.cars.length
    ? Math.min(...game.police.cars.map((c) => c.distanceTo(game.playerWorldPos().x, game.playerWorldPos().z)))
    : 999;
  const sirenLevel = game.wanted.stars > 0 ? Math.max(0, 1 - nearestCop / 90) : 0;
  game.audio.updateAudio(dt, game.player.inVehicle ? 0.25 + playerSpeed : 0, sirenLevel);

  if (game.player.dead && game.state === 'playing') {
    game.state = 'gameover';
    document.getElementById('gameover').style.display = 'flex';
    if (document.exitPointerLock) document.exitPointerLock();
  }

  game.hud.updateHud(dt, game);
  renderer.render(scene, camera);
  countShotFrame();
}

function countShotFrame() {
  if (!shotName) return;
  game.shotFrames += 1;
  if (game.shotFrames >= 35) window.__shotReady = true;
}

if (shotName) stageShotScene(game, shotName);
window.__game = game; // handy for debugging and automated play-tests
runFrame();
