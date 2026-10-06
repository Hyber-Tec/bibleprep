"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Locale = "en" | "ko";

// ---------------------------------------------------------------------------
// Dictionary. Add keys here; both languages must define each key.
// ---------------------------------------------------------------------------
const DICT = {
  "app.name": { en: "Typing Bible", ko: "성경타자통독" },
  "app.tagline": {
    en: "Read the whole Bible by typing it — together.",
    ko: "성경을 타이핑하며 통독하는 신앙 공동체",
  },
  "app.subtitle": {
    en: "Type through Scripture verse by verse, keep one progress across English and Korean, and grow together in bible studies.",
    ko: "한 절씩 타이핑하며 성경을 통독하고, 영어와 한국어 진도를 하나로 관리하며, 성경공부 모임에서 함께 성장하세요.",
  },

  "nav.home": { en: "Home", ko: "홈" },
  "nav.read": { en: "Type Bible", ko: "성경타자" },
  "nav.studies": { en: "Bible Studies", ko: "성경공부" },
  "nav.leaderboard": { en: "Ranking", ko: "통독순위" },
  "nav.community": { en: "Community", ko: "커뮤니티" },
  "nav.minister": { en: "Minister", ko: "사역자 인증" },
  "nav.login": { en: "Log in", ko: "로그인" },
  "nav.logout": { en: "Log out", ko: "로그아웃" },
  "nav.signup": { en: "Sign up", ko: "회원가입" },
  "nav.profile": { en: "My Page", ko: "마이페이지" },
  "nav.menu": { en: "Menu", ko: "메뉴" },
  "nav.language": { en: "Language", ko: "언어" },

  "auth.email": { en: "Email", ko: "이메일" },
  "auth.password": { en: "Password", ko: "비밀번호" },
  "auth.displayName": { en: "Display name", ko: "이름" },
  "auth.loginTitle": { en: "Log in", ko: "로그인" },
  "auth.signupTitle": { en: "Create account", ko: "회원가입" },
  "auth.noAccount": { en: "No account yet?", ko: "계정이 없으신가요?" },
  "auth.hasAccount": { en: "Already have an account?", ko: "이미 계정이 있으신가요?" },
  "auth.loginSubtitle": {
    en: "Welcome back. Pick up where you left off.",
    ko: "다시 오신 것을 환영합니다. 이어서 통독하세요.",
  },
  "auth.signupSubtitle": {
    en: "Read the whole Bible by typing it, one verse at a time.",
    ko: "한 절씩 타이핑하며 성경 전체를 통독하세요.",
  },
  "auth.passwordHint": { en: "At least 6 characters.", ko: "6자 이상 입력하세요." },
  "auth.or": { en: "or", ko: "또는" },
  "auth.googleLogin": { en: "Log in with Google", ko: "Google로 로그인" },
  "auth.googleSignup": { en: "Sign up with Google", ko: "Google로 회원가입" },
  "auth.errInvalidCredential": {
    en: "Incorrect email or password.",
    ko: "이메일 또는 비밀번호가 올바르지 않습니다.",
  },
  "auth.errInvalidEmail": { en: "Enter a valid email address.", ko: "올바른 이메일 주소를 입력해 주세요." },
  "auth.errEmailInUse": {
    en: "An account with this email already exists. Try logging in.",
    ko: "이미 가입된 이메일입니다. 로그인해 주세요.",
  },
  "auth.errWeakPassword": {
    en: "Choose a password with at least 6 characters.",
    ko: "비밀번호는 6자 이상이어야 합니다.",
  },
  "auth.errUserDisabled": { en: "This account has been disabled.", ko: "사용이 중지된 계정입니다." },
  "auth.errTooManyRequests": {
    en: "Too many attempts. Wait a moment and try again.",
    ko: "시도 횟수가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  },
  "auth.errPopupBlocked": {
    en: "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.",
    ko: "브라우저가 Google 로그인 창을 차단했습니다. 이 사이트의 팝업을 허용한 후 다시 시도해 주세요.",
  },
  "auth.errAccountExists": {
    en: "This email is already registered with a different sign-in method. Log in with that method instead.",
    ko: "이미 다른 로그인 방법으로 가입된 이메일입니다. 해당 방법으로 로그인해 주세요.",
  },
  "auth.errUnavailable": {
    en: "Signing in isn't available right now. Please try again later.",
    ko: "지금은 로그인할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  },

  "read.title": { en: "My Reading Progress", ko: "나의 성경통독 현황표" },
  "read.translation": { en: "Translation", ko: "역본" },
  "read.overall": { en: "Overall progress", ko: "전체 달성" },
  "read.ot": { en: "Old Testament", ko: "구약성경" },
  "read.nt": { en: "New Testament", ko: "신약성경" },
  "read.done": { en: "Completed", ko: "통독완료" },
  "read.todo": { en: "Not started", ko: "통독전" },
  "read.partial": { en: "In progress", ko: "통독중" },
  "read.chaptersDone": { en: "chapters done", ko: "장 완료" },
  "read.verseTyped": { en: "verse typed", ko: "절 타자" },
  "read.versesTyped": { en: "verses typed", ko: "절 타자" },
  "read.startTyping": { en: "Start typing", ko: "통독 시작" },
  "read.chapters": { en: "chapters", ko: "장" },
  "read.verse": { en: "Verse", ko: "절" },
  "read.saved": { en: "Progress saved", ko: "저장되었습니다" },
  "read.autoSave": {
    en: "Each verse is saved as soon as you finish it.",
    ko: "절을 마칠 때마다 자동으로 저장됩니다.",
  },
  "read.next": { en: "Next chapter", ko: "다음 장" },
  "read.prev": { en: "Previous", ko: "이전" },
  "read.chapterComplete": { en: "Chapter complete!", ko: "이 장을 모두 통독했습니다!" },
  "read.typeHere": { en: "Type the verse above…", ko: "위 구절을 따라 입력하세요…" },
  "read.accuracy": { en: "Accuracy", ko: "정확도" },
  "read.nextVerse": { en: "Next verse", ko: "다음 절" },
  "read.typeThisVerse": { en: "Type this verse", ko: "이 절 입력하기" },
  "read.copyVerse": { en: "Copy verse", ko: "절 복사하기" },
  "read.copied": { en: "Copied to clipboard", ko: "클립보드에 복사했습니다" },
  "read.chapterCompleteHint": {
    en: "Every verse of this chapter is typed.",
    ko: "이 장의 모든 절을 입력했습니다.",
  },
  "read.noText": {
    en: "Text for this chapter isn't loaded yet. See README to import the full Bible.",
    ko: "이 장의 본문이 아직 없습니다. 전체 성경 가져오기는 README를 참고하세요.",
  },

  "studies.title": { en: "Bible Studies", ko: "성경공부 모임" },
  "studies.subtitle": {
    en: "Join a group and follow each other's reading progress.",
    ko: "모임에 참여하고 서로의 통독 현황을 함께 확인하세요.",
  },
  "studies.create": { en: "Host a study", ko: "모임 개설" },
  "studies.join": { en: "Join", ko: "참여하기" },
  "studies.joined": { en: "Joined", ko: "참여중" },
  "studies.member": { en: "member", ko: "명 참여" },
  "studies.members": { en: "members", ko: "명 참여" },
  "studies.hostedBy": { en: "Hosted by", ko: "인도자" },
  "studies.hostedByYou": { en: "Hosted by you", ko: "내가 인도하는 모임" },
  "studies.leave": { en: "Leave", ko: "나가기" },
  "studies.private": { en: "Private", ko: "비공개" },
  "studies.ministerOnly": {
    en: "Only verified ministers can host studies.",
    ko: "인증된 사역자만 모임을 개설할 수 있습니다.",
  },
  "studies.becomeMinister": { en: "Apply for verification", ko: "사역자 인증 신청" },
  "studies.titleField": { en: "Study title", ko: "모임 이름" },
  "studies.descField": { en: "Description", ko: "소개" },
  "studies.scheduleField": { en: "Schedule (e.g. Wed 7pm)", ko: "일정 (예: 수요일 저녁 7시)" },
  "studies.public": { en: "Public (anyone can join)", ko: "공개 (누구나 참여 가능)" },
  "studies.memberProgress": { en: "Member progress", ko: "구성원 통독 현황" },
  "studies.empty": { en: "No studies yet.", ko: "아직 개설된 모임이 없습니다." },
  "studies.emptyHint": {
    en: "When a verified minister hosts a study, it will appear here.",
    ko: "인증된 사역자가 모임을 개설하면 이곳에 표시됩니다.",
  },

  "minister.title": { en: "Minister Verification", ko: "사역자 인증" },
  "minister.intro": {
    en: "Hosting a bible study requires verified minister status. Submit your details for review.",
    ko: "성경공부 모임을 인도하려면 사역자 인증이 필요합니다. 아래 정보를 제출해 주세요.",
  },
  "minister.church": { en: "Church / organization", ko: "교회 / 소속" },
  "minister.denomination": { en: "Denomination", ko: "교단" },
  "minister.roleTitle": { en: "Your role (e.g. Pastor)", ko: "직분 (예: 목사, 전도사)" },
  "minister.credential": { en: "Credential link (ordination, church site)", ko: "증빙 링크 (안수증, 교회 홈페이지)" },
  "minister.note": { en: "Anything else for the reviewer", ko: "심사자에게 전할 내용" },
  "minister.submit": { en: "Submit application", ko: "인증 신청" },
  "minister.pending": { en: "Your application is under review.", ko: "인증 심사 중입니다." },
  "minister.approved": { en: "You are a verified minister.", ko: "인증된 사역자입니다." },
  "minister.rejected": { en: "Your last application was not approved.", ko: "이전 신청이 승인되지 않았습니다." },

  "leaderboard.title": { en: "Typing Ranking", ko: "성경타자 통독순위" },
  "leaderboard.subtitle": {
    en: "Ranked by verses typed, in any translation.",
    ko: "역본과 상관없이 통독한 절수로 순위를 매깁니다.",
  },
  "leaderboard.you": { en: "You", ko: "나" },
  "leaderboard.rank": { en: "Rank", ko: "순위" },
  "leaderboard.name": { en: "Name", ko: "이름" },
  "leaderboard.verses": { en: "Verses typed", ko: "통독 절수" },
  "leaderboard.chapters": { en: "Chapters", ko: "장" },

  "community.title": { en: "Community", ko: "커뮤니티" },
  "community.subtitle": {
    en: "Share notices, questions and testimonies.",
    ko: "공지와 질문, 간증을 함께 나누세요.",
  },
  "community.category": { en: "Category", ko: "분류" },
  "community.new": { en: "New post", ko: "글쓰기" },
  "community.notice": { en: "Notice", ko: "공지사항" },
  "community.qna": { en: "Q&A", ko: "문의게시판" },
  "community.testimony": { en: "Testimony", ko: "간증" },
  "community.general": { en: "General", ko: "자유" },
  "community.postTitle": { en: "Title", ko: "제목" },
  "community.postBody": { en: "Body", ko: "내용" },
  "community.post": { en: "Post", ko: "등록" },
  "community.empty": { en: "No posts yet.", ko: "게시글이 없습니다." },
  "community.emptyHint": { en: "Be the first to share something.", ko: "첫 글을 남겨 보세요." },

  "profile.chaptersCompleted": { en: "Chapters completed", ko: "완료한 장" },

  "common.save": { en: "Save", ko: "저장" },
  "common.saved": { en: "Saved", ko: "저장되었습니다" },
  "common.cancel": { en: "Cancel", ko: "취소" },
  "common.loading": { en: "Loading…", ko: "불러오는 중…" },
  "common.back": { en: "Back", ko: "뒤로" },
  "common.minister": { en: "Verified minister", ko: "인증 사역자" },
  "common.networkError": {
    en: "Can't reach the server. Check your internet connection and try again.",
    ko: "서버에 연결할 수 없습니다. 인터넷 연결을 확인한 후 다시 시도해 주세요.",
  },
  "common.permissionDenied": {
    en: "You don't have permission to do that.",
    ko: "이 작업을 수행할 권한이 없습니다.",
  },
  "common.error": { en: "Something went wrong. Please try again.", ko: "문제가 발생했습니다. 다시 시도해 주세요." },
} as const;

export type DictKey = keyof typeof DICT;

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: DictKey) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  children,
  initialLocale = "en",
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const stored = window.localStorage.getItem("locale") as Locale | null;
    if (stored === "en" || stored === "ko") setLocaleState(stored);
  }, []);

  // Keep <html lang> in sync (screen readers, :lang(ko) styles), including a locale restored on load.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem("locale", l);
  };

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: (key) => DICT[key]?.[locale] ?? key,
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
