import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { BottomTabBar, TopNavLinks } from "@/components/app-nav";
import { Logo } from "@/components/logo";

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
      <nav className="sticky top-0 z-30 border-b border-bone/15 bg-ink" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/today" aria-label="Coach Console home" className="mr-2 flex items-center gap-3 text-bone no-underline hover:no-underline">
            <Logo mark="single-line" className="hidden h-auto w-[240px] lg:block" />
            <Logo mark="monogram" className="h-8 w-8 lg:hidden" />
            <span className="display whitespace-nowrap border-l border-bone/20 pl-3 text-[9px] text-stone lg:hidden">Coach Console</span>
          </Link>
          <TopNavLinks />
          <form action={signOut} className="ml-auto">
            <button className="btn btn-sm whitespace-nowrap">Sign out</button>
          </form>
        </div>
      </nav>
      <main className="mx-auto max-w-[1200px] space-y-6 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:pb-12">{children}</main>
      <BottomTabBar />
    </div>
  );
}
