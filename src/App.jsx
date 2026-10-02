import { Routes, Route } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import Home from './pages/Home.jsx';
import SimulationList from './pages/SimulationList.jsx';
import SimulationPage from './pages/SimulationPage.jsx';
import About from './pages/About.jsx';
import Standards from './pages/Standards.jsx';

export default function App() {
  return (
    <div className="app">
      <ScrollToTop />
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/simulations" element={<SimulationList />} />
          <Route path="/simulations/:id" element={<SimulationPage />} />
          <Route path="/standards" element={<Standards />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<div className="container"><h2>페이지를 찾을 수 없습니다.</h2></div>} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
