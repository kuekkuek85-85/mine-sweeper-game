/** `config/app` 문서 읽기/쓰기 (시즌, 이름 마스킹, 게임 열기) */

import { doc, onSnapshot, setDoc } from 'firebase/firestore';

import { DEFAULT_APP_CONFIG, type AppConfig } from '../types';
import { getDb } from './app';

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
    (snapshot) => {
      const data = snapshot.data();
      onChange({
        season: typeof data?.season === 'string' ? data.season : DEFAULT_APP_CONFIG.season,
        gameOpen: typeof data?.gameOpen === 'boolean' ? data.gameOpen : DEFAULT_APP_CONFIG.gameOpen,
      });
    },
    (error) => {
      // 읽기 실패 시에도 기본값으로 게임은 계속 할 수 있게 한다.
      onChange(DEFAULT_APP_CONFIG);
      onError?.(error);
    },
  );
}

export async function updateAppConfig(patch: Partial<AppConfig>): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase가 설정되어 있지 않습니다.');
  await setDoc(doc(db, 'config', 'app'), patch, { merge: true });
}
