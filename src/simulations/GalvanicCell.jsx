import { useEffect, useRef, useState } from 'react';
import { Select, Segmented, SimLayout, ScaleNote, Readout, LineChart, useAnimationFrame, bisect, sci } from './common.jsx';
import { REDUCTION_POTENTIALS, R, F } from '../data/crc.js';

/* =========================================================
   화학 전지와 표준 환원 전위
   - 두 비커 속 입자(금속 원자, 금속 이온, NO₃⁻)와 염다리 속 K⁺·NO₃⁻ 를 그림
   - 스위치를 닫으면 전구를 지나 전류가 흐르고, (−)극 금속 원자가 이온이 되어 녹아 나오고(산화)
     (+)극 금속 이온이 전자를 받아 금속으로 붙음(환원)
   - 염다리: NO₃⁻ 는 (−)극 비커로, K⁺ 는 (+)극 비커로 들어가 두 비커의 전하 합을 0 으로 유지
   - 전압은 네른스트 식 E = E° − (RT/F)·[ln[양극 쪽 이온]/a − ln[음극 쪽 이온]/b] 로 매 순간 계산
     → 반응이 진행되면 전압이 줄고, 평형(Q = K)에서 0 V 가 되어 전류가 멈춤
   - 입자 그림 1개 = 1.0 × 10⁻³ mol (각 비커: 1.0 M 용액 12 mL → 금속 이온 12개)
   ========================================================= */

// 수용액에서 전극으로 쓰기 어려운 금속(Li, K, Ca, Na)과 수소 전극은 반응성 순서 표시에만 사용
const ELECTRODES = REDUCTION_POTENTIALS.filter((m) => !['Li', 'K', 'Ca', 'Na', 'H2'].includes(m.sym));
const W = 640, H = 400; // 그림판 크기 (px)
const METAL_COLOR = { Mg: '#c9ccd1', Al: '#d5d8dc', Zn: '#a7b0b8', Fe: '#7d7f86', Ni: '#a9a48f', Sn: '#c7c9c4', Pb: '#6d7380', Cu: '#c87533', Ag: '#d7d9de', Au: '#d4af37' };
// 수용액 속 금속 이온의 색 (그림용). 색이 있는 이온은 용액에도 옅게 색을 입힘
const ION_COLOR = { Mg: '#8a96a3', Al: '#9aa3ad', Zn: '#6f7b88', Fe: '#7fb069', Ni: '#2e9e6b', Sn: '#8c9196', Pb: '#4f5863', Cu: '#2f80ed', Ag: '#8d95a0', Au: '#c9a227' };
const TINT = { Cu: [47, 128, 237], Ni: [46, 158, 107], Fe: [127, 176, 105], Au: [230, 190, 40] }; // 용액 색 (색이 있는 이온만)
const LOOK_NO3 = { r: 4.5, color: '#f2994a', sign: '−' };
const LOOK_K = { r: 4.5, color: '#9b51e0', sign: '+' };

const UNIT = 1e-3; // 입자 1개 = 1.0 × 10⁻³ mol
const N0 = 12; // 처음 각 비커의 금속 이온 입자 수
const VOL = 0.012; // 각 비커 용액 부피 (L) → 1.0 M
const BRIDGE_EACH = 40; // 염다리 속 K⁺, NO₃⁻ 입자 수 (각각)
const T = 298.15; // 25 °C
const RT_F = (R * T) / F; // 0.025693 V
const K_RATE = 9e-4; // 전류 ∝ 전압 (전구 저항 일정): 전자 이동 속도 = K_RATE × E (mol/s, 화면용)
const SPEEDS = [1, 10, 100, 1000];

// 그림 속 위치 (px)
const BEAKER = { L: { x0: 30, x1: 270 }, R: { x0: 370, x1: 610 } };
const LIQ_TOP = 190, LIQ_BOT = 374; // 수면, 바닥
const ELEC_X = { L: 75, R: 525 }; // 전극(원자 4줄) 왼쪽 끝
const ELEC_TOP = 130, ROWS = 20, COLS = 4, CELL = 10;
const WIRE_Y = 40;
const BRIDGE_PTS = [[230, 252], [230, 132], [410, 132], [410, 252]]; // 염다리 중심선 (왼쪽 끝 → 오른쪽 끝)
const BRIDGE_HALF = 11; // 염다리 관 안쪽 반폭

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const rand = (a, b) => a + Math.random() * (b - a);
const gauss = () => Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random());
const chargeText = (n) => (n === 1 ? '+' : `${n}+`);

// ── 염다리 중심선 위의 위치: s = 0(왼쪽 끝) ~ 1(오른쪽 끝), lat = 관 안에서 옆으로 벗어난 거리
const SEG = BRIDGE_PTS.slice(1).map((p, i) => Math.hypot(p[0] - BRIDGE_PTS[i][0], p[1] - BRIDGE_PTS[i][1]));
const BRIDGE_LEN = SEG.reduce((a, b) => a + b, 0);
function bridgePos(s, lat) {
  let d = Math.min(Math.max(s, 0), 1) * BRIDGE_LEN, k = 0;
  while (k < SEG.length - 1 && d > SEG[k]) { d -= SEG[k]; k++; }
  const [x0, y0] = BRIDGE_PTS[k], [x1, y1] = BRIDGE_PTS[k + 1];
  const ux = (x1 - x0) / SEG[k], uy = (y1 - y0) / SEG[k];
  return [x0 + ux * d - uy * lat, y0 + uy * d + ux * lat];
}

