// store/settingsSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { isScheduledDarkMode } from "./themeSchedule";
import { DEFAULT_IMAGE_MODEL } from "./imageModels";
import type { LanguageModelTier } from "./languageModels";
import type { ConversationModelTier } from "./conversationModels";
import { setLoggedUser, clearLoggedUser } from "./profileSlice";
import { DEFAULT_APP_ACCENT_COLORS, savedAppAccentColor } from "./appAccentColors";

export type GpuEngine = "h3" | "ltx";
export type SpatialControlMode = "analog" | "dpad";
export type ThemePreference = "automatic" | "light" | "dark";
type PixelChargeNoticeState = {
  id: number;
  pixels: number;
  label: string;
  stage?: string;
};

/* -----------------------------------------------------------
 *  State shape
 * ---------------------------------------------------------- */
interface SettingsState {
  /** User permission for future concierge app actions; independent of Guide speech. */
  conciergeEnabled: boolean;
  conciergeResponseExpanded: boolean;
  autoControlEnabled: boolean;
  autoControlVisible: boolean;
  autoControlEntryPoints: Array<"guide" | "chat">;
  autoControlChangedAt: number | null;
  autoControlChangedBy: "user" | "concierge" | null;
  /** Separate opt-in for Concierge's paid video and Motion Guide operations. */
  videoControlEnabled: boolean;
  pixelsOverlayOpen: boolean;
  darkMode: boolean;
  themePreference: ThemePreference;
  tutorial: boolean;
  showmenuToggle: boolean;
  fullscreenMute: boolean;
  /** Shared media playback level; independent of generation and narration settings. */
  playbackVolume: number;
  /** Session-only choice; null selects stick for creation and donut for viewers. */
  spatialControlMode: SpatialControlMode | null;
  /** Donut selection shared by creation, preview and feeds until reload. */
  spatialViewerHoverActive: boolean;
  pixels: number;
  /** Local observation revision; protects new async balance reads from stale delivery. */
  pixelsRevision: number;
  /** Latest confirmed server-side Pixel deduction, used by the floating pill. */
  pixelChargeNotice: PixelChargeNoticeState | null;
  /** Pending deductions are shown one-by-one so separate requests never merge into a misleading total. */
  pixelChargeNoticeQueue: PixelChargeNoticeState[];
  aiProviderNotice: { id: number; message: string } | null;
  /** Remaining prepaid GPU session time, stored in seconds. */
  gpuTimeSeconds: number;
  /** GPU backend selected before a session starts. H3 remains the default. */
  gpuEngine: GpuEngine;
  login: boolean;
  /** 🔑 Stripe Embedded Checkout */
  clientSecret: string | null;
  /** Numeric aspect ratio key (1,2,3) */
  aspectRatio: number;
  /** Opt-in image preview generation inside every NotepadEditor. */
  notepadPreviewActive: boolean;
  followersCount: number; // NEW
  followingCount: number; // NEW

  /** 🎨 AI generation controls */
  artstyle: string; // text type
  model: string; // text type — the IMAGE generation model, not the LLM
  imageModelPreview: { model: string; url: string } | null;
  artstylePreview: { style: string; url: string } | null;
  creationConfirmationOpen: boolean;
  creationSelectionDialogOpen: boolean;
  prompt: string; // text type

  /**
   * Prompt-writing model shared by both model pickers (the modal and the
   * toolbar menu). Separate from `model` above, which is the image model.
   * Intentionally not persisted: a reload returns to Luna, the cheap default.
   */
  languageModel: LanguageModelTier;

  /**
   * Brainstorm/Guide conversation model. Separate from the creation model so
   * choosing a stronger conversational assistant never changes prompt writing.
   * Like the other model setting, it resets to the economical default on reload.
   */
  conversationModel: ConversationModelTier;

  /** First Impressions */
  firstImpressions: { postId: string; trials: number }[];

  /** Theme Colors */
  appColorDark: string;
  appColorLight: string;

  /* ---------- Landing rows (PromptWelcomeUI) ---------- */
  /**
   * The creation-mode cards AND the showcase templates are folded away behind a
   * single reopen bubble.
   *
   * This lives in Redux rather than in PromptWelcomeUI for one concrete reason:
   * that component is REMOUNTED on every mode navigation (Shorts -> Games ->
   * Cinema each mount a fresh PromptInput, and therefore a fresh copy of the
   * welcome UI). Local state would forget the user's choice the moment they
   * moved, which is exactly the thing they asked to survive.
   *
   * The store is deliberately NOT persisted (see store.ts - plain
   * configureStore, no redux-persist), so this is per-page-load by
   * construction. That is what makes the auto-collapse below honest: a reload
   * is a fresh start, a route change is not.
   */
  landingRowsCollapsed: boolean;
  /**
   * The one automatic collapse of this page load has not been spent yet.
   *
   * Consumed exactly once, by whichever comes first: the 10s timer folding the
   * rows on its own, or the user reaching for the control by hand. Either way
   * the timer must never fire again afterwards - re-folding a row somebody just
   * deliberately opened is the worst version of this feature.
   */
  landingAutoCollapseArmed: boolean;

