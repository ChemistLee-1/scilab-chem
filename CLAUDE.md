# chemistLee 실험실 (화학 시뮬레이션)

PhET 스타일의 고등학교 **화학** 시뮬레이션 웹사이트. React + Vite + React Router, 외부 차트 라이브러리 없음.
GitHub `ChemistLee-1/scilab-chem`(공개) → Vercel 자동 배포. 사용자는 한국어로 소통하는 화학 교사.

실행: `npm.cmd run dev` (PowerShell) · 빌드: `npx vite build`

## 핵심 원칙
1. 화학만 다룬다. 다른 과목은 나중에.
2. 모든 수치는 CRC Handbook 95판(2014) 실측값. 화면에 그대로 그릴 수 없으면 비율을 적용하고, 시뮬레이션 아래 `ScaleNote`(화면 축척) 상자에 비율과 가정을 적는다.
3. 교과서 단원과 2022 개정 교육과정 성취기준에 따라 분류한다.
4. 시뮬레이션 1개 = 파일 1개 (`src/simulations/*.jsx`).

## 작업 규칙 (버전 관리)
1. `main`은 실제 사이트. 직접 수정하지 않는다.
2. 요청마다 브랜치(`feat/…`, `fix/…`, `docs/…`)에서 작업 → 빌드·브라우저로 확인 → 커밋·push → PR 생성 → PR에 달린 Vercel 미리보기 주소를 사용자에게 전달.
3. 사용자가 **"반영해"** 하면 `gh pr merge --squash --delete-branch` → 로컬 `main` 동기화 → Production 배포 성공 확인.
4. 커밋 작성자는 `ChemistLee-1 <188952540+ChemistLee-1@users.noreply.github.com>`(저장소 로컬 설정). 실제 이메일은 쓰지 않는다.
5. `AGENTS.md`는 사용자가 결정할 때까지 커밋하지 않는다. PDF·교과서는 `.gitignore`로 제외(저작권).
6. 시뮬레이션을 고치면 해당 `docs/simulations/<파일명>.md`의 내용과 수정 이력도 함께 갱신한다.

## 파일 구조
| 무엇 | 위치 |
|---|---|
| 시뮬레이션 14개 | `src/simulations/*.jsx` (평형만 전용 CSS `Equilibrium.css`) |
| 공통 부품 (Slider, Select, Segmented, LineChart, ScaleNote, Readout, sci, bisect, wavelengthToRGB, useAnimationFrame) | `src/simulations/common.jsx` |
| CRC 데이터 + 출처 쪽 번호 | `src/data/crc.js` |
| 과목·단원·성취기준 52개 원문 | `src/data/curriculum.js` |
| 시뮬레이션 목록 (제목, 목표, 단원, 성취기준, 출처) | `src/data/simulations.js` |
| 페이지 / 스타일 | `src/pages/`, `src/index.css`, `src/chem.css` |

새 시뮬레이션: `src/simulations/X.jsx` 작성 → `simulations.js`에 등록 → 썸네일은 `src/components/Thumbnail.jsx`의 `ART` → `docs/simulations/X.md` 작성.

## 필요할 때만 읽을 문서
| 언제 | 문서 |
|---|---|
| 특정 시뮬레이션을 고칠 때 | `docs/simulations/<파일명>.md` — 단원, 성취기준, CRC 데이터, 계산 방식, 검증값, 수정 이력 |
| CRC에서 새 데이터를 찾을 때 | `docs/data-sources.md` |
| 단원·성취기준 분류를 바꾸거나 새 시뮬레이션을 배치할 때 | `docs/curriculum.md` |

시뮬레이션 문서: Spectrum, PeriodicTrends, BondPolarity, GasProperties, BoyleLaw, CharlesLaw, VaporPressure, Colligative, DissolutionHeat, DynamicEquilibrium, Equilibrium, AcidPH, Titration, GalvanicCell
