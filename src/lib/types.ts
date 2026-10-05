export interface Profile {
  id: string;
  display_name: string;
  locale: "en" | "ko";
  role: "member" | "minister" | "admin";
  is_minister: boolean;
  created_at: string;
}

/** Verses typed in one chapter, shared by every translation (matched by verse number). */
export interface ReadingProgressRow {
  id: string;
  user_id: string;
  book_id: number;
  chapter: number;
  typed_verses: number[];
  verses_typed: number;
  completed: boolean;
  updated_at: string;
}

export interface Study {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  translation: string;
  schedule: string | null;
  is_public: boolean;
  join_code: string;
  created_at: string;
}

export interface MinisterApplication {
  id: string;
  user_id: string;
  church_name: string;
  denomination: string | null;
  role_title: string | null;
  credential_url: string | null;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface CommunityPost {
  id: string;
  author_id: string;
  category: "notice" | "qna" | "testimony" | "general";
  title: string;
  body: string;
  created_at: string;
}
