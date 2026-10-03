import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { BottomTabBar, SettingsIconLink, TopNavLinks } from "@/components/app-nav";
import { Logo } from "@/components/logo";
import { Toaster } from "@/components/toaster";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const db = createClient();
  const { data: user } = await db.auth.getUser();
  if (!user.user) redirect("/login");
  const { data: isTrainer } = await db.rpc("claim_trainer");
  if (!isTrainer) {
    await db.auth.signOut();
    redirect("/login");
  }
  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-30 border-b border-fg/15 bg-canvas" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-4 py-3 sm:px-6">
          {/* Monogram in a square frame; padding is one letter height (1 U) of clear space. */}
          <Link href="/today" aria-label="Coach Console home" className="mr-4 flex items-center border border-fg p-2 text-fg no-underline hover:bg-fg/5 hover:no-underline">
            <Logo mark="monogram" className="h-6 w-6" title="Make Time To Move · Coach Console" />
          </Link>
          <TopNavLinks />
          <Link href="/log" className="btn btn-primary btn-sm ml-auto hidden whitespace-nowrap lg:inline-flex">+ Log</Link>
          <SettingsIconLink />
          <form action={signOut}>
            <button className="btn btn-sm whitespace-nowrap">Sign out</button>
          </form>
        </div>
      </nav>
      <main className="mx-auto max-w-[1200px] space-y-6 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:pb-12">{children}</main>
      <BottomTabBar />
      <Toaster />
    </div>
  );
}
