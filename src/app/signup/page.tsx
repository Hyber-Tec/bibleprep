"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LuCircleAlert } from "react-icons/lu";
import { useI18n } from "@/lib/i18n";
import { reloadTo, useAuth } from "@/lib/auth";
import { errorMessage, isCancelled } from "@/lib/errors";
import AuthCard from "@/components/AuthCard";
import GoogleButton from "@/components/GoogleButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export default function SignupPage() {
  const { t } = useI18n();
  const { user, loading, signUp, signInWithGoogle } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Signed up, just now or already: start reading.
  useEffect(() => {
    if (!loading && user) reloadTo("/read");
  }, [loading, user]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signUp(displayName, email, password);
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
          <GoogleButton disabled={busy} onClick={() => void onGoogle()}>
            {t("auth.googleSignup")}
          </GoogleButton>
          <FieldSeparator>{t("auth.or")}</FieldSeparator>
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
          <Button type="submit" disabled={busy} className="w-full">
            {busy && <Spinner />}
            {t("auth.signupTitle")}
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
