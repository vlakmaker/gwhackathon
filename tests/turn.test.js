/* The turn handler, with the network stubbed.
 *
 * No key, no netlify dev, no model. What is under test here is everything the
 * acceptance run in check.js cannot see: the retry, the failure routes, the
 * request we actually send, and the two things we promised never to leak.
 *
 * Classification quality is NOT tested here — that needs a live model and
 * lives in check.js. These tests must stay deterministic and offline.
 */
"use strict";
const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const turn = require("../netlify/functions/turn.js");
const { handler, MODEL, FALLBACK_MODEL } = turn;

const FAKE_KEY = "sk-or-v1-TESTKEYTESTKEYTESTKEY";
const REASON   = "his boots are dry, he was never in the marsh";

let calls, realFetch, logs, realLog, realError;

beforeEach(() => {
  calls = []; logs = [];
  process.env.OPENROUTER_API_KEY = FAKE_KEY;
  process.env.URL = "https://example.test";
  realFetch = globalThis.fetch;
  realLog = console.log; realError = console.error;
  console.log = (...a) => logs.push(a.join(" "));
  console.error = (...a) => logs.push(a.join(" "));
});

afterEach(() => {
  globalThis.fetch = realFetch;
  console.log = realLog; console.error = realError;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.URL;
});

/* --- helpers ----------------------------------------------------------- */

const ok = (content) => ({
  ok: true, status: 200,
  json: async () => ({ choices: [{ message: { content } }] })
});
const httpErr = (status) => ({ ok: false, status, json: async () => ({}) });
const aborted = () => { const e = new Error("aborted"); e.name = "AbortError"; throw e; };

/* replies: one entry per expected call, each a fn returning a response */
function stubFetch(...replies) {
  let i = 0;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts, body: JSON.parse(opts.body) });
    const r = replies[Math.min(i, replies.length - 1)];
    i++;
    return r();
  };
}

const post = (body) => handler({ httpMethod: "POST", body: JSON.stringify(body) });
const turnBody = (over = {}) => Object.assign(
  { scene_id: "greyford-inn", chosen_option: "Refuse", player_reason: REASON }, over);

const GOOD = '{"bucket":"INTEGRATED","narration":"Dorin stops talking."}';

/* --- the happy path ----------------------------------------------------- */

test("a good response passes bucket and narration through", async () => {
  stubFetch(() => ok(GOOD));
  const res = await post(turnBody());
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), {
    bucket: "INTEGRATED", narration: "Dorin stops talking."
  });
});

/* Latency is the demo risk. Two calls per turn is the design being violated. */
test("exactly one upstream call on the happy path", async () => {
  stubFetch(() => ok(GOOD));
  await post(turnBody());
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.model, MODEL);
});

test("the request carries the headers OpenRouter asks for", async () => {
  stubFetch(() => ok(GOOD));
  await post(turnBody());
  const h = calls[0].opts.headers;
  assert.equal(h.Authorization, "Bearer " + FAKE_KEY);
  assert.equal(h["HTTP-Referer"], "https://example.test");
  assert.ok(h["X-Title"], "X-Title must be set");
  assert.equal(calls[0].url, "https://openrouter.ai/api/v1/chat/completions");
});

test("the prompt is built from the scene's own data", async () => {
  const { SCENES } = require("../public/scenes.js");
  const s = SCENES["greyford-inn"];
  stubFetch(() => ok(GOOD));
  await post(turnBody());
  const prompt = calls[0].body.messages[0].content;
  for (const f of ["scene_text", "inference", "detail_a", "detail_b"]) {
    assert.ok(prompt.includes(s[f]), "prompt is missing " + f);
  }
  assert.ok(prompt.includes(REASON), "prompt is missing the player's reason");
  assert.ok(prompt.includes("Refuse"), "prompt is missing the chosen action");
});

/* If this line is ever edited away, the classifier starts grading obedience
 * and the whole design quietly inverts. Worth a test of its own. */
