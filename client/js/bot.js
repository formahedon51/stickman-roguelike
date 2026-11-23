// Умный авто-бот: сам выбирает цель, оружие, уклоняется и покупает улучшения.
// Не трогает DOM, поэтому его легко тестировать и прогонять на скорость.

import { WEAPONS, getWeapon, weaponReach } from '../shared/weapons.js?v=20261123';
import { ARENA } from '../shared/constants.js?v=20261123';

const centerX = (e) => e.x + e.w / 2;
const centerY = (e) => e.y + e.h / 2;

const SHOP_SCORE = {
  hp: 72,
  shield: 74,
  armor: 70,
  regenRate: 56,
  regenFast: 48,
  killHeal: 58,
  thorns: 50,
  lifesteal: 62,
  move: 55,
  jump: 38,
  doubleJump: 40,
  dashCd: 54,
  dashSpeed: 42,
  dashDur: 44,
  dashDmg: 46,
  dashInvuln: 52,
  melee: 56,
  atkSpd: 60,
  atkRange: 44,
  shootDmg: 58,
  shootCd: 66,
  shootSpd: 40,
  multishot: 70,
  pierce: 60,
  bulletSize: 46,
  crit: 62,
  critDmg: 58,
  retarget: 76,
  execute: 52,
  bossDmg: 57,
  lowHpDmg: 50,
  magnet: 46,
  xpGain: 50,
  coinGain: 44,
  swapSpeed: 38,
};

