// Coral City Heat — HUD and the live minimap.
// All DOM elements live in index.html; this class writes cash, health,
// wanted stars, objective text with distance, dialogue and banners, the
// damage vignette, the speed readout, and paints the north-up minimap
// (roads, player arrow, police blips, gold mission marker, wash garage).

import { CITY, PLACES } from './config.js';

export class Hud {
  constructor() {
    this.el = {};
    const ids = ['hud', 'cash', 'healthfill', 'stars', 'objective', 'dialogue', 'banner', 'prompt', 'speed', 'vignette', 'minimap', 'muted'];
    for (const id of ids) this.el[id] = document.getElementById(id);
    this.mapCtx = this.el.minimap.getContext('2d');
    this.dialogueTimer = 0;
    this.bannerTimer = 0;
    this.vignetteTimer = 0;
    this.promptText = '';
  }

  showDialogue(text, seconds) {
    this.el.dialogue.textContent = text;
    this.el.dialogue.style.opacity = '1';
    this.dialogueTimer = seconds || 5;
  }

  showBanner(text, seconds) {
    this.el.banner.textContent = text;
    this.el.banner.style.opacity = '1';
    this.bannerTimer = seconds || 3;
  }

  setPrompt(text) {
    this.promptText = text;
  }

  flashDamage() {
    this.vignetteTimer = 0.45;
  }

  updateHud(dt, game) {
    const player = game.player;
    this.el.cash.textContent = `$${Math.round(player.cash)}`;
    this.el.healthfill.style.width = `${Math.max(0, player.health)}%`;
    this.el.healthfill.style.background = player.health > 35 ? '#59d977' : '#e84a3c';
    const stars = game.wanted.stars;
    this.el.stars.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    this.el.stars.style.color = stars > 0 ? '#ffc93c' : 'rgba(255,255,255,0.25)';

    const target = game.missions.currentTarget();
    let objective = game.missions.objectiveText || '';
    if (target) {
      const p = game.playerWorldPos();
      const dist = Math.hypot(p.x - target.x, p.z - target.z);
      objective += ` — ${Math.round(dist)}m`;
    }
    this.el.objective.textContent = objective;
    this.el.prompt.textContent = this.promptText;
    this.el.speed.textContent = player.inVehicle ? `${Math.round(Math.abs(player.inVehicle.speed) * 3.6)} km/h` : '';
    this.el.muted.textContent = game.audio.muted ? 'MUTED (M)' : '';

    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.el.dialogue.style.opacity = '0';
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.el.banner.style.opacity = '0';
    }
    this.vignetteTimer = Math.max(0, this.vignetteTimer - dt);
    const lowHealth = player.health < 35 ? (35 - player.health) / 60 : 0;
    this.el.vignette.style.opacity = String(Math.min(0.85, this.vignetteTimer * 1.4 + lowHealth));
    this.drawMinimap(game);
  }

  worldToMap(x, z, size) {
    const scale = size / 430;
    return [(x + 195) * scale, (z + 195) * scale];
  }

  drawMinimap(game) {
    const ctx = this.mapCtx;
    const size = this.el.minimap.width;
    ctx.fillStyle = '#20262e';
    ctx.fillRect(0, 0, size, size);
    // Beach and water on the east edge.
    const [sandX] = this.worldToMap(CITY.beachX, 0, size);
    const [waterX] = this.worldToMap(CITY.waterX, 0, size);
    ctx.fillStyle = '#d9c48f';
    ctx.fillRect(sandX, 0, waterX - sandX, size);
    ctx.fillStyle = '#2d7fb8';
    ctx.fillRect(waterX, 0, size - waterX, size);
    // Roads.
    ctx.strokeStyle = '#565e66';
    ctx.lineWidth = 3;
    for (const r of CITY.roads) {
      const [rx] = this.worldToMap(r, 0, size);
      const [, rz] = this.worldToMap(0, r, size);
      ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, rz); ctx.lineTo(size, rz); ctx.stroke();
    }
    // Wash garage: blue square marked W.
    const [wx, wz] = this.worldToMap(PLACES.washGarage.x, PLACES.washGarage.z, size);
    ctx.fillStyle = '#3f8fbf';
    ctx.fillRect(wx - 5, wz - 5, 10, 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('W', wx, wz + 3);
    // Hospital: white square, red H.
    const [hx, hz] = this.worldToMap(PLACES.hospital.x, PLACES.hospital.z, size);
    ctx.fillStyle = '#f4f6f8';
    ctx.fillRect(hx - 5, hz - 5, 10, 10);
    ctx.fillStyle = '#e84a3c';
    ctx.fillText('H', hx, hz + 3);
    // Mission target: pulsing gold ring.
    const target = game.missions.currentTarget();
    if (target) {
      const [tx, tz] = this.worldToMap(target.x, target.z, size);
      const pulse = 5 + Math.sin(performance.now() * 0.006) * 1.6;
      ctx.strokeStyle = '#ffc93c';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(tx, tz, pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffc93c';
      ctx.beginPath(); ctx.arc(tx, tz, 2.6, 0, Math.PI * 2); ctx.fill();
    }
    // Police blips blink red/blue.
    const blink = Math.sin(performance.now() * 0.012) > 0;
    for (const car of game.police.cars) {
      const [px, pz] = this.worldToMap(car.pos.x, car.pos.z, size);
      ctx.fillStyle = blink ? '#ff3b30' : '#3a7bff';
      ctx.beginPath(); ctx.arc(px, pz, 3, 0, Math.PI * 2); ctx.fill();
    }
    for (const officer of game.police.officers) {
      if (officer.state === 'dead') continue;
      const [px, pz] = this.worldToMap(officer.pos.x, officer.pos.z, size);
      ctx.fillStyle = blink ? '#ff3b30' : '#3a7bff';
      ctx.fillRect(px - 2, pz - 2, 4, 4);
    }
    // Player arrow: canvas x is world x, canvas y is world z (north-up with
    // -z at the top). A world heading h points along (sin h, cos h), which
    // on canvas is a rotation of PI - h for a triangle drawn pointing up.
    const p = game.playerWorldPos();
    const [px, pz] = this.worldToMap(p.x, p.z, size);
    const heading = game.player.inVehicle ? game.player.inVehicle.heading : game.player.heading;
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.PI - heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
