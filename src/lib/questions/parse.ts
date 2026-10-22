import { CHOICE_KEYS, type Choice, type ChoiceKey, type ParseResult, type Question } from "./types";

/**
 * Turns the text of a practice test into structured multiple-choice questions.
 *
 * It is deliberately rule-based: AP-style practice PDFs, teacher-made review
 * packets and AP Classroom printouts all follow the same loose shape
 * (numbered stem, lettered choices, maybe an answer key at the end), and a
 * parser that just reads that shape is predictable, fast, free, and works
 * on a school Chromebook with no API key. Anything it is unsure about gets a
 * warning so the person can fix it on the review screen.
 */
export function parseQuestions(rawText: string): ParseResult {
  const notes: string[] = [];
  const text = normalize(rawText);
  const { body, keyText } = splitOffAnswerKey(text);

  const blocks = splitIntoBlocks(body);
  const questions: Question[] = [];
  const keyFromBody = new Map<number, ChoiceKey>();

  for (const block of blocks) {
    const inlineKey = readInlineKey(block);
    if (inlineKey) {
      for (const [n, k] of inlineKey) keyFromBody.set(n, k);
      continue;
    }
    const q = readQuestion(block.number, block.content, questions.length);
    if (q) questions.push(q);
  }

  const keyFromSection = keyText ? readKeyPairs(keyText) : new Map<number, ChoiceKey>();
  const key = new Map<number, ChoiceKey>([...keyFromSection, ...keyFromBody]);

  let keyedAnswers = 0;
  const numbered = questions.every((q) => q.number !== null);
  questions.forEach((q, i) => {
    if (q.answer) return;
    const lookup = numbered ? q.number! : i + 1;
    const k = key.get(lookup);
    if (k && q.choices.some((c) => c.key === k)) {
      q.answer = k;
      q.warnings = q.warnings.filter((w) => w !== NO_ANSWER);
      keyedAnswers++;
    }
  });

  if (questions.length === 0) notes.push("No numbered questions were found in this text.");
  if (key.size > 0 && keyedAnswers === 0) notes.push("An answer key was found but none of its numbers matched a question.");

  return { questions, keyedAnswers, notes };
}

const NO_ANSWER = "No correct answer found. Pick one.";

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

function normalize(raw: string): string {
  let t = raw.replace(/\r\n?/g, "\n").replace(/ /g, " ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  // PDF extractors often break a word across a line with a hyphen.
  t = t.replace(/(\w)-\n(?=[a-z])/g, "$1");
  // Page numbers and running footers show up as lonely lines.
  t = t
    .split("\n")
    .filter((line) => !/^\s*(page\s+)?\d{1,3}(\s*(of|\/)\s*\d{1,3})?\s*$/i.test(line))
    .filter((line) => !/^\s*-\s*\d{1,3}\s*-\s*$/.test(line))
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n");
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

// ---------------------------------------------------------------------------
// Answer key section ("Answer Key" / "Answers" heading near the end)
// ---------------------------------------------------------------------------

const KEY_HEADING = /^\s*(answer\s*key|answers|key|solutions)\s*[:.]?\s*$/i;

function splitOffAnswerKey(text: string): { body: string; keyText: string | null } {
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (KEY_HEADING.test(lines[i])) {
      return { body: lines.slice(0, i).join("\n"), keyText: lines.slice(i + 1).join("\n") };
    }
  }
  return { body: text, keyText: null };
}

const KEY_PAIR = /(\d{1,3})\s*[.):\-–]?\s*\(?([A-Ea-e])\)?(?=[\s,;.]|$)/g;

function readKeyPairs(text: string): Map<number, ChoiceKey> {
  const map = new Map<number, ChoiceKey>();
  for (const m of text.matchAll(KEY_PAIR)) {
    map.set(Number(m[1]), m[2].toUpperCase() as ChoiceKey);
  }
  return map;
}

/** A block that is nothing but "n. X" pairs is an answer key without a heading. */
function readInlineKey(block: Block): Map<number, ChoiceKey> | null {
  const compact = block.content.replace(/\s+/g, " ").trim();
  if (block.number !== null) {
    // "7. C" on its own: the number became the block, the letter is all that is left.
    const single = compact.match(/^\(?([A-Ea-e])\)?[.)]?$/);
    if (!single) return null;
    return new Map([[block.number, single[1].toUpperCase() as ChoiceKey]]);
  }
  if (!block.isKey) return null;
  const pairs = readKeyPairs(compact);
  return pairs.size > 0 ? pairs : null;
}

// ---------------------------------------------------------------------------
// Splitting the body into numbered blocks
// ---------------------------------------------------------------------------

interface Block {
  number: number | null;
  content: string;
  /** True for a line that is only an answer key, like "1-C, 2-A". */
  isKey?: boolean;
}

