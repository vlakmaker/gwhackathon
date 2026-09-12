#!/usr/bin/env node
/* bench.js — compare models on the classification, with real costs.
 *
 *   node bench.js                      # the default shortlist
 *   node bench.js anthropic/claude-sonnet-5 google/gemini-2.5-flash
 *   RUNS=5 node bench.js
 *
 * Calls OpenRouter directly rather than going through the function, so the
 * model is the only thing that varies. Uses turn.js's own buildPrompt — a
 * benchmark against a copy of the prompt measures the copy.
 *
 * Token counts come back from OpenRouter per call, so the cost column is
 * measured, not estimated.
 */
"use strict";
const fs = require("node:fs");
const { buildPrompt, extractJSON, normaliseBucket } = require("./netlify/functions/turn.js");
const { SCENES } = require("./public/scenes.js");

const KEY = (fs.readFileSync(".env", "utf8").match(/^OPENROUTER_API_KEY=(.+)$/m) || [])[1];
if (!KEY) { console.error("no OPENROUTER_API_KEY in .env"); process.exit(2); }

const RUNS = parseInt(process.env.RUNS || "3", 10);
const MODELS = process.argv.slice(2).length ? process.argv.slice(2) : [
  "anthropic/claude-sonnet-5",
  "anthropic/claude-haiku-4.5",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "meta-llama/llama-3.3-70b-instruct"
];

/* Five rows from SPEC's acceptance table plus the one that has been wobbling.
 * Small on purpose: this costs money per cell. */
const CASES = [
  { id: "row2",   scene: "greyford-inn", opt: "Go with him", reason: "his boots are dry, I want to see where he really goes", want: "INTEGRATED" },
  { id: "row1",   scene: "greyford-inn", opt: "Refuse",      reason: "his boots are dry, he wasn't in the marsh",            want: "INTEGRATED" },
  { id: "row3",   scene: "greyford-inn", opt: "Refuse",      reason: "i dont trust him",                                     want: "PARTIAL" },
  { id: "row4",   scene: "greyford-inn", opt: "Refuse",      reason: "i dunno",                                              want: "GENERIC" },
  { id: "row5",   scene: "greyford-inn", opt: "Go with him", reason: "he walked through the mud all night, he needs help",    want: "CONTRADICTED" },
  { id: "boots",  scene: "greyford-inn", opt: "Refuse",      reason: "his boots are dry",                                    want: "PARTIAL" },
  { id: "dutch",  scene: "greyford-inn", opt: "Refuse",      reason: "zijn laarzen zijn droog maar de weg is modder",         want: "INTEGRATED" },
  /* the two the boundary was just re-drawn around */
  { id: "badguy", scene: "greyford-inn", opt: "Refuse",      reason: "he looks like a bad guy",                               want: "PARTIAL" },
  { id: "felt",   scene: "greyford-inn", opt: "Refuse",      reason: "it felt right",                                        want: "GENERIC" }
];

const C = process.stdout.isTTY
  ? { g:"\x1b[32m", r:"\x1b[31m", y:"\x1b[33m", d:"\x1b[2m", b:"\x1b[1m", o:"\x1b[0m" }
  : { g:"", r:"", y:"", d:"", b:"", o:"" };

async function prices() {
  try {
    const r = await fetch("https://openrouter.ai/api/v1/models");
    const d = (await r.json()).data;
    const m = {};
    for (const x of d) m[x.id] = { in: +x.pricing.prompt * 1e6, out: +x.pricing.completion * 1e6 };
    return m;
  } catch { return {}; }
}

