/* Structural invariants of the scene data.
 *
 * These are the rules SPEC.md states about scenes, turned into assertions.
 * Prose is yours to rewrite freely; these tests fail only if a rewrite breaks
 * a rule the rest of the system depends on.
 *
 *   node --test tests/
 */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { SCENES, GOAL, NEL_PROMPT, FIRST_SCENE } = require("../public/scenes.js");

const BUCKETS = ["INTEGRATED", "PARTIAL", "GENERIC", "CONTRADICTED"];
const PROMPT_FIELDS = ["scene_text", "inference", "detail_a", "detail_b"];
const entries = Object.entries(SCENES);

test("every scene carries the four fields the prompt interpolates", () => {
  for (const [id, s] of entries) {
    for (const f of PROMPT_FIELDS) {
      assert.equal(typeof s[f], "string", `${id}.${f} must be a string`);
      assert.ok(s[f].trim().length > 0, `${id}.${f} must not be empty`);
      assert.ok(!s[f].includes("{{"), `${id}.${f} still contains a placeholder`);
    }
  }
});

test("two or three options, never four — four is already a menu", () => {
  for (const [id, s] of entries) {
    assert.ok(Array.isArray(s.options), `${id}.options must be an array`);
    assert.ok(s.options.length >= 2 && s.options.length <= 3,
      `${id} has ${s.options.length} options`);
    for (const o of s.options) {
      assert.equal(typeof o, "string");
      assert.ok(o.trim().length > 0, `${id} has a blank option`);
    }
  }
});

/* The single rule that separates this from a reading test with the answer
 * printed underneath. "Refuse, his boots are dry" hands over the inference. */
test("options state the action and never the reasoning", () => {
  const reasoning = /\b(because|his boots|the mud|the marsh|lying|dry)\b/i;
  for (const [id, s] of entries) {
    for (const o of s.options) {
      assert.ok(!reasoning.test(o), `${id} option "${o}" leaks the reasoning`);
    }
  }
});

test("beat 1 is reachable and routes all four buckets to real scenes", () => {
  const b1 = SCENES[FIRST_SCENE];
  assert.ok(b1, "FIRST_SCENE does not resolve");
  assert.equal(b1.beat, 1);
  for (const b of BUCKETS) {
    const next = b1.next[b];
    assert.ok(next, `beat 1 has no branch for ${b}`);
    assert.ok(SCENES[next], `${b} points at missing scene "${next}"`);
    assert.equal(SCENES[next].from_bucket, b, `${next} disagrees about its bucket`);
    assert.equal(SCENES[next].beat, 2);
  }
});

test("no beat-2 scene is orphaned", () => {
  const reachable = Object.values(SCENES[FIRST_SCENE].next);
  for (const [id, s] of entries) {
    if (s.beat !== 2) continue;
    assert.ok(reachable.includes(id), `${id} is unreachable`);
  }
});

/* A single fixed ending contradicted whichever option you did not take. */
test("every final option has its own ending", () => {
  for (const [id, s] of entries) {
    if (s.beat !== 2) continue;
    assert.ok(s.endings, `${id} has no endings map`);
    for (const opt of s.options) {
      assert.equal(typeof s.endings[opt], "string", `${id} has no ending for "${opt}"`);
      assert.ok(s.endings[opt].trim().length > 20, `${id} ending for "${opt}" is too short`);
    }
    assert.equal(Object.keys(s.endings).length, s.options.length,
      `${id} has an ending for an option that does not exist`);
  }
});

/* SPEC.md: 150 to 200 words. Difficulty lives in the inference, not volume. */
test("beat 1 is 150-200 words", () => {
  const n = SCENES[FIRST_SCENE].scene_text.split(/\s+/).filter(Boolean).length;
  assert.ok(n >= 150 && n <= 200, `beat 1 is ${n} words`);
});

test("beat 2 scenes stay short enough to re-read", () => {
  for (const [id, s] of entries) {
    if (s.beat !== 2) continue;
    const n = s.scene_text.split(/\s+/).filter(Boolean).length;
    assert.ok(n >= 40 && n <= 200, `${id} is ${n} words`);
  }
});

/* Never say correct, incorrect, well done, or good spotting. Applies to every
 * word we ship, not only to what the model generates. */
test("no shipped prose delivers a verdict", () => {
  const verdict = /\b(correct|incorrect|well done|good spotting|good thinking|right answer|wrong answer)\b/i;
  /* "it counts for more when it's early" was scoring language in a game built
     on never scoring anyone. Catch the softer forms too. */
  const scoring = /\b(counts for|points|score|better next time|you should have)\b/i;
  for (const [id, s] of entries) {
    assert.ok(!verdict.test(s.scene_text), `${id}.scene_text delivers a verdict`);
    assert.ok(!scoring.test(s.scene_text), `${id}.scene_text uses scoring language`);
    for (const e of Object.values(s.endings || {})) {
      assert.ok(!verdict.test(e), `${id} has an ending that delivers a verdict`);
      assert.ok(!scoring.test(e), `${id} has an ending that scores the player`);
    }
  }
});

