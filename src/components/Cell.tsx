import { memo } from 'react';

import type { Cell as CellData } from '../game/board';

export interface CellProps {
  cell: CellData;
  row: number;
  col: number;
  size: number;
  /** 패배 후 잘못 꽂은 깃발 */
  wrongFlag: boolean;
  /** 패배를 일으킨 칸 */
  exploded: boolean;
  /** 원리 보기 모드에서 아직 나타나지 않은 칸 */
  pending: boolean;
  /** 원리 보기 모드에서 지금 확인 중인 칸 */
  focused: boolean;
  /** 코드 열기가 막혀 잠깐 강조되는 칸 */
  blocked: boolean;
  pressed: boolean;
}

function CellView({
  cell,
  row,
  col,
  size,
  wrongFlag,
  exploded,
  pending,
  focused,
  blocked,
  pressed,
}: CellProps) {
  // 원리 보기 모드에서는 아직 순서가 오지 않은 칸을 닫힌 것처럼 보여 준다.
  const revealed = cell.state === 'revealed' && !pending;
  const flagged = cell.state === 'flagged';

  const base =
    'relative flex select-none items-center justify-center font-bold leading-none transition-colors';

  const look = revealed
    ? exploded
      ? 'bg-rose-500 text-white'
      : 'bg-slate-200 text-slate-900 border border-slate-300'
    : [
        'border-t-[3px] border-l-[3px] border-b-[3px] border-r-[3px]',
        'border-t-slate-300 border-l-slate-300 border-b-slate-600 border-r-slate-600',
        pressed ? 'bg-slate-400' : 'bg-slate-400/90 hover:bg-slate-300',
      ].join(' ');

  const fontSize = Math.max(12, Math.round(size * 0.56));

  return (
    <div
      role="gridcell"
      aria-label={cellLabel(cell, revealed, flagged, wrongFlag)}
      data-row={row}
      data-col={col}
      className={[
        base,
        look,
        focused ? 'ring-2 ring-amber-400 ring-offset-0 z-10' : '',
        blocked ? 'animate-shake ring-2 ring-amber-300 z-10' : '',
      ].join(' ')}
      style={{ width: size, height: size, fontSize }}
    >
      {flagged && !wrongFlag && <span aria-hidden>🚩</span>}
      {wrongFlag && <span aria-hidden>❌</span>}
      {revealed && cell.mine && <span aria-hidden>💣</span>}
      {revealed && !cell.mine && cell.adjacent > 0 && (
        <span className={`n-${cell.adjacent}`}>{cell.adjacent}</span>
      )}
    </div>
  );
}

function cellLabel(cell: CellData, revealed: boolean, flagged: boolean, wrongFlag: boolean): string {
  if (wrongFlag) return '잘못 꽂은 깃발';
  if (flagged) return '깃발';
  if (!revealed) return '닫힌 칸';
  if (cell.mine) return '지뢰';
  return cell.adjacent === 0 ? '빈 칸' : `숫자 ${cell.adjacent}`;
}

export const Cell = memo(CellView);
