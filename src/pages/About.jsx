import { SOURCES } from '../data/crc.js';
import { COURSES } from '../data/curriculum.js';

export default function About() {
  return (
    <div className="container section narrow">
      <h1>자료 출처와 설계 원칙</h1>

      <h3>실측 데이터</h3>
      <p>모든 수치는 <b>CRC Handbook of Chemistry and Physics, 95th Edition (2014)</b> 에서 가져왔습니다. 사용한 표(인쇄 쪽 번호)는 다음과 같습니다.</p>
      <ul className="small">{Object.values(SOURCES).map((s) => <li key={s}>{s}</li>)}</ul>

      <h3>화면 축척</h3>
      <p>분자 수, 분자 속력, 원자 크기처럼 실제 값을 그대로 그릴 수 없는 경우에는 일정한 비율을 적용해 표시하고,
        각 시뮬레이션 아래의 <b>화면 축척</b> 상자에 적용한 비율과 가정을 적었습니다. 계산 결과(압력, pH, 전위 등)는 축척과 관계없이 실제 단위로 보여 줍니다.</p>

      <h3>단원과 성취기준 분류</h3>
      <p>성취기준은 <b>2022 개정 과학과 교육과정(교육부 고시 제2022-33호 [별책 9])</b> 원문을 따랐습니다.
        대단원은 교육과정의 영역과 같고, 중단원은 다음 교과서의 차례를 기준으로 했습니다.</p>
      <ul className="small">{COURSES.map((c) => <li key={c.id}>{c.name}: {c.textbook}</li>)}</ul>
      <p className="small muted">중단원 구성을 확인하지 못한 단원(물질과 에너지 Ⅱ~Ⅳ, 화학 반응의 세계 Ⅲ)은 대단원 단위로 분류했습니다.</p>
    </div>
  );
}
