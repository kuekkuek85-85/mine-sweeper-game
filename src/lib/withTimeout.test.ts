import { describe, expect, it, vi } from 'vitest';

import { TIMED_OUT, withTimeout } from './withTimeout';

function later<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function failsLater(message: string, ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

describe('withTimeout', () => {
  it('시간 안에 끝나면 결과를 그대로 돌려준다', async () => {
    await expect(withTimeout(later('ok', 5), 200)).resolves.toBe('ok');
  });

  it('시간을 넘기면 TIMED_OUT 을 돌려준다', async () => {
    await expect(withTimeout(later('늦음', 300), 30)).resolves.toBe(TIMED_OUT);
  });

  it('작업이 실패하면 그 오류를 전달한다', async () => {
    await expect(withTimeout(failsLater('망함', 5), 200)).rejects.toThrow('망함');
  });

  it('시간을 넘긴 뒤 늦게 실패해도 처리되지 않은 거부가 생기지 않는다', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    const result = await withTimeout(failsLater('늦은 실패', 40), 10);
    expect(result).toBe(TIMED_OUT);

    // 늦은 실패가 도착할 시간을 준다.
    await later(null, 80);
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('이미 끝난 작업도 그대로 통과시킨다', async () => {
    await expect(withTimeout(Promise.resolve(42), 10)).resolves.toBe(42);
  });
});
