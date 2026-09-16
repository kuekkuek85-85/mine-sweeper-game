import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { firebaseEnabled } from '../firebase/app';
import { DASHBOARD_LIMIT, fetchMyRank, subscribeRanking } from '../firebase/records';
import { LEVELS, LEVEL_IDS, isLevelId, type LevelId } from '../game/levels';
import { useMyRecords } from '../hooks/useMyRecords';
import { formatRecord, maskName } from '../lib/format';
import { useApp } from '../state/AppContext';
import type { GameRecord } from '../types';

/** 교실 TV 모드 자동 순환 간격 */
const TV_ROTATE_MS = 10_000;

export function Dashboard() {
  const { student, config, settings, updateSettings } = useApp();
  const [params, setParams] = useSearchParams();

  const levelParam = params.get('level');
  const level: LevelId = isLevelId(levelParam) ? levelParam : 'beginner';
  const classParam = Number(params.get('class') ?? 0);
  const classNo = Number.isFinite(classParam) && classParam > 0 ? classParam : null;
  const tv = params.get('tv') === '1';

  const [records, setRecords] = useState<GameRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);

  // 순위가 바뀐 줄을 잠깐 강조하기 위해 이전 순위를 기억한다.
  const previousRanks = useRef<Map<string, number>>(new Map());
  const [movedIds, setMovedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setError(null);
    const unsubscribe = subscribeRanking({ season: config.season, level, classNo }, (next) => {
      const moved = new Set<string>();
      next.forEach((record, index) => {
        const before = previousRanks.current.get(record.id);
        if (before !== undefined && before !== index) moved.add(record.id);
      });
      previousRanks.current = new Map(next.map((record, index) => [record.id, index]));
      setRecords(next);
      setMovedIds(moved);
    }, (subscribeError) => {
      setError(
        subscribeError.message.includes('index')
          ? '순위 조회용 색인이 아직 준비되지 않았습니다. (firestore.indexes.json 배포 필요)'
          : '순위를 불러오지 못했습니다.',
      );
    });
    return unsubscribe;
  }, [config.season, level, classNo]);

  // 교실 TV 모드: 난이도 탭 자동 순환
  useEffect(() => {
    if (!tv) return;
    const timer = window.setInterval(() => {
      const index = LEVEL_IDS.indexOf(level);
      const next = LEVEL_IDS[(index + 1) % LEVEL_IDS.length];
      setParams((previous) => {
        const updated = new URLSearchParams(previous);
        updated.set('level', next);
        return updated;
      });
    }, TV_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [tv, level, setParams]);

  const myRecords = useMyRecords(config.season, student?.studentId);
  const myBest = myRecords[level]?.bestTimeMs ?? null;
  const myIndex = useMemo(
    () => records.findIndex((record) => record.studentId === student?.studentId),
    [records, student],
  );

  // 상위 50명 밖이면 순위를 따로 조회해 하단에 고정 표시한다.
  useEffect(() => {
    if (!student || myIndex >= 0 || myBest == null) {
      setMyRank(null);
      return;
    }
    let cancelled = false;
    void fetchMyRank({ season: config.season, level, classNo }, myBest).then((rank) => {
      if (!cancelled) setMyRank(rank);
    });
    return () => {
      cancelled = true;
    };
  }, [student, myIndex, myBest, config.season, level, classNo]);

  const classOptions = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);

  function updateParam(key: string, value: string | null) {
    setParams((previous) => {
      const updated = new URLSearchParams(previous);
      if (value === null) updated.delete(key);
      else updated.set(key, value);
      return updated;
    });
  }

  return (
    <main className={['mx-auto w-full space-y-4 p-4', tv ? 'max-w-5xl text-xl' : 'max-w-2xl'].join(' ')}>
      <header className="flex items-center justify-between">
        <Link to="/home" className="text-sm text-slate-400 underline">
          ← 홈
        </Link>
        <h1 className={tv ? 'text-4xl font-extrabold' : 'text-xl font-extrabold'}>🏆 순위표</h1>
        <button
          type="button"
          className="text-sm text-slate-400 underline"
          onClick={() => updateParam('tv', tv ? null : '1')}
        >
          {tv ? '일반 보기' : 'TV 모드'}
        </button>
      </header>

      <div className="flex gap-2">
        {LEVEL_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => updateParam('level', id)}
            className={[
              'btn flex-1',
              id === level ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-300',
            ].join(' ')}
          >
            {LEVELS[id].label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="classFilter" className="text-slate-400">
          반
        </label>
        <select
          id="classFilter"
          className="min-h-[44px] rounded-lg border border-slate-600 bg-slate-800 px-3"
          value={classNo ?? ''}
          onChange={(event) => updateParam('class', event.target.value || null)}
        >
          <option value="">전체</option>
          {classOptions.map((value) => (
            <option key={value} value={value}>
              {value}반
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={settings.maskNames}
          onClick={() => updateSettings({ maskNames: !settings.maskNames })}
          title="교실 TV처럼 여러 사람이 보는 화면에서는 켜 두세요."
          className={[
            'min-h-[44px] rounded-lg border px-3 font-bold transition',
            settings.maskNames
              ? 'border-sky-400 bg-sky-500/20 text-sky-200'
              : 'border-slate-600 bg-slate-800 text-slate-400',
          ].join(' ')}
        >
          {settings.maskNames ? '🙈 이름 가림' : '👀 이름 보임'}
        </button>

        <span className="ml-auto text-xs text-slate-500">시즌 {config.season}</span>
      </div>

      {!firebaseEnabled && (
        <p className="card text-center text-sm text-slate-400">
          Firebase가 설정되지 않아 순위를 표시할 수 없습니다.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-amber-500/15 p-3 text-sm text-amber-300">
          {error}
        </p>
      )}

      <ol className="space-y-1">
        {records.map((record, index) => (
          <li
            key={record.id}
            className={[
              'flex items-center gap-3 rounded-xl px-3 py-2',
              record.studentId === student?.studentId ? 'bg-sky-500/20' : 'bg-slate-800/60',
              movedIds.has(record.id) ? 'animate-highlight' : '',
            ].join(' ')}
          >
            <span className="w-10 shrink-0 text-center font-extrabold tabular-nums text-slate-400">
              {medal(index)}
            </span>
            <span className="w-12 shrink-0 text-sm text-slate-400">{record.classNo}반</span>
            <span className="flex-1 truncate font-bold">
              {settings.maskNames ? maskName(record.name) : record.name}
            </span>
            <span className="shrink-0 tabular-nums font-bold text-sky-300">
              {formatRecord(record.bestTimeMs)}
            </span>
            <span className="w-16 shrink-0 text-right text-xs text-slate-500">
              {record.wins}승/{record.plays}판
            </span>
          </li>
        ))}
        {records.length === 0 && !error && firebaseEnabled && (
          <li className="card text-center text-sm text-slate-400">아직 기록이 없어요. 첫 주인공이 되어 보세요!</li>
        )}
      </ol>

      {records.length >= DASHBOARD_LIMIT && (
        <p className="text-center text-xs text-slate-500">상위 {DASHBOARD_LIMIT}명까지 표시합니다.</p>
      )}

      {student && myIndex < 0 && myRank != null && (
        <div className="sticky bottom-2 rounded-xl bg-sky-600 px-3 py-2 text-center font-bold shadow-lg">
          내 순위 {myRank}위
        </div>
      )}
    </main>
  );
}

function medal(index: number): string {
  if (index === 0) return '🥇';
  if (index === 1) return '🥈';
  if (index === 2) return '🥉';
  return String(index + 1);
}
