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
  tonight: "Tonight: the baker's daughter. You have until the rain starts."
};

/* Nel asks in the fiction. Never "explain your reasoning". */
var NEL_PROMPT = {
  stage: "Nel, your partner, watches Dorin over the rim of her cup.",
  question: "Alright. Why?",
  placeholder: "Type what you tell her...",
  /* SPEC: "One sentence is a fine answer. Nobody should feel they are writing
   * for a teacher." It must say how little is needed, never what to say. */
  reassurance: "One sentence is enough."
};

var FIRST_SCENE = "greyford-inn";

var SCENES = {

  /* ---------------------------------------------------------------- BEAT 1 */

  "greyford-inn": {
    beat: 1,

    /* Rewritten for a twelve year old reading English.
     *
     * The inference is untouched: mud on the road, dust on the boots. What
     * changed is everything that cost reading effort without adding difficulty.
     *
     *   innkeeper  -> the woman who runs it
     *   miller     -> baker            (a job a child has met)
     *   bandits    -> robbers
     *   at dusk    -> just before dark
     *   scrape     -> wipe
     *   will not settle -> will not lie down
     *   the scar across his knuckles -> cut entirely, with "knuckles"
     *
     * "marsh" stays: one syllable, concrete, and named in SPEC's acceptance
     * table, so renaming it would cost more than it buys.
     *
     * The 35-word sentence with three stacked "that" clauses is now four short
     * ones. And the two details are ~60 words apart instead of 127 — the dog
     * still sits between them, because putting the boots directly after his
     * claim would juxtapose the answer into place.
     *
     * Two decoys, both in plain words: the shaking hands and the dog.
     */
    scene_text:
      "The inn at Greyford has one rule, and the woman who runs it says it " +
      "twice: wipe your boots at the door. The road up from the marsh is thick " +
      "black mud all winter. Deep enough to pull a boot off your foot. She is " +
      "tired of mopping.\n\n" +
      "The man by the fire is called Dorin. He says he walked all night up " +
      "that road. He says robbers took the baker's daughter just before dark. " +
      "He says he was the only one who got away. His hands shake around his " +
      "cup.\n\n" +
      "The dog will not lie down. It circles the table twice, then lies down " +
      "facing him.\n\n" +
      "Dorin's boots are by the fire, drying. They are grey with dust.\n\n" +
      "He says he will take you to the camp himself, if you go now, before the " +
      "rain. Outside, the sky has gone the colour of a bruise.\n\n" +
      "Dorin is waiting. Do you go with him?",

    inference:
      "The road up from the marsh is thick black mud, and Dorin's boots are " +
      "dry and grey with dust, so he did not walk up that road. He is lying " +
      "about where he has been.",
    detail_a: "the road up from the marsh is thick black mud all winter",
    detail_b: "Dorin's boots are drying by the fire and are grey with dust",

    /* Two, not three. "Ask him a question first" was removed: the player could
     * not supply the question, and worse, the box that appears next captures
     * their REASON — a child who typed their question into it scored GENERIC
     * for engaging properly. Go and Refuse are both commitments the story can
     * honour. */
    options: ["Go with him", "Refuse"],

    next: {
      INTEGRATED:   "quarry-road",
      PARTIAL:      "boots-turned-over",
      GENERIC:      "the-offer-again",
      CONTRADICTED: "the-dry-road"
    }
  },

  /* ---------------------------------------------------- BEAT 2, four branches
   * Each is a second chance at the same inference, so a PARTIAL on beat 1 can
   * still reach INTEGRATED here.
   *
   * `endings` is keyed by the option the player chose, so the last choice
   * changes how it ends. A single fixed ending contradicted half of them: the
   * quarry branch offered "Make him talk" and then ended with you halfway up
   * the quarry road.
   */

  /* After INTEGRATED: his story breaks, and something opens up. */
  "quarry-road": {
    beat: 2,
    from_bucket: "INTEGRATED",

    scene_text:
      "Dorin stops talking. The woman who runs the inn has picked up one of " +
      "his boots. She holds it near the lamp and scratches at the bottom of it " +
      "with her thumb.\n\n" +
      "\"That is not marsh dirt,\" she says. \"That is red. There is one red " +
      "road out of Greyford. It goes up to the old stone pit.\"\n\n" +
      "The stone pit has been shut for years. There is no reason for anyone to " +
      "be up there at all.\n\n" +
      "Dorin is looking at the door. Nel has not moved, but her cup is down on " +
      "the table now.\n\n" +
      "Do you go up to the pit, or make him talk?",

    /* The old version claimed the red dust proved the girl was being kept at
     * the pit. It proved no such thing — and the line it leaned on ("no water,
     * so nobody camps there") argued the opposite. This is what the scene
     * actually supports and nothing more. */
    inference:
      "The dust on his boots is the red of the stone pit road, and the only " +
      "red road out of Greyford goes to the pit, so that is where he has been " +
      "— not the marsh, and not where he says the camp is.",
    detail_a: "the dust on his boots is red, not marsh black",
    detail_b: "the only red road out of Greyford goes up to the old stone pit",

    options: ["Go up to the pit", "Make him talk"],

    endings: {
      "Go up to the pit":
        "You go up the red road in the rain. Dorin does not come, and nobody " +
        "makes him. You knew where you were going before anyone said the name " +
        "of the place out loud, and that is why you get there first.",
      "Make him talk":
        "You sit down across from him and wait. Dorin talks about the marsh " +
        "for a while, and then he stops talking about the marsh. By the time " +
        "the rain starts he has told you a second story, and this one has a " +
        "place in it."
    }
  },

  /* After PARTIAL: the nudge from inside the fiction. The path a real
   * learner takes — SPEC calls this the one to make sure works. */
  "boots-turned-over": {
    beat: 2,
    from_bucket: "PARTIAL",

    scene_text:
      "The woman who runs the inn comes past to move the boots away from the " +
      "fire. She moves them the way she moves anything in her way.\n\n" +
      "She picks one up. She turns it over. She looks at the bottom of it for " +
      "a moment longer than she needs to.\n\n" +
      "Then she puts it down and goes back to the bar without saying " +
      "anything at all.\n\n" +
      "Dorin has not noticed. He is still talking about the road, about " +
      "walking it all night, about the rain coming.\n\n" +
      "Do you still go with him?",

    inference:
      "The road up from the marsh is thick black mud, and the bottom of the " +
      "boot she turned over is dry and grey, so he did not walk up that road. " +
      "He is lying about where he has been.",
    detail_a: "the road up from the marsh is thick black mud all winter",
    detail_b: "the bottom of the boot she turned over is dry and grey, with no mud on it",

    options: ["Go with him", "Refuse"],

    endings: {
      "Go with him":
        "You walk out with him into the first of the rain. You keep half a " +
        "step behind him, and you watch the ground the whole way. Nel comes " +
        "too, without being asked.",
      "Refuse":
        "You stay by the fire. Dorin goes out alone, and the woman who runs " +
        "the inn watches the door long after it has shut. Nel sits down beside " +
        "you and says nothing, which from Nel is a kind of agreement."
    }
  },

  /* After GENERIC: nothing has moved. Reveal nothing. The anti-gaming rule. */
  "the-offer-again": {
    beat: 2,
    from_bucket: "GENERIC",

    scene_text:
      "Dorin pushes his cup away and leans across the table.\n\n" +
      "\"We go now or we do not go,\" he says. \"Once it rains you will not " +
      "find the track at all, and she is out there in it.\"\n\n" +
      "The fire has burned low. His boots are still beside it. The dog has not " +
      "moved from where it lies, facing him.\n\n" +
      "Outside, the first drops are coming off the roof, slow, one at a " +
      "time.\n\n" +
      "Do you go with him?",

    inference:
      "The road up from the marsh is thick black mud, and his boots have been " +
      "sitting dry and grey beside the fire the whole time, so he did not walk " +
      "up that road. He is lying about where he has been.",
    detail_a: "the road up from the marsh is thick black mud all winter",
    detail_b: "his boots are still beside the fire, dry and grey with dust",

    options: ["Go with him", "Refuse"],

    endings: {
      "Go with him":
        "You go. The rain finds you before the road does. Dorin talks the " +
        "whole way, and you learn nothing you did not already have in front of " +
        "you in the inn.",
      "Refuse":
        "You stay. Dorin goes out into the rain alone and the door bangs twice " +
        "behind him. Nel looks at you, waiting for a reason, and you do not " +
        "have one for her yet."
    }
  },

  /* After CONTRADICTED: show the consequence. Do not warn, do not correct. */
  "the-dry-road": {
    beat: 2,
    from_bucket: "CONTRADICTED",

    scene_text:
      "You are an hour out of Greyford, walking behind him.\n\n" +
      "The road is pale. It is dry enough that your boots kick up dust, and " +
      "the dust settles on the backs of your legs and stays there.\n\n" +
      "It has not rained here in a long time. Not last night. Not the night " +
      "before.\n\n" +
      "Dorin keeps a good pace for a man who walked all night. He does not " +
      "look back at you. Somewhere behind, thunder goes over the marsh.\n\n" +
      "Do you keep walking?",

    inference:
      "The road you are walking is dry and dusty, and the road up from the " +
      "marsh is thick black mud, so this is not the road he said he came down. " +
      "He is not taking you where he said he would.",
    detail_a: "the road under your boots is dry and kicks up dust",
    detail_b: "he said he walked all night up the marsh road, which is thick mud",

    options: ["Keep walking", "Ask him where you are"],

    endings: {
      "Keep walking":
        "You keep walking. The road stays dry and pale under both of you, and " +
        "Dorin keeps a good pace for a man who says he walked all night. " +
        "Somewhere behind you the rain is falling on the marsh, where you are " +
        "not.",
      "Ask him where you are":
        "You stop in the middle of the dry road and ask him where you are. " +
        "Dorin turns round. He looks at your boots, and then at his own, and " +
        "for the first time tonight he has nothing to say."
    }
  }
};

/* Same file, both runtimes. No build step, no dependency. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { SCENES: SCENES, GOAL: GOAL, NEL_PROMPT: NEL_PROMPT, FIRST_SCENE: FIRST_SCENE };
}
