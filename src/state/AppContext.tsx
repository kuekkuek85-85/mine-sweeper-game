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
import { readJson, removeKey, writeJson } from '../lib/storage';
import { DEFAULT_APP_CONFIG, type AppConfig, type Student } from '../types';

export interface Settings {
  sound: boolean;
  vibrate: boolean;
  /** 원리 보기 모드: 연쇄 열기를 한 칸씩 보여 준다. 이 모드의 판은 기록하지 않는다. */
  explain: boolean;
  /** 물음표(?) 표시: 깃발을 한 번 더 누르면 ❓ 가 된다. */
  questionMark: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  sound: true,
  vibrate: true,
  explain: false,
  questionMark: true,
};

interface AppContextValue {
  student: Student | null;
  setStudent: (student: Student) => void;
  clearStudent: () => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  config: AppConfig;
  queuedCount: number;
  setQueuedCount: (count: number) => void;
}

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

  useEffect(() => subscribeAppConfig(setConfig), []);

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
      queuedCount,
      setQueuedCount,
    }),
    [student, setStudent, clearStudent, settings, updateSettings, config, queuedCount],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppProvider 안에서만 사용할 수 있습니다.');
  return value;
}
