'use strict';
const $ = id => document.getElementById(id), sc = $('scene'), g = sc.getContext('2d');
const B = 120, RW = 7, LN = 3.5, SL = 13, TAU = Math.PI * 2, PI = Math.PI;
const S = { mode: 'auto', ag: 'D', on: false, run: false, paused: false, x: LN, y: -70, h: 0, px: LN, py: -70, speed: 0, steer: 0, rpm: 0, gear: 0, clutch: 0, hb: false, belt: false, sL: false, sR: false, haz: false, lights: false, wipers: false, horn: false, score: 100, time: 0, blink: 0, shake: 0, flash: 0, lastL: -99, tSp: 0, tLane: 0, minSp: 99, inZ: false, ent: null };
const keys = {}, cars = [], parts = [], cd = {}, done = {};
const hs = (a, b, c = 0) => { const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return n - Math.floor(n); };
const K = { 1: 130, 2: 75, 3: 52, 4: 39, 5: 31, R: 110 }, AC_ = { 1: 14, 2: 9, 3: 6, 4: 4.5, 5: 3.5, R: 6 };
const angd = (a, b) => ((a - b + PI) % TAU + TAU) % TAU - PI;
/* типи авто: w,l,b(верх кузова),t(верх кабіни),a,c(частка довжини кабіни),v(швидкість м/с) */
const TY = [{ w: 1.8, l: 4.5, b: .95, t: 1.45, a: .2, c: .7, v: 12 }, { w: 1.75, l: 3.9, b: .95, t: 1.5, a: .12, c: .92, v: 12 }, { w: 1.95, l: 4.7, b: 1.15, t: 1.8, a: .1, c: .92, v: 11 }, { w: 2, l: 5.3, b: 2.1, t: 0, v: 10 }, { w: 2.5, l: 11, b: 3.1, t: 0, v: 7 }, { w: 2.4, l: 8, b: 3.2, t: 0, v: 7.5 }, { w: 1.8, l: 4.5, b: .95, t: 1.45, a: .2, c: .7, v: 13, taxi: 1 }, { w: 1.85, l: 4.6, b: .95, t: 1.45, a: .2, c: .7, v: 13, police: 1 }];
const TPICK = [0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 7];
const COLS = [[190, 40, 40], [40, 100, 190], [230, 200, 50], [225, 225, 225], [50, 150, 80], [60, 60, 70], [150, 80, 170], [230, 130, 40]];
const BCOLS = [[200, 185, 150], [190, 130, 110], [160, 175, 195], [215, 215, 205], [150, 150, 160]];

/* ---------- правила міста ---------- */
function rule(i, j, ax) { const k = ((i * 3 + j * 5) % 7 + 7) % 7; if (k < 3) return 'light'; if (k < 5) return ax === 'v' ? 'stop' : 'prio'; if (k === 5) return ax === 'h' ? 'stop' : 'prio'; return ax === 'h' ? 'yield' : 'prio'; }
function lightSt(i, j, ax) { const p = (S.time + (((i * 5 + j * 3) % 24) + 24) % 24) % 24; return ax === 'v' ? (p < 10 ? 'g' : p < 12 ? 'y' : 'r') : (p < 12 ? 'r' : p < 22 ? 'g' : 'y'); }
function laneOf(ax, dir, idx) { return ax === 'v' ? idx * B + (dir > 0 ? LN : -LN) : idx * B + (dir > 0 ? -LN : LN); }
function inBay(x, y) { const i = Math.round(x / B), j = Math.floor(y / B), rx = x - i * B, ry = y - j * B; if (rx > RW + .5 && rx < RW + 6.5 && ry >= 25 && ry <= 38 && hs(i, j, 1) > .6) return i + ',' + j; return null; }
function onBuilding(x, y) { const mx = ((x % B) + B) % B, my = ((y % B) + B) % B; return Math.min(mx, B - mx) > RW + 12 && Math.min(my, B - my) > RW + 12; }
const onRoad = (x, y) => { const mx = ((x % B) + B) % B, my = ((y % B) + B) % B; return Math.min(mx, B - mx) < RW || Math.min(my, B - my) < RW; };
const night = () => Math.max(0, Math.min(1, -Math.sin(S.time * TAU / 240) * 2));
const raining = () => Math.sin(S.time / 31 + 1) > .75;

/* ---------- питання ---------- */
const QZ = {
  light: { q: 'Що означає жовтий сигнал світлофора?', o: ['Можна проїжджати без обмежень', 'Забороняє рух (за винятком випадку, коли зупинка неможлива без екстреного гальмування)', 'Дозволяє рух лише прямо'], a: 1, e: 'Жовтий забороняє рух, але якщо зупинитись можна лише різко — проїжджай.' },
  stop: { q: 'Що вимагає знак «Стоп»?', o: ['Зменшити швидкість і їхати далі', 'Зупинитись перед стоп-лінією та дати дорогу', 'Дати дорогу лише при наявності авто'], a: 1, e: 'Зупинка обов\'язкова перед стоп-лінією, навіть якщо дорога вільна.' },
  yield: { q: 'Що означає знак «Дати дорогу»?', o: ['Обов\'язково зупинитись', 'Поступитись транспорту на головній дорозі', 'Увімкнути аварійку'], a: 1, e: 'Треба дати дорогу транспорту на головній дорозі, зупинка — якщо потрібно.' },
  prio: { q: 'Що означає жовтий ромб з білою рамкою?', o: ['Головна дорога', 'Кінець населеного пункту', 'Небезпечний поворот'], a: 0, e: 'Знак «Головна дорога» дає перевагу на перехрестях.' },
  left: { q: 'Виконуючи лівий поворот на перехресті, водій повинен дати дорогу:', o: ['Лише пішоходам', 'Зустрічним авто, що їдуть прямо або праворуч', 'Нікому'], a: 1, e: 'Лівий поворот: поступись зустрічному транспорту, що їде прямо чи праворуч.' },
  uturn: { q: 'Розворот дозволено:', o: ['Де це не заборонено знаками, і він безпечний', 'Лише на перехрестях зі світлофором', 'Лише вночі'], a: 0, e: 'Розворот можна там, де не заборонено знаком/розміткою, і лише коли він безпечний.' },
  over: { q: 'Перед обгоном водій зобов\'язаний:', o: ['Увімкнути лівий поворотник і переконатися в безпеці', 'Просигналити і прискоритись', 'Увімкнути аварійку'], a: 0, e: 'Обгін починають з лівого поворотника і оцінки безпеки.' },
  park: { q: 'Що означає синій квадрат з літерою P?', o: ['Місце стоянки', 'Паркування заборонено', 'Автостанція'], a: 0, e: 'Знак «Місце стоянки» — тут дозволено паркування.' }
};

