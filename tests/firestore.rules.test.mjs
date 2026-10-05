// Tests for firestore.rules. Run with `npm run test:rules`: it starts the Firestore
// emulator (JDK 21+ required) and runs this file against it.
//
// The expectations come from the spec (the old Postgres RLS policies plus the Firestore
// data contract), not from the rules text, so a failure means the rules and the intended
// behaviour disagree. Tests marked `todo` document a known gap that Firestore rules
// cannot close; they never fail the run.

import { readFileSync } from "node:fs";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
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
  setDoc,
  setLogLevel,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

setLogLevel("silent"); // denied requests are expected here; keep the SDK from logging them

// ---------------------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------------------

let testEnv;
const clients = new Map();

/** Firestore client for `uid` (null = signed out), cached for the whole run. */
function as(uid, claims) {
  const key = uid === null ? "signed-out" : `${uid}:${JSON.stringify(claims ?? {})}`;
  if (!clients.has(key)) {
    const context = uid === null ? testEnv.unauthenticatedContext() : testEnv.authenticatedContext(uid, claims);
    clients.set(key, context.firestore());
  }
  return clients.get(key);
}

const D = (uid, path) => doc(as(uid), path);
const C = (uid, path) => collection(as(uid), path);

/** Run `fn` against the database with security rules disabled (seeding and inspecting). */
const bypass = (fn) => testEnv.withSecurityRulesDisabled((context) => fn(context.firestore()));

/** The stored data of a document, or null if it does not exist (read with rules disabled). */
async function peek(path) {
  let data = null; // withSecurityRulesDisabled resolves to void, so hand the value out through a closure
  await bypass(async (db) => {
    const snap = await getDoc(doc(db, path));
    data = snap.exists() ? snap.data() : null;
  });
  return data;
}

