"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bubble } from "@/components/Bubble";
import { Button, Field, Notice, inputClass } from "@/components/ui";
import { createRoom, getSet, storageKey, updateSet } from "@/lib/game/api";
import { useStoredValue } from "@/lib/game/useStored";
import type { SetRow } from "@/lib/game/types";
import { CHOICE_KEYS, type ChoiceKey, type Question } from "@/lib/questions/types";
import { ExportMenu } from "./ExportMenu";

export function SetEditor({ id }: { id: string }) {
  const router = useRouter();
  const [set, setSet] = useState<SetRow | null | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [seconds, setSeconds] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const canEdit = Boolean(useStoredValue(storageKey.edit(id)));

  useEffect(() => {
    getSet(id)
      .then((row) => {
        setSet(row);
        if (row) {
          setTitle(row.title);
          setQuestions(row.questions);
        }
      })
      .catch((err) => setError(err.message));
  }, [id]);

  const unanswered = useMemo(() => questions.filter((q) => !q.answer).length, [questions]);
  const playable = questions.filter((q) => q.answer && q.choices.length >= 2);

  const patch = (index: number, change: Partial<Question>) => {
    setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...change, warnings: [] } : q)));
    setDirty(true);
  };

  const remove = (index: number) => {
    setQuestions((qs) => qs.filter((_, i) => i !== index));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateSet(id, title, questions);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  const host = async () => {
    setStarting(true);
    setError(null);
    try {
      if (dirty && canEdit) await updateSet(id, title, questions);
      const code = await createRoom(id, seconds);
      router.push(`/host/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start a game.");
      setStarting(false);
    }
  };

  if (set === undefined && !error) return <p className="pt-8 text-graphite">Loading the set…</p>;
  if (set === null) {
    return (
      <div className="pt-8">
        <Notice tone="error">That set doesn&apos;t exist. The link may be wrong.</Notice>
      </div>
    );
  }

  return (
    <div className="pt-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          {canEdit ? (
            <input
              className="display w-full bg-transparent text-3xl sm:text-4xl"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
              aria-label="Set title"
            />
          ) : (
            <h1 className="display text-3xl sm:text-4xl">{title}</h1>
          )}
          <p className="mt-2 text-graphite">
            {questions.length} questions
            {unanswered > 0 && (
              <>
                {" "}
                · <span className="text-redpen">{unanswered} without an answer</span>
              </>
            )}
            {set?.source_name && <> · from {set.source_name}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu title={title} questions={playable} />
          {canEdit && (
            <Button variant="quiet" onClick={save} disabled={!dirty || saving}>
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4 rounded-form border-2 border-ink bg-paper-2 p-4">
        <div className="flex-1">
          <p className="text-lg font-bold">Host a live game</p>
          <p className="text-sm text-graphite">
            {playable.length === questions.length
              ? `All ${playable.length} questions will be played.`
              : `${playable.length} of ${questions.length} will be played; questions without an answer are skipped.`}
          </p>
        </div>
        <Field label="Seconds per question">
          <input
            type="number"
            min={5}
            max={120}
            value={seconds}
            onChange={(e) => setSeconds(Number(e.target.value) || 20)}
            className={`${inputClass} w-28`}
          />
        </Field>
        <Button size="lg" onClick={host} disabled={starting || playable.length === 0}>
          {starting ? "Starting…" : "Start game"}
        </Button>
      </div>

      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {!canEdit && (
        <div className="mt-4">
          <Notice>This set was made on another device, so it&apos;s read-only here. You can still host it or export it.</Notice>
        </div>
      )}

      <ol className="mt-8 space-y-6">
        {questions.map((q, i) => (
          <li key={q.id} className="rounded-form border-2 border-rule p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="mt-1 w-7 shrink-0 text-right text-sm font-semibold text-graphite">{i + 1}.</span>
              <div className="min-w-0 flex-1 space-y-3">
                {canEdit ? (
                  <textarea
                    className={`${inputClass} min-h-16 resize-y`}
                    value={q.stem}
                    onChange={(e) => patch(i, { stem: e.target.value })}
                    aria-label={`Question ${i + 1}`}
                  />
                ) : (
                  <p className="text-lg">{q.stem}</p>
                )}
                <ul className="space-y-2">
                  {q.choices.map((c, ci) => {
                    const isAnswer = q.answer === c.key;
                    return (
                      <li key={c.key} className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => patch(i, { answer: c.key })}
                          className="rounded-full disabled:cursor-default"
                          aria-pressed={isAnswer}
                          aria-label={`Mark ${c.key} as the correct answer`}
                          title={canEdit ? "Mark as correct" : undefined}
                        >
                          <Bubble letter={c.key} state={isAnswer ? "correct" : "empty"} />
                        </button>
                        {canEdit ? (
                          <input
                            className={`${inputClass} py-1`}
                            value={c.text}
                            onChange={(e) =>
                              patch(i, {
                                choices: q.choices.map((cc, j) => (j === ci ? { ...cc, text: e.target.value } : cc)),
                              })
                            }
                            aria-label={`Choice ${c.key}`}
                          />
                        ) : (
                          <span className={isAnswer ? "font-semibold" : ""}>{c.text}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {canEdit && q.choices.length < 5 && (
                  <button
                    type="button"
                    className="text-sm font-semibold text-graphite underline-offset-4 hover:underline"
                    onClick={() =>
                      patch(i, {
                        choices: [...q.choices, { key: CHOICE_KEYS[q.choices.length] as ChoiceKey, text: "" }],
                      })
                    }
                  >
                    Add choice {CHOICE_KEYS[q.choices.length]}
                  </button>
                )}
                {q.warnings.length > 0 && (
                  <ul className="space-y-1">
                    {q.warnings.map((w) => (
                      <li key={w} className="text-sm text-redpen">
                        {w}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="shrink-0 rounded-form px-2 py-1 text-sm font-semibold text-graphite hover:text-redpen"
                  aria-label={`Remove question ${i + 1}`}
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
