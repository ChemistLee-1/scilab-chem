import { useMemo, useRef, useState } from 'react';
import { Slider, Select, SimLayout, ScaleNote, Readout, LineChart, Segmented, useAnimationFrame, bisect } from './common.jsx';
import { ACIDS, INDICATORS, PKW, interp } from '../data/crc.js';

const KW = 10 ** -interp(PKW, 25);
const VA = 20; // 분석할 산 용액 (mL)
const CB = 0.1; // 표준 NaOH (M)
const MAX_VB = 50;

// 산 HA(Ca, Va) 에 NaOH(Cb, Vb) 를 넣었을 때 pH: 전하 균형 [H⁺] + [Na⁺] = [OH⁻] + [A⁻]
function pHAt(Ca, Ka, vb) {
  const V = VA + vb, CA = (Ca * VA) / V, Na = (CB * vb) / V;
  const l = bisect((x) => { const h = Math.exp(x); return h + Na - KW / h - (CA * Ka) / (h + Ka); }, Math.log(1e-14), Math.log(10));
  return -Math.log10(Math.exp(l));
}

function mix(c1, c2, t) {
  const p = (c) => c.startsWith('#') ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)).concat(1) : c.match(/[\d.]+/g).map(Number);
  const a = p(c1), b = p(c2);
  return `rgba(${a.slice(0, 4).map((v, i) => (i < 3 ? Math.round(v + (b[i] - v) * t) : (v + (b[i] - v) * t).toFixed(2))).join(',')})`;
}
function indicatorColor(ind, pH) {
  const [lo, hi] = ind.range;
  const t = Math.min(1, Math.max(0, (pH - lo) / (hi - lo)));
  return mix(ind.acid, ind.base, t);
}

