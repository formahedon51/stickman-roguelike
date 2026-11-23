import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createUI } from './ui.js';
import { createDemo } from './demo.js';
import { createP2PHost, createP2PGuest } from './p2p.js';
import { createAudio } from './audio.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const input = createInput();
const audio = createAudio();

let session = null;
let state = null;
let selfId = null;
let active = false;
let inputTimer = null;
let paused = false;

const ui = createUI({
  onSolo: startSolo,
  onDemo: startDemo,
  onCreate: createRoom,
  onJoin: joinRoom,
  onStart: startRoom,
  onLobbyLeave: () => leaveSession(),
  onPause: togglePause,
  onRestart: () => {
    if (!session) return;
    session.restart();
    ui.hideGameOver();
  },
  onMenu: () => leaveSession(),
  onBuy: (index) => {
    if (session && session.buy) session.buy(index);
  },
  onReady: () => {
    if (session && session.ready) session.ready();
  },
});

function begin(adapter) {
  session = adapter;
  selfId = adapter.sessionId;
  active = true;
  paused = false;

  ui.hideMenu();
  ui.hideLobby();
  ui.showHud();
  ui.hideGameOver();
  ui.hideShop();
  ui.setPaused(false);
  ui.setMenuStatus('');

  const pauseBtn = document.getElementById('pauseBtn');
  if (pauseBtn) pauseBtn.style.display = adapter.isSolo ? '' : 'none';

  clearInterval(inputTimer);
  let prevInput = input.snapshot();
  inputTimer = setInterval(() => {
    const cur = input.snapshot();
    if (active && session && session.sessionId) session.sendInput(cur);
    if (active) {
      if (cur.jump && !prevInput.jump) audio.sfx.jump();
      if (cur.dash && !prevInput.dash) audio.sfx.dash();
      if (cur.attack && !prevInput.attack) audio.sfx.attack();
      if (cur.shoot && !prevInput.shoot) audio.sfx.shoot();
    }
    prevInput = cur;
  }, 1000 / 30);
}

function startLocal(solo) {
  if (session) leaveSession();
  const adapter = createDemo({
    name: ui.getName(),
    solo,
    onState: (s) => { state = s; },
    onGameOver: (stats) => ui.showGameOver(stats),
  });
  begin(adapter);
}

function startSolo() {
  startLocal(true);
}

function startDemo() {
  startLocal(false);
}

function togglePause() {
  if (!session || !session.isSolo) return;
  if (!state || state.status !== 'playing') return;
  paused = !paused;
  session.setPaused(paused);
  ui.setPaused(paused);
}

function createRoom() {
  if (session) leaveSession();
  const adapter = createP2PHost({
    name: ui.getName(),
    onLobby: (data) => {
      if (data.started) ui.hideLobby();
      else ui.showLobby(data);
    },
    onState: (s) => { state = s; },
    onGameOver: (stats) => ui.showGameOver(stats),
    onStarted: () => begin(adapter),
    onError: (msg) => {
      ui.hideLobby();
      ui.showMenu();
      ui.setMenuStatus(msg, 'err');
      if (session === adapter) session = null;
    },
    onEnd: () => { /* хост сам завершает */ },
  });
  session = adapter;
}

function joinRoom() {
  const code = ui.getCode();
  if (code.length !== 6) {
    ui.setMenuStatus('Код комнаты — 6 символов', 'err');
    return;
  }
  if (session) leaveSession();
  const adapter = createP2PGuest({
    code,
    name: ui.getName(),
    onLobby: (data) => {
      if (data.started) ui.hideLobby();
      else ui.showLobby(data);
    },
    onState: (s) => { state = s; },
    onStarted: () => begin(adapter),
    onError: (msg) => {
      ui.hideLobby();
      ui.showMenu();
      ui.setMenuStatus(msg, 'err');
      if (session === adapter) session = null;
    },
    onEnd: (msg) => {
      if (active) {
        leaveSession(msg || 'Соединение с хостом закрыто.');
      } else {
        ui.hideLobby();
        ui.showMenu();
        ui.setMenuStatus(msg || 'Соединение закрыто', 'warn');
        if (session === adapter) session = null;
      }
    },
  });
  session = adapter;
}

function startRoom() {
  if (session && session.isHost && session.start) session.start();
}

function leaveSession(message) {
  const s = session;
  active = false;
  paused = false;
  session = null;
  state = null;
  selfId = null;
  ui.setPaused(false);

  clearInterval(inputTimer);
  inputTimer = null;

  if (s) {
    try { s.leave(); } catch (e) { /* noop */ }
  }

  ui.hideHud();
  ui.hideGameOver();
  ui.hideShop();
  ui.hideLobby();
  ui.showMenu();

  if (message) ui.setMenuStatus(message, 'warn');
}

let last = 0;
const prevState = { hp: null, coins: null, level: null, wave: null, downed: null };
function trackSounds(stateNow, id) {
  if (!stateNow) return;
  const me = stateNow.players && stateNow.players[id];
  if (me) {
    if (prevState.hp != null && me.hp < prevState.hp - 1 && !me.dead) audio.sfx.hurt();
    if (prevState.downed === false && me.downed) audio.sfx.downed();
    if (prevState.downed === true && !me.downed && !me.dead) audio.sfx.revive();
    prevState.hp = me.hp;
    prevState.downed = me.downed;
  }
  if (prevState.coins != null && stateNow.coins > prevState.coins) audio.sfx.coin();
  prevState.coins = stateNow.coins;

  if (prevState.wave != null && stateNow.wave > prevState.wave) {
    if (stateNow.wave % 5 === 0) audio.sfx.boss();
    else audio.sfx.wave();
  }
  prevState.wave = stateNow.wave;

  if (prevState.level != null && stateNow.level > prevState.level) audio.sfx.level();
  prevState.level = stateNow.level;
}

function loop(ts) {
  if (!last) last = ts;
  const dt = Math.min(0.05, (ts - last) / 1000);
  last = ts;
  const now = ts / 1000;

  if (state) {
    renderer.update(state, dt);
    renderer.draw(state, selfId, now);
    ui.updateHud(state, selfId);
    trackSounds(state, selfId);
  } else {
    renderer.drawIdle(now);
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

const muteBtn = document.getElementById('muteBtn');
if (muteBtn) {
  muteBtn.addEventListener('click', () => {
    const m = audio.toggle();
    muteBtn.textContent = m ? '🔇' : '🔊';
  });
}
window.addEventListener('keydown', (e) => {
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (e.code === 'KeyM') {
    const m = audio.toggle();
    if (muteBtn) muteBtn.textContent = m ? '🔇' : '🔊';
  }
  if ((e.code === 'Escape' || e.code === 'KeyP') && session && session.isSolo) {
    e.preventDefault();
    togglePause();
  }
});

// Отладочный доступ (для тестов, не влияет на игру).
window.__RG_DEBUG__ = {
  getState: () => state,
  getSession: () => session,
  getSelfId: () => selfId,
  setState: (s) => { state = s; },
};
