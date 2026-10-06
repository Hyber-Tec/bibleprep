"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LuCircleCheck } from "react-icons/lu";
import { listProgress } from "@/lib/firebase/db";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { BOOKS, bookName } from "@/lib/bible/books";
import { aggregate, type BookAgg, type ProgressRow } from "@/lib/progress";
import PageHeader from "@/components/PageHeader";
import VersionSelect from "@/components/VersionSelect";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function ReadGridPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();

  const [rows, setRows] = useState<ProgressRow[]>([]);

  // Progress is shared by every version and language.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    listProgress(user.id)
      .then((data) => {
        if (alive) setRows(data);
      })
      .catch((error) => console.error(error));
    return () => {
      alive = false;
    };
  }, [user]);

  const agg = useMemo(() => aggregate(rows), [rows]);
  const byBook = useMemo(() => {
    const m = new Map<number, BookAgg>();
    for (const b of agg.books) m.set(b.bookId, b);
    return m;
  }, [agg]);

  const ot = BOOKS.filter((b) => b.testament === "old");
  const nt = BOOKS.filter((b) => b.testament === "new");

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("read.title")}
        description={
          <>
            {agg.chaptersDone} / {agg.totalChapters} {t("read.chaptersDone")} · {agg.versesTyped}{" "}
            {t(agg.versesTyped === 1 ? "read.verseTyped" : "read.versesTyped")}
          </>
        }
        actions={<VersionSelect />}
      />

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm font-medium">{t("read.overall")}</span>
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{agg.percent}%</span>
          </div>
          <Progress value={agg.percent} aria-label={t("read.overall")} />
        </CardContent>
      </Card>

      <Section title={t("read.ot")} books={ot} byBook={byBook} locale={locale} />
      <Section title={t("read.nt")} books={nt} byBook={byBook} locale={locale} />
    </div>
  );
}

function Section({
  title,
  books,
  byBook,
  locale,
}: {
  title: string;
  books: typeof BOOKS;
  byBook: Map<number, BookAgg>;
  locale: "en" | "ko";
}) {
  const { t } = useI18n();
  const booksDone = books.filter((b) => byBook.get(b.id)?.status === "done").length;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {booksDone} / {books.length}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {books.map((b) => {
          const a = byBook.get(b.id);
          const done = a?.chaptersDone ?? 0;
          const status = a?.status ?? "todo";
          return (
            <Link
              key={b.id}
              href={`/read/${b.id}`}
              className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card size="sm" className="h-full transition-colors group-hover:bg-muted/50">
                <CardHeader>
                  <CardTitle className="truncate">{bookName(b, locale)}</CardTitle>
                  <CardDescription className="text-xs tabular-nums">
                    {status === "done"
                      ? t("read.done")
                      : status === "partial"
                      ? `${done} / ${b.chapters} ${t("read.chapters")}`
                      : `${b.chapters} ${t("read.chapters")}`}
                  </CardDescription>
                  {status === "done" && (
                    <CardAction>
                      <LuCircleCheck className="size-4" aria-label={t("read.done")} />
                    </CardAction>
                  )}
                </CardHeader>
                <CardContent className="mt-auto">
                  <Progress value={(done / b.chapters) * 100} aria-label={bookName(b, locale)} />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
