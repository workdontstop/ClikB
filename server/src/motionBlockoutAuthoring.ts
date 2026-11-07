import { boxSpanKey, validateMotionPlan, type MotionVec3 } from './motionGuidePlan';
import { initialMotionMatrix, initialMotionTransform } from './motionNodeTransforms';

/** Normalize newly authored extrusion coordinates without changing their volume.
 * Valid saved plans are returned unchanged; animated mirror signs must be fixed. */
export function normalizeBlockoutGeometry(input: any): any {
    const compact = ['connected-boxes', 'connected-primitives', 'skeleton-scene'].includes(input?.format);
    const normalizeNode = (node: any): any => {
        let result = node;
        if (node.shape === 'extrude') {
            const outline = node.geometry?.outline;
            const scales = compact ? [node.size ?? [1, 1, 1]] : node.keys?.map((key: any) => key.scale);
            if (Array.isArray(outline) && outline.length >= 3 && outline.length <= 64
                && outline.every((point: any) => Array.isArray(point) && point.length === 2
                    && point.every((n: any) => typeof n === 'number' && Number.isFinite(n)))
                && Array.isArray(scales) && scales.length > 0
                && scales.every((scale: any) => Array.isArray(scale) && scale.length === 3
                    && scale.every((n: any) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) >= .01 && Math.abs(n) <= 100))) {
                const signs = scales[0].map((n: number) => Math.sign(n));
                const factor = Math.max(1, ...outline.flat().map((n: number) => Math.abs(n) / 2));
                const dimensions = scales.map((scale: number[]) => [Math.abs(scale[0]) * factor, Math.abs(scale[1]) * factor, Math.abs(scale[2])]);
                if (scales.every((scale: number[]) => scale.every((n, axis) => Math.sign(n) === signs[axis]))
                    && dimensions.every((scale: number[]) => scale.every(n => Number.isFinite(n) && n >= .01 && n <= 100))
                    && (factor > 1 || signs.some((sign: number) => sign < 0))) {
                    // Fold X/Y reflections into the polygon, then compensate
                    // its bounded coordinates with positive size. Centered
                    // extrusion depth has the same volume when Z is reflected.
                    result = { ...node, geometry: { ...node.geometry,
                        outline: outline.map((point: number[]) => [point[0] * signs[0] / factor, point[1] * signs[1] / factor]) },
                        ...(compact ? { size: dimensions[0] }
                            : { keys: node.keys.map((key: any, i: number) => ({ ...key, scale: dimensions[i] })) }) };
                }
            }
        }
        if (Array.isArray(node.parts)) {
            const parts = node.parts.map(normalizeNode);
            if (parts.some((part: any, i: number) => part !== node.parts[i])) result = { ...result, parts };
        }
        return result;
    };
    if (!Array.isArray(input?.objects)) return input;
    const objects = input.objects.map(normalizeNode);
    return objects.some((object: any, i: number) => object !== input.objects[i]) ? { ...input, objects } : input;
}

/** Tolerate static authoring shorthand at the generation boundary only.
 * Saved animations keep strict validation; no model repair or visual gate. */
