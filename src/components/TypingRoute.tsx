"use client";

import TypingPane from "@/components/TypingPane";
import { useBibleVersion } from "@/lib/bible/version";

/** The typing page for one chapter, in the Bible version the reader has chosen. */
export default function TypingRoute({ bookId, chapter }: { bookId: number; chapter: number }) {
  const { translation } = useBibleVersion();

  return <TypingPane bookId={bookId} chapter={chapter} translation={translation.id} />;
}
