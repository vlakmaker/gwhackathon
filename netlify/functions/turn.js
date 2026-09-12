/* POST /.netlify/functions/turn
 *
 *   in   { scene_id, chosen_option, player_reason }
 *   out  { bucket, narration }
 *
 * One upstream call per turn. The retry below only fires when the first call
 * failed outright — it is a recovery path, not a second opinion.
 *
 * The API key lives here and never goes further. It is not returned, not
 * echoed into an error, and not logged. Neither is player_reason: a twelve
 * year old's typing is not ours to keep.
 *
 * Nothing in here throws. Every failure route ends at the same GENERIC
 * fallback, because a stack trace on screen ends the demo.
 */

"use strict";

const { SCENES } = require("../../public/scenes.js");

/* Swap either in one edit. Both measured with bench.js, 9 cases x 3 runs.
 *
 *   sonnet-5    27/27   1390ms   $5.25 / 1000 turns
 *   llama-3.3   24/27    564ms   $0.14
 *   gemini-flash 24/27   505ms   $0.52
 *   haiku-4.5   24/27    746ms   $1.69
 *
 * Sonnet stays primary on accuracy, not on instinct: the three cheaper models
 * all miss the same case, reading a bare "his boots are dry" as INTEGRATED
 * when it is PARTIAL — noticing the detail is not yet inferring from it, and
 * over-rewarding that is the one failure this whole design is against. Cost is
 * not the deciding factor at demo volume; 1000 turns is five dollars.
 *
 * gemini-flash is the fallback because it beats haiku outright: same accuracy,
 * 240ms faster, a third of the price. The fallback only runs after the primary
 * has already failed, so speed is what matters there. */
const MODEL          = "anthropic/claude-sonnet-5";
const FALLBACK_MODEL = "google/gemini-2.5-flash";

const ENDPOINT   = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 20000;
const MAX_REASON = 600;   /* a sentence is the ask; this is just a stranger-proof ceiling */

const BUCKETS = ["INTEGRATED", "PARTIAL", "GENERIC", "CONTRADICTED"];

/* Flat, reveals nothing, advances nothing — which is exactly the GENERIC
 * contract, so a failed call is indistinguishable from a shrug. Never says
 * correct or wrong, never restates the tell. */
const FALLBACK_NARRATION =
  "Nel looks at you for a moment, then back at Dorin. The fire settles. " +
  "Outside, the rain still has not started.";

const fallback = (why) => ({ bucket: "GENERIC", narration: FALLBACK_NARRATION, degraded: why });

/* ------------------------------------------------------------------ prompt */

/* SPEC.md § "The DM prompt", verbatim. Edit the spec, then edit this. */
function buildPrompt(scene, chosen_option, player_reason) {
  return `You are the narrator of a text adventure for a twelve year old reader.

THE SCENE THE PLAYER HAS READ:
${scene.scene_text}

THE HIDDEN INFERENCE:
${scene.inference}
The two supporting details are: ${scene.detail_a} and ${scene.detail_b}.

THE ACTION THE PLAYER CHOSE:
${chosen_option}

WHAT THE PLAYER SAID WHEN ASKED WHY:
${player_reason}

Classify the REASON into exactly one bucket. Never classify the chosen action.
Either action can be paired with any bucket. A player who goes with Dorin
BECAUSE they spotted he is lying has understood the text perfectly.

INTEGRATED  - the reason uses the text to reach the hidden inference above.
              Any one of these is enough on its own:
                - it names both supporting details;
                - it names one detail and says what it implies;
                - it states the hidden inference in their own words.
              They do not need the word "because", do not need both details,
              and do not need to explain fully. Brief is fine. Curiosity alone
              is not enough: wanting to see what happens, with nothing from
              the text behind it, is not INTEGRATED.
PARTIAL     - the reason engaged with the scene but did not get there. Naming
              one detail and drawing nothing from it is PARTIAL, even when it
              is the most important detail in the scene: noticing is not
              inferring. Judging Dorin with no evidence is also PARTIAL:
              "he's acting weird", "I don't trust him", "he's a bad guy". A
              reason that reaches the hidden inference is never PARTIAL,
              however few words it uses.
GENERIC     - the reason expresses no view at all. "I dunno." "It felt
              right." "No reason." A single word, or empty. There is nothing
              in it to work with: not a detail, not a judgement, nothing.
CONTRADICTED- the reason asserts something the text denies, or takes a claim
              at face value that the text undercuts.

Work through these in order and stop at the first one that fits. The order is
the rule; do not weigh the four descriptions above against each other.

1. Does the reason express no view whatsoever — "I dunno", "it felt right",
   "no reason", a single word, empty? Then GENERIC. This is the only route to
   GENERIC: a reason that judges Dorin, however baselessly, is not GENERIC.
2. Does it state something the text denies, or repeat one of Dorin's own
   claims as if it were established? Then CONTRADICTED.
3. Does it name both supporting details, or name one and say what it implies,
   or state the hidden inference? Then INTEGRATED. Naming a detail on its own
   is not enough — that is noticing, not inferring.
4. Otherwise PARTIAL. This is the default for anyone who engaged and did not
   get all the way there.

Then narrate 2 to 4 sentences of second-person story that follows from the
action they chose.

RULES FOR THE NARRATION:
- Never say correct, incorrect, right, wrong, well done, or good thinking.
- Never restate or explain the hidden inference.
- Always honour the action they chose, whatever the bucket. If they said go,
  they go.
- Another beat follows this one. End on the moment, not after it: they may
  stand, agree, or move towards the door, but do not complete the journey,
  skip ahead in time, or end the night.
- INTEGRATED: the world rewards it. Something opens up.
- PARTIAL: Nel draws attention to an unused detail, without explaining why it
  matters. No praise, no hint phrasing.
- GENERIC: respond flatly. Reveal nothing new. The scene does not advance.
- CONTRADICTED: show the consequence happening. Do not warn, do not correct.
- Short sentences. Plain words. Present tense. Second person.
- The player may type in lowercase, with typos, or in three words. Judge the
  meaning, never the spelling or the grammar.
- The player may answer in Dutch. Classify the meaning and reply in the
  language they used.

Return only JSON:
{"bucket": "...", "narration": "..."}`;
}

