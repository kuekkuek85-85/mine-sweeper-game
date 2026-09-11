export interface ControlBarProps {
  flagMode: boolean;
  onToggleFlagMode: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

/** 하단 조작바: 깃발 모드 토글 + 칸 크기 조절 (PRD 5.2 / 6.4) */
export function ControlBar({
  flagMode,
  onToggleFlagMode,
  onZoomIn,
  onZoomOut,
  canZoomIn,
  canZoomOut,
}: ControlBarProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggleFlagMode}
        aria-pressed={flagMode}
        className={[
          'btn flex-1 text-lg',
          flagMode
            ? 'bg-amber-400 text-slate-900 ring-4 ring-amber-300/50'
            : 'bg-slate-700 text-slate-100',
        ].join(' ')}
      >
        <span aria-hidden className="text-2xl">{flagMode ? '🚩' : '⛏️'}</span>
        {flagMode ? '깃발 모드' : '열기 모드'}
      </button>

      <button
        type="button"
        onClick={onZoomOut}
        disabled={!canZoomOut}
        aria-label="칸 작게"
        className="btn-ghost w-12 px-0 text-2xl"
      >
        −
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        disabled={!canZoomIn}
        aria-label="칸 크게"
        className="btn-ghost w-12 px-0 text-2xl"
      >
        +
      </button>
    </div>
  );
}
