"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { learnNav, studioNav } from "@/lib/nav";

export type NavKey = "studio" | "learn";

const navs = { studio: studioNav, learn: learnNav } as const;

type SidebarProps = {
  /** Which nav config to render. Resolved here because icon components can't cross the server→client boundary. */
  nav: NavKey;
  /** Small caption under the logo, e.g. "Studio" or "Area candidato". */
  area: string;
  className?: string;
};

/**
 * Sofia-style sidebar: white, 240px, logo + uppercase title, muted uppercase
 * group titles, active item in violet with a light-violet pill background.
 */
export function Sidebar({ nav, area, className }: SidebarProps) {
  const pathname = usePathname();
  const groups = navs[nav];

  return (
    <nav
      className={cn(
        "flex h-full w-60 shrink-0 flex-col bg-sidebar px-4 pt-4 text-sidebar-foreground",
        className,
      )}
    >
      <Link href="/" className="mb-6 flex items-center gap-3 px-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCap className="size-5" />
        </span>
        <span className="leading-tight">
          <span className="block text-base font-bold uppercase tracking-wide">
            ITV Academy
          </span>
          <span className="block text-xs text-muted-foreground">{area}</span>
        </span>
      </Link>

      <ul className="flex-1 space-y-1 overflow-y-auto pb-4">
        {groups.map((group, gi) => (
          <li key={gi}>
            {group.title && (
              <h5 className="mt-7 mb-2 px-3 text-xs font-normal uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h5>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-muted hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="rounded-full bg-pink px-2 py-0.5 text-[11px] font-semibold text-white">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