const idsOf = (snap) => snap.docs.map((d) => d.id).sort();
const omit = (obj, ...keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
const longer = (n) => "x".repeat(n);

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-bibleprep",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});

after(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// ---------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------

const T0 = Timestamp.fromDate(new Date("2026-01-01T00:00:00Z"));

const profile = (over = {}) => ({
  display_name: "Test",
  locale: "en",
  role: "member",
  is_minister: false,
  verses_typed: 0,
  chapters_completed: 0,
  created_at: T0,
  ...over,
});

// Users that have a profile. `ghost` and `newbie` are signed in but have none.
const USERS = {
  alice: profile({ display_name: "Alice" }),
  bob: profile({ display_name: "Bob" }),
  minnie: profile({ display_name: "Minnie", role: "minister", is_minister: true }),
  ada: profile({ display_name: "Ada", role: "admin", is_minister: true }), // like the old seeded admin
  root: profile({ display_name: "Root", role: "admin", is_minister: false }), // admin, not a verified minister
};

/** What the app writes when it creates a profile. */
const newProfile = (over = {}) => ({
  display_name: "Newbie",
  locale: "en",
  role: "member",
  is_minister: false,
  verses_typed: 0,
  chapters_completed: 0,
  created_at: serverTimestamp(),
  ...over,
});

const progress = (bookId, chapter, verses, over = {}) => ({
  book_id: bookId,
  chapter,
  typed_verses: verses,
  verses_typed: verses.length,
  completed: false,
  updated_at: serverTimestamp(),
  ...over,
});

const studyData = (over = {}) => ({
  host_id: "minnie",
  title: "Romans study",
  description: "Weekly",
  translation: "web",
  schedule: "Wed 7pm",
  is_public: true,
  join_code: "abcd1234",
  member_ids: ["minnie"],
  created_at: serverTimestamp(),
  ...over,
});

const postData = (over = {}) => ({
  author_id: "alice",
  category: "general",
  title: "Hello",
  body: "World",
  created_at: serverTimestamp(),
  ...over,
});

const appData = (over = {}) => ({
  user_id: "alice",
  church_name: "Grace Church",
  denomination: "",
  role_title: "",
  credential_url: "",
  note: "",
  status: "pending",
  reviewed_by: null,
  reviewed_at: null,
  created_at: serverTimestamp(),
  ...over,
});

/**
 * Baseline for every test:
 *   profiles  alice, bob (members), minnie (minister), ada (admin + minister), root (admin)
 *   studies   pub      public, members [minnie]
 *             pubAlice public, members [minnie, alice, bob]
 *             priv     private, members [minnie, alice]
 *   posts     p1 (alice, general), n1 (minnie, notice), g2 (minnie, general)
 *   apps      app1 (alice, pending)
 *   progress  alice 1_1 = verses 1-3, not completed
 */
beforeEach(async () => {
  await bypass(async (db) => {
    const study = studyData({ created_at: T0 });
    await Promise.all([
      ...Object.entries(USERS).map(([uid, data]) => setDoc(doc(db, "profiles", uid), data)),
      setDoc(doc(db, "studies/pub"), { ...study, member_ids: ["minnie"] }),
      setDoc(doc(db, "studies/pubAlice"), { ...study, title: "With Alice", member_ids: ["minnie", "alice", "bob"] }),
      setDoc(doc(db, "studies/priv"), { ...study, title: "Private", is_public: false, member_ids: ["minnie", "alice"] }),
      setDoc(doc(db, "community_posts/p1"), postData({ created_at: T0 })),
      setDoc(doc(db, "community_posts/n1"), postData({ author_id: "minnie", category: "notice", title: "Notice", created_at: T0 })),
      setDoc(doc(db, "community_posts/g2"), postData({ author_id: "minnie", title: "Minnie general", created_at: T0 })),
      setDoc(doc(db, "minister_applications/app1"), appData({ created_at: T0 })),
      setDoc(doc(db, "profiles/alice/reading_progress/1_1"), progress(1, 1, [1, 2, 3], { updated_at: T0 })),
    ]);
  });
});

// ---------------------------------------------------------------------------------------
// Signed out
// ---------------------------------------------------------------------------------------

describe("signed-out visitors", () => {
  it("can read a profile and list profiles (the leaderboard is public)", async () => {
    const one = await assertSucceeds(getDoc(D(null, "profiles/alice")));
    assert.equal(one.data().display_name, "Alice");
    const all = await assertSucceeds(getDocs(C(null, "profiles")));
    assert.deepEqual(idsOf(all), ["ada", "alice", "bob", "minnie", "root"]);
  });

  for (const path of [
    "studies/pub",
    "community_posts/p1",
    "minister_applications/app1",
    "profiles/alice/reading_progress/1_1",
  ]) {
    it(`cannot read ${path}`, async () => {
      await assertFails(getDoc(D(null, path)));
    });
  }

  for (const path of ["studies", "community_posts", "minister_applications", "profiles/alice/reading_progress"]) {
    it(`cannot list ${path}`, async () => {
      await assertFails(getDocs(C(null, path)));
    });
  }

  it("cannot write anywhere", async () => {
    await assertFails(setDoc(D(null, "profiles/newbie"), newProfile()));
    await assertFails(updateDoc(D(null, "profiles/alice"), { display_name: "Hacked" }));
    await assertFails(deleteDoc(D(null, "profiles/alice")));
    await assertFails(setDoc(D(null, "profiles/alice/reading_progress/2_1"), progress(2, 1, [1])));
    await assertFails(addDoc(C(null, "community_posts"), postData()));
    await assertFails(addDoc(C(null, "minister_applications"), appData()));
    await assertFails(addDoc(C(null, "studies"), studyData()));
    await assertFails(updateDoc(D(null, "studies/pub"), { member_ids: arrayUnion("anon") }));
  });
});

// ---------------------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------------------

describe("profiles", () => {
  describe("create", () => {
    it("lets a signed-in user create their own profile", async () => {
      await assertSucceeds(setDoc(D("newbie", "profiles/newbie"), newProfile()));
      const stored = await peek("profiles/newbie");
      assert.equal(stored.role, "member");
      assert.equal(stored.is_minister, false);
      assert.equal(stored.verses_typed, 0);
    });

    it("accepts Korean as the locale and a 60-character name", async () => {
      await assertSucceeds(setDoc(D("newbie", "profiles/newbie"), newProfile({ locale: "ko", display_name: longer(60) })));
    });

    it("denies creating a profile for another uid", async () => {
      await assertFails(setDoc(D("newbie", "profiles/someoneElse"), newProfile()));
    });

    it("denies an admin creating a profile for another uid", async () => {
      await assertFails(setDoc(D("ada", "profiles/someoneElse"), newProfile()));
    });

    const bad = {
      "role admin": { role: "admin" },
      "role minister": { role: "minister" },
      "is_minister true": { is_minister: true },
      "verses_typed 5": { verses_typed: 5 },
      "chapters_completed 1": { chapters_completed: 1 },
      "an unknown field (email)": { email: "a@b.c" },
      "a created_at in the past": { created_at: T0 },
      "an empty display_name": { display_name: "" },
      "a 61-character display_name": { display_name: longer(61) },
      "a numeric display_name": { display_name: 123 },
      "an unsupported locale": { locale: "fr" },
    };
    for (const [name, over] of Object.entries(bad)) {
      it(`denies creating a profile with ${name}`, async () => {
        await assertFails(setDoc(D("newbie", "profiles/newbie"), newProfile(over)));
      });
    }

    for (const key of ["display_name", "locale", "role", "is_minister", "verses_typed", "chapters_completed", "created_at"]) {
      it(`denies creating a profile without ${key}`, async () => {
        await assertFails(setDoc(D("newbie", "profiles/newbie"), omit(newProfile(), key)));
      });
    }

    it("denies a signed-out create", async () => {
      await assertFails(setDoc(D(null, "profiles/newbie"), newProfile()));
    });
  });

  describe("update by the owner", () => {
    it("can rename themselves and change locale", async () => {
      await assertSucceeds(updateDoc(D("alice", "profiles/alice"), { display_name: "Alice B", locale: "ko" }));
      const stored = await peek("profiles/alice");
      assert.equal(stored.display_name, "Alice B");
      assert.equal(stored.locale, "ko");
    });

    it("cannot set an empty or over-long name, a bad locale or a non-string name", async () => {
      await assertFails(updateDoc(D("alice", "profiles/alice"), { display_name: "" }));
      await assertFails(updateDoc(D("alice", "profiles/alice"), { display_name: longer(61) }));
      await assertFails(updateDoc(D("alice", "profiles/alice"), { display_name: 42 }));
      await assertFails(updateDoc(D("alice", "profiles/alice"), { locale: "fr" }));
    });

    const forbidden = {
      "role admin": { role: "admin" },
      "role minister": { role: "minister" },
      "is_minister true": { is_minister: true },
      "created_at": { created_at: serverTimestamp() },
      "a new field (email)": { email: "a@b.c" },
      "role together with an allowed field": { role: "admin", display_name: "Alice" },
    };
    for (const [name, over] of Object.entries(forbidden)) {
      it(`cannot change ${name}`, async () => {
        await assertFails(updateDoc(D("alice", "profiles/alice"), over));
      });
    }

    it("cannot escalate by overwriting their own document with setDoc", async () => {
      await assertFails(setDoc(D("alice", "profiles/alice"), newProfile({ role: "admin", is_minister: true })));
      await assertFails(setDoc(D("alice", "profiles/alice"), newProfile())); // created_at would change
      await assertFails(setDoc(D("alice", "profiles/alice"), { role: "admin" }, { merge: true }));
      assert.equal((await peek("profiles/alice")).role, "member");
    });

    it("cannot change someone else's profile", async () => {
      await assertFails(updateDoc(D("bob", "profiles/alice"), { display_name: "Hacked" }));
      await assertFails(updateDoc(D("bob", "profiles/alice"), { verses_typed: 5 }));
      await assertFails(updateDoc(D("minnie", "profiles/alice"), { is_minister: true }));
    });

    describe("progress counters", () => {
      beforeEach(async () => {
        await bypass((db) => updateDoc(doc(db, "profiles/alice"), { verses_typed: 10, chapters_completed: 2 }));
      });

      it("can grow", async () => {
        await assertSucceeds(updateDoc(D("alice", "profiles/alice"), { verses_typed: 11, chapters_completed: 3 }));
      });

      it("can reach exactly the Bible's totals (31102 verses, 1189 chapters)", async () => {
        await assertSucceeds(updateDoc(D("alice", "profiles/alice"), { verses_typed: 31102, chapters_completed: 1189 }));
      });

      it("cannot decrease", async () => {
        await assertFails(updateDoc(D("alice", "profiles/alice"), { verses_typed: 9 }));
        await assertFails(updateDoc(D("alice", "profiles/alice"), { chapters_completed: 1 }));
        await assertFails(updateDoc(D("alice", "profiles/alice"), { verses_typed: 0, chapters_completed: 0 }));
      });

      it("cannot exceed the Bible's totals", async () => {
        await assertFails(updateDoc(D("alice", "profiles/alice"), { verses_typed: 31103 }));
        await assertFails(updateDoc(D("alice", "profiles/alice"), { chapters_completed: 1190 }));
      });

      it("must be integers", async () => {
        await assertFails(updateDoc(D("alice", "profiles/alice"), { verses_typed: 10.5 }));
        await assertFails(updateDoc(D("alice", "profiles/alice"), { verses_typed: "11" }));
        await assertFails(updateDoc(D("alice", "profiles/alice"), { chapters_completed: null }));
      });

      // The totals are maintained by the client alongside the progress documents; the
      // rules bound them but cannot tie them to those documents.
      it("cannot be raised without typing anything", { todo: "totals are client-maintained; not tied to progress documents" }, async () => {
        await assertFails(updateDoc(D("alice", "profiles/alice"), { verses_typed: 31102, chapters_completed: 1189 }));
      });
    });
  });

  describe("update by an admin", () => {
    it("can flip another user's role and minister flag", async () => {
      await assertSucceeds(updateDoc(D("ada", "profiles/alice"), { is_minister: true, role: "minister" }));
      const stored = await peek("profiles/alice");
      assert.equal(stored.is_minister, true);
      assert.equal(stored.role, "minister");
    });

    it("can do so without being a verified minister themselves (role is enough)", async () => {
      await assertSucceeds(updateDoc(D("root", "profiles/bob"), { is_minister: true }));
    });

    it("can revoke minister status and promote another admin", async () => {
      await assertSucceeds(updateDoc(D("ada", "profiles/minnie"), { is_minister: false, role: "member" }));
      await assertSucceeds(updateDoc(D("ada", "profiles/bob"), { role: "admin" }));
    });

    it("cannot set a role outside member / minister / admin", async () => {
      await assertFails(updateDoc(D("ada", "profiles/alice"), { role: "superuser" }));
      await assertFails(updateDoc(D("ada", "profiles/alice"), { is_minister: "yes" }));
    });

    it("cannot edit another user's name, locale, counters or created_at", async () => {
      await assertFails(updateDoc(D("ada", "profiles/alice"), { display_name: "Renamed" }));
      await assertFails(updateDoc(D("ada", "profiles/alice"), { locale: "ko" }));
      await assertFails(updateDoc(D("ada", "profiles/alice"), { verses_typed: 99 }));
      await assertFails(updateDoc(D("ada", "profiles/alice"), { created_at: serverTimestamp() }));
      await assertFails(updateDoc(D("ada", "profiles/alice"), { role: "minister", display_name: "Renamed" }));
    });
  });

  describe("non-admins", () => {
    it("cannot flip role or minister flag, for anyone", async () => {
      await assertFails(updateDoc(D("alice", "profiles/bob"), { is_minister: true }));
      await assertFails(updateDoc(D("alice", "profiles/alice"), { is_minister: true }));
      await assertFails(updateDoc(D("minnie", "profiles/bob"), { role: "minister" }));
      await assertFails(updateDoc(D("minnie", "profiles/minnie"), { role: "admin" }));
    });
  });

  it("can never be deleted", async () => {
    await assertFails(deleteDoc(D("alice", "profiles/alice")));
    await assertFails(deleteDoc(D("ada", "profiles/alice")));
    await assertFails(deleteDoc(D("ada", "profiles/ada")));
    await assertFails(deleteDoc(D(null, "profiles/alice")));
    assert.ok(await peek("profiles/alice"));
  });
});

// ---------------------------------------------------------------------------------------
// Reading progress
// ---------------------------------------------------------------------------------------

describe("reading progress", () => {
  const path = (id, uid = "alice") => `profiles/${uid}/reading_progress/${id}`;

  describe("owner writes", () => {
    it("can create a chapter document and then extend it", async () => {
      await assertSucceeds(setDoc(D("alice", path("2_1")), progress(2, 1, [1, 2])));
      await assertSucceeds(
        updateDoc(D("alice", path("2_1")), { typed_verses: [1, 2, 3], verses_typed: 3, updated_at: serverTimestamp() })
      );
      const stored = await peek(path("2_1"));
      assert.deepEqual(stored.typed_verses, [1, 2, 3]);
      assert.equal(stored.verses_typed, 3);
    });

    it("can mark a chapter completed", async () => {
      await assertSucceeds(
        updateDoc(D("alice", path("1_1")), { completed: true, updated_at: serverTimestamp() })
      );
    });

    it("accepts the edges: book 66, book 1, chapter 150 and a 176-verse chapter", async () => {
      await assertSucceeds(setDoc(D("alice", path("66_22")), progress(66, 22, [1])));
      await assertSucceeds(setDoc(D("alice", path("19_150")), progress(19, 150, [1])));
      const verses = Array.from({ length: 176 }, (_, i) => i + 1);
      await assertSucceeds(setDoc(D("alice", path("19_119")), progress(19, 119, verses)));
    });

    it("can delete their own chapter document", async () => {
      await assertSucceeds(deleteDoc(D("alice", path("1_1"))));
    });

    const bad = {
      "a document id that does not match book and chapter": [path("1_2"), progress(1, 1, [1])],
      "a dash in the id": [path("1-1"), progress(1, 1, [1])],
      "a leading zero in the id": [path("01_1"), progress(1, 1, [1])],
      "a swapped id": [path("1_2"), progress(2, 1, [1])],
      "verses_typed higher than the verse count": [path("2_1"), progress(2, 1, [1, 2], { verses_typed: 3 })],
      "verses_typed lower than the verse count": [path("2_1"), progress(2, 1, [1, 2], { verses_typed: 1 })],
      "duplicate verses": [path("2_1"), progress(2, 1, [1, 1, 2])],
      "177 verses": [path("2_1"), progress(2, 1, Array.from({ length: 177 }, (_, i) => i + 1))],
      "book 0": [path("0_1"), progress(0, 1, [1])],
      "book 67": [path("67_1"), progress(67, 1, [1])],
      "a negative book": [path("-1_1"), progress(-1, 1, [1])],
      "chapter 0": [path("2_0"), progress(2, 0, [1])],
      "chapter 151": [path("2_151"), progress(2, 151, [1])],
      "a string book_id": [path("1_1"), progress("1", 1, [1])],
      "a fractional chapter": [path("2_1.5"), progress(2, 1.5, [1])],
      "completed as a string": [path("2_1"), progress(2, 1, [1], { completed: "yes" })],
      "typed_verses that is not a list": [path("2_1"), progress(2, 1, [1], { typed_verses: "1,2", verses_typed: 3 })],
      "a client-side updated_at": [path("2_1"), progress(2, 1, [1], { updated_at: Timestamp.now() })],
      "an unknown field": [path("2_1"), progress(2, 1, [1], { note: "x" })],
      "a missing field (completed)": [path("2_1"), omit(progress(2, 1, [1]), "completed")],
      "a missing field (updated_at)": [path("2_1"), omit(progress(2, 1, [1]), "updated_at")],
    };
    for (const [name, [p, data]] of Object.entries(bad)) {
      it(`denies ${name}`, async () => {
        await assertFails(setDoc(D("alice", p), data));
      });
    }

    it("denies an update that leaves verses_typed stale", async () => {
      await assertFails(updateDoc(D("alice", path("1_1")), { typed_verses: [1, 2, 3, 4], updated_at: serverTimestamp() }));
    });

    it("denies an update that adds duplicate verses", async () => {
      await assertFails(
        updateDoc(D("alice", path("1_1")), { typed_verses: [1, 2, 3, 3], verses_typed: 4, updated_at: serverTimestamp() })
      );
    });

    // Firestore rules cannot iterate a list, so element values are not validated.
    it("denies verse numbers that are not integers", { todo: "rules cannot check list elements" }, async () => {
      await assertFails(setDoc(D("alice", path("2_1")), progress(2, 1, ["a", "b"])));
    });

    it("denies verse numbers outside 1..176", { todo: "rules cannot check list elements" }, async () => {
      await assertFails(setDoc(D("alice", path("2_1")), progress(2, 1, [-5, 9999])));
    });

    it("denies a chapter marked completed with no verses typed", { todo: "rules do not know chapter lengths" }, async () => {
      await assertFails(setDoc(D("alice", path("2_1")), progress(2, 1, [], { completed: true })));
    });
  });

  describe("access control", () => {
    it("owner can read the document, list the collection and filter by book", async () => {
      await assertSucceeds(getDoc(D("alice", path("1_1"))));
      const all = await assertSucceeds(getDocs(C("alice", "profiles/alice/reading_progress")));
      assert.deepEqual(idsOf(all), ["1_1"]);
      const book = await assertSucceeds(getDocs(query(C("alice", "profiles/alice/reading_progress"), where("book_id", "==", 1))));
      assert.deepEqual(idsOf(book), ["1_1"]);
    });

    it("another user cannot read, list or write it", async () => {
      await assertFails(getDoc(D("bob", path("1_1"))));
      await assertFails(getDocs(C("bob", "profiles/alice/reading_progress")));
      await assertFails(setDoc(D("bob", path("2_1")), progress(2, 1, [1])));
      await assertFails(updateDoc(D("bob", path("1_1")), { completed: true, updated_at: serverTimestamp() }));
      await assertFails(deleteDoc(D("bob", path("1_1"))));
    });

    it("admins and ministers cannot read it either (owner only)", async () => {
      await assertFails(getDoc(D("ada", path("1_1"))));
      await assertFails(getDocs(C("root", "profiles/alice/reading_progress")));
      await assertFails(getDoc(D("minnie", path("1_1"))));
    });

    it("a signed-out visitor cannot touch it", async () => {
      await assertFails(getDoc(D(null, path("1_1"))));
      await assertFails(setDoc(D(null, path("2_1")), progress(2, 1, [1])));
    });

    it("cannot be read across users with a collection-group query", async () => {
      await assertFails(getDocs(collectionGroup(as("alice"), "reading_progress")));
      await assertFails(getDocs(collectionGroup(as("ada"), "reading_progress")));
    });
  });
});

// ---------------------------------------------------------------------------------------
// The app's atomic chapter save
// ---------------------------------------------------------------------------------------

/**
 * Mirrors the app: one transaction reads the chapter document, writes the merged chapter
 * and bumps the leaderboard totals on the profile. `overrides` replaces the increments.
 */
function saveChapter(uid, bookId, chapter, verses, chapterVerses, { owner = uid, ...overrides } = {}) {
  const db = as(uid);
  const chapterRef = doc(db, `profiles/${owner}/reading_progress/${bookId}_${chapter}`);
  const profileRef = doc(db, `profiles/${owner}`);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(chapterRef);
    const before = snap.exists() ? snap.data() : { typed_verses: [], completed: false };
    const typed = [...new Set([...before.typed_verses, ...verses])].sort((a, b) => a - b);
    const completed = before.completed || chapterVerses.every((v) => typed.includes(v));
    tx.set(chapterRef, {
      book_id: bookId,
      chapter,
      typed_verses: typed,
      verses_typed: typed.length,
      completed,
      updated_at: serverTimestamp(),
    });
    tx.update(profileRef, {
      verses_typed: increment(overrides.verses ?? typed.length - before.typed_verses.length),
      chapters_completed: increment(overrides.chapters ?? (completed && !before.completed ? 1 : 0)),
    });
    return typed;
  });
}

