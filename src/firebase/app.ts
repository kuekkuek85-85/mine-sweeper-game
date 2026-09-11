/**
 * Firebase 초기화.
 *
 * 환경 변수(VITE_FIREBASE_*)가 없으면 `firebaseEnabled === false` 가 되고,
 * 앱은 "오프라인 모드"로 동작한다. (게임 플레이는 그대로, 기록 저장·대시보드만 비활성)
 * 덕분에 Firebase 설정 전에도 수업에서 게임을 쓸 수 있다.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseEnabled = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let auth: Auth | null = null;

function getApp(): FirebaseApp | null {
  if (!firebaseEnabled) return null;
  if (!app) app = initializeApp(config);
  return app;
}

/** Firestore 인스턴스. 설정이 없으면 null. */
export function getDb(): Firestore | null {
  if (!firebaseEnabled) return null;
  if (!firestore) {
    const instance = getApp();
    firestore = instance ? getFirestore(instance) : null;
  }
  return firestore;
}

/** Auth 인스턴스. 설정이 없으면 null. */
export function getFirebaseAuth(): Auth | null {
  if (!firebaseEnabled) return null;
  if (!auth) {
    const instance = getApp();
    auth = instance ? getAuth(instance) : null;
  }
  return auth;
}
