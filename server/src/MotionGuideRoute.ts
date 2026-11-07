import { motionSceneInstructions, motionGuideTextInstructions } from './motionSceneInstructions';
import { prepareMotionGuide } from './motionBlockout';
import { validateSceneLayout } from './spatialSceneCalibration';
import type { Request, Response } from 'express';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import { createRoutedTextClient, resetOpenAiAvailability } from './textGeneration';
import { handleLiveRequest, registerLivePreparer, type LiveSpec } from './liveSceneBuilds';
import { recordOpenAiUsage, recordPixelCharge, providerUsageCursor, providerPixelsSince } from './aiUsageLedger';
import {
    accumulateMeteredUsage,
    buildMeteredSessionKey,
    checkMeteredZeroBalanceGuard,
    rawPixelsToSubunits,
    settleMeteredSession,
    SUBUNITS_PER_PIXEL,
} from './meteredUsageBilling';
import { authenticatedOwnerId, authenticatedUserId } from './requestAuth';
import { getPixelsForUser } from './db';
import { cleanMotionGuideDisplayText, validateMotionPlan } from './motionGuidePlan';
import { cleanQuotedAtMentions } from './promptLiterals';
import { languageModelForTier } from './languageModels';
import { isPlanningTier } from './spatialWorld';
import { motionGuidePrice } from './motionGuidePricing';
import { guardLiveBuild } from './liveBuildSecurity';
import type { SceneAuthoringDraft } from './sceneAuthoring';
import { validateScenePerformance } from './scenePerformance';
import { motionGuideStateInstructions } from './motionGuideState';
import { adoptSceneBuild, scenePerformanceInstructions } from './sceneBuildAuthoring';
import { expandScenePlan, sceneRecipeInstructions } from './sceneRecipes';

// Keep Astra available to restore if Sol is not suitable for motion guides.
// const MODEL = 'gpt-6-astra';
const SYSTEM = `You direct a simple Three.js motion-reference animatic for a single video shot.
Return JSON only, no code. Preserve the user's exact camera movement, action timing, trajectories and relative positions.
If a first-frame image is supplied, match its camera framing, source aspect ratio, foreground position, relative subject sizes, intentional edge cropping, physical ground and depth order. Never move a left foreground person to the right or shrink the important creature into an indistinct distant speck. In the SAME JSON response you may include sourceLayout:{camera:"perspective evidence",landmarks:[{id,description,box:[x,y,width,height],occluded:false}]} with normalized visible image boxes measured from top-left, matching root IDs; mark cropped/hidden subjects occluded:true. This is optional guidance, never a reason to omit the complete plan. Do not invent hidden dimensions. Infer its scene layout. Match visible proportions, poses, equipment and overlap using lightweight compound geometry. Build clear subject silhouettes and local limb motion.
Y is up; camera looks at target. All geometry is centered: box is 1x1x1, sphere radius 0.5, cylinder/cone radius 0.5 and height 1. Scale gives object dimensions. Rotation is Euler XYZ in radians. Use meters, seconds, and vertical camera fov in degrees. No external assets, textures from URLs or executable code. The renderer draws a grid on tagged physical ground.
Include the objects needed to represent the scene; there is no fixed object-count cap. Every object and the camera needs 2–96 strictly increasing keys from t=0 through the EXACT requested duration. Interpolation is LINEAR, including Euler angles: insert enough intermediate keys for curved paths, acceleration, arcs and holds. Camera supports roll?:number in radians [-3.15, 3.15] for Dutch tilt or banking turns. Use deliberate rotation values for full spins. Static tracks repeat their transform at both ends. Keep the action visible within the supplied aspect ratio. Use articulated compound parts for people, animals and other subjects when their action needs them.
DIRECTORIAL PLAYBOOK: SnorriCam (lock camera pos and target at fixed offset to character torso/head throughout timeline); Dutch Angle / Roll (roll: 0.25 to 0.45 rad / 15-25°); Dolly Zoom / Zolly (move position backward while decreasing fov or vice versa); Crash Zoom (fov 50 -> 22 over 0.2s); 180°/360° Orbit (supply 6-8 keys per 90° arc); Whip Pan (rotational target snap across 0.2s); Zenith God's Eye (camera directly overhead looking straight down); Worm's-Eye Low Hero (y: 0.2-0.5m looking steeply up); Reverse Tracking (camera backpedals maintaining distance ahead of moving subject); Flight & Stunts (anticipate crouch -> launch -> hang-time -> impact hold; vehicles lift off -> pitch nose down -> roll into turns -> rocket acceleration).
For edits, modify the previous plan only as instructed; preserve all unaffected objects and choreography. Return the complete replacement plan.
Schema:
{"version":1,"duration":5,"background":"#DCE2EC","objects":[{"id":"subject","shape":"box","color":"#BBC3D2","keys":[{"t":0,"position":[0,0.5,0],"rotation":[0,0,0],"scale":[1,1,1]},{"t":5,"position":[2,0.5,0],"rotation":[0,0,0],"scale":[1,1,1]}]}],"camera":[{"t":0,"position":[0,2,6],"target":[0,0.5,0],"fov":45,"roll":0},{"t":5,"position":[0,2,6],"target":[0,0.5,0],"fov":45,"roll":0}]}
${motionSceneInstructions}
${motionGuideTextInstructions}
${motionGuideStateInstructions}
${sceneRecipeInstructions}
${scenePerformanceInstructions}
Return the full version:1 animated schema, never compact static reconstruction formats. Every moving root, local part and camera must include the complete requested choreography and timing. Do not substitute two identical endpoint poses for an action. A stationary root can have moving local parts; keep their tracks. Keep truly static tracks static when the user asks for a static scene or deliberate hold.
Colors are six-digit hex. Coordinates within +/-100, rotation within +/-32, scale 0.01–100, fov 15–100.`;
class MotionRouteError extends Error { constructor(message: string, readonly status: number, readonly extra?: Record<string, unknown>) { super(message); } }

