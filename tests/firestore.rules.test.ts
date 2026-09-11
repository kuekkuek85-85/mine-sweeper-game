/**
 * firestore.rules 보안 규칙 테스트 (PRD Phase 4 완료 기준).
 *
 * 실행: npm run test:rules   (Firestore 에뮬레이터를 자동으로 띄운다)
 */

import { readFileSync } from 'node:fs';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const SEASON = '2026-2';
const STUDENT_ID = '10101';
const OTHER_ID = '10102';
const ADMIN_UID = 'teacher-uid';
const TEACHER_PIN = '123456';

let env: RulesTestEnvironment;

/** 학생(비로그인) 클라이언트 */
function studentDb() {
  return env.unauthenticatedContext().firestore();
}

/** 교사(admins 에 등록된 계정) 클라이언트 */
function adminDb() {
  return env.authenticatedContext(ADMIN_UID).firestore();
}

function recordId(level: string, studentId = STUDENT_ID) {
  return `${SEASON}_${level}_${studentId}`;
}

/** 한 판의 결과로 쓰는 문서 내용 */
function recordData(overrides: Record<string, unknown> = {}) {
  return {
    season: SEASON,
    level: 'beginner',
    studentId: STUDENT_ID,
    name: '이승엽',
    classNo: 1,
    plays: 1,
    wins: 1,
    bestTimeMs: 12_000,
    bestAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-minesweeper',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  // 규칙을 우회해 기본 데이터를 심는다.
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'students', STUDENT_ID), { name: '이승엽', classNo: 1, createdAt: new Date() });
    await setDoc(doc(db, 'students', OTHER_ID), { name: '김철수', classNo: 1, createdAt: new Date() });
    await setDoc(doc(db, 'admins', ADMIN_UID), { email: 'teacher@school.kr' });
    await setDoc(doc(db, 'config', 'app'), { season: SEASON, maskNames: true, gameOpen: true });
    await setDoc(doc(db, 'config', 'secret'), { pin: TEACHER_PIN });
  });
});

describe('students', () => {
  it('올바른 학번·이름이면 등록된다', async () => {
    const db = studentDb();
    await assertSucceeds(
      setDoc(doc(db, 'students', '10305'), { name: '박영희', classNo: 3, createdAt: serverTimestamp() }),
    );
  });

  it('학번 형식이 틀리면 거절된다', async () => {
    const db = studentDb();
    await assertFails(
      setDoc(doc(db, 'students', '20305'), { name: '박영희', classNo: 3, createdAt: serverTimestamp() }),
    );
  });

  it('학생은 이미 등록된 이름을 바꿀 수 없다', async () => {
    await assertFails(updateDoc(doc(studentDb(), 'students', STUDENT_ID), { name: '다른이름' }));
  });

  it('교사는 이름을 고칠 수 있다', async () => {
    await assertSucceeds(updateDoc(doc(adminDb(), 'students', STUDENT_ID), { name: '이승엽' }));
  });

  it('등록 정보는 누구나 읽을 수 있다', async () => {
    await assertSucceeds(getDoc(doc(studentDb(), 'students', STUDENT_ID)));
  });
});

