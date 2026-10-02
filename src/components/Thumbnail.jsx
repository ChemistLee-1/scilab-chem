// 시뮬레이션별 간단한 SVG 썸네일
const ART = {
  spectrum: (<><rect width="120" height="80" fill="#05060a" />{[410, 434, 486, 656].map((nm, i) => <rect key={nm} x={14 + (nm - 380) / 3.4} y="14" width="3" height="52" fill={['#7b00ff', '#2a3bff', '#00e5ff', '#ff2a00'][i]} />)}</>),
  'periodic-trends': (<>{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <circle key={i} cx={14 + i * 13} cy="40" r={10 - i} fill="white" opacity="0.85" />)}</>),
  'bond-polarity': (<><circle cx="45" cy="40" r="16" fill="white" opacity="0.6" /><circle cx="78" cy="40" r="20" fill="white" /><text x="78" y="20" fill="white" fontSize="11" textAnchor="middle">δ−</text><text x="45" y="20" fill="white" fontSize="11" textAnchor="middle">δ+</text></>),
  'gas-properties': (<><rect x="14" y="12" width="80" height="56" fill="none" stroke="white" strokeWidth="3" /><rect x="94" y="10" width="6" height="60" fill="white" />{[[25, 25], [55, 50], [80, 30], [40, 58], [70, 60], [60, 20]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="white" />)}</>),
  'vapor-pressure': <path d="M12 70 C 60 68, 85 50, 110 10" fill="none" stroke="white" strokeWidth="4" />,
  colligative: (<><rect x="50" y="8" width="16" height="56" rx="8" fill="white" opacity="0.4" /><rect x="54" y="30" width="8" height="34" fill="white" /><circle cx="58" cy="68" r="9" fill="white" /></>),
  'dissolution-heat': (<><path d="M35 20 h50 l-6 50 h-38z" fill="white" opacity="0.5" /><path d="M60 8 v12" stroke="white" strokeWidth="3" /><text x="60" y="55" fill="white" fontSize="16" textAnchor="middle">ΔH</text></>),
  equilibrium: <text x="60" y="48" fill="white" fontSize="26" textAnchor="middle">⇌</text>,
  'acid-ph': <text x="60" y="50" fill="white" fontSize="26" fontWeight="700" textAnchor="middle">pH</text>,
  titration: (<><rect x="56" y="4" width="8" height="40" fill="white" /><path d="M42 50 h36 l12 22 h-60z" fill="white" opacity="0.7" /></>),
  'galvanic-cell': (<><rect x="20" y="36" width="10" height="34" fill="white" /><rect x="90" y="36" width="10" height="34" fill="white" /><path d="M25 36 V14 H95 V36" fill="none" stroke="white" strokeWidth="2" /><text x="60" y="30" fill="white" fontSize="12" textAnchor="middle">1.10 V</text></>),
};

export default function Thumbnail({ sim, color }) {
  return (
    <div className="thumb" style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)` }}>
      <svg viewBox="0 0 120 80" width="100%" height="100%">{ART[sim.id]}</svg>
    </div>
  );
}
