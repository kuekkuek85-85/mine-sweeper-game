/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

/** 보안 규칙 테스트는 Firestore 에뮬레이터가 필요해 일반 단위 테스트와 분리한다. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // 같은 에뮬레이터 데이터를 지우고 쓰므로 순차 실행한다.
    fileParallelism: false,
  },
});
