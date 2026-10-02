import { useRef, useState } from 'react';
import { Slider, SimLayout, ScaleNote, Readout, LineChart, useAnimationFrame, sci } from './common.jsx';
import { WATER_VP, R, interp } from '../data/crc.js';

/* =========================================================
   가역 반응과 동적 평형 — 밀폐 용기 속 물의 증발과 응축
   H₂O(l) ⇌ H₂O(g)
   - 증발 속도(정반응)는 온도로만 정해지고 (포화 증기압 P° 에 비례),
     응축 속도(역반응)는 지금 수증기 압력 P 에 비례.
     (분자 운동론: 표면을 드나드는 분자 수 ∝ 압력 ÷ √T)
   - 그래서 P 가 CRC 포화 증기압 P° 에 도달하면 두 속도가 같아져 동적 평형.
   - 그래프는 교과서처럼 '25 °C 증발 속도 = 1' 인 상댓값으로 그림.
   ========================================================= */

// ── 실제 데이터와 연결되는 값
const LN_WATER_VP = WATER_VP.map(([t, p]) => [t, Math.log(p)]);
const pVap = (t) => Math.exp(interp(LN_WATER_VP, t)); // 물의 포화 증기압 (kPa), CRC 표를 ln P 로 보간
const V_GAS = 1; // 플라스크 안 빈 공간(기체가 차지하는 부피) = 1 L 로 가정
const MOL_PER_GAS = 2e-4; // 기체 분자 그림 1개 = 2×10⁻⁴ mol
const M_WATER = 18.015; // 물의 몰질량 (g/mol)
const toK = (t) => t + 273.15;
// 수증기 압력 P (kPa) → 기체 분자 그림 개수 (n = PV/RT, kPa·L = J)
const gasCountOf = (P, t) => (P * V_GAS) / (R * toK(t)) / MOL_PER_GAS;
const pressureOf = (n, t) => (n * MOL_PER_GAS * R * toK(t)) / V_GAS;
// 표면을 드나드는 속도 ∝ P ÷ √T, 25 °C 포화 증기압일 때를 1 로 맞춘 상댓값
const REL0 = pVap(25) / Math.sqrt(toK(25));
const relRate = (P, t) => P / Math.sqrt(toK(t)) / REL0;

// ── 화면용 값 (실제 속도와 무관)
const K0 = 0.2; // 평형에 다가가는 빠르기 (1/초, 25 °C 기준)
const kOf = (t) => K0 * Math.sqrt(toK(t) / toK(25)); // 표면을 드나드는 빠르기 ∝ √T
const GAS_SPEED = 200; // 25 °C 기체 분자 그림 속력 (px/초), 실제처럼 √T 에 비례
const LIQ_SPEED = 30; // 액체 분자의 흔들림 속력 (px/초)
const N_TOTAL = 260; // 전체 물 분자 그림 수
const WINDOW = 30; // 그래프에 보이는 시간 폭 (초)
const T_MIN = 20, T_MAX = 90;

// ── 플라스크 그림
const W = 440, H = 420;
const cx = W / 2, cy = 258, RAD = 148; // 둥근 플라스크 중심과 반지름
const SURFACE0 = cy + 40; // 분자가 모두 액체일 때 수면 높이
const NECK_TOP = 62, NECK_HALF = 32;
const MR = 3.6; // 산소 원자 그림 반지름
const COLL_D = 8.4, COLL_D2 = COLL_D * COLL_D; // 분자끼리 부딪히는 거리
const COL_LIQ = '#2f80ed', COL_GAS = '#f2994a'; // 액체·기체 분자 색 (그래프의 응축·증발 색과 같음)

// 액체 부분(원의 아랫부분) 넓이: 수면이 중심에서 s 만큼 아래일 때
function segArea(s) {
  return RAD * RAD * (Math.PI / 2) - s * Math.sqrt(RAD * RAD - s * s) - RAD * RAD * Math.asin(Math.max(-1, Math.min(1, s / RAD)));
}
const AREA_FULL = segArea(SURFACE0 - cy);
// 액체 분자 수에 맞는 수면 높이 (넓이가 분자 수에 비례하도록 반씩 좁혀 가며 찾기)
function surfaceFor(liq) {
  const target = AREA_FULL * (liq / N_TOTAL);
  let lo = -RAD, hi = RAD;
  for (let k = 0; k < 26; k++) { const mid = (lo + hi) / 2; if (segArea(mid) > target) lo = mid; else hi = mid; }
  return cy + (lo + hi) / 2;
}

