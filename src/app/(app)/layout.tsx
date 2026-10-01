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
      <nav className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-3 py-2 sm:px-4">
          <Link href="/today" className="font-semibold text-slate-50 no-underline hover:no-underline">
            Coach Console
          </Link>
          <TopNavLinks />
          <form action={signOut} className="ml-auto">
            <button className="btn btn-sm">Sign out</button>
          </form>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl space-y-4 px-3 pb-24 pt-3 sm:px-4 sm:pt-4 md:pb-6">{children}</main>
      <BottomTabBar />
    </div>
  );
}
