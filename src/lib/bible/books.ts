// 66-book Protestant canon with Korean + English names, chapter counts, and a
// stable slug used by the WEB import (bible-api.com book names).
// book id is 1..66 and is what the DB / routes use.

import translations from "./translations.json";

export type Testament = "old" | "new";

export interface BookMeta {
  id: number;
  /** English name */
  en: string;
  /** Korean name (개역한글 식 이름) */
  ko: string;
  /** number of chapters */
  chapters: number;
  testament: Testament;
  /** name used by bible-api.com (WEB) for importing English text */
  apiName: string;
}

export const BOOKS: BookMeta[] = [
  { id: 1, en: "Genesis", ko: "창세기", chapters: 50, testament: "old", apiName: "Genesis" },
  { id: 2, en: "Exodus", ko: "출애굽기", chapters: 40, testament: "old", apiName: "Exodus" },
  { id: 3, en: "Leviticus", ko: "레위기", chapters: 27, testament: "old", apiName: "Leviticus" },
  { id: 4, en: "Numbers", ko: "민수기", chapters: 36, testament: "old", apiName: "Numbers" },
  { id: 5, en: "Deuteronomy", ko: "신명기", chapters: 34, testament: "old", apiName: "Deuteronomy" },
  { id: 6, en: "Joshua", ko: "여호수아", chapters: 24, testament: "old", apiName: "Joshua" },
  { id: 7, en: "Judges", ko: "사사기", chapters: 21, testament: "old", apiName: "Judges" },
  { id: 8, en: "Ruth", ko: "룻기", chapters: 4, testament: "old", apiName: "Ruth" },
  { id: 9, en: "1 Samuel", ko: "사무엘상", chapters: 31, testament: "old", apiName: "1 Samuel" },
  { id: 10, en: "2 Samuel", ko: "사무엘하", chapters: 24, testament: "old", apiName: "2 Samuel" },
  { id: 11, en: "1 Kings", ko: "열왕기상", chapters: 22, testament: "old", apiName: "1 Kings" },
  { id: 12, en: "2 Kings", ko: "열왕기하", chapters: 25, testament: "old", apiName: "2 Kings" },
  { id: 13, en: "1 Chronicles", ko: "역대상", chapters: 29, testament: "old", apiName: "1 Chronicles" },
  { id: 14, en: "2 Chronicles", ko: "역대하", chapters: 36, testament: "old", apiName: "2 Chronicles" },
  { id: 15, en: "Ezra", ko: "에스라", chapters: 10, testament: "old", apiName: "Ezra" },
  { id: 16, en: "Nehemiah", ko: "느헤미야", chapters: 13, testament: "old", apiName: "Nehemiah" },
  { id: 17, en: "Esther", ko: "에스더", chapters: 10, testament: "old", apiName: "Esther" },
  { id: 18, en: "Job", ko: "욥기", chapters: 42, testament: "old", apiName: "Job" },
  { id: 19, en: "Psalms", ko: "시편", chapters: 150, testament: "old", apiName: "Psalms" },
  { id: 20, en: "Proverbs", ko: "잠언", chapters: 31, testament: "old", apiName: "Proverbs" },
  { id: 21, en: "Ecclesiastes", ko: "전도서", chapters: 12, testament: "old", apiName: "Ecclesiastes" },
  { id: 22, en: "Song of Solomon", ko: "아가", chapters: 8, testament: "old", apiName: "Song of Solomon" },
  { id: 23, en: "Isaiah", ko: "이사야", chapters: 66, testament: "old", apiName: "Isaiah" },
  { id: 24, en: "Jeremiah", ko: "예레미야", chapters: 52, testament: "old", apiName: "Jeremiah" },
  { id: 25, en: "Lamentations", ko: "예레미야애가", chapters: 5, testament: "old", apiName: "Lamentations" },
  { id: 26, en: "Ezekiel", ko: "에스겔", chapters: 48, testament: "old", apiName: "Ezekiel" },
  { id: 27, en: "Daniel", ko: "다니엘", chapters: 12, testament: "old", apiName: "Daniel" },
  { id: 28, en: "Hosea", ko: "호세아", chapters: 14, testament: "old", apiName: "Hosea" },
  { id: 29, en: "Joel", ko: "요엘", chapters: 3, testament: "old", apiName: "Joel" },
  { id: 30, en: "Amos", ko: "아모스", chapters: 9, testament: "old", apiName: "Amos" },
  { id: 31, en: "Obadiah", ko: "오바댜", chapters: 1, testament: "old", apiName: "Obadiah" },
  { id: 32, en: "Jonah", ko: "요나", chapters: 4, testament: "old", apiName: "Jonah" },
  { id: 33, en: "Micah", ko: "미가", chapters: 7, testament: "old", apiName: "Micah" },
  { id: 34, en: "Nahum", ko: "나훔", chapters: 3, testament: "old", apiName: "Nahum" },
  { id: 35, en: "Habakkuk", ko: "하박국", chapters: 3, testament: "old", apiName: "Habakkuk" },
  { id: 36, en: "Zephaniah", ko: "스바냐", chapters: 3, testament: "old", apiName: "Zephaniah" },
  { id: 37, en: "Haggai", ko: "학개", chapters: 2, testament: "old", apiName: "Haggai" },
  { id: 38, en: "Zechariah", ko: "스가랴", chapters: 14, testament: "old", apiName: "Zechariah" },
  { id: 39, en: "Malachi", ko: "말라기", chapters: 4, testament: "old", apiName: "Malachi" },
  { id: 40, en: "Matthew", ko: "마태복음", chapters: 28, testament: "new", apiName: "Matthew" },
  { id: 41, en: "Mark", ko: "마가복음", chapters: 16, testament: "new", apiName: "Mark" },
  { id: 42, en: "Luke", ko: "누가복음", chapters: 24, testament: "new", apiName: "Luke" },
  { id: 43, en: "John", ko: "요한복음", chapters: 21, testament: "new", apiName: "John" },
  { id: 44, en: "Acts", ko: "사도행전", chapters: 28, testament: "new", apiName: "Acts" },
  { id: 45, en: "Romans", ko: "로마서", chapters: 16, testament: "new", apiName: "Romans" },
  { id: 46, en: "1 Corinthians", ko: "고린도전서", chapters: 16, testament: "new", apiName: "1 Corinthians" },
  { id: 47, en: "2 Corinthians", ko: "고린도후서", chapters: 13, testament: "new", apiName: "2 Corinthians" },
  { id: 48, en: "Galatians", ko: "갈라디아서", chapters: 6, testament: "new", apiName: "Galatians" },
  { id: 49, en: "Ephesians", ko: "에베소서", chapters: 6, testament: "new", apiName: "Ephesians" },
  { id: 50, en: "Philippians", ko: "빌립보서", chapters: 4, testament: "new", apiName: "Philippians" },
  { id: 51, en: "Colossians", ko: "골로새서", chapters: 4, testament: "new", apiName: "Colossians" },
  { id: 52, en: "1 Thessalonians", ko: "데살로니가전서", chapters: 5, testament: "new", apiName: "1 Thessalonians" },
  { id: 53, en: "2 Thessalonians", ko: "데살로니가후서", chapters: 3, testament: "new", apiName: "2 Thessalonians" },
  { id: 54, en: "1 Timothy", ko: "디모데전서", chapters: 6, testament: "new", apiName: "1 Timothy" },
  { id: 55, en: "2 Timothy", ko: "디모데후서", chapters: 4, testament: "new", apiName: "2 Timothy" },
  { id: 56, en: "Titus", ko: "디도서", chapters: 3, testament: "new", apiName: "Titus" },
  { id: 57, en: "Philemon", ko: "빌레몬서", chapters: 1, testament: "new", apiName: "Philemon" },
  { id: 58, en: "Hebrews", ko: "히브리서", chapters: 13, testament: "new", apiName: "Hebrews" },
  { id: 59, en: "James", ko: "야고보서", chapters: 5, testament: "new", apiName: "James" },
  { id: 60, en: "1 Peter", ko: "베드로전서", chapters: 5, testament: "new", apiName: "1 Peter" },
  { id: 61, en: "2 Peter", ko: "베드로후서", chapters: 3, testament: "new", apiName: "2 Peter" },
  { id: 62, en: "1 John", ko: "요한일서", chapters: 5, testament: "new", apiName: "1 John" },
  { id: 63, en: "2 John", ko: "요한이서", chapters: 1, testament: "new", apiName: "2 John" },
  { id: 64, en: "3 John", ko: "요한삼서", chapters: 1, testament: "new", apiName: "3 John" },
  { id: 65, en: "Jude", ko: "유다서", chapters: 1, testament: "new", apiName: "Jude" },
  { id: 66, en: "Revelation", ko: "요한계시록", chapters: 22, testament: "new", apiName: "Revelation" },
];

export const TOTAL_CHAPTERS = BOOKS.reduce((n, b) => n + b.chapters, 0); // 1189

export function getBook(id: number): BookMeta | undefined {
  return BOOKS.find((b) => b.id === id);
}

export function bookName(book: BookMeta, locale: "en" | "ko"): string {
  return locale === "ko" ? book.ko : book.en;
}

export interface Translation {
  id: string;
  label: string;
  locale: "en" | "ko";
  source: string; // getBible v2 abbreviation, used by scripts/import-bible.mjs
}

/** Bible versions (shared with the import script); the first of each language is its default. */
export const TRANSLATIONS = translations as Translation[];
