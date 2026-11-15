// Cometfall Harvest — tuning, palette and wave layout.
// One clear job: every number the rest of the game reads, in one place.

export const VIEW = { width: 1280, height: 720 };

export const PALETTE = {
  spaceTop: '#0b1030',
  spaceBottom: '#070818',
  nebulaA: '#3b1d6e',
  nebulaB: '#0d3b4d',
  nebulaC: '#6e1d3f',
  hudPanel: 'rgba(8, 12, 34, 0.72)',
  hudBorder: 'rgba(140, 180, 255, 0.35)',
  text: '#eaf2ff',
  textDim: '#9fb4dd',
  gold: '#ffd166',
  cyan: '#6ee7ff',
  pink: '#ff7ad9',
  green: '#7dff9e',
  red: '#ff5d6c',
  launcher: '#ffb347',
};

export const PHYSICS = {
  gravity: 4000000, // G * mass scale for planet pull: strong enough to bend a comet
  cometRadius: 9,
  maxSpeed: 980,
  launchSpeed: 560,
  minLaunchSpeed: 260,
  maxLaunchSpeed: 780,
  trailLength: 46,
  offscreenMargin: 90,
  collectRadius: 26,
};

export const GAME = {
  totalWaves: 10,
  baseLaunches: 5,
  shardBaseScore: 100,
  comboStep: 25, // extra points per combo step
  waveClearBonus: 250,
  launchRefundOnClear: 1, // +1 launch banked into the next wave, capped
  maxLaunches: 9,
  bestKey: 'cometfall-harvest-best',
};

// Planet looks: body colour, band colour, ring or not.
export const PLANET_STYLES = [
  { body: '#c96f3f', band: '#8a4526', ring: false },
  { body: '#4f8fd0', band: '#2c5a8f', ring: false },
  { body: '#7bc96f', band: '#4a8a44', ring: true },
  { body: '#b06fd0', band: '#7a3f9e', ring: true },
  { body: '#d0a24f', band: '#8f6a2c', ring: false },
  { body: '#4fd0c0', band: '#2c8a7e', ring: false },
];

// Wave layout: how many planets, shards, black holes and novas a wave gets.
// Difficulty grows: more planets, tighter launches, moving shards, black holes.
export function waveSpec(wave) {
  const w = Math.max(1, Math.min(GAME.totalWaves, wave));
  return {
    planets: Math.min(1 + Math.floor((w - 1) / 2), 4),
    shards: 4 + Math.min(w, 6),
    blackHoles: w >= 4 ? Math.min(Math.floor((w - 2) / 3), 2) : 0,
    novas: w >= 3 ? 1 : 0, // +1 launch pickup
    movingShards: w >= 2,
    launches: Math.min(GAME.baseLaunches + (w >= 6 ? 1 : 0), GAME.maxLaunches),
    planetMassMin: 1.0,
    planetMassMax: 1.0 + w * 0.12,
  };
}
