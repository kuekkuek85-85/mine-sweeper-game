import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

/**
 * 보드는 항상 화면 안에 들어가게 칸 크기를 계산한다.
 *
 * PRD 6.5는 "칸 최소 36px, 안 들어가면 스크롤"이었지만, 실제 수업에서
 * 스크롤 때문에 조작이 불편하다는 의견이 있어 **스크롤 없이 맞추는 쪽**으로 바꿨다.
 * 대신 칸이 작아질 수 있다. (고급 16×16 을 좁은 스마트폰에서 열 때)
 */
const MAX_CELL = 48;
/** 이보다 작아지면 누르기가 너무 어려워, 아주 좁은 화면에서만 쓰이는 하한 */
const MIN_CELL = 18;
/** 보드 자체의 테두리 여백(p-1 → 좌우 4px씩) + 반올림 여유 */
const BOARD_CHROME = 10;

/*
 * 화면이 낮으면(주로 스마트폰 가로 모드) 상태바·조작바가 보드 왼쪽으로 간다.
 * 위아래로 쌓으면 보드에 남는 높이가 200px 남짓이라 칸이 너무 작아지기 때문이다. (PRD 6.5)
 * 배치는 src/index.css 의 .game-layout 그리드가 담당한다.
 */

export function Game() {
  const { level: levelParam } = useParams();
  const navigate = useNavigate();
  const { student, settings, config, access, setQueuedCount } = useApp();

  const [flagMode, setFlagMode] = useState(false);
  // 보드가 들어갈 영역의 실제 크기. 여기에 맞춰 칸 크기를 정한다.
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });
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

  // 화면 회전·주소창 높이 변화까지 잡으려면 창 크기보다 실제 영역을 재는 편이 정확하다.
  useLayoutEffect(() => {
    const element = boardAreaRef.current;
    if (!element) return;

    const measure = () => setArea({ width: element.clientWidth, height: element.clientHeight });
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /** 가로·세로 모두 들어가는 가장 큰 칸 크기 */
  const size = useMemo(() => {
    const spec = LEVELS[isLevelId(levelParam) ? levelParam : 'beginner'];
    if (area.width === 0 || area.height === 0) return MIN_CELL;
    const byWidth = Math.floor((area.width - BOARD_CHROME) / spec.cols);
    const byHeight = Math.floor((area.height - BOARD_CHROME) / spec.rows);
    return Math.max(MIN_CELL, Math.min(MAX_CELL, byWidth, byHeight));
  }, [area, levelParam]);

  // R 키로 새 게임
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'r' || event.key === 'R') reset();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [reset]);

  if (!level) return <Navigate to="/home" replace />;
  // 주소를 직접 쳐서 들어오는 길도 막는다. 게임 중에 닫히면 그 자리에서 홈으로 나간다.
  if (!access.open) return <Navigate to="/home" replace />;

  const spec = LEVELS[level];
  const finished = game.state.status === 'won' || game.state.status === 'lost';

  return (
    <main className="game-layout mx-auto h-dvh w-full max-w-5xl overflow-hidden p-3">
      <header className="game-head flex items-center justify-between">
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

      <div className="game-status space-y-2">
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
      </div>

      <div
        ref={boardAreaRef}
        className="game-board flex items-center justify-center overflow-hidden"
      >
        <Board
          state={game.state}
          size={size}
          input={input}
          pendingCells={game.pendingCells}
          focusCell={game.focusCell}
          blockedCell={game.blockedCell}
        />
      </div>

      <div className="game-control">
        <ControlBar flagMode={flagMode} onToggleFlagMode={() => setFlagMode((previous) => !previous)} />
      </div>

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