// ── 전극 원자 자리
function electrodeAtoms(side) {
  const list = [];
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const x = ELEC_X[side] + 5 + col * CELL, y = ELEC_TOP + 5 + row * CELL;
    list.push({ x, y, col, gone: false, wet: y > LIQ_TOP + 3 }); // wet: 용액에 잠긴 원자만 반응
  }
  return list;
}
// (+)극 표면에 새로 붙을 자리 (전극 양옆)
function depositSlots(side) {
  const slots = [];
  for (let row = 0; row < ROWS; row++) {
    const y = ELEC_TOP + 5 + row * CELL;
    if (y <= LIQ_TOP + 3) continue;
    slots.push({ x: ELEC_X[side] - 5, y }, { x: ELEC_X[side] + COLS * CELL + 5, y });
  }
  return slots.sort(() => Math.random() - 0.5);
}

// ── 비커 속에서 입자가 들어가면 안 되는 곳 (전극, 염다리 관)
function blockers(side) {
  const ex = ELEC_X[side];
  const leg = side === 'L' ? BRIDGE_PTS[0][0] : BRIDGE_PTS[3][0];
  return [
    { l: ex - 12, r: ex + COLS * CELL + 12, t: 0, b: ELEC_TOP + ROWS * CELL + 6 },
    { l: leg - BRIDGE_HALF - 4, r: leg + BRIDGE_HALF + 4, t: 0, b: BRIDGE_PTS[0][1] },
  ];
}

// 비커 속 빈 곳 아무 데나
function freeSpot(side, r) {
  const B = BEAKER[side], blk = blockers(side);
  for (let k = 0; k < 200; k++) {
    const x = rand(B.x0 + r + 3, B.x1 - r - 3), y = rand(LIQ_TOP + r + 2, LIQ_BOT - r - 2);
    if (!blk.some((b) => x > b.l - r && x < b.r + r && y > b.t - r && y < b.b + r)) return [x, y];
  }
  return [(B.x0 + B.x1) / 2, LIQ_BOT - 20];
}

// 브라운 운동: 둘레의 물 분자에 끊임없이 밀려 방향이 계속 바뀜
function wander(p, dt, speed, r) {
  const tau = 0.4, kick = speed * Math.sqrt(dt / tau);
  p.vx += (-p.vx / tau) * dt + gauss() * kick;
  p.vy += (-p.vy / tau) * dt + gauss() * kick;
  p.x += p.vx * dt; p.y += p.vy * dt;
  const B = BEAKER[p.side];
  if (p.x < B.x0 + r + 3) { p.x = B.x0 + r + 3; p.vx = Math.abs(p.vx); }
  if (p.x > B.x1 - r - 3) { p.x = B.x1 - r - 3; p.vx = -Math.abs(p.vx); }
  if (p.y < LIQ_TOP + r + 2) { p.y = LIQ_TOP + r + 2; p.vy = Math.abs(p.vy); }
  if (p.y > LIQ_BOT - r - 2) { p.y = LIQ_BOT - r - 2; p.vy = -Math.abs(p.vy); }
  // 전극·염다리 관 속으로 들어가면 가장 가까운 바깥쪽으로 밀어냄
  for (const b of blockers(p.side)) {
    if (p.x > b.l - r && p.x < b.r + r && p.y > b.t - r && p.y < b.b + r) {
      const dl = p.x - (b.l - r), dr = b.r + r - p.x, db = b.b + r - p.y;
      const m = Math.min(dl, dr, db);
      if (m === dl) { p.x = b.l - r; p.vx = -Math.abs(p.vx); }
      else if (m === dr) { p.x = b.r + r; p.vx = Math.abs(p.vx); }
      else { p.y = b.b + r; p.vy = Math.abs(p.vy); }
    }
  }
}

// ── 전지의 화학 (네른스트 식)
// a: (−)극 금속 이온 전하, b: (+)극 금속 이온 전하, nC: (+)극 비커에 남은 금속 이온 (mol)
function makeChem(anode, cathode) {
  const a = anode.n, b = cathode.n, E0 = cathode.E - anode.E;
  const n0 = N0 * UNIT;
  const nAof = (nC) => n0 + (b * (n0 - nC)) / a; // 전자 b(n0 − nC) mol 이 흐르면 (−)극 이온은 그 ÷a 만큼 늘어남
  const Eof = (nC) => E0 - RT_F * (Math.log(nAof(nC) / VOL) / a - Math.log(nC / VOL) / b);
  // 평형(E = 0)에서 남는 (+)극 이온의 양. 아주 작은 수까지 다루려고 ln(nC) 로 이분법
  const s = bisect((x) => Eof(Math.exp(x)), Math.log(1e-300), Math.log(n0));
  const N = (a * b) / gcd(a, b); // 반응식 1번에 오가는 전자 수 (최소공배수)
  return { a, b, E0, n0, N, nAof, Eof, nCeq: Math.exp(s), logK: (N * E0) / (Math.LN10 * RT_F) };
}