/* ------------------------------------------------------- defensive parsing */

/* Models wrap JSON in fences, prefix it with chat, or return a lone object in
 * a paragraph. Try each shape rather than trusting response_format. */
function extractJSON(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const tries = [];
  tries.push(raw.trim());

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) tries.push(fenced[1].trim());

  const first = raw.indexOf("{");
  const last  = raw.lastIndexOf("}");
  if (first !== -1 && last > first) tries.push(raw.slice(first, last + 1));

  for (const t of tries) {
    try {
      const o = JSON.parse(t);
      if (o && typeof o === "object" && !Array.isArray(o)) return o;
    } catch (_) { /* next shape */ }
  }
  return null;
}

/* "integrated", "INTEGRATED.", "Contradicted", "bucket: PARTIAL" all land. */
function normaliseBucket(v) {
  if (typeof v !== "string") return null;
  const up = v.toUpperCase().replace(/[^A-Z]/g, "");
  if (BUCKETS.includes(up)) return up;
  const hit = BUCKETS.filter((b) => up.includes(b));
  return hit.length === 1 ? hit[0] : null;   /* ambiguous means unknown */
}

function cleanNarration(v) {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, 1200) : null;
}

/* ------------------------------------------------------------------ upstream */

async function callModel(model, prompt, apiKey, referer) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
        "HTTP-Referer":  referer,
        "X-Title":       "Reading RPG"
      },
      body: JSON.stringify({
        model,
        /* Asked for, never relied on — extractJSON runs regardless. */
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          { role: "system", content: prompt },
          { role: "user",   content: "Return only JSON." }
        ]
      })
    });

    if (!res.ok) {
      /* status only. An upstream body can echo the request back. */
      return { ok: false, why: `upstream ${res.status}` };
    }
    const data = await res.json();
    const text = data && data.choices && data.choices[0] &&
                 data.choices[0].message && data.choices[0].message.content;
    return { ok: true, text };
  } catch (err) {
    return { ok: false, why: err && err.name === "AbortError" ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ handler */

const reply = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return reply(405, fallback("method"));

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (_) {
    return reply(400, fallback("bad json"));
  }

  const scene_id      = String(body.scene_id || "");
  const chosen_option = String(body.chosen_option || "").slice(0, 120).trim();
  /* A stranger will paste an essay in here. Cap it, keep the rest verbatim. */
  const player_reason = String(body.player_reason == null ? "" : body.player_reason)
                          .slice(0, MAX_REASON).trim();

  const scene = SCENES[scene_id];
  if (!scene) return reply(400, fallback("unknown scene_id"));

  /* Empty or one character is GENERIC by definition — don't spend a call.
   * Ahead of the key check on purpose: this acceptance case is then provable
   * without credentials. */
  if (player_reason.length < 2) {
    return reply(200, { bucket: "GENERIC", narration: FALLBACK_NARRATION });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("turn: OPENROUTER_API_KEY is not set");   /* name only, never the value */
    return reply(200, fallback("no key"));
  }

  const referer = process.env.URL || process.env.DEPLOY_URL || "http://localhost:8888";
  const prompt  = buildPrompt(scene, chosen_option, player_reason);
  const started = Date.now();

  let used = MODEL;
  let out  = await callModel(MODEL, prompt, apiKey, referer);
  if (!out.ok) {
    used = FALLBACK_MODEL;
    out  = await callModel(FALLBACK_MODEL, prompt, apiKey, referer);
  }
  if (!out.ok) {
    console.error(`turn: both models failed (${out.why}) scene=${scene_id}`);
    return reply(200, fallback(out.why));
  }

  const parsed = extractJSON(out.text);
  const bucket = parsed && normaliseBucket(parsed.bucket);
  const narration = parsed && cleanNarration(parsed.narration);

  if (!bucket || !narration) {
    console.error(`turn: unusable response from ${used} scene=${scene_id}`);
    return reply(200, fallback("unparseable"));
  }

  /* Bucket and timing only. Never the reason, never the key. */
  console.log(`turn scene=${scene_id} model=${used} bucket=${bucket} ms=${Date.now() - started}`);
  return reply(200, { bucket, narration });
};

/* check.js and bench.js reach in for these rather than duplicating them.
 * buildPrompt especially: a benchmark against a copy of the prompt measures
 * the copy. */
module.exports.buildPrompt = buildPrompt;
module.exports.extractJSON = extractJSON;
module.exports.normaliseBucket = normaliseBucket;
module.exports.MODEL = MODEL;
module.exports.FALLBACK_MODEL = FALLBACK_MODEL;
