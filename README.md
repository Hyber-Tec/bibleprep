# Typing Bible — Christian Community (성경타자통독)

A community web app for Christians whose core feature is **reading the whole Bible by typing it**,
with per-user progress tracking, an EN/KR language switch, minister-gated **bible studies (CRM)**,
a typing **leaderboard**, and a **community board**.

Built with **Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) + Supabase**
(Postgres, Auth, RLS).
Scales to many users; deploy on Vercel.

---

## Features

| Area | What it does |
|------|--------------|
| **Type Bible** (`/read`) | 66-book completion grid (구약/신약) echoing the reference UI, overall % bar, per-chapter typing with live character-accuracy highlighting, and resume at the first untyped verse. Typed verses are saved per user and shared by every version and language. |
| **EN / KR switch** | Whole UI and Bible text toggle English ↔ Korean instantly (top-right). Versions: **WEB, KJV, ASV, YLT, BBE** (English) and **개역한글** (Korean), all public domain; the chosen version is remembered per language. |
| **Bible Studies** (`/studies`) | CRM for groups: hosts create studies, members join, and the study page shows every member's reading progress. **Only verified ministers can host** (enforced in the database). |
| **Minister verification** (`/minister`) | Users apply with church/credentials; an admin approves; a DB trigger flips their status so they can host. |
| **Leaderboard** (`/leaderboard`) | Ranking by verses typed + chapters completed (통독순위). |
| **Community** (`/community`) | Notice / Q&A / Testimony / General board. Only ministers/admins may post Notices. |

---

## Setup

### 1. Install
```bash
npm install
```

### 2. Start the local Supabase stack
Needs Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
(`brew install supabase/tap/supabase`).
```bash
supabase start                      # Postgres, Auth, REST API, Studio
cp .env.local.example .env.local    # already points at the local stack
```
`supabase start` applies [`supabase/migrations/`](supabase/migrations): all tables, the leaderboard view,
triggers, Data API grants and the **Row Level Security** policies, including the rule that only
`is_minister = true` profiles can insert into `studies`.

Two accounts are seeded from [`supabase/seed.sql`](supabase/seed.sql), both with password `password123`:

| Email | Role |
|-------|------|
| `admin@example.com` | admin + verified minister (hosts studies, posts notices) |
| `member@example.com` | regular member |

Locally, email confirmation is off, so signups log in immediately. Studio (SQL editor, table browser)
is at <http://127.0.0.1:54323>, and any auth emails land in Mailpit at <http://127.0.0.1:54324>.
`supabase db reset` rebuilds the local database from the migrations and the seed.

### 3. Run
```bash
npm run dev      # http://localhost:3000 (Turbopack; pages compile on first visit)
```

