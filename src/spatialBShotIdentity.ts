import { createSpatialScene, type SpatialSceneState } from './spatialStageModel';

export type BShotSource = { prompt: string; frameUrl: string; identity?: string };
const frame = (value: string) => value && !value.startsWith('EMPTY') ? value.split('?')[0] : '';

/** Match media first, then unchanged text, before treating a same-slot change as an edit.
 * Identity lives on the saved stage, never in the current prompt hash.
 */
export function reconcileSpatialBShots(parent: string, previous: Array<SpatialSceneState | null>, shots: BShotSource[], id: () => string): SpatialSceneState[] {
    const available = previous.filter((scene): scene is SpatialSceneState => Boolean(scene?.sceneId.startsWith(`${parent}:b:`)));
    const claimed = new Set<string>();
    const result: Array<SpatialSceneState | undefined> = shots.map(() => undefined);
    const explicit = shots.map(shot => shot.identity).filter(Boolean);
    if (new Set(explicit).size !== explicit.length) throw new Error('B-shot source identities must be unique.');
    shots.forEach((shot, index) => {
        if (!shot.identity) return;
        const match = available.find(scene => scene.sceneId === shot.identity);
        if (!match) throw new Error('The B-shot source identity no longer exists. Restore the source shot before mapping.');
        result[index] = match; claimed.add(match.sceneId);
    });
    for (const criterion of ['frame', 'prompt'] as const) shots.forEach((shot, index) => {
        if (result[index]) return;
        const value = criterion === 'frame' ? frame(shot.frameUrl) : shot.prompt;
        if (!value) return;
        const matches = available.filter(scene => !claimed.has(scene.sceneId) && (criterion === 'frame'
            ? frame(scene.bShotSource?.frameUrl || scene.nodes[0]?.frameUrl || '') === value
            : scene.bShotSource?.prompt === value));
        const duplicates = shots.filter(other => (criterion === 'frame' ? frame(other.frameUrl) : other.prompt) === value).length;
        if (matches.length === 1 && duplicates === 1) { result[index] = matches[0]; claimed.add(matches[0].sceneId); }
    });
    return shots.map((shot, index) => {
        let scene = result[index];
        const legacyAmbiguous = available.filter(candidate => !claimed.has(candidate.sceneId) && candidate.ledger && candidate.bShotSource?.slot === undefined
            && (Boolean(frame(shot.frameUrl)) && frame(candidate.bShotSource?.frameUrl || candidate.nodes[0]?.frameUrl || '') === frame(shot.frameUrl) || Boolean(shot.prompt) && candidate.bShotSource?.prompt === shot.prompt));
        // Saved documents are returned in database order, not storyboard order.
        // A persisted slot disambiguates identical sources on reload.
        const savedAtSlot = available.filter(candidate => candidate.bShotSource?.slot === index && !claimed.has(candidate.sceneId));
        const sameSlot = savedAtSlot.length === 1 ? savedAtSlot[0] : previous[index];
        const ambiguous = legacyAmbiguous.length > 1 || (legacyAmbiguous.length > 0 && shots.filter(other => other.prompt === shot.prompt && frame(other.frameUrl) === frame(shot.frameUrl)).length > 1);
        if (!scene && savedAtSlot.length === 1 && sameSlot && sameSlot.bShotSource?.prompt === shot.prompt && frame(sameSlot.bShotSource.frameUrl) === frame(shot.frameUrl)) {
            scene = sameSlot; claimed.add(scene.sceneId);
        }
        if (!scene && !ambiguous && savedAtSlot.length < 2 && previous.length === shots.length && sameSlot && available.includes(sameSlot) && !claimed.has(sameSlot.sceneId)) {
            scene = sameSlot; claimed.add(scene.sceneId);
        }
        if (!scene) {
            scene = createSpatialScene(`${parent}:b:shot-${id()}`, shot.frameUrl);
            if (ambiguous) scene.bShotIdentityConflict = legacyAmbiguous.map(candidate => candidate.sceneId);
        }
        if (scene.bShotSource?.prompt === shot.prompt && scene.bShotSource.frameUrl === shot.frameUrl && scene.bShotSource.identity === scene.sceneId && scene.bShotSource.slot === index) return scene;
        return { ...scene, bShotSource: { ...shot, identity: scene.sceneId, slot: index } };
    });
}
