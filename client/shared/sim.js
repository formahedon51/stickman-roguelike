// Авторитетная симуляция забега (перенесено из STICKMAN CO-OP V2).
// Чистый JS без DOM. Этот же модуль сможет использовать Colyseus-сервер.

import {
  ARENA, SOLIDS, PLAYER, ENEMY_TYPES, GRAVITY, MAX_ACTIVE_ENEMIES,
  COMBO_TIME, REVIVE_RANGE, REVIVE_TIME, REVIVE_BLEEDOUT, REVIVE_HP_PCT,
  WAVE_TIME_LIMIT, MAX_PARTICLES, PLAYER_COLORS,
} from './constants.js';
import { RARITY_MULT, rollOffers } from './upgrades.js';
import { applyClass } from './classes.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const aabb = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
const emptyInput = () => ({
  left: false, right: false, jump: false, dash: false, attack: false, swap: false,
});

const SPAWNS = [
  { x: 70, y: null }, { x: 220, y: null }, { x: 380, y: null },
  { x: 520, y: null }, { x: 760, y: null }, { x: 900, y: null },
  { x: ARENA.w - 100, y: null }, { x: ARENA.w - 250, y: null },
];

/* ------------------------------------------------------------------ */
/* Игроки                                                              */
/* ------------------------------------------------------------------ */

export function makePlayer(def, index = 0, solo = false) {
  const p = {
    id: def.id,
    name: def.name || 'Игрок',
    color: def.color || PLAYER_COLORS[index % PLAYER_COLORS.length],
    w: PLAYER.w,
    h: PLAYER.h,
    x: 200 + (index % 8) * 120,
    y: ARENA.floorY - PLAYER.h,
    vx: 0, vy: 0, kb: 0,
    onGround: false, facing: 1, anim: 0, coyote: 0,
    hp: PLAYER.maxHp, maxHp: PLAYER.maxHp, invuln: 0,
    dead: false, downed: false, downedTimer: 0, reviveProgress: 0,
    attackCd: 0, attackT: 0, attackCdMax: 0.36, attackRange: 54,
    damage: 34, lifesteal: 0,
    shootCd: 0, shootT: 0, shootCdMax: 2.5, shootDamage: 24,
    shootSpeed: 720, multishot: 0, pierce: 0,
    dashCd: 0, dashT: 0, dashDir: 1, dashCdMax: 0.9,
    dashSpeed: 900, dashDur: 0.17, dashDamage: 0,
    regenT: 0, regenDelay: 3.5, regenRate: 6,
    moveSpeed: 290, jumpPower: 830, armor: 0, xpMult: 1,
    crit: 0, magnetRange: 170, doubleJump: 0, jumpsLeft: 0,
    damageThisWave: 0, jumpAnim: 0, landAnim: 0,
    _prevOnGround: false, _prevJump: false, _prevDash: false, _prevSwap: false,
    intent: emptyInput(),
    shopLevels: {}, shopOffers: [], ready: false,
    kills: 0, score: 0,
    weapon: 'sword', clazz: 'warrior', switchCd: 0,
  };
  applyClass(p, def.clazz || (index % 2 === 0 ? 'warrior' : 'gunner'));
  return p;
}

export function createWorld(playerDefs, opts = {}) {
  const solo = !!opts.solo;
  const world = {
    solo,
    playerCount: playerDefs.length,
    wave: 0,
    status: 'playing',     // playing | shop | game_over
    phase: 'intermission', // intermission | fight | clear | shop | game_over
    waveTimer: 1.5,
    clearTimer: 0,
    time: 0,
    pending: [],
    players: {},
    enemies: {},
    projectiles: {},
    pickups: [],
    particles: [],
    dmgNumbers: [],
    decals: [],
    dashTrails: [],
    coins: 0,
    xp: 0,
    xpNext: 30,
    level: 1,
    combo: 0,
    comboTimer: 0,
    comboBest: 0,
    score: 0,
    wavesCleared: 0,
    stats: { kills: 0, damage: 0, coinsEarned: 0 },
    banner: { text: '', sub: '', t: 0, max: 2, color: '#e8eef7' },
    shake: 0,
    hurtFlash: 0,
    levelFlash: 0,
    hitStop: 0,
    nextId: 1,
  };
  playerDefs.forEach((def, i) => {
    world.players[def.id] = makePlayer(def, i, solo);
  });
  return world;
}

export function resetWorld(world, playerDefs, opts = {}) {
  const fresh = createWorld(playerDefs, opts);
  for (const k of Object.keys(world)) delete world[k];
  Object.assign(world, fresh);
  return world;
}

/* ------------------------------------------------------------------ */
/* Эффекты                                                             */
/* ------------------------------------------------------------------ */

function burst(world, x, y, n, color, power) {
  if (world.particles.length > MAX_PARTICLES) return;
  power = power || 0.8;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (60 + Math.random() * 240) * power;
    world.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 80,
      life: 0.3 + Math.random() * 0.5,
      size: 2 + Math.random() * 3,
      color,
    });
  }
}

function spawnDmgNumber(world, x, y, val, color, crit) {
  if (val <= 0) return;
  world.dmgNumbers.push({
    x, y,
    val: Math.round(val),
    color,
    life: crit ? 1.0 : 0.8,
    vy: -150,
    vx: (Math.random() - 0.5) * 40,
    crit: !!crit,
  });
}

function addDecal(world, x, y, color) {
  if (world.decals.length >= 24) world.decals.shift();
  world.decals.push({ x, y, r: 3 + Math.random() * 4, color });
}

function showBanner(world, text, sub, color) {
  world.banner.text = text;
  world.banner.sub = sub || '';
  world.banner.color = color || '#e8eef7';
  world.banner.max = sub ? 2.6 : 2.0;
  world.banner.t = world.banner.max;
}