test("the prompt keeps the instruction that makes this measure reading", async () => {
  stubFetch(() => ok(GOOD));
  await post(turnBody());
  const prompt = calls[0].body.messages[0].content;
  assert.ok(prompt.includes("Never classify the chosen action."));
  assert.ok(prompt.includes("Either action can be paired with any bucket."));
  assert.ok(prompt.includes("Never say correct, incorrect, right, wrong, well done, or good thinking."));
  assert.ok(prompt.includes("Never restate or explain the hidden inference."));
  assert.ok(prompt.includes("Another beat follows this one."));
});

test("json_object is requested even though the parse does not rely on it", async () => {
  stubFetch(() => ok(GOOD));
  await post(turnBody());
  assert.deepEqual(calls[0].body.response_format, { type: "json_object" });
});

/* --- the retry ---------------------------------------------------------- */

test("a non-2xx retries once, on the fallback model", async () => {
  stubFetch(() => httpErr(503), () => ok(GOOD));
  const res = await post(turnBody());
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.model, MODEL);
  assert.equal(calls[1].body.model, FALLBACK_MODEL);
  assert.equal(JSON.parse(res.body).bucket, "INTEGRATED");
});

test("a timeout retries once, on the fallback model", async () => {
  stubFetch(aborted, () => ok(GOOD));
  const res = await post(turnBody());
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.model, FALLBACK_MODEL);
  assert.equal(JSON.parse(res.body).bucket, "INTEGRATED");
});

test("it gives up after the retry — never a third call", async () => {
  stubFetch(() => httpErr(500));
  const res = await post(turnBody());
  assert.equal(calls.length, 2);
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).bucket, "GENERIC");
});

/* --- degrading instead of throwing -------------------------------------- */

test("garbage from the model lands GENERIC with a narration", async () => {
  for (const junk of ["I cannot help with that", "", "```json\n{oops\n```"]) {
    calls = [];
    stubFetch(() => ok(junk));
    const res = await post(turnBody());
    const b = JSON.parse(res.body);
    assert.equal(res.statusCode, 200);
    assert.equal(b.bucket, "GENERIC");
    assert.ok(b.narration && b.narration.length > 0);
  }
});

test("an unknown bucket is not passed through", async () => {
  stubFetch(() => ok('{"bucket":"EXCELLENT","narration":"nice one"}'));
  const b = JSON.parse((await post(turnBody())).body);
  assert.equal(b.bucket, "GENERIC");
  assert.ok(!b.narration.includes("nice one"), "narration from a rejected bucket must not ship");
});

test("a bucket with no narration is rejected", async () => {
  stubFetch(() => ok('{"bucket":"INTEGRATED"}'));
  assert.equal(JSON.parse((await post(turnBody())).body).bucket, "GENERIC");
});

test("a thrown network error does not escape the handler", async () => {
  globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
  const res = await post(turnBody());
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).bucket, "GENERIC");
});

/* --- input the demo will actually receive -------------------------------- */

test("empty or one-character reasons are GENERIC without spending a call", async () => {
  for (const r of ["", " ", "x", null, undefined]) {
    calls = [];
    stubFetch(() => ok(GOOD));
    const b = JSON.parse((await post(turnBody({ player_reason: r }))).body);
    assert.equal(b.bucket, "GENERIC", JSON.stringify(r));
    assert.ok(b.narration.length > 0);
    assert.equal(calls.length, 0, "should not call the model for " + JSON.stringify(r));
  }
});

test("an essay is capped, not rejected", async () => {
  stubFetch(() => ok(GOOD));
  const res = await post(turnBody({ player_reason: "a".repeat(50000) }));
  assert.equal(res.statusCode, 200);
  assert.ok(calls[0].body.messages[0].content.length < 20000, "prompt should be capped");
});

test("a missing key degrades instead of erroring", async () => {
  delete process.env.OPENROUTER_API_KEY;
  stubFetch(() => ok(GOOD));
  const res = await post(turnBody());
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).bucket, "GENERIC");
  assert.equal(calls.length, 0);
});

