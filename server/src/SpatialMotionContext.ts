import { DEFAULT_LANGUAGE_MODEL_TIER, isLanguageModelTier, languageModelForTier } from "./languageModels";
import { spatialPlanningInference } from './spatialPlanningInference';
import { validateSpatialPlan } from "./spatialPlanValidation";
import type { Request, Response } from "express";
import OpenAI from "openai";
import { createRoutedTextClient } from "./textGeneration";
import { recordOpenAiUsage } from "./aiUsageLedger";

export const SPATIAL_MOTION_CONTEXT_MODEL = "gpt-6-luna";
export const SPATIAL_MOVEMENT_REFINER_MODEL = "gpt-5.6-terra";

type JsonRecord = Record<string, unknown>;
type ControlMode = "character" | "vehicle" | "mounted" | "pov" | "other";

const openai = createRoutedTextClient(new OpenAI({ apiKey: process.env.DALLE_KEY }));
const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const asText = (value: unknown, max: number): string =>
  (typeof value === "string" ? value : "").replace(/\s+/g, " ").trim().slice(0, max);
const modes = new Set<ControlMode>(["character", "vehicle", "mounted", "pov", "other"]);

const renderedMotionImages = (referenceMotion: JsonRecord | undefined): any[] => {
  const evidence = isRecord(referenceMotion?.motionEvidence) ? referenceMotion.motionEvidence : undefined;
  if (!Array.isArray(evidence?.frames)) return [];
  const diagram = isRecord(evidence.diagram) && typeof evidence.diagram.imageUrl === 'string' && /^https:\/\//i.test(evidence.diagram.imageUrl)
    ? [{ type: 'text', text: 'ANNOTATED THREE.JS MOTION PLAN. Object IDs, START/STOP and directional arrows describe this one authored route. The X/Z inset shows the whole trajectory. These annotations are reasoning evidence only; express their meaning in physical scene relationships and never include them in the generated video.' },
       { type: 'image_url', image_url: { url: evidence.diagram.imageUrl, detail: 'high' } }] : [];
  return [...diagram, ...evidence.frames.flatMap(frame => isRecord(frame) && typeof frame.imageUrl === 'string' && /^https:\/\//i.test(frame.imageUrl)
    ? [{ type: 'text', text: `THREE.JS MOTION AT ${frame.t} SECONDS. Same authored scene and controlled unit; primitive appearance is motion evidence only. Match stable object IDs to referenceMotion.objects and their state.` },
       { type: 'image_url', image_url: { url: frame.imageUrl, detail: 'high' } }]
    : [])];
};

const SYSTEM_PROMPT = `
You create compact motion-control context for an interactive spatial-video joystick.
Return strict JSON only, with one result for every supplied scene and no markdown.

The joystick directly controls ONE subject or one natural controllable unit (for example a
rider and mount). Infer that subject from the global intent, exact scene intent, and exact
video prompt. Do not create identity/reference profiles and do not retell the story.

Each scene may set stateMode to "post-action" and provide completedAction plus
previousMotionContext. In that mode, the action has ALREADY FINISHED. Infer and return the
persistent physical/control state at the final instant after completedAction. The supplied FINAL
FRAME is authoritative evidence of that resulting state. The final action outcome overrides older
scene intent and previous state. Never repeat, reverse, or automatically
undo that completed action in primaryMotion. If the completed action mounts or boards a rideable
subject, return controlMode "mounted", make rider and mount the single controlledSubject, and make
primaryMotion move that mounted unit together in future joystick directions. Never dismount unless
a later explicit action requests dismounting. Apply the equivalent persistent-state rule to entering
or exiting vehicles, picking up or dropping objects, transformations, and other state changes.

For every scene return:
- sceneId: exactly the supplied sceneId.
- controlledSubject: a short unambiguous description of what the joystick controls.
- controlMode: character, vehicle, mounted, pov, or other.
- primaryMotion: one short locomotion profile for the controlled subject. For character control,
  describe its natural walking gait (human walk, zombie shamble, dinosaur stride, and so on), never
  running or sprinting. For vehicle or mounted control, use the scene's current intensity to define
  appropriate driving/riding speed and mechanics. Include no plot goal, destination, route, named
  secondary subject, or camera instruction.
- ambientMotion: one short secondary-motion profile. Identify prominent secondary living or
  movable subjects and classify them from scene intent: normally they remain anchored at their
  current positions with only natural in-place motion; if the scene explicitly establishes active
  travel (other racers in a race, a moving crowd, flying birds), preserve that independent travel.
  Never make a secondary subject follow the controlled subject merely because the joystick moves.

The text will be inserted directly into a video-generation prompt. Be concrete, imperative,
and compact. Do not use generic phrases such as "move naturally" without saying what moves.

OUTPUT SHAPE:
{"contexts":[{"sceneId":"...","controlledSubject":"...","controlMode":"character","primaryMotion":"...","ambientMotion":"..."}]}
`.trim();

