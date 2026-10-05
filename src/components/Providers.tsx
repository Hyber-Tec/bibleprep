"use client";

import { useEffect, type ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { BibleVersionProvider } from "@/lib/bible/version";
import { initAnalytics } from "@/lib/firebase/client";

export default function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    initAnalytics().catch(() => {
      // Analytics is optional: a blocked or unsupported environment must not affect the app.
    });
  }, []);

  return (
    <I18nProvider>
      <BibleVersionProvider>
        <AuthProvider>{children}</AuthProvider>
      </BibleVersionProvider>
    </I18nProvider>
  );
}
