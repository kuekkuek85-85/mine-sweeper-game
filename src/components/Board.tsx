import { isWrongFlag, type Coord, type GameState } from '../game/board';
import type { CellInputHandlers } from '../hooks/useCellInput';
import { Cell } from './Cell';

export interface BoardProps {
  state: GameState;
  size: number;
  /** 입력 처리는 게임 화면에서 만들어 넘긴다. (얼굴 버튼이 누름 상태를 함께 쓰기 때문) */
  input: CellInputHandlers;
  pendingCells: ReadonlySet<string>;
  focusCell: Coord | null;
  blockedCell: Coord | null;
}

export function Board({ state, size, input, pendingCells, focusCell, blockedCell }: BoardProps) {
  return (
    <div
      className="no-touch-gestures inline-block rounded-lg bg-slate-600 p-1 shadow-xl"
      role="grid"
      aria-label="지뢰찾기 보드"
      onContextMenu={input.onContextMenu}
      onPointerMove={input.onPointerMove}
      onPointerLeave={input.onPointerCancel}
      onPointerCancel={input.onPointerCancel}
    >
      {state.board.map((row, rowIndex) => (
        <div key={rowIndex} className="flex" role="row">
          {row.map((cell, colIndex) => (
            <div
              key={colIndex}
              onPointerDown={(event) => input.onPointerDown(event, rowIndex, colIndex)}
              onPointerUp={(event) => input.onPointerUp(event, rowIndex, colIndex)}
              onMouseDown={(event) => input.onMouseDown(event, rowIndex, colIndex)}
            >
              <Cell
                cell={cell}
                row={rowIndex}
                col={colIndex}
                size={size}
                wrongFlag={isWrongFlag(state, rowIndex, colIndex)}
                exploded={state.explodedAt?.row === rowIndex && state.explodedAt?.col === colIndex}
                pending={pendingCells.has(`${rowIndex},${colIndex}`)}
                focused={focusCell?.row === rowIndex && focusCell?.col === colIndex}
                blocked={blockedCell?.row === rowIndex && blockedCell?.col === colIndex}
                pressed={input.pressed?.row === rowIndex && input.pressed?.col === colIndex}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
