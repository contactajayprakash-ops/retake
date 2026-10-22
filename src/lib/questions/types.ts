export type ChoiceKey = "A" | "B" | "C" | "D" | "E";

export const CHOICE_KEYS: ChoiceKey[] = ["A", "B", "C", "D", "E"];

export interface Choice {
  key: ChoiceKey;
  text: string;
}

export interface Question {
  /** Stable id within a set. */
  id: string;
  /** The number printed on the paper, if any. */
  number: number | null;
  stem: string;
  choices: Choice[];
  /** Letter of the correct choice, when known. */
  answer: ChoiceKey | null;
  /** Why the parser is unsure about this one, if it is. */
  warnings: string[];
}

export interface QuestionSet {
  id: string;
  title: string;
  questions: Question[];
  createdAt: string;
}

export interface ParseResult {
  questions: Question[];
  /** Number of answer-key entries that were found and applied. */
  keyedAnswers: number;
  notes: string[];
}
