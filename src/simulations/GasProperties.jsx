import { useEffect, useRef, useState } from 'react';
import { Slider, Select, SimLayout, ScaleNote, Readout, LineChart, useAnimationFrame } from './common.jsx';
import { GASES, R, R_LBAR, NA, molarMass } from '../data/crc.js';

const W = 640, H = 340, BOX_Y = 20, BOX_H = 300, PX_PER_L = 110;
const MMOL_PER_PARTICLE = 2; // 입자 1개 = 2 mmol
const SPEED_SCALE = 0.25; // 화면 1 px/s = 4 m/s
const RADIUS = 4;

const gauss = () => Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random());

export default function GasProperties() {
  const [gasA, setGasA] = useState('N2');
  const [gasB, setGasB] = useState('none');
  const [nA, setNA] = useState(100); // mmol
  const [nB, setNB] = useState(40);
  const [T, setT] = useState(300); // K
  const [V, setV] = useState(2.5); // L
  const particles = useRef([]);
  const prevT = useRef(T);
  const canvasRef = useRef(null);
  const boxW = V * PX_PER_L;

  const spawn = (gas, T0) => {
    const M = molarMass(GASES[gas].formula) / 1000;
    const s = Math.sqrt((R * T0) / M) * SPEED_SCALE;
    return { gas, x: 20 + RADIUS + Math.random() * (boxW - 2 * RADIUS), y: BOX_Y + RADIUS + Math.random() * (BOX_H - 2 * RADIUS), vx: gauss() * s, vy: gauss() * s };
  };

  // 기체 종류·양이 바뀌면 입자 수 맞추기
  useEffect(() => {
    const want = { [gasA]: Math.round(nA / MMOL_PER_PARTICLE) };
    if (gasB !== 'none' && gasB !== gasA) want[gasB] = Math.round(nB / MMOL_PER_PARTICLE);
    const next = [];
    for (const [g, count] of Object.entries(want)) {
      const have = particles.current.filter((p) => p.gas === g).slice(0, count);
      while (have.length < count) have.push(spawn(g, prevT.current));
      next.push(...have);
    }
    particles.current = next;
  }, [gasA, gasB, nA, nB]);

  // 온도 변화 → 속력 ∝ √T
  useEffect(() => {
    const k = Math.sqrt(T / prevT.current);
    particles.current.forEach((p) => { p.vx *= k; p.vy *= k; });
    prevT.current = T;
  }, [T]);

  useAnimationFrame((dt) => {
    const right = 20 + boxW - RADIUS;
    for (const p of particles.current) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < 20 + RADIUS) { p.x = 20 + RADIUS; p.vx = Math.abs(p.vx); }
      if (p.x > right) { p.x = right; p.vx = -Math.abs(p.vx); }
      if (p.y < BOX_Y + RADIUS) { p.y = BOX_Y + RADIUS; p.vy = Math.abs(p.vy); }
      if (p.y > BOX_Y + BOX_H - RADIUS) { p.y = BOX_Y + BOX_H - RADIUS; p.vy = -Math.abs(p.vy); }
    }
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f7f9fc'; ctx.fillRect(20, BOX_Y, boxW, BOX_H);
    ctx.strokeStyle = '#334'; ctx.lineWidth = 3; ctx.strokeRect(20, BOX_Y, boxW, BOX_H);
    ctx.fillStyle = '#8a94a6'; ctx.fillRect(20 + boxW, BOX_Y - 6, 12, BOX_H + 12); // 피스톤
    ctx.fillRect(20 + boxW + 12, BOX_Y + BOX_H / 2 - 5, W - boxW - 32, 10);
    for (const p of particles.current) {
      ctx.fillStyle = GASES[p.gas].color;
      ctx.beginPath(); ctx.arc(p.x, p.y, RADIUS, 0, Math.PI * 2); ctx.fill();
    }
  });

  // 계산 (실제 단위)
  const gases = [{ g: gasA, n: nA / 1000 }];
  if (gasB !== 'none' && gasB !== gasA) gases.push({ g: gasB, n: nB / 1000 });
  const nTot = gases.reduce((s, x) => s + x.n, 0);
  const P = (n) => (n * R * T) / V; // kPa (J/L = kPa)
  const vdw = (g, n) => 100 * ((n * R_LBAR * T) / (V - n * GASES[g].b) - (GASES[g].a * n * n) / (V * V));
  const vrms = (g) => Math.sqrt((3 * R * T) / (molarMass(GASES[g].formula) / 1000));
  const gasOpts = Object.entries(GASES).map(([k, v]) => ({ value: k, label: `${v.ko} (${v.formula.replace(/2/g, '₂')})` }));
  const curve = Array.from({ length: 41 }, (_, i) => { const v = 1 + i * 0.1; return [v, (nTot * R * T) / v]; });

  const rows = [['전체 압력 (이상 기체)', `${P(nTot).toFixed(1)} kPa`]];
  gases.forEach(({ g, n }) => {
    rows.push([`${GASES[g].ko} 부분 압력`, `${P(n).toFixed(1)} kPa (몰 분율 ${(n / nTot).toFixed(2)})`]);
    rows.push([`${GASES[g].ko} 평균 속력 √(3RT/M)`, `${Math.round(vrms(g))} m/s`]);
  });
  if (gases.length === 1) rows.push(['실제 기체 (반데르발스)', `${vdw(gasA, nA / 1000).toFixed(1)} kPa`]);

  return (
    <SimLayout
      canvas={<>
        <canvas ref={canvasRef} width={W} height={H} />
        <LineChart height={210} series={[{ points: curve, color: '#2f80ed', label: `PV = nRT (n = ${(nTot * 1000).toFixed(0)} mmol, T = ${T} K)` }]}
          markers={[{ x: V, y: P(nTot), color: '#eb5757' }]} xDomain={[1, 5]} xTicks={8}
          yDomain={[0, Math.max(200, Math.ceil((nTot * R * T) / 200) * 200)]}
          xLabel="부피 (L)" yLabel="압력 (kPa)" />
      </>}
      controls={<>
        <Select label="기체 A" value={gasA} onChange={setGasA} options={gasOpts} />
        <Slider label="기체 A 양" value={nA} min={10} max={200} step={2} unit=" mmol" onChange={setNA} />
        <Select label="기체 B (혼합)" value={gasB} onChange={setGasB} options={[{ value: 'none', label: '없음' }, ...gasOpts]} />
        {gasB !== 'none' && <Slider label="기체 B 양" value={nB} min={10} max={200} step={2} unit=" mmol" onChange={setNB} />}
        <Slider label="온도" value={T} min={100} max={600} step={5} unit=" K" onChange={setT} />
        <Slider label="부피" value={V} min={1} max={5} step={0.1} unit=" L" onChange={setV} />
        <Readout rows={rows} />
      </>}
      footer={<ScaleNote items={[
        `입자 1개 = ${MMOL_PER_PARTICLE} mmol = ${(MMOL_PER_PARTICLE / 1000 * NA).toExponential(2)} 개 분자`,
        `입자 속력: 실제 분자 속력 분포(맥스웰 분포)에서 뽑은 값 × ${SPEED_SCALE} (화면 1 px/s = ${1 / SPEED_SCALE} m/s)`,
        `용기 가로 길이 ∝ 부피 (1 L = ${PX_PER_L} px), 입자 크기는 실제와 무관`,
      ]} />}
    />
  );
}
