# PRD: 지뢰찾기 (1학년 정보 캐주얼 게임 시리즈 5)

| 항목 | 내용 |
|---|---|
| 문서 버전 | v1.0 (2026-09-11) |
| 작성자 | 이승엽 (장평중학교 정보) |
| 대상 | 중학교 1학년 정보 수업 |
| 기술 스택 | React + Vite + TypeScript + Tailwind / Firebase (Firestore, Auth) / GitHub / Vercel |
| 개발 방식 | Claude Code 바이브 코딩 (PRD → PLAN.md → 단계별 구현 → REVIEW.md) |
| 선행 게임 | 1 하노이 탑 → 2 2048 → 3 똥 피하기 → 4 한붓그리기 → **5 지뢰찾기** |

---

## 1. 배경과 목적

1학년 정보 수업에서 매주 캐주얼 게임을 플레이하며 컴퓨팅 사고력을 기르고, 최종적으로 학생 각자가 바이브 코딩으로 자신만의 게임 웹앱을 만드는 시리즈의 다섯 번째 게임이다.

지뢰찾기는 "주어진 단서(숫자)로 보이지 않는 정보를 추론한다"는 점에서 논리적 사고를 직접 요구하고, 게임 내부가 **2차원 격자 데이터 + 이웃 탐색 + 연쇄 열기(재귀/탐색)**로 이루어져 있어 알고리즘 설명 소재로도 좋다. 특히 빈칸을 누르면 주변이 연쇄적으로 열리는 동작은 1주차 하노이 탑에서 다룬 "자기 자신을 다시 부르는" 재귀 개념과 연결된다.

### 1.1 수업 목표

- 숫자 단서를 근거로 지뢰 위치를 논리적으로 추론할 수 있다.
- 게임 보드를 행과 열로 이루어진 2차원 데이터로 이해할 수 있다.
- 한 칸의 숫자가 "주변 8칸 지뢰 개수"로 계산된다는 규칙을 설명할 수 있다.
- 연쇄 열기가 "빈칸이면 이웃도 연다"는 규칙의 반복(재귀)임을 이해할 수 있다.

### 1.2 성공 기준

- 수업 시간 내 학생 90% 이상이 초급을 1회 이상 클리어한다.
- 스마트폰·태블릿·PC 어느 기기에서도 조작 문제로 수업이 멈추지 않는다.
- 한 반(약 30명) 동시 접속 시 대시보드가 실시간으로 갱신된다.

---

## 2. 사용자와 사용 환경

| 구분 | 설명 |
|---|---|
| 학생 | 중1, 주로 개인 스마트폰(세로 화면), 일부 태블릿·노트북 |
| 교사 | PC + 교실 TV/프로젝터로 대시보드 띄움, 기록 관리 |
| 네트워크 | 학교 Wi-Fi (간헐적 끊김 가능) |
| 동시 접속 | 수업 중 한 반 30명 내외, 학년 전체 기록 누적 |
| 브라우저 | iOS Safari, Android Chrome/삼성 인터넷, PC Chrome/Edge 최신 버전 |

---

## 3. 범위

### 3.1 MVP (P0, 반드시 구현)

- 지뢰찾기 게임 (3개 난이도)
- 기기별 조작 (탭/길게 누르기/깃발 모드 버튼, 마우스 좌·우클릭)
- 학번·이름 입력 및 기록 저장 (Firebase)
- 난이도별 실시간 순위 대시보드
- 교사 로그인 및 기록 관리 (삭제, CSV 내보내기, 시즌 초기화)

### 3.2 P1 (가능하면 구현)

- 원리 보기 모드: 연쇄 열기를 한 칸씩 느리게 보여주는 수업용 애니메이션
- 교실 TV 모드 대시보드 (큰 글씨, 자동 순환)
- 효과음 / 진동 (설정에서 끄기 가능)

### 3.3 P2 (향후 확장)

- 추측 없이 풀 수 있는 보드(no-guess) 생성
- 연쇄 열기 방식 비교 (재귀 DFS vs 큐 BFS 퍼지는 모양 비교)
- 사용자 지정 보드 크기

### 3.4 제외

- 학생 회원가입/비밀번호 로그인
- 멀티플레이 대전
- 물음표(?) 표시 기능 (조작 단순화를 위해 제외)

---

## 4. 게임 규칙

### 4.1 난이도

