/* Reading RPG — scene data.
 *
 * This file is PROSE plus the four fields the classifier needs. It holds no
 * logic, so the writing can be rewritten freely without touching the function
 * or the page.
 *
 * Loaded twice, deliberately:
 *   - the browser, via <script src="scenes.js"> in index.html
 *   - netlify/functions/turn.js, via require()
 * so the text the player reads and the text the model is told they read are
 * the same bytes. The module.exports guard at the bottom is what allows that
 * with no build step and no dependencies.
 *
 * SCENES is a flat map of scene_id -> scene. Beat 2 branches are ordinary
 * scenes with their own ids; beat 1 names its four successors in `next`,
 * keyed by bucket. That keeps the function's job to a single lookup and keeps
 * {scene_id, chosen_option, player_reason} as the whole API contract.
 *
 * Every scene carries the four prompt fields:
 *   scene_text  what the player read, verbatim
 *   inference   the hidden conclusion the two details support
 *   detail_a    first supporting detail
 *   detail_b    second supporting detail, from a different part of the text
 */

var GOAL = {
  role: "You are a Finder. People pay you to bring back what is lost.",
  tonight: "Tonight: the miller's daughter. You have until the rain starts."
};

/* Nel asks in the fiction. Never "explain your reasoning". */
var NEL_PROMPT = {
  stage: "Nel, your partner, watches Dorin over the rim of her cup.",
  question: "Alright. Why?",
  placeholder: "Type what you tell her...",
  /* SPEC: "One sentence is a fine answer. Nobody should feel they are writing
   * for a teacher." That was a requirement and the UI shipped without it. It
   * must not hint at the answer — only at how little is needed. */
  reassurance: "One sentence is enough."
};

var FIRST_SCENE = "greyford-inn";

