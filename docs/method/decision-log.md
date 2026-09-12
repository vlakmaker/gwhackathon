# Decision log — gwhackathon

Append-only. Newest at the top of each section. Never edit a past entry — add a
new one that supersedes it and say so.

This file exists because git records *what* changed and never *why*. It is also
the only record of work that happened before the first commit — architecture,
research, scoping — which is invisible to every other measurement.

---

## Confirmed decisions

### 2026-09-12 — The reading load was vocabulary and distance, not length

**Decision:** Beat 1 was rewritten for plainer vocabulary and closer details,
and kept at 154 words rather than cut to 110–140 as advised.
**Reason:** Measured first. Flesch 90.9 and grade 3.5 said "very easy", which
was wrong, because the formula counts syllables and sentence length and the load
was neither. Eleven words were not plain for a twelve year old and every one was
short enough to pass unnoticed: innkeeper, marshes, miller's, bandits, dusk,
knuckles, scrape, settle, hearth, quarry, gutter. That breaks SPEC's own scene
rule 5. Separately, the two details the inference needs sat 127 words apart,
which is a working memory task rather than an inference task. Shortening the
scene would have addressed neither: a 140 word scene still containing "miller"
and "knuckles" is just as hard. After fixing vocabulary and distance the word
count landed at 154 on its own, inside SPEC's range, so no SPEC change was
needed.
**Impact:** Zero flagged words remain in any of the five scenes. Longest
sentence anywhere is 23 words, down from 35. The details are 59 words apart.
Beat 1 now reads Flesch 97, grade 2.3. `tests/scenes.test.js` holds the word
count and verdict-language rules; nothing yet holds the vocabulary list, so a
future rewrite could reintroduce it.
**Time:** ~1h including the measurement pass.

### 2026-09-12 — "marsh" stays, everything else archaic goes

**Decision:** Keep the word "marsh" while replacing miller, innkeeper,
knuckles, dusk, bandits, hearth, quarry, sole and gutter.
**Reason:** One syllable, concrete, and common in children's fiction — but the
deciding factor is that SPEC's acceptance table names it verbatim ("his boots
are dry, he wasn't in the marsh"). Renaming it would cascade into the
acceptance criteria, `check.js` and `bench.js` for very little readability gain.
**Impact:** The marsh/mud half of the inference keeps its wording across
SPEC, all five scenes, and both test harnesses.

### 2026-09-12 — Two plain decoys, not one

**Decision:** Drop the scar, keep the shaking hands and the dog. A review
recommended cutting to a single decoy; declined.
**Reason:** SPEC rule 3 states the reason decoys exist: if every detail matters,
guessing works. With the third option removed the beat-1 choice is now binary,
so fewer decoys directly raises the guess rate. The review's concern — that
decoys push a reader toward "suspicious person" reasoning — describes what
PARTIAL exists to catch and nudge, so it is the mechanism working rather than a
fault. The scar was cut because it carried "knuckles", the hardest word in the
scene, not because it was one decoy too many.
**Impact:** Beat 1 keeps two decoys, both in plain words.

### 2026-09-12 — English, targeting native speakers as well as learners

**Decision:** The scene is in English and stays in English.
**Reason:** The judges read English. The earlier concern was that
COMPREHENSION.md's entire premise is Dutch and Flemish reading scores, which
would make an English scene a second-language decoding task rather than an
inference task — the exact confound the design exists to avoid. Resolved by the
observation that comprehension is declining in native-English countries too, so
native speakers are a legitimate target rather than a compromise.
**Impact:** The vocabulary problem above is a background-knowledge problem, not
a language problem. Same fix, different reason. The prompt still accepts and
replies in Dutch, so a Dutch-speaking player can answer in Dutch.

### 2026-09-12 — Endings branch on the final action

**Decision:** Eight endings keyed on the beat-2 option, replacing four fixed
ones.
**Reason:** The fixed endings contradicted whichever option the player did not
take. The quarry branch offered "Make him talk" and then ended with the player
halfway up the pit road; the partial branch offered "Go with him" and ended with
Nel waiting by the door as if they had refused. A second choice that the story
ignores teaches the player their choices do not matter, which is the opposite of
the whole design.
**Impact:** Beat-2 scenes carry an `endings` map instead of an `ending` string.
`tests/scenes.test.js` fails if any option lacks one, or if an ending exists for
an option that does not.

### 2026-09-12 — "Ask him a question first" removed

