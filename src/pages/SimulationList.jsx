import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { COURSES, courseById } from '../data/curriculum.js';
import { simulations, simsForPlace } from '../data/simulations.js';
import SimCard from '../components/SimCard.jsx';

function SimLinks({ sims }) {
  if (sims.length === 0) return <span className="pending">준비 중</span>;
  return (
    <span className="sim-links">
      {sims.map((s) => <Link key={s.id} to={`/simulations/${s.id}`} className="sim-link">{s.title}</Link>)}
    </span>
  );
}

// 교과서 차례 형태로 단원별 시뮬레이션 표시
function CourseTree({ course, query }) {
  const match = (s) => !query || (s.title + s.description).includes(query);
  return (
    <div className="tree">
      <div className="tree-head" style={{ borderColor: course.color }}>
        <h2>{course.name}</h2>
        <span className="muted small">{course.type} · {course.grade} · 단원 구성: {course.textbook} 교과서 기준</span>
      </div>
      {course.units.map((u) => {
        const unitSims = simsForPlace(u.id).filter(match);
        let lastParent = null;
        return (
          <div key={u.id} className="tree-unit">
            <h3><span className="roman" style={{ background: course.color }}>{u.no}</span>{u.title}</h3>
            {unitSims.length > 0 && <div className="tree-row unit-level"><span className="muted">단원 전체</span><SimLinks sims={unitSims} /></div>}
            {u.sections.map((sec) => {
              const showParent = sec.parent && sec.parent !== lastParent;
              lastParent = sec.parent;
              return (
                <div key={sec.id}>
                  {showParent && <div className="tree-parent">{sec.parent}</div>}
                  <div className="tree-row">
                    <span>
                      <b className="sec-no">{sec.no}</b> {sec.title}
                      {sec.subs && <span className="subs">{sec.subs.join(' · ')}</span>}
                    </span>
                    <SimLinks sims={simsForPlace(sec.id).filter(match)} />
                  </div>
                </div>
              );
            })}
            {u.sections.length === 0 && unitSims.length === 0 && <div className="tree-row"><span className="muted">—</span><span className="pending">준비 중</span></div>}
          </div>
        );
      })}
    </div>
  );
}

export default function SimulationList() {
  const [params, setParams] = useSearchParams();
  const courseId = params.get('course') ?? 'tsci1';
  const view = params.get('view') ?? 'tree';
  const [query, setQuery] = useState('');
  const set = (patch) => setParams({ course: courseId, view, ...patch });
  const filtered = simulations.filter((s) => (s.title + s.description).includes(query));

  return (
    <div className="container section list-layout">
      <aside className="filters">
        <input className="search" placeholder="시뮬레이션 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        <h4>보기</h4>
        <label className="radio"><input type="radio" checked={view === 'tree'} onChange={() => set({ view: 'tree' })} /> 교과서 단원별</label>
        <label className="radio"><input type="radio" checked={view === 'cards'} onChange={() => set({ view: 'cards' })} /> 전체 카드</label>
        {view === 'tree' && <>
          <h4>과목</h4>
          {COURSES.map((c) => (
            <label key={c.id} className="radio">
              <input type="radio" checked={courseId === c.id} onChange={() => set({ course: c.id })} />
              <span className="dot" style={{ background: c.color }} /> {c.name}
            </label>
          ))}
        </>}
        <p className="small muted note">성취기준 코드로 찾으려면 <Link to="/standards">성취기준</Link> 메뉴를 이용하세요.</p>
      </aside>
      <section>
        {view === 'tree'
          ? <CourseTree course={courseById[courseId] ?? COURSES[0]} query={query} />
          : (
            <>
              <h2>시뮬레이션 <small>{filtered.length}개</small></h2>
              <div className="card-grid">{filtered.map((sim) => <SimCard key={sim.id} sim={sim} />)}</div>
            </>
          )}
      </section>
    </div>
  );
}