describe("atomic chapter save", () => {
  it("creates a completed chapter and bumps both totals", async () => {
    const typed = await assertSucceeds(saveChapter("alice", 2, 1, [1, 2, 3], [1, 2, 3]));
    assert.deepEqual(typed, [1, 2, 3]);
    const chapter = await peek("profiles/alice/reading_progress/2_1");
    assert.equal(chapter.completed, true);
    assert.equal(chapter.verses_typed, 3);
    const stored = await peek("profiles/alice");
    assert.equal(stored.verses_typed, 3);
    assert.equal(stored.chapters_completed, 1);
  });

  it("merges into an existing chapter and completes it", async () => {
    // alice already has verses 1-3 of chapter 1:1 (seed); typing verse 4 finishes a 4-verse chapter
    const typed = await assertSucceeds(saveChapter("alice", 1, 1, [3, 4], [1, 2, 3, 4]));
    assert.deepEqual(typed, [1, 2, 3, 4]);
    const stored = await peek("profiles/alice");
    assert.equal(stored.verses_typed, 1);
    assert.equal(stored.chapters_completed, 1);
  });

  it("an unfinished chapter bumps verses but not chapters (increment of 0)", async () => {
    await assertSucceeds(saveChapter("alice", 3, 1, [1], [1, 2]));
    const stored = await peek("profiles/alice");
    assert.equal(stored.verses_typed, 1);
    assert.equal(stored.chapters_completed, 0);
    assert.equal((await peek("profiles/alice/reading_progress/3_1")).completed, false);
  });

  it("works repeatedly, accumulating the totals", async () => {
    await assertSucceeds(saveChapter("alice", 4, 1, [1], [1, 2]));
    await assertSucceeds(saveChapter("alice", 4, 1, [2], [1, 2]));
    await assertSucceeds(saveChapter("alice", 5, 1, [1, 2], [1, 2]));
    const stored = await peek("profiles/alice");
    assert.equal(stored.verses_typed, 4);
    assert.equal(stored.chapters_completed, 2);
  });

  it("fails, atomically, when the verses total would pass 31102", async () => {
    await bypass((db) => updateDoc(doc(db, "profiles/alice"), { verses_typed: 31100 }));
    await assertFails(saveChapter("alice", 2, 2, [1, 2, 3], [1, 2, 3], { verses: 5 }));
    assert.equal(await peek("profiles/alice/reading_progress/2_2"), null, "chapter must not be written");
    assert.equal((await peek("profiles/alice")).verses_typed, 31100);
  });

  it("fails when the chapters total would pass 1189", async () => {
    await bypass((db) => updateDoc(doc(db, "profiles/alice"), { chapters_completed: 1189 }));
    await assertFails(saveChapter("alice", 2, 2, [1], [1], { chapters: 1 }));
    assert.equal(await peek("profiles/alice/reading_progress/2_2"), null);
  });

  it("fails, atomically, with a negative verses increment", async () => {
    await bypass((db) => updateDoc(doc(db, "profiles/alice"), { verses_typed: 10, chapters_completed: 2 }));
    await assertFails(saveChapter("alice", 2, 2, [1], [1, 2], { verses: -1 }));
    assert.equal(await peek("profiles/alice/reading_progress/2_2"), null);
    assert.equal((await peek("profiles/alice")).verses_typed, 10);
  });

  it("fails with a negative chapters increment", async () => {
    await bypass((db) => updateDoc(doc(db, "profiles/alice"), { verses_typed: 10, chapters_completed: 2 }));
    await assertFails(saveChapter("alice", 2, 2, [1], [1, 2], { chapters: -1 }));
    assert.equal((await peek("profiles/alice")).chapters_completed, 2);
  });

  it("fails when someone else's progress and profile are targeted", async () => {
    await assertFails(saveChapter("bob", 2, 1, [1], [1], { owner: "alice" }));
    assert.equal(await peek("profiles/alice/reading_progress/2_1"), null);
    assert.equal((await peek("profiles/alice")).verses_typed, 0);
  });

  it("fails for a signed-out visitor", async () => {
    await assertFails(saveChapter(null, 2, 1, [1], [1], { owner: "alice" }));
  });
});

