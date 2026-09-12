# gwhackathon — contract

<!--
  Source of truth for every agent on this project, regardless of vendor.
  CLAUDE.md is one line importing this file.

  Keep this under 150 lines and keep it NARROW. The evidence says repo
  overviews and restated conventions do not help and cost >20% more tokens
  (arXiv:2602.11988) — an agent can read the code. Write only what it
  cannot infer: your commands, your prohibitions, your stop conditions.

  Delete every {{...}} placeholder and every comment before committing.
-->

## What this is

{{ONE PARAGRAPH. What the project is, who uses it, what state it is in.}}

**What it is not:** {{the anti-definition — "not production", "not a brochure
site". This single line prevents more wrong work than the paragraph above.}}

## Stack

- {{language / runtime + version}}
- {{framework}}
- {{database / hosting}}

## Commands

<!-- Exact, copy-pasteable. This is the highest-value section in the file. -->

| Purpose | Command |
|---|---|
| Install | `{{npm install}}` |
| Dev | `{{npm run dev}}` |
| Test | `{{npm test}}` |
| Lint | `{{npm run lint}}` |
| Typecheck | `{{npm run typecheck}}` |
| Full check before any handoff | `{{npm run check}}` |

## How we work

- **Slices.** One slice, one packet, one PR. Smallest shippable deliverable.
- **Contracts before code.** Work starts from a packet in `docs/method/packets/`,
  never from a chat message.
- **Allowed files.** Every packet lists the files you may touch. Touching
  anything else means stopping and reporting, not asking forgiveness.
- **No drive-by refactors.** Minimal diff. Unrelated improvements go in the
  decision log as a proposal, not in this PR.
- **One writer per file.** {{Name the hotspot files here — the big stylesheet,
  the god component. Being explicit is what prevents the collision.}}

## Rules

<!-- Numbered so a review can say "violates rule 4". Non-negotiable. -->

1. {{Rule.}}
2. {{Rule.}}
3. Never invent tables, columns, endpoints, or business rules. If something
   needed is missing, stop and report — do not design around the gap.
4. Never commit a secret, a key, or a real customer record.
5. Money is {{integer cents / 2-decimal strings}}, never floating point, and is
   formatted by exactly one shared helper.
6. Time comes from an injected value, never from the system clock. Timezone is
   {{Europe/Brussels}}.

## Never do

<!-- Prohibitions, phrased as absolutes. Short list, no exceptions. -->

- {{...}}
- {{...}}
- Do not deploy. Do not merge. Both are human actions.

## Stop and report if

- A rule above and the task appear to conflict.
- The schema, a business rule, or a required value is missing.
- The change wants a file outside the packet's allowed list.
- A test that was passing starts failing for a reason you did not cause.

Stopping is a successful outcome. Guessing is not.

## Where things are

| What | Where |
|---|---|
| Rules and method | `docs/method/` |
| Active slice packets | `docs/method/packets/` |
| Decisions and their reasons | `docs/method/decision-log.md` |
| Facts the work depends on | `docs/method/source/` |

Read the packet for your slice before writing anything. If there is no packet,
there is no slice — stop and say so.
