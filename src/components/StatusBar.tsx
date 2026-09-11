import type { GameStatus } from '../game/board';
import { formatSeconds } from '../lib/format';

const FACE: Record<GameStatus | 'pressing', string> = {
  ready: '😊',
  playing: '😊',
  pressing: '😮',
  won: '😎',
  lost: '😵',
};

export interface StatusBarProps {
  remaining: number;
  elapsedMs: number;
  status: GameStatus;
  pressing: boolean;
  onReset: () => void;
}

export function StatusBar({ remaining, elapsedMs, status, pressing, onReset }: StatusBarProps) {
  const face = pressing && (status === 'ready' || status === 'playing') ? FACE.pressing : FACE[status];

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-800 px-3 py-2 shadow-lg">
      <div className="flex items-center gap-1">
        <span aria-hidden className="text-xl">💣</span>
        <span className="lcd" aria-label="남은 지뢰 수">
          {String(Math.max(-99, Math.min(999, remaining))).padStart(2, '0')}
        </span>
      </div>

      <button
        type="button"
        onClick={onReset}
        aria-label="새 게임"
        title="새 게임 (R)"
        className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-slate-500 bg-slate-700 text-2xl active:scale-95"
      >
        {face}
      </button>

      <div className="flex items-center gap-1">
        <span aria-hidden className="text-xl">⏱️</span>
        <span className="lcd" aria-label="경과 시간">
          {formatSeconds(elapsedMs)}
        </span>
      </div>
    </div>
  );
}