export function normalizeAuthoredScene(input: any): any {
    if (!input || typeof input !== 'object') return input;
    const finite = (n: any, fallback: number, min: number, max: number) =>
        typeof n === 'number' && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
    const vec = (value: any, fallback: number[], min = -100, max = 100) =>
        fallback.map((n, i) => finite(value?.[i], n, min, max));
    const duration = finite(input.duration, 5, 2, 15);
    const compact = ['connected-boxes', 'connected-primitives', 'skeleton-scene'].includes(input.format);
    const pose = (key: any = {}) => ({ ...key, position: vec(key.position, [0,0,0]),
        rotation: vec(key.rotation, [0,0,0], -32, 32), scale: vec(key.scale ?? key.size, [1,1,1], .01, 100) });
    const track = (keys: any, fallback: any, camera = false) => {
        const parse = (key: any) => camera ? { ...key, position: vec(key.position, [0,2,6]),
            target: vec(key.target, [0,1,0]), fov: finite(key.fov,45,15,100) } : pose(key);
        const sorted = (Array.isArray(keys) && keys.length ? keys : [fallback || {}])
            .filter((key: any) => key && typeof key === 'object').map((key: any) => ({ ...parse(key), t: finite(key.t,0,0,duration) }))
            .sort((a: any,b: any) => a.t-b.t);
        if (!sorted.length) sorted.push({...parse(fallback || {}),t:0});
        const unique = sorted.filter((key: any,i: number) => !i || key.t !== sorted[i-1].t);
        if(unique[0].t !== 0) unique.unshift({...unique[0],t:0});
        if(unique[unique.length-1].t !== duration) unique.push({...unique[unique.length-1],t:duration});
        return unique.length <= 96 ? unique : Array.from({length:96},(_,i)=>unique[Math.round(i*(unique.length-1)/95)]);
    };
    const node = (value: any): any => {
        const normalized = compact ? { ...value, ...(value.position ? {position:vec(value.position,[0,0,0])} : {}), ...(value.rotation ? {rotation:vec(value.rotation,[0,0,0],-32,32)} : {}),
            ...(value.size ? {size:vec(value.size,[1,1,1],.01,100)} : {}) }
            : { ...value, shape:value.shape || 'box',color:/^#[\da-f]{6}$/i.test(value.color) ? value.color : '#C4CAD6', keys:track(value.keys,value) };
        if(Array.isArray(value.parts)) {
            if(value.parts.length) normalized.parts=value.parts.map(node);
            else delete normalized.parts;
        }
        return normalized;
    };
    const camera = track(Array.isArray(input.camera) ? input.camera : undefined, input.camera, true);
    for(const key of camera) if(Math.hypot(...key.position.map((n: number,i: number)=>n-key.target[i]))<.01)
        key.position=vec([key.target[0],key.target[1],key.target[2] > 94 ? key.target[2]-6 : key.target[2]+6],[0,2,6]);
    const normalized = { ...input, duration, ...(!compact ? {version:1,background:/^#[\da-f]{6}$/i.test(input.background) ? input.background : '#E4E9F2'} : {}),
        ...(Array.isArray(input.objects) ? {objects:input.objects.map(node)} : {}),
        camera:compact ? {position:camera[0].position,target:camera[0].target,fov:camera[0].fov} : camera };
    return JSON.stringify(normalized) === JSON.stringify(input) ? input : normalized;
}

/** A compact authoring input, compiled to the existing saved/animated format.
 * Shared named joints remove independent endpoint guesses. No species templates. */
export function expandBlockoutAuthoring(input: any, relationships: any[] = []): unknown {
    input = normalizeAuthoredScene(normalizeBlockoutGeometry(input));
    if (!['connected-boxes', 'connected-primitives', 'skeleton-scene'].includes(input?.format)) return input;
    const duration = input.duration ?? 5;
    const track = (pose: any = {}, scale = [1, 1, 1]) => [0, duration].map(t => ({ t,
        position: pose.position || [0, 0, 0], rotation: pose.rotation || [0, 0, 0], scale: pose.size || scale }));
    const endpointGrips = new Map<string, MotionVec3>();
    const endpoint = (value: any): value is MotionVec3 => Array.isArray(value) && value.length === 3
        && value.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 100);
    const objects = (input.objects || []).map((object: any) => {
        // Motion/control role is independent of geometry: a car or aircraft is
        // still an actor while retaining its solid body and functional parts.
        // Older skeleton-scene authors omitted this discriminator; retain their
        // explicit organic joint graphs without treating every actor as bones.
        const skeletal = object.representation === 'skeleton' || object.representation !== 'solid'
            && input.format === 'skeleton-scene' && object.role === 'actor' && Array.isArray(object.bones) && object.bones.length > 0;
        const parts = (skeletal ? [] : object.parts || []).map((part: any) => ({ ...part, shape: part.shape || 'box', color: '#C4CAD6', keys: track(part) }));
        for (const bone of object.bones || []) {
            const start = object.joints?.[bone.from], end = object.joints?.[bone.to];
            if (!start || !end) throw new Error('A connected box is missing its named joint.');
            const shape = skeletal ? 'bone' : bone.shape || 'box';
            parts.push({ id: bone.id, identity: bone.identity, shape, color: '#C4CAD6', keys: [0, duration].map(t => {
                const key = boxSpanKey(t, { start, end,
                    width: skeletal ? (object.boneWidth || .09) : bone.width || object.boneWidth || .15,
                    depth: skeletal ? (object.boneWidth || .09) : bone.depth || bone.width || object.boneWidth || .15 });
                if (shape !== 'box' && shape !== 'bone') { delete key.span; if (shape === 'capsule') { key.scale[0] *= 2; key.scale[2] *= 2; } }
                return key;
            }) });
        }
        // Compact size explicitly describes a solid core, not a multiplier for
        // details. Keep that core when a model adds railings, a cap or a hilt.
        let solidCore: any;
        if (!skeletal && parts.length && object.size) {
            let id = 'solid_core'; while (parts.some((part: any) => part.id === id)) id += '_';
            solidCore = { id, shape: object.shape || 'box', geometry: object.geometry, color: '#C4CAD6', surface: object.surface, keys: track({ size: object.size }) };
            parts.unshift(solidCore);
        }
        let endpointKeys: ReturnType<typeof boxSpanKey>[] | undefined;
        const owner = input.objects.find((candidate: any) => candidate.id === object.attachment?.objectId);
        const grip = owner?.joints?.[object.attachment?.jointId];
        if ((!parts.length || solidCore) && !object.attachment?.partId && ['box', 'cylinder', 'cone'].includes(object.shape || 'box')
            && endpoint(grip) && endpoint(object.tipPosition)) {
            const length = Math.hypot(...object.tipPosition.map((n: number, axis: number) => n - grip[axis]));
            if (length >= .01 && length <= 100) {
                const width = typeof object.size?.[0] === 'number' && object.size[0] >= .01 && object.size[0] <= 100 ? object.size[0] : .06;
                const depth = typeof object.size?.[2] === 'number' && object.size[2] >= .01 && object.size[2] <= 100 ? object.size[2] : .06;
                endpointKeys = [0, duration].map(t => {
                    const key = boxSpanKey(t, { start: grip, end: object.tipPosition, width, depth });
                    // Bone spans overlap at joints; a held prop instead needs
                    // exact grip/tip endpoints on its centered unit primitive.
                    key.scale = solidCore ? [1, 1, 1] : [width, length, depth];
                    delete key.span;
                    return key;
                });
                if (solidCore) solidCore.keys = track({ size: [width, length, depth] });
                endpointGrips.set(object.id, [0, solidCore ? -length / 2 : -.5, 0]);
            }
        }
        return { id: object.id, identity: object.identity, subjectColor: object.subjectColor, role: object.role, surface: object.surface,
            shape: parts.length ? 'box' : object.shape || 'box', ...(!parts.length && object.geometry ? { geometry: object.geometry } : {}), color: '#C4CAD6', attachment: object.attachment,
            keys: endpointKeys || track({ ...object, size: parts.length ? [1, 1, 1] : object.size }), ...(parts.length ? { parts } : {}) };
    });
    const plan = validateMotionPlan({ version: 1, duration, background: '#E4E9F2', objects,
        camera: [0, duration].map(t => ({ t, ...input.camera })) });
    // Use an explicit shared joint for held objects. Legacy compact responses
    // can resolve their declared left/right hold against a named wrist/grip.
    // This is geometry + attachment, not a creature or equipment template.
    for (const object of plan.objects) {
        const source = input.objects.find((item: any) => item.id === object.id);
        const owner = input.objects.find((item: any) => item.id === object.attachment?.objectId);
        if (!owner || object.attachment?.partId) continue;
        const held = relationships.find(item => item.from === owner.id && item.to === object.id && /^(holds|holding|carries|carrying)$/.test(item.relation));
        const side = held?.facts?.hand;
        const jointId = source.attachment?.jointId || (['left', 'right'].includes(side)
            ? Object.keys(owner.joints || {}).find(id => id.includes(side) && /wrist|hand/.test(id)) : undefined);
        const joint = owner.joints?.[jointId];
        const bone = owner.bones?.find((bone: any) => bone.to === jointId);
        const contact = endpointGrips.get(object.id) || source.gripPoint || source.parts?.find((part: any) => /(^|_)(grip|handle|contact)(_|$)/.test(part.id))?.position;
        if (!joint || !bone || !contact) continue;
        const localPlan = { ...plan, objects: [{ ...object, attachment: undefined, keys: object.keys.map(key => ({ ...key, position: [0, 0, 0] as MotionVec3 })) }] };
        const matrix = initialMotionMatrix(localPlan, object.id);
        const rotated = [0, 1, 2].map(row => contact.reduce((sum: number, n: number, col: number) => sum + n * matrix[row * 4 + col], 0));
        object.keys = object.keys.map(key => ({ ...key, position: joint.map((n: number, axis: number) => n - rotated[axis]) as MotionVec3 }));
        let anchorPart = bone.id;
        const ownerPlan = plan.objects.find(item => item.id === owner.id)!;
        const parentBone = ownerPlan.parts!.find(part => part.id === bone.id)!;
        if (parentBone.shape === 'bone' || endpointGrips.has(object.id) && parentBone.shape === 'box' && parentBone.keys.every(key => key.span)) {
            anchorPart = (bone.id.slice(0, 35) + '_grip_anchor');
            if (!ownerPlan.parts!.some(part => part.id === anchorPart)) {
                ownerPlan.parts!.push({ id: anchorPart, shape: 'anchor', color: '#6686B3', parentId: bone.id,
                    keys: parentBone.keys.map(key => ({ t: key.t, position: [0, Math.hypot(...key.span!.end.map((n, i) => n - key.span!.start[i])) / (2 * key.scale[1]), 0],
                        rotation: [0, 0, 0], scale: key.scale.map(n => 1 / n) as MotionVec3 })) });
            }
        }
        const anchor = { objectId: owner.id, partId: anchorPart };
        const pose = initialMotionTransform(plan, object.id, anchor);
        if (endpointGrips.has(object.id) && object.parts?.length) pose.scale = [1, 1, 1];
        // A nonuniformly scaled bone can introduce shear when reparenting.
        // TRS approximates orientation, so pin the contact again AFTER that
        // decomposition instead of allowing the grip to drift off the hand.
        const contactPlan = { ...plan, objects: plan.objects.map(item => item === object
            ? { ...item, keys: [0, duration].map(t => ({ t, position: joint as MotionVec3, rotation: [0, 0, 0] as MotionVec3, scale: [1, 1, 1] as MotionVec3 })) } : item) };
        const target = initialMotionTransform(contactPlan, object.id, anchor).position;
        const local = initialMotionMatrix({ ...plan, objects: [{ ...object, attachment: undefined,
            keys: [{ ...pose, position: [0, 0, 0] }] }] }, object.id);
        pose.position = target.map((n, row) => n - contact.reduce((sum: number, value: number, col: number) => sum + value * local[row * 4 + col], 0)) as MotionVec3;
        object.keys = [0, duration].map(t => ({ ...pose, t })); object.attachment = anchor;
    }
    return validateMotionPlan(plan);
}

export const blockoutAuthoringInstructions = `
In this single response, inspect the source image and build the scene. Optionally include top-level sourceLayout:{camera:"perspective evidence",landmarks:[{id,description,box:[x,y,width,height],occluded:false}]} with normalized visible image boxes matching object IDs. Never require a separate analysis or review turn.
For static reconstruction return COMPACT {plan:{format:"connected-primitives",duration:5,camera:{position:[x,y,z],target:[x,y,z],fov:45},objects:[...]},controlledObject,controlMode,motionStyle,locomotion,walkable:[{min,max}],obstacles:[{min,max}],initialState:{conditions,relationships,objects}}.
Every object explicitly chooses representation:"skeleton" or "solid" independently of role. role:"actor" means a moving or controllable entity; vehicles and rigid moving objects also retain this role. The compact format can mix both representations in one scene.
Default all visible figures and moving objects to representation:"solid". People/creatures use {id,role:"actor",representation:"solid",identity?,position,rotation?,joints:{NAME:[x,y,z]},bones:[{id,from:"NAME",to:"NAME",shape?:"box"|"capsule",width,depth}],parts?:[{id,shape,position,rotation?,size,geometry?}]}. Shared joint coordinates drive connected SOLID limb/body spans; choose actual filled widths/depths appropriate to the source's broad mass, not thin skeletal lines. Join torso, pelvis, head/neck and limbs into one readable solid form with overlapping contact; simple body/head masses may be local parts. Use the simplest useful graph without fixed bone counts or species templates. Local joints/parts are meters, root scale is one. Practical curves may use capsule/tube; a wing may use a simple attached filled extrusion/triangle when it helps the broad silhouette. Keep those shapes joined to the body/joints; avoid oversized loose panels. BODY-ONLY FIGURES: infer the simple body underneath clothing. Ignore capes, cloaks, coats, skirts, armor and all costume silhouettes completely; do not create cape_mass, cloth panels or a single slab covering the figure. A human must read as a head, torso/pelvis, two distinct arms and two distinct legs, connected at joints. Keep the torso body-sized, not as wide or long as the clothing outline. Preserve the source pose and facing, and preserve useful held equipment as separate props. Omit decorative anatomy and identity details. Prioritize source position, scale, facing, contact and motion over recreating costume or exact identity.
Only an explicit request for skeletal visualization uses representation:"skeleton" with named joints, bones:[{id,from,to}], and boneWidth relative to figure size. That optional representation creates smooth blue rods and round joints; existing skeletal scenes retain their saved geometry.
Atmospheric sky, clouds and lighting observations remain background appearance, even if sourceLayout mentions them; they need no solid object/root. Never add a solid wall, ceiling or strip to represent sky/clouds. Physical mountains and meaningful sky bodies such as a visible sun or moon are separate simple volumes. Obstacle bounds cover actual blocked solids; keep arch/door openings and the traversable path out of obstacle boxes.
Vehicles, rigid moving objects, props and scenery: {id,role:"actor"|"prop"|"scenery",representation:"solid",identity?,position,rotation?,shape?,geometry?,size?,attachment?,tipPosition?,gripPoint?,surface?,parts?:[{id,shape?,geometry?,position,rotation?,size?,surface?}]}. Cars, aircraft, boats and machines retain clean solid primitive bodies and functional parts: body/cabin, wheels, wings or other motion-relevant components. Use solid articulated mechanical parts where needed. A driven vehicle remains role:"actor", representation:"solid"; its seated human rider/passenger is a separate connected solid figure attached to it. Supported shapes: box(default),sphere,cylinder,cone,capsule,extrude,tube. Parts use actual local meters and unit root; size with parts creates an additional solid core of those dimensions. Keep compound size absent unless that core is intended. Use mainly boxes for environment, broad stepped blocks for mountains, other shapes for genuinely shaped objects such as pointed roofs or cups. No textures. For each actor include subjectColor:"#rrggbb": ONE representative dominant body/appearance color observed in the SOURCE IMAGE. All body parts use that same color. Clothing may inform this flat color but must not create costume geometry. Do not invent identifier-based colors. Preserve existing subjectColor on edits unless the user asks to recolor.
Every part/joint position is LOCAL to its root: add the root offset exactly once, never repeat a world coordinate inside the part. Extrude outlines use finite local XY coordinates in [-2,2], with positive size and depth; scale size to obtain the intended meters. The app safely normalizes larger finite outlines or fixed mirrored extrusion scales without changing their world silhouette. Establish the source camera height and tilt before choosing distances. A standing-eye-level image needs a standing-eye-level camera relative to the actor, not an overhead camera followed by an enlarged actor. Physical continuous floors, paths, platforms and terrain use box with surface:"ground" for the grid. Connect steps/path/landing. Environment objects follow their observed form class: solid masses (rocks, crates, consoles, furniture) use solid volumes; open frames (arches, doorways, trellises, scaffolds, railings, gantries) use open posts, beams or tubes with the opening left open and traversable, never solid occluding slabs; low borders (hedges, curbs, low ledges, planters) remain at their observed low height; distant backdrops (mountains, skylines, far walls) stay placed deep behind the playable area. Enclose scenes with walls or ceilings ONLY when the source image physically shows an indoor room, chamber, corridor or cockpit; open outdoor landscapes, nature, gardens, fields, streets and landing pads remain open to the sky and horizon without artificial bordering walls. Broad mountains retain their stepped profile with depth and varying heights behind the scene. A background skyline must stay behind the scene. Flying subjects retain terrain BELOW at the inferred altitude. Match source camera, subject position/size/crop, overlap order, facing and proportions. Keep the controlled character's head, torso and limbs inside the initial frame with a small margin. Preserve left/right placement and facing; widen or pull back the camera if necessary instead of cropping the controlled body. Check this at the supplied portrait/landscape aspect ratio. A mounted rider is its own connected solid root attached to the carrier with seated pose.
Held props must be complete, simple solid shapes. For a simple long sword, rod or pole use shape:"box"|"cylinder"|"cone", attachment:{objectId:"owner",jointId:"right_wrist"}, and tipPosition:[x,y,z] in the OWNER's local meters, using the same coordinate system as its named joints. The app derives position, rotation and exact length from that grip joint to the far tip; cone points at the tip. size X/Z optionally supplies thickness (default .06). Specify the visible tip below/above/left/right of the grip exactly as the source shows; this endpoint form needs no guessed Euler rotation, size Y or gripPoint. It also works for a compound prop with size and parts: size defines its solid core, the app replaces core length with joint-to-tip distance and keeps a unit root. Additional parts retain their local geometry around the centered core; the grip is at local Y=-length/2 and the tip at +length/2. Compound props without an endpoint retain their explicit geometry. For other props the existing attachment plus gripPoint:[x,y,z] in the prop's unscaled LOCAL geometry coordinates remains supported (unit primitives span -.5 to .5); retain the source's visible far-tip direction. Preserve equipment even without Character assets. Supporting relationships use {from:"actor_or_prop",to:"surface",relation:"stands_on"|"rests_on"}; airborne actors do not stand on the terrain below them. Preserve all identities/relationships for subsequent actions. Return strict JSON only.
`;
