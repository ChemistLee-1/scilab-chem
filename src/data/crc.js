// CRC Handbook of Chemistry and Physics, 95th Edition (2014) 에서 발췌한 실측 데이터.
// 각 항목의 source 는 표 이름과 인쇄 쪽 번호(섹션-쪽)입니다.

export const SOURCES = {
  constants: 'Fundamental Physical Constants (1-2)',
  atomicWeights: 'Standard Atomic Weights 2013 (1-11~1-12)',
  ionization: 'Electron Configuration and Ionization Energy of Neutral Atoms (1-17)',
  thermo: 'Standard Thermodynamic Properties of Chemical Substances (5-4~5-42)',
  aqIons: 'Thermodynamic Properties of Aqueous Ions (5-66)',
  kw: 'Ionization Constant of Water (5-70)',
  echem: 'Electrochemical Series, Table 1 (5-80)',
  pkaInorg: 'Dissociation Constants of Inorganic Acids and Bases (5-92)',
  pkaOrg: 'Dissociation Constants of Organic Acids and Bases (5-94~5-99)',
  solH: 'Enthalpy of Solution of Electrolytes (5-111)',
  waterProps: 'Thermophysical Properties of Water and Steam (6-2)',
  waterVP: 'Vapor Pressure and Other Saturation Properties of Water (6-5)',
  vdw: 'Van der Waals Constants for Gases (6-56)',
  vp: 'Vapor Pressure (6-88~6-100)',
  organic: 'Physical Constants of Organic Compounds (3-4~3-246)',
  indicators: 'Indicators for Acids and Bases (8-84)',
  radii: 'Atomic Radii of the Elements (9-49~9-50)',
  en: 'Electronegativity (9-97)',
  spectra: 'Line Spectra of the Elements (10-1~)',
  colligative: 'Ebullioscopic / Cryoscopic Constants (15-27~15-28)',
};

// ── 기본 상수 (1-2)
export const R = 8.3144621; // J mol⁻¹ K⁻¹
export const R_LBAR = 0.083144621; // L bar mol⁻¹ K⁻¹
export const NA = 6.02214129e23; // mol⁻¹
export const ATM_KPA = 101.325; // 표준 대기압 1 atm (kPa)
export const EV_TO_KJMOL = 96.4853365; // 1 eV/atom = F/1000 kJ/mol