export function createBotBrain() {
  const mem = {
    targetId: null,
    retarget: 0,
    strafe: 1,
    strafeT: 0,
    jumpT: 0,
    dashT: 0,
    swapT: 0,
    stuckT: 0,
    lastX: 0,
    mode: 'idle',
    shopBuys: 0,
    shopPicks: [],
  };

  function reset() {
    mem.targetId = null;
    mem.retarget = 0;
    mem.strafe = 1;
    mem.strafeT = 0;
    mem.jumpT = 0;
    mem.dashT = 0;
    mem.swapT = 0;
    mem.stuckT = 0;
    mem.lastX = 0;
    mem.mode = 'idle';
    mem.shopBuys = 0;
    mem.shopPicks = [];
  }

  function move(inp, dir) {
    if (dir < 0) inp.left = true;
    else if (dir > 0) inp.right = true;
  }

  // Не отступать в стену: если места нет, уходить в другую сторону.
  function safeDir(p, dir) {
    const leftSpace = p.x - (ARENA.wall + 12);
    const rightSpace = (ARENA.w - ARENA.wall - 12) - (p.x + p.w);
    if (dir < 0 && leftSpace < 110) return 1;
    if (dir > 0 && rightSpace < 110) return -1;
    return dir;
  }

  function nearWall(p) {
    return p.x < 150 || p.x + p.w > ARENA.w - 150;
  }

  function chooseWeapon(p, distance, vertical, forceRanged) {
    let best = p.weapon;
    let bestScore = -Infinity;
    for (const id of p.arsenal || [p.weapon]) {
      const w = WEAPONS[id];
      if (!w) continue;
      if (forceRanged && w.kind !== 'ranged') continue;
      let score = 0;
      if (w.kind === 'melee') {
        score = distance < 115 ? 104 - distance * 0.34 : 12;
        if (p.dashDamage > 0) score += 8;
      } else if (id === 'shotgun') {
        score = distance < 230 ? 108 - distance * 0.24 : 20;
      } else if (id === 'rifle') {
        score = distance > 170 ? 98 - Math.abs(distance - 430) * 0.055 : 56;
      } else if (id === 'staff') {
        score = distance > 110 && distance < 640 ? 94 : 45;
      } else {
        score = distance > 80 && distance < 650 ? 84 : 55;
      }
      if (vertical > 120) score -= 8;
      if (id === p.weapon) score += 12;
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    return best;
  }

  function bossDanger(boss, p) {
    if (!boss || !boss.alive || boss.type !== 'boss') return false;
    const dx = Math.abs(centerX(boss) - centerX(p));
    if (boss.st === 'slamWindup' || boss.st === 'slamAir' || boss.st === 'sprayWindup') return true;
    if (boss.st === 'sprayFire') return true;
    if (boss.st === 'slamLand') return dx < 180;
    if (boss.st === 'chase' && dx < 150 && boss.t < 0.3) return true;
    if (boss.enrage && dx < 90) return true;
    return false;
  }

  function hasRangedWeapon(p) {
    return (p.arsenal || []).some((id) => getWeapon(id).kind === 'ranged');
  }

  function pickTarget(world, p) {
    let best = null;
    let bestScore = Infinity;
    const ranged = hasRangedWeapon(p);
    const all = Object.values(world.enemies).filter((e) => e.alive);
    const nearMinions = all.some(
      (e) => e.type !== 'boss' && Math.hypot(centerX(e) - centerX(p), centerY(e) - centerY(p)) < 280,
    );
    for (const e of all) {
      const dx = centerX(e) - centerX(p);
      const dy = centerY(e) - centerY(p);
      let score = Math.hypot(dx, dy);
      if (e.type === 'thrower') score -= 150;
      if (e.type === 'brute') score -= 70;
      if (e.type === 'boss') {
        if (nearMinions) score -= 20;
        else score -= ranged ? 230 : 90;
      }
      score += Math.abs((e.y + e.h) - (p.y + p.h)) * 0.7;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  function incomingThreat(world, p) {
    let danger = 0;
    let jump = false;
    let dash = false;

    for (const b of Object.values(world.projectiles)) {
      if (b.friendly || b.life <= 0) continue;
      const vx = b.vx || 0;
      const vy = b.vy || 0;
      const v2 = vx * vx + vy * vy;
      if (v2 < 1) continue;
      const dx = centerX(p) - b.x;
      const dy = centerY(p) - b.y;
      const t = (dx * vx + dy * vy) / v2;
      if (t <= 0 || t > 0.85) continue;
      const px = b.x + vx * t;
      const py = b.y + vy * t;
      if (Math.hypot(centerX(p) - px, centerY(p) - py) > 42) continue;
      danger = b.x < centerX(p) ? 1 : -1;
      dash = true;
      if (b.y > p.y + p.h * 0.5) jump = true;
      break;
    }

    for (const e of Object.values(world.enemies)) {
      if (!e.alive) continue;
      const dx = centerX(e) - centerX(p);
      if (e.type === 'brute' && e.st === 'windup' && Math.abs(dx) < 165) {
        danger = dx > 0 ? -1 : 1;
        dash = true;
        jump = true;
        break;
      }
      if (e.type === 'boss' && Math.abs(dx) < 240 && bossDanger(e, p)) {
        danger = dx > 0 ? -1 : 1;
        dash = true;
        jump = true;
        break;
      }
    }

    if (p.hp / p.maxHp < 0.3) {
      const close = Object.values(world.enemies).find(
        (e) => e.alive && Math.abs(centerX(e) - centerX(p)) < 120,
      );
      if (close) {
        danger = centerX(close) > centerX(p) ? -1 : 1;
        dash = true;
        jump = true;
      }
    }

    return { danger, jump, dash };
  }

  function input(world, p, dt) {
    const inp = {
      left: false, right: false, jump: false, dash: false, attack: false, swap: false,
    };
    if (p.dead || p.downed || world.status !== 'playing') return inp;

    mem.retarget -= dt;
    mem.strafeT -= dt;
    mem.jumpT -= dt;
    mem.dashT -= dt;
    mem.swapT -= dt;
    mem.stuckT -= dt;
    if (mem.strafeT <= 0) {
      mem.strafe = Math.random() < 0.5 ? -1 : 1;
      mem.strafeT = 0.8 + Math.random() * 1.1;
    }

    const enemies = Object.values(world.enemies).filter((e) => e.alive);
    if (!enemies.length) {
      mem.mode = world.phase === 'clear' ? 'collect' : 'idle';
      if (world.pickups.length) {
        let near = null;
        let nd = Infinity;
        for (const k of world.pickups) {
          const d = Math.hypot(k.x - centerX(p), k.y - centerY(p));
          if (d < nd) { nd = d; near = k; }
        }
        if (near) {
          if (near.x < p.x - 20) move(inp, -1);
          else if (near.x > p.x + p.w + 20) move(inp, 1);
          if (near.y < p.y - 40 && p.onGround && Math.abs(near.x - centerX(p)) < 110) inp.jump = true;
        }
      } else if (Math.abs(centerX(p) - 640) > 60) {
        move(inp, centerX(p) < 640 ? 1 : -1);
      }
      return inp;
    }

    let target = mem.targetId ? world.enemies[mem.targetId] : null;
    if (!target || !target.alive || mem.retarget <= 0) {
      target = pickTarget(world, p);
      mem.targetId = target ? target.id : null;
      mem.retarget = 0.4;
    }
    if (!target) return inp;

    const tx = centerX(target);
    const ty = centerY(target);
    const dx = tx - centerX(p);
    const dy = ty - centerY(p);
    const dist = Math.hypot(dx, dy);
    const vertical = ty - centerY(p);
    const dir = dx < 0 ? -1 : 1;

    const threat = incomingThreat(world, p);
    if (threat.dash && p.dashCd <= 0 && mem.dashT <= 0 && !p.dashT) {
      move(inp, safeDir(p, threat.danger || dir));
      inp.dash = true;
      mem.dashT = 0.45;
    }
    if (threat.jump && p.onGround && mem.jumpT <= 0) {
      inp.jump = true;
      mem.jumpT = 0.35;
    }

    const isBoss = target.type === 'boss';
    const angry = isBoss && bossDanger(target, p);
    const lowHp = p.hp / p.maxHp < 0.42;
    const nearThreat = dist < 320;
    const forceRanged = (lowHp || isBoss || target.type === 'brute') && hasRangedWeapon(p);
    const retreat = ((isBoss && angry && dist < 390) || (lowHp && nearThreat && dist < 330));

    const desired = chooseWeapon(p, dist, vertical, forceRanged);
    if (desired && desired !== p.weapon && p.switchCd <= 0 && mem.swapT <= 0) {
      inp.swap = true;
      mem.swapT = 0.55;
    }

    const w = getWeapon(p.weapon);
    const ideal = w.idealRange || 260;
    const horizontal = Math.abs(dx);

    if (!inp.dash) {
      if (retreat) {
        const away = safeDir(p, -dir);
        move(inp, away);
        if (p.onGround && (nearWall(p) || Math.abs(dx) < 90)) {
          inp.jump = true;
          mem.jumpT = 0.4;
        }
        if (p.dashCd <= 0 && mem.dashT <= 0) {
          inp.dash = true;
          mem.dashT = 0.6;
        }
        if (w.kind === 'ranged' && dist < weaponReach(p, p.weapon)) {
          inp.attack = true;
        }
      } else if (w.kind === 'melee') {
        if (horizontal > 34) move(inp, dir);
        else if (horizontal < 18) move(inp, -dir);
        if (horizontal < 62 && Math.abs(vertical) < 74 && !(isBoss && bossDanger(target, p))) {
          inp.attack = true;
        }
      } else {
        const maxRange = w.id === 'shotgun' ? 220 : weaponReach(p, p.weapon);
        if (horizontal > ideal + 35) move(inp, dir);
        else if (horizontal < ideal - 55) move(inp, safeDir(p, -dir));
        else move(inp, safeDir(p, mem.strafe));
        if (dist < maxRange && Math.abs(vertical) < 300) inp.attack = true;
      }
    }

    // Прыжки на платформы и к цели выше.
    if (p.onGround && mem.jumpT <= 0) {
      if (vertical < -60 && horizontal < 190) {
        inp.jump = true;
        mem.jumpT = 0.45;
      } else if (horizontal > 140 && horizontal < 260 && Math.random() < 0.018) {
        inp.jump = true;
        mem.jumpT = 0.7;
      }
    }

    // Рывок к цели, если прокачан урон рывком.
    if (
      w.kind === 'melee' && p.dashDamage > 0 && dist > 90 && dist < 190 &&
      p.dashCd <= 0 && mem.dashT <= 0 && !threat.dash && !retreat
    ) {
      move(inp, dir);
      inp.dash = true;
      mem.dashT = 0.5;
    }

    // Если застряли — прыжок.
    if (mem.stuckT <= 0) {
      const moved = Math.abs(p.x - mem.lastX);
      if ((inp.left || inp.right) && moved < 5 && p.onGround) {
        inp.jump = true;
        mem.jumpT = 0.4;
      }
      mem.lastX = p.x;
      mem.stuckT = 0.5;
    }

    mem.mode = retreat ? 'retreat' : w.kind === 'melee' ? 'melee' : 'ranged';
    return inp;
  }

  function shop(world, p) {
    const picks = [];
    const offers = (p.shopOffers || [])
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => !o.purchased && world.coins >= o.cost);
    if (!offers.length) {
      mem.shopPicks = [];
      return picks;
    }

    const hasRanged = (p.arsenal || []).some((id) => getWeapon(id).kind === 'ranged');
    const hasMelee = (p.arsenal || []).some((id) => getWeapon(id).kind === 'melee');
    const lowHp = p.hp / p.maxHp < 0.55;

    offers.sort((a, b) => scoreOffer(b.o, p, hasRanged, hasMelee, lowHp) - scoreOffer(a.o, p, hasRanged, hasMelee, lowHp));

    for (const { o, i } of offers) {
      if (picks.length >= 3) break;
      picks.push(i);
    }
    mem.shopPicks = picks;
    mem.shopBuys = picks.length;
    return picks;
  }

  function scoreOffer(offer, p, hasRanged, hasMelee, lowHp) {
    const u = offer.upg || {};
    let score = SHOP_SCORE[u.id] || 40;
    if (u.unlockWeapon) {
      if ((p.arsenal || []).includes(u.unlockWeapon)) return -1000;
      score = p.arsenal.length < 2 ? 78 : 50;
      if (u.unlockWeapon === 'pistol' && !hasRanged) score += 12;
    }
    if (hasRanged && ['shootDmg', 'shootCd', 'multishot', 'pierce', 'bulletSize', 'shootSpd', 'retarget'].includes(u.id)) score += 8;
    if (hasMelee && ['melee', 'atkSpd', 'atkRange', 'lifesteal'].includes(u.id)) score += 6;
    if (lowHp && ['hp', 'shield', 'armor', 'regenRate', 'regenFast', 'killHeal'].includes(u.id)) score += 22;
    return score - offer.cost * 0.35;
  }

  return { input, shop, reset, mem };
}
