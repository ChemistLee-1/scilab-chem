import { useEffect, useRef, useState } from 'react';
import { ScaleNote } from './common.jsx';
import './DynamicEquilibrium.css';

/* =========================================================
   가역 반응과 동적 평형 — 밀폐 용기 속 물의 증발과 응축
   (사용자 제공 '동적 평형 시뮬레이션 — 증발과 응축' 디자인)
   - 아래쪽 액체에서 분자가 튀어나가면 증발(정반응),
     기체 분자가 수면에 부딪히면 응축(역반응).
   - 증발 속도는 온도로만 정해지고, 응축 속도는 기체 분자 수에 비례.
     → 시간이 지나면 두 속도가 같아져 동적 평형에 도달.
   - 수치는 모두 '상댓값'(화면용)이며 실제 측정값이 아님.
   ========================================================= */

// ── 플라스크 그림 크기 (그림 좌표, 실제 화면 크기에 맞춰 늘리고 줄임)
const FW = 400, FH = 460;
const cx = FW / 2, cy = 268, R = 150; // 둥근 플라스크의 중심과 반지름
const SURFACE_Y0 = cy + 46; // 처음 수면 높이
const NECK_TOP = 70, NECK_HALF = 34; // 플라스크 목

// ── 분자 관련 값 (화면용)
const N = 220; // 전체 물 분자 수
const MR = 3.4; // 분자(산소 원자) 그림 반지름
const COLL_R = 4.2; // 분자끼리 부딪히는 거리의 절반
const COLL_D = COLL_R * 2, COLL_D2 = COLL_D * COLL_D;

// ── 속도 그래프용 '거시적' 계산 값 (상댓값)
const FPS = 60;
const KC = 0.24; // 응축 속도 = KC × (기체 양)
const HIST_MAX = 320; // 그래프에 남겨 두는 점의 개수

// 액체 부분(원의 아랫부분)의 넓이: 수면이 중심에서 s 만큼 아래에 있을 때
function segArea(s) {
  return R * R * (Math.PI / 2) - s * Math.sqrt(R * R - s * s) - R * R * Math.asin(Math.max(-1, Math.min(1, s / R)));
}
const AREA_FULL = segArea(SURFACE_Y0 - cy);

// 액체 분자 수에 맞는 수면 높이 찾기 (넓이가 분자 수에 비례하도록, 반씩 좁혀 가며 찾기)
function targetSurfaceY(liqCount) {
  const At = AREA_FULL * (liqCount / N);
  let lo = -R, hi = R;
  for (let k = 0; k < 26; k++) {
    const mid = (lo + hi) / 2;
    if (segArea(mid) > At) lo = mid; else hi = mid;
  }
  return cy + (lo + hi) / 2;
}

function tempLabel(v) {
  if (v < 20) return '낮음';
  if (v < 40) return '조금 낮음';
  if (v <= 60) return '보통';
  if (v <= 80) return '조금 높음';
  return '높음';
}

// 색은 CSS 변수와 같은 값 (캔버스에서 직접 쓰기 위해 여기에도 적어 둠)
const COL_EVAP = '#fb9f4b', COL_COND = '#5fa8ff';

