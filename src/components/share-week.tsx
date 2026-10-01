"use client";
import { useEffect, useState } from "react";

/** Download / share / copy the client-facing week sheet. */
export function ShareWeek({ planId, week, fileBase }: { planId: string; week: number; fileBase: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Web Share (phones) is only known after mount; avoids a hydration mismatch.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);
  const url = (format: "pdf" | "txt") => `/api/plans/${planId}/export/week?week=${week}&format=${format}`;
  // Safari only opens the share sheet straight from a tap, so the PDF is
  // fetched ahead of time rather than after the click.
  const [ready, setReady] = useState<{ week: number; file: File | null; text: string | null } | null>(null);
  useEffect(() => {
    if (!canShare) return;
    let live = true;
    setReady(null);
    Promise.all([
      fetch(url("pdf")).then(async (r) => (r.ok ? new File([await r.blob()], `${fileBase}-week-${week}.pdf`, { type: "application/pdf" }) : null)).catch(() => null),
      fetch(url("txt")).then((r) => (r.ok ? r.text() : null)).catch(() => null),
    ]).then(([file, text]) => live && setReady({ week, file, text }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canShare, planId, week, fileBase]);
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 3000);
  };

  async function fetchOk(format: "pdf" | "txt") {
    const r = await fetch(url(format));
    if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `Export failed (${r.status})`);
    return r;
  }

  async function copy() {
    setBusy(true);
    try {
      await navigator.clipboard.writeText(await (await fetchOk("txt")).text());
      flash("Copied: paste it into a text or email.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Couldn't copy.");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!ready || ready.week !== week) return;
    try {
      if (ready.file && navigator.canShare?.({ files: [ready.file] })) await navigator.share({ files: [ready.file], title: `Week ${week} workouts` });
      else if (ready.text) await navigator.share({ title: `Week ${week} workouts`, text: ready.text });
      else flash("Couldn't prepare the file. Try Download instead.");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) flash(e instanceof Error ? e.message : "Couldn't share.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canShare && <button type="button" className="btn btn-primary" onClick={share} disabled={!ready || ready.week !== week}>{ready && ready.week === week ? `Share week ${week}…` : "Preparing…"}</button>}
      <a className={canShare ? "btn" : "btn btn-primary"} href={url("pdf")}>Download week {week} PDF</a>
      <button type="button" className="btn" onClick={copy} disabled={busy}>Copy as text</button>
      {msg && <span className="text-xs text-slate-400">{msg}</span>}
    </div>
  );
}