function updateEffects(world, dt) {
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const q = world.particles[i];
    q.life -= dt;
    if (q.life <= 0) { world.particles.splice(i, 1); continue; }
    q.vy += 1100 * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vx *= 0.985;
  }
  for (let i = world.dmgNumbers.length - 1; i >= 0; i--) {
    const d = world.dmgNumbers[i];
    d.life -= dt;
    if (d.life <= 0) { world.dmgNumbers.splice(i, 1); continue; }
    d.y += d.vy * dt;
    d.x += (d.vx || 0) * dt;
    d.vy += 320 * dt;
  }
  for (let i = world.dashTrails.length - 1; i >= 0; i--) {
    world.dashTrails[i].life -= dt;
    if (world.dashTrails[i].life <= 0) world.dashTrails.splice(i, 1);
  }
  if (world.dashTrails.length > 8) world.dashTrails.splice(0, world.dashTrails.length - 8);

  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 70);
  if (world.hurtFlash > 0) world.hurtFlash = Math.max(0, world.hurtFlash - dt);
  if (world.levelFlash > 0) world.levelFlash = Math.max(0, world.levelFlash - dt);

  if (world.banner.t > 0) world.banner.t -= dt;
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = 0;
  }
}

/* ------------------------------------------------------------------ */
/* Физика                                                              */
/* ------------------------------------------------------------------ */

