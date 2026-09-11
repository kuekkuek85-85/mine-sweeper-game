import { describe, expect, it } from 'vitest';

import {
  chord,
  checkWin,
  computeAdjacent,
  countMines,
  createEmptyBoard,
  createGame,
  elapsedMs,
  getNeighbors,
  isWrongFlag,
  placeMines,
  remainingMines,
  reveal,
  revealedRatio,
  toggleFlag,
  type Board,
  type GameState,
} from './board';
import { LEVELS, type LevelId } from './levels';

/** 테스트 편의를 위해 지뢰 위치를 직접 지정한 판을 만든다. */
function gameWith(level: LevelId, mines: Array<[number, number]>): GameState {
  const state = createGame(level, 1);
  const board = createEmptyBoard(level);
  for (const [row, col] of mines) board[row][col].mine = true;
  return { ...state, board: computeAdjacent(board), status: 'playing', startedAt: 0 };
}

function findMines(board: Board): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  board.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell.mine) result.push([r, c]);
    }),
  );
  return result;
}

describe('levels', () => {
  it('PRD의 난이도 설정값을 그대로 가진다', () => {
    expect(LEVELS.beginner).toMatchObject({ rows: 9, cols: 9, mines: 10 });
    expect(LEVELS.intermediate).toMatchObject({ rows: 12, cols: 12, mines: 24 });
    expect(LEVELS.expert).toMatchObject({ rows: 16, cols: 16, mines: 40 });
  });
});

describe('createEmptyBoard', () => {
  it('난이도 크기대로 만들어지고 모든 칸이 닫혀 있다', () => {
    const board = createEmptyBoard('intermediate');
    expect(board).toHaveLength(12);
    expect(board[0]).toHaveLength(12);
    expect(board.flat().every((cell) => cell.state === 'hidden' && !cell.mine)).toBe(true);
  });
});

describe('getNeighbors', () => {
  const board = createEmptyBoard('beginner');

  it('가운데 칸은 이웃이 8개', () => {
    expect(getNeighbors(board, 4, 4)).toHaveLength(8);
  });

  it('모서리 칸은 이웃이 3개', () => {
    expect(getNeighbors(board, 0, 0)).toHaveLength(3);
    expect(getNeighbors(board, 0, 8)).toHaveLength(3);
    expect(getNeighbors(board, 8, 0)).toHaveLength(3);
    expect(getNeighbors(board, 8, 8)).toHaveLength(3);
  });

  it('가장자리 칸은 이웃이 5개', () => {
    expect(getNeighbors(board, 0, 4)).toHaveLength(5);
    expect(getNeighbors(board, 8, 4)).toHaveLength(5);
    expect(getNeighbors(board, 4, 0)).toHaveLength(5);
    expect(getNeighbors(board, 4, 8)).toHaveLength(5);
  });

  it('보드 밖 좌표는 돌려주지 않는다', () => {
    for (const { row, col } of getNeighbors(board, 0, 0)) {
      expect(row).toBeGreaterThanOrEqual(0);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(9);
      expect(col).toBeLessThan(9);
    }
  });
});

describe('computeAdjacent', () => {
  it('주변 8칸의 지뢰 수를 센다', () => {
    const board = createEmptyBoard('beginner');
    board[0][0].mine = true;
    board[0][1].mine = true;
    const computed = computeAdjacent(board);
    expect(computed[1][1].adjacent).toBe(2);
    expect(computed[1][0].adjacent).toBe(2);
    expect(computed[0][2].adjacent).toBe(1);
    expect(computed[5][5].adjacent).toBe(0);
  });

  it('지뢰 칸 자신도 주변 지뢰 수를 가진다', () => {
    const board = createEmptyBoard('beginner');
    board[3][3].mine = true;
    board[3][4].mine = true;
    expect(computeAdjacent(board)[3][3].adjacent).toBe(1);
  });
});

