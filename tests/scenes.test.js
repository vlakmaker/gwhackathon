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

test("no beat-2 scene is orphaned, and each has an ending", () => {
  const reachable = Object.values(SCENES[FIRST_SCENE].next);
  for (const [id, s] of entries) {
    if (s.beat !== 2) continue;
    assert.ok(reachable.includes(id), `${id} is unreachable`);
    assert.equal(typeof s.ending, "string");
    assert.ok(s.ending.trim().length > 0, `${id} has an empty ending`);
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
  for (const [id, s] of entries) {
    assert.ok(!verdict.test(s.scene_text), `${id}.scene_text delivers a verdict`);
    if (s.ending) assert.ok(!verdict.test(s.ending), `${id}.ending delivers a verdict`);
  }
});

/* The goal line is what gives a twelve year old a reason to investigate. */
test("the goal line states a role and a clock", () => {
  assert.match(GOAL.role, /\S/);
  assert.match(GOAL.tonight, /\S/);
  assert.match(GOAL.tonight, /rain/i, "the deadline should be visible in the goal line");
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
