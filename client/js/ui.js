import { RARITY_LABEL, RARITY_COLOR } from '../shared/upgrades.js?v=20261123';
import { CLASSES, CLASS_LIST } from '../shared/classes.js?v=20261123';
import { getWeapon } from '../shared/weapons.js?v=20261123';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function fmtTime(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

export function createUI({
  onSolo, onBot, onPause, onRestart, onMenu, onSpeed, onBuy, onReady,
}) {
  const els = {
    menu: $('menu'),
    hud: $('hud'),
    gameover: $('gameover'),
    pause: $('pause'),
    menuStatus: $('menuStatus'),
    classPicker: $('classPicker'),
    name: $('nameInput'),
    btnSolo: $('btnSolo'),
    btnBot: $('btnBot'),
    btnHelp: $('btnHelp'),
    btnPause: $('pauseBtn'),
    btnResume: $('btnResume'),
    btnPauseMenu: $('btnPauseMenu'),
    playerName: $('playerName'),
    classIcon: $('classIcon'),
    botBadge: $('botBadge'),
    hpFill: $('hpFill'),
    hpText: $('hpText'),
    shieldWrap: $('shieldWrap'),
    shieldFill: $('shieldFill'),
    lvl: $('lvlNum'),
    xpFill: $('xpFill'),
    xpNum: $('xpNum'),
    wave: $('waveLbl'),
    weaponIcon: $('weaponIcon'),
    weapon: $('weaponLbl'),
    swapHint: $('swapHint'),
    combo: $('comboLbl'),
    enemies: $('enemyLbl'),
    coins: $('coinLbl'),
    score: $('scoreLbl'),
    speedBtn: $('speedBtn'),
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
  let shopKey = '';
  let botMode = false;
  let botSpeed = 1;

  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem('rg_prefs') || '{}'); } catch (e) { /* noop */ }
  if (prefs.name) els.name.value = prefs.name;
  let selectedClass = CLASSES[prefs.clazz] ? prefs.clazz : 'warrior';

  function savePrefs() {
    try {
      localStorage.setItem('rg_prefs', JSON.stringify({
        name: els.name.value.trim(),
        clazz: selectedClass,
      }));
    } catch (e) { /* noop */ }
  }

  function buildClassPicker() {
    if (!els.classPicker) return;
    els.classPicker.innerHTML = '';
    for (const cls of CLASS_LIST) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'class-card' + (cls.id === selectedClass ? ' selected' : '');
      btn.dataset.class = cls.id;
      btn.style.setProperty('--cls-color', cls.color);

      const icon = document.createElement('span');
      icon.className = 'cc-icon';
      icon.textContent = cls.icon;

      const name = document.createElement('span');
      name.className = 'cc-name';
      name.textContent = cls.name;

      const weapons = document.createElement('span');
      weapons.className = 'cc-weapons';
      weapons.textContent = cls.weapons.map((id) => getWeapon(id).icon).join(' ');

      const desc = document.createElement('span');
      desc.className = 'cc-desc';
      desc.textContent = cls.desc;

      btn.appendChild(icon);
      btn.appendChild(name);
      btn.appendChild(weapons);
      btn.appendChild(desc);
      btn.addEventListener('click', () => {
        selectedClass = cls.id;
        for (const c of els.classPicker.children) {
          c.classList.toggle('selected', c.dataset.class === cls.id);
        }
        savePrefs();
      });
      els.classPicker.appendChild(btn);
    }
  }

  const getName = () => els.name.value.trim() || 'Игрок';
  const getClass = () => selectedClass;
  buildClassPicker();

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

  function setPaused(value) {
    els.pause.classList.toggle('show', !!value);
  }

  function setBotMode(value) {
    botMode = !!value;
    els.botBadge.classList.toggle('hidden', !botMode);
    els.speedBtn.classList.toggle('hidden', !botMode);
    if (!botMode) {
      botSpeed = 1;
      els.speedBtn.textContent = '×1';
    }
  }

  function setSpeed(value) {
    botSpeed = value || 1;
    els.speedBtn.textContent = '×' + botSpeed;
    els.speedBtn.classList.toggle('fast', botSpeed > 1);
  }

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

  /* ---------------- game over ---------------- */

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
    els.shop.classList.remove('show');
  }

  const hideGameOver = () => els.gameover.classList.remove('show');
  const hideShop = () => els.shop.classList.remove('show');

  /* ---------------- HUD ---------------- */

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

    const offers = p.shopOffers || [];
    const key = offers.map((o) => o.upg && o.upg.id).join(',');
    if (key !== shopKey) {
      shopKey = key;
      els.shopOffers.innerHTML = '';
      offers.forEach((o, i) => {
        const card = document.createElement('div');
        card.className = 'shop-card';
        card.innerHTML =
          '<div class="srarity"></div><div class="sname"></div><div class="sdesc"></div>' +
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
      card.querySelector('.sdesc').textContent = upg.desc || '';
      card.querySelector('.slevel').textContent = upg.unlockWeapon
        ? 'НОВОЕ ОРУЖИЕ'
        : 'УР. ' + (o.level || 0) + '/' + (upg.max || 1);
      const cost = card.querySelector('.scost');
      cost.textContent = '◆ ' + o.cost;
      cost.classList.toggle('affordable', !o.purchased && (state.coins || 0) >= o.cost);
      const btn = card.querySelector('button');
      btn.textContent = o.purchased ? 'КУПЛЕНО' : '[' + (i + 1) + '] КУПИТЬ';
      btn.disabled = o.purchased || (state.coins || 0) < o.cost || botMode;
    });

    if (botMode) {
      els.shopStatus.textContent = 'Бот выбирает улучшения…';
      els.btnShopReady.textContent = 'БОТ';
      els.btnShopReady.disabled = true;
    } else {
      els.shopStatus.textContent = p.ready
        ? 'Ожидание…'
        : 'Купи улучшения и нажми «Готов».';
      els.btnShopReady.textContent = p.ready ? 'ОЖИДАНИЕ…' : 'ГОТОВ [ПРОБЕЛ]';
      els.btnShopReady.disabled = !!p.ready;
    }
  }

  function updateHud(state, selfId) {
    if (!state) return;
    const me = state.players && state.players[selfId];
    if (!me) return;

    const cls = CLASSES[me.clazz];
    els.classIcon.textContent = cls ? cls.icon : '?';
    if (cls) els.classIcon.style.color = cls.color;
    els.playerName.textContent = me.name || 'Игрок';
    const hp = Math.max(0, Math.round(me.hp || 0));
    const maxHp = Math.max(1, Math.round(me.maxHp || 100));
    els.hpText.textContent = hp + '/' + maxHp;
    els.hpFill.style.width = Math.round(clamp(hp / maxHp, 0, 1) * 100) + '%';
    els.hpFill.style.background = me.color || '#4aa3ff';

    if (me.shieldMax > 0) {
      els.shieldWrap.classList.remove('hidden');
      els.shieldFill.style.width = Math.round(clamp((me.shield || 0) / me.shieldMax, 0, 1) * 100) + '%';
    } else {
      els.shieldWrap.classList.add('hidden');
    }

    els.lvl.textContent = state.level || 1;
    const xpPct = clamp((state.xp || 0) / (state.xpNext || 30), 0, 1);
    els.xpFill.style.width = Math.round(xpPct * 100) + '%';
    els.xpNum.textContent = Math.round(state.xp || 0) + '/' + (state.xpNext || 30);

    els.wave.textContent = 'ВОЛНА ' + Math.max(1, state.wave || 1);

    const w = getWeapon(me.weapon);
    els.weaponIcon.textContent = w.icon;
    els.weaponIcon.style.color = w.color;
    els.weapon.textContent = w.name.toUpperCase();
    els.weapon.style.color = w.color;
    const hasSwap = Array.isArray(me.arsenal) && me.arsenal.length > 1;
    els.swapHint.classList.toggle('hidden', !hasSwap);
    els.swapHint.textContent = hasSwap ? 'Q ⇄' : '';

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

  /* ---------------- handlers ---------------- */

  els.btnSolo.addEventListener('click', () => { savePrefs(); onSolo(); });
  els.btnBot.addEventListener('click', () => { savePrefs(); onBot(); });
  els.btnHelp.addEventListener('click', showTutorial);
  els.btnPause.addEventListener('click', onPause);
  els.btnResume.addEventListener('click', onPause);
  els.btnPauseMenu.addEventListener('click', onMenu);
  els.btnTutorialOk.addEventListener('click', closeTutorial);
  els.tutorial.addEventListener('click', (e) => {
    if (e.target === els.tutorial) closeTutorial();
  });
  els.btnRestart.addEventListener('click', () => { hideGameOver(); onRestart(); });
  els.btnGoMenu.addEventListener('click', onMenu);
  els.btnLeave.addEventListener('click', onMenu);
  els.btnShopReady.addEventListener('click', onReady);
  els.speedBtn.addEventListener('click', onSpeed);

  window.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (!els.shop.classList.contains('show') || botMode) return;
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
    getClass,
    setMenuStatus,
    showMenu,
    hideMenu,
    showHud,
    hideHud,
    showGameOver,
    hideGameOver,
    hideShop,
    setPaused,
    setBotMode,
    setSpeed,
    updateHud,
    savePrefs,
  };
}