describe('placeMines — 첫 클릭 보호', () => {
  it('1,000회 반복해도 첫 클릭 칸과 주변 8칸에는 지뢰가 없다', () => {
    for (let seed = 0; seed < 1000; seed += 1) {
      const level: LevelId = (['beginner', 'intermediate', 'expert'] as const)[seed % 3];
      const { rows, cols, mines } = LEVELS[level];
      const safeRow = seed % rows;
      const safeCol = (seed * 7) % cols;

      const board = placeMines(createEmptyBoard(level), safeRow, safeCol, seed, mines);

      expect(countMines(board)).toBe(mines);
      expect(board[safeRow][safeCol].mine).toBe(false);
      expect(board[safeRow][safeCol].adjacent).toBe(0);
      for (const n of getNeighbors(board, safeRow, safeCol)) {
        expect(board[n.row][n.col].mine).toBe(false);
      }
    }
  });

  it('같은 시드 + 같은 첫 클릭이면 같은 보드가 나온다', () => {
    const a = placeMines(createEmptyBoard('expert'), 5, 5, 20260911, 40);
    const b = placeMines(createEmptyBoard('expert'), 5, 5, 20260911, 40);
    expect(findMines(a)).toEqual(findMines(b));
  });

  it('시드가 다르면 보드가 달라진다', () => {
    const a = placeMines(createEmptyBoard('expert'), 5, 5, 1, 40);
    const b = placeMines(createEmptyBoard('expert'), 5, 5, 2, 40);
    expect(findMines(a)).not.toEqual(findMines(b));
  });
});

describe('reveal', () => {
  it('첫 열기에 지뢰가 배치되고 타이머가 시작된다', () => {
    const start = createGame('beginner', 42);
    expect(start.status).toBe('ready');
    expect(countMines(start.board)).toBe(0);

    const { state } = reveal(start, 4, 4, 1_000);
    expect(state.status).toBe('playing');
    expect(state.startedAt).toBe(1_000);
    expect(countMines(state.board)).toBe(10);
    expect(state.board[4][4].state).toBe('revealed');
  });

  it('첫 열기는 항상 빈칸이라 여러 칸이 함께 열린다', () => {
    const { state, opened } = reveal(createGame('beginner', 7), 4, 4, 0);
    expect(opened.length).toBeGreaterThanOrEqual(9);
    expect(state.revealedCount).toBe(opened.length);
  });

  it('빈칸이 아니면 그 칸만 열린다', () => {
    // (0,0)만 지뢰 → (1,1)은 숫자 1
    const game = gameWith('beginner', [[0, 0]]);
    const { state, opened } = reveal(game, 1, 1, 0);
    expect(opened).toEqual([{ row: 1, col: 1 }]);
    expect(state.board[1][1].adjacent).toBe(1);
  });

  it('연쇄 열기는 깃발이 꽂힌 칸을 열지 않는다', () => {
    const game = gameWith('beginner', [[8, 8]]);
    const flagged = toggleFlag(game, 0, 1).state;
    const { state, opened } = reveal(flagged, 0, 0, 0);
    expect(state.board[0][1].state).toBe('flagged');
    expect(opened.some((c) => c.row === 0 && c.col === 1)).toBe(false);
  });

  it('깃발이 꽂힌 칸은 직접 눌러도 열리지 않는다', () => {
    const game = gameWith('beginner', [[0, 0]]);
    const flagged = toggleFlag(game, 3, 3).state;
    const result = reveal(flagged, 3, 3, 0);
    expect(result.changed).toBe(false);
    expect(result.state.board[3][3].state).toBe('flagged');
  });

  it('지뢰를 열면 패배하고 모든 지뢰가 공개된다', () => {
    const game = gameWith('beginner', [
      [0, 0],
      [5, 5],
    ]);
    const { state } = reveal(game, 0, 0, 2_000);
    expect(state.status).toBe('lost');
    expect(state.endedAt).toBe(2_000);
    expect(state.explodedAt).toEqual({ row: 0, col: 0 });
    expect(state.board[5][5].state).toBe('revealed');
  });

  it('패배 후에는 더 이상 열리지 않는다', () => {
    const lost = reveal(gameWith('beginner', [[0, 0]]), 0, 0, 0).state;
    expect(reveal(lost, 4, 4, 0).changed).toBe(false);
  });

  it('원래 상태를 바꾸지 않는다', () => {
    const game = gameWith('beginner', [[0, 0]]);
    const before = JSON.stringify(game);
    reveal(game, 4, 4, 0);
    expect(JSON.stringify(game)).toBe(before);
  });

  it('보드 밖 좌표는 무시한다', () => {
    const game = gameWith('beginner', [[0, 0]]);
    expect(reveal(game, -1, 0, 0).changed).toBe(false);
    expect(reveal(game, 0, 99, 0).changed).toBe(false);
  });
});

