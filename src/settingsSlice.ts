import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// 1) Extend the interface to include fullscreenMute
interface SettingsState {
  darkMode: boolean;
  tutorial: boolean;
  showmenuToggle: boolean;
  fullscreenMute: boolean; // NEW
}

const initialState: SettingsState = {
  darkMode: true,
  tutorial: false,
  showmenuToggle: true,
  fullscreenMute: true, // NEW – default off
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    // ───────── existing actions ─────────
    toggleDarkMode: (state) => {
      state.darkMode = !state.darkMode;
    },
    enableTutorial: (state) => {
      state.tutorial = true;
    },
    disableTutorial: (state) => {
      state.tutorial = false;
    },
    setTutorial: (state, action: PayloadAction<boolean>) => {
      state.tutorial = action.payload;
    },
    setShowmenuToggle: (state, action: PayloadAction<boolean>) => {
      state.showmenuToggle = action.payload;
    },

    // ───────── new fullscreen-mute actions ─────────
    activateFullscreenMute: (state) => {
      state.fullscreenMute = true;
    },
    deactivateFullscreenMute: (state) => {
      state.fullscreenMute = false;
    },
    // Or, if you prefer a single setter:
    // setFullscreenMute: (state, action: PayloadAction<boolean>) => {
    //   state.fullscreenMute = action.payload;
    // },
  },
});

export const {
  // existing exports
  toggleDarkMode,
  enableTutorial,
  disableTutorial,
  setTutorial,
  setShowmenuToggle,

  // new exports
  activateFullscreenMute,
  deactivateFullscreenMute,
  // setFullscreenMute,   // <- uncomment if you enabled it
} = settingsSlice.actions;

export default settingsSlice.reducer;