  /* ---------- App intro ---------- */
  /**
   * The toolbar strip is showing the app name instead of its normal controls.
   *
   * True on a cold start and false forever after, within this page load. Same
   * reasoning as the landing rows above: the store is not persisted, so "first
   * time the app loads" needs no timestamp and no storage key - a fresh store
   * IS a fresh load. It lives in Redux rather than in the intro component only
   * because that component is remounted on every mode navigation, and an intro
   * that replayed each time the user moved between Shorts and Cinema would stop
   * being an intro.
   */
  appIntroActive: boolean;
  deckEnabled: boolean;
  deckCleanMode: boolean;
  deckCardCount: 3 | 4 | 5;
}

const initialState: SettingsState = {
  conciergeEnabled: true,
  conciergeResponseExpanded: false,
  autoControlEnabled: false,
  autoControlVisible: false,
  autoControlEntryPoints: [],
  autoControlChangedAt: null,
  autoControlChangedBy: null,
  videoControlEnabled: false,
  pixelsOverlayOpen: false,
  darkMode: isScheduledDarkMode(new Date().getHours()),
  themePreference: "automatic",
  tutorial: false,
  showmenuToggle: true,
  fullscreenMute: true,
  playbackVolume: 1,
  spatialControlMode: null,
  spatialViewerHoverActive: false,
  pixels: 0,
  pixelsRevision: 0,
  pixelChargeNotice: null,
  pixelChargeNoticeQueue: [],
  aiProviderNotice: null,
  gpuTimeSeconds: 0,
  gpuEngine: "h3",
  login: false,
  clientSecret: null,
  aspectRatio: 1, // 1 = your default (e.g. 9:16)
  notepadPreviewActive: false,
  followersCount: 0, // NEW
  followingCount: 0, // NEW

  // NEW text fields
  artstyle: "",
  model: DEFAULT_IMAGE_MODEL,
  imageModelPreview: null,
  artstylePreview: null,
  creationConfirmationOpen: false,
  creationSelectionDialogOpen: false,
  prompt: "",

  languageModel: "luna",
  conversationModel: "luna",

  firstImpressions: [],
  appColorDark: DEFAULT_APP_ACCENT_COLORS.dark,
  appColorLight: DEFAULT_APP_ACCENT_COLORS.light,

  landingRowsCollapsed: false,
  landingAutoCollapseArmed: true,

  appIntroActive: true,
  deckEnabled: true,
  deckCleanMode: true,
  deckCardCount: 3,
};

/* -----------------------------------------------------------
 *  Slice
 * ---------------------------------------------------------- */