describe('연쇄 열기 (BFS)', () => {
  it('지뢰가 하나뿐이면 빈칸에서 거의 모든 칸이 열린다', () => {
    const game = gameWith('beginner', [[0, 0]]);
    const { state } = reveal(game, 8, 8, 0);
    // 지뢰 1개를 뺀 80칸이 모두 열린다
    expect(state.revealedCount).toBe(80);
    expect(state.status).toBe('won');
  });

  it('큰 보드에서도 스택 오버플로 없이 동작한다', () => {
    const game = gameWith('expert', [[0, 0]]);
    const { state } = reveal(game, 15, 15, 0);
    expect(state.revealedCount).toBe(16 * 16 - 1);
  });

  it('열린 순서를 배열로 돌려준다 (원리 보기 모드용)', () => {
    const game = gameWith('beginner', [[0, 0]]);
    const { opened } = reveal(game, 8, 8, 0);
    expect(opened[0]).toEqual({ row: 8, col: 8 });
    expect(new Set(opened.map((c) => `${c.row},${c.col}`)).size).toBe(opened.length);
  });
});

describe('toggleFlag', () => {
  it('깃발을 꽂고 뺄 수 있다', () => {
    const game = gameWith('beginner', [[0, 0]]);
    const flagged = toggleFlag(game, 3, 3).state;
    expect(flagged.board[3][3].state).toBe('flagged');
    expect(flagged.flags).toBe(1);
    expect(remainingMines(flagged)).toBe(9);

    const unflagged = toggleFlag(flagged, 3, 3).state;
    expect(unflagged.board[3][3].state).toBe('hidden');
    expect(unflagged.flags).toBe(0);
  });

  it('열린 칸에는 깃발을 꽂을 수 없다', () => {
    const game = gameWith('beginner', [[0, 0]]);
    const opened = reveal(game, 1, 1, 0).state;
    expect(toggleFlag(opened, 1, 1).changed).toBe(false);
  });

  it('끝난 판에서는 깃발을 바꿀 수 없다', () => {
    const lost = reveal(gameWith('beginner', [[0, 0]]), 0, 0, 0).state;
    expect(toggleFlag(lost, 4, 4).changed).toBe(false);
  });
});

