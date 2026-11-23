// P2P-кооп без сервера: хост в браузере авторитетно считает игру,
// гости подключаются по коду через бесплатный PeerJS.

import {
  createWorld, step, buyOffer, setReady, makePlayer,
} from '../shared/sim.js';
import { PLAYER_COLORS, TICK_RATE } from '../shared/constants.js';
import { rollOffers } from '../shared/upgrades.js';

const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302', 'stun:stun3.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.nextcloud.com:443' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:80?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

const PEER_CONFIG = {
  debug: 0,
  config: {
    iceServers: ICE_SERVERS,
    iceCandidatePoolSize: 10,
    sdpSemantics: 'unified-plan',
    bundlePolicy: 'max-bundle',
  },
};

const SNAPSHOT_RATE = 15; // снапшотов в секунду
const CONNECT_TIMEOUT = 8000;

const emptyInput = () => ({
  left: false, right: false, jump: false, dash: false, attack: false, swap: false,
});

function genCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

export function getSignalingServers() {
  const list = [];
  try {
    const raw = new URLSearchParams(location.search).get('server');
    if (raw) {
      const parts = raw.split(':');
      const host = parts[0];
      const port = parseInt(parts[1] || '443', 10) || 443;
      const path = parts.slice(2).join(':') || '/peerjs';
      if (host) list.push({ host, port, path, secure: port === 443 });
    }
  } catch (e) { /* noop */ }
  list.push(
    { host: '0.peerjs.com', port: 443, path: '/', secure: true },
    { host: '1.peerjs.com', port: 443, path: '/', secure: true },
    { host: 'peerjs-server.onrender.com', port: 443, path: '/', secure: true },
  );
  return list;
}

function makePeer(id, signal) {
  if (!window.Peer) throw new Error('peerjs.min.js не загрузился');
  const options = {
    ...PEER_CONFIG,
    host: signal.host,
    port: signal.port,
    path: signal.path,
    secure: signal.secure,
  };
  return id ? new window.Peer(id, options) : new window.Peer(options);
}

function sendTo(conn, msg) {
  try { if (conn && conn.open) conn.send(msg); } catch (e) { /* noop */ }
}

function plainPlayer(p) {
  return {
    id: p.id, name: p.name, color: p.color,
    x: p.x, y: p.y, w: p.w, h: p.h, vx: p.vx, vy: p.vy,
    facing: p.facing, anim: p.anim, onGround: p.onGround,
    jumpAnim: p.jumpAnim || 0, landAnim: p.landAnim || 0,
    hp: p.hp, maxHp: p.maxHp,
    dead: p.dead, downed: p.downed,
    downedTimer: p.downedTimer || 0, reviveProgress: p.reviveProgress || 0,
    attackT: p.attackT || 0, shootT: p.shootT || 0, dashT: p.dashT || 0,
    weapon: p.weapon || 'sword', clazz: p.clazz || 'warrior',
    switchCd: p.switchCd || 0,
    kills: p.kills || 0, score: p.score || 0,
    ready: !!p.ready,
    shopLevels: p.shopLevels ? { ...p.shopLevels } : {},
    shopOffers: (p.shopOffers || []).map((o) => ({
      upg: { id: o.upg.id, name: o.upg.name, max: o.upg.max },
      level: o.level, cost: o.cost, rarity: o.rarity, purchased: o.purchased,
    })),
  };
}

function plainEnemy(e) {
  return {
    id: e.id, type: e.type, x: e.x, y: e.y, w: e.w, h: e.h,
    hp: e.hp, maxHp: e.maxHp, facing: e.facing,
    onGround: e.onGround, hitFlash: e.hitFlash,
    st: e.st, t: e.t, enrage: e.enrage, alive: e.alive, color: e.color,
  };
}

function plainProjectile(b) {
  return {
    id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy,
    r: b.r, life: b.life, friendly: b.friendly,
  };
}

