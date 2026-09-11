/**
 * 시드 기반 난수.
 * 같은 시드를 넣으면 항상 같은 보드가 나오므로 테스트와 재현에 사용한다.
 */

export type Rng = () => number;

/** mulberry32 — 짧고 품질이 충분한 시드 난수 생성기 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 0 이상 max 미만의 정수 */
export function randomInt(rng: Rng, max: number): number {
  return Math.floor(rng() * max);
}

/** Fisher–Yates 셔플. 원본을 바꾸지 않고 새 배열을 돌려준다. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(rng, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 새 판을 시작할 때 쓰는 임의 시드 */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