const VISUAL_REFINER_SYSTEM_PROMPT = `
You convert one joystick gesture into one compact spatial movement instruction for the ONE stored
controlledSubject. controlledSubject was already identified from story intent and is authoritative.
Never choose a different subject from image prominence. Return strict JSON only with exactly these
fields and never explain your work:
{"startRelation":"...","route":"...","endRelation":"...","controlledMovement":"...","secondaryMotion":"...","spatialPlan":{"cameraMode":"fixed","unitStaysInside":true,"preservesControlState":true,"inventsEnvironment":false,"boundaryLimited":false,"path":[{"x":0.5,"y":0.0,"z":0.3},{"x":0.6,"y":0.0,"z":0.3}]}}

joystickInput is the creator's explicit movement constraint, not optional inspiration.
Its x is positive toward the displayed frame's right and negative left. Its y is positive for
FORWARD (joystick up, away from the viewer into scene depth) and negative for BACKWARD (toward
viewer). FORWARD never means flying upward or moving toward the viewer just because the subject
faces the camera. LEFT/RIGHT refer to the viewer's frame, not the character's anatomical sides.
Preserve both components for diagonals. startPoint, when present, uses normalized image coordinates
(x right, y down) and identifies the controlled unit's ground position, not the destination.
Resolve a grounded route around obstacles consistent with these constraints. For forward movement,
consider passing behind nearby subjects where the actual geometry supports it. Do not invent a
sideways destination for pure forward movement. Before returning, check that route, endRelation,
and controlledMovement agree with the requested direction. Do not expose coordinates or control
labels in the final prose; express them through concrete scene relationships.

The low-resolution current-frame image and its bright control vector are reasoning evidence only.
For a return request with two images, the current image is unannotated: use the subject's actual visible location and the second image as the destination state. Do not assume a control vector is present. Both images depict the same subjects at different times, never additional subjects.
Use the subject's visible starting location, the vector's direction and magnitude when present, perspective,
walkable surfaces, depth, and nearby landmarks to infer a physically plausible route and endpoint.
Resolve that evidence into explicit scene-relative spatial language. The video model must never be
told about an arrow, line, dot, overlay, marker, marked position, screen-left, or screen-right.

Write the first sentence about moving that exact controlledSubject. Name it first, state its natural
locomotion, give a concise approximate distance or route, and describe its final spatial relation
using visible geometry when helpful. Do not discuss the camera or cinematography. For POV, mounted,
or vehicle control, the stored controlledSubject is still the primary moving unit.
Treat the depicted scene as a bounded 3D volume. Every part of the controlled unit and its entire
route must remain inside that existing space. Do not invent new terrain, locations, exits, or unseen
extensions of the environment. Shorten or stop movement at a boundary or impassable obstacle;
never move the camera to make room. Preserve the stored locomotion, speed context, mounted/vehicle
state, and established altitude for flying units. Ground units use traversable surfaces; airborne
units move through the depicted airspace. Do not force flying units to land.
For third-person, lock the camera position, orientation, lens and framing. The controlled unit moves
within that view. No following, side-tracking, orbit, pan, zoom, cut or reframing.
For POV, translate only with the controlled viewpoint within the existing space; keep orientation
and lens unchanged. No independent camera movement or invented environment beyond the scene.
Return spatialPlan with cameraMode "fixed" for third-person or "pov-translation" for POV.
Its path is your inferred 3D route: normalized x increases to viewer-right, y is height, z increases
away from the viewer into depth. All coordinates must stay in [0,1]. These are inferred scene-space
coordinates, NOT the image startPoint coordinates. Include the start and end and obstacle turns.
Account for the WHOLE unit's size, not just its center. unitStaysInside and preservesControlState
must be true, inventsEnvironment false. If a boundary prevents travel, set boundaryLimited true
and describe the shortened travel or holding position. The prose must express this exact plan.
These spatial/camera constraints also apply when helper text supplies a route or speed.

Before writing controlledMovement, fully resolve:
- startRelation: where the controlled subject visibly begins relative to nearby scene geometry.
- route: the physical path it takes, including whether it passes in front of, behind, between, or
  around nearby geometry.
- endRelation: the concrete final position relative to visible scene geometry.
controlledMovement must incorporate all three resolved relationships as one natural sentence. Never
replace them with a vague phrase such as "toward the area", "nearby", or "beside it".

Use one short second sentence for prominent secondary subjects visible in the frame. If
secondaryMotionContext does not explicitly establish an unmistakable active movement system, state
that subject by name/type and require it to remain in its exact position and current state while
allowing only natural in-place motion. The ACTUAL current-frame image overrides old story verbs or
earlier scene intent. A visibly standing horse always stays planted and may only breathe, look, or
move its head, mane, and tail in place; it must never advance, walk, follow, or change position.
Standing people follow the same rule.

The only automatic exceptions are an unmistakable ongoing race, established traffic flow, moving
crowd, or flock already in flight, and the current frame must visually support that active system.
A chase mentioned in story text does not qualify by itself. Never let any secondary subject copy,
follow, or join the controlled movement.

secondaryMotion must be that complete second sentence, or an empty string only when no prominent
secondary subject exists.

For character control, always use that character's natural walking gait: a person walks, a zombie
shambles, and a dinosaur strides. Never make a character run or sprint unless userInstruction
explicitly requests it. For vehicle or mounted control, scale driving or riding speed from scene
context. The creator's explicit helper overrides the automatic speed choice.

Write the actual number naturally inside controlledMovement as "over 5 seconds" or "over 10
seconds". Never output the token durationSeconds or any programming-style field name. Keep
controlledMovement plus secondaryMotion within 55 words total.

When userInstruction is supplied, it is the creator's highest-priority clarification. Use the image
to ground its nouns and spatial relationships, but do not weaken, replace, or expand its requested
movement.

For a return request, the second image is the exact previous-node state. Describe a newly performed
physical movement of the same controlled subject back to that spatial state; never describe rewind
or reverse playback. Treat userInstruction as the forward action to undo unless it explicitly gives
separate return behavior.
`.trim();

