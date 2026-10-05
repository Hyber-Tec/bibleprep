"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LuCircleAlert } from "react-icons/lu";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { reloadTo, safeNextPath } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import AuthCard from "@/components/AuthCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

function LoginForm() {
  const { t } = useI18n();
  const params = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(errorMessage(error, t));
      setBusy(false);
      return;
    }
    reloadTo(safeNextPath(params.get("next")));
  };

  return (
    <AuthCard
      title={t("auth.loginTitle")}
      description={t("auth.loginSubtitle")}
      footer={
        <>
          {t("auth.noAccount")}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            {t("nav.signup")}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        <FieldGroup>
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && (
            <Alert variant="destructive">
              <LuCircleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={busy} className="w-full">
            {busy && <Spinner />}
            {t("auth.loginTitle")}
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
