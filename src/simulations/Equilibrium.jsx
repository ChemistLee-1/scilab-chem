import { useEffect, useRef, useState } from 'react';
import { ScaleNote, sci } from './common.jsx';
import { N2O4_DH, N2O4_DS, R, R_LBAR } from '../data/crc.js';
import './Equilibrium.css';

/* =========================================================
   2NO₂ ⇌ N₂O₄ 평형 시뮬레이션
   - NO₂ 하나 = '조각' 1개. 두 조각이 부딪혀 붙으면 N₂O₄가 된다.
   - 평형 조성은 CRC 열역학 자료로 계산한 Kc(T)와 같아지도록
     역반응 속도 상수를 정한다 (kr = kf / (Kc · 조각 1개의 농도)).
   ========================================================= */

// ── 실제 데이터와 연결되는 값
const MOL_PER_UNIT = 2e-4; // NO₂ 조각 1개 = 2×10⁻⁴ mol
const V0 = 1.0; // 부피 배율 1.00 = 1 L
const C_UNIT = MOL_PER_UNIT / V0; // 조각 1개의 농도 (mol/L, 부피 배율 1일 때)
// 2NO₂ ⇌ N₂O₄ 의 Kc (L/mol) = 1 / (N₂O₄ ⇌ 2NO₂ 의 Kc), Kp 는 1 bar 기준
const KcDim = (T) => (R_LBAR * T) / Math.exp(-(N2O4_DH - T * N2O4_DS) / (R * T));

// ── 화면용 값 (실제 반응 속도와 무관)
const START_N = 300; // 처음 NO₂ 조각 수
const EA_F = 3000, A_F = 0.1049; // 정반응 아레니우스 상수 (화면용)
const SPEED = 0.6; // 반응이 일어나는 빠르기
const SIZE = 0.5; // 분자 그림 크기 배율
const BOND = 13 * SIZE; // N₂O₄ 에서 두 조각 사이 거리
const R_FREE = 9 * SIZE, R_PAIR = 13 * SIZE; // 충돌 반지름
const M_FREE = 1, M_PAIR = 2; // 무게 비율
const VMAX = 5.0; // 최고 속력 (px/프레임)
const TEMP_REF = 298, BASE_MEANSQ = 0.667; // 실온 기준 움직임 세기
const CARD_PAD = 8;
const V_MIN = 0.5, V_MAX = 1.8; // 부피 배율 범위
const HIST_MAX = 320;
const N_COL = '#3b7ec4', N_EDGE = '#1d4e80', O_COL = '#c84b3a', O_EDGE = '#7d2018';

const kRates = (T) => {
  const kf = A_F * Math.exp(-EA_F / (R * T));
  return { kf, kr: kf / (KcDim(T) * C_UNIT) };
};

// 이론 평형: 조각 총수 N, N₂O₄ 개수 x 에 대해 x / (N − 2x)² = Kc·C_UNIT / Vrel
function eqPairs(N, T, Vrel) {
  const a = (KcDim(T) * C_UNIT) / Vrel;
  const b = 4 * a * N + 1;
  return (b - Math.sqrt(b * b - 16 * a * a * N * N)) / (8 * a);
}

function colorOf(alpha) {
  if (alpha > 0.44) return ['짙은 적갈색', '#8a3d12'];
  if (alpha > 0.30) return ['갈색', '#b3541e'];
  if (alpha > 0.15) return ['옅은 갈색', '#c0743a'];
  return ['무색에 가까움', '#2e6f7e'];
}

const PRESETS = [[278, '❄️ 얼음물 (5°C)'], [298, '실온 (25°C)'], [343, '♨️ 뜨거운 물 (70°C)']];

