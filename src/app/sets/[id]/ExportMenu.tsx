"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import {
  download,
  safeFilename,
  toBlooketCsv,
  toGimkitCsv,
  toKahootWorkbook,
  toQuizletText,
  toRetakeJson,
} from "@/lib/questions/export";
import type { Question } from "@/lib/questions/types";

/**
 * Not everyone wants to play live. Some people just want the questions in
 * the game they already use, so every set exports to the big four plus a
 * JSON copy of itself.
 */
export function ExportMenu({ title, questions }: { title: string; questions: Question[] }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const base = safeFilename(title);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const items: { label: string; hint: string; run: () => void }[] = [
    {
      label: "Gimkit (.csv)",
      hint: "Kit → Import from spreadsheet",
      run: () => download(`${base}-gimkit.csv`, toGimkitCsv(questions), "text/csv"),
    },
    {
      label: "Blooket (.csv)",
      hint: "Create set → CSV Import",
      run: () => download(`${base}-blooket.csv`, toBlooketCsv(questions), "text/csv"),
    },
    {
      label: "Kahoot (.xlsx)",
      hint: "Create → Import spreadsheet",
      run: () =>
        download(`${base}-kahoot.xlsx`, toKahootWorkbook(questions), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    },
    {
      label: copied ? "Copied for Quizlet" : "Quizlet (copy text)",
      hint: "Create set → Import → paste",
      run: async () => {
        try {
          await navigator.clipboard.writeText(toQuizletText(questions));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          download(`${base}-quizlet.txt`, toQuizletText(questions), "text/plain");
        }
      },
    },
    {
      label: "Retake (.json)",
      hint: "Back up or re-import later",
      run: () => download(`${base}.json`, toRetakeJson(title, questions), "application/json"),
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <Button variant="quiet" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" disabled={questions.length === 0}>
        Export
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-2 w-72 overflow-hidden rounded-form border-2 border-ink bg-paper shadow-[4px_4px_0_0_var(--ink)]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              type="button"
              className="flex w-full flex-col items-start px-4 py-3 text-left hover:bg-paper-2"
              onClick={() => {
                item.run();
                if (!item.label.startsWith("Quizlet")) setOpen(false);
              }}
            >
              <span className="font-semibold">{item.label}</span>
              <span className="text-sm text-graphite">{item.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
