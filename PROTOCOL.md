# Протокол Colyseus для STICKMAN ROGUELIKE

Контракт между этим клиентом и будущим сервером. Серверная часть в репозиторий **не входит** (по договорённости).

## Комната

- Имя: `roguelike_room`
- `maxClients: 8`
- `joinOrCreate(roomName, { name: string })`
- `sessionId` клиента — ключ игрока в `state.players`.

## Частоты

- Сервер: **20 тиков/с** (`setSimulationInterval(..., 50)`).
- Клиент: **30 отправок ввода/с**.
- Клиент интерполирует позиции между состояниями; сервер авторитетен.

## Сообщения клиент → сервер

### `input`

```json
{ "left": false, "right": true, "jump": false, "dash": false, "attack": true, "shoot": false }
```

Сервер применяет ввод к игроку с этим `sessionId` на следующем тике.

### `shopBuy`

```json
{ "index": 0 }
```

Купить предложение `shopOffers[index]` (только в `status === "shop"`).

### `shopReady`

Готов к следующей волне. Когда все живые игроки готовы — сервер запускает следующую волну.

### `restart`

После `game_over`: сбросить забег, воскресить игроков, волна 1.

## Сообщения сервер → клиент

### `game_over`

```json
{ "wave": 7, "kills": 42, "damage": 8123, "coinsEarned": 240, "comboBest": 12, "score": 9100, "time": 312 }
```

Дублирует `state.stats`; клиент показывает экран итогов.

## Состояние (Schema)

Клиент читает поля напрямую (MapSchema/ArraySchema) и приводит их в `normalizeState` (`client/js/net.js`). Минимально нужны:

```ts
class Player extends Schema {
  @type("string") name;
  @type("number") x; @type("number") y;
  @type("number") w; @type("number") h;
  @type("number") vx; @type("number") vy;
  @type("number") hp; @type("number") maxHp;
  @type("number") facing;
  @type("number") anim;
  @type("number") attackT; @type("number") shootT; @type("number") dashT;
  @type("boolean") onGround;
  @type("boolean") dead; @type("boolean") downed;
  @type("number") downedTimer; @type("number") reviveProgress;
  @type("string") color;
  @type("string") weapon;      // "sword" | "gun"
  @type("number") kills; @type("number") score;
  @type("boolean") ready;
  @type({ array: "string" }) shopLevelsJson; // или MapSchema
  @type({ array: ShopOffer }) shopOffers;
}

class Enemy extends Schema {
  @type("string") type;        // grunt | brute | thrower | boss
  @type("number") x; @type("number") y;
  @type("number") w; @type("number") h;
  @type("number") hp; @type("number") maxHp;
  @type("number") facing;
  @type("boolean") alive;
  @type("boolean") onGround;
  @type("boolean") enrage;
  @type("number") hitFlash;
  @type("string") st; @type("number") t;
  @type("string") color;
}

class GameState extends Schema {
  @type("number") wave;
  @type("string") status;   // playing | shop | game_over
  @type("string") phase;    // intermission | fight | clear | shop | game_over
  @type("number") time;
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Enemy }) enemies = new MapSchema<Enemy>();
  @type({ map: Projectile }) projectiles = new MapSchema<Projectile>();
  @type([ Pickup ]) pickups = new ArraySchema<Pickup>();
  @type("number") coins;
  @type("number") xp; @type("number") xpNext;
  @type("number") level;
  @type("number") score;
  @type("number") combo; @type("number") comboBest;
  @type("number") wavesCleared;
  @type("string") statsJson; // или Stats Schema
  @type("string") bannerJson; // или Banner Schema
  // необязательные визуальные массивы: particles, dmgNumbers, decals, dashTrails
}
```

`normalizeState` терпимо относится к отсутствующим полям; эффекты (партиклы, цифры урона) можно не синхронизировать — клиент умеет рисовать и без них.

## Готовая симуляция

`client/shared/sim.js` — чистый ESM без DOM:

```js
import { createWorld, resetWorld, step, buyOffer, setReady, openShop } from './shared/sim.js';

const world = createWorld([{ id: sessionId, name, color }]);
// каждый тик:
step(world, inputsBySessionId, 0.05);
// магазин:
buyOffer(world, sessionId, index);
setReady(world, sessionId);
```

Сервер может использовать этот модуль напрямую (Node ESM) и раскладывать `world` в Colyseus Schema. Константы арены/физики — в `client/shared/constants.js`, магазин — в `client/shared/upgrades.js`.

## Схема забега (как в клиенте)

- `status`: `playing` — идёт волна/перерыв; `shop` — магазин; `game_over` — итоги.
- `phase`: `intermission` (1.5 c перед волной), `fight`, `clear` (1.2 c после зачистки), `shop`.
- Босс — каждая 5-я волна.
- Нокдаун: HP 0 при живом напарнике → `downed`, таймер 15 c, подъём рядом 2.5 c; если все `downed`/мертвы → `game_over`.
- Магазин: 3 предложения на игрока, общие монеты, редкости с множителями 1/1.5/2/3.

## Caddy / sslip.io (когда сервер появится)

```caddyfile
45-12-34-56.sslip.io {
    reverse_proxy localhost:2567
}
```

Клиент подключается по `wss://45-12-34-56.sslip.io`. CORS для WebSocket не нужен; для HTTP-эндпоинтов Colyseus — стандартные настройки.