/* ---------- службові ---------- */
function can(k, t) { if ((cd[k] || 0) > S.time) return false; cd[k] = S.time + t; return true; }
let tt; function toast(m, c) { const T = $('toast'); T.textContent = m; T.className = c || ''; clearTimeout(tt); tt = setTimeout(() => T.textContent = '', 3500); }
function fine(n, msg, key, t) {
  if (key && !can(key, t)) return;
  S.score -= n; toast('−' + n + ' ' + msg, 'bad'); $('score').textContent = 'Бали: ' + S.score;
  if (S.score <= 0 && S.run) { S.run = false; $('end').hidden = false; }
}
function showQuiz(k) {
  const q = QZ[k]; if (!q || !S.run || S.paused || !can('quiz', 25)) return;
  setTimeout(() => {
    if (!S.run) return; S.paused = true; $('qq').textContent = q.q; $('qe').textContent = ''; $('qc').hidden = true;
    const box = $('qo'); box.innerHTML = '';
    q.o.forEach((t, i) => {
      const b = document.createElement('button'); b.textContent = t;
      b.onclick = () => {
        [...box.children].forEach((x, j) => { x.disabled = true; if (j === q.a) x.classList.add('right'); });
        if (i === q.a) { S.score += 5; $('qe').textContent = '✅ Правильно! +5 балів. ' + q.e; } else { S.score -= 5; b.classList.add('wrong'); $('qe').textContent = '❌ Неправильно, −5 балів. ' + q.e; }
        $('score').textContent = 'Бали: ' + S.score; $('qc').hidden = false;
      };
      box.appendChild(b);
    });
    $('qc').onclick = () => { $('quiz').hidden = true; S.paused = false; if (S.score <= 0) { S.run = false; $('end').hidden = false; } };
    $('quiz').hidden = false;
  }, 600);
}

/* ---------- керування ---------- */
function setGear(v) {
  if (S.mode !== 'manual') return;
  if (v === -1 && Math.abs(S.speed) > 3) { toast('Задню передачу вмикай лише на зупинці', 'bad'); return; }
  if (S.on && S.clutch < .7 && v !== S.gear) { fine(1, 'Скрегіт коробки! Стисни зчеплення (Shift)', 'gr', 2); return; }
  S.gear = v;
}
function engine() {
  if (S.on) { S.on = false; toast('Двигун вимкнено'); return; }
  if (S.mode === 'manual' && S.gear !== 0 && S.clutch < .7) { toast('Вибери N (0) або стисни зчеплення (Shift)', 'bad'); return; }
  S.on = true; S.rpm = 900; toast('Двигун запущено', 'ok');
}
function act(a) {
  if (a === 'engine') engine();
  else if (a === 'sL') { S.sL = !S.sL; if (S.sL) S.sR = false; }
  else if (a === 'sR') { S.sR = !S.sR; if (S.sR) S.sL = false; }
  else if (a === 'belt') { S.belt = !S.belt; toast(S.belt ? 'Ремінь пристебнуто' : 'Ремінь відстебнуто'); }
  else if (a === 'hb') { S.hb = !S.hb; toast(S.hb ? 'Ручник піднято' : 'Ручник опущено'); }
  else S[a] = !S[a];
}
document.querySelectorAll('[data-a]').forEach(b => {
  if (b.dataset.a === 'horn') { b.onpointerdown = () => S.horn = true; b.onpointerup = b.onpointerleave = () => S.horn = false; } else b.onclick = () => act(b.dataset.a);
});
const MAP = { KeyW: 'ArrowUp', KeyS: 'ArrowDown', KeyA: 'ArrowLeft', KeyD: 'ArrowRight' };
addEventListener('keydown', e => {
  keys.Shift = e.shiftKey; const c = e.code;
  if (c.startsWith('Arrow') || c === 'Space') e.preventDefault();
  if (MAP[c]) keys[MAP[c]] = true; if (c.startsWith('Arrow')) keys[c] = true;
  if (e.repeat) return;
  const man = S.mode === 'manual';
  if (c === 'Space') act('hb'); else if (c === 'KeyI' || c === 'Enter') act('engine');
  else if (c === 'KeyQ') act('sL'); else if (c === 'KeyE') act('sR'); else if (c === 'KeyH') act('haz');
  else if (c === 'KeyL') act('lights'); else if (c === 'KeyV') act('wipers'); else if (c === 'KeyB') act('belt'); else if (c === 'KeyC') S.horn = true;
  else if (man && /^Digit[0-5]$/.test(c)) setGear(+c[5]); else if (man && c === 'KeyR') setGear(-1);
});
addEventListener('keyup', e => { keys.Shift = e.shiftKey; if (MAP[e.code]) keys[MAP[e.code]] = false; if (e.code.startsWith('Arrow')) keys[e.code] = false; if (e.code === 'KeyC') S.horn = false; });

/* ---------- звук ---------- */
let AC, osc, gn, hosc, hgn;
function audioInit() {
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    osc = AC.createOscillator(); osc.type = 'sawtooth'; gn = AC.createGain(); gn.gain.value = 0; osc.connect(gn); gn.connect(AC.destination); osc.start();
    hosc = AC.createOscillator(); hosc.type = 'square'; hosc.frequency.value = 420; hgn = AC.createGain(); hgn.gain.value = 0; hosc.connect(hgn); hgn.connect(AC.destination); hosc.start();
  } catch (e) { }
}
function thud() { if (!AC) return; try { const o = AC.createOscillator(), v = AC.createGain(); o.type = 'sawtooth'; o.frequency.value = 70; v.gain.setValueAtTime(.3, AC.currentTime); v.gain.exponentialRampToValueAtTime(.001, AC.currentTime + .5); o.connect(v); v.connect(AC.destination); o.start(); o.stop(AC.currentTime + .5); } catch (e) { } }

