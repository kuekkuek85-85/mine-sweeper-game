import { describe, expect, it } from 'vitest';

import {
  describeNextOpen,
  describeWindow,
  formatHhmm,
  isOpenAt,
  isValidWindow,
  nextOpenAt,
  parseHhmm,
  slotsForWindows,
  utcSlotAt,
  type AccessWindow,
} from './schedule';

/** 한국 시간과 UTC 의 시차(분) */
const KST = 540;

/** 2026-09-21 은 월요일, 22 화요일, 23 수요일, 26 토요일, 27 일요일 */
const MONDAY = (hours: number, minutes = 0) => new Date(2026, 8, 21, hours, minutes);
const TUESDAY = (hours: number, minutes = 0) => new Date(2026, 8, 22, hours, minutes);
const SATURDAY = (hours: number, minutes = 0) => new Date(2026, 8, 26, hours, minutes);

function window(patch: Partial<AccessWindow> = {}): AccessWindow {
  return { id: 'w1', days: [1], start: '09:00', end: '09:45', label: '', ...patch };
}

describe('parseHhmm / formatHhmm', () => {
  it('HH:MM 을 분으로 바꾼다', () => {
    expect(parseHhmm('09:00')).toBe(540);
    expect(parseHhmm('9:05')).toBe(545);
    expect(parseHhmm('23:59')).toBe(1439);
    expect(parseHhmm(' 13:30 ')).toBe(810);
  });

  it('형식이 틀리면 null', () => {
    expect(parseHhmm('')).toBeNull();
    expect(parseHhmm('9시')).toBeNull();
    expect(parseHhmm('24:00')).toBeNull();
    expect(parseHhmm('09:60')).toBeNull();
    expect(parseHhmm('0900')).toBeNull();
  });

  it('분을 다시 HH:MM 으로 되돌린다', () => {
    expect(formatHhmm(540)).toBe('09:00');
    expect(formatHhmm(1439)).toBe('23:59');
    expect(formatHhmm(0)).toBe('00:00');
  });
});

describe('isValidWindow', () => {
  it('요일이 없으면 쓸 수 없다', () => {
    expect(isValidWindow(window({ days: [] }))).toBe(false);
  });

  it('끝이 시작보다 빠르거나 같으면 쓸 수 없다', () => {
    expect(isValidWindow(window({ start: '10:00', end: '09:00' }))).toBe(false);
    expect(isValidWindow(window({ start: '10:00', end: '10:00' }))).toBe(false);
  });

  it('자정을 넘는 시간대는 지원하지 않는다', () => {
    expect(isValidWindow(window({ start: '23:00', end: '01:00' }))).toBe(false);
  });

  it('요일 범위를 벗어나면 쓸 수 없다', () => {
    expect(isValidWindow(window({ days: [7] }))).toBe(false);
    expect(isValidWindow(window({ days: [-1] }))).toBe(false);
  });

  it('올바른 시간대는 통과한다', () => {
    expect(isValidWindow(window({ days: [1, 3, 5] }))).toBe(true);
  });
});

describe('isOpenAt', () => {
  const windows = [window({ days: [1, 3], start: '09:00', end: '09:45' })];

  it('항상 허용이면 시간대를 보지 않는다', () => {
    expect(isOpenAt('open', [], SATURDAY(23))).toBe(true);
  });

  it('항상 차단이면 시간대를 보지 않는다', () => {
    expect(isOpenAt('closed', windows, MONDAY(9, 10))).toBe(false);
  });

  it('시간대 안이면 열린다', () => {
    expect(isOpenAt('schedule', windows, MONDAY(9, 0))).toBe(true);
    expect(isOpenAt('schedule', windows, MONDAY(9, 44))).toBe(true);
  });

  it('끝 시각이 되면 닫힌다', () => {
    expect(isOpenAt('schedule', windows, MONDAY(9, 45))).toBe(false);
  });

  it('시작 1분 전에는 닫혀 있다', () => {
    expect(isOpenAt('schedule', windows, MONDAY(8, 59))).toBe(false);
  });

  it('요일이 다르면 닫혀 있다', () => {
    expect(isOpenAt('schedule', windows, TUESDAY(9, 10))).toBe(false);
  });

  it('시간대가 하나도 없으면 계속 닫혀 있다', () => {
    expect(isOpenAt('schedule', [], MONDAY(9, 10))).toBe(false);
  });

  it('잘못 입력된 시간대는 무시한다', () => {
    const broken = [window({ start: '10:00', end: '09:00' })];
    expect(isOpenAt('schedule', broken, MONDAY(9, 30))).toBe(false);
  });

  it('여러 시간대 중 하나만 맞아도 열린다', () => {
    const many = [
      window({ id: 'a', days: [1], start: '09:00', end: '09:45' }),
      window({ id: 'b', days: [1], start: '13:00', end: '13:45' }),
    ];
    expect(isOpenAt('schedule', many, MONDAY(13, 30))).toBe(true);
  });
});

