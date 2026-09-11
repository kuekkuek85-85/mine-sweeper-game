/**
 * 지뢰찾기 게임 로직 (순수 모듈).
 *
 * - UI나 Firebase에 전혀 의존하지 않는다.
 * - 모든 동작 함수는 원래 상태를 바꾸지 않고 새 상태를 돌려준다.
 * - 연쇄 열기는 큐(BFS) 기반 반복문이라 보드가 커져도 스택 오버플로가 없다.
 */

import { getLevel, type LevelId } from './levels';
import { createRng, shuffle } from './rng';

export type CellState = 'hidden' | 'revealed' | 'flagged';

export interface Cell {
  mine: boolean;
  /** 주변 8칸의 지뢰 수 (0~8) */
  adjacent: number;
  state: CellState;
}

export type Board = Cell[][]; // board[row][col]

export type GameStatus = 'ready' | 'playing' | 'won' | 'lost';

export interface Coord {
  row: number;
  col: number;
}

export interface GameState {
  level: LevelId;
  board: Board;
  status: GameStatus;
  /** 첫 열기 시각(ms). 아직 시작 전이면 null */
  startedAt: number | null;
  /** 승리/패배 시각(ms) */
  endedAt: number | null;
  flags: number;
  revealedCount: number;
  seed: number;
  /** 패배를 일으킨 칸 (UI 강조용) */
  explodedAt: Coord | null;
}

export interface ActionResult {
  state: GameState;
  /** 이번 동작으로 열린 칸을 열린 순서대로 담는다. 원리 보기 모드 애니메이션에 사용. */
  opened: Coord[];
  /** 상태가 실제로 바뀌었는지 */
  changed: boolean;
  /** 코드 열기에서 깃발 수가 맞지 않아 아무 일도 일어나지 않은 경우 */
  blocked: boolean;
}

/** 주변 8방향 */
const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export function createEmptyBoard(level: LevelId): Board {
  const { rows, cols } = getLevel(level);
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, (): Cell => ({ mine: false, adjacent: 0, state: 'hidden' })),
  );
}

export function createGame(level: LevelId, seed: number): GameState {
  return {
    level,
    board: createEmptyBoard(level),
    status: 'ready',
    startedAt: null,
    endedAt: null,
    flags: 0,
    revealedCount: 0,
    seed,
    explodedAt: null,
  };
}

/** 보드 범위 안의 이웃 좌표만 돌려준다. 가장자리·모서리에서도 안전하다. */
export function getNeighbors(board: Board, row: number, col: number): Coord[] {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const result: Coord[] = [];
  for (const [dr, dc] of DIRECTIONS) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      result.push({ row: r, col: c });
    }
  }
  return result;
}

export function inBounds(board: Board, row: number, col: number): boolean {
  return row >= 0 && row < board.length && col >= 0 && col < (board[0]?.length ?? 0);
}

/**
 * 첫 클릭 칸과 그 주변 8칸을 제외하고 지뢰를 배치한다.
 * 같은 시드 + 같은 첫 클릭이면 항상 같은 보드가 나온다.
 */
export function placeMines(
  board: Board,
  safeRow: number,
  safeCol: number,
  seed: number,
  mineCount: number,
): Board {
  const next = cloneBoard(board);
  const rows = next.length;
  const cols = next[0]?.length ?? 0;

  const safe = new Set<number>([safeRow * cols + safeCol]);
  for (const { row, col } of getNeighbors(next, safeRow, safeCol)) {
    safe.add(row * cols + col);
  }

  let candidates: number[] = [];
  for (let i = 0; i < rows * cols; i += 1) {
    if (!safe.has(i)) candidates.push(i);
  }

  // 보드가 아주 작아 안전 영역을 빼면 지뢰를 다 놓을 수 없는 경우,
  // 첫 클릭 칸만 지키고 주변은 후보로 되돌린다.
  if (candidates.length < mineCount) {
    candidates = [];
    for (let i = 0; i < rows * cols; i += 1) {
      if (i !== safeRow * cols + safeCol) candidates.push(i);
    }
  }

  const picked = shuffle(candidates, createRng(seed)).slice(0, Math.min(mineCount, candidates.length));
  for (const index of picked) {
    next[Math.floor(index / cols)][index % cols].mine = true;
  }

  return computeAdjacent(next);
}

