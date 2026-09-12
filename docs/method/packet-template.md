# Packet {{NN}} — {{slice name}}

**Status:** {{DRAFT | READY | GATED — do not build until {{condition}} | DONE}}
**Issue:** {{#123}}
**Base branch:** {{main, or the branch this stacks on and why}}

## Goal

{{One sentence. What is true after this ships that is not true now.}}

## Read first

- `AGENTS.md`
- `docs/method/decision-log.md` {{— specifically the entry dated ...}}
- {{any source extract this slice depends on}}

## Preconditions

- {{What must already be merged, migrated, or answered.}}

## Files allowed to change

<!--
  Exhaustive. The pre-commit gate reads this list literally, so paths must be
  real and relative to the repo root. One glob per line is allowed.
  Anything not listed here is out of scope by definition.
-->

```
{{src/features/thing/Thing.tsx}}
{{src/lib/thing.ts}}
{{tests/thing.test.ts}}
```

## Out of scope

- {{Named explicitly, so "while I was in there" has no room to grow.}}

## Implementation

1. {{Explicit, numbered requirements. Prefer ten small ones to three vague ones.}}
2. {{...}}

## Data contracts

{{Exact shapes: request/response, table columns, event payloads. If this
section is empty, say so — an empty contract is a stop condition, not a
licence to improvise.}}

## Acceptance criteria

**Happy path**
- [ ] {{Observable behaviour, not implementation.}}

**Error paths**
- [ ] {{What the user sees when it fails, and what gets logged.}}

## Tests required

- [ ] {{test file + what it asserts}}

## Verification

```sh
{{npm run check}}
```

Manual:
- [ ] {{What to click, at what breakpoints, and what "correct" looks like.}}

## Stop and report if

- {{Slice-specific boundary conditions, on top of the ones in AGENTS.md.}}

## Review notes

<!-- Filled in AFTER review. This is what turns a packet into a record. -->

_(empty until reviewed)_
