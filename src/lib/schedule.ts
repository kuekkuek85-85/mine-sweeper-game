/**
 * 접속 허용 시간대 (선생님 화면의 "접속 허용" 설정).
 *
 * PRD 6.8 의 `gameOpen` 스위치를 넓힌 것이다. 수동으로 켜고 끄는 것만으로는
 * 선생님이 매 시간 눌러야 해서, 요일·시간대를 미리 정해 두는 방식을 더했다.
 *
 * 이 파일은 순수 함수만 둔다. (UI·Firebase 의존 없음)
 */

export type AccessMode = 'open' | 'closed' | 'schedule';

/** 허용 시간대 한 줄. "월·수 09:00–09:45" 처럼 여러 요일을 묶는다. */
export interface AccessWindow {
  /** 목록에서 줄을 구분하기 위한 키 */
  id: string;
  /** 0=일요일 … 6=토요일 (JS `Date.getDay()` 와 같다) */
  days: number[];
  /** 시작 "HH:MM" (이 시각부터 열린다) */
  start: string;
  /** 끝 "HH:MM" (이 시각이 되면 닫힌다) */
  end: string;
  /** "1학년 3반" 같은 메모 */
  label: string;
}

export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/**
 * 보안 규칙에 넘길 슬롯의 단위(분).
 *
 * 규칙 언어에는 반복문이 없어서 시간대를 그대로 넘길 수 없다.
 * 대신 허용 시간대를 5분 조각으로 펼쳐 둔 숫자 목록을 `config/app.slots` 에 저장하고,
 * 규칙은 "지금 조각이 목록에 있는가"만 확인한다. (firestore.rules 의 accessSlotNow 참고)
 */
export const SLOT_MINUTES = 5;