const THREE_CONTROL_CONTINUITY = `
For this authored Three.js request, primarySubjectName identifies the persistent character;
controlledIdentity identifies the actual moving unit. A vehicle or mount can carry that same actor.
Riders, passengers and held equipment belong to the moving unit, never stationary bystanders.
Preserve their identities and state. An explicit exit, release or dismount restores the same actor
or released item; changing the moving unit never replaces the main character.
The secondary-motion restrictions above are defaults only for subjects without explicit creator
choreography. Honor current userInstruction requests for independent behavior, such as enemies
attacking, villagers fleeing or another character approaching, while retaining the exact recorded
controlled-unit trajectory. Do not make others copy joystick motion automatically. Completed
actions remain completed. Explicit cameraInstruction overrides the fixed-camera default.
Keep automatic prose compact; allow up to 120 words to preserve explicit creator choreography.
`.trim();

// The recording has already resolved geometry and movement. Re-inferring a
// landmark destination here can turn the approved route into a different one.
const AUTHORED_THREE_REFINER_SYSTEM_PROMPT = `
Describe the supplied processed Three.js movement in compact, natural language for video generation.
Return strict JSON with startRelation, route, endRelation, controlledMovement, secondaryMotion and
spatialPlan. Use the same spatialPlan shape as
{"cameraMode":"fixed","unitStaysInside":true,"preservesControlState":true,"inventsEnvironment":false,"boundaryLimited":false,"path":[{"x":0.5,"y":0,"z":0.3},{"x":0.6,"y":0,"z":0.3}]}.

referenceMotion is the authoritative performance, not a suggested destination to reinterpret.
Read its exact timeline: sourceState, trajectory, local-part poses, attachments, projectionCamera,
time-labelled images and endState. The original scene image establishes appearance and environment;
it must not reset a changed pose, mounted state, held object or current controlled subject.
Name the exact controlledSubject first. Describe its actual sequence of turns and travel in plain
language, such as "turns in place and walks calmly forward into the garden" or "turns, walks right
and goes off screen" when those are the recorded movements. Preserve deliberate yaw, pitch, roll,
height and posture changes, their order and timing, and any rider, passenger or carried item moving
with the unit. Include the supplied duration naturally, for example "over 5 seconds".

Do not invent approximate distances, a curve, a landmark-based destination or a stopping point.
startRelation, route and endRelation are brief descriptions of the actual authored start, movement
and final pose; they need not mention landmarks or appear together in controlledMovement. Use a
landmark only when it clarifies an evidenced relation without changing the recorded route. The
last recorded pose is not by itself a command to stop beside visible scenery. Preserve an authored
exit from the camera frame. Leaving the camera frame is different from leaving the authored world:
never shorten an approved route or force its endpoint back on screen to keep the subject visible.
Do not invent new environments or change the established locomotion or control state.

spatialPlan is a normalized description of the already authored world-space path, not a new path
inferred from image coordinates. Normalize against the authored world, not the camera frame; an
off-screen destination can remain inside this world. cameraMode is fixed for third-person or
pov-translation for POV. Preserve the actual recorded camera trajectory and explicit
cameraInstruction; do not invent tracking, pan, orbit, zoom, cuts or reframing.

Honor explicit userInstruction choreography without changing the approved controlled-unit route.
For secondaryMotion preserve the independent behavior shown by its local/object tracks and current
creator instruction. Unchoreographed secondary subjects retain their positions and current state
with natural in-place motion; they never automatically follow joystick motion. Return an empty
secondaryMotion only when there is no relevant secondary subject. Keep the prose compact while
retaining the complete performance, normally within 120 words.

For direction backward, describe the separately authored physical return to endState, including its
actual turns and travel. Never repeat the forward command, rewind or reverse video playback.
${THREE_CONTROL_CONTINUITY}
`.trim();

