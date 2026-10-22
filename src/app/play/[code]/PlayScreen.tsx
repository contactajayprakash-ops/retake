"use client";

import { useMemo, useState } from "react";
import { Bubble } from "@/components/Bubble";
import { Button, LinkButton, Notice, Wordmark, inputClass } from "@/components/ui";
import { joinRoom, parseSeat, storageKey, submitAnswer } from "@/lib/game/api";
import { summarize } from "@/lib/game/results";
import { playableIndices, useCountdown, useRoom } from "@/lib/game/useRoom";
import { useStoredValue } from "@/lib/game/useStored";
import type { ChoiceKey } from "@/lib/questions/types";

/**
 * The phone view. One job per screen: type a name, tap a bubble, see if it
 * was right. The whole thing fits above the fold on a small phone, and the
 * tap targets are big enough to hit while walking to class.
 */
export function PlayScreen({ code }: { code: string }) {
  const { room, set, players, answers, error, loading } = useRoom(code);
  const secondsLeft = useCountdown(room);
  const seat = parseSeat(useStoredValue(storageKey.seat(code)));
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [pick, setPick] = useState<{ index: number; choice: ChoiceKey; correct?: boolean; points?: number; answer?: string | null } | null>(null);
  const [sending, setSending] = useState(false);

  const order = useMemo(() => playableIndices(set), [set]);
  const position = room ? order.indexOf(room.current_index) : -1;
  const question = room && room.current_index >= 0 ? set?.questions[room.current_index] : null;
  const me = seat ? players.find((p) => p.id === seat.playerId) : undefined;
  const fromList = room && seat ? answers.find((a) => a.player_id === seat.playerId && a.question_index === room.current_index) : undefined;
  // Until the answers list catches up, the server's reply to our own submit is just as good.
  const myAnswer =
    fromList ??
    (pick && room && pick.index === room.current_index && pick.correct !== undefined
      ? { choice: pick.choice, correct: pick.correct, points: pick.points ?? 0 }
      : undefined);
  const rank = me ? [...players].sort((a, b) => b.score - a.score).findIndex((p) => p.id === me.id) + 1 : 0;

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoining(true);
    setJoinError(null);
    try {
      await joinRoom(code, name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't join.";
      setJoinError(
        msg.includes("game over") ? "This game already ended." : msg.includes("no such") ? "No game with that code." : msg,
      );
    } finally {
      setJoining(false);
    }
  };

  const answer = async (choice: ChoiceKey) => {
    if (!room || sending || myAnswer || pick?.index === room.current_index) return;
    setSending(true);
    setPick({ index: room.current_index, choice });
    try {
      const r = await submitAnswer(code, room.current_index, choice);
      setPick({ index: room.current_index, choice, correct: r.correct, points: r.points, answer: r.answer });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (!msg.includes("already")) setPick(null);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <p className="p-6 text-graphite">Loading…</p>;
  if (error || !room || !set) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 p-6">
        <Wordmark />
        <Notice tone="error">{error ?? "No game with that code."}</Notice>
        <LinkButton href="/join" variant="quiet">
          Try another code
        </LinkButton>
      </div>
    );
  }

  if (!seat) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-6">
        <Wordmark />
        <form onSubmit={join} className="mt-10 space-y-4">
          <p className="text-graphite">
            Joining <span className="font-semibold text-ink">{set.title}</span>
          </p>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Your name</span>
            <input
              className={`${inputClass} text-xl`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              autoComplete="nickname"
              autoFocus
              required
            />
          </label>
          {room.phase === "ended" ? (
            <Notice>This game already ended.</Notice>
          ) : (
            <Button type="submit" size="lg" className="w-full" disabled={joining || !name.trim()}>
              {joining ? "Joining…" : "Join"}
            </Button>
          )}
          {joinError && <Notice tone="error">{joinError}</Notice>}
        </form>
      </div>
    );
  }

  const current = pick && pick.index === room.current_index ? pick : null;
  const chosen = (myAnswer?.choice as ChoiceKey | undefined) ?? current?.choice;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-5">
      <header className="flex items-center justify-between">
        <Wordmark />
        <span className="font-semibold">{seat.name}</span>
      </header>

      {room.phase === "lobby" && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Bubble letter="✓" state="filled" size="xl" />
          <p className="mt-5 text-2xl font-bold">You&apos;re in.</p>
          <p className="mt-2 text-graphite">Look at the board. The first question is coming.</p>
          <p className="mt-6 text-sm text-graphite" aria-live="polite">
            {players.length} {players.length === 1 ? "person" : "people"} here
          </p>
        </div>
      )}

      {room.phase === "question" && question && (
        <div className="flex flex-1 flex-col pt-4">
          <div className="flex items-center justify-between text-sm text-graphite">
            <span>
              {position + 1} of {order.length}
            </span>
            <span className="tabular-nums" aria-live="off">
              {secondsLeft}s
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-paper-2" aria-hidden>
            <div className="h-full bg-ink transition-[width] duration-200 ease-linear" style={{ width: `${(secondsLeft / room.seconds_per_question) * 100}%` }} />
          </div>
          <p className="mt-5 text-lg leading-snug">{question.stem}</p>
          <ul className="mt-5 grid flex-1 content-start gap-3">
            {question.choices.map((c) => {
              const isChosen = chosen === c.key;
              return (
                <li key={c.key}>
                  <button
                    type="button"
                    onClick={() => answer(c.key)}
                    disabled={Boolean(chosen) || secondsLeft === 0}
                    aria-pressed={isChosen}
                    className={`flex w-full items-center gap-4 rounded-form border-2 p-3 text-left text-lg transition-colors disabled:opacity-70 ${
                      isChosen ? "border-ink bg-paper-2" : "border-ink active:bg-paper-2"
                    }`}
                  >
                    <Bubble letter={c.key} state={isChosen ? "filled" : "empty"} size="lg" />
                    <span>
                      <span className="sr-only">{c.key}. </span>
                      {c.text}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-center text-graphite" aria-live="polite">
            {chosen ? "Locked in. Waiting for everyone." : secondsLeft === 0 ? "Time's up." : "Pick one."}
          </p>
        </div>
      )}

      {room.phase === "reveal" && question && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {myAnswer ? (
            <>
              <Bubble letter={myAnswer.choice} state={myAnswer.correct ? "correct" : "wrong"} size="xl" className="bubble-fill" />
              <p className="mt-5 text-3xl font-bold">{myAnswer.correct ? "Right." : "Not that one."}</p>
              {myAnswer.correct ? (
                <p className="mt-1 text-graphite">+{myAnswer.points.toLocaleString()} points</p>
              ) : (
                <p className="mt-1 text-graphite">
                  It was <span className="font-semibold text-ink">{question.answer}</span>.{" "}
                  {question.choices.find((c) => c.key === question.answer)?.text}
                </p>
              )}
            </>
          ) : (
            <>
              <Bubble letter="–" state="dim" size="xl" />
              <p className="mt-5 text-3xl font-bold">No answer.</p>
              <p className="mt-1 text-graphite">
                It was <span className="font-semibold text-ink">{question.answer}</span>.{" "}
                {question.choices.find((c) => c.key === question.answer)?.text}
              </p>
            </>
          )}
          {me && (
            <p className="mt-8 text-sm text-graphite">
              {me.score.toLocaleString()} points · #{rank} of {players.length}
            </p>
          )}
        </div>
      )}

      {room.phase === "leaderboard" && me && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="display text-7xl">#{rank}</p>
          <p className="mt-3 text-graphite">
            {me.score.toLocaleString()} points · {players.length} playing
          </p>
        </div>
      )}

      {room.phase === "ended" && (
        <EndedView
          code={code}
          rank={rank}
          total={players.length}
          score={me?.score ?? 0}
          missed={seat ? summarize(set.questions, players, answers).players.find((r) => r.player.id === seat.playerId)?.missed ?? [] : []}
          questions={set.questions}
        />
      )}
    </div>
  );
}

function EndedView({
  code,
  rank,
  total,
  score,
  missed,
  questions,
}: {
  code: string;
  rank: number;
  total: number;
  score: number;
  missed: number[];
  questions: { stem: string; answer: string | null; choices: { key: string; text: string }[] }[];
}) {
  return (
    <div className="flex flex-1 flex-col pt-6">
      <p className="display text-5xl">#{rank}</p>
      <p className="mt-2 text-graphite">
        {score.toLocaleString()} points · {total} playing
      </p>
      <h2 className="mt-8 text-xl font-bold">{missed.length ? `Your ${missed.length} to study` : "You got them all."}</h2>
      <ol className="mt-3 space-y-3">
        {missed.map((i) => {
          const q = questions[i];
          return (
            <li key={i} className="rounded-form border-2 border-rule p-3">
              <p>{q.stem}</p>
              <p className="mt-1 text-sm text-mark">
                {q.answer}. {q.choices.find((c) => c.key === q.answer)?.text}
              </p>
            </li>
          );
        })}
      </ol>
      <div className="mt-8">
        <LinkButton href={`/results/${code}`} variant="quiet" className="w-full">
          See the class results
        </LinkButton>
      </div>
    </div>
  );
}
