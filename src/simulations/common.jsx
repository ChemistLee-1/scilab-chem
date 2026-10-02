import { useEffect, useRef } from 'react';

// 매 프레임 callback(dt초) 호출. running=false 면 정지.
export function useAnimationFrame(callback, running = true) {
  const cbRef = useRef(callback);
  cbRef.current = callback;
  useEffect(() => {
    if (!running) return;
    let id;
    let last = performance.now();
    const loop = (now) => {
      cbRef.current(Math.min((now - last) / 1000, 0.05));
      last = now;
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [running]);
}

export function Slider({ label, value, min, max, step = 1, unit = '', format, onChange }) {
  return (
    <label className="slider">
      <span>{label} <b>{format ? format(value) : value}{unit}</b></span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Select({ label, value, options, onChange }) {
  return (
    <label className="select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Segmented({ value, options, onChange }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function SimLayout({ canvas, controls, footer }) {
  return (
    <>
      <div className="sim-layout">
        <div className="sim-canvas">{canvas}</div>
        <div className="sim-controls">{controls}</div>
      </div>
      {footer}
    </>
  );
}

// 화면 표시를 위해 실제 값에 적용한 비율(축척)
export function ScaleNote({ items }) {
  return (
    <div className="scale-note">
      <b>화면 축척</b>
      <ul>{items.map((t) => <li key={t}>{t}</li>)}</ul>
    </div>
  );
}

export function Readout({ rows }) {
  return (
    <div className="readout">
      {rows.map(([k, v]) => <div key={k} className="readout-row"><span>{k}</span><b>{v}</b></div>)}
    </div>
  );
}

// 지수 표기: 1.2 × 10⁻⁵
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export function sci(x, digits = 2) {
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -2 && e <= 3) return x.toFixed(Math.max(0, digits - e));
  const m = x / 10 ** e;
  return `${m.toFixed(digits)} × 10${String(e).split('').map((c) => SUP[c]).join('')}`;
}

// 간단한 SVG 선 그래프. series: [{ points: [[x,y]], color, label, dashed }]
export function LineChart({
  series, xDomain, yDomain, xLabel, yLabel, width = 640, height = 300,
  xTicks = 5, yTicks = 5, markers = [], hLines = [], vLines = [], yFormat = (v) => v, xFormat = (v) => v,
}) {
  const pad = { l: 56, r: 16, t: 14, b: 40 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const sx = (x) => pad.l + ((x - xDomain[0]) / (xDomain[1] - xDomain[0])) * W;
  const sy = (y) => pad.t + H - ((y - yDomain[0]) / (yDomain[1] - yDomain[0])) * H;
  const clampY = (y) => Math.min(Math.max(y, yDomain[0]), yDomain[1]);
  const ticks = (d, n) => Array.from({ length: n + 1 }, (_, i) => d[0] + ((d[1] - d[0]) * i) / n);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart" role="img">
      {ticks(yDomain, yTicks).map((t) => (
        <g key={`y${t}`}>
          <line x1={pad.l} x2={pad.l + W} y1={sy(t)} y2={sy(t)} className="grid" />
          <text x={pad.l - 6} y={sy(t) + 4} textAnchor="end" className="tick">{yFormat(t)}</text>
        </g>
      ))}
      {ticks(xDomain, xTicks).map((t) => (
        <g key={`x${t}`}>
          <line y1={pad.t} y2={pad.t + H} x1={sx(t)} x2={sx(t)} className="grid" />
          <text y={pad.t + H + 16} x={sx(t)} textAnchor="middle" className="tick">{xFormat(t)}</text>
        </g>
      ))}
      <line x1={pad.l} x2={pad.l + W} y1={pad.t + H} y2={pad.t + H} className="axis" />
      <line x1={pad.l} x2={pad.l} y1={pad.t} y2={pad.t + H} className="axis" />
      {hLines.map((h) => (
        <g key={`h${h.y}`}>
          <line x1={pad.l} x2={pad.l + W} y1={sy(h.y)} y2={sy(h.y)} stroke={h.color} strokeDasharray="5 4" strokeWidth="1.5" />
          {h.label && <text x={pad.l + W - 4} y={sy(h.y) - 5} textAnchor="end" fill={h.color} className="tick">{h.label}</text>}
        </g>
      ))}
      {vLines.map((v) => (
        <g key={`v${v.x}${v.label}`}>
          <line y1={pad.t} y2={pad.t + H} x1={sx(v.x)} x2={sx(v.x)} stroke={v.color} strokeDasharray="5 4" strokeWidth="1.5" />
          {v.label && <text x={sx(v.x) + 4} y={pad.t + 12} fill={v.color} className="tick">{v.label}</text>}
        </g>
      ))}
      {series.map((s) => (
        <polyline key={s.label} fill="none" stroke={s.color} strokeWidth={s.width ?? 2.5}
          strokeDasharray={s.dashed ? '6 4' : undefined}
          points={s.points.map(([x, y]) => `${sx(x)},${sy(clampY(y))}`).join(' ')} />
      ))}
      {markers.map((m, i) => (
        <circle key={i} cx={sx(m.x)} cy={sy(clampY(m.y))} r={m.r ?? 5} fill={m.color} stroke="#fff" strokeWidth="1.5" />
      ))}
      <text x={pad.l + W / 2} y={height - 4} textAnchor="middle" className="axis-label">{xLabel}</text>
      <text transform={`translate(14 ${pad.t + H / 2}) rotate(-90)`} textAnchor="middle" className="axis-label">{yLabel}</text>
      {series.filter((s) => s.label && !s.hideLegend).map((s, i) => (
        <g key={`lg${s.label}`} transform={`translate(${pad.l + 10} ${pad.t + 10 + i * 16})`}>
          <rect width="14" height="4" y="-4" fill={s.color} />
          <text x="20" y="0" className="tick" dominantBaseline="middle">{s.label}</text>
        </g>
      ))}
    </svg>
  );
}

// 파장(nm) → RGB 문자열 (가시광 근사)
export function wavelengthToRGB(nm, alpha = 1) {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else if (nm <= 780) { r = 1; }
  let f = 1;
  if (nm < 420) f = 0.3 + (0.7 * (nm - 380)) / 40;
  else if (nm > 700) f = 0.3 + (0.7 * (780 - nm)) / 80;
  const c = (v) => Math.round(255 * Math.pow(v * f, 0.8));
  return `rgba(${c(r)},${c(g)},${c(b)},${alpha})`;
}

// 단조 함수 f 의 근을 [lo, hi] 에서 이분법으로 찾기
export function bisect(f, lo, hi, iter = 100) {
  let flo = f(lo);
  for (let i = 0; i < iter; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else hi = mid;
  }
  return (lo + hi) / 2;
}
