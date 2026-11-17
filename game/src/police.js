// Coral City Heat — police response.
// Police cars spawn in proportion to the wanted stars and hunt the player
// down the road grid, ramming when they get close. At two stars or more, if
// the player is on foot, officers climb out and give chase on foot — and
// they shoot (combat.js resolves their fire).

import { CITY, POLICE_COLOR } from './config.js';
import { randRange, pickRandom } from './random.js';
import { Vehicle, steerToward } from './vehicle.js';
import { collideWithBuildings } from './city.js';

export class PoliceSystem {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.cars = [];
    this.officers = [];
    this.spawnTimer = 0;
    this.officerTimer = 0;
  }

  desiredCars(stars) {
    return stars <= 0 ? 0 : Math.min(5, stars + 1);
  }

  spawnCar(playerPos) {
    // Spawn on a road, far enough to approach but close enough to matter.
    const angle = Math.random() * Math.PI * 2;
    const dist = randRange(85, 120);
    let x = playerPos.x + Math.sin(angle) * dist;
    let z = playerPos.z + Math.cos(angle) * dist;
    x = Math.max(-165, Math.min(175, x));
    z = Math.max(-165, Math.min(165, z));
    // Snap to the nearest road centre so the car starts on tarmac.
    const nearRoad = (v) => CITY.roads.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    if (Math.random() < 0.5) x = nearRoad(x); else z = nearRoad(z);
    const heading = Math.atan2(playerPos.x - x, playerPos.z - z);
    const car = new Vehicle(this.scene, x, z, heading, POLICE_COLOR, { isPolice: true });
    car.occupied = true;
    this.cars.push(car);
    this.game.registerVehicle(car);
    return car;
  }

  removeCar(car) {
    this.scene.remove(car.mesh);
    this.game.unregisterVehicle(car);
    this.cars = this.cars.filter((c) => c !== car);
  }

  removeOfficer(officer) {
    this.game.peds.removePed(officer);
    this.officers = this.officers.filter((o) => o !== officer);
  }

  canSeePlayer() {
    const p = this.game.playerWorldPos();
    for (const car of this.cars) if (car.distanceTo(p.x, p.z) < 65) return true;
    for (const officer of this.officers) {
      if (officer.state !== 'dead' && Math.hypot(officer.pos.x - p.x, officer.pos.z - p.z) < 45) return true;
    }
    return false;
  }

  updatePolice(dt) {
    const game = this.game;
    const stars = game.wanted.stars;
    const playerPos = game.playerWorldPos();

    // Spawn / retire patrol cars to match the heat.
    this.spawnTimer -= dt;
    const want = this.desiredCars(stars);
    if (this.cars.length < want && this.spawnTimer <= 0) {
      this.spawnCar(playerPos);
      this.spawnTimer = 2.5;
    }
    for (const car of [...this.cars]) {
      const far = car.distanceTo(playerPos.x, playerPos.z) > 280;
      if ((stars === 0 && car.distanceTo(playerPos.x, playerPos.z) > 60) || far) this.removeCar(car);
    }

    // Drive the pursuit: aim at the player, faster than civilian traffic.
    for (const car of this.cars) {
      const targetSpeed = stars >= 3 ? 33 : 28;
      const control = steerToward(car, playerPos.x, playerPos.z, targetSpeed);
      // When close behind the player's car, aim to ram its rear quarter.
      car.drive(dt, control.throttle, control.steer, false, game.city.colliders);
    }

    // Officers on foot.
    this.officerTimer -= dt;
    const playerOnFoot = !game.player.inVehicle;
    if (stars >= 2 && playerOnFoot && this.officers.length < 3 && this.officerTimer <= 0) {
      const nearCar = this.cars.find((c) => c.distanceTo(playerPos.x, playerPos.z) < 34);
      if (nearCar) {
        const officer = game.peds.spawnPed(nearCar.pos.x + 2, nearCar.pos.z, { isOfficer: true, shirt: 0x27354d });
        officer.state = 'chase';
        this.officers.push(officer);
        this.officerTimer = 4;
      }
    }
    for (const officer of [...this.officers]) {
      if (officer.state === 'dead' || officer.state === 'fallen') continue;
      if (stars === 0 || !playerOnFoot) {
        if (Math.hypot(officer.pos.x - playerPos.x, officer.pos.z - playerPos.z) > 12 || stars === 0) {
          this.removeOfficer(officer);
          continue;
        }
      }
      const dx = playerPos.x - officer.pos.x;
      const dz = playerPos.z - officer.pos.z;
      const dist = Math.hypot(dx, dz);
      officer.heading = Math.atan2(dx, dz);
      if (dist > 11) {
        officer.pos.x += (dx / dist) * 5.4 * dt;
        officer.pos.z += (dz / dist) * 5.4 * dt;
        officer.walkPhase += dt * 11;
      }
      collideWithBuildings(officer.pos, 0.5, game.city.colliders);
      officer.mesh.position.copy(officer.pos);
      officer.mesh.rotation.y = officer.heading;
      const swing = Math.sin(officer.walkPhase) * 0.5;
      officer.legL.rotation.x = swing;
      officer.legR.rotation.x = -swing;
    }
  }

  allPoliceCars() {
    return this.cars;
  }
}