export default function Titration() {
  const [mode, setMode] = useState('learn');
  const [acidId, setAcidId] = useState('CH3COOH');
  const [Ca, setCa] = useState(0.1);
  const [indId, setIndId] = useState('pp');
  const [vb, setVb] = useState(0);
  const [flow, setFlow] = useState(0); // mL/s
  const [unknown, setUnknown] = useState(() => 0.05 + Math.round(Math.random() * 10) / 100);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);
  const vbRef = useRef(0);

  const acid = ACIDS.find((a) => a.id === acidId);
  const Ka = acid.strong ? 1e8 : 10 ** -acid.pKa;
  const conc = mode === 'unknown' ? unknown : Ca;
  const ind = INDICATORS.find((i) => i.id === indId);
  const pH = pHAt(conc, Ka, vb);
  const veq = (conc * VA) / CB;

  const curve = useMemo(() => Array.from({ length: 201 }, (_, i) => [i * MAX_VB / 200, pHAt(conc, Ka, i * MAX_VB / 200)]), [conc, Ka]);
  const [measured, setMeasured] = useState([]);

  useAnimationFrame((dt) => {
    vbRef.current = Math.min(MAX_VB, vbRef.current + flow * dt);
    setVb(vbRef.current);
    setMeasured((m) => (m.length && vbRef.current - m[m.length - 1][0] < 0.1 ? m : [...m, [vbRef.current, pHAt(conc, Ka, vbRef.current)]]));
    if (vbRef.current >= MAX_VB) setFlow(0);
  }, flow > 0);

  const reset = (newUnknown) => {
    vbRef.current = 0; setVb(0); setFlow(0); setMeasured([]); setResult(null); setAnswer('');
    if (newUnknown) setUnknown(0.05 + Math.round(Math.random() * 10) / 100);
  };
  const check = () => {
    const a = Number(answer);
    setResult(Math.abs(a - unknown) / unknown < 0.05 ? `정답! 실제 농도는 ${unknown.toFixed(3)} M` : '다시 생각해 보세요. (오차 5% 이내)');
  };

  const level = 180 - (vb / MAX_VB) * 150;
  const flaskColor = indicatorColor(ind, pH);

  return (
    <SimLayout
      canvas={<>
        <div className="titr-top">
          <svg viewBox="0 0 260 330" className="titr-app">
            <rect x="115" y="10" width="30" height="190" fill="#fff" stroke="#556" strokeWidth="2" />
            <rect x="117" y={200 - (1 - vb / MAX_VB) * 180} width="26" height={(1 - vb / MAX_VB) * 180} fill="#cfe3ff" />
            {[0, 10, 20, 30, 40, 50].map((m) => <g key={m}><line x1="145" x2="155" y1={20 + (m / 50) * 180} y2={20 + (m / 50) * 180} stroke="#556" /><text x="158" y={24 + (m / 50) * 180} className="tick">{m}</text></g>)}
            <path d="M125 200 h10 v20 h-10z" fill="#556" />
            <rect x="128" y="220" width="4" height="22" fill="#556" />
            {flow > 0 && <circle cx="130" cy="252" r="3" fill="#7fb3ff" className="drip" />}
            <path d="M100 255 h60 v15 l40 50 a6 6 0 0 1 -5 9 h-130 a6 6 0 0 1 -5 -9 l40 -50z" fill="#fff" stroke="#556" strokeWidth="2" />
            <path d="M74 295 h112 l15 20 a6 6 0 0 1 -5 9 h-132 a6 6 0 0 1 -5 -9z" fill={flaskColor === 'rgba(255,255,255,0)' ? '#f4f8ff' : flaskColor} stroke="none" />
            <text x="200" y="250" className="tick">NaOH {CB} M</text>
          </svg>
          <LineChart width={420} height={330} xDomain={[0, MAX_VB]} yDomain={[0, 14]} xTicks={5} yTicks={7}
            series={[
              ...(mode === 'learn' ? [{ label: '이론 곡선', color: '#c5cbe0', points: curve, width: 2, dashed: true }] : []),
              { label: '측정값', color: '#eb5757', points: measured.length ? measured : [[0, pHAt(conc, Ka, 0)]] },
            ]}
            hLines={[{ y: ind.range[0], color: '#bbb' }, { y: ind.range[1], color: '#bbb', label: `${ind.ko} 변색 범위` }]}
            vLines={mode === 'learn' ? [{ x: veq, color: '#27ae60', label: '중화점' }] : []}
            markers={[{ x: vb, y: pH, color: '#eb5757' }]}
            xLabel="넣은 NaOH 부피 (mL)" yLabel="pH" />
        </div>
      </>}
      controls={<>
        <Segmented value={mode} onChange={(m) => { setMode(m); reset(m === 'unknown'); }}
          options={[{ value: 'learn', label: '적정 곡선 탐구' }, { value: 'unknown', label: '미지 시료 농도' }]} />
        <Select label="산 (20.0 mL)" value={acidId} onChange={(v) => { setAcidId(v); reset(false); }}
          options={ACIDS.map((a) => ({ value: a.id, label: `${a.ko} ${a.strong ? '(강산)' : `pKa ${a.pKa}`}` }))} />
        {mode === 'learn' && <Slider label="산의 농도" value={Ca} min={0.02} max={0.2} step={0.01} unit=" M" onChange={(v) => { setCa(v); reset(false); }} />}
        <Select label="지시약" value={indId} onChange={setIndId}
          options={INDICATORS.map((i) => ({ value: i.id, label: `${i.ko} (pH ${i.range[0]}–${i.range[1]})` }))} />
        <div className="btn-row">
          <button className="btn" onClick={() => setFlow(flow ? 0 : 1)}>{flow ? '멈춤' : '콕 열기'}</button>
          <button className="btn btn-ghost" onClick={() => { vbRef.current = Math.min(MAX_VB, vbRef.current + 0.05); setVb(vbRef.current); setMeasured((m) => [...m, [vbRef.current, pHAt(conc, Ka, vbRef.current)]]); }}>한 방울 (0.05 mL)</button>
          <button className="btn btn-ghost" onClick={() => reset(false)}>처음부터</button>
        </div>
        <Readout rows={[
          ['넣은 NaOH', `${vb.toFixed(2)} mL`],
          ['pH', pH.toFixed(2)],
          ...(mode === 'learn' ? [['중화점 부피 (계산)', `${veq.toFixed(2)} mL`], ['중화점 pH', pHAt(conc, Ka, veq).toFixed(2)]] : []),
        ]} />
        {mode === 'unknown' && (
          <div className="subpanel">
            <b>산의 농도는? (M)</b>
            <p className="small muted">중화점: 산의 mol = NaOH 의 mol → C<sub>산</sub> × 20.0 mL = {CB} M × V<sub>NaOH</sub></p>
            <div className="btn-row">
              <input className="num-input" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="예: 0.085" />
              <button className="btn" onClick={check}>확인</button>
            </div>
            {result && <div className="feedback">{result}</div>}
            <button className="btn btn-ghost" onClick={() => reset(true)}>새 시료</button>
          </div>
        )}
      </>}
      footer={<ScaleNote items={[
        `뷰렛 눈금 0–${MAX_VB} mL 를 180 px 에 표시`,
        '콕을 열면 1 mL/s 로 떨어지도록 화면 속도를 정함 (실제 실험보다 빠름)',
        '지시약 색: CRC 변색 범위 안에서 산성색→염기성색으로 선형 혼합해 표시',
      ]} />}
    />
  );
}
