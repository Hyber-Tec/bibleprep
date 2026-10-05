"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n, type Locale } from "@/lib/i18n";
import { TRANSLATIONS, type Translation } from "@/lib/bible/books";

const STORAGE_KEY = "bibleVersions";

const defaultFor = (locale: Locale) => TRANSLATIONS.find((tr) => tr.locale === locale)!.id;
const DEFAULTS: Record<Locale, string> = { en: defaultFor("en"), ko: defaultFor("ko") };

interface VersionValue {
  translation: Translation; // the version read in the current language
  versions: Translation[]; // every version available in the current language
  setVersion: (id: string) => void;
}

const VersionContext = createContext<VersionValue | null>(null);

/** Remembers the chosen Bible version separately for each UI language. */
export function BibleVersionProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [chosen, setChosen] = useState<Record<Locale, string>>(DEFAULTS);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
      const valid = (l: Locale) => TRANSLATIONS.some((tr) => tr.id === stored[l] && tr.locale === l);
      setChosen({ en: valid("en") ? stored.en : DEFAULTS.en, ko: valid("ko") ? stored.ko : DEFAULTS.ko });
    } catch {
      // Unreadable storage: keep the defaults.
    }
  }, []);

  const value = useMemo<VersionValue>(() => {
    const versions = TRANSLATIONS.filter((tr) => tr.locale === locale);
    return {
      translation: versions.find((tr) => tr.id === chosen[locale]) ?? versions[0],
      versions,
      setVersion: (id) => {
        const picked = TRANSLATIONS.find((tr) => tr.id === id);
        if (!picked) return;
        const next = { ...chosen, [picked.locale]: id };
        setChosen(next);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      },
    };
  }, [locale, chosen]);

  return <VersionContext.Provider value={value}>{children}</VersionContext.Provider>;
}

export function useBibleVersion(): VersionValue {
  const ctx = useContext(VersionContext);
  if (!ctx) throw new Error("useBibleVersion must be used within BibleVersionProvider");
  return ctx;
}
