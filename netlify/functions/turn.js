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
/* Two calls worst case, so this is half the ceiling a player can wait, not the
 * whole of it. 20s here meant a 40s silence on a double failure — long past the
 * point a twelve year old decides the page is broken. Measured latency is
 * 1.4-5s, so 8s is already generous; a call slower than that is a call that has
 * gone wrong, and giving up on it fast is the point. */
const TIMEOUT_MS = 8000;
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

/* One line of the prompt depends on the beat: promising "another beat follows"
 * during beat 2 asks the model to set up a scene that will never come, and the
 * fixed ending then lands on top of that setup. */
const CONTINUITY = {
  1: "- Another beat follows this one. End on the moment, not after it: they may\n" +
     "  stand, agree, or move towards the door, but do not complete the journey,\n" +
     "  skip ahead in time, or end the night.",
  2: "- This is the last narration in the story, and a written ending follows it\n" +
     "  immediately. Narrate only the moment they act \u2014 the first breath of it.\n" +
     "  Do not narrate the journey, where they arrive, what they find, or how it\n" +
     "  turns out. None of that is yours to invent: it is already written, and\n" +
     "  your narration sits directly before it."
};

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
- Never restate or explain the hidden inference, and never put both supporting
  details in the same narration. Naming one of them is allowed. Naming both, or
  saying what they imply together, hands over the answer the player was supposed
  to reach, and the next player learns nothing. Never write a sentence like "his
  boots are dry and that road is mud", or "your boots are dry", or "they are
  still dry, still grey with dust". Describe what people do, not what the
  evidence means.
- Always honour the action they chose, whatever the bucket. If they said go,
  they go.
${CONTINUITY[scene.beat === 2 ? 2 : 1]}
- INTEGRATED: the world rewards it. Something opens up.
- PARTIAL: Nel draws attention to a detail the player did NOT mention, without
  explaining why it matters. Never point at something their reason already
  named — they have that one, and pointing at it again tells them nothing. If
  they named one of the two supporting details, point at the other. If they
  named both, point at neither. No praise, no hint phrasing.
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
  /* Last resort: pull the two fields out by hand. A narration is prose, so it
   * arrives with the model's own quotation marks in it — one unescaped " or a
   * raw newline and every JSON.parse above fails on output that is otherwise
   * perfectly good. Seen in the wild on the primary model. */
  return salvage(raw);
}