### Using a hosted Supabase project instead
1. Create a project at <https://supabase.com> (free tier is fine).
2. Apply the schema: `supabase link --project-ref <project-ref>` then `supabase db push`
   (or paste the migration file into the dashboard's **SQL Editor** and run it).
3. In `.env.local`, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the
   **Project URL** and **anon public** key from **Project Settings → API**.
4. (Optional) In **Authentication → Providers → Email**, turn **"Confirm email"** off for quick testing
   so signups log in immediately.

Change the schema by adding a migration (`supabase migration new <name>`) rather than editing an
applied one.

---

## Bible text

The full text of every version (1189 chapters each) is already imported in `public/bible/` and
served as static assets, one file per chapter:
`public/bible/<version>/<bookId>/<chapter>.json` → `{ "verses": [{ "verse": 1, "text": "..." }, ...] }`.
Verse numbers are stored because versions omit or merge some verses (e.g. 개역한글 has no Mark 9:44).

The versions are listed in [`src/lib/bible/translations.json`](src/lib/bible/translations.json), which
both the app and the importer read; the first version of each language is its default. To re-download
text, or to add a version (add it to that file first):
```bash
npm run import:bible -- --all                 # every version, one request per book
npm run import:bible -- --trans kjv,asv --all  # specific versions
npm run import:bible -- --books 1,2,3         # specific book ids
```
Source: [getBible v2](https://getbible.net). Only use versions whose license allows it and that follow
the standard (KJV-style) chapter and verse numbering, since progress is matched by verse number;
Vulgate-numbered versions such as Douay-Rheims would mark the wrong verses as typed.

> 개역개정 (NKRV), 새번역, NIV, ESV and other modern versions are copyrighted and are **not** included.
> To use one, obtain a license and drop the text into the same JSON layout.

---

## Approving ministers

Hosting a study requires verified minister status. After a user applies at `/minister`:

1. **Make yourself an admin** (one time; locally, the seeded `admin@example.com` already is) - in the
   SQL Editor (locally: Studio at <http://127.0.0.1:54323>):
   ```sql
   update public.profiles set role = 'admin' where id = '<your-user-uuid>';
   ```
2. **Approve an application** — set its status to `approved`; a trigger flips the applicant's
   `is_minister` flag automatically:
   ```sql
   update public.minister_applications set status = 'approved' where id = '<application-id>';
   ```
   (Or build an admin UI later — the RLS policy already lets admins update applications.)

---

## UI

- **Components**: [shadcn/ui](https://ui.shadcn.com) (Base UI primitives, `base-nova` style) in
  `src/components/ui/`, themed with the **Neutral** palette from <https://ui.shadcn.com/colors>
  (tokens in `src/app/globals.css`). Shared page pieces: `PageHeader`, `AuthCard`, `Loading`.
- **Icons**: [react-icons](https://react-icons.github.io/react-icons/) only. Use the `lu` (Lucide)
  set for UI icons so they match the components.
- **Adding a component**: `npm run ui:add -- <name>` (e.g. `npm run ui:add -- dialog`). It runs
  `shadcn add`, then switches the generated `lucide-react` imports to `react-icons/lu`.
- **Menus**: the verse list has a right-click Context Menu (type or copy a verse); the account menu
  is a Dropdown Menu; both share the same shadcn styling.

## Architecture notes

- **Auth & data**: `@supabase/ssr` browser client + a session-refreshing `middleware.ts`.
  All data access is governed by **RLS**, so the public anon key is safe in the browser.
- **i18n**: `src/lib/i18n.tsx` — a client context with an EN/KR dictionary; preference persists in `localStorage`.
- **Bible model**: `src/lib/bible/books.ts` (66 books, KR/EN names, chapter counts) +
  `src/lib/bible/text.ts` (chapter loader + typing accuracy helpers).
- **Progress**: one `reading_progress` row per `(user, book, chapter)` holding the typed verse numbers,
  shared by every version and language. Verses are saved through the `record_typed_verses()` database
  function, which merges them atomically; `src/lib/progress.ts` aggregates the rows into the book grid
  and overall %.
- **Versions**: `src/lib/bible/version.tsx` remembers the chosen version per language (in `localStorage`).
- **Minister gating**: enforced in the database (`studies` INSERT policy checks `is_minister`), not just the UI.
- **Errors**: `src/lib/errors.ts` turns Supabase errors into user-facing text; requests that never reach the
  server get a translated message instead of the browser's raw "Failed to fetch".

## Project structure
```
src/
  app/            route pages (read grid, typing, studies, minister, leaderboard, community, auth)
  components/     Nav, LangSwitch, VersionSelect, TypingPane, PageHeader, AuthCard, Providers
    ui/           shadcn/ui components (npm run ui:add)
  lib/
    supabase/     browser + server clients
    bible/        book metadata, versions (translations.json + version.tsx), text loader
    i18n.tsx      EN/KR dictionary + context
    auth.tsx      auth/profile context
    progress.ts   progress aggregation
    errors.ts     Supabase error -> user-facing message
supabase/
  config.toml     local stack settings (supabase start)
  migrations/     schema: tables, grants, RLS, triggers, leaderboard view
scripts/import-bible.mjs   public-domain Bible importer
public/bible/   chapter text JSON, every version
```

## Deploy
Apply the migrations to your hosted project (`supabase db push`), then push to GitHub, import into **Vercel**,
add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel project settings, deploy.
Point Supabase **Auth → URL Configuration** at your Vercel domain.
