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

/* --- step 5: the typography is a requirement, not decoration ------------- */

test("body text is serif", () => {
  const body = html.match(/body\s*\{[^}]*\}/);
  assert.ok(body, "no body rule");
  assert.match(body[0], /serif/, "body is not set in a serif");
  assert.ok(!/sans-serif/.test(body[0]), "body is set in a sans");
});

test("the measure is constrained and the leading is generous", () => {
  assert.match(html, /--measure:\s*\d+(\.\d+)?em/, "no measure token");
  assert.match(html, /max-width:\s*var\(--measure\)/, "the measure is not applied");
  const lh = html.match(/font:\s*\d+\s+[\d.]+rem\/([\d.]+)/);
  assert.ok(lh, "body line-height is not set in the font shorthand");
  assert.ok(parseFloat(lh[1]) >= 1.5, `line-height ${lh[1]} is too tight to read`);
});

/* SPEC: "Narration appears below. Not a verdict. The story continues."
   A box, border, background or icon makes it read as feedback. */
test("the narration is not boxed, tinted, or otherwise marked as a response", () => {
  const rule = html.match(/p\.narration\s*\{([^}]*)\}/);
  assert.ok(rule, "the .narration rule is gone — check it did not gain styling elsewhere");
  assert.ok(!/border|background|box-shadow|padding|color\s*:|::before|content/.test(rule[1]),
    "the narration is being styled as a callout: " + rule[1].trim());
});

/* The player's own lines must not compete with the prose. */
test("the player's lines are quieter than the story", () => {
  assert.match(html, /p\.chose[\s\S]{0,200}--quiet/, "the chosen action is not set quiet");
  assert.match(html, /p\.said[\s\S]{0,80}font-style:\s*italic/, "the typed reason is not italic");
});

/* No webfont, no CDN: it must render instantly and offline, and the CSP story
   stays trivial. */
test("nothing is fetched from anywhere", () => {
  assert.ok(!/@import|fonts\.googleapis|fonts\.gstatic|cdn\./i.test(html),
    "the page pulls in an external resource");
  assert.ok(!/<link[^>]+stylesheet/i.test(html), "there is an external stylesheet");
});

test("it is legible in a dark room and on a phone", () => {
  assert.match(html, /prefers-color-scheme:\s*dark/, "no dark scheme");
  assert.match(html, /@media[^{]*max-width/, "no narrow-screen rule");
});

/* --- the 90s chrome ------------------------------------------------------ */

test("the window chrome is present", () => {
  for (const id of ["window", "titlebar", "page", "statusbar"]) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
  assert.match(html, /--desktop:\s*#008080/i, "the teal desktop is gone");
});

/* Four-colour borders are what make a bevel look raised or sunken. A plain
   1px border is a 2010s card, not a 1995 window. */
test("bevels are done with four border colours, and both directions exist", () => {
  const raised = /border-color:\s*#fff\s+var\(--rule\)\s+var\(--rule\)\s+#fff/;
  const sunken = /border-color:\s*var\(--rule\)\s+#fff\s+#fff\s+var\(--rule\)/;
  assert.match(html, raised, "nothing is raised");
  assert.match(html, sunken, "nothing is sunken");
});

/* Period-correct AND the right reading face. The one thing that needed no
   compromise. */
test("the body face is Times New Roman", () => {
  const body = html.match(/body\s*\{[^}]*\}/)[0];
  assert.match(body, /"Times New Roman"/);
});

/* --- flow fixes: what a stranger hits -------------------------------------- */

test("new writing is scrolled into view", () => {
  assert.match(html, /scrollIntoView/, "the player answers and nothing appears to happen");
  /* Presence of the string is not enough — a disabled call still matches. Pin
     the three places the screen changes and must follow the writing. */
  const calls = (html.match(/bringIntoView\(/g) || []).length;
  assert.ok(calls >= 4, `bringIntoView is called ${calls} times; expected the definition plus each place new text lands`);
  assert.match(html, /bringIntoView\(para\(/, "the player's own line is not scrolled to");
  assert.match(html, /show\("done"\)[\s\S]{0,160}bringIntoView\(first\)/, "the ending is not scrolled to");
  assert.match(html, /renderOptions\(next\);\s*\n\s*bringIntoView\(first\)/, "beat 2 is not scrolled to");
});

test("a second player can start again without reloading", () => {
  assert.ok(html.includes('id="again"'), "no restart control");
  assert.match(html, /function restart\(\)/, "no restart function");
  assert.match(html, /again"\)\.addEventListener/, "the restart control is not wired");
  /* it must clear the screen and go back to the first scene */
  assert.match(html, /story"\)\.textContent = ""/, "restart does not clear the story");
  assert.match(html, /state\.sceneId = FIRST_SCENE/, "restart does not return to beat 1");
});

test("the end of the encounter is announced", () => {
  assert.ok(html.includes('id="done"'), "the controls just vanish");
  assert.match(html, /show\("done"\)/, "the done state is never shown");
});

/* SPEC: "One sentence is a fine answer. Nobody should feel they are writing
   for a teacher." Shipped without it the first time. */
test("the input says how little is enough, without hinting what to say", () => {
  assert.ok(html.includes('id="reassure"'), "no reassurance line");
  assert.match(html, /NEL_PROMPT\.reassurance/, "it is not driven by the prose file");
  const { NEL_PROMPT } = require("../public/scenes.js");
  assert.ok(NEL_PROMPT.reassurance, "no reassurance text");
  assert.ok(/sentence|short|few words/i.test(NEL_PROMPT.reassurance), "it should be about length");
  assert.ok(!/boot|mud|marsh|dry|lying|because/i.test(NEL_PROMPT.reassurance),
    "the reassurance leaks the inference");
});
