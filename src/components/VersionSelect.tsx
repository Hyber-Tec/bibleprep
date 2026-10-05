"use client";

import { LuBookOpen } from "react-icons/lu";
import { useI18n } from "@/lib/i18n";
import { useBibleVersion } from "@/lib/bible/version";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Picks the Bible version for the current language; a static label when there is only one. */
export default function VersionSelect() {
  const { t } = useI18n();
  const { translation, versions, setVersion } = useBibleVersion();

  if (versions.length === 1) {
    return (
      <div
        aria-label={t("read.translation")}
        className="flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm"
      >
        <LuBookOpen className="size-4 text-muted-foreground" />
        {translation.label}
      </div>
    );
  }

  return (
    <Select
      items={versions.map((tr) => ({ value: tr.id, label: tr.label }))}
      value={translation.id}
      onValueChange={(id) => id && setVersion(id)}
    >
      <SelectTrigger aria-label={t("read.translation")}>
        <LuBookOpen className="text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {versions.map((tr) => (
          <SelectItem key={tr.id} value={tr.id}>
            {tr.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