// ---------------------------------------------------------------------------------------
// Minister applications
// ---------------------------------------------------------------------------------------

describe("minister applications", () => {
  describe("create", () => {
    it("lets a signed-in user apply for themselves", async () => {
      const ref = await assertSucceeds(addDoc(C("bob", "minister_applications"), appData({ user_id: "bob" })));
      const stored = await peek(`minister_applications/${ref.id}`);
      assert.equal(stored.status, "pending");
    });

    it("accepts the maximum field lengths", async () => {
      await assertSucceeds(
        addDoc(
          C("bob", "minister_applications"),
          appData({
            user_id: "bob",
            church_name: longer(120),
            denomination: longer(80),
            role_title: longer(80),
            credential_url: longer(300),
            note: longer(2000),
          })
        )
      );
    });

    it("lets a user without a profile apply for themselves", async () => {
      await assertSucceeds(addDoc(C("newbie", "minister_applications"), appData({ user_id: "newbie" })));
    });

    const bad = {
      "someone else's user_id": { user_id: "alice" },
      "status approved": { status: "approved" },
      "status rejected": { status: "rejected" },
      "reviewed_by set": { reviewed_by: "ada" },
      "reviewed_at set": { reviewed_at: serverTimestamp() },
      "a client-side created_at": { created_at: Timestamp.now() },
      "an empty church_name": { church_name: "" },
      "a 121-character church_name": { church_name: longer(121) },
      "an 81-character denomination": { denomination: longer(81) },
      "an 81-character role_title": { role_title: longer(81) },
      "a 301-character credential_url": { credential_url: longer(301) },
      "a 2001-character note": { note: longer(2001) },
      "an unknown field": { priority: 1 },
    };
    for (const [name, over] of Object.entries(bad)) {
      it(`denies an application with ${name}`, async () => {
        await assertFails(addDoc(C("bob", "minister_applications"), appData({ user_id: "bob", ...over })));
      });
    }

    it("denies an application missing a field", async () => {
      await assertFails(addDoc(C("bob", "minister_applications"), omit(appData({ user_id: "bob" }), "note")));
    });

    it("denies an admin applying on someone else's behalf", async () => {
      await assertFails(addDoc(C("ada", "minister_applications"), appData({ user_id: "bob" })));
    });
  });

  describe("read", () => {
    it("applicant can read their own, by id and by query", async () => {
      await assertSucceeds(getDoc(D("alice", "minister_applications/app1")));
      const mine = await assertSucceeds(
        getDocs(query(C("alice", "minister_applications"), where("user_id", "==", "alice")))
      );
      assert.deepEqual(idsOf(mine), ["app1"]);
    });

    it("another user cannot read it or query for it", async () => {
      await assertFails(getDoc(D("bob", "minister_applications/app1")));
      await assertFails(getDocs(query(C("bob", "minister_applications"), where("user_id", "==", "alice"))));
      await assertFails(getDocs(C("bob", "minister_applications")));
      const own = await assertSucceeds(getDocs(query(C("bob", "minister_applications"), where("user_id", "==", "bob"))));
      assert.equal(own.size, 0);
    });

    it("a minister (non-admin) cannot read other people's applications", async () => {
      await assertFails(getDoc(D("minnie", "minister_applications/app1")));
    });

    it("admins can read and list all of them", async () => {
      await assertSucceeds(getDoc(D("ada", "minister_applications/app1")));
      await assertSucceeds(getDoc(D("root", "minister_applications/app1")));
      const all = await assertSucceeds(getDocs(C("ada", "minister_applications")));
      assert.deepEqual(idsOf(all), ["app1"]);
    });
  });

  describe("review", () => {
    const review = (status = "approved", over = {}) => ({
      status,
      reviewed_by: "ada",
      reviewed_at: serverTimestamp(),
      ...over,
    });

    it("an admin can approve or reject", async () => {
      await assertSucceeds(updateDoc(D("ada", "minister_applications/app1"), review("approved")));
      assert.equal((await peek("minister_applications/app1")).status, "approved");
      await assertSucceeds(updateDoc(D("ada", "minister_applications/app1"), review("rejected")));
      assert.equal((await peek("minister_applications/app1")).status, "rejected");
    });

    it("an admin who is not a verified minister can review too", async () => {
      await assertSucceeds(updateDoc(D("root", "minister_applications/app1"), review("approved", { reviewed_by: "root" })));
    });

    it("the applicant cannot approve their own application", async () => {
      await assertFails(updateDoc(D("alice", "minister_applications/app1"), review("approved", { reviewed_by: "alice" })));
      await assertFails(updateDoc(D("alice", "minister_applications/app1"), { status: "approved" }));
    });

    it("a minister who is not an admin cannot review", async () => {
      await assertFails(updateDoc(D("minnie", "minister_applications/app1"), review("approved", { reviewed_by: "minnie" })));
    });

    it("a signed-out visitor cannot review", async () => {
      await assertFails(updateDoc(D(null, "minister_applications/app1"), review("approved")));
    });

    it("an admin cannot touch fields other than the review fields", async () => {
      await assertFails(updateDoc(D("ada", "minister_applications/app1"), review("approved", { church_name: "Changed" })));
      await assertFails(updateDoc(D("ada", "minister_applications/app1"), { note: "edited" }));
      await assertFails(updateDoc(D("ada", "minister_applications/app1"), review("approved", { user_id: "bob" })));
      await assertFails(updateDoc(D("ada", "minister_applications/app1"), review("approved", { created_at: serverTimestamp() })));
    });

    it("an admin must record themselves and the server time", async () => {
      await assertFails(updateDoc(D("ada", "minister_applications/app1"), review("approved", { reviewed_by: "bob" })));
      await assertFails(updateDoc(D("ada", "minister_applications/app1"), review("approved", { reviewed_at: Timestamp.now() })));
    });

    it("an admin cannot set an unknown status", async () => {
      await assertFails(updateDoc(D("ada", "minister_applications/app1"), review("maybe")));
    });
  });

  it("can never be deleted", async () => {
    await assertFails(deleteDoc(D("alice", "minister_applications/app1")));
    await assertFails(deleteDoc(D("ada", "minister_applications/app1")));
  });
});

