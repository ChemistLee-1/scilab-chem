import { useRef, useState } from 'react';
import { Slider, Select, Segmented, SimLayout, ScaleNote, useAnimationFrame, sci, bisect, subscript } from './common.jsx';
import { MOLE_SUBSTANCES, WATER_DENSITY, ICE_DENSITY, WATER_VP_EXT, R, R_LBAR, NA, ATM_KPA, molarMass, interp } from '../data/crc.js';

/* =========================================================
   물질 1 mol 의 부피 비교 (고체·액체·기체)
   - 1 mol 의 질량 = 몰질량 (CRC 원자량 1-11)
   - 고체·액체: 부피 = 몰질량 ÷ 밀도 (CRC 실측 밀도)
   - 기체: 이상 기체 V = RT/P (반데르발스 부피도 함께 계산)
   - 온도·압력에 따라 상태가 바뀜: 물 0 °C 미만 얼음, 끓는점 이상 기체
   - 세 물질을 같은 축척의 정육면체로 그려 부피 차이를 비교
   ========================================================= */

const R_LATM = R / ATM_KPA; // L atm mol⁻¹ K⁻¹
const STATE_KO = { solid: '고체', liquid: '액체', gas: '기체' };
const STATE_COLOR = { solid: '#8a6d3b', liquid: '#2f80ed', gas: '#27ae60' };
const byId = Object.fromEntries(MOLE_SUBSTANCES.map((s) => [s.id, s]));

// 압력 P (kPa) 에서의 끓는점 (°C)
function boilingPoint(s, PkPa) {
  if (s.water) {
    // 포화 증기압 표를 거꾸로 보간 (6-5)
    return interp(WATER_VP_EXT.map(([t, p]) => [p, t]), PkPa);
  }
  // 증기압이 10 kPa, 100 kPa 인 온도로 클라우지우스-클라페이롱 식 (ln P = A − B/T)
  const T10 = s.t10 + 273.15, T100 = s.t100 + 273.15;
  const B = Math.log(10) / (1 / T10 - 1 / T100);
  return 1 / (1 / T100 - Math.log(PkPa / 100) / B) - 273.15;
}

// 온도 t (°C), 압력 P (atm) 에서 물질 1 mol 의 상태와 부피
function molarState(s, t, P) {
  const M = molarMass(s.formula);
  const TK = t + 273.15;
  let state = s.kind;
  let bp = null;
  if (s.kind === 'liquid') {
    bp = boilingPoint(s, P * ATM_KPA);
    if (t < s.mp) state = 'solid';
    else if (t >= bp) state = 'gas';
  }
  if (state === 'gas') {
    const Vid = R_LATM * TK / P; // L
    const Pbar = P * ATM_KPA / 100;
    const f = (V) => R_LBAR * TK / (V - s.b) - s.a / (V * V) - Pbar;
    const Vreal = bisect(f, Vid * 0.6, Vid * 1.4, 60);
    return { M, state, bp, mL: Vid * 1000, realL: Vreal, density: M / Vid }; // 기체 밀도 g/L
  }
  let rho;
  if (s.water) rho = state === 'solid' ? interp(ICE_DENSITY, t) : interp(WATER_DENSITY, t);
  else if (s.kind === 'liquid') rho = s.density / (1 + s.alpha * (t - s.tRef));
  else rho = s.density;
  return { M, state, bp, mL: M / rho, density: rho };
}

const fmtVol = (mL) => (mL >= 1000 ? `${(mL / 1000).toFixed(mL >= 10000 ? 1 : 2)} L` : `${mL.toFixed(mL >= 100 ? 0 : 1)} mL`);
const niceStep = (x) => [0.5, 1, 2, 5, 10, 20, 50].find((v) => v >= x) ?? 50;

// ── 그림 부품. 모두 (cx, y) = 바닥 가운데, k = 1 cm 당 px

