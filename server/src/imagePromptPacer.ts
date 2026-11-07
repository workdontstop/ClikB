import { createHash } from 'node:crypto';

export type PacedImage = { pacedImagePrompt: string; handoff: string };
export type ImagePacingSource = { id: string; fullScene: string; originalImagePrompt: string; sceneIntent?: unknown };

export const IMAGE_PACER_SYSTEM_PROMPT = `You are the contextual image prompt pacing stage in ClikB Creation.
An existing writer has produced the full-scene visual conception. Your output is the image prompt that will actually be rendered immediately afterward, within the same automatic workflow.

INPUT FIELD MEANINGS:
The user payload contains images and creationContext. Each images entry is one output target; preserve its id and keep its data associated with that target.
- fullScene is the scene's narrative ground truth: the required events, relationships, progression and scene boundary. It describes the whole scene, not everything that must coexist in one image.
- sceneIntent is the existing interpretation of that scene's purpose, meaning, continuity and temporal scope. When structured, read its text as the intent prose; identifiers, revision numbers and sync metadata are bookkeeping. Use intent to interpret fullScene, not to replace its action with a static depiction. If intent is absent, use fullScene without inventing missing intent.
- originalImagePrompt is the generated visual draft being paced. Preserve its applicable visual detail, identity and style while revising its chosen moment to satisfy intent and scene ground truth. Its selected pose or completed action is not an authoritative starting state.
- creationContext.globalIntent supplies the overall premise, purpose and visual continuity across scenes.
- creationContext.initialPlan is the global overview of the entire story and may include other scenes. Use it for supporting background and continuity only. Each target's fullScene and sceneIntent define that specific scene; do not import other scenes' actions or later outcomes, merge targets or move required actions between them.
- creationContext.outputContext describes the output's role and format, including aspect ratio where supplied.
- creationContext.referenceContext supplies reference identities and appearance descriptions; it does not prescribe action timing.
Read sceneIntent and fullScene together to determine what must happen and in what order. The visual draft and supporting context must not silently omit, pre-complete or contradict those required developments.

Understand the user's intended result from the complete supplied context. Read the supplied scene intent, full scene, original image prompt, global understanding, initial plan, output context, and applicable references together. Use the existing intent to determine temporal scope; the original writer's chosen depiction cannot override the intended complete sequence. Workflow knowledge explains the image's role and downstream uses. Do not impose predefined use-case categories or assume that a video-capable workflow means animation is requested.

Preserve the intended meaning, explicit requirements, identities, subject composition and count, relationships, meaningful details, and authored visual treatment. Recognise which choices remain open to interpretation. An aesthetically pleasing rewrite that changes the user's meaning is a failed result. An already effective prompt can remain substantially intact.

Use the existing scene intent as the authority for action order and temporal scope. Treat the generated image prompt as visual material to revise, not as a fixed choice of moment.

When the image will start an animated sequence, identify the earliest required action and its physical prerequisites. Depict one coherent state at or immediately before that action. Leave every required transition available to happen during the clip.

Identify the first required action from scene intent before selecting the frame. Do not substitute the beginning of a later action. Preserve the physical state needed to perform every earlier required action.

All subjects, objects and environmental conditions must belong to that same instant. Do not combine a subject's earlier state with another element's later state. Position objects according to their current physical relationships, rather than staging them for a future interaction.

Preserve identity, composition requirements, style and camera language while correcting the temporal state. For connected scenes, respect their intended boundary without advancing the opening into later action.

Before returning, check whether the complete intended sequence can proceed naturally from this frame without reversing time, resetting positions or undoing completed actions. If it cannot, revise the frame.

If the intent explicitly requests a standalone still or a later starting moment, preserve that choice. Describe the selected state and remaining intended actions in the handoff without inventing events.

Understand viewpoint and spatial identity. Keep the intended subject membership and count; repeated mentions or viewpoints do not imply extra instances. Keep referenced entities coherent with their surroundings and the selected camera position. Contextually intended collective subjects must retain their membership and meaningful distinctions.

Retain the specific, professional optical and cinematographic language supplied by the original writer and shared camera directive. Make purposeful lens, perspective, framing, lighting, depth, texture, and atmosphere choices that serve the actual intention. Preserve exact useful @reference handles, canonical appearance, explicit style and literal requested words. Do not add graphic text unless required by the supplied context. For Cinema Stage B (an images entry with id "B" or sceneIntent.stage "B"), never include a cover or movie-poster Title text overlay even if fullScene or sceneIntent mentions a Title; any cover Title overlay belongs only to Stage A (id "A"), while Stage B is the pure visual continuation without title text. Honour the requested output dimensions without allowing an optical descriptor to change them.

Return one strict JSON object with exactly an images array. For each supplied id, return {"id":string,"pacedImagePrompt":string,"handoff":string}. Preserve the supplied ids, count, and order. Each pacedImagePrompt must be a complete self-contained render prompt, retaining the designated art style and reference handles. Do not include explanatory metadata in the render prompt. Do not invent extra scenes, merge separate stages, or duplicate a stage as filler. Related stages must preserve shared identities and spatial continuity.

Keep the handoff concise. Use an empty handoff when no subsequent-development explanation applies.

Before returning, verify the depiction's meaning, temporal state, required content, spatial relationships, and visual treatment against the full context. Return only JSON, without markdown or commentary.`;

