"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { saveEntriesAction } from "@/app/actions/entries";
import type { EntryState } from "@/lib/data/entries";

export interface GridColumn {
  key: string;
  label: string;
  unit: string | null;
  type: string;
}

/**
 * Spreadsheet-style entry: arrow keys / Enter / Tab to move, paste a block
 * (tab- or comma-separated rows) from a spreadsheet starting at the focused
 * cell. Only changed cells are sent; replacements and implausible values ask
 * for confirmation first.
 */
export function EntryGrid({ clientId, rows, columns, initial }: { clientId: string; rows: { date: string; label: string }[]; columns: GridColumn[]; initial: Record<string, string> }) {
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [state, setState] = useState<EntryState>({ error: null });
  const [pending, start] = useTransition();
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const k = (r: number, c: number) => `${columns[c].key}|${rows[r].date}`;
  const changed = useMemo(() => Object.keys(values).filter((key) => (values[key] ?? "") !== (initial[key] ?? "")), [values, initial]);

  const focus = (r: number, c: number) => {
    if (r < 0 || r >= rows.length || c < 0 || c >= columns.length) return;
    refs.current[k(r, c)]?.focus();
    refs.current[k(r, c)]?.select();
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    if (e.key === "ArrowDown" || e.key === "Enter") { e.preventDefault(); focus(r + 1, c); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focus(r - 1, c); }
    else if (e.key === "ArrowRight" && e.currentTarget.selectionStart === e.currentTarget.value.length) { e.preventDefault(); focus(r, c + 1); }
    else if (e.key === "ArrowLeft" && e.currentTarget.selectionStart === 0) { e.preventDefault(); focus(r, c - 1); }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n") && !text.includes(",")) return;
    e.preventDefault();
    const lines = text.replace(/\r/g, "").split("\n").filter((l, i, a) => l.length || i < a.length - 1);
    setValues((v) => {
      const next = { ...v };
      lines.forEach((line, i) => {
        line.split(line.includes("\t") ? "\t" : ",").forEach((cell, j) => {
          if (r + i < rows.length && c + j < columns.length) next[k(r + i, c + j)] = cell.trim();
        });
      });
      return next;
    });
  };

  const save = (confirmed: boolean) => {
    const entries = changed.filter((key) => (values[key] ?? "").trim() !== "").map((key) => {
      const [metric_key, date] = key.split("|");
      return { metric_key, date, raw: values[key] };
    });
    const fd = new FormData();
    fd.set("entries", JSON.stringify(entries));
    if (confirmed) fd.set("confirmed", "1");
    start(async () => {
      const r = await saveEntriesAction(clientId, state, fd);
      setState(r);
    });
  };

  return (
    <div className="space-y-2">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="table">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-canvas">Date</th>
              {columns.map((c) => <th key={c.key}>{c.label}{c.unit ? ` (${c.unit})` : ""}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={row.date}>
                <td className="sticky left-0 z-10 whitespace-nowrap bg-canvas pr-3 align-middle text-sm">{row.label}</td>
                {columns.map((col, c) => {
                  const key = k(r, c);
                  const err = state.cellErrors?.[key];
                  const warn = state.warnings?.[key];
                  const dirty = (values[key] ?? "") !== (initial[key] ?? "");
                  return (
                    <td key={col.key} className="p-0.5">
                      <input
                        ref={(el) => { refs.current[key] = el; }}
                        inputMode={col.type === "text" || col.type === "time" ? "text" : col.type === "boolean" ? "numeric" : "decimal"}
                        className={clsx("input min-w-[5.5rem] py-1.5", dirty && "bg-fg/10", err && "border-fg", warn && "border-muted")}
                        value={values[key] ?? ""}
                        title={err ?? warn ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                        onKeyDown={(e) => onKey(e, r, c)}
                        onPaste={(e) => onPaste(e, r, c)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {state.error && <p className="text-sm text-alert">{state.error}</p>}
      {state.cellErrors && <ul className="text-xs text-alert">{Object.entries(state.cellErrors).map(([key, m]) => <li key={key}>{key.replace("|", " on ")}: {m}</li>)}</ul>}
      {state.needsConfirm && state.warnings && (
        <div className="note-warn p-2 text-sm">
          <ul className="list-disc pl-4">{Object.entries(state.warnings).map(([key, m]) => <li key={key}>{key.replace("|", " on ")}: {m}</li>)}</ul>
          <button type="button" className="btn btn-sm mt-2" disabled={pending} onClick={() => save(true)}>Confirm and save</button>
        </div>
      )}
      {state.saved != null && !state.needsConfirm && !state.error && <p className="text-sm text-ok">Saved {state.saved} value{state.saved === 1 ? "" : "s"}.</p>}
      <button type="button" className="btn btn-primary" disabled={pending || changed.length === 0} onClick={() => save(false)}>
        {pending ? "Saving…" : `Save ${changed.length} change${changed.length === 1 ? "" : "s"}`}
      </button>
      <p className="text-xs text-muted">Tip: copy a block from a spreadsheet and paste into the first cell. Blank cells are ignored (existing values are never cleared).</p>
    </div>
  );
}