// 입자들을 처음 상태로
function buildSim(left, right) {
  const s = { key: `${left.sym}|${right.sym}`, list: [], electrons: [], events: 0, flashes: [] };
  for (const [side, m] of [['L', left], ['R', right]]) {
    s[side] = { metal: m, atoms: electrodeAtoms(side), slots: depositSlots(side), deposits: [] };
    for (let i = 0; i < N0; i++) addIon(s, side, 'M', m);
    for (let i = 0; i < N0 * m.n; i++) addIon(s, side, 'NO3');
  }
  for (const kind of ['K', 'NO3']) for (let i = 0; i < BRIDGE_EACH; i++) {
    s.list.push({ kind, side: 'B', s: rand(0.04, 0.96), lat: rand(-BRIDGE_HALF + 4, BRIDGE_HALF - 4), x: 0, y: 0 });
  }
  return s;
}
function addIon(s, side, kind, metal, x, y) {
  const r = kind === 'M' ? 6.5 : 4.5;
  const [fx, fy] = x == null ? freeSpot(side, r) : [x, y];
  const a = rand(0, Math.PI * 2);
  const p = { kind, side, metal, x: fx, y: fy, vx: Math.cos(a) * 20, vy: Math.sin(a) * 20, age: 99 };
  s.list.push(p);
  return p;
}
const radius = (p) => (p.kind === 'M' ? 6.5 : 4.5);

