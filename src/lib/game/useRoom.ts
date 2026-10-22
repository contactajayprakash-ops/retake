"use client";

import { useEffect, useRef, useState } from "react";
import { getRoom, getSet, listAnswers, listPlayers, watchRoom } from "./api";
import type { Answer, Player, Room, SetRow } from "./types";

export interface RoomState {
  room: Room | null;
  set: SetRow | null;
  players: Player[];
  answers: Answer[];
  error: string | null;
  loading: boolean;
}

/**
 * Everything one screen needs to know about a live game, kept fresh.
 * Both the host and the players use this; what they render differs.
 */
export function useRoom(code: string): RoomState {
  const [state, setState] = useState<RoomState>({ room: null, set: null, players: [], answers: [], error: null, loading: true });
  const stop = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const room = await getRoom(code);
        if (!room) {
          if (!cancelled) setState((s) => ({ ...s, loading: false, error: "No game with that code." }));
          return;
        }
        const [set, players, answers] = await Promise.all([getSet(room.set_id), listPlayers(room.id), listAnswers(room.id)]);
        if (cancelled) return;
        setState({ room, set, players, answers, error: null, loading: false });
        stop.current = watchRoom(room, {
          onRoom: (r) => setState((s) => ({ ...s, room: r })),
          onPlayers: (p) => setState((s) => ({ ...s, players: p })),
          onAnswers: (a) => setState((s) => ({ ...s, answers: a })),
        });
      } catch (err) {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : "Couldn't load the game." }));
      }
    })();
    return () => {
      cancelled = true;
      stop.current();
    };
  }, [code]);

  return state;
}

/** Seconds left on the current question, ticking on the client. */
export function useCountdown(room: Room | null): number {
  const [now, setNow] = useState(() => Date.now());
  const active = Boolean(room && room.phase === "question" && room.question_started_at);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active, room?.question_started_at]);
  if (!active || !room?.question_started_at) return 0;
  const started = new Date(room.question_started_at).getTime();
  const total = room.seconds_per_question * 1000;
  return Math.max(0, Math.ceil((started + total - now) / 1000));
}

/**
 * Positions (in the set's full list) of the questions that can be played:
 * ones with a marked answer and at least two choices. The server scores by
 * position in the full list, so the host walks this list and skips the rest.
 */
export function playableIndices(set: SetRow | null): number[] {
  return (set?.questions ?? []).flatMap((q, i) => (q.answer && q.choices.length >= 2 ? [i] : []));
}