모든 기기에서 동일한 보드를 사용해 기록의 공정성을 유지한다.

| 난이도 | 크기 (행×열) | 지뢰 수 | 비고 |
|---|---|---|---|
| 초급 | 9×9 | 10 | 수업 기본 |
| 중급 | 12×12 | 24 | |
| 고급 | 16×16 | 40 | 스마트폰은 보드 스크롤/확대 사용 |

난이도 설정값은 `src/game/levels.ts` 한 곳에서 관리해 쉽게 수정할 수 있어야 한다.

### 4.2 기본 규칙

1. 칸을 열었을 때 지뢰면 패배, 아니면 주변 8칸의 지뢰 수가 숫자로 표시된다.
2. 숫자가 0인 칸(빈칸)을 열면 주변 칸이 자동으로 연쇄해서 열린다.
3. 지뢰가 아닌 모든 칸을 열면 승리한다. (깃발을 모두 꽂을 필요 없음)
4. 깃발은 표시용이며, 깃발이 꽂힌 칸은 실수로 열리지 않는다.

### 4.3 첫 클릭 보호

- 지뢰는 **첫 번째 열기 이후**에 배치한다.
- 첫 클릭한 칸과 그 주변 8칸에는 지뢰를 두지 않는다. (첫 클릭이 항상 빈칸이 되어 일정 영역이 열림)
- 보드 생성은 시드 기반 난수를 사용해 같은 시드면 같은 보드가 나오게 한다. (테스트·재현용)

### 4.4 코드(Chord) 열기

- 이미 열린 숫자 칸을 누르면, 주변 깃발 수가 그 숫자와 같을 때 나머지 주변 칸을 한 번에 연다.
- 깃발 수가 다르면 아무 일도 일어나지 않고 해당 칸 주변을 잠깐 강조한다.
- 깃발을 잘못 꽂은 상태에서 코드 열기로 지뢰를 열면 패배한다.

### 4.5 시간과 종료

- 타이머는 첫 번째 열기 순간 시작, 승리/패배 시 정지한다.
- 화면에는 0.1초 단위로 표시, 기록은 밀리초(ms) 정수로 저장한다.
- 패배 시 모든 지뢰 위치를 공개하고, 잘못 꽂은 깃발은 ❌로 표시한다.
- 게임 중 새로고침·이탈 시 해당 판은 기록하지 않는다.

---

## 5. 조작 방식

### 5.1 기기별 입력

| 동작 | 스마트폰·태블릿 | PC |
|---|---|---|
| 칸 열기 | 탭 | 왼쪽 클릭 |
| 깃발 꽂기/빼기 | 길게 누르기(400ms) 또는 깃발 모드에서 탭 | 오른쪽 클릭 |
| 코드 열기 | 열린 숫자 칸 탭 | 열린 숫자 칸 왼쪽 클릭 |
| 새 게임 | 😊 버튼 | 😊 버튼 또는 `R` 키 |

### 5.2 깃발 모드 토글 버튼

길게 누르기가 익숙하지 않은 학생을 위해 화면 하단에 큰 토글 버튼을 둔다.

- ⛏️ 열기 모드 ↔ 🚩 깃발 모드
- 현재 모드를 버튼 색과 아이콘으로 명확히 표시
- 깃발 모드에서도 길게 누르기는 동일하게 깃발 동작

### 5.3 터치 처리 요구사항

- 보드 영역에서 브라우저 기본 동작 차단: 롱프레스 컨텍스트 메뉴, 텍스트 선택, 더블탭 확대
- 길게 누르기 판정 중 손가락이 10px 이상 움직이면 취소 (스크롤로 간주)
- 길게 누르기로 깃발이 꽂히면 손을 뗄 때 열기 동작이 추가로 발생하지 않아야 함
- 깃발을 꽂을 때 진동 피드백 (`navigator.vibrate` 지원 기기만, 설정에서 끄기 가능)

---

## 6. 화면 구성

### 6.1 화면 흐름

```
[시작] 학번·이름 입력
   ↓
[홈] 난이도 선택 + 내 최고 기록 + 대시보드 바로가기
   ↓
[게임] 보드 플레이
   ↓
[결과] 승리/패배 모달 → 다시하기 / 난이도 변경 / 순위 보기

[대시보드] 난이도별 순위 (누구나 접근)
[교사] Google 로그인 → 기록 관리
```