const cleanJson = (text: string): unknown => JSON.parse(
  text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
);

const validateContexts = (
  value: unknown,
  expectedSceneIds: string[],
): Array<{
  sceneId: string;
  controlledSubject: string;
  controlMode: ControlMode;
  primaryMotion: string;
  ambientMotion: string;
}> => {
  if (!isRecord(value) || !Array.isArray(value.contexts)) {
    throw new Error("Motion context response must contain a contexts array");
  }
  const expected = new Set(expectedSceneIds);
  const seen = new Set<string>();
  const contexts = value.contexts.map((entry) => {
    if (!isRecord(entry)) throw new Error("Every motion context must be an object");
    const sceneId = asText(entry.sceneId, 160);
    const controlledSubject = asText(entry.controlledSubject, 160);
    const rawMode = asText(entry.controlMode, 32) as ControlMode;
    const primaryMotion = asText(entry.primaryMotion, 520);
    const ambientMotion = asText(entry.ambientMotion, 520);
    if (!expected.has(sceneId) || seen.has(sceneId)) throw new Error(`Unexpected or duplicate sceneId: ${sceneId}`);
    if (!modes.has(rawMode)) throw new Error(`Invalid controlMode for ${sceneId}`);
    if (controlledSubject.length < 2 || primaryMotion.length < 20 || ambientMotion.length < 20) {
      throw new Error(`Incomplete primary or ambient motion for ${sceneId}`);
    }
    if (primaryMotion.toLowerCase() === ambientMotion.toLowerCase()) {
      throw new Error(`Primary and ambient motion are not separated for ${sceneId}`);
    }
    seen.add(sceneId);
    return { sceneId, controlledSubject, controlMode: rawMode, primaryMotion, ambientMotion };
  });
  const missing = expectedSceneIds.filter((sceneId) => !seen.has(sceneId));
  if (missing.length) throw new Error(`Missing motion contexts: ${missing.join(", ")}`);
  return contexts;
};

