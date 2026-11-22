import { RARITY_LABEL, RARITY_COLOR } from '../shared/upgrades.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function fmtTime(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

export function createUI({ onSolo, onDemo, onConnect, onRestart, onMenu, onBuy, onReady, onPause }) {
  const els = {
    menu: $('menu'),
    hud: $('hud'),
    gameover: $('gameover'),
    pause: $('pause'),
    menuStatus: $('menuStatus'),
    name: $('nameInput'),
    server: $('serverInput'),
    btnSolo: $('btnSolo'),
    btnDemo: $('btnDemo'),
    btnConnect: $('btnConnect'),
    btnHelp: $('btnHelp'),
    btnPause: $('pauseBtn'),
    btnResume: $('btnResume'),
    btnPauseMenu: $('btnPauseMenu'),
    players: $('playersHud'),
    lvl: $('lvlNum'),
    xpFill: $('xpFill'),
    xpNum: $('xpNum'),
    wave: $('waveLbl'),
    combo: $('comboLbl'),
    enemies: $('enemyLbl'),
    coins: $('coinLbl'),
    score: $('scoreLbl'),
    btnLeave: $('btnLeave'),
    bossBar: $('bossBar'),
    bossLabel: $('bossLabel'),
    bossHp: $('bossHp'),
    shop: $('shop'),
    shopCoins: $('shopCoins'),
    shopOffers: $('shopOffers'),
    shopStatus: $('shopStatus'),
    btnShopReady: $('btnShopReady'),
    tutorial: $('tutorial'),
    btnTutorialOk: $('btnTutorialOk'),
    btnRestart: $('btnRestart'),
    btnGoMenu: $('btnGoMenu'),
    goStats: $('goStats'),
    touch: $('touchControls'),
  };

  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  const rows = new Map();
  let shopKey = '';

  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem('rg_prefs') || '{}'); } catch (e) { /* noop */ }
  if (prefs.name) els.name.value = prefs.name;
  if (prefs.server) els.server.value = prefs.server;

  function savePrefs() {
    try {
      localStorage.setItem('rg_prefs', JSON.stringify({
        name: els.name.value.trim(),
        server: els.server.value.trim(),
      }));
    } catch (e) { /* noop */ }
  }

  const getName = () => els.name.value.trim() || 'Игрок';
  const getServerUrl = () => els.server.value.trim();

  function setMenuStatus(text, kind) {
    els.menuStatus.textContent = text || '';
    els.menuStatus.className = kind || '';
  }

  const showMenu = () => els.menu.classList.add('show');
  const hideMenu = () => els.menu.classList.remove('show');
  function showHud() {
    els.hud.classList.remove('hidden');
    if (isTouch) els.touch.classList.remove('hidden');
  }

  function hideHud() {
    els.hud.classList.add('hidden');
    els.touch.classList.add('hidden');
  }
  const hideShop = () => els.shop.classList.remove('show');

  function showTutorial() {
    els.tutorial.classList.add('show');
  }

  function closeTutorial() {
    els.tutorial.classList.remove('show');
    try { localStorage.setItem('rg_tut', '1'); } catch (e) { /* noop */ }
  }

  try {
    if (localStorage.getItem('rg_tut') !== '1') {
      setTimeout(() => {
        if (localStorage.getItem('rg_tut') !== '1') showTutorial();
      }, 400);
    }
  } catch (e) { /* noop */ }

  function showGameOver(stats) {
    const s = stats || {};
    let best = 0;
    try { best = parseInt(localStorage.getItem('rg_bestWave') || '0', 10) || 0; } catch (e) { /* noop */ }
    if ((s.wave || 0) > best) {
      best = s.wave || 0;
      try { localStorage.setItem('rg_bestWave', String(best)); } catch (e) { /* noop */ }
    }
    const items = [
      ['ВОЛН ПРОЙДЕНО', s.wave != null ? s.wave : '—'],
      ['ВРЕМЯ', s.time != null ? fmtTime(s.time) : '—'],
      ['УБИЙСТВ', s.kills != null ? s.kills : '—'],
      ['УРОН', s.damage != null ? s.damage : '—'],
      ['ЛУЧШАЯ СЕРИЯ', s.comboBest != null ? '×' + s.comboBest : '—'],
      ['МОНЕТ', s.coinsEarned != null ? s.coinsEarned : '—'],
      ['ЛУЧШИЙ', best + ' волн'],
    ];
    els.goStats.innerHTML = items
      .map(([k, v], i) => `<div class="go-row${i === items.length - 1 ? ' best' : ''}"><span>${k}</span><b>${v}</b></div>`)
      .join('');
    els.gameover.classList.add('show');
    hideShop();
  }

  function hideGameOver() {
    els.gameover.classList.remove('show');
  }

  function makeRow() {
    const root = document.createElement('div');
    root.className = 'prow';
    root.innerHTML =
      '<span class="pdot"></span>' +
      '<div class="pinfo"><div class="pname"><span class="pnm"></span><span class="ptag"></span></div>' +
      '<div class="pbar"><i></i></div></div>' +
      '<span class="php"></span>';
    return {
      root,
      dot: root.querySelector('.pdot'),
      name: root.querySelector('.pnm'),
      tag: root.querySelector('.ptag'),
      fill: root.querySelector('.pbar i'),
      hp: root.querySelector('.php'),
    };
  }

  function updatePlayers(state, selfId) {
    const players = state.players || {};
    const seen = new Set();
    let index = 0;

    for (const p of Object.values(players)) {
      index += 1;
      seen.add(p.id);
      let row = rows.get(p.id);
      if (!row) {
        row = makeRow();
        rows.set(p.id, row);
        els.players.appendChild(row.root);
      }
      const color = p.color || '#4aa3ff';
      const pct = clamp((p.hp || 0) / (p.maxHp || 100), 0, 1);
      row.dot.style.background = color;
      row.name.textContent = 'P' + index + ' · ' + (p.name || 'Игрок');
      row.fill.style.width = Math.round(pct * 100) + '%';
      row.fill.style.background = color;
      row.hp.textContent = Math.max(0, Math.round(p.hp || 0)) + '/' + Math.round(p.maxHp || 100);
      row.root.classList.toggle('dead', !!p.dead);
      row.root.classList.toggle('downed', !!p.downed && !p.dead);
      if (p.dead) row.tag.textContent = 'ВЫБЫЛ';
      else if (p.downed) row.tag.textContent = 'ПОДЪЁМ';
      else if (p.id === selfId) row.tag.textContent = 'ВЫ';
      else row.tag.textContent = '';
    }

    for (const [id, row] of rows) {
      if (!seen.has(id)) {
        row.root.remove();
        rows.delete(id);
      }
    }
  }

  function updateBoss(state) {
    const boss = Object.values(state.enemies || {}).find(
      (e) => e.type === 'boss' && e.alive !== false,
    );
    if (!boss) {
      els.bossBar.classList.add('hidden');
      return;
    }
    els.bossBar.classList.remove('hidden');
    els.bossLabel.textContent = boss.enrage ? 'БОСС (ЯРОСТЬ)' : 'БОСС';
    els.bossHp.style.width = Math.round(clamp(boss.hp / (boss.maxHp || 1), 0, 1) * 100) + '%';
  }

  function renderShop(state, selfId) {
    const p = state.players && state.players[selfId];
    if (!p) return;

    els.shopCoins.textContent = '◆ ' + (state.coins || 0);

    if (p.dead) {
      els.shopOffers.innerHTML = '';
      shopKey = '';
      els.shopStatus.textContent = 'Вы выбыли. Наблюдайте за командой.';
      els.btnShopReady.disabled = true;
      els.btnShopReady.textContent = 'ВЫБЫЛИ';
      return;
    }

    const offers = p.shopOffers || [];
    const key = offers.map((o) => o.upg && o.upg.id).join(',');
    if (key !== shopKey) {
      shopKey = key;
      els.shopOffers.innerHTML = '';
      offers.forEach((o, i) => {
        const card = document.createElement('div');
        card.className = 'shop-card';
        card.innerHTML =
          '<div class="srarity"></div><div class="sname"></div>' +
          '<div class="slevel"></div><div class="scost"></div>' +
          '<button type="button">КУПИТЬ</button>';
        card.querySelector('button').addEventListener('click', () => onBuy(i));
        els.shopOffers.appendChild(card);
      });
    }

    offers.forEach((o, i) => {
      const card = els.shopOffers.children[i];
      if (!card) return;
      const upg = o.upg || {};
      card.className = 'shop-card rarity-' + (o.rarity || 'common') + (o.purchased ? ' purchased' : '');
      const rar = card.querySelector('.srarity');
      rar.textContent = RARITY_LABEL[o.rarity] || RARITY_LABEL.common;
      rar.style.color = RARITY_COLOR[o.rarity] || RARITY_COLOR.common;
      card.querySelector('.sname').textContent = upg.name || 'Улучшение';
      card.querySelector('.slevel').textContent = 'УР. ' + (o.level || 0) + '/' + (upg.max || 1);
      const cost = card.querySelector('.scost');
      cost.textContent = '◆ ' + o.cost;
      cost.classList.toggle('affordable', !o.purchased && (state.coins || 0) >= o.cost);
      const btn = card.querySelector('button');
      btn.textContent = o.purchased ? 'КУПЛЕНО' : '[' + (i + 1) + '] КУПИТЬ';
      btn.disabled = o.purchased || (state.coins || 0) < o.cost;
    });

    const alive = Object.values(state.players || {}).filter((x) => !x.dead);
    const readyCount = alive.filter((x) => x.ready).length;
    els.shopStatus.textContent = p.ready
      ? `Ожидание других игроков… (${readyCount}/${alive.length})`
      : `Готовы: ${readyCount}/${alive.length}. Купи улучшения и нажми «Готов».`;
    els.btnShopReady.textContent = p.ready ? 'ОЖИДАНИЕ…' : 'ГОТОВ [ПРОБЕЛ]';
    els.btnShopReady.disabled = !!p.ready;
  }

  function updateHud(state, selfId) {
    if (!state) return;

    updatePlayers(state, selfId);

    els.lvl.textContent = state.level || 1;
    const xpPct = clamp((state.xp || 0) / (state.xpNext || 30), 0, 1);
    els.xpFill.style.width = Math.round(xpPct * 100) + '%';
    els.xpNum.textContent = Math.round(state.xp || 0) + '/' + (state.xpNext || 30);

    els.wave.textContent = 'ВОЛНА ' + Math.max(1, state.wave || 1);
    els.combo.textContent = (state.combo || 0) >= 2 ? 'СЕРИЯ ×' + state.combo : '';
    const aliveEnemies = Object.values(state.enemies || {}).filter((e) => e.alive !== false).length;
    const pending = Array.isArray(state.pending) ? state.pending.length : 0;
    els.enemies.textContent = 'ВРАГОВ ' + (aliveEnemies + pending);
    els.coins.textContent = '◆ ' + (state.coins || 0);
    els.score.textContent = '★ ' + (state.score || 0);

    updateBoss(state);

    if (state.status === 'shop') {
      els.shop.classList.add('show');
      renderShop(state, selfId);
    } else {
      hideShop();
    }

    if (state.status === 'game_over') {
      if (!els.gameover.classList.contains('show')) showGameOver(state.stats);
    } else if (els.gameover.classList.contains('show')) {
      hideGameOver();
    }
  }

  els.btnSolo.addEventListener('click', () => { savePrefs(); onSolo(); });
  els.btnDemo.addEventListener('click', () => { savePrefs(); onDemo(); });
  els.btnConnect.addEventListener('click', () => { savePrefs(); onConnect(); });
  els.btnPause.addEventListener('click', onPause);
  els.btnResume.addEventListener('click', onPause);
  els.btnPauseMenu.addEventListener('click', onMenu);
  els.btnHelp.addEventListener('click', showTutorial);
  els.btnTutorialOk.addEventListener('click', closeTutorial);
  els.tutorial.addEventListener('click', (e) => {
    if (e.target === els.tutorial) closeTutorial();
  });
  els.btnRestart.addEventListener('click', () => { hideGameOver(); onRestart(); });
  els.btnGoMenu.addEventListener('click', onMenu);
  els.btnLeave.addEventListener('click', onMenu);
  els.btnShopReady.addEventListener('click', onReady);

  window.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (!els.shop.classList.contains('show')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!els.btnShopReady.disabled) onReady();
    }
    if (e.code === 'Digit1' || e.code === 'Numpad1') onBuy(0);
    if (e.code === 'Digit2' || e.code === 'Numpad2') onBuy(1);
    if (e.code === 'Digit3' || e.code === 'Numpad3') onBuy(2);
  });

  return {
    getName,
    getServerUrl,
    setMenuStatus,
    showMenu,
    hideMenu,
    showHud,
    hideHud,
    showGameOver,
    hideGameOver,
    hideShop,
    setPaused(value) {
      els.pause.classList.toggle('show', !!value);
    },
    updateHud,
    savePrefs,
  };
}
