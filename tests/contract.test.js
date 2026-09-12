/* Guards on the contract files themselves.
 *
 * These exist because the failure they catch has already happened here: the
 * scaffolder writes an AGENTS.md that is entirely {{placeholders}} and nothing
 * ever objects, so the file an agent must read to start reads as a template.
 * An unfilled contract is worse than no contract — the placeholder text gets
 * taken for the brief.
 */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

test("AGENTS.md is filled in, not a template", () => {
  const s = read("AGENTS.md");
  assert.ok(!s.includes("{{"), "AGENTS.md still contains {{placeholders}}");
  assert.ok(!s.includes("<!--"), "AGENTS.md still contains scaffolding comments");
  assert.ok(s.length > 1000, "AGENTS.md is suspiciously short");
});

test("AGENTS.md states the rule the whole design rests on", () => {
  const s = read("AGENTS.md");
  assert.match(s, /Classify the reason, never the chosen action/i);
  assert.match(s, /Never log `player_reason`/i);
  assert.match(s, /Zero npm dependencies/i);
});

test("CLAUDE.md imports AGENTS.md rather than duplicating it", () => {
  assert.match(read("CLAUDE.md").trim(), /^@AGENTS\.md$/);
});

test(".env cannot be committed", () => {
  assert.match(read(".gitignore"), /^\.env$/m);
});

/* Zero npm dependencies is a rule, not an aspiration. */
test("no package.json and no lockfile have appeared", () => {
  for (const f of ["package.json", "package-lock.json", "node_modules"]) {
    assert.ok(!fs.existsSync(path.join(root, f)), f + " exists — rule 6 says it should not");
  }
});

test("every command AGENTS.md claims to have, it has", () => {
  const s = read("AGENTS.md");
  /* check.js is the one command allowed to be absent, and only while the
     table says so out loud. */
  if (!fs.existsSync(path.join(root, "check.js"))) {
    assert.match(s, /Not written yet/, "check.js is missing and AGENTS.md does not say so");
  } else {
    assert.ok(!s.includes("Not written yet"), "check.js exists — remove the caveat");
  }
});

/* The decision log is the only record of why. It shipped as a template for six
 * commits while every real decision went into commit messages, where nobody
 * asking "why that model?" will look. */
test("the decision log is written, not a template", () => {
  const s = read("docs/method/decision-log.md");
  assert.ok(!s.includes("{{"), "the decision log still contains {{placeholders}}");
  const entries = (s.match(/^### /gm) || []).length;
  assert.ok(entries >= 5, `only ${entries} entries — decisions are going unrecorded`);
  assert.match(s, /^## Open questions/m, "no open questions section");
  assert.match(s, /^## Superseded/m, "no superseded section");
});