var SCENES = {

  /* ---------------------------------------------------------------- BEAT 1 */

  "greyford-inn": {
    beat: 1,

    /* SPEC.md "Reference scene", verbatim. Yours to rewrite. */
    scene_text:
      "The inn at Greyford has one rule, and the innkeeper says it twice: " +
      "scrape your boots at the door. The road up from the marshes is " +
      "ankle-deep in black mud from autumn until spring, and she is tired of " +
      "mopping.\n\n" +
      "The man by the fire is called Dorin. He is telling anyone who will " +
      "listen that he walked all night from the marsh road, that the bandits " +
      "took the miller's daughter at dusk, and that he was the only one to " +
      "get away. His hands shake around his cup. There is a long white scar " +
      "across his knuckles.\n\n" +
      "The innkeeper's dog will not settle. It circles the table twice and " +
      "lies down facing him.\n\n" +
      "Dorin's boots are by the fire, drying. They are grey with dust.\n\n" +
      "He says he will lead you to the camp himself, if you go now, before " +
      "the rain.\n\n" +
      "Dorin is waiting. Do you go with him?",

    inference:
      "The marsh road is ankle-deep black mud, and Dorin's boots are dry and " +
      "grey with dust, so he did not walk up from the marsh. He is lying " +
      "about where he has been.",
    detail_a: "the road up from the marshes is ankle-deep in black mud",
    detail_b: "Dorin's boots are drying by the fire and are grey with dust",

    /* State the action, never the reasoning. SPEC.md, and the whole design. */
    options: ["Go with him", "Refuse", "Ask him a question first"],

    next: {
      INTEGRATED:   "quarry-road",
      PARTIAL:      "boots-turned-over",
      GENERIC:      "the-offer-again",
      CONTRADICTED: "the-dry-road"
    }
  },

  /* ---------------------------------------------------- BEAT 2, four branches
   * Each is a second chance at the same inference, so a PARTIAL on beat 1 can
   * still reach INTEGRATED here. All beat-2 prose is placeholder — written
   * only from the branch descriptions in SPEC.md "Beat structure", and yours
   * to rewrite.
   */

  /* After INTEGRATED: his story breaks, and something opens up. */
  "quarry-road": {
    beat: 2,
    from_bucket: "INTEGRATED",

    scene_text:
      "Dorin stops talking. The innkeeper has picked up one of his boots and " +
      "is holding it near the lamp, scratching at the sole with her " +
      "thumbnail.\n\n" +
      "\"That's not marsh dirt,\" she says. \"That's red. There's one red " +
      "road out of Greyford and it goes up to the old quarry.\"\n\n" +
      "The quarry has been shut four years. Nobody keeps a camp there, " +
      "because there is no water.\n\n" +
      "Dorin is looking at the door. Nel has not moved, but her cup is down " +
      "on the table now.\n\n" +
      "Do you search the quarry, or make him talk?",

    inference:
      "The dust on his boots is the red of the quarry road, and the quarry " +
      "is shut and waterless, so he has come from somewhere nobody would " +
      "camp — which is where the girl is being kept.",
    detail_a: "the dust on his boots is red, and only the quarry road is red",
    detail_b: "the quarry has been shut four years and has no water",

    options: ["Search the quarry", "Make him talk"],

    ending:
      "The rain starts before you are halfway up. It does not matter. You " +
      "know where you are going, and you knew it in the inn, an hour before " +
      "anyone said the word quarry out loud."
  },

  /* After PARTIAL: the nudge from inside the fiction. The path a real
   * learner takes — SPEC.md calls this the one to make sure works. */
  "boots-turned-over": {
    beat: 2,
    from_bucket: "PARTIAL",

    scene_text:
      "The innkeeper comes past to move the boots off the hearth, the way " +
      "she moves everything that is in her way.\n\n" +
      "She picks one up. She turns it over. She looks at the sole for a " +
      "moment longer than she needs to.\n\n" +
      "Then she puts it down and goes back to the bar without saying " +
      "anything at all.\n\n" +
      "Dorin has not noticed. He is still talking about the marsh road, " +
      "about walking it all night, about the rain coming.\n\n" +
      "Do you still go with him?",

    inference:
      "The marsh road is ankle-deep black mud, and the sole she turned over " +
      "is dry and grey, so he did not walk up from the marsh. He is lying " +
      "about where he has been.",
    detail_a: "the road up from the marshes is ankle-deep in black mud",
    detail_b: "the sole the innkeeper turned over is dry and grey, not muddy",

    options: ["Go with him", "Refuse"],

    ending:
      "Nel pulls her hood up and waits for you by the door. \"Next time,\" " +
      "she says, \"say it out loud when you see it. It counts for more when " +
      "it's early.\""
  },

  /* After GENERIC: nothing has moved. Reveal nothing. The anti-gaming rule. */
  "the-offer-again": {
    beat: 2,
    from_bucket: "GENERIC",

    scene_text:
      "Dorin pushes his cup away and leans across the table.\n\n" +
      "\"We go now or we don't go,\" he says. \"Once it rains you'll not " +
      "find the track at all, and she's out there in it.\"\n\n" +
      "The fire has burned down. His boots are still beside it. The dog has " +
      "not moved from where it lies, facing him.\n\n" +
      "Outside, the first drops are coming off the gutter, slow, one at a " +
      "time.\n\n" +
      "Do you go with him?",

    inference:
      "The marsh road is ankle-deep black mud, and his boots have been " +
      "sitting dry and grey by the fire the whole time, so he did not walk " +
      "up from the marsh. He is lying about where he has been.",
    detail_a: "the road up from the marshes is ankle-deep in black mud",
    detail_b: "his boots are still by the fire, dry and grey with dust",

    options: ["Go with him", "Refuse"],

    ending:
      "The rain comes on properly as you decide. Whatever you chose, you " +
      "chose it knowing exactly as much as you knew when you walked in."
  },

  /* After CONTRADICTED: show the consequence. Do not warn, do not correct. */
  "the-dry-road": {
    beat: 2,
    from_bucket: "CONTRADICTED",

    scene_text:
      "You are an hour out of Greyford, walking behind him.\n\n" +
      "The road is pale. It is dry enough that your boots raise dust, and " +
      "the dust settles on the backs of your legs and stays there.\n\n" +
      "It has not rained here in a long time. Not last night. Not the night " +
      "before.\n\n" +
      "Dorin keeps a good pace for a man who walked all night. He does not " +
      "look back at you. Somewhere behind, thunder goes over the marshes.\n\n" +
      "Do you keep walking?",

    inference:
      "The road you are on is dry and dusty, and the marsh road he said he " +
      "walked is black mud until spring, so this is not the way he came and " +
      "he is not taking you where he said.",
    detail_a: "the road under your boots is dry and raises dust",
    detail_b: "he said he walked all night up the marsh road, which is mud",

    options: ["Keep walking", "Stop and ask him where you are"],

    ending:
      "Nel catches your eye over his shoulder and taps the side of her own " +
      "boot, once. She has been looking at the ground since the inn."
  }
};

/* Same file, both runtimes. No build step, no dependency. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { SCENES: SCENES, GOAL: GOAL, NEL_PROMPT: NEL_PROMPT, FIRST_SCENE: FIRST_SCENE };
}
