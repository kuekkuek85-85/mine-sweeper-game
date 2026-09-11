import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { User } from 'firebase/auth';

import { firebaseEnabled } from '../firebase/app';
import { isTeacher, lockTeacher, subscribeUser, unlockTeacher } from '../firebase/auth';
import { updateAppConfig } from '../firebase/config';
import { deleteRecord, deleteSeasonRecords, listRecordsBySeason } from '../firebase/records';
import { deleteStudent, listStudents, updateStudentName, type StudentRow } from '../firebase/students';
import { LEVELS } from '../game/levels';
import { formatDateTime, formatRecord, isValidName } from '../lib/format';
import { useApp } from '../state/AppContext';
import type { GameRecord } from '../types';

export function Admin() {
  const { config } = useApp();
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [season, setSeason] = useState(config.season);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setSeason(config.season), [config.season]);

  useEffect(
    () =>
      subscribeUser((next) => {
        setUser(next);
        if (!next) {
          setAdmin(false);
          return;
        }
        // 새로고침해도 열린 세션이면 그대로 들어간다.
        void isTeacher(next.uid).then(setAdmin);
      }),
    [],
  );

  async function handleUnlock(event: FormEvent) {
    event.preventDefault();
    if (!pin.trim() || unlocking) return;

    setUnlocking(true);
    setMessage(null);
    const result = await unlockTeacher(pin.trim());
    setUnlocking(false);

    if (result.ok) {
      setPin('');
      setAdmin(true);
      return;
    }
    setMessage(result.message);
  }

  const reload = useCallback(async () => {
    setBusy(true);
    try {
      const [nextRecords, nextStudents] = await Promise.all([
        listRecordsBySeason(config.season),
        listStudents(),
      ]);
      setRecords(nextRecords);
      setStudents(nextStudents);
    } catch (error) {
      setMessage(`불러오기 실패: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [config.season]);

  useEffect(() => {
    if (admin) void reload();
  }, [admin, reload]);

  if (!firebaseEnabled) {
    return (
      <Shell>
        <p className="card text-center text-sm text-slate-400">Firebase가 설정되어 있지 않습니다.</p>
      </Shell>
    );
  }

  if (admin === null) {
    return (
      <Shell>
        <p className="card text-center text-sm text-slate-400">확인 중…</p>
      </Shell>
    );
  }

  if (!admin) {
    return (
      <Shell>
        <form className="card space-y-4" onSubmit={handleUnlock}>
          <div className="text-center">
            <p className="text-4xl" aria-hidden>🔒</p>
            <p className="mt-2 font-bold">선생님 화면</p>
            <p className="text-sm text-slate-400">핀 번호를 입력하세요.</p>
          </div>

          <input
            type="password"
            className="input text-center text-2xl tracking-[0.4em]"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            maxLength={12}
            placeholder="••••••"
            aria-label="핀 번호"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
          />

          {message && (
            <p role="alert" className="rounded-xl bg-rose-500/15 p-3 text-sm font-bold text-rose-300">
              {message}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={!pin.trim() || unlocking}>
            {unlocking ? '확인 중…' : '들어가기'}
          </button>

          <p className="text-center text-xs text-slate-500">
            핀 번호는 Firebase 콘솔의 <code>config/secret</code> 문서에서 바꿀 수 있습니다.
          </p>
        </form>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">{user?.email ?? '핀 번호로 접속 중'}</span>
        <button
          type="button"
          className="underline text-slate-400"
          onClick={() => {
            void lockTeacher().then(() => setAdmin(false));
          }}
        >
          잠그기
        </button>
      </div>

      {message && (
        <p className="rounded-xl bg-slate-700/60 p-3 text-sm text-slate-200" role="status">
          {message}
        </p>
      )}

      <section className="card space-y-3">
        <h2 className="font-bold">설정</h2>
        <label className="flex items-center justify-between">
          <span>대시보드 이름 마스킹</span>
          <input
            type="checkbox"
            className="h-6 w-6 accent-sky-500"
            checked={config.maskNames}
            onChange={(event) => {
              void updateAppConfig({ maskNames: event.target.checked }).catch((error) =>
                setMessage(error.message),
              );
            }}
          />
        </label>
        <label className="flex items-center justify-between">
          <span>게임 열기</span>
          <input
            type="checkbox"
            className="h-6 w-6 accent-sky-500"
            checked={config.gameOpen}
            onChange={(event) => {
              void updateAppConfig({ gameOpen: event.target.checked }).catch((error) =>
                setMessage(error.message),
              );
            }}
          />
        </label>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="season" className="mb-1 block text-sm text-slate-400">
              시즌 (바꾸면 순위가 새로 시작됩니다)
            </label>
            <input
              id="season"
              className="input"
              value={season}
              onChange={(event) => setSeason(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={!season.trim() || season === config.season}
            onClick={() => {
              void updateAppConfig({ season: season.trim() })
                .then(() => setMessage(`시즌을 ${season.trim()}(으)로 바꿨습니다.`))
                .catch((error) => setMessage(error.message));
            }}
          >
            변경
          </button>
        </div>

        <Link className="btn-ghost w-full" to="/dashboard?tv=1">
          📺 교실 TV 모드 열기
        </Link>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">기록 ({records.length})</h2>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost text-sm" onClick={() => void reload()} disabled={busy}>
              새로고침
            </button>
            <button
              type="button"
              className="btn-ghost text-sm"
              onClick={() => downloadCsv(records, config.season)}
              disabled={records.length === 0}
            >
              CSV 내보내기
            </button>
          </div>
        </div>

        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-800 text-xs text-slate-400">
              <tr>
                <th className="p-2">학번</th>
                <th className="p-2">이름</th>
                <th className="p-2">난이도</th>
                <th className="p-2">최고</th>
                <th className="p-2">승/판</th>
                <th className="p-2">최종</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-t border-slate-700">
                  <td className="p-2 tabular-nums">{record.studentId}</td>
                  <td className="p-2">{record.name}</td>
                  <td className="p-2">{LEVELS[record.level].label}</td>
                  <td className="p-2 tabular-nums">{formatRecord(record.bestTimeMs)}</td>
                  <td className="p-2 tabular-nums">
                    {record.wins}/{record.plays}
                  </td>
                  <td className="p-2 text-xs text-slate-400">{formatDateTime(record.updatedAt)}</td>
                  <td className="p-2">
                    <button
                      type="button"
                      className="text-xs text-rose-400 underline"
                      onClick={() => {
                        if (!window.confirm(`${record.name}의 ${LEVELS[record.level].label} 기록을 삭제할까요?`)) return;
                        void deleteRecord(record.id)
                          .then(() => reload())
                          .catch((error) => setMessage(error.message));
                      }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          className="btn w-full bg-rose-600 text-white"
          onClick={() => {
            if (!window.confirm(`시즌 ${config.season}의 기록을 모두 삭제할까요? 되돌릴 수 없습니다.`)) return;
            void deleteSeasonRecords(config.season)
              .then((count) => {
                setMessage(`${count}개 기록을 삭제했습니다.`);
                return reload();
              })
              .catch((error) => setMessage(error.message));
          }}
        >
          시즌 {config.season} 기록 일괄 삭제
        </button>
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold">학생 등록 정보 ({students.length})</h2>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-800 text-xs text-slate-400">
              <tr>
                <th className="p-2">학번</th>
                <th className="p-2">이름</th>
                <th className="p-2">등록</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {students.map((row) => (
                <tr key={row.studentId} className="border-t border-slate-700">
                  <td className="p-2 tabular-nums">{row.studentId}</td>
                  <td className="p-2">{row.name}</td>
                  <td className="p-2 text-xs text-slate-400">{formatDateTime(row.createdAt)}</td>
                  <td className="space-x-2 p-2">
                    <button
                      type="button"
                      className="text-xs text-sky-400 underline"
                      onClick={() => {
                        const next = window.prompt('새 이름 (한글 2~5자)', row.name);
                        if (!next) return;
                        if (!isValidName(next)) {
                          setMessage('이름은 한글 2~5자여야 합니다.');
                          return;
                        }
                        void updateStudentName(row.studentId, next.trim())
                          .then(() => reload())
                          .catch((error) => setMessage(error.message));
                      }}
                    >
                      이름 수정
                    </button>
                    <button
                      type="button"
                      className="text-xs text-rose-400 underline"
                      onClick={() => {
                        if (!window.confirm(`${row.studentId} ${row.name} 등록을 삭제할까요?`)) return;
                        void deleteStudent(row.studentId)
                          .then(() => reload())
                          .catch((error) => setMessage(error.message));
                      }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <header className="flex items-center justify-between">
        <Link to="/home" className="text-sm text-slate-400 underline">
          ← 홈
        </Link>
        <h1 className="text-xl font-extrabold">선생님 화면</h1>
        <span className="w-10" />
      </header>
      {children}
    </main>
  );
}

/** CSV 내보내기: 학번, 이름, 난이도, 최고 기록, 승리 수, 도전 수, 최종 플레이 시각 */
function downloadCsv(records: GameRecord[], season: string): void {
  const header = ['학번', '이름', '반', '난이도', '최고기록(ms)', '승리수', '도전수', '최종플레이'];
  const rows = records.map((record) => [
    record.studentId,
    record.name,
    String(record.classNo),
    LEVELS[record.level].label,
    record.bestTimeMs == null ? '' : String(record.bestTimeMs),
    String(record.wins),
    String(record.plays),
    formatDateTime(record.updatedAt),
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  // 엑셀에서 한글이 깨지지 않도록 BOM을 붙인다.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `지뢰찾기_기록_${season}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
