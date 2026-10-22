import * as XLSX from "xlsx";
import type { Question } from "./types";

/**
 * Exports in the exact shapes the import screens of other study-game sites
 * expect. Each one was checked against that site's own template, because a
 * column in the wrong place fails silently on most of them.
 */

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function correctText(q: Question): string {
  return q.choices.find((c) => c.key === q.answer)?.text ?? "";
}

function wrongTexts(q: Question): string[] {
  return q.choices.filter((c) => c.key !== q.answer).map((c) => c.text);
}

// Gimkit: a header row, then "Question, Correct Answer, Incorrect Answer 1..3".
export function toGimkitCsv(questions: Question[]): string {
  const rows: (string | number)[][] = [["Question", "Correct Answer", "Incorrect Answer 1", "Incorrect Answer 2", "Incorrect Answer 3"]];
  for (const q of questions) {
    const wrong = wrongTexts(q).slice(0, 3);
    while (wrong.length < 3) wrong.push("");
    rows.push([q.stem, correctText(q), ...wrong]);
  }
  return csv(rows);
}

// Blooket: a title row, a header row, then one question per row with the
// correct answer given as its position (1-4). Only four choices fit.
export function toBlooketCsv(questions: Question[], seconds = 20): string {
  const rows: (string | number)[][] = [
    ["Blooket Import Template", "", "", "", "", "", "", ""],
    [
      "Question #",
      "Question Text",
      "Answer 1",
      "Answer 2",
      "Answer 3 (Optional)",
      "Answer 4 (Optional)",
      "Time Limit (sec) (Max: 300 seconds)",
      "Correct Answer(s) (Only include Answer #)",
    ],
  ];
  questions.forEach((q, i) => {
    const choices = q.choices.slice(0, 4);
    const texts = choices.map((c) => c.text);
    while (texts.length < 4) texts.push("");
    const pos = choices.findIndex((c) => c.key === q.answer) + 1;
    rows.push([i + 1, q.stem, ...texts, Math.min(300, seconds), pos || 1]);
  });
  return csv(rows);
}

// Kahoot: its xlsx template has instructions in rows 1-7, headers on row 8
// in columns B-H, and questions from row 9. Time limits must be one of a
// fixed list, questions are capped at 120 characters and answers at 75.
const KAHOOT_TIMES = [5, 10, 20, 30, 60, 90, 120, 240];

export function toKahootWorkbook(questions: Question[], seconds = 20): ArrayBuffer {
  const time = KAHOOT_TIMES.reduce((best, t) => (Math.abs(t - seconds) < Math.abs(best - seconds) ? t : best), 20);
  const aoa: (string | number)[][] = [];
  aoa.push(["", "Quiz template"]);
  aoa.push(["", "Add questions, at least two answer alternatives, time limit and choose correct answer(s)."]);
  for (let r = 2; r < 7; r++) aoa.push([""]);
  aoa.push([
    "",
    "Question - max 120 characters",
    "Answer 1 - max 75 characters",
    "Answer 2 - max 75 characters",
    "Answer 3 - max 75 characters",
    "Answer 4 - max 75 characters",
    "Time limit (sec) – 5, 10, 20, 30, 60, 90, 120, or 240 secs",
    "Correct answer(s) - choose at least one",
  ]);
  questions.slice(0, 100).forEach((q, i) => {
    const choices = q.choices.slice(0, 4);
    const texts = choices.map((c) => c.text.slice(0, 75));
    while (texts.length < 4) texts.push("");
    const pos = choices.findIndex((c) => c.key === q.answer) + 1;
    aoa.push([i + 1, q.stem.slice(0, 120), ...texts, time, pos || 1]);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 4 }, { wch: 60 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 18 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

// Quizlet imports plain text: term, tab, definition, newline. The question
// with its choices becomes the term and the correct choice the definition.
export function toQuizletText(questions: Question[]): string {
  return questions
    .map((q) => {
      const term = `${q.stem} ${q.choices.map((c) => `(${c.key}) ${c.text}`).join(" ")}`.replace(/\s+/g, " ");
      const def = `${q.answer}. ${correctText(q)}`;
      return `${term}\t${def}`;
    })
    .join("\n");
}

export function toRetakeJson(title: string, questions: Question[]): string {
  return JSON.stringify({ title, questions }, null, 2);
}

/** Sends a file to the browser's download folder. */
export function download(name: string, data: string | ArrayBuffer, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(title: string): string {
  return title.replace(/[^\w\s-]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "retake-set";
}
