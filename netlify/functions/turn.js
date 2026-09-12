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

/* Swap either in one edit. Ids verified against openrouter.ai/api/v1/models.
 * Primary is the one that has to get the subtle case right: "go with him,
 * because his boots are dry" is INTEGRATED, and a weaker model reads the
 * chosen action instead of the reason. Fallback is chosen for speed. */
const MODEL          = "anthropic/claude-sonnet-5";
const FALLBACK_MODEL = "anthropic/claude-haiku-4.5";

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

INTEGRATED  - the reason connects two details from different parts of the
              text, or states what they imply together. They do not need to
              use the word "because" or explain fully. Naming both details is
              enough.
PARTIAL     - the reason cites one detail only, or expresses suspicion with no
              textual evidence. "He's acting weird" is PARTIAL.
GENERIC     - the reason engages nothing in the text. "I dunno." "He's a bad
              guy." "It felt right." Empty or one word is GENERIC.
CONTRADICTED- the reason asserts something the text denies, or takes a claim
              at face value that the text undercuts.

Then narrate 2 to 4 sentences of second-person story that follows from the
action they chose.

RULES FOR THE NARRATION:
- Never say correct, incorrect, right, wrong, well done, or good thinking.
- Never restate or explain the hidden inference.
- Always honour the action they chose, whatever the bucket. If they said go,
  they go.
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
        temperature: 0.7,
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

/* check.js reaches in for these rather than duplicating them. */
module.exports.extractJSON = extractJSON;
module.exports.normaliseBucket = normaliseBucket;
module.exports.MODEL = MODEL;
module.exports.FALLBACK_MODEL = FALLBACK_MODEL;
