import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { BottomTabBar, TopNavLinks } from "@/components/app-nav";

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
          <Link href="/today" className="display mr-2 text-[11px] text-bone no-underline hover:no-underline">
            Coach Console
          </Link>
          <TopNavLinks />
          <form action={signOut} className="ml-auto">
            <button className="btn btn-sm">Sign out</button>
          </form>
        </div>
      </nav>
      <main className="mx-auto max-w-[1200px] space-y-6 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pb-12">{children}</main>
      <BottomTabBar />
    </div>
  );
}
