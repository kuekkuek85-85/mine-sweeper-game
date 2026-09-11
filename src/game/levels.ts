/**
 * 난이도 설정은 이 파일 한 곳에서만 관리한다.
 * 수업에서 난이도를 바꾸고 싶으면 여기 숫자만 고치면 된다.
 */

export type LevelId = 'beginner' | 'intermediate' | 'expert';

export interface Level {
  id: LevelId;
  label: string;
  rows: number;
  cols: number;
  mines: number;
  /** 보안 규칙과 맞춘 최소 기록(ms). 이보다 빠른 기록은 저장되지 않는다. */
  minTimeMs: number;
}

export const LEVELS: Record<LevelId, Level> = {
  beginner: { id: 'beginner', label: '초급', rows: 9, cols: 9, mines: 10, minTimeMs: 1000 },
  intermediate: { id: 'intermediate', label: '중급', rows: 12, cols: 12, mines: 24, minTimeMs: 3000 },
  expert: { id: 'expert', label: '고급', rows: 16, cols: 16, mines: 40, minTimeMs: 8000 },
};

export const LEVEL_IDS: LevelId[] = ['beginner', 'intermediate', 'expert'];

export function isLevelId(value: unknown): value is LevelId {
  return typeof value === 'string' && (LEVEL_IDS as string[]).includes(value);
}

export function getLevel(id: LevelId): Level {
  return LEVELS[id];
}
