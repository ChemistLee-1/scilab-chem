import { useRef, useState } from 'react';
import { Slider, Select, SimLayout, ScaleNote, Readout, LineChart, useAnimationFrame } from './common.jsx';
import { SOLVENTS, WATER_VP, molarMass } from '../data/crc.js';

// ions: 화학식 1개가 녹았을 때 생기는 입자들 (전해질은 이온으로 나뉨, 완전 해리 가정)
const SOLUTES = [
  { id: 'glucose', ko: '포도당 (C₆H₁₂O₆)', i: 1, ions: ['glucose'] },
  { id: 'urea', ko: '요소 (CO(NH₂)₂)', i: 1, ions: ['urea'] },
  { id: 'nacl', ko: '염화 나트륨 (NaCl)', i: 2, ions: ['Na', 'Cl'] },
  { id: 'cacl2', ko: '염화 칼슘 (CaCl₂)', i: 3, ions: ['Ca', 'Cl', 'Cl'] },
];
const P0_25 = WATER_VP.find(([t]) => t === 25)[1]; // 25 °C 물의 증기압
const UNITS_PER_MOLAL = 12; // 그림: 용질 1 mol/kg 당 화학식 12개 (NaCl 이면 Na⁺ 12개 + Cl⁻ 12개)

// 입자 종류별 모양과 색 (중화 적정 시뮬레이션과 같은 색: Na⁺ 보라, 음이온 초록)
// 크기는 대략적인 비교용 (Cl⁻ 가 Na⁺·Ca²⁺ 보다 큼, 포도당 분자가 요소 분자보다 큼)
const LOOK = {
  glucose: { r: 5.5, color: '#eb5757', sign: '', name: '포도당 분자' },
  urea: { r: 4, color: '#eb5757', sign: '', name: '요소 분자' },
  Na: { r: 4, color: '#9b51e0', sign: '+', name: 'Na⁺' },
  Ca: { r: 4, color: '#f2994a', sign: '2+', name: 'Ca²⁺' },
  Cl: { r: 6, color: '#27ae60', sign: '−', name: 'Cl⁻' },
};

// 비커 속 액체가 있는 곳 (SVG 좌표)
const LIQ = { l: 18, r: 202, top: 55, bot: 177 };
const N_SOLVENT = 70; // 배경으로 움직이는 용매 분자 수 (개수는 실제 비율 아님)
const WANDER = 22; // 용질 입자의 평균 빠르기 (화면 px/초)

const rand = (a, b) => a + Math.random() * (b - a);
// 정규분포 난수 (브라운 운동의 무작위 밀침)
const gauss = () => Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random());

