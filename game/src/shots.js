// Coral City Heat — deterministic screenshot scenes.
// ?shot=chase|downtown|mission|menu stages a REAL game state (live systems,
// live HUD) for the cover/screenshot renders; main.js flips
// window.__shotReady once the scene has rendered for ~30 frames.

import { PLACES } from './config.js';
import { Vehicle } from './vehicle.js';

export function stageShotScene(game, name) {
  if (name === 'menu') {
    // Start screen over the orbiting city camera: main.js handles both.
    return;
  }
  game.startPlaying(true);
  if (name === 'downtown') stageDowntown(game);
  else if (name === 'chase') stageChase(game);
  else if (name === 'mission') stageMission(game);
}

function stageDowntown(game) {
  // Sol on foot at a busy midtown intersection, traffic rolling past.
  game.player.pos.set(46, 0, 33);
  game.player.heading = -0.7;
  game.player.camYaw = 2.2;
  game.player.camPitch = 0.3;
  game.player.mesh.position.copy(game.player.pos);
  for (let i = 0; i < 6; i++) {
    game.peds.spawnPed(34 + i * 3, 48 - (i % 3) * 8);
  }
  game.hud.showDialogue('Dario Fenn: "Downtown is awake, Sol. Try not to scratch the paint."', 30);
}

function stageChase(game) {
  // Sol driving north on the central avenue, two patrol cars on his tail,
  // far enough back that the chase camera frames all three cars.
  const car = new Vehicle(game.scene, 3, -40, 0, 0xd64541);
  car.speed = 19;
  game.registerVehicle(car);
  game.player.enterVehicle(car);
  game.player.pos.copy(car.pos);
  game.wanted.heat = 60; // exactly 3 stars
  game.wanted.recomputeStars();
  game.wanted.locked = true; // rams during staging must not change the level
  const copA = game.police.spawnCar({ x: 3, z: -30 });
  copA.pos.set(1, 0, -82);
  copA.heading = 0;
  copA.speed = 17;
  const copB = game.police.spawnCar({ x: 3, z: -30 });
  copB.pos.set(-4, 0, -97);
  copB.heading = 0.12;
  copB.speed = 16;
  game.shotLookBack = true; // front camera: player car + pursuers in frame
  game.freezeMissions = true;
  game.missions.setObjective('Deliver the package downtown — 87s left', PLACES.downtown);
  game.hud.showDialogue('Dario Fenn: "You have the package and the heat noticed. Move!"', 30);
}

function stageMission(game) {
  // The M5 warehouse shootout, guards posted and the banner up.
  game.player.pos.set(126, 0, 120);
  game.player.heading = 0.8;
  game.player.camYaw = -2.05;
  game.player.camPitch = 0.26;
  game.player.mesh.position.copy(game.player.pos);
  game.player.health = 78;
  const guards = game.spawnWarehouseGuards();
  game.freezeMissions = true;
  game.missions.setObjective(`Survive the warehouse shootout — guards left: ${guards.length}`, PLACES.warehouse);
  game.hud.showDialogue('Vera Calloway: "You walked into the wrong warehouse, courier."', 30);
}
