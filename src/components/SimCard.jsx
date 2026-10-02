import { Link } from 'react-router-dom';
import Thumbnail from './Thumbnail.jsx';
import { sectionById, unitById } from '../data/curriculum.js';

const courseOf = (placeId) => (sectionById[placeId] ?? unitById[placeId]).course;

export default function SimCard({ sim }) {
  const courses = [...new Map(sim.places.map((p) => [courseOf(p).id, courseOf(p)])).values()];
  return (
    <Link to={`/simulations/${sim.id}`} className="card">
      <Thumbnail sim={sim} color={courses[0].color} />
      <div className="card-body">
        <h3>{sim.title}</h3>
        <div className="tags">
          {courses.map((c) => <span key={c.id} className="tag" style={{ color: c.color, borderColor: c.color }}>{c.name}</span>)}
        </div>
      </div>
    </Link>
  );
}

