import { useRef, useState } from 'react';
import { Slider, SimLayout, ScaleNote, Readout, LineChart, useAnimationFrame, sci } from './common.jsx';
import { N2O4_DH, N2O4_DS, R, R_LBAR } from '../data/crc.js';

const W = 640, H = 300, BOX_Y = 15, BOX_H = 270, PX_PER_L = 180;
const MMOL_PER_PARTICLE = 0.5;
const RELAX = 0.8; // 평형 도달 시정수 (화면 초)

const Kp = (T) => Math.exp(-(N2O4_DH - T * N2O4_DS) / (R * T)); // 표준 압력 1 bar 기준
const Kc = (T) => Kp(T) / (R_LBAR * T); // Δn = 1
// n0: N2O4 로 환산한 전체 양(mol), 해리된 양 x 에 대해 Kc = (2x/V)² / ((n0−x)/V)
const xEq = (n0, V, T) => {
  const a = Kc(T) * V;
  return (-a + Math.sqrt(a * a + 16 * a * n0)) / 8;
};

export default function Equilibrium() {
  const [T, setT] = useState(298);
  const [V, setV] = useState(1.5);
  const [, force] = useState(0);
  const st = useRef({ n0: 0.04, x: xEq(0.04, 1.5, 298), t: 0, hist: [], parts: [] });
  const canvasRef = useRef(null);
  const s = st.current;
  const boxW = V * PX_PER_L;

  const add = (kind, mmol) => {
    if (kind === 'NO2') { s.n0 += mmol / 2000; s.x += mmol / 2000; }
    else s.n0 += mmol / 1000;
    force((k) => k + 1);
  };

  useAnimationFrame((dt) => {
    const xe = xEq(s.n0, V, T);
    s.x += (xe - s.x) * (1 - Math.exp(-dt / RELAX));
    s.t += dt;
    if (!s.hist.length || s.t - s.hist[s.hist.length - 1][0] > 0.1) {
      s.hist.push([s.t, (2 * s.x) / V, (s.n0 - s.x) / V]);
      if (s.hist.length > 300) s.hist.shift();
    }
    // 입자 수 맞추기 (N2O4 ↔ 2NO2)
    const wantN2O4 = Math.round(((s.n0 - s.x) * 1000) / MMOL_PER_PARTICLE);
    const wantNO2 = Math.round((2 * s.x * 1000) / MMOL_PER_PARTICLE);
    const P = s.parts;
    const rnd = () => ({ x: 20 + Math.random() * boxW, y: BOX_Y + Math.random() * BOX_H, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120 });
    let cN = P.filter((p) => p.k === 'N').length, cD = P.length - cN;
    while (cN > wantN2O4 && cD + 2 <= wantNO2 + 1) { // 해리
      const i = P.findIndex((p) => p.k === 'N'); const p = P[i];
      P.splice(i, 1, { ...p, k: 'D', vx: -p.vx }, { ...p, k: 'D', x: p.x + 8 }); cN--; cD += 2;
    }
    while (cD >= 2 && cN < wantN2O4 && cD > wantNO2) { // 결합
      const i = P.findIndex((p) => p.k === 'D'); P[i].k = 'N';
      P.splice(P.findIndex((p, j) => j !== i && p.k === 'D'), 1); cN++; cD -= 2;
    }
    while (cN < wantN2O4) { P.push({ ...rnd(), k: 'N' }); cN++; }
    while (cD < wantNO2) { P.push({ ...rnd(), k: 'D' }); cD++; }
    while (cN > wantN2O4) { P.splice(P.findIndex((p) => p.k === 'N'), 1); cN--; }
    while (cD > wantNO2) { P.splice(P.findIndex((p) => p.k === 'D'), 1); cD--; }

    const speed = Math.sqrt(T / 298);
    for (const p of P) {
      p.x += p.vx * speed * dt; p.y += p.vy * speed * dt;
      if (p.x < 26) { p.x = 26; p.vx = Math.abs(p.vx); }
      if (p.x > 14 + boxW) { p.x = 14 + boxW; p.vx = -Math.abs(p.vx); }
      if (p.y < BOX_Y + 6) { p.y = BOX_Y + 6; p.vy = Math.abs(p.vy); }
      if (p.y > BOX_Y + BOX_H - 6) { p.y = BOX_Y + BOX_H - 6; p.vy = -Math.abs(p.vy); }
    }

    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const cNO2 = (2 * s.x) / V;
    ctx.fillStyle = `rgba(150,75,0,${Math.min(0.55, cNO2 * 6)})`;
    ctx.fillRect(20, BOX_Y, boxW, BOX_H);
    ctx.strokeStyle = '#334'; ctx.lineWidth = 3; ctx.strokeRect(20, BOX_Y, boxW, BOX_H);
    ctx.fillStyle = '#8a94a6'; ctx.fillRect(20 + boxW, BOX_Y - 6, 10, BOX_H + 12);
    for (const p of P) {
      if (p.k === 'D') {
        ctx.fillStyle = '#8b4513'; ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#d9dde6'; ctx.strokeStyle = '#99a'; ctx.lineWidth = 1;
        [-4, 4].forEach((o) => { ctx.beginPath(); ctx.arc(p.x + o, p.y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
      }
    }
    force((k) => (k + 1) % 1000);
  });

  const cNO2 = (2 * s.x) / V, cN2O4 = (s.n0 - s.x) / V;
  const Q = (cNO2 * cNO2) / cN2O4, K = Kc(T);
  const dir = Math.abs(Q - K) / K < 0.02 ? '평형 상태 (Q = K)' : Q < K ? 'Q < K → 정반응 쪽 (NO₂ 생성)' : 'Q > K → 역반응 쪽 (N₂O₄ 생성)';
  const t0 = s.hist.length ? s.hist[0][0] : 0;
  const yMax = Math.max(0.02, ...s.hist.map((h) => Math.max(h[1], h[2]))) * 1.15;

  return (
    <SimLayout
      canvas={<>
        <canvas ref={canvasRef} width={W} height={H} />
        <LineChart height={220} xDomain={[t0, t0 + 30]} yDomain={[0, yMax]} xTicks={6} yTicks={4}
          series={[
            { label: '[NO₂]', color: '#8b4513', points: s.hist.map((h) => [h[0], h[1]]) },
            { label: '[N₂O₄]', color: '#7a8699', points: s.hist.map((h) => [h[0], h[2]]) },
          ]}
          xFormat={(v) => Math.round(v)} yFormat={(v) => v.toFixed(3)}
          xLabel="시간 (화면 초)" yLabel="농도 (mol/L)" />
      </>}
      controls={<>
        <div className="eq-eqn">N₂O₄(g) ⇌ 2NO₂(g) &nbsp; ΔH° = +{(N2O4_DH / 1000).toFixed(1)} kJ</div>
        <Slider label="온도" value={T} min={273} max={373} unit=" K" onChange={setT} />
        <Slider label="부피 (압력 변화)" value={V} min={0.5} max={3} step={0.1} unit=" L" onChange={setV} />
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={() => add('NO2', 10)}>NO₂ 10 mmol 추가</button>
          <button className="btn btn-ghost" onClick={() => add('N2O4', 10)}>N₂O₄ 10 mmol 추가</button>
        </div>
        <Readout rows={[
          ['평형 상수 Kc', sci(K, 3)],
          ['반응 지수 Qc', sci(Q, 3)],
          ['진행 방향', dir],
          ['[NO₂]', `${cNO2.toFixed(4)} M`],
          ['[N₂O₄]', `${cN2O4.toFixed(4)} M`],
          ['전체 압력', `${((s.x + s.n0) * R_LBAR * T / V * 100).toFixed(1)} kPa`],
        ]} />
      </>}
      footer={<ScaleNote items={[
        `입자 1개 = ${MMOL_PER_PARTICLE} mmol, 용기 가로 길이 ∝ 부피 (1 L = ${PX_PER_L} px)`,
        '갈색 배경의 진하기 ∝ [NO₂]',
        `K(T) = exp(−(ΔH° − TΔS°)/RT): CRC 표준 생성 엔탈피·엔트로피로 계산 (ΔS° = ${N2O4_DS.toFixed(1)} J/K, ΔH°·ΔS° 는 온도와 무관하다고 가정)`,
        `평형으로 가는 속도는 화면용(시정수 ${RELAX}초) — 실제 반응 속도와 무관`,
      ]} />}
    />
  );
}
