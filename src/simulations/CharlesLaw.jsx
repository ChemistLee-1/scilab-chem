import { useEffect, useRef, useState } from 'react';
import { Slider, Select, SimLayout, ScaleNote, Readout, LineChart, useAnimationFrame } from './common.jsx';
import { R, ATM_KPA, GASES, molarMass } from '../data/crc.js';

/* =========================================================
   샤를 법칙 — 압력이 일정할 때 기체의 부피와 온도 (사용자 제공 '샤를 법칙 시뮬레이션' 내용)
   - 압력·기체의 양을 고정하고 온도를 바꾸면 부피가 V = nRT/P 에 따라 변함
   - 여러 온도에서 기록 → 그래프 + 추세선(직선 맞춤)으로 V = 0 이 되는 온도(절대 영도) 찾기
   - 기록한 데이터는 CSV, 그래프는 PNG 이미지로 내려받기
   ========================================================= */

// ── 실제 데이터와 연결되는 값
const R_LATM = R / ATM_KPA; // 기체 상수 (L·atm/(mol·K)) = 8.3144621 J/(mol·K) ÷ 101.325 kPa/atm
const ZERO_C = -273.15; // 절대 영도 (°C)
const T_MIN = 100, T_MAX = 600; // 온도 범위 (K)
const gasName = (g) => `${GASES[g].ko} (${GASES[g].formula.replace(/2/g, '₂')})`;
const massOf = (g) => molarMass(GASES[g].formula); // CRC 원자량으로 계산한 몰질량 (g/mol)

// ── 화면용 값
const N_PARTICLES = 40; // 입자 그림 수 (몰수와 무관하게 고정)
const SERIES_COLORS = ['#2f80ed', '#eb5757', '#27ae60', '#9b51e0', '#c79a12', '#0e7490'];
const W = 400, H = 500; // 실린더 그림 크기

const vol = (n, T, P) => (n * R_LATM * T) / P; // 이상 기체: V = nRT/P
const r2d = (x) => Math.round(x * 100) / 100;
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
// 눈금 최댓값을 보기 좋은 수로 올림 (1, 2, 2.5, 5, 10 × 10ⁿ)
function niceNum(v) {
  if (v <= 0) return 1;
  const e = 10 ** Math.floor(Math.log10(v)), f = v / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
}
// 온도에 따라 파랑(차가움) → 빨강(뜨거움)
const tempColor = (T) => { const t = Math.min(1, Math.max(0, (T - T_MIN) / (T_MAX - T_MIN))); return `hsl(${215 - 210 * t},72%,${52 - 4 * t}%)`; };
// 최소 제곱 직선 맞춤: y = m·x + b, 결정 계수 R²
function linfit(xs, ys) {
  const n = xs.length; if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); syy += (ys[i] - my) ** 2; }
  if (sxx === 0) return null;
  const m = sxy / sxx, b = my - m * mx;
  let res = 0; for (let i = 0; i < n; i++) res += (ys[i] - (m * xs[i] + b)) ** 2;
  return { m, b, r2: syy === 0 ? 1 : 1 - res / syy };
}
const minus = (s) => String(s).replace('-', '−');
const stamp = () => { const d = new Date(), p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; };
function download(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }

// 입자: 3차원 맥스웰 분포에서 속력 비율을 뽑아 2차원 방향으로 사용
const makeParticles = () => Array.from({ length: N_PARTICLES }, () => {
  const f = Math.min(2.4, Math.hypot(gauss(), gauss(), gauss()) / Math.sqrt(3)), a = Math.random() * Math.PI * 2;
  return { x: Math.random(), y: Math.random(), dx: Math.cos(a), dy: Math.sin(a), f, init: true };
});

