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
├─ firebase/    초기화, 기록 저장(트랜잭션), 대시보드 조회, 재전송 대기열, 교사 핀 인증
├─ lib/         포맷·저장소·효과음
└─ state/       학생 정보 / 설정 / config 공유
```

## Firebase 설정

1. Firebase 콘솔에서 프로젝트를 만들고 **Firestore**를 켠다.
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

4. 콘솔에서 초기 문서를 만든다. 문서 ID는 **자동 ID가 아니라 직접 입력**해야 한다.

   | 경로 | 내용 | 필수 |
   |---|---|---|
   | `config/secret` | `{ pin: "123456" }` — 교사 화면 핀 번호 | 필수 |
   | `config/app` | `{ season: "2026-2", gameOpen: true }` | 선택 |

   `config/app` 은 없으면 기본값으로 동작하고, 교사 화면에서 설정을 한 번 바꾸면 자동으로 만들어진다.

5. Authentication → Sign-in method 에서 **익명(Anonymous)** 로그인을 켠다.

### 교사 화면 인증 방식

Google 로그인 대신 **핀 번호**를 쓰되, 확인은 서버(보안 규칙)에서 한다.

1. `/admin` 에서 핀을 입력하면 익명 로그인으로 uid 를 받는다
2. `teacherSessions/{uid}` 문서를 핀과 함께 만들려고 시도한다
3. 보안 규칙이 `config/secret` 의 핀과 대조해, **맞을 때만** 문서 생성을 허용한다
4. 기록 삭제·설정 변경 규칙은 이 세션 문서가 있는지로 교사를 판단한다

덕분에 **핀이 앱 코드에 들어가지 않고**(`config/secret` 은 규칙에서 `allow read: if false`),
콘솔에서 값만 바꾸면 재배포 없이 핀을 바꿀 수 있다.
콘솔에서 `admins/{uid}` 를 직접 등록한 계정도 그대로 교사로 인정한다. (비상용)

> 핀은 숫자 6자리보다 길게 잡는 편이 안전하다. 학생이 여러 번 시도해 볼 수 있기 때문이다.

### 에뮬레이터로 규칙 테스트

보안 규칙 테스트(`tests/firestore.rules.test.ts`)는 Firestore 에뮬레이터를 자동으로 띄운 뒤 실행된다.
로그인이나 실제 프로젝트 없이 동작하므로 배포 전에 먼저 돌려 보면 좋다.

```bash
npm install -g firebase-tools   # 최초 1회, Java 필요
npm run test:rules
```

정상 저장 / 느린 기록으로 덮어쓰기 거절 / 다른 이름 거절 / 최소 시간 미만 거절과
교사 핀 인증까지 포함해 33가지를 확인한다.
규칙을 고쳤다면 배포 전에 이 명령이 통과하는지 확인한다.

## 배포 (Vercel)

1. GitHub 저장소를 Vercel에 연결한다. (Framework: Vite)
2. 환경 변수에 `VITE_FIREBASE_*` 6개를 등록한다.
3. `main` 브랜치에 push하면 자동 배포된다. SPA 라우팅은 `vercel.json` 의 rewrite로 처리된다.

## 데이터 구조

```
config/app                              앱 설정 (시즌, 게임 열기)
config/secret                           교사 화면 핀 번호 (앱에서는 읽을 수 없음)
teacherSessions/{uid}                   핀으로 연 교사 세션
admins/{uid}                            교사 계정 (콘솔에서 직접 등록, 비상용)
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
| 물음표(?) | 깃발 상태에서 한 번 더 | 깃발 상태에서 오른쪽 클릭 |
| 코드 열기 | 열린 숫자 칸 탭 | 열린 숫자 칸 왼쪽 클릭 |
| 새 게임 | 😊 버튼 | 😊 버튼 또는 `R` 키 |

깃발을 꽂으면 남은 지뢰 수가 줄지만, **물음표는 표시일 뿐이라 지뢰 수에 세지 않고 열기도 막지 않는다.**
헷갈리는 칸을 잠깐 표시해 두는 용도다. (Windows 지뢰찾기와 같은 동작)
조작이 어려운 학급에서는 설정에서 끄면 깃발만 쓰는 두 단계로 돌아간다.

## 수업에서 자주 바꾸는 것

| 하고 싶은 것 | 고칠 곳 |
|---|---|
| 난이도(크기·지뢰 수) 조정 | `src/game/levels.ts` |
| 순위 초기화 | `/admin` → 시즌 값 변경 |
| 교사 화면 핀 번호 변경 | Firebase 콘솔 → `config/secret` 의 `pin` (재배포 불필요) |
| 수업 외 시간 차단 | `/admin` → 게임 열기 끄기 |
| 이름 공개/가리기 | 대시보드 오른쪽 위 `👀 이름 보임 / 🙈 이름 가림` 버튼 (기기마다 따로 기억) |
| 교실 TV 순위표 | `/dashboard?tv=1` (난이도 10초마다 자동 순환) |
| 연쇄 열기 원리 시연 | 홈 → 설정 → 원리 보기 모드 (이 모드의 판은 기록하지 않음) |
| 물음표 표시 끄기 (조작 단순화) | 홈 → 설정 → 물음표(?) 표시 |

## 수업 전 점검

- [ ] `config/app` 의 `season` 이 이번 학기 값인지
- [ ] `config/secret` 에 이번 학기 핀 번호가 설정되어 있는지
- [ ] `gameOpen` 이 `true` 인지
- [ ] 교실 TV에 `/dashboard?tv=1` 이 떠 있는지
- [ ] 깃발 모드 버튼 사용법을 시연했는지