async function one(model, c) {
  const scene = SCENES[c.scene];
  const prompt = buildPrompt(scene, c.opt, c.reason);
  const t0 = Date.now();
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json",
                 "HTTP-Referer": "http://localhost:8888", "X-Title": "Reading RPG bench" },
      body: JSON.stringify({ model, response_format: { type: "json_object" }, temperature: 0.2,
                             max_tokens: 400,
                             messages: [{ role: "system", content: prompt },
                                        { role: "user", content: "Return only JSON." }] })
    });
    const ms = Date.now() - t0;
    if (!res.ok) return { bucket: null, ms, err: "http " + res.status, pt: 0, ct: 0 };
    const j = await res.json();
    const text = j?.choices?.[0]?.message?.content;
    const parsed = extractJSON(text);
    return { bucket: parsed && normaliseBucket(parsed.bucket), ms,
             pt: j?.usage?.prompt_tokens || 0, ct: j?.usage?.completion_tokens || 0,
             unparsed: !parsed };
  } catch (e) { return { bucket: null, ms: Date.now() - t0, err: e.message, pt: 0, ct: 0 }; }
}

(async () => {
  const P = await prices();
  const cells = CASES.length * RUNS;
  console.log(`\n${C.b}Model comparison${C.o}  ${C.d}${CASES.length} cases x ${RUNS} runs = ${cells} calls per model, ${MODELS.length} models${C.o}\n`);

  const results = [];
  for (const model of MODELS) {
    let hit = 0, tot = 0, pt = 0, ct = 0, ms = 0, errs = 0, unparsed = 0;
    const perCase = [];
    for (const c of CASES) {
      let h = 0;
      const seen = {};
      for (let i = 0; i < RUNS; i++) {
        const o = await one(model, c);
        tot++; pt += o.pt; ct += o.ct; ms += o.ms;
        if (o.err) errs++;
        if (o.unparsed) unparsed++;
        const k = o.bucket || (o.err ? "ERR" : "UNPARSED");
        seen[k] = (seen[k] || 0) + 1;
        if (o.bucket === c.want) { h++; hit++; }
      }
      perCase.push({ id: c.id, want: c.want, h, n: RUNS, seen });
    }
    const pr = P[model] || { in: 0, out: 0 };
    const cost = (pt / 1e6) * pr.in + (ct / 1e6) * pr.out;
    results.push({ model, hit, tot, cost, perCall: cost / tot, ms: Math.round(ms / tot), errs, unparsed, perCase, pr });

    const pct = (100 * hit / tot).toFixed(0);
    const col = hit === tot ? C.g : pct >= 85 ? C.y : C.r;
    console.log(`${C.b}${model}${C.o}  ${C.d}$${pr.in}/$${pr.out} per M${C.o}`);
    console.log(`  ${col}${hit}/${tot} correct (${pct}%)${C.o}  ${C.d}~${Math.round(ms / tot)}ms/call  $${cost.toFixed(4)} this run  $${(cost / tot).toFixed(5)}/call${C.o}${errs ? `  ${C.r}${errs} errors${C.o}` : ""}${unparsed ? `  ${C.y}${unparsed} unparseable${C.o}` : ""}`);
    for (const pc of perCase) {
      const s = Object.entries(pc.seen).sort((a, b) => b[1] - a[1])
        .map(([k, v]) => (k === pc.want ? k : C.r + k + C.o) + "x" + v).join(" ");
      console.log(`    ${pc.h === pc.n ? C.g + "ok " : C.r + "!! "}${C.o}${pc.id.padEnd(6)} want=${pc.want.padEnd(12)} ${pc.h}/${pc.n}  ${s}`);
    }
    console.log();
  }

  console.log(`${C.b}Ranked by accuracy, then cost${C.o}\n`);
  console.log("  " + "model".padEnd(38) + "acc".padEnd(9) + "ms".padEnd(7) + "$/1k turns");
  for (const r of results.sort((a, b) => (b.hit / b.tot) - (a.hit / a.tot) || a.perCall - b.perCall)) {
    const pct = (100 * r.hit / r.tot).toFixed(0) + "%";
    const col = r.hit === r.tot ? C.g : (r.hit / r.tot) >= 0.85 ? C.y : C.r;
    console.log("  " + r.model.padEnd(38) + (col + pct + C.o).padEnd(9 + C.o.length + col.length) +
                String(r.ms).padEnd(7) + "$" + (r.perCall * 1000).toFixed(2));
  }
  const total = results.reduce((a, r) => a + r.cost, 0);
  console.log(`\n${C.d}this benchmark cost $${total.toFixed(4)}${C.o}\n`);
})();
