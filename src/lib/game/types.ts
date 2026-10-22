import type { Question } from "@/lib/questions/types";

export type Phase = "lobby" | "question" | "reveal" | "leaderboard" | "ended";

export interface Room {
  id: string;
  code: string;
  set_id: string;
  phase: Phase;
  current_index: number;
  question_started_at: string | null;
  seconds_per_question: number;
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  name: string;
  score: number;
  joined_at: string;
}

export interface Answer {
  id: string;
  room_id: string;
  player_id: string;
  question_index: number;
  choice: string;
  correct: boolean;
  ms: number;
  points: number;
  created_at: string;
}

export interface SetRow {
  id: string;
  title: string;
  questions: Question[];
  source_name: string | null;
  created_at: string;
  updated_at: string;
}
