"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaCross } from "react-icons/fa6";
import { LuBadgeCheck, LuLogOut, LuMenu, LuUser } from "react-icons/lu";
import { useI18n, type DictKey } from "@/lib/i18n";
import { reloadTo, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import LangSwitch from "./LangSwitch";

const LINKS: { href: string; key: DictKey }[] = [
  { href: "/read", key: "nav.read" },
  { href: "/studies", key: "nav.studies" },
  { href: "/leaderboard", key: "nav.leaderboard" },
  { href: "/community", key: "nav.community" },
];

/** Up to two initials, e.g. "Pastor Kim" -> "PK", "홍길동" -> "홍". */
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toUpperCase();
}

function Logo({ onClick, alwaysShowName }: { onClick?: () => void; alwaysShowName?: boolean }) {
  const { t } = useI18n();
  return (
    <Link href="/" onClick={onClick} className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <FaCross className="size-3.5" />
      </span>
      <span className={alwaysShowName ? undefined : "hidden sm:inline"}>{t("app.name")}</span>
    </Link>
  );
}

export default function Nav() {
  const { t } = useI18n();
  const { user, profile, signOut } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) => pathname.startsWith(href);
  const name = profile?.display_name ?? t("nav.profile");

  const onSignOut = async () => {
    await signOut();
    reloadTo("/");
  };

  const linkClass = (href: string) =>
    cn(
      "rounded-md px-3 py-1.5 text-sm transition-colors",
      isActive(href) ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
    );

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" className="-ml-2 md:hidden" aria-label={t("nav.menu")} />}
          >
            <LuMenu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader>
              <SheetTitle>
                <Logo onClick={() => setMenuOpen(false)} alwaysShowName />
              </SheetTitle>
            </SheetHeader>
            <nav className="grid gap-1 px-4">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={cn(linkClass(l.href), "py-2")}
                >
                  {t(l.key)}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Logo />

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={linkClass(l.href)}
            >
              {t(l.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LangSwitch />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 gap-2 px-1.5" />}>
                <Avatar className="size-6">
                  <AvatarFallback className="text-[0.65rem] font-medium">{initials(name)}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-36 truncate sm:inline">{name}</span>
                {profile?.is_minister && (
                  <LuBadgeCheck className="hidden text-muted-foreground sm:inline" aria-label={t("common.minister")} />
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="space-y-0.5">
                    <div className="truncate text-sm font-medium text-foreground">{name}</div>
                    <div className="truncate text-xs font-normal">{user.email}</div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLinkItem render={<Link href="/profile" />}>
                  <LuUser />
                  {t("nav.profile")}
                </DropdownMenuLinkItem>
                <DropdownMenuLinkItem render={<Link href="/minister" />}>
                  <LuBadgeCheck />
                  {t("minister.title")}
                </DropdownMenuLinkItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSignOut}>
                  <LuLogOut />
                  {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                {t("nav.login")}
              </Link>
              <Link href="/signup" className={cn(buttonVariants({ size: "sm" }))}>
                {t("nav.signup")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
