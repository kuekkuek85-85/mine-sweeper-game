/**
 * 보드 입력 처리 (PRD 5.3).
 *
 * - 길게 누르기 400ms → 깃발
 * - 판정 중 손가락이 10px 이상 움직이면 취소 (스크롤로 간주)
 * - 길게 눌러 깃발이 꽂히면 손을 뗄 때 열기가 추가로 일어나지 않는다
 * - PC 오른쪽 클릭 → 깃발, 컨텍스트 메뉴는 막는다
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

export const LONG_PRESS_MS = 400;
export const MOVE_TOLERANCE_PX = 10;

export interface CellInputHandlers {
  onPointerDown: (event: ReactPointerEvent, row: number, col: number) => void;
  onPointerUp: (event: ReactPointerEvent, row: number, col: number) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
  onPointerCancel: () => void;
  onContextMenu: (event: ReactMouseEvent) => void;
  /** 누르고 있는 칸 (😮 얼굴, 칸 눌림 효과용) */
  pressed: { row: number; col: number } | null;
}

export interface CellInputOptions {
  onOpen: (row: number, col: number) => void;
  onFlag: (row: number, col: number) => void;
  /** 깃발 모드가 켜져 있으면 탭이 곧 깃발 */
  flagMode: boolean;
  disabled?: boolean;
}

export function useCellInput(options: CellInputOptions): CellInputHandlers {
  const { onOpen, onFlag, flagMode, disabled = false } = options;

  const [pressed, setPressed] = useState<{ row: number; col: number } | null>(null);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const handledRef = useRef(false);

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

  const onPointerCancel = useCallback(() => {
    clearTimer();
    setPressed(null);
    startRef.current = null;
    handledRef.current = true;
  }, [clearTimer]);

  const onContextMenu = useCallback((event: ReactMouseEvent) => {
    event.preventDefault();
  }, []);

  return { onPointerDown, onPointerUp, onPointerMove, onPointerCancel, onContextMenu, pressed };
}