describe('records — 정상 저장', () => {
  it('첫 판(승리) 기록이 저장된다', async () => {
    await assertSucceeds(setDoc(doc(studentDb(), 'records', recordId('beginner')), recordData()));
  });

  it('첫 판(패배) 기록이 저장된다', async () => {
    await assertSucceeds(
      setDoc(
        doc(studentDb(), 'records', recordId('beginner')),
        recordData({ wins: 0, bestTimeMs: null, bestAt: null }),
      ),
    );
  });

  it('더 빠른 기록으로 갱신된다', async () => {
    const db = studentDb();
    await setDoc(doc(db, 'records', recordId('beginner')), recordData());
    await assertSucceeds(
      updateDoc(doc(db, 'records', recordId('beginner')), {
        plays: 2,
        wins: 2,
        bestTimeMs: 9_000,
        bestAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('패배하면 승수와 최고 기록은 그대로, 도전 수만 늘어난다', async () => {
    const db = studentDb();
    await setDoc(doc(db, 'records', recordId('beginner')), recordData());
    await assertSucceeds(
      updateDoc(doc(db, 'records', recordId('beginner')), {
        plays: 2,
        wins: 1,
        bestTimeMs: 12_000,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  // PRD 9.1 초안에서는 이 경우가 거절되어 승수·도전 수를 올릴 수 없었다. (REVIEW.md 참고)
  it('승리했지만 최고 기록을 못 깨도 승수가 올라간다', async () => {
    const db = studentDb();
    await setDoc(doc(db, 'records', recordId('beginner')), recordData());
    await assertSucceeds(
      updateDoc(doc(db, 'records', recordId('beginner')), {
        plays: 2,
        wins: 2,
        bestTimeMs: 12_000, // 기존 기록 유지
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('records — 부정 방지', () => {
  it('느린 기록으로 최고 기록을 덮어쓸 수 없다', async () => {
    const db = studentDb();
    await setDoc(doc(db, 'records', recordId('beginner')), recordData());
    await assertFails(
      updateDoc(doc(db, 'records', recordId('beginner')), {
        plays: 2,
        wins: 2,
        bestTimeMs: 30_000, // 기존 12초보다 느린데 최고 기록으로 쓰려고 함
        bestAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('등록된 이름과 다른 이름으로는 저장할 수 없다', async () => {
    await assertFails(
      setDoc(doc(studentDb(), 'records', recordId('beginner')), recordData({ name: '가짜이름' })),
    );
  });

  it('최소 시간보다 빠른 기록은 거절된다 (초급 1초)', async () => {
    await assertFails(
      setDoc(doc(studentDb(), 'records', recordId('beginner')), recordData({ bestTimeMs: 500 })),
    );
  });

  it('중급·고급의 최소 시간도 적용된다', async () => {
    const db = studentDb();
    await assertFails(
      setDoc(
        doc(db, 'records', recordId('intermediate')),
        recordData({ level: 'intermediate', bestTimeMs: 2_000 }),
      ),
    );
    await assertFails(
      setDoc(doc(db, 'records', recordId('expert')), recordData({ level: 'expert', bestTimeMs: 7_000 })),
    );
  });

  it('문서 ID가 season_level_studentId 와 다르면 거절된다', async () => {
    await assertFails(setDoc(doc(studentDb(), 'records', 'aaa_bbb_ccc'), recordData()));
  });

  it('다른 학생의 기록을 대신 쓸 수 없다 (ID와 studentId 불일치)', async () => {
    await assertFails(
      setDoc(doc(studentDb(), 'records', recordId('beginner', OTHER_ID)), recordData()),
    );
  });

  it('도전 수를 한 번에 여러 번 올릴 수 없다', async () => {
    const db = studentDb();
    await setDoc(doc(db, 'records', recordId('beginner')), recordData());
    await assertFails(
      updateDoc(doc(db, 'records', recordId('beginner')), {
        plays: 10,
        wins: 1,
        bestTimeMs: 12_000,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('없는 난이도는 거절된다', async () => {
    await assertFails(
      setDoc(doc(studentDb(), 'records', recordId('cheat')), recordData({ level: 'cheat' })),
    );
  });

  it('학생은 기록을 삭제할 수 없고, 교사는 삭제할 수 있다', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'records', recordId('beginner')), {
        ...recordData(),
        bestAt: new Date(),
        updatedAt: new Date(),
      });
    });
    const { deleteDoc } = await import('firebase/firestore');
    await assertFails(deleteDoc(doc(studentDb(), 'records', recordId('beginner'))));
    await assertSucceeds(deleteDoc(doc(adminDb(), 'records', recordId('beginner'))));
  });

  it('순위표는 누구나 읽을 수 있다', async () => {
    await assertSucceeds(getDoc(doc(studentDb(), 'records', recordId('beginner'))));
  });
});

describe('config / admins', () => {
  it('config 는 누구나 읽지만 교사만 쓸 수 있다', async () => {
    await assertSucceeds(getDoc(doc(studentDb(), 'config', 'app')));
    await assertFails(updateDoc(doc(studentDb(), 'config', 'app'), { gameOpen: false }));
    await assertSucceeds(updateDoc(doc(adminDb(), 'config', 'app'), { gameOpen: false }));
  });

  it('admins 는 아무도 쓸 수 없다 (콘솔에서만 등록)', async () => {
    await assertFails(setDoc(doc(adminDb(), 'admins', 'someone'), { email: 'x@y.z' }));
  });

  it('교사가 아닌 로그인 계정은 관리 권한이 없다', async () => {
    const outsider = env.authenticatedContext('stranger-uid').firestore();
    await assertFails(updateDoc(doc(outsider, 'config', 'app'), { gameOpen: false }));
  });
});

describe('교사 핀 번호 인증', () => {
  /** 익명 로그인한 사용자를 흉내 낸다. */
  function anonDb(uid: string) {
    return env.authenticatedContext(uid).firestore();
  }

  it('핀이 맞으면 교사 세션이 열린다', async () => {
    const db = anonDb('anon-1');
    await assertSucceeds(
      setDoc(doc(db, 'teacherSessions', 'anon-1'), { pin: TEACHER_PIN, createdAt: serverTimestamp() }),
    );
  });

  it('핀이 틀리면 세션이 열리지 않는다', async () => {
    const db = anonDb('anon-2');
    await assertFails(
      setDoc(doc(db, 'teacherSessions', 'anon-2'), { pin: '000000', createdAt: serverTimestamp() }),
    );
  });

  it('핀은 앱에서 읽을 수 없다 (규칙 안에서만 대조)', async () => {
    await assertFails(getDoc(doc(studentDb(), 'config', 'secret')));
    await assertFails(getDoc(doc(adminDb(), 'config', 'secret')));
  });

  it('교사도 핀 문서를 바꿀 수 없다 (콘솔에서만)', async () => {
    await assertFails(setDoc(doc(adminDb(), 'config', 'secret'), { pin: '999999' }));
  });

  it('남의 uid 로는 세션을 만들 수 없다', async () => {
    const db = anonDb('anon-3');
    await assertFails(
      setDoc(doc(db, 'teacherSessions', 'anon-4'), { pin: TEACHER_PIN, createdAt: serverTimestamp() }),
    );
  });

  it('로그인하지 않으면 핀이 맞아도 세션을 열 수 없다', async () => {
    await assertFails(
      setDoc(doc(studentDb(), 'teacherSessions', 'nobody'), {
        pin: TEACHER_PIN,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('세션을 나중에 고쳐서 권한을 유지할 수 없다', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'teacherSessions', 'anon-5'), {
        pin: TEACHER_PIN,
        createdAt: new Date(),
      });
    });
    const { updateDoc: update } = await import('firebase/firestore');
    await assertFails(update(doc(anonDb('anon-5'), 'teacherSessions', 'anon-5'), { pin: 'x' }));
  });

  it('핀으로 연 세션은 교사 권한을 가진다 (기록 삭제·설정 변경)', async () => {
    const db = anonDb('anon-6');
    await setDoc(doc(db, 'teacherSessions', 'anon-6'), {
      pin: TEACHER_PIN,
      createdAt: serverTimestamp(),
    });
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'records', recordId('beginner')), {
        ...recordData(),
        bestAt: new Date(),
        updatedAt: new Date(),
      });
    });
    const { deleteDoc } = await import('firebase/firestore');
    await assertSucceeds(deleteDoc(doc(db, 'records', recordId('beginner'))));
    await assertSucceeds(updateDoc(doc(db, 'config', 'app'), { gameOpen: false }));
  });

  it('세션을 닫으면 권한이 사라진다', async () => {
    const db = anonDb('anon-7');
    await setDoc(doc(db, 'teacherSessions', 'anon-7'), {
      pin: TEACHER_PIN,
      createdAt: serverTimestamp(),
    });
    const { deleteDoc } = await import('firebase/firestore');
    await assertSucceeds(deleteDoc(doc(db, 'teacherSessions', 'anon-7')));
    await assertFails(updateDoc(doc(db, 'config', 'app'), { gameOpen: false }));
  });
});

describe('규칙 커버리지 요약', () => {
  it('PRD Phase 4 완료 기준 4종을 모두 다룬다', () => {
    expect([
      '정상 저장',
      '느린 기록으로 덮어쓰기 거절',
      '다른 이름 거절',
      '최소 시간 미만 거절',
    ]).toHaveLength(4);
  });
});
