import { useState } from 'react';
import { Slider, Segmented, SimLayout, ScaleNote, Readout, sci, subscript } from './common.jsx';
import { MOLE_SUBSTANCES, NA, R, ATM_KPA, molarMass } from '../data/crc.js';

/* ────────────────────────────────────────────────────────────
   1 mol 은 얼마나 클까?
   - 물(액체), 금속(철·구리·알루미늄·금), 기체(헬륨·산소·이산화 탄소)를 골라
     n mol 의 질량·부피를 실제 크기 비율로 봄 (100원 동전, 자, 2 L 페트병과 비교)
   - 같은 1 mol 끼리 나란히 놓고 비교
   - 확대창: 입자 사이 평균 거리 (액체·고체는 빽빽, 기체는 듬성듬성)
   - 6.02 × 10²³ 개를 하나씩 센다면 몇 년이 걸리는지 계산
   ──────────────────────────────────────────────────────────── */

// ── 화면 축척
const PX_CM = 30; // 액체·금속: 1 cm = 30 px
const PX_CM_GAS = 5; // 기체: 1 cm = 5 px (부피가 너무 커서 축척을 줄임)
const PX_NM = 40; // 확대창: 1 nm = 40 px

// ── 크기를 비교할 생활 물건 (CRC 값 아님, 대략적인 크기)
const COIN_CM = 2.4; // 100원 동전 지름
const BOTTLE = { w: 10, h: 31, L: 2 }; // 2 L 페트병 (폭, 높이 cm)
const BEAKER = { d: 4, h: 5 }; // 물을 담는 비커 (안지름, 높이 cm)

// ── 세기 비교용 속도 (개/초)
const COUNTERS = [
  { value: 'one', label: '나 혼자', rate: 1, text: '1초에 1개씩 혼자 센다면' },
  { value: 'world', label: '전 세계 사람', rate: 8e9, text: '전 세계 80억 명이 1초에 1개씩 함께 센다면' },
  { value: 'pc', label: '컴퓨터', rate: 1e9, text: '1초에 10억 개를 세는 컴퓨터라면' },
];
const YEAR_S = 365.25 * 24 * 3600; // 1년 = 초
const UNIVERSE_YEARS = 1.38e10; // 우주의 나이 약 138억 년 (참고값)

// 같은 그림이 매번 나오도록 고정된 '무작위' 수 만들기
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

// 정육면체를 비스듬히 본 모습 (앞면 + 윗면 + 옆면). x, y = 앞면 왼쪽 아래 꼭짓점, a = 한 변(px)
function Cube({ x, y, a, color, opacity = 1, dashed = false }) {
  const d = a * 0.35; // 뒤로 들어간 깊이를 비스듬히 그린 길이
  const top = `${x},${y - a} ${x + d},${y - a - d} ${x + a + d},${y - a - d} ${x + a},${y - a}`;
  const side = `${x + a},${y} ${x + a},${y - a} ${x + a + d},${y - a - d} ${x + a + d},${y - d}`;
  const line = { stroke: '#4a5565', strokeWidth: 1.2, strokeDasharray: dashed ? '5 4' : undefined };
  return (
    <g opacity={opacity}>
      <rect x={x} y={y - a} width={a} height={a} fill={color} {...line} />
      <polygon points={top} fill={color} {...line} style={{ filter: 'brightness(1.18)' }} />
      <polygon points={side} fill={color} {...line} style={{ filter: 'brightness(0.82)' }} />
    </g>
  );
}

// 물질 하나의 n mol 값 계산
function amounts(sub, n, T) {
  const M = molarMass(sub.formula); // 몰질량 g/mol
  const mass = n * M; // 질량 g
  // 부피 cm³ : 기체는 이상 기체 V = nRT/P, 나머지는 질량 ÷ 밀도
  const vol = sub.state === 'gas' ? (n * R * T / ATM_KPA) * 1000 : mass / sub.rho;
  const N = n * NA; // 입자 수
  const side = Math.cbrt(vol); // 같은 부피 정육면체의 한 변 cm
  const gap = Math.cbrt(vol / N) * 1e7; // 입자 1개가 차지하는 공간의 한 변 = 입자 사이 평균 거리 (nm)
  return { M, mass, vol, N, side, gap };
}

const fmt = (x, d = 1) => x.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });

