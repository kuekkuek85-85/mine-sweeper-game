import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { registerStudent } from '../firebase/students';
import { describeStudentId, isValidName, isValidStudentId, parseStudentId } from '../lib/format';
import { useApp } from '../state/AppContext';

export function Start() {
  const { student, setStudent } = useApp();
  const navigate = useNavigate();

  const [studentId, setStudentId] = useState(student?.studentId ?? '');
  const [name, setName] = useState(student?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = describeStudentId(studentId, name);
  const canSubmit = isValidStudentId(studentId) && isValidName(name) && !busy;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);
    const trimmed = name.trim();
    const result = await registerStudent(studentId, trimmed);
    setBusy(false);

    if (!result.ok) {
      if (result.reason === 'name-mismatch') {
        setError(
          `이 학번은 이미 "${result.registeredName}"(으)로 등록되어 있어요. 학번을 다시 확인하고, 맞다면 선생님께 말씀드리세요.`,
        );
      } else if (result.reason === 'invalid') {
        setError('학번 형식이 올바르지 않습니다.');
      } else {
        setError(result.message);
      }
      return;
    }

    setStudent(result.student);
    navigate('/home', { replace: true });
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-5">
      <header className="text-center">
        <p className="text-5xl" aria-hidden>💣🚩</p>
        <h1 className="mt-2 text-3xl font-extrabold">지뢰찾기</h1>
        <p className="mt-1 text-sm text-slate-400">1학년 정보 · 캐주얼 게임 5</p>
      </header>

      <form className="card space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="studentId" className="mb-1 block text-sm font-bold text-slate-300">
            학번 (5자리)
          </label>
          <input
            id="studentId"
            className="input tabular-nums"
            inputMode="numeric"
            autoComplete="off"
            maxLength={5}
            placeholder="10101"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value.replace(/\D/g, '').slice(0, 5))}
          />
          <p className="mt-1 text-xs text-slate-500">1학년 1반 1번이면 10101</p>
        </div>

        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-bold text-slate-300">
            이름
          </label>
          <input
            id="name"
            className="input"
            autoComplete="off"
            maxLength={5}
            placeholder="홍길동"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">한글 2~5자</p>
        </div>

        {preview && parseStudentId(studentId) && isValidName(name) && (
          <p className="rounded-xl bg-slate-900 p-3 text-center text-lg font-bold text-sky-300">
            {preview} 맞나요?
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-rose-500/15 p-3 text-sm font-bold text-rose-300">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={!canSubmit}>
          {busy ? '확인 중…' : '시작하기'}
        </button>
      </form>

      <p className="text-center text-xs text-slate-500">
        수집하는 정보는 학번과 이름뿐이며, 순위표에서는 이름을 가려서 보여 줍니다.
      </p>
    </main>
  );
}
