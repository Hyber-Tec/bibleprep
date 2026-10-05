"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import type { IconType } from "react-icons";
import {
  LuCircleAlert,
  LuHeart,
  LuMegaphone,
  LuMessageCircleQuestion,
  LuMessageSquare,
  LuMessagesSquare,
  LuSquarePen,
} from "react-icons/lu";
import { createPost, getProfiles, listPosts } from "@/lib/firebase/db";
import { useAuth } from "@/lib/auth";
import { useI18n, type DictKey } from "@/lib/i18n";
import { errorMessage } from "@/lib/errors";
import type { CommunityPost } from "@/lib/types";
import Loading from "@/components/Loading";
import PageHeader from "@/components/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

const CATEGORIES: { id: CommunityPost["category"]; key: DictKey; icon: IconType }[] = [
  { id: "notice", key: "community.notice", icon: LuMegaphone },
  { id: "qna", key: "community.qna", icon: LuMessageCircleQuestion },
  { id: "testimony", key: "community.testimony", icon: LuHeart },
  { id: "general", key: "community.general", icon: LuMessageSquare },
];

export default function CommunityPage() {
  const { t, locale } = useI18n();
  const { user, profile } = useAuth();

  const [posts, setPosts] = useState<(CommunityPost & { author: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listPosts();
      // Authors are looked up by id, so a renamed author shows under the new name.
      const authors = await getProfiles(rows.map((p) => p.author_id));
      setPosts(rows.map((p) => ({ ...p, author: authors.get(p.author_id)?.display_name ?? "-" })));
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("community.title")}
        description={t("community.subtitle")}
        actions={
          user &&
          !showForm && (
            <Button onClick={() => setShowForm(true)}>
              <LuSquarePen data-icon="inline-start" />
              {t("community.new")}
            </Button>
          )
        }
      />

      {showForm && user && (
        <PostForm
          canNotice={!!profile?.is_minister || profile?.role === "admin"}
          onCancel={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {loading ? (
        <Loading />
      ) : posts.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LuMessagesSquare />
            </EmptyMedia>
            <EmptyTitle>{t("community.empty")}</EmptyTitle>
            <EmptyDescription>{t("community.emptyHint")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card>
          <CardContent className="space-y-0">
            {posts.map((p, i) => (
              <Fragment key={p.id}>
                {i > 0 && <Separator className="my-4" />}
                <article className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <CategoryBadge category={p.category} />
                    <h3 className="font-medium">{p.title}</h3>
                  </div>
                  {p.body && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{p.body}</p>}
                  <p className="text-xs text-muted-foreground">
                    {p.author} · {formatDate(p.created_at)}
                  </p>
                </article>
              </Fragment>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CategoryBadge({ category }: { category: CommunityPost["category"] }) {
  const { t } = useI18n();
  const c = CATEGORIES.find((x) => x.id === category)!;
  return (
    <Badge variant={category === "notice" ? "default" : "outline"}>
      <c.icon />
      {t(c.key)}
    </Badge>
  );
}

function PostForm({
  canNotice,
  onCreated,
  onCancel,
}: {
  canNotice: boolean;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [category, setCategory] = useState<CommunityPost["category"]>("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await createPost(user.id, { category, title, body });
    } catch (e) {
      setBusy(false);
      setError(errorMessage(e, t));
      return;
    }
    setBusy(false);
    onCreated();
  };

  const available = canNotice ? CATEGORIES : CATEGORIES.filter((c) => c.id !== "notice");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("community.new")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
              <Field>
                <FieldLabel>{t("community.category")}</FieldLabel>
                <Select
                  items={available.map((c) => ({ value: c.id, label: t(c.key) }))}
                  value={category}
                  onValueChange={(id) => id && setCategory(id as CommunityPost["category"])}
                >
                  <SelectTrigger aria-label={t("community.category")} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {t(c.key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="post-title">{t("community.postTitle")}</FieldLabel>
                <Input id="post-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="post-body">{t("community.postBody")}</FieldLabel>
              <Textarea id="post-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
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
                {t("community.post")}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