// 흔히 쓰는 비커 (용량 mL, 바깥 지름·높이 cm) — 실측이 아닌 가정, 유리 두께 1 mm
const BEAKERS = [
  { cap: 25, od: 3.4, h: 5.0 }, { cap: 50, od: 4.2, h: 6.0 }, { cap: 100, od: 5.0, h: 7.0 },
  { cap: 250, od: 7.0, h: 9.5 }, { cap: 400, od: 8.0, h: 11.0 }, { cap: 600, od: 9.0, h: 12.5 }, { cap: 1000, od: 10.5, h: 14.5 },
];
const GLASS = 0.1; // cm
const pickBeaker = (mL) => BEAKERS.find((b) => b.cap >= mL * 1.2) ?? BEAKERS[BEAKERS.length - 1];
const innerArea = (b) => Math.PI * ((b.od - 2 * GLASS) / 2) ** 2; // cm²

// 풍선: 부피가 같은 구를 세로로 15 % 늘인 타원체로 그림 (부피는 그대로)
const STRETCH = 1.15;
const balloonDims = (mL) => {
  const r = Math.cbrt((3 * mL) / (4 * Math.PI)); // 같은 부피 구의 반지름 (cm)
  const rx = r / Math.cbrt(STRETCH);
  return { r, rx, ry: rx * STRETCH, knot: r * 0.08, string: r * 0.5 };
};

// 그림이 차지하는 너비·높이 (cm)
function extentCm(r) {
  if (r.state === 'solid') { const c = Math.cbrt(r.mL); return { w: c * 1.35, h: c * 1.25 }; }
  if (r.state === 'liquid') { const b = pickBeaker(r.mL); return { w: b.od * 1.1, h: b.h }; }
  const d = balloonDims(r.mL);
  return { w: 2 * d.rx, h: 2 * d.ry + d.knot + d.string };
}

// 고체: 정육면체 (정면 + 윗면 + 옆면)
function Cube({ cx, y, k, mL, color }) {
  const s = Math.cbrt(mL) * k;
  const x = cx - (s * 1.35) / 2;
  const dx = s * 0.35, dy = s * 0.25;
  const face = { stroke: '#334', strokeWidth: 1 };
  return (
    <g>
      <polygon points={`${x},${y - s} ${x + dx},${y - s - dy} ${x + s + dx},${y - s - dy} ${x + s},${y - s}`} fill={color} fillOpacity="0.75" {...face} />
      <polygon points={`${x + s},${y} ${x + s + dx},${y - dy} ${x + s + dx},${y - s - dy} ${x + s},${y - s}`} fill={color} {...face} />
      <rect x={x} y={y - s} width={s} height={s} fill={color} fillOpacity="0.9" {...face} />
      {s > 24 && Array.from({ length: 3 }, (_, i) => (
        <g key={i} stroke="#fff" strokeOpacity="0.35">
          <line x1={x + (s * (i + 1)) / 4} y1={y - s} x2={x + (s * (i + 1)) / 4} y2={y} />
          <line x1={x} y1={y - (s * (i + 1)) / 4} x2={x + s} y2={y - (s * (i + 1)) / 4} />
        </g>
      ))}
    </g>
  );
}

// 액체: 비커에 담긴 모습 (액체 높이 = 부피 ÷ 비커 안쪽 바닥 넓이)
function Beaker({ cx, y, k, mL, color }) {
  const b = pickBeaker(mL);
  const w = b.od * k, h = b.h * k, g = Math.max(GLASS * k, 1);
  const x0 = cx - w / 2, x1 = cx + w / 2, rr = Math.min(w * 0.08, 6);
  const lh = (mL / innerArea(b)) * k; // 액체 높이 (px)
  const lip = w * 0.08;
  const marks = [0.2, 0.4, 0.6, 0.8, 1].map((f) => (b.cap * f / innerArea(b)) * k);
  return (
    <g>
      <rect x={x0 + g} y={y - g - lh} width={w - 2 * g} height={lh} fill={color} fillOpacity="0.55" />
      <line x1={x0 + g} x2={x1 - g} y1={y - g - lh} y2={y - g - lh} stroke={color} strokeWidth={Math.max(1, k * 0.05)} />
      <path d={`M${x0 - lip} ${y - h} L${x0} ${y - h + lip * 0.6} L${x0} ${y - rr} Q${x0} ${y} ${x0 + rr} ${y} L${x1 - rr} ${y} Q${x1} ${y} ${x1} ${y - rr} L${x1} ${y - h}`}
        fill="none" stroke="#556" strokeWidth={Math.max(1, g)} strokeLinejoin="round" />
      {h > 40 && marks.map((m, i) => (
        <line key={i} x1={x0 + w * 0.12} x2={x0 + w * (i === 4 ? 0.34 : 0.24)} y1={y - g - m} y2={y - g - m} stroke="#556" strokeWidth="1" />
      ))}
    </g>
  );
}

