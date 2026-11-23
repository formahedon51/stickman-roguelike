// Магазинные улучшения, редкости и разблокировка оружия.

import { addWeapon, getWeapon } from './weapons.js?v=20261123';

export const RARITY_COLOR = {
  common: '#aaaaaa',
  uncommon: '#4affa0',
  rare: '#4aa3ff',
  legendary: '#ffd54f',
};

export const RARITY_LABEL = {
  common: 'ОБЫЧНОЕ',
  uncommon: 'НЕОБЫЧНОЕ',
  rare: 'РЕДКОЕ',
  legendary: 'ЛЕГЕНДАРНОЕ',
};

export const RARITY_MULT = {
  common: 1.0,
  uncommon: 1.5,
  rare: 2.0,
  legendary: 3.0,
};

export function rollRarity(waveNum) {
  const bonus = Math.min(waveNum * 0.6, 18);
  const weights = {
    common: Math.max(8, 60 - bonus * 2.2),
    uncommon: 25 + bonus * 0.6,
    rare: 12 + bonus,
    legendary: 3 + bonus * 0.4,
  };
  const total = weights.common + weights.uncommon + weights.rare + weights.legendary;
  let r = Math.random() * total;
  for (const k of ['legendary', 'rare', 'uncommon', 'common']) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  return 'common';
}

