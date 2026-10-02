import { useMemo, useState } from 'react';
import { Slider, Select, SimLayout, ScaleNote, Readout, sci, bisect } from './common.jsx';
import { ACIDS, PKW, interp, molarMass } from '../data/crc.js';

const KW25 = 10 ** -interp(PKW, 25);
const FORMULA = { HCl: 'HCl', HNO2: 'HNO2', HF: 'HF', HCOOH: 'CH2O2', CH3COOH: 'C2H4O2', H2CO3: 'H2CO3', HClO: 'HClO', HCN: 'HCN' };
const N_DOTS = 100; // 처음 넣은 산 분자 100개로 표시

// 일양성자산 HA 수용액의 [H₃O⁺]: h = Kw/h + C·Ka/(h+Ka) (전하 균형)
export function solveH(C, Ka, Kw = KW25) {
  const lnh = bisect((l) => { const h = Math.exp(l); return h - Kw / h - (C * Ka) / (h + Ka); }, Math.log(1e-14), Math.log(10));
  return Math.exp(lnh);
}

function LogBars({ items }) {
  const x = (c) => ((Math.log10(c) + 14) / 14) * 400;
  return (
    <svg viewBox="0 0 560 170" className="logbars">
      {items.map((it, i) => (
        <g key={it.label} transform={`translate(110 ${12 + i * 38})`}>
          <text x="-8" y="17" textAnchor="end" className="tick">{it.label}</text>
          <rect width="400" height="24" fill="#f0f2f7" rx="4" />
          <rect width={Math.max(0, x(it.value))} height="24" fill={it.color} rx="4" />
          <text x={Math.max(0, x(it.value)) + 6} y="17" className="tick">{sci(it.value, 2)} M</text>
        </g>
      ))}
      {[-14, -10, -6, -2, 0].map((e) => <text key={e} x={110 + ((e + 14) / 14) * 400} y="166" textAnchor="middle" className="tick">10^{e}</text>)}
    </svg>
  );
}

export default function AcidPH() {
  const [acidId, setAcidId] = useState('CH3COOH');
  const [logC, setLogC] = useState(-1);
  const [tw, setTw] = useState(25);
  const acid = ACIDS.find((a) => a.id === acidId);
  const C = 10 ** logC;
  const Ka = acid.strong ? 1e8 : 10 ** -acid.pKa;
  const h = solveH(C, Ka);
  const pH = -Math.log10(h);
  const A = (C * Ka) / (h + Ka), HA = C - A, OH = KW25 / h;
  const alpha = A / C;
  const dots = useMemo(() => Array.from({ length: N_DOTS }, () => [20 + Math.random() * 300, 30 + Math.random() * 170]), []);
  const nIon = Math.round(alpha * N_DOTS);
  const pKwT = interp(PKW, tw);

  return (
    <SimLayout
      canvas={<>
        <div className="ph-top">
          <svg viewBox="0 0 340 220" className="beaker">
            <path d="M10 20 v180 a10 10 0 0 0 10 10 h300 a10 10 0 0 0 10 -10 v-180" fill="none" stroke="#556" strokeWidth="3" />
            <rect x="13" y="25" width="314" height="182" fill="#eef6ff" />
            {dots.map(([x, y], i) => i < nIon ? (
              <g key={i}><circle cx={x} cy={y} r="4" fill="#eb5757" /><circle cx={x + 9} cy={y + 3} r="4" fill="#2f80ed" /></g>
            ) : (
              <g key={i}><circle cx={x} cy={y} r="4" fill="#bbb" /><circle cx={x + 5} cy={y} r="3" fill="#888" /></g>
            ))}
          </svg>
          <div className="ph-meter">
            <div className="ph-value">{pH.toFixed(2)}</div>
            <div className="small muted">pH</div>
            <div className="ph-scale"><div className="ph-needle" style={{ left: `${(pH / 14) * 100}%` }} /></div>
            <div className="legend small"><span className="dot red" />H₃O⁺ <span className="dot blue" />A⁻ <span className="dot gray" />HA</div>
          </div>
        </div>
        <LogBars items={[
          { label: '[HA]', value: Math.max(HA, 1e-14), color: '#999' },
          { label: '[A⁻]', value: A, color: '#2f80ed' },
          { label: '[H₃O⁺]', value: h, color: '#eb5757' },
          { label: '[OH⁻]', value: OH, color: '#27ae60' },
        ]} />
      </>}
      controls={<>
        <Select label="산" value={acidId} onChange={setAcidId}
          options={ACIDS.map((a) => ({ value: a.id, label: `${a.ko} ${a.formula} ${a.strong ? '(강산)' : `pKa ${a.pKa}`}` }))} />
        <Slider label="몰 농도" value={logC} min={-4} max={0} step={0.05} format={(v) => sci(10 ** v, 2)} unit=" M" onChange={setLogC} />
        <Readout rows={[
          ['pH', pH.toFixed(2)],
          ['이온화도 α', `${(alpha * 100).toFixed(alpha < 0.01 ? 3 : 1)} %`],
          ['Ka', acid.strong ? '매우 큼 (완전 이온화)' : sci(Ka, 2)],
          ['용액 1 L 에 녹인 산', `${C.toPrecision(3)} mol = ${(C * molarMass(FORMULA[acid.id])).toPrecision(3)} g`],
        ]} />
        <div className="subpanel">
          <b>물의 자동 이온화</b>
          <Slider label="물의 온도" value={tw} min={0} max={100} step={1} unit=" °C" onChange={setTw} />
          <Readout rows={[['pKw', pKwT.toFixed(3)], ['Kw', sci(10 ** -pKwT, 2)], ['중성 pH', (pKwT / 2).toFixed(2)]]} />
        </div>
      </>}
      footer={<ScaleNote items={[
        `비커: 처음 넣은 산 분자 ${N_DOTS}개 중 이온화한 비율(α)만큼 H₃O⁺·A⁻ 로 표시 (농도와 관계없이 100개)`,
        '농도 막대: 로그 눈금 (10⁻¹⁴ ~ 1 M)',
        'pH 는 전하 균형식 [H₃O⁺] = [OH⁻] + [A⁻] 를 수치로 풀어 계산 (25 °C, 활동도 = 농도로 근사)',
      ]} />}
    />
  );
}
