# CLAUDE.md

Rules for everyone who works in this repository, people and AI sessions alike. They are strict.

## Git workflow

- `main` is reached through a pull request: CI green, and the code owner's approval where a shared file changed.
- A session works on a branch, opens the pull request, and says so. It never pushes to `main` and never merges unless the owner asked for exactly that.

## Commits

- **No attribution trailers.** No `Co-Authored-By:` line, no session line, no "generated with" footer, in commit messages or in pull request bodies. Every commit is authored solely as the git user configured (for the owner: `goochoi913 <goochoi913@gmail.com>`).
- **[Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):** `<type>[(scope)][!]: <imperative description>`, blank line, body, blank line, footers. Types: `feat` `fix` `docs` `refactor` `test` `chore` `perf` `build` `ci` `style`.
- **Commit far less often.** One commit per meaningful, self-contained piece of work: a feature, a fix, a refactor, a runbook. Small things join the commit they belong to. Never one commit per file, per review round or per step of a session. A day's work is a handful of commits split by type and scope, not by when the edits were made.

## AI naming (permanent rule)

The app never names the AI model or provider in labels, settings, messages or errors. It is always "AI".

## UI

- shadcn/ui components in `src/components/ui`, icons from `react-icons`.
- Schedule (applies to any Schedule view in the app): it keeps its structure (tutors as rows, time across, Day / Week / Month) in the side-rail design the owner picked in round 3; everything may improve on TE.

## Secrets

Never commit API keys, service-account files, tokens, passwords or PINs. The Firebase web config lives in `.env.local` (git-ignored). `.env.local.example` is the committed template and holds placeholders only.

## Stack

Firebase is the only backend and the host: Authentication (email/password and Google), Firestore, Analytics and Hosting, in the `bibleprep-hyber` project. The site is a static export published with `npm run deploy` at bibleprep.com. Setup, emulators, security rules, deploying and the admin runbook are in [README.md](README.md).
