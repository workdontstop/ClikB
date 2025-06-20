import { configureStore } from "@reduxjs/toolkit";
import settingsReducer from "./settingsSlice"; // Import the reducer from settingsSlice
import profileReducer from "./profileSlice"; // Import the reducer from profileSlice

export const store = configureStore({
  reducer: {
    settings: settingsReducer, // Add the settings reducer
    profile: profileReducer, // Add the profile reducer
  },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>; // RootState type for Redux state
export type AppDispatch = typeof store.dispatch; // AppDispatch type for dispatching actions

export default store;
