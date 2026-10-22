// Drives a whole game through the real UI: host makes a set from the
// sample, three players join from separate browser contexts, everyone
// answers, and we screenshot each screen along the way.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.BASE ?? "http://localhost:3000";
const out = process.env.OUT ?? "/tmp/claude-0/-home-claude/871c2bf9-64f7-566b-aecf-6799a48ea647/scratchpad/shots";
const scheme = process.env.SCHEME ?? "light";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
const host = await hostCtx.newPage();
const errors = [];
const wire = (p, tag) => {
  p.on("console", (m) => m.type() === "error" && errors.push(`${tag} console: ${m.text()}`));
  p.on("pageerror", (e) => errors.push(`${tag} page: ${e.message}`));
};
wire(host, "host");

const shot = (p, name) => p.screenshot({ path: `${out}/${name}.png`, fullPage: false });

// 1. Make the sample set
await host.goto(base + "/");
await host.getByRole("button", { name: /12-question sample/ }).click();
await host.waitForURL(/\/sets\//, { timeout: 20000 });
await host.waitForTimeout(1200);
await shot(host, "02-set");
const setUrl = host.url();
console.log("set:", setUrl);

// 2. Set 8 seconds per question and start
await host.getByLabel("Seconds per question").fill("8");
await host.getByRole("button", { name: "Start game" }).click();
await host.waitForURL(/\/host\//, { timeout: 20000 });
const code = host.url().split("/").pop();
console.log("code:", code);
await host.waitForTimeout(1500);
await shot(host, "03-lobby-empty");

// 3. Three players join from phones
const names = ["Rishi", "Maya", "Jordan"];
const players = [];
for (const name of names) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, colorScheme: scheme, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  wire(p, name);
  await p.goto(`${base}/play/${code}`);
  await p.getByLabel("Your name").fill(name);
  await p.getByRole("button", { name: "Join" }).click();
  await p.getByText("You're in.").waitFor({ timeout: 15000 });
  players.push(p);
}
await host.waitForTimeout(1200);
await shot(host, "04-lobby");
await shot(players[0], "05-phone-lobby");

// 4. Play every question. Player 0 always right, player 1 always picks A, player 2 skips odd questions.
// Correct letters for the bundled sample set, in order.
const sample = { answers: ["B", "C", "C", "B", "C", "D", "B", "C", "B", "C", "A", "C"] };
await host.getByRole("button", { name: /^Start/ }).click();
let q = 0;
let shotQuestion = false;
for (;;) {
  // wait for a question or the end
  const state = await Promise.race([
    host.getByText(/^Question \d+ of \d+$/).waitFor({ timeout: 15000 }).then(() => "question"),
    host.getByText("That's the set.").waitFor({ timeout: 15000 }).then(() => "ended"),
  ]);
  if (state === "ended") break;
  q++;
  await host.waitForTimeout(600);
  if (!shotQuestion) {
    await shot(host, "06-host-question");
    await shot(players[0], "07-phone-question");
    shotQuestion = true;
  }
  // players answer
  const answerOn = async (p, pickCorrect, pickLetter) => {
    const buttons = p.getByRole("button", { name: /^[A-E]\. / });
    const count = await buttons.count();
    if (count === 0) return;
    if (pickCorrect) {
      // The host screen knows the answer; read it from the page's data via the choices order on the host after reveal.
      // Simpler: the phone doesn't know, so pick by letter from the known sample answers.
      const letter = sample?.answers?.[q - 1] ?? "B";
      const b = p.getByRole("button", { name: new RegExp(`^${letter}\\. `) });
      if ((await b.count()) > 0) await b.first().click();
      else await buttons.first().click();
    } else if (pickLetter) {
      const b = p.getByRole("button", { name: new RegExp(`^${pickLetter}\\. `) });
      if ((await b.count()) > 0) await b.first().click();
    }
  };
  await answerOn(players[0], true);
  await players[0].waitForTimeout(300);
  await answerOn(players[1], false, "A");
  if (q % 2 === 0) await answerOn(players[2], false, "C");
  // host auto-reveals when time is up or everyone answered; wait for reveal
  await host.getByRole("button", { name: /Leaderboard|Finish/ }).waitFor({ timeout: 15000 });
  await host.waitForTimeout(500);
  if (q === 1) {
    await shot(host, "08-host-reveal");
    await shot(players[0], "09-phone-right");
    await shot(players[1], "10-phone-wrong");
  }
  await host.getByRole("button", { name: /Leaderboard|Finish/ }).click();
  if (q === 2) {
    await host.waitForTimeout(500);
    await shot(host, "11-host-leaderboard");
  }
  const nextBtn = host.getByRole("button", { name: /Next question|See results/ });
  await nextBtn.waitFor({ timeout: 15000 });
  if ((await nextBtn.textContent())?.includes("See results")) break;
  await nextBtn.click();
}
await host.waitForTimeout(800);
await shot(host, "12-host-ended");
await shot(players[1], "13-phone-ended");

// 5. Results
await host.goto(`${base}/results/${code}`);
await host.waitForTimeout(1500);
await host.screenshot({ path: `${out}/14-results.png`, fullPage: true });
await host.getByRole("tab", { name: "Table" }).click();
await host.waitForTimeout(300);
await host.screenshot({ path: `${out}/15-results-table.png`, fullPage: true });

console.log("questions played:", q);
console.log("errors:", errors.length ? errors : "none");
await browser.close();
