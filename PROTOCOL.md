# P2P-протокол STICKMAN CO-OP · ROGUELIKE

Сервера нет: **хост** (браузер) авторитетно считает игру, гости подключаются по WebRTC DataChannel. PeerJS используется только для сигналинга (обмена SDP/ICE).

## Комната

- Код: 6 символов (`A–Z`, без похожих букв, `2–9`).
- Peer ID хоста: `rg-<КОД>`.
- Гость подключается к `rg-<КОД>` через PeerJS.
- До 8 игроков (хост + гости).

## Сигналинг

Бесплатные публичные серверы по умолчанию:

```
0.peerjs.com:443 /
1.peerjs.com:443 /
peerjs-server.onrender.com:443 /
```

Свой сервер: `?server=HOST:PORT:PATH` (например, `host:443:/peerjs`). Хост и гости должны использовать один и тот же сигналинг; ссылка с `?server=` передаёт его гостям.

## Сообщения

### Гость → хост

```json
{ "t": "hello", "name": "Игрок", "clazz": "warrior" }
{ "t": "input", "intent": { "left": false, "right": true, "jump": false, "dash": false, "attack": true, "swap": false } }
{ "t": "shopBuy", "index": 0 }
{ "t": "shopReady" }
{ "t": "restart" }
```

- `input` — 30 раз/с; хост применяет к игроку с `peer.id` гостя. `attack` использует текущее оружие, `swap` меняет меч ↔ пистолет.
- `shopBuy`/`shopReady` — только в `status === "shop"`.
- `restart` — после `game_over`.

### Хост → гость

```json
{ "t": "welcome", "id": "<peer.id>", "host": "Имя", "code": "XXXXXX", "started": false }
{ "t": "lobby", "code": "XXXXXX", "isHost": true, "started": false, "players": [ … ] }
{ "t": "start" }
{ "t": "state", "state": { … } }
```

- `welcome` — после `hello`; `id` — ID игрока гостя.
- `lobby` — при изменении состава/старте.
- `state` — снапшот мира **15 раз/с**.
- `state` — единственный источник истины для клиента: позиции, HP, волна, магазин и т.д.

## Снапшот (`state`)

```js
{
  solo: false, playerCount: 3,
  wave: 4, status: "playing", phase: "fight", time: 61.2,
  players: {
    "host": {
      id, name, color, clazz, x, y, w, h, vx, vy, facing, anim, onGround,
      hp, maxHp, dead, downed, downedTimer, reviveProgress,
      attackT, shootT, dashT, weapon, switchCd, kills, score, ready,
      shopLevels: {…}, shopOffers: [
        { upg: { id, name, max }, level, cost, rarity, purchased }
      ]
    },
    "peer-id": { … }
  },
  enemies: {
    "e1": { id, type, x, y, w, h, hp, maxHp, facing, onGround, hitFlash, st, t, enrage, alive, color }
  },
  projectiles: {
    "p1": { id, x, y, vx, vy, r, life, friendly }
  },
  pickups: [ { id, type: "coin"|"xp", x, y, vx, vy, r, value, bob, magnet } ],
  pending: [ { type, x, y, t } ],
  dmgNumbers: [ { x, y, val, color, life, crit } ],
  banner: { text, sub, t, max, color },
  coins, xp, xpNext, level, score, combo, comboBest, wavesCleared,
  stats: { wave, kills, damage, coinsEarned, comboBest, score, time } | null,
  shake, hurtFlash, levelFlash
}
```

Клиент рисует снапшот напрямую; интерполирует позиции. Частицы/декали/следы рывка на госте не синхронизируются (локальный визуал хоста); урон-цифры передаются в `dmgNumbers`.

## Частоты

- Симуляция хоста: **20 тиков/с** (`shared/sim.js`, `step`).
- Снапшоты: **15/с**.
- Ввод гостя: **30/с**.

## Магазин

- При зачистке волны хост ставит `status: "shop"` и генерирует по 3 оффера каждому живому игроку (`shared/upgrades.js`).
- Гость видит свои офферы в `state.players[selfId].shopOffers`, покупает `shopBuy`, готов — `shopReady`.
- Когда все живые готовы, хост продолжает волны.

## Поражение/рестарт

- Если все игроки мертвы/в нокдауне — `status: "game_over"`, `stats`.
- Рестарт: гость отправляет `restart`, хост сбрасывает мир с текущими игроками и рассылает новые снапшоты.

## Авторитетность

Гость **не** симулирует игру: он отправляет ввод и рисует снапшоты. Вся физика/урон/волны/магазин — на хосте (`shared/sim.js`).
