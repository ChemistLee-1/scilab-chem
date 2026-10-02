import { useRef, useState } from 'react';
import { Slider, Segmented, SimLayout, ScaleNote, Readout, LineChart, useAnimationFrame } from './common.jsx';
import { R, ATM_KPA } from '../data/crc.js';

/* =========================================================
   보일 법칙 — 압력과 부피 (사용자 제공 '보일 법칙 시뮬레이션' 내용)
   - 온도·기체의 양을 고정하고 피스톤 위 압력을 바꾸면 부피가 PV = nRT 에 따라 변함
   - [현재 값 기록] / [자동 측정]으로 데이터를 모으고, 세 가지 그래프로 비교
   - 모은 데이터는 CSV 파일로 내려받아 스프레드시트에서 분석
   ========================================================= */

// ── 실제 데이터와 연결되는 값
const R_LATM = R / ATM_KPA; // 기체 상수 (L·atm/(mol·K)) = 8.3144621 J/(mol·K) ÷ 101.325 kPa/atm
const P_MIN = 0.5, P_MAX = 4.0; // 외부 압력 범위 (atm)

// ── 화면용 값
const V_SCALE = 10; // 실린더 눈금 최댓값 (L)
const PARTICLES_PER_MOL = 500; // 입자 그림 수 = 몰수 × 500
const BASE_SPEED = 150; // 300 K 에서 입자 평균 속력 (px/초), 속력 ∝ √T
const NOISE = 0.008; // 측정 오차 표준편차 (부피의 0.8 %)
const SWEEP = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0]; // 자동 측정 압력
const COLORS = ['#2f80ed', '#eb5757', '#27ae60', '#9b51e0', '#c79a12', '#c23b6a'];

// ── 실린더 그림
const W = 420, H = 430;
const X0 = 80, X1 = 290, Y_BOT = 410, REGION = 360, PR = 3.5;

const MODES = {
  VP: { label: '부피 – 압력', x: '압력 P (atm)', y: '부피 V (L)', xy: (d) => [d.P, d.V] },
  VinvP: { label: '부피 – 1/압력', x: '1/압력 (1/atm)', y: '부피 V (L)', xy: (d) => [1 / d.P, d.V] },
  PVP: { label: 'P×V – 압력', x: '압력 P (atm)', y: 'P × V (atm·L)', xy: (d) => [d.P, d.P * d.V] },
};

const volumeOf = (P, T, n) => (n * R_LATM * T) / P; // 이상 기체: V = nRT/P
const keyOf = (d) => `${d.T} K, ${d.n.toFixed(2)} mol`; // 같은 조건끼리 같은 색
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
// 그래프 눈금 최댓값을 보기 좋은 수로 올림 (1, 2, 2.5, 5, 10 × 10ⁿ)
function niceCeil(v) {
  if (v <= 0) return 1;
  const e = 10 ** Math.floor(Math.log10(v)), f = v / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
}
// 최소 제곱 직선 맞춤: y = a·x + b, 결정 계수 R²
function linfit(pts) {
  const n = pts.length; if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const den = n * sxx - sx * sx; if (Math.abs(den) < 1e-12) return null;
  const a = (n * sxy - sx * sy) / den, b = (sy - a * sx) / n, ym = sy / n;
  let ssr = 0, sst = 0;
  for (const [x, y] of pts) { ssr += (y - (a * x + b)) ** 2; sst += (y - ym) ** 2; }
  return { a, b, r2: sst > 0 ? 1 - ssr / sst : 1 };
}

function makeParticles(n, T, V) {
  const N = Math.round(n * PARTICLES_PER_MOL);
  const top = Y_BOT - (V / V_SCALE) * REGION;
  const speed = BASE_SPEED * Math.sqrt(T / 300);
  return Array.from({ length: N }, () => {
    const a = Math.random() * Math.PI * 2, s = speed * (0.6 + Math.random() * 0.8);
    return { x: X0 + PR + Math.random() * (X1 - X0 - 2 * PR), y: top + PR + Math.random() * Math.max(1, Y_BOT - top - 2 * PR), vx: Math.cos(a) * s, vy: Math.sin(a) * s };
  });
}