export default function CharlesLaw() {
  const [T, setTRaw] = useState(300); // K
  const [n, setN] = useState(1);
  const [P, setP] = useState(1);
  const [gas, setGas] = useState('N2');
  const [axis, setAxis] = useState('C'); // 가로축: °C 또는 K
  const [fitOn, setFitOn] = useState(true);
  const [zeroOn, setZeroOn] = useState(false);
  const [noiseOn, setNoiseOn] = useState(false);
  const [noisePct, setNoisePct] = useState(1);
  const [data, setData] = useState([]);
  const [status, setStatus] = useState('');
  const [auto, setAuto] = useState(false);
  const [autoRange, setAutoRange] = useState({ start: 0, end: 300, step: 50 });
  const [inC, setInC] = useState('26.85'), [inK, setInK] = useState('300.00'); // 숫자 입력 칸
  const canvasRef = useRef(null), chartRef = useRef(null);
  const anim = useRef({ T: 300, parts: makeParticles() });
  const cur = useRef(); cur.current = { T, n, P, gas, noiseOn, noisePct };
  const nextId = useRef(1), timer = useRef(null), autoOn = useRef(false);

  // 온도 바꾸기 (슬라이더·°C 칸·K 칸이 서로 맞춰짐)
  const setT = (K) => {
    K = r2d(Math.min(T_MAX, Math.max(T_MIN, K)));
    setTRaw(K); cur.current.T = K;
    setInK(K.toFixed(2)); setInC((K + ZERO_C).toFixed(2));
  };

  function addRecord() {
    const { T: t, n: nn, P: p, gas: g, noiseOn: nz, noisePct: pct0 } = cur.current;
    let V = vol(nn, t, p);
    const pct = nz ? pct0 : 0;
    if (pct) V = Math.max(0, V * (1 + (gauss() * pct) / 100));
    const rec = { id: nextId.current++, gas: g, n: nn, P: p, tC: r2d(t + ZERO_C), TK: t, V, VT: V / t, pct };
    setData((d) => { setStatus(`${d.length + 1}번째 측정값을 기록했습니다.`); return [...d, rec]; });
  }

  // ----- 자동 측정: 온도를 맞추고 0.65초 뒤 기록, 0.2초 뒤 다음 온도
  const stopAuto = (msg) => { autoOn.current = false; clearTimeout(timer.current); setAuto(false); if (msg) setStatus(msg); };
  useEffect(() => () => clearTimeout(timer.current), []);
  function toggleAuto() {
    if (autoOn.current) { stopAuto('자동 측정을 멈췄습니다.'); return; }
    const { start: a, end: b } = autoRange, st = Math.abs(autoRange.step);
    const lo = T_MIN + ZERO_C, hi = T_MAX + ZERO_C;
    if (!(st > 0)) { setStatus('간격은 0보다 커야 합니다.'); return; }
    if (a < lo || a > hi || b < lo || b > hi) { setStatus(`온도는 ${minus(lo.toFixed(2))} °C 에서 ${hi.toFixed(2)} °C 사이로 정하세요.`); return; }
    const dir = b >= a ? 1 : -1, temps = [];
    for (let k = 0; ; k++) { const t = a + dir * k * st; if (dir > 0 ? t > b + 1e-9 : t < b - 1e-9) break; temps.push(t); if (temps.length > 200) break; }
    if (temps.length > 200) { setStatus('측정 횟수가 200번을 넘습니다. 간격을 넓히세요.'); return; }
    autoOn.current = true; setAuto(true);
    let i = 0;
    const step = () => {
      if (!autoOn.current) return;
      if (i >= temps.length) { stopAuto(`자동 측정을 마쳤습니다. ${temps.length}개의 값을 기록했습니다.`); return; }
      setT(temps[i] - ZERO_C); i++;
      setStatus(`${temps[i - 1].toFixed(2)} °C 에서 측정 중 (${i}/${temps.length})`);
      timer.current = setTimeout(() => { if (!autoOn.current) return; addRecord(); timer.current = setTimeout(step, 200); }, 650);
    };
    step();
  }

  // ----- CSV 저장 (엑셀에서 한글이 깨지지 않도록 맨 앞에 BOM)
  function downloadCSV() {
    if (!data.length) { setStatus('다운로드할 기록이 없습니다. 먼저 측정값을 기록하세요.'); return; }
    const head = ['번호', '기체', '몰수 n (mol)', '압력 P (atm)', '온도 t (°C)', '절대 온도 T (K)', '부피 V (L)', 'V/T (L/K)', '측정 오차 표준편차 (%)'];
    const rows = data.map((d, i) => [i + 1, gasName(d.gas), d.n.toFixed(2), d.P.toFixed(2), d.tC.toFixed(2), d.TK.toFixed(2), d.V.toFixed(5), d.VT.toFixed(7), d.pct]);
    const cell = (v) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = `﻿${[head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    download(url, `charles_law_${stamp()}.csv`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('CSV 파일을 저장했습니다.');
  }

  // ----- 그래프 이미지(PNG) 저장: 화면의 그래프(SVG)를 흰 바탕 그림으로 바꿈
  function downloadPNG() {
    const svg = chartRef.current?.querySelector('svg');
    if (!svg) return;
    const clone = svg.cloneNode(true);
    const [, , vw, vh] = svg.getAttribute('viewBox').split(' ').map(Number);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', vw); clone.setAttribute('height', vh);
    // 화면에서는 CSS 로 꾸민 부분을 그림 안에 직접 넣어 줌
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = 'text{font-family:"Noto Sans KR",sans-serif}.grid{stroke:#eef1f5}.axis{stroke:#8892a0}.tick{font-size:11px;fill:#5c6675}.axis-label{font-size:12px;fill:#333;font-weight:600}';
    clone.insertBefore(style, clone.firstChild);
    const img = new Image(), scale = 2;
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = vw * scale; c.height = vh * scale;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      download(c.toDataURL('image/png'), `charles_law_graph_${stamp()}.png`);
      setStatus('그래프 이미지를 저장했습니다.');
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
  }

  // ----- 실린더 그리기 (매 장면)
  useAnimationFrame((dt) => {
    const c = canvasRef.current.getContext('2d'), a = anim.current;
    c.clearRect(0, 0, W, H);
    a.T += (T - a.T) * Math.min(1, dt * 5); // 온도는 천천히 따라감
    const scaleMax = niceNum(vol(n, T_MAX, P) * 1.02);
    const V = vol(n, a.T, P);
    const x0 = W * 0.34, x1 = W * 0.88, yb = H * 0.84, cylTop = H * 0.03;
    const pistonH = 11, weightH = H * 0.07, top = cylTop + weightH + pistonH + 4, Hmax = yb - top;
    const py = yb - (V / scaleMax) * Hmax, r = 4.4;

    // 기체 영역 (온도에 따라 색)
    c.fillStyle = '#f7f9fc'; c.fillRect(x0, cylTop, x1 - x0, yb - cylTop);
    c.globalAlpha = 0.16; c.fillStyle = tempColor(a.T); c.fillRect(x0, py, x1 - x0, yb - py); c.globalAlpha = 1;
    // 입자: 속력 ∝ √(T/M) (N₂ 300 K 기준)
    const speed = Hmax * 0.45 * Math.sqrt(a.T / 300) * Math.sqrt(massOf('N2') / massOf(gas));
    const L = x0 + r + 2, Rr = x1 - r - 2, T_ = py + r, B = yb - r;
    c.fillStyle = tempColor(a.T);
    for (const p of a.parts) {
      if (p.init) { p.x = L + p.x * (Rr - L); p.y = T_ + p.y * (B - T_); p.init = false; }
      p.x += p.dx * p.f * speed * dt; p.y += p.dy * p.f * speed * dt;
      if (p.x < L) { p.x = L; p.dx = Math.abs(p.dx); } if (p.x > Rr) { p.x = Rr; p.dx = -Math.abs(p.dx); }
      if (p.y < T_) { p.y = T_; p.dy = Math.abs(p.dy); } if (p.y > B) { p.y = B; p.dy = -Math.abs(p.dy); }
      c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill();
    }
    // 실린더 벽
    c.strokeStyle = '#334'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x0, cylTop); c.lineTo(x0, yb); c.lineTo(x1, yb); c.lineTo(x1, cylTop); c.stroke();
    // 피스톤과 추 (추에 외부 압력 표시)
    c.fillStyle = '#8a94a6'; c.fillRect(x0 + 1.5, py - pistonH, x1 - x0 - 3, pistonH);
    const wx0 = x0 + (x1 - x0) * 0.22, wx1 = x1 - (x1 - x0) * 0.22;
    c.fillStyle = '#5c6675'; c.fillRect(wx0, py - pistonH - weightH, wx1 - wx0, weightH);
    c.fillStyle = '#fff'; c.font = '600 14px "Noto Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(`${P.toFixed(2)} atm`, (wx0 + wx1) / 2, py - pistonH - weightH / 2);
    // 부피 눈금자
    const xr = x0 - 12, step = niceNum(scaleMax / 6);
    c.strokeStyle = '#5c6675'; c.lineWidth = 1; c.fillStyle = '#5c6675'; c.font = '12px "Noto Sans KR", sans-serif'; c.textAlign = 'right';
    c.beginPath(); c.moveTo(xr, top); c.lineTo(xr, yb); c.stroke();
    for (let v = 0; v <= scaleMax + 1e-9; v += step) {
      const y = yb - (v / scaleMax) * Hmax;
      c.beginPath(); c.moveTo(xr - 6, y); c.lineTo(xr, y); c.stroke();
      c.fillText(`${+v.toFixed(3)}`, xr - 9, y);
    }
    c.fillText('L', xr - 9, top - 12);
    c.fillStyle = '#334'; c.beginPath(); c.moveTo(xr + 1, py); c.lineTo(xr + 9, py - 5); c.lineTo(xr + 9, py + 5); c.fill(); // 지금 부피
    // 가열·냉각 장치
    const hy = yb + H * 0.025, hh = H * 0.045;
    c.fillStyle = tempColor(a.T); c.fillRect(x0, hy, x1 - x0, hh);
    c.fillStyle = '#5c6675'; c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillText(`가열·냉각 장치  ${minus((a.T + ZERO_C).toFixed(1))} °C`, (x0 + x1) / 2, hy + hh + 6);
  });

  // ----- 화면 표시용 계산
  const V = vol(n, T, P);
  const urms = Math.sqrt((3 * R * T) / (massOf(gas) / 1000)); // 제곱 평균 제곱근 속력 (m/s)
  const C = axis === 'C';
  const xOf = (d) => (C ? d.tC : d.TK);
  const xDomain = C ? [ZERO_C, 350] : [0, 650];
  const xTickValues = C ? [ZERO_C, -200, -100, 0, 100, 200, 300] : [0, 100, 200, 300, 400, 500, 600];
  // 세로축: 깔끔한 눈금 간격(1·2·2.5·5 × 10ⁿ)을 먼저 정하고, 최댓값을 그 배수로 올림
  const yRaw = Math.max(V, ...data.map((d) => d.V)) * 1.12;
  const yStep = niceNum(yRaw / 6), yMax = Math.ceil(yRaw / yStep) * yStep;

  // 같은 조건(n, P)끼리 묶어 같은 색. 추세선은 V = 0 이 되는 곳까지 점선으로 연장
  const groups = new Map();
  data.forEach((d) => { const k = `${d.n.toFixed(2)}|${d.P.toFixed(2)}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(d); });
  const series = [], markers = [], legend = [];
  [...groups].forEach(([k, arr], gi) => {
    const col = SERIES_COLORS[gi % SERIES_COLORS.length];
    const f = linfit(arr.map(xOf), arr.map((d) => d.V));
    if (fitOn && f && f.m > 0) {
      const xs = Math.max(xDomain[0], -f.b / f.m), xe = xDomain[1];
      const dmin = Math.min(...arr.map(xOf)), dmax = Math.max(...arr.map(xOf));
      series.push({ label: `${k}-ext`, hideLegend: true, color: col, dashed: true, width: 1.4, points: [[xs, f.m * xs + f.b], [xe, f.m * xe + f.b]] });
      series.push({ label: `${k}-fit`, hideLegend: true, color: col, width: 2.2, points: [[dmin, f.m * dmin + f.b], [dmax, f.m * dmax + f.b]] });
    }
    arr.forEach((d) => markers.push({ x: xOf(d), y: d.V, color: col }));
    const [nn, pp] = k.split('|');
    let eq = '';
    if (fitOn) {
      if (f) {
        const v = C ? 't' : 'T';
        eq = `V = ${f.m.toFixed(6)} ${v} ${f.b < 0 ? '−' : '+'} ${Math.abs(f.b).toFixed(4)}, R² = ${f.r2.toFixed(5)}`;
        if (f.m > 0) eq += `, V = 0 일 때 ${v} = ${minus((-f.b / f.m).toFixed(2))} ${C ? '°C' : 'K'}`;
      } else eq = '서로 다른 온도에서 2개 이상 측정하면 추세선이 그려집니다.';
    }
    legend.push({ k, col, text: `n = ${nn} mol, P = ${pp} atm (${arr.length}개)`, eq });
  });
  markers.push({ x: C ? T + ZERO_C : T, y: V, color: '#334', r: 7, hollow: true }); // 지금 상태 (빈 원)
  const vLines = zeroOn ? [{ x: xDomain[0], color: '#b42318', label: C ? '절대 영도 −273.15 °C' : '절대 영도 0 K' }] : [];

  return (
    <>
      <SimLayout
        canvas={<>
          <canvas ref={canvasRef} width={W} height={H} style={{ maxWidth: 380, margin: '0 auto' }} />
          <p className="small muted center">입자 수와 화면 속도는 보기 좋게 줄인 것입니다. 수치는 이상 기체 상태 방정식으로 계산합니다.</p>
        </>}
        controls={<>
          <Slider label="온도" value={T} min={T_MIN} max={T_MAX} step={1} unit=" K" format={(v) => v.toFixed(2)} onChange={setT} disabled={auto} />
          <div className="inline-fields">
            <label><input className="num-in" type="number" step="0.01" min={T_MIN + ZERO_C} max={T_MAX + ZERO_C} value={inC} disabled={auto}
              onChange={(e) => setInC(e.target.value)} onBlur={(e) => e.target.value !== '' && setT(+e.target.value - ZERO_C)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} /> °C</label>
            <label><input className="num-in" type="number" step="0.01" min={T_MIN} max={T_MAX} value={inK} disabled={auto}
              onChange={(e) => setInK(e.target.value)} onBlur={(e) => e.target.value !== '' && setT(+e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} /> K</label>
          </div>
          <Readout rows={[
            ['부피 V', `${V.toFixed(3)} L`],
            ['절대 온도 T', `${T.toFixed(2)} K`],
            ['섭씨 온도 t', `${minus((T + ZERO_C).toFixed(2))} °C`],
            ['V / T', `${(V / T).toFixed(6)} L/K`],
            ['입자 평균 속력 (rms)', `${Math.round(urms)} m/s`],
          ]} />
          <b className="small">일정하게 유지하는 조건</b>
          <Slider label="기체의 양 n" value={n} min={0.2} max={2} step={0.1} unit=" mol" format={(v) => v.toFixed(2)} onChange={setN} />
          <Slider label="외부 압력 P" value={P} min={0.5} max={3} step={0.05} unit=" atm" format={(v) => v.toFixed(2)} onChange={setP} />
          <Select label="기체 종류" value={gas} onChange={setGas} options={Object.keys(GASES).map((g) => ({ value: g, label: gasName(g) }))} />
          <p className="small muted">n 이나 P 를 바꾼 뒤 기록하면 그래프에 새 계열로 표시됩니다. 기체 종류를 바꾸면 입자 속력은 달라지지만 부피는 달라지지 않습니다.</p>
          <b className="small">측정</b>
          <div className="btn-row">
            <button className="btn" type="button" disabled={auto} onClick={addRecord}>현재 상태 기록</button>
          </div>
          <div className="inline-fields">
            <label><input type="checkbox" checked={noiseOn} onChange={(e) => setNoiseOn(e.target.checked)} /> 측정 오차 넣기</label>
            <label>표준편차 <input className="num-in short" type="number" min="0.1" max="10" step="0.1" value={noisePct}
              onChange={(e) => setNoisePct(Math.min(10, Math.max(0.1, +e.target.value || 1)))} /> %</label>
          </div>
          <div className="inline-fields">
            <span>자동 측정</span>
            {[['start', '°C 부터'], ['end', '°C 까지'], ['step', '°C 간격']].map(([k, lab]) => (
              <label key={k}><input className="num-in short" type="number" step="1" value={autoRange[k]} disabled={auto}
                onChange={(e) => setAutoRange((r) => ({ ...r, [k]: +e.target.value }))} /> {lab}</label>
            ))}
          </div>
          <div className="btn-row">
            <button className="btn btn-ghost" type="button" onClick={toggleAuto}>{auto ? '자동 측정 중지' : '자동 측정 시작'}</button>
          </div>
          {status && <div className="feedback" role="status">{status}</div>}
        </>}
      />

      {/* ----- 그래프 ----- */}
      <div className="data-panel">
        <div className="data-panel-head">
          <h3>그래프</h3>
          <div className="btn-row">
            <div className="segmented">
              {[['C', 't (°C)'], ['K', 'T (K)']].map(([v, lab]) => <button key={v} type="button" className={axis === v ? 'on' : ''} onClick={() => setAxis(v)}>{lab}</button>)}
            </div>
            <button className="btn btn-ghost" type="button" onClick={downloadPNG}>그래프 이미지 저장</button>
          </div>
        </div>
        <div className="chart-toggles">
          <label><input type="checkbox" checked={fitOn} onChange={(e) => setFitOn(e.target.checked)} /> 추세선과 식</label>
          <label><input type="checkbox" checked={zeroOn} onChange={(e) => setZeroOn(e.target.checked)} /> 절대 영도 표시</label>
        </div>
        <div ref={chartRef}>
          <LineChart height={360} series={series} markers={markers} vLines={vLines}
            xDomain={xDomain} xTickValues={xTickValues} yDomain={[0, yMax]} yTicks={Math.round(yMax / yStep)}
            xFormat={(v) => minus(v)} yFormat={(v) => +v.toFixed(3)}
            xLabel={C ? '온도 t (°C)' : '절대 온도 T (K)'} yLabel="부피 V (L)" />
        </div>
        <div className="data-legend small">
          {legend.length === 0 && <div className="muted">빈 원은 지금 상태입니다. 기록한 측정값이 점으로 표시됩니다.</div>}
          {legend.map((l) => <div key={l.k}><i className="dot" style={{ background: l.col }} /> {l.text} <span className="eq">{l.eq}</span></div>)}
        </div>
      </div>

      {/* ----- 측정 데이터 표 + CSV 저장 ----- */}
      <div className="data-panel">
        <div className="data-panel-head">
          <h3>측정 데이터</h3>
          <div className="btn-row">
            <button className="btn" type="button" onClick={downloadCSV}>CSV 다운로드</button>
            <button className="btn btn-ghost" type="button" disabled={auto}
              onClick={() => { if (data.length && window.confirm('기록한 측정값을 모두 지울까요?')) { setData([]); setStatus('모든 기록을 지웠습니다.'); } }}>모두 지우기</button>
          </div>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>번호</th><th>기체</th><th>n (mol)</th><th>P (atm)</th><th>t (°C)</th><th>T (K)</th><th>V (L)</th><th>V/T (L/K)</th><th>오차 설정</th><th /></tr></thead>
            <tbody>
              {data.length === 0 && <tr><td colSpan={10} className="empty">아직 기록이 없습니다. 온도를 정한 뒤 [현재 상태 기록]을 누르거나 자동 측정을 실행하세요.</td></tr>}
              {data.map((d, i) => (
                <tr key={d.id}>
                  <td>{i + 1}</td><td>{gasName(d.gas)}</td><td>{d.n.toFixed(2)}</td><td>{d.P.toFixed(2)}</td>
                  <td>{minus(d.tC.toFixed(2))}</td><td>{d.TK.toFixed(2)}</td><td>{d.V.toFixed(4)}</td><td>{d.VT.toFixed(6)}</td>
                  <td>{d.pct ? `${d.pct} %` : '없음'}</td>
                  <td><button className="del" type="button" onClick={() => { setData((all) => all.filter((x) => x.id !== d.id)); setStatus('기록을 삭제했습니다.'); }}>삭제</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details>
          <summary>이 모형의 가정과 한계</summary>
          <p>부피는 이상 기체 상태 방정식 PV = nRT 에서 V = nRT/P 로 계산합니다. 이상 기체는 입자 자체의 부피가 없고 입자 사이에 인력이 작용하지 않는다고 가정하므로, 그래프의 직선은 어느 온도까지 내려가도 휘지 않습니다.</p>
          <p>실제 기체는 입자 사이의 인력과 입자 자체의 부피 때문에 온도가 낮고 압력이 높을수록 이상 기체에서 벗어나고, 절대 영도에 이르기 훨씬 전에 액체나 고체가 됩니다. 따라서 부피가 0 이 되는 온도는 실제로 측정한 값이 아니라 직선을 연장해서 얻은 값입니다.</p>
          <p>화면 속 입자는 40개로 고정되어 있고, 입자끼리의 충돌은 생략했습니다. 입자 속력은 √T 에 비례하도록 그렸지만 실제 속력(수백 m/s)을 화면에 맞게 줄인 것입니다. 입자 수가 적어 보여도 표시되는 수치는 입력한 몰수로 계산한 값입니다.</p>
          <p>기체 종류는 입자의 평균 속력만 바꿉니다. 같은 온도에서 가벼운 입자는 더 빠르게, 무거운 입자는 더 느리게 움직이지만 평균 운동 에너지가 같으므로 이상 기체의 부피는 기체 종류와 관계없습니다.</p>
        </details>
      </div>

      <ScaleNote items={[
        `기체 상수 R = ${R} J/(mol·K) ÷ 101.325 kPa/atm = ${R_LATM.toFixed(6)} L·atm/(mol·K) (CRC 1-2), 절대 영도 = −273.15 °C`,
        `입자 평균 속력 √(3RT/M): 몰질량은 CRC 원자량(1-11)으로 계산 (예: N₂ ${massOf('N2').toFixed(3)} g/mol)`,
        '입자 그림 40개 고정 (몰수와 무관), 화면 속력 ∝ √(T/M) — N₂ 300 K 기준으로 줄인 값',
        '실린더 높이 ∝ 부피 (눈금 최댓값 = 600 K 일 때 부피를 보기 좋게 올린 값), 기체·가열 장치 색은 온도를 나타냄',
        '온도가 바뀌는 빠르기는 화면용, 측정 오차는 부피에 정규 분포 무작위 오차 (표준편차 직접 입력)',
      ]} />
    </>
  );
}
