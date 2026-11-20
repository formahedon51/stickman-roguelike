export function createInput() {
  const keys = {};
  const touch = {
    left: false, right: false, jump: false, dash: false, attack: false, shoot: false,
  };
  const pointers = new Map();

  const isField = (el) =>
    el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');

  window.addEventListener('keydown', (e) => {
    if (isField(e.target)) return;
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (isField(e.target)) return;
    keys[e.code] = false;
  });

  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
    clearTouch();
  });

  document.querySelectorAll('#touchControls .tc-btn').forEach((btn) => {
    const act = btn.dataset.act;
    if (!act) return;

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (pointers.has(e.pointerId)) return;
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      pointers.set(e.pointerId, { btn, act });
      touch[act] = true;
      btn.classList.add('pressed');
    });

    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  function endPointer(e) {
    const entry = pointers.get(e.pointerId);
    if (!entry) return;
    pointers.delete(e.pointerId);
    let stillHeld = false;
    for (const v of pointers.values()) {
      if (v.act === entry.act) { stillHeld = true; break; }
    }
    if (!stillHeld) {
      touch[entry.act] = false;
      entry.btn.classList.remove('pressed');
    }
  }

  function clearTouch() {
    pointers.clear();
    for (const k of Object.keys(touch)) touch[k] = false;
    document.querySelectorAll('#touchControls .tc-btn.pressed').forEach((b) => b.classList.remove('pressed'));
  }

  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      for (const k of Object.keys(keys)) keys[k] = false;
      clearTouch();
    }
  });

  return {
    snapshot() {
      return {
        left: !!(keys['KeyA'] || keys['ArrowLeft'] || touch.left),
        right: !!(keys['KeyD'] || keys['ArrowRight'] || touch.right),
        jump: !!(keys['KeyW'] || keys['Space'] || keys['ArrowUp'] || touch.jump),
        dash: !!(keys['ShiftLeft'] || keys['ShiftRight'] || touch.dash),
        attack: !!(keys['KeyJ'] || keys['KeyZ'] || touch.attack),
        shoot: !!(keys['KeyK'] || keys['KeyX'] || touch.shoot),
      };
    },
  };
}
