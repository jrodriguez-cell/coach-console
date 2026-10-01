"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayIn } from "@/lib/dates";

function refresh(clientId?: string | null) {
  revalidatePath("/today");
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

export async function completeTaskAction(taskId: string, clientId?: string | null) {
  const db = createClient();
  await db.from("tasks").update({ status: "done" }).eq("id", taskId);
  refresh(clientId);
}

export async function reopenTaskAction(taskId: string, clientId?: string | null) {
  const db = createClient();
  await db.from("tasks").update({ status: "open", snoozed_until: null }).eq("id", taskId);
  refresh(clientId);
}

export async function snoozeTaskAction(taskId: string, clientId: string | null, form: FormData) {
  const db = createClient();
  const days = Math.max(1, Math.min(30, Number(form.get("days") ?? 1)));
  await db.from("tasks").update({ status: "snoozed", snoozed_until: addDays(todayIn(), days) }).eq("id", taskId);
  refresh(clientId);
}

export async function createTaskAction(form: FormData) {
  const db = createClient();
  const title = String(form.get("title") ?? "").trim();
  if (!title) throw new Error("Enter a task title.");
  const clientId = String(form.get("client_id") ?? "") || null;
  const { error } = await db.from("tasks").insert({ client_id: clientId, title, due_date: String(form.get("due_date") ?? "") || todayIn(), kind: "manual", source: "manual", status: "open" });
  if (error) throw error;
  refresh(clientId);
}
