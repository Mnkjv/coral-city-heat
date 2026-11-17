// Coral City Heat — shared tuning constants.
// One place for the numbers every other system reads: city layout, physics,
// wanted levels, mission spots. Nothing here imports anything.

export const CITY = {
  roads: [-160, -120, -80, -40, 0, 40, 80, 120, 160], // road centre lines, both axes
  pitch: 40,          // distance between neighbouring roads
  roadHalf: 6,        // half the width of a road
  walkHalf: 8.5,      // sidewalk outer edge, from road centre
  half: 172,          // playable half-extent of the city grid
  beachX: 178,        // sand starts here
  waterX: 198,        // water starts here
  worldEdge: 250,     // hard clamp for actors
};

export const PLAYER = {
  walkSpeed: 6,
  sprintSpeed: 10,
  radius: 0.55,
  maxHealth: 100,
  startCash: 120,
  startPos: { x: -148, z: -132 },
};

export const VEHICLE = {
  accel: 16,
  brake: 26,
  reverseMax: 9,
  drag: 0.55,
  gripTurn: 1.9,      // steering rate at speed
  maxSpeed: 34,
};

export const WANTED = {
  maxStars: 5,
  // heat points needed to reach each star (index = stars)
  thresholds: [0, 12, 30, 55, 85, 120],
  decayPerSecond: 2.2,     // heat lost while unseen
  seenGraceSeconds: 4,     // time without police sight before decay starts
  washCost: 150,
};

export const CRIME_HEAT = {
  carTheft: 14,
  pedHit: 22,
  gunshot: 16,
  policeHit: 30,
  policeKill: 45,
  missionPickup: 12,
};

export const PLACES = {
  hospital: { x: -120, z: 120, label: 'Coral General Hospital' },
  washGarage: { x: -40, z: 164, label: 'Sparkle Wash Garage' },
  dropPoint: { x: 124, z: -44, label: 'Bayview drop point' },
  marina: { x: 168, z: 116, label: 'Coral Marina' },
  downtown: { x: 44, z: 36, label: 'Downtown plaza' },
  debtSpots: [
    { x: -84, z: 76, label: 'Debt: pawn shop' },
    { x: 84, z: -84, label: 'Debt: arcade' },
    { x: -4, z: 124, label: 'Debt: beach bar' },
  ],
  chopShop: { x: -124, z: -124, label: 'Fenn chop shop' },
  hotCar: { x: 84, z: 124, label: 'Marked coupe' },
  warehouse: { x: 132, z: 132, label: 'Marlin warehouse' },
  safehouse: { x: 182, z: -124, label: 'Beach safehouse' },
};

export const SAVE_KEY = 'coralCityHeatSaveV1';

export const CAR_COLORS = [0xd64541, 0x3f7fbf, 0xe8b13a, 0x59b06a, 0xd9d9d9, 0x8e6fc0, 0xef7d3c, 0x3fbfae, 0x9aa3ad, 0x704214];
export const POLICE_COLOR = 0xf2f4f6;
