"use client";

import { useMemo, useState } from "react";
import { Bubble } from "@/components/Bubble";
import { Button, LinkButton, Notice } from "@/components/ui";
import { heatBucket, summarize, type QuestionResult } from "@/lib/game/results";
import { useRoom } from "@/lib/game/useRoom";
import { download, safeFilename } from "@/lib/questions/export";
import type { ChoiceKey } from "@/lib/questions/types";

/**
 * The screen the whole product exists for. It is drawn as the answer sheet
 * the class just filled in together: one row per question, the correct
 * bubble marked, and red pen over everything the room got wrong. Darker red
 * means more people missed it.
 */
export function ResultsScreen({ code }: { code: string }) {
  const { room, set, players, answers, error, loading } = useRoom(code);
  const [view, setView] = useState<"sheet" | "table">("sheet");
  const [open, setOpen] = useState<number | null>(null);

  const results = useMemo(() => (set ? summarize(set.questions, players, answers) : null), [set, players, answers]);

  if (loading) return <p className="pt-8 text-graphite">Loading results…</p>;
  if (error || !room || !set || !results) {
    return (
      <div className="pt-8">
        <Notice tone="error">{error ?? "No game with that code."}</Notice>
      </div>
    );
  }

  const inProgress = room.phase !== "ended";
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  const exportCsv = () => {
    const rows = [
      ["#", "Question", "Correct", "Class correct", "Answered", "Most common wrong answer", ...(["A", "B", "C", "D", "E"] as ChoiceKey[]).map((k) => `Picked ${k}`)],
      ...results.questions.map((q) => [
        q.index + 1,
        q.question.stem,
        q.question.answer ?? "",
        pct(q.classCorrectRate),
        q.answered,
        q.trap ?? "",
        q.picks.A,
        q.picks.B,
        q.picks.C,
        q.picks.D,
        q.picks.E,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))).join(",")).join("\r\n");
    download(`${safeFilename(set.title)}-results.csv`, csv, "text/csv");
  };

  return (
    <div className="pt-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl sm:text-4xl">{set.title}</h1>
          <p className="mt-2 text-graphite">
            {players.length} {players.length === 1 ? "player" : "players"} · {results.questions.length} questions · class average{" "}
            <span className="font-semibold text-ink">{pct(results.classAverage)}</span>
            {inProgress && " · still being played"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div role="tablist" className="inline-flex overflow-hidden rounded-form border-2 border-ink">
            {(["sheet", "table"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`px-4 py-2 font-semibold ${view === v ? "bg-ink text-paper" : "hover:bg-paper-2"}`}
              >
                {v === "sheet" ? "Answer sheet" : "Table"}
              </button>
            ))}
          </div>
          <Button variant="quiet" onClick={exportCsv}>
            Download CSV
          </Button>
          <LinkButton href={`/sets/${set.id}`} variant="quiet">
            Play again
          </LinkButton>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="mt-8">
          <Notice>Nobody has played this set yet.</Notice>
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]">
          <section aria-label="Results by question" className="min-w-0">
            {view === "sheet" ? (
              <AnswerSheet results={results.questions} open={open} setOpen={setOpen} />
            ) : (
              <ResultsTable results={results.questions} />
            )}
          </section>

          <aside className="min-w-0 space-y-8">
            <div>
              <h2 className="text-xl font-bold">Study these first</h2>
              {results.studyList.length === 0 ? (
                <p className="mt-2 text-graphite">Nothing stumped the room. Harder set next time.</p>
              ) : (
                <ol className="mt-3 space-y-3">
                  {results.studyList.slice(0, 8).map((q) => (
                    <li key={q.index}>
                      <button
                        type="button"
                        onClick={() => {
                          setView("sheet");
                          setOpen(q.index);
                          document.getElementById(`q-${q.index}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        className="w-full rounded-form border-l-4 border-highlighter bg-highlighter/25 px-3 py-2 text-left hover:bg-highlighter/40"
                      >
                        <span className="text-sm font-semibold">
                          {q.index + 1}. {pct(q.classCorrectRate)} got it
                          {q.trap && <> · most picked {q.trap}</>}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-sm text-graphite">{q.question.stem}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              {results.studyList.length > 8 && (
                <p className="mt-2 text-sm text-graphite">and {results.studyList.length - 8} more below 70% on the sheet</p>
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold">Players</h2>
              <ol className="mt-3 space-y-1.5">
                {results.players.map((r, i) => (
                  <li key={r.player.id} className="flex items-center gap-3 text-sm">
                    <span className="w-5 text-right text-graphite">{i + 1}</span>
                    <span className="flex-1 font-semibold">{r.player.name}</span>
                    <span className="text-graphite">
                      {r.correct}/{results.questions.length}
                    </span>
                    <span className="w-14 text-right tabular-nums">{r.player.score.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="text-sm text-graphite">
              <p className="font-semibold text-ink">Reading the sheet</p>
              <ul className="mt-2 space-y-1.5">
                <li className="flex items-center gap-2">
                  <Bubble letter="B" state="correct" size="sm" /> the right answer
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-6 w-6 rounded-full border-2 border-ink" aria-hidden /> nobody fell for it
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-flex gap-1" aria-hidden>
                    <span className="h-6 w-6 rounded-full bg-heat-1" />
                    <span className="h-6 w-6 rounded-full bg-heat-2" />
                    <span className="h-6 w-6 rounded-full bg-heat-3" />
                  </span>
                  some → most of the room picked it
                </li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

// Tailwind only emits classes it can see written out in full.
const HEAT = [
  "border-ink text-ink",
  "border-heat-1 bg-heat-1 text-ink",
  "border-heat-2 bg-heat-2 text-paper",
  "border-heat-3 bg-heat-3 text-paper",
] as const;

/**
 * The bubble sheet. For each question: the row number, a bubble per choice
 * (the correct one in green, wrong ones in red pen scaled by how many picked
 * them), and the class-correct percentage. Click a row to see the question.
 */
function AnswerSheet({
  results,
  open,
  setOpen,
}: {
  results: QuestionResult[];
  open: number | null;
  setOpen: (i: number | null) => void;
}) {
  return (
    <ol className="rounded-form border-2 border-ink">
      {results.map((q) => {
        const bucket = heatBucket(q.classCorrectRate);
        const isOpen = open === q.index;
        return (
          <li key={q.index} id={`q-${q.index}`} className="border-b-2 border-rule last:border-b-0">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : q.index)}
              aria-expanded={isOpen}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-paper-2 sm:gap-5 sm:px-5 ${isOpen ? "bg-paper-2" : ""}`}
            >
              <span className="w-7 shrink-0 text-right text-sm font-semibold text-graphite">{q.index + 1}</span>
              <span className="flex shrink-0 items-center gap-2" aria-hidden>
                {q.question.choices.map((c) => {
                  const picked = q.picks[c.key];
                  const share = q.answered ? picked / q.answered : 0;
                  const correct = c.key === q.question.answer;
                  const wrongBucket = share === 0 ? 0 : share < 0.2 ? 1 : share < 0.45 ? 2 : 3;
                  return (
                    <span
                      key={c.key}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold sm:h-9 sm:w-9 sm:text-sm ${
                        correct ? "border-mark bg-mark text-mark-ink" : HEAT[wrongBucket]
                      }`}
                      title={`${c.key}: ${picked} picked`}
                    >
                      {c.key}
                    </span>
                  );
                })}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-graphite sm:text-base">{q.question.stem}</span>
              <span
                className={`w-14 shrink-0 text-right text-sm font-semibold tabular-nums sm:text-base ${bucket >= 2 ? "text-redpen" : ""}`}
                aria-label={`${Math.round(q.classCorrectRate * 100)} percent of the class got it right`}
              >
                {Math.round(q.classCorrectRate * 100)}%
              </span>
            </button>
            {isOpen && (
              <div className="border-t-2 border-rule px-3 py-4 sm:px-5 sm:pl-[4.75rem]">
                <p className="text-lg">{q.question.stem}</p>
                <ul className="mt-3 space-y-2">
                  {q.question.choices.map((c) => {
                    const picked = q.picks[c.key];
                    const correct = c.key === q.question.answer;
                    return (
                      <li key={c.key} className="flex items-center gap-3">
                        <Bubble letter={c.key} state={correct ? "correct" : picked ? "wrong" : "dim"} />
                        <span className={`flex-1 ${correct ? "font-semibold" : ""}`}>{c.text}</span>
                        <span className="text-sm text-graphite">
                          {picked} {picked === 1 ? "pick" : "picks"}
                          {q.trap === c.key && " · the trap"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-sm text-graphite">
                  {q.answered} answered
                  {q.medianMs !== null && <> · typical time {(q.medianMs / 1000).toFixed(1)}s</>}
                </p>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ResultsTable({ results }: { results: QuestionResult[] }) {
  return (
    <div className="overflow-x-auto rounded-form border-2 border-ink">
      <table className="w-full text-sm">
        <thead className="bg-paper-2 text-left">
          <tr>
            <th className="px-3 py-2 font-semibold">#</th>
            <th className="px-3 py-2 font-semibold">Question</th>
            <th className="px-3 py-2 font-semibold">Answer</th>
            <th className="px-3 py-2 text-right font-semibold">Class correct</th>
            <th className="px-3 py-2 text-right font-semibold">Answered</th>
            <th className="px-3 py-2 font-semibold">Most picked wrong</th>
          </tr>
        </thead>
        <tbody>
          {results.map((q) => (
            <tr key={q.index} className="border-t-2 border-rule">
              <td className="px-3 py-2 text-graphite">{q.index + 1}</td>
              <td className="px-3 py-2">{q.question.stem}</td>
              <td className="px-3 py-2 font-semibold">{q.question.answer}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${heatBucket(q.classCorrectRate) >= 2 ? "font-semibold text-redpen" : ""}`}>
                {Math.round(q.classCorrectRate * 100)}%
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{q.answered}</td>
              <td className="px-3 py-2">{q.trap ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
