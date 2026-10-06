"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listProgress } from "@/lib/firebase/db";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getBook, bookName } from "@/lib/bible/books";
import type { ProgressRow } from "@/lib/progress";
import PageHeader, { BackLink } from "@/components/PageHeader";

export default function ChapterPicker({ bookId }: { bookId: number }) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const book = getBook(bookId);

  const [rows, setRows] = useState<ProgressRow[]>([]);

  // Progress is shared by every version and language.
  useEffect(() => {
    if (!user || !book) return;
    let alive = true;
    listProgress(user.id, bookId)
      .then((data) => {
        if (alive) setRows(data);
      })
      .catch((error) => console.error(error));
    return () => {
      alive = false;
    };
  }, [user, book, bookId]);

  if (!book) return <p className="text-muted-foreground">Unknown book.</p>;

  const statusOf = (ch: number) => rows.find((r) => r.chapter === ch);
  const chaptersDone = rows.filter((r) => r.completed).length;

  return (
    <div className="space-y-6">
      <PageHeader
        back={<BackLink href="/read">{t("read.title")}</BackLink>}
        title={bookName(book, locale)}
        description={
          <>
            {chaptersDone} / {book.chapters} {t("read.chaptersDone")}
          </>
        }
      />

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-primary" /> {t("read.done")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-primary/15" /> {t("read.partial")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] border" /> {t("read.todo")}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
        {Array.from({ length: book.chapters }, (_, i) => i + 1).map((ch) => {
          const r = statusOf(ch);
          const state = r?.completed ? "done" : r && r.verses_typed > 0 ? "partial" : "todo";
          return (
            <Link
              key={ch}
              href={`/read/${bookId}/${ch}`}
              data-state={state}
              className={cn(
                "flex h-10 items-center justify-center rounded-lg border text-sm font-medium tabular-nums outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                state === "done" && "border-transparent bg-primary text-primary-foreground hover:bg-primary/85",
                state === "partial" && "border-transparent bg-primary/15 hover:bg-primary/20",
                state === "todo" && "bg-background hover:bg-muted"
              )}
            >
              {ch}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
