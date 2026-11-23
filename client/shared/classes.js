// Классы персонажей. Каждый класс даёт бонусы и стартовое оружие.
// Оружие можно менять в бою (меч/пистолет), но использовать можно только одно.

export const CLASSES = {
  warrior: {
    id: 'warrior',
    name: 'Воин',
    icon: '⚔',
    weapon: 'sword',
    color: '#ff9f68',
    desc: 'Меч · +HP, ближний урон, вампиризм',
    apply(p) {
      p.maxHp += 20;
      p.hp = p.maxHp;
      p.damage += 10;
      p.lifesteal += 1;
      p.moveSpeed = Math.round(p.moveSpeed * 0.95);
    },
  },
  gunner: {
    id: 'gunner',
    name: 'Стрелок',
    icon: '➤',
    weapon: 'gun',
    color: '#4affa0',
    desc: 'Пистолет · +урон, скорострельность, скорость',
    apply(p) {
      p.shootDamage += 8;
      p.shootCdMax *= 0.85;
      p.moveSpeed += 20;
      p.damage = Math.round(p.damage * 0.85);
    },
  },
  sniper: {
    id: 'sniper',
    name: 'Снайпер',
    icon: '✜',
    weapon: 'gun',
    color: '#b79cff',
    desc: 'Тяжёлый пистолет · +урон, криты, медленнее',
    apply(p) {
      p.shootDamage += 14;
      p.shootCdMax *= 1.2;
      p.moveSpeed = Math.max(180, p.moveSpeed - 20);
      p.damage = Math.round(p.damage * 0.8);
      p.crit += 0.1;
    },
  },
  universal: {
    id: 'universal',
    name: 'Универсал',
    icon: '✦',
    weapon: 'sword',
    color: '#7fe7ff',
    desc: 'Меч или пистолет · ровные бонусы, быстрая смена',
    apply(p) {
      p.maxHp += 10;
      p.hp = p.maxHp;
      p.damage += 4;
      p.shootDamage += 4;
      p.moveSpeed += 10;
    },
  },
};

export const CLASS_LIST = Object.values(CLASSES);

export function applyClass(p, id) {
  const cls = CLASSES[id] || CLASSES.warrior;
  p.clazz = cls.id;
  p.weapon = cls.weapon;
  cls.apply(p);
  return cls;
}