/** Validate, price and build the model call shared by JSON and live routes. */
async function prepareMotionGuideRequest(userId: string, body: any): Promise<LiveSpec> {
    resetOpenAiAvailability();
    const usageCursor = providerUsageCursor();
    const tier = body.llmTier ?? 'luna';
    if (!isPlanningTier(tier)) throw new MotionRouteError('Choose Luna, Terra, Sol, DeepSeek or Kimi for Motion Guide.', 400);
    const PRICE = motionGuidePrice(tier);
    const MODEL = languageModelForTier(tier);
    const reasoningEffort = 'low' as const;
    let previousPlan: ReturnType<typeof validateMotionPlan> | undefined;
    let previousAuthoring: SceneAuthoringDraft | undefined;
    try {
        if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 30000) throw new Error('Enter a motion prompt (max 30,000 characters).');
        if (!Number.isFinite(body.duration) || body.duration < 2 || body.duration > 15) throw new Error('Motion Guides support 2–15 seconds.');
        if (!['16:9', '9:16', '1:1'].includes(body.aspectRatio)) throw new Error('Invalid aspect ratio.');
        if (body.editInstruction != null && (typeof body.editInstruction !== 'string' || body.editInstruction.length > 4000)) throw new Error('Edit instruction is too long.');
        if (body.previousPlan) previousPlan = validateMotionPlan(cleanMotionGuideDisplayText(body.previousPlan));
        const suppliedAuthoring = body.authoringContext?.schema === 'clikb.scene-authoring.v1' ? body.authoringContext
            : body.liveAuthoring?.schema === 'clikb.scene-authoring.v1' ? body.liveAuthoring : undefined;
        if (suppliedAuthoring) {
            previousAuthoring = validateScenePerformance({ plan: previousPlan || suppliedAuthoring.plan, authoring: suppliedAuthoring }).authoring;
            previousPlan ||= previousAuthoring!.plan;
        }
        if (body.firstFrameUrl && (typeof body.firstFrameUrl !== 'string' || body.firstFrameUrl.length > 8000 || new URL(body.firstFrameUrl).protocol !== 'https:')) throw new Error('The first frame must be an HTTPS image URL.');
    } catch (error) { throw new MotionRouteError((error as Error).message, 400); }
    const admission = await checkMeteredZeroBalanceGuard(userId, PRICE);
    if (!admission.allowed) throw new MotionRouteError(`Motion Guide needs ${PRICE} P.`, 402, { required: PRICE, pixels: admission.balance });
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: 'text', text: JSON.stringify({
        prompt: cleanQuotedAtMentions(body.prompt), duration: body.duration, aspectRatio: body.aspectRatio,
        previousPlan, sourceState: previousAuthoring?.sourceState,
        editInstruction: cleanQuotedAtMentions(body.editInstruction || ''),
        ...(previousAuthoring ? { authoringContext: previousAuthoring } : {}),
    }) }];
    if (body.firstFrameUrl) content.push({ type: 'image_url', image_url: { url: body.firstFrameUrl, detail: 'high' } });
    const request: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model: MODEL,
        // These tier models support max; the installed SDK's older enum
        // omits it. Assert only this field, preserving max at runtime and
        // checking every other field against the non-streaming request.
        reasoning_effort: reasoningEffort as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming['reasoning_effort'],
        max_completion_tokens: 32000, stream: false,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content }],
    };
    const sourceKey = previousAuthoring?.sourceKey || `motion:${String(body.liveTargetKey || 'shot').slice(0, 255)}`;
    const adoptCheckpoint = (raw: any, current?: SceneAuthoringDraft, pinned: readonly string[] = []) => {
        const authoring = adoptSceneBuild(raw, sourceKey, current || previousAuthoring, pinned, cleanMotionGuideDisplayText(expandScenePlan(raw)));
        return { plan: authoring.plan, authoring };
    };
    const finalize = (raw: any, meta: { model: string; provider: string }, acceptedAuthoring?: SceneAuthoringDraft) => {
        let layout;
        // Optional measurements ride in the existing response. A bad
        // measurement never causes another call or blocks a result.
        if (!previousPlan && body.firstFrameUrl && raw?.sourceLayout) {
            try { layout = validateSceneLayout(raw.sourceLayout); } catch { /* render the scene */ }
        }
        const cleaned = cleanMotionGuideDisplayText(expandScenePlan(raw));
        // Visual checkpoint plans have already been rendered and reviewed.
        // Refitting their camera at finalization would export a different scene.
        const plan = acceptedAuthoring?.plan || (previousPlan || body.visualCheckpoints ? validateMotionPlan(cleaned) : prepareMotionGuide(cleaned, body.aspectRatio, layout));
        if (Math.abs(plan.duration - body.duration) > 0.001) throw new Error('Use the exact requested duration.');
        const authoring = acceptedAuthoring ? validateScenePerformance({ plan, authoring: acceptedAuthoring }).authoring!
            : adoptSceneBuild(raw, sourceKey, previousAuthoring, [], plan);
        return { plan: authoring.plan, authoring, model: meta.model || MODEL, provider: meta.provider || 'openai', requestedModel: MODEL, requestedReasoningEffort: reasoningEffort, llmTier: tier };
    };
    const chargeEventId = `motion-guide:${randomUUID()}`;
    const charge = async () => {
        const rawPixels = providerPixelsSince(usageCursor);
        if (rawPixels === null) throw new Error('Provider usage is unavailable. The build cannot be charged yet.');
        const billingScope = String(body.billingSessionId || body.projectKey || 'default');
        const sessionKey = buildMeteredSessionKey('motion', userId, billingScope);
        const addedSubunits = rawPixelsToSubunits(rawPixels);
        await accumulateMeteredUsage({
            sessionKey,
            userId,
            workload: 'motion',
            profile: tier,
            model: MODEL,
            eventId: chargeEventId,
            costSubunits: addedSubunits,
            billableToUser: true,
        });
        const receipt = await settleMeteredSession({
            sessionKey, userId, workload: 'motion', profile: tier, model: MODEL,
            forceReceipt: true, strictFullBalance: false, throwOnError: true,
        });
        if (!receipt || receipt.pendingReconciliation) throw new Error('The billing receipt is unavailable. The scene has not been charged again.');
        const cost = receipt.replayed ? 0 : receipt.pixelsCharged;
        if (cost > 0) recordPixelCharge(cost, 'motion-guide');
        return {
            llmBilling: {
                tier: 'motion-guide',
                pixelsCharged: cost,
                receiptId: receipt.receiptId,
                carrySubunits: receipt.carrySubunits,
                unsettledWholePixels: receipt.unsettledWholePixels,
                carriedPixels: Number((receipt.carrySubunits / SUBUNITS_PER_PIXEL).toFixed(6)),
                pixels: receipt.remainingPixels,
                pricing: 'provider-cost',
                rawPixels,
            },
        };
    };
    return { kind: 'motion', operation: previousPlan ? 'motion-edit' : 'motion-build', price: PRICE, atCostPricing: true, tier, planPath: [], basePlan: previousPlan, baseAuthoring: previousAuthoring, adoptCheckpoint, duration: body.duration, request, finalize, charge,
        recordUsage: (model, usage, meta) => recordOpenAiUsage(model, { model, usage }, { motionGuide: true, selectedTier: tier, reasoningEffort, ...meta }) };
}