/* ---------- ДТП / частинки ---------- */
function burst(x, y, n) { for (let k = 0; k < n; k++) parts.push({ x, y, z: .5 + Math.random() * .6, vx: (Math.random() - .5) * 9, vy: (Math.random() - .5) * 9, vz: Math.random() * 5, l: 1 + Math.random() * 1.5, m: 2.5, s: Math.random() < .45 }); }
function circles(a) { const s = Math.sin(a.h), c = Math.cos(a.h), r = a.w * .6; return [-.33, 0, .33].map(k => [a.x + s * a.l * k, a.y + c * a.l * k, r]); }
function hit(a, b) { if (Math.hypot(a.x - b.x, a.y - b.y) > (a.l + b.l) / 2 + 1) return false; for (const p of circles(a)) for (const q of circles(b)) if (Math.hypot(p[0] - q[0], p[1] - q[1]) < p[2] + q[2]) return true; return false; }
function crashCar(c) { if (c.cr) return; c.cr = true; c.crt = 9; c.v = 0; c.brake = false; }

/* ---------- ШІ транспорт ---------- */
function newCar(first) {
  for (let t = 0; t < 14; t++) {
    const ax = Math.random() < .5 ? 'v' : 'h', dir = Math.random() < .5 ? 1 : -1;
    const p = (ax === 'v' ? S.y : S.x) + (Math.random() < .5 ? -1 : 1) * ((first ? 40 : 140) + Math.random() * 120);
    const idx = Math.round((ax === 'v' ? S.x : S.y) / B) + ((Math.random() * 5 | 0) - 2), m = ((p % B) + B) % B;
    if (Math.min(m, B - m) < 30) continue;
    const L = laneOf(ax, dir, idx), x = ax === 'v' ? L : p, y = ax === 'v' ? p : L;
    if (Math.hypot(x - S.x, y - S.y) < 40) continue;
    if (cars.some(o => Math.hypot(o.x - x, o.y - y) < 16)) continue;
    const ty = TPICK[Math.random() * TPICK.length | 0], T = TY[ty];
    const nx = dir > 0 ? Math.ceil(p / B) : Math.floor(p / B);
    cars.push({ ty, w: T.w, l: T.l, col: COLS[Math.random() * COLS.length | 0], cv: T.v + Math.random() * 2, x, y, h: ax === 'v' ? (dir > 0 ? 0 : PI) : (dir > 0 ? PI / 2 : -PI / 2), v: 0, axis: ax, dir, L, ni: ax === 'v' ? idx : nx, nj: ax === 'v' ? nx : idx, mode: 'lane', plan: pick(), go: false, wt: 0 });
    return;
  }
}
const pick = () => { const r = Math.random(); return r < .6 ? 's' : r < .85 ? 'r' : 'l'; };
function busy(i, j, me, left) {
  const cx = i * B, cy = j * B;
  for (const o of cars.concat([PL()])) {
    if (o === me) continue; const dx = o.x - cx, dy = o.y - cy, dc = Math.hypot(dx, dy);
    if (dc < RW + 4 && (o.cr || o.v > .3 || o.mode === 'turn')) return true;
    if (dc < 35 && o.v > 3 && (cx - o.x) * Math.sin(o.h) + (cy - o.y) * Math.cos(o.h) > 0) { const dh = Math.abs(angd(o.h, me.h)); if (dh > .8 && dh < 2.4) return true; if (left && dh >= 2.4) return true; }
  }
  return false;
}
const PL = () => ({ x: S.x, y: S.y, h: S.h, v: Math.abs(S.speed) / 3.6, l: 4.5, w: 1.8, player: true });
function startTurn(c) {
  const cx = c.ni * B, cy = c.nj * B, nh = c.plan === 's' ? c.h : c.h + (c.plan === 'r' ? PI / 2 : -PI / 2);
  const ax = Math.abs(Math.sin(nh)) > .5 ? 'h' : 'v', dir = ax === 'h' ? Math.sign(Math.sin(nh)) : Math.sign(Math.cos(nh));
  const L2 = laneOf(ax, dir, ax === 'v' ? c.ni : c.nj);
  const P0 = [c.x, c.y], P2 = ax === 'v' ? [L2, cy + dir * RW] : [cx + dir * RW, L2];
  let P1 = [(P0[0] + P2[0]) / 2, (P0[1] + P2[1]) / 2];
  if (c.plan !== 's') P1 = c.axis === 'v' ? [c.L, L2] : [L2, c.L];
  c.bz = [P0, P1, P2]; c.t = 0; c.len = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]) + Math.hypot(P2[0] - P1[0], P2[1] - P1[1]) + .01; c.nax = ax; c.ndir = dir; c.nL = L2; c.nh = nh; c.mode = 'turn';
}
function aiStep(c, dt, veh) {
  if (c.cr) { c.crt -= dt; if (Math.random() < dt * 8) parts.push({ x: c.x, y: c.y, z: 1, vx: 0, vy: 0, vz: 1.3, l: 2, m: 2.5, s: false }); return; }
  let vt = c.cv, stop = false;
  const fx = Math.sin(c.h), fy = Math.cos(c.h), rx = Math.cos(c.h), ry = -Math.sin(c.h);
  for (const o of veh) { if (o === c) continue; const dx = o.x - c.x, dy = o.y - c.y, f = dx * fx + dy * fy, r = dx * rx + dy * ry; if (f > 0 && f < 35 && Math.abs(r) < 2.4) vt = Math.min(vt, Math.max(0, f - (c.l + o.l) / 2 - 3) * .9); }
  if (c.mode === 'lane') {
    const dist = c.axis === 'v' ? (c.nj * B - c.y) * c.dir : (c.ni * B - c.x) * c.dir, ds = dist - (SL + c.l / 2 + .5), r = rule(c.ni, c.nj, c.axis);
    if (c.plan !== 's') vt = Math.min(vt, 8);
    if (ds > -3) {
      if (r === 'light') { const st = lightSt(c.ni, c.nj, c.axis); if (st === 'r' || (st === 'y' && ds > c.v * c.v / 8 + 2)) stop = true; }
      if ((r === 'stop' || r === 'yield') && !c.go) { stop = true; if (ds < 1 && c.v < .4) { c.wt += dt; if (c.wt > (r === 'stop' ? 1 : .2) && !busy(c.ni, c.nj, c, c.plan === 'l')) { c.go = true; c.wt = 0; } } }
      if (c.plan === 'l' && ds < 3 && !c.go && r !== 'stop' && r !== 'yield' && busy(c.ni, c.nj, c, true)) stop = true;
      if (stop) vt = Math.min(vt, ds <= .3 ? 0 : Math.sqrt(2 * 3.5 * ds));
    }
    c.v += Math.max(-6 * dt, Math.min(2.2 * dt, vt - c.v)); c.brake = vt < c.v - .3 || stop && c.v < 2;
    if (c.axis === 'v') c.y += c.dir * c.v * dt; else c.x += c.dir * c.v * dt;
    if (dist <= RW) startTurn(c);
  } else {
    vt = Math.min(vt, c.plan === 's' ? c.cv : 6.5); c.v += Math.max(-6 * dt, Math.min(2.2 * dt, vt - c.v)); c.brake = false;
    c.t = Math.min(1, c.t + c.v * dt / c.len); const [P0, P1, P2] = c.bz, t = c.t, u = 1 - t;
    c.x = u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0]; c.y = u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1];
    const dx = 2 * u * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]), dy = 2 * u * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]); if (dx || dy) c.h = Math.atan2(dx, dy);
    if (c.t >= 1) { const ci = c.ni, cj = c.nj; c.mode = 'lane'; c.axis = c.nax; c.dir = c.ndir; c.L = c.nL; c.h = c.nh; c.ni = c.axis === 'v' ? ci : ci + c.dir; c.nj = c.axis === 'v' ? cj + c.dir : cj; c.plan = pick(); c.go = false; c.wt = 0; }
  }
}