### 6.2 시작 화면

- 학번 입력: 5자리 숫자, `1`로 시작 (예: 10101 = 1학년 1반 1번)
- 이름 입력: 한글 2~5자
- 학번에서 반 번호를 자동 추출해 확인 문구 표시 ("1학년 1반 1번 이○○ 맞나요?")
- 입력값은 localStorage에 저장해 다음 접속 시 자동 입력, "다른 사람으로 시작" 버튼 제공
- 이미 다른 이름으로 등록된 학번이면 진행을 막고 "선생님께 말씀드리세요" 안내 (6.8 참고)

### 6.3 홈 화면

- 난이도 카드 3개: 보드 크기, 지뢰 수, 내 최고 기록, 내 순위
- 대시보드 버튼
- 설정: 효과음, 진동, 원리 보기 모드(P1)

### 6.4 게임 화면

상단 상태바: 남은 지뢰 수(지뢰 수 − 깃발 수) / 😊 새 게임 버튼 / 타이머

하단 조작바(터치 기기): 깃발 모드 토글, 확대/축소(+/−) 버튼(고급 난이도)

얼굴 버튼 상태: 😊 진행 중 / 😮 누르는 중 / 😎 승리 / 😵 패배

### 6.5 반응형 보드 규칙

- 칸 최소 크기: 터치 기기 36px, PC 28px
- 화면에 다 들어가면 화면 폭에 맞춰 칸 크기를 키움 (최대 48px)
- 다 들어가지 않으면(주로 스마트폰 고급) 보드 컨테이너만 가로·세로 스크롤, 상태바와 조작바는 고정
- +/− 버튼으로 칸 크기 조절 가능 (브라우저 핀치 확대는 사용하지 않음)
- 가로 모드 지원: 상태바와 조작바를 보드 옆으로 배치
- 숫자 색상은 1~8 각각 구분되는 색 사용, 색만으로 구분하지 않도록 숫자 자체도 굵게 표시
- 열린 칸과 닫힌 칸은 명도 차이와 입체감(테두리)으로 명확히 구분

### 6.6 결과 모달

- 승리: 기록 시간, 최고 기록 갱신 여부, 현재 순위, 🎉 효과
- 패배: 격려 문구, 연 칸 비율(%) 표시
- 버튼: 다시 하기 / 난이도 변경 / 순위 보기
- 기록 저장 상태 표시 (저장 중 / 저장 완료 / 저장 실패 → 자동 재시도 중)

### 6.7 대시보드

- 난이도 탭 (초급/중급/고급)
- 순위 기준: 최고 기록(ms) 오름차순, 같으면 먼저 달성한 순
- 표시 항목: 순위, 반, 이름, 최고 기록, 승리 수/도전 수
- 반 필터 (전체 / 1반 / 2반 …)
- 상위 50명 표시 + 내 순위는 목록 밖이어도 하단 고정 표시
- Firestore 실시간 구독(onSnapshot)으로 자동 갱신, 순위가 바뀐 줄은 잠깐 강조
- 이름 마스킹: 교사 설정에 따라 `이승엽` 또는 `이○엽`으로 표시 (기본값: 마스킹)

### 6.8 교사 관리 화면

- Google 계정 로그인, `admins` 컬렉션에 등록된 계정만 접근
- 기록 목록 조회, 개별 기록 삭제
- 학생 등록 정보(학번-이름) 수정·삭제 (이름 오입력, 학번 도용 해결용)
- CSV 내보내기: 학번, 이름, 난이도, 최고 기록, 승리 수, 도전 수, 최종 플레이 시각
- 시즌 관리: 현재 시즌 값 변경으로 순위 초기화 (기존 기록은 삭제하지 않고 보존)
- 설정: 이름 마스킹 on/off, 게임 열기/닫기(수업 외 시간 차단용)
- 교실 TV 모드 버튼 (P1): 큰 글씨, 난이도 탭 자동 순환(10초)

---

## 7. 게임 로직 설계

UI와 분리된 순수 TypeScript 모듈로 작성하고 단위 테스트를 작성한다. 이후 수업에서 "게임 속 알고리즘" 설명 자료로도 활용한다.

### 7.1 데이터 구조