function snapWorld(world) {
  const players = {};
  for (const p of Object.values(world.players)) players[p.id] = plainPlayer(p);
  const enemies = {};
  for (const e of Object.values(world.enemies)) enemies[e.id] = plainEnemy(e);
  const projectiles = {};
  for (const b of Object.values(world.projectiles)) projectiles[b.id] = plainProjectile(b);

  return {
    solo: false,
    playerCount: world.playerCount,
    wave: world.wave,
    status: world.status,
    phase: world.phase,
    time: world.time,
    players,
    enemies,
    projectiles,
    pickups: world.pickups.map((k) => ({ ...k })),
    pending: world.pending.map((p) => ({ ...p })),
    dmgNumbers: world.dmgNumbers.map((d) => ({ ...d })),
    banner: { ...world.banner },
    coins: world.coins,
    xp: world.xp,
    xpNext: world.xpNext,
    level: world.level,
    score: world.score,
    combo: world.combo,
    comboBest: world.comboBest,
    wavesCleared: world.wavesCleared,
    stats: world.stats ? { ...world.stats } : null,
    shake: world.shake,
    hurtFlash: world.hurtFlash,
    levelFlash: world.levelFlash,
  };
}

/* ------------------------------------------------------------------ */
/* Хост                                                                */
/* ------------------------------------------------------------------ */