describe('nextOpenAt', () => {
  it('오늘 뒤에 남은 시간대가 있으면 그 시각', () => {
    const windows = [
      window({ id: 'a', days: [1], start: '09:00', end: '09:45' }),
      window({ id: 'b', days: [1], start: '13:00', end: '13:45' }),
    ];
    const next = nextOpenAt('schedule', windows, MONDAY(10, 0));
    expect(next).toEqual(MONDAY(13, 0));
  });

  it('오늘이 끝났으면 다음 요일로 넘어간다', () => {
    const windows = [window({ days: [1, 3], start: '09:00', end: '09:45' })];
    const next = nextOpenAt('schedule', windows, MONDAY(10, 0));
    // 다음 수요일 09:00
    expect(next).toEqual(new Date(2026, 8, 23, 9, 0));
  });

  it('한 주를 돌아 같은 요일로 돌아온다', () => {
    const windows = [window({ days: [1], start: '09:00', end: '09:45' })];
    const next = nextOpenAt('schedule', windows, MONDAY(10, 0));
    expect(next).toEqual(new Date(2026, 8, 28, 9, 0));
  });

  it('시간표 모드가 아니면 null', () => {
    expect(nextOpenAt('closed', [window()], MONDAY(10, 0))).toBeNull();
    expect(nextOpenAt('open', [window()], MONDAY(10, 0))).toBeNull();
  });

  it('쓸 수 있는 시간대가 없으면 null', () => {
    expect(nextOpenAt('schedule', [], MONDAY(10, 0))).toBeNull();
    expect(nextOpenAt('schedule', [window({ days: [] })], MONDAY(10, 0))).toBeNull();
  });
});

describe('describeNextOpen / describeWindow', () => {
  it('오늘·내일·요일로 나눠서 알려 준다', () => {
    expect(describeNextOpen(MONDAY(13, 0), MONDAY(10, 0))).toBe('오늘 13:00');
    expect(describeNextOpen(TUESDAY(9, 0), MONDAY(10, 0))).toBe('내일 09:00');
    expect(describeNextOpen(new Date(2026, 8, 23, 9, 0), MONDAY(10, 0))).toBe('수요일 09:00');
  });

  it('요일을 묶어서 보여 준다', () => {
    expect(describeWindow(window({ days: [3, 1], start: '09:00', end: '09:45' }))).toBe('월·수 09:00–09:45');
  });
});

describe('slotsForWindows / utcSlotAt', () => {
  it('시간대를 5분 조각으로 펼친다', () => {
    const slots = slotsForWindows([window({ days: [1], start: '09:00', end: '09:20' })], 0);
    expect(slots).toEqual([10900, 10905, 10910, 10915]);
  });

  it('요일마다 따로 펼친다', () => {
    const slots = slotsForWindows([window({ days: [1, 2], start: '09:00', end: '09:10' })], 0);
    expect(slots).toEqual([10900, 10905, 20900, 20905]);
  });

  it('시간대가 겹쳐도 조각은 한 번만 넣는다', () => {
    const slots = slotsForWindows(
      [
        window({ id: 'a', days: [1], start: '09:00', end: '09:10' }),
        window({ id: 'b', days: [1], start: '09:05', end: '09:15' }),
      ],
      0,
    );
    expect(slots).toEqual([10900, 10905, 10910]);
  });

  it('잘못 입력된 시간대는 건너뛴다', () => {
    expect(slotsForWindows([window({ start: '10:00', end: '09:00' })], 0)).toEqual([]);
  });

  it('시작 시각은 5분 경계로 내림한다', () => {
    const slots = slotsForWindows([window({ days: [1], start: '09:02', end: '09:12' })], 0);
    expect(slots).toEqual([10900, 10905, 10910]);
  });

  it('한국 시간(+9)을 UTC 로 옮겨서 넣는다', () => {
    // 월 09:00 KST = 월 00:00 UTC
    expect(slotsForWindows([window({ days: [1], start: '09:00', end: '09:05' })], KST)).toEqual([10000]);
  });

  it('새벽 시간대는 전날 UTC 로 넘어간다', () => {
    // 월 07:00 KST = 일 22:00 UTC
    expect(slotsForWindows([window({ days: [1], start: '07:00', end: '07:05' })], KST)).toEqual([2200]);
  });

  it('일요일 이전으로 넘어가면 토요일로 돌아간다', () => {
    // 일 08:00 KST = 토 23:00 UTC
    expect(slotsForWindows([window({ days: [0], start: '08:00', end: '08:05' })], KST)).toEqual([62300]);
  });

  it('utcSlotAt 은 그 시각이 속한 UTC 조각을 돌려준다', () => {
    expect(utcSlotAt(new Date(Date.UTC(2026, 8, 21, 9, 0)))).toBe(10900);
    expect(utcSlotAt(new Date(Date.UTC(2026, 8, 21, 9, 4)))).toBe(10900);
    expect(utcSlotAt(new Date(Date.UTC(2026, 8, 21, 9, 5)))).toBe(10905);
    expect(utcSlotAt(new Date(Date.UTC(2026, 8, 26, 23, 59)))).toBe(62355);
  });

  it('열려 있는 시각의 조각은 항상 목록 안에 있다', () => {
    // 기기 시간대가 무엇이든 화면 판단(현지 시각)과 규칙 판단(UTC 조각)이 같아야 한다.
    const windows = [window({ days: [1], start: '09:00', end: '09:45' })];
    const offset = -MONDAY(9, 0).getTimezoneOffset();
    const slots = slotsForWindows(windows, offset);

    for (let minute = 0; minute < 45; minute += 1) {
      const at = MONDAY(9, minute);
      expect(isOpenAt('schedule', windows, at)).toBe(true);
      expect(slots).toContain(utcSlotAt(at));
    }
  });

  it('닫혀 있는 시각의 조각은 목록에 없다', () => {
    const windows = [window({ days: [1], start: '09:00', end: '09:45' })];
    const offset = -MONDAY(9, 0).getTimezoneOffset();
    const slots = slotsForWindows(windows, offset);

    for (const at of [MONDAY(8, 50), MONDAY(9, 45), MONDAY(13, 0), TUESDAY(9, 10), SATURDAY(9, 10)]) {
      expect(isOpenAt('schedule', windows, at)).toBe(false);
      expect(slots).not.toContain(utcSlotAt(at));
    }
  });
});