test("unknown scene_id, bad method and bad JSON all degrade cleanly", async () => {
  stubFetch(() => ok(GOOD));
  const cases = [
    [await post(turnBody({ scene_id: "nope" })), 400],
    [await handler({ httpMethod: "GET" }), 405],
    [await handler({ httpMethod: "POST", body: "{{{" }), 400]
  ];
  for (const [res, status] of cases) {
    assert.equal(res.statusCode, status);
    const b = JSON.parse(res.body);
    assert.equal(b.bucket, "GENERIC");
    assert.ok(b.narration.length > 0, "even a rejection gets a narration");
  }
  assert.equal(calls.length, 0);
});

/* --- the two things we promised never to leak ---------------------------- */

test("the key never appears in any response body", async () => {
  const scenarios = [
    () => ok(GOOD), () => httpErr(401), () => httpErr(500), aborted, () => ok("garbage")
  ];
  for (const s of scenarios) {
    stubFetch(s);
    const res = await post(turnBody());
    assert.ok(!res.body.includes(FAKE_KEY), "key leaked into a response body");
    assert.ok(!/sk-or-/.test(res.body), "key-shaped string in a response body");
    assert.ok(!/Bearer/i.test(res.body), "auth header echoed into a response body");
  }
});

test("player_reason is never logged, on any path", async () => {
  const secret = "my very private sentence about the boots";
  const scenarios = [
    () => ok(GOOD), () => httpErr(500), aborted, () => ok("garbage"),
    () => ok('{"bucket":"NOPE","narration":"x"}')
  ];
  for (const s of scenarios) {
    logs = [];
    stubFetch(s);
    await post(turnBody({ player_reason: secret }));
    const all = logs.join("\n");
    assert.ok(!all.includes(secret), "player_reason reached the logs:\n" + all);
    assert.ok(!all.includes(FAKE_KEY), "the key reached the logs:\n" + all);
  }
});

test("upstream error bodies are never echoed into the logs", async () => {
  globalThis.fetch = async () => ({
    ok: false, status: 400,
    json: async () => ({ error: { message: "your key sk-or-v1-LEAKED is invalid" } })
  });
  await post(turnBody());
  const all = logs.join("\n");
  assert.ok(!all.includes("sk-or-v1-LEAKED"), "an upstream body reached the logs:\n" + all);
});

/* An unreadable reply is the call failing, so it earns the retry. Before this,
 * one malformed response meant the player got the flat fallback narration
 * mid-scene with no second attempt. */
test("an unreadable primary reply retries on the fallback model", async () => {
  stubFetch(() => ok("I'm afraid I can't do that"), () => ok(GOOD));
  const res = await post(turnBody());
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.model, MODEL);
  assert.equal(calls[1].body.model, FALLBACK_MODEL);
  assert.equal(JSON.parse(res.body).bucket, "INTEGRATED");
});

test("both models unreadable still gives up after two calls", async () => {
  stubFetch(() => ok("nonsense"));
  const res = await post(turnBody());
  assert.equal(calls.length, 2);
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).bucket, "GENERIC");
});

test("a salvageable reply needs no retry", async () => {
  stubFetch(() => ok('{"bucket":"PARTIAL","narration":"He says "no" and sits."}'));
  const res = await post(turnBody());
  assert.equal(calls.length, 1, "salvage should avoid spending a second call");
  assert.equal(JSON.parse(res.body).bucket, "PARTIAL");
});

/* Two calls at 20s each was a 40 second silence on a double failure, long past
 * the point a child decides the page is broken. */
test("the worst-case wait is bounded well under half a minute", async () => {
  const src = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "..", "netlify", "functions", "turn.js"), "utf8");
  const m = src.match(/const TIMEOUT_MS = (\d+);/);
  assert.ok(m, "no TIMEOUT_MS");
  const worst = 2 * parseInt(m[1], 10);
  assert.ok(worst <= 20000, `worst case is ${worst / 1000}s — too long for a twelve year old`);
});
