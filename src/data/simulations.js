// 시뮬레이션 목록.
// places: 교과서 단원(중단원 id 또는 대단원 id) — curriculum.js 참고
// standards: 2022 개정 교육과정 성취기준 코드
// sources: CRC Handbook 데이터 출처 키 — crc.js 의 SOURCES 참고
import Spectrum from '../simulations/Spectrum.jsx';
import PeriodicTrends from '../simulations/PeriodicTrends.jsx';
import BondPolarity from '../simulations/BondPolarity.jsx';
import GasProperties from '../simulations/GasProperties.jsx';
import VaporPressure from '../simulations/VaporPressure.jsx';
import Colligative from '../simulations/Colligative.jsx';
import DissolutionHeat from '../simulations/DissolutionHeat.jsx';
import DynamicEquilibrium from '../simulations/DynamicEquilibrium.jsx';
import Equilibrium from '../simulations/Equilibrium.jsx';
import AcidPH from '../simulations/AcidPH.jsx';
import Titration from '../simulations/Titration.jsx';
import GalvanicCell from '../simulations/GalvanicCell.jsx';

export const simulations = [
  {
    id: 'spectrum',
    title: '원소의 선 스펙트럼',
    description: '원소마다 고유한 방출·흡수 스펙트럼을 비교하고, 별빛 스펙트럼에서 구성 원소를 찾아냅니다.',
    goals: ['원소마다 선 스펙트럼의 위치가 다름을 안다', '흡수선을 비교해 천체의 구성 원소를 추론한다'],
    places: ['tsci1-2-1-01'],
    standards: ['10통과1-02-01'],
    sources: ['spectra'],
    component: Spectrum,
  },
  {
    id: 'periodic-trends',
    title: '원소의 주기적 성질',
    description: '1~20번 원소의 원자 반지름, 이온화 에너지, 전기 음성도가 주기와 족에 따라 어떻게 변하는지 비교합니다.',
    goals: ['원소의 성질이 주기적으로 변함을 찾는다', '전기 음성도의 주기적 변화를 설명한다'],
    places: ['tsci1-2-2-01', 'chem-2-1'],
    standards: ['10통과1-02-03', '12화학02-02'],
    sources: ['atomicWeights', 'radii', 'ionization', 'en'],
    component: PeriodicTrends,
  },
  {
    id: 'bond-polarity',
    title: '화학 결합과 극성',
    description: '두 원자의 전기 음성도 차이로 결합의 종류와 극성을 판단합니다.',
    goals: ['이온 결합과 공유 결합을 구별한다', '전기 음성도 차이로 결합의 극성을 판단한다'],
    places: ['tsci1-2-2-02', 'chem-2-1'],
    standards: ['10통과1-02-04', '12화학02-02'],
    sources: ['en', 'radii'],
    component: BondPolarity,
  },
  {
    id: 'gas-properties',
    title: '기체의 성질과 혼합 기체',
    description: '온도·부피·양을 바꾸며 이상 기체 방정식, 부분 압력, 실제 기체와의 차이를 탐구합니다.',
    goals: ['PV = nRT 관계를 확인한다', '부분 압력과 몰 분율의 관계를 안다', '분자량에 따른 분자 속력 차이를 비교한다'],
    places: ['matter-1-01', 'matter-1-02'],
    standards: ['12물에01-01', '12물에01-02'],
    sources: ['constants', 'atomicWeights', 'vdw'],
    component: GasProperties,
  },
  {
    id: 'vapor-pressure',
    title: '증기 압력과 끓는점',
    description: '물, 에탄올, 아세톤, 다이에틸 에테르의 증기 압력 곡선으로 분자 간 인력과 끓는점을 비교합니다.',
    goals: ['증기 압력과 끓는점의 관계를 설명한다', '분자 간 인력에 따라 끓는점이 다름을 안다', '외부 압력이 끓는점에 미치는 영향을 안다'],
    places: ['matter-1-03', 'matter-2'],
    standards: ['12물에01-03', '12물에02-01'],
    sources: ['waterVP', 'vp'],
    component: VaporPressure,
  },
  {
    id: 'colligative',
    title: '묽은 용액의 총괄성',
    description: '용질 입자 수에 따른 증기 압력 내림, 끓는점 오름, 어는점 내림을 계산합니다.',
    goals: ['용액의 농도에 따른 끓는점·어는점 변화를 비교한다', '전해질과 비전해질의 차이를 설명한다'],
    places: ['matter-2'],
    standards: ['12물에02-02'],
    sources: ['colligative', 'organic', 'waterVP'],
    component: Colligative,
  },
  {
    id: 'dissolution-heat',
    title: '용해와 에너지 출입',
    description: '여러 물질이 물에 녹을 때 방출하거나 흡수하는 열을 간이 열량계로 측정합니다.',
    goals: ['발열 반응과 흡열 반응을 구별한다', '엔탈피 변화로 열의 출입을 표현한다', '생활 속 이용 사례(손난로, 냉찜질 팩)를 설명한다'],
    places: ['tsci2-1-2-03', 'matter-3'],
    standards: ['10통과2-01-05', '12물에03-01'],
    sources: ['solH', 'waterProps', 'atomicWeights'],
    component: DissolutionHeat,
  },
  {
    id: 'dynamic-equilibrium',
    title: '가역 반응과 동적 평형',
    description: '밀폐된 플라스크 속 물이 증발하고 응축하는 모습을 보며, 수증기 압력이 포화 증기압에 이르러 증발 속도(정반응)와 응축 속도(역반응)가 같아지는 동적 평형을 관찰합니다.',
    goals: ['가역 반응의 의미를 안다', '정반응 속도와 역반응 속도가 같아지는 동적 평형 상태를 설명한다', '평형 상태에서도 반응이 멈추지 않고 계속됨을 이해한다'],
    places: ['chem-3-1'],
    standards: ['12화학03-01'],
    sources: ['waterVP', 'constants'],
    component: DynamicEquilibrium,
  },
  {
    id: 'equilibrium',
    title: '화학 평형과 르샤틀리에 원리',
    description: '2NO₂ ⇌ N₂O₄ 평형에서 분자가 부딪혀 결합하고 쪼개지는 모습을 보며, 온도·부피·농도에 따른 평형 이동과 Q·K 를 관찰합니다.',
    goals: ['평형 상수 K 의 의미를 안다', 'Q 와 K 를 비교해 반응 방향을 예측한다', '농도·압력·온도 변화에 따른 평형 이동을 설명한다'],
    places: ['chem-3-2'],
    standards: ['12화학03-02', '12화학03-03', '12화학03-04'],
    sources: ['thermo', 'constants'],
    component: Equilibrium,
  },
  {
    id: 'acid-ph',
    title: '산의 세기와 pH',
    description: '강산과 약산의 농도에 따른 pH, 이온화도, 물의 자동 이온화를 탐구합니다.',
    goals: ['물의 이온화 상수와 pH 를 이해한다', '몰 농도의 의미를 안다', 'Ka 로 산의 상대적 세기를 비교한다'],
    places: ['chem-4-1', 'react-1-02'],
    standards: ['12화학04-01', '12화학04-02', '12반응01-02'],
    sources: ['kw', 'pkaInorg', 'pkaOrg', 'atomicWeights'],
    component: AcidPH,
  },
  {
    id: 'titration',
    title: '중화 반응과 중화 적정',
    description: '산 용액에 NaOH 를 넣으며 지시약 색과 적정 곡선을 관찰하고, 미지 시료의 농도를 구합니다.',
    goals: ['중화 반응의 양적 관계를 설명한다', '강산·약산의 적정 곡선을 해석한다', '중화 적정으로 미지 시료의 농도를 구한다'],
    places: ['tsci2-1-2-02', 'chem-4-2', 'react-1-03'],
    standards: ['10통과2-01-04', '12화학04-03', '12화학04-04', '12반응01-03'],
    sources: ['kw', 'pkaInorg', 'pkaOrg', 'indicators'],
    component: Titration,
  },
  {
    id: 'galvanic-cell',
    title: '화학 전지와 표준 환원 전위',
    description: '두 금속 전극으로 전지를 만들어 산화·환원 반응, 전자의 이동, 표준 전지 전위를 확인합니다.',
    goals: ['산화와 환원을 전자의 이동으로 설명한다', '금속의 반응성 순서를 안다', '표준 환원 전위로 전지 전위를 구한다'],
    places: ['tsci2-1-2-01', 'react-2-01', 'react-2-02', 'react-2-03'],
    standards: ['10통과2-01-03', '12반응02-01', '12반응02-03'],
    sources: ['echem'],
    component: GalvanicCell,
  },
];

export const simsForPlace = (id) => simulations.filter((s) => s.places.includes(id));
export const simsForStandard = (code) => simulations.filter((s) => s.standards.includes(code));
