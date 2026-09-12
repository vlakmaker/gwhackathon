# Reading comprehension — background

Supporting document. Written for the pitch, the README, and the questions a
judge will ask.

> **Verify before you cite.** The theory here is well established. The specific
> PISA and PIRLS figures are from memory and should be checked against the
> source before they appear on a slide. Where a number is load-bearing I have
> marked it.

---

## 1. What reading comprehension actually is

It is not one skill. The most useful model is the **Simple View of Reading**
(Gough and Tunmer, 1986):

```
Reading comprehension = Decoding × Language comprehension
```

Multiplication, not addition. Either factor at zero produces zero. A child who
decodes perfectly but has no grasp of what the sentences mean together reads
nothing. A child who understands spoken language beautifully but cannot decode
also reads nothing.

Scarborough's **Reading Rope** (2001) expands the second factor into strands
that have to be braided together:

- Background knowledge
- Vocabulary
- Language structures (syntax, how clauses relate)
- Verbal reasoning (inference, metaphor)
- Literacy knowledge (how texts work, genre conventions)

The rope matters because it shows comprehension is not a technique you apply to
a text. It is what happens when several slow-built capacities operate at once,
automatically enough that attention is free for meaning.

### The four layers of understanding a text

Useful for design, because they are not equally hard:

| Layer | Question | Difficulty |
|---|---|---|
| Decoding | What do these words say? | Mostly solved by age 9 |
| Literal | What happened? | Easy to test, easy to teach |
| **Inferential** | **What does this imply that it does not say?** | **The bottleneck** |
| Evaluative | Is this true, fair, well made? | Hardest, needs the above |

---

## 2. What is actually failing

This is the part most edtech gets wrong, so it is worth being precise.

**Decoding is not the problem.** Dutch and Flemish children learn to decode
well and early. Phonics instruction in both systems is broadly sound.

**The failure is concentrated in the inferential layer,** plus two upstream
causes:

**Background knowledge.** You cannot infer from a text about a subject you know
nothing about, because inference requires filling gaps with what you already
have. The classic demonstration is Recht and Leslie (1988): weak readers who
knew baseball comprehended a baseball passage better than strong readers who
did not. Knowledge is not a nice-to-have alongside comprehension; at the
inferential layer it largely *is* comprehension.

**Volume.** Comprehension is built by reading a great deal, not by being taught
about reading. Stanovich's **Matthew effect** (1986) describes the compounding:
children who read more get better, which makes reading more pleasant, which
means they read more. Children who read less fall further behind at an
accelerating rate. The gap at 15 was mostly created between 8 and 12.

And volume has collapsed. Across the OECD, the share of teenagers who report
reading for pleasure has fallen sharply over two decades. In the Netherlands
and Flanders it is among the lowest measured.

> **Check this:** PISA 2022 reported roughly one in three Dutch 15 year olds
> below Level 2 in reading, the threshold often described as functional
> literacy. The Flemish figure is lower but has declined across successive
> cycles. PIRLS 2021 showed Flanders performing weakly for grade 4 reading
> relative to comparable systems. Confirm the exact figures and years.

So the causal chain is: **enjoyment falls → volume falls → knowledge and
inference stop developing → comprehension scores drop.**

Most interventions target the last link. The break is at the first.

---

## 3. Why this matters more now, not less

The common response is that AI makes reading less necessary, because a model
can summarise anything. The opposite is true, for three reasons.

**Prompting is writing.** Getting useful output requires expressing an
intention precisely in language. This is a composition skill, and it is
downstream of reading.

**Evaluating output is reading comprehension.** A model produces fluent,
confident, well-structured prose that is sometimes wrong. Detecting that
requires exactly the inferential and evaluative layers: does this follow, does
this contradict what it said earlier, is this claim supported or just asserted.
A reader who operates only at the literal layer has no defence. They will read
a confident paragraph and accept it, because fluency reads as truth when you
cannot check the joins.

**The stakes have inverted.** Before, a weak reader encountered a limited
amount of text. Now anyone can generate unlimited plausible text on demand. The
cost of weak comprehension has gone up while the effort required to produce
things that need comprehending has gone to zero.

This is the same relationship arithmetic has to calculators. The calculator did
not remove the need for number sense. It removed the need to *execute*
calculations, while making number sense the only thing standing between you and
an unnoticed wrong answer.

---

## 4. What works, and what it costs

### Comprehension strategy instruction

Teaching children to predict, summarise, question, clarify, visualise.
**Reciprocal teaching** (Palincsar and Brown, 1984) is the best-evidenced form.

It works. It also has a low ceiling, and this is the most important finding in
the field for anyone building a product. Willingham's synthesis of the evidence
is that strategy instruction produces a real but one-off gain, and that a
handful of sessions captures nearly all of it. Continuing to drill strategies
for months adds very little.

