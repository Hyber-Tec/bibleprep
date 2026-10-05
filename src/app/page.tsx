"use client";

import Link from "next/link";
import type { IconType } from "react-icons";
import { LuArrowRight, LuKeyboard, LuMessagesSquare, LuTrophy, LuUsers } from "react-icons/lu";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// John 3:16 for the typing preview (WEB / 개역한글, both public domain).
const PREVIEW = {
  en: {
    reference: "John 3:16",
    text: "For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.",
  },
  ko: {
    reference: "요한복음 3:16",
    text: "하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 저를 믿는 자마다 멸망치 않고 영생을 얻게 하려 하심이니라",
  },
};

export default function HomePage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const preview = PREVIEW[locale];
  const typedLength = Math.round(preview.text.length * 0.45);

  const features: { href: string; icon: IconType; title: string; desc: string }[] = [
    {
      href: "/read",
      icon: LuKeyboard,
      title: t("nav.read"),
      desc:
        locale === "ko"
          ? "성경을 한 절씩 타이핑하며 통독하고 진도를 저장하세요."
          : "Type through the Bible verse by verse and save your progress.",
    },
    {
      href: "/studies",
      icon: LuUsers,
      title: t("nav.studies"),
      desc:
        locale === "ko"
          ? "인증 사역자가 모임을 개설하고 구성원의 통독 현황을 관리합니다."
          : "Verified ministers host studies and track members' progress.",
    },
    {
      href: "/leaderboard",
      icon: LuTrophy,
      title: t("nav.leaderboard"),
      desc:
        locale === "ko"
          ? "통독 절수로 순위를 확인하며 서로 격려하세요."
          : "See rankings by verses typed and encourage one another.",
    },
    {
      href: "/community",
      icon: LuMessagesSquare,
      title: t("nav.community"),
      desc:
        locale === "ko"
          ? "공지, 간증, 질문을 나누는 신앙 공동체 게시판."
          : "A community board for notices, testimonies, and questions.",
    },
  ];

  return (
    <div className="space-y-16 pb-8 pt-4 sm:pt-12">
      <section className="mx-auto max-w-3xl space-y-6 text-center">
        <Badge variant="outline">Typing Bible · 성경타자통독</Badge>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{t("app.tagline")}</h1>
        <p className="mx-auto max-w-2xl text-lg text-balance text-muted-foreground">{t("app.subtitle")}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href={user ? "/read" : "/signup"} className={cn(buttonVariants({ size: "lg" }))}>
            {user ? t("read.startTyping") : t("nav.signup")}
            <LuArrowRight data-icon="inline-end" />
          </Link>
          <Link href="/studies" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            {t("nav.studies")}
          </Link>
        </div>
      </section>

      <Card className="mx-auto max-w-2xl" aria-hidden>
        <CardHeader>
          <CardDescription>{preview.reference}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="font-serif text-xl leading-relaxed">
            <span>{preview.text.slice(0, typedLength)}</span>
            <span className="border-l-2 border-foreground" />
            <span className="text-muted-foreground/60">{preview.text.slice(typedLength)}</span>
          </p>
          <Progress value={45} />
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <Link key={f.href} href={f.href} className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Card className="h-full transition-colors group-hover:bg-muted/50">
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                  <f.icon className="size-4" />
                </div>
                <CardTitle>{f.title}</CardTitle>
                <CardDescription>{f.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
