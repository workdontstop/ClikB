import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { emptyCreationControls, type CreationControls, type CreationArea } from './creationControlSnapshot';
import { DEFAULT_FISH_VOICE } from '../server/src/fishVoiceCatalog';
import type { CreationMediaChange } from './creationMediaSnapshot';
import type { ChatMessage } from "./PromptConstructorMock";
import { AUTOMATIC_GUIDE_ENABLED_STORAGE_KEY } from "./automaticGuideCalls";
import {
  assembleNavigationSnapshot,
  appendNavigationTransition,
  emptyNavigationSnapshot,
  type NavigationAreaId,
  type NavigationAreaSnapshot,
  type NavigationControlSnapshot,
  type NavigationTransitionInput,
} from './navigationControlSnapshot';
import { navigationActorFor, navigationScrollActorFor } from './navigationActionProvenance';
import {
  assembleFeedsSnapshot, emptyFeedsSnapshot,
  type FeedAreaId, type FeedAreaSnapshot, type FeedsControlSnapshot,
} from './feedsControlSnapshot';

export type BrainstormMemorySlot = {
  slotId: number;
  turnStart: number;
  turnEnd: number;
  title: string;
  fullSummary: string;
  rejectedIdeas: string[];
  openQuestions: string[];
  names: string[];
  style: string;
};

export type BrainstormSessionIdentity = {
  userId?: number | string | null;
  username?: string | null;
  sessionId: string;
  deviceId: string;
};

export type CreationSceneSlotSnapshot = {
  slotKey: string;
  sceneNumber: number;
  nativeSlotNumber: number;
  cinemaStage?: 'Stage A' | 'Stage B';
  role: 'a-shot' | 'b-shot';
  bShotNumber?: number;
  displaySceneNumber?: number;
  parentDisplaySceneNumber?: number;
  displayRole?: 'A-roll' | 'B-roll';
  parentCinemaStage?: 'Stage A' | 'Stage B';
  hasPreviewImage: boolean;
  hasHdImage: boolean;
  hasVideo: boolean;
  previewVersion?: string;
  hdVersion?: string;
  videoVersion?: string;
  brief?: string;
};

export type ActiveAttemptClaim = {
  attemptId: string;
  projectId: string;
  mediaKind: 'image' | 'video' | 'character';
  targetKey: string;
  startedAt: number;
};

export type ConfirmedAttemptFailure = {
  attemptId: string;
  failureId: string;
  projectId: string;
  mediaKind: 'image' | 'video' | 'character';
  targetKey: string;
  sceneNumber?: number;
  bShotNumber?: number;
  message: string;
  failedAt: number;
};

export type UserSnapshotAction = {
  type: string;
  label?: string;
  target?: string;
  tagName?: string;
  route?: string;
  timestamp: number;
};

