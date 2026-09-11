# 지뢰찾기 — 1학년 정보 캐주얼 게임 5

중학교 1학년 정보 수업용 지뢰찾기 웹앱. 학생은 스마트폰으로 플레이하고, 교실 TV에는 실시간 순위표를 띄운다.

- 기술 스택: React + Vite + TypeScript + Tailwind / Firebase (Firestore, Auth) / Vercel
- 상세 요구사항: [`docs/PRD.md`](docs/PRD.md) · 구현 계획: [`PLAN.md`](PLAN.md) · 구현 메모: [`REVIEW.md`](REVIEW.md)

## 빠르게 실행하기

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 게임 로직 단위 테스트
npm run build      # 타입 체크 + 배포 빌드
```

Firebase 설정 없이도 실행된다. 이때는 **오프라인 모드**로 동작해 게임만 할 수 있고 기록 저장과 순위표는 꺼진다.

## 폴더 구조

```
src/
├─ game/        # 순수 게임 로직 (UI·Firebase 의존 없음) + 단위 테스트
│  ├─ levels.ts   난이도 설정 (여기만 고치면 난이도가 바뀐다)
│  ├─ rng.ts      시드 난수
│  └─ board.ts    보드 생성, 첫 클릭 보호, 연쇄 열기(BFS), 코드 열기, 승패 판정
├─ components/  Board, Cell, StatusBar, ControlBar, ResultModal
├─ pages/       Start, Home, Game, Dashboard, Admin
├─ hooks/       useGame, useCellInput, useMyRecords
├─ firebase/    초기화, 기록 저장(트랜잭션), 대시보드 조회, 재전송 대기열, 교사 로그인
├─ lib/         포맷·저장소·효과음
└─ state/       학생 정보 / 설정 / config 공유
```

## Firebase 설정

1. Firebase 콘솔에서 프로젝트를 만들고 **Firestore**와 **Authentication → Google 로그인**을 켠다.
2. 웹 앱을 등록해 SDK 설정값을 받아 `.env` 를 만든다. (`.env.example` 참고)

   ```bash
   cp .env.example .env
   ```

3. 보안 규칙과 색인을 배포한다.

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use <프로젝트ID>
   firebase deploy --only firestore
   ```

4. 콘솔에서 초기 문서를 만든다.

   | 경로 | 내용 |
   |---|---|
   | `config/app` | `{ season: "2026-2", maskNames: true, gameOpen: true }` |
   | `admins/{교사 UID}` | 아무 필드나 (예: `{ email: "..." }`) |

   교사 UID는 `/admin` 화면에서 Google 로그인하면 안내 문구에 표시된다.

### 에뮬레이터로 규칙 테스트

보안 규칙 테스트(`tests/firestore.rules.test.ts`)는 Firestore 에뮬레이터를 자동으로 띄운 뒤 실행된다.
로그인이나 실제 프로젝트 없이 동작하므로 배포 전에 먼저 돌려 보면 좋다.

```bash
npm install -g firebase-tools   # 최초 1회, Java 필요
npm run test:rules
```

정상 저장 / 느린 기록으로 덮어쓰기 거절 / 다른 이름 거절 / 최소 시간 미만 거절을 포함한 24가지를 확인한다.
규칙을 고쳤다면 배포 전에 이 명령이 통과하는지 확인한다.

## 배포 (Vercel)

1. GitHub 저장소를 Vercel에 연결한다. (Framework: Vite)
2. 환경 변수에 `VITE_FIREBASE_*` 6개를 등록한다.
3. `main` 브랜치에 push하면 자동 배포된다. SPA 라우팅은 `vercel.json` 의 rewrite로 처리된다.

## 데이터 구조

```
config/app                              앱 설정 (시즌, 이름 마스킹, 게임 열기)
admins/{uid}                            교사 계정 (콘솔에서 직접 등록)
students/{studentId}                    학번-이름 등록 정보
records/{season}_{level}_{studentId}    학생별·난이도별 기록 (시즌마다 1개)
```

한 판이 끝나면 기록 문서 **하나를 트랜잭션으로 갱신**한다. (판마다 문서를 만들지 않아 무료 한도 안에서 운영된다.)
저장에 실패하면 localStorage 대기열에 넣고, 온라인으로 돌아오면 자동으로 다시 보낸다.

## 조작

| 동작 | 스마트폰·태블릿 | PC |
|---|---|---|
| 칸 열기 | 탭 | 왼쪽 클릭 |
| 깃발 | 길게 누르기(400ms) 또는 깃발 모드에서 탭 | 오른쪽 클릭 |
| 코드 열기 | 열린 숫자 칸 탭 | 열린 숫자 칸 왼쪽 클릭 |
| 새 게임 | 😊 버튼 | 😊 버튼 또는 `R` 키 |

## 수업에서 자주 바꾸는 것

| 하고 싶은 것 | 고칠 곳 |
|---|---|
| 난이도(크기·지뢰 수) 조정 | `src/game/levels.ts` |
| 순위 초기화 | `/admin` → 시즌 값 변경 |
| 수업 외 시간 차단 | `/admin` → 게임 열기 끄기 |
| 이름 공개/마스킹 | `/admin` → 이름 마스킹 |
| 교실 TV 순위표 | `/dashboard?tv=1` (난이도 10초마다 자동 순환) |
| 연쇄 열기 원리 시연 | 홈 → 설정 → 원리 보기 모드 (이 모드의 판은 기록하지 않음) |

## 수업 전 점검

- [ ] `config/app` 의 `season` 이 이번 학기 값인지
- [ ] `admins` 에 교사 UID가 등록되어 있는지
- [ ] `gameOpen` 이 `true` 인지
- [ ] 교실 TV에 `/dashboard?tv=1` 이 떠 있는지
- [ ] 깃발 모드 버튼 사용법을 시연했는지
