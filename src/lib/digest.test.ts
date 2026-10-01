import { describe, expect, it } from "vitest";
import { digestHtml, digestSubject } from "./digest";

describe("digest", () => {
  it("renders key dates, overdue and flags, escaping HTML", () => {
    const d = { kind: "weekly" as const, today: "2026-10-05", appUrl: "https://x.test", keyDates: [{ date: "2026-10-11", client_id: "1", client_name: "A <b>", label: "Weigh-in" }], overdue: [{ client: "B", title: "Text B for weigh-in", due: "2026-10-04" }], flagged: [{ client: "C", clientId: "3", flags: ["clearance pending"] }] };
    const html = digestHtml(d);
    expect(html).toContain("A &lt;b&gt;");
    expect(html).toContain("Text B for weigh-in");
    expect(html).toContain("clearance pending");
    expect(digestSubject(d)).toContain("1 overdue");
  });
});