const rand = (a, b) => a + Math.random() * (b - a);

// 처음 상태 만들기. vapor = 시작할 때 들어 있는 기체 분자 수
function makeState(vapor, t) {
  const nGas = Math.round(vapor);
  const surfaceY = surfaceFor(N_TOTAL - nGas);
  const mols = [];
  for (let i = 0; i < N_TOTAL; i++) {
    const gas = i < nGas;
    let x, y;
    for (let k = 0; k < 200; k++) { // 액체면 수면 아래, 기체면 수면 위의 아무 곳
      x = cx + rand(-1, 1) * (RAD - 8);
      y = gas ? rand(cy - RAD + 8, surfaceY - 4) : rand(surfaceY + 2, cy + RAD - 6);
      if ((x - cx) ** 2 + (y - cy) ** 2 <= (RAD - 8) ** 2) break;
    }
    const sp = gas ? GAS_SPEED * Math.sqrt(toK(t) / toK(25)) : LIQ_SPEED;
    const a = rand(0, Math.PI * 2);
    mols.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, gas, angle: rand(0, 6.28), spin: rand(-3, 3) });
  }
  return { mols, surfaceY, n: vapor, time: 0, hist: [], lastRec: -1, eqTime: null, hold: 0, hitRate: 0.4 };
}

