/** Digest email body (pure). Includes names but is only ever sent to the trainer. */
import type { KeyDate } from "./tasks";

export interface DigestInput {
  kind: "weekly" | "daily";
  today: string;
  appUrl: string;
  keyDates: KeyDate[];
  overdue: { client: string; title: string; due: string }[];
  flagged: { client: string; clientId: string; flags: string[] }[];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function digestSubject(d: DigestInput): string {
  return `Coach Console ${d.kind === "weekly" ? "weekly" : "daily"} digest — ${d.overdue.length} overdue, ${d.keyDates.length} key dates`;
}

export function digestHtml(d: DigestInput): string {
  const byClient = new Map<string, KeyDate[]>();
  for (const k of d.keyDates) byClient.set(k.client_name, [...(byClient.get(k.client_name) ?? []), k]);
  const section = (title: string, body: string) => `<h3 style="font-family:Arial;margin:16px 0 4px">${title}</h3>${body}`;
  const list = (items: string[]) => (items.length ? `<ul style="font-family:Arial;font-size:14px">${items.map((i) => `<li>${i}</li>`).join("")}</ul>` : `<p style="font-family:Arial;font-size:14px;color:#64748b">None.</p>`);
  return [
    `<div style="font-family:Arial;font-size:14px"><p>${d.kind === "weekly" ? "This week" : "Today"} at a glance (${esc(d.today)}). <a href="${d.appUrl}/today">Open Coach Console</a></p>`,
    section(
      d.kind === "weekly" ? "Key dates this week" : "Key dates (next 7 days)",
      byClient.size
        ? Array.from(byClient.entries()).map(([c, ks]) => `<p style="margin:4px 0"><b>${esc(c)}</b>: ${ks.map((k) => `${esc(k.date)} ${esc(k.label)}`).join(" · ")}</p>`).join("")
        : list([]),
    ),
    section("Overdue", list(d.overdue.map((o) => `${esc(o.client)} — ${esc(o.title)} (due ${esc(o.due)})`))),
    section("Clients with flags", list(d.flagged.map((f) => `<a href="${d.appUrl}/clients/${f.clientId}">${esc(f.client)}</a>: ${f.flags.map(esc).join("; ")}`))),
    `<p style="color:#64748b;font-size:12px">Sent to the trainer only. Nothing is sent to clients.</p></div>`,
  ].join("");
}
