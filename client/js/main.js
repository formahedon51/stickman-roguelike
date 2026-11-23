import { createRenderer } from './render.js?v=20261123';
import { createInput } from './input.js?v=20261123';
import { createUI } from './ui.js?v=20261123';
import { createDemo } from './demo.js?v=20261123';
import { createAudio } from './audio.js?v=20261123';
import { getWeapon } from '../shared/weapons.js?v=20261123';

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
let lastInput = null;

const ui = createUI({
  onSolo: startSolo,
  onBot: startBot,
  onPause: togglePause,
  onRestart: () => {
    if (!session) return;
    session.restart();
    ui.hideGameOver();
  },
  onMenu: () => leaveSession(),
  onSpeed: cycleBotSpeed,
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
  lastInput = null;

  ui.hideMenu();
  ui.showHud();
  ui.hideGameOver();
  ui.hideShop();
  ui.setPaused(false);
  ui.setMenuStatus('');
  ui.setBotMode(!!adapter.isBot);
  if (adapter.isBot) ui.setSpeed(adapter.getSpeed ? adapter.getSpeed() : 1);
  prevState.hp = null;
  prevState.coins = null;
  prevState.level = null;
  prevState.wave = null;
  prevState.downed = null;
  prevState.attackT = 0;
  prevState.shootT = 0;

  const pauseBtn = document.getElementById('pauseBtn');
  if (pauseBtn) pauseBtn.style.display = adapter.canPause ? '' : 'none';

  clearInterval(inputTimer);
  let prevInput = input.snapshot();
  inputTimer = setInterval(() => {
    const cur = input.snapshot();
    lastInput = cur;
    if (active && session && session.sessionId) session.sendInput(cur);
    if (active && session && !session.isBot) {
      const me = state && state.players && state.players[session.sessionId];
      if (cur.jump && !prevInput.jump) audio.sfx.jump();
      if (cur.dash && !prevInput.dash) audio.sfx.dash();
      if (cur.attack && !prevInput.attack) {
        if (me && getWeapon(me.weapon).kind === 'ranged') audio.sfx.shoot();
        else audio.sfx.attack();
      }
      if (cur.swap && !prevInput.swap) audio.sfx.swap();
    }
    prevInput = cur;
  }, 1000 / 30);
}

function startRun(mode) {
  if (session) leaveSession();
  const adapter = createDemo({
    name: ui.getName(),
    clazz: ui.getClass(),
    mode,
    onState: (s) => { state = s; },
    onGameOver: (stats) => ui.showGameOver(stats),
  });
  begin(adapter);
}

function startSolo() {
  startRun('solo');
}

function startBot() {
  startRun('bot');
}

function cycleBotSpeed() {
  if (!session || !session.isBot || !session.setSpeed) return;
  const current = session.getSpeed ? session.getSpeed() : 1;
  const next = current === 1 ? 2 : current === 2 ? 4 : current === 4 ? 8 : 1;
  session.setSpeed(next);
  ui.setSpeed(next);
}

function togglePause() {
  if (!session || !session.canPause) return;
  if (!state || state.status === 'game_over') return;
  paused = !paused;
  session.setPaused(paused);
  ui.setPaused(paused);
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
  ui.setBotMode(false);
  ui.showMenu();

  if (message) ui.setMenuStatus(message, 'warn');
}

let last = 0;
const prevState = {
  hp: null, coins: null, level: null, wave: null, downed: null,
  attackT: 0, shootT: 0,
};
function trackSounds(stateNow, id) {
  if (!stateNow) return;
  const me = stateNow.players && stateNow.players[id];
  if (me) {
    if (prevState.hp != null && me.hp < prevState.hp - 1 && !me.dead) audio.sfx.hurt();
    if (prevState.downed === false && me.downed) audio.sfx.downed();
    if (prevState.downed === true && !me.downed && !me.dead) audio.sfx.revive();
    if (session && session.isBot) {
      if ((me.attackT || 0) > 0 && !(prevState.attackT > 0)) audio.sfx.attack();
      if ((me.shootT || 0) > 0 && !(prevState.shootT > 0)) {
        audio.sfx.shoot();
      }
    }
    prevState.hp = me.hp;
    prevState.downed = me.downed;
    prevState.attackT = me.attackT || 0;
    prevState.shootT = me.shootT || 0;
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
  if ((e.code === 'Escape' || e.code === 'KeyP') && session && session.canPause) {
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
  getInput: () => input.snapshot(),
  getLastInput: () => lastInput,
  getBotInfo: () => (session && session.getBotInfo ? session.getBotInfo() : null),
};
