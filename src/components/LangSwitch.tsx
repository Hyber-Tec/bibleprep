"use client";

import { useI18n, type Locale } from "@/lib/i18n";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export default function LangSwitch() {
  const { t, locale, setLocale } = useI18n();
  return (
    <ToggleGroup
      value={[locale]}
      // Clicking the active language would clear the selection; one language is always on.
      onValueChange={(value) => value[0] && setLocale(value[0] as Locale)}
      variant="outline"
      size="sm"
      spacing={0}
      aria-label={t("nav.language")}
    >
      <ToggleGroupItem value="en" className="px-2.5 text-xs font-semibold">
        EN
      </ToggleGroupItem>
      <ToggleGroupItem value="ko" className="px-2.5 text-xs font-semibold">
        KR
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
