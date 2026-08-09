/**
 * 같은 프로젝트의 같은 파이프라인 단계가 중복 트리거되는 것(예: 사용자가 "생성" 버튼을
 * 연타)을 막는 최소한의 인메모리 잠금. 서버가 재시작되면 자동으로 풀리는데, 각 단계가
 * 섹션/장면 단위로 체크포인트를 남기는 멱등적 설계라 재시작 후 다시 트리거해도 안전하다
 * (이미 끝난 부분은 다시 만들지 않는다) — 그래서 잠금을 디스크에 영속시킬 필요가 없다.
 */
const busyKeys = new Set<string>();

export function tryAcquire(key: string): boolean {
  if (busyKeys.has(key)) return false;
  busyKeys.add(key);
  return true;
}

export function release(key: string): void {
  busyKeys.delete(key);
}