The reason is that strategies are not a skill being built. They are a trick
being revealed: *the answer is not always stated, look for what is implied*.
Once a child knows that, knowing it harder does not help.

**Implication:** any product whose core loop is repeated strategy practice has
a ceiling it will hit within weeks.

### Building background knowledge

Slower, higher ceiling, strongly evidenced. Core Knowledge style curricula show
gains, though they are hard to implement and attribute.

### Reading volume

The strongest lever and the least tractable. There is no reliable way to make
someone read more except making them want to.

### Engagement

Reading enjoyment correlates with reading performance about as strongly as any
variable in PISA. Causation runs both ways, which is exactly the Matthew
effect. It also means enjoyment is a legitimate intervention point, not a soft
proxy for a real one.

Nobody builds for it, because enjoyment is hard to measure and a test score is
easy.

---

## 5. Where this approach sits

The design bets on the links in the chain that other products skip.

**It targets inference directly, but never teaches it.** The player is not told
to look for implications. They discover that the text contains information that
matters, because acting without it goes badly. This sidesteps the strategy
ceiling: the insight arrives once, through consequence, and then the game keeps
requiring it rather than keeps explaining it.

**It measures reasoning, not answers.** The player picks an action, then a
character asks why. Only the reason is assessed. This distinguishes a child who
understood from a child who guessed, which a comprehension question cannot do.
It also means the *risky* choice paired with good reasoning scores as well as
the safe one, so the exercise rewards reading rather than compliance.

**Feedback is consequence, not correction.** The system never says right or
wrong. A misread produces a worse situation in the story. This matters because
correction attaches reading to evaluation and evaluation is what makes children
avoid reading. A dry road under your feet teaches the same thing without the
grade attached.

**It is built for volume, not assessment.** The measurement exists to make the
story respond, not to produce a score. If a child plays because they want to
know what happens next, that is the mechanism working, not a distraction from
it.

**Content follows the reader.** Generating around what a child already cares
about attacks the background knowledge problem from the only angle that is
available to a product rather than a curriculum: you cannot install knowledge
in a session, but you can meet the knowledge they came with.

---

## 6. What this does not do

Include this. It is what separates a credible pitch from a pitch deck, and a
judge will find these anyway.

- **No evidence it works.** It is a demo built in four hours. Everything above
  is a reasoned bet, not a result. The honest claim is "this targets the right
  link in the chain," not "this improves comprehension."
- **It does not build background knowledge.** Generated fantasy content is
  low-knowledge by design. It exercises inference; it does not give a child
  more world to infer from. That remains a curriculum problem.
- **Difficulty calibration is unsolved.** Matching a text to a reader's level
  is the genuinely hard technical problem and it is not solved in a four hour
  build.
- **Generated prose is not literature.** Volume from generated text may not
  transfer the way volume from real books does. Vocabulary breadth, sentence
  variety and voice are all likely weaker. Plausibly a bridge to books rather
  than a replacement for them.
- **Screen versus paper.** Several meta-analyses find comprehension is somewhat
  better on paper for sustained reading. This ships on a screen.
- **Gaming the game.** Children optimise. If a pattern in the classifier can be
  exploited, it will be found. The GENERIC bucket is the guard against this and
  it is a partial one.

---

## 7. The thirty second version

> Reading comprehension in Flanders and the Netherlands has been falling for
> over a decade, and it is not a decoding problem. Kids can read the words.
> What has collapsed is inference: holding two things from different parts of a
> text and working out what they mean together.
>
> That happens because reading volume has collapsed, and volume has collapsed
> because reading stopped being enjoyable. Everyone builds better tests. Almost
> nobody builds for the part that actually broke.
>
> This is a text adventure where reading closely is how you win. You read a
> scene, you choose what to do, and a character asks you why. The story
> responds to your reasoning, not your answer. Nothing is ever marked right or
> wrong. If you misread, the world just gets harder in a way you could have
> seen coming.
>
> And it matters more now than it did five years ago, because evaluating what a
> language model tells you is reading comprehension under another name.

---

## Sources to verify

- Gough & Tunmer (1986), the Simple View of Reading
- Scarborough (2001), the Reading Rope
- Stanovich (1986), Matthew effects in reading
- Recht & Leslie (1988), the baseball study
- Palincsar & Brown (1984), reciprocal teaching
- Willingham, on the ceiling of strategy instruction
- PISA 2022 reading, Netherlands and Belgium/Flanders
- PIRLS 2021, Flanders
- Delgado et al. meta-analysis on screen versus paper comprehension

I have no search access in the session where this was written, so treat every
citation above as a lead to check rather than a reference. Author, year and
finding should be confirmed before any of it is stated publicly.
