import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createUI } from './ui.js';
import { createDemo } from './demo.js';
import { connectColyseus } from './net.js';
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

const ui = createUI({
  onDemo: startDemo,
  onConnect: startConnect,
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

  ui.hideMenu();
  ui.showHud();
  ui.hideGameOver();
  ui.hideShop();
  ui.setMenuStatus('');

  clearInterval(inputTimer);
  let prevInput = input.snapshot();
  inputTimer = setInterval(() => {
    const cur = input.snapshot();
    if (active && session) session.sendInput(cur);
    if (active) {
      if (cur.jump && !prevInput.jump) audio.sfx.jump();
      if (cur.dash && !prevInput.dash) audio.sfx.dash();
      if (cur.attack && !prevInput.attack) audio.sfx.attack();
      if (cur.shoot && !prevInput.shoot) audio.sfx.shoot();
    }
    prevInput = cur;
  }, 1000 / 30);
}

function startDemo() {
  if (session) leaveSession();
  const name = ui.getName();
  const adapter = createDemo({
    name,
    onState: (s) => { state = s; },
    onGameOver: (stats) => ui.showGameOver(stats),
  });
  begin(adapter);
}

async function startConnect() {
  const url = ui.getServerUrl();
  const name = ui.getName();
  if (!url) {
    ui.setMenuStatus('Укажите адрес сервера, например wss://45-12-34-56.sslip.io', 'warn');
    return;
  }

  ui.setMenuStatus('Подключение к серверу…');

  try {
    if (session) leaveSession();
    const adapter = await connectColyseus({
      url,
      name,
      onState: (s) => { state = s; },
      onGameOver: (stats) => ui.showGameOver(stats),
      onLeave: () => {
        if (active) leaveSession('Соединение с сервером закрыто.');
      },
      onError: (msg) => {
        if (active) leaveSession('Ошибка сервера: ' + msg);
        else ui.setMenuStatus('Ошибка сервера: ' + msg, 'err');
      },
    });
    begin(adapter);
  } catch (e) {
    ui.setMenuStatus('Не удалось подключиться: ' + (e && e.message ? e.message : e), 'err');
  }
}

function leaveSession(message) {
  const s = session;
  active = false;
  session = null;
  state = null;
  selfId = null;

  clearInterval(inputTimer);
  inputTimer = null;

  if (s) {
    try { s.leave(); } catch (e) { /* noop */ }
  }

  ui.hideHud();
  ui.hideGameOver();
  ui.hideShop();
  ui.showMenu();

  if (message) ui.setMenuStatus(message, 'warn');
}

let last = 0;
const prevState = { hp: null, coins: null, level: null, wave: null, downed: null };
function trackSounds(state, selfId) {
  if (!state) return;
  const me = state.players && state.players[selfId];
  if (me) {
    if (prevState.hp != null && me.hp < prevState.hp - 1 && !me.dead) audio.sfx.hurt();
    if (prevState.downed === false && me.downed) audio.sfx.downed();
    if (prevState.downed === true && !me.downed && !me.dead) audio.sfx.revive();
    prevState.hp = me.hp;
    prevState.downed = me.downed;
  }
  if (prevState.coins != null && state.coins > prevState.coins) audio.sfx.coin();
  prevState.coins = state.coins;

  if (prevState.wave != null && state.wave > prevState.wave) {
    if (state.wave % 5 === 0) audio.sfx.boss();
    else audio.sfx.wave();
  }
  prevState.wave = state.wave;

  if (prevState.level != null && state.level > prevState.level) audio.sfx.level();
  prevState.level = state.level;
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
  if (e.code === 'KeyM' && e.target && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
    const m = audio.toggle();
    if (muteBtn) muteBtn.textContent = m ? '🔇' : '🔊';
  }
});

// Отладочный доступ для ручной проверки (не влияет на игру).
window.__RG_DEBUG__ = {
  getState: () => state,
  getSession: () => session,
  getSelfId: () => selfId,
  setState: (s) => { state = s; },
};