// ---------------------------------------------------------------------------------------
// Studies
// ---------------------------------------------------------------------------------------

describe("studies", () => {
  describe("create", () => {
    it("lets a verified minister host a study", async () => {
      const ref = await assertSucceeds(addDoc(C("minnie", "studies"), studyData()));
      const stored = await peek(`studies/${ref.id}`);
      assert.deepEqual(stored.member_ids, ["minnie"]);
      assert.equal(stored.host_id, "minnie");
    });

    it("lets a private study be created", async () => {
      await assertSucceeds(addDoc(C("minnie", "studies"), studyData({ is_public: false })));
    });

    it("accepts the maximum field lengths", async () => {
      await assertSucceeds(
        addDoc(
          C("minnie", "studies"),
          studyData({ title: longer(120), description: longer(2000), schedule: longer(120), translation: longer(20) })
        )
      );
    });

    it("lets an admin who is also a verified minister host", async () => {
      await assertSucceeds(addDoc(C("ada", "studies"), studyData({ host_id: "ada", member_ids: ["ada"] })));
    });

    it("denies a member who is not a minister", async () => {
      await assertFails(addDoc(C("alice", "studies"), studyData({ host_id: "alice", member_ids: ["alice"] })));
    });

    it("denies an admin who is not a verified minister (parity with the old RLS)", async () => {
      await assertFails(addDoc(C("root", "studies"), studyData({ host_id: "root", member_ids: ["root"] })));
    });

    it("denies a signed-in user who has no profile (fails closed)", async () => {
      await assertFails(addDoc(C("ghost", "studies"), studyData({ host_id: "ghost", member_ids: ["ghost"] })));
    });

    it("denies a signed-out visitor", async () => {
      await assertFails(addDoc(C(null, "studies"), studyData()));
    });

    const bad = {
      "someone else as host": { host_id: "alice" },
      "extra members": { member_ids: ["minnie", "alice"] },
      "no members": { member_ids: [] },
      "a member list without the host": { member_ids: ["alice"] },
      "an unknown field": { owner_note: "x" },
      "a 7-character join code": { join_code: "abcd123" },
      "a 9-character join code": { join_code: "abcd12345" },
      "an empty title": { title: "" },
      "a 121-character title": { title: longer(121) },
      "a 2001-character description": { description: longer(2001) },
      "a 121-character schedule": { schedule: longer(121) },
      "an empty translation": { translation: "" },
      "a 21-character translation": { translation: longer(21) },
      "a non-boolean is_public": { is_public: "yes" },
      "a past created_at": { created_at: T0 },
    };
    for (const [name, over] of Object.entries(bad)) {
      it(`denies a study with ${name}`, async () => {
        await assertFails(addDoc(C("minnie", "studies"), studyData(over)));
      });
    }

    it("denies a study missing a field", async () => {
      await assertFails(addDoc(C("minnie", "studies"), omit(studyData(), "schedule")));
      await assertFails(addDoc(C("minnie", "studies"), omit(studyData(), "member_ids")));
    });
  });

  describe("read", () => {
    it("any signed-in user can read a public study", async () => {
      await assertSucceeds(getDoc(D("bob", "studies/pub")));
      await assertSucceeds(getDoc(D("newbie", "studies/pub")));
    });

    it("a signed-out visitor cannot read a public study", async () => {
      await assertFails(getDoc(D(null, "studies/pub")));
    });

    it("a private study is hidden from non-members", async () => {
      await assertFails(getDoc(D("bob", "studies/priv")));
      await assertFails(getDoc(D("ada", "studies/priv"))); // admins get no special access
    });

    it("a private study is readable by its host and its members", async () => {
      await assertSucceeds(getDoc(D("minnie", "studies/priv")));
      await assertSucceeds(getDoc(D("alice", "studies/priv")));
    });

    it("the public-studies query works for any signed-in user and hides private ones", async () => {
      const snap = await assertSucceeds(getDocs(query(C("bob", "studies"), where("is_public", "==", true))));
      assert.deepEqual(idsOf(snap), ["pub", "pubAlice"]);
    });

    it("the 'studies I belong to' query returns private and public memberships", async () => {
      const snap = await assertSucceeds(getDocs(query(C("alice", "studies"), where("member_ids", "array-contains", "alice"))));
      assert.deepEqual(idsOf(snap), ["priv", "pubAlice"]);
    });

    it("a user cannot query for somebody else's memberships", async () => {
      await assertFails(getDocs(query(C("bob", "studies"), where("member_ids", "array-contains", "alice"))));
    });

    it("the host can query their own studies by host_id", async () => {
      const snap = await assertSucceeds(getDocs(query(C("minnie", "studies"), where("host_id", "==", "minnie"))));
      assert.deepEqual(idsOf(snap), ["priv", "pub", "pubAlice"]);
    });

    it("an unconstrained list is denied, even though some documents are readable", async () => {
      await assertFails(getDocs(C("alice", "studies")));
      await assertFails(getDocs(C("minnie", "studies")));
      await assertFails(getDocs(C("ada", "studies")));
    });

    it("querying for private studies is denied for non-hosts", async () => {
      await assertFails(getDocs(query(C("bob", "studies"), where("is_public", "==", false))));
      await assertFails(getDocs(query(C("alice", "studies"), where("is_public", "==", false))));
    });

    it("the public-studies query is denied when signed out", async () => {
      await assertFails(getDocs(query(C(null, "studies"), where("is_public", "==", true))));
    });
  });

  describe("join", () => {
    it("any signed-in user can join a public study", async () => {
      await assertSucceeds(updateDoc(D("bob", "studies/pub"), { member_ids: arrayUnion("bob") }));
      assert.deepEqual((await peek("studies/pub")).member_ids.sort(), ["bob", "minnie"]);
    });

    it("joining is idempotent", async () => {
      await assertSucceeds(updateDoc(D("bob", "studies/pub"), { member_ids: arrayUnion("bob") }));
      await assertSucceeds(updateDoc(D("bob", "studies/pub"), { member_ids: arrayUnion("bob") }));
      assert.deepEqual((await peek("studies/pub")).member_ids.sort(), ["bob", "minnie"]);
    });

    it("a user without a profile can join a public study", async () => {
      await assertSucceeds(updateDoc(D("newbie", "studies/pub"), { member_ids: arrayUnion("newbie") }));
    });

    it("cannot join a private study", async () => {
      await assertFails(updateDoc(D("bob", "studies/priv"), { member_ids: arrayUnion("bob") }));
    });

    it("cannot add someone else's uid", async () => {
      await assertFails(updateDoc(D("bob", "studies/pub"), { member_ids: arrayUnion("carol") }));
      await assertFails(updateDoc(D("bob", "studies/pub"), { member_ids: arrayUnion("bob", "carol") }));
    });

    it("cannot join and change anything else in the same write", async () => {
      await assertFails(updateDoc(D("bob", "studies/pub"), { member_ids: arrayUnion("bob"), title: "Hacked" }));
      await assertFails(updateDoc(D("bob", "studies/pub"), { member_ids: arrayUnion("bob"), is_public: false }));
      await assertFails(updateDoc(D("bob", "studies/pub"), { member_ids: arrayUnion("bob"), host_id: "bob" }));
    });

    it("cannot replace the member list wholesale", async () => {
      await assertFails(updateDoc(D("bob", "studies/pub"), { member_ids: ["bob"] }));
    });

    it("a signed-out visitor cannot join", async () => {
      await assertFails(updateDoc(D(null, "studies/pub"), { member_ids: arrayUnion("anon") }));
    });
  });

  describe("leave", () => {
    it("a member can leave a public study", async () => {
      await assertSucceeds(updateDoc(D("alice", "studies/pubAlice"), { member_ids: arrayRemove("alice") }));
      assert.deepEqual((await peek("studies/pubAlice")).member_ids.sort(), ["bob", "minnie"]);
    });

    it("a member can leave a private study", async () => {
      await assertSucceeds(updateDoc(D("alice", "studies/priv"), { member_ids: arrayRemove("alice") }));
    });

    it("the host cannot leave their own study", async () => {
      await assertFails(updateDoc(D("minnie", "studies/pubAlice"), { member_ids: arrayRemove("minnie") }));
      await assertFails(updateDoc(D("minnie", "studies/pub"), { member_ids: arrayRemove("minnie") }));
    });

    it("a member cannot remove another member", async () => {
      await assertFails(updateDoc(D("alice", "studies/pubAlice"), { member_ids: arrayRemove("bob") }));
      await assertFails(updateDoc(D("alice", "studies/pubAlice"), { member_ids: arrayRemove("alice", "bob") }));
      await assertFails(updateDoc(D("alice", "studies/pubAlice"), { member_ids: arrayRemove("minnie") }));
    });

    it("a member cannot leave and change anything else in the same write", async () => {
      await assertFails(updateDoc(D("alice", "studies/pubAlice"), { member_ids: arrayRemove("alice"), title: "Hacked" }));
    });
  });

  describe("host edits", () => {
    it("the host can edit title, description, translation, schedule and visibility", async () => {
      await assertSucceeds(
        updateDoc(D("minnie", "studies/pub"), {
          title: "New title",
          description: "",
          translation: "kjv",
          schedule: "Fri 8pm",
          is_public: false,
        })
      );
      assert.equal((await peek("studies/pub")).is_public, false);
    });

    it("the host can remove a member", async () => {
      await assertSucceeds(updateDoc(D("minnie", "studies/pubAlice"), { member_ids: arrayRemove("alice") }));
      assert.deepEqual((await peek("studies/pubAlice")).member_ids.sort(), ["bob", "minnie"]);
    });

    it("the host cannot add a member", async () => {
      await assertFails(updateDoc(D("minnie", "studies/pub"), { member_ids: arrayUnion("carol") }));
      await assertFails(updateDoc(D("minnie", "studies/pub"), { member_ids: arrayUnion("minnie", "carol") }));
    });

    it("the host cannot remove themselves while editing", async () => {
      await assertFails(updateDoc(D("minnie", "studies/pubAlice"), { member_ids: arrayRemove("minnie"), title: "x" }));
    });

    it("the host cannot hand the study to someone else or touch immutable fields", async () => {
      await assertFails(updateDoc(D("minnie", "studies/pub"), { host_id: "alice" }));
      await assertFails(updateDoc(D("minnie", "studies/pub"), { join_code: "zzzzzzzz" }));
      await assertFails(updateDoc(D("minnie", "studies/pub"), { created_at: serverTimestamp() }));
      await assertFails(updateDoc(D("minnie", "studies/pub"), { owner_note: "x" }));
    });

    it("the host cannot save invalid values", async () => {
      await assertFails(updateDoc(D("minnie", "studies/pub"), { title: "" }));
      await assertFails(updateDoc(D("minnie", "studies/pub"), { title: longer(121) }));
      await assertFails(updateDoc(D("minnie", "studies/pub"), { translation: "" }));
      await assertFails(updateDoc(D("minnie", "studies/pub"), { is_public: "no" }));
    });

    it("members, non-members and admins cannot edit the study", async () => {
      await assertFails(updateDoc(D("alice", "studies/pubAlice"), { title: "Hacked" }));
      await assertFails(updateDoc(D("alice", "studies/pubAlice"), { is_public: false }));
      await assertFails(updateDoc(D("bob", "studies/pub"), { title: "Hacked" }));
      await assertFails(updateDoc(D("ada", "studies/pub"), { title: "Hacked" }));
    });
  });

  // The UI shows member_ids.length as the member count, and the spec lets a joiner add
  // "only their own uid", once. A set comparison alone lets duplicates through.
  describe("member list integrity", () => {
    it("a joiner cannot write their own uid several times (inflating the member count)", async () => {
      await assertFails(updateDoc(D("bob", "studies/pub"), { member_ids: ["minnie", "bob", "bob", "bob"] }));
    });

    it("a leaver cannot duplicate other members while leaving", async () => {
      await assertFails(updateDoc(D("alice", "studies/pubAlice"), { member_ids: ["minnie", "bob", "bob"] }));
    });

    it("the host cannot duplicate entries while editing the roster", async () => {
      await assertFails(updateDoc(D("minnie", "studies/pubAlice"), { member_ids: ["minnie", "minnie", "alice", "bob"] }));
    });

    it("a non-member cannot send a no-op 'leave' to a private study (no existence oracle)", async () => {
      // The study is private and bob is not in it: he must not be able to tell it exists
      // by seeing a write succeed where a read is denied.
      await assertFails(updateDoc(D("bob", "studies/priv"), { member_ids: arrayRemove("bob") }));
    });

    it("an honest join and leave still keep the list free of duplicates", async () => {
      await assertSucceeds(updateDoc(D("bob", "studies/pub"), { member_ids: arrayUnion("bob") }));
      await assertSucceeds(updateDoc(D("bob", "studies/pub"), { member_ids: arrayRemove("bob") }));
      assert.deepEqual((await peek("studies/pub")).member_ids, ["minnie"]);
    });
  });

  describe("delete", () => {
    it("the host can delete their study", async () => {
      await assertSucceeds(deleteDoc(D("minnie", "studies/pub")));
      assert.equal(await peek("studies/pub"), null);
    });

    it("a member, a non-member, an admin and a visitor cannot", async () => {
      await assertFails(deleteDoc(D("alice", "studies/pubAlice")));
      await assertFails(deleteDoc(D("bob", "studies/pub")));
      await assertFails(deleteDoc(D("ada", "studies/pub")));
      await assertFails(deleteDoc(D(null, "studies/pub")));
    });
  });
});

