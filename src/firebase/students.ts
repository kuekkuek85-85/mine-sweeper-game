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
import { TIMED_OUT, withTimeout } from '../lib/withTimeout';
import type { Student } from '../types';
import { getDb } from './app';

export type RegisterResult =
  | { ok: true; student: Student; offline: boolean }
  | { ok: false; reason: 'name-mismatch'; registeredName: string }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'error'; message: string };

/**
 * 등록 확인을 기다리는 시간. 이 시간을 넘기면 오프라인으로 보고 게임에 들여보낸다.
 *
 * Firestore 는 연결이 끊겨도 자체 타임아웃(약 10초)까지 응답을 붙잡고 있어서,
 * 그대로 두면 시작 화면에서 학생이 15초 가까이 멈춰 선다. 한 반이 동시에 그러면 수업이 끊긴다.
 */
export const REGISTER_TIMEOUT_MS = 3_000;

/**
 * 학번을 등록하거나, 이미 등록돼 있으면 이름이 같은지 확인한다.
 * 다른 이름으로 등록된 학번이면 진행을 막는다. (PRD 6.2)
 *
 * 네트워크가 느리거나 끊겼으면 확인을 포기하고 오프라인으로 통과시킨다.
 * 이때 학번 도용을 놓칠 수 있지만, 보안 규칙이 서버에서 `name == 등록된 이름` 을
 * 다시 확인하므로 잘못된 기록이 저장되지는 않는다. (PRD 10 "오프라인" 항목)
 */
export async function registerStudent(studentId: string, name: string): Promise<RegisterResult> {
  const parts = parseStudentId(studentId);
  if (!parts) return { ok: false, reason: 'invalid' };

  const student: Student = { studentId, name, classNo: parts.classNo };
  const db = getDb();
  if (!db) return { ok: true, student, offline: true };

  const check = async (): Promise<RegisterResult> => {
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
  };

  try {
    const result = await withTimeout(check(), REGISTER_TIMEOUT_MS);
    if (result === TIMED_OUT) {
      console.warn('[students] 등록 확인이 느려 오프라인으로 진행합니다.');
      return { ok: true, student, offline: true };
    }
    return result;
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
