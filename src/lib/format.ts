/** 표시용 포맷과 학번 규칙을 한곳에 모은다. */

/** 화면 표시는 0.1초 단위 (예: 12.3) */
export function formatSeconds(ms: number): string {
  return (Math.floor(ms / 100) / 10).toFixed(1);
}

/** 기록 표시 (예: 1:02.3 / 12.3초) */
export function formatRecord(ms: number | null | undefined): string {
  if (ms == null) return '-';
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${formatSeconds(ms)}초`;
  const minutes = Math.floor(totalSeconds / 60);
  const rest = ms - minutes * 60_000;
  return `${minutes}:${formatSeconds(rest).padStart(4, '0')}`;
}

/** 학번 형식: 5자리, 1로 시작 (예: 10101 = 1학년 1반 1번) */
export const STUDENT_ID_PATTERN = /^1\d{4}$/;

export function isValidStudentId(id: string): boolean {
  return STUDENT_ID_PATTERN.test(id);
}

/** 이름: 한글 2~5자 */
export const NAME_PATTERN = /^[가-힣]{2,5}$/;

export function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name.trim());
}

export interface StudentIdParts {
  grade: number;
  classNo: number;
  number: number;
}

export function parseStudentId(id: string): StudentIdParts | null {
  if (!isValidStudentId(id)) return null;
  return {
    grade: Number(id.slice(0, 1)),
    classNo: Number(id.slice(1, 3)),
    number: Number(id.slice(3, 5)),
  };
}

export function describeStudentId(id: string, name: string): string | null {
  const parts = parseStudentId(id);
  if (!parts) return null;
  return `${parts.grade}학년 ${parts.classNo}반 ${parts.number}번 ${name}`;
}

/** 대시보드 이름 마스킹: 이승엽 → 이○엽, 김철 → 김○ */
export function maskName(name: string): string {
  if (name.length <= 1) return name;
  if (name.length === 2) return `${name[0]}○`;
  return `${name[0]}${'○'.repeat(name.length - 2)}${name[name.length - 1]}`;
}

/**
 * 순위표 이름 검색. 공백과 대소문자를 무시하고 부분 일치로 찾는다.
 * 검색어가 비어 있으면 모두 통과시킨다.
 *
 * 이름이 가려져 있어도(이○엽) 원래 이름으로 찾을 수 있게, 비교는 항상 실제 이름으로 한다.
 */
export function matchesName(name: string, query: string): boolean {
  const needle = query.replace(/\s+/g, '').toLowerCase();
  if (needle === '') return true;
  return name.replace(/\s+/g, '').toLowerCase().includes(needle);
}

export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
