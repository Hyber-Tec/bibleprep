"use client";

import { useEffect, useState } from "react";
import { LuBadgeCheck } from "react-icons/lu";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import Loading from "@/components/Loading";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Row {
  id: string;
  display_name: string;
  verses_typed: number;
  chapters_completed: number;
  is_minister: boolean;
}

export default function LeaderboardPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("leaderboard")
      .select("*")
      .order("verses_typed", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setRows((data as Row[]) ?? []);
        setLoading(false);
      });
  }, [supabase]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("leaderboard.title")} description={t("leaderboard.subtitle")} />
      {loading ? (
        <Loading />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">{t("leaderboard.rank")}</TableHead>
                  <TableHead>{t("leaderboard.name")}</TableHead>
                  <TableHead className="text-right">{t("leaderboard.verses")}</TableHead>
                  <TableHead className="text-right">{t("leaderboard.chapters")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  // Standard competition ranking: tied scores share a rank (1, 1, 3, ...).
                  const rank = rows.findIndex((x) => x.verses_typed === r.verses_typed) + 1;
                  const podium = r.verses_typed > 0 && rank <= 3;
                  return (
                    <TableRow key={r.id} data-state={r.id === user?.id ? "selected" : undefined}>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                            podium && rank === 1 && "bg-primary text-primary-foreground",
                            podium && rank > 1 && "bg-secondary text-secondary-foreground ring-1 ring-border",
                            !podium && "text-muted-foreground"
                          )}
                        >
                          {rank}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-1.5">
                          {r.display_name}
                          {r.is_minister && (
                            <LuBadgeCheck className="size-4 text-muted-foreground" aria-label={t("common.minister")} />
                          )}
                          {r.id === user?.id && (
                            <Badge variant="outline" className="bg-background">
                              {t("leaderboard.you")}
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{r.verses_typed}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.chapters_completed}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