// 액체 속 아무 곳에 입자 하나 만들기
function makeParticle(type, x, y, speed) {
  const a = rand(0, Math.PI * 2);
  return { type, x: x ?? rand(LIQ.l + 8, LIQ.r - 8), y: y ?? rand(LIQ.top + 8, LIQ.bot - 8), vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
}

// 화학식 1개가 녹은 모습: 같은 자리에서 이온들이 생겨 서로 흩어짐
function makeUnit(ions) {
  const x = rand(LIQ.l + 12, LIQ.r - 12), y = rand(LIQ.top + 12, LIQ.bot - 12);
  return ions.map((type, k) => {
    const a = (k / ions.length) * Math.PI * 2 + rand(0, 1);
    return makeParticle(type, x + Math.cos(a) * 5, y + Math.sin(a) * 5, WANDER);
  });
}

// 브라운 운동: 둘레의 용매 분자에게 끊임없이 무작위로 밀려 방향이 계속 바뀜 (기체처럼 곧게 날아가지 않음)
//  - 속도가 조금씩 줄어들고(끌림) 무작위로 밀리는 힘이 더해짐 → 평균 빠르기는 speed 근처로 유지
function wander(p, dt, speed, r) {
  const tau = 0.4; // 방향이 바뀌는 데 걸리는 대략적인 시간 (초, 화면용)
  const kick = speed * Math.sqrt((2 * dt) / tau);
  p.vx += (-p.vx / tau) * dt + gauss() * kick / Math.SQRT2;
  p.vy += (-p.vy / tau) * dt + gauss() * kick / Math.SQRT2;
  p.x += p.vx * dt; p.y += p.vy * dt;
  // 비커 벽·바닥에서 튕기고, 수면 위로는 나가지 않음 (용질은 비휘발성)
  if (p.x < LIQ.l + r) { p.x = LIQ.l + r; p.vx = Math.abs(p.vx); }
  if (p.x > LIQ.r - r) { p.x = LIQ.r - r; p.vx = -Math.abs(p.vx); }
  if (p.y < LIQ.top + r) { p.y = LIQ.top + r; p.vy = Math.abs(p.vy); }
  if (p.y > LIQ.bot - r) { p.y = LIQ.bot - r; p.vy = -Math.abs(p.vy); }
}

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
  const SOL = SOLUTES.find((s) => s.id === solute);
  const i = SOL.i;
  const dTb = i * S.kb * m, dTf = i * S.kf * m;

  // 그림 속 화학식 개수: 농도에 비례. 이온 수는 화학식 개수 × (화학식 1개의 이온 수) 라서 전하가 항상 맞음
  const nUnits = Math.round(m * UNITS_PER_MOLAL);

  // 움직이는 입자들은 화면을 다시 그려도 사라지지 않도록 ref 에 보관
  const sim = useRef(null);
  if (!sim.current) sim.current = { solute: null, units: [], solvent: Array.from({ length: N_SOLVENT }, () => makeParticle('W', null, null, WANDER * 1.6)) };
  const st = sim.current;
  // 용질을 바꾸면 처음부터 다시 녹임
  if (st.solute !== solute) { st.solute = solute; st.units = []; }
  // 농도를 올리면 그만큼 새로 녹고, 내리면 뺌 (나머지 입자는 하던 움직임 그대로)
  while (st.units.length < nUnits) st.units.push(makeUnit(SOL.ions));
  if (st.units.length > nUnits) st.units.length = nUnits;

  const [, tick] = useState(0);
  useAnimationFrame((dt) => {
    if (!(dt > 0)) return; // 첫 장면에서 시간 간격이 0 이나 음수로 올 수 있어 건너뜀
    for (const p of st.solvent) wander(p, dt, WANDER * 1.6, 2);
    for (const u of st.units) for (const p of u) wander(p, dt, WANDER, LOOK[p.type].r);
    tick((k) => (k + 1) % 1000);
  });
  const particles = st.units.flat();
  const countOf = (type) => particles.filter((p) => p.type === type).length;
  const kinds = [...new Set(SOL.ions)];

  const nWater = 1000 / molarMass('H2O');
  const xSolvent = nWater / (nWater + i * m);

  return (
    <SimLayout
      canvas={<>
        <div className="colli-row">
          <svg viewBox="0 0 220 190" className="beaker">
            <path d="M15 40 v130 a10 10 0 0 0 10 10 h170 a10 10 0 0 0 10 -10 v-130" fill="none" stroke="#556" strokeWidth="3" />
            <rect x="18" y="55" width="184" height="122" fill="#d6ebff" opacity="0.6" />
            {st.solvent.map((p, k) => <circle key={`w${k}`} cx={p.x} cy={p.y} r="2" fill="#7fb3ff" opacity="0.45" />)}
            {particles.map((p, k) => {
              const L = LOOK[p.type];
              return (
                <g key={k}>
                  <circle cx={p.x} cy={p.y} r={L.r} fill={L.color} />
                  {L.sign && <text x={p.x} y={p.y + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={L.sign.length > 1 ? 5 : 8} fontWeight="bold" fill="#fff">{L.sign}</text>}
                </g>
              );
            })}
            <text x="110" y="28" textAnchor="middle" className="tick">{S.ko} 1 kg + 용질 입자</text>
            <text x="110" y="46" textAnchor="middle" className="tick">
              {kinds.map((t, k) => <tspan key={t} fill={LOOK[t].color}>{k > 0 ? '  ' : ''}● {LOOK[t].name}</tspan>)}
              <tspan fill="#7fb3ff">  · 용매</tspan>
            </text>
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
          ['그림 속 용질 입자', particles.length === 0 ? '0개' : `${kinds.map((t) => `${LOOK[t].name} ${countOf(t)}`).join(' + ')}${kinds.length > 1 ? ` = ${particles.length}` : ''}개`],
          ['끓는점 오름 ΔTb', `${dTb.toFixed(3)} K`],
          ['어는점 내림 ΔTf', `${dTf.toFixed(3)} K`],
          ['용액의 끓는점', `${(S.bp + dTb).toFixed(2)} °C`],
          ['용액의 어는점', `${(S.mp - dTf).toFixed(2)} °C`],
          ...(solvent === 'water' ? [['25 °C 증기압 (라울 법칙)', `${(xSolvent * P0_25).toFixed(3)} kPa (순수 ${P0_25})`]] : []),
        ]} />
        <p className="small muted">전해질은 물에서 이온으로 나뉘어 입자 수가 늘어납니다. 여기서는 완전히 해리된다고 가정했습니다.</p>
        <p className="small muted">녹은 용질 입자는 용매 분자에 끊임없이 부딪혀 이리저리 방향을 바꾸며 움직이고(브라운 운동), 비휘발성이라 수면 위로 날아가지 않습니다. 총괄성은 입자의 종류가 아니라 개수에만 달려 있습니다.</p>
      </>}
      footer={<ScaleNote items={[
        `용질 입자: 1 mol/kg 당 화학식 ${UNITS_PER_MOLAL}개 (입자 수 = 화학식 수 × i, 예: NaCl 1 mol/kg → Na⁺ ${UNITS_PER_MOLAL}개 + Cl⁻ ${UNITS_PER_MOLAL}개)`,
        '입자 움직임: 무작위 걸음(브라운 운동)을 보여 주는 화면용 속도 — 실제 확산 속도·입자 크기의 비율은 아님',
        '용매 분자(옅은 파란 점)는 개수를 크게 줄여 배경으로만 표시',
        '온도계 눈금: 용매마다 순수 용매의 끓는점·어는점을 기준으로 확대해 표시',
        '묽은 용액 근사식 ΔT = i·K·m 사용 (고농도에서는 실제와 차이 날 수 있음)',
      ]} />}
    />
  );
}
