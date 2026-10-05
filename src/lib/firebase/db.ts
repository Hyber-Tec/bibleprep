import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import type { ProgressRow } from "@/lib/progress";
import type { CommunityPost, MinisterApplication, Profile, Study } from "@/lib/types";

// Every Firestore read and write the app makes lives here. The collections, their fields and
// who may touch them are defined in firestore.rules and described in README.md.

// ---------------------------------------------------------------------------
// Conversions
// ---------------------------------------------------------------------------

/** Firestore timestamps as ISO strings, the shape the pages use. */
function iso(value: unknown): string {
  return value instanceof Timestamp ? value.toDate().toISOString() : "";
}

const clean = (value: string) => value.trim();

function toProfile(id: string, d: DocumentData): Profile {
  return {
    id,
    display_name: d.display_name ?? "",
    locale: d.locale === "ko" ? "ko" : "en",
    role: d.role ?? "member",
    is_minister: d.is_minister === true,
    verses_typed: d.verses_typed ?? 0,
    chapters_completed: d.chapters_completed ?? 0,
    created_at: iso(d.created_at),
  };
}

function toStudy(id: string, d: DocumentData): Study {
  return {
    id,
    host_id: d.host_id,
    title: d.title ?? "",
    description: d.description ?? "",
    translation: d.translation ?? "",
    schedule: d.schedule ?? "",
    is_public: d.is_public === true,
    join_code: d.join_code ?? "",
    member_ids: d.member_ids ?? [],
    created_at: iso(d.created_at),
  };
}

function toApplication(id: string, d: DocumentData): MinisterApplication {
  return {
    id,
    user_id: d.user_id,
    church_name: d.church_name ?? "",
    denomination: d.denomination ?? "",
    role_title: d.role_title ?? "",
    credential_url: d.credential_url ?? "",
    note: d.note ?? "",
    status: d.status ?? "pending",
    created_at: iso(d.created_at),
  };
}

function toPost(id: string, d: DocumentData): CommunityPost {
  return {
    id,
    author_id: d.author_id,
    category: d.category ?? "general",
    title: d.title ?? "",
    body: d.body ?? "",
    created_at: iso(d.created_at),
  };
}

const newestFirst = <T extends { created_at: string }>(a: T, b: T) => b.created_at.localeCompare(a.created_at);

// ---------------------------------------------------------------------------
// Profiles (also the public leaderboard)
// ---------------------------------------------------------------------------

export async function getProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(doc(getDb(), "profiles", uid));
  return snap.exists() ? toProfile(snap.id, snap.data()) : null;
}

// Firestore allows at most 30 values in one `in` filter.
const IN_LIMIT = 30;

/** Profiles by id, e.g. the authors of the posts on a page. Unknown ids are left out. */
export async function getProfiles(ids: string[]): Promise<Map<string, Profile>> {
  const unique = [...new Set(ids)];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += IN_LIMIT) chunks.push(unique.slice(i, i + IN_LIMIT));

  const snaps = await Promise.all(
    chunks.map((chunk) => getDocs(query(collection(getDb(), "profiles"), where(documentId(), "in", chunk))))
  );
  const profiles = new Map<string, Profile>();
  for (const snap of snaps) for (const d of snap.docs) profiles.set(d.id, toProfile(d.id, d.data()));
  return profiles;
}

/** Create the profile of a new account. Does nothing if it already exists. */
export async function ensureProfile(uid: string, displayName: string): Promise<void> {
  const db = getDb();
  const ref = doc(db, "profiles", uid);
  await runTransaction(db, async (tx) => {
    if ((await tx.get(ref)).exists()) return;
    tx.set(ref, {
      display_name: clean(displayName),
      locale: "en",
      role: "member",
      is_minister: false,
      verses_typed: 0,
      chapters_completed: 0,
      created_at: serverTimestamp(),
    });
  });
}

export async function setDisplayName(uid: string, displayName: string): Promise<void> {
  await updateDoc(doc(getDb(), "profiles", uid), { display_name: clean(displayName) });
}

/** Everyone ranked by verses typed. Public: the leaderboard works signed out. */
export async function listLeaderboard(max = 100): Promise<Profile[]> {
  const snap = await getDocs(
    query(collection(getDb(), "profiles"), orderBy("verses_typed", "desc"), limit(max))
  );
  return snap.docs.map((d) => toProfile(d.id, d.data()));
}

// ---------------------------------------------------------------------------
// Reading progress: profiles/{uid}/reading_progress/{bookId}_{chapter}
// Progress is shared by every translation: verses are matched by number.
// ---------------------------------------------------------------------------

const progressCollection = (uid: string) => collection(getDb(), "profiles", uid, "reading_progress");
const chapterDoc = (uid: string, bookId: number, chapter: number) =>
  doc(progressCollection(uid), `${bookId}_${chapter}`);

/** One row per chapter the user has started, optionally for a single book. */
export async function listProgress(uid: string, bookId?: number): Promise<ProgressRow[]> {
  const col = progressCollection(uid);
  const snap = await getDocs(bookId === undefined ? col : query(col, where("book_id", "==", bookId)));
  return snap.docs.map((d) => ({
    book_id: d.data().book_id,
    chapter: d.data().chapter,
    completed: d.data().completed === true,
    verses_typed: d.data().verses_typed ?? 0,
  }));
}

/** Verse numbers typed so far in a chapter. */
export async function getTypedVerses(uid: string, bookId: number, chapter: number): Promise<number[]> {
  const snap = await getDoc(chapterDoc(uid, bookId, chapter));
  return snap.exists() ? (snap.data().typed_verses ?? []) : [];
}

