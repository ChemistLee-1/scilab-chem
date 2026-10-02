import { useState } from 'react';
import { SimLayout, Segmented, ScaleNote, LineChart, Readout } from './common.jsx';
import { ELEMENTS, EV_TO_KJMOL } from '../data/crc.js';

const PROPS = {
  rcov: { label: '원자 반지름', unit: 'pm', get: (e) => e.rcov * 100, max: 210, color: '#2f80ed' },
  ie: { label: '제1 이온화 에너지', unit: 'kJ/mol', get: (e) => e.ie * EV_TO_KJMOL, max: 2500, color: '#eb5757' },
  en: { label: '전기 음성도', unit: '', get: (e) => e.en, max: 4.2, color: '#27ae60' },
};
const GROUPS = [1, 2, 13, 14, 15, 16, 17, 18];
const CELL = 74, PX_PER_PM = 0.17; // 원 반지름: 1 pm = 0.17 px

export default function PeriodicTrends() {
  const [prop, setProp] = useState('rcov');
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
          <LineChart height={230}
            series={[{ points, color: P.color, label: P.label }]}
            markers={P.get(pick) != null ? [{ x: pick.z, y: P.get(pick), color: P.color }] : []}
            xDomain={[1, 20]} xTicks={19} yDomain={[0, P.max]}
            xLabel="원자 번호" yLabel={`${P.label}${P.unit ? ` (${P.unit})` : ''}`} />
        </div>
      }
      controls={<>
        <Segmented value={prop} onChange={setProp} options={Object.entries(PROPS).map(([k, v]) => ({ value: k, label: v.label }))} />
        <Readout rows={[
          ['원소', `${pick.ko} (${pick.sym}), Z = ${pick.z}`],
          ['원자량', pick.mass.toFixed(3)],
          ['원자 반지름', `${Math.round(pick.rcov * 100)} pm`],
          ['제1 이온화 에너지', `${Math.round(pick.ie * EV_TO_KJMOL)} kJ/mol (${pick.ie} eV)`],
          ['전기 음성도', pick.en ?? '— (값 없음)'],
        ]} />
        <p className="small muted">주기율표의 칸을 눌러 원소를 선택하세요. 같은 주기에서 오른쪽으로, 같은 족에서 위로 갈수록 어떻게 변하나요?</p>
      </>}
      footer={<ScaleNote items={[
        `원자 반지름(공유 반지름): 실제 크기에 비례, 1 pm = ${PX_PER_PM} px (예: Na 160 pm → 반지름 ${(160 * PX_PER_PM).toFixed(1)} px)`,
        '이온화 에너지·전기 음성도: 원의 크기 = 6 px + 값/최댓값 × 26 px (상대 비교용)',
        '18족 원소는 Pauling 전기 음성도 값이 없어 표시하지 않음',
      ]} />}
    />
  );
}
