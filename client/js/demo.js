// Демо/соло-режим: симуляция прямо в браузере (пока нет Colyseus-сервера).
// Внешность и механика — из предыдущей версии.

import {
  createWorld, resetWorld, step, buyOffer, setReady,
} from '../shared/sim.js';
import { PLAYER_COLORS, TICK_RATE } from '../shared/constants.js';

const emptyInput = () => ({
  left: false, right: false, jump: false, dash: false, attack: false, swap: false,
});

export function createDemo({ name, solo, clazz, onState, onGameOver }) {
  const selfId = 'local-' + Math.random().toString(36).slice(2, 8);
  const defs = solo
    ? [{ id: selfId, name: name || 'Игрок', color: PLAYER_COLORS[0], clazz }]
    : [
        { id: selfId, name: name || 'Игрок', color: PLAYER_COLORS[0], clazz },
        { id: 'bot-alpha', name: 'Бот Альфа', color: PLAYER_COLORS[1], clazz: 'warrior' },
        { id: 'bot-beta', name: 'Бот Бета', color: PLAYER_COLORS[2], clazz: 'gunner' },
      ];

  const world = createWorld(defs, { solo: !!solo });
  const DT = 1 / TICK_RATE;
  const botIds = solo ? [] : ['bot-alpha', 'bot-beta'];
  let localInput = emptyInput();
  let timer = null;
  let reported = false;
  let shopSeen = false;
  let paused = false;
  const botTimers = { 'bot-alpha': 0, 'bot-beta': 0 };

  function enterShop() {
    shopSeen = true;
    botTimers['bot-alpha'] = 1.2 + Math.random() * 0.8;
    botTimers['bot-beta'] = 2.0 + Math.random() * 0.8;
  }

  function tickShop() {
    for (const id of botIds) {
      const p = world.players[id];
      if (!p || p.dead || p.ready) continue;
      botTimers[id] -= DT;
      if (botTimers[id] > 0) continue;

      let bought = 0;
      for (let i = 0; i < p.shopOffers.length && bought < 2; i++) {
        const o = p.shopOffers[i];
        if (!o.purchased && world.coins >= o.cost) {
          if (buyOffer(world, id, i)) bought++;
        }
      }
      setReady(world, id);
      botTimers[id] = 999;
    }
  }

  function tick() {
    if (paused) {
      onState(world);
      return;
    }

    if (world.status === 'shop') {
      if (!shopSeen) enterShop();
      tickShop();
    } else {
      shopSeen = false;
    }

    const inputs = { [selfId]: localInput };
    for (const id of botIds) {
      const p = world.players[id];
      if (p && !p.dead && !p.downed) inputs[id] = botInput(world, p);
    }

    step(world, inputs, DT);

    if (world.status === 'game_over' && !reported) {
      reported = true;
      onGameOver(world.stats);
    }
    onState(world);
  }

  onState(world);
  timer = setInterval(tick, 1000 / TICK_RATE);

  return {
    sessionId: selfId,
    isDemo: true,
    isSolo: !!solo,
    sendInput(input) {
      localInput = { ...emptyInput(), ...input };
    },
    buy(index) {
      return buyOffer(world, selfId, index);
    },
    ready() {
      setReady(world, selfId);
    },
    setPaused(value) {
      if (!solo) return;
      paused = !!value;
    },
    get paused() {
      return paused;
    },
    restart() {
      resetWorld(world, defs, { solo: !!solo });
      reported = false;
      shopSeen = false;
      paused = false;
      localInput = emptyInput();
      onState(world);
    },
    leave() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

function botInput(world, p) {
  const enemies = Object.values(world.enemies).filter((e) => e.alive);
  const input = emptyInput();

  // Приоритет — поднять упавшего напарника.
  const downed = Object.values(world.players).find((o) => o !== p && o.downed && !o.dead);
  if (downed) {
    const dx = downed.x - p.x;
    if (dx < -20) input.left = true;
    else if (dx > 20) input.right = true;
    return input;
  }

  if (!enemies.length) {
    const targetX = 640;
    if (p.x < targetX - 50) input.right = true;
    else if (p.x > targetX + 50) input.left = true;
    return input;
  }

  let target = null;
  let best = Infinity;
  for (const e of enemies) {
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < best) { best = d; target = e; }
  }

  const dx = target.x - p.x;
  const dy = target.y - p.y;
  if (dx < -20) input.left = true;
  else if (dx > 20) input.right = true;

  const dist = Math.hypot(dx, dy);
  if (p.weapon === 'gun') {
    if (dist > 130 && dist < 640 && Math.abs(dy) < 220) input.attack = true;
    else if (dist < 80 && p.switchCd <= 0 && Math.random() < 0.05) input.swap = true;
  } else {
    if (dist < 100) {
      input.attack = true;
      if (p.dashCd <= 0 && Math.random() < 0.02) input.dash = true;
    } else if (dist > 200 && p.switchCd <= 0 && Math.random() < 0.03) {
      input.swap = true;
    }
  }

  if (dy < -40 && p.onGround && Math.random() < 0.12) input.jump = true;
  return input;
}