/**
 * Add typed verses to a chapter and return every verse now saved. The union happens inside
 * a transaction, so saves from several tabs or devices never overwrite each other.
 * `chapterVerses` lists the verse numbers of the translation being typed; the chapter is
 * complete once they are all typed, and stays complete. The leaderboard totals on the
 * profile move by the same amounts in the same transaction.
 */
export async function recordTypedVerses(
  uid: string,
  bookId: number,
  chapter: number,
  verses: number[],
  chapterVerses: number[]
): Promise<number[]> {
  const db = getDb();
  const progressRef = chapterDoc(uid, bookId, chapter);
  const profileRef = doc(db, "profiles", uid);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(progressRef);
    const before: number[] = snap.exists() ? (snap.data().typed_verses ?? []) : [];
    const wasCompleted = snap.exists() && snap.data().completed === true;

    const typed = [...new Set([...before, ...verses])].sort((a, b) => a - b);
    const typedSet = new Set(typed);
    const completed = wasCompleted || chapterVerses.every((v) => typedSet.has(v));
    if (typed.length === before.length && completed === wasCompleted) return typed; // nothing new

    tx.set(progressRef, {
      book_id: bookId,
      chapter,
      typed_verses: typed,
      verses_typed: typed.length,
      completed,
      updated_at: serverTimestamp(),
    });
    tx.update(profileRef, {
      verses_typed: increment(typed.length - before.length),
      chapters_completed: increment(completed && !wasCompleted ? 1 : 0),
    });
    return typed;
  });
}

// ---------------------------------------------------------------------------
// Bible studies. Only verified ministers can create one; member_ids includes the host.
// ---------------------------------------------------------------------------

/** Every study the user can see: public ones, plus any they host or have joined. */
export async function listStudies(uid: string): Promise<Study[]> {
  const col = collection(getDb(), "studies");
  // Two queries, because Firestore rules filter nothing: each query has to match what the
  // rules allow on its own.
  const [publicStudies, mine] = await Promise.all([
    getDocs(query(col, where("is_public", "==", true))),
    getDocs(query(col, where("member_ids", "array-contains", uid))),
  ]);
  const byId = new Map<string, Study>();
  for (const d of [...publicStudies.docs, ...mine.docs]) byId.set(d.id, toStudy(d.id, d.data()));
  return [...byId.values()].sort(newestFirst);
}

/** A study, or null when it does not exist or is private and the user is not in it. */
export async function getStudy(id: string): Promise<Study | null> {
  try {
    const snap = await getDoc(doc(getDb(), "studies", id));
    return snap.exists() ? toStudy(snap.id, snap.data()) : null;
  } catch (error) {
    if ((error as { code?: string }).code === "permission-denied") return null;
    throw error;
  }
}

export interface StudyInput {
  title: string;
  description: string;
  schedule: string;
  translation: string;
  isPublic: boolean;
}

export async function createStudy(hostId: string, input: StudyInput): Promise<void> {
  await addDoc(collection(getDb(), "studies"), {
    host_id: hostId,
    title: clean(input.title),
    description: clean(input.description),
    translation: input.translation,
    schedule: clean(input.schedule),
    is_public: input.isPublic,
    join_code: crypto.randomUUID().replace(/-/g, "").slice(0, 8),
    member_ids: [hostId],
    created_at: serverTimestamp(),
  });
}

export async function joinStudy(studyId: string, uid: string): Promise<void> {
  await updateDoc(doc(getDb(), "studies", studyId), { member_ids: arrayUnion(uid) });
}

export async function leaveStudy(studyId: string, uid: string): Promise<void> {
  await updateDoc(doc(getDb(), "studies", studyId), { member_ids: arrayRemove(uid) });
}

// ---------------------------------------------------------------------------
// Minister applications. An admin reviews them in the Firebase console (see README.md).
// ---------------------------------------------------------------------------

/** The user's most recent application, if any. */
export async function getLatestApplication(uid: string): Promise<MinisterApplication | null> {
  const snap = await getDocs(query(collection(getDb(), "minister_applications"), where("user_id", "==", uid)));
  const applications = snap.docs.map((d) => toApplication(d.id, d.data())).sort(newestFirst);
  return applications[0] ?? null;
}

export interface ApplicationInput {
  church_name: string;
  denomination: string;
  role_title: string;
  credential_url: string;
  note: string;
}

export async function submitApplication(uid: string, input: ApplicationInput): Promise<MinisterApplication> {
  const ref = await addDoc(collection(getDb(), "minister_applications"), {
    user_id: uid,
    church_name: clean(input.church_name),
    denomination: clean(input.denomination),
    role_title: clean(input.role_title),
    credential_url: clean(input.credential_url),
    note: clean(input.note),
    status: "pending",
    reviewed_by: null,
    reviewed_at: null,
    created_at: serverTimestamp(),
  });
  return toApplication(ref.id, (await getDoc(ref)).data() ?? {});
}

// ---------------------------------------------------------------------------
// Community board
// ---------------------------------------------------------------------------

export async function listPosts(max = 50): Promise<CommunityPost[]> {
  const snap = await getDocs(
    query(collection(getDb(), "community_posts"), orderBy("created_at", "desc"), limit(max))
  );
  return snap.docs.map((d) => toPost(d.id, d.data()));
}

export interface PostInput {
  category: CommunityPost["category"];
  title: string;
  body: string;
}

export async function createPost(authorId: string, input: PostInput): Promise<void> {
  await addDoc(collection(getDb(), "community_posts"), {
    author_id: authorId,
    category: input.category,
    title: clean(input.title),
    body: clean(input.body),
    created_at: serverTimestamp(),
  });
}