// ---------------------------------------------------------------------------------------
// Community posts
// ---------------------------------------------------------------------------------------

describe("community posts", () => {
  describe("read", () => {
    it("requires being signed in", async () => {
      await assertFails(getDoc(D(null, "community_posts/p1")));
      await assertFails(
        getDocs(query(C(null, "community_posts"), orderBy("created_at", "desc"), limit(50)))
      );
    });

    it("any signed-in user can read a post and run the board query", async () => {
      await assertSucceeds(getDoc(D("bob", "community_posts/p1")));
      const snap = await assertSucceeds(
        getDocs(query(C("bob", "community_posts"), orderBy("created_at", "desc"), limit(50)))
      );
      assert.deepEqual(idsOf(snap), ["g2", "n1", "p1"]);
    });
  });

  describe("create", () => {
    for (const category of ["general", "qna", "testimony"]) {
      it(`a plain member can post in ${category}`, async () => {
        await assertSucceeds(addDoc(C("alice", "community_posts"), postData({ category })));
      });
    }

    it("accepts an empty body and the maximum lengths", async () => {
      await assertSucceeds(addDoc(C("alice", "community_posts"), postData({ body: "" })));
      await assertSucceeds(addDoc(C("alice", "community_posts"), postData({ title: longer(200), body: longer(10000) })));
    });

    it("a plain member cannot post a notice", async () => {
      await assertFails(addDoc(C("alice", "community_posts"), postData({ category: "notice" })));
    });

    it("a verified minister can post a notice", async () => {
      await assertSucceeds(addDoc(C("minnie", "community_posts"), postData({ author_id: "minnie", category: "notice" })));
    });

    it("an admin who is not a verified minister can post a notice", async () => {
      await assertSucceeds(addDoc(C("root", "community_posts"), postData({ author_id: "root", category: "notice" })));
    });

    it("a signed-in user without a profile cannot post a notice (fails closed)", async () => {
      await assertFails(addDoc(C("ghost", "community_posts"), postData({ author_id: "ghost", category: "notice" })));
    });

    it("a signed-out visitor cannot post", async () => {
      await assertFails(addDoc(C(null, "community_posts"), postData()));
    });

    const bad = {
      "a spoofed author": { author_id: "bob" },
      "an unknown field (author_name)": { author_name: "Alice" },
      "an unknown category": { category: "ads" },
      "an empty title": { title: "" },
      "a 201-character title": { title: longer(201) },
      "a 10001-character body": { body: longer(10001) },
      "a numeric body": { body: 5 },
      "a past created_at": { created_at: T0 },
    };
    for (const [name, over] of Object.entries(bad)) {
      it(`denies a post with ${name}`, async () => {
        await assertFails(addDoc(C("alice", "community_posts"), postData(over)));
      });
    }

    it("denies a post missing a field", async () => {
      await assertFails(addDoc(C("alice", "community_posts"), omit(postData(), "body")));
      await assertFails(addDoc(C("alice", "community_posts"), omit(postData(), "category")));
    });
  });

  describe("update", () => {
    it("the author can edit title, body and category", async () => {
      await assertSucceeds(updateDoc(D("alice", "community_posts/p1"), { title: "Edited", body: "New body", category: "qna" }));
      assert.equal((await peek("community_posts/p1")).category, "qna");
    });

    it("someone else cannot edit it", async () => {
      await assertFails(updateDoc(D("bob", "community_posts/p1"), { title: "Hacked" }));
      await assertFails(updateDoc(D("minnie", "community_posts/p1"), { title: "Hacked" }));
      await assertFails(updateDoc(D("ada", "community_posts/p1"), { title: "Hacked" }));
    });

    it("the author cannot turn a general post into a notice if they are a plain member", async () => {
      await assertFails(updateDoc(D("alice", "community_posts/p1"), { category: "notice" }));
    });

    it("a minister can turn their own general post into a notice", async () => {
      await assertSucceeds(updateDoc(D("minnie", "community_posts/g2"), { category: "notice" }));
    });

    it("a minister can keep editing an existing notice and can downgrade it", async () => {
      await assertSucceeds(updateDoc(D("minnie", "community_posts/n1"), { title: "Updated notice" }));
      await assertSucceeds(updateDoc(D("minnie", "community_posts/n1"), { category: "general" }));
    });

    it("an author who is no longer a minister can still edit their old notice", async () => {
      await bypass((db) => updateDoc(doc(db, "profiles/minnie"), { is_minister: false, role: "member" }));
      await assertSucceeds(updateDoc(D("minnie", "community_posts/n1"), { title: "Still a notice" }));
      await assertFails(updateDoc(D("minnie", "community_posts/g2"), { category: "notice" }));
    });

    it("the author cannot change author_id or created_at, or add fields", async () => {
      await assertFails(updateDoc(D("alice", "community_posts/p1"), { author_id: "bob" }));
      await assertFails(updateDoc(D("alice", "community_posts/p1"), { created_at: serverTimestamp() }));
      await assertFails(updateDoc(D("alice", "community_posts/p1"), { author_name: "Alice" }));
    });

    it("the author cannot save invalid values", async () => {
      await assertFails(updateDoc(D("alice", "community_posts/p1"), { title: "" }));
      await assertFails(updateDoc(D("alice", "community_posts/p1"), { title: longer(201) }));
      await assertFails(updateDoc(D("alice", "community_posts/p1"), { body: longer(10001) }));
      await assertFails(updateDoc(D("alice", "community_posts/p1"), { category: "ads" }));
    });

    it("a signed-out visitor cannot edit", async () => {
      await assertFails(updateDoc(D(null, "community_posts/p1"), { title: "Hacked" }));
    });
  });

  describe("delete", () => {
    it("the author can delete their post", async () => {
      await assertSucceeds(deleteDoc(D("alice", "community_posts/p1")));
      assert.equal(await peek("community_posts/p1"), null);
    });

    it("nobody else can, admins included", async () => {
      await assertFails(deleteDoc(D("bob", "community_posts/p1")));
      await assertFails(deleteDoc(D("minnie", "community_posts/p1")));
      await assertFails(deleteDoc(D("ada", "community_posts/p1")));
      await assertFails(deleteDoc(D(null, "community_posts/p1")));
    });
  });
});

