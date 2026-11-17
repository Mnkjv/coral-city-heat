// Coral City Heat — Dario Fenn's five-mission story chain.
// A small stage machine: each mission is a list of stages with a target on
// the map, an objective line for the HUD, and a check that advances it.
// Dialogue banners introduce every beat; cash rewards land on completion.

import { PLACES, CRIME_HEAT, WANTED } from './config.js';

export const MISSION_DEFS = [
  { title: 'M1 · First Wheels', reward: 150 },
  { title: 'M2 · Harbor Run', reward: 250 },
  { title: 'M3 · Neon Debt', reward: 300 },
  { title: 'M4 · Hot Cargo', reward: 400 },
  { title: 'M5 · The Marlin Job', reward: 800 },
];

const DIALOGUE = {
  m1a: 'Dario Fenn: "Sol. I need a wheelman again. Lift any car and bring it to the Bayview drop."',
  m1b: 'Dario Fenn: "Good wheels. Now the drop point — east side, follow the gold marker."',
  m2a: 'Dario Fenn: "A package is waiting at Coral Marina. Pick it up, then downtown. Clock is ticking once you touch it."',
  m2b: 'Dario Fenn: "You have the package and the heat noticed. Move!"',
  m3a: 'Dario Fenn: "Three debtors owe the Syndicate — no, owe ME. Visit each marker, hold E, collect."',
  m4a: 'Dario Fenn: "A marked coupe is sitting pretty uptown. Take it to my chop shop. Expect company."',
  m4b: 'Dario Fenn: "That is the car. The whole city will watch you drive it. Go!"',
  m5a: 'Dario Fenn: "Vera Calloway runs the Marlin Syndicate out of that warehouse. End it, Sol."',
  m5b: 'Vera Calloway: "You walked into the wrong warehouse, courier."',
  m5c: 'Dario Fenn: "It is done. Get to the beach safehouse and disappear."',
  done: 'Dario Fenn: "Coral City is ours again. Drinks are on me — free roam, partner."',
};

export class MissionSystem {
  constructor(game, startIndex, storyComplete) {
    this.game = game;
    this.index = Math.min(startIndex || 0, MISSION_DEFS.length);
    this.storyComplete = storyComplete === true || this.index >= MISSION_DEFS.length;
    if (this.storyComplete) this.index = MISSION_DEFS.length;
    this.stage = 0;
    this.briefTimer = 1.2; // first briefing appears shortly after spawn
    this.briefed = false;
    this.timer = 0;        // M2 delivery countdown
    this.holdTime = 0;     // M3 hold-E progress
    this.debtDone = [false, false, false];
    this.hotCar = null;
    this.guards = [];
    this.target = null;
    this.objectiveText = '';
  }

  currentTarget() {
    return this.target;
  }

  say(text) {
    this.game.hud.showDialogue(text, 5.5);
  }

  startMissionBrief() {
    this.briefed = true;
    if (this.index === 0) this.say(DIALOGUE.m1a);
    else if (this.index === 1) this.say(DIALOGUE.m2a);
    else if (this.index === 2) this.say(DIALOGUE.m3a);
    else if (this.index === 3) {
      this.say(DIALOGUE.m4a);
      this.hotCar = this.game.spawnHotCar();
    } else if (this.index === 4) this.say(DIALOGUE.m5a);
  }

  completeMission() {
    const game = this.game;
    const def = MISSION_DEFS[this.index];
    game.player.cash += def.reward;
    game.audio.playCashChime();
    game.audio.playMissionJingle();
    game.hud.showBanner(`${def.title} complete — +$${def.reward}`, 4);
    this.index += 1;
    this.stage = 0;
    this.briefed = false;
    this.briefTimer = 3.5;
    this.target = null;
    if (this.index >= MISSION_DEFS.length) {
      this.storyComplete = true;
      this.say(DIALOGUE.done);
    }
    game.saveNow();
  }

  failDelivery() {
    this.say('Dario Fenn: "Too slow — the package went cold. Pick it up again at the marina."');
    this.stage = 0;
    this.timer = 0;
  }

  onPlayerEnteredVehicle(vehicle) {
    if (this.index === 0 && this.stage === 0) {
      this.stage = 1;
      this.say(DIALOGUE.m1b);
    }
    if (this.index === 3 && this.stage === 0 && vehicle === this.hotCar) {
      this.stage = 1;
      this.game.wanted.forceStars(3, 9999);
      this.say(DIALOGUE.m4b);
    }
  }

  distTo(place) {
    const p = this.game.playerWorldPos();
    return Math.hypot(p.x - place.x, p.z - place.z);
  }