/* ---------- фізика гравця ---------- */
function update(dt) {
  S.time += dt; S.blink = (S.blink + dt) % .9; S.shake = Math.max(0, S.shake - dt * 1.5); S.flash = Math.max(0, S.flash - dt * 2.5);
  const man = S.mode === 'manual', up = keys.ArrowUp ? 1 : 0, dn = keys.ArrowDown ? 1 : 0;
  let thr, br, d;
  if (man) { thr = up; br = dn; d = S.gear === -1 ? -1 : S.gear > 0 ? 1 : 0; const t = keys.Shift ? 1 : 0; S.clutch += (t - S.clutch) * Math.min(1, dt * (t > S.clutch ? 12 : 2.5)); }
  else { if (dn && S.speed < .5 && !up) S.ag = 'R'; if (up && S.speed > -.5) S.ag = 'D'; thr = S.ag === 'D' ? up : dn; br = S.ag === 'D' ? dn : up; d = S.ag === 'R' ? -1 : 1; S.clutch = 0; S.gear = S.ag; }
  const sp = Math.abs(S.speed), eng = 1 - S.clutch;
  const gn_ = man ? (S.gear === -1 ? 'R' : S.gear) : S.ag === 'R' ? 'R' : sp < 22 ? 1 : sp < 42 ? 2 : sp < 65 ? 3 : sp < 95 ? 4 : 5, wr = d ? sp * K[gn_] : 0;
  let drive = 0;
  if (S.on) {
    const free = 900 + thr * 5600;
    const tg = d ? (man ? free + (wr - free) * Math.max(0, (eng - .3) / .7) : Math.max(900 + thr * 900, wr)) : free;
    S.rpm += (tg - S.rpm) * Math.min(1, dt * 7);
    if (man && d && eng > .92 && wr < 550) { S.on = false; toast('Двигун заглох! Стисни зчеплення й запусти (I)', 'bad'); }
    const f = man ? Math.min(1, Math.max(0, (eng - .25) / .35)) : 1;
    if (d && S.rpm < 6600 && !S.hb) drive = thr * AC_[gn_] * f * (.55 + .45 * Math.min(1, S.rpm / 2500));
    if (S.hb && thr && d && eng > .5 && can('hbw', 4)) toast('Ручник піднято! Опусти його (Пробіл)', 'bad');
  } else S.rpm += (0 - S.rpm) * Math.min(1, dt * 4);
  let a = d * drive;
  if (!man && S.on && !thr && !br && !S.hb && sp < 6 && S.ag === 'D') a += 3.5;
  let dec = 1.5 + sp * .03 + br * 38 + (S.hb ? 30 : 0);
  if (d && eng > .5 && !thr) dec += S.on ? (man ? 3 : 1) : 20;
  if (!onRoad(S.x, S.y) && !inBay(S.x, S.y)) dec += 12;
  S.speed += a * dt; S.speed -= Math.sign(S.speed) * Math.min(dec * dt, Math.abs(S.speed));
  if (S.speed < -15) S.speed = -15; if (d >= 0 && S.speed < 0 && man) S.speed = 0;
  const v = S.speed / 3.6, ts = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
  S.steer += (ts - S.steer) * Math.min(1, dt * (ts ? 3 : 5));
  S.h += v / 2.7 * Math.tan(S.steer * .6 * (1 - Math.min(.65, Math.abs(v) / 30))) * dt;
  S.px = S.x; S.py = S.y; S.x += Math.sin(S.h) * v * dt; S.y += Math.cos(S.h) * v * dt;
  if (S.sL) S.lastL = S.time;
  if (onBuilding(S.x, S.y)) { S.x = S.px; S.y = S.py; burst(S.x + Math.sin(S.h) * 2, S.y + Math.cos(S.h) * 2, 25); S.speed = -S.speed * .3; S.shake = 1; S.flash = 1; thud(); fine(10, 'Зіткнення з будівлею!', 'bld', 2); }
  // ШІ
  while (cars.length < 15) newCar(cars.length < 12 && !S.started);
  S.started = true;
  const veh = cars.concat([PL()]);
  for (let i = cars.length - 1; i >= 0; i--) { const c = cars[i]; aiStep(c, dt, veh); if (c.crt < 0 || Math.hypot(c.x - S.x, c.y - S.y) > 340) cars.splice(i, 1); }
  for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) { const a2 = cars[i], b2 = cars[j]; if ((!a2.cr || !b2.cr) && hit(a2, b2)) { crashCar(a2); crashCar(b2); burst((a2.x + b2.x) / 2, (a2.y + b2.y) / 2, 22); thud(); } }
  const me = PL(), fx = Math.sin(S.h), fy = Math.cos(S.h), rx = Math.cos(S.h), ry = -Math.sin(S.h);
  for (const c of cars) {
    if (hit(me, c) && can('crash', 1.2)) {
      const ex = c.x - S.x, ey = c.y - S.y; crashCar(c); burst((c.x + S.x) / 2, (c.y + S.y) / 2, 30); S.shake = 1; S.flash = 1; thud();
      S.speed = -S.speed * .3; S.x -= Math.sign(ex) * .8; S.y -= Math.sign(ey) * .8; fine(15, 'ДТП! Зіткнення з авто!');
    }
    const dx = c.x - S.x, dy = c.y - S.y, f = dx * fx + dy * fy, r = dx * rx + dy * ry;
    if (c.pf > 0 && f <= 0 && Math.abs(angd(c.h, S.h)) < .6 && r > 2.5 && r < 7 && S.time - S.lastL < 9 && sp > 5 && can('ovt', 10)) { S.score += 5; $('score').textContent = 'Бали: ' + S.score; toast('Обгін виконано правильно! +5', 'ok'); showQuiz('over'); }
    c.pf = f;
  }
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.s) p.vz -= 9 * dt; else { p.vx *= .98; p.vy *= .98; } p.l -= dt; if (p.l <= 0 || p.z < 0) parts.splice(i, 1); }
  rules(dt, sp);
  if (S.sL || S.sR || S.haz) { if (S.blink < dt && AC) { } }
}
function rules(dt, sp) {
  const i = Math.round(S.x / B), j = Math.round(S.y / B), cx = i * B, cy = j * B, dxz = Math.abs(S.x - cx), dyz = Math.abs(S.y - cy);
  const inZ = dxz < RW && dyz < RW, dc = Math.hypot(S.x - cx, S.y - cy);
  if (!inZ && dc < 32) S.minSp = Math.min(S.minSp, sp);
  if (inZ && !S.inZ) {
    const ax = Math.abs(S.py - cy) > Math.abs(S.px - cx) ? 'v' : 'h', rl = rule(i, j, ax);
    S.ent = { i, j, h: S.h, sL: S.sL, sR: S.sR, rl };
    if (rl === 'light' && lightSt(i, j, ax) === 'r' && sp > 5) fine(10, 'Проїзд на червоне світло!');
    if (rl === 'stop' && S.minSp > 2) fine(10, 'Не зупинився перед знаком «Стоп»!');
  }
  if (!inZ && S.inZ && S.ent) {
    const dl = angd(S.h, S.ent.h);
    if (Math.abs(dl) > .7) { if (!(dl > 0 ? S.ent.sR : S.ent.sL)) fine(5, 'Поворот без поворотника!'); S.sL = S.sR = false; }
    showQuiz(Math.abs(dl) > 2.4 ? 'uturn' : dl < -.7 ? 'left' : S.ent.rl);
    S.minSp = 99; S.ent = null;
  }
  S.inZ = inZ;
  if (!inZ && sp > 3) {
    let wrong = false;
    if (dxz < RW) { if (Math.abs(Math.cos(S.h)) > .7) wrong = (S.x - cx) * Math.sign(Math.cos(S.h)) < -.2; }
    else if (dyz < RW) { if (Math.abs(Math.sin(S.h)) > .7) wrong = (S.y - cy) * -Math.sign(Math.sin(S.h)) < -.2; }
    if (wrong && !(S.sL || S.time - S.lastL < 6)) { S.tLane += dt; if (S.tLane > 1.5) fine(5, 'Рух по зустрічній смузі!', 'ln', 6); } else S.tLane = 0;
  }
  if (!onRoad(S.x, S.y) && !inBay(S.x, S.y) && sp > 3) fine(5, 'Рух по тротуару!', 'sw', 4);
  if (sp > 60) { S.tSp += dt; if (S.tSp > 3) fine(5, 'Перевищення швидкості (у місті 50)!', 'sp', 5); } else S.tSp = 0;
  if (sp > 5 && !S.belt) fine(2, 'Пристебни ремінь!', 'belt', 10);
  if (night() > .5 && !S.lights && sp > 10) fine(3, 'Увімкни ближнє світло (L)!', 'lt', 10);
  if (raining() && !S.wipers && sp > 10 && can('wp', 20)) toast('Дощ! Увімкни двірники (V)');
  const bay = inBay(S.x, S.y);
  if (bay && sp < 1 && S.hb && !done[bay]) { done[bay] = 1; S.score += 10; $('score').textContent = 'Бали: ' + S.score; toast('Припарковано! +10', 'ok'); showQuiz('park'); }
}

