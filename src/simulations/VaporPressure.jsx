import { useState } from 'react';
import { Slider, SimLayout, ScaleNote, Readout, LineChart, bisect } from './common.jsx';
import { WATER_VP, SOLVENT_VP, interp } from '../data/crc.js';

// 클라우지우스-클레이페이론 식 ln P = A − B/T 를 CRC 의 두 점(10 kPa, 100 kPa)으로 맞춤
function fitCC({ t10, t100 }) {
  const T1 = t10 + 273.15, T2 = t100 + 273.15;
  const B = Math.log(10) / (1 / T1 - 1 / T2);
  const A = Math.log(100) + B / T2;
  return { B, f: (t) => Math.exp(A - B / (t + 273.15)) };
}

const LN_WATER_VP = WATER_VP.map(([t, p]) => [t, Math.log(p)]);

const LIQUIDS = [
  { id: 'water', ko: '물', color: '#2f80ed', vp: (t) => Math.exp(interp(LN_WATER_VP, t)), note: '표 값 보간' },
  ...Object.entries(SOLVENT_VP).map(([id, s], i) => {
    const { f } = fitCC(s);
    return { id, ko: s.ko, color: ['#27ae60', '#f2994a', '#eb5757'][i], vp: f, note: '2점 맞춤' };
  }),
];
const T_MAX = 120, P_MAX = 200;

function Flask({ liquid, t, pext }) {
  const p = liquid.vp(t);
  const boiling = p >= pext;
  const h = Math.min(1, p / P_MAX) * 120; // 증기압 막대
  return (
    <div className="flask">
      <svg viewBox="0 0 120 190" width="100%">
        <rect x="10" y={150 - h} width="22" height={h} fill={liquid.color} opacity="0.35" />
        <rect x="10" y="30" width="22" height="120" fill="none" stroke="#99a" />
        <text x="21" y="22" textAnchor="middle" className="tick">{p.toFixed(1)}</text>
        <path d="M52 40 h36 v40 l18 60 a10 10 0 0 1 -9 14 h-54 a10 10 0 0 1 -9 -14 l18 -60z" fill="#fff" stroke="#556" strokeWidth="2" />
        <path d="M46 118 h48 l8 22 a10 10 0 0 1 -9 14 h-46 a10 10 0 0 1 -9 -14z" fill={liquid.color} opacity="0.5" />
        {boiling && [0, 1, 2, 3, 4].map((i) => (
          <circle key={i} cx={56 + i * 7} cy="140" r="3" fill="#fff" className="bubble" style={{ animationDelay: `${i * 0.25}s` }} />
        ))}
      </svg>
      <div className="flask-label"><b>{liquid.ko}</b><span className={boiling ? 'boil' : ''}>{boiling ? '끓는 중' : '증발'}</span></div>
    </div>
  );
}

export default function VaporPressure() {
  const [t, setT] = useState(25);
  const [pext, setPext] = useState(101.3);
  const series = LIQUIDS.map((l) => ({
    label: l.ko, color: l.color,
    points: Array.from({ length: 121 }, (_, i) => [i, l.vp(i)]).filter(([, p]) => p <= P_MAX * 1.03),
  }));
  const bp = (l) => bisect((x) => l.vp(x) - pext, -60, 200);

  return (
    <SimLayout
      canvas={<>
        <div className="flasks">{LIQUIDS.map((l) => <Flask key={l.id} liquid={l} t={t} pext={pext} />)}</div>
        <LineChart series={series} xDomain={[0, T_MAX]} yDomain={[0, P_MAX]} xTicks={6} yTicks={4}
          hLines={[{ y: pext, color: '#555', label: `외부 압력 ${pext} kPa` }]}
          vLines={[{ x: t, color: '#999', label: `${t} °C` }]}
          markers={LIQUIDS.map((l) => ({ x: t, y: l.vp(t), color: l.color }))}
          xLabel="온도 (°C)" yLabel="증기 압력 (kPa)" />
      </>}
      controls={<>
        <Slider label="온도" value={t} min={0} max={T_MAX} unit=" °C" onChange={setT} />
        <Slider label="외부 압력" value={pext} min={20} max={190} step={0.1} unit=" kPa" onChange={setPext} />
        <button className="btn btn-ghost" onClick={() => setPext(101.3)}>1기압 (101.3 kPa)</button>
        <Readout rows={LIQUIDS.map((l) => [`${l.ko} 끓는점`, `${bp(l).toFixed(1)} °C`])} />
        <p className="small muted">증기 압력이 외부 압력과 같아지는 온도가 끓는점입니다. 분자 간 인력이 큰 액체일수록 같은 온도에서 증기 압력이 낮습니다.</p>
      </>}
      footer={<ScaleNote items={[
        '플라스크 왼쪽 막대: 증기 압력에 비례 (0–200 kPa → 0–120 px), 위 숫자는 kPa',
        '물: CRC 포화 증기압 표(0.01–120 °C)를 ln P 기준으로 보간',
        '에탄올·아세톤·다이에틸 에테르: CRC 의 10 kPa·100 kPa 온도 두 점으로 ln P = A − B/T 를 맞춘 근사값',
      ]} />}
    />
  );
}