registerLivePreparer('motion', prepareMotionGuideRequest);

const motionUser = (req: Request) => {
    let userId = authenticatedUserId(req) || '';
    if (!userId && process.env.APP_STATE === 'dev') userId = '1';
    return userId;
};

export async function buildMotionGuide(req: Request, res: Response): Promise<void> {
    const userId = motionUser(req);
    if (!userId) { res.status(401).json({ message: 'Please sign in to build a Motion Guide.' }); return; }
    const body = req.body || {};
    if (body.operation === 'review') {
        // Older clients may still send the retired automatic review request.
        // Return their original renderable plan without inference or billing.
        try { res.json({ plan: validateMotionPlan(body.plan) }); }
        catch { res.status(400).json({ message: 'The scene preview is unavailable.' }); }
        return;
    }
    // Live construction streams this same request into the Three.js preview.
    if (body.live === true) { await handleLiveRequest(req, res, 'motion', userId); return; }
    let spec: LiveSpec;
    const walletId = authenticatedOwnerId(req) || userId;
    try { spec = await prepareMotionGuideRequest(walletId, body); }
    catch (error) { const e = error as MotionRouteError; res.status(e.status || 400).json({ message: e.message, ...(e.extra || {}) }); return; }
    const controller = new AbortController();
    let securityError: Error | undefined;
    const stopGuard = guardLiveBuild(async () => {
        if (motionUser(req) !== userId) throw new Error('Your session expired during the Motion Guide build.');
        const balance = Number(await getPixelsForUser(walletId));
        if (!Number.isFinite(balance) || balance < spec.price) throw new Error('The pixel balance is no longer sufficient for this build.');
        return balance;
    }, () => console.info('[ThreeJS]', JSON.stringify({ event: 'security', verified: true, mode: 'buffered' })), error => {
        securityError = error; controller.abort();
    });
    try {
        const client = createRoutedTextClient(new OpenAI({ apiKey: process.env.DALLE_KEY, timeout: 600000, maxRetries: 0 }));
        let result: any, repair = '';
        for (let attempt = 0; attempt < 2; attempt++) {
            const request = { ...spec.request, messages: [{ role: 'system' as const, content: SYSTEM + (repair ? `\nRepair the previous invalid plan: ${repair}` : '') }, spec.request.messages[1]] };
            if (controller.signal.aborted) throw securityError;
            const response = await client.chat.completions.create(request, { signal: controller.signal });
            if (controller.signal.aborted) throw securityError;
            recordOpenAiUsage(spec.request.model, response, { motionGuide: true, attempt: attempt + 1, selectedTier: spec.tier, reasoningEffort: (spec.request as any).reasoning_effort });
            try {
                const raw = JSON.parse(response.choices[0]?.message?.content || '');
                result = spec.finalize(raw, { model: response.model || spec.request.model, provider: (response as any)._clikbProvider || 'openai' });
                break;
            } catch (error) { result = undefined; repair = (error as Error).message; }
        }
        if (!result) throw new Error('The AI returned an invalid motion plan. Please try again.');
        let billing: Record<string, unknown>;
        try { billing = await spec.charge(); }
        catch (error) { const e = error as MotionRouteError; res.status(402).json({ message: e.message, ...(e.extra || {}) }); return; }
        res.json({ ...result, ...billing });
    } catch (error) {
        console.error('[MotionGuide] build failed', error);
        res.status(securityError ? 403 : 502).json({ code: securityError ? 'SECURITY_STOP' : 'PROVIDER_FAILED',
            stage: securityError ? 'security-heartbeat' : 'provider',
            message: securityError?.message || 'Could not build the Motion Guide. Please try again.' });
    } finally { stopGuard(); }
}
