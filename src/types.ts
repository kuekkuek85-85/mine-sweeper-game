import type { LevelId } from './game/levels';

/** 시작 화면에서 입력한 학생 정보 (localStorage + Firestore `students`) */
export interface Student {
  studentId: string;
  name: string;
  classNo: number;
}

/** `config/app` 문서 */
export interface AppConfig {
  season: string;
  gameOpen: boolean;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  season: '2026-2',
  gameOpen: true,
};

/** `records/{season}_{level}_{studentId}` 문서 */
export interface GameRecord {
  id: string;
  season: string;
  level: LevelId;
  studentId: string;
  name: string;
  classNo: number;
  plays: number;
  wins: number;
  bestTimeMs: number | null;
  bestAt: Date | null;
  updatedAt: Date | null;
}

/** 한 판이 끝났을 때 저장할 내용 */
export interface PendingResult {
  /** 재전송 대기열에서 중복을 막기 위한 키 */
  key: string;
  season: string;
  level: LevelId;
  studentId: string;
  name: string;
  classNo: number;
  won: boolean;
  timeMs: number | null;
  playedAt: number;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'queued' | 'skipped';