export const UPGRADE_POOL = [
  // ---- выживание ----
  { id: 'hp', name: 'Здоровье', desc: '+20 HP', base: 8, step: 6, max: 99, apply(p, m) { const v = Math.round(20 * m); p.maxHp += v; if (!p.downed) p.hp = Math.min(p.maxHp, p.hp + v); } },
  { id: 'regenRate', name: 'Регенерация', desc: 'Быстрее восстанавливает HP', base: 10, step: 8, max: 5, apply(p, m) { p.regenRate += Math.round(2 * m); } },
  { id: 'regenFast', name: 'Откат регена', desc: 'Реген начинается раньше', base: 9, step: 7, max: 3, apply(p, m) { p.regenDelay = Math.max(1.2, p.regenDelay - 0.5 * m); } },
  { id: 'armor', name: 'Броня', desc: 'Снижает получаемый урон', base: 11, step: 9, max: 5, apply(p, m) { p.armor = Math.min(0.75, p.armor + 0.04 * m); } },
  { id: 'shield', name: 'Щит', desc: 'Поглощает урон и восстанавливается', base: 18, step: 14, max: 4, apply(p, m) { const add = Math.round(18 * m); p.shieldMax += add; p.shield = Math.min(p.shieldMax, p.shield + add); p.shieldCdMax = Math.max(5, p.shieldCdMax - 0.8); } },
  { id: 'killHeal', name: 'Пожиратель', desc: '+HP за каждое убийство', base: 13, step: 10, max: 4, apply(p, m) { p.killHeal += Math.round(2 * m); } },
  { id: 'thorns', name: 'Шипы', desc: 'Ранят врагов, которые вас бьют', base: 12, step: 9, max: 3, apply(p, m) { p.thorns += Math.round(5 * m); } },
  { id: 'lifesteal', name: 'Вампиризм', desc: 'Лечит при попадании вблизи', base: 12, step: 10, max: 5, apply(p, m) { p.lifesteal += Math.round(2 * m); } },

  // ---- движение ----
  { id: 'move', name: 'Скорость бега', desc: '+18 скорости', base: 8, step: 6, max: 5, apply(p, m) { p.moveSpeed += Math.round(18 * m); } },
  { id: 'jump', name: 'Прыжок', desc: 'Выше прыжок', base: 7, step: 5, max: 4, apply(p, m) { p.jumpPower += Math.round(45 * m); } },
  { id: 'doubleJump', name: 'Двойной прыжок', desc: 'Второй прыжок в воздухе', base: 22, step: 0, max: 1, apply(p) { p.doubleJump = 1; p.jumpsLeft = 1; } },
  { id: 'dashCd', name: 'Перезарядка рывка', desc: 'Рывок чаще', base: 10, step: 8, max: 4, apply(p, m) { p.dashCdMax = Math.max(0.3, p.dashCdMax - 0.1 * m); } },
  { id: 'dashSpeed', name: 'Скорость рывка', desc: 'Дальше и резче рывок', base: 8, step: 6, max: 4, apply(p, m) { p.dashSpeed += Math.round(70 * m); } },
  { id: 'dashDur', name: 'Длина рывка', desc: 'Дольше неуязвимость рывка', base: 9, step: 7, max: 3, apply(p, m) { p.dashDur += 0.025 * m; } },
  { id: 'dashDmg', name: 'Урон рывком', desc: 'Рывок наносит урон', base: 13, step: 10, max: 3, apply(p, m) { p.dashDamage += Math.round(12 * m); } },
  { id: 'dashInvuln', name: 'Фантом', desc: '+неуязвимость во время рывка', base: 11, step: 8, max: 3, apply(p, m) { p.dashInvuln += 0.04 * m; } },

  // ---- ближний бой ----
  { id: 'melee', name: 'Урон удара', desc: '+6 к урону оружия ближнего боя', base: 9, step: 7, max: 99, apply(p, m) { p.damage += Math.round(6 * m); } },
  { id: 'atkSpd', name: 'Скорость удара', desc: 'Быстрее атака вблизи', base: 9, step: 7, max: 6, apply(p, m) { p.attackCdMax = Math.max(0.18, p.attackCdMax - 0.025 * m); } },
  { id: 'atkRange', name: 'Дальность удара', desc: '+дальность клинка', base: 8, step: 6, max: 3, apply(p, m) { p.attackRange += Math.round(7 * m); } },

  // ---- стрельба ----
  { id: 'shootDmg', name: 'Урон выстрела', desc: '+4 к урону стрелкового оружия', base: 9, step: 7, max: 99, apply(p, m) { p.shootDamage += Math.round(4 * m); } },
  { id: 'shootCd', name: 'Скорострельность', desc: 'Быстрее перезарядка', base: 10, step: 8, max: 6, apply(p, m) { p.shootCdMax = Math.max(0.28, p.shootCdMax - 0.1 * m); } },
  { id: 'shootSpd', name: 'Скорость снаряда', desc: 'Снаряды летят быстрее', base: 7, step: 5, max: 5, apply(p, m) { p.shootSpeed += Math.round(50 * m); } },
  { id: 'multishot', name: 'Мультивыстрел', desc: '+1 снаряд за выстрел', base: 15, step: 12, max: 3, apply(p, m) { p.multishot += Math.max(1, Math.round(m)); } },
  { id: 'pierce', name: 'Пробивание', desc: 'Снаряды пробивают врагов', base: 12, step: 10, max: 3, apply(p, m) { p.pierce += Math.max(1, Math.round(m)); } },
  { id: 'bulletSize', name: 'Крупный калибр', desc: '+размер снарядов', base: 11, step: 9, max: 3, apply(p, m) { p.bulletSize += 1.1 * m; } },

  // ---- криты и добивание ----
  { id: 'crit', name: 'Критический удар', desc: '+7% шанс крита', base: 13, step: 10, max: 6, apply(p, m) { p.crit = Math.min(0.65, p.crit + 0.07 * m); } },
  { id: 'critDmg', name: 'Сила крита', desc: 'Криты бьют сильнее', base: 14, step: 10, max: 5, apply(p, m) { p.critDmg += 0.3 * m; } },
  { id: 'execute', name: 'Казнь', desc: 'Шанс добить слабого врага', base: 18, step: 0, max: 3, apply(p, m) { p.execute = Math.min(0.3, p.execute + 0.06 * m); } },
  { id: 'retarget', name: 'Умные снаряды', desc: 'Пули и магия меняют цель уже после выстрела', base: 18, step: 14, max: 3, apply(p, m) { p.retarget = Math.min(4, p.retarget + Math.max(1, Math.round(m))); } },
  { id: 'bossDmg', name: 'Охотник на боссов', desc: '+урон по боссам', base: 15, step: 12, max: 4, apply(p, m) { p.bossDmg += 0.12 * m; } },
  { id: 'lowHpDmg', name: 'Ярость', desc: '+урон при низком HP', base: 12, step: 9, max: 4, apply(p, m) { p.lowHpDmg += 0.15 * m; } },

  // ---- экономика ----
  { id: 'magnet', name: 'Магнит', desc: 'Притягивает монеты и опыт', base: 8, step: 6, max: 4, apply(p, m) { p.magnetRange += Math.round(120 * m); } },
  { id: 'xpGain', name: 'Опыт', desc: '+15% получаемого опыта', base: 8, step: 6, max: 5, apply(p, m) { p.xpMult += 0.15 * m; } },
  { id: 'coinGain', name: 'Жадность', desc: '+20% монет', base: 10, step: 8, max: 4, apply(p, m) { p.coinMult += 0.2 * m; } },
  { id: 'swapSpeed', name: 'Быстрая смена', desc: 'Меньше задержка смены оружия', base: 8, step: 6, max: 4, apply(p, m) { p.swapCdMax = Math.max(0.08, p.swapCdMax - 0.06 * m); } },

  // ---- разблокировка оружия ----
  { id: 'unlock_pistol', name: 'Пистолет', desc: 'Добавить оружие в арсенал', base: 20, step: 0, max: 1, unlockWeapon: 'pistol', apply(p) { addWeapon(p, 'pistol'); } },
  { id: 'unlock_axe', name: 'Топор', desc: 'Добавить оружие в арсенал', base: 22, step: 0, max: 1, unlockWeapon: 'axe', apply(p) { addWeapon(p, 'axe'); } },
  { id: 'unlock_dagger', name: 'Кинжал', desc: 'Добавить оружие в арсенал', base: 18, step: 0, max: 1, unlockWeapon: 'dagger', apply(p) { addWeapon(p, 'dagger'); } },
  { id: 'unlock_shotgun', name: 'Дробовик', desc: 'Добавить оружие в арсенал', base: 24, step: 0, max: 1, unlockWeapon: 'shotgun', apply(p) { addWeapon(p, 'shotgun'); } },
  { id: 'unlock_rifle', name: 'Винтовка', desc: 'Добавить оружие в арсенал', base: 24, step: 0, max: 1, unlockWeapon: 'rifle', apply(p) { addWeapon(p, 'rifle'); } },
  { id: 'unlock_staff', name: 'Посох', desc: 'Добавить оружие в арсенал', base: 26, step: 0, max: 1, unlockWeapon: 'staff', apply(p) { addWeapon(p, 'staff'); } },
];