/** 모든 칸의 주변 지뢰 수를 계산한 새 보드를 돌려준다. */
export function computeAdjacent(board: Board): Board {
  const next = cloneBoard(board);
  for (let row = 0; row < next.length; row += 1) {
    for (let col = 0; col < next[row].length; col += 1) {
      let count = 0;
      for (const n of getNeighbors(next, row, col)) {
        if (next[n.row][n.col].mine) count += 1;
      }
      next[row][col].adjacent = count;
    }
  }
  return next;
}

export function countMines(board: Board): number {
  let count = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.mine) count += 1;
    }
  }
  return count;
}

/** 지뢰가 아닌 칸이 모두 열렸는지 확인한다. (깃발은 상관없음) */
export function checkWin(state: GameState): boolean {
  return state.status !== 'ready' && state.revealedCount === safeCellCount(state.board);
}

/** 열어야 하는 칸(지뢰가 아닌 칸)의 개수 */
export function safeCellCount(board: Board): number {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  return rows * cols - countMines(board);
}

/**
 * 칸 열기.
 * - 첫 열기면 그때 지뢰를 배치하고 타이머를 시작한다.
 * - 빈칸(0)이면 큐 기반으로 연쇄해서 연다.
 * - 깃발이 꽂힌 칸은 열리지 않고, 연쇄 열기에서도 제외된다.
 */
export function reveal(state: GameState, row: number, col: number, now: number = Date.now()): ActionResult {
  if (!inBounds(state.board, row, col)) return unchanged(state);
  if (state.status === 'won' || state.status === 'lost') return unchanged(state);

  const cellBefore = state.board[row][col];
  if (cellBefore.state !== 'hidden') return unchanged(state);

  let next: GameState = { ...state };

  if (next.status === 'ready') {
    const { mines } = getLevel(next.level);
    next.board = placeMines(next.board, row, col, next.seed, mines);
    next.status = 'playing';
    next.startedAt = now;
  } else {
    next.board = cloneBoard(next.board);
  }

  const opened: Coord[] = [];

  if (next.board[row][col].mine) {
    next.board[row][col].state = 'revealed';
    next.explodedAt = { row, col };
    return { state: finishLost(next, now), opened: [{ row, col }], changed: true, blocked: false };
  }

  floodReveal(next, [{ row, col }], opened);
  next.revealedCount += opened.length;

  if (checkWin(next)) {
    next = finishWon(next, now);
  }

  return { state: next, opened, changed: opened.length > 0, blocked: false };
}

/** 깃발 토글. 판이 끝난 뒤에는 동작하지 않는다. */
export function toggleFlag(state: GameState, row: number, col: number): ActionResult {
  if (!inBounds(state.board, row, col)) return unchanged(state);
  if (state.status !== 'playing' && state.status !== 'ready') return unchanged(state);

  const cell = state.board[row][col];
  if (cell.state === 'revealed') return unchanged(state);

  const next: GameState = { ...state, board: cloneBoard(state.board) };
  if (cell.state === 'flagged') {
    next.board[row][col].state = 'hidden';
    next.flags -= 1;
  } else {
    next.board[row][col].state = 'flagged';
    next.flags += 1;
  }
  return { state: next, opened: [], changed: true, blocked: false };
}

/**
 * 코드(chord) 열기.
 * 열린 숫자 칸 주변의 깃발 수가 그 숫자와 같으면 나머지 주변 칸을 한 번에 연다.
 * 깃발 수가 다르면 아무 일도 일어나지 않고 blocked=true 를 돌려준다. (UI에서 잠깐 강조)
 */
