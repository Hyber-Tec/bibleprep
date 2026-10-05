# Typing Bible — Christian Community (성경타자통독)

A community web app for Christians whose core feature is **reading the whole Bible by typing it**,
with per-user progress tracking, an EN/KR language switch, minister-gated **bible studies (CRM)**,
a typing **leaderboard**, and a **community board**.

Built with **Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) + Firebase**
(Authentication with email/password and Google, Firestore, Analytics) in the `bibleprep-hyber` project.
Firebase is the only backend. Rules for contributors are in [CLAUDE.md](CLAUDE.md).

---

## Features

| Area | What it does |
|------|--------------|
| **Sign up / log in** | Email + password, or one click with a Google account. |
| **Type Bible** (`/read`) | 66-book completion grid (구약/신약) echoing the reference UI, overall % bar, per-chapter typing with live character-accuracy highlighting, and resume at the first untyped verse. Typed verses are saved per user and shared by every version and language. |
| **EN / KR switch** | Whole UI and Bible text toggle English ↔ Korean instantly (top-right). Versions: **WEB, KJV, ASV, YLT, BBE** (English) and **개역한글** (Korean), all public domain; the chosen version is remembered per language. |
| **Bible Studies** (`/studies`) | CRM for groups: hosts create studies, members join, and the study page shows every member's reading progress. **Only verified ministers can host** (enforced by the Firestore rules). |
| **Minister verification** (`/minister`) | Users apply with church/credentials; an admin approves it in the Firebase console so they can host. |
| **Leaderboard** (`/leaderboard`) | Ranking by verses typed + chapters completed (통독순위). Public: works signed out. |
| **Community** (`/community`) | Notice / Q&A / Testimony / General board. Only ministers/admins may post Notices. |

---

## Setup

### 1. Install
```bash
npm install
npm install -g firebase-tools   # the Firebase CLI, once per machine
```

### 2. Configure the Firebase web app
```bash
cp .env.local.example .env.local
```
Fill in `.env.local` with the web app config from the Firebase console (**Project settings → General →
Your apps → BiblePrep → SDK setup and configuration**). `.env.local` is git-ignored; never commit it.

