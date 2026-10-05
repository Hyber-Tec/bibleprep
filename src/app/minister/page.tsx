"use client";

import { useEffect, useState } from "react";
import { LuBadgeCheck, LuCircleAlert, LuCircleX, LuHourglass } from "react-icons/lu";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/errors";
import type { MinisterApplication } from "@/lib/types";
import Loading from "@/components/Loading";
import PageHeader from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

export default function MinisterPage() {
  const { t } = useI18n();
  const { user, profile, refreshProfile } = useAuth();
  const supabase = createClient();

  const [app, setApp] = useState<MinisterApplication | null>(null);
  const [loading, setLoading] = useState(true);

  const [church, setChurch] = useState("");
  const [denomination, setDenomination] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [credential, setCredential] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("minister_applications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setApp((data as MinisterApplication) ?? null);
        setLoading(false);
      });
  }, [user, supabase]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    const { data, error, status } = await supabase
      .from("minister_applications")
      .insert({
        user_id: user.id,
        church_name: church,
        denomination,
        role_title: roleTitle,
        credential_url: credential,
        note,
      })
      .select()
      .single();
    setBusy(false);
    if (error) {
      setError(errorMessage(error, t, status));
      return;
    }
    setApp(data as MinisterApplication);
    await refreshProfile();
  };

  if (loading) return <Loading />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t("minister.title")} description={t("minister.intro")} />

      {profile?.is_minister ? (
        <Alert>
          <LuBadgeCheck />
          <AlertTitle>{t("minister.approved")}</AlertTitle>
        </Alert>
      ) : app?.status === "pending" ? (
        <Alert>
          <LuHourglass />
          <AlertTitle>{t("minister.pending")}</AlertTitle>
        </Alert>
      ) : (
        <>
          {app?.status === "rejected" && (
            <Alert variant="destructive">
              <LuCircleX />
              <AlertTitle>{t("minister.rejected")}</AlertTitle>
            </Alert>
          )}
          <Card>
            <CardContent>
              <form onSubmit={submit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="church">{t("minister.church")}</FieldLabel>
                    <Input id="church" required value={church} onChange={(e) => setChurch(e.target.value)} />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="denomination">{t("minister.denomination")}</FieldLabel>
                      <Input
                        id="denomination"
                        value={denomination}
                        onChange={(e) => setDenomination(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="role-title">{t("minister.roleTitle")}</FieldLabel>
                      <Input id="role-title" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="credential">{t("minister.credential")}</FieldLabel>
                    <Input id="credential" value={credential} onChange={(e) => setCredential(e.target.value)} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="note">{t("minister.note")}</FieldLabel>
                    <Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
                  </Field>
                  {error && (
                    <Alert variant="destructive">
                      <LuCircleAlert />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex justify-end">
                    <Button type="submit" disabled={busy}>
                      {busy && <Spinner />}
                      {t("minister.submit")}
                    </Button>
                  </div>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
