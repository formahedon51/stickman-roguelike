// Оружие. У каждого ствола/клина свои урон, темп, дальность и снаряды.
// Игрок носит арсенал из 1–3 единиц и переключается между ними.

const melee = (o) => ({
  kind: 'melee',
  shots: 0,
  spread: 0,
  life: 0,
  speed: 1,
  r: 0,
  pierce: 0,
  critBonus: 0,
  anim: 1,
  height: 1,
  ...o,
});

const ranged = (o) => ({
  kind: 'ranged',
  damage: 1,
  cooldown: 1,
  range: 1,
  shots: 1,
  spread: 0,
  speed: 1,
  life: 2,
  r: 5,
  pierce: 0,
  critBonus: 0,
  idealRange: 260,
  homing: 0,
  ...o,
});

export const WEAPONS = {
  sword: melee({
    id: 'sword', name: 'Меч', icon: '⚔', color: '#ffd54f',
    desc: 'Быстрый и надёжный клинок',
    damage: 1, cooldown: 1, range: 1, idealRange: 56,
  }),
  axe: melee({
    id: 'axe', name: 'Топор', icon: '⚒', color: '#ff9f68',
    desc: 'Медленный, но очень тяжёлый удар',
    damage: 1.75, cooldown: 1.85, range: 1.16, height: 1.12,
    knockback: 1.7, idealRange: 64,
  }),
  dagger: melee({
    id: 'dagger', name: 'Кинжал', icon: '⌁', color: '#7fe7ff',
    desc: 'Очень быстрый, повышенный крит',
    damage: 0.62, cooldown: 0.48, range: 0.82,
    critBonus: 0.08, anim: 0.72, idealRange: 44,
  }),
  pistol: ranged({
    id: 'pistol', name: 'Пистолет', icon: '➤', color: '#b79cff',
    desc: 'Универсальный точный выстрел',
    damage: 1, cooldown: 1, idealRange: 280,
  }),
  shotgun: ranged({
    id: 'shotgun', name: 'Дробовик', icon: '≡', color: '#ff9f68',
    desc: 'Пять картечин вблизи',
    damage: 0.58, cooldown: 1.35, shots: 5, spread: 0.42,
    speed: 0.9, life: 0.55, r: 4, idealRange: 120,
  }),
  rifle: ranged({
    id: 'rifle', name: 'Винтовка', icon: '⌐', color: '#4affa0',
    desc: 'Дальний точный огонь, пробивает насквозь',
    damage: 0.72, cooldown: 0.45, spread: 0.025,
    speed: 1.35, life: 2, r: 4, pierce: 1, idealRange: 430,
  }),
  staff: ranged({
    id: 'staff', name: 'Посох', icon: '✧', color: '#7fe7ff',
    desc: 'Самонаводящийся магический снаряд',
    damage: 1.15, cooldown: 0.9, speed: 0.72, life: 2.4,
    r: 8, pierce: 1, homing: 260, idealRange: 320,
  }),
};

export const WEAPON_LIST = Object.values(WEAPONS);

export function getWeapon(id) {
  return WEAPONS[id] || WEAPONS.sword;
}

export function isMelee(id) {
  return getWeapon(id).kind === 'melee';
}

export function weaponReach(p, id) {
  const w = getWeapon(id);
  if (w.kind === 'melee') return p.attackRange * w.range;
  return Math.max(120, p.shootSpeed * w.speed * w.life * 0.9);
}

export function addWeapon(p, id) {
  if (!WEAPONS[id]) return false;
  if (!Array.isArray(p.arsenal)) p.arsenal = [p.weapon || 'sword'];
  if (p.arsenal.includes(id)) return false;
  p.arsenal.push(id);
  return true;
}

export function getWeaponMod(p, id) {
  if (!p.weaponMods) p.weaponMods = {};
  let m = p.weaponMods[id];
  if (!m) {
    m = { damage: 0, cooldown: 0, range: 0, life: 0, crit: 0 };
    p.weaponMods[id] = m;
  }
  return m;
}
