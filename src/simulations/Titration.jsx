import { useMemo, useRef, useState } from 'react';
import { Slider, Select, SimLayout, ScaleNote, Readout, LineChart, Segmented, useAnimationFrame, bisect, sci } from './common.jsx';
import { ACIDS, INDICATORS, PKW, interp } from '../data/crc.js';

/* =========================================================
   중화 반응과 중화 적정
   - pH 는 CRC 의 Kw·Ka 로 전하 균형을 풀어 계산 (예전과 같음)
   - 새로 추가: 삼각 플라스크 속 용액 전체를 확대한 '입자 창'
     · 입자 그림 1개 = 1.0 × 10⁻⁴ mol  (0.1 M NaOH 1 mL 를 넣으면 Na⁺ 1개 + OH⁻ 1개)
     · 산 HA 와 OH⁻ 가 만나 물(H₂O)이 생기고, Na⁺·Cl⁻ 같은 구경꾼 이온은 그대로 남는 모습을 보여 줌
   ========================================================= */

const KW = 10 ** -interp(PKW, 25);
const VA = 20; // 분석할 산 용액 (mL)
const CB = 0.1; // 표준 NaOH (M)
const MAX_VB = 50;
const MOL_PER_PARTICLE = 1e-4; // 입자 그림 1개가 나타내는 실제 양 (mol)

// 산이 H⁺ 를 내놓고 남는 음이온 (짝염기) 이름
const ANION = { HCl: 'Cl⁻', HNO2: 'NO₂⁻', HF: 'F⁻', HCOOH: 'HCOO⁻', CH3COOH: 'CH₃COO⁻', H2CO3: 'HCO₃⁻', HClO: 'ClO⁻', HCN: 'CN⁻' };

// 산 HA(Ca, Va) 에 NaOH(Cb, Vb) 를 넣었을 때 pH: 전하 균형 [H⁺] + [Na⁺] = [OH⁻] + [A⁻]
function pHAt(Ca, Ka, vb) {
  const V = VA + vb, CA = (Ca * VA) / V, Na = (CB * vb) / V;
  const l = bisect((x) => { const h = Math.exp(x); return h + Na - KW / h - (CA * Ka) / (h + Ka); }, Math.log(1e-14), Math.log(10));
  return -Math.log10(Math.exp(l));
}

// 지금 용액 속 각 입자의 실제 양 (mol) — pH 계산과 같은 식에서 나옴
function realAmounts(Ca, Ka, strong, vb) {
  const V = (VA + vb) / 1000; // 전체 부피 (L)
  const h = 10 ** -pHAt(Ca, Ka, vb);
  const nAcid = (Ca * VA) / 1000, nBase = (CB * vb) / 1000;
  const oh = (KW / h) * V;
  const fA = strong ? 1 : Ka / (h + Ka); // 산 가운데 이온(A⁻)으로 있는 비율
  return {
    H: h * V, OH: oh, Na: nBase, A: nAcid * fA, HA: nAcid * (1 - fA),
    W: Math.max(0, nBase - oh), // 중화로 생긴 물 = 넣은 OH⁻ 가운데 없어진 양
  };
}

// 화면에 그릴 입자 개수 (정수). 실제 양 ÷ 1.0×10⁻⁴ mol 을 반올림하되, 개수가 서로 맞도록 정리
function particleTargets(Ca, Ka, strong, vb) {
  const a = Math.round((Ca * VA) / 1000 / MOL_PER_PARTICLE); // 처음 넣은 산 입자 수
  const b = Math.round((CB * vb) / 1000 / MOL_PER_PARTICLE); // 지금까지 넣은 NaOH 입자 수 (= Na⁺ 수)
  const W = Math.min(a, b); // 중화로 생긴 물 분자 수
  const OH = Math.max(0, b - a); // 산을 다 쓰고 남은 OH⁻
  let H, A;
  if (strong) { H = Math.max(0, a - b); A = a; } // 강산: 남은 산은 모두 H⁺ + Cl⁻
  else {
    const hReal = Math.round(realAmounts(Ca, Ka, strong, vb).H / MOL_PER_PARTICLE); // 약산: 이온화한 것만 H⁺
    H = b < a ? Math.min(a - b, hReal) : 0;
    A = W + H;
  }
  return { H, OH, Na: b, A, HA: a - A, W };
}

