import { useMemo, useState } from 'react';
import { SimLayout, Segmented, ScaleNote, wavelengthToRGB } from './common.jsx';
import { SPECTRA } from '../data/crc.js';

const MIN = 380, MAX = 720, W = 640;
const x = (nm) => ((nm - MIN) / (MAX - MIN)) * W;
const KEYS = Object.keys(SPECTRA);

function Strip({ lines, mode, height = 54, label }) {
  return (
    <div className="spec-row">
      <div className="spec-label">{label}</div>
      <svg viewBox={`0 0 ${W} ${height}`} className="spec-strip" preserveAspectRatio="none">
        <defs>
          <linearGradient id="rainbow" x1="0" x2="1">
            {Array.from({ length: 35 }, (_, i) => MIN + (i * (MAX - MIN)) / 34).map((nm) => (
              <stop key={nm} offset={(nm - MIN) / (MAX - MIN)} stopColor={wavelengthToRGB(nm)} />
            ))}
          </linearGradient>
        </defs>
        <rect width={W} height={height} fill={mode === 'emission' ? '#05060a' : 'url(#rainbow)'} />
        {lines.map((nm) => (
          <rect key={nm} x={x(nm) - 1.25} width="2.5" height={height}
            fill={mode === 'emission' ? wavelengthToRGB(nm) : '#05060a'} />
        ))}
      </svg>
    </div>
  );
}

const pickStar = () => {
  const shuffled = [...KEYS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2 + Math.floor(Math.random() * 2));
};

export default function Spectrum() {
  const [tab, setTab] = useState('explore');
  const [mode, setMode] = useState('emission');
  const [selected, setSelected] = useState(['H', 'He', 'Na']);
  const [star, setStar] = useState(pickStar);
  const [guess, setGuess] = useState([]);
  const [checked, setChecked] = useState(false);

  const starLines = useMemo(() => star.flatMap((k) => SPECTRA[k].lines), [star]);
  const toggle = (list, set, k) => set(list.includes(k) ? list.filter((s) => s !== k) : [...list, k]);
  const correct = checked && guess.length === star.length && star.every((k) => guess.includes(k));

  const axis = (
    <div className="spec-row">
      <div className="spec-label" />
      <svg viewBox={`0 0 ${W} 18`} className="spec-strip axis-strip">
        {[400, 450, 500, 550, 600, 650, 700].map((nm) => (
          <text key={nm} x={x(nm)} y="13" textAnchor="middle" className="tick">{nm}</text>
        ))}
      </svg>
    </div>
  );

  return (
    <SimLayout
      canvas={
        <div className="spec-view">
          {tab === 'explore' ? (
            <>
              {selected.map((k) => <Strip key={k} lines={SPECTRA[k].lines} mode={mode} label={`${SPECTRA[k].ko} (${k})`} />)}
              {selected.length === 0 && <p className="muted">오른쪽에서 원소를 선택하세요.</p>}
            </>
          ) : (
            <>
              <Strip lines={starLines} mode="absorption" label="미지의 별" height={64} />
              {guess.map((k) => <Strip key={k} lines={SPECTRA[k].lines} mode="absorption" label={`${SPECTRA[k].ko} (${k})`} />)}
            </>
          )}
          {axis}
          <p className="muted small center">파장 (nm)</p>
        </div>
      }
      controls={<>
        <Segmented value={tab} onChange={(v) => { setTab(v); setChecked(false); }}
          options={[{ value: 'explore', label: '원소 스펙트럼' }, { value: 'star', label: '별빛 분석' }]} />
        {tab === 'explore' ? (
          <>
            <Segmented value={mode} onChange={setMode}
              options={[{ value: 'emission', label: '방출' }, { value: 'absorption', label: '흡수' }]} />
            <div className="chips">
              {KEYS.map((k) => (
                <button key={k} className={`chip ${selected.includes(k) ? 'on' : ''}`} onClick={() => toggle(selected, setSelected, k)}>
                  {SPECTRA[k].ko}
                </button>
              ))}
            </div>
            <p className="small muted">같은 원소는 방출선과 흡수선의 파장이 같습니다. 원소마다 선의 위치가 달라 '빛의 지문'처럼 원소를 구별할 수 있습니다.</p>
          </>
        ) : (
          <>
            <p className="small">별빛의 흡수 스펙트럼에 2~3가지 원소의 흡수선이 섞여 있습니다. 원소를 골라 선의 위치를 비교해 보세요.</p>
            <div className="chips">
              {KEYS.map((k) => (
                <button key={k} className={`chip ${guess.includes(k) ? 'on' : ''}`} onClick={() => { toggle(guess, setGuess, k); setChecked(false); }}>
                  {SPECTRA[k].ko}
                </button>
              ))}
            </div>
            <button className="btn" onClick={() => setChecked(true)}>확인</button>
            {checked && (
              <div className={`feedback ${correct ? 'ok' : 'no'}`}>
                {correct ? '정답입니다! 모든 흡수선이 설명됩니다.' : '아직 설명되지 않는 흡수선이 있거나, 없는 원소가 포함되어 있습니다.'}
              </div>
            )}
            <button className="btn btn-ghost" onClick={() => { setStar(pickStar()); setGuess([]); setChecked(false); }}>새로운 별</button>
          </>
        )}
      </>}
      footer={<ScaleNote items={[
        `가로축: 380–720 nm 를 ${W} px 에 표시 (1 px ≈ ${((MAX - MIN) / W).toFixed(2)} nm)`,
        '선의 굵기와 밝기는 실제 세기와 무관하게 같게 표시 (파장 위치만 실측값)',
        '색은 파장을 RGB 로 근사 변환한 것',
      ]} />}
    />
  );
}
