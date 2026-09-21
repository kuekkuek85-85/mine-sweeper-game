/** `config/app` 문서 읽기/쓰기 (시즌, 접속 허용) */

import { doc, onSnapshot, setDoc } from 'firebase/firestore';

import { isValidWindow, slotsForWindows, type AccessMode, type AccessWindow } from '../lib/schedule';
import { DEFAULT_APP_CONFIG, type AppConfig } from '../types';
import { getDb } from './app';

const MODES: AccessMode[] = ['open', 'closed', 'schedule'];

/**
 * 콘솔에서 손으로 고칠 수 있는 문서라 값을 그대로 믿지 않는다.
 * 읽을 수 없는 값은 기본값(열림)으로 돌려, 설정 실수로 수업이 막히지 않게 한다.
 */
function parseConfig(data: Record<string, unknown> | undefined): AppConfig {
  const rawMode = data?.accessMode;
  const mode = MODES.includes(rawMode as AccessMode)
    ? (rawMode as AccessMode)
    : // accessMode 가 없던 시절의 문서. gameOpen 만 보고 판단한다.
      data?.gameOpen === false
      ? 'closed'
      : 'open';

  return {
    season: typeof data?.season === 'string' ? data.season : DEFAULT_APP_CONFIG.season,
    accessMode: mode,
    windows: parseWindows(data?.windows),
  };
}

function parseWindows(raw: unknown): AccessWindow[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index): AccessWindow => {
      const value = (item ?? {}) as Record<string, unknown>;
      return {
        id: typeof value.id === 'string' ? value.id : `w${index}`,
        days: Array.isArray(value.days) ? value.days.filter((day): day is number => typeof day === 'number') : [],
        start: typeof value.start === 'string' ? value.start : '',
        end: typeof value.end === 'string' ? value.end : '',
        label: typeof value.label === 'string' ? value.label : '',
      };
    })
    .filter(isValidWindow);
}

export function subscribeAppConfig(
  onChange: (config: AppConfig) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getDb();
  if (!db) {
    onChange(DEFAULT_APP_CONFIG);
    return () => {};
  }

  return onSnapshot(
    doc(db, 'config', 'app'),
    (snapshot) => onChange(parseConfig(snapshot.data())),
    (error) => {
      // 읽기 실패 시에도 기본값으로 게임은 계속 할 수 있게 한다.
      onChange(DEFAULT_APP_CONFIG);
      onError?.(error);
    },
  );
}

export async function updateAppConfig(patch: { season: string }): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase가 설정되어 있지 않습니다.');
  await setDoc(doc(db, 'config', 'app'), patch, { merge: true });
}

/**
 * 접속 허용 설정 저장.
 *
 * 화면이 보는 `accessMode`/`windows` 와 함께, 보안 규칙이 볼 `slots` 를 같이 넣는다.
 * 규칙 언어에는 반복문이 없어서 시간대를 그대로 확인할 수 없기 때문이다. (lib/schedule.ts 참고)
 *
 * `gameOpen` 은 예전 버전이 열려 있는 탭을 위해 같이 써 준다.
 * 그 화면들은 `gameOpen` 만 보고 열림/닫힘을 판단한다.
 */
export async function updateAccess(mode: AccessMode, windows: AccessWindow[]): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase가 설정되어 있지 않습니다.');

  const usable = windows.filter(isValidWindow);
  await setDoc(
    doc(db, 'config', 'app'),
    {
      accessMode: mode,
      windows: usable,
      slots: mode === 'schedule' ? slotsForWindows(usable) : [],
      gameOpen: mode !== 'closed',
    },
    { merge: true },
  );
}