export const compileSpatialMotionContexts = async (req: Request, res: Response): Promise<any> => {
  try {
    const body = isRecord(req.body) ? req.body : {};
    const tier = body.llmTier ?? DEFAULT_LANGUAGE_MODEL_TIER;
    if (!isLanguageModelTier(tier)) return res.status(400).send({ message: "Unknown spatial language model tier." });
    const selectedModel = languageModelForTier(tier);
    if (!Array.isArray(body.scenes) || body.scenes.length < 1 || body.scenes.length > 18) {
      return res.status(400).send({ message: "scenes must contain 1 to 18 entries" });
    }
    const scenes = body.scenes.map((entry, index) => {
      if (!isRecord(entry)) throw new Error(`Scene ${index + 1} is invalid`);
      const sceneId = asText(entry.sceneId, 160);
      const nodeId = asText(entry.nodeId, 200);
      const sceneIntent = asText(entry.sceneIntent, 6000);
      const videoPrompt = asText(entry.videoPrompt, 6000);
      if (!sceneId || !nodeId || !sceneIntent || !videoPrompt) {
        throw new Error(`Scene ${index + 1} needs sceneId, nodeId, sceneIntent and videoPrompt`);
      }
      const stateMode = entry.stateMode === 'planned-action' ? 'planned-action' : entry.stateMode === "post-action" ? "post-action" : "scene-root";
      const plannedState = isRecord(entry.plannedState) ? entry.plannedState : undefined;
      const referenceMotion = isRecord(entry.referenceMotion) ? entry.referenceMotion : undefined;
      const completedAction = asText(entry.completedAction, 3000);
      const finalFrameUrl = asText(entry.finalFrameUrl, 4_000);
      if (finalFrameUrl && !/^(?:https?:\/\/|data:image\/(?:jpeg|png|webp);base64,)/i.test(finalFrameUrl)) {
        throw new Error(`Scene ${index + 1} finalFrameUrl must be a public image URL or image data URL`);
      }
      const previousMotionContext = isRecord(entry.previousMotionContext) ? {
        controlledSubject: asText(entry.previousMotionContext.controlledSubject, 160),
        controlMode: asText(entry.previousMotionContext.controlMode, 32),
        primaryMotion: asText(entry.previousMotionContext.primaryMotion, 520),
        ambientMotion: asText(entry.previousMotionContext.ambientMotion, 520),
      } : undefined;
      if (stateMode === "post-action" && (!completedAction || !finalFrameUrl)) {
        throw new Error(`Scene ${index + 1} needs completedAction and finalFrameUrl in post-action mode`);
      }
      if (stateMode === 'planned-action' && (!completedAction || !plannedState)) throw new Error(`Scene ${index + 1} needs the completed authored action and its state`);
      return { sceneId, nodeId, sceneIntent, videoPrompt, stateMode, completedAction, finalFrameUrl, previousMotionContext, plannedState, referenceMotion };
    });
    if (new Set(scenes.map(({ sceneId }) => sceneId)).size !== scenes.length) {
      return res.status(400).send({ message: "sceneId values must be unique" });
    }

    const payload = {
      globalIntent: body.globalIntent,
      scenes: scenes.map(({ sceneId, sceneIntent, videoPrompt, stateMode, completedAction, previousMotionContext, plannedState, referenceMotion }) => ({
        sceneId,
        sceneIntent,
        videoPrompt,
        stateMode,
        completedAction,
        previousMotionContext,
        plannedState,
        referenceMotion,
      })),
    };
    console.log("[SpatialMotionContext][batch][start]", {
      model: selectedModel,
      llmTier: tier,
      sceneIds: scenes.map(({ sceneId }) => sceneId),
    });

    const compilationModel = selectedModel;
    const userContent: any[] = [{ type: "text", text: JSON.stringify(payload) }];
    scenes.forEach(({ sceneId, stateMode, finalFrameUrl, plannedState, referenceMotion }) => {
      if (!finalFrameUrl) return;
      userContent.push(
        { type: "text", text: plannedState ? `SCENE APPEARANCE FOR ${sceneId}. Use plannedState for current pose, object relationships and control state; this image establishes the original appearance and environment, not a command to reset the authored scene.` : stateMode === 'post-action' ? `FINAL FRAME FOR ${sceneId}. This image is the authoritative state after completedAction.` : `CURRENT FRAME FOR ${sceneId}. This image is the authoritative opening state; identify the selected controlled unit and its current physical relationships.` },
        { type: "image_url", image_url: { url: finalFrameUrl, detail: referenceMotion ? "high" : "low" } },
        ...renderedMotionImages(referenceMotion),
      );
    });

    let repair = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const completion = await openai.chat.completions.create({
          model: compilationModel,
          ...spatialPlanningInference(tier),
          n: 1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT + (scenes.some(scene => scene.plannedState) ? '\nFor authored 3D scenes, plannedState is authoritative for the current controlled unit, conditions, carried items, relationships and completed action outcomes. The original image is appearance/environment evidence only. In planned-action mode the authored action has finished in the 3D state: preserve its outcome exactly as post-action mode, without requiring a future generated frame. Never reset to the original image pose, repeat an action, or choose a different controlled unit. Support any subject or natural controlled unit, not a fixed inventory of humans/vehicles.' : '') + (isRecord(body.globalIntent) && body.globalIntent.primarySubjectName ? `\n${THREE_CONTROL_CONTINUITY}` : '') },
            ...(repair ? [{ role: "system" as const, content: `Repair the previous invalid response: ${repair}` }] : []),
            { role: "user", content: userContent },
          ],
        });
        recordOpenAiUsage(compilationModel, completion, { spatialCompile: true, attempt: attempt + 1, selectedTier: tier, reasoningEffort: spatialPlanningInference(tier).reasoning_effort });
        const content = completion.choices[0]?.message?.content;
        if (!content) throw new Error("Luna returned an empty motion context response");
        const contexts = validateContexts(cleanJson(content), scenes.map(({ sceneId }) => sceneId));
        scenes.forEach((scene) => {
          if (scene.stateMode !== "post-action" && scene.stateMode !== 'planned-action') return;
          const context = contexts.find(({ sceneId }) => sceneId === scene.sceneId);
          const completedMount = /\bmount(?:s|ed|ing)?\b/i.test(scene.completedAction)
            && !/\bdismount(?:s|ed|ing)?\b/i.test(scene.completedAction);
          if (completedMount && context && (
            context.controlMode !== "mounted"
            || /\bdismount(?:s|ed|ing)?\b/i.test(context.primaryMotion)
          )) {
            throw new Error(`Post-action context for ${scene.sceneId} must preserve the completed mounted state`);
          }
        });
        console.log("[SpatialMotionContext][batch][ready]", {
          model: compilationModel,
          attempt: attempt + 1,
          contexts,
        });
        return res.status(200).send({ model: compilationModel, contexts });
      } catch (error: unknown) {
        repair = error instanceof Error ? error.message : String(error);
        console.error("[SpatialMotionContext][batch][attempt-failed]", {
          model: compilationModel,
          attempt: attempt + 1,
          error: repair,
        });
        if (attempt === 1) throw error;
      }
    }
    throw new Error("Motion context compiler produced no result");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[SpatialMotionContext][batch][failed]", message);
    return res.status(502).send({ message: "Motion context compilation failed", error: message });
  }
};

