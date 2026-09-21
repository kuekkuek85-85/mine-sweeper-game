/** 학생 정보, 설정, 앱 설정(config/app)을 앱 전체에서 공유한다. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { subscribeAppConfig } from '../firebase/config';
import { startQueueAutoFlush } from '../firebase/queue';
import { isOpenAt, nextOpenAt } from '../lib/schedule';
import { readJson, removeKey, writeJson } from '../lib/storage';
import { DEFAULT_APP_CONFIG, type AppConfig, type Student } from '../types';

export interface Settings {
  sound: boolean;
  vibrate: boolean;
  /** 원리 보기 모드: 연쇄 열기를 한 칸씩 보여 준다. 이 모드의 판은 기록하지 않는다. */
  explain: boolean;
  /** 물음표(?) 표시: 깃발을 한 번 더 누르면 ❓ 가 된다. */
  questionMark: boolean;
  /** 대시보드에서 참가자 이름을 가릴지. 기기마다 따로 기억한다. */
  maskNames: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  sound: true,
  vibrate: true,
  explain: false,
  questionMark: true,
  maskNames: false,
};

/** 지금 게임을 할 수 있는지. 시간표 모드면 1분 안에 저절로 바뀐다. */
export interface AccessState {
  open: boolean;
  /** 닫혀 있고 시간표가 잡혀 있을 때만 채워진다. */
  nextOpenAt: Date | null;
}

interface AppContextValue {
  student: Student | null;
  setStudent: (student: Student) => void;
  clearStudent: () => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  config: AppConfig;
  access: AccessState;
  queuedCount: number;
  setQueuedCount: (count: number) => void;
}

/** 시간표 모드에서 시간대 경계를 얼마나 촘촘히 확인할지 */
const ACCESS_TICK_MS = 20_000;

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [student, setStudentState] = useState<Student | null>(() =>
    readJson<Student | null>('student', null),
  );
  const [settings, setSettings] = useState<Settings>(() =>
    ({ ...DEFAULT_SETTINGS, ...readJson<Partial<Settings>>('settings', {}) }),
  );
  const [config, setConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [queuedCount, setQueuedCount] = useState(0);

  // 시간표 모드에서만 시계를 돌린다. 켜고 끄기만 쓰는 학급은 다시 그릴 일이 없다.
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => subscribeAppConfig(setConfig), []);

  useEffect(() => {
    // 설정이 바뀌는 순간에는 오래된 시각으로 판단하지 않도록 한 번 맞춰 둔다.
    setTick(Date.now());
    if (config.accessMode !== 'schedule') return;
    const timer = window.setInterval(() => setTick(Date.now()), ACCESS_TICK_MS);
    return () => window.clearInterval(timer);
  }, [config.accessMode, config.windows]);

  const access = useMemo<AccessState>(() => {
    const at = new Date(tick);
    const open = isOpenAt(config.accessMode, config.windows, at);
    return { open, nextOpenAt: open ? null : nextOpenAt(config.accessMode, config.windows, at) };
  }, [config.accessMode, config.windows, tick]);

  useEffect(() => startQueueAutoFlush(() => setQueuedCount(0)), []);

  const setStudent = useCallback((next: Student) => {
    writeJson('student', next);
    setStudentState(next);
  }, []);

  const clearStudent = useCallback(() => {
    removeKey('student');
    setStudentState(null);
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      writeJson('settings', next);
      return next;
    });
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      student,
      setStudent,
      clearStudent,
      settings,
      updateSettings,
      config,
      access,
      queuedCount,
      setQueuedCount,
    }),
    [student, setStudent, clearStudent, settings, updateSettings, config, access, queuedCount],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppProvider 안에서만 사용할 수 있습니다.');
  return value;
}
