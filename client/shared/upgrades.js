// Магазинные улучшения, редкости и разблокировка оружия.

import { addWeapon, getWeapon, getWeaponMod } from './weapons.js?v=20261123b';

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

export function rollRarity(waveNum, luck) {
  const bonus = Math.min(waveNum * 0.6, 18) + (luck || 0) * 3;
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

// --------------------------------------------------------------------------
// Расширенный пул: бесконечные статы, мастерство оружия/классов,
// статусы, условный урон, защита, экономика и эффекты убийства.
// --------------------------------------------------------------------------

const INF = (o) => ({ ...o, max: Infinity, infinite: true });

const EXTRA_UPGRADES = [
  // ---- бесконечные базовые статы ----
  INF({ id: 'inf_damage', name: 'Неугасающая сила', desc: '+8% ко всему урону', base: 14, step: 10, apply(p, m) { p.damageMult += 0.08 * m; } }),
  INF({ id: 'inf_ranged', name: 'Свинцовый поток', desc: '+8% к урону снарядов', base: 13, step: 9, apply(p, m) { p.rangedMult += 0.08 * m; } }),
  INF({ id: 'inf_melee', name: 'Стальной размах', desc: '+8% к урону ближнего боя', base: 13, step: 9, apply(p, m) { p.meleeMult += 0.08 * m; } }),
  INF({ id: 'inf_fireRate', name: 'Непрерывный огонь', desc: 'Стрельба становится быстрее навсегда', base: 15, step: 11, apply(p, m) { p.shootRateMult *= Math.pow(0.94, m); } }),
  INF({ id: 'inf_attackRate', name: 'Серия ударов', desc: 'Ближний бой ускоряется навсегда', base: 14, step: 10, apply(p, m) { p.attackRateMult *= Math.pow(0.94, m); } }),
  INF({ id: 'inf_multishot', name: 'Лавина снарядов', desc: '+1 снаряд за выстрел без предела', base: 20, step: 16, apply(p, m) { p.multishot += Math.max(1, Math.round(m)); } }),
  INF({ id: 'inf_pierce', name: 'Бесконечное прошивание', desc: 'Снаряды пробивают ещё одного врага', base: 16, step: 13, apply(p, m) { p.pierce += Math.max(1, Math.round(m)); } }),
  INF({ id: 'inf_projSpeed', name: 'Ускорение снарядов', desc: '+10% скорость снарядов', base: 10, step: 8, apply(p, m) { p.projSpeedMult *= Math.pow(1.1, m); } }),
  INF({ id: 'inf_projSize', name: 'Раздувание калибра', desc: '+0.9 к размеру снарядов', base: 11, step: 9, apply(p, m) { p.bulletSize += 0.9 * m; } }),
  INF({ id: 'inf_projLife', name: 'Дальний полёт', desc: '+7% время жизни снарядов', base: 10, step: 8, apply(p, m) { p.projLifeMult *= Math.pow(1.07, m); } }),
  INF({ id: 'inf_crit', name: 'Абсолютный крит', desc: '+4% шанс крита; излишек уходит в силу', base: 15, step: 11, apply(p, m) { p.crit += 0.04 * m; if (p.crit > 1) { p.critDmg += (p.crit - 1) * 2; p.crit = 1; } } }),
  INF({ id: 'inf_critDmg', name: 'Смертельный крит', desc: '+0.25 к множителю крита', base: 15, step: 11, apply(p, m) { p.critDmg += 0.25 * m; } }),
  INF({ id: 'inf_hp', name: 'Титанизм', desc: '+30 максимального HP', base: 10, step: 8, apply(p, m) { const v = Math.round(30 * m); p.maxHp += v; if (!p.downed) p.hp = Math.min(p.maxHp, p.hp + v); } }),
  INF({ id: 'inf_regen', name: 'Живучесть', desc: '+2 к регенерации', base: 10, step: 8, apply(p, m) { p.regenRate += 2 * m; } }),
  INF({ id: 'inf_armor', name: 'Закалка', desc: '+1.5% брони', base: 12, step: 9, apply(p, m) { p.armor = Math.min(0.85, p.armor + 0.015 * m); } }),
  INF({ id: 'inf_move', name: 'Разгон', desc: '+12 скорости бега', base: 9, step: 7, apply(p, m) { p.moveSpeed += Math.round(12 * m); } }),
  INF({ id: 'inf_jump', name: 'Пружинистые ноги', desc: '+30 к силе прыжка', base: 8, step: 6, apply(p, m) { p.jumpPower += Math.round(30 * m); } }),
  INF({ id: 'inf_accel', name: 'Резкий старт', desc: '+6% ускорение движения', base: 8, step: 6, apply(p, m) { p.accelMult *= Math.pow(1.06, m); } }),
  INF({ id: 'inf_dashCd', name: 'Бесконечный шаг', desc: 'Рывок перезаряжается быстрее', base: 10, step: 8, apply(p, m) { p.dashCdMax = Math.max(0.16, p.dashCdMax - 0.03 * m); } }),
  INF({ id: 'inf_lifesteal', name: 'Кровопийца', desc: '+1 вампиризм', base: 13, step: 10, apply(p, m) { p.lifesteal += Math.round(m); } }),
  INF({ id: 'inf_shield', name: 'Вечный барьер', desc: '+12 к щиту', base: 15, step: 11, apply(p, m) { const v = Math.round(12 * m); p.shieldMax += v; p.shield = Math.min(p.shieldMax, p.shield + v); } }),
  INF({ id: 'inf_shieldRegen', name: 'Щит-регенератор', desc: 'Щит восстанавливается чаще', base: 12, step: 9, apply(p, m) { p.shieldCdMax = Math.max(2, p.shieldCdMax - 0.5 * m); } }),
  INF({ id: 'inf_magnet', name: 'Гравитация', desc: '+60 радиус сбора', base: 8, step: 6, apply(p, m) { p.magnetRange += Math.round(60 * m); } }),
  INF({ id: 'inf_xp', name: 'Просветление', desc: '+8% опыта', base: 8, step: 6, apply(p, m) { p.xpMult += 0.08 * m; } }),
  INF({ id: 'inf_coins', name: 'Золотая жила', desc: '+10% монет', base: 9, step: 7, apply(p, m) { p.coinMult += 0.1 * m; } }),
  INF({ id: 'inf_boss', name: 'Убийца боссов', desc: '+8% урона по боссам', base: 13, step: 10, apply(p, m) { p.bossDmg += 0.08 * m; } }),
  INF({ id: 'inf_lowhp', name: 'Отчаяние', desc: '+8% урона при низком HP', base: 12, step: 9, apply(p, m) { p.lowHpDmg += 0.08 * m; } }),
  INF({ id: 'inf_execute', name: 'Приговор', desc: '+3% шанс казни', base: 16, step: 12, apply(p, m) { p.execute = Math.min(0.75, p.execute + 0.03 * m); } }),
  INF({ id: 'inf_retarget', name: 'Разум снарядов', desc: '+1 уровень перенаведения', base: 17, step: 13, apply(p, m) { p.retarget += Math.max(1, Math.round(m)); } }),
  INF({ id: 'inf_thorns', name: 'Стальные шипы', desc: '+3 урона шипами', base: 11, step: 8, apply(p, m) { p.thorns += Math.round(3 * m); } }),
  INF({ id: 'inf_killHeal', name: 'Пир убийцы', desc: '+1 HP за убийство', base: 12, step: 9, apply(p, m) { p.killHeal += Math.round(m); } }),
  INF({ id: 'inf_dashDamage', name: 'Таран', desc: '+10 урона рывком', base: 12, step: 9, apply(p, m) { p.dashDamage += Math.round(10 * m); } }),
  INF({ id: 'inf_dashInvuln', name: 'Фантомный шаг', desc: '+0.02 неуязвимости в рывке', base: 10, step: 8, apply(p, m) { p.dashInvuln += 0.02 * m; } }),
  INF({ id: 'inf_dashSpeed', name: 'Сверхрывок', desc: '+30 скорости рывка', base: 9, step: 7, apply(p, m) { p.dashSpeed += Math.round(30 * m); } }),
  INF({ id: 'inf_regenDelay', name: 'Быстрый откат', desc: 'Регенерация начинается раньше', base: 9, step: 7, apply(p, m) { p.regenDelay = Math.max(0.6, p.regenDelay - 0.1 * m); } }),
  INF({ id: 'inf_attackRange', name: 'Длинный клинок', desc: '+3 дальность ближнего боя', base: 9, step: 7, apply(p, m) { p.attackRange += Math.round(3 * m); } }),
  INF({ id: 'inf_knockback', name: 'Тяжёлая рука', desc: '+8% сила отбрасывания', base: 8, step: 6, apply(p, m) { p.kbPower += 0.08 * m; } }),

  // ---- статусы ----
  { id: 'ignite', name: 'Поджог', desc: 'Шанс поджечь врага', base: 12, step: 9, max: 5, apply(p, m) { p.burnChance = Math.min(0.8, p.burnChance + 0.08 * m); p.burnDps = Math.max(p.burnDps, 4); } },
  INF({ id: 'firePower', name: 'Пламя', desc: '+5 урона горения в секунду', base: 12, step: 9, apply(p, m) { p.burnDps += 5 * m; } }),
  { id: 'venom', name: 'Яд', desc: 'Шанс отравить врага', base: 12, step: 9, max: 5, apply(p, m) { p.poisonChance = Math.min(0.8, p.poisonChance + 0.08 * m); p.poisonDps = Math.max(p.poisonDps, 3); } },
  INF({ id: 'poisonPower', name: 'Токсин', desc: '+4 урона яда в секунду', base: 12, step: 9, apply(p, m) { p.poisonDps += 4 * m; } }),
  { id: 'frost', name: 'Обморожение', desc: 'Шанс замедлить врага', base: 11, step: 8, max: 5, apply(p, m) { p.slowChance = Math.min(0.8, p.slowChance + 0.08 * m); p.slowPower = Math.max(p.slowPower, 0.2); p.slowTime = 2.5; } },
  { id: 'frostPower', name: 'Стынь', desc: '+8% сила замедления', base: 10, step: 8, max: 4, apply(p, m) { p.slowPower = Math.min(0.8, p.slowPower + 0.08 * m); } },
  { id: 'vulnerability', name: 'Уязвимость', desc: 'Шанс сделать врага уязвимым', base: 12, step: 9, max: 5, apply(p, m) { p.vulnChance = Math.min(0.8, p.vulnChance + 0.08 * m); p.vulnPower = Math.max(p.vulnPower, 0.1); } },
  INF({ id: 'vulnPower', name: 'Раскрытая броня', desc: '+6% уязвимость', base: 12, step: 9, apply(p, m) { p.vulnPower += 0.06 * m; } }),
  { id: 'chain', name: 'Цепная молния', desc: 'Шанс ударить молнией соседнего врага', base: 14, step: 10, max: 5, apply(p, m) { p.chainChance = Math.min(0.7, p.chainChance + 0.07 * m); p.chainDmg = Math.max(p.chainDmg, 6); } },
  INF({ id: 'chainPower', name: 'Разряд', desc: '+6 урона цепной молнии и радиус', base: 14, step: 10, apply(p, m) { p.chainDmg += 6 * m; p.chainRange += 10 * m; } }),

  // ---- условный урон ----
  { id: 'fullHpDmg', name: 'На пике', desc: '+8% урона при HP выше 85%', base: 12, step: 9, max: 4, apply(p, m) { p.fullHpDmg += 0.08 * m; } },
  { id: 'airDmg', name: 'Воздушный бой', desc: '+8% урона в воздухе', base: 10, step: 8, max: 4, apply(p, m) { p.airDmg += 0.08 * m; } },
  { id: 'closeDmg', name: 'В упор', desc: '+8% урона ближе 160 px', base: 11, step: 8, max: 4, apply(p, m) { p.closeDmg += 0.08 * m; } },
  { id: 'farDmg', name: 'Дальний выстрел', desc: '+8% урона дальше 420 px', base: 11, step: 8, max: 4, apply(p, m) { p.farDmg += 0.08 * m; } },
  { id: 'eliteDmg', name: 'Охотник', desc: '+8% урона по брутам и боссам', base: 13, step: 10, max: 4, apply(p, m) { p.eliteDmg += 0.08 * m; } },
  { id: 'comboDmg', name: 'Кураж', desc: '+1% урона за каждое комбо', base: 13, step: 10, max: 4, apply(p, m) { p.comboDmg += 0.01 * m; } },
  { id: 'stationaryDmg', name: 'Стойка', desc: '+10% урона стоя на месте', base: 10, step: 8, max: 4, apply(p, m) { p.stationaryDmg += 0.1 * m; } },
  { id: 'movingDmg', name: 'На ходу', desc: '+8% урона в движении', base: 10, step: 8, max: 4, apply(p, m) { p.movingDmg += 0.08 * m; } },
  { id: 'dashBuffDmg', name: 'После рывка', desc: '+12% урона 1.4 сек после рывка', base: 12, step: 9, max: 4, apply(p, m) { p.dashBuffDmg += 0.12 * m; } },
  { id: 'lastStandDmg', name: 'Последний рубеж', desc: '+12% урона при HP ниже 30%', base: 12, step: 9, max: 4, apply(p, m) { p.lastStandDmg += 0.12 * m; } },

  // ---- защита и движение ----
  { id: 'kbResist', name: 'Устойчивость', desc: '-12% отбрасывание', base: 9, step: 7, max: 4, apply(p, m) { p.kbResist = Math.min(0.8, p.kbResist + 0.12 * m); } },
  { id: 'contactArmor', name: 'Контактная броня', desc: '-6% урона от касаний', base: 10, step: 8, max: 4, apply(p, m) { p.contactArmor = Math.min(0.6, p.contactArmor + 0.06 * m); } },
  { id: 'projArmor', name: 'Антиснарядная броня', desc: '-6% урона от снарядов', base: 10, step: 8, max: 4, apply(p, m) { p.projArmor = Math.min(0.6, p.projArmor + 0.06 * m); } },
  { id: 'dodge', name: 'Уклонение', desc: '+3% шанс полностью избежать урона', base: 14, step: 10, max: 3, apply(p, m) { p.dodge = Math.min(0.45, p.dodge + 0.03 * m); } },
  { id: 'hitInvuln', name: 'Крепкая реакция', desc: '+0.06 сек неуязвимости после удара', base: 10, step: 8, max: 3, apply(p, m) { p.hitInvuln = Math.min(0.5, p.hitInvuln + 0.06 * m); } },
  { id: 'accel', name: 'Быстрый разгон', desc: '+8% ускорение', base: 8, step: 6, max: 4, apply(p, m) { p.accelMult *= Math.pow(1.08, m); } },
  { id: 'extraJump', name: 'Третий прыжок', desc: 'Добавляет ещё один прыжок', base: 30, step: 0, max: 1, apply(p) { p.extraJump = 1; p.jumpsLeft = Math.max(p.jumpsLeft, 1); } },
  { id: 'lastStandArmor', name: 'Второе дыхание', desc: '+10% брони при HP ниже 30%', base: 12, step: 9, max: 4, apply(p, m) { p.lastStandArmor = Math.min(0.5, p.lastStandArmor + 0.1 * m); } },
  { id: 'shieldRegen', name: 'Быстрый щит', desc: 'Щит восстанавливается на 0.6 сек быстрее', base: 11, step: 8, max: 4, apply(p, m) { p.shieldCdMax = Math.max(2, p.shieldCdMax - 0.6 * m); } },
  { id: 'regenDelay2', name: 'Ранний реген', desc: 'Регенерация начинается на 0.25 сек раньше', base: 9, step: 7, max: 4, apply(p, m) { p.regenDelay = Math.max(0.6, p.regenDelay - 0.25 * m); } },

  // ---- экономика ----
  { id: 'discount', name: 'Скидка', desc: '-5% цена магазина', base: 16, step: 12, max: 4, apply(p, m) { p.discount = Math.min(0.5, p.discount + 0.05 * m); } },
  { id: 'interest', name: 'Проценты', desc: '+3% монет в конце волны', base: 15, step: 11, max: 4, apply(p, m) { p.interest = Math.min(0.3, p.interest + 0.03 * m); } },
  { id: 'luck', name: 'Удача', desc: 'Выше шанс редких предложений', base: 14, step: 10, max: 4, apply(p, m) { p.luck += 0.2 * m; } },
  { id: 'bounty', name: 'Награда за голову', desc: '+25% монет с брутов и боссов', base: 12, step: 9, max: 4, apply(p, m) { p.bounty += 0.25 * m; } },
  { id: 'xpBounty', name: 'Учёный', desc: '+10% опыта', base: 9, step: 7, max: 4, apply(p, m) { p.xpMult += 0.1 * m; } },
  { id: 'coinBounty', name: 'Скупщик', desc: '+12% монет', base: 9, step: 7, max: 4, apply(p, m) { p.coinMult += 0.12 * m; } },

  // ---- эффекты убийства ----
  { id: 'explodeChance', name: 'Взрывной финал', desc: 'Шанс взорвать врага при убийстве', base: 15, step: 11, max: 4, apply(p, m) { p.explodeChance = Math.min(0.6, p.explodeChance + 0.08 * m); p.explodeDmg = Math.max(p.explodeDmg, 15); p.explodeRadius = Math.max(p.explodeRadius, 120); } },
  INF({ id: 'explodePower', name: 'Мощный взрыв', desc: '+12 урона взрыва', base: 14, step: 10, apply(p, m) { p.explodeDmg += 12 * m; } }),
  { id: 'explodeRadius', name: 'Радиус взрыва', desc: '+8 радиус взрыва', base: 11, step: 8, max: 4, apply(p, m) { p.explodeRadius += 8 * m; } },
  { id: 'coinOnKill', name: 'Мародёр', desc: '+1 монета за убийство', base: 11, step: 8, max: 4, apply(p, m) { p.coinOnKill += Math.round(m); } },
  { id: 'shieldOnKill', name: 'Щит из убийств', desc: '+5 щита за убийство', base: 12, step: 9, max: 4, apply(p, m) { p.shieldOnKill += Math.round(5 * m); } },
  { id: 'bossKillHeal', name: 'Трофей босса', desc: '+25 HP за убийство босса', base: 13, step: 10, max: 4, apply(p, m) { p.bossKillHeal += Math.round(25 * m); } },
];

UPGRADE_POOL.push(...EXTRA_UPGRADES);

// ---- мастерство оружия: 4 улучшения на каждый вид ----
const WEAPON_MASTERY = [
  ['sword', 'Меч'], ['axe', 'Топор'], ['dagger', 'Кинжал'],
  ['pistol', 'Пистолет'], ['shotgun', 'Дробовик'], ['rifle', 'Винтовка'], ['staff', 'Посох'],
];
for (const [weaponId, label] of WEAPON_MASTERY) {
  const kind = getWeapon(weaponId).kind;
  UPGRADE_POOL.push(
    INF({ id: `wm_${weaponId}_dmg`, name: `${label}: сила`, desc: `+12% урона (${label})`, base: 11, step: 8, requiresWeapon: weaponId, apply(p, m) { getWeaponMod(p, weaponId).damage += 0.12 * m; } }),
    INF({ id: `wm_${weaponId}_speed`, name: `${label}: темп`, desc: `+5% скорость атаки (${label})`, base: 11, step: 8, requiresWeapon: weaponId, apply(p, m) { const mod = getWeaponMod(p, weaponId); mod.cooldown = Math.min(0.7, 1 - (1 - mod.cooldown) * Math.pow(0.95, m)); } }),
    INF({ id: `wm_${weaponId}_range`, name: `${label}: дальность`, desc: kind === 'melee' ? `+8% дальность (${label})` : `+8% дальность полёта (${label})`, base: 9, step: 7, requiresWeapon: weaponId, apply(p, m) { const mod = getWeaponMod(p, weaponId); if (kind === 'melee') mod.range += 0.08 * m; else mod.life += 0.08 * m; } }),
    INF({ id: `wm_${weaponId}_crit`, name: `${label}: крит`, desc: `+2% крит (${label})`, base: 11, step: 8, requiresWeapon: weaponId, apply(p, m) { getWeaponMod(p, weaponId).crit += 0.02 * m; } }),
  );
}

// ---- мастерство класса: 2 улучшения на каждый класс ----
const CLASS_MASTERY = [
  { id: 'cm_warrior_hp', name: 'Стойкость воина', desc: '+40 HP', cls: 'warrior', apply(p, m) { p.maxHp += Math.round(40 * m); p.hp = Math.min(p.maxHp, p.hp + 40 * m); } },
  { id: 'cm_warrior_leech', name: 'Кровь воина', desc: '+1 вампиризм', cls: 'warrior', apply(p, m) { p.lifesteal += Math.round(m); } },
  { id: 'cm_gunner_power', name: 'Оружейник', desc: '+8% урон снарядов', cls: 'gunner', apply(p, m) { p.rangedMult += 0.08 * m; } },
  { id: 'cm_gunner_rate', name: 'Автоматика', desc: 'Стрельба быстрее', cls: 'gunner', apply(p, m) { p.shootRateMult *= Math.pow(0.95, m); } },
  { id: 'cm_sniper_crit', name: 'Глаз снайпера', desc: '+4% крит', cls: 'sniper', apply(p, m) { p.crit += 0.04 * m; } },
  { id: 'cm_sniper_boss', name: 'Прицел на босса', desc: '+10% урон по боссам', cls: 'sniper', apply(p, m) { p.bossDmg += 0.1 * m; } },
  { id: 'cm_universal_hp', name: 'Запас прочности', desc: '+25 HP', cls: 'universal', apply(p, m) { p.maxHp += Math.round(25 * m); p.hp = Math.min(p.maxHp, p.hp + 25 * m); } },
  { id: 'cm_universal_power', name: 'Ровный стиль', desc: '+6% весь урон', cls: 'universal', apply(p, m) { p.damageMult += 0.06 * m; } },
  { id: 'cm_berserker_melee', name: 'Ярость берсерка', desc: '+12% урон ближнего боя', cls: 'berserker', apply(p, m) { p.meleeMult += 0.12 * m; } },
  { id: 'cm_berserker_leech', name: 'Жажда крови', desc: '+1 вампиризм', cls: 'berserker', apply(p, m) { p.lifesteal += Math.round(m); } },
  { id: 'cm_engineer_shield', name: 'Полевой щит', desc: '+20 щит', cls: 'engineer', apply(p, m) { const v = Math.round(20 * m); p.shieldMax += v; p.shield = Math.min(p.shieldMax, p.shield + v); } },
  { id: 'cm_engineer_regen', name: 'Ремонт', desc: '+2 регенерация', cls: 'engineer', apply(p, m) { p.regenRate += 2 * m; } },
  { id: 'cm_mage_ranged', name: 'Магическая мощь', desc: '+10% урон снарядов', cls: 'mage', apply(p, m) { p.rangedMult += 0.1 * m; } },
  { id: 'cm_mage_retarget', name: 'Умная магия', desc: '+1 перенаведение', cls: 'mage', apply(p, m) { p.retarget += Math.max(1, Math.round(m)); } },
  { id: 'cm_ninja_speed', name: 'Тень', desc: '+15 скорость', cls: 'ninja', apply(p, m) { p.moveSpeed += Math.round(15 * m); } },
  { id: 'cm_ninja_dash', name: 'Скольжение', desc: 'Рывок быстрее', cls: 'ninja', apply(p, m) { p.dashCdMax = Math.max(0.16, p.dashCdMax - 0.04 * m); } },
];
for (const u of CLASS_MASTERY) {
  UPGRADE_POOL.push(INF({ id: u.id, name: u.name, desc: u.desc, base: 13, step: 9, requiresClass: u.cls, apply: u.apply }));
}



const DEFENSIVE_UPGRADES = new Set([
  'hp', 'shield', 'armor', 'regenRate', 'regenFast', 'killHeal', 'lifesteal',
  'inf_hp', 'inf_shield', 'inf_armor', 'inf_regen', 'inf_lifesteal',
  'dodge', 'contactArmor', 'projArmor', 'lastStandArmor', 'shieldRegen', 'inf_shieldRegen',
]);

export function offerPrice(player, offer) {
  const discount = player ? Math.min(0.6, player.discount || 0) : 0;
  return Math.max(1, Math.ceil(offer.cost * (1 - discount)));
}

export function rollOffers(waveNum, shopLevels, player) {
  const available = UPGRADE_POOL.filter((u) => {
    if ((shopLevels[u.id] || 0) >= u.max) return false;
    if (u.unlockWeapon && player && Array.isArray(player.arsenal) && player.arsenal.includes(u.unlockWeapon)) return false;
    if (u.requiresWeapon && player && Array.isArray(player.arsenal) && !player.arsenal.includes(u.requiresWeapon)) return false;
    if (u.requiresClass && player && player.clazz !== u.requiresClass) return false;
    return true;
  });
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = available[i];
    available[i] = available[j];
    available[j] = tmp;
  }
  const picked = available.slice(0, 6);

  // В магазине всегда есть хотя бы один защитный вариант.
  if (player) {
    const hasDefense = picked.some((u) => DEFENSIVE_UPGRADES.has(u.id));
    if (!hasDefense) {
      const defensive = available.filter((u) => DEFENSIVE_UPGRADES.has(u.id));
      if (defensive.length) picked[picked.length - 1] = defensive[Math.floor(Math.random() * defensive.length)];
    }
  }

  // Классу без дальнего оружия гарантируем шанс докупить пистолет.
  if (player && Array.isArray(player.arsenal) &&
      !player.arsenal.some((id) => getWeapon(id).kind === 'ranged') &&
      !player.arsenal.includes('pistol')) {
    const hasRangedOffer = picked.some(
      (o) => o.unlockWeapon && getWeapon(o.unlockWeapon).kind === 'ranged',
    );
    if (!hasRangedOffer) {
      const pistol = available.find((u) => u.id === 'unlock_pistol');
      if (pistol) {
        let slot = picked.length - 1;
        if (DEFENSIVE_UPGRADES.has(picked[slot].id) && picked.length > 1) slot--;
        picked[slot] = pistol;
      }
    }
  }

  return picked.map((upg) => {
    const level = shopLevels[upg.id] || 0;
    const rarity = rollRarity(waveNum, player ? player.luck : 0);
    const inflation = upg.infinite ? Math.pow(1.11, level) : 1;
    return {
      upg,
      level,
      rarity,
      cost: Math.round((upg.base + level * upg.step) * RARITY_MULT[rarity] * inflation),
      purchased: false,
    };
  });
}