const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    setConciergeResponseExpanded(state, action: PayloadAction<boolean>) {
      state.conciergeResponseExpanded = action.payload;
    },
    setConciergeEnabled(state, action: PayloadAction<boolean>) {
      state.conciergeEnabled = action.payload;
      if (!action.payload) {
        state.autoControlVisible = false;
        if (state.autoControlEnabled) {
          state.autoControlEnabled = false;
          state.autoControlChangedAt = Date.now();
          state.autoControlChangedBy = null;
        }
      }
    },
    setAutoControlEntryPoint(
      state,
      action: PayloadAction<{ entry: "guide" | "chat"; visible: boolean }>
    ) {
      const exists = state.autoControlEntryPoints.includes(
        action.payload.entry
      );
      if (action.payload.visible && !exists)
        state.autoControlEntryPoints.push(action.payload.entry);
      if (!action.payload.visible && exists)
        state.autoControlEntryPoints = state.autoControlEntryPoints.filter(
          (entry) => entry !== action.payload.entry
        );
    },
    setAutoControlVisible(
      state,
      action: PayloadAction<{ visible: boolean; actor: "user" | "concierge" }>
    ) {
      if (action.payload.visible && !state.conciergeEnabled) return;
      state.autoControlVisible = action.payload.visible;
      // Hiding is also a stop. Do not leave invisible AI permission enabled.
      if (!action.payload.visible && state.autoControlEnabled) {
        state.autoControlEnabled = false;
        state.autoControlChangedAt = Date.now();
        state.autoControlChangedBy = action.payload.actor;
      }
    },
    setAutoControl(
      state,
      action: PayloadAction<{ enabled: boolean; actor: "user" | "concierge" }>
    ) {
      if (
        action.payload.enabled &&
        (!state.autoControlVisible || !state.conciergeEnabled)
      )
        return;
      if (state.autoControlEnabled === action.payload.enabled) return;
      state.autoControlEnabled = action.payload.enabled;
      state.autoControlChangedAt = Date.now();
      state.autoControlChangedBy = action.payload.actor;
    },
    setPixelsOverlayOpen(state, action: PayloadAction<boolean>) {
      state.pixelsOverlayOpen = action.payload;
    },
    setVideoControl(state, action: PayloadAction<boolean>) {
      state.videoControlEnabled = action.payload;
    },
    setSpatialControlMode(state, action: PayloadAction<SpatialControlMode>) {
      state.spatialControlMode = action.payload;
    },
    setSpatialViewerHoverActive(state, action: PayloadAction<boolean>) {
      state.spatialViewerHoverActive = action.payload;
    },
    /* ---------- UI toggles ---------- */
    toggleDarkMode(state) {
      state.darkMode = !state.darkMode;
      state.themePreference = state.darkMode ? "dark" : "light";
      /// state.darkMode = true;
    },
    setThemePreference(state, action: PayloadAction<ThemePreference>) {
      state.themePreference = action.payload;
      state.darkMode =
        action.payload === "automatic"
          ? isScheduledDarkMode(new Date().getHours())
          : action.payload === "dark";
    },
    syncScheduledTheme(state, action: PayloadAction<boolean>) {
      if (state.themePreference === "automatic")
        state.darkMode = action.payload;
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
    setPlaybackMuted(state, action: PayloadAction<boolean>) {
      state.fullscreenMute = action.payload;
    },
    setPlaybackVolume(state, action: PayloadAction<number>) {
      if (Number.isFinite(action.payload)) {
        state.playbackVolume = Math.max(0, Math.min(1, action.payload));
      }
    },

    /* ---------- Pixels ---------- */
    setPixels(state, action: PayloadAction<number>) {
      state.pixels = action.payload;
      state.pixelsRevision = (state.pixelsRevision || 0) + 1;
    },
    incrementPixels(state, action: PayloadAction<number>) {
      state.pixels += action.payload;
      state.pixelsRevision = (state.pixelsRevision || 0) + 1;
    },
    showPixelChargeNotice(
      state,
      action: PayloadAction<{ pixels: number; label: string; stage?: string }>
    ) {
      const lastQueued =
        state.pixelChargeNoticeQueue[state.pixelChargeNoticeQueue.length - 1];
      const lastId = lastQueued?.id ?? state.pixelChargeNotice?.id ?? 0;
      const notice = {
        ...action.payload,
        id: Math.max(Date.now(), lastId + 1),
      };
      if (state.pixelChargeNotice) {
        state.pixelChargeNoticeQueue.push(notice);
        // A runaway retry loop must not leave minutes of stale UI behind.
        if (state.pixelChargeNoticeQueue.length > 24)
          state.pixelChargeNoticeQueue.shift();
      } else {
        state.pixelChargeNotice = notice;
      }
    },
    clearPixelChargeNotice(state) {
      state.pixelChargeNotice = state.pixelChargeNoticeQueue.shift() ?? null;
    },
    showAiProviderNotice(state, action: PayloadAction<string>) {
      state.aiProviderNotice = { id: Date.now(), message: action.payload };
    },
    clearAiProviderNotice(state) {
      state.aiProviderNotice = null;
    },
    setGpuTime(state, action: PayloadAction<number>) {
      state.gpuTimeSeconds = Math.max(0, Math.floor(action.payload || 0));
    },
    addGpuTime(state, action: PayloadAction<number>) {
      state.gpuTimeSeconds = Math.max(
        0,
        state.gpuTimeSeconds + Math.floor(action.payload || 0)
      );
    },
    reduceGpuTime(state, action: PayloadAction<number>) {
      state.gpuTimeSeconds = Math.max(
        0,
        state.gpuTimeSeconds - Math.max(0, Math.floor(action.payload || 0))
      );
    },
    setGpuEngine(state, action: PayloadAction<GpuEngine>) {
      state.gpuEngine = action.payload;
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
    setNotepadPreviewActive(state, action: PayloadAction<boolean>) {
      state.notepadPreviewActive = action.payload;
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
      if (state.artstylePreview?.style !== action.payload)
        state.artstylePreview = null;
    },
    setModel(state, action: PayloadAction<string>) {
      state.model = action.payload;
      if (state.imageModelPreview?.model !== action.payload)
        state.imageModelPreview = null;
    },
    setImageModelPreview(
      state,
      action: PayloadAction<{ model: string; url: string } | null>
    ) {
      state.imageModelPreview = action.payload;
    },
    setArtstylePreview(
      state,
      action: PayloadAction<{ style: string; url: string } | null>
    ) {
      state.artstylePreview = action.payload;
    },
    setCreationConfirmationOpen(state, action: PayloadAction<boolean>) {
      state.creationConfirmationOpen = action.payload;
    },
    setCreationSelectionDialogOpen(state, action: PayloadAction<boolean>) {
      state.creationSelectionDialogOpen = action.payload;
    },
    /** Prompt-writing model. Never touches `model` (the image model). */
    setLanguageModel(state, action: PayloadAction<LanguageModelTier>) {
      state.languageModel = action.payload === 'sol_medium' ? 'terra' : action.payload;
    },
    setConversationModel(state, action: PayloadAction<ConversationModelTier>) {
      state.conversationModel = action.payload;
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

    /* ---------- Landing rows: creation modes + showcase templates ---------- */
    setLandingRowsCollapsed(state, action: PayloadAction<boolean>) {
      state.landingRowsCollapsed = action.payload;
    },
    toggleLandingRowsCollapsed(state) {
      state.landingRowsCollapsed = !state.landingRowsCollapsed;
    },
    /** Spend this page load's single automatic collapse, whatever spent it. */
    disarmLandingAutoCollapse(state) {
      state.landingAutoCollapseArmed = false;
    },

    /* ---------- App intro ---------- */
    /** One-way: the intro never comes back inside a page load. */
    dismissAppIntro(state) {
      state.appIntroActive = false;
    },

    /* ---------- Theme Colors ---------- */
    setAppColorDark(state, action: PayloadAction<string>) {
      state.appColorDark = action.payload;
    },
    setAppColorLight(state, action: PayloadAction<string>) {
      state.appColorLight = action.payload;
    },
    setDeckEnabled(state, action: PayloadAction<boolean>) {
      state.deckEnabled = action.payload;
    },
    setDeckCleanMode(state, action: PayloadAction<boolean>) {
      state.deckCleanMode = action.payload;
    },
    setDeckCardCount(state, action: PayloadAction<3 | 4 | 5>) {
      state.deckCardCount = action.payload;
    },
  },
  extraReducers: builder => {
    // Existing Guest/session login, Google login and signup all dispatch this.
    builder.addCase(setLoggedUser, (state, action) => {
      state.appColorLight = savedAppAccentColor('light', action.payload.usercolor1);
      state.appColorDark = savedAppAccentColor('dark', action.payload.usercolor2);
      state.deckEnabled = action.payload.deckEnabled !== false;
    });
    builder.addCase(clearLoggedUser, state => {
      state.appColorLight = DEFAULT_APP_ACCENT_COLORS.light;
      state.appColorDark = DEFAULT_APP_ACCENT_COLORS.dark;
      state.deckEnabled = true;
    });
  },
});

