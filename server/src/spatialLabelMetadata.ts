/** Post-production metadata is independent of playback and authoring revisions. */
export type SpatialActionLabels = Record<string, Record<string, string>>;
export interface SpatialActionLabelPatch { stageId: string; connectionId: string; label: string }
export const ACTION_LABEL_MAX_LENGTH = 32;
export const actionLabelKey = (stageId: string, connectionId: string) => JSON.stringify([stageId, connectionId]);
export const normalizeActionLabel = (value: string) => value.replace(/\s+/gu, ' ').trim();
export const readActionLabelRevision = (document: any): number => Number.isSafeInteger(document?.actionLabelsRevision) && document.actionLabelsRevision >= 0 ? document.actionLabelsRevision : 0;
const safeId = (value: unknown): value is string => typeof value === 'string' && Boolean(value) && value.length <= 500
    && value !== 'prototype' && !Object.prototype.hasOwnProperty.call(Object.prototype, value);

export function validateActionLabelPatches(value: unknown): SpatialActionLabelPatch[] {
    if (!Array.isArray(value) || !value.length || value.length > 1000) throw new Error('Choose between 1 and 1000 action labels.');
    const seen = new Set<string>();
    return value.map(patch => {
        if (!patch || !safeId(patch.stageId) || !safeId(patch.connectionId) || typeof patch.label !== 'string' || patch.label.length > 256)
            throw new Error('Invalid action label.');
        const label = normalizeActionLabel(patch.label), key = actionLabelKey(patch.stageId, patch.connectionId);
        if (Array.from(label).length > ACTION_LABEL_MAX_LENGTH) throw new Error('Keep each label to 32 characters.');
        if (seen.has(key)) throw new Error('An action label was included twice.');
        seen.add(key);
        return { stageId: patch.stageId, connectionId: patch.connectionId, label };
    });
}

export function readActionLabels(document: any): SpatialActionLabels {
    const result: SpatialActionLabels = {};
    if (!document?.actionLabels || typeof document.actionLabels !== 'object') return result;
    for (const [stageId, labels] of Object.entries(document.actionLabels)) {
        if (!safeId(stageId) || !labels || typeof labels !== 'object') continue;
        for (const [connectionId, text] of Object.entries(labels)) {
            if (!safeId(connectionId) || typeof text !== 'string') continue;
            const label = normalizeActionLabel(text);
            if (label && Array.from(label).length <= ACTION_LABEL_MAX_LENGTH) (result[stageId] ||= {})[connectionId] = label;
        }
    }
    return result;
}

export function patchActionLabels(document: any, patches: SpatialActionLabelPatch[], preview = false) {
    // Preview may contain actions that have not been published. Store their
    // labels independently; this never publishes or changes the draft graph.
    if (!preview && patches.some(patch => !document?.stages?.some((stage: any) => stage.id === patch.stageId
        && stage.scene?.connections?.some((edge: any) => edge.id === patch.connectionId && edge.kind === 'action'))))
        throw new Error('An action changed. Reload the experience before saving its label.');
    const labels = readActionLabels(document);
    for (const patch of patches) {
        if (patch.label) (labels[patch.stageId] ||= {})[patch.connectionId] = patch.label;
        else if (labels[patch.stageId]) {
            delete labels[patch.stageId][patch.connectionId];
            if (!Object.keys(labels[patch.stageId]).length) delete labels[patch.stageId];
        }
    }
    return { ...document, actionLabels: labels, actionLabelsRevision: readActionLabelRevision(document) + 1 };
}

/** Publishing an editor snapshot retains labels saved from feed/preview. */
export function retainActionLabels(document: any, previous: any) {
    const labels = readActionLabels(previous), retained: SpatialActionLabels = {};
    for (const stage of document.stages || []) for (const edge of stage.scene?.connections || []) {
        const text = edge.kind === 'action' && labels[stage.id]?.[edge.id];
        if (text) (retained[stage.id] ||= {})[edge.id] = text;
    }
    return { ...document, actionLabels: retained, actionLabelsRevision: readActionLabelRevision(previous) };
}
