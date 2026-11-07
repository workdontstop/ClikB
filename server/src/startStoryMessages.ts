// Set to false to remove the architecture context from all three creation routes.
export const ENABLE_CLIKB_PIPELINE_CONTEXT = true;

// Edit this single variable to change the shared initial-model context.
export const CLIKB_PIPELINE_CONTEXT = `CLIKB — YOUR POSITION IN THE CREATION PIPELINE

ClikB turns user ideas into visual experiences: Shorts, Cinema,
and interactive hotspot or spatial experiences. These can express
stories, explanations, demonstrations, humour, music videos, and
other purposes inferred from the user's request.

Active mode: {activeMode}
Active options: {activeOptions}

PromptInput
User request + selected mode + optional style, world,
character/image references, authored scenes, or music
↓
StartStory  ← YOU ARE RESPONDING HERE
Create the concise scene foundation used by later AI stages.
↓
StartPlan
Preserve the request's meaning in a summary; establish visual
character descriptions and art style.
↓
Scene preparation
Optional casting and character/environment reference preparation.
↓
Storybook
Global intent → scene intent → image prompts → scene images.
Cinema develops each logical scene into Stage A and Stage B.
Other modes develop their corresponding scenes or nodes.
↓
EditStory
The user can edit images and prompts.
Main-scene image-prompt edits reconcile the scene's intent.
↓
Depending on the selected workflow:
├─ Video plan → video prompts → generated clips
│  Optional motion/frame guidance, reference video, lip-sync
├─ Narration preparation → voice/audio generation
├─ Music selection and timing
├─ Optional user-directed B-shots: extra supporting shots
└─ Hotspot or spatial configuration and preview
↓
Storybook publishing / rendering
↓
FullScreenStories
Watch or interact with the finished experience.

HOW TO WRITE YOUR RESPONSE

Return only scene data in the existing keyPoints JSON format.
Keep the existing scene-count and text-length requirements.

Within each scene, preserve the meaning and details that matter
for the user's intended experience. Where useful, include brief,
stage-addressed guidance for downstream AI alongside the scene
content, within the same text budget.

Infer which guidance is useful:

- Image guidance can clarify what should be visible.
- Cinema Stage A/B guidance can distinguish two useful depictions
  of the same scene: separate beats or complementary information.
- Video guidance can clarify intended action or progression.
- Narration guidance can clarify what the audience should learn
  or understand.
- Interaction/spatial guidance can clarify the intended experience.
- B-shot suggestions are optional ideas for user-directed additions.

Include only the guidance the particular scene benefits from.
A scene does not need instructions for every downstream stage.
Stage B and an optional B-shot are different things.

Address guidance to its intended stage so it can be interpreted
there rather than depicted or spoken as scene content. Later
stages elaborate it under their own instructions and the user's
current edits.

Do not reproduce this pipeline or explain your process.`;

/** Application instructions belong in system; scenario/reference text stays user data. */
export function buildStartStoryMessages(baseInstructions: string, taskInstructions: string, pp: string, remixData: string, activeMode = "Not specified", activeOptions: string[] = []) {
  const options = [
    ...activeOptions,
    ...(remixData.trim() ? ["World/reference context supplied"] : []),
  ];
  const pipelineContext = ENABLE_CLIKB_PIPELINE_CONTEXT
    ? CLIKB_PIPELINE_CONTEXT
        .replace("{activeMode}", () => activeMode)
        .replace("{activeOptions}", () => options.length ? options.join("; ") : "No additional options supplied to this request") + "\n\n"
    : "";
  return [
    { role: "system", content: `${pipelineContext}${baseInstructions}\n\nThe following task-specific requirements take precedence over conflicting general defaults above.\n\n${taskInstructions}` },
    { role: "user", content: JSON.stringify({ scenario: pp, ...(remixData.trim() ? { worldGuide: remixData } : {}) }) },
  ];
}
