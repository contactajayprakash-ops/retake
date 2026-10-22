import type { ChoiceKey, Question } from "@/lib/questions/types";
import type { Answer, Player } from "./types";

export interface QuestionResult {
  index: number;
  question: Question;
  answered: number;
  correct: number;
  /** Fraction of people who answered and got it wrong (0..1). */
  missRate: number;
  /** Fraction of the whole class that got it right, counting no-answer as a miss. */
  classCorrectRate: number;
  /** How many picked each letter. */
  picks: Record<ChoiceKey, number>;
  /** The wrong answer most people fell for, if any. */
  trap: ChoiceKey | null;
  medianMs: number | null;
}

export interface PlayerResult {
  player: Player;
  correct: number;
  answered: number;
  missed: number[];
}

export interface ClassResults {
  questions: QuestionResult[];
  players: PlayerResult[];
  /** Questions worth re-studying, hardest first. */
  studyList: QuestionResult[];
  /** Average fraction correct across the class, 0..1. */
  classAverage: number;
}

/**
 * Everything the results screen shows, computed in one place so the host
 * view, the player view and the exports can't disagree with each other.
 */
export function summarize(questions: Question[], players: Player[], answers: Answer[]): ClassResults {
  const byQuestion = new Map<number, Answer[]>();
  for (const a of answers) {
    const list = byQuestion.get(a.question_index) ?? [];
    list.push(a);
    byQuestion.set(a.question_index, list);
  }

  // Indexes are positions in the set's full question list, because that is
  // what the server scores against. Questions that couldn't be played
  // (no answer marked) are left out of the results entirely.
  const qResults: QuestionResult[] = questions.flatMap((question, index) => {
    if (!question.answer || question.choices.length < 2) return [];
    const list = byQuestion.get(index) ?? [];
    const picks: Record<ChoiceKey, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    let correct = 0;
    for (const a of list) {
      if (a.choice in picks) picks[a.choice as ChoiceKey]++;
      if (a.correct) correct++;
    }
    const wrongPicks = (Object.entries(picks) as [ChoiceKey, number][])
      .filter(([k, n]) => k !== question.answer && n > 0)
      .sort((x, y) => y[1] - x[1]);
    const trap = wrongPicks.length && wrongPicks[0][1] >= Math.max(2, list.length * 0.25) ? wrongPicks[0][0] : null;
    const times = list.map((a) => a.ms).sort((x, y) => x - y);
    const result: QuestionResult = {
      index,
      question,
      answered: list.length,
      correct,
      missRate: list.length ? 1 - correct / list.length : 0,
      classCorrectRate: players.length ? correct / players.length : 0,
      picks,
      trap,
      medianMs: times.length ? times[Math.floor(times.length / 2)] : null,
    };
    return [result];
  });

  const pResults: PlayerResult[] = players
    .map((player) => {
      const mine = answers.filter((a) => a.player_id === player.id);
      const correct = mine.filter((a) => a.correct).length;
      const answeredSet = new Set(mine.map((a) => a.question_index));
      const missed = qResults
        .map((q) => q.index)
        .filter((i) => !answeredSet.has(i) || mine.some((a) => a.question_index === i && !a.correct));
      return { player, correct, answered: mine.length, missed };
    })
    .sort((a, b) => b.player.score - a.player.score || b.correct - a.correct);

  // A question is worth studying if a good chunk of the class got it wrong
  // or skipped it. Sorted hardest first; ties broken by the trap being
  // popular, since a shared wrong answer means a shared misconception.
  const studyList = qResults
    .filter((q) => players.length > 0 && q.classCorrectRate < 0.7)
    .sort((a, b) => a.classCorrectRate - b.classCorrectRate || (b.trap ? 1 : 0) - (a.trap ? 1 : 0));

  const classAverage = qResults.length ? qResults.reduce((s, q) => s + q.classCorrectRate, 0) / qResults.length : 0;

  return { questions: qResults, players: pResults, studyList, classAverage };
}

/** Four buckets for the heatmap, from "everyone got it" to "almost nobody did". */
export function heatBucket(classCorrectRate: number): 0 | 1 | 2 | 3 {
  if (classCorrectRate >= 0.85) return 0;
  if (classCorrectRate >= 0.7) return 1;
  if (classCorrectRate >= 0.45) return 2;
  return 3;
}
