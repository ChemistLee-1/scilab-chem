import { useRef, useState } from 'react';
import { Select, SimLayout, ScaleNote, Readout, useAnimationFrame } from './common.jsx';
import { REDUCTION_POTENTIALS } from '../data/crc.js';

// 수용액에서 전극으로 쓰기 어려운 금속(Li, K, Ca, Na)과 수소 전극은 반응성 순서 표시에만 사용
const ELECTRODES = REDUCTION_POTENTIALS.filter((m) => !['Li', 'K', 'Ca', 'Na', 'H2'].includes(m.sym));
const W = 640, H = 330;
const METAL_COLOR = { Mg: '#c9ccd1', Al: '#d5d8dc', Zn: '#a7b0b8', Fe: '#7d7f86', Ni: '#a9a48f', Sn: '#c7c9c4', Pb: '#6d7380', Cu: '#c87533', Ag: '#d7d9de', Au: '#d4af37' };

export default function GalvanicCell() {
  const [left, setLeft] = useState('Zn');
  const [right, setRight] = useState('Cu');
  const [, tick] = useState(0);
  const t = useRef(0);
  const L = ELECTRODES.find((m) => m.sym === left), Rm = ELECTRODES.find((m) => m.sym === right);
  const same = left === right;
  const anode = L.E < Rm.E ? L : Rm, cathode = anode === L ? Rm : L;
  const Ecell = cathode.E - anode.E;
  const anodeLeft = anode === L;

  useAnimationFrame((dt) => { t.current += dt; tick((k) => (k + 1) % 1000); }, !same);

  const electrons = same ? [] : Array.from({ length: 8 }, (_, i) => {
    const s = ((t.current * (0.15 + Ecell * 0.15) + i / 8) % 1);
    const path = [[140, 110], [140, 40], [500, 40], [500, 110]];
    const segs = [70, 360, 70], total = 500;
    let d = (anodeLeft ? s : 1 - s) * total, k = 0;
    while (k < 2 && d > segs[k]) { d -= segs[k]; k++; }
    const [x0, y0] = path[k], [x1, y1] = path[k + 1], f = d / segs[k];
    return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
  });
  const wear = Math.min(1, t.current / 60);
  const electrode = (x, m, isAnode) => {
    const h = 130 * (same ? 1 : isAnode ? 1 - 0.35 * wear : 1);
    const w = same ? 26 : isAnode ? 26 * (1 - 0.3 * wear) : 26 + 8 * wear;
    return <rect x={x - w / 2} y={110} width={w} height={h} fill={METAL_COLOR[m.sym]} stroke="#555" />;
  };

  return (
    <SimLayout
      canvas={
        <svg viewBox={`0 0 ${W} ${H}`} className="cell-view">
          <path d="M60 150 v150 h160 v-150" fill="#e8f2ff" stroke="#556" strokeWidth="3" />
          <path d="M420 150 v150 h160 v-150" fill="#e8f2ff" stroke="#556" strokeWidth="3" />
          <path d="M190 175 v-35 h260 v35" fill="none" stroke="#f2c94c" strokeWidth="18" />
          <text x="320" y="132" textAnchor="middle" className="tick">염다리 (KNO₃)</text>
          {electrode(140, L, anodeLeft)}
          {electrode(500, Rm, !anodeLeft)}
          <line x1="140" y1="110" x2="140" y2="40" stroke="#333" strokeWidth="2" />
          <line x1="500" y1="110" x2="500" y2="40" stroke="#333" strokeWidth="2" />
          <line x1="140" y1="40" x2="500" y2="40" stroke="#333" strokeWidth="2" />
          {electrons.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" fill="#2f80ed" />)}
          <rect x="270" y="18" width="100" height="44" rx="8" fill="#222" />
          <text x="320" y="47" textAnchor="middle" fill="#7CFC00" className="volt">{same ? '0.000' : Ecell.toFixed(3)} V</text>
          <text x="140" y="322" textAnchor="middle" className="tick">{L.sym} | {L.ion} (1 M)</text>
          <text x="500" y="322" textAnchor="middle" className="tick">{Rm.sym} | {Rm.ion} (1 M)</text>
          {!same && <>
            <text x={anodeLeft ? 30 : 610} y="100" textAnchor={anodeLeft ? 'start' : 'end'} className="pole">(−)극 산화</text>
            <text x={anodeLeft ? 610 : 30} y="100" textAnchor={anodeLeft ? 'end' : 'start'} className="pole">(+)극 환원</text>
          </>}
        </svg>
      }
      controls={<>
        <Select label="왼쪽 전극" value={left} onChange={(v) => { setLeft(v); t.current = 0; }} options={ELECTRODES.map((m) => ({ value: m.sym, label: `${m.ko} (${m.sym}) E° = ${m.E} V` }))} />
        <Select label="오른쪽 전극" value={right} onChange={(v) => { setRight(v); t.current = 0; }} options={ELECTRODES.map((m) => ({ value: m.sym, label: `${m.ko} (${m.sym}) E° = ${m.E} V` }))} />
        {same ? <p className="small">두 전극이 같으면 전위차가 없어 전류가 흐르지 않습니다.</p> : (
          <Readout rows={[
            ['(−)극 산화', `${anode.sym} → ${anode.ion} + ${anode.n}e⁻`],
            ['(+)극 환원', `${cathode.ion} + ${cathode.n}e⁻ → ${cathode.sym}`],
            ['표준 전지 전위', `E° = ${cathode.E} − (${anode.E}) = ${Ecell.toFixed(3)} V`],
          ]} />
        )}
        <div className="subpanel">
          <b>표준 환원 전위 (V)</b>
          <div className="series">
            {REDUCTION_POTENTIALS.map((m) => (
              <div key={m.sym} className={`series-row ${m.sym === left || m.sym === right ? 'on' : ''}`}>
                <span>{m.ion}/{m.sym === 'H2' ? 'H₂' : m.sym}</span>
                <div className="series-bar"><div style={{ left: `${((m.E + 3.1) / 4.7) * 100}%` }} /></div>
                <b>{m.E.toFixed(3)}</b>
              </div>
            ))}
          </div>
          <p className="small muted">아래(전위가 낮은) 금속일수록 전자를 잃기 쉬워 반응성이 큽니다.</p>
        </div>
      </>}
      footer={<ScaleNote items={[
        '전자 이동 속도·전극 질량 변화는 화면용 (전지 전위가 클수록 빠르게 표시)',
        '전해질 농도 1 M, 25 °C 의 표준 상태를 가정 (실제 측정값은 농도·온도에 따라 달라짐)',
        'Li, K, Ca, Na 는 물과 반응하므로 전극 선택에서 제외',
      ]} />}
    />
  );
}
