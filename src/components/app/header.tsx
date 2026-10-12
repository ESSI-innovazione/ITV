"use client";

import Link from "next/link";
import { Bell, LogOut, Search, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export type HeaderUser = {
  name: string;
  email: string;
  role: "admin" | "author" | "reviewer" | "candidate";
  avatarUrl?: string | null;
};

const roleLabel: Record<HeaderUser["role"], string> = {
  admin: "Amministratore",
  author: "Autore",
  reviewer: "Revisore",
  candidate: "Candidato",
};

type HeaderProps = {
  title: string;
  user: HeaderUser | null;
  /** Where the avatar menu's "Profilo" entry links. */
  profileHref: string;
};

/** Sofia-style top bar: page title, search, notification bell with a pink dot, avatar menu. */
export function Header({ title, user, profileHref }: HeaderProps) {
  const initials = user
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <header className="flex items-center justify-between gap-4 px-6 pt-6 pb-2">
      <h1 className="text-2xl font-semibold">{title}</h1>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Cerca…"
            className="h-10 w-64 rounded-full bg-card pl-9"
          />
        </div>

        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Notifiche">
          <Bell className="size-5" />
          <span className="absolute top-2 right-2 size-1.5 rounded-full bg-pink" />
        </Button>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-3 rounded-full pl-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="size-10">
                <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
                <AvatarFallback className="bg-secondary text-secondary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-left leading-tight lg:block">
                <span className="block text-sm font-medium">{user.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {roleLabel[user.role]}
                </span>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <span className="block text-sm font-medium">{user.name}</span>
                <span className="block text-xs text-muted-foreground">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href={profileHref} />}>
                <UserRound className="size-4" />
                Profilo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/logout" />}>
                <LogOut className="size-4" />
                Esci
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button render={<Link href="/login" />}>Accedi</Button>
        )}
      </div>
    </header>
  );
}
