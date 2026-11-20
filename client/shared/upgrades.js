// Магазинные улучшения и редкости — перенесено из предыдущей версии.

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
  { id: 'hp', name: 'Здоровье', base: 8, step: 6, max: 99, apply(p, m) { const v = Math.round(20 * m); p.maxHp += v; if (!p.downed) p.hp = Math.min(p.maxHp, p.hp + v); } },
  { id: 'regenRate', name: 'Регенерация', base: 10, step: 8, max: 5, apply(p, m) { p.regenRate += Math.round(2 * m); } },
  { id: 'regenFast', name: 'Откат регена', base: 9, step: 7, max: 3, apply(p, m) { p.regenDelay = Math.max(1.5, p.regenDelay - 0.5 * m); } },
  { id: 'dashCd', name: 'Перезарядка рывка', base: 10, step: 8, max: 4, apply(p, m) { p.dashCdMax = Math.max(0.35, p.dashCdMax - 0.1 * m); } },
  { id: 'dashSpeed', name: 'Скорость рывка', base: 8, step: 6, max: 4, apply(p, m) { p.dashSpeed += Math.round(70 * m); } },
  { id: 'dashDur', name: 'Длина рывка', base: 9, step: 7, max: 3, apply(p, m) { p.dashDur += 0.025 * m; } },
  { id: 'melee', name: 'Урон удара', base: 9, step: 7, max: 99, apply(p, m) { p.damage += Math.round(6 * m); } },
  { id: 'shootDmg', name: 'Урон выстрела', base: 9, step: 7, max: 99, apply(p, m) { p.shootDamage += Math.round(4 * m); } },
  { id: 'shootCd', name: 'Скорострельность', base: 10, step: 8, max: 6, apply(p, m) { p.shootCdMax = Math.max(1.0, p.shootCdMax - 0.2 * m); } },
  { id: 'shootSpd', name: 'Скорость снаряда', base: 7, step: 5, max: 5, apply(p, m) { p.shootSpeed += Math.round(50 * m); } },
  { id: 'move', name: 'Скорость бега', base: 8, step: 6, max: 5, apply(p, m) { p.moveSpeed += Math.round(18 * m); } },
  { id: 'jump', name: 'Прыжок', base: 7, step: 5, max: 4, apply(p, m) { p.jumpPower += Math.round(45 * m); } },
  { id: 'atkSpd', name: 'Скорость удара', base: 9, step: 7, max: 4, apply(p, m) { p.attackCdMax = Math.max(0.24, p.attackCdMax - 0.025 * m); } },
  { id: 'atkRange', name: 'Дальность удара', base: 8, step: 6, max: 3, apply(p, m) { p.attackRange += Math.round(7 * m); } },
  { id: 'lifesteal', name: 'Вампиризм', base: 12, step: 10, max: 5, apply(p, m) { p.lifesteal += Math.round(2 * m); } },
  { id: 'armor', name: 'Броня', base: 11, step: 9, max: 5, apply(p, m) { p.armor = Math.min(0.75, p.armor + 0.04 * m); } },
  { id: 'multishot', name: 'Мультивыстрел', base: 15, step: 12, max: 2, apply(p, m) { p.multishot += Math.max(1, Math.round(m)); } },
  { id: 'pierce', name: 'Пробивание', base: 12, step: 10, max: 2, apply(p, m) { p.pierce += Math.max(1, Math.round(m)); } },
  { id: 'xpGain', name: 'Опыт', base: 8, step: 6, max: 5, apply(p, m) { p.xpMult += 0.15 * m; } },
  { id: 'dashDmg', name: 'Урон рывком', base: 13, step: 10, max: 3, apply(p, m) { p.dashDamage += Math.round(12 * m); } },
  { id: 'crit', name: 'Критический удар', base: 13, step: 10, max: 5, apply(p, m) { p.crit = Math.min(0.6, p.crit + 0.07 * m); } },
  { id: 'magnet', name: 'Магнит', base: 8, step: 6, max: 4, apply(p, m) { p.magnetRange += Math.round(120 * m); } },
  { id: 'doubleJump', name: 'Двойной прыжок', base: 22, step: 0, max: 1, apply(p, m) { p.doubleJump = 1; p.jumpsLeft = 1; } },
];

export function rollOffers(waveNum, shopLevels) {
  const available = UPGRADE_POOL.filter((u) => (shopLevels[u.id] || 0) < u.max);
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = available[i];
    available[i] = available[j];
    available[j] = tmp;
  }
  return available.slice(0, 3).map((upg) => {
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