/** "HH:MM" → 자정부터 지난 분. 형식이 틀리면 null. */
export function parseHhmm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** 자정부터 지난 분 → "HH:MM" */
export function formatHhmm(minutes: number): string {
  const clamped = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(clamped / 60);
  return `${String(hours).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

/**
 * 쓸 수 있는 시간대인지.
 *
 * 자정을 넘는 시간대(23:00–01:00)는 지원하지 않는다. 수업 시간에는 필요 없고,
 * 허용하면 규칙·화면 양쪽에서 경계 처리가 복잡해지기 때문이다.
 */
export function isValidWindow(window: AccessWindow): boolean {
  const start = parseHhmm(window.start);
  const end = parseHhmm(window.end);

  return (
    window.days.length > 0 &&
    window.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) &&
    start !== null &&
    end !== null &&
    start < end
  );
}

/** 새 줄을 만들 때 쓰는 키. 저장 전에는 화면에서만 쓰인다. */
export function newWindowId(): string {
  return `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** 지금 게임을 할 수 있는지. 시간은 기기의 현지 시각(교실에서는 한국 시간)으로 본다. */
export function isOpenAt(mode: AccessMode, windows: AccessWindow[], at: Date): boolean {
  if (mode === 'open') return true;
  if (mode === 'closed') return false;

  const day = at.getDay();
  const minutes = at.getHours() * 60 + at.getMinutes();

  return windows.some((window) => {
    if (!isValidWindow(window) || !window.days.includes(day)) return false;
    const start = parseHhmm(window.start) as number;
    const end = parseHhmm(window.end) as number;
    return minutes >= start && minutes < end;
  });
}

/**
 * 다음에 열리는 시각. 시간표 모드가 아니거나 쓸 수 있는 시간대가 없으면 null.
 * 지금 열려 있으면 "이번 시간대 다음"이 아니라 다음 시작 시각을 돌려준다.
 */
export function nextOpenAt(mode: AccessMode, windows: AccessWindow[], at: Date): Date | null {
  if (mode !== 'schedule') return null;

  const valid = windows.filter(isValidWindow);
  if (valid.length === 0) return null;

  const nowMinutes = at.getHours() * 60 + at.getMinutes();

  for (let offset = 0; offset <= 7; offset += 1) {
    const day = (at.getDay() + offset) % 7;
    const starts = valid
      .filter((window) => window.days.includes(day))
      .map((window) => parseHhmm(window.start) as number)
      .filter((start) => offset > 0 || start > nowMinutes)
      .sort((a, b) => a - b);

    if (starts.length === 0) continue;

    const next = new Date(at);
    next.setDate(next.getDate() + offset);
    next.setHours(Math.floor(starts[0] / 60), starts[0] % 60, 0, 0);
    return next;
  }

  return null;
}

/** 학생 화면에 보여 줄 안내: "다음 열림: 내일 09:00" */
export function describeNextOpen(next: Date, now: Date): string {
  const days = dayDifference(now, next);
  const time = formatHhmm(next.getHours() * 60 + next.getMinutes());

  if (days === 0) return `오늘 ${time}`;
  if (days === 1) return `내일 ${time}`;
  return `${DAY_LABELS[next.getDay()]}요일 ${time}`;
}

function dayDifference(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** 선생님 화면 목록에 보여 줄 한 줄: "월·수 09:00–09:45" */
export function describeWindow(window: AccessWindow): string {
  const days = [...window.days]
    .sort((a, b) => a - b)
    .map((day) => DAY_LABELS[day])
    .join('·');
  return `${days} ${window.start}–${window.end}`;
}

/**
 * 허용 시간대를 보안 규칙이 확인할 수 있는 5분 조각 목록으로 펼친다.
 *
 * 조각 하나는 `요일*10000 + 시*100 + 분` 이고, **UTC 기준**이다. (예: 수요일 09:35 UTC → 30935)
 * 보안 규칙의 `request.time` 은 UTC 라서, 여기서 미리 UTC 로 옮겨 두면
 * 규칙에 시간대를 적어 넣지 않아도 된다. (선생님이 어느 시간대에서 설정하든 맞는다)
 *
 * 선생님이 입력한 "월 09:00" 은 그 기기의 현지 시각이므로, 저장 시점의 시차만큼 민다.
 * 한국은 서머타임이 없어 시차가 늘 +9시간으로 일정하다.
 *
 * 시작 시각은 5분 경계로 내림하므로 규칙 쪽이 최대 4분 너그러워질 수 있다.
 * 학생 화면은 정확한 시각으로 막으므로, 이 오차는 "늦게 저장된 기록" 정도로만 남는다.
 */
export function slotsForWindows(
  windows: AccessWindow[],
  offsetMinutes: number = -new Date().getTimezoneOffset(),
): number[] {
  const slots = new Set<number>();

  for (const window of windows) {
    if (!isValidWindow(window)) continue;
    const start = parseHhmm(window.start) as number;
    const end = parseHhmm(window.end) as number;
    const first = Math.floor(start / SLOT_MINUTES) * SLOT_MINUTES;

    for (const day of window.days) {
      for (let minute = first; minute < end; minute += SLOT_MINUTES) {
        // 주 단위로 돌려 가며 UTC 로 옮긴다. (한 주 = 10080분)
        const weekMinute = (((day * 1440 + minute - offsetMinutes) % 10_080) + 10_080) % 10_080;
        const utcDay = Math.floor(weekMinute / 1440);
        const utcMinute = weekMinute % 1440;
        slots.add(utcDay * 10_000 + Math.floor(utcMinute / 60) * 100 + (utcMinute % 60));
      }
    }
  }

  return [...slots].sort((a, b) => a - b);
}

/** 한 시각이 속한 UTC 조각. `slotsForWindows` 와 같은 규칙으로 센다. */
export function utcSlotAt(at: Date): number {
  const minute = Math.floor(at.getUTCMinutes() / SLOT_MINUTES) * SLOT_MINUTES;
  return at.getUTCDay() * 10_000 + at.getUTCHours() * 100 + minute;
}
