"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LuArrowRight, LuBadgeCheck, LuCheck } from "react-icons/lu";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { aggregate, type ProgressRow } from "@/lib/progress";
import Loading from "@/components/Loading";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function ProfilePage() {
  const { t } = useI18n();
  const { user, profile, refreshProfile } = useAuth();
  const supabase = createClient();

  const [displayName, setDisplayName] = useState("");
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState({ verses: 0, chapters: 0 });

  useEffect(() => {
    if (profile) setDisplayName(profile.display_name);
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    supabase
      .from("reading_progress")
      .select("book_id, chapter, completed, verses_typed")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!alive) return;
        const agg = aggregate((data as ProgressRow[]) ?? []);
        setStats({ verses: agg.versesTyped, chapters: agg.chaptersDone });
      });
    return () => {
      alive = false;
    };
  }, [user, supabase]);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
    await refreshProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  if (!profile) return <Loading />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t("nav.profile")} description={user?.email} />

      <div className="grid grid-cols-2 gap-4">
        <Stat label={t("leaderboard.verses")} value={stats.verses} testId="stat-verses" />
        <Stat label={t("profile.chaptersCompleted")} value={stats.chapters} testId="stat-chapters" />
      </div>

      <Card>
        <CardContent>
          <form onSubmit={saveName}>
            <Field>
              <FieldLabel htmlFor="display-name">{t("auth.displayName")}</FieldLabel>
              <div className="flex gap-2">
                <Input id="display-name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                <Button type="submit" className="min-w-20">
                  {saved ? (
                    <>
                      <LuCheck data-icon="inline-start" />
                      {t("common.saved")}
                    </>
                  ) : (
                    t("common.save")
                  )}
                </Button>
              </div>
            </Field>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("minister.title")}</CardTitle>
          <CardDescription>{profile.is_minister ? t("minister.approved") : t("studies.ministerOnly")}</CardDescription>
          <CardAction>
            {profile.is_minister ? (
              <Badge variant="secondary">
                <LuBadgeCheck />
                {t("common.minister")}
              </Badge>
            ) : (
              <Link href="/minister" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                {t("studies.becomeMinister")}
                <LuArrowRight data-icon="inline-end" />
              </Link>
            )}
          </CardAction>
        </CardHeader>
      </Card>
    </div>
  );
}

function Stat({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle data-testid={testId} className="text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
