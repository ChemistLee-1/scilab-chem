import { useEffect, useRef, useState } from 'react';
import { Slider, Select, SimLayout, ScaleNote, Readout, LineChart, useAnimationFrame } from './common.jsx';
import { SOLUTION_ENTHALPY, WATER_CP, molarMass } from '../data/crc.js';

const T0 = 25; // 처음 물 온도 (°C)
const TAU = 6; // 온도 변화 시정수 (초, 화면용)

export default function DissolutionHeat() {
  const [solute, setSolute] = useState('NH4NO3');
  const [mass, setMass] = useState(10);
  const [water, setWater] = useState(100);
  const [time, setTime] = useState(null); // null = 아직 넣지 않음
  const [log, setLog] = useState([]);
  const tRef = useRef(0);

  const S = SOLUTION_ENTHALPY.find((s) => s.formula === solute);
  const M = molarMass(solute);
  const n = mass / M;
  const q = n * S.dH * 1000; // J (계가 흡수한 열, + 면 흡열)
  const dT = -q / ((water + mass) * WATER_CP);
  const temp = time == null ? T0 : T0 + dT * (1 - Math.exp(-time / TAU));

  useEffect(() => { setTime(null); setLog([]); }, [solute, mass, water]);

  useAnimationFrame((dt) => {
    tRef.current += dt;
    const t = tRef.current;
    setTime(t);
    if (log.length === 0 || t - log[log.length - 1][0] > 0.25) setLog((l) => [...l, [t, T0 + dT * (1 - Math.exp(-t / TAU))]]);
  }, time != null && time < 30);

  const start = () => { tRef.current = 0; setLog([[0, T0]]); setTime(0); };
  const exo = S.dH < 0;
  const color = temp > T0 ? `rgba(235,87,87,${Math.min(0.6, (temp - T0) / 20)})` : `rgba(47,128,237,${Math.min(0.6, (T0 - temp) / 15)})`;

  return (
    <SimLayout
      canvas={<>
        <svg viewBox="0 0 640 230" className="calorimeter">
          <rect x="190" y="40" width="200" height="170" rx="16" fill="#f3f4f8" stroke="#99a" strokeWidth="3" />
          <rect x="205" y="80" width="170" height="120" rx="8" fill="#d6ebff" />
          <rect x="205" y="80" width="170" height="120" rx="8" fill={color} />
          <text x="290" y="30" textAnchor="middle" className="tick">간이 열량계 (스타이로폼 컵)</text>
          {time != null && Array.from({ length: 14 }).map((_, k) => (
            <circle key={k} cx={220 + (k * 37) % 150} cy={120 + ((k * 53) % 70)} r="3" fill={exo ? '#c0392b' : '#1f5fa8'} opacity={Math.max(0, 1 - time / 4)} />
          ))}
          <rect x="440" y="30" width="22" height="170" rx="11" fill="#eef1f6" stroke="#aab" />
          <rect x="445" y={200 - ((temp + 10) / 80) * 170} width="12" height={((temp + 10) / 80) * 170} fill={temp >= T0 ? '#eb5757' : '#2f80ed'} />
          <text x="475" y={204 - ((temp + 10) / 80) * 170} className="tick">{temp.toFixed(1)} °C</text>
          <text x="80" y="110" textAnchor="middle" className="big-label">{exo ? '발열' : '흡열'}</text>
          <text x="80" y="135" textAnchor="middle" className="tick">ΔH = {S.dH > 0 ? '+' : ''}{S.dH} kJ/mol</text>
        </svg>
        <LineChart height={220} xDomain={[0, 30]} yDomain={[-10, 70]} xTicks={6} yTicks={8}
          series={[{ label: '온도', color: exo ? '#eb5757' : '#2f80ed', points: log.length ? log : [[0, T0]] }]}
          hLines={[{ y: T0 + dT, color: '#888', label: `최종 ${(T0 + dT).toFixed(1)} °C` }]}
          xLabel="시간 (화면 초)" yLabel="온도 (°C)" />
      </>}
      controls={<>
        <Select label="용질" value={solute} onChange={setSolute}
          options={SOLUTION_ENTHALPY.map((s) => ({ value: s.formula, label: `${s.ko} (${s.formula})` }))} />
        <Slider label="용질 질량" value={mass} min={1} max={20} unit=" g" onChange={setMass} />
        <Slider label="물의 질량" value={water} min={100} max={300} step={10} unit=" g" onChange={setWater} />
        <button className="btn" onClick={start}>용질 넣기</button>
        <Readout rows={[
          ['몰질량', `${M.toFixed(2)} g/mol`],
          ['용질의 양', `${n.toFixed(4)} mol`],
          ['출입한 열', `${Math.abs(q / 1000).toFixed(2)} kJ ${exo ? '방출' : '흡수'}`],
          ['온도 변화 ΔT', `${dT > 0 ? '+' : ''}${dT.toFixed(2)} K`],
        ]} />
        <p className="small muted">열량 q = m·c·ΔT 에서 용액의 비열을 물의 비열({WATER_CP} J/g·K)로 가정했습니다.</p>
      </>}
      footer={<ScaleNote items={[
        '용해 엔탈피: 무한 희석 용액 값(CRC) 사용 — 실제 농도에서는 다소 차이가 있음',
        `온도 변화 속도는 화면용(시정수 ${TAU}초), 최종 온도만 계산값`,
        '열량계의 열 손실은 없다고 가정',
      ]} />}
    />
  );
}
