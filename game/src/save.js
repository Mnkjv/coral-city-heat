// Coral City Heat — localStorage save game.
// Persists cash, mission progress, the story-complete flag and where the
// player stood, so Continue on the start screen picks the run back up.

import { SAVE_KEY, PLAYER } from './config.js';

export function hasSaveGame() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function loadSaveGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: Number.isFinite(data.cash) ? data.cash : PLAYER.startCash,
      missionIndex: Number.isFinite(data.missionIndex) ? data.missionIndex : 0,
      storyComplete: data.storyComplete === true,
      pos: data.pos && Number.isFinite(data.pos.x) ? data.pos : { ...PLAYER.startPos },
    };
  } catch {
    return null;
  }
}

export function writeSaveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: Math.round(state.cash),
      missionIndex: state.missionIndex,
      storyComplete: state.storyComplete === true,
      pos: { x: Math.round(state.pos.x * 10) / 10, z: Math.round(state.pos.z * 10) / 10 },
    }));
  } catch {
    // Storage can be unavailable (private mode); the game simply runs unsaved.
  }
}

export function clearSaveGame() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
