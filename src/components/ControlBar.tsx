export interface ControlBarProps {
  flagMode: boolean;
  onToggleFlagMode: () => void;
}

/**
 * 하단 조작바: 깃발 모드 토글 (PRD 5.2)
 *
 * 칸 크기 +/− 버튼은 보드가 항상 화면에 맞도록 바뀌면서 없앴다.
 * 키우면 다시 스크롤이 생기기 때문이다.
 */
export function ControlBar({ flagMode, onToggleFlagMode }: ControlBarProps) {
  return (
    <button
      type="button"
      onClick={onToggleFlagMode}
      aria-pressed={flagMode}
      className={[
        'btn w-full text-lg',
        flagMode ? 'bg-amber-400 text-slate-900 ring-4 ring-amber-300/50' : 'bg-slate-700 text-slate-100',
      ].join(' ')}
    >
      <span aria-hidden className="text-2xl">{flagMode ? '🚩' : '⛏️'}</span>
      {flagMode ? '깃발 모드' : '열기 모드'}
    </button>
  );
}
