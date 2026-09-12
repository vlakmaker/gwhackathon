# Reading RPG — build spec

**Status:** READY
**Scope:** one encounter, two beats, four hours, solo
**Name:** _(pick one before you write code)_

## Goal

A twelve year old reads a short scene, types what they want to do, and the
story responds differently depending on whether their action shows they
connected two details in the text. Not a quiz. The consequence is the feedback.

---

## What the player actually does

This is the part that decides whether it works. Written as what is on screen,
top to bottom.

**1. One line of role and goal, always visible.**

> You are a Finder. People pay you to bring back what is lost.
> **Tonight: the miller's daughter. You have until the rain starts.**

Without this the player has no reason to care about anything in the scene.
Twelve year olds do not investigate for fun; they investigate because someone
is missing and the clock is running.

**2. The scene.** 150 to 200 words. They read it.

**3. Two or three suggested actions. Buttons, not a blank box.**

> `Go with him` · `Refuse` · `Ask him a question first`

**The options state the action and never the reasoning.** "Refuse, his boots
are dry" hands over the answer. "Refuse" does not. This rule is the difference
between a comprehension exercise and a reading test with the answer printed
underneath.

Two or three options. Four is already a menu.

**4. A companion asks why.**

After they pick, an NPC in the scene turns to them:

> Nel, your partner, watches Dorin over the rim of her cup.
> **"Alright. Why?"**
>
> `Type what you tell her...`

This is the measured input, and it has to be asked in the fiction. "Explain
your reasoning" is a worksheet. A character asking why is a conversation. Same
data, completely different feeling to a twelve year old.

One sentence is a fine answer. Nobody should feel they are writing for a
teacher.

**5. Narration appears below.** Not a verdict. The story continues.

**6. Beat 2.** New text, new details, new options, Nel asks again. Then an
ending.

### Why the split matters

The action is guessable. Fifty-fifty on go or refuse. The reason is not.

So **classify the reason, never the choice.** This has one consequence worth
stating loudly:

> "I go with him, because his boots are dry so he's lying, and I want to see
> where he actually takes me."

That is the wrong-looking choice and the best answer in the set. It must score
`INTEGRATED`. If it doesn't, you have built an obedience test wearing a
comprehension costume.

| Choice | Reason they type | Bucket |
|---|---|---|
| Refuse | "his boots are dry, he wasn't in the marsh" | `INTEGRATED` |
| Go with him | "his boots are dry, I want to see where he really goes" | `INTEGRATED` |
| Refuse | "he's acting weird" | `PARTIAL` |
| Either | "i dunno" / "it felt right" | `GENERIC` |
| Refuse | "he looks like a bad guy" | `PARTIAL` — a view, just an unevidenced one |
| Go with him | "he came all the way through the mud, he needs help" | `CONTRADICTED` |

The last one is the useful failure. They didn't misjudge Dorin, they misread
the text, and the story shows them the dry road rather than telling them so.

---

## Why inference, not recall

The thing failing in Flemish and Dutch schools is not decoding. Kids can read
the words. What has dropped hardest is inference: holding two facts from
different parts of a text and working out what they imply together.

Multiple choice tests recognition, which is not what is broken. Comprehension
questions after a passage test recall, which is also not what is broken. Both
also signal "school" instantly, which kills engagement, which kills volume,
which is the actual root cause.

So: free text input, inference-dependent action, in-fiction consequences.

---

## Scene design rules

1. **The tell requires two details from different sentences.** One detail alone
   is recall. Two combined is inference. This is the whole product.
2. **Never state the tell.** If the text says "he seems nervous," you have
   tested nothing.
3. **Plant at least one vivid decoy** that carries no information. If every
   detail matters, guessing works.
4. **150 to 200 words.** Difficulty lives in the inference, not the volume.
5. **Plain vocabulary, complex relationships.** They should never be stuck on a
   word, only on what it implies.
6. **End on a forced choice.** The scene stops at a moment where they must act.
   There is no separate exercise.

---

## Reference scene

Written to be beaten. Read it aloud and ask whether a bored twelve year old
finishes the first paragraph. If not, rewrite it, not the rules.

> The inn at Greyford has one rule, and the innkeeper says it twice: scrape
> your boots at the door. The road up from the marshes is ankle-deep in black
> mud from autumn until spring, and she is tired of mopping.
>
> The man by the fire is called Dorin. He is telling anyone who will listen
> that he walked all night from the marsh road, that the bandits took the
> miller's daughter at dusk, and that he was the only one to get away. His
> hands shake around his cup. There is a long white scar across his knuckles.
>
> The innkeeper's dog will not settle. It circles the table twice and lies
> down facing him.
>
> Dorin's boots are by the fire, drying. They are grey with dust.
>
> He says he will lead you to the camp himself, if you go now, before the rain.
>
> **Dorin is waiting. Do you go with him?**

**The inference:** the marsh road is black mud, his boots are dry and grey with
dust, therefore he did not come from the marsh, therefore he is lying about
where he was.

