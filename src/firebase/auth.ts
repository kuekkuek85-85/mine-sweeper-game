/** 교사용 Google 로그인 + `admins/{uid}` 확인 */

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { getDb, getFirebaseAuth } from './app';

export function subscribeUser(onChange: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    onChange(null);
    return () => {};
  }
  return onAuthStateChanged(auth, onChange);
}

export async function signInWithGoogle(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase가 설정되어 있지 않습니다.');
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function signOutTeacher(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signOut(auth);
}

/** `admins` 컬렉션에 uid 문서가 있어야 교사로 인정한다. */
export async function isAdmin(uid: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const snapshot = await getDoc(doc(db, 'admins', uid));
    return snapshot.exists();
  } catch {
    return false;
  }
}
