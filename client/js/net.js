// Адаптер Colyseus. Сервер пока не поднят — этот файл готов к нему.
// Ожидаемый протокол описан в PROTOCOL.md.

import { ROOM_NAME } from '../shared/constants.js';

export async function connectColyseus({ url, name, onState, onGameOver, onLeave, onError }) {
  if (!window.Colyseus || !window.Colyseus.Client) {
    throw new Error('Библиотека colyseus.js не загрузилась (vendor/colyseus.js)');
  }

  const endpoint = normalizeUrl(url);
  const client = new window.Colyseus.Client(endpoint);
  const room = await withTimeout(
    client.joinOrCreate(ROOM_NAME, { name }),
    12000,
  );

  const selfId = room.sessionId;
  let closedByUs = false;

  const emit = () => {
    if (room.state) onState(normalizeState(room.state));
  };

  room.onStateChange(emit);
  room.onMessage('game_over', (msg) => {
    if (onGameOver) onGameOver(msg || null);
  });
  room.onLeave((code) => {
    if (!closedByUs && onLeave) onLeave(code);
  });
  room.onError((code, message) => {
    if (!closedByUs && onError) onError(`[${code}] ${message || ''}`.trim());
  });

  emit();

  return {
    sessionId: selfId,
    isDemo: false,
    sendInput(input) {
      room.send('input', input);
    },
    buy(index) {
      room.send('shopBuy', { index });
    },
    ready() {
      room.send('shopReady');
    },
    restart() {
      room.send('restart');
    },
    leave() {
      closedByUs = true;
      try { room.leave(); } catch (e) { /* noop */ }
    },
  };
}

function normalizeUrl(raw) {
  let u = String(raw || '').trim();
  if (!u) throw new Error('Укажите адрес сервера');
  if (u.startsWith('https://')) u = 'wss://' + u.slice(8);
  else if (u.startsWith('http://')) u = 'ws://' + u.slice(7);
  else if (!/^wss?:\/\//i.test(u)) u = 'wss://' + u;
  return u.replace(/\/+$/, '');
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Таймаут подключения к серверу')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

function plain(value) {
  if (!value) return value;
  try {
    return typeof value.toJSON === 'function' ? value.toJSON() : value;
  } catch (e) {
    return value;
  }
}

function mapToObj(obj) {
  const out = {};
  if (!obj) return out;
  if (typeof obj.forEach === 'function') {
    obj.forEach((v, k) => {
      const item = { ...(plain(v) || {}) };
      item.id = item.id || k;
      out[k] = item;
    });
    return out;
  }
  for (const k of Object.keys(obj)) {
    const item = { ...(plain(obj[k]) || {}) };
    item.id = item.id || k;
    out[k] = item;
  }
  return out;
}

function arr(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value.forEach === 'function') {
    const out = [];
    value.forEach((v) => out.push(plain(v)));
    return out;
  }
  return [];
}

export function normalizeState(state) {
  const players = mapToObj(state.players);
  const enemies = mapToObj(state.enemies);
  const projectiles = mapToObj(state.projectiles);
  const pickups = arr(state.pickups);

  for (const p of Object.values(players)) {
    p.x = Number(p.x) || 0;
    p.y = Number(p.y) || 0;
    p.w = Number(p.w) || 26;
    p.h = Number(p.h) || 60;
    p.vx = Number(p.vx) || 0;
    p.vy = Number(p.vy) || 0;
    p.hp = Number(p.hp) || 0;
    p.maxHp = Number(p.maxHp) || 100;
    p.facing = Number(p.facing) || 1;
    p.color = p.color || '#4aa3ff';
    p.name = p.name || 'Игрок';
    p.anim = Number(p.anim) || 0;
    p.attackT = Number(p.attackT) || 0;
    p.shootT = Number(p.shootT) || 0;
    p.dashT = Number(p.dashT) || 0;
    p.onGround = p.onGround !== false;
    p.jumpAnim = Number(p.jumpAnim) || 0;
    p.landAnim = Number(p.landAnim) || 0;
    p.dead = !!p.dead;
    p.downed = !!p.downed;
    p.downedTimer = Number(p.downedTimer) || 0;
    p.reviveProgress = Number(p.reviveProgress) || 0;
    p.kills = Number(p.kills) || 0;
    p.score = Number(p.score) || 0;
    p.weapon = p.weapon || 'sword';
    p.ready = !!p.ready;
    p.shopLevels = p.shopLevels ? { ...plain(p.shopLevels) } : {};
    p.shopOffers = arr(p.shopOffers).map((o) => ({
      ...o,
      upg: o.upg || {
        id: o.id || o.upgId || 'upgrade',
        name: o.name || 'Улучшение',
        max: o.max || 1,
      },
      purchased: !!o.purchased,
    }));
  }

  for (const e of Object.values(enemies)) {
    e.x = Number(e.x) || 0;
    e.y = Number(e.y) || 0;
    e.w = Number(e.w) || 24;
    e.h = Number(e.h) || 56;
    e.hp = Number(e.hp) || 0;
    e.maxHp = Number(e.maxHp) || 1;
    e.facing = Number(e.facing) || 1;
    e.type = e.type || 'grunt';
    e.color = e.color || '#ff3b3b';
    e.hitFlash = Number(e.hitFlash) || 0;
    e.onGround = e.onGround !== false;
    e.st = e.st || 'chase';
    e.t = Number(e.t) || 0;
    e.enrage = !!e.enrage;
    e.alive = e.alive !== false;
  }

  for (const b of Object.values(projectiles)) {
    b.x = Number(b.x) || 0;
    b.y = Number(b.y) || 0;
    b.vx = Number(b.vx) || 0;
    b.vy = Number(b.vy) || 0;
    b.r = Number(b.r) || 5;
    b.friendly = !!b.friendly;
  }

  return {
    wave: Number(state.wave) || 0,
    status: state.status || 'playing',
    phase: state.phase || 'fight',
    time: Number(state.time) || 0,
    players,
    enemies,
    projectiles,
    pickups,
    pending: arr(state.pending),
    particles: arr(state.particles),
    dmgNumbers: arr(state.dmgNumbers),
    decals: arr(state.decals),
    dashTrails: arr(state.dashTrails),
    banner: state.banner ? plain(state.banner) : { t: 0, max: 2, text: '', sub: '', color: '#e8eef7' },
    coins: Number(state.coins) || 0,
    xp: Number(state.xp) || 0,
    xpNext: Number(state.xpNext) || 30,
    level: Number(state.level) || 1,
    score: Number(state.score) || 0,
    combo: Number(state.combo) || 0,
    comboBest: Number(state.comboBest) || 0,
    wavesCleared: Number(state.wavesCleared) || 0,
    stats: state.stats ? plain(state.stats) : null,
  };
}
