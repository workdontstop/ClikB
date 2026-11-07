import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { resetConversationMeasurementSessionId, syncConversationMeasurementSessionOwner } from "./conversationMeasurementSession";

// Define the state interface for the profile slice
interface User {
  id: number;
  ownerId?: number;
  name: string;
  username: string;
  image: string;
  imageThumb: string;
  usercolor1?: string | null;
  deckEnabled?: boolean;
  usercolor2?: string | null;
  usercolortype?: string;
  userquote?: string;
  biography?: string;
  fans?: number;
  favorites?: number;
  userbillboard1?: string;
  userbillboardthumb1?: string;
}

interface ProfileState {
  loggedUser: User | null;
  visitedUser: User | null;
}

// Set the initial state
const initialState: ProfileState = {
  loggedUser: null,
  visitedUser: null,
};

// Create the slice
const profileSlice = createSlice({
  name: "profile",
  initialState,
  reducers: {
    setLoggedUser: (state, action: PayloadAction<User>) => {
      syncConversationMeasurementSessionOwner(action.payload?.id ?? null);
      state.loggedUser = action.payload;
    },
    clearLoggedUser: (state) => {
      if (state.loggedUser) {
        resetConversationMeasurementSessionId();
      }
      syncConversationMeasurementSessionOwner(null);
      state.loggedUser = null;
    },
    updateProfileAccentColor: (state, action: PayloadAction<{ userId: number; mode: 'light' | 'dark'; color: string }>) => {
      if (state.loggedUser?.id === action.payload.userId) {
        state.loggedUser[action.payload.mode === 'light' ? 'usercolor1' : 'usercolor2'] = action.payload.color;
      }
    },
    updateProfileDeckEnabled: (state, action: PayloadAction<{ userId: number; enabled: boolean }>) => {
      if (state.loggedUser?.id === action.payload.userId) state.loggedUser.deckEnabled = action.payload.enabled;
    },

    // New action for updating only the profile picture
    updateProfilePic: (
      state,
      action: PayloadAction<{ image: string; imageThumb: string }>
    ) => {
      if (state.loggedUser) {
        state.loggedUser.image = action.payload.image;
        state.loggedUser.imageThumb = action.payload.imageThumb;
      }
    },

    // New action for updating only the billboard images
    updateBillboard: (
      state,
      action: PayloadAction<{
        userbillboard1: string;
        userbillboardthumb1: string;
      }>
    ) => {
      if (state.loggedUser) {
        state.loggedUser.userbillboard1 = action.payload.userbillboard1;
        state.loggedUser.userbillboardthumb1 =
          action.payload.userbillboardthumb1;
      }
    },
  },
});

// Export actions
export const {
  setLoggedUser,
  clearLoggedUser,
  updateProfileAccentColor,
  updateProfileDeckEnabled,
  updateProfilePic,
  updateBillboard,
} = profileSlice.actions;

// Export the reducer
export default profileSlice.reducer;