// ── 1~20번 원소 (원자량 1-11, 이온화 에너지 1-17, 공유 반지름 9-49, 전기음성도 9-97)
// rcov: 단일 결합 공유 반지름(Å), ie: 제1 이온화 에너지(eV), en: Pauling 전기음성도
export const ELEMENTS = [
  { z: 1, sym: 'H', ko: '수소', period: 1, group: 1, mass: 1.008, rcov: 0.32, ie: 13.5984, en: 2.20 },
  { z: 2, sym: 'He', ko: '헬륨', period: 1, group: 18, mass: 4.002602, rcov: 0.37, ie: 24.5874, en: null },
  { z: 3, sym: 'Li', ko: '리튬', period: 2, group: 1, mass: 6.94, rcov: 1.30, ie: 5.3917, en: 0.98 },
  { z: 4, sym: 'Be', ko: '베릴륨', period: 2, group: 2, mass: 9.0121831, rcov: 0.99, ie: 9.3227, en: 1.57 },
  { z: 5, sym: 'B', ko: '붕소', period: 2, group: 13, mass: 10.81, rcov: 0.84, ie: 8.2980, en: 2.04 },
  { z: 6, sym: 'C', ko: '탄소', period: 2, group: 14, mass: 12.011, rcov: 0.75, ie: 11.2603, en: 2.55 },
  { z: 7, sym: 'N', ko: '질소', period: 2, group: 15, mass: 14.007, rcov: 0.71, ie: 14.5341, en: 3.04 },
  { z: 8, sym: 'O', ko: '산소', period: 2, group: 16, mass: 15.999, rcov: 0.64, ie: 13.6181, en: 3.44 },
  { z: 9, sym: 'F', ko: '플루오린', period: 2, group: 17, mass: 18.998403163, rcov: 0.60, ie: 17.4228, en: 3.98 },
  { z: 10, sym: 'Ne', ko: '네온', period: 2, group: 18, mass: 20.1797, rcov: 0.62, ie: 21.5645, en: null },
  { z: 11, sym: 'Na', ko: '나트륨', period: 3, group: 1, mass: 22.98976928, rcov: 1.60, ie: 5.1391, en: 0.93 },
  { z: 12, sym: 'Mg', ko: '마그네슘', period: 3, group: 2, mass: 24.305, rcov: 1.40, ie: 7.6462, en: 1.31 },
  { z: 13, sym: 'Al', ko: '알루미늄', period: 3, group: 13, mass: 26.9815385, rcov: 1.24, ie: 5.9858, en: 1.61 },
  { z: 14, sym: 'Si', ko: '규소', period: 3, group: 14, mass: 28.085, rcov: 1.14, ie: 8.1517, en: 1.90 },
  { z: 15, sym: 'P', ko: '인', period: 3, group: 15, mass: 30.973761998, rcov: 1.09, ie: 10.4867, en: 2.19 },
  { z: 16, sym: 'S', ko: '황', period: 3, group: 16, mass: 32.06, rcov: 1.04, ie: 10.3600, en: 2.58 },
  { z: 17, sym: 'Cl', ko: '염소', period: 3, group: 17, mass: 35.45, rcov: 1.00, ie: 12.9676, en: 3.16 },
  { z: 18, sym: 'Ar', ko: '아르곤', period: 3, group: 18, mass: 39.948, rcov: 1.01, ie: 15.7596, en: null },
  { z: 19, sym: 'K', ko: '칼륨', period: 4, group: 1, mass: 39.0983, rcov: 2.00, ie: 4.3407, en: 0.82 },
  { z: 20, sym: 'Ca', ko: '칼슘', period: 4, group: 2, mass: 40.078, rcov: 1.74, ie: 6.1132, en: 1.00 },
];
export const elementBySym = Object.fromEntries(ELEMENTS.map((e) => [e.sym, e]));

// 화학식 → 몰질량 (g/mol). 예: 'NH4NO3', 'Ca(OH)2'
export function molarMass(formula) {
  const extra = { Cu: 63.546, Zn: 65.38, Fe: 55.845, Ag: 107.8682, Ni: 58.6934, Sn: 118.71, Sr: 87.62 };
  const mass = (s) => elementBySym[s]?.mass ?? extra[s];
  const parse = (str) => {
    let total = 0;
    const re = /\(([^)]+)\)(\d*)|([A-Z][a-z]?)(\d*)/g;
    let m;
    while ((m = re.exec(str))) {
      if (m[1]) total += parse(m[1]) * (Number(m[2]) || 1);
      else total += mass(m[3]) * (Number(m[4]) || 1);
    }
    return total;
  };
  return parse(formula);
}

// ── 선 스펙트럼: 중성 원자(I)의 가시광선 영역 주요 선 (nm, 공기 중 파장; 10-1~)
export const SPECTRA = {
  H: { ko: '수소', lines: [410.174, 434.047, 486.133, 656.272] },
  He: { ko: '헬륨', lines: [388.865, 447.148, 471.315, 492.193, 501.568, 587.562, 667.815, 706.519] },
  Li: { ko: '리튬', lines: [413.256, 460.283, 497.166, 610.354, 670.776] },
  Na: { ko: '나트륨', lines: [498.281, 568.821, 588.995, 589.592, 615.423] },
  Ne: { ko: '네온', lines: [585.249, 588.190, 594.483, 614.306, 640.225, 650.653, 659.895, 692.947, 703.241] },
  Ca: { ko: '칼슘', lines: [422.673, 445.478, 558.876, 616.217, 643.907, 646.257, 649.378] },
  Sr: { ko: '스트론튬', lines: [460.733, 483.208, 548.084, 640.847, 707.010] },
  Hg: { ko: '수은', lines: [404.656, 435.833, 546.074, 576.960, 579.066] },
};

