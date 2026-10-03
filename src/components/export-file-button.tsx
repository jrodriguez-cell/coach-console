"use client";
import { useState } from "react";
import clsx from "clsx";

/**
 * Export button that works on phones. A plain download link fails silently
 * on iPhone when the app is opened from the home screen, and gives no
 * feedback while the file is being built. This fetches the file first
 * ("Preparing…"), then opens the share sheet on phones (Save to Files, Mail,
 * Messages…) or downloads it on desktop.
 */
export function ExportFileButton({ url, label, className }: { url: string; label: string; className?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "ready" | "error">("idle");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const touch = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  function download(f: File) {
    const href = URL.createObjectURL(f);
    const a = document.createElement("a");
    a.href = href;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
  }

  /** Share sheet on phones; false if it isn't available or the tap has expired. */
  async function share(f: File): Promise<boolean> {
    if (!touch() || !navigator.canShare?.({ files: [f] })) return false;
    try {
      await navigator.share({ files: [f], title: f.name });
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return true; // closed the sheet
      if (e instanceof DOMException && e.name === "NotAllowedError") throw e; // needs a fresh tap
      return false;
    }
  }

  async function deliver(f: File) {
    try {
      if (!(await share(f))) {
        if (touch()) window.location.href = URL.createObjectURL(f); // opens in the phone's PDF viewer
        else download(f);
      }
      setState("idle");
      setFile(null);
    } catch {
      // Building the file took longer than the browser allows for one tap: ask for a second tap.
      setFile(f);
      setState("ready");
    }
  }

  async function onClick() {
    if (state === "ready" && file) return deliver(file);
    if (state === "busy") return;
    setState("busy");
    setMsg(null);
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `Export failed (${r.status}). Try again.`);
      const name = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") ?? "")?.[1] ?? "export.pdf";
      const blob = await r.blob();
      await deliver(new File([blob], name, { type: blob.type || "application/pdf" }));
    } catch (e) {
      setState("error");
      setMsg(e instanceof Error ? e.message : "Export failed. Try again.");
    }
  }

  return (
    <>
      <button type="button" className={clsx("btn", state === "ready" && "btn-primary", className)} onClick={onClick} disabled={state === "busy"} aria-live="polite">
        {state === "busy" ? "Preparing…" : state === "ready" ? `Save or share ${label}` : label}
      </button>
      {msg && <span role="alert" className="col-span-2 text-xs text-muted sm:basis-full">{msg}</span>}
    </>
  );
}
