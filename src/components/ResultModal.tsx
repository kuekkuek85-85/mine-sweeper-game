import { formatRecord } from '../lib/format';
import type { SaveStatus } from '../types';

export interface ResultModalProps {
  open: boolean;
  won: boolean;
  timeMs: number;
  /** 패배 시 연 칸 비율 (0~1) */
  ratio: number;
  isNewBest: boolean;
  bestTimeMs: number | null;
  rank: number | null;
  saveStatus: SaveStatus;
  onRetry: () => void;
  onChangeLevel: () => void;
  onDashboard: () => void;
}

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: '',
  saving: '기록 저장 중…',
  saved: '기록 저장 완료',
  queued: '저장 실패 — 연결되면 자동으로 다시 보냅니다',
  skipped: '원리 보기 모드라 기록하지 않았습니다',
};

const ENCOURAGEMENTS = [
  '아깝다! 숫자를 다시 읽어 보면 보일 거예요.',
  '한 칸만 더 신중하게! 다시 도전해 봐요.',
  '지뢰는 숫자가 알려 줘요. 천천히 추론해 봐요.',
];

export function ResultModal({
  open,
  won,
  timeMs,
  ratio,
  isNewBest,
  bestTimeMs,
  rank,
  saveStatus,
  onRetry,
  onChangeLevel,
  onDashboard,
}: ResultModalProps) {
  if (!open) return null;

  const encouragement = ENCOURAGEMENTS[Math.floor(ratio * ENCOURAGEMENTS.length) % ENCOURAGEMENTS.length];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={won ? '승리' : '패배'}
        className="w-full max-w-sm animate-pop rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-2xl"
      >
        <div className="text-center">
          <div className="text-5xl" aria-hidden>
            {won ? '🎉' : '💥'}
          </div>
          <h2 className="mt-2 text-2xl font-extrabold">{won ? '성공!' : '지뢰를 밟았어요'}</h2>

          {won ? (
            <div className="mt-3 space-y-1">
              <p className="text-4xl font-extrabold tabular-nums text-sky-300">{formatRecord(timeMs)}</p>
              {isNewBest && <p className="font-bold text-amber-300">🏆 최고 기록 갱신!</p>}
              {!isNewBest && bestTimeMs != null && (
                <p className="text-sm text-slate-400">내 최고 기록 {formatRecord(bestTimeMs)}</p>
              )}
              {rank != null && <p className="text-sm text-slate-300">현재 {rank}위</p>}
            </div>
          ) : (
            <div className="mt-3 space-y-1">
              <p className="text-slate-300">{encouragement}</p>
              <p className="text-sm text-slate-400">연 칸 {Math.round(ratio * 100)}%</p>
            </div>
          )}

          {saveStatus !== 'idle' && (
            <p
              className={[
                'mt-3 text-xs',
                saveStatus === 'queued' ? 'text-amber-300' : 'text-slate-400',
              ].join(' ')}
            >
              {SAVE_LABEL[saveStatus]}
            </p>
          )}
        </div>

        <div className="mt-6 grid gap-2">
          <button type="button" className="btn-primary" onClick={onRetry} autoFocus>
            다시 하기
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost" onClick={onChangeLevel}>
              난이도 변경
            </button>
            <button type="button" className="btn-ghost" onClick={onDashboard}>
              순위 보기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
