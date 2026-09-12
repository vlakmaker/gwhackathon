#!/usr/bin/env node
/* check.js — run SPEC.md § "Acceptance criteria" against the live function.
 *
 *   netlify dev          # in one terminal
 *   node check.js        # in another
 *
 * Every case here is a row of that table and nothing else. This costs money
 * on each run and needs a key; the offline suite (`node --test`) is what to
 * run while iterating on code.
 *
 * When a row fails, tune the PROMPT. Not the table, not the design.
 */
"use strict";

const BASE = process.env.CHECK_BASE || "http://localhost:8888";
/* The classifier is stochastic. One green run is not evidence — row 2 passed
   10/10 once and turned out to hold only ~25% of the time. --runs=N runs every
   row N times and a row passes only if every run agrees. */
const RUNS = Math.max(1, parseInt(
  (process.argv.find((a) => a.startsWith("--runs=")) || "--runs=1").slice(7), 10) || 1);
const URL_ = BASE.replace(/\/$/, "") + "/.netlify/functions/turn";

const C = process.stdout.isTTY
  ? { g:"\x1b[32m", r:"\x1b[31m", y:"\x1b[33m", d:"\x1b[2m", b:"\x1b[1m", o:"\x1b[0m" }
  : { g:"", r:"", y:"", d:"", b:"", o:"" };

/* SPEC.md § Adjudication: never say correct, incorrect, well done, good
 * spotting. Row 8 checks this across every narration the run produces. */
const VERDICT = /\b(correct|incorrect|well done|good spotting|good thinking|right answer|wrong answer)\b/i;

const INN = "greyford-inn";

/* Row 2 runs first. SPEC.md: "Test row two first. It is the whole design in
 * one case." If it fails, the prompt is classifying the choice. */
const CASES = [
  { row: "2", first: true,
    scene: INN, option: "Go with him",
    reason: "his boots are dry, I want to see where he really goes",
    expect: "INTEGRATED",
    why: "the wrong-looking choice with the best reasoning — proves this measures reading, not obedience" },

  { row: "1",
    scene: INN, option: "Refuse",
    reason: "his boots are dry, he wasn't in the marsh",
    expect: "INTEGRATED",
    why: "two details, different sentences" },

  { row: "3",
    scene: INN, option: "Refuse",
    reason: "i dont trust him",
    expect: "PARTIAL", reject: "INTEGRATED",
    why: "suspicion with no textual evidence" },

  { row: "4a",
    scene: INN, option: "Refuse", reason: "i dunno",
    expect: "GENERIC",
    why: "no engagement with the text" },

  { row: "4b",
    scene: INN, option: "Go with him", reason: "i dunno",
    expect: "GENERIC",
    why: "same reason, other action — SPEC says either" },

  { row: "5",
    scene: INN, option: "Go with him",
    reason: "he walked through the mud all night, he needs help",
    expect: "CONTRADICTED",
    why: "asserts what the text denies — the useful failure" },

  { row: "6a",
    scene: INN, option: "Refuse", reason: "",
    expect: "GENERIC",
    why: "empty must not crash" },

  { row: "6b",
    scene: INN, option: "Refuse", reason: "x",
    expect: "GENERIC",
    why: "one character must not crash" }
];

/* Row 7 is two turns: a PARTIAL on beat 1 must still be able to reach
 * INTEGRATED on beat 2. Nobody is locked out by one wrong answer. */
const ROW7 = {
  row: "7",
  beat1: { scene: INN, option: "Refuse", reason: "he's acting weird", expect: "PARTIAL" },
  beat2: { option: "Refuse",
           reason: "the innkeeper turned the boot over and the sole was dry, but the marsh road is deep mud",
           expect: "INTEGRATED" },
  why: "the second chance works — the path a real learner takes"
};

/* ---------------------------------------------------------------- plumbing */

