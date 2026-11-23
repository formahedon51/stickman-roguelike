// Общие константы клиента и будущего сервера (чистый JS, без DOM).

export const ARENA = { w: 1280, h: 720, floorY: 640, wall: 22 };

export const GRAVITY = 2000;

export const PLATFORMS = [
  { x: 160, y: 490, w: 230, h: 18 },
  { x: 890, y: 490, w: 230, h: 18 },
  { x: 530, y: 350, w: 220, h: 18 },
];

export const SOLIDS = [
  { x: 0, y: ARENA.floorY, w: ARENA.w, h: ARENA.h - ARENA.floorY, blocksX: false, blocksY: true },
  { x: 0, y: 0, w: ARENA.wall, h: ARENA.h, blocksX: true, blocksY: false },
  { x: ARENA.w - ARENA.wall, y: 0, w: ARENA.wall, h: ARENA.h, blocksX: true, blocksY: false },
  ...PLATFORMS.map((p) => ({ ...p, blocksX: false, blocksY: true })),
];

export const PLAYER = {
  w: 26, h: 60,
  speed: 290,
  accelGround: 3200,
  accelAir: 1900,
  jump: 830,
  coyote: 0.1,
  dashSpeed: 900,
  dashDur: 0.17,
  dashCd: 0.9,
  attackRange: 54,
  attackDamage: 34,
  attackCd: 0.36,
  attackDur: 0.24,
  shootDamage: 24,
  shootSpeed: 720,
  shootCd: 2.5,
  maxHp: 100,
  regenDelay: 3.5,
  regenRate: 6,
};

export const ENEMY_TYPES = {
  grunt: { hp: 50, w: 24, h: 56, speed: 100, dmg: 7, score: 25, color: '#ff3b3b' },
  brute: { hp: 160, w: 36, h: 78, speed: 65, dmg: 16, score: 70, color: '#d81f1f' },
  thrower: { hp: 42, w: 24, h: 56, speed: 85, dmg: 0, score: 45, color: '#ff7a5c' },
  runner: { hp: 30, w: 22, h: 50, speed: 170, dmg: 5, score: 30, color: '#ff8a3d' },
  shielder: { hp: 180, w: 36, h: 74, speed: 50, dmg: 11, score: 90, color: '#5eead4' },
  bomber: { hp: 50, w: 28, h: 52, speed: 80, dmg: 20, score: 70, color: '#ffb347' },
  flyer: { hp: 38, w: 24, h: 46, speed: 135, dmg: 6, score: 60, color: '#b79cff', flying: true },
  healer: { hp: 60, w: 26, h: 58, speed: 70, dmg: 3, score: 85, color: '#4affa0' },
  sniper: { hp: 44, w: 24, h: 56, speed: 60, dmg: 0, score: 80, color: '#7fe7ff' },
  summoner: { hp: 100, w: 30, h: 64, speed: 55, dmg: 6, score: 110, color: '#c4a7ff' },
  splitter: { hp: 120, w: 34, h: 68, speed: 70, dmg: 8, score: 95, color: '#8dff6b' },
  spawnling: { hp: 14, w: 18, h: 36, speed: 150, dmg: 3, score: 8, color: '#a8ff8a' },
  boss: { hp: 800, w: 84, h: 150, speed: 75, dmg: 32, score: 500, color: '#8b1a1a' },
};

export const PLAYER_COLORS = [
  '#4aa3ff', '#4affa0', '#ffd54f', '#ff6bcb',
  '#b79cff', '#5eead4', '#ff9f68', '#f472b6',
];

export const TICK_RATE = 20;        // тиков симуляции в секунду
export const MAX_ACTIVE_ENEMIES = 15;

export const COMBO_TIME = 3.0;
export const REVIVE_RANGE = 90;
export const REVIVE_TIME = 2.5;
export const REVIVE_BLEEDOUT = 15;
export const REVIVE_HP_PCT = 0.3;
export const WAVE_TIME_LIMIT = 180;
export const MAX_PARTICLES = 400;