function mix(c1, c2, t) {
  const p = (c) => c.startsWith('#') ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)).concat(1) : c.match(/[\d.]+/g).map(Number);
  const a = p(c1), b = p(c2);
  return `rgba(${a.slice(0, 4).map((v, i) => (i < 3 ? Math.round(v + (b[i] - v) * t) : (v + (b[i] - v) * t).toFixed(2))).join(',')})`;
}
function indicatorColor(ind, pH) {
  const [lo, hi] = ind.range;
  const t = Math.min(1, Math.max(0, (pH - lo) / (hi - lo)));
  return mix(ind.acid, ind.base, t);
}

// ── 입자 창 (용액 전체를 확대한 그림)
const PW = 440, PH = 460; // 그림판 크기 (px)
const BOX_L = 20, BOX_R = 420, BOX_TOP = 18, BOX_BOT = 446; // 용기 벽
const PX_PER_ML = 6; // 용액 1 mL = 높이 6 px → 20 mL 는 120 px, 70 mL 는 420 px
const levelOf = (vb) => BOX_BOT - (VA + vb) * PX_PER_ML; // 수면 높이
const WANDER = 34; // 입자가 떠도는 속력 (px/초, 화면용)
const MEET = 160; // 반응하러 서로 다가가는 속력 (px/초, 화면용)

// 입자 종류별 모양과 색
const LOOK = {
  H: { r: 5, color: '#eb5757', sign: '+', name: 'H⁺' },
  OH: { r: 7, color: '#2f80ed', sign: '−', name: 'OH⁻' },
  Na: { r: 7, color: '#9b51e0', sign: '+', name: 'Na⁺' },
  A: { r: 8, color: '#27ae60', sign: '−' },
  HA: { r: 8, color: '#27ae60', sign: '' },
  W: { r: 6, color: '#56ccf2', sign: '' },
};

const rand = (a, b) => a + Math.random() * (b - a);

// 용액 속 아무 곳에 입자 하나 만들기
function makeParticle(type, level, x, y) {
  const a = rand(0, Math.PI * 2);
  return {
    type, x: x ?? rand(BOX_L + 10, BOX_R - 10), y: y ?? rand(level + 10, BOX_BOT - 10),
    vx: Math.cos(a) * WANDER, vy: Math.sin(a) * WANDER, angle: rand(0, 6.28), spin: rand(-2, 2),
    partner: null, // 반응할 짝
    age: 99, // 막 생긴 물 분자를 빛나게 하려고 쓰는 시간
  };
}

// 목표 개수대로 입자를 처음부터 다시 배치
function buildParticles(t, level) {
  const list = [];
  for (const type of ['HA', 'H', 'A', 'Na', 'OH', 'W']) for (let i = 0; i < t[type]; i++) list.push(makeParticle(type, level));
  return list;
}