async function turn(scene_id, chosen_option, player_reason) {
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(URL_, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scene_id, chosen_option, player_reason })
    });
  } catch (err) {
    console.error(`\n${C.r}Cannot reach ${URL_}${C.o}`);
    console.error(`${C.d}Start the dev server first:  netlify dev${C.o}`);
    console.error(`${C.d}(${err.message})${C.o}\n`);
    process.exit(2);
  }
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ms: Date.now() - t0, ...body };
}

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/* Run one case RUNS times. Returns the tally, the worst reply seen, and one
   narration to print. */
async function repeat(scene, option, reason) {
  const tally = {}; let degraded = null, narration = null, ms = 0;
  for (let i = 0; i < RUNS; i++) {
    const out = await turn(scene, option, reason);
    const k = out.degraded ? "(degraded)" : String(out.bucket);
    tally[k] = (tally[k] || 0) + 1;
    ms += out.ms;
    if (out.degraded) degraded = out.degraded;
    if (!narration && out.narration) narration = out.narration;
  }
  return { tally, degraded, narration, ms: Math.round(ms / RUNS) };
}

function rate(tally, want) {
  const hit = tally[want] || 0;
  const n = Object.values(tally).reduce((a, b) => a + b, 0);
  return { hit, n, all: hit === n };
}

function spread(tally, want) {
  return Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => (k === want ? k : C.r + k + C.o) + "\u00d7" + v)
    .join(" ");
}

function report(label, want, got, out, why) {
  /* A degraded reply means the call itself failed. That is not a
     misclassification and tuning the prompt will not fix it. */
  const bad = !!out.degraded;
  const pass = !bad && got === want;
  const tag = bad  ? `${C.y}ERROR${C.o}`
            : pass ? `${C.g}PASS ${C.o}`
                   : `${C.r}FAIL ${C.o}`;
  console.log(`${tag} row ${label.padEnd(3)} want=${want.padEnd(12)} got=${String(got).padEnd(12)} ${C.d}${out.ms}ms${C.o}`);
  if (why) console.log(`      ${C.d}${why}${C.o}`);
  if (bad) console.log(`      ${C.y}call degraded: ${out.degraded} — not a prompt problem${C.o}`);
  return { pass, bad };
}

function show(option, reason, narration) {
  console.log(`      ${C.d}chose:${C.o}  ${option}`);
  console.log(`      ${C.d}said:${C.o}   ${reason === "" ? C.d + "(empty)" + C.o : JSON.stringify(clip(reason, 90))}`);
  console.log(`      ${C.d}story:${C.o}  ${clip(narration || "(none)", 300)}`);
  console.log();
}

/* -------------------------------------------------------------------- main */

