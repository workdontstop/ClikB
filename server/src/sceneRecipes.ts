import type { MotionObject, MotionPlan, MotionVec3 } from './motionGuidePlan';
import { bikeRecipe, creatureRecipe, humanoidRecipe, vehicleRecipe } from './sceneRig';

/** Declarative construction tools. Expansion is identical for live and final plans. */
export function expandSceneObject(input: any, duration: number): MotionObject {
    if (!input?.recipe) return input;
    const position: MotionVec3 = input.keys?.[0]?.position || input.position || [0, 0, 0];
    if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) throw new Error('Recipe position must be a finite 3D point.');
    if (typeof input.id !== 'string' || !input.id) throw new Error('A recipe needs a stable object ID.');
    const color = input.color || '#bd5c65';
    const built = input.recipe === 'humanoid' ? humanoidRecipe(input.id, position, color, input.height ?? 1.75, input.initialPosture || 'standing')
        : input.recipe === 'creature' ? creatureRecipe(input.id, position, color, input.size ?? 1, Boolean(input.wings))
        : input.recipe === 'vehicle' ? vehicleRecipe(input.id, position, color, false)
        : input.recipe === 'helicopter' ? vehicleRecipe(input.id, position, color, true)
        : input.recipe === 'bike' ? bikeRecipe(input.id, position, color)
        : undefined;
    if (!built) throw new Error(`Unsupported scene recipe: ${String(input.recipe).slice(0, 50)}`);
    const retime = (keys: any[]) => keys.map(key => ({ ...key, t: key.t / 5 * duration }));
    const parts = built.object.parts!.map(part => ({ ...part, keys: retime(part.keys) }));
    for (const update of input.parts || []) {
        const index = parts.findIndex(part => part.id === update.id);
        if (index < 0) parts.push(update);
        else parts[index] = { ...parts[index], ...update };
    }
    const { recipe, height, size, wings, initialPosture, position: _position, ...overrides } = input;
    return { ...built.object, shape: 'anchor', keys: retime(built.object.keys), ...overrides, parts };
}

export function expandScenePlan(input: any): MotionPlan {
    return input && Array.isArray(input.objects)
        ? { ...input, objects: input.objects.map((object: any) => expandSceneObject(object, input.duration)) }
        : input;
}

export const sceneRecipeInstructions = `SHARED AUTHORING TOOLS:
You may construct standard articulated subjects using objects with recipe:"humanoid"|"creature"|"vehicle"|"helicopter"|"bike", a stable id, color and full root keys. Humanoid height defaults to 1.75 metres; creature size defaults to 1 and supports wings:true. The engine expands connected geometry and rig controls; optional parts overrides refine individual controls by stable ID. Recipe humanoid controls are pelvis,chest,neck,left/right_hip,knee,ankle,shoulder,elbow,wrist. Vehicle wheel controls are wheel_left/right_front/rear; helicopter has rotor; bike has saddle and handlebar. Use these tools when appropriate, with detailed local part keys for the actual source pose and requested action. You may add custom parts or use the existing full geometry schema for any subject. Do not reduce fidelity or replace source-specific anatomy, clothing, equipment or choreography with an unrelated template.
For humanoid recipes, initialPosture:standing|kneeling|seated establishes the physical base pose BEFORE the first live geometry appears; choose it from the actual source/video prompt. Then refine asymmetry, torso/hand contacts and action transitions with part keys or timed performance operations. For a seated/driving character, explicitly author the seat/socket, hand contacts and carrier attachment. No gait is enabled merely by creating a rig.`;