export function parsePacedImages(raw: unknown, sources: ImagePacingSource[]): PacedImage[] {
    const text = (Array.isArray(raw) ? raw.join('') : String(raw)).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const result = JSON.parse(text) as { images?: unknown };
    if (!Array.isArray(result?.images) || result.images.length !== sources.length) throw new Error('Image pacer returned an invalid scene count.');
    const images = result.images;
    const allowedHandles = new Set(sources.flatMap(source =>
        `${source.originalImagePrompt}\n${source.fullScene}`.match(/@[\p{L}\p{N}_-]+/gu) || []));
    return sources.map((source, index) => {
        const image = images[index] as Record<string, unknown>;
        if (!image || image.id !== source.id || typeof image.pacedImagePrompt !== 'string'
            || !image.pacedImagePrompt.trim() || typeof image.handoff !== 'string') throw new Error('Image pacer returned an invalid scene or prompt.');
        for (const handle of image.pacedImagePrompt.match(/@[\p{L}\p{N}_-]+/gu) || []) {
            if (!allowedHandles.has(handle)) throw new Error('Image pacer invented a reference handle.');
        }
        return { pacedImagePrompt: image.pacedImagePrompt.trim(), handoff: image.handoff.trim() };
    });
}

export const imagePacingFingerprint = (value: unknown): string =>
    createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Applies only to inputs carrying the new, separately identified starting look. */
export function videoPacingSystemContext(body: Record<string, unknown>): string {
    if (typeof body.groundTruthAction === 'string' && body.groundTruthAction.trim()
        && typeof body.firstFramePrompt === 'string' && body.firstFramePrompt.trim()) {
        return `\nVIDEO INPUT MEANINGS AND AUTHORITY:
- scene identifies this clip's target scene, stage and current duration; it is not the whole story.
- groundTruthAction is this scene's narrative ground truth: its required events and their causal order. fullScene, when supplied, preserves the same scene's complete source context.
- imageDescription supplies the original unpaced image prompt when pacing metadata is present: detailed visual conception supporting the required action. Preserve useful appearance, style and camera detail, but resolve compressed or conflicting chronology against this scene's ground truth.
- sceneIntent supplies purpose, meaning, mood and continuity. Read its text when structured; identifiers, revision and sync fields are bookkeeping. Intent guides interpretation; a static depiction in Intent cannot veto the storyboard action. Missing intent does not authorize inventing it.
- firstFramePrompt or startingImagePrompt, together with the supplied image, establishes the opening physical state only. The original unpaced visual conception does not imply every event is already visible or complete at second zero.
- PlanVid is the global plan overview of the entire story, including other scenes. Any supplied global intent has the same whole-story scope. These support world, identity and continuity only; do not import another scene's events into this clip. question is a scene-context seed, not a replacement for the explicit current-scene action.
- Character and reference descriptions support identity, appearance and relevant visual consistency. They do not add subjects or actions unrelated to this scene.
- The current duration and target model capabilities constrain timing and supported features. Do not inherit an older plan's timing or invent unsupported inputs.
- imagePacingHandoff explains the selected opening relative to the scene and what remains to happen; it is supporting interpretation, not replacement ground truth.
Animate the required current-scene action from the opening state. Preserve its order without replaying completed actions or suppressing later developments merely because they are absent from the first frame. An explicit video UPDATE WITH AI instruction may intentionally change the narrative; ordinary image polish changes only the first frame.\n`;
    }
    if (typeof body.startingImagePrompt !== 'string' || !body.startingImagePrompt.trim()
        || typeof body.fullScene !== 'string' || !body.fullScene.trim()) return '';
    return `\nPACED IMAGE INPUT CONTRACT:
imageDescription is the ORIGINAL full-scene visual conception and remains the grounding source for scene content and photographic treatment. It is not a declaration that all of its actions or states already coexist at time zero.
startingImagePrompt describes the selected starting look used for the actual image. The supplied source image, when present and enabled, grounds visible initial appearance and physical relationships. fullScene preserves the complete source scene; use it with sceneIntent to preserve explicit user chronology and correct temporal or spatial compression in the original visual prose. imagePacingHandoff explains the actual selection and is subordinate to the user's intended scene.
Begin from the selected starting state and realise the original intended scene, preserving causal order, intentional simultaneity, identities, and spatial continuity. An event or subject established by that scene is not forbidden merely because it is not yet visible in the opening depiction. Use only the intended developments and applicable supplied references that the selected generation route can support. Do not hallucinate additional entities or replay events already completed at the selected instant. Preserve deliberate optical language and begin camera development from the established composition. Current explicit user edits and current duration remain authoritative. Do not restore a known interpretation error merely because it appeared in the original prompt.\n`;
}

export function videoPacingUserContext(body: Record<string, unknown>): string {
    if (!videoPacingSystemContext(body)) return '';
    if (typeof body.groundTruthAction === 'string' && typeof body.firstFramePrompt === 'string') {
        return `\nVIDEO SCENE CONTRACT:\n${JSON.stringify({ scene: body.scene,
            sceneIntent: body.sceneIntent, groundTruthAction: body.groundTruthAction,
            firstFramePrompt: body.firstFramePrompt,
            ...(typeof body.imagePacingHandoff === 'string' && body.imagePacingHandoff.trim()
                ? { imagePacingHandoff: body.imagePacingHandoff } : {}) })}\n`;
    }
    return `\nPACED STARTING LOOK AND FULL SCENE:\n${JSON.stringify({
        startingImagePrompt: body.startingImagePrompt, fullScene: body.fullScene,
        imagePacingHandoff: body.imagePacingHandoff || '',
    })}\n`;
}
