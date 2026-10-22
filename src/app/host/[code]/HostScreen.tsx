"use client";

import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bubble } from "@/components/Bubble";
import { Button, LinkButton, Notice, Wordmark } from "@/components/ui";
import { setPhase, storageKey } from "@/lib/game/api";
import { summarize } from "@/lib/game/results";
import { playableIndices, useCountdown, useRoom } from "@/lib/game/useRoom";
import { useMounted, useStoredValue } from "@/lib/game/useStored";

/**
 * The projector view. Big type, big bubbles, one keyboard shortcut (space
 * or enter) to move forward, because the host is usually standing at the
 * front of the room with a Chromebook at arm's length.
 */
export function HostScreen({ code }: { code: string }) {
  const router = useRouter();
  const { room, set, players, answers, error, loading } = useRoom(code);
  const secondsLeft = useCountdown(room);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const autoRevealed = useRef<number | null>(null);
  const mounted = useMounted();
  const isHost = Boolean(useStoredValue(storageKey.host(code)));
  const joinUrl = mounted ? `${window.location.origin}/play/${code}` : "";

  const order = useMemo(() => playableIndices(set), [set]);
  const position = room ? order.indexOf(room.current_index) : -1;
  const question = room && room.current_index >= 0 ? set?.questions[room.current_index] : null;
  const isLast = position >= 0 && position === order.length - 1;

  useEffect(() => {
    if (!joinUrl) return;
    let live = true;
    QRCode.toDataURL(joinUrl, { margin: 1, width: 360, color: { dark: "#182019", light: "#00000000" } })
      .then((url) => live && setQr(url))
      .catch(() => live && setQr(null));
    return () => {
      live = false;
    };
  }, [joinUrl]);

  const go = async (phase: Parameters<typeof setPhase>[1], index?: number) => {
    setBusy(true);
    setActionError(null);
    try {
      await setPhase(code, phase, index);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "That didn't go through.");
    } finally {
      setBusy(false);
    }
  };

  // Everyone answered, or time ran out: show the answer without waiting on the host.
  const answeredNow = room ? answers.filter((a) => a.question_index === room.current_index).length : 0;
  useEffect(() => {
    if (!room || !isHost || room.phase !== "question") return;
    const everyone = players.length > 0 && answeredNow >= players.length;
    if ((secondsLeft === 0 || everyone) && autoRevealed.current !== room.current_index) {
      autoRevealed.current = room.current_index;
      go("reveal");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, answeredNow, room?.phase, room?.current_index, players.length, isHost]);

  const next = () => {
    if (!room) return;
    if (room.phase === "lobby") return go("question", order[0]);
    if (room.phase === "question") return go("reveal");
    if (room.phase === "reveal") return isLast ? go("ended") : go("leaderboard");
    if (room.phase === "leaderboard") return go("question", order[position + 1]);
    if (room.phase === "ended") router.push(`/results/${code}`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        if (!busy) next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.phase, room?.current_index, busy, order]);

  if (loading || !mounted) return <p className="p-8 text-graphite">Loading the game…</p>;
  if (error || !room || !set) {
    return (
      <div className="mx-auto w-full max-w-xl p-8">
        <Notice tone="error">{error ?? "No game with that code."}</Notice>
      </div>
    );
  }
  if (!isHost) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4 p-8">
        <Notice>This game is being hosted from another device. You can join it as a player instead.</Notice>
        <LinkButton href={`/play/${code}`}>Join {code}</LinkButton>
      </div>
    );
  }

  const nextLabel = {
    lobby: players.length ? "Start" : "Start anyway",
    question: "Show answer",
    reveal: isLast ? "Finish" : "Leaderboard",
    leaderboard: "Next question",
    ended: "See results",
  }[room.phase];

  const results = room.phase === "ended" ? summarize(set.questions, players, answers) : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Wordmark />
        {room.phase !== "lobby" && (
          <div className="flex items-center gap-3 text-sm sm:text-base">
            <span className="text-graphite">{joinUrl.replace(/^https?:\/\//, "")}</span>
            <span className="rounded-form border-2 border-ink px-3 py-1 text-xl font-bold tracking-[0.2em]">{code}</span>
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-28 sm:px-8">
        {room.phase === "lobby" && (
          <div className="grid flex-1 gap-10 pt-6 lg:grid-cols-[1fr_auto]">
            <div>
              <h1 className="display text-4xl sm:text-5xl">{set.title}</h1>
              <p className="mt-3 text-xl text-graphite">
                {order.length} questions · {room.seconds_per_question}s each
              </p>
              <p className="mt-8 text-xl font-semibold">
                {players.length === 0 ? "Waiting for people to join" : `${players.length} ${players.length === 1 ? "person" : "people"} in`}
              </p>
              <ul className="mt-4 flex flex-wrap gap-2" aria-live="polite">
                {players.map((p) => (
                  <li key={p.id} className="bubble-fill rounded-full border-2 border-ink px-4 py-1.5 text-lg font-semibold">
                    {p.name}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col items-center gap-3 self-start rounded-form border-2 border-ink bg-paper-2 p-6">
              <p className="display text-6xl tracking-[0.15em]">{code}</p>
              {qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt={`QR code to join game ${code}`} className="h-56 w-56 dark:invert" />
              )}
              <p className="text-center text-graphite">
                Scan, or go to <span className="font-semibold text-ink">{joinUrl.replace(/^https?:\/\//, "")}</span>
              </p>
            </div>
          </div>
        )}

        {(room.phase === "question" || room.phase === "reveal") && question && (
          <div className="flex flex-1 flex-col pt-4">
            <div className="flex items-center justify-between text-lg text-graphite">
              <span>
                Question {position + 1} of {order.length}
              </span>
              <span aria-live="polite">
                {room.phase === "question" ? `${answeredNow} of ${players.length} answered` : `${answeredNow} answered`}
              </span>
            </div>
            {room.phase === "question" && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-paper-2" aria-hidden>
                <div
                  className="h-full bg-ink transition-[width] duration-200 ease-linear"
                  style={{ width: `${(secondsLeft / room.seconds_per_question) * 100}%` }}
                />
              </div>
            )}
            <h1 className="display mt-8 text-3xl leading-tight sm:text-5xl">{question.stem}</h1>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2">
              {question.choices.map((c) => {
                const picked = answers.filter((a) => a.question_index === room.current_index && a.choice === c.key).length;
                const revealed = room.phase === "reveal";
                const correct = c.key === question.answer;
                const state = revealed ? (correct ? "correct" : picked ? "wrong" : "dim") : "empty";
                return (
                  <li
                    key={c.key}
                    className={`flex items-center gap-4 rounded-form border-2 p-4 text-xl sm:text-2xl ${
                      revealed && correct ? "border-mark bg-paper-2" : revealed ? "border-rule text-graphite" : "border-ink"
                    }`}
                  >
                    <Bubble letter={c.key} state={state} size="xl" />
                    <span className="flex-1">{c.text}</span>
                    {revealed && (
                      <span className={`text-lg font-semibold ${correct ? "text-mark" : ""}`}>
                        {picked}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {room.phase === "question" && (
              <p className="display mt-auto pt-8 text-right text-7xl tabular-nums" aria-live="off">
                {secondsLeft}
              </p>
            )}
          </div>
        )}

        {room.phase === "leaderboard" && (
          <div className="pt-6">
            <h1 className="display text-4xl sm:text-5xl">Standings</h1>
            <ol className="mt-8 max-w-2xl space-y-2">
              {[...players]
                .sort((a, b) => b.score - a.score)
                .slice(0, 10)
                .map((p, i) => (
                  <li key={p.id} className="flex items-center gap-4 rounded-form border-2 border-ink px-4 py-3 text-xl sm:text-2xl">
                    <span className="w-8 text-graphite">{i + 1}</span>
                    <span className="flex-1 font-semibold">{p.name}</span>
                    <span className="tabular-nums">{p.score.toLocaleString()}</span>
                  </li>
                ))}
            </ol>
          </div>
        )}

        {room.phase === "ended" && results && (
          <div className="pt-6">
            <h1 className="display text-4xl sm:text-5xl">That&apos;s the set.</h1>
            <p className="mt-3 text-xl text-graphite">
              Class average {Math.round(results.classAverage * 100)}%.{" "}
              {results.studyList.length
                ? `${results.studyList.length} ${results.studyList.length === 1 ? "question" : "questions"} worth another look.`
                : "Nothing stumped the room."}
            </p>
            <ol className="mt-8 grid max-w-3xl gap-2 sm:grid-cols-2">
              {results.players.slice(0, 6).map((r, i) => (
                <li key={r.player.id} className="flex items-center gap-4 rounded-form border-2 border-ink px-4 py-3 text-xl">
                  <span className="w-6 text-graphite">{i + 1}</span>
                  <span className="flex-1 font-semibold">{r.player.name}</span>
                  <span className="tabular-nums">{r.player.score.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {actionError && (
          <div className="mt-6">
            <Notice tone="error">{actionError}</Notice>
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t-2 border-rule bg-paper px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <span className="text-sm text-graphite">Space or Enter also moves forward</span>
          <div className="flex gap-2">
            {room.phase !== "ended" && room.phase !== "lobby" && (
              <Button variant="quiet" onClick={() => go("ended")} disabled={busy}>
                End early
              </Button>
            )}
            <Button size="lg" onClick={next} disabled={busy || (room.phase === "lobby" && order.length === 0)}>
              {nextLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
