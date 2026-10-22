import { useRef, useState } from 'react';
import { SimLayout, Segmented, Slider, ScaleNote, LineChart, Readout } from './common.jsx';
import { ELEMENTS, EV_TO_KJMOL } from '../data/crc.js';

const PROPS = {
  rcov: { label: '원자 반지름', unit: 'pm', get: (e) => e.rcov * 100, max: 210, color: '#2f80ed', fmt: (v) => Math.round(v) },
  ie: { label: '제1 이온화 에너지', unit: 'kJ/mol', get: (e) => e.ie * EV_TO_KJMOL, max: 2500, color: '#eb5757', fmt: (v) => Math.round(v) },
  en: { label: '전기 음성도', unit: '', get: (e) => e.en, max: 4.2, color: '#27ae60', fmt: (v) => v.toFixed(2) },
};
const GROUPS = [1, 2, 13, 14, 15, 16, 17, 18];
const CELL = 74, PX_PER_PM = 0.17; // 원 반지름: 1 pm = 0.17 px

// 높낮이(3D) 보기: 주기율표 칸 위에 값에 비례하는 막대를 세운다
const S = 66;       // 한 칸 = 66 px
const H_MAX = 160;  // 최댓값일 때 막대 높이 (px)
const HALF = 0.36;  // 막대 밑면 절반 너비 (칸 단위)

// 색을 밝게(f > 0) 또는 어둡게(f < 0)
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(f >= 0 ? c + (255 - c) * f : c * (1 + f)));
  return `rgb(${ch.join(',')})`;
}