export default function BoyleLaw() {
  const [P, setPRaw] = useState(1.0);
  const [T, setTRaw] = useState(300);
  const [n, setNRaw] = useState(0.1);
  const [noise, setNoise] = useState(true);
  const [mode, setMode] = useState('VP');
  const [data, setData] = useState([]); // 기록: { T, n, P, V }
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false); // 자동 측정 중
  const [live, setLive] = useState({ V: volumeOf(1, 300, 0.1), hits: 0 });
  const canvasRef = useRef(null);

  // 애니메이션 상태 (화면을 다시 그릴 때마다 바뀌는 값은 ref 에 보관)
  const sim = useRef(null);
  if (!sim.current) {
    const V = volumeOf(1, 300, 0.1);
    sim.current = { V, particles: makeParticles(0.1, 300, V), hits: [], now: 0, sweep: null, lastView: 0 };
  }
  const cur = useRef({ P, T, n, noise });
  cur.current = { P, T, n, noise };

  const setP = (v) => setPRaw(Math.min(P_MAX, Math.max(P_MIN, Math.round(v * 10) / 10)));
  const setT = (v) => { setTRaw(v); sim.current.particles = makeParticles(n, v, sim.current.V); sim.current.hits = []; };
  const setN = (v) => { const r = +v.toFixed(2); setNRaw(r); sim.current.particles = makeParticles(r, T, sim.current.V); sim.current.hits = []; };

  const settled = () => { const tv = volumeOf(cur.current.P, cur.current.T, cur.current.n); return Math.abs(tv - sim.current.V) / tv < 0.003; };

  // 피스톤이 멈춘 상태에서 지금 값을 기록 (측정 오차를 넣을 수 있음)
  function record() {
    if (!settled()) { setMsg('피스톤이 멈춘 뒤 기록하세요.'); return; }
    const { P: p, T: t, n: nn, noise: nz } = cur.current;
    let V = volumeOf(p, t, nn);
    if (nz) V *= 1 + gauss() * NOISE;
    V = +V.toFixed(3);
    setData((d) => { setMsg(`${d.length + 1}번: P = ${p.toFixed(2)} atm, V = ${V.toFixed(3)} L 기록`); return [...d, { T: t, n: nn, P: p, V }]; });
  }

  function startSweep() {
    setBusy(true);
    setP(SWEEP[0]); cur.current.P = SWEEP[0];
    sim.current.sweep = { i: 0, since: null };
    setMsg(`${SWEEP[0].toFixed(1)} atm 으로 압력을 맞추는 중…`);
  }

  // ----- 한 장면: 피스톤 이동 → 입자 이동 → 자동 측정 진행 → 그리기
  useAnimationFrame((dt) => {
    const s = sim.current;
    s.now += dt;
    const tv = volumeOf(P, T, n);
    s.V += (tv - s.V) * Math.min(1, dt * 3); // 피스톤이 부드럽게 새 위치로
    const top = Y_BOT - (s.V / V_SCALE) * REGION;
    for (const p of s.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < X0 + PR) { p.x = X0 + PR; p.vx = Math.abs(p.vx); }
      if (p.x > X1 - PR) { p.x = X1 - PR; p.vx = -Math.abs(p.vx); }
      if (p.y > Y_BOT - PR) { p.y = Y_BOT - PR; p.vy = -Math.abs(p.vy); }
      if (p.y < top + PR) { p.y = top + PR; if (p.vy < 0) { p.vy = -p.vy; s.hits.push(s.now); } } // 피스톤 충돌
    }
    while (s.hits.length && s.hits[0] < s.now - 2) s.hits.shift();

    // 자동 측정: 피스톤이 멈추고 0.35초 지나면 기록 → 다음 압력
    if (s.sweep) {
      const sw = s.sweep;
      if (settled()) {
        if (sw.since == null) sw.since = s.now;
        if (s.now - sw.since > 0.35) {
          record();
          sw.i++;
          if (sw.i >= SWEEP.length) { s.sweep = null; setBusy(false); setTimeout(() => setMsg('자동 측정을 마쳤습니다. 그래프 종류를 바꿔 비교해 보세요.'), 0); }
          else { setP(SWEEP[sw.i]); cur.current.P = SWEEP[sw.i]; sw.since = null; setMsg(`${SWEEP[sw.i].toFixed(1)} atm 으로 압력을 맞추는 중…`); }
        }
      } else sw.since = null;
    }

    draw(top);
    if (s.now - s.lastView > 0.1) { s.lastView = s.now; setLive({ V: s.V, hits: s.hits.length / 2 }); }
  });

  function draw(top) {
    const c = canvasRef.current.getContext('2d');
    c.clearRect(0, 0, W, H);
    // 부피 눈금
    c.strokeStyle = '#5c6675'; c.fillStyle = '#5c6675'; c.lineWidth = 1;
    c.font = '12px "Noto Sans KR", sans-serif'; c.textAlign = 'right'; c.textBaseline = 'middle';
    for (let v = 0; v <= V_SCALE; v++) {
      const y = Y_BOT - (v / V_SCALE) * REGION;
      c.beginPath(); c.moveTo(X0 - 12, y); c.lineTo(X0 - 4, y); c.stroke();
      if (v % 2 === 0) c.fillText(`${v} L`, X0 - 16, y);
    }
    // 기체 영역과 입자
    c.fillStyle = '#f7f9fc'; c.fillRect(X0, Y_BOT - REGION - 20, X1 - X0, REGION + 20);
    c.fillStyle = 'rgba(47,128,237,0.08)'; c.fillRect(X0, top, X1 - X0, Y_BOT - top);
    c.fillStyle = '#2f80ed';
    for (const p of sim.current.particles) { c.beginPath(); c.arc(p.x, p.y, PR, 0, Math.PI * 2); c.fill(); }
    // 실린더 벽
    c.strokeStyle = '#334'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(X0 - 2, Y_BOT - REGION - 20); c.lineTo(X0 - 2, Y_BOT + 2); c.lineTo(X1 + 2, Y_BOT + 2); c.lineTo(X1 + 2, Y_BOT - REGION - 20); c.stroke();
    // 피스톤
    c.fillStyle = '#8a94a6'; c.fillRect(X0, top - 14, X1 - X0, 14);
    c.fillStyle = '#b8c1cf'; c.fillRect(X0, top - 14, X1 - X0, 3);
    // 추 (1개 = 0.5 atm)
    const blocks = Math.round(P / 0.5), bw = 90, bh = 9, bx = (X0 + X1) / 2 - bw / 2;
    c.fillStyle = '#f2994a';
    for (let i = 0; i < blocks; i++) c.fillRect(bx, top - 14 - (i + 1) * (bh + 2), bw, bh);
    c.fillStyle = '#334'; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.font = '11px "Noto Sans KR", sans-serif';
    c.fillText('추 1개 = 0.5 atm', X1 - 92, 16);
    // 압력계 (0~4 atm)
    const gx = 355, gy = Y_BOT - 60, gr = 42, a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    c.lineWidth = 2; c.strokeStyle = '#334'; c.fillStyle = '#fff';
    c.beginPath(); c.arc(gx, gy, gr, 0, Math.PI * 2); c.fill(); c.stroke();
    c.font = '10px "Noto Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#5c6675';
    for (let k = 0; k <= 4; k++) {
      const a = a0 + ((a1 - a0) * k) / 4;
      c.beginPath(); c.moveTo(gx + Math.cos(a) * (gr - 6), gy + Math.sin(a) * (gr - 6)); c.lineTo(gx + Math.cos(a) * gr, gy + Math.sin(a) * gr); c.stroke();
      c.fillText(k, gx + Math.cos(a) * (gr - 15), gy + Math.sin(a) * (gr - 15));
    }
    const an = a0 + ((a1 - a0) * P) / 4;
    c.strokeStyle = '#eb5757'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + Math.cos(an) * (gr - 10), gy + Math.sin(an) * (gr - 10)); c.stroke();
    c.fillStyle = '#334'; c.fillText('atm', gx, gy + 22);
    c.strokeStyle = '#334'; c.lineWidth = 3; // 연결관
    c.beginPath(); c.moveTo(X1 + 2, Y_BOT - 8); c.lineTo(gx, Y_BOT - 8); c.lineTo(gx, gy + gr); c.stroke();
  }

  // ----- CSV 저장 (엑셀에서 한글이 깨지지 않도록 맨 앞에 BOM 을 붙임)
  function downloadCSV() {
    if (!data.length) { setMsg('저장할 데이터가 없습니다. 먼저 값을 기록하세요.'); return; }
    const head = ['번호', '온도(K)', '기체의 양(mol)', '압력(atm)', '부피(L)', '1/압력(1/atm)', '압력×부피(atm·L)'];
    const lines = [head.join(',')];
    data.forEach((d, i) => lines.push([i + 1, d.T, d.n.toFixed(2), d.P.toFixed(2), d.V.toFixed(3), (1 / d.P).toFixed(4), (d.P * d.V).toFixed(4)].join(',')));
    const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const t = new Date(), pad = (v) => String(v).padStart(2, '0');
    const name = `boyle_data_${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}_${pad(t.getHours())}${pad(t.getMinutes())}.csv`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg(`${name} 저장됨 (${data.length}개)`);
  }
  const clearAll = () => { if (data.length && window.confirm('기록한 데이터를 모두 삭제할까요?')) { setData([]); setMsg('데이터를 모두 삭제했습니다.'); } };

  // ----- 그래프 준비: 같은 조건(온도·양)끼리 묶어 같은 색으로
  const groups = new Map();
  for (const d of data) { const k = keyOf(d); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(d); }
  const colorOf = (k) => COLORS[[...groups.keys()].indexOf(k) % COLORS.length];
  const M = MODES[mode];
  const nRT = n * R_LATM * T;
  const xMax = mode === 'VinvP' ? 2.2 : 4.5;
  const yMax = niceCeil(mode === 'PVP' ? Math.max(nRT, ...data.map((d) => d.P * d.V)) * 1.5 : Math.max(nRT / P_MIN, ...data.map((d) => d.V)) * 1.05);
  const series = [], markers = [];
  for (const [k, arr] of groups) {
    const pts = arr.map(M.xy).sort((a, b) => a[0] - b[0]);
    series.push({ label: k, color: colorOf(k), width: 2, points: pts });
    pts.forEach(([x, y]) => markers.push({ x, y, color: colorOf(k) }));
  }
  const [lx, ly] = M.xy({ P, V: live.V });
  markers.push({ x: lx, y: ly, color: '#334', r: 8, hollow: true }); // 지금 상태 (빈 원)

  const PV = P * live.V;

  return (
    <>
      <SimLayout
        canvas={<>
          <canvas ref={canvasRef} width={W} height={H} style={{ maxWidth: 420, margin: '0 auto' }} />
          <Segmented value={mode} onChange={setMode} options={Object.entries(MODES).map(([k, v]) => ({ value: k, label: v.label }))} />
          <LineChart height={320} series={series} markers={markers}
            xDomain={[0, xMax]} xTicks={mode === 'VinvP' ? 11 : 9} yDomain={[0, yMax]} yTicks={5}
            xFormat={(v) => +v.toFixed(1)} yFormat={(v) => +v.toFixed(2)} xLabel={M.x} yLabel={M.y} />
          <div className="data-legend small">
            {groups.size === 0 && <div className="muted">값을 기록할 때마다 그래프에 점이 찍힙니다. 빈 원은 지금 상태입니다.</div>}
            {[...groups].map(([k, arr]) => {
              let info = `측정 ${arr.length}개`;
              if (mode === 'VinvP') {
                const f = linfit(arr.map((d) => [1 / d.P, d.V]));
                if (f) info += ` · 기울기 ${f.a.toFixed(3)} atm·L · R² ${f.r2.toFixed(4)}`;
              } else info += ` · P×V 평균 ${(arr.reduce((s, d) => s + d.P * d.V, 0) / arr.length).toFixed(3)} atm·L`;
              return <div key={k}><i className="dot" style={{ background: colorOf(k) }} /> <b>{k}</b> — {info}</div>;
            })}
          </div>
        </>}
        controls={<>
          <Slider label="외부 압력" value={P} min={P_MIN} max={P_MAX} step={0.1} unit=" atm" format={(v) => v.toFixed(1)} onChange={setP} disabled={busy} />
          <div className="btn-row">
            <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setP(P - 0.1)}>− 0.1 atm</button>
            <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setP(P + 0.1)}>+ 0.1 atm</button>
          </div>
          <Slider label="온도 (실험 중 일정)" value={T} min={200} max={400} step={50} unit=" K" onChange={setT} disabled={busy} />
          <Slider label="기체의 양 (실험 중 일정)" value={n} min={0.05} max={0.15} step={0.01} unit=" mol" format={(v) => v.toFixed(2)} onChange={setN} disabled={busy} />
          <Readout rows={[
            ['압력 P', `${P.toFixed(2)} atm`],
            ['부피 V', `${live.V.toFixed(2)} L`],
            ['P × V', `${PV.toFixed(2)} atm·L`],
            ['nRT (이론값)', `${nRT.toFixed(2)} atm·L`],
            ['피스톤 충돌 횟수', `${Math.round(live.hits)} 회/초`],
          ]} />
          <div className="btn-row">
            <button className="btn" type="button" disabled={busy} onClick={record}>현재 값 기록</button>
            <button className="btn btn-ghost" type="button" disabled={busy} onClick={startSweep}>자동 측정 (0.5~4.0 atm)</button>
          </div>
          <label className="small"><input type="checkbox" checked={noise} onChange={(e) => setNoise(e.target.checked)} /> 측정 오차 포함 (약 ±1 %)</label>
          {msg && <div className="feedback" role="status">{msg}</div>}
        </>}
      />

      {/* ----- 측정 데이터 표 + CSV 저장 ----- */}
      <div className="data-panel">
        <div className="data-panel-head">
          <h3>측정 데이터</h3>
          <div className="btn-row">
            <button className="btn" type="button" onClick={downloadCSV}>CSV 파일로 저장</button>
            <button className="btn btn-ghost" type="button" disabled={busy} onClick={clearAll}>전체 삭제</button>
          </div>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>번호</th><th>온도(K)</th><th>기체의 양(mol)</th><th>압력(atm)</th><th>부피(L)</th><th>1/P (1/atm)</th><th>P×V (atm·L)</th><th /></tr></thead>
            <tbody>
              {data.length === 0 && <tr><td colSpan={8} className="empty">아직 기록한 값이 없습니다. 압력을 바꾸고 [현재 값 기록]을 눌러 보세요.</td></tr>}
              {data.map((d, i) => (
                <tr key={i}>
                  <td style={{ color: colorOf(keyOf(d)), fontWeight: 700 }}>{i + 1}</td>
                  <td>{d.T}</td><td>{d.n.toFixed(2)}</td><td>{d.P.toFixed(2)}</td><td>{d.V.toFixed(3)}</td>
                  <td>{(1 / d.P).toFixed(3)}</td><td>{(d.P * d.V).toFixed(3)}</td>
                  <td><button className="del" type="button" disabled={busy} onClick={() => setData((all) => all.filter((_, j) => j !== i))}>삭제</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details>
          <summary>실험 방법</summary>
          <ol>
            <li>온도와 기체의 양을 정하고, 실험 중에는 바꾸지 않습니다.</li>
            <li>압력을 바꾸고 피스톤이 멈추면 [현재 값 기록]을 누릅니다.</li>
            <li>여러 압력에서 측정한 뒤 세 가지 그래프를 비교합니다.</li>
            <li>온도나 기체의 양을 바꿔 다시 측정하면 다른 색의 데이터로 표시됩니다.</li>
            <li>[CSV 파일로 저장]으로 데이터를 받아 스프레드시트에서 분석합니다.</li>
          </ol>
        </details>
        <details>
          <summary>이 모형의 한계</summary>
          <ul>
            <li>이상 기체를 가정합니다. 입자 자체의 부피와 입자 사이의 인력은 무시하므로, 매우 높은 압력이나 낮은 온도에서 실제 기체와 차이가 납니다.</li>
            <li>실제 기체 입자 수(약 10²²개)를 수십 개로 줄이고, 3차원 운동을 2차원으로 나타냈습니다.</li>
            <li>입자끼리의 충돌은 생략했습니다. 온도가 일정하므로 피스톤과 충돌해도 입자의 속력은 변하지 않게 했습니다(등온 과정).</li>
            <li>부피는 PV = nRT 로 계산하고, 입자 운동은 그 경향(부피가 작을수록 충돌이 잦음)을 보여 주는 역할입니다. 충돌 횟수는 정량 값이 아닌 비교용 지표입니다.</li>
            <li>실제 실험에서는 압축할 때 온도가 오르므로, 천천히 압축해야 보일 법칙에 가까운 결과를 얻습니다.</li>
          </ul>
        </details>
      </div>

      <ScaleNote items={[
        `기체 상수 R = ${R} J/(mol·K) ÷ 101.325 kPa/atm = ${R_LATM.toFixed(5)} L·atm/(mol·K) (CRC 1-2)`,
        `실린더 높이 ∝ 부피 (0–${V_SCALE} L → ${REGION} px), 추 1개 = 0.5 atm`,
        `입자 그림 수 = 몰수 × ${PARTICLES_PER_MOL} (0.10 mol → 50개), 입자 속력 ∝ √T (300 K = ${BASE_SPEED} px/초, 실제 속력과 무관)`,
        `측정 오차: 부피에 표준편차 ${NOISE * 100} % 의 무작위 오차를 더함 (끌 수 있음)`,
        '피스톤이 새 위치로 움직이는 빠르기는 화면용',
      ]} />
    </>
  );
}
