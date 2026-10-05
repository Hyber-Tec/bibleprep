"use client";

import { useState } from "react";
import Link from "next/link";
import { LuCircleAlert, LuMailCheck } from "react-icons/lu";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { reloadTo } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import AuthCard from "@/components/AuthCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export default function SignupPage() {
  const { t } = useI18n();
  const supabase = createClient();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) {
      setError(errorMessage(error, t));
      setBusy(false);
      return;
    }
    // If email confirmation is OFF, a session is returned immediately.
    if (data.session) {
      reloadTo("/read");
    } else {
      setInfo(t("auth.checkEmail"));
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title={t("auth.signupTitle")}
      description={t("auth.signupSubtitle")}
      footer={
        <>
          {t("auth.hasAccount")}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            {t("nav.login")}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="display-name">{t("auth.displayName")}</FieldLabel>
            <Input
              id="display-name"
              required
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">{t("auth.email")}</FieldLabel>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">{t("auth.password")}</FieldLabel>
            <Input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FieldDescription>{t("auth.passwordHint")}</FieldDescription>
          </Field>
          {error && (
            <Alert variant="destructive">
              <LuCircleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {info && (
            <Alert>
              <LuMailCheck />
              <AlertDescription>{info}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={busy} className="w-full">
            {busy && <Spinner />}
            {t("auth.signupTitle")}
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
