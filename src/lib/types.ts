// Shapes of the Firestore documents (see firestore.rules and README.md). Timestamps are
// converted to ISO strings when a document is read.

export interface Profile {
  id: string;
  display_name: string;
  locale: "en" | "ko";
  role: "member" | "minister" | "admin";
  is_minister: boolean;
  /** Leaderboard totals, kept in step with reading_progress by the client. */
  verses_typed: number;
  chapters_completed: number;
  created_at: string;
}

export interface Study {
  id: string;
  host_id: string;
  title: string;
  description: string;
  translation: string;
  schedule: string;
  is_public: boolean;
  join_code: string;
  /** Every member, including the host. */
  member_ids: string[];
  created_at: string;
}

export interface MinisterApplication {
  id: string;
  user_id: string;
  church_name: string;
  denomination: string;
  role_title: string;
  credential_url: string;
  note: string;
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
