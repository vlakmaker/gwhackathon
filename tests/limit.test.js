/* The abuse ceiling.
 *
 * A shareable link is part of the brief and honest use is cheap — a whole
 * playthrough is two calls. What is guarded against is one person looping the
 * endpoint. These run with the limiter forced ON, which it is not under
 * `netlify dev`, so check.js and bench.js are never throttled.
 */
"use strict";
const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");

const FAKE_KEY = "sk-or-v1-TESTKEYTESTKEY";
const GOOD = '{"bucket":"INTEGRATED","narration":"Dorin stops talking."}';

let realFetch, realErr, logs, turn;

beforeEach(() => {
  /* a fresh module, so the in-memory counters start empty */
  delete require.cache[require.resolve("../netlify/functions/turn.js")];
  turn = require("../netlify/functions/turn.js");
  process.env.OPENROUTER_API_KEY = FAKE_KEY;
  delete process.env.NETLIFY_DEV;      /* limiter ON */
  delete process.env.TURN_NO_LIMIT;
  logs = [];
  realFetch = globalThis.fetch; realErr = console.error;
  console.error = (...a) => logs.push(a.join(" "));
  globalThis.fetch = async () => ({
    ok: true, status: 200, json: async () => ({ choices: [{ message: { content: GOOD } }] })
  });
});
afterEach(() => {
  globalThis.fetch = realFetch; console.error = realErr;
  delete process.env.OPENROUTER_API_KEY;
});

const play = (ip) => turn.handler({
  httpMethod: "POST",
  headers: { "x-nf-client-connection-ip": ip },
  body: JSON.stringify({ scene_id: "greyford-inn", chosen_option: "Refuse",
                         player_reason: "his boots are dry and the road is mud" })
});

test("an ordinary visitor is never refused", async () => {
  for (let i = 0; i < 6; i++) {
    const r = await play("1.2.3.4");
    assert.equal(r.statusCode, 200, "refused on turn " + (i + 1));
    assert.equal(JSON.parse(r.body).bucket, "INTEGRATED");
  }
});

test("a loop is cut off, and spends no more model calls", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return {
    ok: true, status: 200, json: async () => ({ choices: [{ message: { content: GOOD } }] }) }; };

  let refusedAt = null;
  for (let i = 1; i <= turn.RATE_MAX + 10; i++) {
    const r = await play("9.9.9.9");
    if (r.statusCode === 429 && refusedAt === null) refusedAt = i;
  }
  assert.equal(refusedAt, turn.RATE_MAX + 1, `refused at ${refusedAt}, expected ${turn.RATE_MAX + 1}`);
  assert.equal(calls, turn.RATE_MAX, "a refused turn must not reach the model");
});

test("a refused turn is honest, not a fake narration", async () => {
  for (let i = 0; i <= turn.RATE_MAX; i++) await play("8.8.8.8");
  const r = await play("8.8.8.8");
  const b = JSON.parse(r.body);
  assert.equal(r.statusCode, 429);
  assert.equal(b.limited, true);
  assert.ok(b.message && b.message.length > 10, "no message for the player");
  /* crucially: no bucket, so the page cannot branch the story on a load problem */
  assert.equal(b.bucket, undefined, "a refusal must not carry a bucket");
  assert.equal(b.narration, undefined, "a refusal must not carry a narration");
});

test("one visitor being throttled does not throttle anyone else", async () => {
  for (let i = 0; i <= turn.RATE_MAX; i++) await play("5.5.5.5");
  assert.equal((await play("5.5.5.5")).statusCode, 429);
  assert.equal((await play("6.6.6.6")).statusCode, 200, "a different visitor was caught in it");
});

test("the visitor's address is never logged", async () => {
  for (let i = 0; i <= turn.RATE_MAX + 1; i++) await play("7.7.7.7");
  const all = logs.join("\n");
  assert.ok(all.length > 0, "the refusal was not logged at all");
  assert.ok(!all.includes("7.7.7.7"), "an IP reached the logs:\n" + all);
  assert.ok(!all.includes(FAKE_KEY), "the key reached the logs");
});

test("the limiter is off under netlify dev, so the harnesses are not throttled", async () => {
  process.env.NETLIFY_DEV = "true";
  for (let i = 0; i < turn.RATE_MAX + 15; i++) {
    const r = await play("1.1.1.1");
    assert.equal(r.statusCode, 200, "throttled locally on turn " + (i + 1));
  }
});

test("x-forwarded-for is used when Netlify's own header is absent", async () => {
  const viaProxy = (fwd) => turn.handler({
    httpMethod: "POST",
    headers: { "x-forwarded-for": fwd },
    body: JSON.stringify({ scene_id: "greyford-inn", chosen_option: "Refuse",
                           player_reason: "the boots are dry and the road is mud" })
  });
  for (let i = 0; i <= turn.RATE_MAX; i++) await viaProxy("4.4.4.4, 10.0.0.1");
  assert.equal((await viaProxy("4.4.4.4, 10.0.0.1")).statusCode, 429);
  assert.equal((await viaProxy("3.3.3.3, 10.0.0.1")).statusCode, 200);
});
