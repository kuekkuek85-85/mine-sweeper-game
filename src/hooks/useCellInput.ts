/**
 * 보드 입력 처리 (PRD 5.3).
 *
 * - 길게 누르기 400ms → 깃발
 * - 판정 중 손가락이 10px 이상 움직이면 취소 (스크롤로 간주)
 * - 길게 눌러 깃발이 꽂히면 손을 뗄 때 열기가 추가로 일어나지 않는다
 * - PC 오른쪽 클릭 → 깃발, 컨텍스트 메뉴는 막는다
 * - PC 좌+우 동시 누르기(양클릭) → 코드 열기 (Windows 지뢰찾기와 같은 조작)
 *
 * 양클릭만 mousedown 으로 처리하는 이유:
 * 포인터가 이미 눌린 상태에서 두 번째 버튼을 누르면 pointerdown 이 발생하지 않는다.
 * (Pointer Events 명세상 첫 버튼만 pointerdown 을 낸다) mousedown 은 버튼마다 발생한다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

export const LONG_PRESS_MS = 400;
export const MOVE_TOLERANCE_PX = 10;

/** PointerEvent.buttons 에서 좌(1) + 우(2) 가 동시에 눌린 상태 */
const BOTH_BUTTONS = 3;

export interface CellInputHandlers {
  onPointerDown: (event: ReactPointerEvent, row: number, col: number) => void;
  onPointerUp: (event: ReactPointerEvent, row: number, col: number) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
  onPointerCancel: () => void;
  /** 양클릭 감지용. 칸마다 붙인다. */
  onMouseDown: (event: ReactMouseEvent, row: number, col: number) => void;
  onContextMenu: (event: ReactMouseEvent) => void;
  /** 누르고 있는 칸 (😮 얼굴, 칸 눌림 효과용) */
  pressed: { row: number; col: number } | null;
}

export interface CellInputOptions {
  onOpen: (row: number, col: number) => void;
  onFlag: (row: number, col: number) => void;
  /** 양클릭 코드 열기. 열린 숫자 칸에서만 의미가 있다. */
  onChord: (row: number, col: number) => void;
  /** 깃발 모드가 켜져 있으면 탭이 곧 깃발 */
  flagMode: boolean;
  disabled?: boolean;
}

export function useCellInput(options: CellInputOptions): CellInputHandlers {
  const { onOpen, onFlag, onChord, flagMode, disabled = false } = options;

  const [pressed, setPressed] = useState<{ row: number; col: number } | null>(null);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const handledRef = useRef(false);
  /** 양클릭을 처리한 뒤, 두 버튼을 모두 뗄 때까지 열기·깃발을 막는다 */
  const suppressRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent, row: number, col: number) => {
      if (disabled) return;

      // 오른쪽 클릭은 즉시 깃발
      if (event.pointerType === 'mouse' && event.button === 2) {
        handledRef.current = true;
        onFlag(row, col);
        return;
      }
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      handledRef.current = false;
      startRef.current = { x: event.clientX, y: event.clientY };
      setPressed({ row, col });

      if (event.pointerType !== 'mouse') {
        clearTimer();
        timerRef.current = window.setTimeout(() => {
          handledRef.current = true; // 손을 뗄 때 열기가 일어나지 않도록
          setPressed(null);
          onFlag(row, col);
        }, LONG_PRESS_MS);
      }
    },
    [clearTimer, disabled, onFlag],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const start = startRef.current;
      if (!start) return;
      const moved =
        Math.abs(event.clientX - start.x) > MOVE_TOLERANCE_PX ||
        Math.abs(event.clientY - start.y) > MOVE_TOLERANCE_PX;
      if (moved) {
        // 스크롤로 판단 — 길게 누르기와 탭을 모두 취소한다.
        clearTimer();
        handledRef.current = true;
        setPressed(null);
        startRef.current = null;
      }
    },
    [clearTimer],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent, row: number, col: number) => {
      clearTimer();
      setPressed(null);
      startRef.current = null;

      // 양클릭 뒤에는 두 버튼이 모두 떨어질 때까지 아무 일도 하지 않는다.
      if (suppressRef.current) {
        if (event.buttons === 0) suppressRef.current = false;
        return;
      }

      if (disabled) return;
      if (handledRef.current) {
        handledRef.current = false;
        return;
      }
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      if (flagMode) {
        onFlag(row, col);
      } else {
        onOpen(row, col);
      }
    },
    [clearTimer, disabled, flagMode, onFlag, onOpen],
  );

  /** 좌+우 동시 누르기 → 코드 열기 */
  const onMouseDown = useCallback(
    (event: ReactMouseEvent, row: number, col: number) => {
      if (disabled) return;
      if (event.buttons !== BOTH_BUTTONS) return;

      event.preventDefault();
      clearTimer();
      // 두 버튼을 모두 뗄 때까지 열기·깃발이 일어나지 않게 한다.
      suppressRef.current = true;
      handledRef.current = true;
      setPressed(null);
      startRef.current = null;
      onChord(row, col);
    },
    [clearTimer, disabled, onChord],
  );

  const onPointerCancel = useCallback(() => {
    clearTimer();
    setPressed(null);
    startRef.current = null;
    handledRef.current = true;
    suppressRef.current = false;
  }, [clearTimer]);

  const onContextMenu = useCallback((event: ReactMouseEvent) => {
    event.preventDefault();
  }, []);

  return {
    onPointerDown,
    onPointerUp,
    onPointerMove,
    onPointerCancel,
    onMouseDown,
    onContextMenu,
    pressed,
  };
}