// 기체: 풍선 (구와 부피가 같은 타원체) + 매듭 + 줄
function Balloon({ cx, y, k, mL, color, dots }) {
  const d = balloonDims(mL);
  const rx = d.rx * k, ry = d.ry * k, knot = Math.max(d.knot * k, 3), str = d.string * k;
  const cyB = y - str - knot - ry;
  return (
    <g>
      <path d={`M${cx} ${y - str} q ${-str * 0.12} ${str * 0.35} 0 ${str * 0.5} t 0 ${str * 0.5}`} fill="none" stroke="#778" strokeWidth="1.2" />
      <polygon points={`${cx},${cyB + ry - 1} ${cx - knot * 0.8},${cyB + ry + knot} ${cx + knot * 0.8},${cyB + ry + knot}`} fill={color} />
      <ellipse cx={cx} cy={cyB} rx={rx} ry={ry} fill={color} fillOpacity="0.28" stroke={color} strokeWidth="2" />
      <ellipse cx={cx - rx * 0.4} cy={cyB - ry * 0.45} rx={rx * 0.14} ry={ry * 0.2} fill="#fff" fillOpacity="0.6" transform={`rotate(-25 ${cx - rx * 0.4} ${cyB - ry * 0.45})`} />
      {dots && dots.map((p, i) => {
        const v = (2 * p.v - 1) * 0.85;
        return <circle key={i} cx={cx + (2 * p.u - 1) * rx * 0.85 * Math.sqrt(1 - v * v)} cy={cyB + v * ry} r="3" fill={color} />;
      })}
    </g>
  );
}

function Item({ r, color, ...rest }) {
  if (r.state === 'solid') return <Cube {...rest} mL={r.mL} color={color} />;
  if (r.state === 'liquid') return <Beaker {...rest} mL={r.mL} color={color} />;
  return <Balloon {...rest} mL={r.mL} color={color} />;
}

// 아래 글자: 어떤 모습으로 그렸는지
function shapeLabel(r) {
  if (r.state === 'solid') return `한 변 ${Math.cbrt(r.mL).toFixed(2)} cm 정육면체`;
  if (r.state === 'liquid') return `${pickBeaker(r.mL).cap} mL 비커에 담음`;
  return `풍선 지름 약 ${(2 * balloonDims(r.mL).r).toFixed(0)} cm`;
}

const W = 720, H = 400, FLOOR = 330;
const SLOTS = 3;
const MAX_PX = 200; // 가장 큰 그림의 높이 최대 (px)
const MIN_SLOT_W = 170; // 칸 하나의 최소 너비 (이름·부피 글자가 들어갈 자리)
const MAGS = [2, 3, 4, 5, 10, 20, 50];
const MAG_R = 62; // 확대 동그라미 반지름 (px)