export const refineSpatialMovementFromFrame = async (req: Request, res: Response): Promise<any> => {
  try {
    const body = isRecord(req.body) ? req.body : {};
    const tier = body.llmTier ?? DEFAULT_LANGUAGE_MODEL_TIER;
    if (!isLanguageModelTier(tier)) return res.status(400).send({ message: "Unknown spatial language model tier." });
    const selectedModel = languageModelForTier(tier);
    const sceneId = asText(body.sceneId, 160);
    const sceneIntent = asText(body.sceneIntent, 6000);
    const videoPrompt = asText(body.videoPrompt, 6000);
    // Preserve the full forward/return context. Never silently truncate instructions.
    const movementText = typeof body.movementText === "string" ? body.movementText.trim() : "";
    const userInstruction = asText(body.userInstruction, 600);
    const durationSeconds = Number(body.durationSeconds);
    const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
    // Three.js supplies trajectory evidence, not replacement scene appearance.
    // Keep the legacy annotated-image caller unchanged; author-time processing
    // uses the same refiner with clean appearance and the authored 3D state.
    const imageUrl = asText(body.imageUrl, 4000);
    const referenceMotion = isRecord(body.referenceMotion) ? body.referenceMotion : undefined;
    const currentImage = imageDataUrl || imageUrl;
    const destinationImageUrl = asText(body.destinationImageUrl, 4000);
    if (!sceneId || !sceneIntent || !videoPrompt || !movementText || !isRecord(body.motionContext)) {
      return res.status(400).send({ message: "sceneId, sceneIntent, videoPrompt, movementText and motionContext are required" });
    }
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 60) {
      return res.status(400).send({ message: "durationSeconds must be a number between 0 and 60" });
    }
    if ((!/^data:image\/(?:jpeg|png|webp);base64,/i.test(currentImage)
      && !(referenceMotion && /^https:\/\//i.test(currentImage))) || currentImage.length > 4_000_000) {
      return res.status(400).send({ message: "A low-resolution annotated image is required" });
    }
    if (destinationImageUrl && !/^(?:https?:\/\/|data:image\/(?:jpeg|png|webp);base64,)/i.test(destinationImageUrl)) {
      return res.status(400).send({ message: "destinationImageUrl must be a public image URL or image data URL" });
    }
    const motionContext = {
      controlledSubject: asText(body.motionContext.controlledSubject, 160),
      controlMode: asText(body.motionContext.controlMode, 32),
      primaryMotion: asText(body.motionContext.primaryMotion, 520),
      ambientMotion: asText(body.motionContext.ambientMotion, 520),
    };
    if (!motionContext.controlledSubject || !motionContext.primaryMotion || !motionContext.ambientMotion) {
      return res.status(400).send({ message: "The persistent motion context is incomplete" });
    }
    // Ambient context is stored for later interaction systems, but it is
    // deliberately withheld from this final movement call so the refiner cannot
    // promote a horse, NPC, prop, or background action over controlledSubject.
    const rawJoystick = isRecord(body.joystickInput) ? body.joystickInput : null;
    const joystickInput = rawJoystick && Number.isFinite(rawJoystick.x) && Number.isFinite(rawJoystick.y)
      && Math.abs(Number(rawJoystick.x)) <= 1 && Math.abs(Number(rawJoystick.y)) <= 1
      ? { x: rawJoystick.x, y: rawJoystick.y, direction: asText(rawJoystick.direction, 40),
          startPoint: isRecord(rawJoystick.startPoint)
            && Number.isFinite(rawJoystick.startPoint.x) && Number.isFinite(rawJoystick.startPoint.y)
            && Number(rawJoystick.startPoint.x) >= 0 && Number(rawJoystick.startPoint.x) <= 1
            && Number(rawJoystick.startPoint.y) >= 0 && Number(rawJoystick.startPoint.y) <= 1
            ? { x: rawJoystick.startPoint.x, y: rawJoystick.startPoint.y } : undefined }
      : undefined;
    const controlledMovementContext = {
      controlledSubject: motionContext.controlledSubject,
      controlMode: motionContext.controlMode,
      movementStyle: motionContext.primaryMotion,
      secondaryMotionContext: motionContext.ambientMotion,
    };

    console.log("[SpatialMotionContext][visual-refine][start]", {
      model: selectedModel,
      sceneId,
      controlledSubject: motionContext.controlledSubject,
      durationSeconds,
      imageBytesApprox: Math.round(imageDataUrl.length * 0.75),
      movementContextChars: movementText.length,
      referenceMode: referenceMotion ? 'authored-3d-route' : destinationImageUrl ? "clean-current-and-destination" : "annotated-forward-route",
      identityPolicy: "preserve-current-subject-count",
    });
    let parsed: unknown;
    let planRepair = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
    const completion = await openai.chat.completions.create({
      model: selectedModel,
      ...spatialPlanningInference(tier),
      n: 1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: referenceMotion ? AUTHORED_THREE_REFINER_SYSTEM_PROMPT : VISUAL_REFINER_SYSTEM_PROMPT },
        ...(planRepair ? [{ role: "system" as const, content: `Correct the rejected plan: ${planRepair}. Return a complete consistent plan and prose.` }] : []),
        {
          role: "user",
          content: [
            {
              type: "text",
              // Scene intent/videoPrompt already did their job in the one-time
              // compiler that selected controlledSubject. Re-sending their
              // story action here biases a fresh stick move toward the old plot.
              text: JSON.stringify({ imageRoles: referenceMotion?.stateEvidence === 'authored-world'
                ? 'Image 1 establishes original scene appearance and geometry. referenceMotion.sourceState, trajectory and endState establish the current authored pose, physical route and destination. Do not reset the subject to its original image pose.'
                : destinationImageUrl
                ? "Image 1 is the clean CURRENT start frame. Image 2 is the REQUIRED destination state of the SAME scene and SAME subjects. Infer the physical return between these states; do not invent an arrow or locate the subject from graph coordinates."
                : referenceMotion ? "Image 1 is the clean ACTUAL current scene. referenceMotion is supplementary authored 3D trajectory evidence; ground its route in this image without copying proxy appearance or changing subjects."
                : "Image 1 is the current scene with a movement annotation. Move the existing controlled subject along the arrow; do not add a new subject.",
                identityRule: "Preserve subject count and identity from the current frame. Reference depictions are the same subjects, never additional people or clones. Describe continuous movement of the existing subject, without spawning a foreground replacement.",
                sceneId, motionContext: controlledMovementContext, joystickInput, movementText, userInstruction, durationSeconds,
                cameraRule: referenceMotion?.cameraInstruction ? "The explicit creator camera instruction and referenceMotion.projectionCamera override the default fixed camera rule. Preserve the recorded subject path while following that camera motion." : undefined,
                ...(referenceMotion ? { referenceMotion } : {}) }),
            },
            {
              type: "image_url",
              image_url: { url: currentImage, detail: referenceMotion ? "high" : "low" },
            },
            ...(destinationImageUrl ? [{
              type: "image_url" as const,
              image_url: { url: destinationImageUrl, detail: "low" as const },
            }] : []),
            ...renderedMotionImages(referenceMotion),
          ],
        },
      ],
    });
    recordOpenAiUsage(selectedModel, completion, { spatialRefine: true, attempt: attempt + 1, selectedTier: tier, reasoningEffort: spatialPlanningInference(tier).reasoning_effort });
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Terra returned an empty visual movement refinement");
    try {
      parsed = cleanJson(content);
      validateSpatialPlan(isRecord(parsed) ? parsed.spatialPlan : undefined,
        joystickInput ? { x: Number(joystickInput.x), y: Number(joystickInput.y) } : undefined,
        motionContext.controlMode === "pov");
      break;
    } catch (error) {
      if (attempt === 1) throw error;
      planRepair = error instanceof Error ? error.message : String(error);
    }
    }
    const startRelation = isRecord(parsed) ? asText(parsed.startRelation, 220) : "";
    const route = isRecord(parsed) ? asText(parsed.route, 260) : "";
    const endRelation = isRecord(parsed) ? asText(parsed.endRelation, 220) : "";
    const controlledMovement = isRecord(parsed) ? asText(parsed.controlledMovement, referenceMotion ? 1000 : 420) : "";
    const secondaryMotion = isRecord(parsed) ? asText(parsed.secondaryMotion, referenceMotion ? 1000 : 320) : "";
    if (!startRelation || !route || !endRelation || controlledMovement.length < 24) {
      throw new Error("Terra returned an incomplete spatial movement plan");
    }
    const ensureSentence = (value: string): string => value && !/[.!?]$/.test(value) ? `${value}.` : value;
    const rawInstruction = [ensureSentence(controlledMovement), ensureSentence(secondaryMotion)]
      .filter(Boolean)
      .join(" ");
    const words = rawInstruction.split(/\s+/).filter(Boolean);
    const wordLimit = referenceMotion ? 120 : 55;
    const instruction = words.length > wordLimit
      ? `${words.slice(0, wordLimit).join(" ").replace(/[,:;\-]+$/, "")}.`
      : rawInstruction;
    // Duration is already part of the model input and must appear only once in
    // the compact instruction. Do not prepend another timing paragraph here.
    const cameraConstraint = referenceMotion?.cameraInstruction
      ? `Follow the reference camera movement: ${asText(referenceMotion.cameraInstruction, 1000)}. Preserve the recorded subject route and established scene.`
      : referenceMotion
      ? motionContext.controlMode === "pov"
        ? "Follow the authored first-person viewpoint trajectory; preserve its orientation, lens, timing and existing world. No independent camera motion or new environment."
        : "Camera locked: no tracking, pan, orbit, zoom, cut or reframing. Preserve the authored route, timing, locomotion and current state, including any recorded exit from the camera frame."
      : motionContext.controlMode === "pov"
      ? "Translate only within the depicted space in the existing first-person view; preserve orientation and lens. No independent camera motion or new environment. Stop at scene boundaries."
      : "Camera locked: no tracking, pan, orbit, zoom, cut or reframing. Keep the entire controlled unit and route inside the depicted scene; shorten movement at its boundaries. Preserve its existing locomotion and state.";
    const timedInstruction = `${instruction} ${cameraConstraint}`;
    console.log("[SpatialMotionContext][visual-refine][ready]", {
      model: selectedModel,
      sceneId,
      durationSeconds,
      spatialPlan: { startRelation, route, endRelation },
      instruction: timedInstruction,
    });
    return res.status(200).send({ model: selectedModel, durationSeconds, instruction: timedInstruction,
      interpretation: { startRelation, route, endRelation, controlledMovement, secondaryMotion, spatialPlan: isRecord(parsed) ? parsed.spatialPlan : undefined } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[SpatialMotionContext][visual-refine][failed]", message);
    return res.status(502).send({ message: "Visual movement refinement failed", error: message });
  }
};