export function createP2PHost({
  name, clazz, onLobby, onState, onGameOver, onStarted, onError, onEnd,
}) {
  const hostId = 'host';
  const hostName = name || 'Хост';
  const hostClass = clazz || 'warrior';
  const servers = getSignalingServers();
  const guests = new Map();
  const inputs = {};

  let peer = null;
  let code = '';
  let started = false;
  let world = null;
  let reported = false;
  let destroyed = false;
  let localInput = emptyInput();
  let simTimer = null;
  let snapTimer = null;

  function playersList() {
    const list = [{ id: hostId, name: hostName, host: true, color: PLAYER_COLORS[0], clazz: hostClass }];
    for (const g of guests.values()) {
      list.push({ id: g.id, name: g.name, host: false, color: g.color, clazz: g.clazz });
    }
    return list;
  }

  function lobbyData() {
    return { code, isHost: true, started, players: playersList() };
  }

  function broadcastLobby() {
    const data = lobbyData();
    if (onLobby) onLobby(data);
    for (const g of guests.values()) sendTo(g.conn, { t: 'lobby', ...data });
  }

  function sendState(conn) {
    if (world) sendTo(conn, { t: 'state', state: snapWorld(world) });
  }

  function setupGuest(conn) {
    let info = null;

    const helloTimer = setTimeout(() => {
      if (!info) {
        try { conn.close(); } catch (e) { /* noop */ }
        broadcastLobby();
      }
    }, 15000);

    conn.on('data', (msg) => {
      if (!msg || !msg.t) return;

      if (msg.t === 'hello' && !info) {
        clearTimeout(helloTimer);
        const id = conn.peer;
        const color = PLAYER_COLORS[(guests.size + 1) % PLAYER_COLORS.length];
        info = { id, name: msg.name || 'Гость', color, clazz: msg.clazz || 'warrior', conn };
        guests.set(id, info);

        if (started && world && !world.players[id]) {
          world.players[id] = makePlayer(
            { id, name: info.name, color, clazz: info.clazz },
            Object.keys(world.players).length,
            false,
          );
          world.playerCount = Object.keys(world.players).length;
          if (world.status === 'shop') {
            world.players[id].shopOffers = rollOffers(world.wave, {});
          }
        }

        sendTo(conn, { t: 'welcome', id, host: hostName, code, started });
        sendTo(conn, { t: 'lobby', ...lobbyData() });
        if (started) sendState(conn);
        broadcastLobby();
        return;
      }

      if (!info) return;

      if (msg.t === 'input') {
        inputs[info.id] = { ...emptyInput(), ...(msg.intent || {}) };
      } else if (msg.t === 'shopBuy' && started && world) {
        if (buyOffer(world, info.id, msg.index)) onState(world);
      } else if (msg.t === 'shopReady' && started && world) {
        setReady(world, info.id);
        onState(world);
      } else if (msg.t === 'restart' && started && world) {
        if (world.status === 'game_over') beginRun();
      }
    });

    conn.on('close', () => {
      clearTimeout(helloTimer);
      if (!info || guests.get(info.id) !== info) return;
      guests.delete(info.id);
      delete inputs[info.id];
      if (started && world) {
        delete world.players[info.id];
        world.playerCount = Object.keys(world.players).length;
      }
      broadcastLobby();
      if (world) onState(world);
    });

    conn.on('error', () => { /* noop */ });
  }

  function openServer(index) {
    if (destroyed) return;
    if (index >= servers.length) {
      if (onError) onError('Все сигнальные серверы недоступны. Попробуй VPN или позже.');
      return;
    }

    const signal = servers[index];
    code = genCode();
    const p = makePeer('rg-' + code, signal);
    peer = p;
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled || peer !== p) return;
      settled = true;
      try { p.destroy(); } catch (e) { /* noop */ }
      openServer(index + 1);
    }, CONNECT_TIMEOUT);

    p.on('open', () => {
      if (peer !== p || settled) return;
      clearTimeout(timeout);
      settled = true;
      broadcastLobby();
    });

    p.on('connection', (conn) => {
      if (peer !== p) return;
      setupGuest(conn);
    });

    p.on('error', (e) => {
      if (peer !== p) return;
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        try { p.destroy(); } catch (err) { /* noop */ }
        openServer(index + 1);
      }
    });

    p.on('disconnected', () => {
      if (peer === p && p.disconnected) {
        setTimeout(() => {
          if (peer === p && p.disconnected && !p.destroyed) {
            try { p.reconnect(); } catch (e) { /* noop */ }
          }
        }, 1000);
      }
    });
  }

  function beginRun() {
    const defs = playersList().map((p) => ({ id: p.id, name: p.name, color: p.color, clazz: p.clazz }));
    world = createWorld(defs, { solo: false });
    started = true;
    reported = false;

    for (const g of guests.values()) sendTo(g.conn, { t: 'start' });
    for (const g of guests.values()) sendState(g.conn);
    broadcastLobby();

    if (onStarted) onStarted();
    onState(world);

    clearInterval(simTimer);
    clearInterval(snapTimer);
    simTimer = setInterval(() => {
      if (!world) return;
      if (world.status !== 'game_over') {
        inputs[hostId] = localInput;
        step(world, inputs, 1 / TICK_RATE);
        if (world.status === 'game_over' && !reported) {
          reported = true;
          if (onGameOver) onGameOver(world.stats);
        }
      }
      onState(world);
    }, 1000 / TICK_RATE);

    snapTimer = setInterval(() => {
      if (!world) return;
      const snap = snapWorld(world);
      for (const g of guests.values()) sendTo(g.conn, { t: 'state', state: snap });
    }, 1000 / SNAPSHOT_RATE);
  }

  openServer(0);

  return {
    sessionId: hostId,
    isHost: true,
    isSolo: false,
    get code() { return code; },
    start() { if (!started) beginRun(); },
    sendInput(input) { localInput = { ...emptyInput(), ...input }; },
    buy(index) { if (started && world) { if (buyOffer(world, hostId, index)) onState(world); } },
    ready() { if (started && world) { setReady(world, hostId); onState(world); } },
    restart() { if (started && world && world.status === 'game_over') beginRun(); },
    leave() {
      destroyed = true;
      clearInterval(simTimer);
      clearInterval(snapTimer);
      try { if (peer) peer.destroy(); } catch (e) { /* noop */ }
      if (onEnd) onEnd();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Гость                                                               */
/* ------------------------------------------------------------------ */

export function createP2PGuest({
  code, name, clazz, onLobby, onState, onStarted, onError, onEnd,
}) {
  const roomCode = String(code || '').trim().toUpperCase();
  const guestClass = clazz || 'warrior';
  const servers = getSignalingServers();
  let peer = null;
  let conn = null;
  let selfId = null;
  let destroyed = false;
  let joined = false;
  let failed = false;
  let p2pTimer = null;

  function joinServer(index) {
    if (destroyed) return;
    if (index >= servers.length) {
      if (onError) onError('Комната не найдена или серверы недоступны.');
      return;
    }

    const signal = servers[index];
    const p = makePeer(null, signal);
    peer = p;
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled || peer !== p) return;
      settled = true;
      try { p.destroy(); } catch (e) { /* noop */ }
      joinServer(index + 1);
    }, CONNECT_TIMEOUT);

    p.on('open', () => {
      if (peer !== p || settled) return;
      clearTimeout(timeout);
      settled = true;

      const c = p.connect('rg-' + roomCode, { reliable: true });
      conn = c;

      c.on('open', () => {
        sendTo(c, { t: 'hello', name: name || 'Гость', clazz: guestClass });
      });

      clearTimeout(p2pTimer);
      p2pTimer = setTimeout(() => {
        if (!selfId && !destroyed && !failed) {
          failed = true;
          try { p.destroy(); } catch (e) { /* noop */ }
          if (onError) onError('P2P не установилось. Попробуй VPN/другую сеть или смени сигналинг.');
        }
      }, 15000);

      c.on('data', (msg) => {
        if (!msg || !msg.t) return;

        if (msg.t === 'welcome') {
          clearTimeout(p2pTimer);
          selfId = msg.id;
          if (onLobby) {
            onLobby({
              code: msg.code || roomCode,
              isHost: false,
              started: !!msg.started,
              players: [],
            });
          }
        } else if (msg.t === 'lobby') {
          if (onLobby) {
            onLobby({
              code: msg.code || roomCode,
              isHost: false,
              started: !!msg.started,
              players: msg.players || [],
            });
          }
        } else if (msg.t === 'start') {
          // Ждём первый state.
        } else if (msg.t === 'state') {
          clearTimeout(p2pTimer);
          onState(msg.state);
          if (!joined) {
            joined = true;
            if (onStarted) onStarted();
          }
        }
      });

      c.on('close', () => {
        if (!destroyed && onEnd) onEnd('Соединение с хостом закрыто.');
      });
      c.on('error', () => {
        if (!destroyed && onEnd) onEnd('Ошибка соединения с хостом.');
      });
    });

    p.on('error', (e) => {
      if (peer !== p) return;
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        try { p.destroy(); } catch (err) { /* noop */ }
        joinServer(index + 1);
      } else if (e && e.type === 'peer-unavailable') {
        try { p.destroy(); } catch (err) { /* noop */ }
        joinServer(index + 1);
      }
    });

    p.on('disconnected', () => {
      if (peer === p && p.disconnected) {
        setTimeout(() => {
          if (peer === p && p.disconnected && !p.destroyed) {
            try { p.reconnect(); } catch (e) { /* noop */ }
          }
        }, 1000);
      }
    });
  }

  joinServer(0);

  return {
    get sessionId() { return selfId; },
    isHost: false,
    isSolo: false,
    sendInput(input) { sendTo(conn, { t: 'input', intent: input }); },
    buy(index) { sendTo(conn, { t: 'shopBuy', index }); },
    ready() { sendTo(conn, { t: 'shopReady' }); },
    restart() { sendTo(conn, { t: 'restart' }); },
    leave() {
      destroyed = true;
      clearTimeout(p2pTimer);
      try { if (peer) peer.destroy(); } catch (e) { /* noop */ }
      if (onEnd) onEnd();
    },
  };
}
