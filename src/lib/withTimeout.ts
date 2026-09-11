/**
 * 정해진 시간 안에 끝나지 않는 작업을 기다리지 않고 넘어가기 위한 유틸.
 *
 * 학교 Wi-Fi가 끊기면 Firestore 요청이 10초 넘게 응답 없이 매달릴 수 있다.
 * 그 사이 학생 화면이 멈춰 수업이 끊기므로, 짧은 시간만 기다리고 오프라인으로 진행한다.
 */

/** 시간 안에 끝나지 않았음을 나타내는 표식 */
export const TIMED_OUT = Symbol('timed-out');

export type MaybeTimedOut<T> = T | typeof TIMED_OUT;

/**
 * `promise` 가 `ms` 안에 끝나면 그 결과를, 아니면 `TIMED_OUT` 을 돌려준다.
 * 작업이 실패하면 그 오류를 그대로 전달한다.
 *
 * 원래 작업을 취소하지는 않는다. Firestore 쓰기는 뒤늦게라도 전송되는 편이 낫기 때문이다.
 * 대신 시간이 지난 뒤의 실패가 처리되지 않은 거부로 남지 않도록 삼킨다.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<MaybeTimedOut<T>> {
  return new Promise<MaybeTimedOut<T>>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      // 뒤늦은 실패는 여기서 흡수한다. (이미 오프라인으로 진행한 뒤)
      promise.catch(() => {});
      resolve(TIMED_OUT);
    }, ms);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