### 3. Prepare the Firebase project (once)
Authentication providers (**Email/Password** and **Google**) are already enabled. Still to do, in the
[Firebase console](https://console.firebase.google.com/project/bibleprep-hyber/overview):

1. **Create the Firestore database**: **Build → Firestore Database → Create database**. The location cannot
   be changed afterwards, so pick the one closest to your users. Choose production mode: the rules below
   do the real access control.
2. **Deploy the security rules and indexes** (they are what keeps users out of each other's data; without
   them every request is denied):
   ```bash
   firebase login
   firebase deploy --only firestore
   ```
3. **Authorize your domains for sign-in**: **Authentication → Settings → Authorized domains**. `localhost`
   and the project's `firebaseapp.com` / `web.app` domains are there already; add the production domain.

### 4. Run
```bash
npm run dev      # http://localhost:3000 (Turbopack; pages compile on first visit)
```
With the real config this talks to the live `bibleprep-hyber` project, so accounts and data you create
are real. To work against a throwaway local copy instead, use the emulators.

### Local emulators
Needs the Firebase CLI and a JDK 21 or newer (for the Firestore emulator).
```bash
npm run emulators                 # Auth :9099, Firestore :8080, Emulator UI http://127.0.0.1:4000
# in .env.local: NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true, then
npm run dev
```
Emulator data is wiped when the emulators stop. Sign up through the app; the Emulator UI shows the
accounts and documents, and is where you can edit a document to make yourself an admin (below).

### Tests
```bash
npm run test:rules                # runs tests/ against the Firestore emulator
```
The tests cover [`firestore.rules`](firestore.rules): ownership, the minister gate for studies and
notices, and the public leaderboard.

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

## Admin runbook

There is no admin UI yet; admins work in the Firestore console (**Build → Firestore Database → Data**,
or the Emulator UI locally). The Firestore rules stop everyone else from changing these fields.

**Make yourself an admin** (one time). Sign up in the app first, then open `profiles/<your-uid>` (your uid
is in **Authentication → Users**) and set:
- `role` = `admin`
- `is_minister` = `true` (so you can also host studies)

**Approve a minister application.** A user applies at `/minister`, which creates a
`minister_applications/<id>` document with `status: "pending"`. To approve it, edit two documents:
1. `minister_applications/<id>`: set `status` to `approved`.
2. `profiles/<applicant's user_id>`: set `is_minister` to `true` and `role` to `minister`.

To decline, set the application's `status` to `rejected`; the applicant can apply again.

> Approval used to be a database trigger. Doing it automatically (and keeping the leaderboard totals
> tamper-proof) needs Cloud Functions, which require the Blaze plan.

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

- **Auth**: Firebase Authentication, email/password and Google (popup). `src/lib/auth.tsx` holds the
  signed-in user and profile; a user's profile document is created when the account is. There is no
  server session: `AuthGate` redirects signed-out visitors away from the account pages, and the
  Firestore rules are what actually protect the data, so the public web config is safe in the browser.
- **Data**: every Firestore read and write is in `src/lib/firebase/db.ts`. The Firebase SDK starts on first
  use (`src/lib/firebase/client.ts`), so `next build` needs no Firebase config.
- **i18n**: `src/lib/i18n.tsx` — a client context with an EN/KR dictionary; preference persists in `localStorage`.
- **Bible model**: `src/lib/bible/books.ts` (66 books, KR/EN names, chapter counts) +
  `src/lib/bible/text.ts` (chapter loader + typing accuracy helpers).
- **Progress**: one `reading_progress` document per `(user, book, chapter)` holding the typed verse numbers,
  shared by every version and language. A save is a Firestore transaction that merges the verses into the
  document and moves the user's leaderboard totals in step, so saves from several tabs or devices never
  overwrite each other. `src/lib/progress.ts` aggregates the documents into the book grid and overall %.
- **Versions**: `src/lib/bible/version.tsx` remembers the chosen version per language (in `localStorage`).
- **Minister gating**: enforced by the Firestore rules (creating a study requires `is_minister`), not just the UI.
- **Errors**: `src/lib/errors.ts` turns Firebase error codes into translated, user-facing text.

### Firestore data model

| Collection | Fields | Read | Write |
|------------|--------|------|-------|
| `profiles/{uid}` | `display_name`, `locale`, `role`, `is_minister`, `verses_typed`, `chapters_completed`, `created_at` | everyone (the leaderboard is public) | the owner: name and totals; admins: `role`, `is_minister` |
| `profiles/{uid}/reading_progress/{bookId}_{chapter}` | `book_id`, `chapter`, `typed_verses[]`, `verses_typed`, `completed`, `updated_at` | the owner | the owner |
| `studies/{id}` | `host_id`, `title`, `description`, `translation`, `schedule`, `is_public`, `join_code`, `member_ids[]`, `created_at` | signed in: public studies, and those you host or joined | verified ministers create; anyone joins a public study or leaves; the host edits and deletes |
| `minister_applications/{id}` | `user_id`, `church_name`, `denomination`, `role_title`, `credential_url`, `note`, `status`, `reviewed_by`, `reviewed_at`, `created_at` | the applicant, admins | the applicant creates (always `pending`); admins review |
| `community_posts/{id}` | `author_id`, `category`, `title`, `body`, `created_at` | signed in | the author; only ministers/admins may use the `notice` category |

The leaderboard is a query on `profiles` ordered by `verses_typed`. Those totals are kept by the client, so
a determined user could inflate their own, as they could always have faked their progress rows; the rules cap
them at what the Bible contains.

## Project structure
```
src/
  app/            route pages (read grid, typing, studies, minister, leaderboard, community, auth)
  components/     Nav, AuthGate, GoogleButton, LangSwitch, VersionSelect, TypingPane, PageHeader, AuthCard, Providers
    ui/           shadcn/ui components (npm run ui:add)
  lib/
    firebase/     client (SDK setup), auth (sign up / in / Google), db (all Firestore access)
    bible/        book metadata, versions (translations.json + version.tsx), text loader
    i18n.tsx      EN/KR dictionary + context
    auth.tsx      auth/profile context
    progress.ts   progress aggregation
    errors.ts     Firebase error -> user-facing message
firestore.rules         security rules (the access control)
firestore.indexes.json  Firestore indexes
firebase.json           deploy + emulator config; .firebaserc selects the project
tests/                  Firestore rules tests (npm run test:rules)
scripts/import-bible.mjs   public-domain Bible importer
public/bible/   chapter text JSON, every version
```

## Deploy
1. Deploy the rules and indexes: `firebase deploy --only firestore`.
2. Host the Next.js app wherever you like (e.g. Vercel: import the GitHub repo and add the
   `NEXT_PUBLIC_FIREBASE_*` variables from `.env.local.example` in the project settings).
3. Add the production domain under **Authentication → Settings → Authorized domains**, or Google sign-in
   will be refused there.