```ts
type CellState = 'hidden' | 'revealed' | 'flagged';

interface Cell {
  mine: boolean;
  adjacent: number;   // 주변 8칸 지뢰 수 (0~8)
  state: CellState;
}

type Board = Cell[][];  // board[row][col]

interface GameState {
  level: LevelId;
  board: Board;
  status: 'ready' | 'playing' | 'won' | 'lost';
  startedAt: number | null;
  endedAt: number | null;
  flags: number;
  revealedCount: number;
  seed: number;
}
```

### 7.2 핵심 함수

| 함수 | 역할 |
|---|---|
| `createEmptyBoard(level)` | 지뢰 없는 빈 보드 생성 |
| `placeMines(board, safeRow, safeCol, seed)` | 첫 클릭 칸과 주변을 제외하고 지뢰 배치 |
| `computeAdjacent(board)` | 모든 칸의 주변 지뢰 수 계산 |
| `getNeighbors(row, col)` | 보드 범위 안의 이웃 좌표 반환 (가장자리·모서리 처리) |
| `reveal(state, row, col)` | 칸 열기, 빈칸이면 연쇄 열기, 승패 판정 |
| `toggleFlag(state, row, col)` | 깃발 토글 |
| `chord(state, row, col)` | 코드 열기 |
| `checkWin(state)` | 지뢰 아닌 칸이 모두 열렸는지 확인 |

### 7.3 연쇄 열기

- 기본 구현은 큐(BFS) 기반 반복문으로 작성해 스택 오버플로를 방지한다.
- 연쇄 과정에서 열린 칸 순서를 배열로 반환하도록 해 원리 보기 모드 애니메이션에 재사용한다.
- 깃발이 꽂힌 칸은 연쇄 열기에서 제외한다.

### 7.4 원리 보기 모드 (P1)

- 설정에서 켜면 연쇄 열기가 한 칸씩 0.1초 간격으로 열리는 애니메이션으로 재생된다.
- 현재 확인 중인 칸을 강조하고, 화면 한쪽에 "빈칸 발견 → 이웃 8칸 확인" 같은 한 줄 설명을 표시한다.
- 원리 보기 모드로 플레이한 판은 기록에 저장하지 않는다.

---

## 8. 데이터 설계 (Firestore)

### 8.1 컬렉션 구조

```
config/app                 앱 설정 (1개 문서)
admins/{uid}               교사 계정 목록 (콘솔에서 직접 등록)
students/{studentId}       학번-이름 등록 정보
records/{season}_{level}_{studentId}   학생별·난이도별 기록 (시즌마다 1개)
```

### 8.2 문서 필드

`config/app`
```ts
{
  season: string;        // 예: "2026-2"
  maskNames: boolean;    // 대시보드 이름 마스킹
  gameOpen: boolean;     // false면 게임 시작 차단
}
```

`students/{studentId}`
```ts
{
  name: string;
  classNo: number;       // 학번에서 추출한 반
  createdAt: Timestamp;
}
```

`records/{season}_{level}_{studentId}`
```ts
{
  season: string;
  level: 'beginner' | 'intermediate' | 'expert';
  studentId: string;
  name: string;
  classNo: number;
  plays: number;              // 도전 횟수 (승+패)
  wins: number;               // 승리 횟수
  bestTimeMs: number | null;  // 최고 기록, 승리 전에는 null
  bestAt: Timestamp | null;   // 최고 기록 달성 시각
  updatedAt: Timestamp;
}
```

### 8.3 쓰기 방식

- 한 판이 끝날 때(승리/패배) 해당 기록 문서를 **트랜잭션으로 1회 갱신**한다.
  - plays +1, 승리면 wins +1
  - 승리이고 기존 기록보다 빠르면 bestTimeMs, bestAt 갱신
- 판마다 문서를 새로 만들지 않아 쓰기·읽기 비용을 무료 한도 안에서 유지한다.
- 저장 실패 시 localStorage 대기열에 보관하고, 네트워크 복구 시 자동 재전송한다.

### 8.4 인덱스

대시보드 조회용 복합 인덱스를 `firestore.indexes.json`에 정의한다.

- `records`: `season ASC, level ASC, bestTimeMs ASC, bestAt ASC`
- `records`: `season ASC, level ASC, classNo ASC, bestTimeMs ASC, bestAt ASC` (반 필터)

`bestTimeMs == null`인 문서는 순위 조회에서 제외되도록 `bestTimeMs > 0` 조건을 함께 사용한다.