function moveEntity(e, dx, dy) {
  if (dx !== 0) {
    const steps = Math.max(1, Math.ceil(Math.abs(dx) / 6));
    const step = dx / steps;
    for (let i = 0; i < steps; i++) {
      e.x += step;
      let hit = false;
      for (const s of SOLIDS) {
        if (!s.blocksX) continue;
        if (aabb(e, s)) {
          e.x = step > 0 ? s.x - e.w : s.x + s.w;
          e.vx = 0;
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
  }

  e.onGround = false;
  if (dy !== 0) {
    const steps = Math.max(1, Math.ceil(Math.abs(dy) / 6));
    const step = dy / steps;
    for (let i = 0; i < steps; i++) {
      e.y += step;
      let hit = false;
      for (const s of SOLIDS) {
        if (!s.blocksY) continue;
        if (aabb(e, s)) {
          if (step > 0) {
            e.y = s.y - e.h;
            e.vy = 0;
            e.onGround = true;
          } else if (step < 0) {
            e.y = s.y + s.h;
            e.vy = 0;
          }
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
  }
}

function fixInsideWall(e) {
  for (const s of SOLIDS) {
    if (!s.blocksX) continue;
    if (aabb(e, s)) {
      if (s.x < ARENA.w / 2) e.x = s.x + s.w;
      else e.x = s.x - e.w;
      e.vx = 0;
    }
  }
}

function updatePlayerPhysics(world, p, dt) {
  if (p.dead) return;

  if (p.downed) {
    p.vx = 0;
    p.kb = 0;
    p.vy = Math.min(p.vy + GRAVITY * dt, 1500);
    moveEntity(p, 0, p.vy * dt);
    p._prevOnGround = p.onGround;
    return;
  }

  if (p.attackCd > 0) p.attackCd -= dt;
  if (p.attackT > 0) p.attackT -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.dashCd > 0) p.dashCd -= dt;
  if (p.switchCd > 0) p.switchCd = Math.max(0, p.switchCd - dt);
  if (p.shootCd > 0) p.shootCd -= dt;
  if (p.shootT > 0) p.shootT -= dt;

  p.regenT += dt;
  if (p.regenT > p.regenDelay && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + p.regenRate * dt);
  }

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashDir * p.dashSpeed;
    const totalDX = p.vx * dt;
    const dSteps = Math.max(1, Math.ceil(Math.abs(totalDX) / 6));
    const dStep = totalDX / dSteps;
    for (let i = 0; i < dSteps; i++) {
      p.x += dStep;
      let hit = false;
      for (const s of SOLIDS) {
        if (!s.blocksX) continue;
        if (aabb(p, s)) {
          p.x = dStep > 0 ? s.x - p.w : s.x + s.w;
          p.dashT = 0;
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
    if (p.dashDamage > 0) {
      for (const e of Object.values(world.enemies)) {
        if (!e.alive || e._dashHit) continue;
        if (aabb(p, e)) {
          e._dashHit = true;
          damageEnemy(world, e, p.dashDamage, p.dashDir, p);
        }
      }
    }
    p.anim += dt * 16;
    world.dashTrails.push({
      x: p.x, y: p.y, w: p.w, h: p.h, facing: p.facing, life: 0.22, color: p.color,
    });
    p._prevOnGround = p.onGround;
    return;
  }

  const wasOnGround = p._prevOnGround;
  let moveX = 0;
  if (p.intent.left && !p.intent.right) moveX = -1;
  else if (p.intent.right && !p.intent.left) moveX = 1;

  const atLeftWall = p.x <= ARENA.wall + 4;
  const atRightWall = p.x + p.w >= ARENA.w - ARENA.wall - 4;
  if (moveX < 0 && atLeftWall) moveX = 0;
  if (moveX > 0 && atRightWall) moveX = 0;

  const accel = p.onGround ? 3200 : 1900;
  if (moveX < 0) { p.vx -= accel * dt; p.facing = -1; }
  else if (moveX > 0) { p.vx += accel * dt; p.facing = 1; }
  else {
    const fr = (p.onGround ? 3400 : 900) * dt;
    if (Math.abs(p.vx) <= fr) p.vx = 0;
    else p.vx -= Math.sign(p.vx) * fr;
  }
  p.vx = clamp(p.vx, -p.moveSpeed, p.moveSpeed);

  if (p.onGround) {
    p.coyote = 0.1;
    p.jumpsLeft = p.doubleJump;
  } else {
    p.coyote -= dt;
  }

  const jumpPressed = !!p.intent.jump && !p._prevJump;
  p._prevJump = !!p.intent.jump;
  if (jumpPressed) {
    if (p.coyote > 0) {
      p.vy = -p.jumpPower;
      p.onGround = false;
      p.coyote = 0;
      p.jumpAnim = 1.0;
    } else if (p.doubleJump > 0 && p.jumpsLeft > 0) {
      p.vy = -p.jumpPower * 0.92;
      p.jumpsLeft--;
      p.jumpAnim = 1.0;
      burst(world, p.x + p.w / 2, p.y + p.h, p.jumpsLeft > 0 ? 6 : 4, '#bfe3ff', 0.6);
    }
  }

  p.vy = Math.min(p.vy + GRAVITY * dt, 1500);
  const vyBeforeMove = p.vy;

  const kfr = 2400 * dt;
  if (Math.abs(p.kb) <= kfr) p.kb = 0;
  else p.kb -= Math.sign(p.kb) * kfr;

  moveEntity(p, (p.vx + p.kb) * dt, p.vy * dt);

  if (p.onGround && !wasOnGround && vyBeforeMove > 150) {
    p.landAnim = 1.0;
    burst(world, p.x + p.w / 2, p.y + p.h, 5, '#8a8f99', 0.45);
  }

  p._prevOnGround = p.onGround;
  if (p.jumpAnim > 0) p.jumpAnim = Math.max(0, p.jumpAnim - dt * 5);
  if (p.landAnim > 0) p.landAnim = Math.max(0, p.landAnim - dt * 6);
  p.anim += Math.abs(p.vx) * dt * 0.055;
  if (p.onGround && Math.abs(p.vx) < 25) {
    const tgt = Math.round(p.anim / Math.PI) * Math.PI;
    p.anim = lerp(p.anim, tgt, 1 - Math.pow(0.0008, dt));
  }
}

/* ------------------------------------------------------------------ */
/* Бой игроков                                                         */
/* ------------------------------------------------------------------ */

function tryDash(world, p) {
  if (p.dead || p.downed || p.dashCd > 0 || p.dashT > 0) return;
  p.dashCd = p.dashCdMax;
  p.dashT = p.dashDur;
  p.dashDir = p.intent.left ? -1 : p.intent.right ? 1 : p.facing;
  p.facing = p.dashDir;
  p.vy = 0;
  p.invuln = Math.max(p.invuln, p.dashDur + 0.06);
  for (const e of Object.values(world.enemies)) e._dashHit = false;
  burst(world, p.x + p.w / 2, p.y + p.h * 0.5, 9, p.color, 0.75);
}

function trySwitch(p) {
  if (p.dead || p.downed || p.switchCd > 0) return false;
  p.weapon = p.weapon === 'gun' ? 'sword' : 'gun';
  p.switchCd = 0.35;
  p.attackT = 0;
  p.shootT = 0;
  // Небольшая задержка перед атакой новым оружием.
  if (p.weapon === 'gun') p.shootCd = Math.max(p.shootCd, 0.18);
  else p.attackCd = Math.max(p.attackCd, 0.12);
  return true;
}

// Одно активное оружие: J атакует тем, что в руках.
function tryAttack(world, p) {
  if (p.dead || p.downed) return;
  if (p.weapon === 'gun') tryShoot(world, p);
  else tryMelee(world, p);
}

function tryMelee(world, p) {
  if (p.weapon !== 'sword') return;
  if (p.dead || p.downed || p.attackCd > 0 || p.attackT > 0) return;
  p.attackCd = p.attackCdMax;
  p.attackT = 0.24;
  doPlayerHit(world, p);
}

function doPlayerHit(world, p) {
  const R = p.attackRange;
  const hb = {
    x: p.facing > 0 ? p.x + p.w - 8 : p.x + 8 - R,
    y: p.y + 4,
    w: R,
    h: p.h - 8,
  };
  let hit = false;
  for (const e of Object.values(world.enemies)) {
    if (!e.alive) continue;
    if (aabb(hb, e)) {
      hit = true;
      damageEnemy(world, e, p.damage, p.facing, p);
      if (p.lifesteal > 0 && !p.dead) p.hp = Math.min(p.maxHp, p.hp + p.lifesteal);
    }
  }
  if (hit) {
    world.shake = Math.max(world.shake, 6);
    world.hitStop = Math.max(world.hitStop, 0.04);
    burst(world, hb.x + hb.w / 2, hb.y + hb.h / 2, 8, '#9ccdff', 0.7);
  }
}

function tryShoot(world, p) {
  if (p.weapon !== 'gun') return;
  if (p.dead || p.downed || p.shootCd > 0) return;
  let target = null;
  let bestD = Infinity;
  const px = p.x + p.w / 2;
  for (const e of Object.values(world.enemies)) {
    if (!e.alive) continue;
    const dx = (e.x + e.w / 2) - px;
    if (p.facing > 0 && dx < -60) continue;
    if (p.facing < 0 && dx > 60) continue;
    const dy = (e.y + e.h / 2) - (p.y + p.h / 2);
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; target = e; }
  }
  const handX = p.x + p.w / 2 + p.facing * 12;
  const handY = p.y + p.h * 0.42;
  const baseAng = target
    ? Math.atan2((target.y + target.h / 2) - handY, (target.x + target.w / 2) - handX)
    : (p.facing > 0 ? 0 : Math.PI);
  const shots = 1 + p.multishot;
  for (let i = 0; i < shots; i++) {
    const ang = baseAng + (i - (shots - 1) / 2) * 0.18;
    spawnProjectile(world, {
      x: handX, y: handY,
      vx: Math.cos(ang) * p.shootSpeed,
      vy: Math.sin(ang) * p.shootSpeed,
      r: 5, life: 2,
      friendly: true,
      damage: p.shootDamage,
      pierce: p.pierce,
      owner: p.id,
      source: p,
    });
  }
  p.shootCd = p.shootCdMax;
  p.shootT = 0.18;
  burst(world, handX, handY, 5, '#b79cff', 0.5);
  world.shake = Math.max(world.shake, 2);
}

function spawnProjectile(world, data) {
  const id = 'p' + world.nextId++;
  world.projectiles[id] = {
    id,
    ...data,
    _hitEnemies: data.friendly ? new Set() : null,
  };
}

/* ------------------------------------------------------------------ */
/* Урон                                                                */
/* ------------------------------------------------------------------ */

function damageEnemy(world, e, dmg, dir, source) {
  if (!e.alive) return;
  let crit = false;
  if (source && source.crit > 0 && Math.random() < source.crit) {
    dmg *= 2;
    crit = true;
  }
  e.hp -= dmg;
  e.hitFlash = 0.14;
  e.kb = dir * (e.type === 'boss' ? 100 : 320);
  if (e.onGround && e.type !== 'boss') e.vy = -180;
  burst(world, e.x + e.w / 2, e.y + e.h / 2, 8, crit ? '#ffd54f' : '#ff5b5b', 0.7);

  if (source) {
    source.damageThisWave += dmg;
    source.fitness = (source.fitness || 0) + dmg * 0.15;
    world.stats.damage += dmg;
    spawnDmgNumber(world, e.x + e.w / 2, e.y - 5, dmg, crit ? '#ffd54f' : source.color, crit);
  }

  if (e.hp <= 0) {
    e.alive = false;
    e.hp = 0;
    world.combo += 1;
    world.comboTimer = COMBO_TIME;
    if (world.combo > world.comboBest) world.comboBest = world.combo;
    const mult = 1 + Math.min(world.combo - 1, 20) * 0.1;
    world.score += Math.round(e.score * mult);
    world.stats.kills += 1;
    if (source) {
      source.kills += 1;
      source.score += Math.round(e.score * mult);
    }

    const bigKill = e.type === 'boss' || e.type === 'brute';
    world.shake = Math.max(world.shake, bigKill ? 15 : 9);
    world.hitStop = Math.max(world.hitStop, bigKill ? 0.08 : 0.05);
    burst(world, e.x + e.w / 2, e.y + e.h / 2, bigKill ? 40 : 20, e.color, bigKill ? 1.6 : 1.1);
    spawnDrops(world, e.x + e.w / 2, e.y + e.h / 2, e);
    addDecal(world, e.x + e.w / 2, ARENA.floorY - 2, e.color);
  }
}

function damagePlayer(world, p, amount, dir) {
  if (p.dead || p.downed || p.invuln > 0) return;
  const reduced = amount * (1 - Math.min(0.75, p.armor));
  p.hp -= reduced;
  p.invuln = 0.9;
  p.kb = (dir || 1) * 340;
  p.vy = -280;
  p.regenT = 0;
  world.shake = 14;
  world.hurtFlash = 0.45;
  world.hitStop = Math.max(world.hitStop, 0.06);
  burst(world, p.x + p.w / 2, p.y + p.h / 2, 16, p.color, 1.1);

  if (p.hp <= 0) {
    p.hp = 0;
    if (canBeDowned(world, p)) {
      p.downed = true;
      p.downedTimer = REVIVE_BLEEDOUT;
      p.reviveProgress = 0;
      p.vx = 0;
      burst(world, p.x + p.w / 2, p.y + p.h / 2, 24, '#ff6b6b', 1.4);
      world.shake = 18;
    } else {
      p.dead = true;
      burst(world, p.x + p.w / 2, p.y + p.h / 2, 30, p.color, 1.6);
      world.shake = 20;
    }
  }
}

function canBeDowned(world, p) {
  for (const other of Object.values(world.players)) {
    if (other === p) continue;
    if (!other.dead && !other.downed) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Враги                                                               */
/* ------------------------------------------------------------------ */

function createEnemy(world, sp) {
  const T = ENEMY_TYPES[sp.type];
  let hpMult = Math.min(1 + (world.wave - 1) * 0.06, 2.8);
  let spdMult = Math.min(1 + (world.wave - 1) * 0.018, 1.8);
  if (world.solo) hpMult *= 0.9;
  else if (world.playerCount > 2) hpMult *= 1 + (world.playerCount - 2) * 0.06;
  if (sp.type === 'boss') {
    const bossWave = Math.floor(world.wave / 5);
    hpMult *= 1 + bossWave * 0.7;
    spdMult *= 1 + bossWave * 0.04;
  }
  const y = (sp.y === null || sp.y === undefined) ? ARENA.floorY - T.h : sp.y;
  const e = {
    id: 'e' + world.nextId++,
    type: sp.type,
    x: sp.x, y,
    w: T.w, h: T.h,
    vx: 0, vy: 0, kb: 0,
    onGround: false,
    hp: T.hp * hpMult,
    maxHp: T.hp * hpMult,
    speed: T.speed * spdMult,
    dmg: T.dmg,
    score: T.score,
    color: T.color,
    facing: -1,
    anim: 0,
    hitFlash: 0,
    contactCd: 0,
    jumpCd: 0,
    st: 'chase',
    t: 0,
    alive: true,
    _dashHit: false,
    enrage: false,
  };
  world.enemies[e.id] = e;
  burst(world, sp.x + T.w / 2, y + T.h / 2, sp.type === 'boss' ? 40 : 10, T.color, sp.type === 'boss' ? 1.6 : 0.85);
}

function nearestAlivePlayer(world, e) {
  let best = null;
  let bestD = Infinity;
  for (const p of Object.values(world.players)) {
    if (p.dead || p.downed) continue;
    const d = dist2(p.x + p.w / 2, p.y + p.h / 2, e.x + e.w / 2, e.y + e.h / 2);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

function updateEnemies(world, dt) {
  for (const [id, e] of Object.entries(world.enemies)) {
    if (!e.alive) { delete world.enemies[id]; continue; }
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    e.contactCd = Math.max(0, e.contactCd - dt);
    e.jumpCd = Math.max(0, e.jumpCd - dt);
    e.anim += dt * (3 + Math.abs(e.vx) * 0.05);
    e.vy += GRAVITY * dt;

    const kfr = 1700 * dt;
    if (Math.abs(e.kb) <= kfr) e.kb = 0;
    else e.kb -= Math.sign(e.kb) * kfr;

    const target = nearestAlivePlayer(world, e);
    if (!target) {
      e.vx = 0;
      moveEntity(e, e.kb * dt, e.vy * dt);
      continue;
    }

    if (e.type === 'grunt') aiGrunt(world, e, dt, target);
    else if (e.type === 'brute') aiBrute(world, e, dt, target);
    else if (e.type === 'thrower') aiThrower(world, e, dt, target);
    else if (e.type === 'boss') aiBoss(world, e, dt, target);

    if (!e.alive) continue;
    moveEntity(e, (e.vx + e.kb) * dt, e.vy * dt);
  }
}

function aiGrunt(world, e, dt, p) {
  const pcx = p.x + p.w / 2;
  const ecx = e.x + e.w / 2;
  const dx = pcx - ecx;
  const dist = Math.abs(dx);
  const dir = Math.sign(dx) || 1;
  e.facing = dir;

  let sideStep = 0;
  let nearCount = 0;
  let nearDx = 0;
  for (const o of Object.values(world.enemies)) {
    if (o === e || !o.alive || o.type !== 'grunt') continue;
    if (Math.abs((o.y + o.h) - (e.y + e.h)) > 40) continue;
    const odx = (o.x + o.w / 2) - ecx;
    if (Math.abs(odx) < 80) { nearCount++; nearDx += odx; }
  }
  if (nearCount >= 2 && Math.abs(nearDx) < 60) sideStep = (nearDx >= 0 ? -1 : 1) * 0.3;

  e.vx = (dir + sideStep) * e.speed;
  if (e.onGround && e.jumpCd <= 0) {
    if (p.y + p.h < e.y - 40 && dist < 140) { e.vy = -830; e.jumpCd = 0.7; }
    else if (Math.abs(e.vx) < 20 && dist > 80 && Math.random() < 0.15) { e.vy = -780; e.jumpCd = 1.2; }
  }
  if (e.contactCd <= 0 && aabb(p, e)) {
    damagePlayer(world, p, e.dmg, dir);
    e.contactCd = 0.9;
  }
}

function aiBrute(world, e, dt, p) {
  const pcx = p.x + p.w / 2;
  const ecx = e.x + e.w / 2;
  const dx = pcx - ecx;
  const dist = Math.abs(dx);
  const dir = Math.sign(dx) || 1;
  e.t -= dt;

  if (e.st === 'chase') {
    e.facing = dir;
    let otherAttacking = false;
    for (const o of Object.values(world.enemies)) {
      if (o === e || !o.alive || o.type !== 'brute') continue;
      if ((o.st === 'windup' || o.st === 'strike') && Math.abs((o.x + o.w / 2) - ecx) < 240) {
        otherAttacking = true;
        break;
      }
    }
    e.vx = dir * e.speed * (otherAttacking ? 0.6 : 1.1);
    if (e.onGround && e.jumpCd <= 0 && p.y + p.h < e.y - 50 && dist < 240) {
      e.vy = -780;
      e.jumpCd = 1.3;
    }
    if (dist < 115 && Math.abs(p.y - e.y) < 95 && e.t <= 0 && !otherAttacking) {
      e.st = 'windup';
      e.t = 0.5;
      e.vx = 0;
    }
  } else if (e.st === 'windup') {
    e.vx = 0;
    e.facing = dir;
    if (e.t <= 0) {
      e.st = 'strike';
      e.t = 0.16;
      const hb = {
        x: e.facing > 0 ? e.x + e.w : e.x - 52,
        y: e.y + 8, w: 52, h: e.h - 8,
      };
      burst(world, hb.x + hb.w / 2, hb.y + hb.h / 2, 14, '#ff3030', 1);
      world.shake = Math.max(world.shake, 10);
      if (aabb(hb, p)) damagePlayer(world, p, e.dmg, e.facing);
    }
  } else if (e.st === 'strike') {
    e.vx = 0;
    if (e.t <= 0) { e.st = 'recover'; e.t = 0.6; }
  } else {
    e.vx = 0;
    if (e.t <= 0) { e.st = 'chase'; e.t = 0.2; }
  }
}

function aiThrower(world, e, dt, p) {
  const pcx = p.x + p.w / 2;
  const ecx = e.x + e.w / 2;
  const dx = pcx - ecx;
  const dist = Math.abs(dx);
  const dir = Math.sign(dx) || 1;
  e.facing = dir;

  const sameLevel = Math.abs((p.y + p.h) - (e.y + e.h)) < 50;
  if (sameLevel && dist < 200) e.vx = -dir * e.speed * 1.2;
  else if (dist < 240) e.vx = -dir * e.speed * 0.7;
  else if (dist > 400) e.vx = dir * e.speed * 0.8;
  else e.vx = 0;

  if (e.onGround && e.jumpCd <= 0) {
    if (p.y + p.h < e.y - 55 && dist < 320) { e.vy = -720; e.jumpCd = 1.4; }
    else if (sameLevel && dist < 200 && Math.random() < 0.04) { e.vy = -750; e.jumpCd = 1.6; }
  }

  e.t -= dt;
  if (e.t <= 0 && dist < 600 && dist > 120) {
    e.t = 1.9 + Math.random() * 0.5;
    const flight = Math.min(1.0, dist / 430);
    const px = pcx + p.vx * flight * 0.6;
    const py = p.y + p.h / 2 + p.vy * flight * 0.4;
    const ex = e.x + e.w / 2;
    const ey = e.y + e.h * 0.35;
    const ang = Math.atan2(py - ey, px - ex);
    spawnProjectile(world, {
      x: ex, y: ey,
      vx: Math.cos(ang) * 430,
      vy: Math.sin(ang) * 430,
      r: 6, life: 3,
      friendly: false,
    });
    burst(world, ex, ey, 5, '#ff8a6a', 0.5);
  }
}

function aiBoss(world, e, dt, p) {
  const pcx = p.x + p.w / 2;
  const ecx = e.x + e.w / 2;
  const dx = pcx - ecx;
  const dir = Math.sign(dx) || 1;
  e.facing = dir;
  e.t -= dt;

  if (!e.enrage && e.hp < e.maxHp * 0.5) {
    e.enrage = true;
    e.speed *= 1.35;
    burst(world, e.x + e.w / 2, e.y + e.h / 2, 30, '#ff3030', 1.8);
    world.shake = 15;
  }

  if (e.st === 'chase') {
    e.vx = dir * e.speed;
    if (e.t <= 0 && e.onGround) {
      if (Math.random() < 0.55) { e.st = 'slamWindup'; e.t = 0.75; e.vx = 0; }
      else { e.st = 'sprayWindup'; e.t = 0.65; e.vx = 0; }
    }
  } else if (e.st === 'slamWindup') {
    e.vx = 0;
    if (e.t <= 0) {
      e.st = 'slamAir';
      e.t = 0.65;
      e.vy = -1100;
      e.vx = dir * 380;
    }
  } else if (e.st === 'slamAir') {
    if (e.onGround && e.t < 0.4) {
      e.st = 'slamLand';
      e.t = 0.4;
      const hb = { x: e.x - 50, y: e.y + e.h - 70, w: e.w + 100, h: 70 };
      burst(world, hb.x + hb.w / 2, hb.y + hb.h / 2, 40, '#ff3030', 1.8);
      world.shake = 18;
      world.hitStop = Math.max(world.hitStop, 0.08);
      for (const pl of Object.values(world.players)) {
        if (pl.dead || pl.downed) continue;
        if (aabb(hb, pl)) damagePlayer(world, pl, e.dmg, dir);
      }
    }
  } else if (e.st === 'slamLand') {
    e.vx = 0;
    if (e.t <= 0) { e.st = 'chase'; e.t = e.enrage ? 1.6 : 2.6; }
  } else if (e.st === 'sprayWindup') {
    e.vx = 0;
    if (e.t <= 0) {
      e.st = 'sprayFire';
      e.t = 0.5;
      const baseAng = Math.atan2(
        p.y + p.h / 2 - (e.y + e.h * 0.4),
        p.x + p.w / 2 - (e.x + e.w / 2),
      );
      const count = e.enrage ? 7 : 5;
      for (let i = 0; i < count; i++) {
        const ang = baseAng + (i - (count - 1) / 2) * 0.16;
        spawnProjectile(world, {
          x: e.x + e.w / 2,
          y: e.y + e.h * 0.4,
          vx: Math.cos(ang) * 430,
          vy: Math.sin(ang) * 430,
          r: 9, life: 3,
          friendly: false,
        });
      }
      burst(world, e.x + e.w / 2, e.y + e.h * 0.4, 20, '#ff8a6a', 1.2);
    }
  } else if (e.st === 'sprayFire') {
    e.vx = 0;
    if (e.t <= 0) { e.st = 'chase'; e.t = e.enrage ? 1.4 : 2.2; }
  }

  if (e.contactCd <= 0) {
    for (const pl of Object.values(world.players)) {
      if (pl.dead || pl.downed) continue;
      if (aabb(pl, e)) {
        damagePlayer(world, pl, e.dmg * 0.6, dir);
        e.contactCd = 1.0;
        break;
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Снаряды                                                             */
/* ------------------------------------------------------------------ */

function updateProjectiles(world, dt) {
  for (const [id, b] of Object.entries(world.projectiles)) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;

    let dead = b.life <= 0;
    if (!dead && (b.x < 0 || b.x > ARENA.w || b.y < 0 || b.y > ARENA.h)) dead = true;

    if (!dead) {
      for (const s of SOLIDS) {
        if (b.x > s.x && b.x < s.x + s.w && b.y > s.y && b.y < s.y + s.h) {
          dead = true;
          break;
        }
      }
    }

    if (!dead && b.friendly) {
      const br = { x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 };
      for (const e of Object.values(world.enemies)) {
        if (!e.alive) continue;
        if (b._hitEnemies && b._hitEnemies.has(e.id)) continue;
        if (aabb(br, e)) {
          damageEnemy(world, e, b.damage, Math.sign(b.vx) || 1, b.source || null);
          if (b._hitEnemies) b._hitEnemies.add(e.id);
          if (b.pierce > 0) b.pierce--;
          else dead = true;
          break;
        }
      }
    }

    if (!dead && !b.friendly) {
      const br = { x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 };
      for (const p of Object.values(world.players)) {
        if (p.dead || p.downed) continue;
        if (aabb(br, p)) {
          damagePlayer(world, p, 8, Math.sign(b.vx) || 1);
          dead = true;
          break;
        }
      }
    }

    if (dead) {
      burst(world, b.x, b.y, 5, b.friendly ? '#b79cff' : '#ff8a6a', 0.55);
      delete world.projectiles[id];
    }
  }
}

/* ------------------------------------------------------------------ */
/* Дроп и опыт                                                         */
/* ------------------------------------------------------------------ */

function spawnDrops(world, x, y, enemy) {
  const coinCount = enemy.type === 'boss' ? 20 : enemy.type === 'brute' ? 5 : enemy.type === 'thrower' ? 3 : 2;
  for (let i = 0; i < coinCount; i++) {
    world.pickups.push({
      id: 'k' + world.nextId++,
      type: 'coin',
      x: x + (Math.random() - 0.5) * 16,
      y: y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 260,
      vy: -160 - Math.random() * 130,
      r: 6, value: 1, life: 0,
      bob: Math.random() * 6.283,
      magnet: false,
    });
  }
  const xpMult = 1 + world.wave * 0.04;
  const xpVal = (enemy.type === 'boss' ? 120 : enemy.type === 'brute' ? 24 : enemy.type === 'thrower' ? 12 : 7) * xpMult;
  const orbCount = enemy.type === 'boss' ? 8 : enemy.type === 'brute' ? 3 : 1;
  for (let i = 0; i < orbCount; i++) {
    world.pickups.push({
      id: 'k' + world.nextId++,
      type: 'xp',
      x: x + (Math.random() - 0.5) * 16,
      y: y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 200,
      vy: -170 - Math.random() * 110,
      r: 7,
      value: Math.max(1, Math.round(xpVal / orbCount)),
      life: 0,
      bob: Math.random() * 6.283,
      magnet: false,
    });
  }
}

function updatePickups(world, dt) {
  const alive = Object.values(world.players).filter((p) => !p.dead && !p.downed);
  if (!alive.length) return;

  for (let i = world.pickups.length - 1; i >= 0; i--) {
    const k = world.pickups[i];
    k.life += dt;

    let near = null;
    let nearD2 = Infinity;
    for (const p of alive) {
      const d2 = dist2(p.x + p.w / 2, p.y + p.h / 2, k.x, k.y);
      if (d2 < nearD2) { nearD2 = d2; near = p; }
    }
    if (!near) continue;

    const magnetRange = world.phase === 'clear' ? 2000 : (near.magnetRange || 170);
    if (!k.magnet && k.life > 0.3 && nearD2 < magnetRange * magnetRange) k.magnet = true;

    const cx = near.x + near.w / 2;
    const cy = near.y + near.h / 2;
    const dx = cx - k.x;
    const dy = cy - k.y;
    const d2 = dx * dx + dy * dy;

    if (d2 < 27 * 27) {
      if (k.type === 'coin') {
        world.coins += k.value;
        world.stats.coinsEarned += k.value;
      } else {
        gainXp(world, k.value * near.xpMult, near);
      }
      burst(world, k.x, k.y, 4, k.type === 'coin' ? '#e8c15a' : '#7fe0a0', 0.45);
      world.pickups.splice(i, 1);
      continue;
    }

    if (k.magnet) {
      const dist = Math.sqrt(d2);
      if (dist > 0.5) {
        k.x += dx / dist * 840 * dt;
        k.y += dy / dist * 840 * dt;
      }
    } else {
      k.vy += 1400 * dt;
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      const floorY = ARENA.floorY - k.r;
      if (k.y > floorY) {
        k.y = floorY;
        k.vy *= -0.38;
        k.vx *= 0.72;
        if (Math.abs(k.vy) < 60) k.vy = 0;
      }
      if (k.x < ARENA.wall + k.r) { k.x = ARENA.wall + k.r; k.vx = Math.abs(k.vx) * 0.6; }
      else if (k.x > ARENA.w - ARENA.wall - k.r) { k.x = ARENA.w - ARENA.wall - k.r; k.vx = -Math.abs(k.vx) * 0.6; }
    }
  }
}

function gainXp(world, v, player) {
  world.xp += v;
  while (world.xp >= world.xpNext) {
    world.xp -= world.xpNext;
    world.level += 1;
    world.xpNext = Math.round(world.xpNext * 1.2 + 5);
    for (const p of Object.values(world.players)) {
      if (p.dead) continue;
      p.maxHp += 10;
      if (!p.downed) p.hp = p.maxHp;
      p.damage += 2;
      p.shootDamage += 1.5;
    }
    const first = Object.values(world.players)[0];
    if (first) burst(world, first.x, first.y, 24, '#7fe0a0', 1.2);
    world.shake = Math.max(world.shake, 8);
    world.levelFlash = 0.55;
  }
}

/* ------------------------------------------------------------------ */
/* Волны                                                               */
/* ------------------------------------------------------------------ */

function spawnWave(world, n) {
  const list = [];
  if (n > 0 && n % 5 === 0) {
    list.push('boss');
    const minions = Math.min(2 + Math.floor(n / 5), 5);
    for (let i = 0; i < minions; i++) list.push('grunt');
  } else {
    const solo = !!world.solo;
    const extra = Math.max(0, (world.playerCount || 1) - 2);
    const grunts = Math.min(
      (solo ? 1 : 2) + Math.floor(n * (solo ? 0.7 : 0.9)) + (solo ? 0 : extra),
      solo ? 7 : 12,
    );
    const brutes = n >= 3
      ? Math.min(Math.floor((n - 1) * 0.5) + (solo ? 0 : extra), solo ? 2 : 4)
      : 0;
    const throwers = n >= 3
      ? Math.min(Math.floor(n / 4) + 1 + (solo ? 0 : Math.floor(extra / 2)), solo ? 1 : 3)
      : 0;
    for (let i = 0; i < grunts; i++) list.push('grunt');
    for (let i = 0; i < brutes; i++) list.push('brute');
    for (let i = 0; i < throwers; i++) list.push('thrower');
  }

  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }

  world.pending = list.map((type, i) => {
    const sp = SPAWNS[Math.floor(Math.random() * SPAWNS.length)];
    return { type, x: sp.x, y: sp.y, t: 0.15 + i * 0.35 };
  });
}

function updateWaves(world, dt) {
  if (world.phase === 'intermission') {
    world.waveTimer -= dt;
    if (world.waveTimer <= 0) {
      world.wave += 1;
      spawnWave(world, world.wave);
      world.phase = 'fight';
      world.waveTimer = 0;
      for (const p of Object.values(world.players)) p.damageThisWave = 0;
      const isBoss = world.wave % 5 === 0;
      if (isBoss) showBanner(world, 'БОСС', 'ВОЛНА ' + world.wave, '#ff6b6b');
      else showBanner(world, 'ВОЛНА ' + world.wave, '', isBoss ? '#ffd54f' : '#e8eef7');
    }
    return;
  }

  if (world.phase === 'clear') {
    world.clearTimer -= dt;
    if (world.clearTimer <= 0) openShop(world);
    return;
  }

  if (world.phase !== 'fight') return;

  world.waveTimer += dt;

  for (const item of world.pending) item.t -= dt;

  const activeEnemies = Object.values(world.enemies).filter((e) => e.alive).length;
  if (activeEnemies < MAX_ACTIVE_ENEMIES) {
    for (let i = 0; i < world.pending.length; i++) {
      if (world.pending[i].t <= 0) {
        createEnemy(world, world.pending[i]);
        world.pending.splice(i, 1);
        break;
      }
    }
  }

  const total = Object.values(world.enemies).filter((e) => e.alive).length + world.pending.length;
  if (world.waveTimer > WAVE_TIME_LIMIT || total === 0) {
    world.enemies = {};
    world.pending = [];
    world.waveTimer = 0;
    world.wavesCleared += 1;
    world.coins += 12;
    world.stats.coinsEarned += 12;
    for (const p of Object.values(world.players)) {
      if (!p.dead) p.hp = p.maxHp;
    }
    world.score += 120 * world.wave;
    showBanner(world, 'ВОЛНА ПРОЙДЕНА', '', '#4affa0');
    world.phase = 'clear';
    world.clearTimer = 1.2;
  }
}

/* ------------------------------------------------------------------ */
/* Магазин                                                             */
/* ------------------------------------------------------------------ */

export function openShop(world) {
  world.status = 'shop';
  world.phase = 'shop';
  for (const p of Object.values(world.players)) {
    if (p.dead) continue;
    p.shopOffers = rollOffers(world.wave, p.shopLevels);
    p.ready = false;
  }
}

export function buyOffer(world, playerId, index) {
  if (world.status !== 'shop') return false;
  const p = world.players[playerId];
  if (!p || p.dead) return false;
  const offer = p.shopOffers[index];
  if (!offer || offer.purchased || world.coins < offer.cost) return false;
  world.coins -= offer.cost;
  const mult = RARITY_MULT[offer.rarity] || 1;
  offer.upg.apply(p, mult);
  p.shopLevels[offer.upg.id] = (p.shopLevels[offer.upg.id] || 0) + 1;
  offer.purchased = true;
  return true;
}

export function setReady(world, playerId) {
  if (world.status !== 'shop') return;
  const p = world.players[playerId];
  if (!p || p.dead) return;
  p.ready = true;
  checkAllReady(world);
}

function checkAllReady(world) {
  const alive = Object.values(world.players).filter((p) => !p.dead);
  if (!alive.length) return;
  if (alive.every((p) => p.ready)) {
    world.status = 'playing';
    world.phase = 'intermission';
    world.waveTimer = 1.5;
  }
}

/* ------------------------------------------------------------------ */
/* Тик                                                                 */
/* ------------------------------------------------------------------ */

export function step(world, inputs, dt) {
  if (world.status === 'game_over') return;
  if (world.status === 'shop') {
    updateEffects(world, dt);
    return;
  }
  if (world.hitStop > 0) {
    world.hitStop = Math.max(0, world.hitStop - dt);
    updateEffects(world, dt);
    return;
  }

  world.time += dt;

  // Нокдаун / подъём
  for (const p of Object.values(world.players)) {
    if (!p.downed) continue;
    p.downedTimer -= dt;
    if (p.downedTimer <= 0) {
      p.downed = false;
      p.dead = true;
      burst(world, p.x + p.w / 2, p.y + p.h / 2, 24, '#ff3030', 1.4);
      world.shake = 12;
      continue;
    }
    let beingRevived = false;
    for (const other of Object.values(world.players)) {
      if (other === p || other.dead || other.downed) continue;
      const d2 = dist2(
        other.x + other.w / 2, other.y + other.h / 2,
        p.x + p.w / 2, p.y + p.h / 2,
      );
      if (d2 < REVIVE_RANGE * REVIVE_RANGE) { beingRevived = true; break; }
    }
    if (beingRevived) {
      p.reviveProgress += dt / REVIVE_TIME;
      if (p.reviveProgress >= 1) {
        p.downed = false;
        p.reviveProgress = 0;
        p.hp = p.maxHp * REVIVE_HP_PCT;
        p.invuln = 1.5;
        p.downedTimer = 0;
        burst(world, p.x + p.w / 2, p.y + p.h / 2, 24, '#4affa0', 1.4);
        world.shake = 8;
      }
    } else {
      p.reviveProgress = Math.max(0, p.reviveProgress - dt * 0.5);
    }
  }

  for (const p of Object.values(world.players)) {
    if (p.dead) continue;
    p.intent = inputs[p.id] || emptyInput();
    if (!p.downed) {
      if (p.intent.swap && !p._prevSwap) trySwitch(p);
      if (p.intent.dash) tryDash(world, p);
      if (p.intent.attack) tryAttack(world, p);
    }
    p._prevSwap = !!p.intent.swap;
    updatePlayerPhysics(world, p, dt);
  }

  updateEnemies(world, dt);
  updateProjectiles(world, dt);
  updatePickups(world, dt);
  updateWaves(world, dt);
  updateEffects(world, dt);

  for (const p of Object.values(world.players)) if (!p.dead) fixInsideWall(p);
  for (const e of Object.values(world.enemies)) if (e.alive) fixInsideWall(e);

  const active = Object.values(world.players).filter((p) => !p.dead);
  const nonDowned = active.filter((p) => !p.downed);
  if (!active.length || !nonDowned.length) {
    world.status = 'game_over';
    world.phase = 'game_over';
    world.stats = {
      wave: world.wave,
      kills: world.stats.kills,
      damage: Math.round(world.stats.damage),
      coinsEarned: world.stats.coinsEarned,
      comboBest: world.comboBest,
      score: world.score,
      time: Math.round(world.time),
    };
  }
}