// ---------------------------------------------------------------------------------------
// Query shapes the app uses
// ---------------------------------------------------------------------------------------

describe("query shapes", () => {
  beforeEach(async () => {
    await bypass(async (db) => {
      await updateDoc(doc(db, "profiles/alice"), { verses_typed: 10 });
      await updateDoc(doc(db, "profiles/bob"), { verses_typed: 30 });
      await updateDoc(doc(db, "profiles/minnie"), { verses_typed: 20 });
    });
  });

  it("the leaderboard query works signed out and signed in", async () => {
    for (const uid of [null, "alice"]) {
      const snap = await assertSucceeds(
        getDocs(query(C(uid, "profiles"), orderBy("verses_typed", "desc"), limit(100)))
      );
      assert.deepEqual(
        snap.docs.map((d) => d.id).slice(0, 3),
        ["bob", "minnie", "alice"]
      );
      assert.equal(snap.docs[0].data().verses_typed, 30);
    }
  });

  it("the leaderboard query honours its limit", async () => {
    const snap = await assertSucceeds(getDocs(query(C(null, "profiles"), orderBy("verses_typed", "desc"), limit(2))));
    assert.deepEqual(snap.docs.map((d) => d.id), ["bob", "minnie"]);
  });

  it("fetching profiles by document id with 'in' works signed in and out", async () => {
    for (const uid of [null, "alice"]) {
      const snap = await assertSucceeds(
        getDocs(query(C(uid, "profiles"), where(documentId(), "in", ["alice", "bob", "nobody"])))
      );
      assert.deepEqual(idsOf(snap), ["alice", "bob"]);
    }
  });
});