function salvage(raw) {
  const bm = raw.match(/"bucket"\s*:\s*"?\s*([A-Za-z]+)/i);
  let narration = null;
  const ni = raw.search(/"narration"\s*:/i);
  if (ni !== -1) {
    let rest = raw.slice(ni).replace(/^"narration"\s*:\s*/i, "").replace(/^"/, "");
    /* cut at the final quote, allowing for a trailing } and a closing fence */
    const end = rest.search(/"\s*\}?\s*(?:```)?\s*$/);
    rest = end === -1 ? rest : rest.slice(0, end);
    narration = rest.replace(/\\"/g, '"').replace(/\\n/g, " ").trim();
  }
  if (!bm && !narration) return null;
  return { bucket: bm ? bm[1] : null, narration };
}

/* The one prompt rule the model does not reliably hold, watched failing across
 * three playtests: it writes the inference back to the player as if confirming
 * it were the reward.
 *
 * Narrow on purpose. Mentioning the boots is fine; mentioning the road is fine.
 * Carrying BOTH halves in one narration is handing over the connection, and the
 * connection is the entire product. Half a clue is a nudge, which is what
 * PARTIAL is for; both halves is the answer.
 */
const SAYS_DRY = /\b(dry|dust|dusty)\b/i;
const SAYS_WET = /\b(mud|muddy|marsh)\b/i;
const leaksInference = (n) => SAYS_DRY.test(n) && SAYS_WET.test(n);

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
        /* The primary model reasons before answering and those tokens count
         * against this ceiling — a measured call spent 124 of them before
         * writing a word. At 400 a long reasoning pass left too little for the
         * narration and it died mid-word on screen. Generous, and it costs
         * nothing extra: only tokens actually generated are billed. */
        max_tokens: 1500,
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
    const choice = data && data.choices && data.choices[0];
    const text = choice && choice.message && choice.message.content;
    /* "length" means the reply was cut off. A sentence dying mid-word is the one
     * visible bug a player remembers, so this counts as the call failing. */
    return { ok: true, text, truncated: choice && choice.finish_reason === "length" };
  } catch (err) {
    return { ok: false, why: err && err.name === "AbortError" ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------- abuse ceiling
 *
 * A shareable link is part of the brief, and honest use is cheap: a whole
 * playthrough is two calls, about a penny. The exposure is one person looping
 * the endpoint, so that is the only thing guarded against.
 *
 * In-memory, because there is no database and there will not be one. Netlify
 * recycles function containers, so a determined attacker gets a fresh budget
 * each time one spins up — this raises the cost of abuse rather than making it
 * impossible, which is the right trade for a four hour demo. Nothing is
 * persisted and no IP is ever written to a log.
 */
const RATE_WINDOW_MS = 10 * 60 * 1000;   /* 10 minutes */
const RATE_MAX       = 40;               /* turns per visitor per window */
const TOTAL_MAX      = 3000;             /* turns per container, whatever happens */

const hits = new Map();
let totalTurns = 0;

/* Off under `netlify dev`, so check.js and bench.js are not throttled. */
const limiterOn = () =>
  process.env.NETLIFY_DEV !== "true" && process.env.TURN_NO_LIMIT !== "1";

function visitor(event) {
  const h = event.headers || {};
  const fwd = h["x-forwarded-for"] || "";
  return h["x-nf-client-connection-ip"] || fwd.split(",")[0].trim() || "unknown";
}

/* Returns a reason string when the turn should be refused, else null. */
function overLimit(event, now) {
  if (!limiterOn()) return null;
  if (totalTurns >= TOTAL_MAX) return "total";

  const key = visitor(event);
  const recent = (hits.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) { hits.set(key, recent); return "visitor"; }

  recent.push(now);
  hits.set(key, recent);

  /* Keep the map from growing without bound. */
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(k);
    }
  }
  return null;
}

/* Not a narration. No classification happened, so the story must not advance —
 * inventing a GENERIC would charge the player a story consequence for a
 * technical limit. */
const LIMIT_MESSAGE =
  "The demo has had a lot of visitors in the last few minutes. " +
  "Give it a moment and tell Nel again.";

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

  const limit = overLimit(event, Date.now());
  if (limit) {
    /* the reason, never the visitor */
    console.error(`turn: refused, ${limit} limit reached`);
    return reply(429, { limited: true, message: LIMIT_MESSAGE });
  }
  totalTurns++;

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

  /* Read a reply into a bucket + narration, or nothing. */
  const understand = (out) => {
    if (!out.ok || out.truncated) return null;
    const parsed = extractJSON(out.text);
    const bucket = parsed && normaliseBucket(parsed.bucket);
    const narration = parsed && cleanNarration(parsed.narration);
    if (!bucket || !narration) return null;
    /* A narration that explains the inference is unusable in the same way a
     * truncated one is: it is well-formed and it ruins the thing. Retry. */
    if (leaksInference(narration)) return null;
    return { bucket, narration };
  };

  let used = MODEL;
  let out  = await callModel(MODEL, prompt, apiKey, referer);
  let got  = understand(out);

  /* Retry covers an unreadable reply as well as a non-2xx or a timeout: all
   * three are the call failing, and a flat fallback narration mid-scene costs
   * the player more than one extra second does. Still never a third call. */
  if (!got) {
    console.error(`turn: retrying, primary ${out.truncated ? "truncated" : out.ok ? "unreadable or leaked the inference" : out.why} scene=${scene_id}`);
    used = FALLBACK_MODEL;
    out  = await callModel(FALLBACK_MODEL, prompt, apiKey, referer);
    got  = understand(out);
  }

  if (!got) {
    console.error(`turn: both models unusable scene=${scene_id}`);
    return reply(200, fallback(out.ok ? "unparseable" : out.why));
  }
  const { bucket, narration } = got;

  /* Bucket and timing only. Never the reason, never the key. */
  console.log(`turn scene=${scene_id} model=${used} bucket=${bucket} ms=${Date.now() - started}`);
  return reply(200, { bucket, narration });
};

/* check.js and bench.js reach in for these rather than duplicating them.
 * buildPrompt especially: a benchmark against a copy of the prompt measures
 * the copy. */
module.exports.buildPrompt = buildPrompt;
module.exports.leaksInference = leaksInference;
module.exports.RATE_MAX = RATE_MAX;
module.exports.TOTAL_MAX = TOTAL_MAX;
module.exports.extractJSON = extractJSON;
module.exports.normaliseBucket = normaliseBucket;
module.exports.MODEL = MODEL;
module.exports.FALLBACK_MODEL = FALLBACK_MODEL;