/* -----------------------------------------------------------
 *  Exports
 * ---------------------------------------------------------- */
export const {
  setConciergeResponseExpanded,
  setConciergeEnabled,
  setAutoControlEntryPoint,
  setAutoControlVisible,
  setAutoControl,
  setVideoControl,
  setPixelsOverlayOpen,
  setSpatialControlMode,
  setSpatialViewerHoverActive,
  toggleDarkMode,
  setThemePreference,
  syncScheduledTheme,
  enableTutorial,
  disableTutorial,
  setTutorial,
  setShowmenuToggle,
  activateFullscreenMute,
  deactivateFullscreenMute,
  setPlaybackMuted,
  setPlaybackVolume,
  setPixels,
  incrementPixels,
  showPixelChargeNotice,
  clearPixelChargeNotice,
  showAiProviderNotice,
  clearAiProviderNotice,
  setGpuTime,
  addGpuTime,
  reduceGpuTime,
  setGpuEngine,
  setLogin,
  setClientSecret,
  clearClientSecret,
  setAspectRatio,
  cycleAspectRatio,
  cycleAspectRatio2,
  cycleAspectRatio3,
  setNotepadPreviewActive,
  setFollowersCount, // NEW
  setFollowingCount, // NEW
  incrementFollowingCount, // NEW
  deFollowingCount,
  setArtstyle, // NEW
  setModel, // NEW
  setImageModelPreview,
  setArtstylePreview,
  setCreationConfirmationOpen,
  setCreationSelectionDialogOpen,
  setLanguageModel, // prompt-writing model (luna | terra | sol | astra)
  setConversationModel,
  setPromptRed, // NEW
  initFirstImpression,
  incrementFirstImpression,
  setLandingRowsCollapsed,
  toggleLandingRowsCollapsed,
  disarmLandingAutoCollapse,
  dismissAppIntro,
  setAppColorDark,
  setAppColorLight,
  setDeckEnabled,
  setDeckCleanMode,
  setDeckCardCount,
} = settingsSlice.actions;

export default settingsSlice.reducer;
