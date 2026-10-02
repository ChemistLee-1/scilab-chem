import { NavLink, Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">
          <span className="logo-mark">◎</span> SciLab <small>화학</small>
        </Link>
        <nav className="nav">
          <NavLink to="/simulations">시뮬레이션</NavLink>
          <NavLink to="/standards">성취기준</NavLink>
          <NavLink to="/about">자료 출처</NavLink>
        </nav>
      </div>
    </header>
  );
}