export default function MoleSize() {
  const [id, setId] = useState('H2O');
  const [n, setN] = useState(1);
  const [cond, setCond] = useState('0'); // 기체 온도: '0' = 0 °C, '25' = 25 °C (압력은 1 atm)
  const [counter, setCounter] = useState('one');

  const sub = MOLE_SUBSTANCES.find((s) => s.id === id);
  const isGas = sub.state === 'gas';
  const T = 273.15 + Number(cond);
  const a = amounts(sub, n, T);
  const group = MOLE_SUBSTANCES.filter((s) => (isGas ? s.state === 'gas' : s.state !== 'gas'));
  const C = COUNTERS.find((c) => c.value === counter);
  const years = a.N / C.rate / YEAR_S;

  // ── 큰 그림: 바닥선과 자
  const W = 640, FLOOR = 282, X0 = 40;
  const px = isGas ? PX_CM_GAS : PX_CM;
  const rulerCm = isGas ? 110 : 18;
  const tickStep = isGas ? 5 : 1, labelStep = isGas ? 10 : 2;

  let sample;
  if (sub.state === 'liquid') {
    // 비커에 담긴 물: 높이 = 부피 ÷ 바닥 넓이
    const bw = BEAKER.d * px, bh = BEAKER.h * px, bx = 110, by = FLOOR - 40; // by = 저울 접시 윗면
    const hcm = a.vol / (Math.PI * (BEAKER.d / 2) ** 2);
    const wh = Math.min(hcm, BEAKER.h) * px;
    sample = (
      <g>
        <rect x={bx} y={by - wh} width={bw} height={wh} fill={sub.color} opacity="0.75" />
        <path d={`M${bx - 6} ${by - bh} L${bx} ${by - bh + 6} L${bx} ${by} L${bx + bw} ${by} L${bx + bw} ${by - bh}`} fill="none" stroke="#7a8696" strokeWidth="2.5" />
        <text x={bx + bw + 8} y={by - wh + 4} className="tick">{fmt(a.vol)} mL</text>
        <text x={bx + bw / 2} y={by - bh - 10} textAnchor="middle" className="tick">비커 (안지름 {BEAKER.d} cm)</text>
      </g>
    );
  } else if (sub.state === 'metal') {
    const s = a.side * px, cx = 170;
    sample = (
      <g>
        <Cube x={cx - s / 2} y={FLOOR - 40} a={s} color={sub.color} />
        <text x={cx} y={FLOOR - 46 - s * 1.35} textAnchor="middle" className="tick">한 변 {fmt(a.side, 2)} cm 정육면체</text>
      </g>
    );
  } else {
    const s = a.side * px, gx = 60;
    sample = (
      <g>
        <Cube x={gx} y={FLOOR} a={s} color={sub.color} opacity={0.35} dashed />
        <text x={gx + s / 2} y={FLOOR - s * 1.35 - 8} textAnchor="middle" className="tick">한 변 {fmt(a.side, 1)} cm 정육면체 = {fmt(a.vol / 1000)} L</text>
      </g>
    );
  }

  // 크기 비교 물건: 액체·금속은 100원 동전, 기체는 2 L 페트병
  const refObj = isGas ? (() => {
    const w = BOTTLE.w * px, h = BOTTLE.h * px, x = 470;
    return (
      <g>
        <path d={`M${x} ${FLOOR} v${-h * 0.75} q0 ${-h * 0.12} ${w * 0.3} ${-h * 0.18} v${-h * 0.07} h${w * 0.4} v${h * 0.07} q${w * 0.3} ${h * 0.06} ${w * 0.3} ${h * 0.18} v${h * 0.75} z`}
          fill="#e8f4fb" stroke="#7a8696" strokeWidth="1.5" />
        <text x={x + w / 2} y={FLOOR - h - 8} textAnchor="middle" className="tick">2 L 페트병</text>
      </g>
    );
  })() : (
    <g>
      <circle cx={480} cy={FLOOR - 40 - (COIN_CM * px) / 2} r={(COIN_CM * px) / 2} fill="#d9dde3" stroke="#8a9099" strokeWidth="2" />
      <text x={480} y={FLOOR - 40 - (COIN_CM * px) / 2 + 5} textAnchor="middle" className="tick">100</text>
      <text x={480} y={FLOOR - 50 - COIN_CM * px} textAnchor="middle" className="tick">100원 동전 (지름 {COIN_CM} cm)</text>
    </g>
  );

  // 확대창: 입자 배치 (간격만 계산값, 입자 크기는 그림용)
  const gapPx = a.gap * PX_NM, R0 = 85, MX = 110, MY = 100;
  const dots = [];
  const rnd = seeded(7);
  // 칸(한 변 = 평균 거리)마다 입자 1개. 칸의 중심을 확대창 가운데에 맞춤
  // 기체는 칸 안에서 많이 흩어지게, 액체는 조금, 금속은 반듯한 격자로
  const jitter = isGas ? 0.6 : sub.state === 'liquid' ? 0.25 : 0;
  const kMax = Math.ceil(R0 / gapPx);
  for (let i = -kMax; i <= kMax; i++) for (let j = -kMax; j <= kMax; j++) {
    const x = i * gapPx + (rnd() - 0.5) * gapPx * jitter, y = j * gapPx + (rnd() - 0.5) * gapPx * jitter;
    if (x * x + y * y < (R0 - 5) ** 2) dots.push([x, y]);
  }
  const dotR = 4;

  // 나란히 비교: 같은 그룹 물질의 1 mol 을 같은 축척으로
  const cmpPx = isGas ? 2.4 : 22; // px/cm
  const cmp = group.map((s) => ({ s, v: amounts(s, 1, T) }));
  const cmpW = 640 / group.length;

  return (
    <SimLayout
      canvas={<>
        {/* ── 큰 그림: n mol 을 실제 크기 비율로 */}
        <svg viewBox={`0 0 ${W} 330`}>
          <rect x="0" y="0" width={W} height="330" fill="#fbfcfe" />
          <text x="16" y="24" className="axis-label">{fmt(n)} mol 의 {sub.ko} ({subscript(sub.formula)}) — 실제 크기 비율</text>
          {!isGas && (
            // 전자저울: 액체·금속만 (기체는 공기 부력 때문에 그냥 달 수 없음)
            <g>
              <rect x="70" y={FLOOR - 40} width="200" height="40" rx="6" fill="#dfe4ec" stroke="#99a3b3" />
              <rect x="60" y={FLOOR - 44} width="220" height="6" rx="3" fill="#b8c1ce" />
              <rect x="190" y={FLOOR - 32} width="70" height="24" rx="3" fill="#1f2933" />
              <text x="255" y={FLOOR - 15} textAnchor="end" fill="#7CFC9A" fontFamily="monospace" fontSize="14">{fmt(a.mass, 2)} g</text>
            </g>
          )}
          {sample}
          {refObj}
          {/* 자 */}
          <line x1={X0} x2={X0 + rulerCm * px} y1={FLOOR} y2={FLOOR} stroke="#4a5565" strokeWidth="1.5" />
          {Array.from({ length: rulerCm / tickStep + 1 }, (_, i) => i * tickStep).map((c) => (
            <g key={c}>
              <line x1={X0 + c * px} x2={X0 + c * px} y1={FLOOR} y2={FLOOR + (c % labelStep === 0 ? 10 : 5)} stroke="#4a5565" />
              {c % labelStep === 0 && <text x={X0 + c * px} y={FLOOR + 24} textAnchor="middle" className="tick">{c}</text>}
            </g>
          ))}
          <text x={X0 + rulerCm * px + 16} y={FLOOR + 24} className="tick">cm</text>
          {isGas && <text x={W - 16} y="24" textAnchor="end" className="tick">{cond} °C, 1 atm · 질량 {fmt(a.mass, 2)} g</text>}
        </svg>

        {/* ── 같은 1 mol 끼리 나란히 */}
        <svg viewBox="0 0 640 170">
          <rect x="0" y="0" width="640" height="170" fill="#fff" />
          <text x="16" y="20" className="axis-label">같은 1 mol, 같은 축척으로 나란히 ({isGas ? `기체 ${cond} °C, 1 atm` : '25 °C'})</text>
          {cmp.map(({ s, v }, i) => {
            const side = v.side * cmpPx, cx = cmpW * i + cmpW / 2;
            return (
              <g key={s.id} onClick={() => setId(s.id)} style={{ cursor: 'pointer' }}>
                {s.id === id && <rect x={cmpW * i + 4} y="28" width={cmpW - 8} height="138" rx="8" fill="#eaf2ff" />}
                <Cube x={cx - side * 0.6} y={118} a={side} color={s.color} opacity={isGas ? 0.4 : 1} dashed={isGas} />
                <text x={cx} y="136" textAnchor="middle" className="tick" fontWeight="700">{s.ko} {subscript(s.formula)}</text>
                <text x={cx} y="150" textAnchor="middle" className="tick">{fmt(v.mass, 1)} g</text>
                <text x={cx} y="163" textAnchor="middle" className="tick">{isGas ? `${fmt(v.vol / 1000)} L` : `${fmt(v.vol)} cm³`}</text>
              </g>
            );
          })}
        </svg>

        {/* ── 확대창 + 세어 보기 */}
        <svg viewBox="0 0 640 230">
          <rect x="0" y="0" width="640" height="230" fill="#fbfcfe" />
          <defs><clipPath id="lens"><circle cx={MX} cy={MY} r={R0} /></clipPath></defs>
          <circle cx={MX} cy={MY} r={R0} fill="#fff" stroke="#4a5565" strokeWidth="3" />
          <g clipPath="url(#lens)">
            {dots.map(([x, y], i) => <circle key={i} cx={MX + x} cy={MY + y} r={dotR} fill={sub.color} stroke="#4a5565" strokeWidth="0.8" />)}
          </g>
          <line x1={MX - PX_NM / 2} x2={MX + PX_NM / 2} y1={MY + R0 + 18} y2={MY + R0 + 18} stroke="#333" strokeWidth="2" />
          <text x={MX} y={MY + R0 + 32} textAnchor="middle" className="tick">1 nm (10⁻⁹ m) · 확대창 속 입자 {dots.length}개</text>
          <text x="220" y="34" className="axis-label">입자 사이의 평균 거리 ≈ {fmt(a.gap, 2)} nm</text>
          <text x="220" y="56" className="tick">입자 하나가 차지하는 공간 = 부피 ÷ 입자 수 → 한 변의 길이</text>
          <text x="220" y="74" className="tick">{isGas ? '기체는 입자 사이가 넓게 비어 있어 같은 1 mol 이라도 부피가 매우 큽니다.' : '액체·고체는 입자들이 거의 붙어 있어 1 mol 의 부피가 작습니다.'}</text>
          <text x="220" y="108" className="axis-label">입자 {sci(a.N, 2)} 개를 하나씩 센다면?</text>
          <text x="220" y="130" className="tick">{C.text}</text>
          <text x="220" y="156" className="axis-label" fill="#c0392b">약 {sci(years, 1)} 년</text>
          <text x="220" y="178" className="tick">우주의 나이(약 138억 년)의 {sci(years / UNIVERSE_YEARS, 1)} 배</text>
        </svg>
      </>}
      controls={<>
        <div className="subpanel">
          <b className="small">물질 고르기</b>
          {[['liquid', '액체'], ['metal', '금속'], ['gas', '기체']].map(([st, name]) => (
            <div key={st}>
              <div className="small muted">{name}</div>
              <div className="chips">
                {MOLE_SUBSTANCES.filter((s) => s.state === st).map((s) => (
                  <button key={s.id} className={`chip ${s.id === id ? 'on' : ''}`} onClick={() => setId(s.id)}>
                    {s.ko} {subscript(s.formula)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Slider label="물질의 양" value={n} min={0.1} max={3} step={0.1} unit=" mol" format={(v) => v.toFixed(1)} onChange={setN} />
        {isGas && (
          <div>
            <div className="small muted">기체의 온도 (압력 1 atm)</div>
            <Segmented value={cond} onChange={setCond} options={[{ value: '0', label: '0 °C' }, { value: '25', label: '25 °C' }]} />
          </div>
        )}
        <Readout rows={[
          ['몰질량', `${fmt(a.M, 2)} g/mol`],
          ['질량', `${fmt(a.mass, 2)} g`],
          isGas ? ['부피', `${fmt(a.vol / 1000, 2)} L`] : ['밀도', `${sub.rho} g/cm³`],
          isGas ? ['밀도', `${(a.mass / a.vol * 1000).toFixed(3)} g/L`] : ['부피', `${fmt(a.vol, 2)} cm³`],
          ['입자 수', `${sci(a.N, 3)} 개`],
          ['입자 1개의 질량', `${sci(a.M / NA, 2)} g`],
          ['1 g 속 입자 수', `${sci(NA / a.M, 2)} 개`],
        ]} />
        <div>
          <div className="small muted">누가 셀까?</div>
          <Segmented value={counter} onChange={setCounter} options={COUNTERS.map(({ value, label }) => ({ value, label }))} />
        </div>
        <p className="small muted">아래쪽 나란히 비교 그림에서 물질을 눌러도 바꿀 수 있습니다.</p>
      </>}
      footer={<ScaleNote items={[
        `큰 그림: 액체·금속 1 cm = ${PX_CM} px, 기체 1 cm = ${PX_CM_GAS} px (기체는 부피가 커서 축척을 1/6 로 줄임)`,
        `나란히 비교: 액체·금속 1 cm = 22 px, 기체 1 cm = 2.4 px`,
        '정육면체는 비스듬히 본 그림이라 윗면·옆면이 더해져 보임 — 한 변의 길이는 앞면 기준',
        '물은 25 °C 밀도, 금속은 상온 밀도 사용. 기체는 이상 기체(PV = nRT)로 계산 — 실제 기체와 0.1 % 안팎 차이',
        `확대창: 1 nm = ${PX_NM} px. 입자 사이 거리만 계산값이고, 입자 크기(점)와 배치는 그림용`,
        '100원 동전 지름 2.4 cm, 2 L 페트병(폭 10 cm, 높이 31 cm), 우주 나이 138억 년, 세계 인구 80억 명은 비교용 대략값 (CRC 아님)',
      ]} />}
    />
  );
}
