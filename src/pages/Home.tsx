import { Link, useNavigate } from 'react-router-dom';

import { firebaseEnabled } from '../firebase/app';
import { LEVELS, LEVEL_IDS } from '../game/levels';
import { useMyRecords } from '../hooks/useMyRecords';
import { formatRecord } from '../lib/format';
import { describeNextOpen } from '../lib/schedule';
import { useApp } from '../state/AppContext';

export function Home() {
  const { student, clearStudent, settings, updateSettings, config, access } = useApp();
  const navigate = useNavigate();
  const records = useMyRecords(config.season, student?.studentId);

  return (
    <main className="mx-auto w-full max-w-md space-y-5 p-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">지뢰찾기</h1>
          <p className="text-sm text-slate-400">
            {student ? `${student.classNo}반 ${student.name}` : '손님'} · 시즌 {config.season}
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-xs text-slate-400 underline"
          onClick={() => {
            clearStudent();
            navigate('/', { replace: true });
          }}
        >
          다른 사람으로 시작
        </button>
      </header>

      {!access.open && (
        <p className="rounded-xl bg-amber-500/15 p-3 text-center text-sm font-bold text-amber-300">
          지금은 게임이 닫혀 있어요.
          {access.nextOpenAt
            ? ` 다음 열림: ${describeNextOpen(access.nextOpenAt, new Date())}`
            : ' 수업 시간에 다시 해 보세요.'}
        </p>
      )}

      {!firebaseEnabled && (
        <p className="rounded-xl bg-slate-700/60 p-3 text-center text-xs text-slate-300">
          오프라인 모드입니다. 게임은 할 수 있지만 기록은 저장되지 않아요.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-400">난이도 선택</h2>
        {LEVEL_IDS.map((id) => {
          const level = LEVELS[id];
          const record = records[id];
          return (
            <Link
              key={id}
              to={`/game/${id}`}
              className={[
                'card flex items-center justify-between transition hover:border-sky-400',
                access.open ? '' : 'pointer-events-none opacity-40',
              ].join(' ')}
              aria-disabled={!access.open}
              onClick={(event) => {
                if (!access.open) event.preventDefault();
              }}
            >
              <div>
                <p className="text-xl font-extrabold">{level.label}</p>
                <p className="text-sm text-slate-400">
                  {level.rows}×{level.cols} · 지뢰 {level.mines}개
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">내 최고 기록</p>
                <p className="text-lg font-bold tabular-nums text-sky-300">
                  {formatRecord(record?.bestTimeMs ?? null)}
                </p>
                {record && (
                  <p className="text-xs text-slate-500">
                    {record.wins}승 / {record.plays}판
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </section>

      <Link to="/dashboard" className="btn-ghost w-full">
        🏆 순위 보기
      </Link>

      <section className="card space-y-3">
        <h2 className="text-sm font-bold text-slate-400">설정</h2>
        <Toggle
          label="효과음"
          checked={settings.sound}
          onChange={(value) => updateSettings({ sound: value })}
        />
        <Toggle
          label="진동"
          checked={settings.vibrate}
          onChange={(value) => updateSettings({ vibrate: value })}
        />
        <Toggle
          label="물음표(?) 표시"
          hint="깃발을 한 번 더 누르면 ❓ 로 바뀝니다. 헷갈리는 칸을 표시해 두는 용도예요."
          checked={settings.questionMark}
          onChange={(value) => updateSettings({ questionMark: value })}
        />
        <Toggle
          label="원리 보기 모드"
          hint="연쇄 열기를 한 칸씩 보여 줍니다. 이 모드의 판은 기록하지 않아요."
          checked={settings.explain}
          onChange={(value) => updateSettings({ explain: value })}
        />
      </section>

      <p className="text-center text-xs text-slate-600">
        <Link to="/admin" className="underline">
          선생님용
        </Link>
      </p>
    </main>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span>
        <span className="font-bold">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
      <input
        type="checkbox"
        className="mt-1 h-6 w-6 accent-sky-500"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
