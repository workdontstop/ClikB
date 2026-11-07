import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import OpenAI from 'openai';
import { createRoutedTextClient } from './textGeneration';
import { recordOpenAiUsage } from './aiUsageLedger';
import { validateMotionPlan, type MotionPlan } from './motionGuidePlan';
import { motionSceneInstructions } from './motionSceneInstructions';
import { projectedSceneBoxes, type SceneLayout } from './spatialSceneCalibration';
import { prepareMotionBlockout } from './motionBlockout';

type ReviewInput = { plan: MotionPlan; image: string; aspect: string; prompt: string; sourceLayout?: SceneLayout; relationships?: any[] };
const secret = process.env.SECRET_KEYY || randomBytes(32).toString('hex');
const used = new Map<string, number>();
const digest = (input: ReviewInput) => createHash('sha256').update(JSON.stringify([validateMotionPlan(input.plan), input.image, input.aspect, input.prompt])).digest('hex');
const signature = (text: string) => createHmac('sha256', secret).update(text).digest('base64url');

/** Keep the paid first result when the one optional visual correction makes
 * measured framing materially worse. This never requests another AI review. */
function preservesMeasuredFraming(first: MotionPlan, next: MotionPlan, layout: SceneLayout | undefined, aspect: string): boolean {
    if (!layout) return true;
    const before = projectedSceneBoxes(first, aspect), after = projectedSceneBoxes(next, aspect);
    const errors = { actor: [0, 0], environment: [0, 0] };
    for (const item of layout.landmarks) {
        const object = first.objects.find(object => object.id === item.id);
        // Interior fragments of occluded landmarks do not measure their whole
        // geometry. Source edge crops still provide meaningful visible bounds.
        if (!object || item.occluded && item.box[0] > .005 && item.box[1] > .005 && item.box[0] + item.box[2] < .995 && item.box[1] + item.box[3] < .995) continue;
        const a = before[item.id], b = after[item.id];
        if (!a?.[2] || !a[3]) continue;
        if (!b?.[2] || !b[3]) return false;
        const actor = object.role === 'actor';
        if (actor) {
            if (item.box[1] > .04 && a[1] > .04 && b[1] < .02) return false;
            if (item.box[1] + item.box[3] < .96 && a[1] + a[3] < .96 && b[1] + b[3] > .98) return false;
        }
        const weights = actor ? [1, 6, object.parts?.some(part => part.shape === 'bone') ? .35 : 1, 6] : [1, 1, 1, 1];
        const totals = actor ? errors.actor : errors.environment;
        for (const [index, box] of [a, b].entries())
            totals[index] += box.reduce((sum, n, axis) => sum + weights[axis] * (n - item.box[axis]) ** 2, 0);
    }
    return errors.actor[1] <= errors.actor[0] * 1.1 + .01 && errors.environment[1] <= errors.environment[0] * 1.15 + .02;
}

/** A paid build includes ONE review of exactly that plan, at its original tier.
 * The preview stays in memory; it is never uploaded as a permanent asset. */
export function issueMotionReview(user: string, model: string, input: ReviewInput): string | undefined {
    if (!input.image?.startsWith('https://')) return undefined;
    const text = Buffer.from(JSON.stringify({ user: String(user), model, hash: digest(input), sourceLayout: input.sourceLayout, relationships: input.relationships, nonce: randomUUID(), expires: Date.now() + 10 * 60_000 })).toString('base64url');
    return `${text}.${signature(text)}`;
}

