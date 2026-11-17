// Coral City Heat — deterministic seeded randomness.
// The city, traffic and crowds are placed with this generator so a given
// ?seed= always builds the same city (the screenshot scenes rely on that).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rng = mulberry32(1);

export function seedRandom(seed) {
  rng = mulberry32(seed >>> 0 || 1);
}

export function rand() {
  return rng();
}

export function randRange(min, max) {
  return min + rng() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

export function pickRandom(list) {
  return list[Math.floor(rng() * list.length) % list.length];
}

export function readSeedFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get('seed'));
  return Number.isFinite(seed) && seed > 0 ? Math.floor(seed) : 1;
}

export function readShotFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('shot') || '';
}
