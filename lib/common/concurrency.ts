/** 작업 목록을 받아 최대 `limit`개씩만 동시에 실행한다. 순서를 유지한 결과 배열을 반환. */
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= tasks.length) return;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(new Array(Math.min(limit, tasks.length)).fill(0).map(() => worker()));
  return results;
}