export default function DynamicEquilibrium() {
  const flaskRef = useRef(null), graphRef = useRef(null);
  const [temp, setTemp] = useState(50); // 온도 슬라이더 (0~100, 상댓값)
  const [running, setRunning] = useState(true);
  const [equilibrium, setEquilibrium] = useState(false);
  const [stats, setStats] = useState({ liq: N, gas: 0, e: 0, c: 0 });
  const ctl = useRef({ tempNorm: 0.5, running: true });
  ctl.current.running = running;
  const api = useRef({});

  useEffect(() => {
    const flask = flaskRef.current, fctx = flask.getContext('2d');
    const graph = graphRef.current, gctx = graph.getContext('2d');

    let molecules = [];
    let surfaceY = SURFACE_Y0;
    let nGas = 0; // 그래프용 기체 양 (거시적 값)
    let evapAcc = 0; // 이번 장면까지 쌓인 '증발해야 할 분자 수'
    let history = [];
    let frame = 0, tHold = 0, eq = false, eqMark = null;

    // 온도가 높을수록 증발이 많고, 기체 분자가 빨라짐
    const evapPerFrame = () => 0.30 * (0.4 + ctl.current.tempNorm * 1.6);
    const gasSpeed = () => 2.4 * (0.9 + ctl.current.tempNorm * 0.4);
    const keMacro = () => evapPerFrame() * FPS; // 증발 속도 (상댓값)

    const setEq = (v) => { eq = v; setEquilibrium(v); };

    // ----- 화면 크기에 맞춰 도화지 크기 조정 (선명하게 보이도록 화소 밀도 반영)
    function fitCanvas(canvas, ctx, ratio) {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || 400;
      const h = w * ratio;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w, h };
    }

    // ----- 액체 안의 아무 위치 하나 고르기
    function randInLiquid() {
      for (let i = 0; i < 200; i++) {
        const x = cx + (Math.random() * 2 - 1) * (R - 6);
        const y = surfaceY + Math.random() * (cy + R - 6 - surfaceY);
        if ((x - cx) ** 2 + (y - cy) ** 2 <= (R - 6) ** 2) return { x, y };
      }
      return { x: cx, y: (surfaceY + cy + R) / 2 };
    }

    // ----- 처음 상태: 모든 분자가 액체
    function init() {
      surfaceY = SURFACE_Y0;
      molecules = [];
      for (let i = 0; i < N; i++) {
        const p = randInLiquid();
        molecules.push({
          x: p.x, y: p.y, vx: (Math.random() * 2 - 1) * 0.7, vy: (Math.random() * 2 - 1) * 0.7, phase: 'liquid',
          angle: Math.random() * Math.PI * 2, spin: (Math.random() * 2 - 1) * 0.05,
        });
      }
      nGas = 0; evapAcc = 0; history = [];
      frame = 0; tHold = 0; eqMark = null;
      setEq(false);
    }

    // ----- 한 장면만큼 시간 진행
    function step() {
      const gs = gasSpeed();
      let liqCount = 0;
      for (const m of molecules) if (m.phase === 'liquid') liqCount++;

      // 액체가 줄면 수면이 천천히 내려감
      surfaceY += (targetSurfaceY(liqCount) - surfaceY) * 0.06;

      // (1) 증발: 수면이 넓을수록 많이 증발. 수면 근처 분자를 골라 위로 튀어나가게 함
      const sOff = surfaceY - cy;
      const areaFactor = Math.sqrt(Math.max(0, R * R - sOff * sOff)) / Math.sqrt(R * R - (SURFACE_Y0 - cy) ** 2);
      evapAcc += evapPerFrame() * areaFactor;
      while (evapAcc >= 1 && liqCount > 30) {
        evapAcc -= 1;
        let best = -1, bestY = Infinity;
        for (let t = 0; t < 24; t++) {
          const idx = (Math.random() * molecules.length) | 0;
          const m = molecules[idx];
          if (m.phase === 'liquid' && m.y < bestY) { best = idx; bestY = m.y; }
        }
        if (best < 0) break;
        const m = molecules[best];
        m.phase = 'gas';
        m.y = surfaceY - 2;
        const ang = -Math.PI / 2 + (Math.random() * 2 - 1) * 0.9;
        m.vx = Math.cos(ang) * gs;
        m.vy = Math.sin(ang) * gs;
        m.spin = (Math.random() * 2 - 1) * 0.13;
        liqCount--;
      }

      // (2) 분자 이동
      for (const m of molecules) {
        m.angle += m.spin;
        m.x += m.vx; m.y += m.vy;
        if (m.phase === 'gas') {
          // 응축: 기체 분자가 수면에 닿으면 액체가 됨
          if (m.y >= surfaceY) {
            m.phase = 'liquid';
            m.y = surfaceY + 2 + Math.random() * 4;
            const maxx = Math.sqrt(Math.max(0, (R - 6) ** 2 - (m.y - cy) ** 2));
            if (Math.abs(m.x - cx) > maxx) m.x = cx + Math.sign(m.x - cx) * maxx;
            m.vx = (Math.random() * 2 - 1) * 0.5;
            m.vy = 0.4 + Math.random() * 0.35;
            m.spin = (Math.random() * 2 - 1) * 0.045;
            continue;
          }
          // 플라스크 벽에 부딪히면 튕겨 나옴
          const dx = m.x - cx, dy = m.y - cy, d = Math.hypot(dx, dy), lim = R - MR;
          if (d > lim) {
            const nx = dx / d, ny = dy / d, dot = m.vx * nx + m.vy * ny;
            m.vx -= 2 * dot * nx; m.vy -= 2 * dot * ny;
            m.x = cx + nx * lim; m.y = cy + ny * lim;
            if (m.y >= surfaceY) { m.y = surfaceY - 2; m.vy = -Math.abs(m.vy); }
          }
        } else {
          // 액체 분자는 수면 아래에서만 움직임
          if (m.y < surfaceY + 1) { m.y = surfaceY + 1; m.vy = Math.abs(m.vy); }
          const dx = m.x - cx, dy = m.y - cy, d = Math.hypot(dx, dy), lim = R - 4;
          if (d > lim) {
            const nx = dx / d, ny = dy / d, dot = m.vx * nx + m.vy * ny;
            m.vx -= 2 * dot * nx; m.vy -= 2 * dot * ny;
            m.x = cx + nx * lim; m.y = cy + ny * lim;
          }
        }
      }

      // (3) 분자끼리 부딪힘
      const gas = [], liq = [];
      for (const m of molecules) (m.phase === 'gas' ? gas : liq).push(m);
      collidePairs(gas, 'gas');
      collidePairs(liq, 'liquid');

      // (4) 그래프용 거시적 변화: 기체 양 변화 = 증발 속도 − 응축 속도
      nGas += (keMacro() - KC * nGas) * (1 / FPS);
      frame++;
    }

    function collidePairs(arr, phase) {
      const n = arr.length;
      for (let i = 0; i < n; i++) {
        const a = arr[i];
        for (let j = i + 1; j < n; j++) {
          const b = arr[j];
          const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
          if (d2 >= COLL_D2 || d2 === 0) continue;
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
          const vrel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (vrel > 0) { // 서로 다가오는 중이면 속도를 맞바꿈
            a.vx -= vrel * nx; a.vy -= vrel * ny;
            b.vx += vrel * nx; b.vy += vrel * ny;
          }
          const overlap = (COLL_D - d) * 0.5; // 겹친 만큼 떼어 놓기
          a.x -= nx * overlap; a.y -= ny * overlap;
          b.x += nx * overlap; b.y += ny * overlap;
          clampMol(a, phase); clampMol(b, phase);
        }
      }
    }
    function clampMol(m, phase) {
      const dx = m.x - cx, dy = m.y - cy, d = Math.hypot(dx, dy);
      if (phase === 'gas') {
        if (m.y > surfaceY - 2) m.y = surfaceY - 2;
        const lim = R - MR; if (d > lim) { m.x = cx + dx / d * lim; m.y = cy + dy / d * lim; }
      } else {
        if (m.y < surfaceY + 1) m.y = surfaceY + 1;
        const lim = R - 4; if (d > lim) { m.x = cx + dx / d * lim; m.y = cy + dy / d * lim; }
      }
    }

    // ----- 평형 판정: 두 속도 차이가 2.5% 미만으로 잠시 유지되면 평형
    function checkEquilibrium(eRate, cRate) {
      if (eRate < 1) return;
      const rel = Math.abs(eRate - cRate) / eRate;
      if (cRate >= eRate * 0.97 && rel < 0.025) {
        tHold++;
        if (tHold > 70 && !eq) { eqMark = history.length; setEq(true); }
      } else if (eq && rel > 0.10) {
        // 온도 변화 등으로 속도 차이가 크게 벌어지면 평형 해제
        eqMark = null; tHold = 0; setEq(false);
      } else if (!eq) {
        tHold = Math.max(0, tHold - 2);
      }
    }

    // ----- 플라스크 그리기
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    // 물 분자: 산소(큰 공) + 수소 2개(작은 공)
    function drawMolecule(x, y, phase, angle) {
      const oCol = phase === 'gas' ? '#7cc4ff' : '#2dd4bf';
      const hCol = phase === 'gas' ? 'rgba(190,225,255,0.9)' : 'rgba(190,255,240,0.85)';
      if (phase === 'gas') { // 기체 분자는 은은한 빛 테두리
        fctx.beginPath(); fctx.arc(x, y, MR + 3, 0, Math.PI * 2);
        fctx.fillStyle = 'rgba(124,196,255,0.12)'; fctx.fill();
      }
      fctx.beginPath(); fctx.arc(x, y, MR, 0, Math.PI * 2);
      fctx.fillStyle = oCol; fctx.fill();
      const hr = MR * 0.55, bond = MR * 1.25;
      for (const a of [-0.92, 0.92]) {
        fctx.beginPath();
        fctx.arc(x + Math.cos(angle + a) * bond, y + Math.sin(angle + a) * bond, hr, 0, Math.PI * 2);
        fctx.fillStyle = hCol; fctx.fill();
      }
    }

    function drawFlask() {
      const { w } = fitCanvas(flask, fctx, FH / FW);
      const s = w / FW;
      fctx.save();
      fctx.scale(s, s);
      fctx.clearRect(0, 0, FW, FH);

      // 플라스크 안쪽 (둥근 모양으로 잘라서 그림)
      fctx.save();
      fctx.beginPath(); fctx.arc(cx, cy, R, 0, Math.PI * 2); fctx.clip();
      const gg = fctx.createLinearGradient(0, cy - R, 0, cy + R);
      gg.addColorStop(0, 'rgba(120,170,230,0.05)');
      gg.addColorStop(1, 'rgba(80,120,180,0.12)');
      fctx.fillStyle = gg; fctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      // 액체 부분과 수면 선
      fctx.fillStyle = 'rgba(45,212,191,0.10)';
      fctx.fillRect(cx - R, surfaceY, R * 2, (cy + R) - surfaceY);
      fctx.beginPath(); fctx.moveTo(cx - R, surfaceY); fctx.lineTo(cx + R, surfaceY);
      fctx.strokeStyle = 'rgba(45,212,191,0.55)'; fctx.lineWidth = 1.4; fctx.stroke();
      for (const m of molecules) drawMolecule(m.x, m.y, m.phase, m.angle);
      fctx.restore();

      // 플라스크 목
      const neckBottom = cy - Math.sqrt(Math.max(0, R * R - NECK_HALF * NECK_HALF)) + 6;
      fctx.beginPath();
      fctx.moveTo(cx - NECK_HALF, NECK_TOP); fctx.lineTo(cx - NECK_HALF, neckBottom);
      fctx.moveTo(cx + NECK_HALF, NECK_TOP); fctx.lineTo(cx + NECK_HALF, neckBottom);
      fctx.strokeStyle = 'rgba(207,230,255,0.55)'; fctx.lineWidth = 2.2; fctx.lineCap = 'round'; fctx.stroke();
      // 플라스크 몸통 테두리
      fctx.beginPath(); fctx.arc(cx, cy, R, 0, Math.PI * 2);
      fctx.strokeStyle = 'rgba(207,230,255,0.55)'; fctx.lineWidth = 2.2; fctx.stroke();
      // 유리 반사광
      fctx.beginPath(); fctx.arc(cx, cy, R - 6, Math.PI * 0.95, Math.PI * 1.28);
      fctx.strokeStyle = 'rgba(255,255,255,0.20)'; fctx.lineWidth = 4; fctx.lineCap = 'round'; fctx.stroke();
      // 마개 (밀폐 용기)
      fctx.fillStyle = '#3a4a66';
      roundRect(fctx, cx - NECK_HALF - 4, NECK_TOP - 18, (NECK_HALF + 4) * 2, 24, 6); fctx.fill();
      fctx.fillStyle = '#4a5d80';
      roundRect(fctx, cx - NECK_HALF - 10, NECK_TOP - 24, (NECK_HALF + 10) * 2, 12, 5); fctx.fill();
      fctx.restore();
    }

    // ----- 속도 그래프 그리기
    function drawGraph() {
      const { w, h } = fitCanvas(graph, gctx, 240 / 560);
      gctx.clearRect(0, 0, w, h);
      const padL = 10, padR = 10, padT = 14, padB = 22;
      const gw = w - padL - padR, gh = h - padT - padB;

      let ymax = 6;
      for (const p of history) ymax = Math.max(ymax, p.e, p.c);
      ymax *= 1.18;

      // 눈금선과 눈금 숫자
      gctx.strokeStyle = 'rgba(255,255,255,0.06)'; gctx.lineWidth = 1;
      gctx.font = '10px Pretendard, "Noto Sans KR", sans-serif';
      gctx.fillStyle = 'rgba(159,176,204,0.6)';
      gctx.textAlign = 'right'; gctx.textBaseline = 'middle';
      for (let i = 0; i <= 4; i++) {
        const yy = padT + gh * (i / 4);
        gctx.beginPath(); gctx.moveTo(padL, yy); gctx.lineTo(w - padR, yy); gctx.stroke();
        gctx.fillText(Math.round(ymax * (1 - i / 4)), padL * 2 - 2, yy);
      }
      gctx.textAlign = 'center'; gctx.textBaseline = 'bottom';
      gctx.fillText('시간 →', w / 2, h - 3);

      if (history.length < 2) return;
      const xAt = (i) => padL + gw * (i / (HIST_MAX - 1));
      const yAt = (v) => padT + gh * (1 - Math.min(v, ymax) / ymax);

      // 평형에 도달한 뒤 구간 표시
      if (eq && eqMark != null) {
        const ex = xAt(eqMark);
        const grad = gctx.createLinearGradient(ex, 0, w - padR, 0);
        grad.addColorStop(0, 'rgba(74,222,128,0.0)');
        grad.addColorStop(1, 'rgba(74,222,128,0.10)');
        gctx.fillStyle = grad; gctx.fillRect(ex, padT, (w - padR) - ex, gh);
        gctx.strokeStyle = 'rgba(74,222,128,0.6)'; gctx.setLineDash([4, 4]); gctx.lineWidth = 1.3;
        gctx.beginPath(); gctx.moveTo(ex, padT); gctx.lineTo(ex, padT + gh); gctx.stroke();
        gctx.setLineDash([]);
        gctx.fillStyle = 'rgba(74,222,128,0.95)';
        gctx.font = '600 11px Pretendard, "Noto Sans KR", sans-serif';
        gctx.textAlign = ex > w * 0.6 ? 'right' : 'left'; gctx.textBaseline = 'top';
        gctx.fillText('동적 평형', ex + (ex > w * 0.6 ? -6 : 6), padT + 2);
      }

      const plotLine = (key, color) => {
        gctx.beginPath();
        history.forEach((p, i) => { const x = xAt(i), y = yAt(p[key]); if (i === 0) gctx.moveTo(x, y); else gctx.lineTo(x, y); });
        gctx.strokeStyle = color; gctx.lineWidth = 2.4; gctx.lineJoin = 'round'; gctx.lineCap = 'round';
        gctx.stroke();
      };
      plotLine('c', COL_COND);
      plotLine('e', COL_EVAP);
    }

    // ----- 반복 (계산 → 판정 → 기록 → 그리기)
    let raf, lastStats = 0;
    function loop(now) {
      const run = ctl.current.running;
      if (run) step();
      const eRate = keMacro(); // 증발 속도
      const cRate = KC * nGas; // 응축 속도
      if (run) {
        checkEquilibrium(eRate, cRate);
        if (frame % 3 === 0) {
          history.push({ e: eRate, c: cRate });
          if (history.length > HIST_MAX) history.shift();
        }
      }
      drawFlask();
      drawGraph();
      if (now - lastStats > 100) { // 숫자 표시는 0.1초마다 갱신
        lastStats = now;
        let gasN = 0;
        for (const m of molecules) if (m.phase === 'gas') gasN++;
        setStats({ liq: molecules.length - gasN, gas: gasN, e: eRate, c: cRate });
      }
      raf = requestAnimationFrame(loop);
    }

    api.current = {
      reset: init,
      // 온도를 바꾸면 평형을 풀고 새 평형을 다시 찾아감
      changeTemp: () => { if (eq) { eqMark = null; tHold = 0; setEq(false); } },
    };

    init();
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onTemp = (v) => {
    setTemp(v);
    ctl.current.tempNorm = v / 100;
    api.current.changeTemp();
  };
  const reset = () => { api.current.reset(); setRunning(true); };

  const barScale = Math.max(8, stats.e * 1.25);

  return (
    <div className="dynsim">
      <div className="stage">
        {/* 미시 세계: 플라스크 */}
        <div className="dyn-card flask-card">
          <canvas ref={flaskRef} className="dyn-flask" />
          <div className="dyn-legend">
            <span><i className="dyn-dot liquid" /> 액체 물 분자</span>
            <span><i className="dyn-dot gas" /> 기체 수증기 분자</span>
          </div>
        </div>

        {/* 거시 세계: 숫자와 그래프 */}
        <div className="side">
          <div className={`status${equilibrium ? ' eq' : ''}`}>
            <span className="status-label">평형 상태</span>
            <span className="badge">{equilibrium ? '동적 평형 도달' : '평형 도달 중...'}</span>
          </div>

          <div className="counts">
            <div className="count-box liq">
              <div className="k"><span className="dyn-dot liquid" />액체 분자 수</div>
              <div className="v">{stats.liq}</div>
            </div>
            <div className="count-box gas">
              <div className="k"><span className="dyn-dot gas" />기체 분자 수</div>
              <div className="v">{stats.gas}</div>
            </div>
          </div>

          <div className="dyn-card rates">
            <div className="rate-row">
              <div className="top">
                <span className="name" style={{ color: 'var(--evap)' }}>증발 속도 <small>정반응 (액체→기체)</small></span>
                <span className="val">{stats.e.toFixed(1)} (상댓값)</span>
              </div>
              <div className="bar evap"><i style={{ width: `${Math.min(100, (stats.e / barScale) * 100)}%` }} /></div>
            </div>
            <div className="rate-row">
              <div className="top">
                <span className="name" style={{ color: 'var(--cond)' }}>응축 속도 <small>역반응 (기체→액체)</small></span>
                <span className="val">{stats.c.toFixed(1)} (상댓값)</span>
              </div>
              <div className="bar cond"><i style={{ width: `${Math.min(100, (stats.c / barScale) * 100)}%` }} /></div>
            </div>
          </div>

          <div className="dyn-card graph-card">
            <div className="ghead">
              <h2>시간에 따른 반응 속도 <span className="sub">· 몰 단위 거시 변화</span></h2>
              <div className="glegend">
                <span><i className="line evap" />증발</span>
                <span><i className="line cond" />응축</span>
              </div>
            </div>
            <canvas ref={graphRef} className="graph" />
            <p className="gnote">증발 속도와 응축 속도가 완전히 일치하여 겹치는 지점이 동적 평형 구간입니다.</p>
          </div>

          <div className="controls dyn-card">
            <button type="button" className="primary" onClick={() => setRunning((r) => !r)}>{running ? '일시정지' : '재생'}</button>
            <button type="button" onClick={reset}>초기화</button>
            <div className="temp">
              <label htmlFor="dyn-temp">온도</label>
              <input type="range" id="dyn-temp" min="0" max="100" value={temp} onChange={(e) => onTemp(+e.target.value)} />
              <output>{tempLabel(temp)}</output>
            </div>
          </div>

          <p className="dyn-note">
            {equilibrium ? (
              <>증발 속도 = 응축 속도. <span className="eqtext">동적 평형</span>입니다. 기체·액체 분자 수는 일정하게 유지되지만, 분자들은 여전히 증발과 응축을 <b>같은 속도로 계속</b>하고 있습니다. 겉보기엔 멈춘 듯 보여도 미시 세계는 멈추지 않습니다.</>
            ) : (
              <>처음에는 기체 분자가 거의 없어 <b>응축이 거의 일어나지 않습니다</b>. 증발이 진행될수록 기체 분자가 늘어 응축 속도가 커지고, 마침내 두 속도가 같아지는 <b>동적 평형</b>에 도달합니다. 온도를 바꾸면 새로운 동적 평형을 찾아갑니다.</>
            )}
          </p>
        </div>
      </div>

      <ScaleNote items={[
        '정성적 시뮬레이션: 증발·응축 속도와 분자 수는 모두 상댓값이며 실제 측정값이 아님',
        '물 분자 220개만 그림 (실제 물 1 g 에는 약 3.3×10²² 개)',
        '온도는 낮음~높음 5단계 상댓값 — 온도가 높을수록 증발 속도가 커지고 기체 분자가 빨라지도록 화면용으로 정함',
        '속도 그래프: 증발 속도는 온도로만 정해지고, 응축 속도 = 0.24 × (기체 양)으로 계산한 거시적 변화 (분자 그림과 별도 계산)',
        '평형 판정: 두 속도 차이가 2.5% 미만으로 일정 시간 유지될 때',
        '실제 물의 증기압(CRC 6-5) 값은 "증기 압력과 끓는점" 시뮬레이션에서 확인',
      ]} />
    </div>
  );
}
