"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  LuBadgeCheck,
  LuCalendar,
  LuCheck,
  LuCircleAlert,
  LuLock,
  LuPlus,
  LuUser,
  LuUsers,
} from "react-icons/lu";
import { createStudy, getProfiles, joinStudy, listStudies } from "@/lib/firebase/db";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { TRANSLATIONS } from "@/lib/bible/books";
import { useBibleVersion } from "@/lib/bible/version";
import type { Study } from "@/lib/types";
import Loading from "@/components/Loading";
import PageHeader from "@/components/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

interface StudyView extends Study {
  hostName: string;
}

export default function StudiesPage() {
  const { t } = useI18n();
  const { user, profile } = useAuth();

  const [studies, setStudies] = useState<StudyView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const rows = await listStudies(user.id);
      // Hosts are looked up by id, so a renamed host shows under the new name.
      const hosts = await getProfiles(rows.map((s) => s.host_id));
      setStudies(rows.map((s) => ({ ...s, hostName: hosts.get(s.host_id)?.display_name ?? "-" })));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const join = async (studyId: string) => {
    if (!user) return;
    setError(null);
    try {
      await joinStudy(studyId, user.id);
    } catch (e) {
      setError(errorMessage(e, t));
      return;
    }
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("studies.title")}
        description={t("studies.subtitle")}
        actions={
          profile?.is_minister ? (
            !showCreate && (
              <Button onClick={() => setShowCreate(true)}>
                <LuPlus data-icon="inline-start" />
                {t("studies.create")}
              </Button>
            )
          ) : (
            <Link href="/minister" className={cn(buttonVariants({ variant: "outline" }))}>
              <LuBadgeCheck data-icon="inline-start" />
              {t("studies.becomeMinister")}
            </Link>
          )
        }
      />

      {!profile?.is_minister && (
        <Alert>
          <LuLock />
          <AlertDescription>{t("studies.ministerOnly")}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <LuCircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {showCreate && profile?.is_minister && (
        <CreateStudy
          onCancel={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {loading ? (
        <Loading />
      ) : studies.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LuUsers />
            </EmptyMedia>
            <EmptyTitle>{t("studies.empty")}</EmptyTitle>
            <EmptyDescription>{t("studies.emptyHint")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {studies.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle>
                  <Link href={`/studies/${s.id}`} className="underline-offset-4 hover:underline">
                    {s.title}
                  </Link>
                </CardTitle>
                {s.description && <CardDescription className="line-clamp-2">{s.description}</CardDescription>}
                {!s.is_public && (
                  <CardAction>
                    <Badge variant="outline">
                      <LuLock />
                      {t("studies.private")}
                    </Badge>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <LuUser className="size-4" />
                  {t("studies.hostedBy")} <span className="font-medium text-foreground">{s.hostName}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <LuUsers className="size-4" />
                  {s.member_ids.length} {t(s.member_ids.length === 1 ? "studies.member" : "studies.members")}
                </span>
                {s.schedule && (
                  <span className="flex items-center gap-1.5">
                    <LuCalendar className="size-4" />
                    {s.schedule}
                  </span>
                )}
              </CardContent>
              <CardFooter className="mt-auto justify-end">
                {user && s.member_ids.includes(user.id) ? (
                  <Badge variant="secondary">
                    <LuCheck />
                    {t("studies.joined")}
                  </Badge>
                ) : (
                  <Button size="sm" onClick={() => join(s.id)}>
                    {t("studies.join")}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateStudy({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { translation: currentVersion } = useBibleVersion();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [schedule, setSchedule] = useState("");
  const [translation, setTranslation] = useState(currentVersion.id);
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await createStudy(user.id, { title, description, schedule, translation, isPublic });
    } catch (e) {
      setBusy(false);
      setError(errorMessage(e, t));
      return;
    }
    setBusy(false);
    onCreated();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("studies.create")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="study-title">{t("studies.titleField")}</FieldLabel>
              <Input id="study-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="study-description">{t("studies.descField")}</FieldLabel>
              <Textarea
                id="study-description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="study-schedule">{t("studies.scheduleField")}</FieldLabel>
                <Input id="study-schedule" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>{t("read.translation")}</FieldLabel>
                <Select
                  items={TRANSLATIONS.map((tr) => ({ value: tr.id, label: tr.label }))}
                  value={translation}
                  onValueChange={(id) => id && setTranslation(id)}
                >
                  <SelectTrigger aria-label={t("read.translation")} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSLATIONS.map((tr) => (
                      <SelectItem key={tr.id} value={tr.id}>
                        {tr.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field orientation="horizontal">
              <Checkbox id="study-public" checked={isPublic} onCheckedChange={setIsPublic} />
              <FieldLabel htmlFor="study-public" className="font-normal">
                {t("studies.public")}
              </FieldLabel>
            </Field>
            {error && (
              <Alert variant="destructive">
                <LuCircleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onCancel}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Spinner />}
                {t("studies.create")}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