export type UserSnapshot = {
  timestamp: number;
  /** Global user permission switch, shared across every mode and never itself an action grant. */
  autoControl: {
    surfaceId: 'clikb.global.auto_control';
    conciergeEnabled: boolean;
    enabled: boolean;
    videoEnabled?: boolean;
    visible: boolean;
    visibleEntryPoints: Array<'guide' | 'chat'>;
    visibleControlIds: string[];
    changedAt: number | null;
    changedBy: 'user' | 'concierge' | null;
  };
  route: string;
  pageName: string;
  device: "mobile" | "desktop";
  loggedUserName: string;
  ui: {
    isMenuOpen: boolean;
    minimisePrompt: boolean;
    isBrainstormChatOpen: boolean;
    deckEnabled?: boolean;
    deckCleanMode?: boolean;
    guideShortcuts?: string;
  };
  app: {
    prompt: string;
    promptLength: number;
    artstyle: string;
    model: string;
    aspectRatio: number;
    pixels: number;
    appearance?: {
      themePreference: 'automatic' | 'light' | 'dark';
      effectiveDarkMode: boolean;
      appColor: string;
      appColorDark: string;
      appColorLight: string;
    };
  };
  creation: {
    visibleDrafts?: Array<{ controlId: string; label: string; value: string; state: 'uncommitted-editor-draft' }>;
    controls?: CreationControls;
    isActive: boolean;
    projectId?: string;
    stage: string;
    mode: string;
    modeType?: number;
    modeSelectionRequired?: boolean;
    goBlockedReason?: string | null;
    interactionExperienceMode?: 'spatial' | 'hotspots' | null;
    promptOpen: boolean;
    promptCharacterCount: number;
    selectedModel: string;
    selectedModelDisplayName?: string;
    selectedModelPixelRequirement: number;
    currentActionPixelRequirement: number;
    selectedArtStyle: string;
    aspectRatio: number;
    pixelsBalance: number;
    hasPromptMusic: boolean;
    promptMusicName?: string;
    promptMusicDurationSec?: number;
    promptMusicTimingReady?: boolean;
    promptMusicBreakerSec?: number;
    promptMusicSceneCount?: number;
    directUploadReferenceCount: number;
    directUploadReferenceNames: string[];
    selectedWorldId?: string | null;
    worldCharacterReferenceCount?: number;
    worldCharacterReferenceNames?: string[];
    referenceCount: number;
    referenceNames: string[];
    previewSceneCount: number;
    previewImageCount: number;
    promptMemoryPartCount?: number;
    originalRequestMemoryPartCount?: number;
    generationPlanMemoryPartCount?: number;
    intentOverviewMemoryPartCount?: number;
    sceneIndexMemoryPartCount?: number;
    sceneIntentMemoryPartCounts?: number[];
    characterMemoryPartCount?: number;
    musicMemoryPartCount?: number;
    planEditTextLength?: number;
    activeControls: string[];
    status: string;
    isGenerating: boolean;
    canEditGenerationPlan: boolean;
    canUseSkipToStoryboard: boolean;
    canCreateCharacters: boolean;
    canRemoveDirectUploadImages: boolean;
    characterBranchStage?: string;
    castingInstruction?: string;
    detectedCharacterCount?: number;
    detectedEnvironmentCount?: number;
    referenceImageReadyCount?: number;
    referenceImageMissingCount?: number;
    referenceEditorOpen?: boolean;
    selectedReferenceName?: string;
    selectedReferenceId?: string;
    referenceEditEvidence?: ReturnType<typeof import('./creationReferenceEvidence').referenceEditEvidence>[];
    editStoryTargetKey?: string;
    selectedReferenceType?: string;
    selectedReferencePromptLength?: number;
    selectedReferenceUpdateLength?: number;
    referenceDraftPrompt?: string;
    referenceAiInstruction?: string;
    stepOneDetectedCount?: number;
    stepOneCastingReady?: boolean;
    stepTwoAuditInProgress?: boolean;
    stepTwoCastingCancelled?: boolean;
    canUseStepOneCharacters?: boolean;
    canGenerateCharacterImages?: boolean;
    canEditCharacterNames?: boolean;
    canReviewScenesDuringCharacterCreation?: boolean;
    storybookStage?: string;
    storybookMode?: string;
    hdImageCount?: number;
    videoCount?: number;
    mediaRevision?: number;
    recentMediaChanges?: CreationMediaChange[];
    sceneSlots?: CreationSceneSlotSnapshot[];
    displaySceneCount?: number;
    sceneDisplayRevision?: string;
    editStoryDisplaySceneNumber?: number;
    editStoryDisplayRole?: 'A-roll' | 'B-roll';
    activeAttemptsByTarget?: Record<string, ActiveAttemptClaim>;
    confirmedFailuresByTarget?: Record<string, ConfirmedAttemptFailure>;
    editStoryMotionStatus?: string;
    editStoryMotionVideoReady?: boolean;
    editStoryMotionError?: string;
    imageError?: string;
    videoError?: string;
    editStoryMotionSourcePrompt?: string;
    editStoryMotionDraftPrompt?: string;
    editStoryPendingAiInstruction?: string;
    storybookSceneIndex?: number;
    editStoryStage?: string;
    editStoryMode?: string;
    editStoryTab?: string;
    editStoryIsOpen?: boolean;
    isInitialComposer?: boolean;
    isCompactOverlay?: boolean;
    minimizeMode?: number;
    editStoryIsBShot?: boolean;
    editStoryBShotModeActive?: boolean;
    editStoryCurrentSceneNumber?: number;
    editStoryCurrentImagePrompt?: string;
    editStoryCurrentVideoPrompt?: string;
    editStoryCurrentNarration?: string;
    editStoryNarrationText?: string;
    editStoryNarrationAiInstruction?: string;
    editStorySceneIndex?: number;
    editStoryNativeSceneIndex?: number;
    editStoryParentSceneIndex?: number;
    editStoryBShotIndex?: number;
    editStorySelectedImageModel?: string;
    editStorySelectedVideoModel?: string;
    editStoryPixelRequirement?: number;
    editStoryHasImage?: boolean;
    editStoryHasVideo?: boolean;
    editStoryHasNarration?: boolean;
    editStoryHasCharacters?: boolean;
    editStoryActiveCharacterCount?: number;
    editStoryReferenceCount?: number;
    editStorySceneReferenceCount?: number;
    editStoryUpdateTextPresent?: boolean;
    editStoryImagePromptPresent?: boolean;
    editStoryVideoPromptPresent?: boolean;
    editStoryAutoImageGenerate?: boolean;
    editStoryAutoDrawMode?: string;
    editStoryHasAutoDrawGuide?: boolean;
    editStoryVideoContextOpen?: boolean;
    editStoryActionModalOpen?: boolean;
    editStoryActionModalMode?: string;
    editStoryLipSyncActive?: boolean;
    editStoryCanUseDirectLipSync?: boolean;
    editStoryMusicMode?: boolean;
    editStoryMusicTimingLocked?: boolean;
    editStoryMusicSnippetAvailable?: boolean;
    editStoryReferenceVideoActive?: boolean;
  };
  lastAction: UserSnapshotAction | null;
  lastActions: UserSnapshotAction[];
  recentActions: UserSnapshotAction[];
  /** Live, owner-published status of the most recently started automatic guide call. */
  lastGuideCall: AutomaticGuideCallTracking | null;
  navigation?: NavigationControlSnapshot;
  feeds?: FeedsControlSnapshot;
};