export default function GalvanicCell() {
  const [left, setLeft] = useState('Zn');
  const [right, setRight] = useState('Cu');
  const [closed, setClosed] = useState(false); // 스위치
  const [speed, setSpeed] = useState(1);
  const [, tick] = useState(0);
  const canvasRef = useRef(null);

  const L = ELECTRODES.find((m) => m.sym === left), Rm = ELECTRODES.find((m) => m.sym === right);
  const same = left === right;
  const anodeLeft = L.E < Rm.E;
  const anode = anodeLeft ? L : Rm, cathode = anodeLeft ? Rm : L;
  const aSide = anodeLeft ? 'L' : 'R', cSide = anodeLeft ? 'R' : 'L';

  // 전지 상태는 ref 에 보관 (매 장면 바뀌므로)
  const chemRef = useRef(null), simRef = useRef(null);
  const key = `${left}|${right}`;
  if (!simRef.current || simRef.current.key !== key) {
    simRef.current = buildSim(L, Rm);
    chemRef.current = same ? null : { ...makeChem(anode, cathode), nC: N0 * UNIT, done: false, log: [] };
    if (chemRef.current) chemRef.current.log = [[0, chemRef.current.E0]];
  }
  useEffect(() => { setClosed(false); }, [key]);
  const reset = () => { simRef.current = null; chemRef.current = null; simRef.current = buildSim(L, Rm); if (!same) { chemRef.current = { ...makeChem(anode, cathode), nC: N0 * UNIT, done: false, log: [] }; chemRef.current.log = [[0, chemRef.current.E0]]; } setClosed(false); tick((k) => k + 1); };

  const chem = chemRef.current;
  const E = !chem ? 0 : chem.done ? 0 : chem.Eof(chem.nC);
  const flowing = closed && chem && !chem.done; // 전류가 흐르는 중

  // ── 1) 화학 반응 진행: 전류(∝ 전압)만큼 전자가 이동
  function stepChem(dtReal) {
    const c = chemRef.current;
    if (!c || c.done || !closed) return;
    let tLeft = dtReal * speed;
    for (let k = 0; k < 4000 && tLeft > 0; k++) {
      const dt = Math.min(0.05, tLeft); tLeft -= dt;
      const e = c.Eof(c.nC);
      const dnC = (K_RATE * e * dt) / c.b; // (+)극 이온이 줄어드는 양
      if (e < 1e-4 || c.nC - dnC <= c.nCeq) { c.nC = c.nCeq; c.done = true; break; } // 평형 도달: 전압 0
      c.nC -= dnC;
    }
    const q = c.b * (c.n0 - c.nC) * 1000; // 이동한 전자 (mmol)
    const last = c.log[c.log.length - 1];
    if (c.done) c.log.push([q, c.Eof(c.nC) > 1e-4 ? c.Eof(c.nC) : 0]);
    else if (q - last[0] > 0.05) c.log.push([q, c.Eof(c.nC)]);
  }

  // ── 2) 반응한 양만큼 입자 사건 만들기 (반응식 1번 = 전자 N개)
  function doEvent() {
    const s = simRef.current, c = chemRef.current;
    const nOx = c.N / c.a, nRed = c.N / c.b;
    // (−)극: 금속 원자가 전자를 잃고 이온이 되어 용액으로 (산화)
    const A = s[aSide];
    for (let i = 0; i < nOx; i++) {
      const cand = A.atoms.filter((t) => !t.gone && t.wet);
      if (!cand.length) break;
      const outer = Math.max(...cand.map((t) => Math.abs(t.col - 1.5)));
      const pool = cand.filter((t) => Math.abs(t.col - 1.5) === outer);
      const atom = pool[(Math.random() * pool.length) | 0];
      atom.gone = true;
      const toLeft = atom.col < 2;
      const p = addIon(s, aSide, 'M', A.metal, toLeft ? ELEC_X[aSide] - 13 : ELEC_X[aSide] + COLS * CELL + 13, atom.y);
      p.vx = toLeft ? -15 : 15; p.vy = 0; p.age = 0; // age: 막 생긴 이온을 잠깐 빛나게
      s.flashes.push({ x: atom.x, y: atom.y, t: 0, color: '#eb5757' });
    }
    // (+)극: 용액 속 금속 이온이 전극 표면에서 전자를 받아 금속 원자로 붙음 (환원)
    const Cs = s[cSide];
    for (let i = 0; i < nRed; i++) {
      const slot = Cs.slots.shift();
      const free = s.list.filter((p) => p.kind === 'M' && p.side === cSide && !p.target);
      if (!free.length || !slot) break;
      let best = free[0], bd = Infinity;
      for (const p of free) { const d = (p.x - slot.x) ** 2 + (p.y - slot.y) ** 2; if (d < bd) { bd = d; best = p; } }
      best.target = slot;
    }
    // 도선: (−)극 → (+)극 으로 전자 N개
    for (let i = 0; i < c.N; i++) s.electrons.push({ d: -i * 14 });
    // 염다리: NO₃⁻ N개는 (−)극 비커로, K⁺ N개는 (+)극 비커로
    const aEnd = aSide === 'L' ? 0 : 1, cEnd = 1 - aEnd;
    for (const [kind, end] of [['NO3', aEnd], ['K', cEnd]]) {
      const inB = s.list.filter((p) => p.side === 'B' && p.kind === kind && p.exit == null).sort((p, q) => Math.abs(p.s - end) - Math.abs(q.s - end));
      for (let i = 0; i < c.N && i < inB.length; i++) inB[i].exit = end;
    }
    s.events++;
  }

  // ── 3) 입자 움직이기
  function stepParticles(dt) {
    const s = simRef.current, c = chemRef.current;
    if (c) {
      const target = Math.floor((c.b * (c.n0 - c.nC)) / (c.N * UNIT) + 0.02);
      for (let k = 0; k < 50 && s.events < target; k++) doEvent();
    }
    const drift = flowing ? 0.04 * Math.min(1, Math.max(0.15, E / (c?.E0 || 1))) : 0;
    for (const p of s.list) {
      p.age = (p.age ?? 99) + dt;
      if (p.side === 'B') { // 염다리 속
        const dir = p.kind === 'K' ? (cSide === 'L' ? -1 : 1) : (aSide === 'L' ? -1 : 1); // K⁺ 는 (+)극 쪽, NO₃⁻ 는 (−)극 쪽으로
        if (p.exit != null) { // 비커로 빠져나가는 중
          p.s += (p.exit === 0 ? -1 : 1) * 0.35 * dt;
          if (p.s <= 0 || p.s >= 1) {
            const side = p.exit === 0 ? 'L' : 'R';
            const [ex, ey] = bridgePos(p.exit, p.lat);
            Object.assign(p, { side, x: ex, y: ey + 6, vx: rand(-10, 10), vy: 35, age: 0, exit: null });
            continue;
          }
        } else {
          p.s += dir * drift * dt + gauss() * 0.012 * Math.sqrt(dt);
          p.s = Math.min(0.97, Math.max(0.03, p.s));
        }
        p.lat += gauss() * 8 * Math.sqrt(dt);
        p.lat = Math.min(BRIDGE_HALF - 4, Math.max(-BRIDGE_HALF + 4, p.lat));
        [p.x, p.y] = bridgePos(p.s, p.lat);
        continue;
      }
      if (p.target) { // 전극 표면으로 다가가는 (+)극 이온
        const dx = p.target.x - p.x, dy = p.target.y - p.y, d = Math.hypot(dx, dy);
        if (d < 3) {
          s[p.side].deposits.push({ x: p.target.x, y: p.target.y, age: 0 });
          s.flashes.push({ x: p.target.x, y: p.target.y, t: 0, color: '#2f80ed' });
          p.dead = true;
          continue;
        }
        const v = 90; p.x += (dx / d) * v * dt; p.y += (dy / d) * v * dt;
        continue;
      }
      wander(p, dt, 20, radius(p));
    }
    s.list = s.list.filter((p) => !p.dead);
    for (const e of s.electrons) e.d += 260 * dt;
    s.electrons = s.electrons.filter((e) => e.d < wireLen());
    s.flashes = s.flashes.filter((f) => (f.t += dt) < 0.6);
    for (const side of ['L', 'R']) for (const d of s[side].deposits) d.age += dt;
  }

  // 도선 경로: (−)극 위 → 위쪽 → (+)극 위
  const ax = ELEC_X[aSide] + (COLS * CELL) / 2, cx = ELEC_X[cSide] + (COLS * CELL) / 2;
  const wirePts = [[ax, ELEC_TOP], [ax, WIRE_Y], [cx, WIRE_Y], [cx, ELEC_TOP]];
  function wireLen() { return (ELEC_TOP - WIRE_Y) * 2 + Math.abs(cx - ax); }
  function wirePos(d) {
    const segs = [ELEC_TOP - WIRE_Y, Math.abs(cx - ax), ELEC_TOP - WIRE_Y];
    let k = 0; while (k < 2 && d > segs[k]) { d -= segs[k]; k++; }
    const [x0, y0] = wirePts[k], [x1, y1] = wirePts[k + 1], f = Math.min(1, d / segs[k]);
    return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
  }

  // ── 4) 그리기
  function ball(ctx, x, y, r, fill, stroke, lw = 1) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function label(ctx, text, x, y, color = '#fff', size = 8) {
    ctx.fillStyle = color; ctx.font = `bold ${size}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5); ctx.textBaseline = 'alphabetic';
  }
  function drawIon(ctx, p) {
    if (p.kind === 'M') {
      const glow = p.age < 1.2 || p.target;
      ball(ctx, p.x, p.y, 6.5, ION_COLOR[p.metal.sym], glow ? (p.target ? '#2f80ed' : '#eb5757') : '#333', glow ? 2.5 : 0.8);
      label(ctx, chargeText(p.metal.n), p.x, p.y, '#fff', p.metal.n === 1 ? 9 : 7);
    } else {
      const look = p.kind === 'K' ? LOOK_K : LOOK_NO3;
      ball(ctx, p.x, p.y, look.r, look.color, p.side !== 'B' && p.age < 1.5 ? '#333' : null, 1.5);
      label(ctx, look.sign, p.x, p.y, '#fff', 8);
    }
  }
  function draw() {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d'), s = simRef.current, c = chemRef.current;
    ctx.clearRect(0, 0, W, H);
    ctx.font = '12px "Noto Sans KR", sans-serif';
    // 비커와 용액 (색이 있는 이온은 농도만큼 색을 입힘)
    for (const side of ['L', 'R']) {
      const B = BEAKER[side], m = s[side].metal;
      ctx.fillStyle = '#eef5ff'; ctx.fillRect(B.x0, LIQ_TOP, B.x1 - B.x0, LIQ_BOT - LIQ_TOP);
      const tint = TINT[m.sym];
      if (tint && c) {
        const conc = side === cSide ? c.nC / VOL : c.nAof(c.nC) / VOL;
        ctx.fillStyle = `rgba(${tint.join(',')},${Math.min(0.45, 0.22 * conc)})`;
        ctx.fillRect(B.x0, LIQ_TOP, B.x1 - B.x0, LIQ_BOT - LIQ_TOP);
      } else if (tint) {
        ctx.fillStyle = `rgba(${tint.join(',')},0.22)`; ctx.fillRect(B.x0, LIQ_TOP, B.x1 - B.x0, LIQ_BOT - LIQ_TOP);
      }
      ctx.strokeStyle = '#556'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(B.x0, 150); ctx.lineTo(B.x0, LIQ_BOT + 3); ctx.lineTo(B.x1, LIQ_BOT + 3); ctx.lineTo(B.x1, 150); ctx.stroke();
    }
    // 염다리 관
    ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
    for (const [w, col] of [[BRIDGE_HALF * 2 + 6, '#c9a94a'], [BRIDGE_HALF * 2, '#fff6d6']]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
      BRIDGE_PTS.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    }
    ctx.fillStyle = '#8a6d1a'; ctx.textAlign = 'center'; ctx.fillText('염다리 (KNO₃)', 320, 156);
    // 염다리 속 이온 이동 방향 표시
    if (flowing) {
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = LOOK_K.color; ctx.fillText(cSide === 'R' ? 'K⁺ →' : '← K⁺', cSide === 'R' ? 360 : 280, 172);
      ctx.fillStyle = LOOK_NO3.color; ctx.fillText(aSide === 'L' ? '← NO₃⁻' : 'NO₃⁻ →', aSide === 'L' ? 278 : 362, 172);
      ctx.font = '12px "Noto Sans KR", sans-serif';
    }
    for (const p of s.list) if (p.side === 'B') drawIon(ctx, p);
    // 도선, 전구, 스위치, 전압계
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath();
    const lx = ELEC_X.L + 20, rx = ELEC_X.R + 20;
    ctx.moveTo(lx, ELEC_TOP); ctx.lineTo(lx, WIRE_Y); ctx.lineTo(235, WIRE_Y);
    ctx.moveTo(265, WIRE_Y); ctx.lineTo(380, WIRE_Y);
    ctx.moveTo(410, WIRE_Y); ctx.lineTo(rx, WIRE_Y); ctx.lineTo(rx, ELEC_TOP); ctx.stroke();
    const glow = flowing ? Math.min(1, (E / 1.2) ** 2) : 0; // 전구 밝기 ∝ 전력 ∝ 전압²
    if (glow > 0.01) { ctx.fillStyle = `rgba(255,214,64,${0.25 + 0.5 * glow})`; ctx.beginPath(); ctx.arc(250, WIRE_Y, 14 + 12 * glow, 0, Math.PI * 2); ctx.fill(); }
    ball(ctx, 250, WIRE_Y, 13, glow > 0.01 ? '#fff3b0' : '#f4f4f4', '#555', 2);
    ctx.strokeStyle = '#777'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(243, WIRE_Y + 5); ctx.lineTo(247, WIRE_Y - 4); ctx.lineTo(253, WIRE_Y + 4); ctx.lineTo(257, WIRE_Y - 5); ctx.stroke();
    ctx.fillStyle = '#556'; ctx.textAlign = 'center'; ctx.fillText('전구', 250, WIRE_Y - 20);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(380, WIRE_Y);
    if (closed) ctx.lineTo(410, WIRE_Y); else ctx.lineTo(405, WIRE_Y - 14);
    ctx.stroke(); ball(ctx, 380, WIRE_Y, 3, '#333'); ball(ctx, 410, WIRE_Y, 3, '#333');
    ctx.fillStyle = '#556'; ctx.fillText(closed ? '스위치 (닫힘)' : '스위치 (열림)', 395, WIRE_Y - 20);
    // 전압계: 두 전극 사이에 나란히 연결 (전류는 거의 흐르지 않음)
    ctx.strokeStyle = '#777'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]); ctx.beginPath();
    ctx.moveTo(150, WIRE_Y); ctx.lineTo(150, 92); ctx.lineTo(270, 92); ctx.moveTo(490, WIRE_Y); ctx.lineTo(490, 92); ctx.lineTo(370, 92); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#222'; ctx.fillRect(270, 72, 100, 40);
    ctx.fillStyle = '#7CFC00'; ctx.font = 'bold 20px Consolas, monospace'; ctx.fillText(`${E.toFixed(3)} V`, 320, 99);
    ctx.font = '12px "Noto Sans KR", sans-serif';
    // 도선 속 전자
    for (const e of s.electrons) {
      if (e.d < 0) continue;
      const [x, y] = wirePos(e.d);
      ball(ctx, x, y, 4, '#f2c94c', '#9a7400', 1); label(ctx, '−', x, y, '#5a4300', 7);
    }
    if (flowing) {
      ctx.fillStyle = '#9a7400'; ctx.font = 'bold 12px sans-serif';
      ctx.fillText(aSide === 'L' ? 'e⁻ →' : '← e⁻', 180, WIRE_Y - 8);
      ctx.font = '12px "Noto Sans KR", sans-serif';
    }
    // 전극 (금속 원자) + (+)극에 새로 붙은 원자
    for (const side of ['L', 'R']) {
      const m = s[side].metal, col = METAL_COLOR[m.sym];
      for (const t of s[side].atoms) if (!t.gone) ball(ctx, t.x, t.y, 5, col, '#555', 0.8);
      for (const d of s[side].deposits) ball(ctx, d.x, d.y, 5, col, d.age < 1.5 ? '#2f80ed' : '#555', d.age < 1.5 ? 2 : 0.8);
    }
    // 반응 순간 표시 (빨강 = 산화, 파랑 = 환원)
    for (const f of s.flashes) {
      ctx.strokeStyle = f.color; ctx.globalAlpha = 1 - f.t / 0.6; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, 6 + f.t * 25, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
    // 비커 속 이온
    for (const p of s.list) if (p.side !== 'B' && p.kind !== 'M') drawIon(ctx, p);
    for (const p of s.list) if (p.side !== 'B' && p.kind === 'M') drawIon(ctx, p);
    // 이름표
    ctx.fillStyle = '#333'; ctx.font = 'bold 13px "Noto Sans KR", sans-serif';
    for (const side of ['L', 'R']) {
      const B = BEAKER[side], m = s[side].metal, mid = (B.x0 + B.x1) / 2;
      ctx.textAlign = 'center';
      if (same) ctx.fillText(`${m.sym} | ${m.ion}`, mid, LIQ_BOT + 20);
      else {
        const isA = side === aSide;
        ctx.fillStyle = isA ? '#c0392b' : '#1f5fa8';
        ctx.fillText(`${m.sym} | ${m.ion}  ${isA ? '(−)극 · 산화' : '(+)극 · 환원'}`, mid, LIQ_BOT + 20);
        ctx.fillStyle = '#333';
      }
    }
    if (c?.done) {
      ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fillRect(170, 196, 300, 44);
      ctx.strokeStyle = '#27ae60'; ctx.lineWidth = 2; ctx.strokeRect(170, 196, 300, 44);
      ctx.fillStyle = '#1e7b43'; ctx.textAlign = 'center'; ctx.font = 'bold 14px "Noto Sans KR", sans-serif';
      ctx.fillText('전압 0 V — 평형 도달 (Q = K)', 320, 214);
      ctx.font = '12px "Noto Sans KR", sans-serif'; ctx.fillText('전자가 더 이상 흐르지 않음', 320, 232);
    }
  }

  const lastUi = useRef(0);
  useAnimationFrame((dt) => {
    if (!(dt > 0)) return; // 첫 장면에서 시간 간격이 0 이나 음수로 올 수 있어 건너뜀
    stepChem(dt);
    const n = Math.ceil(dt / 0.02);
    for (let i = 0; i < n; i++) stepParticles(dt / n);
    draw();
    const now = performance.now();
    if (now - lastUi.current > 120) { lastUi.current = now; tick((k) => (k + 1) % 100000); }
  });

  // ── 화면 오른쪽 숫자들
  const s = simRef.current;
  const nOx = chem ? chem.N / chem.a : 0, nRed = chem ? chem.N / chem.b : 0;
  const coef = (k, t) => (k === 1 ? t : `${k}${t}`);
  const qNow = chem ? chem.b * (chem.n0 - chem.nC) * 1000 : 0; // mmol
  const cA = chem ? chem.nAof(chem.nC) / VOL : 1, cC = chem ? chem.nC / VOL : 1;
  // 비커별 입자 수와 전하 합 (반응식 단위로 세어 항상 정확)
  const ev = s.events;
  const beakerRows = chem ? [
    { side: aSide, metal: anode, ions: N0 + ev * nOx, no3: N0 * anode.n + ev * chem.N, k: 0 },
    { side: cSide, metal: cathode, ions: N0 - ev * nRed, no3: N0 * cathode.n, k: ev * chem.N },
  ] : [];
  // 세로축 눈금: E° 보다 조금 위까지, 보기 좋은 간격으로
  const yStep = !chem ? 0.5 : chem.E0 > 2 ? 1 : chem.E0 > 0.8 ? 0.5 : chem.E0 > 0.3 ? 0.2 : chem.E0 > 0.1 ? 0.05 : 0.005;
  const yMax = chem ? Math.ceil((chem.E0 * 1.05) / yStep) * yStep : 1;
  const yTicks = Math.round(yMax / yStep);
  const slow = flowing && E < 0.05 && speed < 1000;

  return (
    <SimLayout
      canvas={<>
        <canvas ref={canvasRef} width={W} height={H} className="cell-view" style={{ width: '100%', height: 'auto' }} />
        <div className="legend small">
          {!same && <>
            <span><i className="dot" style={{ background: METAL_COLOR[anode.sym], border: '1px solid #555' }} /> {anode.sym} 원자</span>
            <span><i className="dot" style={{ background: ION_COLOR[anode.sym] }} /> {anode.ion}</span>
            <span><i className="dot" style={{ background: METAL_COLOR[cathode.sym], border: '1px solid #555' }} /> {cathode.sym} 원자</span>
            <span><i className="dot" style={{ background: ION_COLOR[cathode.sym] }} /> {cathode.ion}</span>
          </>}
          <span><i className="dot" style={{ background: LOOK_NO3.color }} /> NO₃⁻</span>
          <span><i className="dot" style={{ background: LOOK_K.color }} /> K⁺</span>
          <span><i className="dot" style={{ background: '#f2c94c', border: '1px solid #9a7400' }} /> 전자 e⁻</span>
        </div>
        {chem && (
          <LineChart height={240} xDomain={[0, N0 * chem.b]} yDomain={[0, yMax]} xTicks={N0 * chem.b > 12 ? 6 : 4} yTicks={yTicks}
            yFormat={(v) => v.toFixed(yStep < 0.01 ? 3 : yStep < 0.1 ? 2 : 1)}
            series={[{ label: '전지 전압', color: '#27ae60', points: chem.log }]}
            hLines={[{ y: chem.E0, color: '#999', label: `E° = ${chem.E0.toFixed(3)} V` }]}
            markers={[{ x: qNow, y: E, color: '#27ae60' }]}
            xLabel="도선으로 이동한 전자의 양 (mmol)" yLabel="전압 (V)" />
        )}
      </>}
      controls={<>
        <Select label="왼쪽 전극" value={left} onChange={setLeft} options={ELECTRODES.map((m) => ({ value: m.sym, label: `${m.ko} (${m.sym}) E° = ${m.E} V` }))} />
        <Select label="오른쪽 전극" value={right} onChange={setRight} options={ELECTRODES.map((m) => ({ value: m.sym, label: `${m.ko} (${m.sym}) E° = ${m.E} V` }))} />
        {same ? <p className="small">두 전극이 같으면 전위차가 없어 전류가 흐르지 않습니다.</p> : <>
          <div className="btn-row">
            <button className="btn" onClick={() => setClosed(!closed)} disabled={chem.done}>{closed ? '스위치 열기' : '스위치 닫기'}</button>
            <button className="btn btn-ghost" onClick={reset}>처음으로</button>
          </div>
          <div>
            <div className="small muted" style={{ marginBottom: 4 }}>빠르기 (실제 시간의 몇 배)</div>
            <Segmented value={speed} onChange={setSpeed} options={SPEEDS.map((v) => ({ value: v, label: `×${v}` }))} />
          </div>
          {slow && <p className="small">전압이 작아 전류가 약하므로 반응이 느립니다. 빠르기를 높여 보세요.</p>}
          <div className="eq-eqn">
            <div style={{ color: '#c0392b' }}>(−)극 산화: {anode.sym} → {anode.ion} + {anode.n}e⁻</div>
            <div style={{ color: '#1f5fa8' }}>(+)극 환원: {cathode.ion} + {cathode.n}e⁻ → {cathode.sym}</div>
            <div>전체: {coef(nOx, anode.sym)} + {coef(nRed, cathode.ion)} → {coef(nOx, anode.ion)} + {coef(nRed, cathode.sym)}</div>
          </div>
          <Readout rows={[
            ['표준 전지 전위 E°', `${cathode.E} − (${anode.E}) = ${chem.E0.toFixed(3)} V`],
            ['지금 전압 E', `${E.toFixed(3)} V`],
            [`[${anode.ion}]`, `${sci(cA, 3)} M`],
            [`[${cathode.ion}]`, `${sci(cC, 3)} M`],
            ['이동한 전자', `${qNow.toFixed(2)} mmol`],
            ['평형 상수 K', `10^${chem.logK.toFixed(1)}`],
          ]} />
          <p className="small muted">(심화) 네른스트 식: E = E° − (0.0592 / {chem.N}) log Q, &nbsp;Q = [{anode.ion}]{nOx > 1 ? <sup>{nOx}</sup> : null} / [{cathode.ion}]{nRed > 1 ? <sup>{nRed}</sup> : null}.
            반응이 진행되면 Q 가 커져 전압이 줄고, Q = K 가 되면 E = 0 V 입니다.</p>
          {chem.done && (
            <div className="feedback ok small">
              {cC < 1e-6
                ? <>평형 상수 K 가 매우 커서(10^{chem.logK.toFixed(0)}) {cathode.ion} 이(가) 사실상 모두 환원되었습니다. 남은 농도 {sci(cC, 2)} M.
                  {' '}전압 0 V 는 반응물이 바닥나 평형에 도달했다는 뜻입니다.</>
                : <>{cathode.ion} 이(가) {cC.toFixed(3)} M 남아 있지만 Q = K 인 평형에 도달해 전자가 더 흐르지 않습니다.
                  {' '}두 금속의 표준 환원 전위 차이가 작으면 반응이 끝까지 가지 않습니다.</>}
            </div>
          )}
          <div className="subpanel">
            <b>비커 속 전하 균형 (입자 1개 = 1.0 × 10⁻³ mol)</b>
            <Readout rows={beakerRows.map((r) => {
              const plus = r.ions * r.metal.n + r.k;
              return [
                `${r.side === 'L' ? '왼쪽' : '오른쪽'} ${r.side === aSide ? '(−)극' : '(+)극'}`,
                `${r.metal.ion} ${r.ions}${r.k ? ` · K⁺ ${r.k}` : ''} · NO₃⁻ ${r.no3} → (+${plus}) + (−${r.no3}) = ${plus - r.no3}`,
              ];
            })} />
            <p className="small muted">(−)극에서는 양이온이 늘어나므로 염다리의 NO₃⁻ 가, (+)극에서는 양이온이 줄어드므로 염다리의 K⁺ 가 들어와 두 비커가 언제나 전기적으로 중성입니다. 염다리가 없으면 전하가 쌓여 전류가 곧 멈춥니다.</p>
          </div>
        </>}
        <div className="subpanel">
          <b>표준 환원 전위 (V)</b>
          <div className="series">
            {REDUCTION_POTENTIALS.map((m) => (
              <div key={m.sym} className={`series-row ${m.sym === left || m.sym === right ? 'on' : ''}`}>
                <span>{m.ion}/{m.sym === 'H2' ? 'H₂' : m.sym}</span>
                <div className="series-bar"><div style={{ left: `${((m.E + 3.1) / 4.7) * 100}%` }} /></div>
                <b>{m.E.toFixed(3)}</b>
              </div>
            ))}
          </div>
          <p className="small muted">아래(전위가 낮은) 금속일수록 전자를 잃기 쉬워 반응성이 큽니다.</p>
        </div>
      </>}
      footer={<ScaleNote items={[
        '입자 1개 = 1.0 × 10⁻³ mol. 각 비커는 1.0 M 용액 12 mL (금속 이온 12개), 염다리에는 K⁺·NO₃⁻ 각 40개 (0.040 mol)',
        '전압: 네른스트 식(25 °C, 농도를 활동도로 근사), 전지의 내부 저항은 무시. 전압계는 전류가 거의 흐르지 않는 이상적인 전압계',
        `반응 속도: 전류가 전압에 비례한다고 두고(전구 저항 일정) 시간을 크게 압축한 화면용. 가로축은 시간이 아니라 이동한 전자의 양`,
        '염다리 속 이온만 이동해 전하 균형을 맞춘다고 단순화 (실제로는 비커 속 다른 이온도 일부 이동). 구경꾼 음이온은 NO₃⁻ 로 통일 (실제로는 금속에 따라 다른 염을 씀, 예: 금은 염화물)',
        '전극 금속은 충분하다고 가정. Mg·Al 은 실제로 물과의 반응·산화막 때문에 측정 전압이 표준값보다 작음',
        'Li, K, Ca, Na 는 물과 반응하므로 전극 선택에서 제외',
      ]} />}
    />
  );
}