export function chord(state: GameState, row: number, col: number, now: number = Date.now()): ActionResult {
  if (!inBounds(state.board, row, col)) return unchanged(state);
  if (state.status !== 'playing') return unchanged(state);

  const cell = state.board[row][col];
  if (cell.state !== 'revealed' || cell.adjacent === 0) return unchanged(state);

  const neighbors = getNeighbors(state.board, row, col);
  const flagged = neighbors.filter((n) => state.board[n.row][n.col].state === 'flagged').length;
  if (flagged !== cell.adjacent) {
    return { state, opened: [], changed: false, blocked: true };
  }

  const targets = neighbors.filter((n) => state.board[n.row][n.col].state === 'hidden');
  if (targets.length === 0) return unchanged(state);

  let next: GameState = { ...state, board: cloneBoard(state.board) };

  // 깃발을 잘못 꽂았다면 여기서 지뢰가 열리고 패배한다.
  const mineHit = targets.find((n) => next.board[n.row][n.col].mine);
  if (mineHit) {
    const opened: Coord[] = [];
    for (const n of targets) {
      if (next.board[n.row][n.col].mine) {
        next.board[n.row][n.col].state = 'revealed';
        opened.push(n);
      }
    }
    next.explodedAt = mineHit;
    return { state: finishLost(next, now), opened, changed: true, blocked: false };
  }

  const opened: Coord[] = [];
  floodReveal(next, targets, opened);
  next.revealedCount += opened.length;

  if (checkWin(next)) {
    next = finishWon(next, now);
  }

  return { state: next, opened, changed: opened.length > 0, blocked: false };
}

/** 남은 지뢰 표시용: 지뢰 수 − 깃발 수 */
export function remainingMines(state: GameState): number {
  return getLevel(state.level).mines - state.flags;
}

/** 진행률(연 칸 / 열어야 할 칸) — 패배 화면에서 사용 */
export function revealedRatio(state: GameState): number {
  const total = safeCellCount(state.board);
  return total <= 0 ? 0 : state.revealedCount / total;
}

/** 경과 시간(ms). 진행 중이면 now 기준. */
export function elapsedMs(state: GameState, now: number = Date.now()): number {
  if (state.startedAt === null) return 0;
  return (state.endedAt ?? now) - state.startedAt;
}

/** 패배 후 잘못 꽂은 깃발인지 */
export function isWrongFlag(state: GameState, row: number, col: number): boolean {
  const cell = state.board[row][col];
  return state.status === 'lost' && cell.state === 'flagged' && !cell.mine;
}

// ---------------------------------------------------------------------------
// 내부 헬퍼
// ---------------------------------------------------------------------------

function unchanged(state: GameState): ActionResult {
  return { state, opened: [], changed: false, blocked: false };
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

/**
 * 큐(BFS) 연쇄 열기. next.board 를 직접 수정하고, 열린 순서를 opened 에 쌓는다.
 * 규칙: "빈칸(0)이면 이웃 8칸도 연다"를 더 열 칸이 없을 때까지 반복.
 */
function floodReveal(next: GameState, starts: Coord[], opened: Coord[]): void {
  const board = next.board;
  const cols = board[0]?.length ?? 0;
  const queued = new Set<number>();
  const queue: Coord[] = [];

  for (const start of starts) {
    const key = start.row * cols + start.col;
    if (board[start.row][start.col].state === 'hidden' && !queued.has(key)) {
      queued.add(key);
      queue.push(start);
    }
  }

  for (let head = 0; head < queue.length; head += 1) {
    const { row, col } = queue[head];
    const cell = board[row][col];
    if (cell.state !== 'hidden') continue;

    cell.state = 'revealed';
    opened.push({ row, col });

    if (cell.adjacent !== 0) continue;

    for (const n of getNeighbors(board, row, col)) {
      const key = n.row * cols + n.col;
      const neighbor = board[n.row][n.col];
      // 깃발이 꽂힌 칸은 연쇄 열기에서 제외한다.
      if (neighbor.state === 'hidden' && !queued.has(key)) {
        queued.add(key);
        queue.push(n);
      }
    }
  }
}

function finishLost(next: GameState, now: number): GameState {
  const board = next.board;
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const cell = board[row][col];
      // 지뢰는 모두 공개한다. 단, 깃발을 꽂아 맞힌 칸은 깃발 그대로 둔다.
      if (cell.mine && cell.state === 'hidden') {
        cell.state = 'revealed';
      }
    }
  }
  return { ...next, status: 'lost', endedAt: now };
}

function finishWon(next: GameState, now: number): GameState {
  const board = next.board;
  let flags = 0;
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const cell = board[row][col];
      // 승리하면 남은 지뢰에 자동으로 깃발을 꽂아 보여 준다.
      if (cell.mine) {
        cell.state = 'flagged';
      }
      if (cell.state === 'flagged') flags += 1;
    }
  }
  return { ...next, status: 'won', endedAt: now, flags };
}