**Decision:** Beat 1 offers two options, not three.
**Reason:** It mis-measured the reader rather than merely under-delivering. The
player could not supply the question, and the text box that appears next
captures their *reason* — so a child who typed their actual question into it was
classified GENERIC for engaging properly. Go and Refuse are both commitments the
story can honour. SPEC allows two or three.
**Impact:** Binary choice on beat 1, which is also why the decoy count matters
more (see above).

### 2026-09-12 — Sonnet 5 primary, gemini-2.5-flash fallback

**Decision:** `MODEL = anthropic/claude-sonnet-5`,
`FALLBACK_MODEL = google/gemini-2.5-flash`.
**Reason:** Measured with `bench.js`, nine cases times three runs, prices from
OpenRouter so the cost column is real:

    sonnet-5       27/27   1390ms   $5.25 / 1000 turns
    llama-3.3-70b  24/27    564ms   $0.14
    gemini-flash   24/27    505ms   $0.52
    haiku-4.5      24/27    746ms   $1.69
    gpt-5-mini      2/21            18 of 21 replies unparseable
    gpt-5-nano      0/21            21 of 21 unparseable

All three cheaper models miss the same case: a bare "his boots are dry" read as
INTEGRATED when it is PARTIAL. Over-rewarding noticing is the one failure this
design exists to prevent, so accuracy decided it. Cost is not a factor at demo
volume — a thousand turns is five dollars. gemini-flash replaced haiku-4.5 as
the fallback because it beats it outright: same accuracy, 240ms faster, a third
of the price, and the fallback only runs after the primary has already failed,
so speed is what matters there.
**Impact:** Two constants at the top of `netlify/functions/turn.js`. Re-run
`node bench.js` before changing either. The GPT-5 minis are unusable here, not
merely worse.
**Time:** ~40min including two benchmark passes, $0.40 of API spend.

### 2026-09-12 — One green test run is not evidence

**Decision:** `check.js` takes `--runs=N` and a row passes only if every run
agrees. Temperature dropped from 0.7 to 0.2.
**Reason:** check.js originally ran each row once against a stochastic
classifier and reported 10/10. Row 2 — the row the whole design rests on — was
actually passing about 25% of the time; the green board was ten coin flips
landing heads. This is the dangerous kind of broken, because it ends the
investigation rather than merely failing to catch something. It was found by
accident while blaming an unrelated prompt change. 0.7 was my own choice and
wrong for a classification: one call was doing both the bucketing and the
storytelling, and only the storytelling wanted warmth.
**Impact:** Never trust a single-run pass on anything the model decides.
`--runs=3` before any claim that the table passes.

### 2026-09-12 — Bucket boundaries SPEC left ambiguous

**Decision:** "he looks like a bad guy" is PARTIAL, not GENERIC. A bare "his
boots are dry" is PARTIAL, not INTEGRATED.
**Reason:** SPEC listed "He's a bad guy" under GENERIC and "He's acting weird"
under PARTIAL, which are nearly the same sentence, and the models split on it.
The line is now "no view at all" versus "a view with no evidence" — GENERIC
means nothing to work with, and a baseless judgement is still a judgement. It
also means a child who engaged always gets the nudge rather than a blank. On the
boots: noticing the key detail is not inferring from it, and inference —
holding two things from different parts of a text together — is the entire
product. Rewarding the notice would hollow it out.
**Impact:** SPEC's Adjudication table and the acceptance table in
"What the player actually does" were both edited to match, so SPEC and the
prompt no longer disagree. The prompt now carries an ordered decision procedure
where the order is the rule, because four independent definitions with nothing
saying which wins made short answers drift to GENERIC.

### 2026-09-12 — The narration is never boxed

**Decision:** `p.narration` is deliberately unstyled — no border, background,
padding or colour — and set identically to the scene text.
**Reason:** It shipped with a left border, which made the story response read as
feedback. A box that appears after you answer is a verdict whatever words are
inside it, and SPEC is explicit that the narration is not a verdict, it is the
story continuing. What separates one turn from the next is the player's own
voice instead, set quieter than the prose rather than louder.
**Impact:** `tests/page.test.js` fails if the `.narration` rule gains any
styling. This survived a complete visual rewrite (see below), which is what the
test was for.

### 2026-09-12 — 1996 chrome, 2026 reading

