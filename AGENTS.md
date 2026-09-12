# gwhackathon — contract

Source of truth for every agent on this project, whatever the vendor.
`CLAUDE.md` is one line importing this file.

## What this is

A reading-comprehension text adventure for a twelve year old. They read a
scene, choose an action, and a character in the fiction asks them *why*. The
model classifies **the reason they typed** into one of four buckets and the
story responds differently. Nothing is ever marked right or wrong; a misread
just makes the world harder in a way they could have seen coming.

Built solo in a four hour hackathon. The deliverable is a demo that survives a
stranger typing into it, deployed to Netlify so the link is shareable.

**What it is not:** not a product, not a quiz, not a platform. One encounter,
two beats, one ending. There is no second scene and there will not be one.

`SPEC.md` is the complete design and it wins every argument. `COMPREHENSION.md`
is the background for the pitch. Read `SPEC.md` before writing anything.

## Stack

- Static front end in `public/`. Plain HTML/CSS/JS, one page, no framework,
  no bundler, no build step.
- One Netlify Function, `netlify/functions/turn.js`, as the API proxy so the
  key never reaches the browser. Native `fetch`, CommonJS.
- Node 22 (via nvm), netlify-cli. **Zero npm dependencies. No `package.json`.**
- OpenRouter, `POST https://openrouter.ai/api/v1/chat/completions`,
  OpenAI-compatible. `OPENROUTER_API_KEY` from the environment only.

## Commands

| Purpose | Command |
|---|---|
| Test | `node --test` |
| Dev | `netlify dev` (serves `public/` and the function on :8888) |
| Acceptance run | `node check.js` — needs `netlify dev` running and a key |
| Full check before any handoff | `node --test && node check.js` |
| Deploy | `netlify deploy --prod` |

`node --test` is offline and needs no key. `check.js` calls a live model and
costs money on every run.

## How we work

- **The build order in `SPEC.md` is the order.** Data, then the function, then
  the acceptance run, then UI, then styling. Do not jump ahead to UI.
- **No UI work until the acceptance criteria pass.** Tune the prompt, not the
  test, and not the design.
- **One writer per file.** `public/scenes.js` is the author's prose. Structure
  is negotiable; the words are not.
- **No drive-by refactors.** Minimal diff. Unrelated improvements go in
  `docs/method/decision-log.md` as a proposal, not into the change.

## Rules

Numbered so a review can say "violates rule 4". Non-negotiable.

1. **Classify the reason, never the chosen action.** Either action can pair
   with any bucket. A player who goes with Dorin *because* they spotted he is
   lying has understood the text perfectly and scores `INTEGRATED`. Losing
   this turns the whole thing into an obedience test.
2. **Never say correct, incorrect, right, wrong, well done, or good thinking** —
   in narration, in UI copy, in scene prose, anywhere the player can see.
3. **Never restate or explain the hidden inference.** If the narration
   explains the boots, the next player learns nothing.
4. **Never commit a secret.** The key comes from the environment, is never
   hardcoded, never logged, never returned to the client, and never echoed
   from an upstream error body. `.env` is gitignored; keep it that way.
5. **Never log `player_reason`.** A child's typing is not ours to keep.
6. **Zero npm dependencies and no build step.** Adding either is a stop
   condition, not a judgement call.
7. **One upstream call per turn.** The `FALLBACK_MODEL` retry is a recovery
   path for a non-2xx or a timeout, never a second opinion. Latency is the
   demo risk.
8. **Nothing thrown reaches the player.** Every failure route — parse failure,
   unknown bucket, upstream error, missing key — returns `GENERIC` with the
   fixed fallback narration. A stack trace on screen ends the demo.
9. **The scene prose in `public/scenes.js` belongs to the author.** Do not
   rewrite it, tighten it, or "improve" it. Structure and field names are
   fair game; sentences are not.
10. **Never invent scene facts, buckets, or branches.** If something needed is
    missing, stop and report.

## Never do

- Do not write a second scene or a second encounter.
- Do not add character creation, inventory, dice, combat, or stats.
- Do not add accounts, a database, `localStorage`, save state, or analytics.
- Do not add a scene-authoring UI.
- Do not print the reasoning in an option label. `Refuse` is an option;
  `Refuse, his boots are dry` hands over the answer.
- Do not deploy and do not merge. Both are human actions.

## Stop and report if

- A rule above and the task appear to conflict.
- You are about to add a dependency, a `package.json`, or a build step.
- The acceptance criteria cannot pass by prompt tuning alone and you think the
  design needs changing.
- You find yourself writing anything the build order does not name.
- A test that was passing starts failing for a reason you did not cause.

Stopping is a successful outcome. Guessing is not.

## Where things are

| What | Where |
|---|---|
| The design, and the final word | `SPEC.md` |
| Background for the pitch | `COMPREHENSION.md` |
| Scene prose and the classifier's four fields | `public/scenes.js` |
| The API proxy and the DM prompt | `netlify/functions/turn.js` |
| Offline tests | `tests/` — `node --test` |
| Decisions and their reasons | `docs/method/decision-log.md` |
| Facts the work depends on | `docs/method/source/` |

The four buckets are `INTEGRATED`, `PARTIAL`, `GENERIC`, `CONTRADICTED`, and
they are defined in `SPEC.md` § Adjudication. `PARTIAL` is the path a real
learner takes — make sure it works.