const QUESTION_START = /^\s*(?:(?:Q(?:uestion)?\s*#?\s*)(\d{1,3})\s*[.):]?|(\d{1,3})\s*[.):])(?:\s+(.*)|\s*)$/i;
// "1-C, 2-A, 3-D" or "1. B  2. C" : two or more number/letter pairs and nothing else.
const KEY_LINE = /^\s*(\d{1,3}\s*[.):\-–]?\s*\(?[A-Ea-e]\)?[\s,;.]*){2,}$/;

function splitIntoBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  for (const line of body.split("\n")) {
    if (KEY_LINE.test(line)) {
      if (current) blocks.push(current);
      blocks.push({ number: null, content: line, isKey: true });
      current = null;
      continue;
    }
    const m = line.match(QUESTION_START);
    if (m) {
      if (current) blocks.push(current);
      current = { number: Number(m[1] ?? m[2]), content: m[3] ?? "" };
      continue;
    }
    if (current) {
      current.content += "\n" + line;
    } else if (line.trim()) {
      // Text before the first number is usually instructions; keep it in
      // an unnumbered block so a packet that never numbers anything still parses.
      current = { number: null, content: line };
    }
  }
  if (current) blocks.push(current);
  const kept = blocks.filter((b) => b.content.trim().length > 0);
  // Once real numbered questions exist, the unnumbered preamble is just
  // directions and page headers.
  return kept.some((b) => b.number !== null) ? kept.filter((b) => b.number !== null || b.isKey) : kept;
}

// ---------------------------------------------------------------------------
// Reading one question
// ---------------------------------------------------------------------------

// Choice markers, in the shapes they actually show up in:
//   "A." "A)" "(A)" "a)" at the start of a line
//   "(A)" or "A." inline, uppercase only, so a sentence's "a." is left alone
//   a lone letter on its own line, which is how AP Classroom printouts render
const MARKER =
  /(?:^|\n)[ \t]*\*?\(?([A-Ea-e])[.):][ \t]+|(?:^|\n)[ \t]*\*?([A-E])[ \t]*(?=\n)|(?<=\s)\*?\(([A-E])\)\s+|(?<=\s)\*?([A-E])[.)]\s+(?=\S)/g;
const ANSWER_LINE = /\n?[ \t]*(?:correct\s+)?(?:answer|ans|key)\s*[:\-–]\s*\(?([A-Ea-e])\)?[.)]?[ \t]*(?=\n|$)/i;
const EXPLANATION = /\n\s*(?:explanation|rationale|solution)\b[\s\S]*$/i;

function readQuestion(number: number | null, content: string, index: number): Question | null {
  const warnings: string[] = [];
  let answer: ChoiceKey | null = null;

  let working = content.replace(EXPLANATION, "");
  const answerMatch = working.match(ANSWER_LINE);
  if (answerMatch) {
    answer = answerMatch[1].toUpperCase() as ChoiceKey;
    working = working.replace(ANSWER_LINE, "");
  }

  const markers = findOrderedMarkers(working);
  const stem = clean(markers.length ? working.slice(0, markers[0].start) : working);

  const choices: Choice[] = markers.map((m, i) => {
    const end = i + 1 < markers.length ? markers[i + 1].start : working.length;
    let text = working.slice(m.end, end);
    if (m.starred) answer = m.key;
    if (/\(correct\)\s*$/i.test(text.trim())) {
      answer = m.key;
      text = text.replace(/\(correct\)\s*$/i, "");
    }
    return { key: m.key, text: clean(text) };
  });

  if (!stem) return null;
  if (choices.length < 2) warnings.push("Fewer than 2 answer choices found.");
  if (!answer) warnings.push(NO_ANSWER);
  if (stem.length < 12) warnings.push("The question text looks very short.");

  return { id: `q${index + 1}`, number, stem, choices, answer, warnings };
}

interface Marker {
  key: ChoiceKey;
  start: number;
  end: number;
  starred: boolean;
  style: "line" | "paren" | "inline";
}

/**
 * Markers must appear in order starting with A, otherwise a stray "B." in a
 * sentence would be mistaken for a choice. Every A is tried as a starting
 * point; the longest run wins, and between equal runs the one whose markers
 * all look alike (all "(A)" or all "A." on their own lines) is trusted more
 * than a run that mixes a sentence's "A." with real choices.
 */
function findOrderedMarkers(text: string): Marker[] {
  const all: Marker[] = [];
  for (const m of text.matchAll(MARKER)) {
    const letter = (m[1] ?? m[2] ?? m[3] ?? m[4]).toUpperCase() as ChoiceKey;
    const style = m[3] !== undefined ? "paren" : m[4] !== undefined ? "inline" : "line";
    all.push({ key: letter, start: m.index!, end: m.index! + m[0].length, starred: m[0].includes("*"), style });
  }

  let best: Marker[] = [];
  let bestUniform = false;
  for (const a of all) {
    if (a.key !== "A") continue;
    const run: Marker[] = [a];
    let cursor = a.end;
    for (const key of CHOICE_KEYS.slice(1)) {
      const next = all.find((m) => m.key === key && m.start >= cursor);
      if (!next) break;
      run.push(next);
      cursor = next.end;
    }
    const uniform = run.every((m) => m.style === run[0].style);
    const better =
      run.length > best.length || (run.length === best.length && ((uniform && !bestUniform) || (uniform === bestUniform && a.start > best[0].start)));
    if (better) {
      best = run;
      bestUniform = uniform;
    }
  }
  // A run only counts if it has at least A and B.
  return best.length >= 2 ? best : [];
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
