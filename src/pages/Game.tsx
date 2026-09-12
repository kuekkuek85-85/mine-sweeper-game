import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

import { Board } from '../components/Board';
import { ControlBar } from '../components/ControlBar';
import { ResultModal } from '../components/ResultModal';
import { StatusBar } from '../components/StatusBar';
import { firebaseEnabled } from '../firebase/app';
import { enqueueResult, queueLength } from '../firebase/queue';
import { fetchMyRank, saveResult } from '../firebase/records';
import { elapsedMs, revealedRatio, type GameState } from '../game/board';
import { LEVELS, isLevelId } from '../game/levels';
import { useCellInput } from '../hooks/useCellInput';
import { useGame } from '../hooks/useGame';
import { useMyRecords } from '../hooks/useMyRecords';
import { useApp } from '../state/AppContext';
import type { PendingResult, SaveStatus } from '../types';

/** 칸 최소 크기: 터치 기기 36px, PC 28px (PRD 6.5) */
const MIN_TOUCH = 36;
const MIN_MOUSE = 28;
const MAX_FIT = 48;
const MAX_ZOOM = 64;

function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

export function Game() {
  const { level: levelParam } = useParams();
  const navigate = useNavigate();
  const { student, settings, config, setQueuedCount } = useApp();

  const [flagMode, setFlagMode] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 360 : window.innerWidth,
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [rank, setRank] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  const records = useMyRecords(config.season, student?.studentId);
  // 이번 판을 시작할 때의 최고 기록을 기억해 둔다. (저장 후 값이 바뀌므로)
  const bestBeforeRef = useRef<number | null>(null);

  const level = isLevelId(levelParam) ? levelParam : null;
  const explain = settings.explain;

  const handleFinish = useCallback(
    (finished: GameState) => {
      const won = finished.status === 'won';
      const timeMs = elapsedMs(finished);

      if (explain) {
        setSaveStatus('skipped');
        return;
      }
      if (!student || !firebaseEnabled || !level) {
        setSaveStatus('idle');
        return;
      }

      const previousBest = bestBeforeRef.current;
      setIsNewBest(won && (previousBest === null || timeMs < previousBest));

      const pending: PendingResult = {
        key: `${config.season}_${level}_${student.studentId}_${finished.endedAt ?? Date.now()}`,
        season: config.season,
        level,
        studentId: student.studentId,
        name: student.name,
        classNo: student.classNo,
        won,
        timeMs: won ? timeMs : null,
        playedAt: finished.endedAt ?? Date.now(),
      };

      setSaveStatus('saving');
      saveResult(pending)
        .then(() => {
          setSaveStatus('saved');
          if (won) {
            void fetchMyRank({ season: config.season, level }, timeMs).then(setRank);
          }
        })
        .catch((error) => {
          console.warn('[game] 기록 저장 실패 — 대기열에 넣습니다.', error);
          enqueueResult(pending);
          setQueuedCount(queueLength());
          setSaveStatus('queued');
        });
    },
    [config.season, explain, level, setQueuedCount, student],
  );

  const game = useGame(level ?? 'beginner', {
    sound: settings.sound,
    vibrate: settings.vibrate,
    explain,
    questionMark: settings.questionMark,
    onFinish: handleFinish,
  });

  const { reset } = game;

  const input = useCellInput({
    onOpen: game.open,
    onFlag: game.flag,
    flagMode,
    disabled: game.state.status === 'won' || game.state.status === 'lost' || game.animating,
  });

  // 새 판이 시작될 때의 기준값을 기록해 둔다.
  useEffect(() => {
    if (game.state.status === 'ready') {
      bestBeforeRef.current = level ? (records[level]?.bestTimeMs ?? null) : null;
      setSaveStatus('idle');
      setRank(null);
      setIsNewBest(false);
    }
  }, [game.state.status, level, records]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // R 키로 새 게임
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'r' || event.key === 'R') reset();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [reset]);

  if (!level) return <Navigate to="/home" replace />;

  const spec = LEVELS[level];
  const touch = isTouchDevice();
  const minSize = touch ? MIN_TOUCH : MIN_MOUSE;
  // 화면에 다 들어가면 폭에 맞춰 키우고, 안 들어가면 최소 크기로 두고 스크롤한다.
  const fitted = Math.floor((Math.min(viewportWidth, 720) - 32) / spec.cols);
  const baseSize = Math.min(MAX_FIT, Math.max(minSize, fitted));
  const size = Math.min(MAX_ZOOM, Math.max(minSize, baseSize + zoom));

  const finished = game.state.status === 'won' || game.state.status === 'lost';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-3 p-3">
      <header className="flex items-center justify-between">
        <Link to="/home" className="text-sm text-slate-400 underline">
          ← 홈
        </Link>
        <p className="font-bold">
          {spec.label} <span className="text-slate-500">{spec.rows}×{spec.cols}</span>
        </p>
        <Link to="/dashboard" className="text-sm text-slate-400 underline">
          순위
        </Link>
      </header>

      <StatusBar
        remaining={game.remaining}
        elapsedMs={game.elapsed}
        status={game.state.status}
        pressing={input.pressed !== null}
        onReset={() => game.reset()}
      />

      {explain && (
        <p className="rounded-xl bg-sky-500/15 p-2 text-center text-xs font-bold text-sky-300">
          원리 보기 모드 — 빈칸을 찾으면 이웃 8칸을 하나씩 확인합니다. (기록은 저장되지 않아요)
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-xl">
        <div className="flex min-h-full items-start justify-center p-1">
          <Board
            state={game.state}
            size={size}
            input={input}
            pendingCells={game.pendingCells}
            focusCell={game.focusCell}
            blockedCell={game.blockedCell}
          />
        </div>
      </div>

      <ControlBar
        flagMode={flagMode}
        onToggleFlagMode={() => setFlagMode((previous) => !previous)}
        onZoomIn={() => setZoom((value) => value + 4)}
        onZoomOut={() => setZoom((value) => value - 4)}
        canZoomIn={size < MAX_ZOOM}
        canZoomOut={size > minSize}
      />

      <ResultModal
        open={finished && !game.animating}
        won={game.state.status === 'won'}
        timeMs={elapsedMs(game.state)}
        ratio={revealedRatio(game.state)}
        isNewBest={isNewBest}
        bestTimeMs={records[level]?.bestTimeMs ?? null}
        rank={rank}
        saveStatus={saveStatus}
        onRetry={() => game.reset()}
        onChangeLevel={() => navigate('/home')}
        onDashboard={() => navigate(`/dashboard?level=${level}`)}
      />
    </main>
  );
}
