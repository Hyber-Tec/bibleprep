import ChapterPicker from "@/components/ChapterPicker";
import { BOOKS } from "@/lib/bible/books";

// The published site is static files, so every book's page is built ahead of time.
export function generateStaticParams() {
  return BOOKS.map((book) => ({ bookId: String(book.id) }));
}

export default async function ChapterPickerPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  return <ChapterPicker bookId={Number(bookId)} />;
}
