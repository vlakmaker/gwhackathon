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
  console.log(`\n${C.b}Acceptance criteria — SPEC.md${C.o}  ${C.d}${URL_}${C.o}\n`);

  const narrations = [];
  let pass = 0, fail = 0, errored = 0;
  const failedRows = [];

  const ordered = [...CASES].sort((a, b) => (b.first ? 1 : 0) - (a.first ? 1 : 0));

  for (const c of ordered) {
    const out = await turn(c.scene, c.option, c.reason);
    const r = report(c.row, c.expect, out.bucket, out, c.why);
    if (out.narration) narrations.push({ row: c.row, text: out.narration });

    /* Row 3 is explicit that PARTIAL must not be graded up to INTEGRATED. */
    if (c.reject && out.bucket === c.reject) {
      console.log(`      ${C.r}graded up to ${c.reject} — this is the anti-gaming rule failing${C.o}`);
    }
    show(c.option, c.reason, out.narration);
    r.bad ? errored++ : r.pass ? pass++ : (fail++, failedRows.push(c.row));
  }

  /* --- row 7, two turns --- */
  const { SCENES } = require("./public/scenes.js");
  const a = await turn(ROW7.beat1.scene, ROW7.beat1.option, ROW7.beat1.reason);
  const okA = a.bucket === ROW7.beat1.expect;
  console.log(`${okA ? C.g + "PASS " : C.r + "FAIL "}${C.o}row 7a  want=${ROW7.beat1.expect.padEnd(12)} got=${String(a.bucket).padEnd(12)} ${C.d}${a.ms}ms${C.o}`);
  console.log(`      ${C.d}${ROW7.why}${C.o}`);
  show(ROW7.beat1.option, ROW7.beat1.reason, a.narration);
  if (a.narration) narrations.push({ row: "7a", text: a.narration });

  const branch = SCENES[INN].next[a.bucket] || SCENES[INN].next.PARTIAL;
  const b = await turn(branch, ROW7.beat2.option, ROW7.beat2.reason);
  const r7 = report("7b", ROW7.beat2.expect, b.bucket, b, `beat 2 in "${branch}" — a PARTIAL can still reach INTEGRATED`);
  show(ROW7.beat2.option, ROW7.beat2.reason, b.narration);
  if (b.narration) narrations.push({ row: "7b", text: b.narration });
  const row7ok = okA && r7.pass;
  r7.bad ? errored++ : row7ok ? pass++ : (fail++, failedRows.push("7"));

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