function Bars3D({ P, pick, setPick, azim, elev, setAzim, setElev }) {
  const drag = useRef(null);
  const th = (azim * Math.PI) / 180, ph = (elev * Math.PI) / 180;
  const c = Math.cos(th), s = Math.sin(th), sp = Math.sin(ph), cp = Math.cos(ph);
  // 세계 좌표(x: 족 방향, y: 주기 방향, 단위 칸; z: 높이 px) → 화면 좌표
  const proj = (x, y, z) => [(x * c - y * s) * S, (x * s + y * c) * S * sp - z * cp];
  const depth = (x, y) => x * s + y * c; // 클수록 보는 사람 쪽

  const cells = ELEMENTS.map((e) => {
    const x = GROUPS.indexOf(e.group) - 3.5, y = e.period - 2.5;
    const v = P.get(e);
    return { e, x, y, v, h: v == null ? 0 : (v / P.max) * H_MAX };
  }).sort((a, b) => depth(a.x, a.y) - depth(b.x, b.y));

  // 화면 맞춤: 막대가 모두 최대 높이일 때의 범위 (속성을 바꿔도 화면이 흔들리지 않게)
  const corners = [];
  for (const x of [-4, 4]) for (const y of [-2, 2]) for (const z of [0, H_MAX]) corners.push(proj(x, y, z));
  const xs = corners.map((p) => p[0]), ys = corners.map((p) => p[1]);
  const pad = 24;
  const vb = [Math.min(...xs) - pad, Math.min(...ys) - pad - 10, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad + 10];

  const pts = (arr) => arr.map((p) => p.join(',')).join(' ');
  // 막대 옆면: 바깥 방향 법선 (nx, ny) 과 꼭짓점 두 개
  const SIDES = [
    { n: [1, 0], a: [HALF, -HALF], b: [HALF, HALF], f: -0.25 },
    { n: [-1, 0], a: [-HALF, HALF], b: [-HALF, -HALF], f: -0.25 },
    { n: [0, 1], a: [HALF, HALF], b: [-HALF, HALF], f: -0.1 },
    { n: [0, -1], a: [-HALF, -HALF], b: [HALF, -HALF], f: -0.1 },
  ];

  const onDown = (ev) => { drag.current = { x: ev.clientX, y: ev.clientY, azim, elev, moved: false }; };
  const onMove = (ev) => {
    const d = drag.current;
    if (!d) return;
    const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (!d.moved) return;
    setAzim(Math.max(-60, Math.min(60, Math.round(d.azim - dx * 0.3))));
    setElev(Math.max(15, Math.min(75, Math.round(d.elev + dy * 0.3))));
  };
  const onUp = () => { setTimeout(() => { drag.current = null; }, 0); };
  const select = (e) => { if (!drag.current?.moved) setPick(e); };

  return (
    <svg viewBox={vb.join(' ')} className="ptable ptable-3d"
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
      {/* 바닥 칸 */}
      {cells.map(({ e, x, y }) => {
        const q = [[-0.47, -0.47], [0.47, -0.47], [0.47, 0.47], [-0.47, 0.47]].map(([dx, dy]) => proj(x + dx, y + dy, 0));
        return <polygon key={`f${e.z}`} points={pts(q)} className={`pcell ${pick.z === e.z ? 'on' : ''}`} />;
      })}
      {/* 족·주기 표시 */}
      {GROUPS.map((g, i) => { const [tx, ty] = proj(i - 3.5, 2.2, 0); return <text key={g} x={tx} y={ty + 10} textAnchor="middle" className="tick">{g}족</text>; })}
      {[1, 2, 3, 4].map((p) => { const [tx, ty] = proj(-4.25, p - 2.5, 0); return <text key={p} x={tx} y={ty + 4} textAnchor="middle" className="tick">{p}주기</text>; })}
      {/* 막대: 먼 것부터 그린다 */}
      {cells.map(({ e, x, y, v, h }) => {
        const on = pick.z === e.z;
        const top = [[-HALF, -HALF], [HALF, -HALF], [HALF, HALF], [-HALF, HALF]].map(([dx, dy]) => proj(x + dx, y + dy, h));
        const [lx, ly] = proj(x, y, h);
        return (
          <g key={e.z} onClick={() => select(e)} style={{ cursor: 'pointer' }}>
            {v != null && SIDES.filter((f) => f.n[0] * s + f.n[1] * c > 1e-6).map((f, i) => (
              <polygon key={i} fill={shade(P.color, f.f)} stroke={shade(P.color, -0.45)} strokeWidth="0.6"
                points={pts([proj(x + f.a[0], y + f.a[1], 0), proj(x + f.b[0], y + f.b[1], 0), proj(x + f.b[0], y + f.b[1], h), proj(x + f.a[0], y + f.a[1], h)])} />
            ))}
            {v != null && <polygon points={pts(top)} fill={shade(P.color, 0.35)} stroke={on ? 'var(--accent)' : shade(P.color, -0.45)} strokeWidth={on ? 2.5 : 0.6} />}
            <text x={lx} y={ly - 6} textAnchor="middle" className="psym psym-3d">{e.sym}</text>
            {on && <text x={lx} y={ly - 24} textAnchor="middle" className="pval-3d">{v == null ? '값 없음' : P.fmt(v)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export default function PeriodicTrends() {
  const [prop, setProp] = useState('rcov');
  const [view, setView] = useState('flat');
  const [azim, setAzim] = useState(-20);
  const [elev, setElev] = useState(40);
  const [pick, setPick] = useState(ELEMENTS[10]);
  const P = PROPS[prop];

  const radius = (e) => {
    const v = P.get(e);
    if (v == null) return 0;
    return prop === 'rcov' ? v * PX_PER_PM : 6 + (v / P.max) * 26;
  };

  const points = ELEMENTS.filter((e) => P.get(e) != null).map((e) => [e.z, P.get(e)]);

  return (
    <SimLayout
      canvas={
        <div>
          {view === '3d'
            ? <Bars3D P={P} pick={pick} setPick={setPick} azim={azim} elev={elev} setAzim={setAzim} setElev={setElev} />
            : (
              <svg viewBox={`0 0 ${CELL * 8 + 40} ${CELL * 4 + 30}`} className="ptable">
                {GROUPS.map((g, i) => <text key={g} x={40 + i * CELL + CELL / 2} y="16" textAnchor="middle" className="tick">{g}족</text>)}
                {[1, 2, 3, 4].map((p) => <text key={p} x="18" y={24 + (p - 1) * CELL + CELL / 2} textAnchor="middle" className="tick">{p}주기</text>)}
                {ELEMENTS.map((e) => {
                  const cx = 40 + GROUPS.indexOf(e.group) * CELL + CELL / 2;
                  const cy = 24 + (e.period - 1) * CELL + CELL / 2;
                  const r = radius(e);
                  return (
                    <g key={e.z} onClick={() => setPick(e)} style={{ cursor: 'pointer' }}>
                      <rect x={cx - CELL / 2 + 2} y={cy - CELL / 2 + 2} width={CELL - 4} height={CELL - 4} rx="6"
                        className={`pcell ${pick.z === e.z ? 'on' : ''}`} />
                      {r > 0 && <circle cx={cx} cy={cy} r={r} fill={P.color} opacity="0.35" />}
                      <text x={cx} y={cy + 5} textAnchor="middle" className="psym">{e.sym}</text>
                      <text x={cx - CELL / 2 + 7} y={cy - CELL / 2 + 15} className="pz">{e.z}</text>
                    </g>
                  );
                })}
              </svg>
            )}
          <LineChart height={230}
            series={[{ points, color: P.color, label: P.label }]}
            markers={P.get(pick) != null ? [{ x: pick.z, y: P.get(pick), color: P.color }] : []}
            xDomain={[1, 20]} xTicks={19} yDomain={[0, P.max]} yFormat={(v) => +v.toFixed(2)}
            xLabel="원자 번호" yLabel={`${P.label}${P.unit ? ` (${P.unit})` : ''}`} />
        </div>
      }
      controls={<>
        <Segmented value={prop} onChange={setProp} options={Object.entries(PROPS).map(([k, v]) => ({ value: k, label: v.label }))} />
        <Segmented value={view} onChange={setView} options={[{ value: 'flat', label: '평면 (원 크기)' }, { value: '3d', label: '높낮이 (막대)' }]} />
        {view === '3d' && <>
          <Slider label="좌우 회전" value={azim} min={-60} max={60} unit="°" onChange={setAzim} />
          <Slider label="내려다보는 각도" value={elev} min={15} max={75} unit="°" onChange={setElev} />
        </>}
        <Readout rows={[
          ['원소', `${pick.ko} (${pick.sym}), Z = ${pick.z}`],
          ['원자량', pick.mass.toFixed(3)],
          ['원자 반지름', `${Math.round(pick.rcov * 100)} pm`],
          ['제1 이온화 에너지', `${Math.round(pick.ie * EV_TO_KJMOL)} kJ/mol (${pick.ie} eV)`],
          ['전기 음성도', pick.en ?? '— (값 없음)'],
        ]} />
        <p className="small muted">
          주기율표의 칸을 눌러 원소를 선택하세요. 같은 주기에서 오른쪽으로, 같은 족에서 위로 갈수록 어떻게 변하나요?
          {view === '3d' && ' 주기율표를 끌어서 돌려 볼 수도 있습니다.'}
        </p>
      </>}
      footer={<ScaleNote items={[
        `원자 반지름(공유 반지름): 실제 크기에 비례, 1 pm = ${PX_PER_PM} px (예: Na 160 pm → 반지름 ${(160 * PX_PER_PM).toFixed(1)} px)`,
        '이온화 에너지·전기 음성도: 원의 크기 = 6 px + 값/최댓값 × 26 px (상대 비교용)',
        `높낮이 보기: 막대 높이 = 값/최댓값 × ${H_MAX} px (최댓값: 반지름 210 pm, 이온화 에너지 2500 kJ/mol, 전기 음성도 4.2). 높이는 값에 정비례`,
        '18족 원소는 Pauling 전기 음성도 값이 없어 표시하지 않음',
      ]} />}
    />
  );
}