export function rollOffers(waveNum, shopLevels, player) {
  const available = UPGRADE_POOL.filter((u) => {
    if ((shopLevels[u.id] || 0) >= u.max) return false;
    if (u.unlockWeapon && player && Array.isArray(player.arsenal) && player.arsenal.includes(u.unlockWeapon)) return false;
    return true;
  });
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = available[i];
    available[i] = available[j];
    available[j] = tmp;
  }
  const picked = available.slice(0, 3);

  // Классу без дальнего оружия гарантируем шанс докупить пистолет.
  if (player && Array.isArray(player.arsenal) &&
      !player.arsenal.some((id) => getWeapon(id).kind === 'ranged') &&
      !player.arsenal.includes('pistol')) {
    const hasRangedOffer = picked.some(
      (o) => o.unlockWeapon && getWeapon(o.unlockWeapon).kind === 'ranged',
    );
    if (!hasRangedOffer) {
      const pistol = available.find((u) => u.id === 'unlock_pistol');
      if (pistol) picked[picked.length - 1] = pistol;
    }
  }

  return picked.map((upg) => {
    const level = shopLevels[upg.id] || 0;
    const rarity = rollRarity(waveNum);
    return {
      upg,
      level,
      rarity,
      cost: Math.round((upg.base + level * upg.step) * RARITY_MULT[rarity]),
      purchased: false,
    };
  });
}
