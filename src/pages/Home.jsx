import { Link } from 'react-router-dom';
import SimCard from '../components/SimCard.jsx';
import { COURSES } from '../data/curriculum.js';
import { simulations } from '../data/simulations.js';

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>실제 데이터로 탐구하는 화학</h1>
          <p>CRC Handbook 의 실측 데이터를 바탕으로 만든 화학 시뮬레이션입니다.<br />
            교과서 단원과 2022 개정 교육과정 성취기준에 따라 찾아볼 수 있습니다.</p>
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
