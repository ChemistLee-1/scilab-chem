import { useParams, Link } from 'react-router-dom';
import { simulations } from '../data/simulations.js';
import { placeLabel, standardByCode } from '../data/curriculum.js';
import { SOURCES } from '../data/crc.js';

export default function SimulationPage() {
  const { id } = useParams();
  const sim = simulations.find((s) => s.id === id);
  if (!sim) return <div className="container section"><h2>시뮬레이션을 찾을 수 없습니다.</h2></div>;
  const Sim = sim.component;

  return (
    <div className="container section">
      <Link to="/simulations" className="back">← 목록으로</Link>
      <h1>{sim.title}</h1>
      <p className="muted">{sim.description}</p>

      <div className="sim-frame"><Sim /></div>

      <div className="sim-info">
        <div>
          <h3>교과서 단원</h3>
          <ul>{sim.places.map((p) => <li key={p}>{placeLabel(p)}</li>)}</ul>
          <h3>학습 목표</h3>
          <ul>{sim.goals.map((g) => <li key={g}>{g}</li>)}</ul>
        </div>
        <div>
          <h3>성취기준</h3>
          <ul className="std-list">
            {sim.standards.map((c) => (
              <li key={c}><Link to={`/standards#${c}`} className="std-code">[{c}]</Link> {standardByCode[c].text}</li>
            ))}
          </ul>
          <h3>데이터 출처</h3>
          <ul className="small">
            {sim.sources.map((k) => <li key={k}>CRC Handbook of Chemistry and Physics, 95th Ed. — {SOURCES[k]}</li>)}
            {/* 실제 측정값을 쓰지 않는 시뮬레이션일 때 */}
            {sim.sources.length === 0 && <li>실측 데이터를 쓰지 않는 정성적 시뮬레이션 (값은 상댓값)</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