export default function Equilibrium() {
  const simRef = useRef(null), graphRef = useRef(null);
  const [T, setT] = useState(298);
  const [Vrel, setVrel] = useState(1);
  const [running, setRunning] = useState(true);
  const [stats, setStats] = useState({ no2: START_N, n2o4: 0, fwd: 0, rev: 0, alpha: 0.6 });
  const ctl = useRef({ T, Vrel, running });
  ctl.current = { T, Vrel, running };
  const api = useRef({});

  useEffect(() => {
    const sim = simRef.current, sctx = sim.getContext('2d');
    const gph = graphRef.current, gctx = gph.getContext('2d');
    let SW, SH, GW, GH, dpr;
    let units = [], history = [], fwdRate = 0, revRate = 0, pendingBonds = 0;
    const rand = (a, b) => a + Math.random() * (b - a);

    // ----- 화면 크기에 맞춰 도화지 크기 조정
    function fit(canvas, ctx, ratio) {
      dpr = window.devicePixelRatio || 1;
      const w = canvas.getBoundingClientRect().width || 400;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(w * ratio * dpr));
      canvas.style.height = `${canvas.height / dpr}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function resize() {
      fit(sim, sctx, 0.8); SW = sim.width / dpr; SH = sim.height / dpr;
      fit(gph, gctx, 0.26); GW = gph.width / dpr; GH = gph.height / dpr;
      for (const u of units) { u.x = Math.min(Math.max(u.x, 30), SW - 30); u.y = Math.min(Math.max(u.y, 30), SH - 30); }
    }

    // ----- 부피 배율 → 용기 상자 (넓이가 부피에 비례)
    function boxRect() {
      const availW = SW - 2 * CARD_PAD, availH = SH - 2 * CARD_PAD;
      const scale = Math.sqrt(ctl.current.Vrel / V_MAX);
      const w = availW * scale, h = availH * scale;
      return { x: CARD_PAD + (availW - w) / 2, y: CARD_PAD + (availH - h) / 2, w, h };
    }

    function mkUnit() {
      const box = boxRect(), mgn = 30;
      const lox = box.x + mgn, hix = Math.max(lox + 1, box.x + box.w - mgn);
      const loy = box.y + mgn, hiy = Math.max(loy + 1, box.y + box.h - mgn);
      return { x: rand(lox, hix), y: rand(loy, hiy), vx: rand(-1, 1), vy: rand(-1, 1), ang: rand(0, 6.28), va: rand(-0.04, 0.04), state: 'free', partner: null, role: 0, gAng: 0 };
    }
    function init() { units = []; for (let i = 0; i < START_N; i++) units.push(mkUnit()); history = []; fwdRate = revRate = 0; pendingBonds = 0; }
    const freeCount = () => { let n = 0; for (const u of units) if (u.state === 'free') n++; return n; };
    const movers = () => units.filter((u) => u.state === 'free' || (u.state === 'bonded' && u.role === 0));

    // ----- 온도에 맞게 분자 속력 맞추기 (화면용: 속력² ∝ T²)
    function thermostat() {
      const ms = movers();
      if (!ms.length) return;
      const meanSq = ms.reduce((s, u) => s + u.vx * u.vx + u.vy * u.vy, 0) / ms.length;
      if (meanSq < 1e-6) { ms.forEach((u) => { u.vx = rand(-0.3, 0.3); u.vy = rand(-0.3, 0.3); }); return; }
      const target = BASE_MEANSQ * Math.pow(ctl.current.T / TEMP_REF, 2);
      const factor = 1 + (Math.sqrt(target / meanSq) - 1) * 0.08;
      ms.forEach((u) => { u.vx *= factor; u.vy *= factor; });
    }

    // ----- 한 장면만큼 시간 진행
    function step(dt) {
      const { T: temp, Vrel: vr } = ctl.current;
      thermostat();
      const f = dt * 60; // 프레임 속도와 무관하게 이동 (60 fps 기준)
      const box = boxRect();
      const m = R_FREE + 6, gm = BOND + R_PAIR + 2;
      const fxMin = box.x + m, fxMax = box.x + box.w - m, fyMin = box.y + m, fyMax = box.y + box.h - m;
      const gxMin = box.x + gm, gxMax = box.x + box.w - gm, gyMin = box.y + gm, gyMax = box.y + box.h - gm;

      // (1) NO₂ 이동
      for (const u of units) {
        if (u.state !== 'free') continue;
        u.x += u.vx * f; u.y += u.vy * f; u.ang += u.va * f;
        if (u.x < fxMin) { u.x = fxMin; u.vx = Math.abs(u.vx); } if (u.x > fxMax) { u.x = fxMax; u.vx = -Math.abs(u.vx); }
        if (u.y < fyMin) { u.y = fyMin; u.vy = Math.abs(u.vy); } if (u.y > fyMax) { u.y = fyMax; u.vy = -Math.abs(u.vy); }
      }
      // (2) N₂O₄ 이동 (대장이 움직이고 짝은 따라감)
      for (const u of units) {
        if (!(u.state === 'bonded' && u.role === 0)) continue;
        u.x += u.vx * f; u.y += u.vy * f; u.gAng += u.va * f;
        if (u.x < gxMin) { u.x = gxMin; u.vx = Math.abs(u.vx); } if (u.x > gxMax) { u.x = gxMax; u.vx = -Math.abs(u.vx); }
        if (u.y < gyMin) { u.y = gyMin; u.vy = Math.abs(u.vy); } if (u.y > gyMax) { u.y = gyMax; u.vy = -Math.abs(u.vy); }
        const p = u.partner; p.x = u.x + Math.cos(u.gAng) * BOND; p.y = u.y + Math.sin(u.gAng) * BOND; p.gAng = u.gAng;
      }

      // (3) 이번 순간의 반응량
      const nf = freeCount();
      const nb = (units.length - nf) / 2;
      const { kf, kr } = kRates(temp);
      const expFwd = (kf * nf * nf / vr) * dt * SPEED; // NO₂ 두 개가 만나야 함 → (개수)² ÷ 부피
      const expRev = kr * nb * dt * SPEED; // N₂O₄ 가 스스로 쪼개짐 → 개수에 비례
      fwdRate += (expFwd / dt - fwdRate) * 0.06;
      revRate += (expRev / dt - revRate) * 0.06;
      pendingBonds = Math.min(nf / 2, pendingBonds + expFwd); // 결합 예약 → 부딪힐 때 붙음

      // (4) 충돌 (+ 부딪히는 순간 결합)
      const bodies = [];
      for (const u of units) {
        if (u.state === 'free') bodies.push({ u, cx: u.x, cy: u.y, r: R_FREE, m: M_FREE, free: true, dead: false });
        else if (u.role === 0) { const p = u.partner; bodies.push({ u, cx: (u.x + p.x) / 2, cy: (u.y + p.y) / 2, r: R_PAIR, m: M_PAIR, free: false, dead: false }); }
      }
      for (let i = 0; i < bodies.length; i++) {
        const A = bodies[i]; if (A.dead) continue;
        for (let j = i + 1; j < bodies.length; j++) {
          const B = bodies[j]; if (B.dead) continue;
          let dx = B.cx - A.cx, dy = B.cy - A.cy, dist = Math.hypot(dx, dy);
          const min = A.r + B.r;
          if (dist === 0) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; dist = Math.hypot(dx, dy) || 1; }
          if (dist >= min) continue;
          const nx = dx / dist, ny = dy / dist;
          if (A.free && B.free && pendingBonds >= 1) {
            pendingBonds -= 1;
            const ga = Math.atan2(dy, dx), L = A.u, F = B.u;
            L.state = 'bonded'; L.role = 0; L.partner = F; L.gAng = ga; L.va = rand(-0.03, 0.03);
            F.state = 'bonded'; F.role = 1; F.partner = L; F.gAng = ga;
            L.vx = (L.vx + F.vx) / 2; L.vy = (L.vy + F.vy) / 2;
            F.x = L.x + Math.cos(ga) * BOND; F.y = L.y + Math.sin(ga) * BOND;
            A.dead = true; B.dead = true; break;
          }
          const vn = (B.u.vx - A.u.vx) * nx + (B.u.vy - A.u.vy) * ny;
          if (vn < 0) {
            const imp = -(2 * vn) / (1 / A.m + 1 / B.m);
            A.u.vx -= imp * nx / A.m; A.u.vy -= imp * ny / A.m;
            B.u.vx += imp * nx / B.m; B.u.vy += imp * ny / B.m;
          }
          const overlap = min - dist, totInv = 1 / A.m + 1 / B.m;
          const sa = overlap * (1 / A.m) / totInv, sb = overlap * (1 / B.m) / totInv;
          A.u.x -= nx * sa; A.u.y -= ny * sa; A.cx -= nx * sa; A.cy -= ny * sa;
          B.u.x += nx * sb; B.u.y += ny * sb; B.cx += nx * sb; B.cy += ny * sb;
        }
      }

      // (4-2) 결합 예약이 밀려 있으면 가까운 NO₂ 끼리 붙임 (충돌만으로는 평형보다 늦어지는 것 보완)
      while (pendingBonds >= 2) {
        const free = units.filter((u) => u.state === 'free');
        if (free.length < 2) break;
        const L = free[Math.floor(Math.random() * free.length)];
        let F = null, best = Infinity;
        for (const u of free) { if (u === L) continue; const d = Math.hypot(u.x - L.x, u.y - L.y); if (d < best) { best = d; F = u; } }
        pendingBonds -= 1;
        const ga = Math.atan2(F.y - L.y, F.x - L.x);
        L.state = 'bonded'; L.role = 0; L.partner = F; L.gAng = ga; L.va = rand(-0.03, 0.03);
        F.state = 'bonded'; F.role = 1; F.partner = L; F.gAng = ga;
        L.vx = (L.vx + F.vx) / 2; L.vy = (L.vy + F.vy) / 2;
        L.x = (L.x + F.x) / 2; L.y = (L.y + F.y) / 2;
        F.x = L.x + Math.cos(ga) * BOND; F.y = L.y + Math.sin(ga) * BOND;
      }

      // (5) 속도 제한 + 벽 밖으로 나간 분자 되돌리기
      for (const u of units) {
        const s = Math.hypot(u.vx, u.vy); if (s > VMAX) { u.vx *= VMAX / s; u.vy *= VMAX / s; }
        if (u.state === 'free') {
          u.x = Math.min(Math.max(u.x, fxMin), fxMax); u.y = Math.min(Math.max(u.y, fyMin), fyMax);
        } else if (u.role === 0) {
          u.x = Math.min(Math.max(u.x, gxMin), gxMax); u.y = Math.min(Math.max(u.y, gyMin), gyMax);
          const p = u.partner; p.x = u.x + Math.cos(u.gAng) * BOND; p.y = u.y + Math.sin(u.gAng) * BOND;
        }
      }

      // (6) 역반응: N₂O₄ 를 무작위로 골라 둘로 쪼갬
      const doR = Math.floor(expRev) + (Math.random() < expRev % 1 ? 1 : 0);
      for (let i = 0; i < doR; i++) {
        const ld = units.filter((u) => u.state === 'bonded' && u.role === 0);
        if (!ld.length) break;
        const L = ld[Math.floor(Math.random() * ld.length)], F = L.partner;
        const ax = Math.cos(L.gAng), ay = Math.sin(L.gAng), kick = 1.5;
        L.state = F.state = 'free'; L.partner = F.partner = null; L.role = F.role = 0;
        L.vx -= ax * kick; L.vy -= ay * kick; F.vx += ax * kick; F.vy += ay * kick;
        L.ang = rand(0, 6.28); F.ang = rand(0, 6.28); L.va = rand(-0.05, 0.05); F.va = rand(-0.05, 0.05);
      }

      // (7) 그래프 기록
      const no2 = freeCount();
      history.push({ no2, n2o4: (units.length - no2) / 2 });
      if (history.length > HIST_MAX) history.shift();
    }

    // ----- 그리기
    function atom(c, x, y, r, col, edge) {
      c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
      c.strokeStyle = edge; c.lineWidth = Math.max(0.3, r * 0.25); c.stroke();
    }
    // NO₂: 가운데 질소(파랑) + 산소(빨강) 2개, 134° 굽은 모양
    function drawUnit(c, x, y, facing) {
      const d = 8 * SIZE, half = (134 * Math.PI) / 180 / 2;
      const o1x = x + Math.cos(facing - half) * d, o1y = y + Math.sin(facing - half) * d;
      const o2x = x + Math.cos(facing + half) * d, o2y = y + Math.sin(facing + half) * d;
      c.strokeStyle = 'rgba(70,50,35,.5)'; c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(o1x, o1y); c.lineTo(x, y); c.lineTo(o2x, o2y); c.stroke();
      atom(c, o1x, o1y, 3.6 * SIZE, O_COL, O_EDGE); atom(c, o2x, o2y, 3.6 * SIZE, O_COL, O_EDGE);
      atom(c, x, y, 4.8 * SIZE, N_COL, N_EDGE);
    }
    function roundRect(c, x, y, w, h, r) {
      c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    }
    const alphaOf = (no2) => Math.min(0.6, (no2 / ctl.current.Vrel / START_N) * 0.85); // 진하기 ∝ [NO₂]

    function drawSim() {
      const c = sctx; c.clearRect(0, 0, SW, SH);
      c.fillStyle = '#f2ece0'; roundRect(c, CARD_PAD, CARD_PAD, SW - CARD_PAD * 2, SH - CARD_PAD * 2, 16); c.fill();
      c.save(); c.setLineDash([5, 5]); c.strokeStyle = 'rgba(60,45,25,.28)'; c.lineWidth = 1.4;
      roundRect(c, CARD_PAD, CARD_PAD, SW - CARD_PAD * 2, SH - CARD_PAD * 2, 16); c.stroke(); c.restore();
      const box = boxRect();
      c.fillStyle = '#efe9dd'; roundRect(c, box.x, box.y, box.w, box.h, 14); c.fill();
      const alpha = alphaOf(freeCount());
      c.save(); roundRect(c, box.x, box.y, box.w, box.h, 14); c.clip();
      const grd = c.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
      grd.addColorStop(0, `rgba(150,68,20,${alpha})`); grd.addColorStop(1, `rgba(120,48,12,${alpha * 0.85})`);
      c.fillStyle = grd; c.fillRect(box.x, box.y, box.w, box.h); c.restore();
      c.strokeStyle = 'rgba(60,45,25,.4)'; c.lineWidth = 2; roundRect(c, box.x, box.y, box.w, box.h, 14); c.stroke();
      for (const u of units) {
        if (u.state === 'free') drawUnit(c, u.x, u.y, u.ang);
        else if (u.role === 0) {
          const p = u.partner;
          c.strokeStyle = 'rgba(40,80,130,.6)'; c.lineWidth = 0.7;
          c.beginPath(); c.moveTo(u.x, u.y); c.lineTo(p.x, p.y); c.stroke();
          const a = Math.atan2(p.y - u.y, p.x - u.x);
          drawUnit(c, u.x, u.y, a + Math.PI); drawUnit(c, p.x, p.y, a);
        }
      }
    }

    function drawGraph() {
      const c = gctx; c.clearRect(0, 0, GW, GH);
      const N = units.length;
      const padL = 34, padR = 10, padT = 10, padB = 18, w = GW - padL - padR, h = GH - padT - padB;
      const yOf = (v) => padT + h - (v / N) * h;
      c.strokeStyle = '#d8cfbe'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(padL, padT); c.lineTo(padL, padT + h); c.lineTo(padL + w, padT + h); c.stroke();
      c.font = '10px "Noto Sans KR",sans-serif'; c.fillStyle = '#8b8276'; c.textAlign = 'right';
      for (let v = 0; v <= N; v += 50) {
        c.fillText(v, padL - 6, yOf(v) + 3);
        c.strokeStyle = 'rgba(216,207,190,.6)'; c.beginPath(); c.moveTo(padL, yOf(v)); c.lineTo(padL + w, yOf(v)); c.stroke();
      }
      // 이론 평형값 (CRC 자료로 계산) 점선
      const x = eqPairs(N, ctl.current.T, ctl.current.Vrel);
      c.save(); c.setLineDash([6, 4]); c.lineWidth = 1.3;
      [[N - 2 * x, 'rgba(179,84,30,.6)'], [x, 'rgba(46,111,126,.6)']].forEach(([v, col]) => {
        c.strokeStyle = col; c.beginPath(); c.moveTo(padL, yOf(v)); c.lineTo(padL + w, yOf(v)); c.stroke();
      });
      c.restore();
      if (history.length < 2) return;
      const line = (key, color) => {
        c.strokeStyle = color; c.lineWidth = 2.4; c.beginPath();
        history.forEach((hp, i) => { const px = padL + (i / (HIST_MAX - 1)) * w; i ? c.lineTo(px, yOf(hp[key])) : c.moveTo(px, yOf(hp[key])); });
        c.stroke();
      };
      line('no2', '#b3541e'); line('n2o4', '#2e6f7e');
    }

    // ----- 반복 (계산 → 그리기)
    let raf, last = performance.now(), lastStats = 0;
    function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (ctl.current.running) step(dt);
      drawSim(); drawGraph();
      if (now - lastStats > 100) {
        lastStats = now;
        const no2 = freeCount();
        setStats({ no2, n2o4: (units.length - no2) / 2, fwd: fwdRate, rev: revRate, alpha: alphaOf(no2) });
      }
      raf = requestAnimationFrame(loop);
    }

    api.current = {
      reset: init,
      addNO2: (k) => { for (let i = 0; i < k; i++) units.push(mkUnit()); },
    };
    const ro = new ResizeObserver(resize);
    ro.observe(sim.parentElement); ro.observe(gph.parentElement);
    resize(); init(); raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  // ----- 화면 표시용 계산 (실제 단위)
  const total = stats.no2 + 2 * stats.n2o4;
  const V = V0 * Vrel; // L
  const cNO2 = (stats.no2 * MOL_PER_UNIT) / V, cN2O4 = (stats.n2o4 * MOL_PER_UNIT) / V;
  const K = KcDim(T);
  const Q = cNO2 > 0 ? cN2O4 / (cNO2 * cNO2) : Infinity;
  const ratio = Q / K;
  const dir = ratio > 0.85 && ratio < 1.15 ? '평형 상태 (Q ≈ K)'
    : ratio < 1 ? 'Q < K → 정반응 쪽으로 진행 (N₂O₄ 생성)' : 'Q > K → 역반응 쪽으로 진행 (NO₂ 생성)';
  const [colorLabel, colorCol] = colorOf(stats.alpha);
  const eqX = eqPairs(total, T, Vrel);

  const reset = () => { setT(298); setVrel(1); ctl.current = { ...ctl.current, T: 298, Vrel: 1 }; api.current.reset(); };

  return (
    <div className="eqsim">
      <div className="sim">
        <div className="sim-grid">
          <div className="canvas-card">
            <div className="color-tag" style={{ color: colorCol }}>기체 색: {colorLabel}</div>
            <canvas ref={simRef} className="eq-canvas" />
          </div>

          <div className="panel">
            <div className="eq-head">2NO₂(g) ⇌ N₂O₄(g) &nbsp; ΔH° = −{(N2O4_DH / 1000).toFixed(1)} kJ</div>
            <div className="ctrl">
              <label htmlFor="eq-temp">온도 <span className="val">{T} K</span></label>
              <input type="range" id="eq-temp" min="270" max="360" step="1" value={T} onChange={(e) => setT(+e.target.value)} />
              <div className="range-scale"><span>270 K (차가움)</span><span>360 K (뜨거움)</span></div>
            </div>
            <div className="ctrl">
              <label htmlFor="eq-vol">부피 <span className="val">{Vrel.toFixed(2)} × ({(V0 * Vrel).toFixed(2)} L)</span></label>
              <input type="range" id="eq-vol" min={V_MIN * 100} max={V_MAX * 100} step="1" value={Math.round(Vrel * 100)} onChange={(e) => setVrel(+e.target.value / 100)} />
              <div className="range-scale"><span>압축 ←</span><span>→ 팽창</span></div>
            </div>
            <div className="readouts">
              <div className="ro no2"><div className="name">NO₂ 분자 수</div><div className="num">{stats.no2}</div></div>
              <div className="ro n2o4"><div className="name">N₂O₄ 분자 수</div><div className="num">{stats.n2o4}</div></div>
              <div className="ro"><div className="name">정반응 속도</div><div className="num fwd">{stats.fwd.toFixed(1)}</div></div>
              <div className="ro"><div className="name">역반응 속도</div><div className="num rev">{stats.rev.toFixed(1)}</div></div>
              <div className="ro"><div className="name">평형 상수 Kc (CRC)</div><div className="num small">{sci(K, 2)}</div></div>
              <div className="ro"><div className="name">반응 지수 Q</div><div className="num small">{Number.isFinite(Q) ? sci(Q, 2) : '—'}</div></div>
            </div>
            <div className="direction">{dir}</div>
            <div className="presets">
              {PRESETS.map(([t, label]) => <button key={t} className="pill" type="button" onClick={() => setT(t)}>{label}</button>)}
            </div>
            <div className="btnrow">
              <button className="btn" type="button" onClick={() => setRunning((r) => !r)}>{running ? '⏸ 일시정지' : '▶ 재생'}</button>
              <button className="btn ghost" type="button" onClick={() => api.current.addNO2(30)}>NO₂ 30개 추가</button>
              <button className="btn ghost" type="button" onClick={reset}>↺ 초기화</button>
            </div>
          </div>
        </div>

        <div className="graph-card">
          <div className="graph-head">
            <span className="t">분자 수의 변화 (시간에 따른 평형 도달)</span>
            <span className="glegend">
              <span style={{ color: '#b3541e' }}><i style={{ background: '#b3541e' }} />NO₂</span>
              <span style={{ color: '#2e6f7e' }}><i style={{ background: '#2e6f7e' }} />N₂O₄</span>
              <span className="muted-leg">점선: 이론 평형값 (NO₂ {Math.round(total - 2 * eqX)}, N₂O₄ {Math.round(eqX)})</span>
            </span>
          </div>
          <canvas ref={graphRef} className="eq-graph" />
        </div>
        <div className="conc-line">
          [NO₂] = {sci(cNO2, 2)} M · [N₂O₄] = {sci(cN2O4, 2)} M · 용기 부피 {V.toFixed(2)} L
        </div>
      </div>

      <ScaleNote items={[
        `NO₂ 그림 1개 = ${sci(MOL_PER_UNIT, 1)} mol (N₂O₄ 그림 1개 = 그 절반의 몰수), 부피 배율 1.00 = 1 L`,
        '용기 넓이 ∝ 부피 (최대 1.8 L 일 때 바깥 점선 크기)',
        `평형 조성: CRC 표준 생성 엔탈피·엔트로피로 구한 Kc(T)와 같아지도록 역반응 속도 상수를 맞춤 (ΔH° = −${(N2O4_DH / 1000).toFixed(1)} kJ, ΔS° = −${N2O4_DS.toFixed(1)} J/K, 온도와 무관하다고 가정)`,
        '반응 속도 값과 평형에 도달하는 빠르기는 화면용 — 실제 반응 속도와 무관',
        '분자 움직임: 실제 속력은 √T 에 비례하지만 눈에 잘 띄도록 T 에 비례하게 과장',
        '기체 색 진하기 ∝ [NO₂] (분자 수 ÷ 부피)',
        '분자 수가 적어 값이 출렁이므로 Q 는 평균적으로 K 근처에서 오르내림',
      ]} />
    </div>
  );
}
