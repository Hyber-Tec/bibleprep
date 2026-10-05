// Verse text loader. Chapter text lives as static JSON under
//   public/bible/<translation>/<bookId>/<chapter>.json   →  { "verses": [{ "verse": 1, "text": "..." }, ...] }
// written by `npm run import:bible -- --all` (the full public-domain Bibles).

export interface Verse {
  verse: number; // not always index + 1: translations omit or merge some verses
  text: string;
}

export interface ChapterText {
  translation: string;
  bookId: number;
  chapter: number;
  verses: Verse[];
}

const cache = new Map<string, ChapterText | null>();

export async function loadChapter(
  translation: string,
  bookId: number,
  chapter: number
): Promise<ChapterText | null> {
  const key = `${translation}/${bookId}/${chapter}`;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const res = await fetch(`/bible/${key}.json`);
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const data = (await res.json()) as { verses: Verse[] };
    const result: ChapterText = {
      translation,
      bookId,
      chapter,
      verses: data.verses ?? [],
    };
    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, null);
    return null;
  }
}

/** Character-level comparison used to score typed input against the target. */
export function diffChars(target: string, typed: string) {
  const out: { ch: string; state: "correct" | "wrong" | "pending" }[] = [];
  for (let i = 0; i < target.length; i++) {
    if (i >= typed.length) out.push({ ch: target[i], state: "pending" });
    else if (typed[i] === target[i]) out.push({ ch: target[i], state: "correct" });
    else out.push({ ch: target[i], state: "wrong" });
  }
  return out;
}

/** A verse counts as "typed" when accuracy is at/above this fraction. */
export const ACCURACY_THRESHOLD = 0.9;

export function accuracy(target: string, typed: string): number {
  if (!target.length) return 1;
  let correct = 0;
  const n = Math.min(target.length, typed.length);
  for (let i = 0; i < n; i++) if (typed[i] === target[i]) correct++;
  return correct / target.length;
}
