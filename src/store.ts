import { configureStore } from "@reduxjs/toolkit";
import settingsReducer from "./settingsSlice"; // Import the reducer from settingsSlice
import profileReducer from "./profileSlice"; // Import the reducer from profileSlice
import brainstormReducer from "./brainstormSlice";
import spatialLabelsReducer from "./spatialLabelsSlice";
import imageModelExamplesReducer from './imageModelExamplesSlice';

export const store = configureStore({
  reducer: {
    settings: settingsReducer, // Add the settings reducer
    profile: profileReducer, // Add the profile reducer
    brainstorm: brainstormReducer,
    spatialLabels: spatialLabelsReducer,
    imageModelExamples: imageModelExamplesReducer,
  },
  // Development-only checks deep-walk state on EVERY dispatch. UI trackers
  // publish the observation snapshot frequently (scroll/overlay changes), so
  // walking it here stalled frames in dev. Production builds omit these checks.
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    immutableCheck: { ignoredPaths: ['brainstorm.userSnapshot'] },
    serializableCheck: { ignoredPaths: ['brainstorm.userSnapshot'] },
  }),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>; // RootState type for Redux state
export type AppDispatch = typeof store.dispatch; // AppDispatch type for dispatching actions

export default store;