// ---------------------------------------------------------------------------------------
// Default deny and privilege escalation
// ---------------------------------------------------------------------------------------

describe("everything else is denied", () => {
  const unknown = [
    "secrets/x",
    "leaderboard/alice", // the old view / collection name
    "reading_progress/alice_1_1", // progress now lives under the profile
    "studies/pub/members/alice", // roster is member_ids, not a subcollection
    "profiles/alice/private/x",
    "minister_applications/app1/comments/c1",
    "users/alice",
  ];
  for (const path of unknown) {
    it(`denies reading and writing ${path}`, async () => {
      for (const uid of [null, "alice", "ada"]) {
        await assertFails(getDoc(D(uid, path)));
        await assertFails(setDoc(D(uid, path), { x: 1 }));
      }
    });
  }

  it("denies listing an unknown collection", async () => {
    await assertFails(getDocs(C("ada", "secrets")));
    await assertFails(getDocs(C("ada", "leaderboard")));
  });
});

describe("privilege escalation attempts", () => {
  it("auth token claims do not grant admin or minister powers", async () => {
    const claims = { admin: true, role: "admin", is_minister: true };
    await assertFails(updateDoc(doc(as("alice", claims), "profiles/bob"), { role: "admin" }));
    await assertFails(addDoc(collection(as("alice", claims), "community_posts"), postData({ category: "notice" })));
    await assertFails(
      addDoc(collection(as("alice", claims), "studies"), studyData({ host_id: "alice", member_ids: ["alice"] }))
    );
    await assertFails(getDoc(doc(as("alice", claims), "profiles/bob/reading_progress/1_1")));
  });

  it("a signed-in user without a profile has no admin powers (fails closed)", async () => {
    await assertFails(updateDoc(D("ghost", "profiles/alice"), { role: "admin" }));
    await assertFails(updateDoc(D("ghost", "minister_applications/app1"), { status: "approved", reviewed_by: "ghost", reviewed_at: serverTimestamp() }));
    await assertFails(getDoc(D("ghost", "minister_applications/app1")));
  });

  it("a new user cannot create their profile as an admin and then use it", async () => {
    await assertFails(setDoc(D("newbie", "profiles/newbie"), newProfile({ role: "admin", is_minister: true })));
    await assertFails(updateDoc(D("newbie", "profiles/alice"), { role: "admin" }));
  });

  it("promoting yourself is impossible even when the admin edit shape is used", async () => {
    await assertFails(updateDoc(D("alice", "profiles/alice"), { role: "admin" }));
    await assertFails(updateDoc(D("bob", "profiles/bob"), { is_minister: true, role: "minister" }));
    assert.equal((await peek("profiles/alice")).role, "member");
    assert.equal((await peek("profiles/bob")).is_minister, false);
  });
});