export async function reviewMotionBlockout(user: string, body: ReviewInput & { reviewTicket?: string; preview?: string }): Promise<MotionPlan> {
    const original = validateMotionPlan(body.plan);
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
        const [text, signed] = String(body.reviewTicket || '').split('.');
        const expected = Buffer.from(signature(text)), received = Buffer.from(signed || '');
        if (expected.length !== received.length || !timingSafeEqual(expected, received)) return original;
        const ticket = JSON.parse(Buffer.from(text, 'base64url').toString());
        for (const [id, expires] of used) if (expires < Date.now()) used.delete(id);
        if (ticket.user !== String(user) || ticket.expires < Date.now() || ticket.hash !== digest(body) || used.has(ticket.nonce)) return original;
        if (typeof body.preview !== 'string' || body.preview.length > 2_000_000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(body.preview)) return original;
        // Consume before awaiting: duplicate requests cannot start another review.
        used.set(ticket.nonce, ticket.expires);
        const client = createRoutedTextClient(new OpenAI({ apiKey: process.env.DALLE_KEY, timeout: 45_000, maxRetries: 0 }));
        const request = client.chat.completions.create({ model: ticket.model, reasoning_effort: 'low', max_completion_tokens: 20000,
            response_format: { type: 'json_object' }, messages: [
                { role: 'system', content: `Return strict JSON. Compare the FIRST source image with the SECOND actual rendered Three.js blockout. This is the only visual review: never request another render or review. If the layout and silhouettes are usable return {"accepted":true}. Otherwise return {"correction":{"camera":COMPLETE_CAMERA_TRACK_IF_CHANGED,"objects":[{"id":"existing_id","keys":COMPLETE_TRACK_IF_CHANGED,"parts":[ONLY_CHANGED_OR_NEW_PARTS]}]}} in this same response. Omit unchanged fields and objects. Parts are merged by ID; use removePartIds:["id"] only to remove an erroneous fragment. This concise correction avoids repeating the entire scene. Correct material spatial mistakes: source camera/framing/aspect, left/right placement, relative size/depth, missing physical path/ground, disconnected anatomy, unrecognizable important subjects and riding pose. Check the visible far-tip direction and length of held equipment against the source, including misplaced child grips/guards; attachment alone does not make an upward or underground blade correct. Check that broad appendages face the intended camera view instead of disappearing edge-on, while the body retains its source facing. Existing span keys derive their transform from span.start/end/width/depth; edit those endpoints when changing a spanned limb, not just its derived position/rotation. Check especially for double scaling: if a compound root has large scale AND its parts already have meter-sized coordinates, correct the root to scale [1,1,1] rather than leaving gigantic walls obscuring the scene. Match the foreground subject height and placement to the source; do not leave it as a tiny figure. Ignore textures, costume colors, detailed lighting and photographic fidelity. Preserve the exact duration, all existing root IDs, subject identities, attachments and intended action. Preserve the root trajectories; correct their initial placement with a consistent offset only when the image shows a clear mismatch. Existing source edge cropping is intentional; do not center or fully reveal a cropped subject. No prose, diagnostics, quality warnings or requests for user input. ${motionSceneInstructions}` },
                { role: 'user', content: [{ type: 'text', text: JSON.stringify({ prompt: body.prompt, aspectRatio: body.aspect, plan: original, sourceLayout: ticket.sourceLayout, relationships: ticket.relationships }) },
                    { type: 'image_url', image_url: { url: body.image, detail: 'high' } },
                    { type: 'image_url', image_url: { url: body.preview, detail: 'high' } }] },
            ] });
        const response = await Promise.race([request, new Promise<never>((_, reject) => {
            deadline = setTimeout(() => reject(new Error('Visual review time budget reached')), 45_000);
        })]);
        recordOpenAiUsage(ticket.model, response, { motionBlockout: 'single-visual-review' });
        const raw = JSON.parse(response.choices[0]?.message?.content || '{}');
        if (raw.accepted || !raw.plan && !raw.correction) return original;
        let candidate = raw.plan;
        if (raw.correction) {
            const edits = Array.isArray(raw.correction.objects) ? raw.correction.objects : [];
            candidate = { ...original, camera: raw.correction.camera || original.camera, objects: original.objects.map(object => {
                const edit = edits.find((item: any) => item.id === object.id);
                if (!edit) return object;
                const changes = Array.isArray(edit.parts) ? edit.parts : [];
                const parts = Array.isArray(edit.parts) || Array.isArray(edit.removePartIds) ? [
                    ...(object.parts || []).filter(part => !edit.removePartIds?.includes(part.id)).map(part => ({ ...part, ...changes.find((item: any) => item.id === part.id) })),
                    ...changes.filter((part: any) => !object.parts?.some(old => old.id === part.id)),
                ] : object.parts;
                return { ...object, ...edit, ...(parts?.length ? { parts } : {}) };
            }) };
        }
        const corrected = validateMotionPlan(candidate);
        if (corrected.duration !== original.duration || original.objects.some(object => !corrected.objects.some(next => next.id === object.id && next.identity === object.identity))) return original;
        // Sparse corrections preserve every omitted component. Full-plan
        // responses must not silently discard a body, wheel or grip anchor.
        for (const object of original.objects) {
            const next = corrected.objects.find(item => item.id === object.id)!;
            const removals = raw.correction?.objects?.find((item: any) => item.id === object.id)?.removePartIds;
            if (object.parts?.some(part => !next.parts?.some(item => item.id === part.id)
                && (!Array.isArray(removals) || !removals.includes(part.id)))) return original;
        }
        // The reviewer has already compared the actual calibrated render with
        // the source. Re-fitting that corrected camera/subject composition here
        // compounds the first calibration and can undo the visual correction.
        // Retain renderability and physical support repair without a second fit.
        const supported = prepareMotionBlockout(corrected, body.aspect, undefined, ticket.relationships);
        return preservesMeasuredFraming(original, supported, ticket.sourceLayout, body.aspect) ? supported : original;
    } catch (error) {
        // The paid, renderable first result survives timeout/invalid correction.
        // No repair call, quality blocker or creator-facing diagnostic.
        console.warn('[MotionBlockout] keeping first result after optional review', error instanceof Error ? error.message : 'Review unavailable');
        return original;
    } finally { clearTimeout(deadline); }
}
