import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

const NAV = [
  { href: "/today", label: "Today" },
  { href: "/clients", label: "Clients" },
  { href: "/progress", label: "Progress" },
  { href: "/entry", label: "Weekly round" },
  { href: "/settings", label: "Settings" },
];

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
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2">
          <Link href="/today" className="font-semibold text-slate-900 no-underline">
            Coach Console
          </Link>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm text-slate-700">
              {n.label}
            </Link>
          ))}
          <form action={signOut} className="ml-auto">
            <button className="btn btn-sm">Sign out</button>
          </form>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl space-y-4 p-4">{children}</main>
    </div>
  );
}
