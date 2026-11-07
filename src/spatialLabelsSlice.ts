import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { actionLabelKey, type SpatialActionLabels, type SpatialActionLabelPatch } from '../server/src/spatialLabelMetadata';

export interface SpatialLabelsState {
    saved: Record<string, SpatialActionLabels>;
    revisions: Record<string, number>;
    drafts: Record<string, Record<string, SpatialActionLabelPatch>>;
}
const initialState: SpatialLabelsState = { saved: {}, revisions: {}, drafts: {} };
const slice = createSlice({ name: 'spatialLabels', initialState, reducers: {
    clearPostActionLabels(state, { payload: postId }: PayloadAction<number>) {
        delete state.saved[postId]; delete state.revisions[postId];
        for (const owner of Object.keys(state.drafts)) if (owner.endsWith(`:${postId}`)) delete state.drafts[owner];
    },
    draftActionLabel(state, { payload }: PayloadAction<{ owner: string; patch: SpatialActionLabelPatch }>) {
        (state.drafts[payload.owner] ||= {})[actionLabelKey(payload.patch.stageId, payload.patch.connectionId)] = payload.patch;
    },
    receiveActionLabels(state, { payload }: PayloadAction<{ postId: number; labels: SpatialActionLabels; revision?: number }>) {
        if ((payload.revision || 0) < (state.revisions[payload.postId] || 0)) return;
        state.saved[payload.postId] = payload.labels;
        state.revisions[payload.postId] = payload.revision || 0;
    },
    commitActionLabels(state, { payload }: PayloadAction<{ owner: string; postId: number; labels: SpatialActionLabels; revision?: number; patches: SpatialActionLabelPatch[] }>) {
        if ((payload.revision || 0) >= (state.revisions[payload.postId] || 0)) {
            state.saved[payload.postId] = payload.labels;
            state.revisions[payload.postId] = payload.revision || 0;
        }
        // A delayed response cannot discard edits made after the request began.
        for (const patch of payload.patches) {
            const key = actionLabelKey(patch.stageId, patch.connectionId);
            if (state.drafts[payload.owner]?.[key]?.label === patch.label) delete state.drafts[payload.owner][key];
        }
    },
} });
export const { draftActionLabel, receiveActionLabels, commitActionLabels, clearPostActionLabels } = slice.actions;
export default slice.reducer;