(async () => {
  console.log(`\n${C.b}Acceptance criteria — SPEC.md${C.o}  ${C.d}${URL_}${C.o}`);
  console.log(`${C.d}${RUNS} run(s) per row; a row passes only if every run agrees.${C.o}\n`);

  const narrations = [];
  let pass = 0, fail = 0, errored = 0;
  const failedRows = [];

  const ordered = [...CASES].sort((a, b) => (b.first ? 1 : 0) - (a.first ? 1 : 0));

  for (const c of ordered) {
    const out = await repeat(c.scene, c.option, c.reason);
    const r = rate(out.tally, c.expect);
    const bad = !!out.degraded;
    const tag = bad ? `${C.y}ERROR${C.o}` : r.all ? `${C.g}PASS ${C.o}` : `${C.r}FAIL ${C.o}`;
    console.log(`${tag} row ${c.row.padEnd(3)} want=${c.expect.padEnd(12)} ${r.hit}/${r.n}  ${spread(out.tally, c.expect)}  ${C.d}~${out.ms}ms${C.o}`);
    if (c.why) console.log(`      ${C.d}${c.why}${C.o}`);
    if (bad) console.log(`      ${C.y}call degraded: ${out.degraded} — not a prompt problem${C.o}`);
    /* Row 3 is explicit that PARTIAL must not be graded up to INTEGRATED. */
    if (c.reject && out.tally[c.reject]) {
      console.log(`      ${C.r}graded up to ${c.reject} ${out.tally[c.reject]}/${r.n} — the anti-gaming rule failing${C.o}`);
    }
    if (out.narration) narrations.push({ row: c.row, text: out.narration });
    show(c.option, c.reason, out.narration);
    bad ? errored++ : r.all ? pass++ : (fail++, failedRows.push(c.row));
  }

  /* --- row 7, two turns --- */
  const { SCENES } = require("./public/scenes.js");
  const a = await repeat(ROW7.beat1.scene, ROW7.beat1.option, ROW7.beat1.reason);
  const rA = rate(a.tally, ROW7.beat1.expect);
  const okA = rA.all;
  console.log(`${okA ? C.g + "PASS " : C.r + "FAIL "}${C.o}row 7a  want=${ROW7.beat1.expect.padEnd(12)} ${rA.hit}/${rA.n}  ${spread(a.tally, ROW7.beat1.expect)}  ${C.d}~${a.ms}ms${C.o}`);
  console.log(`      ${C.d}${ROW7.why}${C.o}`);
  show(ROW7.beat1.option, ROW7.beat1.reason, a.narration);
  if (a.narration) narrations.push({ row: "7a", text: a.narration });

  const branch = SCENES[INN].next[ROW7.beat1.expect];
  const b = await repeat(branch, ROW7.beat2.option, ROW7.beat2.reason);
  const rB = rate(b.tally, ROW7.beat2.expect);
  const badB = !!b.degraded;
  console.log(`${badB ? C.y + "ERROR" : rB.all ? C.g + "PASS " : C.r + "FAIL "}${C.o}row 7b  want=${ROW7.beat2.expect.padEnd(12)} ${rB.hit}/${rB.n}  ${spread(b.tally, ROW7.beat2.expect)}  ${C.d}~${b.ms}ms${C.o}`);
  console.log(`      ${C.d}beat 2 in "${branch}" — a PARTIAL can still reach INTEGRATED${C.o}`);
  show(ROW7.beat2.option, ROW7.beat2.reason, b.narration);
  if (b.narration) narrations.push({ row: "7b", text: b.narration });
  badB ? errored++ : (okA && rB.all) ? pass++ : (fail++, failedRows.push("7"));

  /* --- row 8, across everything this run produced --- */
  const verdicts = narrations.filter((n) => VERDICT.test(n.text));
  if (verdicts.length === 0) {
    console.log(`${C.g}PASS ${C.o}row 8   ${C.d}no narration in ${narrations.length} responses delivered a verdict${C.o}\n`);
    pass++;
  } else {
    console.log(`${C.r}FAIL ${C.o}row 8   ${C.d}a narration graded the player${C.o}`);
    for (const v of verdicts) console.log(`      ${C.r}row ${v.row}:${C.o} ${clip(v.text, 200)}`);
    console.log();
    fail++; failedRows.push("8");
  }

  /* --- summary --- */
  const total = pass + fail + errored;
  console.log(`${C.b}${pass}/${total} passing${C.o}${fail ? `  ${C.r}${fail} failing${C.o}` : ""}${errored ? `  ${C.y}${errored} errored${C.o}` : ""}`);
  if (errored) {
    console.log(`${C.y}Errored rows never reached the model. Check the key and the dev server, not the prompt.${C.o}`);
  }
  if (fail) {
    console.log(`${C.d}Failing: ${failedRows.join(", ")}${C.o}`);
    if (failedRows.includes("2")) {
      console.log(`${C.r}Row 2 is failing. The prompt is classifying the chosen action, not the reason.${C.o}`);
      console.log(`${C.d}That is the whole design. Fix this before anything else.${C.o}`);
    }
    console.log(`${C.d}Tune the prompt in netlify/functions/turn.js. Do not change this table.${C.o}`);
  } else if (!errored) {
    console.log(`${C.g}The table passes. UI work can start.${C.o}`);
  }
  console.log();
  process.exit(fail || errored ? 1 : 0);
})();
