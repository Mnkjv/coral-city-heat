// Coral City Heat — traffic AI and parked cars.
// Traffic cars pick a lane on the road grid, cruise it, and at each
// intersection either carry on or turn onto the crossing road. They brake
// for the car (or pedestrian) in front. Parked cars just sit at kerbs
// waiting to be stolen.

import { CITY, CAR_COLORS } from './config.js';
import { rand, randRange, pickRandom } from './random.js';
import { Vehicle, steerToward } from './vehicle.js';

const LANE = 3; // lane offset from road centre

function laneCoordFor(axis, roadCoord, dir) {
  // Right-hand traffic: your lane sits to one side depending on direction.
  return roadCoord + (dir > 0 ? LANE : -LANE);
}

export class TrafficSystem {
  constructor(scene) {
    this.scene = scene;
    this.trafficCars = []; // {vehicle, axis, road, dir, cruise}
    this.parkedCars = [];
  }

  spawnTrafficCar(nearX, nearZ) {
    const axis = rand() < 0.5 ? 'x' : 'z';
    const road = pickRandom(CITY.roads);
    const dir = rand() < 0.5 ? 1 : -1;
    const along = Math.max(-160, Math.min(160, (axis === 'x' ? nearX : nearZ) + randRange(-70, 70)));
    const lane = laneCoordFor(axis, road, dir);
    const x = axis === 'x' ? along : lane;
    const z = axis === 'x' ? lane : along;
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const vehicle = new Vehicle(this.scene, x, z, heading, pickRandom(CAR_COLORS));
    vehicle.occupied = true; // a civilian driver is at the wheel
    const entry = { vehicle, axis, road, dir, cruise: randRange(10, 14), targetAlong: along + dir * 60 };
    this.trafficCars.push(entry);
    return entry;
  }

  spawnTraffic(count) {
    for (let i = 0; i < count; i++) this.spawnTrafficCar(randRange(-160, 160), randRange(-160, 160));
  }

  spawnParkedCars(count) {
    for (let i = 0; i < count; i++) {
      const road = pickRandom(CITY.roads);
      const along = randRange(-160, 160);
      const side = pickRandom([-1, 1]);
      const alongAxis = rand() < 0.5;
      const x = alongAxis ? along : road + side * (CITY.roadHalf - 1.2);
      const z = alongAxis ? road + side * (CITY.roadHalf - 1.2) : along;
      const heading = alongAxis ? Math.PI / 2 : 0;
      const vehicle = new Vehicle(this.scene, x, z, heading, pickRandom(CAR_COLORS));
      vehicle.isParked = true;
      this.parkedCars.push(vehicle);
    }
  }

  // Called when the player steals a traffic car: the entry leaves traffic.
  releaseCar(vehicle) {
    this.trafficCars = this.trafficCars.filter((e) => e.vehicle !== vehicle);
    this.parkedCars = this.parkedCars.filter((v) => v !== vehicle);
  }

  trafficVehicles() {
    return this.trafficCars.map((e) => e.vehicle);
  }

  nextIntersectionAlong(entry) {
    const along = entry.axis === 'x' ? entry.vehicle.pos.x : entry.vehicle.pos.z;
    let best = null;
    for (const r of CITY.roads) {
      const ahead = (r - along) * entry.dir;
      if (ahead > 4 && (best === null || ahead < best.ahead)) best = { road: r, ahead };
    }
    return best;
  }

  updateTraffic(dt, game) {
    const playerPos = game.playerWorldPos();
    for (const entry of this.trafficCars) {
      const v = entry.vehicle;
      if (v.driverIsPlayer || v.dead) continue;
      // Recycle cars that ended up far from the action: teleport the same
      // car onto a road nearer the player so the city always feels alive.
      if (v.distanceTo(playerPos.x, playerPos.z) > 230) {
        entry.axis = rand() < 0.5 ? 'x' : 'z';
        entry.road = pickRandom(CITY.roads);
        entry.dir = rand() < 0.5 ? 1 : -1;
        const along = Math.max(-160, Math.min(160, (entry.axis === 'x' ? playerPos.x : playerPos.z) + randRange(-90, 90)));
        const lane = laneCoordFor(entry.axis, entry.road, entry.dir);
        v.pos.x = entry.axis === 'x' ? along : lane;
        v.pos.z = entry.axis === 'x' ? lane : along;
        v.heading = entry.axis === 'x' ? (entry.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (entry.dir > 0 ? 0 : Math.PI);
        v.speed = 0;
        v.syncMesh(0);
        continue;
      }
      const cross = this.nextIntersectionAlong(entry);
      let targetX;
      let targetZ;
      const along = entry.axis === 'x' ? v.pos.x : v.pos.z;
      if (cross && cross.ahead < 9 && rand() < 0.012) {
        // Turn onto the crossing road (sometimes).
        const turnDir = rand() < 0.5 ? 1 : -1;
        entry.axis = entry.axis === 'x' ? 'z' : 'x';
        entry.road = cross.road;
        entry.dir = turnDir;
      }
      const lane = laneCoordFor(entry.axis, entry.road, entry.dir);
      if (entry.axis === 'x') { targetX = v.pos.x + entry.dir * 30; targetZ = lane; }
      else { targetX = lane; targetZ = v.pos.z + entry.dir * 30; }

      // Brake for anything solid ahead: other cars, or the player on foot.
      let desired = entry.cruise;
      const f = v.forward();
      const checkAhead = (x, z, radius) => {
        const dx = x - v.pos.x;
        const dz = z - v.pos.z;
        const aheadDist = dx * f.x + dz * f.z;
        const sideDist = Math.abs(dx * f.z - dz * f.x);
        if (aheadDist > 0 && aheadDist < radius && sideDist < 2) return true;
        return false;
      };
      for (const other of game.allVehicles()) {
        if (other !== v && checkAhead(other.pos.x, other.pos.z, 9)) { desired = 0; break; }
      }
      if (desired > 0 && !game.player.inVehicle && checkAhead(playerPos.x, playerPos.z, 8)) desired = 0;
      if (desired > 0) {
        for (const ped of game.peds.peds) {
          if (ped.state !== 'dead' && checkAhead(ped.pos.x, ped.pos.z, 7)) { desired = 0; break; }
        }
      }
      const control = steerToward(v, targetX, targetZ, desired);
      v.drive(dt, control.throttle, control.steer, false, game.city.colliders);
      void along;
    }
  }
}
