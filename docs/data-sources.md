# 데이터 출처와 추출 방법

## 원본 파일 (저장소에는 없음, 로컬 폴더에만 있음)
- `CRC Handbook of Chemistry and Physics 2014.pdf` (95판, 2648쪽)
- `[별책9] 과학과 교육과정.pdf` (교육부 고시 제2022-33호)
- `통합과학 교과서/`, `화학 교과서/` (동아·비상·천재 교과서와 지도서 PDF)

## 텍스트 추출
- 도구: `pdftotext` (xpdf 4.06). 한글은 반드시 `-enc UTF-8`.
- CRC 표는 `-table` 모드가 행 정렬이 정확하다. `-layout`은 여러 단 표에서 값이 다른 행으로 밀린다.
- 전체 추출(약 25초): `pdftotext -enc UTF-8 -table "CRC Handbook of Chemistry and Physics 2014.pdf" crct.txt` → 페이지 구분은 `\f`.
- PDF 페이지 번호와 인쇄 쪽 번호는 다르다. 예: PDF 958쪽 = 5-80, 970쪽 = 5-92, 1096쪽 = 6-5.
- 스펙트럼 표(10-1~)는 4단 구성이라 `-layout` 결과에서 열 위치로 파싱해야 한다. 파장은 믿을 수 있지만 세기 값은 열이 어긋나서 쓰지 않았다.

## 사용한 CRC 표 (src/data/crc.js 의 SOURCES)
| 표 | 인쇄 쪽 | 쓰는 곳 |
|---|---|---|
| Fundamental Physical Constants | 1-2 | R, NA, F |
| Standard Atomic Weights 2013 | 1-11~1-12 | 몰질량 (범위로 주어진 원소는 Table 2 대표값) |
| Electron Configuration and Ionization Energy | 1-17 | 제1 이온화 에너지 |
| Standard Thermodynamic Properties of Chemical Substances | 5-4~5-42 (N₂O₄ 5-16) | 평형 |
| Thermodynamic Properties of Aqueous Ions | 5-66 | OH⁻ 등 (현재 미사용) |
| Ionization Constant of Water | 5-70 | pKw(T) |
| Electrochemical Series, Table 1 | 5-80 | 표준 환원 전위 |
| Dissociation Constants of Inorganic / Organic Acids | 5-92 / 5-94~5-99 | pKa |
| Enthalpy of Solution of Electrolytes | 5-111 | 용해 엔탈피 (무한 희석) |
| Thermophysical Properties of Water and Steam | 6-2 | 물 비열 4.1806 J/g·K (300 K) |
| Vapor Pressure and Other Saturation Properties of Water | 6-5 | 물 증기압 |
| Van der Waals Constants for Gases | 6-56 | a, b |
| Vapor Pressure | 6-88~6-100 | 유기 용매 (10 kPa, 100 kPa 온도) |
| Physical Constants of Organic Compounds | 3-4~3-246 | 용매 녹는점·끓는점 |
| Indicators for Acids and Bases | 8-84 | 지시약 변색 범위 |
| Atomic Radii of the Elements | 9-49~9-50 | 공유 반지름 |
| Electronegativity | 9-97 | Pauling 전기음성도 |
| Line Spectra of the Elements | 10-1~ | 가시광선 선 파장 |
| Ebullioscopic / Cryoscopic Constants | 15-27~15-28 | Kb, Kf |

## 교과서 PDF
- 동아·비상 PDF 본문 대부분은 글꼴 인코딩 때문에 텍스트가 깨진다. 차례 일부만 읽을 수 있었다.
- 천재 화학 교과서는 차례를 소단원까지 읽을 수 있다.
- 통합과학 일부 텍스트는 `통합과학 교과서/작업자료/*.json`에 이미 추출되어 있다(페이지별 문자열 배열).
- 지도서 PDF는 `Adobe-Korea1` 문자 모음 오류가 난다.
