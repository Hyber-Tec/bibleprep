"use client";

import { useParams } from "next/navigation";
import TypingPane from "@/components/TypingPane";
import { useBibleVersion } from "@/lib/bible/version";

export default function TypingPage() {
  const params = useParams();
  const { translation } = useBibleVersion();

  return (
    <TypingPane
      bookId={Number(params.bookId)}
      chapter={Number(params.chapter)}
      translation={translation.id}
    />
  );
}
