// store/settingsSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

/* -----------------------------------------------------------
 *  State shape
 * ---------------------------------------------------------- */
interface SettingsState {
  darkMode: boolean;
  tutorial: boolean;
  showmenuToggle: boolean;
  fullscreenMute: boolean;
  pixels: number;
  login: boolean;
  /** ðŸ”‘ Stripe Embedded Checkout */
  clientSecret: string | null;
  /** Numeric aspect ratio key (1,2,3) */
  aspectRatio: number;
  followersCount: number; // NEW
  followingCount: number; // NEW

  /** ðŸŽ¨ AI generation controls */
  artstyle: string; // text type
  model: string; // text type
  prompt: string; // text type

  /** First Impressions */
  firstImpressions: { postId: string; trials: number }[];

  /** Theme Colors */
  appColorDark: string;
  appColorLight: string;
}

const initialState: SettingsState = {
  darkMode: true,
  tutorial: false,
  showmenuToggle: true,
  fullscreenMute: true,
  pixels: 0,
  login: false,
  clientSecret: null,
  aspectRatio: 1, // 1 = your default (e.g. 9:16)
  followersCount: 0, // NEW
  followingCount: 0, // NEW

  // NEW text fields
  artstyle: "",
  model: "",
  prompt: "",

  firstImpressions: [],
  appColorDark: "#E8BAFA",
  appColorLight: "#0099cc",
};

/* -----------------------------------------------------------
 *  Slice
 * ---------------------------------------------------------- */
const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    /* ---------- UI toggles ---------- */
    toggleDarkMode(state) {
      state.darkMode = !state.darkMode;
      ///state.darkMode = true;
    },
    enableTutorial(state) {
      state.tutorial = true;
    },
    disableTutorial(state) {
      state.tutorial = false;
    },
    setTutorial(state, action: PayloadAction<boolean>) {
      state.tutorial = action.payload;
    },
    setShowmenuToggle(state, action: PayloadAction<boolean>) {
      state.showmenuToggle = action.payload;
    },

    /* ---------- fullscreen-mute ---------- */
    activateFullscreenMute(state) {
      state.fullscreenMute = true;
    },
    deactivateFullscreenMute(state) {
      state.fullscreenMute = false;
    },

    /* ---------- Pixels ---------- */
    setPixels(state, action: PayloadAction<number>) {
      state.pixels = action.payload;
    },
    incrementPixels(state, action: PayloadAction<number>) {
      state.pixels += action.payload;
    },

    /* ---------- Auth ---------- */
    setLogin(state, action: PayloadAction<boolean>) {
      state.login = action.payload;
    },

    /* ---------- Stripe Embedded Checkout ---------- */
    setClientSecret(state, action: PayloadAction<string | null>) {
      state.clientSecret = action.payload;
    },
    clearClientSecret(state) {
      state.clientSecret = null;
    },

    /* ---------- Aspect Ratio (numeric only) ---------- */
    setAspectRatio(state, action: PayloadAction<number>) {
      state.aspectRatio = action.payload;
    },
    cycleAspectRatio(state) {
      // assumes only 1,2,3 are meaningful; wrap around
      state.aspectRatio = state.aspectRatio === 3 ? 1 : state.aspectRatio + 1;
    },
    cycleAspectRatio2(state) {
      // assumes only 1,2,3 are meaningful; wrap around
      state.aspectRatio = 1;
    },
    cycleAspectRatio3(state) {
      // assumes only 1,2,3 are meaningful; wrap around
      state.aspectRatio = 2;
    },

    /* ---------- Followers/Following counts ---------- */
    setFollowersCount(state, action: PayloadAction<number>) {
      // NEW
      state.followersCount = action.payload;
    },
    setFollowingCount(state, action: PayloadAction<number>) {
      // NEW
      state.followingCount = action.payload;
    },
    incrementFollowingCount(state, action: PayloadAction<number | undefined>) {
      // NEW
      state.followingCount += action.payload ?? 1;
    },

    deFollowingCount(state, action: PayloadAction<number | undefined>) {
      // NEW
      state.followingCount -= action.payload ?? 1;
    },

    /* ---------- AI text fields: artstyle / model / prompt ---------- */
    setArtstyle(state, action: PayloadAction<string>) {
      state.artstyle = action.payload;
    },
    setModel(state, action: PayloadAction<string>) {
      state.model = action.payload;
    },
    setPromptRed(state, action: PayloadAction<string>) {
      state.prompt = action.payload;
    },

    /* ---------- First Impressions ---------- */
    initFirstImpression(state, action: PayloadAction<string>) {
      const postId = action.payload;
      if (!state.firstImpressions.find((imp) => imp.postId === postId)) {
        state.firstImpressions.push({ postId, trials: 1 });
      }
    },
    incrementFirstImpression(state, action: PayloadAction<string>) {
      const postId = action.payload;
      const existing = state.firstImpressions.find(
        (imp) => imp.postId === postId
      );
      if (existing) {
        existing.trials = 2; // Marks it as failed (so it's no longer the first impression)
      } else {
        state.firstImpressions.push({ postId, trials: 2 });
      }
    },

    /* ---------- Theme Colors ---------- */
    setAppColorDark(state, action: PayloadAction<string>) {
      state.appColorDark = action.payload;
    },
    setAppColorLight(state, action: PayloadAction<string>) {
      state.appColorLight = action.payload;
    },
  },
});

/* -----------------------------------------------------------
 *  Exports
 * ---------------------------------------------------------- */
export const {
  toggleDarkMode,
  enableTutorial,
  disableTutorial,
  setTutorial,
  setShowmenuToggle,
  activateFullscreenMute,
  deactivateFullscreenMute,
  setPixels,
  incrementPixels,
  setLogin,
  setClientSecret,
  clearClientSecret,
  setAspectRatio,
  cycleAspectRatio,
  cycleAspectRatio2,
  cycleAspectRatio3,
  setFollowersCount, // NEW
  setFollowingCount, // NEW
  incrementFollowingCount, // NEW
  deFollowingCount,
  setArtstyle, // NEW
  setModel, // NEW
  setPromptRed, // NEW
  initFirstImpression,
  incrementFirstImpression,
  setAppColorDark,
  setAppColorLight,
} = settingsSlice.actions;

export default settingsSlice.reducer;
