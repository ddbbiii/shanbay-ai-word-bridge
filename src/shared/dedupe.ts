export interface RecentCapture {
  word: string;
  at: number;
}

export function isRecentDuplicate(
  previous: RecentCapture | null,
  word: string,
  now: number,
  windowMs = 900
): boolean {
  return previous?.word === word && now - previous.at >= 0 && now - previous.at < windowMs;
}
