/**
 * 교사 인증 — 핀 번호 방식.
 *
 * Google 로그인 대신 핀 번호를 쓰되, 확인은 **서버(보안 규칙)에서** 한다.
 *
 *  1. 익명 로그인으로 uid 를 하나 받는다.
 *  2. `teacherSessions/{uid}` 문서를 핀과 함께 만들려고 시도한다.
 *  3. 보안 규칙이 `config/secret` 의 핀과 대조해, 맞을 때만 문서 생성을 허용한다.
 *  4. 이후 기록 삭제·설정 변경 규칙은 이 세션 문서가 있는지로 교사를 판단한다.
 *
 * 핀은 앱 코드에 들어가지 않고, 콘솔에서 값만 바꾸면 재배포 없이 변경된다.
 */

import {
  onAuthStateChanged,
  signInAnonymously,
  signOut,
  type User,
} from 'firebase/auth';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { getDb, getFirebaseAuth } from './app';

export function subscribeUser(onChange: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    onChange(null);
    return () => {};
  }
  return onAuthStateChanged(auth, onChange);
}

export type UnlockResult =
  | { ok: true }
  | { ok: false; reason: 'wrong-pin' | 'anonymous-disabled' | 'no-pin-set' | 'error'; message: string };

/** 핀 번호로 교사 세션을 연다. */
export async function unlockTeacher(pin: string): Promise<UnlockResult> {
  const auth = getFirebaseAuth();
  const db = getDb();
  if (!auth || !db) {
    return { ok: false, reason: 'error', message: 'Firebase가 설정되어 있지 않습니다.' };
  }

  try {
    const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
    await setDoc(doc(db, 'teacherSessions', user.uid), {
      pin,
      createdAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (error) {
    const code = (error as { code?: string }).code ?? '';

    if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
      return {
        ok: false,
        reason: 'anonymous-disabled',
        message: 'Firebase 콘솔 → Authentication에서 "익명" 로그인을 켜 주세요.',
      };
    }
    if (code === 'permission-denied') {
      // 핀이 틀렸거나, config/secret 문서가 아직 없는 경우 모두 여기로 온다.
      return { ok: false, reason: 'wrong-pin', message: '핀 번호가 맞지 않습니다.' };
    }
    return { ok: false, reason: 'error', message: (error as Error).message };
  }
}

/** 이미 열린 교사 세션인지 확인한다. (새로고침해도 유지되도록) */
export async function isTeacher(uid: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const session = await getDoc(doc(db, 'teacherSessions', uid));
    if (session.exists()) return true;
    // 콘솔에서 등록한 Google 계정(admins)도 그대로 인정한다.
    const admin = await getDoc(doc(db, 'admins', uid));
    return admin.exists();
  } catch {
    return false;
  }
}

/** 교사 세션을 닫는다. (세션 문서 삭제 + 로그아웃) */
export async function lockTeacher(): Promise<void> {
  const auth = getFirebaseAuth();
  const db = getDb();
  const uid = auth?.currentUser?.uid;

  if (db && uid) {
    try {
      await deleteDoc(doc(db, 'teacherSessions', uid));
    } catch (error) {
      console.warn('[auth] 교사 세션 정리 실패', error);
    }
  }
  if (auth) await signOut(auth);
}