/* ---------- 3D рендер ---------- */
let CX, CY, CZ, SIN, COS, FOC, W2, HOR, X, L;
function proj(P) {
  const t = P.map(p => { const dx = p[0] - CX, dy = p[1] - CY; return [dx * COS - dy * SIN, p[2] - CZ, dx * SIN + dy * COS]; }), o = [];
  for (let i = 0; i < t.length; i++) { const a = t[i], b = t[(i + 1) % t.length], ai = a[2] >= .2, bi = b[2] >= .2; if (ai) o.push(a); if (ai !== bi) { const k = (.2 - a[2]) / (b[2] - a[2]); o.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, .2]); } }
  return o.length < 3 ? null : o.map(p => [W2 + p[0] / p[2] * FOC, HOR - p[1] / p[2] * FOC]);
}
function fill(p, c) { X.fillStyle = c; X.beginPath(); p.forEach((q, k) => k ? X.lineTo(q[0], q[1]) : X.moveTo(q[0], q[1])); X.fill(); }
const flat = (P, c) => { const p = proj(P); if (p) fill(p, c); };
const rect = (x0, y0, x1, y1, c, z = 0) => flat([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], c);
function fogc(rgb, sh, d) { const t = Math.min(1, d / 360) ** 1.4, f = [185, 210, 235]; return 'rgb(' + rgb.map((v, k) => Math.round(v * sh * (1 - t) + f[k] * t)) + ')'; }
function box(cx, cy, yw, w, l, z0, z1, rgb, bias) {
  const s = Math.sin(yw), c = Math.cos(yw), hw = w / 2, hl = l / 2;
  const C = (a, b) => [cx + c * a * hw + s * b * hl, cy - s * a * hw + c * b * hl];
  for (const [p, q, nx, ny] of [[[-1, 1], [1, 1], s, c], [[1, 1], [1, -1], c, -s], [[1, -1], [-1, -1], -s, -c], [[-1, -1], [-1, 1], -c, s]]) {
    const a = C(...p), b = C(...q), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if ((CX - mx) * nx + (CY - my) * ny <= 0) continue;
    const pp = proj([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]]); if (!pp) continue;
    const d = Math.hypot(CX - mx, CY - my) + bias; L.push({ d, p: pp, c: fogc(rgb, .75 + .25 * (nx * .5 + ny * .8), d) });
  }
}
function bill(wx, wy, wz, fn) { const dx = wx - CX, dy = wy - CY, f = dx * SIN + dy * COS; if (f < .8 || f > 260) return; const r = dx * COS - dy * SIN, k = FOC / f; L.push({ d: f, f: () => fn(W2 + r * k, HOR + (CZ - wz) * k, k) }); }
function circ(x, y, r, c) { X.fillStyle = c; X.beginPath(); X.arc(x, y, r, 0, 7); X.fill(); }
function txt(t, x, y, s, c) { X.fillStyle = c; X.font = 'bold ' + s + 'px sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(t, x, y); }
function sign(t, x, y, k) {
  const r = .42 * k, h = 2.4 * k; if (r < 1.5) return;
  X.fillStyle = '#888'; X.fillRect(x - r * .06, y - h, r * .12, h); const cy = y - h - r * .3;
  if (t === 'limit50') { circ(x, cy, r, '#d00'); circ(x, cy, r * .72, '#fff'); txt('50', x, cy, r * .85, '#000'); }
  else if (t === 'stop') { X.fillStyle = '#d00'; X.beginPath(); for (let q = 0; q < 8; q++) { const a = PI / 8 + q * PI / 4; X.lineTo(x + Math.cos(a) * r * 1.08, cy + Math.sin(a) * r * 1.08); } X.fill(); txt('STOP', x, cy, r * .6, '#fff'); }
  else if (t === 'yield') { X.fillStyle = '#d00'; X.beginPath(); X.moveTo(x - r * 1.1, cy - r * .85); X.lineTo(x + r * 1.1, cy - r * .85); X.lineTo(x, cy + r); X.fill(); X.fillStyle = '#fff'; X.beginPath(); X.moveTo(x - r * .6, cy - r * .5); X.lineTo(x + r * .6, cy - r * .5); X.lineTo(x, cy + r * .5); X.fill(); }
  else if (t === 'prio') { X.fillStyle = '#fff'; X.beginPath(); X.moveTo(x, cy - r * 1.3); X.lineTo(x + r * 1.3, cy); X.lineTo(x, cy + r * 1.3); X.lineTo(x - r * 1.3, cy); X.fill(); X.fillStyle = '#f5c400'; X.beginPath(); X.moveTo(x, cy - r); X.lineTo(x + r, cy); X.lineTo(x, cy + r); X.lineTo(x - r, cy); X.fill(); }
  else if (t === 'cross') { X.fillStyle = '#1b5fd0'; X.fillRect(x - r, cy - r, r * 2, r * 2); X.fillStyle = '#fff'; X.beginPath(); X.moveTo(x - r * .75, cy + r * .75); X.lineTo(x + r * .75, cy + r * .75); X.lineTo(x, cy - r * .75); X.fill(); txt('🚶', x, cy + r * .2, r * .8, '#000'); }
  else if (t === 'nopark') { circ(x, cy, r, '#1b5fd0'); circ(x, cy, r * .85, '#d00'); circ(x, cy, r * .75, '#1b5fd0'); X.strokeStyle = '#d00'; X.lineWidth = r * .18; X.beginPath(); X.moveTo(x - r * .6, cy - r * .6); X.lineTo(x + r * .6, cy + r * .6); X.moveTo(x + r * .6, cy - r * .6); X.lineTo(x - r * .6, cy + r * .6); X.stroke(); }
  else if (t === 'parking') { X.fillStyle = '#1b5fd0'; X.fillRect(x - r, cy - r, r * 2, r * 2); txt('P', x, cy, r * 1.4, '#fff'); }
}
function lightB(st, x, y, k) {
  const w = .22 * k, h = 3.4 * k; if (w < 1) return; X.fillStyle = '#555'; X.fillRect(x - w * .1, y - h, w * .2, h); X.fillStyle = '#111'; X.fillRect(x - w, y - h - w * 3.2, w * 2, w * 6);
  circ(x, y - h - w * 2.2, w * .7, st === 'r' ? '#f22' : '#400'); circ(x, y - h, w * .7, st === 'y' ? '#fd0' : '#440'); circ(x, y - h + w * 2.2, w * .7, st === 'g' ? '#2f4' : '#040');
}
function carItems(c, mini) {
  const T = TY[c.ty], s = Math.sin(c.h), co = Math.cos(c.h);
  let col = c.col; if (T.taxi) col = [235, 200, 30]; if (T.police) col = [235, 235, 240];
  box(c.x, c.y, c.h, c.w * .8, c.l * .9, .15, .45, [20, 20, 22], 0);
  box(c.x, c.y, c.h, c.w, c.l, .35, T.b, col, -.3);
  if (T.t) { const m = c.l * ((T.a + T.c) / 2 - .5); box(c.x + s * m, c.y + co * m, c.h, c.w * .88, c.l * (T.c - T.a), T.b, T.t, [60, 75, 95], -.6); }
  if (T.taxi) box(c.x, c.y, c.h, .5, .3, T.t, T.t + .2, [250, 250, 200], -.8);
  if (T.police) box(c.x, c.y, c.h, .7, .25, T.t, T.t + .18, [30, 80, 230], -.8);
  if (T.t === 0 && T.l > 7) box(c.x + s * c.l * .46, c.y + co * c.l * .46, c.h, c.w * .9, .1, 1.2, T.b - .3, [70, 90, 110], -.5);
  const lc = (sx, sy, front) => { const px = c.x + s * c.l / 2 * sy + co * sx * c.w * .38, py = c.y + co * c.l / 2 * sy - s * sx * c.w * .38; box(px, py, c.h, .35, .12, .5, .75, front ? [255, 250, 200] : (c.brake ? [255, 40, 40] : [150, 20, 20]), -1); };
  lc(-1, 1, true); lc(1, 1, true); lc(-1, -1, false); lc(1, -1, false);
}
function render(cx2, w, h, cam, foc, mini) {
  X = cx2; CX = cam.x; CY = cam.y; CZ = cam.z; SIN = Math.sin(cam.yaw); COS = Math.cos(cam.yaw); FOC = foc; W2 = w / 2; HOR = h * .5; L = [];
  const R = mini ? 2 : 4, ci = Math.round(CX / B), cj = Math.round(CY / B);
  const sk = X.createLinearGradient(0, 0, 0, HOR); sk.addColorStop(0, '#4f9be8'); sk.addColorStop(1, '#c4e4ff'); X.fillStyle = sk; X.fillRect(0, 0, w, HOR);
  X.fillStyle = '#6a7a64'; X.fillRect(0, HOR, w, h - HOR);
  for (let i = ci - R; i < ci + R; i++) for (let j = cj - R; j < cj + R; j++) {
    const x0 = i * B + RW, x1 = (i + 1) * B - RW, y0 = j * B + RW, y1 = (j + 1) * B - RW;
    rect(x0, y0, x1, y1, '#a4a4a4'); rect(x0 + 12, y0 + 12, x1 - 12, y1 - 12, '#5f8f4e', .01);
  }
  for (let i = ci - R; i <= ci + R; i++) rect(i * B - RW, CY - 360, i * B + RW, CY + 360, '#4b4b50', .02);
  for (let j = cj - R; j <= cj + R; j++) rect(CX - 360, j * B - RW, CX + 360, j * B + RW, '#4b4b50', .02);
  if (!mini) {
    for (let i = ci - 2; i <= ci + 2; i++) for (let j = cj - 2; j <= cj + 2; j++) {
      const cx = i * B, cy = j * B, dd = Math.hypot(cx - CX, cy - CY);
      for (const e of [-1, 1]) { rect(cx + e * (RW - .5) - .15, cy + RW, cx + e * (RW - .5) + .15, cy + B - RW, '#eee', .03); rect(cx + RW, cy + e * (RW - .5) - .15, cx + B - RW, cy + e * (RW - .5) + .15, '#eee', .03); }
      for (let t = SL + 2; t < B - SL - 2; t += 8) { rect(cx - .1, cy + t, cx + .1, cy + t + 3, '#fff', .03); rect(cx + t, cy - .1, cx + t + 3, cy + .1, '#fff', .03); }
      if (dd < 120) {
        for (let q = 0; q < 4; q++) {
          const hd = q * PI / 2, dx = Math.sin(hd), dy = Math.cos(hd), rx = Math.cos(hd), ry = -Math.sin(hd);
          const P = (a, b, z = .04) => [cx - dx * a + rx * b, cy - dy * a + ry * b, z];
          flat([P(SL + .5, .2), P(SL + .5, 6.8), P(SL - .1, 6.8), P(SL - .1, .2)], '#fff');
          for (let s = -5; s < 5; s++) flat([P(RW + 2, s * 1.3 + .1), P(RW + 2, s * 1.3 + 1.1), P(RW + 5.5, s * 1.3 + 1.1), P(RW + 5.5, s * 1.3 + .1)], '#e8e8e8');
        }
      }
      const bj = hs(i, j, 1) > .6; if (bj && dd < 130) { rect(cx + RW + .5, cy + 25, cx + RW + 6.5, cy + 38, '#3a3a3e', .03); for (let k = 0; k <= 5; k++) rect(cx + RW + .5, cy + 25 + k * 2.6 - .08, cx + RW + 6.5, cy + 25 + k * 2.6 + .08, '#fff', .04); bill(cx + RW + .8, cy + 24, 0, (x, y, k) => sign('parking', x, y, k)); }
    }
  }
  for (let i = ci - R; i < ci + R; i++) for (let j = cj - R; j < cj + R; j++) {
    const mx = (i + .5) * B, my = (j + .5) * B; if (Math.hypot(mx - CX, my - CY) > (mini ? 170 : 340)) continue;
    const x0 = i * B + RW + 12, x1 = (i + 1) * B - RW - 12, y0 = j * B + RW + 12, y1 = (j + 1) * B - RW - 12, sp = hs(i, j, 2) > .5, m1 = hs(i, j, 3), m2 = hs(i, j, 4);
    const bc = BCOLS[(hs(i, j, 5) * 5) | 0], bc2 = BCOLS[(hs(i, j, 6) * 5) | 0];
    if (sp) { box((x0 + x1) / 2 - 20, my, 0, 36, y1 - y0, 0, 10 + m1 * 40, bc, 0); box((x0 + x1) / 2 + 20, my, 0, 36, y1 - y0, 0, 10 + m2 * 40, bc2, 0); }
    else { box(mx, (y0 + y1) / 2 - 20, 0, x1 - x0, 36, 0, 10 + m1 * 40, bc, 0); box(mx, (y0 + y1) / 2 + 20, 0, x1 - x0, 36, 0, 10 + m2 * 40, bc2, 0); }
  }
  for (const c of cars) { if (Math.hypot(c.x - CX, c.y - CY) < (mini ? 150 : 260)) carItems(c, mini); }
  if (!mini) {
    for (let i = ci - 2; i <= ci + 2; i++) for (let j = cj - 2; j <= cj + 2; j++) {
      const cx = i * B, cy = j * B;
      for (let q = 0; q < 4; q++) {
        const hd = q * PI / 2, dx = Math.sin(hd), dy = Math.cos(hd), rx = Math.cos(hd), ry = -Math.sin(hd), ax = Math.abs(dx) > .5 ? 'h' : 'v', rl = rule(i, j, ax);
        const px = cx - dx * (SL + 1) + rx * (RW + 1.2), py = cy - dy * (SL + 1) + ry * (RW + 1.2);
        if (rl === 'light') { const st = lightSt(i, j, ax), face = (CX - cx) * -dx + (CY - cy) * -dy > 0; bill(px, py, 0, (x, y, k) => lightB(face ? st : '', x, y, k)); }
        else bill(px, py, 0, (x, y, k) => sign(rl, x, y, k));
        const t2 = ['limit50', 'nopark', 'cross', 'limit50'][(hs(i, j, q) * 4) | 0];
        bill(cx - dx * (SL + 26) + rx * (RW + 1.2), cy - dy * (SL + 26) + ry * (RW + 1.2), 0, (x, y, k) => sign(t2, x, y, k));
      }
    }
    for (const p of parts) bill(p.x, p.y, p.z, (x, y, k) => { if (p.s) circ(x, y, .1 * k + .5, '#ffb030'); else { X.globalAlpha = Math.max(0, p.l / p.m); circ(x, y, (.3 + (1 - p.l / p.m) * .9) * k, '#777'); X.globalAlpha = 1; } });
  }
  L.sort((a, b) => b.d - a.d).forEach(o => o.p ? fill(o.p, o.c) : o.f());
  const nf = night(); if (nf > 0) { X.fillStyle = 'rgba(4,8,30,' + .7 * nf + ')'; X.fillRect(0, 0, w, h); }
  if (S.lights && !mini) { X.globalCompositeOperation = 'lighter'; const gr = X.createLinearGradient(0, h, 0, HOR); gr.addColorStop(0, 'rgba(255,240,170,' + (.1 + .3 * nf) + ')'); gr.addColorStop(1, 'rgba(255,240,170,0)'); X.fillStyle = gr; X.beginPath(); X.moveTo(w * .1, h); X.lineTo(w * .9, h); X.lineTo(w * .6, HOR); X.lineTo(w * .4, HOR); X.fill(); X.globalCompositeOperation = 'source-over'; }
  if (!mini && raining()) {
    X.fillStyle = 'rgba(190,200,215,.15)'; X.fillRect(0, 0, w, h); X.strokeStyle = 'rgba(200,215,255,.5)'; X.beginPath(); for (let i = 0; i < (S.wipers ? 30 : 110); i++) { const x = Math.random() * w, y = Math.random() * h; X.moveTo(x, y); X.lineTo(x - 4, y + 14); } X.stroke();
  }
  if (!mini && S.wipers) { const an = PI * (.15 + .7 * (.5 + .5 * Math.sin(S.time * 5))); X.strokeStyle = '#000'; X.lineWidth = 5; X.beginPath(); X.moveTo(w * .5, h); X.lineTo(w * .5 + Math.cos(PI + an) * h * .8, h + Math.sin(PI + an) * h * .8); X.stroke(); }
}

/* ---------- приладова панель ---------- */
function gauge(c, cx, cy, r, max, val, step, lab, red, unit) {
  c.fillStyle = '#0b0f14'; c.strokeStyle = '#666'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill(); c.stroke();
  const a0 = .75 * PI, a1 = 2.25 * PI;
  for (let v = 0; v <= max; v += step) { const a = a0 + (a1 - a0) * v / max; c.strokeStyle = red && v >= red ? '#e33' : '#ddd'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx + Math.cos(a) * r * .82, cy + Math.sin(a) * r * .82); c.lineTo(cx + Math.cos(a) * r * .95, cy + Math.sin(a) * r * .95); c.stroke(); c.fillStyle = '#ddd'; c.font = '11px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(lab ? v / 1000 : v, cx + Math.cos(a) * r * .68, cy + Math.sin(a) * r * .68); }
  c.fillStyle = '#9ab'; c.fillText(unit, cx, cy + r * .5);
  const a = a0 + (a1 - a0) * Math.min(val, max) / max; c.strokeStyle = '#f33'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * r * .85, cy + Math.sin(a) * r * .85); c.stroke(); c.fillStyle = '#ccc'; c.beginPath(); c.arc(cx, cy, 5, 0, 7); c.fill();
}
const gc = $('gauges').getContext('2d');
function drawDash() {
  gc.clearRect(0, 0, 420, 190); gauge(gc, 105, 105, 82, 200, Math.abs(S.speed), 20, false, 0, 'км/год'); gauge(gc, 315, 105, 72, 8000, S.rpm, 1000, true, 6500, '×1000 об/хв');
  gc.font = '18px sans-serif'; gc.textAlign = 'center'; gc.textBaseline = 'middle'; const bl = S.blink < .45;
  gc.fillStyle = (S.sL || S.haz) && bl ? '#3f3' : '#232'; gc.fillText('◀', 150, 18); gc.fillStyle = (S.sR || S.haz) && bl ? '#3f3' : '#232'; gc.fillText('▶', 270, 18);
  gc.fillStyle = S.lights ? '#3cf' : '#223'; gc.fillText('💡', 190, 18); gc.fillStyle = S.belt ? '#232' : '#f33'; gc.fillText('🔒', 230, 18);
  gc.fillStyle = S.hb ? '#f33' : '#322'; gc.fillText('(P)', 210, 175); gc.fillStyle = S.on ? '#232' : '#fa0'; gc.fillText('ENG', 150, 175);
  gc.fillStyle = '#fff'; gc.font = 'bold 34px sans-serif'; gc.fillText(S.mode === 'manual' ? (S.gear === -1 ? 'R' : S.gear === 0 ? 'N' : S.gear) : S.ag, 210, 120);
  $('wheel').style.transform = 'rotate(' + S.steer * 140 + 'deg)';
  $('hint').textContent = S.mode === 'manual' ? 'Механіка: Shift — зчеплення, 1–5 / 0 / R — передачі' : 'Автомат: ↑ вперед, ↓ гальмо і назад';
}

