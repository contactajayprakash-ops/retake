"use client";

import { useRouter } from "next/navigation";
import { useCallback, useId, useRef, useState } from "react";
import { Bubble, BubbleLoader } from "@/components/Bubble";
import { Button, Notice, inputClass } from "@/components/ui";
import { createSet } from "@/lib/game/api";
import { SAMPLE_QUESTIONS, SAMPLE_TITLE } from "@/lib/questions/sample";
import type { ParseResult, Question } from "@/lib/questions/types";

type Mode = "idle" | "reading" | "saving";

/**
 * The hero of the home page is the answer sheet itself. Drop a PDF onto it,
 * or flip it over and paste text. Either way the questions come back
 * parsed, get saved as a set, and the person lands on the review screen.
 */
export function Dropzone() {
  const router = useRouter();
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");

  const finish = useCallback(
    async (questions: Question[], title: string, sourceName?: string) => {
      setMode("saving");
      try {
        const id = await createSet(title, questions, sourceName);
        router.push(`/sets/${id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save the set.");
        setMode("idle");
      }
    },
    [router],
  );

  const extract = useCallback(
    async (body: FormData, fallbackTitle: string) => {
      setError(null);
      setMode("reading");
      try {
        const res = await fetch("/api/extract", { method: "POST", body });
        const data = (await res.json()) as ParseResult & { error?: string; sourceName?: string | null };
        if (!res.ok) throw new Error(data.error ?? "Couldn't read that.");
        if (data.questions.length === 0) {
          throw new Error("No questions found. Retake looks for numbered questions with A/B/C/D choices.");
        }
        const title = (data.sourceName ?? fallbackTitle).replace(/\.(pdf|txt)$/i, "").replace(/[_-]+/g, " ");
        await finish(data.questions, title, data.sourceName ?? undefined);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't read that.");
        setMode("idle");
      }
    },
    [finish],
  );

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    extract(body, file.name);
  };

  const onPaste = () => {
    if (!pasted.trim()) return;
    const body = new FormData();
    body.append("text", pasted);
    extract(body, "Pasted questions");
  };

  const busy = mode !== "idle";

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          onFile(e.dataTransfer.files?.[0]);
        }}
        className={`relative overflow-hidden rounded-form border-2 bg-paper-2 transition-colors ${
          over ? "border-mark" : "border-ink"
        }`}
      >
        {/* The top rows of a blank answer sheet. */}
        <div className="select-none border-b-2 border-dashed border-rule px-5 py-3" aria-hidden>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-graphite">
                <span className="w-4 text-right">{i + 1}</span>
                {["A", "B", "C", "D"].map((l) => (
                  <Bubble key={l} letter={l} size="sm" state="dim" />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-h-[16rem] flex-col items-center justify-center gap-4 p-8 text-center">
          {busy ? (
            <>
              <BubbleLoader />
              <p className="text-lg font-semibold" role="status">
                {mode === "reading" ? "Reading the questions…" : "Saving your set…"}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold">Drop a practice test here</p>
              <p className="max-w-md text-graphite">
                A PDF with numbered questions and lettered choices. If there is an answer key at the end, it gets used.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <input
                  ref={fileRef}
                  id={inputId}
                  type="file"
                  accept="application/pdf,.pdf,text/plain,.txt"
                  className="sr-only"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
                <Button type="button" size="lg" onClick={() => fileRef.current?.click()}>
                  Choose a PDF
                </Button>
                <Button type="button" variant="quiet" size="lg" onClick={() => setPasteOpen((v) => !v)} aria-expanded={pasteOpen}>
                  Paste text instead
                </Button>
              </div>
              <button
                type="button"
                className="text-sm font-semibold underline underline-offset-4"
                onClick={() => finish(SAMPLE_QUESTIONS, SAMPLE_TITLE)}
              >
                Or try the 12-question sample
              </button>
            </>
          )}
        </div>
      </div>

      {pasteOpen && !busy && (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Paste questions</span>
            <textarea
              className={`${inputClass} min-h-48 font-mono text-sm`}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={"1. Which organelle makes ATP?\nA. Ribosome\nB. Mitochondrion\nC. Golgi\nD. Lysosome\n\nAnswer key\n1. B"}
            />
          </label>
          <Button type="button" onClick={onPaste} disabled={!pasted.trim()}>
            Read these questions
          </Button>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </div>
  );
}
