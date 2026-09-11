/**
 * `records/{season}_{level}_{studentId}` — 학생별·난이도별 기록.
 *
 * 한 판이 끝날 때 트랜잭션으로 문서 하나를 갱신한다. (판마다 새 문서를 만들지 않는다)
 */

import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit as limitTo,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { isLevelId, type LevelId } from '../game/levels';
import type { GameRecord, PendingResult } from '../types';
import { getDb } from './app';

export const DASHBOARD_LIMIT = 50;

export function recordId(season: string, level: LevelId, studentId: string): string {
  return `${season}_${level}_${studentId}`;
}

function toRecord(snapshot: QueryDocumentSnapshot): GameRecord {
  const data = snapshot.data();
  const level = isLevelId(data.level) ? data.level : 'beginner';
  return {
    id: snapshot.id,
    season: String(data.season ?? ''),
    level,
    studentId: String(data.studentId ?? ''),
    name: String(data.name ?? ''),
    classNo: Number(data.classNo ?? 0),
    plays: Number(data.plays ?? 0),
    wins: Number(data.wins ?? 0),
    bestTimeMs: typeof data.bestTimeMs === 'number' ? data.bestTimeMs : null,
    bestAt: data.bestAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  };
}

/**
 * 한 판의 결과를 저장한다.
 * - plays +1, 승리면 wins +1
 * - 승리이고 기존 기록보다 빠르면 bestTimeMs / bestAt 갱신
 */
export async function saveResult(result: PendingResult): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase가 설정되어 있지 않습니다.');

  const ref = doc(db, 'records', recordId(result.season, result.level, result.studentId));

  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref);
    const won = result.won && typeof result.timeMs === 'number';
    const timeMs = won ? (result.timeMs as number) : null;

    if (!snapshot.exists()) {
      tx.set(ref, {
        season: result.season,
        level: result.level,
        studentId: result.studentId,
        name: result.name,
        classNo: result.classNo,
        plays: 1,
        wins: won ? 1 : 0,
        bestTimeMs: timeMs,
        bestAt: won ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const data = snapshot.data();
    const previousBest: number | null = typeof data.bestTimeMs === 'number' ? data.bestTimeMs : null;
    const isNewBest = won && timeMs !== null && (previousBest === null || timeMs < previousBest);

    tx.update(ref, {
      name: result.name,
      classNo: result.classNo,
      plays: Number(data.plays ?? 0) + 1,
      wins: Number(data.wins ?? 0) + (won ? 1 : 0),
      bestTimeMs: isNewBest ? timeMs : previousBest,
      ...(isNewBest ? { bestAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    });
  });
}

export interface DashboardOptions {
  season: string;
  level: LevelId;
  classNo?: number | null;
}

/** 대시보드 순위 실시간 구독. 최고 기록 오름차순, 같으면 먼저 달성한 순. */
export function subscribeRanking(
  options: DashboardOptions,
  onChange: (records: GameRecord[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getDb();
  if (!db) {
    onChange([]);
    return () => {};
  }

  const constraints = [
    where('season', '==', options.season),
    where('level', '==', options.level),
    ...(options.classNo ? [where('classNo', '==', options.classNo)] : []),
    // bestTimeMs == null 인 문서(아직 승리 전)는 순위에서 제외한다.
    where('bestTimeMs', '>', 0),
    orderBy('bestTimeMs', 'asc'),
    orderBy('bestAt', 'asc'),
    limitTo(DASHBOARD_LIMIT),
  ];

  return onSnapshot(
    query(collection(db, 'records'), ...constraints),
    (snapshot) => onChange(snapshot.docs.map(toRecord)),
    (error) => onError?.(error),
  );
}

/** 내 기록 문서 하나를 실시간 구독한다. */
export function subscribeMyRecord(
  season: string,
  level: LevelId,
  studentId: string,
  onChange: (record: GameRecord | null) => void,
): () => void {
  const db = getDb();
  if (!db) {
    onChange(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'records', recordId(season, level, studentId)),
    (snapshot) => onChange(snapshot.exists() ? toRecord(snapshot as QueryDocumentSnapshot) : null),
    () => onChange(null),
  );
}

/** 내 순위 = 나보다 빠른 기록 수 + 1 */
export async function fetchMyRank(
  options: DashboardOptions,
  bestTimeMs: number,
): Promise<number | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snapshot = await getCountFromServer(
      query(
        collection(db, 'records'),
        where('season', '==', options.season),
        where('level', '==', options.level),
        ...(options.classNo ? [where('classNo', '==', options.classNo)] : []),
        where('bestTimeMs', '>', 0),
        where('bestTimeMs', '<', bestTimeMs),
      ),
    );
    return snapshot.data().count + 1;
  } catch (error) {
    console.warn('[records] 순위 조회 실패', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 교사 관리용
// ---------------------------------------------------------------------------

export async function listRecordsBySeason(season: string): Promise<GameRecord[]> {
  const db = getDb();
  if (!db) return [];
  const snapshot = await getDocs(
    query(collection(db, 'records'), where('season', '==', season), orderBy('__name__')),
  );
  return snapshot.docs.map(toRecord);
}

export async function deleteRecord(id: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase가 설정되어 있지 않습니다.');
  await deleteDoc(doc(db, 'records', id));
}

/** 시즌 데이터 일괄 삭제 (학기 종료 후 정리용) */
export async function deleteSeasonRecords(season: string): Promise<number> {
  const db = getDb();
  if (!db) throw new Error('Firebase가 설정되어 있지 않습니다.');
  const snapshot = await getDocs(query(collection(db, 'records'), where('season', '==', season)));

  let deleted = 0;
  for (let i = 0; i < snapshot.docs.length; i += 400) {
    const batch = writeBatch(db);
    for (const document of snapshot.docs.slice(i, i + 400)) {
      batch.delete(document.ref);
      deleted += 1;
    }
    await batch.commit();
  }
  return deleted;
}
