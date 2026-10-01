"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(_prev: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const db = createClient();
  const { error } = await db.auth.signInWithPassword({ email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") });
  if (error) return { error: "Sign-in failed. Check your email and password." };
  // First sign-in on a fresh install claims the trainer account.
  const { data: owner } = await db.rpc("claim_trainer");
  if (!owner) {
    await db.auth.signOut();
    return { error: "This account is not the trainer account." };
  }
  redirect("/today");
}

export async function signOut() {
  const db = createClient();
  await db.auth.signOut();
  redirect("/login");
}
