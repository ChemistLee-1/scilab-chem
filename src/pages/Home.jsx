import { Link } from 'react-router-dom';
import SimCard from '../components/SimCard.jsx';
import { COURSES } from '../data/curriculum.js';
import { simulations } from '../data/simulations.js';

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container">
          {/* 소개 두 줄 → 큰 표어(영문) → 우리말 표어 순서 */}
          <p className="hero-lede">화학 현상의 이면에는 언제나 입자의 움직임이 있습니다<br />
            시뮬레이션은 그 보이지 않는 이야기를 상상하게 돕는 도구입니다</p>
          <h1 className="hero-title">Invisible, Imaginable.</h1>
          <p className="hero-sub">보이지 않지만, 상상할 수 있습니다</p>
          <div className="hero-actions">
            <Link to="/simulations" className="btn">단원별로 찾기 →</Link>
            <Link to="/standards" className="btn btn-light">성취기준별로 찾기</Link>
          </div>
        </div>
      </section>

      <section className="container section">
        <h2>과목별 탐색</h2>
        <div className="subject-grid">
          {COURSES.map((c) => (
            <Link key={c.id} to={`/simulations?course=${c.id}`} className="subject-tile" style={{ background: c.color }}>
              <span>{c.name}</span>
              <small>{c.type} · {c.grade}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="container section">
        <h2>전체 시뮬레이션 <small>{simulations.length}개</small></h2>
        <div className="card-grid">
          {simulations.map((sim) => <SimCard key={sim.id} sim={sim} />)}
        </div>
      </section>
    </>
  );
}
