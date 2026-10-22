import type { ChoiceKey } from "@/lib/questions/types";

export type BubbleState = "empty" | "filled" | "correct" | "wrong" | "dim";

interface BubbleProps {
  letter: ChoiceKey | string;
  state?: BubbleState;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** For the results heatmap: 0..1 fill of the circle, drawn as a pie wedge. */
  fill?: number;
}

const sizes = {
  sm: "h-6 w-6 text-[11px]",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-xl",
};

/**
 * The scantron bubble. Every answer in Retake is one of these, so it can be
 * read at a glance from the back of a classroom: a filled bubble is a pick,
 * green is right, red is wrong, and a ring with nothing in it is still open.
 */
export function Bubble({ letter, state = "empty", size = "md", className = "", fill }: BubbleProps) {
  const base = "inline-flex shrink-0 items-center justify-center rounded-full border-2 font-semibold select-none";
  const look = {
    empty: "border-ink text-ink bg-transparent",
    filled: "border-ink bg-ink text-paper",
    correct: "border-mark bg-mark text-mark-ink",
    wrong: "border-redpen bg-redpen text-paper",
    dim: "border-rule text-graphite bg-transparent",
  }[state];

  if (fill !== undefined) {
    const pct = Math.round(Math.max(0, Math.min(1, fill)) * 100);
    return (
      <span
        className={`${base} ${sizes[size]} border-ink text-ink ${className}`}
        style={{
          background: `conic-gradient(var(--ink) 0 ${pct}%, transparent ${pct}% 100%)`,
        }}
        aria-hidden
      >
        <span className="rounded-full bg-paper px-1 leading-none">{letter}</span>
      </span>
    );
  }

  return (
    <span className={`${base} ${sizes[size]} ${look} ${className}`} aria-hidden>
      {letter}
    </span>
  );
}

/** Four bubbles filling in one after another: the "working on it" state. */
export function BubbleLoader({ label = "Working" }: { label?: string }) {
  return (
    <div className="flex gap-2" role="status" aria-label={label}>
      {["A", "B", "C", "D"].map((l, i) => (
        <span
          key={l}
          className="bubble-loader inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink text-base font-semibold"
          style={{ animationDelay: `${i * 220}ms` }}
          aria-hidden
        >
          {l}
        </span>
      ))}
    </div>
  );
}
