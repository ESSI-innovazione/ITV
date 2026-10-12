import { Suspense, type ReactNode } from "react";
import { Header } from "@/components/app/header";
import { Sidebar, type NavKey } from "@/components/app/sidebar";
import { getCurrentUser } from "@/lib/auth";

type AppShellProps = {
  nav: NavKey;
  area: string;
  profileHref: string;
  children: ReactNode;
};

/**
 * Sofia layout: fixed white sidebar on the left, light-gray content canvas
 * with the header on top. The header's user block reads the session, so it
 * streams in behind Suspense while the shell itself prerenders.
 */
export function AppShell({ nav, area, profileHref, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen">
      {/* usePathname() is runtime data under Cache Components, so the sidebar streams in. */}
      <Suspense fallback={<div className="fixed inset-y-0 left-0 z-20 hidden w-60 bg-sidebar md:block" />}>
        <Sidebar nav={nav} area={area} className="fixed inset-y-0 left-0 z-20 hidden md:flex" />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col md:pl-60">
        <Suspense fallback={<Header title={area} user={null} profileHref={profileHref} />}>
          <HeaderWithUser title={area} profileHref={profileHref} />
        </Suspense>
        <main className="flex-1 px-6 pt-4 pb-16">{children}</main>
      </div>
    </div>
  );
}

async function HeaderWithUser({ title, profileHref }: { title: string; profileHref: string }) {
  const user = await getCurrentUser();
  return <Header title={title} user={user} profileHref={profileHref} />;
}
