# Retake

Drop a practice test PDF, play it as a live class game, and end with the list of questions the room actually got wrong.

Built solo for [Neighborhood Hacks 2026](https://neighborhood-hacks-2026.devpost.com/).

## What it does

1. **Upload** a review packet or released exam as a PDF (or paste the text). Retake pulls out the numbered questions and lettered choices, and uses the answer key if there is one.
2. **Review** the questions, fix anything the parser got wrong, mark missing answers.
3. **Host** a live game from any laptop or Chromebook. Players join from their phones with a six-letter code. No accounts, no app.
4. **See what everyone missed.** The game ends with an answer sheet for the whole class: the correct bubble in green, red pen over the wrong answers scaled by how many people picked them, and a "study these first" list.

Sets also export to Gimkit, Blooket, Kahoot and Quizlet in their native import formats.

## Stack

- Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind 4
- Supabase (Postgres + Realtime) with row-level security; every write goes through a SQL function keyed by a secret only the host, player or set owner holds
- `unpdf` for PDF text extraction, a rule-based parser for questions (`src/lib/questions/parse.ts`, with tests)
- Playwright for an end-to-end test that plays a whole game with three players (`scripts/e2e.mjs`)
- Deployed on Vercel

## Run it

```bash
npm install
cp .env.example .env.local   # fill in a Supabase project URL + anon key
# run supabase/schema.sql in the Supabase SQL editor once
npm run dev
```

Tests: `npx vitest run`. End to end (needs the dev server running): `node scripts/e2e.mjs`.

## Layout

```
src/app/              routes: / (upload), /sets/[id] (review), /host/[code], /play/[code], /results/[code], /join
src/app/api/extract   PDF or text -> questions
src/lib/questions     parser, exporters, sample set
src/lib/game          Supabase calls, realtime subscription, results math
src/components        Bubble (the scantron bubble everything is built from), buttons, page shell
supabase/schema.sql   tables, RLS, and the RPCs
```

## AI disclosure

Written with Claude (Anthropic) as a coding assistant during the hacking period. Design decisions, the problem, the testing and the submission are mine.
