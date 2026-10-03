import { MONOGRAM, MONOGRAM_HEAVY, SINGLE_LINE, WORDMARK, type LogoMark } from "@/lib/brand/logo";

const MARKS = { "single-line": SINGLE_LINE, wordmark: WORDMARK, monogram: MONOGRAM, "monogram-heavy": MONOGRAM_HEAVY } satisfies Record<string, LogoMark>;

/** MTTM logo from the supplied artwork; inherits the text colour. */
export function Logo({ mark, className, title = "Make Time To Move" }: { mark: keyof typeof MARKS; className?: string; title?: string }) {
  const m = MARKS[mark];
  return (
    <svg viewBox={`0 0 ${m.width} ${m.height}`} className={className} fill="currentColor" role="img" aria-label={title}>
      <path d={m.d} />
    </svg>
  );
}