// ── 기체: 반데르발스 상수 a (bar L² mol⁻²), b (L mol⁻¹) (6-56)
export const GASES = {
  He: { ko: '헬륨', formula: 'He', a: 0.0346, b: 0.0238, color: '#f2c94c' },
  Ne: { ko: '네온', formula: 'Ne', a: 0.208, b: 0.0167, color: '#eb5757' },
  Ar: { ko: '아르곤', formula: 'Ar', a: 1.355, b: 0.0320, color: '#9b51e0' },
  N2: { ko: '질소', formula: 'N2', a: 1.370, b: 0.0387, color: '#2f80ed' },
  O2: { ko: '산소', formula: 'O2', a: 1.382, b: 0.0319, color: '#27ae60' },
  CO2: { ko: '이산화 탄소', formula: 'CO2', a: 3.658, b: 0.0429, color: '#555' },
};

// ── 증기 압력
// 물: 포화 증기압 (°C, kPa) (6-5)
export const WATER_VP = [
  [0.01, 0.61165], [10, 1.2282], [20, 2.3393], [25, 3.1699], [30, 4.2470], [40, 7.3849],
  [50, 12.352], [60, 19.946], [70, 31.201], [80, 47.414], [90, 70.182], [100, 101.42],
  [110, 143.38], [120, 198.67],
];
// 유기 용매: 증기압이 10 kPa, 100 kPa 가 되는 온도 (°C) (6-96, 6-97, 6-100)
export const SOLVENT_VP = {
  ethanol: { ko: '에탄올', formula: 'C2H5OH', t10: 29.2, t100: 78.0 },
  acetone: { ko: '아세톤', formula: 'CH3COCH3', t10: 1.3, t100: 55.7 },
  ether: { ko: '다이에틸 에테르', formula: '(C2H5)2O', t10: -17.8, t100: 34.1 },
};

// ── 묽은 용액의 총괄성: Kb, Kf (K kg mol⁻¹) (15-27, 15-28), 녹는점·끓는점 (°C) (3-4~3-246)
export const SOLVENTS = {
  water: { ko: '물', kb: 0.513, kf: 1.86, bp: 100.0, mp: 0.0 },
  benzene: { ko: '벤젠', kb: 2.64, kf: 5.07, bp: 80.08, mp: 5.538 },
  cyclohexane: { ko: '사이클로헥세인', kb: 2.92, kf: 20.8, bp: 80.7, mp: 6.7 },
  aceticAcid: { ko: '아세트산', kb: 3.22, kf: 3.63, bp: 117.9, mp: 17 },
};

// ── 용해 엔탈피 (무한 희석, 25 °C, kJ/mol) (5-111)
export const SOLUTION_ENTHALPY = [
  { formula: 'NaOH', ko: '수산화 나트륨', dH: -44.51 },
  { formula: 'KOH', ko: '수산화 칼륨', dH: -57.61 },
  { formula: 'LiCl', ko: '염화 리튬', dH: -37.03 },
  { formula: 'NaCl', ko: '염화 나트륨', dH: 3.88 },
  { formula: 'NH4Cl', ko: '염화 암모늄', dH: 14.78 },
  { formula: 'KCl', ko: '염화 칼륨', dH: 17.22 },
  { formula: 'NH4NO3', ko: '질산 암모늄', dH: 25.69 },
  { formula: 'KNO3', ko: '질산 칼륨', dH: 34.89 },
];
export const WATER_CP = 4.1806; // J g⁻¹ K⁻¹, 300 K, 0.1 MPa (6-2)

// ── 화학 평형: N2O4(g) ⇌ 2NO2(g) (5-16 등, 298.15 K)
export const N2O4_EQ = {
  NO2: { dfH: 33.2, S: 240.1 }, // kJ/mol, J/(mol K)
  N2O4: { dfH: 11.1, S: 304.4 },
};
export const N2O4_DH = (2 * N2O4_EQ.NO2.dfH - N2O4_EQ.N2O4.dfH) * 1000; // J/mol
export const N2O4_DS = 2 * N2O4_EQ.NO2.S - N2O4_EQ.N2O4.S; // J/(mol K)