/* ---------- цикл ---------- */
let W = 0, H = 0, last = 0, fr = 0;
function resize() { W = sc.width = sc.clientWidth; H = sc.height = sc.clientHeight; }
addEventListener('resize', resize);
function loop(t) {
  const dt = Math.min(.05, (t - last) / 1000 || 0); last = t; fr++;
  if (S.run && !S.paused) update(dt);
  if (W) {
    const s = Math.sin(S.h), c = Math.cos(S.h), sh = S.shake * .25, rnd = () => (Math.random() - .5) * sh;
    const cam = { x: S.x - c * .4 + s * .3 + rnd(), y: S.y + s * .4 + c * .3 + rnd(), z: 1.2 + rnd() * .5, yaw: S.h };
    render(g, W, H, cam, W * .8, false);
    drawDash(); $('flash').style.opacity = S.flash * .5;
    const m = fr % 3;
    if (m === 0) render($('mC').getContext('2d'), 240, 60, { x: cam.x, y: cam.y, z: 1.25, yaw: S.h + PI }, 150, true);
    if (m === 1) render($('mL').getContext('2d'), 90, 70, { x: S.x - c * 1, y: S.y + s * 1, z: 1.1, yaw: S.h + PI + .35 }, 70, true);
    if (m === 2) render($('mR').getContext('2d'), 90, 70, { x: S.x + c * 1, y: S.y - s * 1, z: 1.1, yaw: S.h + PI - .35 }, 70, true);
    document.querySelectorAll('[data-a]').forEach(b => b.classList.toggle('on', !!(b.dataset.a === 'engine' ? S.on : S[b.dataset.a])));
    if (AC) { osc.frequency.value = 30 + S.rpm / 22; gn.gain.value = S.on ? .02 + (keys.ArrowUp ? .03 : 0) : 0; hgn.gain.value = S.horn ? .05 : 0; }
  }
  requestAnimationFrame(loop);
}
function start(mode) {
  S.mode = mode; S.run = true; $('menu').hidden = true; resize(); audioInit();
  if (mode === 'manual') { S.gear = 0; S.hb = true; toast('Пристебни ремінь (B), Shift + I — запуск, 1 — передача, зніми ручник (Пробіл)'); }
  else { S.on = true; S.rpm = 900; toast('Пристебни ремінь (B) і їдь: ↑ вперед'); }
}
$('startM').onclick = () => start('manual'); $('startA').onclick = () => start('auto');
resize(); requestAnimationFrame(loop);
