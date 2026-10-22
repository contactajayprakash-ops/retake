// Screenshots every screen with Playwright so the UI can be checked by eye.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:3000";
const out = process.env.OUT ?? "/tmp/claude-0/-home-claude/871c2bf9-64f7-566b-aecf-6799a48ea647/scratchpad/shots";
import { mkdirSync } from "node:fs";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: process.env.SCHEME ?? "light" });
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && console.log("console error:", m.text()));
page.on("pageerror", (e) => console.log("page error:", e.message));
await page.goto(base + "/");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/01-home.png`, fullPage: true });
console.log("home ok");
await browser.close();
