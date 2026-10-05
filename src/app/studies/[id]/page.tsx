"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LuBadgeCheck, LuCalendar, LuCrown, LuKey, LuLock, LuUsers } from "react-icons/lu";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { Study } from "@/lib/types";
import Loading from "@/components/Loading";
import PageHeader, { BackLink } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface LeaderboardRow {
  id: string;
  display_name: string;
  verses_typed: number;
  chapters_completed: number;
  is_minister: boolean;
}

interface MemberRow {
  user_id: string;
  role: string;
  display_name: string;
  verses_typed: number;
  chapters_completed: number;
  is_minister: boolean;
}

export default function StudyDetailPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const studyId = String(params.id);

  const [study, setStudy] = useState<Study | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: s }, { data: mem }] = await Promise.all([
      supabase.from("studies").select("*").eq("id", studyId).maybeSingle(),
      supabase.from("study_members").select("user_id, role").eq("study_id", studyId),
    ]);
    setStudy((s as Study) ?? null);
    const memRows = (mem as { user_id: string; role: string }[]) ?? [];
    const ids = memRows.map((m) => m.user_id);

    const { data: stats } = await supabase
      .from("leaderboard")
      .select("id, display_name, verses_typed, chapters_completed, is_minister")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const statMap = new Map(((stats as LeaderboardRow[]) ?? []).map((r) => [r.id, r]));

    const rows: MemberRow[] = memRows
      .map((m) => {
        const st = statMap.get(m.user_id);
        return {
          user_id: m.user_id,
          role: m.role,
          display_name: st?.display_name ?? "-",
          verses_typed: st?.verses_typed ?? 0,
          chapters_completed: st?.chapters_completed ?? 0,
          is_minister: st?.is_minister ?? false,
        };
      })
      .sort((a, b) => b.verses_typed - a.verses_typed);
    setMembers(rows);
    setLoading(false);
  }, [supabase, studyId]);

  useEffect(() => {
    load();
  }, [load]);

  const leave = async () => {
    if (!user) return;
    await supabase.from("study_members").delete().eq("study_id", studyId).eq("user_id", user.id);
    router.push("/studies");
  };

  const join = async () => {
    if (!user) return;
    await supabase.from("study_members").insert({ study_id: studyId, user_id: user.id, role: "member" });
    load();
  };

  if (loading) return <Loading />;
  if (!study) return <p className="text-muted-foreground">{t("studies.empty")}</p>;

  const isHost = user?.id === study.host_id;
  const isMember = !!user && members.some((m) => m.user_id === user.id);
  const maxVerses = Math.max(1, ...members.map((m) => m.verses_typed));

  return (
    <div className="space-y-6">
      <PageHeader
        back={<BackLink href="/studies">{t("studies.title")}</BackLink>}
        title={study.title}
        description={study.description || undefined}
        actions={
          study.is_public && user && !isMember ? (
            <Button onClick={join}>{t("studies.join")}</Button>
          ) : isMember && !isHost ? (
            <Button variant="outline" onClick={leave}>
              {t("studies.leave")}
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
        {study.schedule && (
          <span className="flex items-center gap-1.5">
            <LuCalendar className="size-4" />
            {study.schedule}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <LuUsers className="size-4" />
          {members.length} {t(members.length === 1 ? "studies.member" : "studies.members")}
        </span>
        {isHost && (
          <span className="flex items-center gap-1.5">
            <LuKey className="size-4" />
            {t("studies.hostedByYou")}
          </span>
        )}
        {!study.is_public && (
          <Badge variant="outline">
            <LuLock />
            {t("studies.private")}
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("studies.memberProgress")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("leaderboard.name")}</TableHead>
                <TableHead className="text-right">{t("leaderboard.verses")}</TableHead>
                <TableHead className="text-right">{t("leaderboard.chapters")}</TableHead>
                <TableHead className="hidden w-1/3 sm:table-cell">{t("read.overall")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {m.role === "host" && <LuCrown className="size-4 text-muted-foreground" />}
                      {m.display_name}
                      {m.is_minister && (
                        <LuBadgeCheck className="size-4 text-muted-foreground" aria-label={t("common.minister")} />
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{m.verses_typed}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.chapters_completed}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Progress value={(m.verses_typed / maxVerses) * 100} aria-label={m.display_name} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