  setObjective(text, place) {
    this.objectiveText = text;
    this.target = place ? { x: place.x, z: place.z, label: place.label } : null;
  }

  updateMissions(dt) {
    const game = this.game;
    if (!this.briefed) {
      this.briefTimer -= dt;
      if (this.briefTimer <= 0 && this.index < MISSION_DEFS.length) this.startMissionBrief();
    }
    if (this.index >= MISSION_DEFS.length) {
      this.setObjective('Story complete — Coral City is yours. Free roam.', null);
      return;
    }

    if (this.index === 0) this.updateM1();
    else if (this.index === 1) this.updateM2(dt);
    else if (this.index === 2) this.updateM3(dt);
    else if (this.index === 3) this.updateM4();
    else if (this.index === 4) this.updateM5();
  }

  updateM1() {
    if (this.stage === 0) {
      this.setObjective('Steal a car (walk up and press F)', null);
    } else {
      this.setObjective('Drive to the Bayview drop point', PLACES.dropPoint);
      if (this.game.player.inVehicle && this.distTo(PLACES.dropPoint) < 7) this.completeMission();
    }
  }

  updateM2(dt) {
    if (this.stage === 0) {
      this.setObjective('Pick up the package at Coral Marina', PLACES.marina);
      if (this.distTo(PLACES.marina) < 8) {
        this.stage = 1;
        this.timer = 120;
        const w = this.game.wanted;
        w.heat = Math.max(w.heat, WANTED.thresholds[1] + 2);
        w.addCrime(CRIME_HEAT.missionPickup);
        this.say(DIALOGUE.m2b);
        this.game.audio.playCashChime();
      }
    } else {
      this.timer -= dt;
      this.setObjective(`Deliver the package downtown — ${Math.max(0, Math.ceil(this.timer))}s left`, PLACES.downtown);
      if (this.distTo(PLACES.downtown) < 8) this.completeMission();
      else if (this.timer <= 0) this.failDelivery();
    }
  }

  updateM3(dt) {
    const next = this.debtDone.findIndex((d) => !d);
    if (next === -1) {
      this.completeMission();
      return;
    }
    const spot = PLACES.debtSpots[next];
    this.setObjective(`Collect the debt (${this.debtDone.filter(Boolean).length}/3) — hold E at the marker`, spot);
    const near = this.distTo(spot) < 4 && !this.game.player.inVehicle;
    this.game.hud.setPrompt(near ? 'Hold E to collect the debt' : '');
    if (near && this.game.input.down('KeyE')) {
      this.holdTime += dt;
      if (this.holdTime >= 2) {
        this.holdTime = 0;
        this.debtDone[next] = true;
        this.game.player.cash += 60;
        this.game.audio.playCashChime();
        this.game.hud.showBanner('Debt collected — +$60', 2.5);
      }
    } else {
      this.holdTime = Math.max(0, this.holdTime - dt * 2);
    }
  }

  updateM4() {
    if (this.stage === 0) {
      this.setObjective('Get into the marked coupe', PLACES.hotCar);
    } else {
      this.setObjective('Deliver the coupe to the chop shop — lose them or outrun them', PLACES.chopShop);
      if (this.game.player.inVehicle === this.hotCar && this.distTo(PLACES.chopShop) < 8) {
        this.game.wanted.forcedTimer = 0;
        this.game.wanted.forcedStars = 0;
        this.game.wanted.heat = Math.min(this.game.wanted.heat, WANTED.thresholds[2]);
        this.completeMission();
      }
    }
  }

  updateM5() {
    const game = this.game;
    if (this.stage === 0) {
      this.setObjective('Reach the Marlin warehouse', PLACES.warehouse);
      if (this.distTo(PLACES.warehouse) < 9) {
        this.stage = 1;
        this.guards = game.spawnWarehouseGuards();
        this.say(DIALOGUE.m5b);
      }
    } else if (this.stage === 1) {
      const left = this.guards.filter((g) => g.state !== 'dead').length;
      this.setObjective(`Survive the warehouse shootout — guards left: ${left}`, PLACES.warehouse);
      if (left === 0) {
        this.stage = 2;
        game.wanted.forceStars(4, 9999);
        this.say(DIALOGUE.m5c);
      }
    } else {
      this.setObjective('Escape to the beach safehouse', PLACES.safehouse);
      if (this.distTo(PLACES.safehouse) < 8) {
        game.wanted.forcedTimer = 0;
        game.wanted.forcedStars = 0;
        game.wanted.clearWanted();
        this.completeMission();
      }
    }
  }
}
