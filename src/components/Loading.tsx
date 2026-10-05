"use client";

import { useI18n } from "@/lib/i18n";
import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
      <Spinner />
      {t("common.loading")}
    </div>
  );
}
