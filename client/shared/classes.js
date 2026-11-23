// Классы персонажей. Класс задаёт арсенал и стиль игры.
// В руках всегда одно оружие; Q/E переключает по арсеналу.

export const CLASSES = {
  warrior: {
    id: 'warrior', name: 'Воин', icon: '⚔', color: '#ff9f68',
    weapons: ['sword', 'axe'],
    desc: 'Меч + топор · танк с вампиризмом',
    apply(p) {
      p.maxHp += 20;
      p.hp = p.maxHp;
      p.damage += 8;
      p.lifesteal += 1;
      p.moveSpeed = Math.round(p.moveSpeed * 0.95);
    },
  },
  gunner: {
    id: 'gunner', name: 'Стрелок', icon: '➤', color: '#4affa0',
    weapons: ['pistol', 'rifle'],
    desc: 'Пистолет + винтовка · темп и скорость',
    apply(p) {
      p.shootDamage += 6;
      p.shootCdMax *= 0.85;
      p.moveSpeed += 15;
      p.damage = Math.round(p.damage * 0.9);
    },
  },
  sniper: {
    id: 'sniper', name: 'Снайпер', icon: '✜', color: '#b79cff',
    weapons: ['rifle', 'pistol'],
    desc: 'Винтовка + пистолет · криты и дальность',
    apply(p) {
      p.shootDamage += 10;
      p.shootCdMax *= 1.15;
      p.moveSpeed = Math.max(180, p.moveSpeed - 10);
      p.crit += 0.1;
      p.damage = Math.round(p.damage * 0.85);
    },
  },
  universal: {
    id: 'universal', name: 'Универсал', icon: '✶', color: '#7fe7ff',
    weapons: ['sword', 'pistol'],
    desc: 'Меч + пистолет · ровные бонусы',
    apply(p) {
      p.maxHp += 10;
      p.hp = p.maxHp;
      p.damage += 3;
      p.shootDamage += 3;
      p.moveSpeed += 10;
    },
  },
  berserker: {
    id: 'berserker', name: 'Берсерк', icon: '⚒', color: '#ff6b6b',
    weapons: ['axe', 'sword'],
    desc: 'Топор + меч · стеклянная пушка',
    apply(p) {
      p.maxHp = Math.max(70, p.maxHp - 10);
      p.hp = p.maxHp;
      p.damage += 14;
      p.lifesteal += 2;
      p.moveSpeed += 15;
      p.shootDamage = Math.round(p.shootDamage * 0.8);
    },
  },
  engineer: {
    id: 'engineer', name: 'Инженер', icon: '⚙', color: '#5eead4',
    weapons: ['shotgun', 'pistol'],
    desc: 'Дробовик + пистолет · броня и реген',
    apply(p) {
      p.maxHp += 15;
      p.hp = p.maxHp;
      p.armor += 0.08;
      p.regenRate += 3;
      p.shootDamage += 2;
      p.moveSpeed = Math.max(220, p.moveSpeed - 5);
    },
  },
  mage: {
    id: 'mage', name: 'Маг', icon: '✧', color: '#c4a7ff',
    weapons: ['staff', 'dagger'],
    desc: 'Посох + кинжал · магия и криты',
    apply(p) {
      p.maxHp = Math.max(70, p.maxHp - 10);
      p.hp = p.maxHp;
      p.shootDamage += 9;
      p.shootSpeed += 60;
      p.crit += 0.05;
      p.damage = Math.round(p.damage * 0.8);
      p.moveSpeed = Math.max(220, p.moveSpeed - 5);
    },
  },
  ninja: {
    id: 'ninja', name: 'Ниндзя', icon: '⌁', color: '#f472b6',
    weapons: ['dagger', 'pistol'],
    desc: 'Кинжал + пистолет · скорость и рывки',
    apply(p) {
      p.maxHp = Math.max(75, p.maxHp - 5);
      p.hp = p.maxHp;
      p.moveSpeed += 25;
      p.crit += 0.08;
      p.dashCdMax = Math.max(0.35, p.dashCdMax * 0.8);
      p.damage = Math.round(p.damage * 0.9);
    },
  },
};

export const CLASS_LIST = Object.values(CLASSES);

export function applyClass(p, id) {
  const cls = CLASSES[id] || CLASSES.warrior;
  p.clazz = cls.id;
  p.arsenal = [...cls.weapons];
  p.weaponIndex = 0;
  p.weapon = p.arsenal[0];
  cls.apply(p);
  return cls;
}
