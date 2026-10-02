import { useMemo, useState } from 'react';
import { Slider, Select, SimLayout, ScaleNote, Readout, LineChart } from './common.jsx';
import { SOLVENTS, WATER_VP, molarMass } from '../data/crc.js';

const SOLUTES = [
  { id: 'glucose', ko: '포도당 (C₆H₁₂O₆)', i: 1 },
  { id: 'urea', ko: '요소 (CO(NH₂)₂)', i: 1 },
  { id: 'nacl', ko: '염화 나트륨 (NaCl)', i: 2 },
  { id: 'cacl2', ko: '염화 칼슘 (CaCl₂)', i: 3 },
];
const P0_25 = WATER_VP.find(([t]) => t === 25)[1]; // 25 °C 물의 증기압
const DOTS_PER_MOLAL = 12; // 용질 입자 표시: 1 mol/kg 당 12개

function Thermo({ label, value, base, color, min, max }) {
  const H = 160, y = (v) => 10 + (1 - (v - min) / (max - min)) * H;
  return (
    <svg viewBox="0 0 90 200" className="thermo">
      <rect x="35" y="10" width="20" height={H} rx="10" fill="#eef1f6" stroke="#aab" />
      <rect x="39" y={y(value)} width="12" height={H + 10 - y(value)} fill={color} />
      <circle cx="45" cy={H + 18} r="14" fill={color} />
      <line x1="58" x2="72" y1={y(base)} y2={y(base)} stroke="#555" strokeDasharray="3 2" />
      <text x="74" y={y(base) + 4} className="tick">순수</text>
      <text x="45" y="196" textAnchor="middle" className="tick">{label}</text>
      <text x="5" y={y(value) + 4} className="tick">{value.toFixed(2)}</text>
    </svg>
  );
}

export default function Colligative() {
  const [solvent, setSolvent] = useState('water');
  const [solute, setSolute] = useState('glucose');
  const [m, setM] = useState(1);
  const S = SOLVENTS[solvent];
  const i = SOLUTES.find((s) => s.id === solute).i;
  const dTb = i * S.kb * m, dTf = i * S.kf * m;

  const dots = useMemo(() => Array.from({ length: 60 }, () => [20 + Math.random() * 180, 60 + Math.random() * 110]), []);
  const nDots = Math.round(i * m * DOTS_PER_MOLAL);

  const nWater = 1000 / molarMass('H2O');
  const xSolvent = nWater / (nWater + i * m);

  return (
    <SimLayout
      canvas={<>
        <div className="colli-row">
          <svg viewBox="0 0 220 190" className="beaker">
            <path d="M15 40 v130 a10 10 0 0 0 10 10 h170 a10 10 0 0 0 10 -10 v-130" fill="none" stroke="#556" strokeWidth="3" />
            <rect x="18" y="55" width="184" height="122" fill="#d6ebff" opacity="0.6" />
            {dots.slice(0, nDots).map(([x, y], k) => <circle key={k} cx={x} cy={y} r="4" fill="#eb5757" />)}
            <text x="110" y="28" textAnchor="middle" className="tick">{S.ko} 1 kg + 용질 입자</text>
          </svg>
          <Thermo label="끓는점 (°C)" value={S.bp + dTb} base={S.bp} color="#eb5757" min={S.bp - 1} max={S.bp + Math.max(4, S.kb * 6)} />
          <Thermo label="어는점 (°C)" value={S.mp - dTf} base={S.mp} color="#2f80ed" min={S.mp - Math.max(4, S.kf * 6)} max={S.mp + 1} />
        </div>
        <LineChart height={230} xDomain={[0, 2]} yDomain={[0, Math.ceil(S.kf * 2 * 3)]} xTicks={4}
          series={[
            { label: `ΔTf = i·Kf·m (Kf = ${S.kf})`, color: '#2f80ed', points: [[0, 0], [2, i * S.kf * 2]] },
            { label: `ΔTb = i·Kb·m (Kb = ${S.kb})`, color: '#eb5757', points: [[0, 0], [2, i * S.kb * 2]] },
          ]}
          markers={[{ x: m, y: dTf, color: '#2f80ed' }, { x: m, y: dTb, color: '#eb5757' }]}
          xLabel="몰랄 농도 m (mol/kg)" yLabel="온도 변화 (K)" />
      </>}
      controls={<>
        <Select label="용매" value={solvent} onChange={setSolvent} options={Object.entries(SOLVENTS).map(([k, v]) => ({ value: k, label: v.ko }))} />
        <Select label="용질" value={solute} onChange={setSolute} options={SOLUTES.map((s) => ({ value: s.id, label: s.ko }))} />
        <Slider label="몰랄 농도" value={m} min={0} max={2} step={0.05} unit=" mol/kg" onChange={setM} />
        <Readout rows={[
          ['반트호프 인자 i (이상적)', i],
          ['끓는점 오름 ΔTb', `${dTb.toFixed(3)} K`],
          ['어는점 내림 ΔTf', `${dTf.toFixed(3)} K`],
          ['용액의 끓는점', `${(S.bp + dTb).toFixed(2)} °C`],
          ['용액의 어는점', `${(S.mp - dTf).toFixed(2)} °C`],
          ...(solvent === 'water' ? [['25 °C 증기압 (라울 법칙)', `${(xSolvent * P0_25).toFixed(3)} kPa (순수 ${P0_25})`]] : []),
        ]} />
        <p className="small muted">전해질은 물에서 이온으로 나뉘어 입자 수가 늘어납니다. 여기서는 완전히 해리된다고 가정했습니다.</p>
      </>}
      footer={<ScaleNote items={[
        `용질 입자 점: 몰랄 농도 × i 1 mol/kg 당 ${DOTS_PER_MOLAL}개`,
        '온도계 눈금: 용매마다 순수 용매의 끓는점·어는점을 기준으로 확대해 표시',
        '묽은 용액 근사식 ΔT = i·K·m 사용 (고농도에서는 실제와 차이 날 수 있음)',
      ]} />}
    />
  );
}
