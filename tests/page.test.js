/* The page's contract.
 *
 * No browser here, so this is static analysis of index.html: the structure the
 * flow depends on, and the rules the page could quietly break — showing the
 * player their bucket, saving state, or grading them.
 */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

test("scenes.js is loaded before the script that uses it", () => {
  const s = html.indexOf('src="scenes.js"');
  const inline = html.indexOf("<script>\n\"use strict\"");
  assert.ok(s > -1, "scenes.js is not loaded");
  assert.ok(inline > s, "the inline script runs before scenes.js");
});

test("every element the flow reaches for exists", () => {
  for (const id of ["goal-role", "goal-tonight", "story", "options", "why",
                    "nel-stage", "nel-question", "reason", "send", "pending"]) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
});

test("it posts to the function, not to a model directly", () => {
  assert.ok(html.includes("/.netlify/functions/turn"));
  assert.ok(!/openrouter|api\.openai|anthropic\.com/i.test(html),
    "the page must never call a model provider directly — the key would be in the browser");
  assert.ok(!/sk-or-|Bearer /.test(html), "no credential material in the page");
});

/* The bucket is the measurement. Showing it turns this back into a score. */
test("the bucket is never rendered", () => {
  for (const b of ["INTEGRATED", "PARTIAL", "CONTRADICTED"]) {
    const shown = new RegExp(`(textContent|innerHTML|innerText|para)\\s*(=|\\()\\s*["'\`][^"'\`]*${b}`);
    assert.ok(!shown.test(html), `${b} looks like it reaches the DOM`);
  }
  assert.ok(!/id="bucket"|class="bucket"/.test(html), "there is a bucket element");
});

/* No accounts, no database, no localStorage, no save state, no analytics. */
test("nothing is stored and nothing is tracked", () => {
  for (const bad of ["localStorage", "sessionStorage", "indexedDB", "document.cookie",
                     "gtag", "analytics", "plausible", "mixpanel"]) {
    assert.ok(!html.includes(bad), `${bad} appears in the page`);
  }
});

test("the input is disabled while a call is in flight, and comes back", () => {
  assert.ok(/reason"\)\.disabled = true/.test(html), "input is never disabled");
  assert.ok(/reason"\)\.disabled = false/.test(html), "input is never re-enabled");
  assert.ok(/inFlight/.test(html), "no in-flight guard against a double submit");
  assert.ok(/hidden = /.test(html) && html.includes('id="pending"'), "no pending state");
});

/* A failed fetch must still produce a sentence. */
test("a dead network still yields a narration", () => {
  assert.ok(/catch\s*\(/.test(html), "the fetch is not wrapped");
  assert.ok(/OFFLINE_NARRATION/.test(html), "no client-side fallback narration");
});

test("the page copy never grades the player", () => {
  const verdict = /\b(correct|incorrect|well done|good spotting|good thinking|score|points|you win|you lose)\b/i;
  /* comments are ours, not the player's — check only rendered text */
  const visible = html.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!verdict.test(visible), "a verdict word is reachable by the player");
});

test("the goal line is in the markup, not invented at runtime", () => {
  assert.ok(html.includes("GOAL.role") && html.includes("GOAL.tonight"),
    "the goal line should come from scenes.js");
});

/* The player's own words are the thing being measured; the log showed the
 * button they pressed and nothing they wrote. */
test("the typed reason is appended to the story", () => {
  assert.ok(/para\(\s*said/.test(html), "the reason is never rendered");
  assert.ok(/reason\.trim\(\)/.test(html), "the reason is not trimmed before display");
});
