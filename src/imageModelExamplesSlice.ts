import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { protectImageModelExampleSources } from './SavepromptHelpersLocal';
import type { RootState } from './store';
import type { ImageModelExampleSet, ModelExampleImages } from '../server/src/imageModelExamples';

export type ImageResultModel = { model: string; storedUrl?: string };
const initialState = {
  sets: [] as ImageModelExampleSet[],
  status: 'idle' as 'idle' | 'loading' | 'ready' | 'failed',
  error: '',
  results: {} as Record<string, ImageResultModel>,
  requestId: '',
};
const url = () => `${import.meta.env.VITE_CLIK_URL}/image-model-example-sets`;

export const loadImageModelExampleSets = createAsyncThunk<ImageModelExampleSet[], boolean | undefined>(
  'imageModelExamples/load',
  async (_refresh, { getState, requestId }) => {
    const { data } = await axios.get<{ sets: ImageModelExampleSet[] }>(url(), { withCredentials: true });
    if (!Array.isArray(data?.sets)) throw new Error('Invalid image model example response.');
    if ((getState() as RootState).imageModelExamples.requestId === requestId) {
      protectImageModelExampleSources(data.sets.flatMap(set => Object.values(set.model_images)), true);
    }
    return data.sets;
  },
  { condition: (refresh: boolean | undefined, { getState }) => refresh === true || (getState() as RootState).imageModelExamples.status === 'idle' },
);

export async function saveImageModelExamples(name: string, images: ModelExampleImages): Promise<void> {
  await axios.post(url(), { name, model_images: images }, { withCredentials: true });
  protectImageModelExampleSources(Object.values(images));
}
export async function deleteImageModelExamples(id: string): Promise<void> {
  await axios.delete(`${url()}/${encodeURIComponent(id)}`, { withCredentials: true });
}

const slice = createSlice({ name: 'imageModelExamples', initialState, reducers: {
  recordImageResultModel(state, { payload }: PayloadAction<{ model: string; urls: string[]; storedUrl?: string }>) {
    for (const source of payload.urls) if (source && payload.model) {
      state.results[source] = { model: payload.model, storedUrl: payload.storedUrl || state.results[source]?.storedUrl };
    }
  },
  restoreImageResultModels(state, { payload }: PayloadAction<Record<string, string>>) {
    for (const [source, model] of Object.entries(payload)) if (!state.results[source]) {
      state.results[source] = { model, storedUrl: source };
    }
  },
}, extraReducers: builder => {
  builder.addCase(loadImageModelExampleSets.pending, (state, action) => { state.status = 'loading'; state.error = ''; state.requestId = action.meta.requestId; });
  builder.addCase(loadImageModelExampleSets.fulfilled, (state, action) => {
    if (state.requestId !== action.meta.requestId) return;
    state.sets = action.payload; state.status = 'ready';
  });
  builder.addCase(loadImageModelExampleSets.rejected, (state, action) => {
    if (state.requestId !== action.meta.requestId) return;
    state.status = 'failed'; state.error = 'Could not load image model example sets.';
  });
} });
export const { recordImageResultModel, restoreImageResultModels } = slice.actions;
export default slice.reducer;
