import { useEffect, useRef, useState } from 'react';
import { Select, Slider, SimLayout, ScaleNote, Readout, useAnimationFrame, sci } from './common.jsx';
import { SOLUTES, NA, molarMass } from '../data/crc.js';

/* =========================================================
   부피 플라스크로 몰 농도 용액 만들기
   실험 순서: 계산 → 질량 측정 → 비커에서 녹이기 → 플라스크로 옮기기
             → 비커·유리 막대 헹구기 → 표선 맞추기 → 마개 막고 섞기 → 결과
   - 몰질량은 CRC 원자량(1-11)으로 계산, 녹는 양의 한계는 CRC 용해도(4-62, 4-89, 5-172)
   - 학생이 실제로 단 질량, 플라스크에 옮겨진 양, 표선까지 채운 부피로 실제 몰 농도를 계산
   - 헹구지 않거나 표선을 넘기면 그만큼 농도가 달라지는 것을 결과에서 확인
   ========================================================= */

// ── 실험 기구 (CRC 값이 아닌 가정 — 화면 축척 상자에 적음)
const FLASKS = {
  50: { neck: 1.1, tol: 0.05, beaker: 100 }, // 목 안지름 (cm), A급 허용 오차 (mL), 함께 쓰는 비커 (mL)
  100: { neck: 1.3, tol: 0.08, beaker: 100 },
  250: { neck: 1.5, tol: 0.12, beaker: 250 },
};
const BOAT_MASS = 1.83; // 칭량 접시 질량 (g)
const DROP = 0.05; // 스포이트 한 방울 (mL)
const FILM = 1.0; // 용액을 부은 뒤 비커 벽·유리 막대에 남는 용액 (mL)
const SCOOP = { big: 2, mid: 0.2, small: 0.02 }; // 약숟가락으로 한 번에 옮기는 양 (g, ±40 % 무작위)
const MIX_PER_INVERT = 0.7; // 한 번 뒤집을 때마다 덜 섞인 정도가 이만큼으로 줄어듦
const hydrateMass = (s) => molarMass(s.formula) + s.hydrate * molarMass('H2O');

const STEPS = ['필요한 질량 계산', '질량 측정', '비커에서 녹이기', '플라스크로 옮기기', '비커·유리 막대 헹구기', '표선 맞추기', '마개 막고 섞기', '결과 확인'];

// 입자 색 (점 1개 = 화학식 단위 하나를 나타내는 양)
const PARTICLES = {
  NaCl: [['Na⁺', '#9b51e0', 2.4], ['Cl⁻', '#27ae60', 3.3]],
  CuSO4: [['Cu²⁺', '#1f6fd6', 2.6], ['SO₄²⁻', '#f2994a', 3.4]],
  glucose: [['C₆H₁₂O₆', '#eb5757', 3.2]],
};

// ── 부피 플라스크 그림 (모든 크기를 같은 모양으로 그림)
const FX = 620, CY = 374, RX = 72, RY = 62, NECK_HW = 11;
const BASE_Y = 430, TOP_Y = 150, MARK_Y = 205;
const hw = (y) => Math.max(NECK_HW, RX * Math.sqrt(Math.max(0, 1 - ((y - CY) / RY) ** 2)));
// 바닥부터 높이 y 까지 들어 있는 부피 (화면 단위)
const VS = (() => {
  const t = [];
  let v = 0;
  for (let y = BASE_Y; y >= TOP_Y; y -= 0.25) { t.push([y, v]); v += Math.PI * hw(y) ** 2 * 0.25; }
  return t;
})();
const V_MARK = VS.find(([y]) => y <= MARK_Y)[1];
const V_TOP = VS[VS.length - 1][1];
function yForVs(v) { // 부피 → 액면 높이
  let lo = 0, hi = VS.length - 1;
  if (v <= 0) return BASE_Y;
  if (v >= VS[hi][1]) return TOP_Y;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (VS[m][1] < v) lo = m; else hi = m; }
  const [y0, v0] = VS[lo], [y1, v1] = VS[hi];
  return y0 + ((y1 - y0) * (v - v0)) / (v1 - v0);
}
const flaskOutline = (() => {
  const L = [], R = [];
  for (let y = BASE_Y; y >= TOP_Y; y -= 2) { L.push(`${FX - hw(y) - 2},${y}`); R.unshift(`${FX + hw(y) + 2},${y}`); }
  return `M${L.join(' L')} L${R.join(' L')} Z`;
})();
function liquidPath(levelY) {
  const L = [], R = [];
  for (let y = BASE_Y; y > levelY; y -= 2) { L.push(`${FX - hw(y)},${y}`); R.unshift(`${FX + hw(y)},${y}`); }
  L.push(`${FX - hw(levelY)},${levelY}`); R.unshift(`${FX + hw(levelY)},${levelY}`);
  return `M${L.join(' L')} L${R.join(' L')} Z`;
}

// ── 비커 그림 (왼쪽 위 모서리 기준이 아니라 오른쪽 위 '입구' 기준)
const BK = { x: 452, y: 318, w: 80, h: 110 };

// 점 위치 씨앗
const SEEDS = Array.from({ length: 600 }, () => ({ u: Math.random(), s: Math.random() * 2 - 1, p: Math.random() * 6.28, f: 0.6 + Math.random() }));
const niceStep = (x) => { const p = 10 ** Math.floor(Math.log10(x)); const m = x / p; return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p; };
const rnd = (a) => a * (0.6 + Math.random() * 0.8);
const fmt = (x, d = 2) => x.toFixed(d);

function newLab() {
  return {
    step: 0, answer: '', answerOk: null, showSolution: false,
    boatOn: false, tare: 0, tared: false, boatSolid: 0, recorded: null, massTrue: 0,
    beakerSolid: 0, beakerDis: 0, beakerWater: 0,
    funnelOn: false, flaskSolute: 0, flaskVol: 0, concVol: 0, pours: 0, rinses: 0,
    stopper: false, inversions: 0, mix: 0, maxOver: 0,
    anim: null, msg: '', time: 0,
  };
}

