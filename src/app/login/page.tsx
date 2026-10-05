"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LuCircleAlert } from "react-icons/lu";
import { useI18n } from "@/lib/i18n";
import { reloadTo, safeNextPath, useAuth } from "@/lib/auth";
import { errorMessage, isCancelled } from "@/lib/errors";
import AuthCard from "@/components/AuthCard";
import GoogleButton from "@/components/GoogleButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

function LoginForm() {
  const { t } = useI18n();
  const params = useSearchParams();
  const { user, loading, signIn, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Signed in, just now or already: carry on to where the visitor was headed.
  useEffect(() => {
    if (!loading && user) reloadTo(safeNextPath(params.get("next")));
  }, [loading, user, params]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(errorMessage(err, t));
      setBusy(false);
    }
  };

  // The Google window is its own progress indicator, and Firebase only notices it being closed
  // after several seconds, so the form stays usable: a new click simply replaces the window.
  const onGoogle = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      if (!isCancelled(err)) setError(errorMessage(err, t));
    }
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
          <GoogleButton disabled={busy} onClick={() => void onGoogle()}>
            {t("auth.googleLogin")}
          </GoogleButton>
          <FieldSeparator>{t("auth.or")}</FieldSeparator>
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