export default function DynamicEquilibrium() {
  const [temp, setTemp] = useState(60); // °C
  const [running, setRunning] = useState(true);
  const canvasRef = useRef(null);
  const sim = useRef(null);
  if (!sim.current) sim.current = makeState(0, 60);
  const [view, setView] = useState({ time: 0, liq: N_TOTAL, gas: 0, n: 0, hist: [], eqTime: null });
  const lastView = useRef(0);

  // ----- 한 장면만큼 시간 진행
  function step(dt) {
    const s = sim.current;
    const k = kOf(temp);
    const nEq = gasCountOf(pVap(temp), temp); // 평형일 때 기체 분자 수 (CRC 포화 증기압으로 계산)

    // (1) 거시적 변화: dn/dt = k·(n평형 − n)  ⇔  증발 속도 − 응축 속도
    s.n = nEq + (s.n - nEq) * Math.exp(-k * dt);
    s.time += dt;

    // (2) 수면 높이: 액체 분자 수에 맞게 천천히 움직임
    let liq = 0;
    for (const m of s.mols) if (!m.gas) liq++;
    s.surfaceY += (surfaceFor(liq) - s.surfaceY) * Math.min(1, dt * 4);
    const sy = s.surfaceY;

    // 기체 분자 속력을 온도에 맞춤 (실제처럼 속력 ∝ √T)
    const vT = GAS_SPEED * Math.sqrt(toK(temp) / toK(25));
    let vSum = 0, gasN = 0;
    for (const m of s.mols) if (m.gas) { vSum += Math.hypot(m.vx, m.vy); gasN++; }
    const fix = gasN ? 1 + (vT / (vSum / gasN) - 1) * Math.min(1, dt * 3) : 1;

    // 수면에 부딪힌 기체 분자가 액체로 붙을 확률 (거시적 응축 속도와 맞도록 조정)
    const stick = Math.min(1, k / Math.max(1e-3, s.hitRate));
    let hits = 0;

    // (3) 분자 이동 + 응축
    for (const m of s.mols) {
      m.angle += m.spin * dt;
      if (m.gas) { m.vx *= fix; m.vy *= fix; }
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.gas) {
        if (m.y >= sy - 1) {
          hits++;
          if (Math.random() < stick) { // 응축: 액체가 됨
            m.gas = false;
            m.y = sy + rand(2, 6);
            const a = rand(0, Math.PI * 2);
            m.vx = Math.cos(a) * LIQ_SPEED; m.vy = Math.abs(Math.sin(a)) * LIQ_SPEED;
            m.spin = rand(-2, 2);
          } else { // 튕겨 나감
            m.y = sy - 2; m.vy = -Math.abs(m.vy);
          }
        }
      } else if (m.y < sy + 1) { m.y = sy + 1; m.vy = Math.abs(m.vy); }
      // 플라스크 벽에서 튕김
      const dx = m.x - cx, dy = m.y - cy, d = Math.hypot(dx, dy), lim = RAD - (m.gas ? MR : 4);
      if (d > lim) {
        const nx = dx / d, ny = dy / d, dot = m.vx * nx + m.vy * ny;
        if (dot > 0) { m.vx -= 2 * dot * nx; m.vy -= 2 * dot * ny; }
        m.x = cx + nx * lim; m.y = cy + ny * lim;
        if (m.gas && m.y > sy - 2) m.y = sy - 2;
        if (!m.gas && m.y < sy + 1) m.y = sy + 1;
      }
    }
    // 기체 분자 1개가 1초에 수면에 부딪히는 횟수 (2초 평균)
    if (gasN > 0) s.hitRate += (hits / (gasN * dt) - s.hitRate) * Math.min(1, dt / 2);

    // (4) 증발: 기체 분자 그림 수가 거시적 값 n 을 따라가도록 수면 근처 분자를 띄움
    //     평형에서는 방금 응축한 수만큼 다시 증발 → 증발 = 응축
    let gasNow = 0;
    for (const m of s.mols) if (m.gas) gasNow++;
    let need = Math.round(s.n) - gasNow;
    while (need > 0) {
      let best = null;
      for (let t = 0; t < 24; t++) {
        const m = s.mols[(Math.random() * s.mols.length) | 0];
        if (!m.gas && (!best || m.y < best.y)) best = m;
      }
      if (!best) break;
      best.gas = true;
      best.y = sy - 2;
      const a = -Math.PI / 2 + rand(-0.9, 0.9);
      best.vx = Math.cos(a) * vT; best.vy = Math.sin(a) * vT;
      best.spin = rand(-7, 7);
      need--;
    }

    // (5) 분자끼리 부딪힘 (기체끼리, 액체끼리)
    const gas = [], liquid = [];
    for (const m of s.mols) (m.gas ? gas : liquid).push(m);
    collide(gas, true, sy); collide(liquid, false, sy);

    // (6) 속도 기록과 평형 판정
    const e = relRate(pVap(temp), temp);
    const c = relRate(pressureOf(s.n, temp), temp);
    const diff = Math.abs(e - c) / e;
    if (diff < 0.02) {
      s.hold += dt;
      if (s.hold > 1 && s.eqTime == null) s.eqTime = s.time; // 1초 동안 거의 같으면 평형
    } else if (diff > 0.05) { s.hold = 0; s.eqTime = null; }
    if (s.time - s.lastRec >= 0.1) {
      s.lastRec = s.time;
      s.hist.push([s.time, e, c]);
      while (s.hist.length && s.hist[0][0] < s.time - WINDOW) s.hist.shift();
    }
  }

  function collide(arr, isGas, sy) {
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i];
      for (let j = i + 1; j < arr.length; j++) {
        const b = arr[j];
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= COLL_D2 || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        const vrel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (vrel > 0) { a.vx -= vrel * nx; a.vy -= vrel * ny; b.vx += vrel * nx; b.vy += vrel * ny; } // 속도 맞바꿈
        const o = (COLL_D - d) / 2; // 겹친 만큼 떼어 놓기
        a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
        for (const m of [a, b]) { if (isGas) m.y = Math.min(m.y, sy - 2); else m.y = Math.max(m.y, sy + 1); }
      }
    }
  }

  // ----- 그리기
  function draw() {
    const s = sim.current, ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    // 플라스크 안쪽
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, RAD, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#f7f9fc'; ctx.fillRect(cx - RAD, cy - RAD, RAD * 2, RAD * 2);
    ctx.fillStyle = 'rgba(47,128,237,0.13)'; ctx.fillRect(cx - RAD, s.surfaceY, RAD * 2, cy + RAD - s.surfaceY);
    ctx.strokeStyle = 'rgba(47,128,237,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - RAD, s.surfaceY); ctx.lineTo(cx + RAD, s.surfaceY); ctx.stroke();
    for (const m of s.mols) drawWater(ctx, m);
    ctx.restore();
    // 플라스크 목, 몸통, 마개
    const neckBottom = cy - Math.sqrt(RAD * RAD - NECK_HALF * NECK_HALF);
    ctx.fillStyle = '#f7f9fc'; ctx.fillRect(cx - NECK_HALF, NECK_TOP, NECK_HALF * 2, neckBottom - NECK_TOP + 2);
    ctx.strokeStyle = '#334'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - NECK_HALF, NECK_TOP); ctx.lineTo(cx - NECK_HALF, neckBottom);
    ctx.moveTo(cx + NECK_HALF, NECK_TOP); ctx.lineTo(cx + NECK_HALF, neckBottom);
    ctx.stroke();
    const gap = Math.asin(NECK_HALF / RAD);
    ctx.beginPath(); ctx.arc(cx, cy, RAD, -Math.PI / 2 + gap, -Math.PI / 2 - gap + Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#8a94a6'; ctx.fillRect(cx - NECK_HALF - 6, NECK_TOP - 22, (NECK_HALF + 6) * 2, 24);
    ctx.fillStyle = '#334'; ctx.font = '12px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('마개 (밀폐)', cx, NECK_TOP - 28);
  }

  // 물 분자: 산소(색 공) + 수소 2개(흰 공)
  function drawWater(ctx, m) {
    const col = m.gas ? COL_GAS : COL_LIQ;
    for (const a of [-0.92, 0.92]) {
      ctx.beginPath(); ctx.arc(m.x + Math.cos(m.angle + a) * MR * 1.25, m.y + Math.sin(m.angle + a) * MR * 1.25, MR * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 0.8; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(m.x, m.y, MR, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
  }

  useAnimationFrame((dt) => {
    // 한 번에 너무 크게 움직이지 않도록 잘게 나눠 계산
    const n = Math.ceil(dt / 0.02);
    for (let i = 0; i < n; i++) step(dt / n);
    draw();
    const s = sim.current;
    if (s.time - lastView.current > 0.1 || s.time < lastView.current) {
      lastView.current = s.time;
      let gas = 0;
      for (const m of s.mols) if (m.gas) gas++;
      setView({ time: s.time, liq: N_TOTAL - gas, gas, n: s.n, hist: s.hist.slice(), eqTime: s.eqTime });
    }
  }, running);

  const reset = (vapor) => {
    sim.current = makeState(vapor, temp);
    lastView.current = -1;
    setView({ time: 0, liq: N_TOTAL - Math.round(vapor), gas: Math.round(vapor), n: vapor, hist: [], eqTime: null });
    setRunning(true);
    requestAnimationFrame(() => canvasRef.current && draw());
  };

  // ----- 화면 표시용 계산 (실제 단위)
  const P0 = pVap(temp); // 포화 증기압 (CRC)
  const P = pressureOf(view.n, temp); // 지금 수증기 압력
  const eNow = relRate(P0, temp), cNow = relRate(P, temp);
  const nEq = gasCountOf(P0, temp);
  const molGas = view.n * MOL_PER_GAS;
  const isEq = view.eqTime != null;

  const t1 = Math.max(WINDOW, view.time), t0 = t1 - WINDOW;
  const yTop = Math.max(2, Math.ceil(Math.max(eNow, ...view.hist.map((h) => Math.max(h[1], h[2]))) * 1.25));
  const series = [
    { label: '증발 속도 (정반응)', color: COL_GAS, points: view.hist.map(([t, e]) => [t, e]) },
    { label: '응축 속도 (역반응)', color: COL_LIQ, points: view.hist.map(([t, , c]) => [t, c]) },
  ];
  const vLines = isEq && view.eqTime >= t0 ? [{ x: view.eqTime, color: '#27ae60', label: '동적 평형' }] : [];

  return (
    <SimLayout
      canvas={<>
        <canvas ref={canvasRef} width={W} height={H} />
        <div className="legend small">
          <span><i className="dot" style={{ background: COL_LIQ }} /> 액체 물 분자 {view.liq}개</span>
          <span><i className="dot" style={{ background: COL_GAS }} /> 기체(수증기) 분자 {view.gas}개</span>
        </div>
        <LineChart height={260} series={series} vLines={vLines}
          xDomain={[t0, t1]} xTicks={6} yDomain={[0, yTop]} yTicks={4}
          xFormat={(v) => Math.round(v)} yFormat={(v) => +v.toFixed(1)}
          xLabel="시간 (화면 초)" yLabel="반응 속도 (상댓값)" />
      </>}
      controls={<>
        <div className="eq-eqn">H₂O(l) ⇌ H₂O(g)</div>
        <Slider label="온도" value={temp} min={T_MIN} max={T_MAX} unit=" °C" onChange={setTemp} />
        <div className={`feedback ${isEq ? 'ok' : ''}`}>
          {isEq
            ? '동적 평형: 증발 속도 = 응축 속도. 겉보기 변화는 없지만 증발과 응축은 계속 일어납니다.'
            : P < P0 ? '증발 속도 > 응축 속도 → 수증기가 늘어나는 중' : '응축 속도 > 증발 속도 → 수증기가 줄어드는 중'}
        </div>
        <Readout rows={[
          ['포화 증기압 P° (CRC)', `${P0.toFixed(2)} kPa`],
          ['지금 수증기 압력 P', `${P.toFixed(2)} kPa`],
          ['증발 속도 (상댓값)', eNow.toFixed(2)],
          ['응축 속도 (상댓값)', cNow.toFixed(2)],
          ['수증기 양 (빈 공간 1 L)', `${sci(molGas, 2)} mol (${(molGas * M_WATER * 1000).toFixed(0)} mg)`],
        ]} />
        <div className="btn-row">
          <button className="btn" type="button" onClick={() => setRunning((r) => !r)}>{running ? '⏸ 일시정지' : '▶ 재생'}</button>
          <button className="btn btn-ghost" type="button" onClick={() => reset(0)}>↺ 진공에서 시작</button>
          <button className="btn btn-ghost" type="button" onClick={() => reset(Math.min(2 * nEq, N_TOTAL - 110))}>수증기 많이 넣고 시작</button>
        </div>
        <p className="small muted">
          처음에는 수증기가 없어 응축이 일어나지 않습니다. 증발이 계속되면 수증기가 늘어 응축 속도가 커지고,
          수증기 압력이 포화 증기압에 이르면 두 속도가 같아집니다. 수증기를 많이 넣고 시작해도 같은 평형에 도달합니다(가역 반응).
        </p>
      </>}
      footer={<ScaleNote items={[
        '평형 수증기 압력 = CRC 물의 포화 증기압 표(6-5)를 ln P 기준으로 보간한 값',
        `기체 분자 그림 1개 = ${sci(MOL_PER_GAS, 1)} mol, 플라스크 빈 공간 1 L 가정 (n = PV/RT) — 예: ${temp} °C 평형에서 ${nEq.toFixed(0)}개`,
        `액체 분자 그림 ${N_TOTAL}개는 축척 없음: 실제로는 액체(예: 물 100 mL = 5.6 mol)가 수증기보다 수백~수천 배 많아 수면이 거의 내려가지 않음`,
        '증발·응축 속도: 분자 운동론에 따라 (압력 ÷ √T)에 비례하게 계산하고, 25 °C 포화 상태의 증발 속도를 1 로 둔 상댓값',
        '평형에 도달하는 빠르기(가로축 시간)는 화면용 — 실제 시간과 무관',
        '기체 분자 그림 속력 ∝ √T (25 °C = 200 px/초), 분자 크기는 실제와 무관',
        '평형 판정: 두 속도 차이가 2 % 미만으로 1초 동안 유지될 때',
      ]} />}
    />
  );
}
