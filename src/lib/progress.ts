import { BOOKS } from "@/lib/bible/books";

export type BookStatus = "done" | "partial" | "todo";

export interface ProgressRow {
  book_id: number;
  chapter: number;
  completed: boolean;
  verses_typed: number;
}

export interface BookAgg {
  bookId: number;
  chaptersDone: number;
  totalChapters: number;
  versesTyped: number;
  status: BookStatus;
}

/** Build a `${bookId}:${chapter}` -> row map for fast lookup. */
export function indexProgress(rows: ProgressRow[]) {
  const map = new Map<string, ProgressRow>();
  for (const r of rows) map.set(`${r.book_id}:${r.chapter}`, r);
  return map;
}

/** Aggregate per-book completion + an overall summary. */
export function aggregate(rows: ProgressRow[]) {
  const doneByBook = new Map<number, number>();
  const versesByBook = new Map<number, number>();
  let versesTyped = 0;
  let chaptersDone = 0;

  for (const r of rows) {
    versesTyped += r.verses_typed;
    versesByBook.set(r.book_id, (versesByBook.get(r.book_id) ?? 0) + r.verses_typed);
    if (r.completed) {
      chaptersDone += 1;
      doneByBook.set(r.book_id, (doneByBook.get(r.book_id) ?? 0) + 1);
    }
  }

  const books: BookAgg[] = BOOKS.map((b) => {
    const done = doneByBook.get(b.id) ?? 0;
    const status: BookStatus =
      done >= b.chapters ? "done" : done > 0 ? "partial" : "todo";
    return {
      bookId: b.id,
      chaptersDone: done,
      totalChapters: b.chapters,
      versesTyped: versesByBook.get(b.id) ?? 0,
      status,
    };
  });

  const totalChapters = BOOKS.reduce((n, b) => n + b.chapters, 0);
  return {
    books,
    versesTyped,
    chaptersDone,
    totalChapters,
    percent: totalChapters ? Math.round((chaptersDone / totalChapters) * 1000) / 10 : 0,
  };
}
