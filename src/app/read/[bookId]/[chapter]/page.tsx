import TypingRoute from "@/components/TypingRoute";
import { BOOKS } from "@/lib/bible/books";

// The published site is static files, so every chapter of every book is built ahead of time.
export function generateStaticParams() {
  return BOOKS.flatMap((book) =>
    Array.from({ length: book.chapters }, (_, i) => ({ bookId: String(book.id), chapter: String(i + 1) }))
  );
}

export default async function TypingPage({ params }: { params: Promise<{ bookId: string; chapter: string }> }) {
  const { bookId, chapter } = await params;
  return <TypingRoute bookId={Number(bookId)} chapter={Number(chapter)} />;
}
