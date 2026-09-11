# PLAN.md — 지뢰찾기 구현 계획

PRD `v1.0 (2026-09-11)` 기준. 단계별로 구현하고, 각 단계 완료 기준을 만족하면 다음으로 넘어간다.

## Phase 1. 게임 로직 (P0)

- `src/game/levels.ts` — 난이도 3종 설정값 단일 소스
- `src/game/rng.ts` — 시드 기반 난수 (mulberry32) + Fisher–Yates 셔플
- `src/game/board.ts` — 순수 함수 게임 로직
  - `createEmptyBoard`, `placeMines`, `computeAdjacent`, `getNeighbors`
  - `reveal`(BFS 연쇄 열기), `toggleFlag`, `chord`, `checkWin`
- `src/game/board.test.ts` — 단위 테스트
- 완료 기준
  - 첫 클릭 보호 1,000회 반복 테스트 통과
  - 모서리/가장자리 이웃 계산 테스트 통과
  - 연쇄 열기 / 코드 열기 / 승패 판정 테스트 통과

## Phase 2. PC 플레이 (P0)

- `useGame` 훅(리듀서) — 상태 전이를 게임 로직에 위임
- `Board`, `Cell`, `StatusBar`, `ResultModal`, `Game` 페이지
- 타이머(첫 열기 시 시작, 종료 시 정지), 0.1초 표시 / ms 저장
- 완료 기준: PC에서 3개 난이도 모두 플레이 가능, `R` 키 새 게임

## Phase 3. 터치 기기 대응 (P0)

- `useLongPress` — 400ms, 10px 이동 시 취소, 깃발 후 클릭 억제
- 깃발 모드 토글 버튼, +/− 칸 크기, 보드 스크롤, 가로 모드
- `touch-action`, `user-select`, contextmenu 차단
- 완료 기준: iOS Safari / Android Chrome 오작동 없음

## Phase 4. 학생 등록과 기록 저장 (P0)

- `Start` 화면(학번 5자리 `1`로 시작, 이름 한글 2~5자), localStorage 캐시
- `students` 등록 + 이름 불일치 차단
- `records/{season}_{level}_{studentId}` 트랜잭션 1회 갱신
- 실패 시 localStorage 대기열 → 온라인 복귀 시 재전송
- `firestore.rules`, `firestore.indexes.json`

## Phase 5. 대시보드 (P0)

- 난이도 탭 / 반 필터 / `onSnapshot` 실시간 / 상위 50 + 내 순위 고정
- 이름 마스킹(`config/app.maskNames`), 순위 변동 줄 강조

## Phase 6. 교사 관리와 배포 (P0)

- Google 로그인 + `admins/{uid}` 확인
- 기록 삭제, 학생 정보 수정/삭제, CSV, 시즌 변경, 설정(마스킹/게임 열기)
- `vercel.json`, `.env.example`, `README.md`

## Phase 7. P1

- 원리 보기 모드(연쇄 열기 0.1초 애니메이션, 기록 미저장)
- 교실 TV 모드(큰 글씨, 난이도 탭 10초 자동 순환)
- 효과음 / 진동 + 설정 토글

## 설계 원칙

- `src/game`은 UI·Firebase 의존 없는 순수 모듈. 모든 상태 전이는 새 객체를 반환한다.
- Firebase 환경 변수가 없으면 앱은 "오프라인 모드"로 동작하고 게임 플레이는 막지 않는다.
- 난이도·색상·크기 등 수업에서 바꿀 값은 한 파일에 모은다.