// ── 물의 이온화 상수 pKw (0.1 MPa 또는 포화압) (5-70)
export const PKW = [[0, 14.946], [25, 13.995], [50, 13.264], [75, 12.696], [100, 12.252]];

// ── 산의 이온화 상수 pKa (25 °C) (5-92, 5-94~5-99)
export const ACIDS = [
  { id: 'HCl', ko: '염산', formula: 'HCl', pKa: null, strong: true },
  { id: 'HNO2', ko: '아질산', formula: 'HNO₂', pKa: 3.25 },
  { id: 'HF', ko: '플루오린화 수소산', formula: 'HF', pKa: 3.20 },
  { id: 'HCOOH', ko: '폼산', formula: 'HCOOH', pKa: 3.75 },
  { id: 'CH3COOH', ko: '아세트산', formula: 'CH₃COOH', pKa: 4.756 },
  { id: 'H2CO3', ko: '탄산(1단계)', formula: 'H₂CO₃', pKa: 6.35 },
  { id: 'HClO', ko: '하이포아염소산', formula: 'HClO', pKa: 7.40 },
  { id: 'HCN', ko: '사이안화 수소산', formula: 'HCN', pKa: 9.21 },
];

// ── 산 염기 지시약 (8-84)
export const INDICATORS = [
  { id: 'mo', ko: '메틸 오렌지', range: [3.1, 4.4], acid: '#d7263d', base: '#f39c12' },
  { id: 'mr', ko: '메틸 레드', range: [4.4, 6.2], acid: '#d7263d', base: '#f1c40f' },
  { id: 'btb', ko: '브로모티몰 블루', range: [6.0, 7.6], acid: '#f1c40f', base: '#2e86de' },
  { id: 'pp', ko: '페놀프탈레인', range: [8.0, 10.0], acid: 'rgba(255,255,255,0)', base: '#e84393' },
];

// ── 표준 환원 전위 E° (V, 25 °C) (5-80)
export const REDUCTION_POTENTIALS = [
  { sym: 'Li', ko: '리튬', ion: 'Li⁺', n: 1, E: -3.0401 },
  { sym: 'K', ko: '칼륨', ion: 'K⁺', n: 1, E: -2.931 },
  { sym: 'Ca', ko: '칼슘', ion: 'Ca²⁺', n: 2, E: -2.868 },
  { sym: 'Na', ko: '나트륨', ion: 'Na⁺', n: 1, E: -2.71 },
  { sym: 'Mg', ko: '마그네슘', ion: 'Mg²⁺', n: 2, E: -2.372 },
  { sym: 'Al', ko: '알루미늄', ion: 'Al³⁺', n: 3, E: -1.676 },
  { sym: 'Zn', ko: '아연', ion: 'Zn²⁺', n: 2, E: -0.7618 },
  { sym: 'Fe', ko: '철', ion: 'Fe²⁺', n: 2, E: -0.447 },
  { sym: 'Ni', ko: '니켈', ion: 'Ni²⁺', n: 2, E: -0.257 },
  { sym: 'Sn', ko: '주석', ion: 'Sn²⁺', n: 2, E: -0.1375 },
  { sym: 'Pb', ko: '납', ion: 'Pb²⁺', n: 2, E: -0.1262 },
  { sym: 'H2', ko: '수소', ion: 'H⁺', n: 2, E: 0.0 },
  { sym: 'Cu', ko: '구리', ion: 'Cu²⁺', n: 2, E: 0.3419 },
  { sym: 'Ag', ko: '은', ion: 'Ag⁺', n: 1, E: 0.7996 },
  { sym: 'Au', ko: '금', ion: 'Au³⁺', n: 3, E: 1.498 },
];

// 선형 보간
export function interp(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    const [x0, y0] = table[i - 1];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return table[table.length - 1][1];
}
