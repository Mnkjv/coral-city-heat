// Coral City Heat — the wanted system.
// Crimes add heat; heat crosses thresholds to become 1–5 stars. While no
// police unit can see the player, heat decays after a short grace period.

import { WANTED } from './config.js';

export class WantedSystem {
  constructor(game) {
    this.game = game;
    this.heat = 0;
    this.stars = 0;
    this.timeSinceSeen = 99;
    this.forcedStars = 0;   // missions can pin a minimum wanted level
    this.forcedTimer = 0;
    this.locked = false;    // screenshot staging can pin the level exactly
  }

  addCrime(heatPoints) {
    if (this.locked) return;
    this.heat = Math.min(WANTED.thresholds[WANTED.maxStars] + 60, this.heat + heatPoints);
    this.recomputeStars();
  }

  forceStars(stars, seconds) {
    this.forcedStars = Math.max(this.forcedStars, stars);
    this.forcedTimer = Math.max(this.forcedTimer, seconds);
    this.recomputeStars();
  }

  clearWanted() {
    this.heat = 0;
    this.forcedStars = 0;
    this.forcedTimer = 0;
    this.stars = 0;
  }

  recomputeStars() {
    let stars = 0;
    for (let i = 1; i <= WANTED.maxStars; i++) {
      if (this.heat >= WANTED.thresholds[i]) stars = i;
    }
    this.stars = Math.max(stars, this.forcedTimer > 0 ? this.forcedStars : 0);
  }

  // policeCanSee: any police car or officer close enough to the player.
  updateWanted(dt, policeCanSee) {
    if (this.locked) return;
    if (policeCanSee) this.timeSinceSeen = 0;
    else this.timeSinceSeen += dt;
    if (this.forcedTimer > 0) {
      this.forcedTimer -= dt;
      if (this.forcedTimer <= 0) this.forcedStars = 0;
    }
    if (this.timeSinceSeen > WANTED.seenGraceSeconds && this.stars > 0) {
      this.heat = Math.max(0, this.heat - WANTED.decayPerSecond * dt);
    }
    this.recomputeStars();
  }
}