export default function MolarVolume() {
  const [ids, setIds] = useState(['Cu', 'H2O', 'O2']);
  const [t, setT] = useState(25); // °C — 상온·상압(25 °C, 1 atm)에서 시작
  const [P, setP] = useState(1); // atm
  const [view, setView] = useState('cube');
  const [, setTick] = useState(0);
  // 기체 입자 위치 (정면 안에서 0~1 비율 좌표) — 칸마다 따로
  const dotsRef = useRef(Array.from({ length: SLOTS }, () => Array.from({ length: 24 }, () => ({
    u: Math.random(), v: Math.random(), du: Math.random() - 0.5, dv: Math.random() - 0.5,
  }))));

  const subs = ids.map((id) => byId[id]);
  const res = subs.map((s) => molarState(s, t, P));
  const anyGas = res.some((r) => r.state === 'gas');

  useAnimationFrame((dt) => {
    res.forEach((r, k) => {
      if (r.state !== 'gas') return;
      const speed = 0.6 * Math.sqrt(((t + 273.15) / 273.15) * (32 / r.M)); // √(T/M) 에 비례, 크기는 화면용
      for (const d of dotsRef.current[k]) {
        d.u += d.du * speed * dt; d.v += d.dv * speed * dt;
        if (d.u < 0 || d.u > 1) { d.du *= -1; d.u = Math.min(1, Math.max(0, d.u)); }
        if (d.v < 0 || d.v > 1) { d.dv *= -1; d.v = Math.min(1, Math.max(0, d.v)); }
      }
    });
    setTick((x) => (x + 1) % 1e6);
  }, anyGas && view === 'cube');

  // 같은 축척: 가장 높은 그림이 MAX_PX 가 되도록 (1 cm = k px, 최대 40 px)
  const ext = res.map(extentCm); // cm
  const k = Math.min(MAX_PX / Math.max(...ext.map((e) => e.h)), 40);
  const ruler = niceStep(90 / k); // cm
  // 칸 배치: 정육면체 너비(깊이 포함)에 맞춰 왼쪽부터 놓고 남는 자리를 고르게 나눔
  const slotW = ext.map((e) => Math.max(e.w * k, MIN_SLOT_W));
  const gap = (W - 20 - slotW.reduce((a, b) => a + b, 0)) / (SLOTS + 1);
  const slotX = slotW.map((w, i) => 10 + gap * (i + 1) + slotW.slice(0, i).reduce((a, b) => a + b, 0) + w / 2);

  const options = MOLE_SUBSTANCES.map((s) => ({
    value: s.id, label: `[${STATE_KO[s.kind]}] ${s.ko} (${subscript(s.formula)})`,
  }));
  const setId = (i) => (v) => setIds((a) => a.map((x, j) => (j === i ? v : x)));

  // 비교 문장
  const order = res.map((r, i) => i).sort((a, b) => res[a].mL - res[b].mL);
  const small = order[0], big = order[2];
  const gasIdx = res.map((r, i) => i).filter((i) => res[i].state === 'gas');

  const sceneView = (
    <svg viewBox={`0 0 ${W} ${H}`} role="img">
      <rect x="0" y="0" width={W} height={H} fill="#f7f9fc" rx="8" />
      <line x1="10" x2={W - 10} y1={FLOOR} y2={FLOOR} stroke="#99a" strokeWidth="2" />
      {res.map((r, i) => {
        const cx = slotX[i];
        const sub = subs[i];
        const color = sub.water && r.state === 'solid' ? '#cfe8f7' : sub.color;
        const size = Math.max(ext[i].w, ext[i].h) * k; // px
        const tiny = size < 40;
        const mag = tiny ? [...MAGS].reverse().find((m) => size * m <= MAG_R * 1.5) ?? 2 : 1;
        const cyM = FLOOR - 160; // 확대 동그라미 중심
        return (
          <g key={i}>
            <Item r={r} color={color} cx={cx} y={FLOOR} k={k} dots={dotsRef.current[i]} />
            {tiny && (
              <g>
                <line x1={cx} y1={FLOOR - ext[i].h * k - 4} x2={cx} y2={cyM + MAG_R} stroke="#99a" strokeDasharray="3 3" />
                <circle cx={cx} cy={cyM} r={MAG_R} fill="#fff" stroke="#99a" />
                <Item r={r} color={color} cx={cx} y={cyM + (ext[i].h * k * mag) / 2} k={k * mag} />
                <text x={cx} y={cyM - MAG_R - 8} textAnchor="middle" className="tick">×{mag} 확대</text>
              </g>
            )}
            <text x={cx} y={FLOOR + 22} textAnchor="middle" fontSize="15" fontWeight="700">{sub.ko} {subscript(sub.formula)}</text>
            <text x={cx} y={FLOOR + 40} textAnchor="middle" fontSize="12" fill={STATE_COLOR[r.state]}>
              {STATE_KO[r.state]} · {shapeLabel(r)}
            </text>
            <text x={cx} y={FLOOR + 60} textAnchor="middle" fontSize="16" fontWeight="700">{r.M.toFixed(2)} g = {fmtVol(r.mL)}</text>
          </g>
        );
      })}
      <g transform={`translate(${W - 20 - ruler * k} 22)`}>
        <line x1="0" x2={ruler * k} y1="0" y2="0" stroke="#334" strokeWidth="2" />
        <line x1="0" x2="0" y1="-5" y2="5" stroke="#334" strokeWidth="2" />
        <line x1={ruler * k} x2={ruler * k} y1="-5" y2="5" stroke="#334" strokeWidth="2" />
        <text x={(ruler * k) / 2} y="18" textAnchor="middle" className="tick">{ruler} cm</text>
      </g>
      <text x="16" y="26" className="tick">{t} °C, {P.toFixed(2)} atm 에서 1 mol 의 모습 (세 물질 같은 축척)</text>
    </svg>
  );

  // 막대 그래프: 부피를 로그 눈금으로
  const LOG_MIN = 0, LOG_MAX = 5; // 1 mL ~ 100 L
  const bx = (mL) => 150 + ((Math.log10(Math.max(mL, 1)) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 530;
  const barView = (
    <svg viewBox={`0 0 ${W} 260`} role="img">
      <rect x="0" y="0" width={W} height="260" fill="#f7f9fc" rx="8" />
      {[0, 1, 2, 3, 4, 5].map((e) => (
        <g key={e}>
          <line x1={bx(10 ** e)} x2={bx(10 ** e)} y1="20" y2="210" className="grid" />
          <text x={bx(10 ** e)} y="228" textAnchor="middle" className="tick">{fmtVol(10 ** e)}</text>
        </g>
      ))}
      {res.map((r, i) => (
        <g key={i} transform={`translate(0 ${40 + i * 58})`}>
          <text x="140" y="22" textAnchor="end" fontSize="14" fontWeight="700">{subs[i].ko}</text>
          <text x="140" y="38" textAnchor="end" fontSize="12" fill={STATE_COLOR[r.state]}>{STATE_KO[r.state]}</text>
          <rect x="150" y="6" width={bx(r.mL) - 150} height="32" fill={subs[i].color} fillOpacity={r.state === 'gas' ? 0.45 : 0.85} stroke="#334" />
          <text x={bx(r.mL) + 6} y="27" fontSize="13" fontWeight="700">{fmtVol(r.mL)}</text>
        </g>
      ))}
      <text x={W / 2} y="252" textAnchor="middle" className="axis-label">1 mol 의 부피 (로그 눈금: 한 칸마다 10배)</text>
    </svg>
  );

  return (
    <SimLayout
      canvas={<>
        <Segmented value={view} onChange={setView} options={[
          { value: 'cube', label: '실제 모습 (같은 축척)' },
          { value: 'bar', label: '막대 그래프 (로그 눈금)' },
        ]} />
        <div style={{ marginTop: 8 }}>{view === 'cube' ? sceneView : barView}</div>
        <div className="data-table-wrap" style={{ maxHeight: 'none' }}>
          <table className="data-table">
            <thead>
              <tr><th>물질</th><th>상태</th><th>1 mol 질량</th><th>밀도</th><th>1 mol 부피</th><th>입자 수</th></tr>
            </thead>
            <tbody>
              {res.map((r, i) => (
                <tr key={i}>
                  <td>{subs[i].ko} {subscript(subs[i].formula)}</td>
                  <td style={{ color: STATE_COLOR[r.state] }}>{STATE_KO[r.state]}</td>
                  <td>{r.M.toFixed(2)} g</td>
                  <td>{r.state === 'gas' ? `${r.density.toFixed(3)} g/L` : `${r.density.toFixed(4)} g/cm³`}</td>
                  <td>{fmtVol(r.mL)}{r.state === 'gas' && <><br /><small>실제 기체 {r.realL.toFixed(2)} L</small></>}</td>
                  <td>{sci(NA, 2)} 개</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>}
      controls={<>
        {ids.map((id, i) => <Select key={i} label={`물질 ${i + 1}`} value={id} onChange={setId(i)} options={options} />)}
        <Slider label="온도" value={t} min={-50} max={200} step={1} onChange={setT}
          format={(v) => `${v} °C (${(v + 273.15).toFixed(2)} K)`} />
        <Slider label="압력" value={P} min={0.5} max={2} step={0.05} unit=" atm" format={(v) => v.toFixed(2)} onChange={setP} />
        <div className="segmented">
          <button className={t === 25 && P === 1 ? 'on' : ''} onClick={() => { setT(25); setP(1); }}>상온·상압 (25 °C, 1 atm)</button>
          <button className={t === 0 && P === 1 ? 'on' : ''} onClick={() => { setT(0); setP(1); }}>0 °C, 1 atm</button>
        </div>
        <div className="readout">
          <p style={{ margin: 0 }}>
            <b>{subs[big].ko}</b> 1 mol 의 부피는 <b>{subs[small].ko}</b> 1 mol 의 약 <b>{Math.round(res[big].mL / res[small].mL).toLocaleString()}배</b>입니다.
          </p>
          {gasIdx.length >= 2 && (
            <p style={{ margin: '8px 0 0' }}>
              같은 온도·압력에서 기체 1 mol 의 부피는 종류와 관계없이 <b>{fmtVol(res[gasIdx[0]].mL)}</b> 로 같습니다 (아보가드로 법칙).
            </p>
          )}
          {subs.map((s, i) => res[i].bp != null && (
            <p key={s.id + i} style={{ margin: '8px 0 0', fontSize: 13 }}>
              {s.ko}의 끓는점 ({P.toFixed(2)} atm): {res[i].bp.toFixed(1)} °C
            </p>
          ))}
        </div>
      </>}
      footer={<ScaleNote items={[
        `세 물질 모두 같은 축척 (지금 1 cm = ${k.toFixed(1)} px). 작은 그림은 동그라미 안에 확대해서 함께 그림`,
        '고체: 1 mol 을 정육면체로 (한 변 = (부피)^⅓)',
        '액체: 부피의 1.2 배 이상 담기는 가장 작은 비커에 담음. 비커 치수(바깥 지름 × 높이)는 25 mL 3.4 × 5.0 cm, 50 mL 4.2 × 6.0 cm, 100 mL 5.0 × 7.0 cm, 250 mL 7.0 × 9.5 cm 로 가정 (유리 두께 1 mm), 액체 높이 = 부피 ÷ 안쪽 바닥 넓이',
        '기체: 1 mol 을 담은 풍선 — 부피가 같은 구를 세로로 15 % 늘인 모양. 풍선 고무가 누르는 압력은 무시 (풍선 속 압력 = 바깥 압력)',
        '기체 부피는 이상 기체 V = RT/P 로 계산 (표에는 반데르발스 식으로 구한 실제 기체 부피도 표시, 상수 a·b 는 CRC 6-56)',
        '고체 밀도는 실온 값으로 고정 (금속의 부피 팽창은 −50~200 °C 에서 1 % 미만이라 무시)',
        '물: 0 °C 미만은 얼음(6-12), 액체 밀도는 6-1~6-2, 끓는점은 포화 증기압(6-5)으로 구함. 압력에 따른 녹는점 변화는 무시',
        '에탄올·아세톤: 밀도 = ρ(기준 온도) ÷ (1 + αV·Δt), 끓는점은 증기압 10 kPa·100 kPa 온도로 세운 클라우지우스-클라페이롱 식 (1 atm 넘는 압력은 외삽)',
        '기체 입자 점의 개수·크기·속력은 화면용 (6.02 × 10²³ 개를 그릴 수 없음)',
      ]} />}
    />
  );
}
