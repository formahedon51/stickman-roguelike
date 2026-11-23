// Локальный забег: одиночная игра или авто-бот. Без сети и без кооп-ботов.

import {
  createWorld, resetWorld, step, buyOffer, setReady,
} from '../shared/sim.js?v=20261123c';
import { PLAYER_COLORS, TICK_RATE } from '../shared/constants.js?v=20261123c';
import { createBotBrain } from './bot.js?v=20261123c';

const emptyInput = () => ({
  left: false, right: false, jump: false, dash: false, attack: false, swap: false,
});

export function createDemo({ name, clazz, mode, onState, onGameOver }) {
  const isBot = mode === 'bot';
  const selfId = 'local';
  const defs = [{
    id: selfId,
    name: name || (isBot ? 'Бот' : 'Игрок'),
    color: PLAYER_COLORS[isBot ? 1 : 0],
    clazz,
  }];

  const world = createWorld(defs, { solo: true });
  const bot = isBot ? createBotBrain() : null;
  const DT = 1 / TICK_RATE;

  let localInput = emptyInput();
  let timer = null;
  let reported = false;
  let shopSeen = false;
  let shopTimer = 0;
  let shopBought = false;
  let paused = false;
  let speed = 1;

  function enterShop() {
    shopSeen = true;
    shopTimer = 1.25 * Math.max(1, speed);
    shopBought = false;
    if (isBot && bot) {
      const picks = bot.shop(world, world.players[selfId]);
      for (const index of picks) buyOffer(world, selfId, index);
      shopBought = true;
    }
  }

  function tickShop() {
    if (!isBot || !bot) return;
    if (!shopBought) {
      const picks = bot.shop(world, world.players[selfId]);
      for (const index of picks) buyOffer(world, selfId, index);
      shopBought = true;
    }
    shopTimer -= DT;
    if (shopTimer <= 0) setReady(world, selfId);
  }

  function stepOnce() {
    if (world.status === 'game_over') return;

    if (world.status === 'shop') {
      if (!shopSeen) enterShop();
      tickShop();
      step(world, {}, DT);
    } else {
      shopSeen = false;
      const p = world.players[selfId];
      const input = isBot && bot && p ? bot.input(world, p, DT) : localInput;
      step(world, { [selfId]: input }, DT);
    }

    if (world.status === 'game_over' && !reported) {
      reported = true;
      if (onGameOver) onGameOver(world.stats);
    }
  }

  function tick() {
    if (paused) {
      onState(world);
      return;
    }
    for (let i = 0; i < speed; i++) {
      if (world.status === 'game_over') break;
      stepOnce();
    }
    onState(world);
  }

  onState(world);
  timer = setInterval(tick, 1000 / TICK_RATE);

  return {
    sessionId: selfId,
    isSolo: !isBot,
    isBot,
    canPause: true,
    sendInput(input) {
      if (isBot) return;
      localInput = { ...emptyInput(), ...input };
    },
    buy(index) {
      return buyOffer(world, selfId, index);
    },
    ready() {
      setReady(world, selfId);
    },
    setPaused(value) {
      paused = !!value;
    },
    get paused() {
      return paused;
    },
    setSpeed(value) {
      speed = Math.max(1, Math.min(8, Math.round(value || 1)));
      return speed;
    },
    getSpeed() {
      return speed;
    },
    getBotInfo() {
      if (!bot) return null;
      const p = world.players[selfId];
      return {
        mode: bot.mem.mode,
        targetId: bot.mem.targetId,
        weapon: p ? p.weapon : null,
        arsenal: p ? [...p.arsenal] : [],
        shopPicks: [...bot.mem.shopPicks],
      };
    },
    restart() {
      resetWorld(world, defs, { solo: true });
      if (bot) bot.reset();
      reported = false;
      shopSeen = false;
      shopTimer = 0;
      shopBought = false;
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
