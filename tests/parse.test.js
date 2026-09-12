/* The defensive parse.
 *
 * response_format json_object is requested but never trusted. Every shape
 * below has come back from a real model at some point; the demo must survive
 * all of them without showing a stack trace.
 */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { extractJSON, normaliseBucket } = require("../netlify/functions/turn.js");

test("plain JSON object", () => {
  assert.deepEqual(extractJSON('{"bucket":"PARTIAL","narration":"x"}'),
    { bucket: "PARTIAL", narration: "x" });
});

test("wrapped in a json fence", () => {
  assert.deepEqual(extractJSON('```json\n{"bucket":"GENERIC","narration":"y"}\n```'),
    { bucket: "GENERIC", narration: "y" });
});

test("wrapped in a bare fence", () => {
  assert.deepEqual(extractJSON('```\n{"bucket":"GENERIC","narration":"y"}\n```'),
    { bucket: "GENERIC", narration: "y" });
});

/* The brace-slice fallback cannot rescue this one: slicing first-{ to last-}
 * swallows the closing fence and the braces in the trailing sentence. Only
 * stripping the fence first gets it, which is why that branch exists. */
test("a fence followed by prose containing braces", () => {
  assert.deepEqual(
    extractJSON('```json\n{"bucket":"PARTIAL","narration":"x"}\n```\nTell me if you want {more}.'),
    { bucket: "PARTIAL", narration: "x" });
});

test("buried in conversational padding", () => {
  assert.deepEqual(
    extractJSON('Sure! Here you go:\n{"bucket":"INTEGRATED","narration":"z"}\nHope that helps.'),
    { bucket: "INTEGRATED", narration: "z" });
});

test("narration containing braces and quotes still parses", () => {
  const o = extractJSON('{"bucket":"INTEGRATED","narration":"She says \\"go\\" and {waits}."}');
  assert.equal(o.bucket, "INTEGRATED");
  assert.equal(o.narration, 'She says "go" and {waits}.');
});

test("unusable input returns null rather than throwing", () => {
  for (const bad of ["not json at all", "", "   ", null, undefined, 42, "[1,2,3]", "{oops"]) {
    assert.equal(extractJSON(bad), null, JSON.stringify(bad) + " should be null");
  }
});

test("bucket normalises across casing and punctuation", () => {
  const cases = {
    "INTEGRATED": "INTEGRATED", "integrated": "INTEGRATED", "Integrated.": "INTEGRATED",
    "  PARTIAL  ": "PARTIAL", "partial,": "PARTIAL",
    "contradicted": "CONTRADICTED", "CONTRADICTED-": "CONTRADICTED",
    "generic": "GENERIC", "bucket: GENERIC": "GENERIC"
  };
  for (const [input, want] of Object.entries(cases)) {
    assert.equal(normaliseBucket(input), want, JSON.stringify(input));
  }
});

test("an unknown bucket is null, never a guess", () => {
  for (const bad of ["MAYBE", "GOOD", "", null, undefined, 42, {}, []]) {
    assert.equal(normaliseBucket(bad), null, JSON.stringify(bad));
  }
});

/* Two buckets named at once means the model hedged. Picking one would be
 * inventing a classification the model did not make. */
test("an ambiguous answer naming two buckets is null", () => {
  assert.equal(normaliseBucket("INTEGRATED or PARTIAL"), null);
  assert.equal(normaliseBucket("somewhere between GENERIC and PARTIAL"), null);
});

/* --- what actually broke in a real play session -------------------------- *
 * A narration is prose, so the model writes dialogue in it. One unescaped
 * quotation mark and every JSON.parse strategy above fails on output that is
 * otherwise perfectly usable. The player saw the flat fallback mid-scene.
 */

test("unescaped quotes inside the narration are salvaged", () => {
  const raw = '{"bucket": "PARTIAL", "narration": "Dorin looks down. "Clean?" he says. "The wind dried them.""}';
  const o = extractJSON(raw);
  assert.ok(o, "should not give up on this");
  assert.equal(normaliseBucket(o.bucket), "PARTIAL");
  assert.ok(o.narration.includes("Clean?"), "the narration should survive");
});

test("a raw newline inside the narration is salvaged", () => {
  const raw = '{"bucket": "INTEGRATED", "narration": "You stand.\nThe fire settles."}';
  const o = extractJSON(raw);
  assert.ok(o);
  assert.equal(normaliseBucket(o.bucket), "INTEGRATED");
  assert.ok(o.narration.length > 10);
});

test("salvage works inside a fence too", () => {
  const raw = '```json\n{"bucket": "CONTRADICTED", "narration": "He says "come on" and walks."}\n```';
  const o = extractJSON(raw);
  assert.ok(o);
  assert.equal(normaliseBucket(o.bucket), "CONTRADICTED");
});

test("salvage does not invent a result from nothing", () => {
  for (const bad of ["not json at all", "", "{oops", "[1,2,3]", "I cannot help with that"]) {
    assert.equal(extractJSON(bad), null, JSON.stringify(bad));
  }
});

test("a bucket with no narration is still rejected after salvage", () => {
  const o = extractJSON('{"bucket": "INTEGRATED"}');
  assert.ok(!o || !o.narration, "must not fabricate a narration");
});

/* Must be unparseable AND missing the narration, or salvage never runs and the
   test proves nothing. This is the shape of a reply truncated mid-write. */
test("salvage will not invent story text it cannot find", () => {
  for (const truncated of ['{"bucket": "INTEGRATED", "narration"',
                           '{"bucket": "PARTIAL" and then it stopped']) {
    const o = extractJSON(truncated);
    assert.ok(!o || !o.narration, "invented a narration from " + JSON.stringify(truncated));
  }
});