export type AutomaticGuideCallStatus = "idle" | "running" | "succeeded" | "failed" | "cancelled";

export type AutomaticGuideCallTracking = {
  callId: string;
  status: AutomaticGuideCallStatus;
  attempts: number;
  lastTriggeredAt?: number;
  lastCompletedAt?: number;
  lastError?: string;
};

export type AutomaticGuideState = {
  enabled: boolean;
  callOverrides: Record<string, boolean>;
  calls: Record<string, AutomaticGuideCallTracking>;
  lastCallId: string | null;
};

type UserSnapshotPatch = Partial<Omit<UserSnapshot, "creation" | "navigation" | "feeds" | "lastGuideCall">> & {
  creation?: Partial<UserSnapshot["creation"]>;
  navigation?: Partial<Pick<NavigationControlSnapshot, 'route' | 'presentation'>>;
  feeds?: Partial<Pick<FeedsControlSnapshot, 'route'>>;
};

interface BrainstormState {
  chatHistory: ChatMessage[];
  memorySlots: BrainstormMemorySlot[];
  isChatOpen: boolean;
  selectedVoice: string;
  sessionId: string;
  deviceId: string;
  userSnapshot: UserSnapshot;
  automaticGuide: AutomaticGuideState;
}


const SELECTED_VOICE_STORAGE_KEY = "clikb_selected_voice";
const getInitialSelectedVoice = (): string => {
  try {
    if (typeof window === "undefined") return DEFAULT_FISH_VOICE;
    return window.localStorage.getItem(SELECTED_VOICE_STORAGE_KEY) || DEFAULT_FISH_VOICE;
  } catch {
    return DEFAULT_FISH_VOICE;
  }
};
const getInitialAutomaticGuideEnabled = (): boolean => {
  try {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(AUTOMATIC_GUIDE_ENABLED_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
};
const initialState: BrainstormState = {
  chatHistory: [],
  memorySlots: [],
  isChatOpen: false,
  selectedVoice: getInitialSelectedVoice(),
  sessionId: '',
  deviceId: '',
  automaticGuide: {
    enabled: getInitialAutomaticGuideEnabled(),
    callOverrides: {},
    calls: {},
    lastCallId: null,
  },
  userSnapshot: {
    timestamp: Date.now(),
    autoControl: {
      surfaceId: 'clikb.global.auto_control',
      conciergeEnabled: true,
      enabled: false,
      visible: false,
      visibleEntryPoints: [],
      visibleControlIds: [],
      changedAt: null,
      changedBy: null,
    },
    route: '/',
    pageName: 'Home',
    device: 'desktop',
    loggedUserName: 'Guest',
    ui: {
      isMenuOpen: false,
      minimisePrompt: true,
      isBrainstormChatOpen: false,
      deckEnabled: true,
      deckCleanMode: true,
      guideShortcuts: 'text-input: voice, model, deck',
    },
    app: {
      prompt: '',
      promptLength: 0,
      artstyle: '',
      model: '',
      aspectRatio: 1,
      pixels: 0,
    },
    creation: {
      isActive: false,
      stage: 'idle',
      mode: '',
      promptOpen: false,
      promptCharacterCount: 0,
      selectedModel: '',
      selectedModelPixelRequirement: 0,
      currentActionPixelRequirement: 0,
      selectedArtStyle: '',
      aspectRatio: 1,
      pixelsBalance: 0,
      hasPromptMusic: false,
      directUploadReferenceCount: 0,
      directUploadReferenceNames: [],
      selectedWorldId: null,
      worldCharacterReferenceCount: 0,
      worldCharacterReferenceNames: [],
      referenceCount: 0,
      referenceNames: [],
      previewSceneCount: 0,
      previewImageCount: 0,
      planEditTextLength: 0,
      activeControls: [],
      status: 'idle',
      isGenerating: false,
      canEditGenerationPlan: false,
      canUseSkipToStoryboard: false,
      canCreateCharacters: false,
      canRemoveDirectUploadImages: false,
    },
    lastAction: null,
    lastActions: [],
    recentActions: [],
    lastGuideCall: null,
    navigation: emptyNavigationSnapshot(),
    feeds: emptyFeedsSnapshot(),
  },
};

const brainstormSlice = createSlice({
  name: "brainstorm",
  initialState,
  reducers: {
    setBrainstormChatHistory(state, action: PayloadAction<ChatMessage[]>) {
      state.chatHistory = action.payload;
    },
    setBrainstormChatOpen(state, action: PayloadAction<boolean>) {
      state.isChatOpen = action.payload;
    },
    setBrainstormSelectedVoice(state, action: PayloadAction<string>) {
      state.selectedVoice = action.payload;
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(SELECTED_VOICE_STORAGE_KEY, action.payload);
        }
      } catch {
        // Ignore storage write errors
      }
    },
    setBrainstormSessionIdentity(state, action: PayloadAction<{ sessionId?: string; deviceId?: string }>) {
      if (typeof action.payload.sessionId === "string") state.sessionId = action.payload.sessionId;
      if (typeof action.payload.deviceId === "string") state.deviceId = action.payload.deviceId;
    },
    patchUserSnapshot(state, action: PayloadAction<UserSnapshotPatch>) {
      const navigation = action.payload.navigation
        ? assembleNavigationSnapshot(state.userSnapshot.navigation ?? emptyNavigationSnapshot(), action.payload.navigation)
        : state.userSnapshot.navigation;
      const feeds = action.payload.feeds
        ? assembleFeedsSnapshot(state.userSnapshot.feeds ?? emptyFeedsSnapshot(), action.payload.feeds.route)
        : state.userSnapshot.feeds;
      const incomingProjectId = action.payload.creation?.projectId;
      const previousProjectId = state.userSnapshot.creation.projectId;
      const projectChanged = Boolean(incomingProjectId && previousProjectId && incomingProjectId !== previousProjectId);
      const baseCreation = projectChanged
        ? {
            ...state.userSnapshot.creation,
            activeAttemptsByTarget: undefined,
            confirmedFailuresByTarget: undefined,
            imageError: undefined,
            videoError: undefined,
          }
        : state.userSnapshot.creation;
      const nextUserSnapshot = {
        ...state.userSnapshot,
        ...action.payload,
        navigation,
        feeds,
        creation: action.payload.creation
          ? { ...baseCreation, ...action.payload.creation }
          : baseCreation,
      };

      // Snapshot producers can rerender in response to this Redux update. Ignore an
      // identical patch so that timestamp-only changes cannot feed back indefinitely.
      const currentComparable = { ...state.userSnapshot, timestamp: 0 };
      const nextComparable = { ...nextUserSnapshot, timestamp: 0 };
      if (JSON.stringify(currentComparable) === JSON.stringify(nextComparable)) {
        return;
      }

      state.userSnapshot = {
        ...nextUserSnapshot,
        timestamp: Date.now(),
      };
    },
    publishCreationArea(state, action: PayloadAction<CreationArea>) {
      const current = state.userSnapshot.creation.controls ?? emptyCreationControls();
      if (JSON.stringify(current.areas[action.payload.areaId]) === JSON.stringify(action.payload)) return;
      current.areas[action.payload.areaId] = action.payload;
      current.stateVersion += 1;
      state.userSnapshot.creation.controls = current;
      state.userSnapshot.timestamp = Date.now();
    },
    removeCreationArea(state, action: PayloadAction<{ areaId: string; source: string }>) {
      const current = state.userSnapshot.creation.controls;
      if (current?.areas[action.payload.areaId]?.source !== action.payload.source) return;
      delete current.areas[action.payload.areaId];
      current.stateVersion += 1;
      state.userSnapshot.timestamp = Date.now();
    },
    publishNavigationArea(state, action: PayloadAction<NavigationAreaSnapshot>) {
      const current = state.userSnapshot.navigation ?? emptyNavigationSnapshot();
      const next = assembleNavigationSnapshot(current, undefined, action.payload);
      if (next === current) return;
      state.userSnapshot.navigation = next;
      state.userSnapshot.timestamp = Date.now();
    },
    publishFeedsArea(state, action: PayloadAction<FeedAreaSnapshot>) {
      const current = state.userSnapshot.feeds ?? emptyFeedsSnapshot();
      const next = assembleFeedsSnapshot(current, undefined, action.payload);
      if (next === current) return;
      state.userSnapshot.feeds = next;
      state.userSnapshot.timestamp = Date.now();
    },
    removeFeedsArea(state, action: PayloadAction<{ areaId: FeedAreaId; source: string }>) {
      const current = state.userSnapshot.feeds ?? emptyFeedsSnapshot();
      if (current.areas[action.payload.areaId]?.source !== action.payload.source) return;
      const next = assembleFeedsSnapshot(current, undefined, undefined, action.payload.areaId);
      if (next === current) return;
      state.userSnapshot.feeds = next;
      state.userSnapshot.timestamp = Date.now();
    },
    removeNavigationArea(state, action: PayloadAction<{ areaId: NavigationAreaId; source: string }>) {
      const current = state.userSnapshot.navigation ?? emptyNavigationSnapshot();
      if (current.areas[action.payload.areaId]?.source !== action.payload.source) return;
      const next = assembleNavigationSnapshot(current, undefined, undefined, action.payload.areaId);
      if (next === current) return;
      state.userSnapshot.navigation = next;
      state.userSnapshot.timestamp = Date.now();
    },
    setNavigationAvailableActions(state, action: PayloadAction<NavigationControlSnapshot['availableActions']>) {
      const current = state.userSnapshot.navigation ?? emptyNavigationSnapshot();
      if (JSON.stringify(current.availableActions) === JSON.stringify(action.payload)) return;
      state.userSnapshot.navigation = { ...current, availableActions: action.payload, stateVersion: current.stateVersion + 1 };
      state.userSnapshot.timestamp = Date.now();
    },
    setFeedsAvailableActions(state, action: PayloadAction<FeedsControlSnapshot['availableActions']>) {
      const current = state.userSnapshot.feeds ?? emptyFeedsSnapshot();
      if (JSON.stringify(current.availableActions) === JSON.stringify(action.payload)) return;
      state.userSnapshot.feeds = { ...current, availableActions: action.payload, stateVersion: current.stateVersion + 1 };
      state.userSnapshot.timestamp = Date.now();
    },
    recordNavigationTransition(state, action: PayloadAction<NavigationTransitionInput>) {
      const current = state.userSnapshot.navigation ?? emptyNavigationSnapshot();
      const actor = action.payload.actor === 'manual'
        ? navigationActorFor(action.payload.after.controlId ?? action.payload.before.controlId)
        : action.payload.actor === 'unknown' && action.payload.before.state?.scrollRegion
          ? navigationScrollActorFor(action.payload.before.areaId)
          : action.payload.actor;
      state.userSnapshot.navigation = appendNavigationTransition(current, { ...action.payload, actor });
      state.userSnapshot.timestamp = action.payload.timestamp ?? Date.now();
    },
    recordUserAction(state, action: PayloadAction<Omit<UserSnapshotAction, "timestamp"> & { timestamp?: number }>) {
      const timestamp = action.payload.timestamp ?? Date.now();
      const event: UserSnapshotAction = {
        ...action.payload,
        timestamp,
      };
      const recentActions = [event, ...state.userSnapshot.recentActions].slice(0, 20);
      state.userSnapshot.lastAction = event;
      state.userSnapshot.lastActions = recentActions.slice(0, 3);
      state.userSnapshot.recentActions = recentActions;
      state.userSnapshot.timestamp = timestamp;
    },
    appendBrainstormMessage(state, action: PayloadAction<ChatMessage>) {
      state.chatHistory.push(action.payload);
    },
    patchBrainstormMessage(state, action: PayloadAction<{ id: string; patch: Partial<ChatMessage> }>) {
      const msg = state.chatHistory.find((m) => m.id === action.payload.id);
      if (msg) Object.assign(msg, action.payload.patch);
    },
    setAutomaticGuideCallsEnabled(state, action: PayloadAction<boolean>) {
      state.automaticGuide.enabled = action.payload;
    },
    setAutomaticGuideCallEnabled(state, action: PayloadAction<{ callId: string; enabled: boolean }>) {
      state.automaticGuide.callOverrides[action.payload.callId] = action.payload.enabled;
    },
    automaticGuideCallStarted(state, action: PayloadAction<{ callId: string; triggeredAt: number }>) {
      const previous = state.automaticGuide.calls[action.payload.callId];
      state.automaticGuide.calls[action.payload.callId] = {
        callId: action.payload.callId,
        status: "running",
        attempts: (previous?.attempts || 0) + 1,
        lastTriggeredAt: action.payload.triggeredAt,
        lastCompletedAt: previous?.lastCompletedAt,
      };
      state.automaticGuide.lastCallId = action.payload.callId;
      state.userSnapshot.lastGuideCall = { ...state.automaticGuide.calls[action.payload.callId] };
      state.userSnapshot.timestamp = action.payload.triggeredAt;
    },
    automaticGuideCallSucceeded(state, action: PayloadAction<{ callId: string; completedAt: number }>) {
      const previous = state.automaticGuide.calls[action.payload.callId];
      state.automaticGuide.calls[action.payload.callId] = {
        callId: action.payload.callId,
        status: "succeeded",
        attempts: previous?.attempts || 1,
        lastTriggeredAt: previous?.lastTriggeredAt,
        lastCompletedAt: action.payload.completedAt,
      };
      if (state.automaticGuide.lastCallId === action.payload.callId) {
        state.userSnapshot.lastGuideCall = { ...state.automaticGuide.calls[action.payload.callId] };
        state.userSnapshot.timestamp = action.payload.completedAt;
      }
    },
    automaticGuideCallFailed(state, action: PayloadAction<{ callId: string; completedAt: number; error: string }>) {
      const previous = state.automaticGuide.calls[action.payload.callId];
      state.automaticGuide.calls[action.payload.callId] = {
        callId: action.payload.callId,
        status: "failed",
        attempts: previous?.attempts || 1,
        lastTriggeredAt: previous?.lastTriggeredAt,
        lastCompletedAt: action.payload.completedAt,
        lastError: action.payload.error.slice(0, 500),
      };
      if (state.automaticGuide.lastCallId === action.payload.callId) {
        state.userSnapshot.lastGuideCall = { ...state.automaticGuide.calls[action.payload.callId] };
        state.userSnapshot.timestamp = action.payload.completedAt;
      }
    },
    automaticGuideCallCancelled(state, action: PayloadAction<{ callId: string; completedAt: number }>) {
      const previous = state.automaticGuide.calls[action.payload.callId];
      state.automaticGuide.calls[action.payload.callId] = {
        callId: action.payload.callId,
        status: "cancelled",
        attempts: previous?.attempts || 1,
        lastTriggeredAt: previous?.lastTriggeredAt,
        lastCompletedAt: action.payload.completedAt,
      };
      if (state.automaticGuide.lastCallId === action.payload.callId) {
        state.userSnapshot.lastGuideCall = { ...state.automaticGuide.calls[action.payload.callId] };
        state.userSnapshot.timestamp = action.payload.completedAt;
      }
    },
    addBrainstormMemorySlot(state, action: PayloadAction<BrainstormMemorySlot>) {
      if (!state.memorySlots.some((slot) => slot.slotId === action.payload.slotId)) {
        state.memorySlots.push(action.payload);
      }
    },
    recordCreationAttemptStart(
      state,
      action: PayloadAction<{
        attemptId: string;
        projectId?: string;
        mediaKind: 'image' | 'video' | 'character';
        targetKey: string;
        startedAt?: number;
      }>,
    ) {
      const projectId = String(action.payload.projectId || state.userSnapshot.creation.projectId || 'active');
      const slotId = `${projectId}:${action.payload.mediaKind}:${action.payload.targetKey}`;
      const active = { ...(state.userSnapshot.creation.activeAttemptsByTarget || {}) };
      active[slotId] = {
        attemptId: action.payload.attemptId,
        projectId,
        mediaKind: action.payload.mediaKind,
        targetKey: action.payload.targetKey,
        startedAt: action.payload.startedAt ?? Date.now(),
      };
      state.userSnapshot.creation.activeAttemptsByTarget = active;
      if (state.userSnapshot.creation.confirmedFailuresByTarget?.[slotId]) {
        const nextFailures = { ...state.userSnapshot.creation.confirmedFailuresByTarget };
        delete nextFailures[slotId];
        state.userSnapshot.creation.confirmedFailuresByTarget = Object.keys(nextFailures).length ? nextFailures : undefined;
      }
      const remaining = Object.values(state.userSnapshot.creation.confirmedFailuresByTarget || {});
      if (action.payload.mediaKind === 'video') {
        if (!remaining.some(item => item.mediaKind === 'video')) state.userSnapshot.creation.videoError = undefined;
      } else if (!remaining.some(item => item.mediaKind !== 'video')) {
        state.userSnapshot.creation.imageError = undefined;
      }
      state.userSnapshot.timestamp = Date.now();
    },
    recordCreationAttemptSuccess(
      state,
      action: PayloadAction<{
        attemptId?: string;
        projectId?: string;
        mediaKind: 'image' | 'video' | 'character';
        targetKey: string;
      }>,
    ) {
      const projectId = String(action.payload.projectId || state.userSnapshot.creation.projectId || 'active');
      const slotId = `${projectId}:${action.payload.mediaKind}:${action.payload.targetKey}`;
      const currentClaim = state.userSnapshot.creation.activeAttemptsByTarget?.[slotId];
      if (action.payload.attemptId && currentClaim && currentClaim.attemptId !== action.payload.attemptId) return;
      if (currentClaim && state.userSnapshot.creation.activeAttemptsByTarget) {
        const nextActive = { ...state.userSnapshot.creation.activeAttemptsByTarget };
        delete nextActive[slotId];
        state.userSnapshot.creation.activeAttemptsByTarget = Object.keys(nextActive).length ? nextActive : undefined;
      }
      if (state.userSnapshot.creation.confirmedFailuresByTarget?.[slotId]) {
        const nextFailures = { ...state.userSnapshot.creation.confirmedFailuresByTarget };
        delete nextFailures[slotId];
        state.userSnapshot.creation.confirmedFailuresByTarget = Object.keys(nextFailures).length ? nextFailures : undefined;
      }
      const remaining = Object.values(state.userSnapshot.creation.confirmedFailuresByTarget || {});
      if (action.payload.mediaKind === 'video') {
        if (!remaining.some(item => item.mediaKind === 'video')) state.userSnapshot.creation.videoError = undefined;
      } else if (!remaining.some(item => item.mediaKind !== 'video')) {
        state.userSnapshot.creation.imageError = undefined;
      }
      state.userSnapshot.timestamp = Date.now();
    },
    recordCreationAttemptFailure(
      state,
      action: PayloadAction<{
        attemptId: string;
        failureId?: string;
        projectId?: string;
        mediaKind: 'image' | 'video' | 'character';
        targetKey: string;
        sceneNumber?: number;
        bShotNumber?: number;
        message: string;
        failedAt?: number;
      }>,
    ) {
      const projectId = String(action.payload.projectId || state.userSnapshot.creation.projectId || 'active');
      const slotId = `${projectId}:${action.payload.mediaKind}:${action.payload.targetKey}`;
      const currentClaim = state.userSnapshot.creation.activeAttemptsByTarget?.[slotId];
      // Only the owning attempt may record a confirmed failure; stale callbacks from superseded runs are ignored.
      if (!currentClaim || currentClaim.attemptId !== action.payload.attemptId) return;
      const nextActive = { ...(state.userSnapshot.creation.activeAttemptsByTarget || {}) };
      delete nextActive[slotId];
      state.userSnapshot.creation.activeAttemptsByTarget = Object.keys(nextActive).length ? nextActive : undefined;
      const failedAt = action.payload.failedAt ?? Date.now();
      const nextFailures = { ...(state.userSnapshot.creation.confirmedFailuresByTarget || {}) };
      nextFailures[slotId] = {
        attemptId: action.payload.attemptId,
        failureId: action.payload.failureId || `fail:${action.payload.attemptId}`,
        projectId,
        mediaKind: action.payload.mediaKind,
        targetKey: action.payload.targetKey,
        ...(typeof action.payload.sceneNumber === 'number' ? { sceneNumber: action.payload.sceneNumber } : {}),
        ...(typeof action.payload.bShotNumber === 'number' ? { bShotNumber: action.payload.bShotNumber } : {}),
        message: String(action.payload.message || '').slice(0, 300),
        failedAt,
      };
      state.userSnapshot.creation.confirmedFailuresByTarget = nextFailures;
      if (action.payload.mediaKind === 'video') {
        state.userSnapshot.creation.videoError = String(action.payload.message || '').slice(0, 300);
      } else {
        state.userSnapshot.creation.imageError = String(action.payload.message || '').slice(0, 300);
      }
      state.userSnapshot.timestamp = Date.now();
    },
    setBrainstormMemorySlots(state, action: PayloadAction<BrainstormMemorySlot[]>) {
      state.memorySlots = action.payload;
    },
    resetBrainstormSession(state) {
      state.chatHistory = [];
      state.memorySlots = [];
      state.userSnapshot.lastAction = null;
      state.userSnapshot.lastActions = [];
      state.userSnapshot.recentActions = [];
      if (state.userSnapshot.navigation) {
        state.userSnapshot.navigation.recentTransitions = [];
        state.userSnapshot.navigation.transitionSequence = 0;
      }
      state.userSnapshot.timestamp = Date.now();
    },
  },
});

export const {
  setBrainstormChatHistory,
  setBrainstormChatOpen,
  setBrainstormSelectedVoice,
  setBrainstormSessionIdentity,
  patchUserSnapshot,
  publishNavigationArea,
  publishFeedsArea,
  removeFeedsArea,
  publishCreationArea,
  removeCreationArea,
  removeNavigationArea,
  setNavigationAvailableActions,
  setFeedsAvailableActions,
  recordNavigationTransition,
  recordUserAction,
  appendBrainstormMessage,
  patchBrainstormMessage,
  setAutomaticGuideCallsEnabled,
  setAutomaticGuideCallEnabled,
  automaticGuideCallStarted,
  automaticGuideCallSucceeded,
  automaticGuideCallFailed,
  automaticGuideCallCancelled,
  addBrainstormMemorySlot,
  recordCreationAttemptStart,
  recordCreationAttemptSuccess,
  recordCreationAttemptFailure,
  setBrainstormMemorySlots,
  resetBrainstormSession,
} = brainstormSlice.actions;

export default brainstormSlice.reducer;
