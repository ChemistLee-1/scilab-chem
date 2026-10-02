import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { COURSES, STANDARDS } from '../data/curriculum.js';
import { simsForStandard } from '../data/simulations.js';

export default function Standards() {
  const [course, setCourse] = useState('all');
  const [onlyCovered, setOnlyCovered] = useState(false);
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); }
  }, [hash]);
  const covered = STANDARDS.filter((s) => simsForStandard(s.code).length > 0).length;

  return (
    <div className="container section">
      <h1>성취기준별 시뮬레이션</h1>
      <p className="muted">2022 개정 과학과 교육과정(교육부 고시 제2022-33호 [별책 9])의 화학 관련 성취기준입니다.
        현재 {STANDARDS.length}개 중 <b>{covered}개</b> 성취기준에 시뮬레이션이 연결되어 있습니다.</p>
      <div className="toolbar">
        <div className="segmented">
          <button className={course === 'all' ? 'on' : ''} onClick={() => setCourse('all')}>전체</button>
          {COURSES.map((c) => <button key={c.id} className={course === c.id ? 'on' : ''} onClick={() => setCourse(c.id)}>{c.name}</button>)}
        </div>
        <label className="radio"><input type="checkbox" checked={onlyCovered} onChange={(e) => setOnlyCovered(e.target.checked)} /> 시뮬레이션 있는 것만</label>
      </div>
      {COURSES.filter((c) => course === 'all' || c.id === course).map((c) => (
        <section key={c.id} className="std-course">
          <h2 style={{ borderColor: c.color }}>{c.name} <small>{c.type}</small></h2>
          {c.units.map((u) => {
            const list = STANDARDS.filter((s) => s.unit === u.id && (!onlyCovered || simsForStandard(s.code).length));
            if (!list.length) return null;
            return (
              <div key={u.id} className="std-unit">
                <h3>{u.no}. {u.title}</h3>
                <table className="std-table">
                  <tbody>
                    {list.map((s) => {
                      const sims = simsForStandard(s.code);
                      return (
                        <tr key={s.code} id={s.code}>
                          <td className="std-code">[{s.code}]</td>
                          <td>{s.text}</td>
                          <td className="std-sims">
                            {sims.length ? sims.map((x) => <Link key={x.id} to={`/simulations/${x.id}`} className="sim-link">{x.title}</Link>) : <span className="pending">준비 중</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
