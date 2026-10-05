"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  LuArrowRight,
  LuBookOpen,
  LuCheck,
  LuCloud,
  LuCloudOff,
  LuCopy,
  LuKeyboard,
  LuPartyPopper,
} from "react-icons/lu";
import { getTypedVerses, recordTypedVerses } from "@/lib/firebase/db";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { getBook, bookName } from "@/lib/bible/books";
import {
  loadChapter,
  diffChars,
  accuracy,
  ACCURACY_THRESHOLD,
  type Verse,
} from "@/lib/bible/text";
import Loading from "./Loading";
import PageHeader, { BackLink } from "./PageHeader";
import VersionSelect from "./VersionSelect";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

/** Index of the first untyped verse after `from`, wrapping to the start; -1 when all are typed. */
function nextUntyped(verses: Verse[], typedVerses: Set<number>, from = -1) {
  const after = verses.findIndex((v, i) => i > from && !typedVerses.has(v.verse));
  return after !== -1 ? after : verses.findIndex((v) => !typedVerses.has(v.verse));
}

export default function TypingPane({
  bookId,
  chapter,
  translation,
}: {
  bookId: number;
  chapter: number;
  translation: string;
}) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const userId = user?.id;
  const book = getBook(bookId);

  const [verses, setVerses] = useState<Verse[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0); // current verse (0-based)
  // Verse numbers typed in this chapter, in any translation.
  const [typedVerses, setTypedVerses] = useState<Set<number>>(new Set());
  const [typed, setTyped] = useState("");
  const [saveStatus, setSaveStatus] = useState<{ saved: boolean; error: string | null }>({
    saved: false,
    error: null,
  });
  // Typed verses the server has not confirmed yet. Every save resends them, so a
  // failed save is repaired by the next one. Kept per chapter, across translations.
  const pending = useRef(new Set<number>());
  const pendingChapter = useRef("");
  // Saves run one at a time. Each is a transaction on the chapter's document, so two in
  // flight at once would only make each other retry.
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [menuIndex, setMenuIndex] = useState(0); // verse right-clicked in the list
  const [copied, setCopied] = useState(false);

  // Load chapter text + typed verses, and start at the first untyped verse. Keyed on the
  // user id, not the user object, which changes on every token refresh and would wipe
  // the verse being typed.
  useEffect(() => {
    const chapterKey = `${bookId}:${chapter}`;
    if (pendingChapter.current !== chapterKey) {
      pendingChapter.current = chapterKey;
      pending.current = new Set();
    }
    let alive = true;
    setLoading(true);
    setTyped("");
    setSaveStatus({ saved: false, error: null });
    (async () => {
      // Text and progress load in parallel.
      const [ch, saved] = await Promise.all([
        loadChapter(translation, bookId, chapter),
        userId
          ? getTypedVerses(userId, bookId, chapter).catch((e): number[] => {
              console.error(e);
              return [];
            })
          : [],
      ]);
      const done = new Set([...saved, ...pending.current]);
      if (!alive) return;
      setVerses(ch?.verses ?? null);
      setTypedVerses(done);
      setIndex(Math.max(0, nextUntyped(ch?.verses ?? [], done)));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [translation, bookId, chapter, userId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [index, loading]);

  // Keep the current verse centred in the verse list (scrolling the list, not the page).
  useEffect(() => {
    const list = listRef.current;
    const row = list?.children[index] as HTMLElement | undefined;
    if (list && row) {
      list.scrollTo({ top: row.offsetTop - (list.clientHeight - row.clientHeight) / 2, behavior: "smooth" });
    }
  }, [index, loading, verses]);

  const record = useCallback(
    (verse: number) => {
      if (!userId || !verses) return;
      const chapterKey = pendingChapter.current;
      pending.current.add(verse);
      const save = async () => {
        if (pendingChapter.current !== chapterKey) return; // moved on to another chapter
        let saved: number[];
        try {
          saved = await recordTypedVerses(
            userId,
            bookId,
            chapter,
            [...pending.current],
            verses.map((v) => v.verse)
          );
        } catch (error) {
          if (pendingChapter.current === chapterKey) {
            setSaveStatus({ saved: false, error: errorMessage(error, t) });
          }
          return;
        }
        if (pendingChapter.current !== chapterKey) return; // moved on to another chapter
        for (const v of saved) pending.current.delete(v);
        setTypedVerses((prev) => new Set([...prev, ...saved]));
        setSaveStatus({ saved: true, error: null });
      };
      saveQueue.current = saveQueue.current.then(save, save);
    },
    [userId, verses, bookId, chapter, t]
  );

  const target = verses?.[index]?.text ?? "";
  const verseNumber = verses?.[index]?.verse ?? index + 1;
  const acc = accuracy(target, typed);
  const canAdvance = target.length > 0 && acc >= ACCURACY_THRESHOLD;

  const advance = useCallback(() => {
    if (!verses || !canAdvance) return;
    const verse = verses[index].verse;
    const nextTyped = new Set(typedVerses).add(verse);
    setTypedVerses(nextTyped);
    setTyped("");
    const upcoming = nextUntyped(verses, nextTyped, index);
    if (upcoming !== -1) setIndex(upcoming);
    record(verse);
  }, [verses, canAdvance, index, typedVerses, record]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // A Korean IME sends the Enter that commits the last syllable while still composing.
    // Advancing on it clears the box, and the IME then drops that syllable into the next verse.
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      advance();
    }
  };

  // Context-menu actions on a verse in the list.
  const typeVerse = (i: number) => {
    setIndex(i);
    setTyped("");
    // After the menu closes and hands focus back, move it to the input.
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  const copyVerse = async (i: number) => {
    const verse = verses?.[i];
    if (!verse) return;
    await navigator.clipboard.writeText(verse.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!book) return <p className="text-muted-foreground">Unknown book.</p>;

  const total = verses?.length ?? 0;
  const completedCount = verses?.filter((v) => typedVerses.has(v.verse)).length ?? 0;
  const pct = total ? Math.round((completedCount / total) * 100) : 0;
  const isChapterDone = total > 0 && completedCount === total;
  const verseLabel = (n: number) => (locale === "ko" ? `${n}${t("read.verse")}` : `${t("read.verse")} ${n}`);

  return (
    <div className="space-y-6">
      <PageHeader
        back={<BackLink href={`/read/${bookId}`}>{bookName(book, locale)}</BackLink>}
        title={
          <>
            {bookName(book, locale)} {chapter}
            {locale === "ko" ? "장" : ""}
          </>
        }
        description={total > 0 ? `${completedCount} / ${total} ${t("read.versesTyped")}` : undefined}
        actions={<VersionSelect />}
      />
      <Progress value={pct} aria-label={t("read.versesTyped")} />

      {loading ? (
        <Loading />
      ) : !verses || verses.length === 0 ? (
        <Alert>
          <LuBookOpen />
          <AlertDescription>{t("read.noText")}</AlertDescription>
        </Alert>
      ) : (
        <Card>
          {isChapterDone ? (
            <ChapterDone bookId={bookId} chapter={chapter} />
          ) : (
            <>
              <CardContent>
                {/* Verse list; right-click a verse to type it or copy it */}
                <ContextMenu>
                  <ContextMenuTrigger
                    render={
                      <div
                        ref={listRef}
                        data-testid="verse-list"
                        className="relative max-h-44 space-y-0.5 overflow-y-auto text-sm"
                      />
                    }
                  >
                    {verses.map((v, i) => (
                      <div
                        key={v.verse}
                        onContextMenu={() => setMenuIndex(i)}
                        aria-current={i === index ? "step" : undefined}
                        className={cn(
                          "flex gap-3 rounded-md px-2.5 py-1.5 leading-5",
                          i === index ? "bg-muted text-foreground" : "text-muted-foreground"
                        )}
                      >
                        <span className="w-6 shrink-0 text-right text-xs font-medium leading-5 tabular-nums">
                          {v.verse}
                        </span>
                        <span className="flex-1">{v.text}</span>
                        {typedVerses.has(v.verse) && (
                          <LuCheck className="mt-0.5 size-4 shrink-0 text-foreground" aria-label={t("read.done")} />
                        )}
                      </div>
                    ))}
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => typeVerse(menuIndex)}>
                      <LuKeyboard />
                      {t("read.typeThisVerse")}
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => void copyVerse(menuIndex)}>
                      <LuCopy />
                      {t("read.copyVerse")}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </CardContent>

              <Separator />

              {/* Current verse: typed characters turn dark, mistakes red */}
              <CardContent className="space-y-4">
                <Badge variant="secondary">{verseLabel(verseNumber)}</Badge>
                <p data-testid="verse-target" className="font-serif text-xl leading-relaxed">
                  {diffChars(target, typed).map((c, i) => (
                    <span
                      key={i}
                      className={
                        c.state === "correct"
                          ? "text-foreground"
                          : c.state === "wrong"
                          ? "text-destructive underline decoration-destructive/50"
                          : "text-muted-foreground/70"
                      }
                    >
                      {c.ch}
                    </span>
                  ))}
                </p>
                <Input
                  ref={inputRef}
                  data-testid="verse-input"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={t("read.typeHere")}
                  aria-label={verseLabel(verseNumber)}
                  className="h-12 font-serif text-lg md:text-lg"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {t("read.accuracy")} {Math.round(acc * 100)}%
                  </span>
                  <Button onClick={advance} disabled={!canAdvance}>
                    {t("read.nextVerse")}
                    <Kbd className="bg-primary-foreground/15 text-primary-foreground">↵</Kbd>
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Save status: every typed verse is saved as soon as it is entered */}
          <CardFooter
            role="status"
            className={cn("min-h-11 gap-2 text-xs", saveStatus.error ? "text-destructive" : "text-muted-foreground")}
          >
            {saveStatus.error ? (
              <>
                <LuCloudOff className="size-3.5 shrink-0" />
                {saveStatus.error}
              </>
            ) : copied ? (
              <>
                <LuCopy className="size-3.5" />
                {t("read.copied")}
              </>
            ) : saveStatus.saved ? (
              <>
                <LuCheck className="size-3.5" />
                {t("read.saved")}
              </>
            ) : (
              <>
                <LuCloud className="size-3.5" />
                {t("read.autoSave")}
              </>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

function ChapterDone({ bookId, chapter }: { bookId: number; chapter: number }) {
  const { t } = useI18n();
  const book = getBook(bookId);
  const hasNext = book && chapter < book.chapters;
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuPartyPopper />
        </EmptyMedia>
        <EmptyTitle>{t("read.chapterComplete")}</EmptyTitle>
        <EmptyDescription>{t("read.chapterCompleteHint")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Link href={`/read/${bookId}`} className={cn(buttonVariants({ variant: "outline" }))}>
          {t("common.back")}
        </Link>
        {hasNext && (
          <Link href={`/read/${bookId}/${chapter + 1}`} className={cn(buttonVariants())}>
            {t("read.next")}
            <LuArrowRight data-icon="inline-end" />
          </Link>
        )}
      </EmptyContent>
    </Empty>
  );
}