export default function Titration() {
  const [mode, setMode] = useState('learn');
  const [acidId, setAcidId] = useState('CH3COOH');
  const [Ca, setCa] = useState(0.1);
  const [indId, setIndId] = useState('pp');
  const [vb, setVb] = useState(0);
  const [flow, setFlow] = useState(0); // mL/s
  const [unknown, setUnknown] = useState(() => 0.05 + Math.round(Math.random() * 10) / 100);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);
  const vbRef = useRef(0);

  const acid = ACIDS.find((a) => a.id === acidId);
  const Ka = acid.strong ? 1e8 : 10 ** -acid.pKa;
  const conc = mode === 'unknown' ? unknown : Ca;
  const ind = INDICATORS.find((i) => i.id === indId);
  const pH = pHAt(conc, Ka, vb);
  const veq = (conc * VA) / CB;

  const curve = useMemo(() => Array.from({ length: 201 }, (_, i) => [i * MAX_VB / 200, pHAt(conc, Ka, i * MAX_VB / 200)]), [conc, Ka]);
  const [measured, setMeasured] = useState([]);

  // ----- 입자 창 상태 (화면을 다시 그릴 때마다 새로 만들지 않도록 ref 에 보관)
  const canvasRef = useRef(null);
  const sim = useRef({ list: [], flashes: [], key: '', vb: -1, drop: null });
  const [counts, setCounts] = useState({ H: 0, OH: 0, Na: 0, A: 0, HA: 0, W: 0 });
  const lastCount = useRef(0);
  const flaskColor = indicatorColor(ind, pH);
  const live = { conc, Ka, strong: !!acid.strong, flaskColor, flow };

  // 한 장면만큼 입자 움직이기
  function stepParticles(dt) {
    const s = sim.current;
    const v = vbRef.current;
    const level = levelOf(v);
    const t = particleTargets(live.conc, live.Ka, live.strong, v);
    const key = `${live.conc}|${live.Ka}`;
    // 산을 바꾸거나 처음부터 다시 하면 새로 배치
    if (s.key !== key || v < s.vb - 1e-9) {
      s.list = buildParticles(t, level); s.flashes = []; s.key = key;
    }
    s.vb = v;
    const L = s.list;
    const count = (type) => L.reduce((n, p) => n + (p.type === type), 0);

    // (1) NaOH 가 들어오면: Na⁺ 와 OH⁻ 가 한 쌍씩 수면 (뷰렛 아래) 으로 떨어짐
    let addNa = t.Na - count('Na');
    while (addNa-- > 0) {
      const x0 = (BOX_L + BOX_R) / 2;
      for (const type of ['Na', 'OH']) {
        const p = makeParticle(type, level, x0 + rand(-14, 14), level + 4);
        p.vx = rand(-30, 30); p.vy = rand(40, 70); // 아래로 퍼져 들어감
        L.push(p);
      }
      s.drop = 0.35; // 방울이 떨어지는 모습
    }

    // (2) 약산이 이온화해야 하면: HA → H⁺ + A⁻ (거의 일어나지 않음)
    const freeOf = (type) => L.filter((p) => p.type === type && !p.partner);
    if (count('H') < t.H) {
      const ha = freeOf('HA')[0];
      if (ha) { ha.type = 'A'; const h = makeParticle('H', level, ha.x + 9, ha.y); L.push(h); }
    }

    // (3) 남아야 할 개수보다 많은 OH⁻ 는 산을 찾아가 반응 → 물
    const pendingOH = L.filter((p) => p.type === 'OH' && p.partner).length;
    let excess = count('OH') - t.OH - pendingOH;
    while (excess > 0) {
      const oh = freeOf('OH')[0];
      if (!oh) break;
      // 짝: 강산이면 H⁺, 약산이면 대부분 HA 분자 (H⁺ 가 있으면 H⁺ 먼저)
      const pendH = L.filter((p) => p.type === 'H' && p.partner).length;
      const pendHA = L.filter((p) => p.type === 'HA' && p.partner).length;
      let pool = count('H') - pendH > t.H ? freeOf('H') : count('HA') - pendHA > t.HA ? freeOf('HA') : [];
      if (!pool.length) break;
      // 가장 가까운 짝 고르기
      let best = pool[0], bd = Infinity;
      for (const p of pool) { const d = (p.x - oh.x) ** 2 + (p.y - oh.y) ** 2; if (d < bd) { bd = d; best = p; } }
      oh.partner = best; best.partner = oh;
      excess--;
    }
    // (3-1) 약산: H⁺ 가 남아야 할 개수보다 많으면 A⁻ 와 다시 만나 HA 분자가 됨 (반대 방향 반응)
    if (excess <= 0 && !live.strong) {
      const pendH = L.filter((p) => p.type === 'H' && p.partner).length;
      if (count('H') - pendH > t.H) {
        const h = freeOf('H')[0], a = freeOf('A')[0];
        if (h && a) { h.partner = a; a.partner = h; }
      }
    }

    // (4) 움직이기
    for (const p of L) {
      p.angle += p.spin * dt;
      p.age += dt;
      if (p.partner) { // 짝을 향해 다가감
        const q = p.partner, dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
        p.vx = (dx / d) * MEET; p.vy = (dy / d) * MEET;
      } else { // 이리저리 떠돌기 (브라운 운동처럼)
        p.vx += rand(-1, 1) * 160 * dt; p.vy += rand(-1, 1) * 160 * dt;
        const sp = Math.hypot(p.vx, p.vy) || 1, want = p.type === 'W' && p.age < 0.6 ? WANDER * 0.3 : WANDER;
        const k = 1 + (want / sp - 1) * Math.min(1, dt * 2);
        p.vx *= k; p.vy *= k;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const r = LOOK[p.type].r + 2;
      if (p.x < BOX_L + r) { p.x = BOX_L + r; p.vx = Math.abs(p.vx); }
      if (p.x > BOX_R - r) { p.x = BOX_R - r; p.vx = -Math.abs(p.vx); }
      if (p.y < level + r) { p.y = level + r; p.vy = Math.abs(p.vy); }
      if (p.y > BOX_BOT - r) { p.y = BOX_BOT - r; p.vy = -Math.abs(p.vy); }
    }

    // (5) 짝끼리 닿으면 반응
    for (const oh of L.filter((p) => p.type === 'OH' && p.partner)) {
      const q = oh.partner;
      if (Math.hypot(q.x - oh.x, q.y - oh.y) > 13) continue;
      const mx = (oh.x + q.x) / 2, my = (oh.y + q.y) / 2;
      // OH⁻ 는 H 를 받아 물 분자가 됨
      oh.type = 'W'; oh.partner = null; oh.age = 0; oh.x = mx; oh.y = my;
      if (q.type === 'H') { // H⁺ + OH⁻ → H₂O : H⁺ 는 물 속으로 들어가 사라짐
        q.dead = true;
      } else { // HA + OH⁻ → A⁻ + H₂O : HA 는 H 를 주고 A⁻ 가 됨
        q.type = 'A'; q.partner = null;
        const a = rand(0, Math.PI * 2); q.vx = Math.cos(a) * WANDER; q.vy = Math.sin(a) * WANDER;
      }
      s.flashes.push({ x: mx, y: my, t: 0 });
    }
    for (const h of L.filter((p) => p.type === 'H' && p.partner?.type === 'A')) {
      const a = h.partner;
      if (Math.hypot(a.x - h.x, a.y - h.y) > 13) continue;
      h.dead = true; a.type = 'HA'; a.partner = null; // H⁺ + A⁻ → HA
    }
    s.list = L.filter((p) => !p.dead);
    s.flashes = s.flashes.filter((f) => (f.t += dt) < 0.7);
    if (s.drop != null) { s.drop -= dt; if (s.drop <= 0) s.drop = null; }
  }

  // 입자 창 그리기
  function drawParticles() {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d'), s = sim.current;
    const level = levelOf(vbRef.current);
    ctx.clearRect(0, 0, PW, PH);
    // 용액 (지시약 색을 옅게 입힘)
    ctx.fillStyle = '#f2f7ff'; ctx.fillRect(BOX_L, level, BOX_R - BOX_L, BOX_BOT - level);
    ctx.globalAlpha = 0.28; ctx.fillStyle = live.flaskColor; ctx.fillRect(BOX_L, level, BOX_R - BOX_L, BOX_BOT - level);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(47,128,237,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(BOX_L, level); ctx.lineTo(BOX_R, level); ctx.stroke();
    // 용기 벽
    ctx.strokeStyle = '#556'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(BOX_L, BOX_TOP); ctx.lineTo(BOX_L, BOX_BOT); ctx.lineTo(BOX_R, BOX_BOT); ctx.lineTo(BOX_R, BOX_TOP); ctx.stroke();
    // 위에서 떨어지는 NaOH 방울
    const x0 = (BOX_L + BOX_R) / 2;
    if (live.flow > 0 || s.drop != null) {
      const ph = ((performance.now() / 600) % 1);
      ctx.fillStyle = 'rgba(127,179,255,0.9)';
      ctx.beginPath(); ctx.arc(x0, BOX_TOP - 6 + ph * (level - BOX_TOP), 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#556'; ctx.font = '11px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('▼ NaOH 방울', x0, 12);
    // 반응 순간 번쩍임
    for (const f of s.flashes) {
      ctx.strokeStyle = `rgba(242,153,74,${1 - f.t / 0.7})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(f.x, f.y, 8 + f.t * 30, 0, Math.PI * 2); ctx.stroke();
    }
    // 물 분자를 먼저, 이온을 위에 그림
    for (const p of s.list) if (p.type === 'W') drawOne(ctx, p);
    for (const p of s.list) if (p.type !== 'W') drawOne(ctx, p);
  }

  function ball(ctx, x, y, r, fill, stroke) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function drawOne(ctx, p) {
    const look = LOOK[p.type];
    const cx = Math.cos(p.angle), sy = Math.sin(p.angle);
    if (p.type === 'W') { // 물: 산소 + 수소 2개, 막 생기면 테두리 강조
      for (const a of [-0.92, 0.92]) ball(ctx, p.x + Math.cos(p.angle + a) * 7, p.y + Math.sin(p.angle + a) * 7, 3.5, '#fff', look.color);
      ball(ctx, p.x, p.y, look.r, look.color, p.age < 1.5 ? '#f2994a' : null);
      return;
    }
    if (p.type === 'OH') ball(ctx, p.x + cx * 8, p.y + sy * 8, 3.5, '#fff', look.color); // OH⁻ 의 H
    if (p.type === 'HA') ball(ctx, p.x + cx * 9, p.y + sy * 9, 4, '#eb5757'); // HA 에 붙은 H
    ball(ctx, p.x, p.y, look.r, look.color);
    if (p.partner) { ctx.strokeStyle = '#f2994a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, look.r + 2, 0, Math.PI * 2); ctx.stroke(); }
    if (look.sign) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(look.sign, p.x, p.y + 0.5); ctx.textBaseline = 'alphabetic';
    }
  }

  // 매 장면: 뷰렛에서 NaOH 를 흘리고 → 입자 움직이기 → 그리기
  useAnimationFrame((dt) => {
    if (flow > 0) {
      vbRef.current = Math.min(MAX_VB, vbRef.current + flow * dt);
      setVb(vbRef.current);
      setMeasured((m) => (m.length && vbRef.current - m[m.length - 1][0] < 0.1 ? m : [...m, [vbRef.current, pHAt(conc, Ka, vbRef.current)]]));
      if (vbRef.current >= MAX_VB) setFlow(0);
    }
    const n = Math.ceil(dt / 0.02); // 한 번에 너무 많이 움직이지 않도록 잘게 나눔
    for (let i = 0; i < n; i++) stepParticles(dt / n);
    drawParticles();
    const now = performance.now();
    if (now - lastCount.current > 150) {
      lastCount.current = now;
      const c = { H: 0, OH: 0, Na: 0, A: 0, HA: 0, W: 0 };
      for (const p of sim.current.list) c[p.type]++;
      setCounts((o) => (Object.keys(c).some((k) => c[k] !== o[k]) ? c : o));
    }
  }, true);

  const reset = (newUnknown) => {
    vbRef.current = 0; setVb(0); setFlow(0); setMeasured([]); setResult(null); setAnswer('');
    if (newUnknown) setUnknown(0.05 + Math.round(Math.random() * 10) / 100);
  };
  const check = () => {
    const a = Number(answer);
    setResult(Math.abs(a - unknown) / unknown < 0.05 ? `정답! 실제 농도는 ${unknown.toFixed(3)} M` : '다시 생각해 보세요. (오차 5% 이내)');
  };

  const anion = ANION[acidId];
  const real = realAmounts(conc, Ka, !!acid.strong, vb);
  const hide = mode === 'unknown' && !result?.startsWith('정답'); // 미지 시료는 정답 전까지 산의 양을 숨김
  // 범례·표에 쓸 입자 목록
  const species = [
    { k: 'HA', name: `${acid.formula} 분자`, show: !acid.strong },
    { k: 'H', name: 'H⁺' },
    { k: 'OH', name: 'OH⁻' },
    { k: 'A', name: anion },
    { k: 'Na', name: 'Na⁺' },
    { k: 'W', name: '생성된 H₂O' },
  ].filter((x) => x.show !== false);
  const eqn = acid.strong
    ? <>H⁺ + <span style={{ color: LOOK.OH.color }}>OH⁻</span> → H₂O<div className="small muted">구경꾼 이온: {anion}, Na⁺ (반응하지 않고 그대로 남음)</div></>
    : <>{acid.formula} + <span style={{ color: LOOK.OH.color }}>OH⁻</span> → {anion} + H₂O<div className="small muted">약산은 대부분 분자로 있어 OH⁻ 가 분자에서 H⁺ 를 직접 가져감 · 구경꾼 이온: Na⁺</div></>;
  const stage = vb === 0 ? '아직 NaOH 를 넣지 않음' : Math.abs(vb - veq) < 0.25 ? '중화점: 산의 H⁺ 를 OH⁻ 가 모두 써 버림' : vb < veq ? '중화점 전: 넣은 OH⁻ 는 모두 물이 되고, 산이 남음' : '중화점 후: 반응할 산이 없어 OH⁻ 가 쌓임';

  return (
    <SimLayout
      canvas={<>
        <div className="titr-top">
          <div>
            <svg viewBox="0 0 260 330" className="titr-app">
              <rect x="115" y="10" width="30" height="190" fill="#fff" stroke="#556" strokeWidth="2" />
              <rect x="117" y={200 - (1 - vb / MAX_VB) * 180} width="26" height={(1 - vb / MAX_VB) * 180} fill="#cfe3ff" />
              {[0, 10, 20, 30, 40, 50].map((m) => <g key={m}><line x1="145" x2="155" y1={20 + (m / 50) * 180} y2={20 + (m / 50) * 180} stroke="#556" /><text x="158" y={24 + (m / 50) * 180} className="tick">{m}</text></g>)}
              <path d="M125 200 h10 v20 h-10z" fill="#556" />
              <rect x="128" y="220" width="4" height="22" fill="#556" />
              {flow > 0 && <circle cx="130" cy="252" r="3" fill="#7fb3ff" className="drip" />}
              <path d="M100 255 h60 v15 l40 50 a6 6 0 0 1 -5 9 h-130 a6 6 0 0 1 -5 -9 l40 -50z" fill="#fff" stroke="#556" strokeWidth="2" />
              <path d="M74 295 h112 l15 20 a6 6 0 0 1 -5 9 h-132 a6 6 0 0 1 -5 -9z" fill={flaskColor === 'rgba(255,255,255,0)' ? '#f4f8ff' : flaskColor} stroke="none" />
              <text x="168" y="236" className="tick">NaOH {CB} M</text>
              {/* 돋보기: 오른쪽 입자 창이 이 플라스크 속을 확대한 것 */}
              <circle cx="205" cy="300" r="16" fill="none" stroke="#f2994a" strokeWidth="3" />
              <line x1="217" y1="312" x2="232" y2="327" stroke="#f2994a" strokeWidth="4" strokeLinecap="round" />
              <text x="200" y="276" className="tick" fill="#f2994a">확대 →</text>
            </svg>
            <div className="feedback small">{stage}</div>
          </div>
          <div>
            <canvas ref={canvasRef} width={PW} height={PH} />
            <div className="legend small">
              {species.map((x) => (
                <span key={x.k}><i className="dot" style={{ background: LOOK[x.k].color, outline: x.k === 'HA' ? '2px solid #eb5757' : undefined }} /> {x.name}{x.k === 'Na' || (acid.strong && x.k === 'A') ? '(구경꾼)' : ''} {hide && (x.k === 'HA' || x.k === 'A' || x.k === 'H') ? '?' : counts[x.k]}개</span>
              ))}
            </div>
          </div>
        </div>
        <LineChart width={640} height={300} xDomain={[0, MAX_VB]} yDomain={[0, 14]} xTicks={5} yTicks={7}
          series={[
            ...(mode === 'learn' ? [{ label: '이론 곡선', color: '#c5cbe0', points: curve, width: 2, dashed: true }] : []),
            { label: '측정값', color: '#eb5757', points: measured.length ? measured : [[0, pHAt(conc, Ka, 0)]] },
          ]}
          hLines={[{ y: ind.range[0], color: '#bbb' }, { y: ind.range[1], color: '#bbb', label: `${ind.ko} 변색 범위` }]}
          vLines={mode === 'learn' ? [{ x: veq, color: '#27ae60', label: '중화점' }] : []}
          markers={[{ x: vb, y: pH, color: '#eb5757' }]}
          xLabel="넣은 NaOH 부피 (mL)" yLabel="pH" />
      </>}
      controls={<>
        <Segmented value={mode} onChange={(m) => { setMode(m); reset(m === 'unknown'); }}
          options={[{ value: 'learn', label: '적정 곡선 탐구' }, { value: 'unknown', label: '미지 시료 농도' }]} />
        <Select label="산 (20.0 mL)" value={acidId} onChange={(v) => { setAcidId(v); reset(false); }}
          options={ACIDS.map((a) => ({ value: a.id, label: `${a.ko} ${a.strong ? '(강산)' : `pKa ${a.pKa}`}` }))} />
        {mode === 'learn' && <Slider label="산의 농도" value={Ca} min={0.02} max={0.2} step={0.01} unit=" M" onChange={(v) => { setCa(v); reset(false); }} />}
        <Select label="지시약" value={indId} onChange={setIndId}
          options={INDICATORS.map((i) => ({ value: i.id, label: `${i.ko} (pH ${i.range[0]}–${i.range[1]})` }))} />
        <div className="eq-eqn">{eqn}</div>
        <div className="btn-row">
          <button className="btn" onClick={() => setFlow(flow ? 0 : 1)}>{flow ? '멈춤' : '콕 열기'}</button>
          <button className="btn btn-ghost" onClick={() => { vbRef.current = Math.min(MAX_VB, vbRef.current + 0.05); setVb(vbRef.current); setMeasured((m) => [...m, [vbRef.current, pHAt(conc, Ka, vbRef.current)]]); }}>한 방울 (0.05 mL)</button>
          <button className="btn btn-ghost" onClick={() => { vbRef.current = Math.min(MAX_VB, vbRef.current + 1); setVb(vbRef.current); setMeasured((m) => [...m, [vbRef.current, pHAt(conc, Ka, vbRef.current)]]); }}>1 mL</button>
          <button className="btn btn-ghost" onClick={() => reset(false)}>처음부터</button>
        </div>
        <Readout rows={[
          ['넣은 NaOH', `${vb.toFixed(2)} mL`],
          ['pH', pH.toFixed(2)],
          ...(mode === 'learn' ? [['중화점 부피 (계산)', `${veq.toFixed(2)} mL`], ['중화점 pH', pHAt(conc, Ka, veq).toFixed(2)]] : []),
        ]} />
        <div className="subpanel">
          <b>용액 속 입자 (그림 개수 ↔ 실제 양)</b>
          <Readout rows={species.map((x) => [
            x.name,
            hide && (x.k === 'HA' || x.k === 'A' || x.k === 'H') ? '?' : `${counts[x.k]}개 · ${sci(real[x.k], 2)} mol`,
          ])} />
          <p className="small muted">입자 1개 = 1.0 × 10⁻⁴ mol. 0.1 M NaOH 1 mL 를 넣을 때마다 Na⁺ 1개와 OH⁻ 1개가 들어옵니다.
            실제 양이 0.5개 분량보다 적으면 그림에는 나타나지 않습니다 (예: 약산이 이온화해 내놓은 H⁺).</p>
        </div>
        {mode === 'unknown' && (
          <div className="subpanel">
            <b>산의 농도는? (M)</b>
            <p className="small muted">중화점: 산의 mol = NaOH 의 mol → C<sub>산</sub> × 20.0 mL = {CB} M × V<sub>NaOH</sub></p>
            <div className="btn-row">
              <input className="num-input" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="예: 0.085" />
              <button className="btn" onClick={check}>확인</button>
            </div>
            {result && <div className="feedback">{result}</div>}
            <button className="btn btn-ghost" onClick={() => reset(true)}>새 시료</button>
          </div>
        )}
      </>}
      footer={<ScaleNote items={[
        `뷰렛 눈금 0–${MAX_VB} mL 를 180 px 에 표시`,
        '콕을 열면 1 mL/s 로 떨어지도록 화면 속도를 정함 (실제 실험보다 빠름)',
        '지시약 색: CRC 변색 범위 안에서 산성색→염기성색으로 선형 혼합해 표시',
        '입자 창은 삼각 플라스크 속 용액 전체를 확대한 그림: 입자 1개 = 1.0 × 10⁻⁴ mol (실제 입자 수 6.0 × 10¹⁹ 개를 1개로 줄임)',
        `입자 창 용액 높이는 부피에 비례 (1 mL = ${PX_PER_ML} px) — 같은 넓이 속 입자 수가 농도를 나타냄`,
        '각 입자의 실제 양(mol)은 pH 계산과 같은 식(CRC Kw·Ka, 전하 균형)에서 구하고, 그림 개수는 이를 1.0 × 10⁻⁴ mol 로 나누어 반올림',
        '용매인 물 분자는 너무 많아 그리지 않고, 중화 반응으로 새로 생긴 물 분자만 그림',
        'H⁺ 는 실제로 물과 결합한 H₃O⁺ 로 존재하지만 교과서 반응식(H⁺ + OH⁻ → H₂O)에 맞추어 H⁺ 로 나타냄',
        '입자의 크기·움직이는 속력·반응하러 다가가는 속력은 화면용 (실제와 무관)',
      ]} />}
    />
  );
}
