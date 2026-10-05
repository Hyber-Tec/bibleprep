#!/usr/bin/env node
/**
 * Import public-domain Bible text into public/bible/<translation>/<bookId>/<chapter>.json
 * as { "verses": [{ "verse": 1, "text": "..." }, ...] }.
 *
 * Source: getBible v2 (https://getbible.net). The versions imported are listed in
 * src/lib/bible/translations.json (all public domain, or GPL for the KJV text).
 *
 * Usage:
 *   node scripts/import-bible.mjs            # seed a few sample chapters (fast)
 *   node scripts/import-bible.mjs --all      # full Bible, every version (one request per book)
 *   node scripts/import-bible.mjs --trans kjv,asv --all
 *   node scripts/import-bible.mjs --books 1,3,43       # specific book ids
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "public", "bible");

// Minimal chapter-count table (book id -> chapters). Mirrors src/lib/bible/books.ts.
const CHAPTERS = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31,
  12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4, 28, 16, 24, 21,
  28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22,
];

// translation id used by the app -> getBible v2 abbreviation
const TRANSLATIONS = Object.fromEntries(
  JSON.parse(await readFile(resolve(__dirname, "..", "src", "lib", "bible", "translations.json"), "utf8")).map(
    (t) => [t.id, t.source]
  )
);

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const ALL = has("--all");
const transFilter = val("--trans")?.split(",");
const booksArg = val("--books");
const SAMPLE = [
  [1, 1], // Genesis 1
  [3, 1], // Leviticus 1 (matches the reference screenshot)
  [19, 23], // Psalm 23
  [43, 1], // John 1
  [43, 3], // John 3
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch a whole book in one request: chapter number -> verses. Verse numbers are kept
 * because translations omit or merge some verses (e.g. 개역한글 has no Mark 9:44).
 */
async function fetchBook(gbAbbr, bookId, attempt = 1) {
  const url = `https://api.getbible.net/v2/${gbAbbr}/${bookId}.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return new Map(
      (data.chapters ?? []).map((c) => [
        c.chapter,
        (c.verses ?? []).map((v) => ({ verse: v.verse, text: String(v.text).trim() })),
      ])
    );
  } catch (err) {
    if (attempt < 4) {
      await sleep(500 * attempt);
      return fetchBook(gbAbbr, bookId, attempt + 1);
    }
    throw err;
  }
}

async function run() {
  const transIds = Object.keys(TRANSLATIONS).filter(
    (t) => !transFilter || transFilter.includes(t)
  );

  let bookIds;
  if (booksArg) bookIds = booksArg.split(",").map((n) => parseInt(n, 10));
  else if (ALL) bookIds = CHAPTERS.map((_, i) => i + 1);
  else bookIds = null; // sample mode

  let written = 0;
  let failed = 0;
  for (const transId of transIds) {
    const gb = TRANSLATIONS[transId];
    // book id -> chapters to write
    const jobs = new Map();

    if (bookIds) {
      for (const bookId of bookIds) {
        jobs.set(bookId, Array.from({ length: CHAPTERS[bookId - 1] }, (_, i) => i + 1));
      }
    } else {
      for (const [bookId, ch] of SAMPLE) jobs.set(bookId, [...(jobs.get(bookId) ?? []), ch]);
    }

    const total = [...jobs.values()].reduce((n, chs) => n + chs.length, 0);
    console.log(`\n[${transId}] importing ${total} chapters from ${jobs.size} books via getBible (${gb})…`);
    for (const [bookId, chapters] of jobs) {
      try {
        const book = await fetchBook(gb, bookId);
        const dir = resolve(OUT, transId, String(bookId));
        await mkdir(dir, { recursive: true });
        for (const ch of chapters) {
          const verses = book.get(ch);
          if (!verses?.length) throw new Error(`chapter ${ch} missing from response`);
          await writeFile(resolve(dir, `${ch}.json`), JSON.stringify({ verses }, null, 0));
          written++;
        }
        process.stdout.write(`  ${transId} book ${bookId} (${chapters.length} ch)\r`);
        await sleep(120); // be polite to the API
      } catch (err) {
        failed++;
        console.error(`\n  ! failed ${transId} book ${bookId}: ${err.message}`);
      }
    }
  }
  console.log(`\n\nDone. Wrote ${written} chapter files to ${OUT}`);
  if (failed) {
    console.error(`${failed} book(s) failed. Re-run those with --books <ids>.`);
    process.exitCode = 1;
  }
}

run();