---

## 9. 보안과 부정 방지

학생 계정 인증이 없으므로 완벽한 부정 방지는 목표로 하지 않는다. 보안 규칙으로 명백히 비정상적인 값을 막고, 교사가 기록을 확인·삭제할 수 있게 하는 수준으로 관리한다.

### 9.1 보안 규칙 초안 (`firestore.rules`)

Firebase 에뮬레이터로 테스트 후 배포한다.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {

    function isAdmin() {
      return request.auth != null
        && exists(/databases/$(db)/documents/admins/$(request.auth.uid));
    }
    function validStudentId(id) { return id.matches('^1[0-9]{4}$'); }
    function validName(n) { return n is string && n.size() >= 2 && n.size() <= 10; }
    function minTime(level) {
      return {'beginner': 1000, 'intermediate': 3000, 'expert': 8000}[level];
    }

    match /config/{doc} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /admins/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
    }

    match /students/{studentId} {
      allow read: if true;
      allow create: if validStudentId(studentId)
        && validName(request.resource.data.name)
        && request.resource.data.keys().hasOnly(['name', 'classNo', 'createdAt']);
      allow update, delete: if isAdmin();
    }

    match /records/{recordId} {
      function d() { return request.resource.data; }
      function registeredName() {
        return get(/databases/$(db)/documents/students/$(d().studentId)).data.name;
      }
      function common() {
        return recordId == d().season + '_' + d().level + '_' + d().studentId
          && d().level in ['beginner', 'intermediate', 'expert']
          && d().name == registeredName()
          && d().updatedAt == request.time;
      }

      allow read: if true;

      allow create: if common()
        && d().plays == 1
        && ((d().wins == 0 && d().bestTimeMs == null)
          || (d().wins == 1 && d().bestTimeMs is int
              && d().bestTimeMs >= minTime(d().level)));

      allow update: if common()
        && d().studentId == resource.data.studentId
        && d().level == resource.data.level
        && d().season == resource.data.season
        && d().plays == resource.data.plays + 1
        && ((d().wins == resource.data.wins
              && d().bestTimeMs == resource.data.bestTimeMs)
          || (d().wins == resource.data.wins + 1
              && d().bestTimeMs is int
              && d().bestTimeMs >= minTime(d().level)
              && (resource.data.bestTimeMs == null
                  || d().bestTimeMs <= resource.data.bestTimeMs)));

      allow delete: if isAdmin();
    }
  }
}
```

### 9.2 운영 원칙

- 학번-이름은 최초 등록 시 고정되고, 다른 이름으로 같은 학번을 쓰면 차단된다.
- 비정상적으로 빠른 기록은 규칙에서 거절되며, 그 밖의 의심 기록은 교사가 삭제한다.
- 수업 시간에 "개발자 도구로 기록을 조작하면 삭제된다"는 점을 안내한다.

### 9.3 개인정보

- 수집 항목은 학번과 이름만으로 최소화한다.
- 대시보드 이름 마스킹을 기본값으로 한다. (배포 URL은 외부에서도 접근 가능하므로)
- 검색 노출 방지: `<meta name="robots" content="noindex">` 적용
- 학기 종료 후 교사 화면에서 해당 시즌 데이터 일괄 삭제 기능 제공

---

## 10. 비기능 요구사항

| 항목 | 기준 |
|---|---|
| 초기 로딩 | 학교 Wi-Fi 기준 3초 이내 |
| 조작 반응 | 탭 후 칸 열림 100ms 이내, 고급 보드 연쇄 열기도 끊김 없이 |
| 대시보드 갱신 | 기록 저장 후 2초 이내 반영 |
| 오프라인 | 게임 플레이는 네트워크 없이 가능, 기록만 복구 후 전송 |
| 접근성 | 버튼 최소 44px, 숫자 색 대비 확보, 색 외 구분 수단 제공 |
| Firebase 비용 | 무료(Spark) 요금제 한도 내 운영 |

---

## 11. 기술 구조

### 11.1 폴더 구조

```
minesweeper/
├─ src/
│  ├─ game/            # 순수 게임 로직 (UI 의존 없음)
│  │  ├─ levels.ts
│  │  ├─ board.ts
│  │  ├─ rng.ts        # 시드 난수
│  │  └─ board.test.ts
│  ├─ components/      # Board, Cell, StatusBar, ControlBar, ResultModal …
│  ├─ pages/           # Start, Home, Game, Dashboard, Admin
│  ├─ hooks/           # useGame, useLongPress, useRecords …
│  ├─ firebase/        # 초기화, 기록 저장, 대시보드 조회
│  └─ main.tsx
├─ firestore.rules
├─ firestore.indexes.json
├─ .env.example        # VITE_FIREBASE_* 목록
├─ vercel.json         # SPA 라우팅 rewrite
└─ README.md           # 설치, Firebase 설정, 배포 방법
```

### 11.2 배포

- GitHub 저장소 main 브랜치 push → Vercel 자동 배포
- Firebase 설정값은 Vercel 환경 변수(`VITE_FIREBASE_*`)로 관리, 저장소에 커밋하지 않음
- 라우팅: React Router, `vercel.json`에서 모든 경로를 `index.html`로 rewrite
- 보안 규칙·인덱스는 Firebase CLI로 배포 (`firebase deploy --only firestore`)

---

## 12. 개발 단계와 완료 기준

각 단계가 끝나면 실제 기기(스마트폰 1대 이상, PC)로 확인 후 다음 단계로 넘어간다.

### Phase 1. 게임 로직

- `src/game` 모듈과 단위 테스트 작성
- 완료 기준: 첫 클릭 보호 1,000회 반복 테스트 통과, 모서리·가장자리 이웃 계산 테스트 통과, 연쇄 열기·코드 열기·승패 판정 테스트 통과

### Phase 2. PC 플레이

- 게임 화면, 상태바, 타이머, 결과 모달, 난이도 선택 (로컬 전용, Firebase 없음)
- 완료 기준: PC에서 3개 난이도 모두 처음부터 끝까지 플레이 가능

### Phase 3. 터치 기기 대응

- 길게 누르기, 깃발 모드, 반응형 보드, 스크롤·확대, 가로 모드
- 완료 기준: iOS Safari와 Android Chrome에서 오작동(컨텍스트 메뉴, 확대, 깃발 후 열림) 없음

### Phase 4. 학생 등록과 기록 저장

- 시작 화면, `students` 등록, 기록 트랜잭션, 재전송 대기열, 보안 규칙
- 완료 기준: 에뮬레이터에서 보안 규칙 테스트(정상 저장, 느린 기록으로 덮어쓰기 거절, 다른 이름 거절, 최소 시간 미만 거절) 통과

### Phase 5. 대시보드

- 난이도 탭, 반 필터, 실시간 갱신, 내 순위 고정, 이름 마스킹
- 완료 기준: 기기 3대 이상 동시 플레이 시 순위가 실시간 반영

### Phase 6. 교사 관리와 배포

- Google 로그인, 기록 삭제, CSV, 시즌 관리, 설정, GitHub·Vercel 배포, README
- 완료 기준: 배포 URL에서 전체 흐름 동작, 교사 외 계정은 관리 화면 접근 불가

### Phase 7. P1 기능 (선택)

- 원리 보기 모드, 교실 TV 모드, 효과음·진동

---

## 13. 수업 전 점검 체크리스트

- [ ] `config/app`의 season 값이 이번 학기로 설정되어 있다
- [ ] `admins`에 교사 계정 UID가 등록되어 있다
- [ ] `gameOpen`이 true로 되어 있다
- [ ] 교실 TV에 대시보드가 띄워져 있다
- [ ] 스마트폰에서 깃발 모드 버튼 사용법을 시연했다
- [ ] 기록 조작 시 삭제된다는 점을 안내했다

---

## 14. 수업 연계 메모

- 도입: 숫자 "1" 옆에 닫힌 칸이 하나뿐이면 그 칸은 반드시 지뢰라는 추론을 함께 풀어본다.
- 전개: 초급으로 규칙 익히기 → 중급 도전 → 대시보드로 반별 경쟁
- 정리: 원리 보기 모드로 연쇄 열기를 보여주며 "빈칸이면 이웃도 열기"를 반복하는 규칙이 하노이 탑의 재귀와 어떻게 닮았는지 이야기한다.
- 최종 프로젝트 연결: "숫자 대신 이모지를 쓰면?", "지뢰 대신 보물을 찾는다면?"처럼 규칙을 바꿔 자신만의 게임을 구상해 보게 한다.
