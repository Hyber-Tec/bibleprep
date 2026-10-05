"use client";

import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { BibleVersionProvider } from "@/lib/bible/version";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <BibleVersionProvider>
        <AuthProvider>{children}</AuthProvider>
      </BibleVersionProvider>
    </I18nProvider>
  );
}