**The decoys:** the scar, the shaking hands, the dog. All vivid, none load
bearing. The dog is the good false lead, because it looks like a tell and
isn't.

---

## Adjudication

Four buckets. Classify the **reason**, never the chosen action. Classify with
the model, branch with code.

| Bucket | Meaning | Story response |
|---|---|---|
| `INTEGRATED` | The reason connects two details from different parts of the text. Either choice qualifies. | Reward it. Dorin's story breaks. New information opens up. |
| `PARTIAL` | One detail cited and nothing drawn from it — even the key detail, since noticing is not inferring — or a judgement with no evidence. "He's acting weird." "He looks like a bad guy." | Second chance, nudged from inside the fiction. Nel points at the unused detail without explaining it. |
| `GENERIC` | No view at all. "I dunno." "It felt right." Empty. | Bland response. Reveal nothing. This is the anti-gaming rule. |
| `CONTRADICTED` | The reason asserts something the text denies. "He came through the mud." | Show the consequence. Do not correct them. |

**Two hard constraints on every response:**

- Never say correct, incorrect, well done, or good spotting.
- Never restate the tell. If the narration explains the boots, the next player
  learns nothing.

---

## Beat structure

Two beats. Not one, not three. Every beat ends on a closed question.

**Beat 1** — the inn. *Do you go with him?*

**Beat 2** — branches on the bucket, but always lands on one more closed
question with new details to read:

- After `INTEGRATED`: Dorin's story breaks. The innkeeper says the dust on his
  boots is the same red dust as the quarry road. *Do you search the quarry, or
  make him talk?*
- After `PARTIAL`: the innkeeper picks up his boots to move them, turns them
  over, says nothing, puts them down. *Do you still go with him?* This is the
  second chance, nudged from inside the fiction.
- After `GENERIC`: nothing has moved. Dorin repeats his offer, more urgently.
  The rain is closer. *Do you go with him?*
- After `CONTRADICTED`: you are on the road with him. It is not muddy. It has
  not been muddy for a while. *Do you keep walking?*

Every branch is a second chance at the same inference. Nobody is locked out by
one wrong answer, which matters at twelve.

The `PARTIAL` path is the one to make sure works. It is the one a real learner
takes.

---

## The DM prompt

One call. Structured JSON out. Do not use two calls; you do not have the time
and the latency shows in demo.

```
You are the narrator of a text adventure for a twelve year old reader.

THE SCENE THE PLAYER HAS READ:
{scene_text}

THE HIDDEN INFERENCE:
{inference}
The two supporting details are: {detail_a} and {detail_b}.

THE ACTION THE PLAYER CHOSE:
{chosen_option}

WHAT THE PLAYER SAID WHEN ASKED WHY:
{player_reason}

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
  [on beat 2 this line is replaced by: "This is the last narration in the
  story. Nothing follows it, so do not set up what happens next or hint at a
  scene to come. End on the moment they are in."]
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
{"bucket": "...", "narration": "..."}
```

---

## Build scope

**In:**
- One page. Scene text, a text input, narration appended below.
- One API call per action.
- Two beats, then an ending.
- Readable type. Serif, generous line height, max ~65 characters per line.

**Out, decided now and not reopened:**
- Character creation, inventory, dice, combat, stats
- A second encounter
- Accounts, save state, a database
- Scene authoring UI
- Anything multiplayer

---

## Acceptance criteria

Each row is a chosen action plus a typed reason.

- [ ] Refuse + "his boots are dry, he wasn't in the marsh" → `INTEGRATED`
- [ ] **Go with him** + "his boots are dry, I want to see where he really
      goes" → `INTEGRATED`. This is the one that proves it measures reading
      and not obedience. If it fails, the prompt is classifying the choice.
- [ ] Refuse + "i dont trust him" → `PARTIAL`, not `INTEGRATED`
- [ ] Either + "i dunno" → `GENERIC`, and nothing in the scene advances
- [ ] Go with him + "he walked through the mud all night, he needs help" →
      `CONTRADICTED`, shown as a consequence, never as a correction
- [ ] Empty reason, or a single character, does not crash and lands `GENERIC`
- [ ] `PARTIAL` on beat 1 can still reach `INTEGRATED` on beat 2
- [ ] No response on any path uses the word "correct"

Test row two first. It is the whole design in one case.

---

## Demo

Hand it to someone who has never seen it. Let them read the scene aloud and
type their own words. Do not drive it yourself.

If they reach `INTEGRATED` without you explaining anything, the concept is
proven. If they need a hint from you, the scene is wrong, not the code.

---

## Timeline

- **+0:00 to 0:30** — Rewrite the scene in your own voice. No code.
- **+0:30 to 2:00** — Build the loop. Single file.
- **+2:00 to 3:00** — Playtest on whoever is at the table. Tune the prompt only.
- **+3:00 to 4:00** — Freeze. Deploy. Write the pitch. Rehearse once.

The freeze is the part that gets skipped and the part that loses.