export default function Molarity() {
  const [soluteId, setSoluteId] = useState('CuSO4');
  const [flaskV, setFlaskV] = useState(100);
  const [target, setTarget] = useState(0.1);
  const [scoop, setScoop] = useState('mid');
  const lab = useRef(newLab());
  const hold = useRef(null);
  const [, setFrame] = useState(0);
  const redraw = () => setFrame((f) => f + 1);
  const L = lab.current;

  const sol = SOLUTES.find((s) => s.id === soluteId);
  const M = hydrateMass(sol);
  const fAnh = molarMass(sol.formula) / M; // 수화물 질량 중 무수물 비율
  const fk = FLASKS[flaskV];
  const nTarget = (target * flaskV) / 1000;
  const mNeed = nTarget * M;
  const molPerDot = niceStep(nTarget / 40);
  const kV = flaskV / V_MARK; // 화면 부피 → mL
  const neckArea = Math.PI * (fk.neck / 2) ** 2; // cm² = mL/cm

  const reading = (L.boatOn ? BOAT_MASS + L.boatSolid : 0) - L.tare;
  const beakerVol = L.beakerWater + L.beakerDis / sol.density;
  const beakerConc = beakerVol > 0 ? L.beakerDis / M / (beakerVol / 1000) : 0;
  const flaskConc = L.flaskVol > 0 ? L.flaskSolute / M / (L.flaskVol / 1000) : 0;

  // 지금 물의 양으로 녹일 수 있는 최대 질량 (수화물의 결정수는 녹으면 용매가 됨)
  const maxDissolve = (water) => {
    const s = sol.sol / 100;
    return (s * water) / (fAnh - s * (1 - fAnh));
  };

  const setMsg = (m) => { L.msg = m; redraw(); };
  const reset = () => { lab.current = newLab(); hold.current = null; redraw(); };
  const changeSetting = (fn) => { fn(); lab.current = newLab(); redraw(); };
  const randomTask = () => {
    const s = SOLUTES[Math.floor(Math.random() * SOLUTES.length)];
    const v = [50, 100, 250][Math.floor(Math.random() * 3)];
    changeSetting(() => { setSoluteId(s.id); setFlaskV(v); setTarget(Math.round(5 + Math.random() * 45) / 100); });
  };

  // ───────── 실험 동작
  const act = {
    checkAnswer() {
      const a = Number(L.answer);
      L.answerOk = Math.abs(a - mNeed) / mNeed <= 0.01;
      L.msg = L.answerOk ? '정답입니다! 이제 이 질량만큼 용질을 달아 봅시다.' : '다시 계산해 보세요. (몰 → 질량)';
      redraw();
    },
    boat() {
      if (L.step === 1 && !L.boatOn) { L.boatOn = true; L.tared = false; return setMsg('칭량 접시를 올렸습니다. 접시 질량을 빼려면 영점(TARE)을 누르세요.'); }
      if (L.step === 2 && L.boatSolid > 0) {
        L.anim = { kind: 'toBeaker', t: 0, dur: 0.9 };
        return setMsg('');
      }
    },
    tareBtn() {
      if (L.step !== 1) return;
      if (L.boatSolid > 0) return setMsg('용질을 넣은 뒤에 영점을 누르면 용질의 질량이 0 으로 지워집니다. 영점은 빈 접시를 올리고 누르세요.');
      L.tare = L.boatOn ? BOAT_MASS : 0;
      L.tared = L.boatOn;
      setMsg(L.boatOn ? '영점을 맞췄습니다. 이제 약숟가락으로 용질을 덜어 넣으세요.' : '저울을 영점으로 맞췄습니다. 칭량 접시를 올리세요.');
    },
    spatula(sign = 1) {
      if (L.step !== 1) return;
      if (!L.boatOn) return setMsg('먼저 칭량 접시를 저울에 올리세요.');
      if (!L.tared) return setMsg('접시를 올린 뒤 영점(TARE)을 맞춰야 용질의 질량만 읽을 수 있습니다.');
      const d = rnd(SCOOP[scoop]);
      L.boatSolid = Math.max(0, L.boatSolid + sign * d);
      L.anim = { kind: 'scoop', t: 0, dur: 0.5 };
      setMsg('');
    },
    record() {
      L.recorded = Math.round(reading * 100) / 100;
      L.massTrue = L.boatSolid;
      L.step = 2;
      setMsg(`${fmt(L.recorded)} g 을 기록했습니다. 용질을 비커에 옮기세요.`);
    },
    funnel() {
      if (L.step === 3 && !L.funnelOn) { L.funnelOn = true; return setMsg('깔때기를 플라스크에 꽂았습니다. 비커의 용액을 부으세요.'); }
      if (L.step === 5 && L.funnelOn) { L.funnelOn = false; return setMsg('깔때기를 뺐습니다. 세척병으로 표선 조금 아래까지 물을 채우세요.'); }
    },
    pour() {
      if (L.step !== 3 && L.step !== 4) return;
      if (!L.funnelOn) return setMsg('깔때기 없이 부으면 용액이 흘러 넘칩니다. 깔때기를 먼저 꽂으세요.');
      if (beakerVol <= FILM + 0.01) return setMsg(L.step === 4 ? '세척병으로 비커에 물을 조금 넣어 헹군 뒤 부으세요.' : '비커가 비어 있습니다.');
      L.anim = { kind: 'pour', t: 0, dur: 1.4, vol: beakerVol - FILM };
      setMsg('');
    },
    dropper() {
      if (L.step !== 5) return;
      if (L.funnelOn) return setMsg('표선을 맞추기 전에 깔때기를 빼세요. (깔때기 속 물이 나중에 흘러들어 부피가 달라집니다)');
      L.flaskVol = Math.min(V_TOP * kV, L.flaskVol + DROP);
      L.anim = { kind: 'drop', t: 0, dur: 0.45 };
      setMsg('');
    },
    stopper() {
      if (L.step === 6 && !L.stopper) { L.stopper = true; setMsg('마개를 막았습니다. 플라스크를 눌러 뒤집어 섞으세요.'); }
    },
    invert() {
      if (L.step !== 6) return;
      if (!L.stopper) return setMsg('마개를 막지 않고 뒤집으면 용액이 쏟아집니다.');
      if (L.anim) return;
      L.anim = { kind: 'invert', t: 0, dur: 0.9 };
    },
    next() {
      if (L.step === 4) { L.step = 5; return setMsg('깔때기를 빼고, 세척병으로 표선 1~2 cm 아래까지 채운 뒤 스포이트로 맞추세요.'); }
      if (L.step === 5) { L.step = 6; return setMsg('마개를 막으세요.'); }
      L.step += 1; L.msg = ''; redraw();
    },
  };

  // 누르고 있는 동안 계속되는 동작: 세척병, 유리 막대
  const startHold = (kind) => (e) => {
    e.preventDefault();
    if (kind === 'wash') {
      if (![2, 4, 5].includes(L.step)) return;
      if (L.step === 5 && L.funnelOn) return setMsg('표선을 맞추기 전에 깔때기를 빼세요.');
      if (L.step === 2 && L.beakerSolid + L.beakerDis === 0) return setMsg('먼저 용질을 비커에 옮기세요.');
    }
    if (kind === 'stir' && L.step !== 2) return;
    hold.current = kind;
    redraw();
  };
  useEffect(() => {
    const stop = () => { hold.current = null; };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => { window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
  }, []);

  // ───────── 매 프레임
  useAnimationFrame((dt) => {
    const s = lab.current;
    s.time += dt;
    const h = hold.current;
    if (h === 'wash') {
      const rate = flaskV / 25; // mL/s
      if (s.step === 5) s.flaskVol = Math.min(V_TOP * kV, s.flaskVol + rate * dt);
      else {
        const add = Math.min(rate * dt, fk.beaker - (s.beakerWater + s.beakerDis / sol.density));
        if (add > 0) s.beakerWater += add;
      }
    }
    // 녹기: 저으면 빠르게, 가만히 두면 천천히. 녹을 수 있는 양(용해도)을 넘지 못함
    if (s.beakerSolid > 0 && s.beakerWater > 0) {
      const room = Math.max(0, maxDissolve(s.beakerWater) - s.beakerDis);
      const rate = (h === 'stir' ? 0.35 : 0.01) * mNeed; // g/s (저으면 약 3초면 다 녹음)
      const d = Math.min(room, s.beakerSolid, rate * dt);
      s.beakerSolid -= d; s.beakerDis += d;
      if (s.beakerSolid < 1e-6) s.beakerSolid = 0;
    }
    // 처음 부은 진한 용액이 마개 막기 전에 조금씩 퍼짐 (확산은 아주 느림)
    const a = s.anim;
    if (a) {
      const prev = a.t;
      a.t = Math.min(a.dur, a.t + dt);
      if (a.kind === 'pour') {
        const frac = (a.t - prev) / a.dur; // 이번 프레임에 옮길 비율 (처음 부피 기준)
        const bVol = s.beakerWater + s.beakerDis / sol.density;
        const vMove = Math.min(a.vol * frac, Math.max(0, bVol - FILM));
        const share = bVol > 0 ? vMove / bVol : 0;
        const dSol = s.beakerDis * share;
        s.beakerDis -= dSol; s.beakerWater -= s.beakerWater * share;
        s.flaskSolute += dSol; s.flaskVol += vMove; s.concVol += vMove;
      }
      if (a.t >= a.dur) {
        if (a.kind === 'toBeaker') { s.beakerSolid += s.boatSolid; s.boatSolid = 0; s.msg = '용질을 비커에 옮겼습니다. 세척병을 눌러 물을 조금 넣고, 유리 막대를 눌러 저으세요.'; }
        if (a.kind === 'pour') {
          s.pours += 1;
          if (s.step === 4) s.rinses += 1;
          s.msg = s.step === 3 ? '용액을 옮겼습니다. 비커와 유리 막대에 아직 용액이 묻어 있어요.' : `${s.rinses}번째 헹군 물을 옮겼습니다.`;
          if (s.step === 3) s.step = 4;
        }
        if (a.kind === 'invert') { s.inversions += 1; s.mix = 1 - MIX_PER_INVERT ** s.inversions; }
        s.anim = null;
      }
    }
    if (s.flaskVol - flaskV > s.maxOver) s.maxOver = s.flaskVol - flaskV;
    redraw();
  }, true);

  // ───────── 그림 계산
  const t = L.time;
  const ions = PARTICLES[sol.id];
  const conc2alpha = (c) => (sol.id === 'CuSO4' ? Math.min(0.85, 0.12 + c * 1.3) : 0);
  const solnFill = (c) => (sol.id === 'CuSO4' ? `rgba(31,111,214,${conc2alpha(c)})` : 'rgba(150,195,255,0.35)');
  const waterFill = 'rgba(150,195,255,0.35)';

  const levelY = yForVs(L.flaskVol / kV);
  const mixedVol = L.concVol + (L.flaskVol - L.concVol) * L.mix; // 용질이 퍼져 있는 부피
  // 용질이 퍼져 있는 부분의 높이 비율 (그라데이션 경계)
  const mixFrac = L.flaskVol > 0 ? Math.min(1, (BASE_Y - yForVs(mixedVol / kV)) / Math.max(1, BASE_Y - levelY)) : 1;
  const nFlaskDots = Math.round(L.flaskSolute / M / molPerDot);
  const nBeakerDots = Math.round(L.beakerDis / M / molPerDot);

  const dotsIn = (count, start, place) => {
    const out = [];
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < ions.length; j++) {
        const sd = SEEDS[(start + i * ions.length + j) % SEEDS.length];
        const jx = Math.sin(t * 2.3 * sd.f + sd.p) * 1.6, jy = Math.cos(t * 1.9 * sd.f + sd.p * 1.3) * 1.6;
        const pos = place(sd);
        if (!pos) continue;
        const [, col, r] = ions[j];
        out.push(<circle key={`${start}-${i}-${j}`} cx={pos[0] + jx} cy={pos[1] + jy} r={r} fill={col} stroke="#fff" strokeWidth="0.6" />);
      }
    }
    return out;
  };

  const bkLevel = BK.y + BK.h - 4 - (beakerVol / fk.beaker) * (BK.h - 16);
  const pouring = L.anim?.kind === 'pour';
  const inverting = L.anim?.kind === 'invert';
  const invAngle = inverting ? 180 * Math.sin(Math.PI * (L.anim.t / L.anim.dur)) : 0;
  const washing = hold.current === 'wash';
  const stirring = hold.current === 'stir';
  const hot = (name) => {
    const st = L.step;
    const map = {
      boat: (st === 1 && !L.boatOn) || (st === 2 && L.boatSolid > 0),
      tare: st === 1 && L.boatOn && !L.tared,
      bottle: st === 1 && L.tared,
      wash: (st === 2 && L.beakerSolid + L.beakerDis > 0) || st === 4 || (st === 5 && !L.funnelOn),
      rod: st === 2 && L.beakerSolid > 0 && L.beakerWater > 0,
      funnel: (st === 3 && !L.funnelOn) || (st === 5 && L.funnelOn),
      beaker: (st === 3 && L.funnelOn) || (st === 4 && beakerVol > FILM + 0.01),
      dropper: st === 5 && !L.funnelOn,
      stopper: st === 6 && !L.stopper,
      flask: st === 6 && L.stopper,
    };
    return map[name] ? 'mol-tool hot' : 'mol-tool';
  };

  // 확대창: 표선 근처 목 (실제 목 안지름 기준, 1 mm = 5 px)
  const showZoom = L.step >= 5 && L.flaskVol > flaskV * 0.85;
  const overMm = ((L.flaskVol - flaskV) / neckArea) * 10; // 표선보다 위(+) 아래(−) mm
  const ZX = 752, ZY = 120, ZR = 58, PXMM = 5, ZW = fk.neck * 10 * PXMM / 2;
  const zLevel = ZY - overMm * PXMM;

  // 결과
  const nFlask = L.flaskSolute / M;
  const cReal = L.flaskVol > 0 ? nFlask / (L.flaskVol / 1000) : 0;
  const cLabel = L.recorded ? L.recorded / M / (flaskV / 1000) : 0;
  const massTrue = L.massTrue;
  const lossPct = massTrue > 0 ? ((massTrue - L.flaskSolute) / massTrue) * 100 : 0;
  const volErr = L.flaskVol - flaskV;
  const errPct = ((cReal - target) / target) * 100;

  const stepHelp = [
    `${sol.ko}(${sol.label}) ${target.toFixed(2)} M 용액 ${flaskV} mL 를 만들려면 용질이 몇 g 필요할까요?`,
    `저울에 칭량 접시를 올리고 → 영점(TARE) → 시약병을 눌러 약숟가락으로 덜어 넣으세요. 목표 ${fmt(mNeed, 2)} g 에 최대한 가깝게!`,
    '접시를 눌러 용질을 비커에 옮기고, 세척병(누르고 있기)으로 물을 조금 넣은 뒤 유리 막대(누르고 있기)로 저어 다 녹이세요.',
    '깔때기를 플라스크에 꽂고, 비커를 눌러 용액을 부으세요.',
    '비커와 유리 막대에 묻은 용액도 옮겨야 합니다. 세척병으로 비커에 물을 조금(약 5~10 mL) 넣고 비커를 눌러 붓기를 2~3번 반복하세요.',
    '깔때기를 빼고, 세척병으로 표선 아래까지 채운 뒤 스포이트로 한 방울씩 넣어 메니스커스 아랫면을 표선에 맞추세요.',
    '마개를 막고 플라스크를 여러 번 뒤집어 용액을 고르게 섞으세요. (10번 정도)',
    '만든 용액의 실제 몰 농도를 확인하세요.',
  ][L.step];

  const canvas = (
    <svg viewBox="0 0 820 470" className="mol-bench" onContextMenu={(e) => e.preventDefault()}>
      <defs>
        <linearGradient id="molGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={solnFill(L.concVol > 0 ? L.flaskSolute / M / (Math.max(mixedVol, 1) / 1000) : 0)} />
          <stop offset={mixFrac} stopColor={solnFill(L.concVol > 0 ? L.flaskSolute / M / (Math.max(mixedVol, 1) / 1000) : 0)} />
          <stop offset={Math.min(1, mixFrac + 0.08)} stopColor={waterFill} />
          <stop offset="1" stopColor={waterFill} />
        </linearGradient>
        <clipPath id="molZoom"><circle cx={ZX} cy={ZY} r={ZR} /></clipPath>
        <clipPath id="molBeaker"><rect x={-BK.w + 3} y="0" width={BK.w - 6} height={BK.h - 3} /></clipPath>
      </defs>
      <rect x="0" y="430" width="820" height="40" fill="#e9e1d3" />
      <rect x="0" y="428" width="820" height="3" fill="#cdbfa6" />

      {/* 시약병 */}
      <g className={hot('bottle')} onClick={() => act.spatula(1)}>
        <rect x="28" y="318" width="70" height="110" rx="10" fill="#f6f2ea" stroke="#8a8f99" strokeWidth="2" />
        <rect x="42" y="300" width="42" height="20" fill="#e6e1d7" stroke="#8a8f99" strokeWidth="2" />
        <rect x="34" y="350" width="58" height="44" fill="#fff" stroke="#c9ccd3" />
        <text x="63" y="368" textAnchor="middle" className="mol-lbl">{sol.label}</text>
        <text x="63" y="384" textAnchor="middle" className="mol-sub">{fmt(M, 2)} g/mol</text>
        <path d="M36 420 q27 -16 54 0 z" fill={sol.id === 'CuSO4' ? '#2d7fe0' : '#fbfbfb'} stroke="#ccc" />
      </g>
      {/* 약숟가락 움직임 */}
      {L.anim?.kind === 'scoop' && (() => {
        const p = L.anim.t / L.anim.dur;
        const x = 70 + p * 135, y = 300 - Math.sin(p * Math.PI) * 50;
        return <g><line x1={x - 40} y1={y - 18} x2={x} y2={y} stroke="#777" strokeWidth="3" /><ellipse cx={x + 4} cy={y + 1} rx="7" ry="3.5" fill={sol.id === 'CuSO4' ? '#2d7fe0' : '#eee'} stroke="#777" /></g>;
      })()}

      {/* 전자저울 */}
      <g>
        <rect x="118" y="380" width="176" height="48" rx="6" fill="#d9dde4" stroke="#7b8494" strokeWidth="2" />
        <rect x="150" y="372" width="112" height="8" rx="2" fill="#aeb5c0" stroke="#7b8494" />
        <rect x="132" y="392" width="100" height="26" rx="3" fill="#1d2b22" />
        <text x="226" y="411" textAnchor="end" className="mol-lcd">{reading.toFixed(2)} g</text>
        <g className={hot('tare')} onClick={act.tareBtn}>
          <rect x="240" y="393" width="44" height="24" rx="4" fill="#4a5568" />
          <text x="262" y="409" textAnchor="middle" className="mol-btn-t">TARE</text>
        </g>
      </g>
      {/* 칭량 접시 */}
      {(() => {
        const toB = L.anim?.kind === 'toBeaker' ? L.anim.t / L.anim.dur : 0;
        const onBal = L.boatOn;
        const bx = onBal ? 206 + toB * (BK.x - BK.w / 2 - 206) : 336;
        const by = onBal ? 364 - Math.sin(toB * Math.PI) * 90 - (toB > 0 ? toB * 40 : 0) : 420;
        const pile = Math.sqrt(L.boatSolid / Math.max(mNeed, 0.01));
        return (
          <g className={hot('boat')} onClick={act.boat} transform={`translate(${bx} ${by}) rotate(${toB > 0.5 ? (toB - 0.5) * 120 : 0})`}>
            <path d="M-30 -8 h60 l-8 10 h-44 z" fill="#f4f4f4" stroke="#8a8f99" strokeWidth="1.5" />
            {L.boatSolid > 0 && <path d={`M${-16 * Math.min(1.4, pile)} -8 q${16 * Math.min(1.4, pile)} ${-14 * Math.min(1.5, pile) - 2} ${32 * Math.min(1.4, pile)} 0 z`} fill={sol.id === 'CuSO4' ? '#2d7fe0' : '#fdfdfd'} stroke="#aaa" strokeWidth="0.8" />}
          </g>
        );
      })()}

      {/* 비커 */}
      {(() => {
        const tr = pouring
          ? `translate(${FX - 26} 98) rotate(${Math.min(1, L.anim.t / 0.3) * 72})`
          : `translate(${BK.x} ${BK.y})`;
        return (
          <g className={hot('beaker')} onClick={act.pour} transform={tr}>
            <g clipPath="url(#molBeaker)">
              {pouring
                ? <rect x="-300" y="2" width="600" height="300" transform={`rotate(${-Math.min(1, L.anim.t / 0.3) * 72})`} fill={solnFill(beakerConc)} />
                : beakerVol > 0 && <rect x={-BK.w} y={bkLevel - BK.y} width={BK.w} height={BK.y + BK.h - bkLevel} fill={solnFill(beakerConc)} />}
            </g>
            <path d={`M0 0 v${BK.h - 6} q0 6 -6 6 h${-BK.w + 12} q-6 0 -6 -6 v${-BK.h + 6} M0 0 l5 -5`} fill="none" stroke="#7b8494" strokeWidth="2.2" />
            {[0.25, 0.5, 0.75].map((f) => (
              <g key={f}><line x1={-BK.w + 8} x2={-BK.w + 20} y1={BK.h - 4 - f * (BK.h - 16)} y2={BK.h - 4 - f * (BK.h - 16)} stroke="#9aa3b0" />
                {!pouring && <text x={-BK.w + 23} y={BK.h - 1 - f * (BK.h - 16)} className="mol-sub">{fk.beaker * f}</text>}</g>
            ))}
            {!pouring && L.beakerSolid > 0 && (
              <path d={`M${-BK.w / 2 - 18 * Math.min(1.3, Math.sqrt(L.beakerSolid / mNeed))} ${BK.h - 3} q${18 * Math.min(1.3, Math.sqrt(L.beakerSolid / mNeed))} -${16 * Math.min(1.3, Math.sqrt(L.beakerSolid / mNeed))} ${36 * Math.min(1.3, Math.sqrt(L.beakerSolid / mNeed))} 0 z`} fill={sol.id === 'CuSO4' ? '#2d7fe0' : '#fbfbfb'} stroke="#aaa" />
            )}
            {!pouring && dotsIn(nBeakerDots, 300, (sd) => {
              const top = bkLevel - BK.y + 5, bot = BK.h - 6;
              if (bot - top < 6) return null;
              return [-BK.w / 2 + sd.s * (BK.w / 2 - 8), top + sd.u * (bot - top)];
            })}
          </g>
        );
      })()}
      {pouring && <line x1={FX - 24} y1={100} x2={FX - 12} y2={128} stroke={sol.id === 'CuSO4' ? solnFill(beakerConc) : '#7fb3ff'} strokeWidth="4" strokeLinecap="round" />}
      {/* 유리 막대 */}
      {!pouring && (
        <g className={hot('rod')} onPointerDown={startHold('stir')} style={{ touchAction: 'none' }}>
          {(() => {
            const sw = stirring ? Math.sin(t * 14) * 14 : 0;
            return <line x1={BK.x - 18 + sw * 0.3} y1={BK.y - 32} x2={BK.x - BK.w / 2 + sw} y2={BK.y + BK.h - 8} stroke="#b8c7d9" strokeWidth="5" strokeLinecap="round" />;
          })()}
          <line x1={BK.x - 18} y1={BK.y - 32} x2={BK.x - 24} y2={BK.y - 14} stroke="transparent" strokeWidth="18" />
        </g>
      )}

      {/* 부피 플라스크 */}
      <g transform={`rotate(${invAngle} ${FX} 300)`} className={hot('flask')} onClick={act.invert}>
        {L.flaskVol > 0 && <path d={liquidPath(levelY)} fill={L.mix > 0.95 || L.concVol === 0 ? solnFill(flaskConc) : 'url(#molGrad)'} />}
        {dotsIn(nFlaskDots, 0, (sd) => {
          const vs = (sd.u * mixedVol) / kV;
          const y = Math.max(yForVs(vs), levelY + 3);
          if (y > BASE_Y - 3) return [FX + sd.s * 20, BASE_Y - 4];
          return [FX + sd.s * (hw(y) - 5), Math.min(BASE_Y - 4, y)];
        })}
        <path d={flaskOutline} fill="rgba(235,244,255,0.25)" stroke="#7b8494" strokeWidth="2.2" />
        <line x1={FX - NECK_HW - 2} x2={FX + NECK_HW + 2} y1={MARK_Y} y2={MARK_Y} stroke="#333" strokeWidth="1.6" />
        <text x={FX + NECK_HW + 6} y={MARK_Y + 4} className="mol-sub">표선</text>
        <text x={FX} y={CY + 12} textAnchor="middle" className="mol-lbl">{flaskV} mL</text>
        <text x={FX} y={CY + 26} textAnchor="middle" className="mol-sub">20 °C · A</text>
        {L.step === 7 && <g><rect x={FX - 52} y={CY - 48} width="104" height="22" rx="3" fill="#fff" stroke="#999" /><text x={FX} y={CY - 33} textAnchor="middle" className="mol-lbl">{sol.label} {cReal.toFixed(3)} M</text></g>}
        {L.stopper && <rect x={FX - 13} y={TOP_Y - 16} width="26" height="20" rx="4" fill="#5c6b7a" />}
      </g>
      {/* 깔때기 */}
      <g className={hot('funnel')} onClick={act.funnel}
        transform={L.funnelOn ? `translate(${FX} ${TOP_Y - 48})` : `translate(520 404) scale(0.6)`}>
        <path d="M-34 0 h68 l-28 40 v34 h-12 v-34 z" fill="rgba(235,244,255,0.6)" stroke="#7b8494" strokeWidth="2" />
      </g>
      {/* 마개 (바닥에 놓여 있을 때) */}
      {!L.stopper && (
        <g className={hot('stopper')} onClick={act.stopper}>
          <rect x="462" y="412" width="26" height="16" rx="4" fill="#5c6b7a" />
        </g>
      )}
      {/* 세척병 */}
      <g className={hot('wash')} onPointerDown={startHold('wash')} style={{ touchAction: 'none' }}>
        <path d="M730 340 h56 v84 q0 6 -6 6 h-44 q-6 0 -6 -6 z" fill={washing ? '#d5e6fb' : '#eef4fb'} stroke="#7b8494" strokeWidth="2" />
        <rect x="748" y="324" width="20" height="16" fill="#cfd6df" stroke="#7b8494" />
        <path d="M758 324 v-18 h-40 l-6 8" fill="none" stroke="#7b8494" strokeWidth="3" />
        <text x="758" y="392" textAnchor="middle" className="mol-sub">증류수</text>
      </g>
      {washing && (L.step === 5
        ? <path d={`M712 314 Q ${FX + 60} 60 ${FX + 2} ${TOP_Y + 4}`} stroke="#7fb3ff" strokeWidth="3" fill="none" strokeDasharray="6 4" strokeDashoffset={-t * 60} />
        : <path d={`M712 314 Q 560 180 ${BK.x - BK.w / 2} ${BK.y + 4}`} stroke="#7fb3ff" strokeWidth="3" fill="none" strokeDasharray="6 4" strokeDashoffset={-t * 60} />)}
      {/* 스포이트 */}
      <g className={hot('dropper')} onClick={act.dropper}
        transform={L.step === 5 && !L.funnelOn ? `translate(${FX} ${TOP_Y - 70})` : 'translate(690 452) rotate(-90)'}>
        <rect x="-4" y="0" width="8" height="46" rx="2" fill="rgba(235,244,255,0.9)" stroke="#7b8494" />
        <rect x="-7" y="-20" width="14" height="22" rx="6" fill="#d9534f" />
        <path d="M-2 46 h4 l-1 10 h-2z" fill="#7b8494" />
      </g>
      {L.anim?.kind === 'drop' && <circle cx={FX} cy={TOP_Y - 12 + (L.anim.t / L.anim.dur) * Math.max(10, levelY - TOP_Y + 12)} r="2.6" fill="#7fb3ff" />}

      {/* 확대창 */}
      {showZoom && (
        <g>
          <line x1={FX + NECK_HW} y1={MARK_Y} x2={ZX - ZR} y2={ZY} stroke="#9aa3b0" strokeDasharray="3 3" />
          <circle cx={ZX} cy={ZY} r={ZR + 2} fill="#fff" stroke="#7b8494" strokeWidth="2" />
          <g clipPath="url(#molZoom)">
            <rect x={ZX - ZW} y={ZY - ZR} width={ZW * 2} height={ZR * 2} fill="#f7fbff" />
            <path d={`M${ZX - ZW} ${ZY + ZR} V${zLevel - 6} Q${ZX} ${zLevel + 6} ${ZX + ZW} ${zLevel - 6} V${ZY + ZR} Z`}
              fill={sol.id === 'CuSO4' ? solnFill(flaskConc) : 'rgba(120,175,250,0.45)'} />
            <line x1={ZX - ZW - 12} x2={ZX + ZW + 12} y1={ZY} y2={ZY} stroke="#111" strokeWidth="1.6" />
            <line x1={ZX - ZW} x2={ZX - ZW} y1={ZY - ZR} y2={ZY + ZR} stroke="#7b8494" strokeWidth="3" />
            <line x1={ZX + ZW} x2={ZX + ZW} y1={ZY - ZR} y2={ZY + ZR} stroke="#7b8494" strokeWidth="3" />
            {[-10, -5, 5, 10].map((m) => <line key={m} x1={ZX + ZW + 3} x2={ZX + ZW + 9} y1={ZY - m * PXMM} y2={ZY - m * PXMM} stroke="#9aa3b0" />)}
          </g>
          <text x={ZX} y={ZY + ZR + 16} textAnchor="middle" className="mol-sub">확대 (눈금 5 mm)</text>
        </g>
      )}
    </svg>
  );

  const stepCls = (i) => (i === L.step ? 'on' : i < L.step ? 'done' : '');

  const controls = (
    <>
      <Select label="용질" value={soluteId} onChange={(v) => changeSetting(() => setSoluteId(v))}
        options={SOLUTES.map((s) => ({ value: s.id, label: `${s.ko} ${s.label}` }))} />
      <Select label="부피 플라스크" value={String(flaskV)} onChange={(v) => changeSetting(() => setFlaskV(Number(v)))}
        options={[50, 100, 250].map((v) => ({ value: String(v), label: `${v} mL` }))} />
      <Slider label="만들 몰 농도" value={target} min={0.05} max={0.5} step={0.01} unit=" M" format={(v) => v.toFixed(2)}
        onChange={(v) => changeSetting(() => setTarget(v))} />
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={randomTask}>무작위 과제</button>
        <button className="btn btn-ghost" onClick={reset}>처음부터</button>
      </div>

      <ol className="mol-steps">
        {STEPS.map((s, i) => <li key={s} className={stepCls(i)}>{s}</li>)}
      </ol>

      <div className="subpanel">
        <b>{L.step + 1}. {STEPS[L.step]}</b>
        <p className="small">{stepHelp}</p>

        {L.step === 0 && (<>
          <div className="btn-row">
            <input className="num-input" value={L.answer} onChange={(e) => { L.answer = e.target.value; redraw(); }} placeholder="질량 (g)" />
            <button className="btn" onClick={act.checkAnswer}>확인</button>
          </div>
          <button className="btn btn-ghost" onClick={() => { L.showSolution = true; redraw(); }}>풀이 보기</button>
          {L.showSolution && (
            <div className="small mol-calc">
              n = C × V = {target.toFixed(2)} mol/L × {(flaskV / 1000).toFixed(3)} L = <b>{sci(nTarget, 3)} mol</b><br />
              m = n × M = {sci(nTarget, 3)} mol × {fmt(M, 2)} g/mol = <b>{fmt(mNeed, 3)} g</b><br />
              입자 수 = n × N<sub>A</sub> = {sci(nTarget * NA, 2)} 개
            </div>
          )}
          <button className="btn" disabled={!(L.answerOk || L.showSolution)} onClick={act.next}>다음: 질량 측정</button>
        </>)}

        {L.step === 1 && (<>
          <div className="btn-row">
            <button className="btn btn-ghost" disabled={L.boatOn} onClick={act.boat}>접시 올리기</button>
            <button className="btn btn-ghost" onClick={act.tareBtn}>영점(TARE)</button>
          </div>
          <label className="select"><span>약숟가락으로 한 번에</span>
            <select value={scoop} onChange={(e) => setScoop(e.target.value)}>
              <option value="big">많이 (약 2 g)</option>
              <option value="mid">조금 (약 0.2 g)</option>
              <option value="small">톡톡 (약 0.02 g)</option>
            </select>
          </label>
          <div className="btn-row">
            <button className="btn" onClick={() => act.spatula(1)}>덜어 넣기</button>
            <button className="btn btn-ghost" onClick={() => act.spatula(-1)}>덜어 내기</button>
          </div>
          <button className="btn" disabled={!L.tared || reading <= 0} onClick={act.record}>질량 기록하고 다음으로</button>
        </>)}

        {L.step === 2 && (<>
          <div className="btn-row">
            <button className="btn btn-ghost" disabled={L.boatSolid === 0} onClick={act.boat}>비커에 옮기기</button>
            <button className="btn btn-ghost" onPointerDown={startHold('wash')}>세척병 (누르고 있기)</button>
            <button className="btn btn-ghost" onPointerDown={startHold('stir')}>젓기 (누르고 있기)</button>
          </div>
          {L.beakerSolid > 0 && L.beakerWater > 0 && maxDissolve(L.beakerWater) < L.beakerSolid + L.beakerDis &&
            <div className="feedback no">물이 부족해 다 녹지 않습니다. (25 °C 에서 물 100 g 에 최대 {sol.sol} g{sol.hydrate ? ' (무수물 기준)' : ''})</div>}
          {L.beakerWater > flaskV * 0.7 && <div className="feedback no">물이 너무 많으면 헹굼 물을 넣다가 표선을 넘을 수 있어요.</div>}
          <button className="btn" disabled={L.beakerSolid > 0 || L.beakerDis === 0 || L.boatSolid > 0} onClick={act.next}>다 녹았어요 → 옮기기</button>
        </>)}

        {L.step === 3 && (
          <div className="btn-row">
            <button className="btn btn-ghost" disabled={L.funnelOn} onClick={act.funnel}>깔때기 꽂기</button>
            <button className="btn" onClick={act.pour}>비커의 용액 붓기</button>
          </div>
        )}

        {L.step === 4 && (<>
          <div className="btn-row">
            <button className="btn btn-ghost" onPointerDown={startHold('wash')}>세척병 → 비커</button>
            <button className="btn" onClick={act.pour}>헹군 물 붓기</button>
          </div>
          <p className="small muted">헹군 횟수 {L.rinses}번 · 비커에 남은 용질 {fmt(L.flaskSolute + L.beakerDis > 0 ? (L.beakerDis / (L.flaskSolute + L.beakerDis)) * 100 : 0, 2)} %</p>
          <button className="btn" onClick={act.next}>{L.rinses ? '헹굼 끝 → 표선 맞추기' : '헹구지 않고 넘어가기'}</button>
        </>)}

        {L.step === 5 && (<>
          <div className="btn-row">
            <button className="btn btn-ghost" disabled={!L.funnelOn} onClick={act.funnel}>깔때기 빼기</button>
            <button className="btn btn-ghost" onPointerDown={startHold('wash')}>세척병 (누르고 있기)</button>
            <button className="btn" onClick={act.dropper}>스포이트 1방울</button>
          </div>
          {volErr > fk.tol && <div className="feedback no">표선을 넘었습니다! 물을 빼내면 용질도 함께 빠져나가므로 처음부터 다시 만들어야 합니다. (그대로 계속하면 오차를 확인할 수 있어요)</div>}
          <button className="btn" disabled={L.funnelOn || L.flaskVol < flaskV * 0.85} onClick={act.next}>표선에 맞췄어요</button>
        </>)}

        {L.step === 6 && (<>
          <div className="btn-row">
            <button className="btn btn-ghost" disabled={L.stopper} onClick={act.stopper}>마개 막기</button>
            <button className="btn" onClick={act.invert}>뒤집어 섞기</button>
          </div>
          <p className="small muted">뒤집은 횟수 {L.inversions}번 · 섞인 정도 {Math.round(L.mix * 100)} %</p>
          <button className="btn" disabled={!L.stopper} onClick={act.next}>결과 확인</button>
        </>)}

        {L.step === 7 && (<>
          <Readout rows={[
            ['목표 농도', `${target.toFixed(3)} M`],
            ['만든 용액의 실제 농도', `${cReal.toFixed(4)} M`],
            ['목표와의 차이', `${errPct >= 0 ? '+' : ''}${errPct.toFixed(2)} %`],
          ]} />
          <div className={`feedback ${Math.abs(errPct) <= 1 && L.mix >= 0.95 ? 'ok' : 'no'}`}>
            {Math.abs(errPct) <= 1 && L.mix >= 0.95 ? '훌륭합니다! 목표 농도의 1 % 안으로 정확하게 만들었어요.' : '오차의 원인을 아래에서 찾아보세요.'}
          </div>
          <ul className="small mol-check">
            <li>단 질량 {fmt(massTrue)} g (목표 {fmt(mNeed)} g, {fmt(((massTrue - mNeed) / mNeed) * 100, 1)} %)</li>
            <li>비커·유리 막대에 남아 못 옮긴 용질 {fmt(lossPct, 2)} %{L.rinses === 0 ? ' — 헹구지 않았어요' : ` (${L.rinses}번 헹굼)`}</li>
            <li>용액 부피 {fmt(L.flaskVol, 2)} mL (표선 {flaskV} mL, 허용 오차 ±{fk.tol} mL){Math.abs(volErr) > fk.tol ? (volErr > 0 ? ' — 표선을 넘었어요' : ' — 표선에 못 미쳤어요') : ''}</li>
            <li>{L.mix >= 0.95 ? '고르게 섞였어요.' : `아직 고르게 섞이지 않았어요 (${Math.round(L.mix * 100)} %). 위쪽 용액을 덜어 쓰면 농도가 낮습니다.`}</li>
            <li>기록한 질량으로 계산한 라벨 농도 {cLabel.toFixed(4)} M{Math.abs(cLabel - cReal) / cReal > 0.002 ? ' — 실제와 달라요' : ''}</li>
          </ul>
          <button className="btn" onClick={reset}>다시 만들기</button>
        </>)}
        {L.msg && <div className="feedback">{L.msg}</div>}
      </div>

      <Readout rows={[
        ['필요한 용질', `${sci(nTarget, 3)} mol`],
        ['플라스크 속 용질', `${sci(nFlask, 3)} mol`],
        ['플라스크 속 입자 수', nFlask > 0 ? `${sci(nFlask * NA, 2)} 개` : '0'],
        ['플라스크 속 용액', L.step === 7 ? `${fmt(L.flaskVol, 2)} mL` : `약 ${Math.round(L.flaskVol)} mL`],
      ]} />
      <div className="mol-legend small">
        {ions.map(([n, c]) => <span key={n}><i style={{ background: c }} />{n}</span>)}
        <span className="muted">점 1개 = {sci(molPerDot, 1)} mol ({sci(molPerDot * NA, 1)} 개)</span>
      </div>
    </>
  );

  return (
    <SimLayout canvas={canvas} controls={controls}
      footer={<ScaleNote items={[
        '몰질량은 CRC 원자량(1-11)으로 계산, 녹을 수 있는 최대량은 CRC 용해도(25 °C)로 판단합니다. 물 1 mL = 1 g 으로 가정',
        '부피 플라스크는 크기와 상관없이 같은 모양으로 그렸고, 확대창은 목 안지름 가정값(50 mL 1.1 cm, 100 mL 1.3 cm, 250 mL 1.5 cm)으로 1 mm = 5 px 로 그림',
        `표선 허용 오차는 A급 부피 플라스크 값(ASTM E288: ±0.05, ±0.08, ±0.12 mL), 스포이트 1방울 = ${DROP} mL, 칭량 접시 ${BOAT_MASS} g, 저울 최소 눈금 0.01 g 으로 가정`,
        `붓고 난 뒤 비커 벽과 유리 막대에 용액 ${FILM} mL 가 남는다고 가정 — 헹굴 때마다 남는 용질이 줄어듦`,
        '용액 부피 = 넣은 물 + 녹은 용질 질량 ÷ 고체 밀도(CRC)로 근사 (섞일 때 부피 변화는 무시)',
        '세척병은 플라스크 부피의 1/25 mL/s, 녹는 빠르기·뒤집어 섞이는 정도·점의 움직임은 화면용',
      ]} />}
    />
  );
}
