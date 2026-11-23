// Canvas-рендер состояния для Untitled X.
import { ARENA, PLATFORMS } from '../shared/constants.js';
import { getWeapon } from '../shared/weapons.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, scale = 1, offX = 0, offY = 0;
  let bgFar = null, bgNear = null, room = null, vignette = null, danger = null;

  const vis = {
    players: new Map(),
    enemies: new Map(),
    projectiles: new Map(),
    pickups: new Map(),
  };
  const dust = [];
  for (let i = 0; i < 30; i++) {
    dust.push({
      x: Math.random() * ARENA.w,
      y: Math.random() * ARENA.h,
      r: 0.6 + Math.random() * 1.7,
      ph: Math.random() * 6.28,
    });
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    scale = Math.min(W / ARENA.w, H / ARENA.h);
    offX = (W - ARENA.w * scale) / 2;
    offY = (H - ARENA.h * scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  function makeCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * 2);
    cv.height = Math.round(h * 2);
    const c = cv.getContext('2d');
    c.scale(2, 2);
    return { cv, c };
  }

  function paintSkyline(c, w, baseY, color, windowColor, minH, maxH) {
    let x = -30;
    while (x < w + 30) {
      const bw = 38 + Math.random() * 90;
      const bh = minH + Math.random() * (maxH - minH);
      c.fillStyle = color;
      c.fillRect(x, baseY - bh, bw, bh);
      c.fillStyle = windowColor;
      for (let wy = baseY - bh + 14; wy < baseY - 10; wy += 20) {
        for (let wx = x + 8; wx < x + bw - 8; wx += 17) {
          if (Math.random() < 0.32) c.fillRect(wx, wy, 4, 6);
        }
      }
      x += bw + 8 + Math.random() * 26;
    }
  }

  function buildBackdrop() {
    const w = ARENA.w + 160;

    const far = makeCanvas(w, ARENA.h);
    {
      const c = far.c;
      const g = c.createLinearGradient(0, 0, 0, ARENA.h);
      g.addColorStop(0, '#060911');
      g.addColorStop(0.55, '#0b111d');
      g.addColorStop(1, '#131a27');
      c.fillStyle = g;
      c.fillRect(0, 0, w, ARENA.h);

      for (let i = 0; i < 170; i++) {
        const x = Math.random() * w;
        const y = Math.random() * ARENA.floorY * 0.78;
        const r = 0.3 + Math.random() * 1.5;
        c.globalAlpha = 0.18 + Math.random() * 0.6;
        c.fillStyle = '#cfe3ff';
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;

      const mx = w * 0.74;
      const my = 128;
      const mr = 50;
      const mg = c.createRadialGradient(mx, my, mr * 0.35, mx, my, mr * 2.8);
      mg.addColorStop(0, 'rgba(150,200,255,0.30)');
      mg.addColorStop(1, 'rgba(150,200,255,0)');
      c.fillStyle = mg;
      c.beginPath();
      c.arc(mx, my, mr * 2.8, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#dce9ff';
      c.beginPath();
      c.arc(mx, my, mr, 0, Math.PI * 2);
      c.fill();

      paintSkyline(c, w, ARENA.floorY, '#0e1522', 'rgba(120,170,255,0.10)', 80, 240);
      bgFar = far.cv;
    }

    const near = makeCanvas(w, ARENA.h);
    {
      const c = near.c;
      paintSkyline(c, w, ARENA.floorY, '#0a0f18', 'rgba(140,190,255,0.14)', 130, 350);
      c.fillStyle = 'rgba(6,10,16,0.5)';
      c.fillRect(0, ARENA.floorY - 380, w, 380);
      bgNear = near.cv;
    }

    const roomCv = makeCanvas(ARENA.w, ARENA.h);
    {
      const c = roomCv.c;
      c.fillStyle = 'rgba(6,9,14,0.55)';
      c.fillRect(0, 0, ARENA.w, ARENA.floorY);

      c.strokeStyle = 'rgba(140,165,200,0.05)';
      c.lineWidth = 1;
      c.beginPath();
      for (let x = ARENA.wall; x < ARENA.w - ARENA.wall; x += 64) {
        c.moveTo(x, 24);
        c.lineTo(x, ARENA.floorY);
      }
      for (let y = 24; y < ARENA.floorY; y += 64) {
        c.moveTo(ARENA.wall, y);
        c.lineTo(ARENA.w - ARENA.wall, y);
      }
      c.stroke();

      for (const lx of [230, 640, 1050]) {
        c.fillStyle = '#232833';
        c.fillRect(lx - 52, 26, 104, 9);
        c.fillStyle = 'rgba(175,200,230,0.22)';
        c.fillRect(lx - 46, 35, 92, 3);
        const lg = c.createRadialGradient(lx, 44, 2, lx, 44, 78);
        lg.addColorStop(0, 'rgba(120,180,255,0.07)');
        lg.addColorStop(1, 'rgba(120,180,255,0)');
        c.fillStyle = lg;
        c.beginPath();
        c.ellipse(lx, 46, 78, 28, 0, 0, Math.PI * 2);
        c.fill();
      }

      const fg = c.createLinearGradient(0, ARENA.floorY, 0, ARENA.h);
      fg.addColorStop(0, '#1a1f28');
      fg.addColorStop(1, '#0a0d12');
      c.fillStyle = fg;
      c.fillRect(0, ARENA.floorY, ARENA.w, ARENA.h - ARENA.floorY);
      c.fillStyle = '#2e333c';
      c.fillRect(0, ARENA.floorY, ARENA.w, 4);
      c.fillStyle = 'rgba(90,170,255,0.5)';
      c.fillRect(0, ARENA.floorY, ARENA.w, 2);
      c.fillStyle = 'rgba(90,170,255,0.1)';
      c.fillRect(0, ARENA.floorY + 4, ARENA.w, 26);

      c.fillStyle = '#23272f';
      c.fillRect(0, 0, ARENA.wall, ARENA.h);
      c.fillRect(ARENA.w - ARENA.wall, 0, ARENA.wall, ARENA.h);
      c.fillStyle = '#343a45';
      c.fillRect(ARENA.wall - 4, 0, 4, ARENA.h);
      c.fillRect(ARENA.w - ARENA.wall, 0, 4, ARENA.h);
      c.fillStyle = '#20242c';
      c.fillRect(0, 0, ARENA.w, 24);
      c.fillStyle = '#2c313a';
      c.fillRect(0, 22, ARENA.w, 3);

      for (const p of PLATFORMS) {
        c.fillStyle = 'rgba(0,0,0,0.45)';
        c.fillRect(p.x, p.y + p.h, p.w, 5);
        c.fillStyle = '#20242b';
        c.fillRect(p.x, p.y, p.w, p.h);
        c.fillStyle = '#333945';
        c.fillRect(p.x, p.y, p.w, 3);
        c.fillStyle = 'rgba(90,170,255,0.45)';
        c.fillRect(p.x, p.y, p.w, 1);
      }
      room = roomCv.cv;
    }

    const vg = makeCanvas(ARENA.w, ARENA.h);
    {
      const c = vg.c;
      const g = c.createRadialGradient(
        ARENA.w / 2, ARENA.h * 0.48, ARENA.h * 0.28,
        ARENA.w / 2, ARENA.h * 0.48, ARENA.h * 0.85,
      );
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.62)');
      c.fillStyle = g;
      c.fillRect(0, 0, ARENA.w, ARENA.h);
      vignette = vg.cv;
    }

    const dg = makeCanvas(ARENA.w, ARENA.h);
    {
      const c = dg.c;
      const g = c.createRadialGradient(
        ARENA.w / 2, ARENA.h * 0.5, ARENA.h * 0.3,
        ARENA.w / 2, ARENA.h * 0.5, ARENA.h * 0.86,
      );
      g.addColorStop(0, 'rgba(255,20,20,0)');
      g.addColorStop(0.55, 'rgba(255,20,20,0.06)');
      g.addColorStop(1, 'rgba(190,0,0,0.55)');
      c.fillStyle = g;
      c.fillRect(0, 0, ARENA.w, ARENA.h);
      danger = dg.cv;
    }
  }

  buildBackdrop();

  function sync(map, src, dt, speed) {
    const k = 1 - Math.exp(-speed * dt);
    const source = src || {};
    for (const id of Object.keys(source)) {
      const e = source[id];
      const v = map.get(id);
      if (!v) map.set(id, { rx: e.x || 0, ry: e.y || 0 });
      else {
        v.rx += ((e.x || 0) - v.rx) * k;
        v.ry += ((e.y || 0) - v.ry) * k;
      }
    }
    for (const id of map.keys()) {
      if (!source[id]) map.delete(id);
    }
  }

  function syncArray(map, src, dt, speed) {
    const k = 1 - Math.exp(-speed * dt);
    const source = {};
    for (const e of src || []) if (e && e.id) source[e.id] = e;
    for (const id of Object.keys(source)) {
      const e = source[id];
      const v = map.get(id);
      if (!v) map.set(id, { rx: e.x || 0, ry: e.y || 0 });
      else {
        v.rx += ((e.x || 0) - v.rx) * k;
        v.ry += ((e.y || 0) - v.ry) * k;
      }
    }
    for (const id of map.keys()) {
      if (!source[id]) map.delete(id);
    }
  }

  function update(state, dt) {
    if (!state) return;
    sync(vis.players, state.players, dt, 22);
    sync(vis.enemies, state.enemies, dt, 16);
    sync(vis.projectiles, state.projectiles, dt, 30);
    syncArray(vis.pickups, state.pickups, dt, 18);
  }

  function beginFrame(state, now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let sx = 0;
    let sy = 0;
    if (state && state.shake > 0) {
      sx = (Math.random() - 0.5) * state.shake;
      sy = (Math.random() - 0.5) * state.shake;
    }
    ctx.setTransform(
      dpr * scale, 0, 0, dpr * scale,
      (offX + sx) * dpr, (offY + sy) * dpr,
    );

    const players = state ? Object.values(state.players || {}) : [];
    let avgX = ARENA.w / 2;
    if (players.length) {
      avgX = players.reduce((s, p) => s + (p.x || 0), 0) / players.length;
    }
    const px = clamp((avgX - ARENA.w / 2) * 0.05, -34, 34);
    ctx.drawImage(bgFar, -80 - px, 0, ARENA.w + 160, ARENA.h);
    ctx.drawImage(bgNear, -80 - px * 1.9, 0, ARENA.w + 160, ARENA.h);
    ctx.drawImage(room, 0, 0, ARENA.w, ARENA.h);
    drawDust(now);
  }

  function drawDust(now) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const d of dust) {
      let y = (d.y - now * 5) % ARENA.h;
      if (y < 0) y += ARENA.h;
      const x = d.x + Math.sin(now * 0.25 + d.ph) * 10;
      ctx.globalAlpha = 0.1 + 0.18 * (0.5 + 0.5 * Math.sin(now * 1.4 + d.ph));
      ctx.fillStyle = '#9fc4ff';
      ctx.beginPath();
      ctx.arc(x, y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function draw(state, selfId, now) {
    beginFrame(state, now);
    if (!state) return;

    drawDecals(state.decals);
    drawDashTrails(state.dashTrails);
    drawSpawnMarkers(state.pending);
    drawPickups(state.pickups, vis.pickups, now);

    for (const id of Object.keys(state.enemies || {})) {
      const e = state.enemies[id];
      if (e.alive === false) continue;
      const v = vis.enemies.get(id) || { rx: e.x, ry: e.y };
      drawEnemy(e, v, now);
    }

    for (const id of Object.keys(state.projectiles || {})) {
      const b = state.projectiles[id];
      const v = vis.projectiles.get(id) || { rx: b.x, ry: b.y };
      drawProjectile(b, v, now);
    }

    const players = Object.values(state.players || {});
    players.sort((a, b) => (a.id === selfId ? 1 : 0) - (b.id === selfId ? 1 : 0));
    for (const p of players) {
      const v = vis.players.get(p.id) || { rx: p.x, ry: p.y };
      drawPlayer(p, v, p.id === selfId, now);
    }

    drawParticles(state.particles);
    drawDmgNumbers(state.dmgNumbers);
    drawBanner(state.banner);

    if (vignette) ctx.drawImage(vignette, 0, 0, ARENA.w, ARENA.h);

    const me = state.players && state.players[selfId];
    if (me && !me.dead && me.hp / (me.maxHp || 100) < 0.3 && danger) {
      const pulse = 0.55 + 0.45 * Math.sin(now * 6);
      const pct = me.hp / (me.maxHp || 100);
      ctx.save();
      ctx.globalAlpha = (1 - pct / 0.3) * 0.85 * pulse;
      ctx.drawImage(danger, 0, 0, ARENA.w, ARENA.h);
      ctx.restore();
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (state.hurtFlash > 0) {
      ctx.fillStyle = 'rgba(255,40,40,' + (state.hurtFlash * 0.45) + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (state.levelFlash > 0) {
      ctx.fillStyle = 'rgba(120,255,180,' + (state.levelFlash * 0.18) + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function drawIdle(now) {
    beginFrame(null, now);
    if (vignette) ctx.drawImage(vignette, 0, 0, ARENA.w, ARENA.h);
  }

  /* ---------------- entities ---------------- */

  function drawEnemy(e, v, now) {
    const x = v.rx;
    const y = v.ry;
    const h = e.h || 56;
    const w = e.w || 24;
    let color = e.hitFlash > 0 ? '#ffffff' : (e.color || '#ff3b3b');
    if (e.type === 'boss' && e.enrage) color = '#ff4040';

    drawShadow(x + w / 2, y + h, w * 1.6, 0.32 * (e.onGround === false ? 0.5 : 1));
    if (e.type === 'boss') {
      ctx.save();
      ctx.globalAlpha = e.enrage ? 0.35 : 0.2;
      ctx.fillStyle = e.enrage ? '#ff3030' : '#8b1a1a';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h * 0.55, w * 1.1, h * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    let weapon = null;
    if (e.type === 'boss') weapon = 'axe';
    else if (e.type === 'brute') weapon = 'sword';
    else if (e.type === 'thrower') weapon = 'pistol';

    let attackT = 0;
    if (e.type === 'boss' && e.st === 'slamWindup') attackT = 0.7;
    else if (e.type === 'boss' && e.st === 'slamLand') attackT = clamp((e.t || 0) / 0.4, 0, 1);
    else if (e.type === 'brute' && e.st === 'windup') attackT = 0.7;
    else if (e.type === 'brute' && e.st === 'strike') attackT = clamp((e.t || 0) / 0.16, 0, 1);

    drawStickman(x + w / 2, y + h, h, color, {
      facing: e.facing || 1,
      phase: now * 3.5 + x * 0.02,
      weapon,
      glow: e.type === 'boss' ? 16 : 0,
      scarf: e.type === 'boss',
      airborne: e.onGround === false,
      attackT,
    });

    if (e.type !== 'boss' && e.hp < e.maxHp) {
      drawHpBar(x + w / 2 - (w + 10) / 2, y - 10, w + 10, 4, e.hp / e.maxHp, '#ff5050');
    }
  }

  function drawPlayer(p, v, isSelf, now) {
    const x = v.rx;
    const y = v.ry;
    const h = p.h || 60;
    const w = p.w || 26;

    if (p.dead) {
      drawShadow(x + w / 2, y + h, w * 1.2, 0.2);
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + h - 24);
      ctx.lineTo(x + w - 4, y + h - 4);
      ctx.moveTo(x + w - 4, y + h - 24);
      ctx.lineTo(x + 4, y + h - 4);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (p.downed) {
      drawDownedPlayer(p, x, y, w, h, now);
      return;
    }

    drawShadow(x + w / 2, y + h, w * 1.5, 0.32 * (p.onGround === false ? 0.5 : 1));

    if (isSelf) {
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.15 * Math.sin(now * 5);
      ctx.strokeStyle = p.color || '#4aa3ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h - 2, w * 0.9, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    drawStickman(x + w / 2, y + h, h, p.color || '#4aa3ff', {
      facing: p.facing || 1,
      phase: p.anim || 0,
      attackT: clamp((p.attackT || 0) / 0.24, 0, 1),
      shootT: clamp((p.shootT || 0) / 0.18, 0, 1),
      weapon: p.weapon || 'sword',
      glow: 8,
      scarf: true,
      airborne: p.onGround === false,
      jumpAnim: p.jumpAnim || 0,
      landAnim: p.landAnim || 0,
    });

    const top = y - h - 14;
    drawHpBar(x + w / 2 - 23, top, 46, 4, p.hp / (p.maxHp || 100), p.color || '#4aa3ff');
    ctx.save();
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    const label = (isSelf ? 'ВЫ · ' : '') + (p.name || 'Игрок');
    ctx.strokeText(label, x + w / 2, top - 5);
    ctx.fillStyle = isSelf ? '#ffffff' : (p.color || '#9fb4cc');
    ctx.fillText(label, x + w / 2, top - 5);
    ctx.restore();
  }

  function drawDownedPlayer(p, x, y, w, h, now) {
    const blink = Math.floor(now * 4) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = blink ? 0.45 : 0.9;
    ctx.strokeStyle = '#ff6b6b';
    ctx.fillStyle = '#ff6b6b';
    ctx.lineCap = 'round';
    const sc = h / 60;
    ctx.translate(x + w / 2, y + h - 8 * sc);
    ctx.scale(sc, sc);
    ctx.lineWidth = 4 / Math.max(sc, 0.7);
    ctx.beginPath();
    ctx.arc(-22, -4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-14, 0); ctx.lineTo(16, 0);
    ctx.moveTo(16, 0); ctx.lineTo(28, -6);
    ctx.moveTo(16, 0); ctx.lineTo(28, 4);
    ctx.moveTo(-2, 0); ctx.lineTo(-10, -10);
    ctx.moveTo(-2, 0); ctx.lineTo(-10, 8);
    ctx.stroke();
    ctx.restore();

    if (p.reviveProgress > 0) {
      const bw = 60;
      const bx = x + w / 2 - bw / 2;
      const by = y - 22;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bx, by, bw, 6);
      ctx.fillStyle = '#4affa0';
      ctx.fillRect(bx, by, bw * clamp(p.reviveProgress, 0, 1), 6);
    }
    if (p.downedTimer > 0) {
      const bw = 60;
      const bx = x + w / 2 - bw / 2;
      const by = y - 12;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bx, by, bw, 3);
      ctx.fillStyle = '#ff5050';
      ctx.fillRect(bx, by, bw * clamp(p.downedTimer / 15, 0, 1), 3);
    }
  }

  function drawProjectile(b, v, now) {
    const x = v.rx;
    const y = v.ry;
    const r = b.r || 5;
    const color = b.color || (b.friendly ? '#d8c8ff' : '#ffb080');
    const sp = Math.hypot(b.vx || 0, b.vy || 0);
    if (sp > 1) {
      const nx = b.vx / sp;
      const ny = b.vy / sp;
      const tlen = Math.min(34, Math.max(6, sp * 0.035));
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = color;
      ctx.lineWidth = r * 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - nx * tlen, y - ny * tlen);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r * 3.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (b.kind === 'staff') {
      ctx.save();
      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (b.retarget > 0) {
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.2 * Math.sin(now * 9 + x * 0.02);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(x, y, r * 2.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPickups(pickups, visuals, now) {
    for (const k of pickups || []) {
      const v = visuals.get(k.id) || { rx: k.x, ry: k.y };
      const bob = Math.sin(now * 6 + (k.bob || 0)) * 1.5;
      const r = k.r || 6;
      const x = v.rx;
      const y = v.ry + bob;
      ctx.save();
      ctx.translate(x, y);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = k.type === 'coin' ? 'rgba(232,193,90,0.16)' : 'rgba(127,224,160,0.16)';
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = k.type === 'coin' ? '#e8c15a' : '#7fe0a0';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles(particles) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const q of particles || []) {
      ctx.globalAlpha = clamp(q.life * 2, 0, 1);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawDmgNumbers(numbers) {
    ctx.textAlign = 'center';
    for (const d of numbers || []) {
      ctx.globalAlpha = clamp(d.life * 2, 0, 1);
      ctx.font = d.crit ? 'bold 19px ui-monospace, monospace' : 'bold 14px ui-monospace, monospace';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(String(d.val), d.x, d.y);
      ctx.fillStyle = d.color;
      ctx.fillText(String(d.val), d.x, d.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function drawDecals(decals) {
    for (const d of decals || []) {
      ctx.save();
      ctx.fillStyle = d.color + '50';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.r, d.r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawDashTrails(trails) {
    for (const t of trails || []) {
      const a = clamp(t.life / 0.22, 0, 1);
      ctx.save();
      ctx.globalAlpha = a * 0.4;
      ctx.fillStyle = t.color;
      const w = t.w || 26;
      const h = t.h || 60;
      const r = Math.min(w, h) * 0.25;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(t.x, t.y, w, h, r);
      else ctx.rect(t.x, t.y, w, h);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawSpawnMarkers(pending) {
    for (const s of pending || []) {
      if (s.t > 0.6) continue;
      const a = clamp(1 - s.t / 0.6, 0, 1);
      const y = (s.y === null || s.y === undefined) ? ARENA.floorY - 56 : s.y;
      ctx.save();
      ctx.globalAlpha = a * 0.85;
      ctx.strokeStyle = '#ff5050';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x + 12, y + 28, 22 + (1 - a) * 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBanner(b) {
    if (!b || !b.t || b.t <= 0) return;
    const total = b.max || 2;
    const p = 1 - b.t / total;
    const a = clamp(Math.min(p * 7, b.t * 2.6), 0, 1);
    const y = ARENA.h * 0.33 - p * 22;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = '900 64px ui-monospace, monospace';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(b.text, ARENA.w / 2, y);
    ctx.fillStyle = b.color || '#e8eef7';
    ctx.shadowColor = b.color || '#4aa3ff';
    ctx.shadowBlur = 28;
    ctx.fillText(b.text, ARENA.w / 2, y);
    if (b.sub) {
      ctx.font = 'bold 20px ui-monospace, monospace';
      ctx.shadowColor = '#ff3030';
      ctx.fillStyle = '#ff8a8a';
      ctx.fillText(b.sub, ARENA.w / 2, y + 40);
    }
    ctx.restore();
  }

  /* ---------------- stickman ---------------- */

  function drawShadow(cx, feetY, w, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, feetY - 2, w * 0.5, w * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHpBar(x, y, w, h, pct, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * clamp(pct, 0, 1), h);
  }

  function computeLimb(x0, y0, ang, len, bend) {
    const t1 = len * 0.55;
    const t2 = len * 0.45;
    const kx = x0 + Math.sin(ang) * t1;
    const ky = y0 + Math.cos(ang) * t1;
    const a2 = ang * bend;
    return { kx, ky, ex: kx + Math.sin(a2) * t2, ey: ky + Math.cos(a2) * t2 };
  }

  function drawStickman(cx, feetY, h, color, o) {
    o = o || {};
    const facing = o.facing || 1;
    const phase = o.phase || 0;
    const lw = Math.max(2.2, h * 0.06);
    const headR = h * 0.125;
    const headCY = feetY - h + headR;
    const shoulderY = feetY - h * 0.70;
    const hipY = feetY - h * 0.44;
    const legLen = feetY - hipY;
    const armLen = h * 0.30;
    const attack = clamp(o.attackT || 0, 0, 1);
    const shoot = clamp(o.shootT || 0, 0, 1);
    const jump = o.jumpAnim || 0;
    const land = o.landAnim || 0;
    const sy = 1 + jump * 0.12 - land * 0.18;
    const sx = 1 - jump * 0.08 + land * 0.12;

    ctx.save();
    ctx.translate(cx, feetY);
    ctx.scale(facing * sx, sy);
    ctx.translate(0, -feetY);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (o.glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = o.glow;
    }

    const s = Math.sin(phase);
    let aa;
    if (attack > 0) {
      const ap = 1 - attack;
      aa = -0.2 + Math.min(1, ap * 1.6) * 2.2;
    } else if (o.airborne) aa = 2.2;
    else aa = -s * 0.85 - 0.12;
    let ab;
    if (shoot > 0) ab = 1.55;
    else if (o.airborne) ab = -2.0;
    else ab = s * 0.85 - 0.12;

    if (attack > 0 && getWeapon(o.weapon).kind === 'melee') {
      const trailStart = attack < 0.7 ? 0 : -0.2;
      const trailEnd = aa;
      if (trailEnd > trailStart) {
        ctx.save();
        ctx.translate(0, shoulderY);
        ctx.globalAlpha = 0.5 * (1 - attack);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(2, h * 0.04);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, armLen * 1.6, Math.PI / 2 - trailEnd, Math.PI / 2 - trailStart, false);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.beginPath();
    ctx.moveTo(0, headCY + headR * 0.85);
    ctx.lineTo(0, hipY);
    addLimb(0, hipY, o.airborne ? 0.85 : s * 0.70, legLen, o.airborne ? 1.9 : 0.75);
    addLimb(0, hipY, o.airborne ? -0.50 : -s * 0.70, legLen, o.airborne ? 0.55 : 0.75);
    addLimb(0, shoulderY, ab, armLen, 0.55);
    addLimb(0, shoulderY, aa, armLen, 0.55);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, headCY, headR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(headR * 0.42, headCY - headR * 0.12, Math.max(1.2, headR * 0.16), 0, Math.PI * 2);
    ctx.fill();

    if (o.scarf) {
      const sway = Math.sin(phase * 0.8) * headR * 0.4;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = Math.max(1.6, lw * 0.5);
      ctx.beginPath();
      ctx.moveTo(0, headCY + headR * 0.55);
      ctx.quadraticCurveTo(-headR * 1.5, headCY + headR * 0.95 + sway, -headR * 2.3, headCY + headR * 1.1 + sway * 0.6);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = lw;
    }

    if (o.weapon) {
      const hand = computeLimb(0, shoulderY, aa, armLen, 0.55);
      drawWeapon(o.weapon, hand.ex, hand.ey, aa, color, h * 0.5, attack);
    }

    ctx.restore();

    function addLimb(x0, y0, ang, len, bend) {
      const l = computeLimb(x0, y0, ang, len, bend);
      ctx.moveTo(x0, y0);
      ctx.lineTo(l.kx, l.ky);
      ctx.lineTo(l.ex, l.ey);
    }
  }

  function drawWeapon(type, x, y, ang, color, size, attack) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI - ang);
    if (type === 'sword') {
      ctx.fillStyle = '#4a3322';
      ctx.fillRect(-size * 0.06, 0, size * 0.12, size * 0.18);
      ctx.fillStyle = '#b8925a';
      ctx.fillRect(-size * 0.18, -size * 0.04, size * 0.36, size * 0.06);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-size * 0.06, -size * 0.04);
      ctx.lineTo(-size * 0.05, -size * 0.75);
      ctx.lineTo(0, -size * 0.95);
      ctx.lineTo(size * 0.05, -size * 0.75);
      ctx.lineTo(size * 0.06, -size * 0.04);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = Math.max(0.6, size * 0.02);
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.1);
      ctx.lineTo(0, -size * 0.85);
      ctx.stroke();
    } else if (type === 'gun' || type === 'pistol') {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(-size * 0.05, 0, size * 0.1, size * 0.15);
      ctx.fillStyle = '#333';
      ctx.fillRect(-size * 0.12, -size * 0.1, size * 0.24, size * 0.14);
      ctx.fillStyle = '#444';
      ctx.fillRect(-size * 0.05, -size * 0.4, size * 0.1, size * 0.32);
      ctx.fillStyle = color;
      ctx.fillRect(-size * 0.1, -size * 0.05, size * 0.2, size * 0.03);
    } else if (type === 'axe') {
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(-size * 0.05, -size * 0.9, size * 0.1, size);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-size * 0.05, -size * 0.85);
      ctx.lineTo(-size * 0.35, -size * 0.95);
      ctx.lineTo(-size * 0.4, -size * 0.75);
      ctx.lineTo(-size * 0.35, -size * 0.55);
      ctx.lineTo(-size * 0.05, -size * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = Math.max(1, size * 0.02);
      ctx.beginPath();
      ctx.moveTo(-size * 0.4, -size * 0.75);
      ctx.lineTo(-size * 0.35, -size * 0.55);
      ctx.stroke();
    } else if (type === 'dagger') {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(-size * 0.05, 0, size * 0.1, size * 0.14);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-size * 0.045, -size * 0.02);
      ctx.lineTo(0, -size * 0.42);
      ctx.lineTo(size * 0.045, -size * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(0.6, size * 0.018);
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.06);
      ctx.lineTo(0, -size * 0.38);
      ctx.stroke();
    } else if (type === 'shotgun') {
      ctx.fillStyle = '#4a3322';
      ctx.fillRect(-size * 0.055, -size * 0.02, size * 0.11, size * 0.3);
      ctx.fillStyle = '#333';
      ctx.fillRect(-size * 0.17, -size * 0.22, size * 0.34, size * 0.09);
      ctx.fillStyle = '#555';
      ctx.fillRect(-size * 0.11, -size * 0.62, size * 0.08, size * 0.4);
      ctx.fillRect(size * 0.03, -size * 0.62, size * 0.08, size * 0.4);
      ctx.fillStyle = color;
      ctx.fillRect(-size * 0.15, -size * 0.25, size * 0.3, size * 0.025);
    } else if (type === 'rifle') {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(-size * 0.05, 0, size * 0.1, size * 0.22);
      ctx.fillStyle = '#3c3c3c';
      ctx.fillRect(-size * 0.07, -size * 0.71, size * 0.14, size * 0.55);
      ctx.fillStyle = color;
      ctx.fillRect(-size * 0.09, -size * 0.5, size * 0.18, size * 0.035);
      ctx.fillStyle = '#666';
      ctx.fillRect(-size * 0.02, -size * 0.8, size * 0.1, size * 0.05);
    } else if (type === 'staff') {
      ctx.strokeStyle = '#5a4330';
      ctx.lineWidth = Math.max(2, size * 0.055);
      ctx.beginPath();
      ctx.moveTo(0, size * 0.12);
      ctx.lineTo(0, -size * 0.8);
      ctx.stroke();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.arc(0, -size * 0.88, size * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, -size * 0.88, size * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(-size * 0.02, -size * 0.91, size * 0.03, 0, Math.PI * 2);
      ctx.fill();
    }
    if (attack > 0) {
      ctx.globalAlpha = attack * 0.25;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, -size * 0.6, size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  return { resize, update, draw, drawIdle };
}