/* The goal line is what gives a twelve year old a reason to investigate. */
test("the goal line states a role, a clock, and a reason to bother", () => {
  assert.match(GOAL.role, /\S/);
  assert.match(GOAL.tonight, /\S/);
  assert.match(GOAL.tonight, /rain/i, "the deadline should be visible in the goal line");
  /* A Finder works for money. Without the fee, "Go with him" has no upside and
     the INTEGRATED-paired-with-going case stops being a natural answer. */
  assert.match(GOAL.tonight, /pay|paid|money/i, "no reason to take the job");
});

test("the scene makes the offer worth taking", () => {
  assert.match(SCENES[FIRST_SCENE].scene_text, /paid|paying|money/i,
    "going with him has no upside, so it reads as the stupid option");
});

/* "Explain your reasoning" is a worksheet. A character asking why is a
 * conversation. Same data, different feeling. */
test("the why-prompt is asked in the fiction", () => {
  assert.match(NEL_PROMPT.question, /\?$/);
  assert.ok(!/explain your reasoning/i.test(NEL_PROMPT.question));
  assert.ok(!/explain/i.test(NEL_PROMPT.placeholder));
});

test("scene ids are url-safe and unique", () => {
  const ids = Object.keys(SCENES);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/, `${id} is not url-safe`);
});

/* The GENERIC branch is the anti-gaming rule: it must reveal nothing, so a
 * player who types "i dunno" cannot buy the payoff. If the motive leaks into
 * these endings, the whole measurement is decorative. */
test("the GENERIC endings still reveal nothing", () => {
  const g = SCENES[SCENES[FIRST_SCENE].next.GENERIC];
  const reveals = /paid|sent him|never taking|away from her|which of you|the point of him|lure/i;
  for (const [opt, e] of Object.entries(g.endings)) {
    assert.ok(!reveals.test(e), `the GENERIC ending for "${opt}" gives away the motive`);
  }
});

/* SPEC: on INTEGRATED "the world rewards it. Something opens up." The reward
 * has to be new information, not a restatement of the clue they already found. */
test("the INTEGRATED endings open something up without restating the clue", () => {
  const q = SCENES[SCENES[FIRST_SCENE].next.INTEGRATED];
  /* Dorin's motive: he is a lure, sent to walk a Finder out of town. */
  const motive = /paid him|not taking you to her|walking you past her|the whole point of him|told to come back/i;
  for (const [opt, e] of Object.entries(q.endings)) {
    assert.ok(motive.test(e),
      `the INTEGRATED ending for "${opt}" reveals no motive — it is just another clue`);
    /* the boots/mud inference is theirs to keep, not ours to explain back */
    assert.ok(!/\bboots? (are|were) dry\b|\bblack mud\b|\bnot marsh dirt\b/i.test(e),
      `the INTEGRATED ending for "${opt}" explains the inference back to the player`);
  }
});

/* The goal line promises the baker's daughter. An ending that stops at "you
 * worked out he was lying" leaves the player holding all the reading work and
 * none of the reward they were shown at the top of the screen.
 *
 * GENERIC is the exception and must stay one: if "i dunno" also closes the
 * loop, the measurement is decorative. So is CONTRADICTED's "keep walking" —
 * the player was shown the dry road twice and walked on anyway. */
test("every path that earns it actually finds her", () => {
  const closes = /\bshe is\b|\bis inside\b|\bat the top of it\b|\bwalking you past her\b|\bname of the only building\b/i;
  const next = SCENES[FIRST_SCENE].next;

  for (const bucket of ["INTEGRATED", "PARTIAL"]) {
    const s = SCENES[next[bucket]];
    for (const [opt, e] of Object.entries(s.endings)) {
      assert.ok(closes.test(e),
        `${bucket} / "${opt}" never finds her — the Finder does not find anything`);
    }
  }

  const g = SCENES[next.GENERIC];
  for (const [opt, e] of Object.entries(g.endings)) {
    assert.ok(!closes.test(e),
      `the GENERIC ending for "${opt}" finds her — that breaks the anti-gaming rule`);
  }

  const c = SCENES[next.CONTRADICTED];
  assert.ok(!closes.test(c.endings["Keep walking"]),
    "walking on past the dry road twice should not still find her");
  assert.ok(closes.test(c.endings["Ask him where you are"]),
    "turning round is the recovery and should find her");
});