**Decision:** The frontend is styled as an early-web page — teal desktop,
silver window, navy title bar, four-colour bevels, Courier chrome — while the
measure, the serif sizing and the leading stay modern.
**Reason:** Requested look. Almost every 1996 page set text edge to edge at 1.2
leading and they were miserable to read; this is a reading comprehension
product, so unreadable loses to authentic. Times New Roman happened to be both
the period default and a decent reading serif, so the body face needed no
compromise at all. Dark mode is an anachronism kept for the same reason.
**Impact:** Six reading-core tests written before the restyle all passed
through it unchanged. Three chrome tests added.

### 2026-09-12 — Worst-case wait is bounded at 16 seconds

**Decision:** `TIMEOUT_MS` is 8000, not 20000.
**Reason:** The retry makes two calls, so 20s per call was a 40 second silence
on a double failure — long past the point a twelve year old decides the page is
broken. Adding retry-on-unreadable had quietly extended that ceiling to parse
failures too. Measured latency is 1.4–5s, so 8s is generous: a call slower than
that has gone wrong, and giving up on it fast is the point.
**Impact:** A test asserts `2 × TIMEOUT_MS` stays under 20s so it cannot drift
back.

### 2026-09-12 — An unreadable reply earns the retry

**Decision:** The fallback model is tried on a parse failure as well as on a
non-2xx or a timeout. `extractJSON` also salvages the two fields by hand when
every `JSON.parse` attempt fails.
**Reason:** A real play session hit it. A narration is prose, so the model
writes dialogue into it, and one unescaped quotation mark defeated every parse
strategy on output that was otherwise perfectly good. The player got the flat
GENERIC fallback mid-scene — indistinguishable from a shrug, by design, which is
exactly why it did not look like a bug.
**Impact:** Still never a third call. Salvage will not invent a narration it
cannot find.

---

## Open questions

Things blocked on someone else. Each one is a reason a slice cannot start.

### 2026-09-12 — Server-held key or bring-your-own-key for the public deploy?

**Blocks:** the deploy, and therefore the shareable link the brief asks for.
**Asked:** 2026-09-12, of the author.
**Status:** open. BYOK protects the wallet but puts a wall in front of the
moment the demo exists to create — SPEC's Demo section says hand it to someone
who has never seen it and let them type, and no judge will paste an OpenRouter
key to try a reading game. A twelve year old never has one at all. BYOK also
inverts the stated reason the function exists ("so the key never reaches the
browser"), and holding the key across turns wants storage that AGENTS.md and
SPEC both forbid. Measured exposure on a server key is small: $5.25 per thousand
turns, and a demo link plausibly sees a hundred. The real risk is scripted
abuse, not honest use, which a spend cap addresses more cheaply than BYOK does.

### 2026-09-12 — Does a bare notice of the key detail deserve the nudge or the reward?

**Blocks:** nothing. Recorded because it was decided on judgement, not evidence.
**Asked:** decided 2026-09-12 in favour of PARTIAL.
**Status:** resolved but worth revisiting after a real playtest. Three of four
benchmarked models disagree and call it INTEGRATED, which is weak evidence that
the intuition is not universal.

---

## Superseded

### 2026-09-12 — GENERIC means "mentions nothing from the scene" — superseded 2026-09-12

The first ordered decision procedure sent any reason that named nothing in the
scene to GENERIC. That contradicted SPEC's own PARTIAL definition, which
includes suspicion with no textual evidence, and it broke "i dont trust him" on
the two most instruction-following models. Left in place because the shape of
the mistake is instructive: an ordered procedure is more reliable than competing
definitions, but only if step one is the right question. It is now "expresses no
view whatsoever", and that is the only route to GENERIC.

### 2026-09-12 — INTEGRATED requires two details — superseded 2026-09-12

SPEC's acceptance table and SPEC's prompt disagreed with each other. The table
says "his boots are dry, I want to see where he really goes" is INTEGRATED; the
prompt defined INTEGRATED as connecting two details, and that answer names one
detail plus the implication. The model was arguably right to say PARTIAL.
INTEGRATED now accepts one detail plus what it implies. A third clause — the
inference stated with no detail at all — was tried and removed: it scored 0/3 in
testing and was conceptually shaky, since curiosity about where someone is
really going is not evidence of having read anything.

### 2026-09-12 — Three decoys, including the scar — superseded 2026-09-12

The scar across Dorin's knuckles was a vivid non-load-bearing detail and did its
job. It was cut for its vocabulary cost, not its function.
