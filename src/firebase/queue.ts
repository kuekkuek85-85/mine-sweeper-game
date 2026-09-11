/**
 * 기록 저장 실패 시 localStorage 대기열에 보관하고,
 * 네트워크가 돌아오면 자동으로 다시 보낸다. (PRD 8.3)
 */

import { readJson, writeJson } from '../lib/storage';
import type { PendingResult } from '../types';
import { firebaseEnabled } from './app';
import { saveResult } from './records';

const QUEUE_KEY = 'pending-results';
const MAX_QUEUE = 50;

export function readQueue(): PendingResult[] {
  return readJson<PendingResult[]>(QUEUE_KEY, []);
}

function writeQueue(items: PendingResult[]): void {
  writeJson(QUEUE_KEY, items.slice(-MAX_QUEUE));
}

export function enqueueResult(result: PendingResult): void {
  const queue = readQueue();
  if (queue.some((item) => item.key === result.key)) return;
  writeQueue([...queue, result]);
}

export function queueLength(): number {
  return readQueue().length;
}

let flushing = false;

/** 대기열을 앞에서부터 보낸다. 실패하면 남겨 두고 다음 기회에 다시 시도한다. */
export async function flushQueue(): Promise<number> {
  if (flushing || !firebaseEnabled) return 0;
  flushing = true;
  let sent = 0;
  try {
    let queue = readQueue();
    while (queue.length > 0) {
      const [head, ...rest] = queue;
      try {
        await saveResult(head);
      } catch (error) {
        console.warn('[queue] 재전송 실패, 나중에 다시 시도합니다.', error);
        break;
      }
      queue = rest;
      writeQueue(queue);
      sent += 1;
    }
  } finally {
    flushing = false;
  }
  return sent;
}

/** 온라인 복귀 / 탭 복귀 시 자동 재전송을 걸어 둔다. */
export function startQueueAutoFlush(onFlushed?: (sent: number) => void): () => void {
  if (!firebaseEnabled) return () => {};

  const run = () => {
    void flushQueue().then((sent) => {
      if (sent > 0) onFlushed?.(sent);
    });
  };

  run();
  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', run);
  const timer = window.setInterval(run, 30_000);

  return () => {
    window.removeEventListener('online', run);
    document.removeEventListener('visibilitychange', run);
    window.clearInterval(timer);
  };
}
