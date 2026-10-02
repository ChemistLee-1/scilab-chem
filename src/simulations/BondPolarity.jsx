import { useState } from 'react';
import { SimLayout, Select, ScaleNote, Readout } from './common.jsx';
import { elementBySym } from '../data/crc.js';

const SYMS = ['H', 'Li', 'C', 'N', 'O', 'F', 'Na', 'Mg', 'P', 'S', 'Cl', 'K', 'Ca'];
const METALS = new Set(['Li', 'Na', 'Mg', 'K', 'Ca']);
const PRESETS = [['H', 'H', 'H₂'], ['H', 'Cl', 'HCl'], ['H', 'F', 'HF'], ['O', 'H', 'H₂O의 O–H'], ['C', 'H', 'CH₄의 C–H'], ['Na', 'Cl', 'NaCl'], ['O', 'O', 'O₂']];
const W = 640, H = 300, PX_PER_PM = 0.55;

function bondType(a, b) {
  const ma = METALS.has(a.sym), mb = METALS.has(b.sym);
  if (ma && mb) return '금속 결합';
  if (ma || mb) return '이온 결합';
  return Math.abs(a.en - b.en) < 1e-9 ? '무극성 공유 결합' : '극성 공유 결합';
}

export default function BondPolarity() {
  const [sa, setSa] = useState('H');
  const [sb, setSb] = useState('Cl');
  const a = elementBySym[sa], b = elementBySym[sb];
  const dEN = Math.abs(a.en - b.en);
  const type = bondType(a, b);
  const ionicChar = 1 - Math.exp(-(dEN ** 2) / 4); // Pauling 근사식
  const ra = a.rcov * 100 * PX_PER_PM, rb = b.rcov * 100 * PX_PER_PM;
  const d = ra + rb; // 공유 반지름 합 ≈ 결합 길이
  const ax = W / 2 - d / 2, bx = W / 2 + d / 2, cy = 140;
  // 전자쌍 중심 위치: 전기 음성도가 큰 쪽으로 이동
  const shift = type === '이온 결합' ? 1 : Math.min(1, dEN / 2.5);
  const toward = a.en >= b.en ? -1 : 1;
  const ex = W / 2 + toward * shift * (d / 2) * 0.8;
  const neg = a.en >= b.en ? a : b;
  const pos = neg === a ? b : a;

  return (
    <SimLayout
      canvas={
        <svg viewBox={`0 0 ${W} ${H}`} className="bond-view">
          <defs>
            <radialGradient id="cloud">
              <stop offset="0" stopColor="#9b51e0" stopOpacity="0.55" />
              <stop offset="1" stopColor="#9b51e0" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="#fbfcff" />
          <circle cx={ax} cy={cy} r={ra} fill="#dce8fb" stroke="#2f80ed" />
          <circle cx={bx} cy={cy} r={rb} fill="#fde2e2" stroke="#eb5757" />
          {type !== '금속 결합' && <ellipse cx={ex} cy={cy} rx={Math.max(26, d * 0.35)} ry={Math.max(22, Math.min(ra, rb) * 0.9)} fill="url(#cloud)" />}
          {type !== '금속 결합' && <>
            <circle cx={ex - 5} cy={cy} r="4" fill="#5b2c83" />
            <circle cx={ex + 5} cy={cy} r="4" fill="#5b2c83" />
          </>}
          <text x={ax} y={cy + 6} textAnchor="middle" className="atom-sym">{a.sym}</text>
          <text x={bx} y={cy + 6} textAnchor="middle" className="atom-sym">{b.sym}</text>
          {dEN > 0 && type !== '금속 결합' && <>
            <text x={neg === a ? ax : bx} y={cy - (neg === a ? ra : rb) - 10} textAnchor="middle" className="charge">{type === '이온 결합' ? '−' : 'δ−'}</text>
            <text x={pos === a ? ax : bx} y={cy - (pos === a ? ra : rb) - 10} textAnchor="middle" className="charge">{type === '이온 결합' ? '+' : 'δ+'}</text>
          </>}
          {/* 전기 음성도 차이 막대 */}
          <g transform={`translate(70 ${H - 50})`}>
            <rect width="500" height="12" rx="6" fill="#e6e9f0" />
            <rect width={Math.min(500, (dEN / 3.5) * 500)} height="12" rx="6" fill="#9b51e0" />
            {[0, 1, 2, 3].map((v) => <text key={v} x={(v / 3.5) * 500} y="30" textAnchor="middle" className="tick">{v}</text>)}
            <text x="250" y="-8" textAnchor="middle" className="tick">전기 음성도 차이 ΔEN = {dEN.toFixed(2)}</text>
          </g>
        </svg>
      }
      controls={<>
        <Select label="원자 A" value={sa} onChange={setSa} options={SYMS.map((s) => ({ value: s, label: `${elementBySym[s].ko} (${s}) · ${elementBySym[s].en}` }))} />
        <Select label="원자 B" value={sb} onChange={setSb} options={SYMS.map((s) => ({ value: s, label: `${elementBySym[s].ko} (${s}) · ${elementBySym[s].en}` }))} />
        <div className="chips">
          {PRESETS.map(([x, y, label]) => <button key={label} className="chip" onClick={() => { setSa(x); setSb(y); }}>{label}</button>)}
        </div>
        <Readout rows={[
          ['결합의 종류', type],
          ['ΔEN', dEN.toFixed(2)],
          ['이온성 정도 (폴링 근사)', `${Math.round(ionicChar * 100)} %`],
          ['결합 길이 추정 (공유 반지름 합)', `${Math.round(a.rcov * 100 + b.rcov * 100)} pm`],
        ]} />
        <p className="small muted">공유 전자쌍은 전기 음성도가 큰 원자 쪽으로 치우칩니다. 금속 원소와 비금속 원소의 결합은 이온 결합으로 분류했습니다.</p>
      </>}
      footer={<ScaleNote items={[
        `원자 크기: 공유 반지름에 비례, 1 pm = ${PX_PER_PM} px`,
        '원자 사이 거리 = 두 원자의 공유 반지름 합 (실제 결합 길이의 근사값)',
        '전자 구름의 치우침은 ΔEN 에 비례하도록 정성적으로 표시',
      ]} />}
    />
  );
}
