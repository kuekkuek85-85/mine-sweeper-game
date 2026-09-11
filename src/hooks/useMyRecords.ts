/** 내 기록(난이도별)을 실시간으로 구독한다. */

import { useEffect, useState } from 'react';

import { subscribeMyRecord } from '../firebase/records';
import { LEVEL_IDS, type LevelId } from '../game/levels';
import type { GameRecord } from '../types';

export type MyRecords = Partial<Record<LevelId, GameRecord | null>>;

export function useMyRecords(season: string, studentId: string | null | undefined): MyRecords {
  const [records, setRecords] = useState<MyRecords>({});

  useEffect(() => {
    if (!studentId) {
      setRecords({});
      return;
    }
    const unsubscribes = LEVEL_IDS.map((level) =>
      subscribeMyRecord(season, level, studentId, (record) =>
        setRecords((previous) => ({ ...previous, [level]: record })),
      ),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [season, studentId]);

  return records;
}