describe('chord (코드 열기)', () => {
  function twoMineGame() {
    // (0,0), (0,2) 지뢰 → (1,1)의 숫자는 2
    return gameWith('beginner', [
      [0, 0],
      [0, 2],
    ]);
  }

  it('깃발 수가 숫자와 같으면 나머지 주변 칸이 한 번에 열린다', () => {
    let state = twoMineGame();
    state = reveal(state, 1, 1, 0).state;
    expect(state.board[1][1].adjacent).toBe(2);
    state = toggleFlag(state, 0, 0).state;
    state = toggleFlag(state, 0, 2).state;

    const result = chord(state, 1, 1, 0);
    expect(result.blocked).toBe(false);
    expect(result.state.board[0][1].state).toBe('revealed');
    expect(result.state.board[2][0].state).toBe('revealed');
  });

  it('깃발 수가 다르면 아무 일도 일어나지 않고 blocked 를 알린다', () => {
    let state = twoMineGame();
    state = reveal(state, 1, 1, 0).state;
    state = toggleFlag(state, 0, 0).state;

    const result = chord(state, 1, 1, 0);
    expect(result.blocked).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.state.board[0][1].state).toBe('hidden');
  });

  it('깃발을 잘못 꽂은 채 코드 열기를 하면 패배한다', () => {
    let state = twoMineGame();
    state = reveal(state, 1, 1, 0).state;
    state = toggleFlag(state, 0, 0).state;
    state = toggleFlag(state, 1, 0).state; // 지뢰가 아닌 칸에 잘못 꽂음

    const result = chord(state, 1, 1, 5_000);
    expect(result.state.status).toBe('lost');
    expect(result.state.explodedAt).toEqual({ row: 0, col: 2 });
    expect(isWrongFlag(result.state, 1, 0)).toBe(true);
    expect(isWrongFlag(result.state, 0, 0)).toBe(false);
  });

  it('닫힌 칸이나 빈칸(0)에서는 동작하지 않는다', () => {
    const state = twoMineGame();
    expect(chord(state, 1, 1, 0).changed).toBe(false); // 닫힌 칸
    const opened = reveal(state, 8, 8, 0).state;
    expect(chord(opened, 8, 8, 0).blocked).toBe(false);
    expect(chord(opened, 8, 8, 0).changed).toBe(false);
  });

  it('코드 열기로 마지막 칸이 열리면 승리한다', () => {
    // 9x9에 지뢰 1개(0,0). (1,1)을 열고 (0,0)에 깃발 → 코드 열기로 전부 열림
    let state = gameWith('beginner', [[0, 0]]);
    state = reveal(state, 1, 1, 0).state;
    state = toggleFlag(state, 0, 0).state;
    const result = chord(state, 1, 1, 9_000);
    expect(result.state.status).toBe('won');
    expect(result.state.endedAt).toBe(9_000);
  });
});

describe('승패 판정', () => {
  it('지뢰가 아닌 칸을 모두 열면 승리한다 (깃발 불필요)', () => {
    let state = gameWith('beginner', [[0, 0]]);
    state = reveal(state, 8, 8, 0).state;
    expect(checkWin(state)).toBe(true);
    expect(state.status).toBe('won');
    expect(state.flags).toBe(1); // 승리 시 남은 지뢰에 자동 깃발
    expect(remainingMines(state)).toBe(9);
  });

  it('승리 시각이 기록된다', () => {
    const state = reveal(gameWith('beginner', [[0, 0]]), 8, 8, 12_345).state;
    expect(state.endedAt).toBe(12_345);
    expect(elapsedMs(state)).toBe(12_345);
  });

  it('패배 시 연 칸 비율을 알 수 있다', () => {
    const game = gameWith('beginner', [
      [0, 0],
      [8, 8],
    ]);
    const opened = reveal(game, 1, 1, 0).state;
    const lost = reveal(opened, 0, 0, 0).state;
    expect(lost.status).toBe('lost');
    expect(revealedRatio(lost)).toBeCloseTo(1 / 79, 5);
  });
});

describe('시간 계산', () => {
  it('시작 전에는 0', () => {
    expect(elapsedMs(createGame('beginner', 1), 5_000)).toBe(0);
  });

  it('진행 중에는 now 기준으로 흐른다', () => {
    const state = reveal(createGame('beginner', 1), 4, 4, 1_000).state;
    expect(elapsedMs(state, 3_500)).toBe(2_500);
  });
});

describe('전체 판 시뮬레이션', () => {
  it('임의의 시드로 지뢰가 아닌 칸을 모두 열면 항상 승리한다', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      let state = createGame('beginner', seed);
      state = reveal(state, 4, 4, 0).state;

      for (let row = 0; row < 9 && state.status === 'playing'; row += 1) {
        for (let col = 0; col < 9 && state.status === 'playing'; col += 1) {
          if (!state.board[row][col].mine) {
            state = reveal(state, row, col, 100).state;
          }
        }
      }

      expect(state.status).toBe('won');
      expect(state.revealedCount).toBe(81 - 10);
    }
  });
});
