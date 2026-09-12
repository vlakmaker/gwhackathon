# The Finder

The Finder is a short, browser-based reading-comprehension adventure for
twelve-year-old readers. The player reads a scene, chooses an action, then
answers a character who asks why. The story responds to the reason, not to the
button they chose.

It is deliberately one encounter: two beats and an ending. There are no
scores, accounts, saved games, or correct/incorrect messages.

## The idea

The game practises inference rather than recall. A scene includes details from
different places in the text. The player must work out what those details imply
and use that understanding in the reason they give.

For example, a player may choose to go with a suspicious character because they
noticed evidence that he is lying and want to see where he actually goes. That
is just as meaningful as refusing to go. The action is not graded; the reason
is what matters.

When a player misses or contradicts a detail, the fiction changes accordingly.
It does not announce a verdict or explain the hidden inference.

## Player Flow

1. The page shows the player's role, goal, and deadline.
2. The player reads a scene and chooses one of two or three actions.
3. Nel, the player's companion, asks, "Alright. Why?"
4. The player types a short reason in their own words.
5. The server classifies that reason and returns a short piece of narration.
6. The first beat routes to one of four second-beat scenes.
7. After the second reason, the encounter ends.

The player can always scroll back to reread the scene and their own previous
choice and explanation.

## Reason Buckets

The server uses four internal buckets. They are never displayed to the player.

| Bucket | Meaning in the story |
| --- | --- |
| `INTEGRATED` | The reason connects evidence from the scene to an implication. The world opens up. |
| `PARTIAL` | The reason engages with the scene but does not yet reach the implication. The next beat offers another chance. |
| `GENERIC` | The reason gives no view, such as "I dunno." The story reveals nothing new. |
| `CONTRADICTED` | The reason treats a claim undermined by the text as true. The consequence appears in the story without a correction. |

The central rule is: **classify the reason, never the chosen action.** Either
action can pair with any bucket.

## Architecture

The project has no framework, bundler, database, or npm dependencies.

| Location | Responsibility |
| --- | --- |
| `public/index.html` | The complete one-page interface, styling, and browser-side flow. |
| `public/scenes.js` | Scene prose, options, routing, and the classifier facts for each scene. |
| `netlify/functions/turn.js` | Netlify Function that validates a turn, calls the model, and returns `{ bucket, narration }`. |
| `check.js` | Live acceptance check for the intended classifications. |
| `tests/` | Offline structural, API, and parsing tests. |
| `SPEC.md` | The product and interaction source of truth. |

`public/scenes.js` is loaded by both the browser and the server function. This
ensures the model is given the exact scene text the player read.

## Model Turn

The browser sends only this turn payload to the Netlify Function:

```json
{
  "scene_id": "greyford-inn",
  "chosen_option": "Refuse",
  "player_reason": "His boots are dry, so he did not come through the marsh."
}
```

The function builds a scene-specific prompt and calls OpenRouter using
`OPENROUTER_API_KEY`, which remains on the server. A valid model reply contains
only a bucket and narration. The function defensively parses malformed replies
and falls back to a neutral `GENERIC` narration if a request, model reply, or
configuration fails.

There is one primary model call per turn. A fallback model is used only if the
primary call fails, times out, or returns an unusable response.

Player reasons are never logged. API keys are never returned to the browser or
included in logs.

## Run Locally

Requirements:

- Node 22
- Netlify CLI
- An `OPENROUTER_API_KEY` environment variable

Start the local site and function server:

```bash
netlify dev
```

Open `http://localhost:8888`.

Run the offline tests:

```bash
node --test
```

Run the live acceptance check in another terminal while `netlify dev` is
running. This calls the model and incurs API cost:

```bash
node check.js
```

To check repeated classifier behaviour, pass a run count:

```bash
node check.js --runs=3
```

## Design Constraints

- The encounter has exactly two beats and one ending.
- Options describe actions, not the reasoning required to choose them.
- The player is never told they are correct, incorrect, right, or wrong.
- The narration must not explain the hidden inference.
- The scene prose in `public/scenes.js` is authored content; change it with
  care and keep its classifier fields in sync.
- Never add browser-side model calls, persistence, analytics, or a dependency
  just to solve a small problem.

## Current Limits

This is a hackathon demo, not evidence that the approach improves reading
comprehension. Difficulty calibration, generated-prose quality, and reliable
model classification still require real playtesting, especially with the
intended age group.
