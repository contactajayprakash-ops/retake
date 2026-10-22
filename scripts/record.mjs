// Records real footage of the deployed app for the demo video: a host
// screen at 1080p and a phone, both driven through the actual UI, with a
// handful of simulated classmates answering through the API so the results
// sheet has something to show.
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const base = process.env.BASE ?? "https://retake-app.vercel.app";
const out = process.env.OUT ?? "/tmp/claude-0/-home-claude/871c2bf9-64f7-566b-aecf-6799a48ea647/scratchpad/footage";
mkdirSync(out, { recursive: true });
const env = Object.fromEntries(readFileSync(".env.local", "utf8").trim().split("\n").map((l) => l.split("=")));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const SECONDS = 12;
const ANSWERS = ["B", "C", "C", "B", "C", "D", "B", "C", "B", "C", "A", "C"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const mark = (label) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${label}`);

const browser = await chromium.launch();

// ---------------------------------------------------------------------------
// Scene A: upload the PDF, review, start a game. Host context 1.
// ---------------------------------------------------------------------------
const hostA = await browser.newContext({
  viewport: { width: 1440, height: 810 },
  deviceScaleFactor: 4 / 3,
  colorScheme: "light",
  recordVideo: { dir: path.join(out, "host-a"), size: { width: 1920, height: 1080 } },
});
const ha = await hostA.newPage();
await ha.goto(base + "/");
mark("A home");
await sleep(2500);
const chooser = ha.waitForEvent("filechooser");
await ha.getByRole("button", { name: "Choose a PDF" }).click();
const fc = await chooser;
await fc.setFiles("public/AP-Bio-Unit-2-Practice-Test.pdf");
mark("A pdf chosen");
await ha.waitForURL(/\/sets\//, { timeout: 30000 });
mark("A review page");
await sleep(2500);
await ha.mouse.wheel(0, 500);
await sleep(1800);
await ha.mouse.wheel(0, 600);
await sleep(1800);
await ha.mouse.wheel(0, -1100);
await sleep(1000);
// export menu peek
await ha.getByRole("button", { name: "Export" }).click();
mark("A export open");
await sleep(2500);
await ha.keyboard.press("Escape");
await sleep(600);
await ha.getByLabel("Seconds per question").fill(String(SECONDS));
await sleep(800);
await ha.getByRole("button", { name: "Start game" }).click();
await ha.waitForURL(/\/host\//, { timeout: 30000 });
const code = ha.url().split("/").pop();
mark(`A lobby ${code}`);
await sleep(1500);
const hostKey = await ha.evaluate((c) => localStorage.getItem(`retake:host:${c}`), code);
const setId = await ha.evaluate(() => location.pathname);

// ---------------------------------------------------------------------------
// Scene B: a phone joins. Phone context.
// ---------------------------------------------------------------------------
const phoneCtx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  colorScheme: "light",
  recordVideo: { dir: path.join(out, "phone"), size: { width: 780, height: 1688 } },
});
const ph = await phoneCtx.newPage();
await ph.goto(`${base}/play/${code}`);
mark("B phone join page");
await sleep(1500);
await ph.getByLabel("Your name").click();
await ph.getByLabel("Your name").pressSequentially("Ajay", { delay: 110 });
await sleep(600);
await ph.getByRole("button", { name: "Join" }).click();
await ph.getByText("You're in.").waitFor({ timeout: 15000 });
mark("B phone in lobby");

// Simulated classmates join through the API, spaced out so the lobby fills visibly.
const names = ["Rishi", "Maya", "Jordan", "Priya", "Ethan", "Sofia", "Noah", "Aanya"];
const seats = [];
for (const name of names) {
  const { data } = await sb.rpc("join_room", { p_code: code, p_name: name });
  seats.push({ name, key: data.player_key });
  await sleep(450);
}
mark("A lobby full");
await sleep(2500);

// ---------------------------------------------------------------------------
// Scene C: play. Host keeps recording in context 1. Phone answers through
// the UI; classmates answer through the API with a mix of right and wrong.
// ---------------------------------------------------------------------------
// accuracy per classmate, and a shared "trap" wrong answer on some questions
const accuracy = [0.95, 0.85, 0.75, 0.7, 0.6, 0.55, 0.45, 0.35];
const trapQuestions = { 1: "A", 7: "B", 8: "A", 10: "C" }; // index -> tempting wrong letter

const classmatesAnswer = async (qi) => {
  const correct = ANSWERS[qi];
  await Promise.all(
    seats.map(async (s, i) => {
      await sleep(900 + Math.random() * 4000 + i * 150);
      let choice;
      if (Math.random() < accuracy[i]) choice = correct;
      else if (trapQuestions[qi] && Math.random() < 0.75) choice = trapQuestions[qi];
      else choice = "ABCD".replace(correct, "")[Math.floor(Math.random() * 3)];
      await sb.rpc("submit_answer", { p_code: code, p_player_key: s.key, p_question_index: qi, p_choice: choice });
    }),
  );
};

const phoneAnswer = async (qi) => {
  const letter = qi === 1 ? "A" : qi === 7 ? "B" : ANSWERS[qi]; // Ajay misses two on purpose
  const btn = ph.getByRole("button", { name: new RegExp(`^${letter}\\. `) });
  await btn.waitFor({ timeout: 15000 });
  await sleep(1400 + Math.random() * 1200);
  await btn.click();
};

await ha.getByRole("button", { name: /^Start/ }).click();
mark("C start");
for (let qi = 0; qi < ANSWERS.length; qi++) {
  await ha.getByText(`Question ${qi + 1} of ${ANSWERS.length}`).waitFor({ timeout: 20000 });
  mark(`C question ${qi + 1}`);
  await Promise.all([phoneAnswer(qi), classmatesAnswer(qi)]);
  await ha.getByRole("button", { name: /Leaderboard|Finish/ }).waitFor({ timeout: 30000 });
  mark(`C reveal ${qi + 1}`);
  await sleep(qi < 2 ? 3500 : 1800);
  await ha.getByRole("button", { name: /Leaderboard|Finish/ }).click();
  const next = ha.getByRole("button", { name: /Next question|See results/ });
  await next.waitFor({ timeout: 20000 });
  mark(`C after ${qi + 1}`);
  await sleep(qi < 2 ? 2500 : 1200);
  if ((await next.textContent())?.includes("See results")) break;
  await next.click();
}
mark("C ended");
await sleep(3000);
await ph.getByText(/to study|got them all/).waitFor({ timeout: 15000 });
await sleep(1500);
await ph.mouse.wheel(0, 400);
await sleep(1500);

// ---------------------------------------------------------------------------
// Scene D: results.
// ---------------------------------------------------------------------------
await ha.getByRole("button", { name: "See results" }).click();
await ha.waitForURL(/\/results\//, { timeout: 20000 });
await ha.getByText("Study these first").waitFor({ timeout: 20000 });
mark("D results");
await sleep(3500);
// open the hardest question from the study list
const firstStudy = ha.locator("aside ol li button").first();
await firstStudy.click();
mark("D expanded");
await sleep(3500);
await ha.getByRole("tab", { name: "Table" }).click();
await sleep(2500);
await ha.getByRole("tab", { name: "Answer sheet" }).click();
await sleep(1500);
mark("D done");

await hostA.close();
await phoneCtx.close();
await browser.close();
console.log("code", code, "set", setId, "hostKey?", Boolean(hostKey));
