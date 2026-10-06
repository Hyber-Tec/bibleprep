"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Loading from "@/components/Loading";

/** Pages that need an account. Anyone else is sent to the log in page. */
const PROTECTED = ["/read", "/studies", "/minister", "/profile", "/community"];

/**
 * Keeps signed-out visitors off the pages that need an account. This is only a convenience:
 * what a visitor can actually read or change is decided by the Firestore rules.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const needsAccount = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const redirecting = needsAccount && !loading && !user;

  useEffect(() => {
    if (redirecting) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [redirecting, router, pathname]);

  if (needsAccount && (loading || !user)) return <Loading />;
  return children;
}
