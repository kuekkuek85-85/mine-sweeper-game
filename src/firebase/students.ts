/** `students/{studentId}` — 학번·이름 등록. 한 번 등록되면 이름이 고정된다. */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { parseStudentId } from '../lib/format';
import type { Student } from '../types';
import { getDb } from './app';

export type RegisterResult =
  | { ok: true; student: Student; offline: boolean }
  | { ok: false; reason: 'name-mismatch'; registeredName: string }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'error'; message: string };

/**
 * 학번을 등록하거나, 이미 등록돼 있으면 이름이 같은지 확인한다.
 * 다른 이름으로 등록된 학번이면 진행을 막는다. (PRD 6.2)
 */
export async function registerStudent(studentId: string, name: string): Promise<RegisterResult> {
  const parts = parseStudentId(studentId);
  if (!parts) return { ok: false, reason: 'invalid' };

  const student: Student = { studentId, name, classNo: parts.classNo };
  const db = getDb();
  if (!db) return { ok: true, student, offline: true };

  try {
    const ref = doc(db, 'students', studentId);
    const snapshot = await getDoc(ref);

    if (snapshot.exists()) {
      const registeredName = String(snapshot.data().name ?? '');
      if (registeredName !== name) {
        return { ok: false, reason: 'name-mismatch', registeredName };
      }
      return { ok: true, student, offline: false };
    }

    await setDoc(ref, { name, classNo: parts.classNo, createdAt: serverTimestamp() });
    return { ok: true, student, offline: false };
  } catch (error) {
    // 네트워크가 끊겨도 게임은 할 수 있게 통과시킨다. 기록은 대기열에 쌓인다.
    console.warn('[students] 등록 확인 실패, 오프라인으로 진행합니다.', error);
    return { ok: true, student, offline: true };
  }
}

export interface StudentRow extends Student {
  createdAt: Date | null;
}

export async function listStudents(): Promise<StudentRow[]> {
  const db = getDb();
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, 'students'), orderBy('__name__')));
  return snapshot.docs.map((d) => ({
    studentId: d.id,
    name: String(d.data().name ?? ''),
    classNo: Number(d.data().classNo ?? 0),
    createdAt: d.data().createdAt?.toDate?.() ?? null,
  }));
}

export async function updateStudentName(studentId: string, name: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase가 설정되어 있지 않습니다.');
  await updateDoc(doc(db, 'students', studentId), { name });
}

export async function deleteStudent(studentId: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase가 설정되어 있지 않습니다.');
  await deleteDoc(doc(db, 'students', studentId));
}
