/** 게임 상태와 타이머를 관리한다. 규칙 판단은 모두 src/game 의 순수 함수에 맡긴다. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  chord,
  createGame,
  elapsedMs,
  remainingMines,
  reveal,
  toggleFlag,
  type ActionResult,
  type Coord,
  type GameState,
} from '../game/board';
import type { LevelId } from '../game/levels';
import { randomSeed } from '../game/rng';
import { playTone, vibrate } from '../lib/feedback';

/** 원리 보기 모드에서 한 칸씩 열리는 간격(ms) */
const EXPLAIN_STEP_MS = 100;

export interface UseGameOptions {
  sound: boolean;
  vibrate: boolean;
  /** 원리 보기 모드 */
  explain: boolean;
  /** 물음표(?) 표시 사용 */
  questionMark: boolean;
  onFinish?: (state: GameState) => void;
}

export interface UseGame {
  state: GameState;
  elapsed: number;
  remaining: number;
  /** 원리 보기 모드에서 아직 화면에 나타나지 않은 칸 ("row,col") */
  pendingCells: ReadonlySet<string>;
  /** 원리 보기 모드에서 지금 확인 중인 칸 */
  focusCell: Coord | null;
  /** 코드 열기가 막힌 칸 (깃발 수 불일치) */
  blockedCell: Coord | null;
  animating: boolean;
  open: (row: number, col: number) => void;
  flag: (row: number, col: number) => void;
  reset: (level?: LevelId) => void;
}

export function useGame(level: LevelId, options: UseGameOptions): UseGame {
  const { sound, vibrate: vibrateOn, explain, questionMark, onFinish } = options;

  const [state, setState] = useState<GameState>(() => createGame(level, randomSeed()));
  const [now, setNow] = useState(() => Date.now());
  const [pendingCells, setPendingCells] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [focusCell, setFocusCell] = useState<Coord | null>(null);
  const [blockedCell, setBlockedCell] = useState<Coord | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  const finishedRef = useRef(false);
  const animationRef = useRef<number | null>(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const stopAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      window.clearInterval(animationRef.current);
      animationRef.current = null;
    }
    setPendingCells(new Set<string>());
    setFocusCell(null);
  }, []);

  const reset = useCallback(
    (nextLevel: LevelId = level) => {
      stopAnimation();
      finishedRef.current = false;
      setBlockedCell(null);
      setState(createGame(nextLevel, randomSeed()));
      setNow(Date.now());
    },
    [level, stopAnimation],
  );

  // 난이도가 바뀌면 새 판을 시작한다.
  useEffect(() => {
    reset(level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  // 진행 중에만 타이머를 돌린다.
  useEffect(() => {
    if (state.status !== 'playing') return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [state.status]);

  useEffect(() => () => stopAnimation(), [stopAnimation]);

  // 승패가 정해지면 한 번만 알린다.
  useEffect(() => {
    if (state.status !== 'won' && state.status !== 'lost') return;
    if (finishedRef.current) return;
    finishedRef.current = true;
    playTone(state.status === 'won' ? 'win' : 'lose', sound);
    vibrate(state.status === 'won' ? [40, 60, 40] : 200, vibrateOn);
    onFinishRef.current?.(state);
  }, [state, sound, vibrateOn]);

  /** 원리 보기 모드: 열린 칸을 0.1초 간격으로 하나씩 보여 준다. */
  const animateOpened = useCallback(
    (opened: Coord[]) => {
      stopAnimation();
      if (opened.length <= 1) return;

      setPendingCells(new Set(opened.map((c) => `${c.row},${c.col}`)));
      let index = 0;
      animationRef.current = window.setInterval(() => {
        const current = opened[index];
        setFocusCell(current ?? null);
        setPendingCells((previous) => {
          const next = new Set(previous);
          if (current) next.delete(`${current.row},${current.col}`);
          return next;
        });
        index += 1;
        if (index >= opened.length) stopAnimation();
      }, EXPLAIN_STEP_MS);
    },
    [stopAnimation],
  );

  const open = useCallback(
    (row: number, col: number) => {
      const previous = stateRef.current;
      const cell = previous.board[row]?.[col];
      if (!cell) return;

      // 열린 숫자 칸을 누르면 코드 열기로 동작한다. (PC 좌클릭 / 모바일 탭 동일)
      const result: ActionResult =
        cell.state === 'revealed' ? chord(previous, row, col) : reveal(previous, row, col);

      if (result.blocked) {
        setBlockedCell({ row, col });
        playTone('blocked', sound);
        return;
      }
      if (!result.changed) return;

      setBlockedCell(null);
      playTone('open', sound);
      setState(result.state);
      if (explain) animateOpened(result.opened);
    },
    [sound, explain, animateOpened],
  );

  const flag = useCallback(
    (row: number, col: number) => {
      const result = toggleFlag(stateRef.current, row, col, questionMark);
      if (!result.changed) return;
      playTone('flag', sound);
      vibrate(30, vibrateOn);
      setState(result.state);
    },
    [sound, vibrateOn, questionMark],
  );

  // 막힘 강조는 잠깐만 보여 준다.
  useEffect(() => {
    if (!blockedCell) return;
    const timer = window.setTimeout(() => setBlockedCell(null), 400);
    return () => window.clearTimeout(timer);
  }, [blockedCell]);

  const elapsed = useMemo(() => elapsedMs(state, now), [state, now]);

  return {
    state,
    elapsed,
    remaining: remainingMines(state),
    pendingCells,
    focusCell,
    blockedCell,
    animating: pendingCells.size > 0,
    open,
    flag,
    reset,
  };
}
