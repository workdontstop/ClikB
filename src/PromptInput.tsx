import { OwnedCreationRequests, CreationWorkPaused } from './creationWorkOwnership';
import { createDraftController, type DraftController } from './creationDrafts/store';
import { consumePendingDraftEntry, registerActiveDraftController, replaceActiveDraftFromCloud, usePendingDraftEntry } from './creationDrafts/entry';
import { useDraftStatus } from './creationDrafts/useDraftStatus';
import { observeCreationDraft } from './creationDrafts/diagnostics';
import { usePersistedCreationState, captureCreationCache, setDraftVideoStage } from './creationDraftBindings';
import { buildDraftCreationMemory } from './creationProjectMemory';
import { creationValueRevision } from '../server/src/creationControlIdentity';
import { referenceEditEvidence, referenceMedia, generatedReferenceProvenance, upscaledReferenceProvenance } from './creationReferenceEvidence';
import { appAccentButtonSx } from './appAccentStyles';
import SpatialNotice from './components/SpatialNotice';
import { subscribeSpatialDocuments } from './spatialWorldClient';
// PromptInput.tsx

import React, { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { creationBinding as cb } from './creationControlSnapshot';
import { useCreationControls } from './useCreationControls';
import { createPromptInputHistoryOwner, usePromptInputHistory } from './usePromptInputHistory';
import './creationGlass.css';
import { ReferenceRenderClaims, runReferenceWorkers, preserveOwnedReferences } from './referenceRenderQueue';
import CharacterImageControls from './components/CharacterImageControls';
import {
  applyReferenceImageReplacement,
  getReferenceGenerationInput,
  getReferenceGenerationRoute,
  getReferenceImageGenerationMode,
  type ReferenceImageGenerationMode,
} from './characterReferenceEditing';
import { imageBlobToPng } from './imageBlobConversion';
import { isHttpMediaUrl, storedImageReceipt, type StoredImageMedia } from './completedMediaLifecycle';
import TextField from "@mui/material/TextField";
import { Button, Box, Menu, MenuItem, Typography, CircularProgress, IconButton, Modal, Avatar, Tooltip } from "@mui/material";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import { alpha, darken } from "@mui/material/styles";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import CloseIcon from "@mui/icons-material/Close"; // Import CloseIcon
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CancelIcon from '@mui/icons-material/Cancel';
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewCarouselOutlinedIcon from '@mui/icons-material/ViewCarouselOutlined';
import ForumIcon from "@mui/icons-material/Forum";
import CancelPresentationIcon from "@mui/icons-material/CancelPresentation";
import PersonIcon from '@mui/icons-material/Person';
import LandscapeIcon from '@mui/icons-material/Landscape';
import CategoryIcon from '@mui/icons-material/Category';  ///casting complete

import { cycleAspectRatio, cycleAspectRatio3, cycleAspectRatio2, toggleDarkMode, setPixels, setAspectRatio } from './settingsSlice'; // <-- adjust path
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import RefreshIcon from '@mui/icons-material/Refresh';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';

import PlanSteps from "./PlanSteps"; // adjust path to match your project



import { useSelector, useDispatch } from "react-redux";
import { setArtstyle, setModel, setPromptRed, setImageModelPreview, setCreationConfirmationOpen, setCreationSelectionDialogOpen } from "./settingsSlice";
import { LANGUAGE_MODELS } from "./languageModels";
import { RootState, AppDispatch } from "./store";
import {
  patchUserSnapshot,
  recordCreationAttemptStart,
  recordCreationAttemptSuccess,
  recordCreationAttemptFailure,
} from "./brainstormSlice";
import { useBrainstormSession } from "./components/BrainstormSessionProvider";
import { chunkCreationMemoryText, createCreationProjectId, renderCreationMemorySections } from "./creationMemory";
import {
  AUTOMATIC_GUIDE_CALLS,
} from "./automaticGuideCalls";


////helperimagesprompt



import WorldModel from './WorldModel';


import { Saveprompthelperfordellater, RemoveFromDeleteLater } from "./SavepromptHelpersLocal";

import { setLogin } from "./settingsSlice";
import { dismissAppIntro } from "./settingsSlice";

import { calcModelPixels } from "./ModelPixels";   // adjust path
import {
  DEFAULT_IMAGE_MODEL,
  getGptImageRoute,
  getImageModelDisplayName,
  getCreationImageModelName,
  isGptImageModel,
} from "./imageModels";

const PROMPTINPUT_CHARACTER_LINK_MODE = true;

import AspectRatioBox from './AspectRatioBox'

import { useParams, useLocation, useNavigate } from "react-router-dom"; // <-- Import useParams he
import LockIcon from '@mui/icons-material/Lock';

import PingLoader from './ping';
import { matchPc, matchTablet } from "./DetectDevice";
import ImageIcon from '@mui/icons-material/Image';

import GradientIcon from '@mui/icons-material/Gradient';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';

import EditIcon from '@mui/icons-material/Edit';

import UploadIcon from '@mui/icons-material/Upload';
import PublicIcon from '@mui/icons-material/Public';
import axios from "axios"; // Import Axios

import ModelPixels from './ModelPixels'

import EditStory from "./EditStory";

import Storybook, { type CreationImaginationProgress } from './Storybook';
import CreationDeck, { useCreationDeckEnabled, type CreationDeckCard } from './CreationDeck';

///const [VideMode, setVideMode] = useState(false);

import ModelSelectionModal, { ModelData } from './ModelSelectionModal';
import { inheritImageResultModel, recordGeneratedImageModel } from './imageResultProvenance';
import { imageModelForGenerationRoute } from './imageModels';
import PromptToolbar from './PromptToolbar';
import PromptWelcomeUI, { PROMPT_LANDING_CONTENT_WIDTH } from './PromptWelcomeUI';
import PromptIntroUI from './PromptIntroUI';

import CheckIcon from '@mui/icons-material/Check';
///localhost

import TitleSelector from "./TitleSelector"; // path to the file

import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Scale } from "@mui/icons-material";
import AudioNarration from "./AudioNarration";

import { keyframes } from "@emotion/react";

import Notepad from "./Notepad";
import AudioPicker from "./AudioPicker";
import type { ImageGenCache } from "./components/PromptConstructor";
import { TemplateLibrary, type TemplateLibraryHandle } from "./components/TemplateGallery";
import type { ShowcaseMode, Template } from "./PromptConstructorMock";
import type { AutoDrawGuideData, AutoDrawGuideMode } from "./AutoDrawGuide";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import ManualCharacterDialog from "./ManualCharacterDialog";
import {
  prepareManualCharacterImage,
  type ManualCharacterInput,
  type PreparedManualCharacterImage,
} from "./manualCharacterImage";
import { getWorldCharacterImagePrompt, getWorldCharacterPersonality } from './worldCharacterDescription';
import { useCreationReferenceDraft } from "./CreationReferenceDraftContext";
import { getCreationStageInfo, type CreationStageInfo } from "./creationStage";
import type { SpatialMotionContext, SpatialManifest, SpatialSceneState } from "./spatialStageModel";
import type { InteractionExperienceMode } from "./interactionExperienceMode";
import {
  CreationLedgerContext,
  type CreationLedgerEntry,
  subscribeToCreationLedger,
} from "./CreationLedgerContext";

type ReferenceImageItem = {
  clientReferenceId?: string;
  name: string;
  type: string;
  imageUrl: string;
  prompt: string;
  originalPrompt?: string;
  isGenerating?: boolean;
  isUploading?: boolean;
  hasManualImage?: boolean;
  imageGenerationMode?: ReferenceImageGenerationMode;
  assetKind?: 'character' | 'environment' | 'object';
  [key: string]: any;
};

/**
 * Interactions mode (type 3) always ships an interface, so the casting audit is
 * told to guarantee exactly one UI look reference. It is deliberately vague about
 * naming: the model names and describes it in the script's own wording, the same
 * way it does for characters, so nothing about the UI is defined here in code.
 *
 * This rides the audit pass rather than the first pass because the audit already
 * receives the first-pass result and returns the full corrected set, so a UI look
 * added here comes back alongside everything else with no merge step.
 */
const UI_LOOK_AUDIT_CLAUSE =
  "This script is interactive game content, which always presents through an on-screen interface. " +
  "In addition to the usual audit, make sure the returned characters contain exactly one UI look reference " +
  "covering the interface style: HUD, menus, panels, buttons, and how text is presented. " +
  "If such a reference is already present, keep it exactly as it is and do not add another. " +
  "If none is present, derive one from the script and return it as a character entry. " +
  "NAME IT AFTER ITS VISUAL TREATMENT, never after a screen, a moment, a menu, or a game state: " +
  "names such as 'Start Race Interface', 'Game Over Screen', 'Pause Menu' or 'Results Screen' are wrong, " +
  "because this one reference is reused by every scene and is not tied to any single screen. " +
  "Build the name from the script's own visual wording for the interface - its colors, glow, materials and " +
  "typography - for example 'Neon Blue Racing HUD' or 'Amber Chrome Overlay'. " +
  "Describe the persistent style every scene reuses: colors, glow, shapes, materials, typography and recurring " +
  "readouts. Do not describe one specific screen, and do not specify literal button wording or on-screen text, " +
  "so the look carries across scenes without baking a single screen's content into every shot.";

const normalizeReferenceName = (value: unknown): string =>
  String(value || "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^(the|an|a)\s+/, "");

const referenceNamesMatch = (left: unknown, right: unknown): boolean => {
  const a = normalizeReferenceName(left);
  const b = normalizeReferenceName(right);
  if (!(a && b)) return false;
  if (
    a === b ||
    a.startsWith(b + " ") ||
    b.startsWith(a + " ") ||
    a.endsWith(" " + b) ||
    b.endsWith(" " + a)
  ) return true;
  // Core-name match: "Kyro (face from input image)" should equal
  // "Kyro (young man, ...) FROM MY INPUT IMAGE" - compare the part before the parenthetical.
  const coreA = normalizeReferenceName(String(left || "").split("(")[0]);
  const coreB = normalizeReferenceName(String(right || "").split("(")[0]);
  return Boolean(coreA && coreB && coreA === coreB);
};

// Exact name match always wins; fuzzy (core-name) match is only a fallback.
// This keeps distinct characters like "Guard (tall)" / "Guard (short)" from mixing.
const findRefByName = <T extends { name?: any }>(list: T[], name: any): T | undefined => {
  const exact = list.find((r) => r?.name === name);
  return exact !== undefined ? exact : list.find((r) => referenceNamesMatch(r?.name, name));
};
const findRefIndexByName = (list: any[], name: any): number => {
  const exact = list.findIndex((r) => r?.name === name);
  return exact !== -1 ? exact : list.findIndex((r) => referenceNamesMatch(r?.name, name));
};

const getUsableReferenceImage = (reference: any): string =>
  String(
    reference?.imageUrl ||
    reference?.url ||
    reference?.image ||
    reference?.vipSourceImageUrl ||
    reference?.sourceImageUrl ||
    reference?.inputImageUrl ||
    ""
  ).trim();

const isReferenceWorking = (reference: any): boolean =>
  Boolean(reference?.isGenerating || reference?.isUpscaling || reference?.isUploading);

const referenceNeedsImage = (reference: any): boolean =>
  !isReferenceWorking(reference) && (
    !getUsableReferenceImage(reference) ||
    (reference?.isVip === true && !reference?.hasManualImage && !String(reference?.prompt || '').trim())
  );

function mergeNamedEntities<T extends { name?: string }>(
  existing: T[],
  incoming: T[]
): T[] {
  const merged = [...existing];
  for (const candidate of incoming) {
    if (!candidate?.name) continue;
    if (merged.some((item) => referenceNamesMatch(item?.name, candidate.name))) {
      continue;
    }
    merged.push(candidate);
  }
  return merged;
}

const createVipReferenceItem = (vip: any): ReferenceImageItem | null => {
  const name = String(vip?.name || "").trim();
  const imageUrl = String(vip?.imageUrl || "").trim();
  if (!name || !imageUrl) return null;

  return {
    name,
    type: vip?.assetKind === 'environment' ? 'environment' : 'character',
    assetKind: vip?.assetKind,
    imageUrl,
    url: imageUrl,
    image: imageUrl,
    prompt: '',
    originalPrompt: '',
    description: vip?.description || 'VIP identity from uploaded input image',
    isGenerating: false,
    isVip: true,
    source: vip?.source || 'upload',
    vipSourceImageUrl: imageUrl
  };
};
import Mirror from "./Mirror";
import { matchMobile } from "./DetectDevice";
import { useDeckRuntime } from './DeckRuntimeContext';


// Define your CLIK_URL here or import it if it's defined elsewhere caption Delete
const CLIK_URL = import.meta.env.VITE_CLIK_URL;
const VITE_HUGG = import.meta.env.VITE_HUGG;
const APP_STATE = import.meta.env.VITE_APPX_STATE;


const PromptInputSession: React.FC<any> = React.memo(({ draftEntry, onDraftSessionClosed, promptHistoryOwner, isMenuOpen, setcallFeeds, setAllowPing, AllowPing, minimisePrompt, setminimisePrompt, type, callFeeds, setFluxLoaded,
  fluxLoaded,
  isSubmittingKick,
  setIsSubmittingKick,
  setIsSubmitting,
  isSubmitting,
  IsMobileBackActive,
  setIsMobileBackActive,
  clikt,
  setclikt,
  setHideBottom,
  setstopFeeds,
  stopFeeds,
  magicMode,
  setType,
  genCache: externalGenCache,
  setGenCache: externalSetGenCache,
  instantCall,
  setinstantCall,
  handleLoginSuccess,
  handleLoginError,
  showcaseTemplates = [],
  onShowcaseTemplatesChanged,
  templateLibrary = [],
  hasMoreTemplates = true,
  ensureTemplateLibraryLoaded,
  loadMoreTemplates,
  onTemplateLibraryChanged,
}) => {
  const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
  const [creationDraft] = useState<DraftController | undefined>(() => draftEntry?.controller || (loggedUser?.id && [0, 1, 3].includes(Number(type))
    ? createDraftController({ accountId: loggedUser.id, creationProjectId: createCreationProjectId(), creationType: Number(type) as 0 | 1 | 3, baseUrl: CLIK_URL }) : undefined));
  const draftStatus = useDraftStatus(creationDraft);
  const draftImageSaveRef = useRef<(() => Promise<void>) | null>(null);
  const registerDraftImageSave = useCallback((save: (() => Promise<void>) | null) => {
    draftImageSaveRef.current = save;
  }, []);
  const draftSeed = useRef(creationDraft?.section<any>('prompt') || {}).current;
  const [draftHydrated, setDraftHydrated] = useState(!draftEntry);
  useEffect(() => {
    if (!creationDraft || !draftStatus.conflicted || !draftStatus.postId || !draftStatus.draftId) return;
    replaceActiveDraftFromCloud(creationDraft.accountId, { postId: draftStatus.postId, draftId: draftStatus.draftId,
      revision: draftStatus.revision, digest: draftStatus.digest, snapshot: draftStatus.snapshot, published: false }, CLIK_URL);
  }, [creationDraft, draftStatus.conflicted]);
  const {
    generatedImages: GeneratedImage,
    setGeneratedImages: setGeneratedImage,
    vipCharacters: Vipcharacters,
    setVipCharacters: setVipcharacters,
    remixData,
    setRemixData,
    worldCover,
    setWorldCover,
    worldStyle,
    setWorldStyle,
    selectedWorldId,
    setSelectedWorldId,
    clearCreationReferences,
  } = useCreationReferenceDraft();


  const VITE_REPLI_KEY = import.meta.env.VITE_REPLI_KEY;
  const artstyleRedux = useSelector((state: RootState) => state.settings.artstyle);
  const modelRedux = useSelector((state: RootState) => state.settings.model);
  const promptRedux = useSelector((state: RootState) => state.settings.prompt);
  const [prompt, setPrompt] = usePersistedCreationState<string>(creationDraft, 'prompt', 'prompt', promptRedux);
  const [creationProjectId, setCreationProjectId] = useState(creationDraft?.creationProjectId || "");
  // Project-owned creation voiceover, separate from Concierge speech/TTS.
  const [cinemaNarrationEnabled, setCinemaNarrationEnabled] = usePersistedCreationState(creationDraft, 'prompt', 'cinemaNarrationEnabled', false);
  const [narrationPreparedFor, setNarrationPreparedFor] = usePersistedCreationState(creationDraft, 'prompt', 'narrationPreparedFor', '');
  const [narrationSummaryError, setNarrationSummaryError] = useState<{ key: string; message: string } | null>(null);
  const [narrationSummaryRetry, setNarrationSummaryRetry] = useState(0);
  const narrationSummaryRequests = useRef(new OwnedCreationRequests<string[]>());
  const failedNarrationSummaries = useRef(new Map<string, string>());
  const [error, setError] = useState<string>("");
  // Temporary JSON ledger for only the creation currently open in PromptInput.
  // It is intentionally not persisted to Redux, localStorage, or the database.
  const [creationLedgerEntries, setCreationLedgerEntries] = useState<CreationLedgerEntry[]>([]);
  const resetCreationLedger = useCallback(() => setCreationLedgerEntries([]), []);
  const actualSubmitRef = useRef<(() => void) | null>(null);
  const submitInFlightRef = useRef(false);

  useEffect(() => subscribeToCreationLedger((entry) => {
    setCreationLedgerEntries((current) => {
      const withoutDuplicate = current.filter((item) => item.requestId !== entry.requestId);
      return [entry, ...withoutDuplicate].slice(0, 160);
    });
  }), []);

  const [isMirrorFocused, setIsMirrorFocused] = useState<boolean>(magicMode || false);

  useEffect(() => {
    setIsMirrorFocused(magicMode || false);
  }, [magicMode]);

  const [planEditText, setPlanEditText] = usePersistedCreationState(creationDraft, 'prompt', 'planEditText', "");
  const [isPlanEditSubmitting, setIsPlanEditSubmitting] = useState(false);

  const [internalGenCache, setInternalGenCache] = usePersistedCreationState<ImageGenCache | undefined>(creationDraft, 'prompt', 'internalGenCache', undefined);
  const genCache = externalGenCache || internalGenCache;
  const setGenCache = externalSetGenCache || setInternalGenCache;

  const [expandedScene, setExpandedScene] = useState<boolean>(false);

  const [IsColdStart, setIsColdStart] = useState<boolean>(false); // Optional: To handle cold start state
  const [StopText, setStopText] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  // const { routeScrollPos, routelastId, userId } = location.state || {};

  const [isStandaloneTemplatesOpen, setIsStandaloneTemplatesOpen] = useState(false);
  const templateGalleryRef = useRef<TemplateLibraryHandle | null>(null);

  const dispatch = useDispatch();
  const [isAskingAiForPrompt, setIsAskingAiForPrompt] = useState(false);
  const handleShowcaseTemplateSelect = useCallback((template: Template) => {
    setPrompt(template.basePrompt);
    if (template.artStyle) dispatch(setArtstyle(template.artStyle));
    setIsStandaloneTemplatesOpen(false);
  }, [dispatch]);

  const handleOpenStandaloneTemplates = useCallback(() => {
    void ensureTemplateLibraryLoaded?.();
    setIsStandaloneTemplatesOpen(true);
  }, [ensureTemplateLibraryLoaded]);

  const handleStandaloneDeleteTemplate = useCallback(async (template: Template) => {
    const isDev = Boolean(import.meta.env.DEV);
    const isOwner = Boolean(loggedUser && Number(loggedUser.id) !== 1 && Number(template.userId) === Number(loggedUser.id));
    if (!isDev && !isOwner) return;
    try {
      await axios.post(`${CLIK_URL}/delete_template_prompt`, { id: template.id, userid: loggedUser?.id || 1 }, { withCredentials: true });
      await onTemplateLibraryChanged?.();
      await ensureTemplateLibraryLoaded?.();
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  }, [loggedUser, onTemplateLibraryChanged, ensureTemplateLibraryLoaded]);

  const handleStandaloneToggleShowcase = useCallback(async (template: Template, mode: ShowcaseMode) => {
    if (!import.meta.env.DEV) return;
    const useForShowcase = !(Number(template.showcaseOrders?.[mode]) > 0);
    await axios.post(
      `${CLIK_URL}/update_template_showcase`,
      { id: template.id, mode, useforshowcase: useForShowcase },
      { withCredentials: true },
    );
    await onTemplateLibraryChanged?.();
    await Promise.all([
      ensureTemplateLibraryLoaded?.(),
      onShowcaseTemplatesChanged?.(),
    ]);
  }, [ensureTemplateLibraryLoaded, onShowcaseTemplatesChanged, onTemplateLibraryChanged]);

  const handleAskAiForPrompt = useCallback(async () => {
    const mode = type === 0 ? "shorts" : type === 3 ? "games" : type === 1 ? "cinema" : null;
    if (!mode || isAskingAiForPrompt) return;

    setIsAskingAiForPrompt(true);
    setError("");
    try {
      const templateExamples = (showcaseTemplates as Template[]).slice(0, 8).map((template) => ({
        name: template.name,
        prompt: template.basePrompt,
      }));
      const response = await axios.post<any>(
        `${CLIK_URL}/examplestory`,
        { mode, templates: templateExamples },
        { withCredentials: true },
      );
      const generatedPrompt = response.data?.initialSteps?.keyPoints?.[0];
      if (typeof generatedPrompt !== "string" || !generatedPrompt.trim()) {
        throw new Error("AI returned an empty prompt.");
      }
      setPrompt(generatedPrompt.trim());
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message
          || requestError?.message
          || "Could not create a prompt. Please try again.",
      );
    } finally {
      setIsAskingAiForPrompt(false);
    }
  }, [isAskingAiForPrompt, showcaseTemplates, type]);
  const {
    syncCreationMemoryCards,
    creationMemoryUnsyncedCardKeys,
    runAutomaticGuideCall,
    cancelAutomaticGuideCall,
    guideEnabled,
  } = useBrainstormSession();

  /**
   * APP INTRO - the toolbar strip shows the app name instead of its controls.
   *
   * Nothing about PromptToolbar changes for this: `landingToolbarContent` is a
   * prop, so the intro is a straight content swap into the slot the landing
   * toolbar already owns. It leaves on the first pointer-down anywhere in the
   * composer (handled on the root Box below, which contains PromptToolbar) or
   * on the 10s fallback timer PromptIntroUI runs for itself.
   */
  const appIntroActive = useSelector((state: RootState) => state.settings.appIntroActive);

  const pixelsRedux = useSelector((state: RootState) => state.settings.pixels);
  const languageModel = useSelector((state: RootState) => state.settings.languageModel);
  const creationConfirmationOpen = useSelector((state: RootState) => state.settings.creationConfirmationOpen);
  const { setConfirmationDockHost } = useDeckRuntime();
  const imageModelPreview = useSelector((state: RootState) => state.settings.imageModelPreview);
  const artstylePreview = useSelector((state: RootState) => state.settings.artstylePreview);
  const autoControlEnabled = useSelector((state: RootState) => state.settings.autoControlEnabled);
  const autoControlVisible = useSelector((state: RootState) => state.settings.autoControlVisible);
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false);

  ///startDelete(GeneratedImage);
  const [promptx, setPromptx] = usePersistedCreationState<string>(creationDraft, 'prompt', 'promptx', "");

  ///seed


  const [planInfo, setPlanInfo] = useState(0);

  const [Seed, setSeed] = usePersistedCreationState<number>(creationDraft, 'prompt', 'Seed', 100);

  const [big, setBig] = useState(false);

  const [narrate, setnarrate] = useState(false);


  const [flip, setflip] = useState(false);

  // Long-form master prompts commonly include detailed continuity, wardrobe,
  // and per-scene instructions. Keep enough room for those documents instead
  // of showing a false over-limit state after a successful paste.
  const maxCharacters = 30000;


  const [TextFieldactive, setTextFieldactive] = useState(false);

  const [VideMode, setVideMode] = useState(false);
  setDraftVideoStage(creationDraft, VideMode);
  const [interactionExperienceMode, setInteractionExperienceMode] = usePersistedCreationState<InteractionExperienceMode | null>(creationDraft, 'prompt', 'interactionExperienceMode', null);
  const [showInteractionExperienceChoice, setShowInteractionExperienceChoice] = useState(false);
  const [promptMusicPickerOpen, setPromptMusicPickerOpen] = useState(false);
  const [promptMusicMode, setPromptMusicMode] = usePersistedCreationState(creationDraft, 'prompt', 'promptMusicMode', true);
  const [promptMusicUrl, setPromptMusicUrl] = usePersistedCreationState(creationDraft, 'prompt', 'promptMusicUrl', "");
  const [promptMusicName, setPromptMusicName] = usePersistedCreationState(creationDraft, 'prompt', 'promptMusicName', "");
  // Music-video scene creation is driven by song length ÷ (breaker × 2).
  // Default the breaker to 5s so scenes start short by default.
  const [promptMusicBreakerSec, setPromptMusicBreakerSec] = usePersistedCreationState<5 | 10>(creationDraft, 'prompt', 'promptMusicBreakerSec', 5);
  const [promptMusicDurationSec, setPromptMusicDurationSec] = usePersistedCreationState(creationDraft, 'prompt', 'promptMusicDurationSec', 0);
  const [promptMusicSceneCount, setPromptMusicSceneCount] = usePersistedCreationState(creationDraft, 'prompt', 'promptMusicSceneCount', 9);
  const [promptMusicSegments, setPromptMusicSegments] = usePersistedCreationState<{ index: number; start: number; end: number }[]>(creationDraft, 'prompt', 'promptMusicSegments', []);

  // Music-video scene maths must NOT depend on the Notepad editor being opened.
  // The editor is unmounted while closed, so if the user picks a song and hits
  // Enter straight away, its callbacks never fire and the story would be asked
  // for the default 9 scenes with no timing segments. We measure the song and
  // derive scenes/segments here; the editor stays a viewer/confirmer.
  useEffect(() => {
    const url = String(promptMusicUrl || "").trim();
    if (!url) return;
    if (promptMusicDurationSec > 0) return;

    let cancelled = false;
    const probe = new Audio();
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      if (cancelled) return;
      if (Number.isFinite(probe.duration) && probe.duration > 0) {
        setPromptMusicDurationSec(probe.duration);
      }
    };
    probe.src = url;
    return () => { cancelled = true; probe.src = ""; };
  }, [promptMusicUrl, promptMusicDurationSec]);

  useEffect(() => {
    const isMusicVideo = Boolean(promptMusicUrl) && type === 1;
    if (!isMusicVideo) {
      setPromptMusicSegments([]);
      return;
    }

    // One scene = stage A + stage B, each `breaker` seconds long.
    const sceneDurationSec = promptMusicBreakerSec * 2;
    const sceneCount = promptMusicDurationSec > 0
      ? Math.max(1, Math.min(9, Math.ceil(promptMusicDurationSec / sceneDurationSec)))
      : 1;

    setPromptMusicSceneCount(sceneCount);
    setPromptMusicSegments(Array.from({ length: sceneCount }, (_, index) => {
      const start = index * sceneDurationSec;
      const end = promptMusicDurationSec > 0
        ? Math.min(promptMusicDurationSec, start + sceneDurationSec)
        : start + sceneDurationSec;
      return { index, start, end };
    }));
  }, [promptMusicUrl, type, promptMusicBreakerSec, promptMusicDurationSec]);

  const resetPromptMusicState = () => {
    setPromptMusicPickerOpen(false);
    setPromptMusicMode(true);
    setPromptMusicUrl("");
    setPromptMusicName("");
    setPromptMusicBreakerSec(10);
    setPromptMusicDurationSec(0);
    setPromptMusicSceneCount(9);
    setPromptMusicSegments([]);
  };


  const [base, setbase] = useState<string[]>([]);
  const [startEdit, setstartEdit] = useState(false);


  const [parsedKeyPoints, setParsedKeyPoints] = usePersistedCreationState<string[]>(creationDraft, 'prompt', 'parsedKeyPoints', []);
  const [parsedKeyPointsx, setParsedKeyPointsx] = usePersistedCreationState<string[]>(creationDraft, 'prompt', 'parsedKeyPointsx', []);
  const [parsedKeyPointsb, setParsedKeyPointsb] = usePersistedCreationState<string[]>(creationDraft, 'prompt', 'parsedKeyPointsb', []);
  const [doubleCheckResult, setDoubleCheckResult] = useState(false);
  const [showPathChoiceOverlay, setShowPathChoiceOverlay] = useState<boolean>(Boolean(draftEntry && draftSeed.parsedKeyPoints?.length));
  const [creationProgressRunKey, setCreationProgressRunKey] = useState<number | null>(null);
  const creationProgressReportedRef = useRef<{ runKey: number | null; milestones: Set<string> }>({ runKey: null, milestones: new Set() });
  const creationProgressBusyRef = useRef(false);
  const creationMemoryPartCountsRef = useRef<Map<string, number>>(new Map());
  const creationMemorySceneIntentCountsRef = useRef<Map<string, number>>(new Map());
  const finalCreationReviewStartedAtRef = useRef<number | null>(null);
  const finalCreationReviewSentRef = useRef(false);


  const [Planx, setPlanx] = usePersistedCreationState<any>(creationDraft, 'prompt', 'Planx', null);
  // What the intent engine understood, lifted up from Storybook so the plan
  // editor can show it beside its own textfield.
  const [intentOverview, setIntentOverview] = usePersistedCreationState<{
    title: string;
    overview: string;
    scenes: { label: string; text: string }[];
  } | null>(creationDraft, 'prompt', 'intentOverview', null);
  const [showIntentPanel, setShowIntentPanel] = useState(false);
  const characterListAuditCallId = AUTOMATIC_GUIDE_CALLS.CHARACTER_LIST_AUDIT.id;
  const sceneDoubleCheckCallId = AUTOMATIC_GUIDE_CALLS.SCENE_GENERATION_DOUBLE_CHECK.id;
  const creationProgressCallId = 'creation-progress';

  useEffect(() => {
    if (!doubleCheckResult) return;

    if (!showPathChoiceOverlay) return;
    const sceneSummaries = parsedKeyPoints.slice(0, 8).map((scene, index) => ({
      scene: index + 1,
      brief: String(scene || '').trim().slice(0, 140),
      intent: String(intentOverview?.scenes?.[index]?.text || '').trim().slice(0, 140),
    }));
    if (magicMode || sceneSummaries.length === 0) {
      setDoubleCheckResult(false);
      return;
    }

    if (finalCreationReviewStartedAtRef.current === null) finalCreationReviewStartedAtRef.current = Date.now();
    const memoryStillSyncing = creationMemoryUnsyncedCardKeys.some((key) =>
      key.startsWith(`project:${creationProjectId}:`));
    const elapsed = Date.now() - finalCreationReviewStartedAtRef.current;
    const delay = memoryStillSyncing ? Math.max(0, 8000 - elapsed) : 800;

    // The project canon contains the full request, plan and per-scene detail.
    // This short fallback covers an eventual-memory-sync delay without replaying all source text.
    const timer = window.setTimeout(() => {
      setDoubleCheckResult(false);
      finalCreationReviewStartedAtRef.current = null;
      if (finalCreationReviewSentRef.current) return;
      finalCreationReviewSentRef.current = true;
      void runAutomaticGuideCall({
        callId: sceneDoubleCheckCallId,
        message: `The ${parsedKeyPoints.length} generated scenes are ready at the Skip / Create Characters choice. Review the original request, generation plan, creation intent and scene summaries in current project memory; these first-eight summaries are fallback only: ${JSON.stringify(sceneSummaries)}. Give a brief overview of what was created and flag only the most important mismatch, if any. This review is observation only, not a new user instruction or a change to the active task. Preserve the user's requested Skip or character workflow and any stop-before-publishing boundary; do not operate controls in this review.`,
        runOncePerReload: AUTOMATIC_GUIDE_CALLS.SCENE_GENERATION_DOUBLE_CHECK.runOncePerReload,
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [
    doubleCheckResult,
    creationMemoryUnsyncedCardKeys,
    creationProjectId,
    magicMode,
    parsedKeyPoints,
    intentOverview,
    runAutomaticGuideCall,
    sceneDoubleCheckCallId,
    showPathChoiceOverlay,
  ]);

  useEffect(() => () => {
    cancelAutomaticGuideCall(sceneDoubleCheckCallId);
  }, [cancelAutomaticGuideCall, sceneDoubleCheckCallId]);

  useEffect(() => () => {
    cancelAutomaticGuideCall(creationProgressCallId);
  }, [cancelAutomaticGuideCall, creationProgressCallId]);

  useEffect(() => () => {
    cancelAutomaticGuideCall(characterListAuditCallId);
  }, [cancelAutomaticGuideCall, characterListAuditCallId]);


  const [allowSpin, setallowSpin] = useState<any>(false);

  const [DummyMode, setDummyMode] = useState<any>(false);



  // Redux selector for dark mode countdown

  const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
  const darkMode = darkModeReducer;
  const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
  const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
  const appColor = (darkModeReducer ? appColorDark : appColorLight)
    || (darkModeReducer ? "#E8BAFA" : "#0099cc");

  // --- Dynamic Button Theme (holds button bg/text + hover bg/text per mode) ---
  type ButtonTheme = {
    bg: string;
    text: string;
    hoverBg: string;
    hoverText: string;
  };

  const makeButtonTheme = (dark: boolean): ButtonTheme => ({
    bg: dark ? "rgba(10, 10, 10, 0.45)" : "rgba(255, 255, 255, 0.94)",
    text: dark ? "#ffffff" : "#000000",
    hoverBg: dark ? "rgba(15, 15, 15, 0.65)" : "rgba(255, 255, 255, 0.98)",
    hoverText: dark ? "#ffffff" : "#000000",
  });

  const [buttonTheme, setButtonTheme] = useState<ButtonTheme>(() => makeButtonTheme(darkMode));

  // Keep the button theme in sync whenever dark/light mode changes
  useEffect(() => {
    setButtonTheme(makeButtonTheme(darkMode));
  }, [darkMode]);


  const ratioKey = useSelector((s: RootState) => s.settings.aspectRatio);

  // The pre-submit countdown was replaced by the explicit confirmation step.
  const isBlinking = false;

  // --- Scene Popup Modal ---
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number | null>(null);
  const [nanoImages, setNanoImages] = usePersistedCreationState<string[]>(creationDraft, 'prompt', 'nanoImages', []);

  // --- Concept Generation Studio Modal ---
  /**
   * Lifted out of PromptToolbar: in the compact pill the STYLES trigger is
   * rendered down in the bottom action row (Slot C), so the modal it opens has to
   * be controlled from here. PromptToolbar still owns the modal itself.
   */
  const [styleModalOpen, setStyleModalOpen] = useState<boolean>(false);
  // Edit-Go loading presentation: frozen snapshot of preview images while new plan loads
  const [editGenSnapshot, setEditGenSnapshot] = useState<string[] | null>(null);
  useEffect(() => {
    if (!editGenSnapshot) return;
    const t = window.setTimeout(() => setEditGenSnapshot(null), 120000); // safety: never stuck blinking
    return () => window.clearTimeout(t);
  }, [editGenSnapshot]);
  const [expandedChoiceScene, setExpandedChoiceScene] = useState<number>(0);
  const [showStudioModal, setShowStudioModal] = useState<boolean>(false);
  const [isRevisitingCharacter, setIsRevisitingCharacter] = useState<boolean>(false);
  const isRevisitingCharacterRef = useRef(false);
  const [showConfirmClose, setShowConfirmClose] = useState<boolean>(false);
  const [pendingReferenceRemoval, setPendingReferenceRemoval] = useState<{
    name: string;
    type: string;
  } | null>(null);
  const [castingInstruction, setCastingInstruction] = usePersistedCreationState<string>(creationDraft, 'prompt', 'castingInstruction', "");
  const [castingStatus, setCastingStatus] = useState<string>("");
  const [detectedCharacters, setDetectedCharacters] = usePersistedCreationState<any[]>(creationDraft, 'prompt', 'detectedCharacters', []);
  const [detectedEnvironments, setDetectedEnvironments] = usePersistedCreationState<any[]>(creationDraft, 'prompt', 'detectedEnvironments', []);

  // --- Pricing & Auto-Proceed Studio Button ---
  const [skipCountdown, setSkipCountdown] = useState<number | null>(null);
  const [autoSkipPending, setAutoSkipPending] = useState(false);
  const [studioButtonStage, setStudioButtonStage] = useState<'hidden' | 'generating' | 'pre-broke' | 'post-countdown' | 'post-continue'>('hidden');
  const [studioActionTimer, setStudioActionTimer] = useState<number | null>(null);
  const [studioActionCost, setStudioActionCost] = useState<number>(0);
  const [availablePixels, setAvailablePixels] = useState<number>(0);
  const [queuedCastingPrompts, setQueuedCastingPrompts] = useState<any[]>([]);
  // --- Reference Image Generation ---
  const [referenceImages, setReferenceImages] = usePersistedCreationState<ReferenceImageItem[]>(creationDraft, 'prompt', 'referenceImages', []);
  const referenceImagesRef = useRef<ReferenceImageItem[]>([]);
  const nextReferenceClientIdRef = useRef(0);
  const activeReferenceEditKeyRef = useRef<string | null>(null);
  const referenceUploadInputRef = useRef<HTMLInputElement>(null);
  const referenceUploadTargetKeyRef = useRef<string | null>(null);
  const referencePromptDraftsRef = useRef<Map<string, string>>(new Map());
  const referenceAiLoadingKeysRef = useRef<Set<string>>(new Set());
  const referenceAiRequestSequenceRef = useRef(0);
  const latestReferenceAiRequestRef = useRef<Map<string, number>>(new Map());
  const manualVipRenderClaimsRef = useRef<Map<string, { pending: Set<number>; completed: boolean }>>(new Map());
  const manualVipRenderSequenceRef = useRef(0);
  const referenceRenderClaims = useRef(new ReferenceRenderClaims());
  const protectedVipCharacterUrlsRef = useRef<Set<string>>(new Set());
  const removedReferenceNamesRef = useRef<string[]>([]);

  useEffect(() => {
    referenceImagesRef.current = referenceImages;
  }, [referenceImages]);

  const updateReferenceImages = useCallback((updater: (prev: ReferenceImageItem[]) => ReferenceImageItem[]) => {
    const previous = referenceImagesRef.current;
    const requested = updater(previous);
    // Repair effects return the same list when nothing changed. Preserve that
    // no-op so their referenceImages dependency cannot cause a render loop.
    if (requested === previous) return;
    const next = requested.map((reference) => {
      if (reference.clientReferenceId) return reference;

      nextReferenceClientIdRef.current += 1;
      return {
        ...reference,
        clientReferenceId: `creation-reference-${nextReferenceClientIdRef.current}`,
      };
    });

    const liveReferenceIds = new Set(
      next.map((reference) => reference.clientReferenceId).filter(Boolean) as string[]
    );
    for (const key of referencePromptDraftsRef.current.keys()) {
      if (!liveReferenceIds.has(key)) referencePromptDraftsRef.current.delete(key);
    }
    for (const key of latestReferenceAiRequestRef.current.keys()) {
      if (!liveReferenceIds.has(key)) latestReferenceAiRequestRef.current.delete(key);
    }
    for (const key of referenceAiLoadingKeysRef.current) {
      if (!liveReferenceIds.has(key)) referenceAiLoadingKeysRef.current.delete(key);
    }
    for (const key of manualVipRenderClaimsRef.current.keys()) {
      if (!liveReferenceIds.has(key)) manualVipRenderClaimsRef.current.delete(key);
    }

    referenceImagesRef.current = next;
    setReferenceImages(next);
  }, []);
  const setReferenceImagesManaged = useCallback<React.Dispatch<React.SetStateAction<ReferenceImageItem[]>>>((nextValue) => {
    updateReferenceImages((previous) =>
      typeof nextValue === "function"
        ? (nextValue as (value: ReferenceImageItem[]) => ReferenceImageItem[])(previous)
        : nextValue
    );
  }, [updateReferenceImages]);
  const [referenceLoading, setReferenceLoading] = useState<boolean>(false);
  const [referencePendingCount, setReferencePendingCount] = useState<number>(0);

  useEffect(() => {
    if (
      studioButtonStage === 'generating' ||
      referenceLoading ||
      referencePendingCount > 0 ||
      queuedCastingPrompts.length > 0
    ) {
      return;
    }
    updateReferenceImages((previous) => {
      if (!previous.some((reference) => reference.isGenerating || reference.isUpscaling)) {
        return previous;
      }
      return previous.map((reference) =>
        (reference.isGenerating || reference.isUpscaling) && !referenceRenderClaims.current.working(reference.clientReferenceId)
          ? { ...reference, isGenerating: false, isUpscaling: false }
          : reference
      );
    });
  }, [studioButtonStage, referenceLoading, referencePendingCount, queuedCastingPrompts.length, updateReferenceImages]);
  const [isAgentCasting, setIsAgentCasting] = useState<boolean>(false);
  const [hideAllLabels, setHideAllLabels] = useState<boolean>(false);
  const [fadeAllLabels, setFadeAllLabels] = useState<boolean>(false);
  const [showScenesPopup, setShowScenesPopup] = useState<boolean>(false);
  const hasAutoOpenedScenesRef = useRef(false);
  const openScenesForCharacterEntry = useCallback(() => {
    const shouldAutoOpen = !hasAutoOpenedScenesRef.current;
    hasAutoOpenedScenesRef.current = true;
    setShowScenesPopup(shouldAutoOpen);
  }, []);

  const studioScrollRef = React.useRef<HTMLDivElement>(null);
  const scenesAnchorRef = React.useRef<HTMLDivElement>(null);
  const scenesTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const labelHideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingRefIdx, setEditingRefIdx] = useState<number | null>(null);
  const [isGoldenPromptExpanded, setIsGoldenPromptExpanded] = useState<boolean>(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);
  const lastSwipeTimeRef = useRef<number>(0);
  const [aiUpdateVal, setAiUpdateVal] = useState<string>("");
  const [imagePromptVal, setImagePromptVal] = useState<string>("");
  const [isRegeneratingRef, setIsRegeneratingRef] = useState<boolean>(false);
  const [renameModalOpen, setRenameModalOpen] = useState<boolean>(false);
  const [characterToRename, setCharacterToRename] = useState<{ idx: number, oldName: string, newName: string, type: string } | null>(null);
  const [isAILoading, setIsAILoading] = useState<boolean>(false);
  const [zoomMode, setZoomMode] = useState<boolean>(false);
  const [minimizeMode, setMinimizeMode] = useState<number>(0); // 0: Full (Default), 1: Inline, 2: Compact
  const [showPromptWelcomeUI, setShowPromptWelcomeUI] = useState(true);
  const [isSaveButtonVisible, setIsSaveButtonVisible] = useState<boolean>(false);
  const getReferenceEditKey = useCallback((reference: any): string | null => {
    const clientReferenceId = String(reference?.clientReferenceId || "").trim();
    return clientReferenceId || null;
  }, []);

  const selectReferenceForEditing = useCallback((
    nextIndex: number,
    options?: { resetZoom?: boolean },
  ) => {
    const nextReference = referenceImages[nextIndex];
    if (!nextReference) return;

    const nextKey = getReferenceEditKey(nextReference);
    if (!nextKey) return;
    activeReferenceEditKeyRef.current = nextKey;
    setEditingRefIdx(nextIndex);
    setImagePromptVal(
      referencePromptDraftsRef.current.get(nextKey)
      ?? nextReference.prompt
      ?? ""
    );
    setAiUpdateVal("");
    setIsAILoading(referenceAiLoadingKeysRef.current.has(nextKey));
    if (options?.resetZoom) setZoomMode(false);
  }, [getReferenceEditKey, referenceImages]);

  const closeReferenceEditor = useCallback(() => {
    activeReferenceEditKeyRef.current = null;
    setEditingRefIdx(null);
    setIsAILoading(false);
  }, []);

  useEffect(() => {
    const activeKey = activeReferenceEditKeyRef.current;
    if (!activeKey) return;

    const currentIndex = referenceImages.findIndex(
      (reference) => getReferenceEditKey(reference) === activeKey
    );
    if (currentIndex === -1) {
      closeReferenceEditor();
    } else if (editingRefIdx !== currentIndex) {
      setEditingRefIdx(currentIndex);
    }
  }, [closeReferenceEditor, editingRefIdx, getReferenceEditKey, referenceImages]);

  const setActiveReferencePromptDraft = useCallback((nextPrompt: string) => {
    setImagePromptVal(nextPrompt);
    const activeKey = activeReferenceEditKeyRef.current;
    if (activeKey) referencePromptDraftsRef.current.set(activeKey, nextPrompt);
  }, []);

  const activeEditingReference = editingRefIdx === null ? undefined : referenceImages[editingRefIdx];
  const activeEditingVip = Vipcharacters?.find((vip: any) => vip?.imageUrl && referenceNamesMatch(vip.name, activeEditingReference?.name));
  const activeReferenceGenerationMode = getReferenceImageGenerationMode(activeEditingReference, activeEditingVip);
  const activeReferenceIsWorking = isReferenceWorking(activeEditingReference);
  const activeReferenceCanEdit = Boolean(getReferenceGenerationInput(activeEditingReference, activeEditingVip));

  const setActiveReferenceGenerationMode = useCallback((mode: ReferenceImageGenerationMode) => {
    const activeKey = activeReferenceEditKeyRef.current;
    if (!activeKey) return;
    updateReferenceImages(previous => previous.map(reference =>
      getReferenceEditKey(reference) === activeKey && !isReferenceWorking(reference)
        ? { ...reference, imageGenerationMode: mode }
        : reference
    ));
  }, [getReferenceEditKey, updateReferenceImages]);

  const openReferenceImageUpload = useCallback(() => {
    const activeKey = activeReferenceEditKeyRef.current;
    const reference = referenceImagesRef.current.find(item => getReferenceEditKey(item) === activeKey);
    if (!activeKey || !reference || isReferenceWorking(reference) || referenceRenderClaims.current.working(activeKey)) return;
    // Capture the owner before the native picker opens; navigation may change afterward.
    referenceUploadTargetKeyRef.current = activeKey;
    if (referenceUploadInputRef.current) {
      referenceUploadInputRef.current.value = '';
      referenceUploadInputRef.current.click();
    }
  }, [getReferenceEditKey]);

  const [showVipPopup, setShowVipPopup] = useState<boolean>(false);
  const [vipDraft, setVipDraft] = useState<PreparedManualCharacterImage | null>(null);
  const vipDraftRef = useRef<PreparedManualCharacterImage | null>(null);

  useEffect(() => {
    vipDraftRef.current = vipDraft;
  }, [vipDraft]);

  useEffect(() => {
    return () => {
      const previewUrl = vipDraftRef.current?.previewUrl;
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []);
  const mergeVipReferenceCards = useCallback((vipList: any[] = Vipcharacters) => {
    const vipRefs = (vipList || [])
      .map(createVipReferenceItem)
      .filter((ref): ref is ReferenceImageItem => Boolean(ref));

    if (vipRefs.length === 0) return;

    updateReferenceImages((previous) => {
      let changed = false;
      const next = [...previous];

      for (const vipRef of vipRefs) {
        const existingIdx = findRefIndexByName(next, vipRef.name);
        if (existingIdx === -1) {
          next.push(vipRef);
          changed = true;
          continue;
        }

        const existing = next[existingIdx] as ReferenceImageItem;
        const shouldUseVipImage = !existing.imageUrl || (existing.isVip && !existing.prompt
          && !existing.hasManualImage && !referenceRenderClaims.current.done(existing.clientReferenceId));
        const merged: ReferenceImageItem = {
          ...existing,
          type: vipRef.assetKind ? vipRef.type : existing.type || vipRef.type,
          assetKind: vipRef.assetKind || existing.assetKind,
          description: existing.description || vipRef.description,
          isVip: true,
          source: (existing as any).source || vipRef.source,
          vipSourceImageUrl: (existing as any).vipSourceImageUrl || vipRef.imageUrl,
          ...(shouldUseVipImage
            ? {
              imageUrl: vipRef.imageUrl,
              url: vipRef.url,
              image: vipRef.image,
              isGenerating: false,
              isUpscaling: false
            }
            : {})
        };

        if (
          merged.imageUrl !== existing.imageUrl ||
          merged.description !== existing.description ||
          (merged as any).url !== (existing as any).url ||
          (merged as any).image !== (existing as any).image ||
          merged.assetKind !== existing.assetKind ||
          (merged as any).isVip !== (existing as any).isVip ||
          (merged as any).source !== (existing as any).source ||
          (merged as any).vipSourceImageUrl !== (existing as any).vipSourceImageUrl ||
          merged.isGenerating !== existing.isGenerating ||
          (merged as any).isUpscaling !== (existing as any).isUpscaling
        ) {
          next[existingIdx] = merged;
          changed = true;
        }
      }

      return changed ? next : previous;
    });
  }, [Vipcharacters, updateReferenceImages]);

  // Hoisted states for B Shot Mode Stage 1 (TTS Audio & Caching)
  const [isAudioDirty, setIsAudioDirty] = useState<boolean>(true);
  const [audioSceneStatuses, setAudioSceneStatuses] = useState<any[]>([]);
  const [isAudioGenerating, setIsAudioGenerating] = useState<boolean>(false);
  const [isBShotModeActive, setIsBShotModeActive] = useState<boolean>(false);
  const [generatedAudios, setGeneratedAudios] = usePersistedCreationState<string[]>(creationDraft, 'prompt', 'generatedAudios', []);
  const [generatedAudioTexts, setGeneratedAudioTexts] = usePersistedCreationState<string[]>(creationDraft, 'prompt', 'generatedAudioTexts', []);

  // Stage 2: Supreme Arrays for B Shots (interleaved per scene)
  const [bShotImages, setBShotImages] = usePersistedCreationState<string[][]>(creationDraft, 'prompt', 'bShotImages', []);
  const [bShotVideos, setBShotVideos] = usePersistedCreationState<string[][]>(creationDraft, 'prompt', 'bShotVideos', []);
  // A-shot cloud videos reported up from Storybook, used by the slideshow
  // preview so it can mirror the final render.
  const [sceneCloudVideos, setSceneCloudVideos] = usePersistedCreationState<string[]>(creationDraft, 'prompt', 'sceneCloudVideos', []);
  // Story background music reported up from Storybook's AudioPicker. This is
  // the track the final render mixes in for every non-music-video mode, so the
  // slideshow preview plays it too. Seeded with Storybook's own default.
  const STORY_DEFAULT_BG_MUSIC_URL =
    "https://clikbatebucket.s3.us-east-1.amazonaws.com/clikb_default.mp3";
  const [storyBgMusicUrl, setStoryBgMusicUrl] = usePersistedCreationState<string>(creationDraft, 'prompt', 'storyBgMusicUrl', STORY_DEFAULT_BG_MUSIC_URL);
  const [storyBgMusicName, setStoryBgMusicName] = usePersistedCreationState<string>(creationDraft, 'prompt', 'storyBgMusicName', "Music");
  const [bShotPrompts, setBShotPrompts] = usePersistedCreationState<string[][]>(creationDraft, 'prompt', 'bShotPrompts', []);
  const [bShotTextVideo, setBShotTextVideo] = usePersistedCreationState<string[][]>(creationDraft, 'prompt', 'bShotTextVideo', []);
  // Canonical spatial control state: [sceneIndex][root/action state index].
  // The second dimension is ready for action-node transitions without making
  // loaders or UI selection depend on a global object lookup.
  const [spatialMotionContexts, setSpatialMotionContexts] = useState<SpatialMotionContext[][]>([]);
  // Canonical creation data, indexed exactly like A scenes and [A scene][B shot].
  // Each node owns its Action slot, including actionLink for later preview.
  const [spatialManifest, setSpatialManifest] = useState<SpatialManifest>({version: 1, scenes: []});
  const [bShotSpatialScenes, setBShotSpatialScenes] = useState<Array<Array<SpatialSceneState | null>>>([]);
  const [bShotSpatialContexts, setBShotSpatialContexts] = useState<SpatialMotionContext[][][]>([]);

  const [bShotNanoImages, setBShotNanoImages] = usePersistedCreationState<string[][]>(creationDraft, 'prompt', 'bShotNanoImages', []);
  const [bShotDrawFrameData, setBShotDrawFrameData] = usePersistedCreationState<any[][]>(creationDraft, 'prompt', 'bShotDrawFrameData', []);
  const [bShotAutoDrawGuideData, setBShotAutoDrawGuideData] = usePersistedCreationState<Array<Array<AutoDrawGuideData | null>>>(creationDraft, 'prompt', 'bShotAutoDrawGuideData', []);
  const [bShotAutoDrawGuideModes, setBShotAutoDrawGuideModes] = usePersistedCreationState<AutoDrawGuideMode[][]>(creationDraft, 'prompt', 'bShotAutoDrawGuideModes', []);

  useEffect(() => {
    setSpatialMotionContexts((previous) => {
      const sceneCount = parsedKeyPoints.length;
      if (!sceneCount) return previous.length ? [] : previous;
      const next = Array.from({ length: sceneCount }, (_, sceneIndex) => previous[sceneIndex] || []);
      return next.length === previous.length && next.every((entry, index) => entry === previous[index])
        ? previous
        : next;
    });
  }, [parsedKeyPoints.length]);

  const spatialMotionProjectRef = useRef(creationProjectId);
  useEffect(() => {
    if (spatialMotionProjectRef.current === creationProjectId) return;
    spatialMotionProjectRef.current = creationProjectId;
    setSpatialMotionContexts([]);
    setSpatialManifest({version: 1, scenes: []});
    setBShotSpatialScenes([]);
    setBShotSpatialContexts([]);
  }, [creationProjectId]);

  useEffect(() => {
    // When the storybook opens (first generation of keypoints), auto-expand to Fullscreen
    if (parsedKeyPoints.length > 0) {
      setMinimizeMode(0);
    }
  }, [parsedKeyPoints.length > 0]);

  // --- Locks to prevent double-generation ---
  const isGeneratingRefsRef = useRef<boolean>(false);
  const referenceGenerationRunRef = useRef<symbol | null>(null);
  const castingPromptRunRef = useRef<{ castingId: number; token: symbol } | null>(null);
  const hasStartedCastingRef = useRef<boolean>(false);
  const isDetectionInProgressRef = useRef<boolean>(false);
  const latestCastingIdRef = useRef<number>(0);
  // Names whose reference image has already been RENDERED in this session.
  // A VIP arrives already holding an uploaded imageUrl, so imageUrl alone
  // cannot tell "uploaded photo" from "already generated" — this ref does.
  // Stamped on a successful render, cleared when the user deletes an image.
  const renderedRefsRef = useRef<Record<string, boolean>>({});
  const renderedRefKey = (name: any) => String(name || "").trim().toLowerCase();
  const stepTwoAuditAbortRef = useRef<AbortController | null>(null);
  const stepOneCastingSnapshotRef = useRef<{ characters: any[]; environments: any[]; references: ReferenceImageItem[] } | null>(null);
  const [castingPipelineActive, setCastingPipelineActive] = useState<boolean>(false);
  const [stepOneCastingReady, setStepOneCastingReady] = usePersistedCreationState<boolean>(creationDraft, 'prompt', 'stepOneCastingReady', false);
  const [stepOneDetectedCount, setStepOneDetectedCount] = usePersistedCreationState<number>(creationDraft, 'prompt', 'stepOneDetectedCount', 0);
  const [stepTwoAuditInProgress, setStepTwoAuditInProgress] = useState<boolean>(false);
  const [stepTwoCastingCancelled, setStepTwoCastingCancelled] = useState<boolean>(false);
  const stepTwoCastingCancelledRef = useRef<boolean>(false);

  useEffect(() => {
    stepTwoCastingCancelledRef.current = stepTwoCastingCancelled;
  }, [stepTwoCastingCancelled]);

  // Helper to refinement prompt with AI (Sync with EditStory logic)
  const handleEditReferenceAI = async (): Promise<string | null> => {
    if (editingRefIdx === null) return null;

    const targetIndex = editingRefIdx;
    const refItem = referenceImages[targetIndex];
    if (!refItem) return null;

    const targetKey = getReferenceEditKey(refItem);
    if (!targetKey) return null;
    const requestId = ++referenceAiRequestSequenceRef.current;
    latestReferenceAiRequestRef.current.set(targetKey, requestId);
    referenceAiLoadingKeysRef.current.add(targetKey);
    if (activeReferenceEditKeyRef.current === targetKey) {
      setIsAILoading(true);
    }

    const promptAtRequestStart = imagePromptVal || refItem.prompt;
    const instructionAtRequestStart = aiUpdateVal;

    try {
      const payload = {
        promptx: promptAtRequestStart,
        instructions: instructionAtRequestStart,
        logic: `Character/Environment reference for: ${refItem.name}`,
        imageUrl: refItem.imageUrl || refItem.url || refItem.image,
      };

      const response = await axios.post<any>(`${CLIK_URL}/GptRemake`, payload, { withCredentials: true });
      let updatedPrompt: any = response.data?.payload || response.data;
      if (typeof updatedPrompt === "object" && updatedPrompt !== null) {
        updatedPrompt = JSON.stringify(updatedPrompt, null, 2);
      }

      if (latestReferenceAiRequestRef.current.get(targetKey) !== requestId) {
        return null;
      }

      const nextPrompt = String(updatedPrompt || "");
      referencePromptDraftsRef.current.set(targetKey, nextPrompt);

      if (activeReferenceEditKeyRef.current === targetKey) {
        setImagePromptVal(nextPrompt);
        setAiUpdateVal("");
      }

      return nextPrompt;
    } catch (err) {
      console.error("AI Update Failed:", err);
      if (latestReferenceAiRequestRef.current.get(targetKey) === requestId) {
        alert("Failed to refine prompt with AI.");
      }
      return null;
    } finally {
      if (latestReferenceAiRequestRef.current.get(targetKey) === requestId) {
        referenceAiLoadingKeysRef.current.delete(targetKey);
        latestReferenceAiRequestRef.current.delete(targetKey);
        if (activeReferenceEditKeyRef.current === targetKey) {
          setIsAILoading(false);
        }
      }
    }
  };

  // Helper to regenerate the reference image
  const handleRegenerateReference = async () => {
    if (editingRefIdx === null) return;
    const targetRef = referenceImages[editingRefIdx];
    if (!targetRef) return;
    const targetKey = getReferenceEditKey(targetRef);
    if (!targetKey) return;
    if (isReferenceWorking(targetRef)) return;
    const vipMatch = Vipcharacters?.find((v: any) => v?.imageUrl && referenceNamesMatch(v.name, targetRef?.name));
    const generationMode = getReferenceImageGenerationMode(targetRef, vipMatch);
    const inputImage = generationMode === 'edit' ? getReferenceGenerationInput(targetRef, vipMatch) : '';
    if (generationMode === 'edit' && !inputImage) {
      alert('Upload or create a character image before editing.');
      return;
    }
    const renderToken = referenceRenderClaims.current.begin(targetKey, 'manual');
    if (!renderToken) return;
    const originalMedia = referenceMedia(targetRef);
    let ownedMedia = originalMedia;
    const ownsRender = (reference: ReferenceImageItem) => referenceRenderClaims.current.owns(targetKey, renderToken)
      && referenceMedia(reference) === originalMedia;
    const resolveTargetIndex = (references: ReferenceImageItem[]) =>
      references.findIndex((reference) =>
        getReferenceEditKey(reference) === targetKey
      );
    const vipUpgrade = !!vipMatch;
    const manualVipRenderAttempt = ++manualVipRenderSequenceRef.current;
    if (vipUpgrade) {
      const currentClaim = manualVipRenderClaimsRef.current.get(targetKey) || {
        pending: new Set<number>(),
        completed: false,
      };
      currentClaim.pending.add(manualVipRenderAttempt);
      manualVipRenderClaimsRef.current.set(targetKey, currentClaim);
    }
    const finishManualVipRender = (succeeded: boolean) => {
      const owns = referenceRenderClaims.current.owns(targetKey, renderToken);
      if (owns) updateReferenceImages(prev => prev.map(reference => getReferenceEditKey(reference) === targetKey && referenceMedia(reference) === ownedMedia && (reference.isGenerating || reference.isUpscaling) ? { ...reference, isGenerating: false, isUpscaling: false } : reference));
      referenceRenderClaims.current.finish(targetKey, renderToken, succeeded);
      if (!vipUpgrade) return;
      const currentClaim = manualVipRenderClaimsRef.current.get(targetKey);
      if (!currentClaim) return;

      currentClaim.pending.delete(manualVipRenderAttempt);
      if (succeeded) currentClaim.completed = true;
      if (!currentClaim.completed && currentClaim.pending.size === 0) {
        manualVipRenderClaimsRef.current.delete(targetKey);
      }
    };

    const referenceDescription = String((targetRef as any).description || '');
    let promptToUse = imagePromptVal.trim() || targetRef.prompt?.trim()
      || `Create a clear ${targetRef.assetKind === 'object' ? 'object' : targetRef.type === 'environment' ? 'environment' : 'full-body character'} appearance reference for @${targetRef.name}. ${targetRef.type === 'environment' || targetRef.assetKind === 'object' ? referenceDescription : getWorldCharacterImagePrompt(referenceDescription)}\nUse this story's current look, clothing and assets, not a previous scene: ${parsedKeyPointsb.join('\n').slice(0, 4000)}. No labels or text.`;
    updateReferenceImages(prev => prev.map(reference => getReferenceEditKey(reference) === targetKey ? { ...reference, isGenerating: true } : reference));

    // First: If AI update field is populated, process it and fetch the refined prompt
    if (aiUpdateVal.trim() !== "") {
      const refinedPrompt = await handleEditReferenceAI();
      if (!refinedPrompt) {
        finishManualVipRender(false);
        return; // Stop if AI refinement fails
      }
      promptToUse = refinedPrompt;
    }

    if (resolveTargetIndex(referenceImagesRef.current) === -1) {
      finishManualVipRender(false);
      return;
    }

    // Set generating status for this specific character locally without locking the whole UI
    updateReferenceImages(prev => {
      const updated = [...prev];
      const targetIdx = resolveTargetIndex(updated);
      if (updated[targetIdx]) {
        updated[targetIdx] = { ...updated[targetIdx], isGenerating: true };
      }
      return updated;
    });

    // Execute asynchronously so the user can continue generating others
    return (async () => {
      const charAttemptTargetKey = `character:${targetKey}`;
      const charAttemptId = `pi-char:${creationProjectId || 'active'}:${charAttemptTargetKey}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      dispatch(recordCreationAttemptStart({
        attemptId: charAttemptId,
        projectId: creationProjectId,
        mediaKind: 'character',
        targetKey: charAttemptTargetKey,
      }));
      try {
        const url = getReferenceGenerationRoute(modelz, generationMode);

        const seed = Math.floor(Math.random() * 1_000_000_000);
        let calcWidth = 1080;
        let calcHeight = 1920;
        if (ratioKey === 3) { calcWidth = 1920; calcHeight = 1080; }
        else if (ratioKey === 2) { calcWidth = 1080; calcHeight = 1080; }
        else if (ratioKey === 1) { calcWidth = 1080; calcHeight = 1920; }


        const payload: any = {
          inputs: promptToUse,
          width: calcWidth,
          height: calcHeight,
          guidance: 7.5,
          num_inference_steps: 35,
          seed: seed,
          ty: ratioKey,
          model: modelz,
          billingAction: targetRef.type === "environment" ? "environment-image" : "character-image",
          billingReference: targetRef.name,
        };
        if (inputImage) {
          payload.sampleImages = [inputImage];
          payload.sampleimagesnames = [{ ...targetRef, imageUrl: inputImage, url: inputImage, image: inputImage }];
        }

        const executeGeneration = async (attempt: number) => {
          try {
            const imgRes: any = await axios.post(`${CLIK_URL}/${url}`, payload, { withCredentials: true });
            const { imageBase64 } = imgRes.data;

            if (imageBase64) {
              let finalUrl = imageBase64;
              try {
                const fetchRes = await fetch(imageBase64);
                const blob = await fetchRes.blob();
                const publicUrl = await putToS3(blob);
                if (publicUrl) {
                  finalUrl = publicUrl;
                  Saveprompthelperfordellater(publicUrl);
                }
              } catch (s3Err) {
                console.error("Failed to upload regenerated character to S3:", s3Err);
              }

              const enableUpscale = false; // Toggled off for now due to backend stitching video size limits

              // First, show the original low-res image but trigger the "UPSCALING..." overlay if enabled
              updateReferenceImages(prev => {
                const updated = [...prev];
                const targetIdx = resolveTargetIndex(updated);
                if (updated[targetIdx] && ownsRender(updated[targetIdx])) {
                  updated[targetIdx] = {
                    ...updated[targetIdx],
                    imageUrl: finalUrl,
                    url: finalUrl,
                    image: finalUrl,
                    prompt: updated[targetIdx].prompt === targetRef.prompt ? promptToUse : updated[targetIdx].prompt,
                    renderProvenance: generatedReferenceProvenance(finalUrl, payload.inputs, inputImage),
                    originalPrompt: updated[targetIdx].originalPrompt || updated[targetIdx].prompt || promptToUse,
                    isGenerating: false,
                    isUpscaling: enableUpscale
                  } as any;
                  ownedMedia = finalUrl;
                  if (referencePromptDraftsRef.current.get(targetKey) === payload.inputs) referencePromptDraftsRef.current.delete(targetKey);
                }
                return updated;
              });

              // Perform auto-upscale
              if (enableUpscale) {
                try {
                  const upscaleRes: any = await axios.post(`${CLIK_URL}/upscaleImage`, {
                    url: imageBase64,
                    billingAction: "image-upscale",
                    billingReference: targetRef.name,
                  });
                  if (upscaleRes.data && upscaleRes.data.url) {
                    updateReferenceImages(prev => {
                      const updated = [...prev];
                      const targetIdx = resolveTargetIndex(updated);
                      if (updated[targetIdx] && referenceRenderClaims.current.owns(targetKey, renderToken) && referenceMedia(updated[targetIdx]) === finalUrl) {
                        updated[targetIdx] = {
                          ...updated[targetIdx],
                          renderProvenance: upscaledReferenceProvenance(updated[targetIdx], upscaleRes.data.url),
                          imageUrl: upscaleRes.data.url,
                          url: upscaleRes.data.url,
                          image: upscaleRes.data.url,
                          isUpscaling: false
                        } as any;
                        ownedMedia = upscaleRes.data.url;
                      }
                      return updated;
                    });
                  } else {
                    throw new Error("No URL returned from upscale API");
                  }
                } catch (upscaleErr) {
                  console.error("Auto-upscale failed for manual retry", upscaleErr);
                  // Remove the loading overlay on failure but keep the base image
                  updateReferenceImages(prev => {
                    const updated = [...prev];
                    const targetIdx = resolveTargetIndex(updated);
                    if (updated[targetIdx] && referenceRenderClaims.current.owns(targetKey, renderToken) && referenceMedia(updated[targetIdx]) === finalUrl) {
                      updated[targetIdx] = { ...updated[targetIdx], isUpscaling: false } as any;
                    }
                    return updated;
                  });
                }
              }
              finishManualVipRender(true);
              // A balance refresh is not part of rendering success. Never
              // recreate a paid image just because this read-only request fails.
              dispatch(recordCreationAttemptSuccess({
                attemptId: charAttemptId,
                projectId: creationProjectId,
                mediaKind: 'character',
                targetKey: charAttemptTargetKey,
              }));
              try { setAvailablePixels(await getPixel()); }
              catch (balanceError) { console.warn('Character image retained; balance refresh failed.', balanceError); }
              return true; // success
            }
            return false;
          } catch (imgErr) {
            console.error(`Failed to generate reference image for manual retry (attempt ${attempt}):`, imgErr);
            return false;
          }
        };

        let success = await executeGeneration(1);
        if (!success) {
          await new Promise(r => setTimeout(r, 3000));
          success = await executeGeneration(2);
          if (!success) {
            await new Promise(r => setTimeout(r, 6000));
            success = await executeGeneration(3);
          }
        }

        if (!success) {
          finishManualVipRender(false);
          dispatch(recordCreationAttemptFailure({
            attemptId: charAttemptId,
            projectId: creationProjectId,
            mediaKind: 'character',
            targetKey: charAttemptTargetKey,
            message: `Failed to regenerate character image for ${targetRef?.name || 'character'}.`,
          }));
          alert("Failed to regenerate image.");
        }
      } catch (err) {
        finishManualVipRender(false);
        console.error("Regeneration Failed:", err);
        alert("Failed to regenerate image.");
      }
    })();
  };

  const sceneElementsRef = React.useRef<(HTMLDivElement | null)[]>([]);

  // Auto-scroll to selected scene when modal opens
  React.useEffect(() => {
    if (selectedSceneIndex === null) return;

    let attempts = 0;
    const scrollInterval = setInterval(() => {
      const target = sceneElementsRef.current[selectedSceneIndex];
      if (target) {
        target.scrollIntoView({
          behavior: 'auto',
          inline: 'center',
          block: 'nearest'
        });
        clearInterval(scrollInterval);
      } else {
        attempts++;
        if (attempts > 20) clearInterval(scrollInterval); // Guard against infinite loop
      }
    }, 50);

    return () => clearInterval(scrollInterval);
  }, [selectedSceneIndex]);

  // Scroll detection: auto-trigger scenes popup when scrolling ~20% into scenes section
  React.useEffect(() => {
    const el = studioScrollRef.current;
    const anchor = scenesAnchorRef.current;
    if (!el || !anchor || !showStudioModal || hasAutoOpenedScenesRef.current) return;

    const handleScroll = () => {
      if (showScenesPopup) return;

      // Check if user has scrolled to the very bottom
      const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;

      if (isAtBottom) {
        // Prevent further scroll
        if (!scenesTimerRef.current) {
          scenesTimerRef.current = setTimeout(() => {
            if (hasAutoOpenedScenesRef.current) return;
            hasAutoOpenedScenesRef.current = true;
            setShowScenesPopup(true);
            scenesTimerRef.current = null;
          }, 500);
        }
      } else {
        // User scrolled back up, cancel
        if (scenesTimerRef.current) {
          clearTimeout(scenesTimerRef.current);
          scenesTimerRef.current = null;
        }
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (scenesTimerRef.current) {
        clearTimeout(scenesTimerRef.current);
        scenesTimerRef.current = null;
      }
    };
  }, [showStudioModal, showScenesPopup]);

  // --- Studio Auto-Proceed Timer Logic ---
  useEffect(() => {
    // Stage 1: Timer Completion
    if (studioActionTimer === 0) {
      setStudioActionTimer(null);
      if (studioButtonStage === 'post-countdown') {
        // Time expired without cancellation! Proceed to Storybook map
        setStudioButtonStage('hidden');
        setShowStudioModal(false);     // Mounts the Storybook
        setShowScenesPopup(false);
      }
      return;
    }

    // Stage 2: Tick Down
    if (studioActionTimer !== null && studioActionTimer > 0) {
      const timer = setInterval(() => {
        setStudioActionTimer((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [studioActionTimer, studioButtonStage, queuedCastingPrompts]);
  const blinkOutline = keyframes`
    0% { outline: 2px solid transparent; outline-offset: 3px; }
    50% { outline: 2px solid rgba(255, 255, 255, 0.5); outline-offset: 3px; }
    100% { outline: 2px solid transparent; outline-offset: 3px; }
  `;

  const cancelCountdown = useCallback(() => {}, []);




  const handleCycle = () => dispatch(cycleAspectRatio2());

  const handleCyclex = () => dispatch(cycleAspectRatio3());


  const handleChange = useCallback(
    (_: React.SyntheticEvent, newValue: string) => {




      if (StopText) { } else { }



      if (newValue.length <= maxCharacters) {
        if (minipromptRefx.current) {
          clearTimeout(minipromptRefx.current);
        }

        setPrompt(newValue);
        setError("");
      } else {
        setError(`Maximum character limit of ${maxCharacters} exceeded.`);


      }
    },
    [maxCharacters, StopText]
  );



  // State variables for signed URLs
  const [signedUrlThumb, setSignedUrlThumb] = useState<string | null>(null);
  const [signedUrlHD, setSignedUrlHD] = useState<string | null>(null);

  const [GeneratedImageFlux, setGeneratedImageFlux] = usePersistedCreationState(creationDraft, 'prompt', 'GeneratedImageFlux', '');



  const [generatedImagesFluxx, setGeneratedImagesFluxx] = usePersistedCreationState<string[]>(creationDraft, 'prompt', 'generatedImagesFluxx', Array(parsedKeyPoints.length).fill(""));
  const [drawFrameData, setDrawFrameData] = usePersistedCreationState<any[]>(creationDraft, 'prompt', 'drawFrameData', Array(parsedKeyPoints.length).fill(null));
  const [autoDrawGuideData, setAutoDrawGuideData] = usePersistedCreationState<Array<AutoDrawGuideData | null>>(creationDraft, 'prompt', 'autoDrawGuideData', Array(parsedKeyPoints.length).fill(null));
  const [autoDrawGuideModes, setAutoDrawGuideModes] = usePersistedCreationState<AutoDrawGuideMode[]>(creationDraft, 'prompt', 'autoDrawGuideModes', Array(parsedKeyPoints.length).fill("text"));
  useEffect(() => {
    setDrawFrameData((prev: any[] = []) => {
      if (parsedKeyPoints.length === 0) return [];
      const next = [...prev];
      while (next.length < parsedKeyPoints.length) next.push(null);
      return next.slice(0, parsedKeyPoints.length);
    });
    setAutoDrawGuideData((prev: Array<AutoDrawGuideData | null> = []) => {
      if (parsedKeyPoints.length === 0) return [];
      const next = [...prev];
      while (next.length < parsedKeyPoints.length) next.push(null);
      return next.slice(0, parsedKeyPoints.length);
    });
    setAutoDrawGuideModes((prev: AutoDrawGuideMode[] = []) => {
      if (parsedKeyPoints.length === 0) return [];
      const next = [...prev];
      while (next.length < parsedKeyPoints.length) next.push("text");
      return next.slice(0, parsedKeyPoints.length);
    });
  }, [parsedKeyPoints.length]);

  const [loadersArray, setLoadersArray] = useState<number[]>([]);



  const [GeneratedImageFluxBlob, setGeneratedImageFluxBlob] = useState<any>(null);
  const singleImageSourceRef = useRef({ blob: GeneratedImageFluxBlob, preview: GeneratedImageFlux });
  singleImageSourceRef.current = { blob: GeneratedImageFluxBlob, preview: GeneratedImageFlux };
  const singleImageStoredRef = useRef(new WeakMap<Blob, { sdUrl: string; hdUrl: string }>());
  const singleImageSaveJobsRef = useRef(new WeakMap<Blob, Promise<any>>());
  const singleImageUrlSaveJobsRef = useRef(new Map<string, Promise<any>>());
  const singleImageCurrentStoredRef = useRef<StoredImageMedia | null>(null);
  const singleImageStoredVersionsRef = useRef(new Map<string, StoredImageMedia>());
  const singleImageStoredAliasesRef = useRef(new Map<string, string>());
  const [, setSingleImageStoredRevision] = useState(0);
  const singleImageRevocationsRef = useRef(new Set<string>());
  useEffect(() => {
    for (const url of singleImageRevocationsRef.current) {
      if (GeneratedImageFlux === url || GeneratedImage.includes(url) || referenceImages.some(reference => reference.imageUrl === url)) continue;
      URL.revokeObjectURL(url); singleImageRevocationsRef.current.delete(url);
    }
  }, [GeneratedImageFlux, GeneratedImage, referenceImages]);
  const [enhancedPromptx, setenhancedPromptx] = usePersistedCreationState(creationDraft, 'prompt', 'enhancedPromptx', '');

  /* âœ±  State declarations with explicit types  âœ± */

  const [generatedImagesFluxBlobHd, setGeneratedImagesFluxBlobHd] = useState<Blob[]>([]);





  const [im, setim] = useState(false);

  const [textchange, settextchange] = useState(false);

  const [GotIm, setGotIm] = usePersistedCreationState(creationDraft, 'prompt', 'GotIm', false);

  const [AudioResult, setAudioResult] = usePersistedCreationState(creationDraft, 'prompt', 'AudioResult', '');
  const [CreationMode, setCreationMode] = usePersistedCreationState(creationDraft, 'prompt', 'CreationMode', '');

  const [selectedStyle, setSelectedStyle] = usePersistedCreationState<string>(creationDraft, 'prompt', 'selectedStyle', artstyleRedux || "Auto");




  const isAllFeeds = location.pathname.toLowerCase() === '/feeds';
  const [urlName4prompt, setUrlName4prompt] = useState(location.pathname); // initial value

  useEffect(() => {
    setUrlName4prompt(location.pathname);
    if (location.pathname === '/images' || location.pathname === '/clikit' || location.pathname === '/kickit' || isAllFeeds) {

    } else {
      setminimisePrompt(true);
    }

  }, [location.pathname]); // runs whenever either changes






  const isActive = !minimisePrompt;
  const activeRef = useRef(isActive);

  // [REMOVED window.history.pushState LOGIC to prevent swipe-back data loss]



  // Add this import if needed, or ensure startDelete is in scope
  // import { startDelete } from './your-api-functions'; 
  // 1. Define the Video Deleter (as requested)
  const startDeleteVid = async (vidUrl: string) => {
    try {
      await axios.post(
        `${CLIK_URL}/del-video`,
        { url: vidUrl },
        { withCredentials: true }
      );
      // console.log("Video deleted from S3:", vidUrl);
    } catch (err) {
      console.error("Delete video failed:", err);
    }
  };

  const startDeleteAudio = async (audioUrl: string) => {
    try {
      await axios.post(
        `${CLIK_URL}/del-audio`,
        { url: audioUrl },
        { withCredentials: true }
      );
    } catch (err) {
      console.error("Delete audio failed:", err);
    }
  };

  useEffect(() => {
    const activeVipUrlsAtMount = new Set(
      (Vipcharacters || [])
        .map((character: any) => String(character?.imageUrl || "").trim())
        .filter(Boolean)
    );

    // 2. Define a Generic Cleanup Function  startstory
    // This handles the logic for ANY storage key and ANY delete function
    const runCleanup = async (
      storageKey: string,
      deleteFn: (url: string) => Promise<any>
    ) => {
      const storedData = localStorage.getItem(storageKey);
      if (!storedData) return;

      try {
        const items = JSON.parse(storedData);
        if (!Array.isArray(items)) return;

        const now = Date.now();
        const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

        const validItems: any[] = [];
        const expiredItems: any[] = [];

        // A. Filter items
        items.forEach((item: any) => {
          const itemUrl = String(item?.url || "").trim();
          // An active World/direct VIP must survive delayed cleanup. Once the
          // PromptInput X intentionally clears it from Vipcharacters, a later
          // cleanup run can remove the expired temporary direct-upload file.
          if (storageKey === "helperimagesprompt" && activeVipUrlsAtMount.has(itemUrl)) {
            validItems.push(item);
            return;
          }

          const age = now - (item.timestamp || 0);
          if (age > TWENTY_FOUR_HOURS_MS) {
            expiredItems.push(item);
          } else {
            validItems.push(item);
          }
        });

        // B. If nothing to delete, exit
        if (expiredItems.length === 0) return;

        console.log(`ðŸ§¹ Cleaning up ${expiredItems.length} expired items from ${storageKey}...`);

        // C. Update Local Storage IMMEDIATELY (Safety first)
        localStorage.setItem(storageKey, JSON.stringify(validItems));

        // D. Trigger the specific delete function for each item
        await Promise.allSettled(
          expiredItems.map((item) => deleteFn(item.url))
        );

        console.log(`âœ… Cleanup complete for ${storageKey}.`);
      } catch (err) {
        console.error(`Error parsing ${storageKey} for cleanup:`, err);
      }
    };

    // --- EXECUTE CLEANUP startDeleteAudio ---

    // 1. Clean Images (Using your existing startDelete)
    // Note: Assuming startDelete is available in your component scope
    runCleanup("helperimagesprompt", startDelete);

    // 2. Clean Videos (Using the new startDeleteVid)
    runCleanup("helpervideosprompt", startDeleteVid);

    // 3. Clean audio snippets generated for music-video lip sync
    runCleanup("helperaudiosprompt", startDeleteAudio);

  }, []); // Runs once on mount

  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [isNotepadOpenRefAI, setIsNotepadOpenRefAI] = useState(false);
  const [isNotepadOpenRefPrompt, setIsNotepadOpenRefPrompt] = useState(false);

  // keep your existing suggestions, error, maxCharacters, etc.
  // handleChange now only needed if you still use Autocomplete suggestions.
  // But the actual text comes from `prompt` which Notepad edits.


  const applyArtStyleToPlan = (
    plan: any,
    style: string
  ): any => {
    if (style === "Auto") {
      console.log("Plan Created:", plan); // <- âœ¨ hereâ€™s your plan
      return plan;
    }

    const token = `${style} art style`;
    const updatedPlan = {
      ...plan,
      art_style: { style_token: token },
      characters: (plan.characters || []).map((char: any) => ({
        ...char,
        style_token: token,
      })),
    };

    console.log("Plan Updated:", updatedPlan);
    return updatedPlan;
  };


  useEffect(() => {


    console.log(signedUrlHD);
    console.log(signedUrlThumb);
  }, [signedUrlThumb, signedUrlHD]);

  useEffect(() => {


    if (parsedKeyPoints.length > 0) {

      setHideBottom(true);
    } else {

      setHideBottom(false)
    }
  }, [parsedKeyPoints]);


  var timerb: any = null;
  var timerbc: any = null;


  // Customize padding for both buttons here.
  const buttonPadding = { px: 3, py: 1.5 };


  const minipromptRefx = useRef<ReturnType<typeof setTimeout> | null>(null);


  const minipromptRefx2 = useRef<ReturnType<typeof setTimeout> | null>(null);


  const [PostId, setPostId] = useState(draftEntry?.record.postId || 0);
  const singleImageProjectRef = useRef({ PostId, Planx, creationProjectId });
  singleImageProjectRef.current = { PostId, Planx, creationProjectId };
  const singleImageSaveOwnerRef = useRef<symbol | null>(null);
  useEffect(() => {
    if (!PostId) return;
    // Background completions belong to their scene identity, never whichever
    // scene happens to be open when the provider finishes.
    return subscribeSpatialDocuments(CLIK_URL, Number(PostId), ({ scene }) => {
      const merge = (current: SpatialSceneState) => ({ ...scene, activeNodeId: current.activeNodeId, bShotSource: current.bShotSource || scene.bShotSource });
      setSpatialManifest(previous => previous.scenes.some(current => current.sceneId === scene.sceneId)
        ? { ...previous, scenes: previous.scenes.map(current => current.sceneId === scene.sceneId ? merge(current) : current) } : previous);
      setBShotSpatialScenes(previous => previous.some(row => row.some(current => current?.sceneId === scene.sceneId))
        ? previous.map(row => row.map(current => current?.sceneId === scene.sceneId ? merge(current) : current)) : previous);
    });
  }, [PostId]);

  const [showWorldModel, setShowWorldModel] = useState(false);

  const [allowgetImage, setallowgetImage] = useState(false)

  const originalStoryRunKeyRef = useRef("");
  const videoModeStartedRunKeyRef = useRef("");
  const promptPrepFinishedRunKeyRef = useRef("");
  const promptPrepFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoModeGateRef = useRef({
    allowgetImage: false,
    showPathChoiceOverlay: false,
    showStudioModal: false,
    showScenesPopup: false,
    isRevisitingCharacter: false,
    magicMode: Boolean(magicMode),
    parsedKeyPointsLength: 0,
  });

  useEffect(() => {
    videoModeGateRef.current = {
      allowgetImage,
      showPathChoiceOverlay,
      showStudioModal,
      showScenesPopup,
      isRevisitingCharacter,
      magicMode: Boolean(magicMode),
      parsedKeyPointsLength: parsedKeyPoints.length,
    };
  }, [
    allowgetImage,
    showPathChoiceOverlay,
    showStudioModal,
    showScenesPopup,
    isRevisitingCharacter,
    magicMode,
    parsedKeyPoints.length,
  ]);

  const clearPromptPrepFallbackTimer = useCallback(() => {
    if (promptPrepFallbackTimerRef.current) {
      window.clearTimeout(promptPrepFallbackTimerRef.current);
      promptPrepFallbackTimerRef.current = null;
    }
  }, []);

  const resetVideoModeRunGuard = useCallback((runKey = "") => {
    clearPromptPrepFallbackTimer();
    originalStoryRunKeyRef.current = runKey;
    videoModeStartedRunKeyRef.current = "";
    promptPrepFinishedRunKeyRef.current = "";
  }, [clearPromptPrepFallbackTimer]);

  const getOriginalStoryRunKey = useCallback(() => {
    if (!originalStoryRunKeyRef.current) {
      const promptKey = String(prompt || "").trim().slice(0, 160);
      originalStoryRunKeyRef.current = `${Date.now()}:${promptKey}:${parsedKeyPoints.length}`;
    }
    return originalStoryRunKeyRef.current;
  }, [parsedKeyPoints.length, prompt]);

  const enterVideoCreationModeOnce = useCallback((runKey?: string) => {
    const currentRunKey = runKey || getOriginalStoryRunKey();
    if (!currentRunKey || videoModeStartedRunKeyRef.current === currentRunKey) {
      return false;
    }

    videoModeStartedRunKeyRef.current = currentRunKey;
    setSkipCountdown(null);
    setStudioButtonStage('hidden');
    setShowStudioModal(false);
    setShowScenesPopup(false);
    setShowPathChoiceOverlay(false);
    setAutoSkipPending(false);

    if (!videoModeGateRef.current.allowgetImage) {
      setCreationMode('Video');
      setallowgetImage(true);
    }

    return true;
  }, [getOriginalStoryRunKey]);

  const recoverMissedVideoModeChoice = useCallback(() => {
    const runKey = originalStoryRunKeyRef.current;
    const gate = videoModeGateRef.current;

    if (!runKey || promptPrepFinishedRunKeyRef.current !== runKey) return false;
    if (videoModeStartedRunKeyRef.current === runKey) return false;
    if (
      gate.allowgetImage ||
      gate.showPathChoiceOverlay ||
      gate.showStudioModal ||
      gate.showScenesPopup ||
      gate.isRevisitingCharacter ||
      gate.magicMode ||
      gate.parsedKeyPointsLength === 0
    ) {
      return false;
    }

    return enterVideoCreationModeOnce(runKey);
  }, [enterVideoCreationModeOnce]);

  const markPromptPrepFinishedForCurrentRun = useCallback(() => {
    const runKey = getOriginalStoryRunKey();
    promptPrepFinishedRunKeyRef.current = runKey;
    clearPromptPrepFallbackTimer();
    promptPrepFallbackTimerRef.current = window.setTimeout(() => {
      promptPrepFallbackTimerRef.current = null;
      if (document.visibilityState === "visible") {
        recoverMissedVideoModeChoice();
      }
    }, 1500);
    return runKey;
  }, [clearPromptPrepFallbackTimer, getOriginalStoryRunKey, recoverMissedVideoModeChoice]);

  useEffect(() => {
    const recoverWhenVisible = () => {
      if (document.visibilityState === "visible") {
        recoverMissedVideoModeChoice();
      }
    };

    document.addEventListener("visibilitychange", recoverWhenVisible);
    window.addEventListener("focus", recoverWhenVisible);

    return () => {
      document.removeEventListener("visibilitychange", recoverWhenVisible);
      window.removeEventListener("focus", recoverWhenVisible);
      clearPromptPrepFallbackTimer();
    };
  }, [clearPromptPrepFallbackTimer, recoverMissedVideoModeChoice]);

  useEffect(() => {
    if (
      parsedKeyPoints.length === 0 ||
      !allowgetImage ||
      showPathChoiceOverlay ||
      isDetectionInProgressRef.current ||
      referenceLoading ||
      referencePendingCount > 0
    ) {
      return;
    }

    mergeVipReferenceCards();
  }, [
    parsedKeyPoints.length,
    allowgetImage,
    showPathChoiceOverlay,
    referenceLoading,
    referencePendingCount,
    Vipcharacters,
    mergeVipReferenceCards
  ]);
  const glassSweep = keyframes`
  from { transform: translateX(-150%) rotate(20deg); }
  to   { transform: translateX(150%)  rotate(20deg); }
`;
  /* ------------------------------------------------------------------
   * 1)  Re-usable glass style
   * ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------
  * Unified â€œglassâ€ style â€“ v2
  * ------------------------------------------------------------------ */
  const glassButtonSx = {
    /* ---------- core look & feel ---------- */
    flex: matchMobile ? 0.2 : 0.2,
    mt: "3px",
    borderRadius: 2,
    background: darkMode
      ? "rgba(25,25,25,0.25)"
      : "rgba(255,255,255,0.25)",
    color: darkMode ? "#ffffff" : "#000",


    /* thinner, neutral border compared to v1 */
    border: "1px solid rgba(255,255,255,0.45)",


    /* softer shadow depth */
    boxShadow: darkMode
      ? "0 8px 32px rgba(0,0,0,.55)"
      : "0 8px 32px rgba(0,0,0,.15)",

    transform: "translateY(-2px)",

    transition:
      "background .25s ease, box-shadow .25s ease, transform .12s ease",

    /* ---------- reflection overlay ---------- */
    position: "relative",
    overflow: "hidden",
    "&::before": {
      content: '""',
      position: "absolute",
      top: "-40%",
      left: 0,
      width: "60%",
      height: "180%",
      background:
        "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)",
      opacity: 0,            // hidden until hover / active
      pointerEvents: "none",
    },

    /* ---------- hover ---------- */
    "&:hover": {
      background: darkMode
        ? "rgba(25,25,25,0.35)"
        : "rgba(255,255,255,0.35)",
      transform: "translateY(0)",
      "&::before": {
        opacity: 0.8,
        animation: `${glassSweep} 1.8s ease-out forwards`,
      },
    },

    /* ---------- active / pressed ---------- */
    "&:active": {
      background: darkMode
        ? "rgba(25,25,25,0.45)"
        : "rgba(255,255,255,0.45)",
      boxShadow: "0 4px 16px rgba(0,0,0,0.30)",
      transform: "translateY(0)",
      "&::before": {
        opacity: 0.9,
        animation: `${glassSweep} 1.1s ease-out forwards`,
      },
    },

    /* ---------- focus highlight ---------- */
    "&:focus, &:focus-visible, &.Mui-focusVisible": {
      outline: "none",
      boxShadow: "none",
      backgroundColor: darkMode
        ? "rgba(255,255,255,0.10)"
        : "rgba(255,255,255,0.10)",
    },

    WebkitTapHighlightColor: "rgba(25,25,25,0.5)",
    "::-moz-focus-inner": { border: 0 },
  };

  // helpers (place inside your component or import from a utils file)
  const LABEL_BY_INDEX = [] as const;

  const LABEL_BY_INDEXcc = ["Pro", "Knowledge", "Artistic", "Graphical", "Standard", "Base", "Pro"] as const;
  // Optional: centralize neon picks
  const NEON = {
    yellow: '#FFFF33',   // electric yellow
    red: '#18FFFF',   // scarlet/neon red
    cyan: 'orange',   // bright cyan
    pink: '#FF00FF',   // magenta/neon pink Dream 4.5
    green: '#39FF14',   // electric green
  };

  const COLOR_BY_LABEL: Record<(typeof LABEL_BY_INDEX)[number], string> = {
    Pro: darkModeReducer ? "yellow" : NEON.yellow,
    Knowledge: darkModeReducer ? "red" : NEON.red,
    Graphical: darkModeReducer ? "orange" : NEON.cyan,
    Artistic: darkModeReducer ? "pink" : NEON.pink,
    Standard: darkModeReducer ? "#3b82f6" : NEON.green,
    Base: darkModeReducer ? "#3b82f6" : NEON.green,
  };


  const getTextShadow = (label: string, dark: boolean): string => {
    // Simulated stroke (works on any bg) + mode-specific glow.
    const heavyForYellow = label === "High" ? "0 0 3px rgba(0,0,0,0.9), " : "";
    const stroke =
      "0 0 1px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.75), " +
      "1px 0 0 rgba(0,0,0,0.7), -1px 0 0 rgba(0,0,0,0.7), " +
      "0 1px 0 rgba(0,0,0,0.7), 0 -1px 0 rgba(0,0,0,0.7), " +
      "1px 1px 0 rgba(0,0,0,0.6), -1px -1px 0 rgba(0,0,0,0.6)";
    const glow = dark
      ? ", 0 0 6px rgba(255,255,255,0.9), 0 0 12px rgba(255,255,255,0.5)"
      : ", 0 2px 4px rgba(0,0,0,0.45), 0 6px 12px rgba(0,0,0,0.35)";
    return heavyForYellow + stroke + glow;
  };

  // --- your JSX snippet, updated window ---


  const handleToggleGeneratedImage = (url: string) => {
    setGeneratedImage((prev: string[]) => {
      if (prev.includes(url)) {
        // URL exists? Remove it (Filter out)
        return prev.filter((img) => img !== url);
      } else {
        // URL doesn't exist? Add it
        return [...prev, url];
      }
    });
  };


  useEffect(() => {
    ///clikt

    if (minimisePrompt) {
      setstopFeeds(false);
    } else { }

  }, [minimisePrompt]); // still valid


  useEffect(() => {
    ///clikt Stories


    if (parsedKeyPoints.length > 0) {

      if (minipromptRefx2.current) {
        clearTimeout(minipromptRefx2.current);
      }
    } else {
      if (prompt === '' && !minimisePrompt) {
        minipromptRefx2.current = setTimeout(() => {
          ///   setminimisePrompt(true);
        }, 30);
      }



      // Cleanup
      return () => {
        if (minipromptRefx2.current) {
          clearTimeout(minipromptRefx2.current);
        }
      };

    }
  }, [prompt, minimisePrompt, type, parsedKeyPoints]); // still valid



  const GRADIENTx = "linear-gradient(135deg, yellow 0%, #736EFE 100%)";


  /////////////////////////////////////////MODELSSSSSSSSSSSSSS///////////////////////////////

  // GPT Image Flare is the default image model. The trigger says "Models"
  // until the user opens the picker; this changes only its label, not routing.
  const [modelz, setModelz] = usePersistedCreationState(creationDraft, 'prompt', 'modelz', modelRedux || DEFAULT_IMAGE_MODEL);
  const [homeModel, setHomeModel] = usePersistedCreationState<string>(creationDraft, 'prompt', 'homeModel', modelRedux || DEFAULT_IMAGE_MODEL);
  const homeModelLocked = useRef(false);

  useEffect(() => {
    if (!homeModelLocked.current && (GeneratedImage.length > 0 || parsedKeyPoints.length > 0)) {
      setHomeModel(modelz === "Models" ? DEFAULT_IMAGE_MODEL : modelz);
      homeModelLocked.current = true;
    }
  }, [modelz, GeneratedImage.length, parsedKeyPoints.length]);


  /////////////////////////////////////////MODELSSSSSSSSSSSSSS///////////////////////////////

  // helper: add the correct circle based on whether the *model key* is pro, hd, or standard
  const circleForLabel = (key: string) => {
    // The dot encodes model strength, so the palette stays. Only the tier
    // membership changed: Nano Banana 2 Lite (fluxUltra) and Seedream 4.5
    // (minimax2) now sit in the yellow tier.
    const k = key.toLowerCase();
    const circleColor =
      (k === "fluxultra" || k === "minimax2" || k === "imagen2")
        ? "#f4d35e"
        : (k === "schnell")
          ? "#4da3ff"
          : "#ff4d6d";

    return (
      <span
        aria-hidden="true"
        style={{
          marginLeft: 6,
          width: matchMobile ? 8 : 9,
          height: matchMobile ? 8 : 9,
          borderRadius: "50%",
          display: "inline-block",
          backgroundColor: circleColor,
          boxShadow: `0 0 8px ${circleColor}`,
          flexShrink: 0,
        }}
      />
    );
  };

  // helper: keeps your exact â€œmobile hides robotâ€ layout
  const renderPretty = (key: string, text: string) => (
    <>
      <span style={{ display: matchMobile ? "none" : "inline-flex", alignItems: "center" }}>
        {text}
        {circleForLabel(key)}
      </span>

      <span style={{ display: matchMobile ? "inline-flex" : "none", alignItems: "center" }}>
        {text}
        {circleForLabel(key)}
      </span>
    </>
  );





  const GRADIENT = darkMode
    ? "linear-gradient(90deg, #ffffff 20%, #eeeeee 100%)"
    : "";



  const [anchorEl, setAnchorEl] = useState(null);



  const startDelete = async (imageUrl: String) => {

    if (imageUrl) {
      try {
        ///  setLoadingDatabase(true);
        //del-
        await axios.post(
          `${CLIK_URL}/del-image`,
          { url: imageUrl },          // <-- body
          { withCredentials: true }   // <-- config
        );
        console.log("Deleted from s3:", imageUrl);
        // success: update UI, toast, etc.
      } catch (err) {
        console.error("Delete failed:", err);
      } finally {
        /// setLoadingDatabase(false);
      }
    }
  };



  ///  startDelete(GeneratedImage);


  const [ImagesHdCloud, setImagesHdCloud] = usePersistedCreationState<string[]>(creationDraft, 'prompt', 'ImagesHdCloud', []);



  const persistStoredSingleImage = useCallback((stored: StoredImageMedia, enhancedTextData: any, loggedUserx: any, canPublish: () => boolean) => {
    const active = singleImageUrlSaveJobsRef.current.get(stored.hdUrl);
    if (active) return active;
    const receipt = storedImageReceipt(stored);
    const job = Promise.resolve().then(async () => {
      // Early media storage does not create the official draft post.
      const postId = Number(creationDraft?.getState().postId || PostId) || 0;
      RemoveFromDeleteLater([receipt.sdUrl, receipt.hdUrl]);
      if (canPublish()) {
        setPostId(postId); localStorage.removeItem('S3fromprompt'); setStopText(false);
        if (singleImageCurrentStoredRef.current?.hdUrl === receipt.hdUrl) singleImageCurrentStoredRef.current = receipt;
        singleImageStoredVersionsRef.current.set(receipt.hdUrl, receipt);
        setSingleImageStoredRevision(version => version + 1);
      }
      return { sdUrl: receipt.sdUrl, hdUrl: receipt.hdUrl, postId };
    });
    singleImageUrlSaveJobsRef.current.set(receipt.hdUrl, job);
    void job.finally(() => { if (singleImageUrlSaveJobsRef.current.get(receipt.hdUrl) === job) singleImageUrlSaveJobsRef.current.delete(receipt.hdUrl); }).catch(() => undefined);
    return job;
  }, [promptx, GeneratedImage, prompt, modelz, ratioKey]);

  const GenerateSignedUrl = useCallback(
    async (source: Blob | string, enhancedTextData: any, loggedUserx: any,
      stored?: Pick<StoredImageMedia, 'sdUrl' | 'hdUrl'>) => {
      try {
        if (stored && isHttpMediaUrl(stored.sdUrl) && isHttpMediaUrl(stored.hdUrl)) {
          const active = singleImageUrlSaveJobsRef.current.get(stored.hdUrl);
          if (active) return await active;
          const owner = Symbol('stored-image-save');
          singleImageSaveOwnerRef.current = owner;
          const context = { ...singleImageProjectRef.current };
          source = '';
          return await persistStoredSingleImage(stored, enhancedTextData, loggedUserx, () => singleImageSaveOwnerRef.current === owner
            && singleImageProjectRef.current.PostId === context.PostId && singleImageProjectRef.current.Planx === context.Planx
            && singleImageProjectRef.current.creationProjectId === context.creationProjectId);
        }
        if (!(source instanceof Blob)) throw new Error("Image files are not available for uploading.");
        const existing = singleImageSaveJobsRef.current.get(source);
        if (existing) { source = ''; return await existing; }
        let binary: Blob | null = source;
        source = '';
        const owner = Symbol('single-image-save');
        singleImageSaveOwnerRef.current = owner;
        const context = { ...singleImageProjectRef.current };
        let publishedReceipt: StoredImageMedia | null = null;
        let storageCompleted = false;
        const canPublish = () => singleImageSaveOwnerRef.current === owner
          && singleImageProjectRef.current.PostId === context.PostId && singleImageProjectRef.current.Planx === context.Planx
          && singleImageProjectRef.current.creationProjectId === context.creationProjectId
          && (!storageCompleted || (publishedReceipt !== null && singleImageSourceRef.current.preview === publishedReceipt.hdUrl));
        let job: Promise<any> | undefined;
        const onStored = (receipt: StoredImageMedia, adopted: boolean) => {
          if (binary && (!job || singleImageSaveJobsRef.current.get(binary) === job)) singleImageSaveJobsRef.current.delete(binary);
          binary = null;
          storageCompleted = true;
          publishedReceipt = adopted ? storedImageReceipt(receipt) : null;
        };
        job = (async () => {
          const cached = singleImageStoredRef.current.get(binary!);
          if (cached) return PutImagesInS3WithURL(binary!, undefined, enhancedTextData, loggedUserx, canPublish, onStored);
          const response: any = await axios.post(
            `${CLIK_URL}/get_signed_url_image`, { values: { count: 2 } }, { withCredentials: true }
          );
          const signedUrls = response.data.holder?.[0];
          if (!signedUrls?.urlHD || !signedUrls?.urlBase) throw new Error("Missing signed URLs for images.");
          return PutImagesInS3WithURL(binary!, signedUrls, enhancedTextData, loggedUserx, canPublish, onStored);
        })();
        if (binary) singleImageSaveJobsRef.current.set(binary, job);
        try { return await job; }
        finally {
          if (binary && singleImageSaveJobsRef.current.get(binary) === job) singleImageSaveJobsRef.current.delete(binary);
          binary = null;
        }
      } catch (err: any) {
        setError(err.message || "An error occurred while saving the image.");
        throw err;
      }
    },
    [CLIK_URL, prompt, promptx, GeneratedImage, modelz, ratioKey, persistStoredSingleImage]
  );

  const textCol = darkModeReducer ? "#ffffff" : "#000000";
  const blobToPng = (blob: Blob): Promise<Blob> => imageBlobToPng(blob);

  const PutImagesInS3WithURL = useCallback(
    async (source: Blob | null, signedUrls: { urlHD: string; urlBase: string } | undefined,
      enhancedTextData: any, loggedUserx: any, canPublish: () => boolean = () => true,
      onStored?: (receipt: StoredImageMedia, adopted: boolean) => void) => {
      setError("");
      if (!source) throw new Error('Missing processing image file.');
      let stored = singleImageStoredRef.current.get(source);
      if (!stored) {
        if (!signedUrls) throw new Error("Missing signed URLs for images.");
        await axios.put(signedUrls.urlHD, source, {
          headers: { "Content-Type": source.type || "application/octet-stream" },
        });
        let pngBlob: Blob | null = await blobToPng(source);
        await axios.put(signedUrls.urlBase, pngBlob, { headers: { "Content-Type": "image/png" } });
        pngBlob = null;
        stored = { hdUrl: signedUrls.urlHD.split("?")[0], sdUrl: signedUrls.urlBase.split("?")[0] };
        singleImageStoredRef.current.set(source, stored);
      }
      const receipt = storedImageReceipt(stored);
      singleImageStoredVersionsRef.current.set(receipt.hdUrl, receipt);
      let owned: { blob: any; preview: string } | null = singleImageSourceRef.current;
      const adopted = owned.blob === source;
      if (adopted) {
        const preview = owned.preview;
        inheritImageResultModel(preview, [preview, receipt.sdUrl, receipt.hdUrl], receipt.hdUrl);
        const expected = source;
        singleImageSourceRef.current = { blob: null, preview: receipt.hdUrl };
        singleImageCurrentStoredRef.current = receipt;
        setImagesHdCloud(previous => previous.includes(stored!.sdUrl) ? previous : [...previous, stored!.sdUrl]);
        if (preview.startsWith('blob:')) singleImageRevocationsRef.current.add(preview);
        if (preview.startsWith('blob:')) singleImageStoredAliasesRef.current.set(preview, receipt.hdUrl);
        setGeneratedImageFlux(previous => previous === preview ? receipt.hdUrl : previous);
        setGeneratedImageFluxBlob((previous: any) => previous === expected ? null : previous);
        setGeneratedImage(previous => previous.map(value => value === preview ? receipt.hdUrl : value));
        setReferenceImagesManaged(previous => previous.map(reference => reference.imageUrl === preview ? { ...reference, imageUrl: receipt.hdUrl } : reference));
        setSingleImageStoredRevision(version => version + 1);
      }
      owned = null; source = null;
      onStored?.(receipt, adopted);
      // Only URL metadata remains while the optional post write is awaited.
      return await persistStoredSingleImage(receipt, enhancedTextData, loggedUserx, canPublish);
    },
    [promptx, GeneratedImage, prompt, modelz, ratioKey, persistStoredSingleImage, setReferenceImagesManaged]
  );

  /**
   * Detects if the user agent is an iPhone.
   * (Very simple check; can be refined if needed.)
   */
  function isIphone(): boolean {
    return /iPhone/i.test(navigator.userAgent);
  }

  /**
   * Converts an input Blob (PNG/JPEG/etc.) into a resized image Blob at 1080Ã—1920.
   * On iPhone, always use JPEG. On other devices, use WebP.
   *
   * @param inputBlob - The original image as a Blob
   * @returns A Promise resolving to the converted image as a Blob
   */
  async function convertToHDWebpOrJpegByDevice(inputBlob: Blob, modelx: any): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      // Step 1: Read the Blob into a Data URL
      const reader = new FileReader();
      reader.readAsDataURL(inputBlob);

      reader.onload = () => {
        const imageUrl = reader.result as string;
        const img = new Image();

        // Step 2: When the image loads, draw it onto a 1080Ã—1920 canvas
        img.onload = () => {

          const canvas = document.createElement("canvas");

          if (modelx === "Gpt Image") {
            // old GPT image (tall format)
            canvas.width = 1024;
            canvas.height = 1536;
          } else if (modelx === "Imagen") {
            // Google Imagen (square format)
            canvas.width = 1024;
            canvas.height = 1024;
          } else {
            // default (tall format)
            canvas.width = 1080;
            canvas.height = 1920;
          }


          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return reject(new Error("Unable to get 2D context from canvas."));
          }

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Decide the format based on iPhone detection
          const format = isIphone() ? "image/jpeg" : "image/webp";
          /// alert(` Using format ${format}`);

          // Step 3: Convert the canvas to a Blob
          canvas.toBlob(
            (outputBlob) => {
              if (outputBlob) {
                resolve(outputBlob);
              } else {
                reject(new Error("Canvas toBlob returned null."));
              }
            },
            format,
            0.8 // 80% quality
          );
        };

        // Handle errors while loading the image
        img.onerror = (error) => {
          reject(error);
        };

        // Begin loading the image
        img.src = imageUrl;
      };

      // Handle file-reading errors
      reader.onerror = (error) => {
        reject(error);
      };
    });
  }


  // Example usage:
  async function exampleUsage() {
    // Suppose you have a file input or some Blob
    const inputBlob = new Blob(); // Placeholder

    try {
      const convertedBlob = await convertToHDWebpOrJpegByDevice(inputBlob, '');
      console.log("Successfully converted image. Blob:", convertedBlob);
      // Do something with the converted Blob (e.g., upload, display, etc.)
    } catch (e) {
      console.error("Failed to convert image:", e);
    }
  }

  const [blinkOn, setBlinkOn] = useState(true);

  useEffect(() => {
    if (planInfo === 1 || planInfo === 2) {
      const id = setInterval(() => setBlinkOn((b) => !b), 600);

      return () => clearInterval(id);
    }

  }, [planInfo]);



  // Example callback that submits a Flux generation request using the BFL API.

  const [Caret, setCaret] = useState(0);

  const handlePromptShellCaret = (e: any) => {
    const el: any = e.target;

    if (!el || typeof el.selectionStart !== "number") {
      // fallback if something weird gets focused
      return 0;
    }

    const caretIndex = el.selectionStart ?? 0;

    // ðŸ‘‰ use this however you want:
    console.log("caretIndex:", caretIndex);

    setCaret(caretIndex);

    ///alert( caretIndex);

    // setShellCaretIndex(caretIndex); // if you have state for it

    return caretIndex;
  };





  // Add a new piece of state to track poll status flux pro
  const [pollStatus, setPollStatus] = useState<string>("");


  // Example updated handleSubmitFluxImage
  const handleSubmitSdxlImageRepli = useCallback(
    async (
      imageUrlFromSdxl: string,   // optional image URL from another model
      enhancedPrompt: string,     // user prompt
      loggedUserx: any            // user object
    ) => {


      setIsSubmitting(true);
      setPollStatus("Polling Replicate...");

      setBig(false);

      const singleImgAttemptId = `pi-img:${creationProjectId || 'active'}:composer:single:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      dispatch(recordCreationAttemptStart({
        attemptId: singleImgAttemptId,
        projectId: creationProjectId,
        mediaKind: 'image',
        targetKey: 'composer:single',
      }));

      try {
        let base64Image = "";

        // If we have an image URL from SDXL (or anywhere)
        if (imageUrlFromSdxl && imageUrlFromSdxl.trim() !== "") {
          const imageResponse = await fetch(imageUrlFromSdxl);
          if (!imageResponse.ok) {
            throw new Error(
              `Failed to fetch image: ${imageResponse.statusText}`
            );
          }
          const imageBlob = await imageResponse.blob();

          // Convert Blob -> base64
          base64Image = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(imageBlob);
          });
        }

        // Build the payload
        const payload: any = {
          inputs: enhancedPrompt,
          // any extra parameters you need
          width: 1080,
          height: 1920,
          guidance: 7.5,
          num_inference_steps: 35,
          billingAction: "style-image",
        };

        // Conditionally include the image if available
        var url = 'sdxlReplicatePro';

        if (base64Image) {
          payload.image = base64Image;
          url = 'sdxlReplicate';
        }

        // Make the POST request
        const response: any = await axios.post(`${CLIK_URL}/${url}`, payload, {
          withCredentials: true,
        });

        if (response.status !== 200) {
          throw new Error(`FluxSchnell route error: ${response.status}`);
        }

        // Extract final base64 from server
        const { imageBase64 } = response.data;
        if (!imageBase64) {
          throw new Error("No imageBase64 returned from server");
        }

        // Convert the returned base64 back to a Blob
        const fluxImageBlob = await (async () => {
          const fetchRes = await fetch(imageBase64);
          return await fetchRes.blob();
        })();

        // Now do whatever you need (convert to HD, etc.)
        const finalBlob = await convertToHDWebpOrJpegByDevice(fluxImageBlob, '');
        const finalUrl = URL.createObjectURL(finalBlob);




        setGeneratedImage([finalUrl]);

        if (matchMobile) {
          setMinimizeMode(0);
        }

        handleSubmitFluxImage(finalUrl, enhancedPrompt, loggedUserx, 2200);
        dispatch(recordCreationAttemptSuccess({
          attemptId: singleImgAttemptId,
          projectId: creationProjectId,
          mediaKind: 'image',
          targetKey: 'composer:single',
        }));

      } catch (err) {
        console.error("Error calling Flux Inference Endpoint:", err);
        const fluxErrText = err?.response?.data?.message || err?.message || 'Image generation failed';
        dispatch(recordCreationAttemptFailure({
          attemptId: singleImgAttemptId,
          projectId: creationProjectId,
          mediaKind: 'image',
          targetKey: 'composer:single',
          message: `Image generation failed: ${fluxErrText}`,
        }));
        dispatch(patchUserSnapshot({ creation: { isGenerating: false } }));
        setPollStatus("Failed!");
      }
    },
    [prompt, modelz]
  );

  const [parsedKeyPoints2, setParsedKeyPoints2] = usePersistedCreationState<string[]>(creationDraft, 'prompt', 'parsedKeyPoints2', []);

  const narrationPreparationKey = JSON.stringify([creationProjectId, type, languageModel, parsedKeyPoints, prompt]);
  const narrationSummaryAllowed = Boolean(draftHydrated && creationProjectId && parsedKeyPoints.length
    && type !== 0 && type !== 3 && !(type === 1 && promptMusicUrl));

  const narrationSummaryLive = useRef({ key: narrationPreparationKey, allowed: narrationSummaryAllowed });
  narrationSummaryLive.current = { key: narrationPreparationKey, allowed: narrationSummaryAllowed };
  const stagePromptCache: Record<number, string> = {};

  useEffect(() => {
    if (!narrationSummaryAllowed || narrationPreparedFor === narrationPreparationKey) return;
    const key = narrationPreparationKey;
    let cancelled = false;
    const current = () => !cancelled && narrationSummaryLive.current.key === key && narrationSummaryLive.current.allowed;
    const failed = failedNarrationSummaries.current.get(key);
    if (failed) { setNarrationSummaryError({ key, message: failed }); return; }
    setNarrationSummaryError(null);
    // The existing request owner retains accepted work through Off/On. A stale
    // subscriber cannot write into another project or scene/prompt revision.
    void narrationSummaryRequests.current.run(key,
      () => narrationSummaryLive.current.key === key && narrationSummaryLive.current.allowed,
      () => StartNarrateSummary(parsedKeyPoints2, prompt)).then(result => {
        if (!current()) return;
        setParsedKeyPoints2(result);
        setNarrationPreparedFor(key);
        setNarrationSummaryError(null);
      }).catch(error => {
        if (error instanceof CreationWorkPaused) return;
        const message = 'Narration preparation failed. Retry, or turn narration off to continue.';
        failedNarrationSummaries.current.set(key, message);
        if (current()) setNarrationSummaryError({ key, message });
      });
    return () => { cancelled = true; };
  }, [narrationPreparationKey, narrationSummaryAllowed, narrationSummaryRetry]);

  const retryNarrationSummary = () => {
    failedNarrationSummaries.current.delete(narrationPreparationKey);
    setNarrationSummaryError(null);
    setNarrationSummaryRetry(value => value + 1);
  };


  useEffect(() => {

    console.log('Sumarrrrrrrrrrrrrrrrry 4 TTS', parsedKeyPoints2)
  }, [parsedKeyPoints2])

  const StartNarrateSummary = async (
    steps: string[],          // ðŸ‘ˆ ALL scenes in an array
    prompt: string,           // keep if you still need it
    _i?: any,                 // no longer needed, but kept so calls don't break
    _last?: boolean,
    _first?: boolean
  ) => {
    // setIsLoading?.(true); // optional spinner

    try {
      // ðŸ‘‡ IMPORTANT: we send steps (array), not step
      const requestData = {
        keyPoints: steps,     // ðŸ‘ˆ backend reads this array
        prompt,              // you can drop this if backend doesn't use it
        llmTier: languageModel,
      };

      const tt = "narrateSummary";

      const response = await axios.post<{
        message: string;
        narrationSteps: {
          keyPoints: string[];   // <- narrations for each scene
        };
      }>(`${CLIK_URL}/${tt}`, requestData, { withCredentials: true });

      const { message, narrationSteps } = response.data || {};

      if (
        !narrationSteps ||
        !Array.isArray(narrationSteps.keyPoints) ||
        !narrationSteps.keyPoints.length
      ) {
        throw new Error("Invalid narrationSteps received from server.");
      }

      // Optional safety: warn if lengths don't match
      if (narrationSteps.keyPoints.length !== steps.length) {
        console.warn(
          "Narration length mismatch:",
          "input =", steps.length,
          "output =", narrationSteps.keyPoints.length
        );
      }

      console.log("Narration Summary:", narrationSteps.keyPoints);
      if (message) console.log("Server Message:", message);

      // ðŸ”¥ Update your narration array 1:1 with original scenes
      // Only the current request subscriber may commit this result.

      return narrationSteps.keyPoints;
    } catch (error: any) {
      // Do not mutate editor/global error state from a potentially stale request.
      throw error;
    }
  };


  // Example updated handleSubmitFluxImage
  const handleSubmitFluxImage = useCallback(
    async (
      imageUrlFromSdxl: string,   // optional image URL from another model
      enhancedPrompt: string,     // user prompt
      loggedUserx: any,
      seed: any         // user object
    ) => {
      setIsSubmitting(true);
      setPollStatus("Polling Replicate...");

      setBig(false);

      const singleImgAttemptId = `pi-flux:${creationProjectId || 'active'}:composer:flux_followup:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      dispatch(recordCreationAttemptStart({
        attemptId: singleImgAttemptId,
        projectId: creationProjectId,
        mediaKind: 'image',
        targetKey: 'composer:flux_followup',
      }));

      try {
        let base64Image = "";

        // If we have an image URL from SDXL (or anywhere)
        if (imageUrlFromSdxl && imageUrlFromSdxl.trim() !== "") {
          const imageResponse = await fetch(imageUrlFromSdxl);
          if (!imageResponse.ok) {
            throw new Error(
              `Failed to fetch image: ${imageResponse.statusText}`
            );
          }
          const imageBlob = await imageResponse.blob();

          // Convert Blob -> base64
          base64Image = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(imageBlob);
          });
        }

        // Build the payload
        const payload: any = {
          inputs: enhancedPrompt,
          // any extra parameters you need
          width: 1080,
          height: 1920,
          guidance: 7.5,
          num_inference_steps: 35,
          seed: seed,
          ty: ratioKey,
          Png: true,
          model: modelz,
          billingAction: "scene-image",
        };

        // Conditionally include the image if available
        var url = "fluxschnell";


        if (modelz === 'code not in use anymore goto storybook') {
          ///  url = 'fluxPro';

          if (base64Image) {
            payload.image = base64Image;
            url = 'Bannana';
          }
        } else if (modelz === 'Schnell') {
          url = 'fluxschnell';

        } else if (modelz === 'Hi Dream') {

          url = 'HiDream';
        }
        else if (modelz === 'minimax') {

          url = 'minimax';
        }
        else if (modelz === 'Imagen') {

          url = 'Imagen';
        }
        else if (getGptImageRoute(modelz)) {

          url = getGptImageRoute(modelz)!;
        } else {

          url = 'fluxschnell';


        }



        // Make the POST request
        const response: any = await axios.post(`${CLIK_URL}/${url}`, payload, {
          withCredentials: true,
        });

        if (response.status !== 200) {
          throw new Error(`FluxSchnell route error: ${response.status}`);
        }
        setLoader(100);


        setTimeout(async () => {


          // Extract final base64 from server
          const { imageBase64 } = response.data;
          if (!imageBase64) {
            throw new Error("No imageBase64 returned from server");
          }

          // Convert the returned base64 back to a Blob
          const fluxImageBlob = await (async () => {
            const fetchRes = await fetch(imageBase64);
            return await fetchRes.blob();
          })();

          // Now do whatever you need (convert to HD, etc.)
          const finalBlob = await convertToHDWebpOrJpegByDevice(fluxImageBlob, modelz);
          const finalUrl = URL.createObjectURL(finalBlob);

          // Show it in your UI
          recordGeneratedImageModel(imageModelForGenerationRoute(url, response.data?.model), [finalUrl]);
          setGeneratedImageFlux(finalUrl);
          setGeneratedImageFluxBlob(finalBlob);
          setenhancedPromptx(enhancedPrompt);

          setIsSubmitting(false);

          // Optionally push it to your storage

          /// GenerateSignedUrl(finalBlob, enhancedPrompt, loggedUserx);
          setBig(true);
          setPollStatus("Succeeded");
          if (matchMobile) {
            setMinimizeMode(0);
          }

          dispatch(recordCreationAttemptSuccess({
            attemptId: singleImgAttemptId,
            projectId: creationProjectId,
            mediaKind: 'image',
            targetKey: 'composer:flux_followup',
          }));
        }, 1000)



      } catch (err) {
        setLoader(100);
        console.error("Error calling Flux Inference Endpoint:", err);
        const fluxFollowupErr = err?.response?.data?.message || err?.message || 'Image generation failed';
        dispatch(recordCreationAttemptFailure({
          attemptId: singleImgAttemptId,
          projectId: creationProjectId,
          mediaKind: 'image',
          targetKey: 'composer:flux_followup',
          message: `Image generation failed: ${fluxFollowupErr}`,
        }));
        setPollStatus("Failed!");
      }
    },
    [prompt, modelz]
  );




  type ModelName = 'Schnell' | 'Hi Dream' | 'minimax' | 'Gpt Image' | 'Imagen' | 'fluxUltra' | 'seeDream' | 'fluxDev'
    | 'Bannana' | 'Imagenx' | 'minimax2' | 'Imagen2' | 'fluxUltra2';

  interface Model {
    name: ModelName;
    img: string;
  }

  const models: Model[] = (['Imagen', 'Gpt Image', 'fluxUltra', 'minimax', 'Schnell'] as ModelName[]).map(name => ({ name, img: '' }));
  const exampleSets = useSelector((state: RootState) => state.imageModelExamples.sets);

  const [open, setOpen] = useState(false);
  const [hasOpenedModelSelection, setHasOpenedModelSelection] = useState(false);
  useEffect(() => {
    if (open) setHasOpenedModelSelection(true);
  }, [open]);

  useEffect(() => {
    dispatch(setCreationSelectionDialogOpen(open || styleModalOpen));
  }, [dispatch, open, styleModalOpen]);

  useEffect(() => () => {
    dispatch(setCreationSelectionDialogOpen(false));
  }, [dispatch]);

  // Previously swapped FluxUltra -> Kontext whenever a reference image was
  // present, because Flux Max could not take references. Nano Banana 2 Lite
  // does, so the model no longer changes underneath the user.

  const prettyLabel = modelz.charAt(0).toUpperCase() + modelz.slice(1);

  const handleSelect = (name: string, image: any) => {

    dispatch(setModel(name));
    dispatch(setImageModelPreview(image ? { model: name, url: String(image) } : null));
    setModelz(name);
    setOpen(false);

  };


  useEffect(() => {

    dispatch(setPromptRed(prompt));
  }, [prompt]);



  useEffect(() => {

    setTimeout(() => {

      if (modelRedux) {
        //   alert(modelRedux);
        setModelz(modelRedux);
      }

      if (promptRedux) {
        //alert(promptRedux)
        setPrompt(promptRedux)
      }

      if (artstyleRedux && artstyleRedux !== selectedStyle) {

        setSelectedStyle(artstyleRedux);
      }

    }, 500)


  }, [artstyleRedux]);


  //GeneratedImage

  useEffect(() => {
    ///if (type === 3) { handleCycle() }

    if (modelz === 'Imagen') { //handleCyclex()
    }

  }, [location.pathname, type, ratioKey, modelz])


  const handleSubmitFlux = useCallback(
    async (enhancedPrompt: string, loggedUserx: any) => {
      try {
        // If you're controlling any UI state (loading, labels, etc.)
        // from your original code, you can keep those here:
        settextchange(false);
        setIsSubmitting(true);
        setLabel('Loading Hd: 10secs');
        setShowLabel(true);

        // Construct the payload WITHOUT extra image data
        const payload = {
          inputs: enhancedPrompt,


        };

        const fluxEndpoint =
          'https://slll6h6mzbbr88gv.us-east-1.aws.endpoints.huggingface.cloud';

        const response = await fetch(fluxEndpoint, {
          method: 'POST',
          headers: {
            Accept: 'image/png',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VITE_HUGG}`, // replace with your token variable
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Flux API Error: ${response.status} - ${errorData}`);
        }

        // Stop ping timer if you have one
        setAllowPing(false);

        // Convert the Flux response into a Blob (PNG)
        let fluxImageBlob: Blob | null = await response.blob();

        const fluxImageUrl = URL.createObjectURL(fluxImageBlob);
        setGeneratedImageFlux(fluxImageUrl);
        setGeneratedImageFluxBlob(fluxImageBlob);
        const saving = GenerateSignedUrl(fluxImageBlob, enhancedPrompt, loggedUserx);
        fluxImageBlob = null;
        await saving;

        // Reset or finalize UI state
        setIsSubmitting(false);
        setIsFluxOnTop(true);


      } catch (err) {

        /// handleCloseOverlay();

        console.error('Error calling Flux Inference Endpoint:', err);
        setIsSubmitting(false);
        // Optionally handle errors in your UI
      }
    },
    [/* dependencies if needed */]
  );


  // helpers/s3.ts
  const putToS3 = async (blob: Blob): Promise<string> => {
    /* A. get signed URL */
    const { data }: any = await axios.post(
      `${CLIK_URL}/get_signed_url_image`,
      { values: { count: 2 } },
      { withCredentials: true }
    );

    const signed = data.holder?.[0];
    if (!signed?.urlHD) throw new Error("Bad signed-URL response");

    /* B. PUT the file */
    const putRes = await axios.put(signed.urlHD, blob, {
      headers: { "Content-Type": blob.type || "application/octet-stream" }
    });
    if (![200, 204].includes(putRes.status)) {
      throw new Error(`Upload failed: ${putRes.status}`);
    }

    /* C. Return the public URL (no query-string) */
    return signed.urlHD.split("?")[0];
  };

  const handleReferenceImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    const targetKey = referenceUploadTargetKeyRef.current;
    input.value = '';
    referenceUploadTargetKeyRef.current = null;
    if (!file || !targetKey) return;

    const targetRef = referenceImagesRef.current.find(reference => getReferenceEditKey(reference) === targetKey);
    if (!targetRef || isReferenceWorking(targetRef)) return;
    if (file.type && !file.type.startsWith('image/')) {
      alert('Choose an image file.');
      return;
    }
    const renderToken = referenceRenderClaims.current.begin(targetKey, 'manual');
    if (!renderToken) return;
    let succeeded = false;
    updateReferenceImages(previous => previous.map(reference =>
      getReferenceEditKey(reference) === targetKey ? { ...reference, isUploading: true } : reference
    ));

    try {
      const blob = await imageBlobToPng(file);
      // The character may have been removed while decoding the file.
      if (!referenceImagesRef.current.some(reference => getReferenceEditKey(reference) === targetKey)) return;
      const publicUrl = await putToS3(blob);
      if (!publicUrl) throw new Error('The character upload did not return a usable image.');
      Saveprompthelperfordellater(publicUrl);
      recordGeneratedImageModel('uploaded', [publicUrl]);
      updateReferenceImages(previous => previous.map(reference => {
        if (getReferenceEditKey(reference) !== targetKey || !referenceRenderClaims.current.owns(targetKey, renderToken)) return reference;
        succeeded = true;
        return applyReferenceImageReplacement(reference, publicUrl);
      }));
    } catch (error) {
      console.error('Failed to replace character image:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload character image.');
    } finally {
      referenceRenderClaims.current.finish(targetKey, renderToken, succeeded);
      if (!succeeded) {
        updateReferenceImages(previous => previous.map(reference =>
          getReferenceEditKey(reference) === targetKey ? { ...reference, isUploading: false } : reference
        ));
      }
    }
  };





  const clearVipDraft = useCallback(() => {
    const previewUrl = vipDraftRef.current?.previewUrl;
    if (previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    vipDraftRef.current = null;
    setVipDraft(null);
  }, []);

  const closeVipDialog = useCallback(() => {
    setShowVipPopup(false);
    clearVipDraft();
  }, [clearVipDraft]);

  const handleVipCreate = useCallback(async ({ name, description, imageBlob }: ManualCharacterInput) => {
    const publicUrl = await putToS3(imageBlob);
    Saveprompthelperfordellater(publicUrl);

    console.log("attached image to prompt url", publicUrl);
    setGeneratedImage((prev: any) => [...prev, publicUrl]);
    setGotIm(true);

    const newVip = { name, description, imageUrl: publicUrl, source: "upload" };
    setVipcharacters((prev) => [...prev, newVip]);
    closeVipDialog();
  }, [closeVipDialog]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const preparedImage = await prepareManualCharacterImage(file, ratioKey);
      clearVipDraft();
      setVipDraft(preparedImage);
      setShowVipPopup(true);
    } catch (err) {
      console.error("Failed to prepare character image", err);
      alert(err instanceof Error ? err.message : "Failed to prepare character image");
    } finally {
      event.target.value = "";
    }
  };


  const handleImageSubmit = useCallback((enhancedTextx: any, loggedUserx: any, seed: any) => {


    if (GeneratedImage) {
      ///alert('im');
      handleSubmitSdxlImageRepli(GeneratedImage, enhancedTextx, loggedUserx);

    } else {
      //alert('no');
      ///handleSubmitSdxlImageRepli('', enhancedTextx, loggedUserx);

      handleSubmitFluxImage('', enhancedTextx, loggedUserx, seed);
    }
  }, [GeneratedImage, modelz]);



  // Self-heal: a VIP reference card must always show the uploaded image, even if
  // the card was created blank by older state. Recreation still overwrites it.
  useEffect(() => {
    if (!Vipcharacters || Vipcharacters.length === 0) return;
    updateReferenceImages(prev => {
      let changed = false;
      const next = prev.map(r => {
        if (!r.imageUrl) {
          const vip = Vipcharacters.find((v: any) => v?.imageUrl && referenceNamesMatch(v.name, r.name));
          if (vip) { changed = true; return { ...r, imageUrl: vip.imageUrl }; }
        }
        return r;
      });
      return changed ? next : prev;
    });
  }, [referenceImages, Vipcharacters]);

  const runReferenceImageGeneration = async (castingPrompts: any[], castingId?: number) => {
    if (!castingPrompts || castingPrompts.length === 0) return;
    if (castingId && latestCastingIdRef.current !== castingId) return;
    if (isGeneratingRefsRef.current) return; // LOCK
    isGeneratingRefsRef.current = true;
    const generationRun = Symbol('reference-generation');
    referenceGenerationRunRef.current = generationRun;
    const generationIsCurrent = () => referenceGenerationRunRef.current === generationRun && (!castingId || latestCastingIdRef.current === castingId);

    setCastingStatus("Generating reference images...");
    setReferenceLoading(true);
    setReferencePendingCount(castingPrompts.length);
    // Initialize empty slots without spinners and keep the first generated prompt as the default.
    updateReferenceImages(prev => {
      const next = prev.map(ref => {
        const match = findRefByName(castingPrompts, ref.name);
        if (match) {
          const manualVipClaim = ref.clientReferenceId
            ? manualVipRenderClaimsRef.current.get(ref.clientReferenceId)
            : undefined;
          const manualVipRenderPending = Boolean(manualVipClaim?.pending.size);
          const manualVipRenderClaimed = Boolean(
            manualVipClaim?.completed || manualVipRenderPending || ref.hasManualImage
            || referenceRenderClaims.current.working(ref.clientReferenceId)
            || referenceRenderClaims.current.done(ref.clientReferenceId)
          );
          const shouldReplaceVipPrompt = !!(
            Vipcharacters?.some((v: any) =>
              v?.imageUrl && referenceNamesMatch(v.name, ref.name)
            )
          ) && !manualVipRenderClaimed;
          return {
            ...ref,
            prompt: shouldReplaceVipPrompt ? match.imagePrompt : (ref.prompt || match.imagePrompt),
            originalPrompt: shouldReplaceVipPrompt ? match.imagePrompt : (ref.originalPrompt || match.imagePrompt),
            isGenerating: referenceRenderClaims.current.working(getReferenceEditKey(ref)) ? ref.isGenerating : false
          };
        }
        return ref;
      });
      return next;
    });

    let successCount = 0;

    const renderOne = async (item: any) => {
      let latestRef = findRefByName(referenceImagesRef.current, item.name);
      const referenceId = latestRef && getReferenceEditKey(latestRef);
      if (!referenceId) { setReferencePendingCount(prev => Math.max(0, prev - 1)); return; }
      if (referenceRenderClaims.current.working(referenceId)) {
        await referenceRenderClaims.current.wait(referenceId);
        latestRef = findRefByName(referenceImagesRef.current, item.name);
      }
      if (!latestRef) { setReferencePendingCount(prev => Math.max(0, prev - 1)); return; }
      if (!generationIsCurrent()) return;

      // Keep the established defaults, with a per-reference choice for this render.
      const vipMatch = Vipcharacters?.find((v: any) => v?.imageUrl && referenceNamesMatch(v.name, item.name));
      const vipUpgrade = !!vipMatch;
      const generationMode = getReferenceImageGenerationMode(latestRef, vipMatch);
      const inputImage = generationMode === 'edit' ? getReferenceGenerationInput(latestRef, vipMatch) : '';

      // A VIP still needs its first storyboard render (its imageUrl is only the
      // upload), but once rendered it is skipped exactly like any other ref —
      // so manually created images are never regenerated.
      const alreadyRendered = referenceRenderClaims.current.done(referenceId);
      const manualVipClaim = latestRef?.clientReferenceId
        ? manualVipRenderClaimsRef.current.get(latestRef.clientReferenceId)
        : undefined;
      const vipRenderAlreadyClaimed = alreadyRendered || Boolean(
        manualVipClaim?.completed || manualVipClaim?.pending.size
      );
      if (latestRef?.imageUrl && (!vipUpgrade || vipRenderAlreadyClaimed)) {
        successCount++;
        setReferencePendingCount(prev => Math.max(0, prev - 1));
        return;
      }
      const renderToken = referenceRenderClaims.current.begin(referenceId, 'automatic');
      if (!renderToken) { setReferencePendingCount(prev => Math.max(0, prev - 1)); return; }
      const originalMedia = referenceMedia(latestRef);
      let ownedMedia = originalMedia;
      const ownsRender = (reference: ReferenceImageItem) => generationIsCurrent()
        && referenceRenderClaims.current.owns(referenceId, renderToken) && referenceMedia(reference) === originalMedia;
      let succeeded = false;
      try {

      // Claim this name the moment the render STARTS, not when it finishes.
      // Stamping on success left a window where a second pass could kick off a
      // duplicate render for the same character while the first was still in
      // flight — paid twice, one result thrown away.
      renderedRefsRef.current[renderedRefKey(item.name)] = true;

      const url = getReferenceGenerationRoute(modelz, generationMode);

      let calcWidth = 1080;
      let calcHeight = 1920;
      if (ratioKey === 3) { calcWidth = 1920; calcHeight = 1080; }
      else if (ratioKey === 2) { calcWidth = 1080; calcHeight = 1080; }
      else if (ratioKey === 1) { calcWidth = 1080; calcHeight = 1920; }

      const payload: any = {
        inputs: referencePromptDraftsRef.current.get(referenceId) || latestRef?.prompt || item.imagePrompt,
        width: calcWidth,
        height: calcHeight,
        guidance: 7.5,
        num_inference_steps: 35,
        seed: Seed,
        ty: ratioKey,
        Png: true,
        linkmode: PROMPTINPUT_CHARACTER_LINK_MODE,
        model: modelz,
        billingAction: item.type === "environment" ? "environment-image" : "character-image",
        billingReference: item.name,
      };
      if (inputImage) {
        payload.sampleImages = [inputImage];
        payload.sampleimagesnames = [{ ...latestRef, imageUrl: inputImage, url: inputImage, image: inputImage }];
      }

      const executeGeneration = async (attempt: number) => {
        try {
          const imgRes: any = await axios.post(`${CLIK_URL}/${url}`, payload, { withCredentials: true });
          if (!generationIsCurrent()) return false;
          const generatedImageSource = PROMPTINPUT_CHARACTER_LINK_MODE
            ? imgRes.data?.imageUrl
            : imgRes.data?.imageBase64;

          if (generatedImageSource) {
            let finalUrl = generatedImageSource;
            try {
              const fetchRes = await fetch(generatedImageSource);
              if (!fetchRes.ok) throw new Error(`Character image fetch failed: ${fetchRes.status}`);
              const blob = await fetchRes.blob();
              const publicUrl = await putToS3(blob);
              if (publicUrl) {
                finalUrl = publicUrl;
                Saveprompthelperfordellater(publicUrl);
              }
            } catch (s3Err) {
              console.error("Failed to upload character to S3:", s3Err);
            }
            if (!generationIsCurrent()) return false;

            const enableUpscale = true; // Auto-upscale after creation

            // Keep 'isGenerating' true during upscale so the normal loading state remains active
            updateReferenceImages(prev => {
              const updated = [...prev];
              const targetIdx = updated.findIndex(reference => getReferenceEditKey(reference) === referenceId);
              if (targetIdx !== -1) {
                const current = updated[targetIdx];
                if (!ownsRender(current)) {
                  return updated;
                }
                updated[targetIdx] = {
                  ...current,
                  imageUrl: finalUrl,
                  url: finalUrl,
                  image: finalUrl,
                  renderProvenance: generatedReferenceProvenance(finalUrl, payload.inputs, inputImage),
                  prompt: current.prompt || payload.inputs,
                  originalPrompt: current.originalPrompt || payload.inputs,
                  isGenerating: enableUpscale,
                  isUpscaling: enableUpscale
                } as any;
                ownedMedia = finalUrl;
              }
              return updated;
            });

            // Perform auto-upscale
            if (!referenceRenderClaims.current.owns(referenceId, renderToken)
              || !referenceImagesRef.current.some(reference => getReferenceEditKey(reference) === referenceId && referenceMedia(reference) === finalUrl)) return false;
            if (enableUpscale) {
              try {
                const upscaleRes: any = await axios.post(`${CLIK_URL}/upscaleImage`, {
                  url: generatedImageSource,
                  linkmode: PROMPTINPUT_CHARACTER_LINK_MODE,
                  billingAction: "image-upscale",
                  billingReference: item.name,
                });
                if (!generationIsCurrent()) return false;
                if (upscaleRes.data && upscaleRes.data.url) {
                  let upscaledFinalUrl = upscaleRes.data.url;
                  if (PROMPTINPUT_CHARACTER_LINK_MODE) {
                    const upscaleFetchRes = await fetch(upscaleRes.data.url);
                    if (!upscaleFetchRes.ok) {
                      throw new Error(`Upscaled character fetch failed: ${upscaleFetchRes.status}`);
                    }
                    const upscaledBlob = await upscaleFetchRes.blob();
                    upscaledFinalUrl = await putToS3(upscaledBlob);
                    Saveprompthelperfordellater(upscaledFinalUrl);
                  }
                  if (!generationIsCurrent()) return false;
                  updateReferenceImages(prev => {
                    const updated = [...prev];
                    const targetIdx = updated.findIndex(reference => getReferenceEditKey(reference) === referenceId);
                    if (targetIdx !== -1) {
                      const current = updated[targetIdx];
                      if (referenceRenderClaims.current.owns(referenceId, renderToken) && referenceMedia(current) === finalUrl) {
                        updated[targetIdx] = {
                          ...current,
                          renderProvenance: upscaledReferenceProvenance(current, upscaledFinalUrl),
                          imageUrl: upscaledFinalUrl,
                          url: upscaledFinalUrl,
                          image: upscaledFinalUrl,
                          isGenerating: false,
                          isUpscaling: false
                        } as any;
                        ownedMedia = upscaledFinalUrl;
                      }
                    }
                    return updated;
                  });
                } else {
                  throw new Error("No URL returned from upscale API");
                }
              } catch (upscaleErr) {
                console.error("Auto-upscale failed for", item.name, upscaleErr);
                // Remove the loading overlay on failure but keep the base image
                updateReferenceImages(prev => {
                  const updated = [...prev];
                  const targetIdx = updated.findIndex(reference => getReferenceEditKey(reference) === referenceId);
                  if (targetIdx !== -1 && generationIsCurrent() && referenceRenderClaims.current.owns(referenceId, renderToken) && referenceMedia(updated[targetIdx]) === finalUrl) {
                    updated[targetIdx] = { ...updated[targetIdx], isGenerating: false, isUpscaling: false } as any;
                  }
                  return updated;
                });
              }
            }

            setReferencePendingCount(prev => Math.max(0, prev - 1));

            successCount++;
            try { setAvailablePixels(await getPixel()); }
            catch (balanceError) { console.warn('Automatic character image retained; balance refresh failed.', balanceError); }
            return true; // success
          }
          return false;
        } catch (imgErr) {
          console.error(`Failed to generate reference image for ${item.name} (attempt ${attempt}):`, imgErr);
          // Release the claim so a genuine failure can be retried.
          delete renderedRefsRef.current[renderedRefKey(item.name)];
          return false;
        }
      };

      // Set generating status for this specific image to show the spinner.
      updateReferenceImages(prev => {
        const updated = [...prev];
        const targetIdx = updated.findIndex(reference => getReferenceEditKey(reference) === referenceId);
        if (targetIdx !== -1) {
          const current = updated[targetIdx];
          if ((!current.imageUrl || vipUpgrade) && !current.isGenerating) {
            updated[targetIdx] = { ...current, isGenerating: true };
          }
        }
        return updated;
      });

      let success = await executeGeneration(1);
      if (!success) {
        if (generationIsCurrent()) setReferencePendingCount(prev => Math.max(0, prev - 1));
      }

      succeeded = success;
      } finally {
        // Cancellation may happen after this owner installed its base image.
        // Release only its current media flags, even after the casting run changed.
        if (referenceRenderClaims.current.owns(referenceId, renderToken)) updateReferenceImages(prev => prev.map(reference =>
          getReferenceEditKey(reference) === referenceId && referenceMedia(reference) === ownedMedia && (reference.isGenerating || reference.isUpscaling)
            ? { ...reference, isGenerating: false, isUpscaling: false } : reference));
        referenceRenderClaims.current.finish(referenceId, renderToken, succeeded);
      }
    };
    let completedCurrentRun = false;
    const batchAttemptId = `pi-cast:${creationProjectId || 'active'}:character_batch:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    dispatch(recordCreationAttemptStart({
      attemptId: batchAttemptId,
      projectId: creationProjectId,
      mediaKind: 'character',
      targetKey: 'character_batch',
    }));
    try {
      await runReferenceWorkers(castingPrompts, renderOne, generationIsCurrent);
      completedCurrentRun = generationIsCurrent();
    } finally {
      if (referenceGenerationRunRef.current === generationRun) {
        referenceGenerationRunRef.current = null;
        isGeneratingRefsRef.current = false;
        setReferenceLoading(false);
        setQueuedCastingPrompts([]);
        setReferencePendingCount(0);
      }
    }

    if (!completedCurrentRun) return;

    if (successCount === castingPrompts.length) {
      dispatch(recordCreationAttemptSuccess({
        attemptId: batchAttemptId,
        projectId: creationProjectId,
        mediaKind: 'character',
        targetKey: 'character_batch',
      }));
      setCastingStatus("Reference images ready!");
      if (isRevisitingCharacterRef.current) {
        setStudioButtonStage('post-continue');
        setStudioActionTimer(null);
      } else {
        setStudioButtonStage('post-countdown');
        setStudioActionTimer(20);
      }
    } else {
      setCastingStatus(`Finished with errors: ${castingPrompts.length - successCount} failed.`);
      dispatch(recordCreationAttemptFailure({
        attemptId: batchAttemptId,
        projectId: creationProjectId,
        mediaKind: 'character',
        targetKey: 'character_batch',
        message: `Character reference generation: ${castingPrompts.length - successCount} image(s) failed.`,
      }));
      setStudioButtonStage('post-continue');
    }
  };

  const handleSubmitSdxl = useCallback(async (enhancedText: any, loggedUserx: any) => {
    // Immediately show loader
    setIsSubmitting(true);

    // Keep forcing the loader to true on an interval
    const intervalId = setInterval(() => {
      setIsSubmitting(true);
    }, 500);

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError("Prompt cannot be empty.");
      return;
    }

    try {
      const response = await fetch(
        "https://mjuutqlkaw0l3v21.us-east-1.aws.endpoints.huggingface.cloud",
        {
          method: "POST",
          headers: {
            Accept: "image/png",
            "Content-Type": "application/json",
            Authorization: `Bearer ${VITE_HUGG}`,
          },
          body: JSON.stringify({
            inputs: trimmedPrompt,
            parameters: {
              height: 1024,
              width: 1024,
              num_inference_steps: 35,
              guidance_scale: 7.5,
            },
          }),
        }
      );

      if (response.ok) {

        setAllowPing(false);
        ///setIsFluxOnTop(true);

        const imageBlob = await response.blob();
        //setGeneratedImageBlob(imageBlob);
        const imageUrl = URL.createObjectURL(imageBlob);
        // setGeneratedImage(imageUrl);

        setim(true)

        ///handleSubmitFlux(imageUrl)

        ///EnhanceText(prompt, imageUrl, loggedUser);

        handleSubmitFluxImage(imageUrl, enhancedText, loggedUserx, 100)


        ///setIsSubmitting(true); // Set loading state
        /// setLabel('Loading Hd: 10secs');
        /// setShowLabel(true);
      } else {
        setAllowPing(true);
        /// handleSubmitDefaultSdxl();
      }
    } catch (err) {

      /// handleCloseOverlay();
      console.error("Error calling Hugging Face Inference Endpoint:", err);
      setError("An error occurred while generating the image. Please try again.");
    } finally {
      // Clear the interval and hide loader
      clearInterval(intervalId);
      // setIsSubmitting(false);
    }
  }, [prompt, loggedUser, modelz]);

  const handleSubmitDefaultSdxl = useCallback(async () => {
    setGeneratedImageFlux('');

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError("Prompt cannot be empty.");
      return;
    }

    setIsSubmitting(true); // Set loading state
    console.log('using Serverless Api');
    try {
      // Make the fetch request to the Hugging Face Inference Endpoint
      const response = await fetch(
        "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0", // Replace with your actual endpoint URL
        {
          method: "POST",
          headers: {
            Accept: "image/png", // Request image response
            "Content-Type": "application/json", // Specify JSON format for request
            Authorization: `Bearer ${VITE_HUGG}`, // Hugging Face API token
          },
          body: JSON.stringify({
            inputs: trimmedPrompt,
            parameters: {
              height: 1024, // Optional: Specify image height
              width: 1024,  // Optional: Specify image width
              num_inference_steps: 50, // Optional: Number of steps for better image quality
              guidance_scale: 7.5, // Optional: Higher value for better adherence to prompt
            },
          }),
        }
      );

      // Convert the Blob response into a URL for display
      const imageBlob = await response.blob();
      const imageUrl = URL.createObjectURL(imageBlob);

      // Update your state to display the image
      //  if (imageUrl) { setGeneratedImage(imageUrl); }
      // setIsSubmitting(false);

      // Clear input and error
      // setPrompt("");
      setError("");

      if (response.ok) {
        ///handleSubmitFlux(imageUrl);
        setIsFluxOnTop(false);
        ///setIsSubmitting(true); // Set loading state
        /// setLabel('Loading Hd: 10secs');
        /// setShowLabel(true);
      } else {
      }
    } catch (err) {
      console.error("Error calling Hugging Face Inference Endpoint:", err);
      setError("An error occurred while generating the image. Please try again.");
    } finally {
      // setIsSubmitting(false); // Reset loading state
    }
  }, [prompt]);

  const handleSubmit = useCallback(() => {
    setGeneratedImageFlux('');
    setParsedKeyPoints([]);
    setParsedKeyPoints2([])
    setParsedKeyPointsb([]);
    /// handleSubmitSdxl();


    EnhanceText(prompt, loggedUser);

  }, [handleSubmitSdxl, prompt, loggedUser, GeneratedImage]);

  // Define TypeScript interfaces
  interface EnhanceTextRequest {
    pp: string;
    remixData: string
    interactionExperienceMode?: InteractionExperienceMode;

    // Cover gate. Both optional: if they are absent the backend behaves
    // exactly as it always has (cover on, model picks its own length).
    sceneCount?: number;
    hasUserScenes?: boolean;

  }

  interface EnhanceTextResponse {
    message: string;
    initialSteps: string;

  }



  // 'kontext' was the reference-image model; that role is now fluxUltra
  // (Nano Banana 2 Lite), so it inherits the same special-case UI.
  const SPECIAL = new Set(['fluxultra', 'bannana', 'minimax']);

  const SPECIALp = new Set(['fluxultra', 'bannana',]);


  const SPECIALx = new Set(['fluxultra', 'bannana',]);
  const modelzLower = (modelz ?? '').toLowerCase();
  const isSpecialSelected = SPECIALp.has(modelzLower);

  const isSpecialSelectedx = SPECIALx.has(modelzLower);
  // State variables
  const [enhancedText, setEnhancedText] = useState<string>('');



  /**
   * How many scenes did the user actually author in the Notepad scene fields?
   *
   * NotepadEditor serialises its slots with makeCombinedPrompt() as
   * "Scene 1: ...", "Scene 1B: ...", "Scene 2: ..." — so this parses the app's
   * own format, not free text. The scene NUMBER is read from the label, which
   * is why stage A/B needs no special handling: "Scene 3" and "Scene 3B" are
   * both scene 3. Blank slots emit no label at all, so they never count.
   *
   * Returns 0 when the user just typed a plain prompt.
   */
  const countAuthoredScenes = (combined: string): number => {
    const value = String(combined || "");
    if (!value.trim()) return 0;

    // Same marker shape NotepadEditor.splitCombinedPrompt() uses, but anchored
    // to the start of a line. makeCombinedPrompt() joins its parts with "\n",
    // so every real scene label begins a line - while a passing mention inside
    // prose ("a wide shot of scene 1 of my life") never does, and is ignored.
    const markerRegex = /^[ \t]*scene\s*(\d+)(?:([ab])\b|(?:\s*[-_]\s*([ab])\b)|(?:\s+stage\s*([ab])\b))?\s*:?\s*/gim;
    const markers: { sceneNumber: number; labelStart: number; contentStart: number }[] = [];
    let match: RegExpExecArray | null;

    while ((match = markerRegex.exec(value)) !== null) {
      const sceneNumber = parseInt(match[1], 10);
      if (sceneNumber < 1 || sceneNumber > 9) continue;
      markers.push({
        sceneNumber,
        labelStart: match.index,
        contentStart: markerRegex.lastIndex,
      });
    }

    // A label only counts if there is text under it.
    const filled = new Set<number>();
    markers.forEach((marker, index) => {
      const contentEnd = markers[index + 1] ? markers[index + 1].labelStart : value.length;
      if (value.slice(marker.contentStart, contentEnd).trim()) {
        filled.add(marker.sceneNumber);
      }
    });

    return filled.size;
  };

  // Define the EnhanceText function
  const StartStory = async (pp: any, loggedUserx: any, selectedStyle: any, typex: any, experienceMode?: InteractionExperienceMode) => {
    protectedVipCharacterUrlsRef.current = new Set(
      (Vipcharacters || [])
        .map((character: any) => String(character?.imageUrl || "").trim())
        .filter(Boolean)
    );
    cancelAutomaticGuideCall(sceneDoubleCheckCallId);
    setDoubleCheckResult(false);
    finalCreationReviewStartedAtRef.current = null;
    resetVideoModeRunGuard(`${Date.now()}:${String(pp || "").trim().slice(0, 160)}`);
    finalCreationReviewSentRef.current = false;
    setCreationProgressRunKey(Date.now());
    setIsSubmittingKick(true);

    setParsedKeyPoints([]);
    setParsedKeyPoints2([])
    setParsedKeyPointsb([]);

    setPlanInfo(1);

    setallowSpin(true);

    setError('');
    try {
      let finalRemixData = remixData || "";

      const actualCharacters = (Vipcharacters || []).filter((item: any) => !item.assetKind || item.assetKind === 'character');
      const catalogAssets = (Vipcharacters || []).filter((item: any) => item.assetKind === 'environment' || item.assetKind === 'object');
      if (catalogAssets.length) {
        finalRemixData += '\n\nSELECTED WORLD PLACES AND OBJECTS:\n' + catalogAssets
          .map((item: any) => '- ' + item.name + ' (' + item.assetKind + '): ' + String(item.description || '')).join('\n');
      }
      if (actualCharacters.length > 0) {
        const vipText = actualCharacters
          .map((v: any) => `- ${v.name}: identity from uploaded input image only; do not use saved clothing/gear text as the active look.`)
          .join("\n");
        const personalityText = actualCharacters
          .map((v: any) => {
            const personality = getWorldCharacterPersonality(String(v.description || ''));
            return personality && personality !== 'Not yet established.' ? `- ${v.name}: ${personality}` : '';
          })
          .filter(Boolean)
          .join("\n");
        const vipGuidance = `VIP CHARACTER IDENTITY REFERENCES:
${vipText}${personalityText ? `

VIP CHARACTER PERSONALITIES FOR STORY AND DIALOGUE:
${personalityText}
- Use these traits for characterization, choices, relationships, and speaking style unless the current user brief overrides them.
- Express relevant traits through scene actions, character decisions, and any dialogue so they carry into later planning. Do not add exposition or dialogue merely to list traits.
- These are narrative traits, not additional visual descriptions or image-generation instructions.` : ''}

DYNAMIC VIP APPEARANCE RULES:
- Preserve each VIP's identity: face, hair, age, body type, and other inherent physical traits.
- Treat clothing, armor, uniforms, weapons, props, and equipment in the saved description as the character's DEFAULT look, not a permanent requirement.
- The current user scenario is authoritative for role, wardrobe, and equipment.
- If the scenario requests or clearly implies a different look, replace the default clothing/gear completely with the scenario-appropriate look; do not merge incompatible old and new outfits.
- If the scenario asks for the character "as is", their original/default look, or gives no conflicting wardrobe context, retain the saved look.
- Always describe the final context-appropriate appearance while identifying the face as coming from the input image.`;
        if (finalRemixData.trim().length > 0) {
          finalRemixData += `\n\n${vipGuidance}`;
        } else {
          finalRemixData = vipGuidance;
        }
      }

      var url = 'startStory';

      if (typex === 0) {
        url = 'startMemes';
      } else if (typex === 3) {
        url = 'startInteractions';
      } else {

      }

      const promptForRequest =
        typex === 1 && promptMusicUrl
          // Put the scene-count constraint INSIDE the brief (front-loaded, where the
          // model weights it most) and reinforce at the tail, so it reads like part
          // of the user's own request rather than a trailing system note. This keeps
          // the AI in control of the story while strongly steering the exact count.
          ? `Tell this story in exactly ${promptMusicSceneCount} scenes â€” not more, not fewer.\n\n${String(pp).trim()}\n\n(Reminder: the finished story must have exactly ${promptMusicSceneCount} scenes.)\n\nNo matter what, you must give me exactly ${promptMusicSceneCount} scenes. You must do this. You must give exactly ${promptMusicSceneCount} scenes.`
          : pp;

      // --- Cover gate -------------------------------------------------
      // If the user filled in the Notepad scene fields they are in control:
      // their scenes are authoritative and the backend must not spend slot 1
      // on a movie-poster cover. If they only typed a plain prompt, nothing is
      // sent and the backend keeps its original behaviour.
      const authoredSceneCount = countAuthoredScenes(pp);
      const hasAuthoredScenes = authoredSceneCount > 0;
      const isMusicVideoRun = typex === 1 && Boolean(promptMusicUrl);

      // Scene count and cover suppression are separate signals. Music mode
      // still needs its exact count even when the user typed no scenes of
      // their own - that case keeps today's behaviour untouched.
      const sceneCountForRequest = hasAuthoredScenes
        ? authoredSceneCount
        : (isMusicVideoRun ? promptMusicSceneCount : 0);

      console.log('GOLDEN PROMPTTTTTTTTTT', promptForRequest);
      console.log('[StartStory] cover gate:', { authoredSceneCount, hasAuthoredScenes, sceneCountForRequest, isMusicVideoRun });

      const requestData: EnhanceTextRequest = {
        pp: promptForRequest,
        remixData: finalRemixData,
        ...(typex === 3 ? { interactionExperienceMode: experienceMode ?? "hotspots" } : {}),
        ...(sceneCountForRequest > 0 ? { sceneCount: sceneCountForRequest } : {}),
        ...(hasAuthoredScenes ? { hasUserScenes: true } : {}),
      };



      // A Start Story/Meme/Interaction request defines a fresh creation. Any
      // previous creation's temporary cost data is discarded before it runs.
      resetCreationLedger();

      // Make the POST request to the server
      const response = await axios.post<EnhanceTextResponse>(
        `${CLIK_URL}/${url}`,
        requestData,
        { withCredentials: true }
      );

      // Extract data from the response
      const data = response.data;


      console.log("log:", data);

      setPlanInfo(2);

      const parsed: any = data.initialSteps;

      const keyPoints: string[] = Array.isArray(parsed?.keyPoints) ? parsed.keyPoints : [];
      if (!keyPoints.length) throw new Error("No scenes were returned. Please try creating again.");

      const keyPointsWithStage2 =
        type === 1
          ? keyPoints.flatMap((t) => [t, t]) // duplicates each item adjacently
          : keyPoints;

      setParsedKeyPointsx(keyPointsWithStage2);

      setParsedKeyPoints2(parsed.keyPoints);
      setPlanInfo(2)

      const planned = await StartPlan(pp, keyPointsWithStage2, selectedStyle);


      console.log("Enhancement Completed:", keyPointsWithStage2);

      // Update state with the enhanced text


      //setPrompt(data.initialSteps);

      console.log(data.initialSteps);
      return planned;
    } catch (error: any) {
      setCreationProgressRunKey(null);
      setshowButton(true);

      setallowSpin(false);
      setIsSubmittingKick(false);
      setPlanInfo(0);
      // Handle different error scenarios
      if (error.response) {
        // Server responded with a status other than 2xx
        console.error("Server Error:", error.response.data);
        setError(error.response.data.message || "Server Error");
      } else if (error.request) {
        // Request was made but no response received
        console.error("No response received:", error.request);
        setError("Network Error: No response received from server.");
      } else {
        // Other errors
        console.error("Error:", error.message);
        setError(error.message);
      }
      return false;
    }
  }

  // strip popular TLD suffixes like ".com", ".org", ".io", etc. (no spaced dots)
  const TLD_REGEX =
    /\.(?:com|org|net|io|co|gov|edu|cn|uk|de|jp|fr|in|it|nl|br|es|ca|au|ru|ch|se|no|dk|fi|pl|cz|at|be|nz|il|kr|tw|tr|ar|mx|pt|gr|hu|ie|sg|hk|id|my|ph|sa|ae|qa|za|ng)\b(?![a-z0-9-])/gi;

  const cleanPoints = (arr: string[]) =>
    arr.map((s) =>
      s
        .replace(/\*/g, "")     // remove all asterisks
      ///.replace(TLD_REGEX, "") // drop the listed TLDs
    );



  // Define the EnhanceText function
  const StartPlan = async (pp: any, x: any, selectedStyle: any) => {
    setIsSubmittingKick(true);
    startNewFluxRun();


    setError('');
    try {
      // Prepare the request payload

      // StartPlan keeps its dedicated GPT-5.2 model, independent of Creation AI.
      // Do not attach the selectable Creation AI tier here: the plan schema is
      // a reliability boundary and Replicate plan routing will be chosen only
      // after its candidate models have been tested against that exact schema.
      const requestData: any = { pp, x, creationType: type };

      var tt = 'startPlan';

      // Check if the array has at least one image
      if (GeneratedImage.length > 0) {
        tt = 'startPlan';
      }
      // Make the POST request to the server
      const response = await axios.post<any>(
        `${CLIK_URL}/${tt}`,
        requestData,
        { withCredentials: true }
      );

      const { plan } = response.data                     // <- âœ¨ hereâ€™s your plan
      if (!plan) throw new Error("No generation plan was returned. Please try creating again.");
      console.log("Plan Created:", plan)

      // example use:



      var finalPlan = plan;

      setPlanInfo(3)

      if (selectedStyle === 'Auto') {



      } else {


        finalPlan = applyArtStyleToPlan(plan, selectedStyle);
        // do something with finalPlanâ€¦



      }


      setPlanx(finalPlan);


      setPlanInfo(0);

      setallowSpin(false);
      const cleaned = Array.isArray(x) ? cleanPoints(x) : [];

      setParsedKeyPoints(cleaned);
      console.log(parsedKeyPoints, parsedKeyPoints);
      setParsedKeyPointsb(cleaned);

      // --- Step 3: Server Casting Call (Phase 2) ---
      // --- DEFERRED: Server Casting Call (Phase 2 & 3) ---
      // We no longer trigger extractCasting here. It is deferred until the 
      // skipCountdown hits 0, saving tokens if the user decides to skip.

      // Update state with the enhanced text


      //setPrompt(data.initialSteps);
      return true;
    } catch (error: any) {
      setCreationProgressRunKey(null);
      setallowSpin(false);
      setIsSubmittingKick(false);
      setPlanInfo(0);
      // Handle different error scenarios
      if (error.response) {
        // Server responded with a status other than 2xx
        console.error("Server Error:", error.response.data);
        setError(error.response.data.message || "Server Error");
      } else if (error.request) {
        // Request was made but no response received
        console.error("No response received:", error.request);
        setError("Network Error: No response received from server.");
      } else {
        // Other errors
        console.error("Error:", error.message);
        setError(error.message);
      }
      return false;
    }
  }





  // 1ï¸âƒ£  Create one â€œbulk-deleteâ€ helper
  const bulkDeleteImages = async () => {
    // Combine scene images and character portraits for cloud cleanup
    const refUrls = (referenceImages || []).map((r: any) => r.imageUrl);
    const allToDelete = [...(ImagesHdCloud || []), ...refUrls].filter(
      url =>
        url &&
        typeof url === 'string' &&
        url.trim() !== "" &&
        !protectedVipCharacterUrlsRef.current.has(url.trim())
    );

    // Always clear the local UI state
    setImagesHdCloud([]);
    updateReferenceImages(() => []);
    setDetectedEnvironments([]);

    if (allToDelete.length === 0) return;

    try {
      await Promise.all(
        allToDelete.map(async (url: any) => {
          try {
            await startDelete(url);          // your existing helper
          } catch (err) {
            console.error(`âŒ  Couldnâ€™t delete ${url}:`, err);
          }
        })
      );
    } catch (err) {
      console.error("Bulk delete error", err);
    }
  };

  const resetMagicMirror = () => {
    resetVideoModeRunGuard();
    setDummyMode(false);

    bulkDeleteImages();
    setVideMode(false);
    destroyAllFluxCalls();
    handleCloseOverlay();
    setIsAgentCasting(false);
    setReferencePendingCount(0);

    if (magicMode) {
      setGeneratedImagesFluxx([]);
      setParsedKeyPoints([]);
      setParsedKeyPoints2([]);
      setIsMirrorFocused(true);
    }
  }

  const callAudio = async () => {


    try {
      // Prepare the request payload
      const requestData: any = { prompt };
      setAudioResult('');

      setaudioLoad(true);
      // Make the POST request to the server
      const response = await axios.post<any>(
        `${CLIK_URL}/ChatGPTApiAudio`,
        requestData,
        { withCredentials: true }
      );

      // Extract data from the response
      const data = response.data;

      console.log("Enhancement Completed:", data.responseText);

      // Update state with the enhanced text
      //setEnhancedText(data.initialSteps);
      //setPrompt(data.initialSteps);

      setAudioResult(data.responseText);
      setaudioLoad(false)


    } catch (error: any) {
      ///handleCloseOverlay();



      // Handle different error scenarios
      if (error.response) {
        // Server responded with a status other than 2xx
        console.error("Server Error:", error.response.data);
        setError(error.response.data.message || "Server Error");
      } else if (error.request) {
        // Request was made but no response received
        console.error("No response received:", error.request);
        setError("Network Error: No response received from server.");
      } else {
        // Other errors
        console.error("Error:", error.message);
        setError(error.message);
      }
    } finally {
      ///setIsLoading(false);
    }
  }




  // Define the EnhanceText function
  const EnhanceText = async (pp: any, loggedUserx: any) => {

    setIsSubmitting(true);
    setError('');
    var long = 0

    if (modelz === 'Flux Pro') {

      long = 1
    }


    try {
      // Prepare the request payload
      const requestData: any = { pp, prompt, long };

      // Make the POST request to the server
      const response = await axios.post<EnhanceTextResponse>(
        `${CLIK_URL}/ChatGPTApiDesign4`,
        requestData,
        { withCredentials: true }
      );

      // Extract data from the response
      const data = response.data;

      console.log("Enhancement Completed:", data.initialSteps);

      const seed = Math.floor(Math.random() * 1_000_000_000);


      setSeed(seed);

      // Update state with the enhanced text
      setEnhancedText(data.initialSteps);
      //setPrompt(data.initialSteps);

      ///handleSubmitFluxImage(img, data.initialSteps, loggedUserx)

      /// handleSubmitSdxl(data.initialSteps, loggedUserx);

      handleImageSubmit(data.initialSteps, loggedUserx, seed)

    } catch (error: any) {
      /// handleCloseOverlay();

      // Handle different error scenarios
      if (error.response) {
        // Server responded with a status other than 2xx
        console.error("Server Error:", error.response.data);
        setError(error.response.data.message || "Server Error");
      } else if (error.request) {
        // Request was made but no response received
        console.error("No response received:", error.request);
        setError("Network Error: No response received from server.");
      } else {
        // Other errors
        console.error("Error:", error.message);
        setError(error.message);
      }
    } finally {
      ///setIsLoading(false);
    }
  }



  const [showButton, setshowButton] = useState(false);


  useEffect(() => {
    if (prompt.trim() === "") return; // Do not submit if prompt is empty

    //type===0


    setshowButton(true);

    const handler = setTimeout(() => {


      setshowButton(false);

    }, 50000); // 500 milliseconds = 0.5 seconds

    // Cleanup the timeout if prompt changes before 0.5 seconds
    return () => {
      clearTimeout(handler);
    };
  }, [prompt, handleSubmit]);



  const getPixel = async (): Promise<number> => {
    const userId = Number(loggedUser?.id);
    if (!Number.isInteger(userId) || userId <= 0) return 0;
    try {
      const { data } = await axios.post<{ userid: number; pixels: number }>(
        `${CLIK_URL}/getPixels`,
        { values: { userid: userId } }
      );
      return data.pixels;          // a number
    } catch (err) {
      console.error("Error fetching pixels:", err);
      throw new Error("Could not check your pixel balance. Please try Go again.");
    }
  };




  /* ------------------------------------------------------------------
   * Actual Submit Logic (Renamed from old handleStartSubmit)
   * ------------------------------------------------------------------ */
  const handleActualSubmit = useCallback(async (experienceMode?: InteractionExperienceMode, promptOverride?: string, onAccepted?: () => void) => {
    actualSubmitRef.current = null; // clear it so it's not stale

    if (!loggedUser) {
      setError("Sign in to update your creation.");
      return false;
    }
    if (submitInFlightRef.current || allowSpin) return false;
    // This flag also covers scene preparation. A ready preview may still carry
    // it from an older run; it must not prevent an explicit plan edit.
    if (isSubmittingKick && promptOverride === undefined) return false;

    if (loggedUser.id === 1 && APP_STATE === 'prodxxxx') {
      alert("ðŸ”’ Please sign up first before using this feature! ðŸ’ª");
      dispatch(setLogin(true));
      return false;
    } else {
      submitInFlightRef.current = true;
      setError("");
      try {
        setIsSubmittingKick(true);
        setshowButton(false);
        setGotIm(GeneratedImage.length > 0);

        if (type === 1 || type === 0 || type === 3) {
          const pixels = await getPixel();
          const modelPrice = calcModelPixels({ model: modelz, baseImagesPerDollar: 333 });
          if (pixels >= modelPrice) {
            onAccepted?.();
            return await StartStory(promptOverride ?? prompt, loggedUser, selectedStyle, type, experienceMode);
          }
          setshowButton(true);
          setError(`This generation needs at least ${modelPrice} P. Your balance is ${pixels} P.`);
          return false;
        } else if (type === 2) {
          await callAudio();
          return true;
        }
        return false;
      } catch (error: any) {
        setshowButton(true);
        setError(error?.message || "Could not update your creation. Please try Go again.");
        return false;
      } finally {
        submitInFlightRef.current = false;
        setIsSubmittingKick(false);
      }
    }
  }, [type, handleSubmit, GeneratedImageFlux, GeneratedImage, selectedStyle, modelz, loggedUser, showButton, planInfo, isSubmittingKick, allowSpin, promptMusicUrl, promptMusicSceneCount, prompt, remixData, Vipcharacters]);

  const handleEditGenerationPlan = async () => {
    if (!planEditText.trim() || isPlanEditSubmitting || submitInFlightRef.current || allowSpin) return;
    const newPrompt = `Update: '${planEditText.trim()}', Original prompt:'${prompt}'`;
    setIsPlanEditSubmitting(true);
    try {
      await handleActualSubmit(interactionExperienceMode ?? undefined, newPrompt, () => {
        // Restart through the normal close/create flow with the chosen inputs.
        handleCloseOverlay(true);
        setShowPathChoiceOverlay(false);
        setPlanx(null);
        // Continue editing the same unpublished creation; do not orphan its draft.
        if (creationDraft) creationDraft.resetDependentSections();
        else setPostId(0);
        setImagesHdCloud([]);
        setPrompt(newPrompt);
        setPlanEditText("");
        dispatch(setCreationConfirmationOpen(false));
      });
    } finally {
      setIsPlanEditSubmitting(false);
    }
  };

  /* Opening the review does not submit, reserve pixels, or start generation. */
  const handleStartSubmit = useCallback(() => {
    dispatch(setCreationConfirmationOpen(true));
  }, [dispatch]);


  useEffect(() => {

    if (instantCall && prompt.trim() !== "") {

      setTimeout(() => {
        handleStartSubmit();
        /// alert(prompt);
        setinstantCall(false);
      }, 2000); // 1-second delay to ensure smooth transition


    }
  }, [instantCall, prompt, handleStartSubmit]);

  const cancelInteractionExperienceChoice = useCallback(() => {
    setShowInteractionExperienceChoice(false);
    setInteractionExperienceMode(null);
    cancelCountdown();
    actualSubmitRef.current = null;
    setIsSubmittingKick(false);
    setshowButton(true);
  }, [cancelCountdown]);

  const chooseInteractionExperience = useCallback((mode: InteractionExperienceMode) => {
    setInteractionExperienceMode(mode);
    setShowInteractionExperienceChoice(false);
    // Pass the selection directly: React state has not updated in this callback yet.
    void handleActualSubmit(mode);
  }, [handleActualSubmit]);

  const confirmCreation = useCallback(() => {
    if (isAllFeeds) return;
    dispatch(setCreationConfirmationOpen(false));
    if (Number(type) === 3) {
      setInteractionExperienceMode(null);
      setShowInteractionExperienceChoice(true);
      return;
    }
    void handleActualSubmit();
  }, [dispatch, handleActualSubmit, isAllFeeds, type]);

  const chooseCreationMode = useCallback((path: string) => {
    if (!isAllFeeds) return;
    // Select a route without resetting the brief, chosen model or references.
    dispatch(setPromptRed(prompt));
    setShowPromptWelcomeUI(true);
    setminimisePrompt(false);
    navigate(path);
  }, [dispatch, isAllFeeds, navigate, prompt, setminimisePrompt]);

  const handleSkipCharacters = useCallback(() => {
    // IMMEDIATELY Proceed to Storybook (Skip Phase) - Visual close only so background gen continues
    setSkipCountdown(null);
    setStudioButtonStage('hidden');
    setShowStudioModal(false);
    setShowScenesPopup(false);
    setAutoSkipPending(false);
    if (!isDetectionInProgressRef.current && !referenceLoading && referencePendingCount === 0) {
      mergeVipReferenceCards();
    }
    // Auto-select the existing Video action once for this original story run.
    enterVideoCreationModeOnce();
  }, [enterVideoCreationModeOnce, mergeVipReferenceCards, referenceLoading, referencePendingCount]);

  const handleDeleteCharacter = useCallback((nameToDelete: string, type: string) => {
    if (
      !removedReferenceNamesRef.current.some((name) =>
        referenceNamesMatch(name, nameToDelete)
      )
    ) {
      removedReferenceNamesRef.current.push(nameToDelete);
    }

    if (type === 'character') {
      setDetectedCharacters((previous) =>
        previous.filter(
          (character) => !referenceNamesMatch(character.name, nameToDelete)
        )
      );
      setVipcharacters((previous) =>
        previous.filter(
          (character) => !referenceNamesMatch(character.name, nameToDelete)
        )
      );
    } else {
      setDetectedEnvironments((previous) =>
        previous.filter(
          (environment) => !referenceNamesMatch(environment.name, nameToDelete)
        )
      );
    }
    updateReferenceImages((previous) =>
      previous.filter(
        (reference) => !referenceNamesMatch(reference.name, nameToDelete)
      )
    );
    setQueuedCastingPrompts((previous) =>
      previous.filter(
        (prompt) => !referenceNamesMatch(prompt.name, nameToDelete)
      )
    );
  }, [updateReferenceImages]);

  const runCharacterListAudit = useCallback((characters: any[]) => {
    // Canon/snapshot synchronization already records these subjects. Do not
    // launch a second automatic concierge conversation during character work.
    void characters;
  }, []);

  const useStepOneCharacterResults = useCallback(() => {
    latestCastingIdRef.current = Date.now();
    stepTwoAuditAbortRef.current?.abort();
    stepTwoAuditAbortRef.current = null;
    const stepOneSnapshot = stepOneCastingSnapshotRef.current;
    if (stepOneSnapshot) {
      setDetectedCharacters(stepOneSnapshot.characters);
      setDetectedEnvironments(stepOneSnapshot.environments);
      runCharacterListAudit(stepOneSnapshot.characters);
    }
    isDetectionInProgressRef.current = false;
    setCastingPipelineActive(false);
    isGeneratingRefsRef.current = false;
    referenceGenerationRunRef.current = null;
    setStepTwoAuditInProgress(false);
    setStepTwoCastingCancelled(true);
    setIsAgentCasting(false);
    setReferenceLoading(false);
    setReferencePendingCount(0);
    setQueuedCastingPrompts([]);
    setStudioActionTimer(null);
    setSkipCountdown(null);
    updateReferenceImages((previous) =>
      preserveOwnedReferences(stepOneSnapshot?.references || previous, previous,
        id => referenceRenderClaims.current.working(id) || referenceRenderClaims.current.done(id), referenceNamesMatch).map((reference) => ({
        ...reference,
        isGenerating: referenceRenderClaims.current.working(getReferenceEditKey(reference)) && reference.isGenerating,
        isUpscaling: referenceRenderClaims.current.working(getReferenceEditKey(reference)) && reference.isUpscaling
      }))
    );
  }, [runCharacterListAudit, updateReferenceImages]);

  const proceedToImageGeneration = useCallback(async (characters: any[], environments: any[], castingId: number) => {
    if (latestCastingIdRef.current !== castingId || castingPromptRunRef.current?.castingId === castingId) return;
    const promptRun = { castingId, token: Symbol('casting-prompts') };
    castingPromptRunRef.current = promptRun;
    setCastingStatus("Generating reference image prompts...");
    // Prompt preparation is queue state, not an in-flight image request.
    // Waiting references stay manually editable/generatable.
    try {
      const charsToGenerate = characters.filter((c: any) => !c.imageUrl);
      // VIP characters go through prompt creation EXACTLY like normal characters:
      // scene-detected description as-is. No saved/stale VIP description is sent.
      // Every VIP ALWAYS gets an image prompt, even if detection missed it (any model).
      // No saved/stale VIP description is sent - the look is derived from the scenes.
      const selectedAssets = (Vipcharacters || []).filter(v => v.imageUrl);
      const vipFallbackChars = selectedAssets
        .filter(v => v.assetKind !== 'environment' && !charsToGenerate.some(c => referenceNamesMatch(c.name, v.name)))
        .map(v => v.assetKind === 'object'
          ? { name: v.name, assetKind: v.assetKind, description: v.description }
          : { name: v.name, isVip: true, description: "Derive this character's current look, wardrobe and gear from the STORY PLAN and SCENES." });
      const promptChars = [...charsToGenerate, ...vipFallbackChars];
      const selectedPlaces = selectedAssets.filter(v => v.assetKind === 'environment');
      const promptEnvironments = [
        ...environments.filter(place => !selectedPlaces.some(v => referenceNamesMatch(v.name, place.name))),
        ...selectedPlaces.map(v => ({ name: v.name, description: v.description, assetKind: v.assetKind })),
      ];
      const savedCasting = creationDraft?.section<any>('prompt');
      const canRestorePrompts = Boolean(draftEntry && savedCasting?.castingPrompts
        && JSON.stringify(draftSeed.parsedKeyPointsb) === JSON.stringify(parsedKeyPointsb));
      const promptRes = canRestorePrompts ? { data: { prompts: savedCasting.castingPrompts } } : await axios.post<any>(
        `${CLIK_URL}/generateCastingPrompts`,
        { characters: promptChars, environments: promptEnvironments, prompts: parsedKeyPointsb, plan: Planx, narrationSummary: parsedKeyPoints2 },
        { withCredentials: true }
      );
      if (latestCastingIdRef.current !== castingId) return;

      const castingPrompts = promptRes.data.prompts || [];
      captureCreationCache(creationDraft, 'prompt', { castingPrompts });
      if (castingPrompts.length === 0) {
        updateReferenceImages(prev => prev.map(ref => referenceRenderClaims.current.working(getReferenceEditKey(ref)) ? ref : ({ ...ref, isGenerating: false })));
        setReferencePendingCount(0);
        setQueuedCastingPrompts([]);
        setStudioActionCost(0);
        setCastingStatus("No reference prompts returned.");
        setStudioButtonStage('post-continue');
        return;
      }
      if (castingPrompts.length > 0) {
        const userPixels = await getPixel();
        setAvailablePixels(userPixels);
        const perImageCost = calcModelPixels({ model: modelz, baseImagesPerDollar: 333 });
        const requiredPixels = perImageCost * castingPrompts.filter((item: any) => {
          const ref = findRefByName(referenceImagesRef.current, item.name);
          const id = ref && getReferenceEditKey(ref);
          if (id && (referenceRenderClaims.current.working(id) || referenceRenderClaims.current.done(id))) return false;
          const vip = Vipcharacters?.some((v: any) => v?.imageUrl && referenceNamesMatch(v.name, item.name));
          return vip || !ref?.imageUrl;
        }).length;
        setStudioActionCost(requiredPixels);

        if (userPixels >= requiredPixels) {
          setQueuedCastingPrompts(castingPrompts);
          hasStartedCastingRef.current = true;
          if (latestCastingIdRef.current !== castingId) return;
          setCastingStatus(`Generating ${castingPrompts.length} references...`);
          await runReferenceImageGeneration(castingPrompts, castingId);
        } else {
          setStudioButtonStage('pre-broke');
          setCastingStatus(`Not enough Pixels. Cost: ${requiredPixels}`);
        }
      }
    } catch (err: any) {
      console.error("Casting Prompts Pipeline Failed:", err);
      setCastingStatus("Error generating prompts.");
      handleSkipCharacters();
    } finally {
      if (castingPromptRunRef.current === promptRun) castingPromptRunRef.current = null;
    }
  }, [parsedKeyPointsb, Planx, parsedKeyPoints2, modelz, handleSkipCharacters, Vipcharacters]);

  const runAutoCastingPipeline = useCallback(async (autoMode?: boolean) => {
    const restoredCast = creationDraft?.section<any>('prompt');
    if (draftEntry && draftSeed.castingCompleted && JSON.stringify(draftSeed.parsedKeyPointsb) === JSON.stringify(parsedKeyPointsb)
        && String(draftSeed.castingInstruction || '') === castingInstruction) {
      setStudioButtonStage('post-continue');
      setShowStudioModal(true);
      setShowPathChoiceOverlay(false);
      setCastingStatus('');
      return;
    }
    if (castingPipelineActive || isDetectionInProgressRef.current) {
      setStudioButtonStage('generating');
      setShowStudioModal(true);
      openScenesForCharacterEntry();
      return;
    }

    setStudioButtonStage('generating');
    cancelAutomaticGuideCall(characterListAuditCallId);
    setStepOneCastingReady(false);
    setStepOneDetectedCount(0);
    setStepTwoAuditInProgress(false);
    setStepTwoCastingCancelled(false);
    stepTwoCastingCancelledRef.current = false;
    stepTwoAuditAbortRef.current?.abort();
    stepTwoAuditAbortRef.current = null;
    stepOneCastingSnapshotRef.current = null;
    isDetectionInProgressRef.current = true;
    setCastingPipelineActive(true);

    const existingCharacters = detectedCharacters;
    const existingEnvironments = detectedEnvironments;
    const existingReferences = referenceImagesRef.current;
    const isAdditiveDetection =
      castingInstruction.trim().length > 0 &&
      (existingCharacters.length > 0 ||
        existingEnvironments.length > 0 ||
        existingReferences.length > 0);

    if (!isAdditiveDetection) {
      removedReferenceNamesRef.current = [];
    }
    const wasManuallyRemoved = (name: unknown): boolean =>
      isAdditiveDetection &&
      removedReferenceNamesRef.current.some((removedName) =>
        referenceNamesMatch(removedName, name)
      );

    setCastingStatus(
      isAdditiveDetection
        ? "Step 1 of 2: Checking your request against current references..."
        : "Step 1 of 2: Reading script & identifying references..."
    );

    const currentCastingId = Date.now();
    latestCastingIdRef.current = currentCastingId;
    const auditStatusTimer = window.setTimeout(() => {
      if (latestCastingIdRef.current === currentCastingId) {
        setCastingStatus(
          isAdditiveDetection
            ? "Step 1 of 2: Still checking your request against current references..."
            : "Step 1 of 2: Still reading script & identifying references..."
        );
      }
    }, 4000);

    const vipUpgradeActive = true;
    const shouldAutoGenerateReferences = autoMode === true;

    // Show VIP characters immediately only for a fresh scan.
    const vipRefsPre = Vipcharacters ? Vipcharacters.map((v: any) => ({
      name: v.name,
      type: v.assetKind === 'environment' ? 'environment' : 'character',
      assetKind: v.assetKind,
      source: v.source,
      imageUrl: v.imageUrl /* uploaded VIP image visible immediately; recreation overwrites it */,
      prompt: '',
      description: v.description || 'VIP identity from uploaded input image',
      isGenerating: false,
      isVip: true
    })) : [];
    if (vipRefsPre.length > 0 && !isAdditiveDetection) {
      updateReferenceImages(() => vipRefsPre);
    }

    try {
      const applyCastingData = (castData: any) => {
        const characters = castData?.characters || [];
        const environments = castData?.environments || [];

        const vipRefs = Vipcharacters ? Vipcharacters.map((v: any) => ({
          name: v.name,
          type: v.assetKind === 'environment' ? 'environment' : 'character',
          assetKind: v.assetKind,
          source: v.source,
          imageUrl: v.imageUrl /* uploaded VIP image visible immediately; recreation overwrites it */,
          prompt: '',
          description: v.description || 'VIP identity from uploaded input image',
          isGenerating: false,
          isVip: true
        })) : [];

        const filteredCharacters = characters.filter(
          (character: any) =>
            !wasManuallyRemoved(character.name) &&
            !vipRefs.some((vip: any) =>
              referenceNamesMatch(vip.name, character.name)
            )
        );
        const filteredEnvironments = environments.filter(
          (environment: any) => !wasManuallyRemoved(environment.name) && !vipRefs.some(vip => referenceNamesMatch(vip.name, environment.name))
        );
        const incomingCharacters = [...vipRefs.filter(vip => vip.type !== "environment"), ...filteredCharacters];
        const vipPlaces = vipRefs.filter(vip => vip.type === 'environment');
      const combinedCharacters = isAdditiveDetection
          ? mergeNamedEntities(existingCharacters, incomingCharacters)
          : incomingCharacters;
        const combinedEnvironments = isAdditiveDetection
          ? mergeNamedEntities(existingEnvironments, [...vipPlaces, ...filteredEnvironments])
          : [...vipPlaces, ...filteredEnvironments];

        const incomingReferences: ReferenceImageItem[] = [
          ...vipRefs,
          ...filteredCharacters.map((character: any) => ({
            name: character.name,
            type: 'character',
            imageUrl: '',
            prompt: '',
            description: character.description,
            isGenerating: false
          })),
          ...filteredEnvironments.map((environment: any) => ({
            name: environment.name,
            type: 'environment',
            imageUrl: '',
            prompt: '',
            description: environment.description,
            isGenerating: false
          }))
        ];
        const addedReferences = isAdditiveDetection
          ? incomingReferences.filter(
            (candidate) =>
              !existingReferences.some((existing) =>
                referenceNamesMatch(existing.name, candidate.name)
              )
          )
          : incomingReferences;

        const incomingWithOwnedRenders = preserveOwnedReferences(incomingReferences, referenceImagesRef.current,
          id => referenceRenderClaims.current.working(id) || referenceRenderClaims.current.done(id), referenceNamesMatch);
        const combinedReferences = isAdditiveDetection
          ? mergeNamedEntities(referenceImagesRef.current, incomingWithOwnedRenders)
          : incomingWithOwnedRenders;
        setDetectedCharacters(combinedCharacters);
        setDetectedEnvironments(combinedEnvironments);
        updateReferenceImages(() => combinedReferences);

        return {
          characters,
          environments,
          filteredCharacters,
          filteredEnvironments,
          incomingCharacters,
          combinedCharacters,
          combinedEnvironments,
          combinedReferences,
          addedReferences
        };
      };

      const reusableCasting = Boolean(draftEntry && JSON.stringify(draftSeed.parsedKeyPointsb) === JSON.stringify(parsedKeyPointsb)
        && String(draftSeed.castingInstruction || '') === castingInstruction);
      const firstPassRes = reusableCasting && draftSeed.castingFirstPass ? { data: { data: draftSeed.castingFirstPass } } : await axios.post<any>(
        CLIK_URL + "/extractCasting",
        { prompts: parsedKeyPointsb, instruction: castingInstruction, firstPassOnly: true },
        { withCredentials: true }
      );
      if (latestCastingIdRef.current !== currentCastingId) return;

      window.clearTimeout(auditStatusTimer);
      const firstPassData = firstPassRes.data.data || { characters: [], environments: [] };
      captureCreationCache(creationDraft, 'prompt', { castingFirstPass: firstPassData });
      let applied = applyCastingData(firstPassData);
      if (!applied.combinedCharacters.length && !applied.combinedEnvironments.length) captureCreationCache(creationDraft, 'prompt', { castingCompleted: true });
      const actualStepOneCount = applied.combinedCharacters.length + applied.combinedEnvironments.length;
      setStepOneDetectedCount(actualStepOneCount);
      setStepOneCastingReady(actualStepOneCount > 0);
      stepOneCastingSnapshotRef.current = actualStepOneCount > 0
        ? {
          characters: applied.combinedCharacters,
          environments: applied.combinedEnvironments,
          references: applied.combinedReferences
        }
        : null;
      setShowScenesPopup(false);


      if (
        applied.combinedCharacters.length === 0 &&
        applied.combinedEnvironments.length === 0
      ) {
        setCastingStatus("No characters found.");
        handleSkipCharacters();
        if (autoMode) {
          setallowgetImage(true);
          setCreationMode('Normal');
          setIsAgentCasting(false);
        }
        return;
      }

      if (actualStepOneCount > 0) {
        setCastingStatus("Step 2 of 2: Auditing results for missed characters & references...");
        setStepTwoAuditInProgress(true);
        const auditAbortController = new AbortController();
        stepTwoAuditAbortRef.current = auditAbortController;
        // Interactions mode only. Sent as a separate value rather than written into
        // castingInstruction, because that state doubles as the isAdditiveDetection
        // flag above and must keep reflecting only what the user typed.
        const auditInstruction = type === 3
          ? [castingInstruction.trim(), UI_LOOK_AUDIT_CLAUSE].filter(Boolean).join("\n\n")
          : castingInstruction;

        const auditRes = reusableCasting && draftSeed.castingAudit ? { data: { data: draftSeed.castingAudit } } : await axios.post<any>(
          CLIK_URL + "/extractCasting",
          { prompts: parsedKeyPointsb, instruction: auditInstruction, auditOnly: true, firstPassResult: firstPassData },
          { withCredentials: true, signal: auditAbortController.signal }
        );
        captureCreationCache(creationDraft, 'prompt', { castingAudit: auditRes.data.data, castingCompleted: true });
        if (stepTwoAuditAbortRef.current === auditAbortController) {
          stepTwoAuditAbortRef.current = null;
        }
        if (stepTwoCastingCancelledRef.current || latestCastingIdRef.current !== currentCastingId) return;
        applied = applyCastingData(auditRes.data.data || firstPassData);
        setStepTwoAuditInProgress(false);
        runCharacterListAudit(applied.combinedCharacters);
      }

      if (!autoMode) {
        if (isAdditiveDetection) {
          setCastingStatus(
            applied.addedReferences.length > 0
              ? "Audit complete! Added " + applied.addedReferences.length + " new reference" +
              (applied.addedReferences.length === 1 ? "." : "s.")
              : "Audit complete. No new references found."
          );
        } else {
          setCastingStatus("Casting Complete! Found Characters.");
        }
      }
      if (
        applied.combinedCharacters.length > 0 ||
        applied.combinedEnvironments.length > 0
      ) {
        setSkipCountdown(null);
        if (autoMode) {
          const charactersToGenerate = isAdditiveDetection
            ? applied.incomingCharacters.filter((candidate: any) =>
              applied.addedReferences.some((added: any) =>
                referenceNamesMatch(added.name, candidate.name)
              )
            )
            : applied.incomingCharacters;
          const environmentsToGenerate = isAdditiveDetection
            ? applied.filteredEnvironments.filter((candidate: any) =>
              applied.addedReferences.some((added: any) =>
                referenceNamesMatch(added.name, candidate.name)
              )
            )
            : applied.environments;

          if (
            charactersToGenerate.length > 0 ||
            environmentsToGenerate.length > 0
          ) {
            if (stepTwoCastingCancelledRef.current || latestCastingIdRef.current !== currentCastingId) return;
            setCastingStatus("Step 2 of 2: Generating reference prompts and images...");
            await proceedToImageGeneration(
              charactersToGenerate,
              environmentsToGenerate,
              currentCastingId
            );
          } else {
            setStudioButtonStage('continue-editing' as any);
          }
        } else {
          setStudioButtonStage('continue-editing' as any);
        }
      }
    } catch (err: any) {
      if (axios.isCancel?.(err) || err?.code === "ERR_CANCELED" || stepTwoCastingCancelledRef.current) {
        return;
      }
      console.error("Casting Pipeline Failed:", err);
      setCastingStatus("Error retrieving characters.");
      handleSkipCharacters();
      if (autoMode) {
        setallowgetImage(true);
        setCreationMode('Normal');
        setIsAgentCasting(false);
      }
    } finally {
      window.clearTimeout(auditStatusTimer);
      setStepTwoAuditInProgress(false);
      isDetectionInProgressRef.current = false;
      setCastingPipelineActive(false);
    }
  }, [
    parsedKeyPointsb,
    castingPipelineActive,
    handleSkipCharacters,
    proceedToImageGeneration,
    setallowgetImage,
    setCreationMode,
    castingInstruction,
    cancelAutomaticGuideCall,
    characterListAuditCallId,
    detectedCharacters,
    detectedEnvironments,
    Vipcharacters,
    modelz,
    openScenesForCharacterEntry,
    runCharacterListAudit,
    type
  ]);

  const startAgentCasting = useCallback(() => {
    setIsAgentCasting(true);
    runAutoCastingPipeline(true);
  }, [runAutoCastingPipeline]);

  useEffect(() => {
    if (isAgentCasting && !castingPipelineActive && !referenceLoading && referencePendingCount === 0 && referenceImages.length > 0) {
      const isAnyGenerating = referenceImages.some(r => r.isGenerating);
      if (!isAnyGenerating) {
        setallowgetImage(true);
        setCreationMode('Normal');
        setIsAgentCasting(false);
      }
    }
  }, [isAgentCasting, castingPipelineActive, referenceLoading, referencePendingCount, referenceImages, setallowgetImage, setCreationMode]);

  useEffect(() => {
    if (isRevisitingCharacter) return;

    if (skipCountdown === 0) {
      setSkipCountdown(null);
      if (studioButtonStage === 'edit-characters') {
        setStudioButtonStage('generating');
        proceedToImageGeneration(detectedCharacters, detectedEnvironments, latestCastingIdRef.current);
      } else {
        runAutoCastingPipeline();
      }
      return;
    }
    if (skipCountdown !== null && skipCountdown > 0) {
      const timer = setInterval(() => {
        setSkipCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [skipCountdown, isRevisitingCharacter, studioButtonStage, detectedCharacters, detectedEnvironments, proceedToImageGeneration, runAutoCastingPipeline]);



  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();


        handleStartSubmit();

      }
    },
    [handleStartSubmit, type]
  );





  const [isFluxOnTop, setIsFluxOnTop] = useState(true); // Tracks which image is on top
  const [label, setLabel] = useState<string>("");

  const [showLabel, setShowLabel] = useState<boolean>(false);

  const handleImageClick = useCallback(() => {


    if (big) {

      setstartEdit(true);
    }
  }, [big]);

  useEffect(() => {
    if (GeneratedImageFlux) {
      setLabel('');
    }
  }, [GeneratedImageFlux]);

  useEffect(() => {
    if (showLabel) {
      const timer = setTimeout(() => {
        setShowLabel(false);
      },
        label === 'Loading Hd: 10secs' ? 900000 : 5000); // 900000 ms = 15 minutes or 5000 ms = 5 sec

      // Cleanup the timer when the component unmounts or when showLabel changes
      return () => clearTimeout(timer);
    }
  }, [showLabel]);


  // Keeps every timeout ID keyed by the image index
  const timeoutRefsxp = useRef<{ [key: number]: ReturnType<typeof setTimeout> | null }>({});
  // When TRUE we refuse to schedule *any* new setTimeouts
  const timeoutsDisabledRef = useRef(false);

  const destroyAllFluxCalls = () => {
    timeoutsDisabledRef.current = true;                 // block future scheduling

    // clear & null-out every live timeout
    Object.keys(timeoutRefsxp.current).forEach((key) => {
      const id = timeoutRefsxp.current[Number(key)];
      if (id) clearTimeout(id);
      timeoutRefsxp.current[Number(key)] = null;
    });
  };

  const startNewFluxRun = () => {
    timeoutsDisabledRef.current = false;
  };







  const saveToDastabase = useCallback(async (uploadedHdUrl: string, enhancedTextData: any, loggedUserx: any) => {
    const values = {
      id: loggedUserx ? loggedUserx.id : null,
      caption: promptx ? promptx : enhancedTextData,
      imagehd: uploadedHdUrl,
      Kkontext: GeneratedImage.length > 0 ? singleImageStoredAliasesRef.current.get(GeneratedImage[0]) || GeneratedImage[0] : null,
      prompt: prompt ? prompt : null,
      model: modelz,
      ratio: ratioKey,
    };
    const response: any = await axios.post(`${CLIK_URL}/generatedImagePost`, { values });
    const newRowId = response.data.go;
    if (newRowId === undefined || newRowId === null || String(newRowId).trim() === '') {
      throw new Error("The saved image did not return a post ID.");
    }
    RemoveFromDeleteLater([uploadedHdUrl, ...GeneratedImage]);
    return newRowId;
  }, [promptx, GeneratedImage, prompt, modelz, ratioKey]);

  // **New State Variable to Control Overlay Visibility**
  const [showOverlay, setShowOverlay] = useState<boolean>(false);

  const [audioLoad, setaudioLoad] = useState<boolean>(false);

  // **Trigger Overlay When Image Generation Starts**
  useEffect(() => {
    if (isSubmitting) {
      setShowOverlay(true);
    } else {
      setShowOverlay(false);

    }
  }, [isSubmitting]);

  // **Function to Close Overlay** startPlan
  const resetCreationOverlay = (forPlanEdit = false) => {
    resetVideoModeRunGuard();
    if (!forPlanEdit) resetPromptMusicState();
    setallowgetImage(false);
    if (!forPlanEdit) setHomeModel(DEFAULT_IMAGE_MODEL);
    homeModelLocked.current = false;
    setbase([]);
    /// setPromptx('');
    // setPrompt('');
    setaudioLoad(false)
    setAllowPing(true);

    //setGeneratedImage('');
    setGeneratedImageFlux('');
    setGeneratedImagesFluxx([]);
    setParsedKeyPoints([]);
    setParsedKeyPoints2([]);
    setParsedKeyPointsx([]);
    setParsedKeyPointsb([]);
    setIsSubmittingKick(false);
    setEditGenSnapshot(null);
    setGeneratedImageFluxBlob([]);

    // --- Story Stage Garbage Collection ---
    setBShotVideos([]);
    setBShotImages([]);
    setBShotPrompts([]);
    setBShotTextVideo([]);
    setSpatialMotionContexts([]);
    setSpatialManifest({version: 1, scenes: []});
    setBShotSpatialScenes([]);
    setBShotSpatialContexts([]);
    setBShotNanoImages([]);
    setBShotDrawFrameData([]);
    setAutoDrawGuideData([]);
    setAutoDrawGuideModes([]);
    setBShotAutoDrawGuideModes([]);
    setBShotAutoDrawGuideData([]);
    setIsBShotModeActive(false);

    // --- Character & Environment Garbage Collection ---
    setDetectedCharacters([]);
    setDetectedEnvironments([]);
    updateReferenceImages(() => []);
    setQueuedCastingPrompts([]);
    setCastingStatus("");
    setSkipCountdown(null);
    setAutoSkipPending(false);
    setStudioButtonStage('hidden');
    setNanoImages([]);
    setShowStudioModal(false);
    hasAutoOpenedScenesRef.current = false;
    setShowConfirmClose(false);
    setReferenceLoading(false);
    setReferencePendingCount(0);
    setStepOneCastingReady(false);
    setStepOneDetectedCount(0);
    setStepTwoAuditInProgress(false);
    setStepTwoCastingCancelled(false);
    stepTwoCastingCancelledRef.current = false;
    stepTwoAuditAbortRef.current?.abort();
    stepTwoAuditAbortRef.current = null;
    stepOneCastingSnapshotRef.current = null;
    hasStartedCastingRef.current = false;

    setShowOverlay(false);
    setMinimizeMode(0);
  };

  const handleCloseOverlay = async (forPlanEdit = false) => {
    if (!forPlanEdit && creationDraft) {
      try { await creationDraft.close(); } catch { /* Pending local receipt remains available for retry. */ }
    }
    resetCreationOverlay(forPlanEdit);
    if (!forPlanEdit) onDraftSessionClosed?.();
  };


  const handleCloseOverlay2 = () => {
    resetVideoModeRunGuard();
    setbase([]);
    setaudioLoad(false)
    setAllowPing(true);
    setShowOverlay(true);
    setGeneratedImageFlux('');
    setParsedKeyPoints([]);
  }




  useEffect(() => {


    if (GeneratedImageFlux && isSubmitting || isSubmittingKick) {





      setStopText(true);
    } else {

      setStopText(false);
    }



  }, [GeneratedImageFlux, isSubmitting, isSubmittingKick]);



  /* ------------------------------------------------------------------ */
  const [loader, setLoader] = useState(0);          // 0 â€“ 100 %

  /* ------------------------------------------------------------------ */
  /* Kick off / reset when isSubmitting flips                           */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (isSubmitting) {
      const start = Date.now();                 // ms
      const DURATION = 3 * 60 * 1000;           // 5 minutes in ms
      const CAP = 95;                           // never exceed 95 %

      // reset immediately
      setLoader(0);

      timer = setInterval(() => {
        const elapsed = Date.now() - start;     // ms since start
        const t = Math.min(elapsed / DURATION, 1); // 0 â€“ 1 timeline

        /* cubic-easing curve  â†’ fast start, slow finish              *
         *   easeOutCubic(t) = 1 â€“ (1 â€“ t)^3                          */
        const eased = 1 - Math.pow(1 - t, 3);

        const pct = Math.round(eased * CAP);   // 0 â†’ 95 % non-linear
        setLoader(prev => (pct > prev ? pct : prev));
      }, 200);                                  // update every 0.2 s
    }

    /* cleanup on unmount / when isSubmitting flips to false */
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isSubmitting]);
  /* ------------------------------------------------------------------ */
  /* When the generation completes, bump to 100 % then hide overlay  countdown    */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!isSubmitting && loader < 100) {
      // when you set isSubmitting = false, bump to 100 first
      setLoader(100);
      // overlay will disappear because isSubmitting === false
    }
  }, [isSubmitting]);                                // runs once on finish



  const Manual = () => {


    setIsSubmittingKick(false);

    setParsedKeyPoints(
      ["",
        "",
        " ",
        "",
      ]);

    setParsedKeyPointsb(
      ["",
        "",
        " ",
        "",
      ]);

    setDummyMode(true)
  }
  // Lifted state for Notepad Image Generation
  // --- Auto-initiate Fullscreen Mode on Storybook Open ---
  useEffect(() => {
    if (parsedKeyPoints.length > 0) {
      setMinimizeMode(0); // Default to Fullscreen when opening
    }
  }, [parsedKeyPoints.length]);

  const handlePromptsFinished = useCallback(() => {
    setIsSubmittingKick(false);
    markPromptPrepFinishedForCurrentRun();
    setEditGenSnapshot(null); // new plan ready: unfreeze the edit-Go loading presentation
    setCreationProgressRunKey(null);
    cancelAutomaticGuideCall(creationProgressCallId);
    // Stop at the user's choice on a fresh run, including a single-scene run.
    if (parsedKeyPoints.length > 0 && !isRevisitingCharacter && !magicMode) {
      setShowPathChoiceOverlay(true);
      setDoubleCheckResult(true);
    }
  }, [parsedKeyPoints.length, isRevisitingCharacter, markPromptPrepFinishedForCurrentRun, magicMode,
    cancelAutomaticGuideCall, creationProgressCallId]);

  const creationMemoryActive = Boolean(
    !minimisePrompt
    || showPathChoiceOverlay
    || showStudioModal
    || parsedKeyPoints.length > 0
  );

  useEffect(() => {
    if (creationMemoryActive && !creationProjectId) {
      setCreationProjectId(createCreationProjectId());
    } else if (!creationDraft && !creationMemoryActive && creationProjectId) {
      setCreationProjectId("");
      setCinemaNarrationEnabled(false);
      setNarrationPreparedFor('');
    }
  }, [creationMemoryActive, creationProjectId, creationDraft]);

  useEffect(() => {
    if (!creationMemoryActive || !creationProjectId || !draftHydrated) return;

    const modeName = isAllFeeds ? "Unselected" : type === 0 ? "Shorts" : type === 1 ? "Cinema" : type === 3 ? "Games" : type === 2 ? "Audio" : "Create";
    const projectKey = `project:${creationProjectId}`;
    const promptText = String(prompt || "").trim();
    const originalPromptMatch = promptText.match(/Original prompt:'([^']*)'/);
    const originalRequestText = originalPromptMatch?.[1] || promptText;
    const planText = renderCreationMemorySections([
      ["Generation plan", Planx], ["Latest plan edit instruction", planEditText],
    ]);
    const characterSources = [
      ...(detectedCharacters || []),
      ...(detectedEnvironments || []),
      ...(referenceImages || []),
      ...(Vipcharacters || []),
    ];
    const characterNames = characterSources
      .map((item: any) => String(item?.name || item?.characterName || item?.environmentName || "").trim())
      .filter(Boolean);
    const sceneIndex = (parsedKeyPoints || []).map((scene: any, sceneIndexNumber: number) => {
      const sceneNumber = sceneIndexNumber + 1;
      const cinemaStage = type === 1 ? (sceneIndexNumber % 2 === 0 ? 'Stage A' : 'Stage B') : undefined;
      return {
        scene: sceneNumber,
        label: cinemaStage ? `Scene ${sceneNumber} (${cinemaStage})` : `Scene ${sceneNumber}`,
        ...(cinemaStage ? { stage: cinemaStage } : {}),
        brief: String(scene || '').slice(0, 260),
        intentSummary: String(intentOverview?.scenes?.[sceneIndexNumber]?.text || '').slice(0, 260),
        narrationSummary: String(parsedKeyPoints2?.[type === 1 ? Math.floor(sceneIndexNumber / 2) : sceneIndexNumber] || '').slice(0, 160),
      };
    });
    const sceneStateCards = (parsedKeyPoints || []).map((scene: any, sceneIndexNumber: number) => {
      const sceneNumber = sceneIndexNumber + 1;
      const cinemaStage = type === 1 ? (sceneIndexNumber % 2 === 0 ? 'Stage A' : 'Stage B') : undefined;
      return {
        cardKey: `${projectKey}:scene:${sceneNumber}:state`,
        title: cinemaStage ? `Scene ${sceneNumber} (${cinemaStage}) current state` : `Scene ${sceneNumber} current state`,
        cardType: 'creation_scene_state',
        sceneNumber: String(sceneNumber),
        mode: modeName,
        text: renderCreationMemorySections([
          ...(cinemaStage ? [['Cinema stage', `${cinemaStage} (Scene ${sceneNumber} of ${parsedKeyPoints.length}; ${sceneIndexNumber % 2 === 0 ? `Stage A main shot, shares narration with Scene ${sceneNumber + 1}` : `Stage B second main shot, not a B-roll, shares narration with Scene ${sceneNumber - 1}`})`]] as [string, unknown][] : []),
          ['Full generated scene', scene],
          ['Scene intent', intentOverview?.scenes?.[sceneIndexNumber]?.text],
          ['Narration', parsedKeyPoints2?.[type === 1 ? Math.floor(sceneIndexNumber / 2) : sceneIndexNumber]],
        ]),
      };
    });
    const chunkedCards: Array<{ cardKey: string; title: string; cardType: string; text: string; mode: string; sceneNumber?: string }> = [];
    const addChunkedCards = (key: string, title: string, cardType: string, body: string,
      sceneNumber?: string, onlyWhenOverflow = false) => {
      const parts = onlyWhenOverflow && body.length <= 12000 ? [] : chunkCreationMemoryText(body);
      const priorCount = creationMemoryPartCountsRef.current.get(key) || 0;
      creationMemoryPartCountsRef.current.set(key, parts.length);
      for (let index = 0; index < Math.max(priorCount, parts.length); index += 1) {
        chunkedCards.push({
          cardKey: `${key}:part:${index + 1}`,
          title: `${title} part ${index + 1}`,
          cardType,
          mode: modeName,
          ...(sceneNumber ? { sceneNumber } : {}),
          text: parts[index] || '',
        });
      }
      return parts.length;
    };
    const promptPartCount = addChunkedCards(`${projectKey}:prompt`, 'Current golden prompt', 'creation_golden_prompt', promptText);
    const originalRequestPartCount = addChunkedCards(
      `${projectKey}:original_request`, 'Original user request', 'creation_original_request',
      originalRequestText === promptText ? '' : originalRequestText,
    );
    const planPartCount = addChunkedCards(`${projectKey}:generation_plan`, 'Current generation plan',
      'creation_generation_plan_part', planText, undefined, true);
    const intentText = renderCreationMemorySections([
      ['Title', intentOverview?.title], ['Whole-creation overview', intentOverview?.overview],
    ]);
    const intentPartCount = addChunkedCards(`${projectKey}:intent_overview`, 'Current creation intent overview',
      'creation_intent_overview_part', intentText, undefined, true);
    const sceneIndexText = renderCreationMemorySections([
      ['Scene count', parsedKeyPoints.length], ['Scenes', sceneIndex],
    ]);
    const sceneIndexPartCount = addChunkedCards(`${projectKey}:scene_index`, 'Current creation scene index',
      'creation_scene_index_part', sceneIndexText, undefined, true);
    const sceneIntentPartCounts = (intentOverview?.scenes || []).map((entry, index) => {
      const sceneNumber = index + 1;
      const sceneLabel = type === 1 ? `Scene ${sceneNumber} (${index % 2 === 0 ? 'Stage A' : 'Stage B'})` : `Scene ${sceneNumber}`;
      return addChunkedCards(
        `${projectKey}:scene:${sceneNumber}:intent`, `${sceneLabel} creation intent`, 'creation_scene_intent_part',
        renderCreationMemorySections([['Scene label', sceneLabel], ['Full scene intent', entry.text]]), String(sceneNumber), true,
      );
    });
    const previousSceneIntentCount = creationMemorySceneIntentCountsRef.current.get(projectKey) || 0;
    creationMemorySceneIntentCountsRef.current.set(projectKey, sceneIntentPartCounts.length);
    const removedSceneIntentCards = Array.from(
      { length: Math.max(0, previousSceneIntentCount - sceneIntentPartCounts.length) },
      (_, offset) => {
        const sceneNumber = sceneIntentPartCounts.length + offset + 1;
        addChunkedCards(`${projectKey}:scene:${sceneNumber}:intent`, `Scene ${sceneNumber} creation intent`,
          'creation_scene_intent_part', '', String(sceneNumber), true);
        return { cardKey: `${projectKey}:scene:${sceneNumber}:intent`, title: `Scene ${sceneNumber} creation intent`,
          cardType: 'creation_scene_intent', sceneNumber: String(sceneNumber), mode: modeName, text: '' };
      },
    );
    const characterText = renderCreationMemorySections([
      ["Detected characters", detectedCharacters],
      ["Detected environments", detectedEnvironments],
      ["Reference appearance: current drafts and committed render sources", referenceImages.map(reference => ({
        ...reference, currentPromptDraft: referencePromptDraftsRef.current.get(String(reference.clientReferenceId)) ?? reference.prompt,
        evidence: referenceEditEvidence(reference, referencePromptDraftsRef.current.get(String(reference.clientReferenceId))),
        field: 'reference_appearance', provenance: 'current-owner',
      }))],
      ["Directly added characters", Vipcharacters],
    ]);
    const characterPartCount = addChunkedCards(`${projectKey}:characters`, 'Project characters and environments',
      'creation_characters_part', characterText, undefined, true);
    const musicText = promptMusicUrl || promptMusicName || promptMusicSegments.length
      ? renderCreationMemorySections([
        ["Music name", promptMusicName],
        ["Music duration seconds; zero means metadata is not ready", promptMusicDurationSec],
        ["Music scene breaker seconds", promptMusicBreakerSec],
        ["Music scene count", promptMusicSceneCount],
        ["Music timing segments", promptMusicSegments],
      ]) : '';
    const musicPartCount = addChunkedCards(`${projectKey}:music_plan`, 'Creation music plan',
      'creation_music_plan_part', musicText, undefined, true);

    syncCreationMemoryCards([
      {
        cardKey: `${projectKey}:overview`,
        title: "Creation project overview",
        cardType: "creation_overview",
        mode: modeName,
        entities: characterNames,
        text: renderCreationMemorySections([
          ["Original request excerpt", originalRequestText.slice(0, 360)],
          ["Golden prompt excerpt", promptText.slice(0, 360)],
          ["Golden prompt parts", promptPartCount],
          ["Original request parts; zero means same as golden prompt", originalRequestPartCount],
          ["Creation mode", modeName],
          ["Games experience", type === 3 ? interactionExperienceMode || "not selected" : "not applicable"],
          ["Cinema music video", type === 1 && Boolean(promptMusicUrl)],
          ["Selected art style", selectedStyle || artstyleRedux || "Auto"],
          ["Aspect ratio", ratioKey],
        ]),
      },
      {
        cardKey: `${projectKey}:generation_plan`,
        title: "Current generation plan",
        cardType: "creation_generation_plan",
        mode: modeName,
        text: planPartCount ? renderCreationMemorySections([
          ["Plan parts", planPartCount],
          ["Latest plan edit instruction excerpt", planEditText.slice(0, 360)],
        ]) : planText,
      },
      {
        cardKey: `${projectKey}:intent_overview`,
        title: 'Current creation intent overview',
        cardType: 'creation_intent_overview',
        mode: modeName,
        text: intentPartCount ? renderCreationMemorySections([
          ['Title', intentOverview?.title],
          ['Whole-creation overview excerpt', intentOverview?.overview?.slice(0, 600)],
          ['Full overview parts', intentPartCount],
        ]) : intentText,
      },
      {
        cardKey: `${projectKey}:characters`,
        title: "Current project characters and environments",
        cardType: "creation_characters",
        mode: modeName,
        entities: characterNames,
        text: characterPartCount ? renderCreationMemorySections([
          ["Character and environment names", characterNames.slice(0, 30)],
          ["Full character/reference parts", characterPartCount],
        ]) : characterText,
      },
      {
        cardKey: `${projectKey}:scene_index`,
        title: "Current creation scene index",
        cardType: "creation_scene_index",
        mode: modeName,
        text: sceneIndexPartCount ? renderCreationMemorySections([
          ["Scene count", parsedKeyPoints.length],
          ["First scene summaries", sceneIndex.slice(0, 12)],
          ["Full scene index parts", sceneIndexPartCount],
          ["Per-scene intent part counts", sceneIntentPartCounts],
        ]) : sceneIndexText,
      },
      {
        cardKey: `${projectKey}:music_plan`,
        title: "Current creation music plan",
        cardType: "creation_music_plan",
        mode: modeName,
        text: musicPartCount ? renderCreationMemorySections([
          ["Music name", promptMusicName], ["Music duration seconds", promptMusicDurationSec],
          ["Music scene count", promptMusicSceneCount],
          ["Full music plan parts", musicPartCount],
        ]) : musicText,
      },
      {
        cardKey: `${projectKey}:selected_reference`,
        title: 'Currently open character or environment reference',
        cardType: 'creation_selected_reference',
        mode: modeName,
        text: editingRefIdx !== null && referenceImages[editingRefIdx]
          ? renderCreationMemorySections([
            ['Project ID', creationProjectId],
            ['Reference ID', referenceImages[editingRefIdx].clientReferenceId],
            ['Field context', 'reference_appearance; separate from scene composition and lighting'],
            ['Current owner evidence', referenceEditEvidence(referenceImages[editingRefIdx], imagePromptVal)],
            ['Name', referenceImages[editingRefIdx].name],
            ['Type', referenceImages[editingRefIdx].type],
            ['Detected description', referenceImages[editingRefIdx].description],
            ['Current image prompt draft', imagePromptVal || '(empty)'],
            ['Current Update with AI instruction', aiUpdateVal || '(none)'],
            ['Has reference image', Boolean(getUsableReferenceImage(referenceImages[editingRefIdx]))],
          ]) : '',
      },
      ...(intentOverview?.scenes || []).map((entry, index) => {
        const sceneNumber = index + 1;
        const sceneLabel = type === 1 ? `Scene ${sceneNumber} (${index % 2 === 0 ? 'Stage A' : 'Stage B'})` : `Scene ${sceneNumber}`;
        return {
          cardKey: `${projectKey}:scene:${sceneNumber}:intent`,
          title: `${sceneLabel} creation intent`,
          cardType: 'creation_scene_intent',
          sceneNumber: String(sceneNumber),
          mode: modeName,
          text: sceneIntentPartCounts[index] ? renderCreationMemorySections([
            ['Scene label', sceneLabel],
            ['Intent excerpt', entry.text.slice(0, 500)],
            ['Full intent parts', sceneIntentPartCounts[index]],
          ]) : renderCreationMemorySections([
            ['Scene label', sceneLabel], ['Full scene intent', entry.text],
          ]),
        };
      }),
      ...(!creationDraft ? sceneStateCards : []),
      ...removedSceneIntentCards,
      ...chunkedCards,
    ].filter(card => !creationDraft || !card.cardKey.startsWith(`${projectKey}:scene_index`)),
    { owner: `prompt:${creationProjectId}`, priority: 0 });
  }, [
    Planx, Vipcharacters, artstyleRedux, creationMemoryActive, creationProjectId,
    detectedCharacters, detectedEnvironments, parsedKeyPoints, parsedKeyPoints2, intentOverview,
    editingRefIdx, imagePromptVal, aiUpdateVal,
    planEditText, prompt, promptMusicBreakerSec, promptMusicName, promptMusicSceneCount,
    promptMusicDurationSec, promptMusicSegments, promptMusicUrl, interactionExperienceMode,
    ratioKey, referenceImages, selectedStyle,
    syncCreationMemoryCards, type, isAllFeeds, creationDraft, draftHydrated,
  ]);

  useEffect(() => {
    if (!creationMemoryActive || !creationProjectId || !creationDraft || !draftHydrated) return;
    syncCreationMemoryCards(buildDraftCreationMemory(draftStatus.snapshot), {
      owner: `draft:${creationProjectId}`, priority: 1,
    });
  }, [creationMemoryActive, creationProjectId, creationDraft, draftHydrated, draftStatus.snapshot, syncCreationMemoryCards]);

  // Observe milestones while Auto Control is on. Unchanged polls make no model
  // request, and these announcements never replace or advance the user's task.
  const creationProgressLiveRef = useRef({ phase: 0, outlineCount: 0, sceneCount: 0,
    intentCount: 0, previewCount: 0, overview: '', mode: '' });
  creationProgressLiveRef.current = {
    phase: Number(planInfo) || 0,
    outlineCount: parsedKeyPointsx.length,
    sceneCount: parsedKeyPoints.length,
    intentCount: intentOverview?.scenes?.length || 0,
    previewCount: nanoImages.filter(Boolean).length,
    overview: String(intentOverview?.overview || '').slice(0, 260),
    mode: isAllFeeds ? 'Unselected' : type === 0 ? 'Shorts' : type === 1 ? 'Cinema' : type === 3 ? 'Games' : 'Create',
  };
  useEffect(() => {
    if (!creationProgressRunKey || showPathChoiceOverlay || !autoControlEnabled || !autoControlVisible) {
      cancelAutomaticGuideCall(creationProgressCallId);
      return;
    }
    if (creationProgressReportedRef.current.runKey !== creationProgressRunKey) {
      creationProgressReportedRef.current = { runKey: creationProgressRunKey, milestones: new Set() };
    }
    const tick = () => {
      if (creationProgressBusyRef.current) return;
      const current = creationProgressLiveRef.current;
      const milestone = current.previewCount > 0 ? 'scene previews started'
        : current.sceneCount > 0 && current.intentCount >= current.sceneCount ? 'scene intents ready'
          : current.overview ? 'whole-creation intent ready'
            : current.sceneCount > 0 ? 'generation plan and scenes ready'
              : current.outlineCount > 0 ? 'scene outline ready'
                : current.phase > 0 ? 'creation started; preparing the outline' : '';
      const reported = creationProgressReportedRef.current;
      if (!milestone || reported.milestones.has(milestone)) return;
      reported.milestones.add(milestone);
      creationProgressBusyRef.current = true;
      void runAutomaticGuideCall({
        callId: creationProgressCallId,
        message: `Creation progress observation only, not a new user instruction or app action. Mode: ${current.mode}. Milestone: ${milestone}. Outline entries: ${current.outlineCount}; scene slots: ${current.sceneCount}; scene intents ready: ${current.intentCount}; previews ready: ${current.previewCount}. ${current.overview ? `Whole-creation intent: ${current.overview}.` : ''} Give one short factual update about this new milestone. Do not claim unfinished work is ready. Preserve the original brief, requested workflow and publication boundary. Do not call VirtualGate or change task disposition in this announcement.`,
        runOncePerReload: false,
      }).finally(() => { creationProgressBusyRef.current = false; });
    };
    const timer = window.setInterval(tick, 4000);
    return () => window.clearInterval(timer);
  }, [creationProgressRunKey, showPathChoiceOverlay, autoControlEnabled, autoControlVisible,
    runAutomaticGuideCall, cancelAutomaticGuideCall, creationProgressCallId]);


  useEffect(() => {
    const modeName = isAllFeeds ? 'Unselected' :
      type === 0 ? 'Shorts' :
        type === 1 ? 'Cinema' :
          type === 3 ? 'Games' :
            type === 2 ? 'Audio' : 'Create';
    const promptText = String(prompt || '');
    const memoryKey = `project:${creationProjectId}`;
    const directUploadRefs = (Vipcharacters || []).filter((item: any) => item?.source === 'upload' || item?.imageUrl);
    const uploadedIdentityRefs = (Vipcharacters || []).filter((item: any) => item?.source === 'upload');
    const worldCharacterRefs = (Vipcharacters || []).filter((item: any) => item?.source === 'world');
    const referenceNames = (referenceImages || [])
      .map((item: any) => String(item?.name || item?.type || 'Reference').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 12);
    const directUploadReferenceNames = uploadedIdentityRefs
      .map((item: any) => String(item?.name || 'Uploaded character').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 12);
    const worldCharacterReferenceNames = worldCharacterRefs
      .map((item: any) => String(item?.name || 'World character').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 12);
    const hasPreviewChoice = Boolean(showPathChoiceOverlay);
    const hasCharacterStudio = Boolean(showStudioModal);
    const hasStoryboard = parsedKeyPoints.length > 0;
    const ownsCreationSurface = !hasStoryboard || hasPreviewChoice || hasCharacterStudio;
    const hasExtractedReferences = detectedCharacters.length > 0 || detectedEnvironments.length > 0;
    const referenceImageReadyCount = referenceImages.filter((item: any) => Boolean(getUsableReferenceImage(item))).length;
    const referenceImageMissingCount = referenceImages.filter(referenceNeedsImage).length;
    const stepOneDetectionActive = (castingPipelineActive || isDetectionInProgressRef.current) && castingStatus.startsWith('Step 1 of 2');
    const stepTwoAuditActive = stepTwoAuditInProgress || castingStatus.startsWith('Step 2 of 2: Auditing');
    const referenceImageGenerationActive = referenceLoading || referencePendingCount > 0 || referenceImages.some(isReferenceWorking) || castingStatus.startsWith('Step 2 of 2: Generating');
    const canUseStepOneCharacters = !stepTwoCastingCancelled && stepOneCastingReady && stepOneDetectedCount > 0 && stepTwoAuditActive;
    const canGenerateCharacterImages = hasCharacterStudio && hasExtractedReferences && referenceImageMissingCount > 0
      && !referenceImageGenerationActive && !stepOneDetectionActive && !stepTwoAuditActive;
    const characterBranchStage = !hasCharacterStudio
      ? undefined
      : stepTwoAuditActive
          ? (canUseStepOneCharacters ? 'character_creation_step_02_auditing_use_step_01_available' : 'character_creation_step_02_auditing')
          : stepOneDetectionActive
            ? 'character_creation_step_01_detecting'
            : referenceImageGenerationActive
              ? 'character_creation_generating_reference_images'
            : canGenerateCharacterImages
              ? 'character_creation_ready_to_generate_images'
              : hasExtractedReferences
                ? 'character_creation_review_references'
                : 'character_creation_ready_to_find_characters';
    const stage = hasPreviewChoice
      ? 'creation_preview_decision'
      : hasCharacterStudio
        ? characterBranchStage || 'character_reference_creation'
        : !minimisePrompt && hasStoryboard
          ? 'storyboard_or_generated_scene_review'
          : !minimisePrompt
            ? 'prompt_input_golden_prompt'
            : 'feed_browsing';
    const selectedModelForSnapshot = modelz && modelz !== 'Models' ? modelz : (modelRedux || DEFAULT_IMAGE_MODEL);
    const selectedModelPixelRequirement = calcModelPixels({ model: selectedModelForSnapshot, baseImagesPerDollar: 333 });
    const currentActionPixelRequirement = studioActionCost || (hasCharacterStudio ? selectedModelPixelRequirement * Math.max(directUploadRefs.length, referenceImages.length, 1) : selectedModelPixelRequirement);
    const activeControls = new Set<string>();

    if (!minimisePrompt && stage === 'prompt_input_golden_prompt') {
      ['prompt input', 'mode selector', 'model selector', 'world or character upload', 'aspect ratio', 'create'].forEach((value) => activeControls.add(value));
    }
    if (!minimisePrompt && type === 1) activeControls.add('music');
    if (hasPreviewChoice) {
      ['edit generation plan', 'go', 'skip', 'create characters'].forEach((value) => activeControls.add(value));
    }
    if (hasCharacterStudio) {
      ['casting instruction', 'reference cards', 'scenes review'].forEach((value) => activeControls.add(value));
      if (!hasExtractedReferences) activeControls.add('find characters');
      if (canUseStepOneCharacters) activeControls.add('use this');
      if (canGenerateCharacterImages) activeControls.add('generate images');
      if (referenceImages.length > 0) {
        ['edit character names', 'manual reference review', 'remove reference'].forEach((value) => activeControls.add(value));
      }
      if (hasExtractedReferences && referenceImageMissingCount === 0 && !referenceImageGenerationActive) activeControls.add('continue');
    }
    if (promptMusicUrl) activeControls.add('music scene previews');
    if (directUploadRefs.length > 0) activeControls.add('remove uploaded image with close icon');

    const creationPatch = {
        isActive: !minimisePrompt || hasPreviewChoice || hasCharacterStudio || hasStoryboard,
        projectId: creationProjectId || undefined,
        ...(ownsCreationSurface ? { sceneSlots: undefined, sceneDisplayRevision: undefined, displaySceneCount: undefined,
          editStoryDisplaySceneNumber: undefined, editStoryDisplayRole: undefined } : {}),
        stage,
        mode: modeName,
        modeType: isAllFeeds ? undefined : Number(type),
        modeSelectionRequired: isAllFeeds,
        goBlockedReason: isAllFeeds ? 'Choose Shorts, Games or Cinema to continue.' : null,
        interactionExperienceMode: type === 3 ? interactionExperienceMode : null,
        promptOpen: !minimisePrompt,
        promptCharacterCount: promptText.length,
        selectedModel: selectedModelForSnapshot,
        selectedModelDisplayName: getCreationImageModelName(selectedModelForSnapshot),
        selectedModelPixelRequirement,
        currentActionPixelRequirement,
        selectedArtStyle: selectedStyle || artstyleRedux || 'Auto',
        aspectRatio: Number(ratioKey) || 1,
        pixelsBalance: Number(pixelsRedux) || 0,
        hasPromptMusic: Boolean(promptMusicUrl),
        promptMusicName: promptMusicName || undefined,
        promptMusicDurationSec,
        promptMusicTimingReady: Boolean(promptMusicUrl && promptMusicDurationSec > 0),
        promptMusicBreakerSec,
        promptMusicSceneCount,
        directUploadReferenceCount: uploadedIdentityRefs.length,
        directUploadReferenceNames,
        selectedWorldId: selectedWorldId == null ? null : String(selectedWorldId),
        worldCharacterReferenceCount: worldCharacterRefs.length,
        worldCharacterReferenceNames,
        referenceCount: referenceImages.length,
        referenceNames,
        previewSceneCount: parsedKeyPoints.length,
        previewImageCount: nanoImages.filter(Boolean).length,
        promptMemoryPartCount: creationMemoryPartCountsRef.current.get(`${memoryKey}:prompt`) || 0,
        originalRequestMemoryPartCount: creationMemoryPartCountsRef.current.get(`${memoryKey}:original_request`) || 0,
        generationPlanMemoryPartCount: creationMemoryPartCountsRef.current.get(`${memoryKey}:generation_plan`) || 0,
        intentOverviewMemoryPartCount: creationMemoryPartCountsRef.current.get(`${memoryKey}:intent_overview`) || 0,
        sceneIndexMemoryPartCount: creationMemoryPartCountsRef.current.get(`${memoryKey}:scene_index`) || 0,
        sceneIntentMemoryPartCounts: (intentOverview?.scenes || []).map((_entry, index) =>
          creationMemoryPartCountsRef.current.get(`${memoryKey}:scene:${index + 1}:intent`) || 0),
        characterMemoryPartCount: creationMemoryPartCountsRef.current.get(`${memoryKey}:characters`) || 0,
        musicMemoryPartCount: creationMemoryPartCountsRef.current.get(`${memoryKey}:music_plan`) || 0,
        planEditTextLength: planEditText.trim().length,
        activeControls: Array.from(activeControls),
        status: hasPreviewChoice ? 'reviewing scene previews before storyboard' : isSubmittingKick
          ? 'building generation plan'
          : editGenSnapshot
            ? 'regenerating edited plan'
            : hasPreviewChoice
              ? 'reviewing scene previews before storyboard'
              : hasCharacterStudio
                ? castingStatus
                : !minimisePrompt
                  ? 'editing creation prompt'
                  : 'idle',
        isGenerating: Boolean(isSubmittingKick || allowSpin || referenceLoading || referencePendingCount > 0 || castingPipelineActive || isDetectionInProgressRef.current || stepTwoAuditInProgress),
        canEditGenerationPlan: hasPreviewChoice,
        canUseSkipToStoryboard: hasPreviewChoice,
        canCreateCharacters: hasPreviewChoice || hasCharacterStudio,
        canRemoveDirectUploadImages: directUploadRefs.length > 0 || GeneratedImage.length > 0,
        characterBranchStage,
        castingInstruction: hasCharacterStudio ? castingInstruction.trim() : undefined,
        detectedCharacterCount: hasCharacterStudio ? detectedCharacters.length : undefined,
        detectedEnvironmentCount: hasCharacterStudio ? detectedEnvironments.length : undefined,
        referenceImageReadyCount: hasCharacterStudio ? referenceImageReadyCount : undefined,
        referenceImageMissingCount: hasCharacterStudio ? referenceImageMissingCount : undefined,
        referenceEditorOpen: editingRefIdx !== null,
        selectedReferenceId: editingRefIdx !== null ? referenceImages[editingRefIdx]?.clientReferenceId : undefined,
        referenceEditEvidence: referenceImages.slice(0, 24).map(reference => referenceEditEvidence(reference, referencePromptDraftsRef.current.get(String(reference.clientReferenceId)))),
        selectedReferenceName: editingRefIdx !== null ? referenceImages[editingRefIdx]?.name : undefined,
        selectedReferenceType: editingRefIdx !== null ? referenceImages[editingRefIdx]?.type : undefined,
        selectedReferencePromptLength: editingRefIdx !== null ? imagePromptVal.length : undefined,
        selectedReferenceUpdateLength: editingRefIdx !== null ? aiUpdateVal.length : undefined,
        referenceDraftPrompt: editingRefIdx !== null ? imagePromptVal : undefined,
        referenceAiInstruction: editingRefIdx !== null ? aiUpdateVal : undefined,
        stepOneDetectedCount: hasCharacterStudio ? stepOneDetectedCount : undefined,
        stepOneCastingReady: hasCharacterStudio ? stepOneCastingReady : undefined,
        stepTwoAuditInProgress: hasCharacterStudio ? stepTwoAuditInProgress : undefined,
        stepTwoCastingCancelled: hasCharacterStudio ? stepTwoCastingCancelled : undefined,
        canUseStepOneCharacters: hasCharacterStudio ? canUseStepOneCharacters : undefined,
        canGenerateCharacterImages: hasCharacterStudio ? canGenerateCharacterImages : undefined,
        canEditCharacterNames: hasCharacterStudio ? referenceImages.length > 0 : undefined,
        canReviewScenesDuringCharacterCreation: hasCharacterStudio ? parsedKeyPoints.length > 0 : undefined,
    };
    // Storybook/workstation owns its own active stage and job status.
    dispatch(patchUserSnapshot({ creation: ownsCreationSurface ? creationPatch :
      Object.fromEntries(Object.entries(creationPatch).filter(([key]) =>
        key === 'projectId' || key === 'previewSceneCount' || key === 'previewImageCount' || key.includes('MemoryPart'))) }));
  }, [
    dispatch,
    type,
    isAllFeeds,
    prompt,
    minimisePrompt,
    parsedKeyPoints,
    nanoImages,
    showPathChoiceOverlay,
    showStudioModal,
    modelz,
    modelRedux,
    studioActionCost,
    selectedStyle,
    artstyleRedux,
    ratioKey,
    pixelsRedux,
    promptMusicUrl,
    promptMusicName,
    promptMusicDurationSec,
    promptMusicBreakerSec,
    promptMusicSceneCount,
    interactionExperienceMode,
    Vipcharacters,
    selectedWorldId,
    referenceImages,
    planEditText,
    Planx,
    intentOverview,
    creationProjectId,
    isSubmittingKick,
    editGenSnapshot,
    castingStatus,
    allowSpin,
    referenceLoading,
    referencePendingCount,
    castingPipelineActive,
    stepTwoAuditInProgress,
    stepTwoCastingCancelled,
    stepOneCastingReady,
    stepOneDetectedCount,
    detectedCharacters.length,
    detectedEnvironments.length,
    castingInstruction,
    studioButtonStage,
    editingRefIdx,
    imagePromptVal,
    aiUpdateVal,
    GeneratedImage.length,
  ]);

  /**
   * Worlds and reference images for the landing top row.
   *
   * Worlds come first and render as circles — the silhouette is the contract:
   * a world reproduces exactly, an image is an identity reference the story is
   * free to reinterpret.
   *
   * Every item declares an aspectRatio so the row's overflow can be measured
   * BEFORE the images decode. Uploads have no ratio of their own until VIP
   * recreates them, so the current canvas ratio is the honest fallback.
   */
  const landingSelectionItems = useMemo(() => {
    const ratioForCanvas = Number(ratioKey) === 2
      ? '1 / 1'
      : Number(ratioKey) === 3
        ? '16 / 9'
        : '9 / 16';

    const items: Array<{ id: string; src: string; kind: 'world' | 'image'; aspectRatio?: string }> = [];

    if (worldCover) {
      items.push({ id: `world-${selectedWorldId || worldCover}`, src: worldCover, kind: 'world' });
    }

    (GeneratedImage || []).forEach((src: any, imageIndex: number) => {
      if (!src) return;
      items.push({
        id: `image-${imageIndex}-${String(src).slice(-24)}`,
        src,
        kind: 'image',
        aspectRatio: ratioForCanvas,
      });
    });

    return items;
  }, [GeneratedImage, ratioKey, selectedWorldId, worldCover]);

  const keepLandingFullscreenInMenuColumn = Boolean(
    minimizeMode === 0
    && isMenuOpen
    && !matchMobile
    && parsedKeyPoints.length === 0
  );
  const showLandingWelcome = Boolean(
    showPromptWelcomeUI
    && minimizeMode !== 2
    && !isMirrorFocused
    && generatedImagesFluxx.length === 0
    && parsedKeyPoints.length === 0
  );

  /**
   * CREATION STAGE - single source of truth for which of PromptInput's four
   * screens is currently up. Derived from the pipeline's own state (see
   * ./creationStage.ts), so it can never drift from what is really rendered.
   *
   * `creationStage.isComposer` is the flag to branch layout on: it is true ONLY
   * for the initial prompt-entry look, before anything has been generated. Once
   * a result or a storyboard exists the stage moves to 'preview' / 'story' and
   * those views keep their current styling untouched.
   */
  const creationStage: CreationStageInfo = useMemo(
    () => getCreationStageInfo({
      minimisePrompt: Boolean(minimisePrompt),
      parsedKeyPointsCount: parsedKeyPoints.length,
      generatedImageFlux: GeneratedImageFlux,
      generatedImagesFluxCount: generatedImagesFluxx.length,
      planInfo,
      allowSpin: Boolean(allowSpin),
      isSubmittingKick: Boolean(isSubmittingKick),
      countdown: null,
      showLandingWelcome,
      minimizeMode,
    }),
    [
      minimisePrompt,
      parsedKeyPoints.length,
      GeneratedImageFlux,
      generatedImagesFluxx.length,
      planInfo,
      allowSpin,
      isSubmittingKick,
      showLandingWelcome,
      minimizeMode,
    ]
  );

  usePromptInputHistory({
    historyOwner: promptHistoryOwner,
    open: !minimisePrompt,
    suspended: isStandaloneTemplatesOpen,
    blockBack: !creationStage.isComposer || Boolean(isSubmitting || isBlinking
      || referenceLoading || referencePendingCount > 0 || castingPipelineActive || stepTwoAuditInProgress),
    routeKey: location.key,
    onClose: () => setminimisePrompt(true),
    onReopen: () => setminimisePrompt(false),
  });

  useEffect(() => {
    if (!creationDraft) return;
    const unregister = registerActiveDraftController(creationDraft);
    const stopDiagnostics = observeCreationDraft(creationDraft, Boolean(import.meta.env.DEV));
    return () => { unregister(); stopDiagnostics(); creationDraft.flushLocal(); void creationDraft.flush().catch(() => undefined); };
  }, [creationDraft]);
  useLayoutEffect(() => {
    if (!creationDraft || !draftEntry) return;
    // The existing reference context is seeded before Storybook can mount.
    setGeneratedImage(draftSeed.GeneratedImage || []);
    setVipcharacters(draftSeed.Vipcharacters || []);
    setRemixData(draftSeed.remixData || '');
    setWorldCover(draftSeed.worldCover || '');
    setWorldStyle(draftSeed.worldStyle || '');
    setSelectedWorldId(draftSeed.selectedWorldId ?? null);
    if (typeof draftSeed.aspectRatio === 'number') dispatch(setAspectRatio(draftSeed.aspectRatio));
    if (draftSeed.narrationPreparedFor) setNarrationPreparedFor(narrationPreparationKey);
    // Common spatial context returns; generated spatial orchestration is absent.
    setSpatialManifest({ version: 1, scenes: [] });
    setSpatialMotionContexts([]);
    setBShotSpatialScenes([]);
    setBShotSpatialContexts([]);
    setallowgetImage(false);
    setCreationMode('Video');
    creationDraft.endHydration();
    setDraftHydrated(true);
  }, [creationDraft, draftEntry]);
  useEffect(() => {
    if (!draftHydrated) return;
    captureCreationCache(creationDraft, 'prompt', { GeneratedImage, Vipcharacters, remixData,
      worldCover, worldStyle, selectedWorldId, aspectRatio: ratioKey });
  }, [creationDraft, draftHydrated, GeneratedImage, Vipcharacters, remixData, worldCover, worldStyle, selectedWorldId, ratioKey]);

  /**
   * PC-ONLY ACTION-ROW METRICS (compact composer pill).
   *
   * The bottom row - Styles / model / upload / Create - was assembled button by
   * button, so on desktop each control carried its own height, radius, padding
   * and glass recipe and the four read as unrelated chips rather than one bar.
   * These tokens are the single source of truth for that row on PC: every
   * control below reads them, so the row stays uniform and one edit here
   * restyles all of it.
   *
   * Mobile is deliberately untouched - it keeps its 44px touch targets and its
   * own spacing, which are tuned against the transformed prompt/audio row.
   */
  useEffect(() => {
    dispatch(patchUserSnapshot({
      creation: {
        isInitialComposer: creationStage.isComposer,
        isCompactOverlay: creationStage.isCompact,
        minimizeMode,
      },
    }));
    return () => {
      dispatch(patchUserSnapshot({
        creation: {
          isInitialComposer: false,
          isCompactOverlay: false,
        },
      }));
    };
  }, [dispatch, creationStage.isComposer, creationStage.isCompact, minimizeMode]);

  const creationDeckEnabled = useCreationDeckEnabled();
  const [promptDeckVisible, setPromptDeckVisible] = useState(true);
  const [promptDeckId, setPromptDeckId] = useState<string>();
  const [storybookImagination, setStorybookImagination] = useState<CreationImaginationProgress | null>(null);
  const [deckCloseReviewRequest, setDeckCloseReviewRequest] = useState(0);
  const characterStudioPortal = useRef<HTMLDivElement>(null);
  const underlyingStoryboardDeck = useRef<{ close: () => void; reopen: () => void } | null>(null);
  const showNativeImagination = isSubmittingKick && parsedKeyPoints.length === 0;
  const imaginationHasContent = storybookImagination !== null;
  const promptDeckStage = showStudioModal ? 'characters' : showPathChoiceOverlay ? 'preview'
    : imaginationHasContent ? 'imagination' : null;
  const promptDeckModelsAvailable = promptDeckStage !== 'imagination' && Boolean(GeneratedImageFlux || parsedKeyPoints.length > 0);
  const promptDeckOpen = creationDeckEnabled && promptDeckVisible && Boolean(promptDeckStage) && !minimisePrompt;
  const promptDeckForegroundPopup = selectedSceneIndex !== null || editingRefIdx !== null || renameModalOpen || showIntentPanel || open;
  useEffect(() => {
    if (!isSubmittingKick && !showPathChoiceOverlay && !showStudioModal && parsedKeyPoints.length === 0) setPromptDeckVisible(true);
  }, [isSubmittingKick, showPathChoiceOverlay, showStudioModal, parsedKeyPoints.length]);
  useEffect(() => setPromptDeckId(undefined), [promptDeckStage, creationProjectId]);
  useEffect(() => { if (creationDeckEnabled) setPromptDeckVisible(true); }, [creationDeckEnabled]);
  useEffect(() => {
    if (!showStudioModal) underlyingStoryboardDeck.current = null;
  }, [showStudioModal]);
  const closePromptCreationDeck = () => {
    setPromptDeckVisible(false);
    if (showStudioModal) underlyingStoryboardDeck.current?.close();
  };
  useEffect(() => {
    if (!promptDeckOpen || promptDeckForegroundPopup) return;
    const closeView = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const foregroundDialog = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).some(dialog => {
        if (dialog.closest('[data-creation-deck-covered="true"], [inert], [aria-hidden="true"]')) return false;
        const style = getComputedStyle(dialog);
        return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) !== 0 && dialog.getClientRects().length > 0;
      });
      if (foregroundDialog) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (pendingReferenceRemoval) { setPendingReferenceRemoval(null); return; }
      if (showStudioModal && showScenesPopup) { setShowScenesPopup(false); return; }
      if (showPathChoiceOverlay && expandedChoiceScene > 0) {
        setExpandedChoiceScene(expandedChoiceScene === 2 ? 1 : 0);
        return;
      }
      closePromptCreationDeck();
    };
    document.addEventListener('keydown', closeView);
    return () => document.removeEventListener('keydown', closeView);
  }, [promptDeckOpen, promptDeckForegroundPopup, showStudioModal, pendingReferenceRemoval,
    showScenesPopup, showPathChoiceOverlay, expandedChoiceScene]);

  const requestDeckCloseReview = () => setDeckCloseReviewRequest(value => value + 1);
  const chooseSkipCharacters = () => {
    setShowPathChoiceOverlay(false);
    handleSkipCharacters();
  };
  const closeCharacterStudio = () => {
    setShowStudioModal(false);
    setShowScenesPopup(false);
  };
  const openStudioReference = (index: number) => {
    if (studioButtonStage === 'post-countdown') {
      setStudioButtonStage('post-continue');
      setStudioActionTimer(null);
    }
    selectReferenceForEditing(index, { resetZoom: true });
  };
  const refreshStudioReferences = () => {
    if (!castingInstruction.trim()) {
      removedReferenceNamesRef.current = [];
      setDetectedCharacters([]);
      setDetectedEnvironments([]);
      updateReferenceImages(() => []);
      setQueuedCastingPrompts([]);
    }
    hasStartedCastingRef.current = false;
    runAutoCastingPipeline(false);
  };
  const acceptStudioFirstPass = () => {
    useStepOneCharacterResults();
    setStudioButtonStage('continue-editing' as any);
    setCastingStatus('Using step 1 character results.');
  };
  const openCharacterStudio = (fromDeck = false) => {
    if (creationDeckEnabled) setPromptDeckVisible(fromDeck);
    isRevisitingCharacterRef.current = true;
    setIsRevisitingCharacter(true);
    setStudioActionTimer(null);
    const characterWorkActive = castingPipelineActive || isDetectionInProgressRef.current || referenceLoading || referencePendingCount > 0 || referenceImages.some(isReferenceWorking);
    if (characterWorkActive) {
      // Character creation still running in background: show live progress, don't present idle UI
      setShowStudioModal(true);
      setStudioButtonStage('generating');
      if (creationDeckEnabled && fromDeck) {
        hasAutoOpenedScenesRef.current = true;
        setShowScenesPopup(false);
      } else openScenesForCharacterEntry();
      return;
    }
    mergeVipReferenceCards();
    setShowStudioModal(true);
    if (creationDeckEnabled && fromDeck) {
      hasAutoOpenedScenesRef.current = true;
      setShowScenesPopup(false);
    } else openScenesForCharacterEntry();

    if (referenceImages.length === 0) {
      // SIMPLIFIED REVISIT: No automatic casting, no countdown.
      // User gets a GENERATE button to manually trigger casting,
      // and an X close button to instantly exit.
      setStudioButtonStage('post-continue');
      setCastingStatus("");
    } else {
      setStudioButtonStage('post-continue');
    }
  };
  const chooseCreateCharacters = () => {
    isRevisitingCharacterRef.current = false;
    setIsRevisitingCharacter(false);
    setShowPathChoiceOverlay(false);
    if (creationDeckEnabled && promptDeckVisible) {
      hasAutoOpenedScenesRef.current = true;
      setShowScenesPopup(false);
    } else openScenesForCharacterEntry();
    const hasExistingCharacters = detectedCharacters.length > 0 || detectedEnvironments.length > 0;
    const characterWorkActive = castingPipelineActive || isDetectionInProgressRef.current || stepTwoAuditInProgress || referenceLoading || referencePendingCount > 0 || referenceImages.some(isReferenceWorking);
    if (characterWorkActive) {
      // Character creation still running in background: reopen to watch progress, do NOT restart
      setShowStudioModal(true);
      setStudioButtonStage('generating');
    } else if (hasExistingCharacters) {
      // Characters already exist: reopen the studio WITHOUT re-running casting
      setShowStudioModal(true);
      setStudioButtonStage('post-continue');
    } else {
      setStudioButtonStage('generating');
      setShowStudioModal(true);
      runAutoCastingPipeline();
    }
  };
  const renderStudioAction = (inDeck = false) => {
  const hasExtractedData = detectedCharacters.length > 0 || detectedEnvironments.length > 0;
  const hasMissingImages = referenceImages.length === 0 || referenceImages.some(referenceNeedsImage);

  const pendingCardCount = referenceImages.filter(isReferenceWorking).length;
  const displayRefCount = Math.max(queuedCastingPrompts.length, referencePendingCount, pendingCardCount);
  const displayActionCost = displayRefCount > 0
      ? (studioActionCost || calcModelPixels({ model: modelz, baseImagesPerDollar: 333 }) * displayRefCount)
      : studioActionCost;
  const stepOneInFlight = castingPipelineActive || isDetectionInProgressRef.current;
  const stepTwoInFlight = stepTwoAuditInProgress || referenceLoading || Boolean(castingPromptRunRef.current)
    || (!stepTwoCastingCancelled && castingStatus.startsWith('Step 2 of 2: Generating'));
  const isCurrentlyGenerating = stepOneInFlight || pendingCardCount > 0 || referencePendingCount > 0 || stepTwoInFlight;

    if (stepTwoAuditInProgress) {
      return null;
    }

    return (
      <Button
        className={`creation-deck-character-button${studioButtonStage === 'pre-broke' ? ' creation-deck-character-button--warning' : ''}`}
        {...(isCurrentlyGenerating || studioButtonStage === 'pre-broke'
          ? cb('character_studio', 'status', 'Reference generation status', 'studioStatus', 'click', 'information_only')
          : studioButtonStage === 'post-countdown'
            ? cb('character_studio', 'cancel_auto_continue', 'Cancel automatic Continue countdown', 'setStudioActionTimer(null)')
            : !hasExtractedData
              ? cb('character_studio', 'find_characters', 'Find characters from scenes', 'runAutoCastingPipeline', 'click', 'candidate')
              : hasMissingImages
                ? cb('character_studio', 'generate_images', 'Generate missing reference images', 'proceedToImageGeneration', 'click', 'candidate')
                : cb('character_studio', 'continue', 'Continue to storyboard', 'enterVideoCreationModeOnce', 'click', 'candidate'))}
        disableRipple
        onClick={async () => {
          // NORMAL FLOW CANCELLATION
          if (!isRevisitingCharacter && studioButtonStage === 'post-countdown' && skipCountdown === null) {
            setStudioButtonStage('post-continue');
            setStudioActionTimer(null);
            return;
          }

          if (isCurrentlyGenerating) {
            return;
          }

          if (!hasExtractedData) {
            runAutoCastingPipeline();
          } else if (hasMissingImages && !isCurrentlyGenerating) {
            setStudioButtonStage('generating');
            proceedToImageGeneration(detectedCharacters, detectedEnvironments, latestCastingIdRef.current);
          } else if (!isCurrentlyGenerating) {
            // Close only if not currently generating and no missing images
            setStudioButtonStage('hidden');
            setShowStudioModal(false);
            setShowScenesPopup(false);
            isRevisitingCharacterRef.current = false;
            setIsRevisitingCharacter(false);
            // Auto-select the existing Video action once for this original story run.
            enterVideoCreationModeOnce();
          }
        }}
        disabled={(!isRevisitingCharacter && skipCountdown !== null) && studioButtonStage !== 'generating' && studioButtonStage !== 'pre-broke'}
        sx={{
          bgcolor: (studioButtonStage === 'pre-broke') ? 'rgba(255,50,50,0.1)' : (darkModeReducer ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          color: (studioButtonStage === 'pre-broke') ? '#ff4040' : (darkModeReducer ? '#fff' : '#000'),
          border: `1px solid ${(studioButtonStage === 'pre-broke') ? 'rgba(255,50,50,0.3)' : (darkModeReducer ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)')}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          borderRadius: '30px', px: { xs: 2.5, sm: 4 }, py: { xs: 1, sm: 1.5 },
          textTransform: 'none', fontSize: { xs: '0.85rem', sm: '1rem' }, fontWeight: 700, letterSpacing: 0.5,
          transition: 'all 0.3s ease',
          whiteSpace: { xs: 'normal', sm: 'nowrap' },
          lineHeight: { xs: 1.3, sm: 1.5 },
          textAlign: 'left',
          '&:hover': {
            bgcolor: (studioButtonStage === 'pre-broke') ? 'rgba(255,50,50,0.2)' : (darkModeReducer ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'),
            transform: 'scale(1.02)'
          }
        }}
      >
        {(studioButtonStage === 'generating' || isCurrentlyGenerating) && (
          <Box className="creation-reference-tally" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: { xs: 0.75, sm: 1.5 }, fontSize: { xs: '0.75rem', sm: '0.85rem' }, letterSpacing: 0.5 }}>
            <span>Refs <strong style={{ color: appColor }}>{displayRefCount}</strong></span>
            <span>Cost <strong style={{ color: appColor }}>{displayActionCost}P</strong></span>
            <span>Balance <strong style={{ color: appColor }}>{(inDeck ? pixelsRedux : availablePixels).toLocaleString()}P</strong></span>
          </Box>
        )}
        {(studioButtonStage === 'pre-broke' && !isCurrentlyGenerating) && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: { xs: 0.5, sm: 1.5 }, fontSize: { xs: '0.75rem', sm: '0.82rem' } }}>
            <span style={{ color: '#ff4040', fontWeight: 800 }}>INSUFFICIENT PIXELS</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span style={{ opacity: 0.7 }}>NEED:</span> <span style={{ color: appColor, fontWeight: 700 }}>{displayActionCost}P</span>
          </Box>
        )}
        {(!isRevisitingCharacter && studioButtonStage === 'post-countdown' && !isCurrentlyGenerating) && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: { xs: 0.5, sm: 1.5 } }}>
            <span style={{ fontWeight: 400, fontSize: '0.9rem', letterSpacing: 1.5 }}>CANCEL SEQUENCE</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span style={{ color: appColor, fontWeight: 700, fontSize: '1.1rem' }}>{studioActionTimer}s</span>
          </Box>
        )}
        {(!hasExtractedData && studioButtonStage !== 'generating' && studioButtonStage !== 'pre-broke' && studioButtonStage !== 'post-countdown' && !isCurrentlyGenerating) && (
          <span style={inDeck ? undefined : { fontWeight: 900, letterSpacing: 2.5 }}>FIND CHARACTERS</span>
        )}
        {(hasExtractedData && hasMissingImages && studioButtonStage !== 'generating' && studioButtonStage !== 'pre-broke' && studioButtonStage !== 'post-countdown' && !isCurrentlyGenerating) && (
          <span style={inDeck ? undefined : { fontWeight: 900, letterSpacing: 2.5 }}>GENERATE IMAGES</span>
        )}
        {(hasExtractedData && !hasMissingImages && studioButtonStage !== 'generating' && studioButtonStage !== 'pre-broke' && studioButtonStage !== 'post-countdown' && !isCurrentlyGenerating) && (
          <span style={inDeck ? undefined : { fontWeight: 900, letterSpacing: 2.5 }}>CONTINUE</span>
        )}
      </Button>
    );

  };
  const renderCharacterStudioFeedback = (compact = false) => {
    const stepOneActive = (castingPipelineActive || isDetectionInProgressRef.current) && castingStatus.startsWith('Step 1 of 2');
    const auditActive = stepTwoAuditInProgress || castingStatus.startsWith('Step 2 of 2: Auditing');
    const imagesActive = referenceLoading || referencePendingCount > 0 || Boolean(castingPromptRunRef.current)
      || referenceImages.some(isReferenceWorking) || castingStatus.startsWith('Step 2 of 2: Generating');
    const generationActive = stepOneActive || auditActive || imagesActive;
    const failed = castingStatus.startsWith('Finished with errors:') || castingStatus.startsWith('Error ') || castingStatus.startsWith('Not enough Pixels.');
    if (!castingStatus || (isRevisitingCharacter && !generationActive && !failed && !castingStatus.startsWith('Audit'))) return null;
    const detailText = stepOneActive
      ? 'The model is reading the story scenes and extracting only reusable characters, creatures, environments, vehicles, and important props for consistent references.'
      : auditActive
        ? 'The model is checking the first pass for missed visible characters or reference-worthy locations before image generation starts.'
        : imagesActive
          ? 'The app is preparing and generating the selected reference images. You can hide this panel and return without starting a duplicate run.'
          : '';
    return <Box className={compact ? 'creation-deck-character-feedback' : undefined}
      {...(compact ? cb('character_studio', 'scroll', 'Scroll Characters studio', 'studioScrollRef.scrollBy', 'scroll') : {})}
      sx={{ display: 'flex', alignItems: 'center', gap: compact ? 1 : 2, mt: compact ? 0 : 2, mb: compact ? 0 : 3, flexWrap: 'wrap' }}>
      {generationActive && <CircularProgress size={18} sx={{ color: appColor }} />}
      <Typography role="status" aria-live="polite" variant="body2"
        sx={{ flex: 1, minWidth: 0, color: failed ? '#d9485c' : darkModeReducer ? '#aaa' : '#666', fontWeight: 500 }}>
        {castingStatus}{referencePendingCount > 0 ? ` (${referencePendingCount} remaining)` : ''}
      </Typography>
      {detailText && <Typography variant="caption" sx={{ flexBasis: '100%', pl: compact ? 0 : 4,
        color: darkModeReducer ? 'rgba(255,255,255,0.58)' : 'rgba(0,0,0,0.58)', fontWeight: 500, lineHeight: 1.5 }}>
        {detailText}
      </Typography>}
      {!compact && !stepTwoCastingCancelled && stepOneCastingReady && stepOneDetectedCount > 0 && stepTwoAuditInProgress && <Button
        {...cb('character_studio', 'use_step_one', 'Use first-pass character results', 'useStepOneCharacterResults')}
        size="small" variant="outlined" onClick={acceptStudioFirstPass}
        sx={{ ml: 'auto', borderRadius: '18px', textTransform: 'none', fontWeight: 900, px: 2, py: 0.5,
          color: appColor, borderColor: alpha(appColor, 0.65), bgcolor: alpha(appColor, 0.08),
          '&:hover': { borderColor: appColor, bgcolor: alpha(appColor, 0.16) } }}>Use This</Button>}
    </Box>;
  };
  const renderOpenCreationDeck = (area: string) => (
    <IconButton
      {...cb(area, 'open_creation_deck', 'Open Creation Deck', 'setPromptDeckVisible(true)')}
      aria-label="Open Creation Deck"
      title="Open Creation Deck"
      onClick={() => {
        if (area === 'character_studio') underlyingStoryboardDeck.current?.reopen();
        setPromptDeckVisible(true);
      }}
      sx={{ ...appAccentButtonSx(appColor, darkModeReducer), width: 36, height: 36, p: 1,
        flex: '0 0 auto', alignSelf: 'center', borderRadius: '50%', mr: area === 'preview_choice' ? 1 : 0 }}
    ><ViewCarouselOutlinedIcon sx={{ fontSize: 20 }} /></IconButton>
  );
  const renderPromptCreationDeck = () => {
    if (!promptDeckOpen) return null;
    const characters = promptDeckStage === 'characters';
    const preview = promptDeckStage === 'preview';
    const characterWorkActive = castingPipelineActive || isDetectionInProgressRef.current || stepTwoAuditInProgress
      || referenceLoading || referencePendingCount > 0 || referenceImages.some(isReferenceWorking);
    const detectedReferences = [...detectedCharacters, ...detectedEnvironments];
    const detectedReferenceNames = detectedReferences.map(reference => typeof reference === 'string' ? reference : reference?.name).filter(Boolean);
    const title = characters ? 'Characters' : preview ? 'Scene previews' : 'Using imagination';
    const cards: CreationDeckCard[] = characters
      ? referenceImages.map((ref, index) => ({
        id: String(ref.clientReferenceId || index), title: ref.name,
        image: getUsableReferenceImage(ref) || undefined,
        text: isReferenceWorking(ref) ? 'Generating reference…' : ref.description || ref.prompt || undefined,
      }))
      : preview
        ? parsedKeyPoints.map((scene, index) => ({
          id: String(index), title: `Scene ${index + 1}`, sceneLabel: `Scene ${index + 1}`, image: editGenSnapshot?.[index] || nanoImages[index] || undefined,
          isPreview: true,
          text: String(scene || ''),
        }))
        : storybookImagination ? [{
            id: 'imagination', title: storybookImagination.title, image: storybookImagination.image,
            informationIcon: <AutoFixHighIcon />,
            isPreview: true,
            text: [storybookImagination.text, storybookImagination.status].filter(Boolean).join('\n\n'),
            showCaptionInClean: true,
          }] : [];
    if (!cards.length) cards.push({ id: 'character-status', title: 'Characters',
      text: characterWorkActive && castingStatus ? castingStatus : 'Find reusable characters and references from your scenes.', informationIcon: <PersonIcon /> });
    const pendingReferenceIndex = characters && pendingReferenceRemoval
      ? referenceImages.findIndex(ref => referenceNamesMatch(pendingReferenceRemoval.name, ref.name)) : -1;
    const activeId = pendingReferenceIndex >= 0 ? cards[pendingReferenceIndex]?.id
      : cards.some(card => card.id === promptDeckId) ? promptDeckId : cards[0]?.id;
    const activeReferenceIndex = characters ? cards.findIndex(card => card.id === activeId) : -1;
    const activeReference = referenceImages[activeReferenceIndex];
    const activeScene = preview ? cards.findIndex(card => card.id === activeId) : -1;
    const hasPendingRemoval = Boolean(characters && pendingReferenceRemoval && activeReference &&
      referenceNamesMatch(pendingReferenceRemoval.name, activeReference.name));
    return <CreationDeck
      title={title}
      cards={cards}
      activeId={activeId}
      onSelect={setPromptDeckId}
      onOpen={activeReference ? () => openStudioReference(activeReferenceIndex) : activeScene >= 0
        ? () => setExpandedChoiceScene(expandedChoiceScene === 1 ? 0 : 1) : undefined}
      openBinding={activeReference
        ? cb('character_studio', `reference_${activeReference.clientReferenceId || activeReferenceIndex}`, `Open ${activeReference.name} reference`, 'selectReferenceForEditing')
        : activeScene >= 0 ? cb('preview_choice', `scene_${activeScene + 1}_image`, `Expand scene ${activeScene + 1} preview`, 'setExpandedChoiceScene') : undefined}
      onOptions={preview && activeScene >= 0 ? () => setExpandedChoiceScene(1) : undefined}
      activeCardAction={activeReference ? <button type="button" className="deck-glass-button creation-deck-reference-remove"
        aria-label={`Remove ${activeReference.name}`}
        {...cb('character_studio', `remove_${activeReference.clientReferenceId || activeReferenceIndex}`, `Request removal of ${activeReference.name}`, 'setPendingReferenceRemoval')}
        onClick={() => setPendingReferenceRemoval({ name: activeReference.name, type: activeReference.type })}><DeleteOutlineIcon /></button> : undefined}
      optionsBinding={preview && activeScene >= 0
        ? cb('preview_choice', `scene_${activeScene + 1}_text`, `Expand scene ${activeScene + 1} text`, 'setExpandedChoiceScene(2)') : undefined}
      detail={hasPendingRemoval && activeReference ? <div className="creation-deck-reference-confirmation" role="group" aria-label={`Remove ${activeReference.name}`}>
        <h2>Remove {activeReference.name}?</h2>
        <div className="creation-deck-character-actions">
          <Button className="creation-deck-character-button creation-deck-reference-confirm-yes"
            {...cb('character_studio', `confirm_remove_${activeReference.clientReferenceId || activeReferenceIndex}`, `Confirm remove ${activeReference.name}`, 'handleDeleteCharacter', 'click', 'needs_confirmation')}
            onClick={() => { handleDeleteCharacter(activeReference.name, activeReference.type); setPendingReferenceRemoval(null); }}>Yes</Button>
          <Button className="creation-deck-character-button"
            {...cb('character_studio', `cancel_remove_${activeReference.clientReferenceId || activeReferenceIndex}`, `Keep ${activeReference.name}`, 'setPendingReferenceRemoval(null)')}
            onClick={() => setPendingReferenceRemoval(null)}>No</Button>
        </div>
      </div> : characters && showScenesPopup ? <div className="creation-deck-character-scenes">
        <h2>Scenes</h2>
        <p>{prompt}</p>
        {parsedKeyPoints.map((scene, index) => <button key={index} type="button"
          {...cb('character_scenes', `scene_${index + 1}`, `Open scene ${index + 1} preview`, 'setSelectedSceneIndex')}
          onClick={() => { setSelectedSceneIndex(index); setExpandedScene(false); }}>
          Scene {index + 1}: {String(scene || '')}
        </button>)}
      </div> : preview && expandedChoiceScene > 0 && activeScene >= 0
        ? <div
          {...cb('preview_choice', `scene_${activeScene + 1}_text`, `Expand scene ${activeScene + 1} text`, 'setExpandedChoiceScene(2)')}
          className={`creation-deck-scene-detail${cards[activeScene].image ? ' creation-deck-scene-detail--media' : ''}${expandedChoiceScene === 2 ? ' creation-deck-scene-detail--expanded' : ''}`}
          onClick={() => setExpandedChoiceScene(expandedChoiceScene === 2 ? 1 : 2)}
        >
          {cards[activeScene].image && <img className="creation-deck-scene-detail-img" src={cards[activeScene].image} alt="" draggable={false} />}
          <div className="creation-deck-scene-detail-overlay">
            {(!cards[activeScene].image || expandedChoiceScene === 2) && <h2>{cards[activeScene].title}</h2>}
            <p>{cards[activeScene].text}</p>
          </div>
        </div> : undefined}
      browsableDetail={preview && expandedChoiceScene > 0}
      renderCardDetail={preview ? cardEntry => (
        <div className={`creation-deck-scene-detail${cardEntry.image ? ' creation-deck-scene-detail--media' : ''}${expandedChoiceScene === 2 ? ' creation-deck-scene-detail--expanded' : ''}`}>
          {cardEntry.image && <img className="creation-deck-scene-detail-img" src={cardEntry.image} alt="" draggable={false} />}
          <div className="creation-deck-scene-detail-overlay">
            {(!cardEntry.image || expandedChoiceScene === 2) && <h2>{cardEntry.title}</h2>}
            <p>{cardEntry.text}</p>
          </div>
        </div>
      ) : undefined}
      onCloseDetail={hasPendingRemoval ? () => setPendingReferenceRemoval(null)
        : characters ? () => setShowScenesPopup(false) : () => setExpandedChoiceScene(0)}
      closeDetailBinding={characters && showScenesPopup && !hasPendingRemoval
        ? cb('character_scenes', 'close', 'Close scenes list', 'setShowScenesPopup(false)') : undefined}
      detailScrollBinding={characters && showScenesPopup && !hasPendingRemoval
        ? cb('character_scenes', 'scroll', 'Scroll character-studio scenes', 'scenesPopup.scrollBy', 'scroll') : undefined}
      onClose={closePromptCreationDeck}
      settings={<>
        {promptDeckModelsAvailable && <button type="button" {...cb('storybook_toolbar', 'open_models', 'Open model selection menu', 'setOpen(true)')}
          onClick={() => setOpen(true)}>{getCreationImageModelName(modelz)}</button>}
        {preview && intentOverview?.overview && <button type="button"
          {...cb('preview_choice', 'intent', 'Open what the engine understood', 'setShowIntentPanel(true)')}
          onClick={() => setShowIntentPanel(true)}>What the engine understood</button>}
        {characters && !showScenesPopup && <button type="button" {...cb('character_studio', 'show_scenes', 'Open creation scenes list', 'setShowScenesPopup(true)')}
          onClick={() => setShowScenesPopup(true)}>Scenes and golden prompt</button>}
        {characters && <button type="button" onClick={closeCharacterStudio}>Close Characters</button>}
        {activeReference && <button type="button"
          {...cb('character_studio', `rename_${activeReference.clientReferenceId || activeReferenceIndex}`, `Rename ${activeReference.name}`, 'setRenameModalOpen(true)')}
          onClick={() => { setCharacterToRename({ idx: activeReferenceIndex, oldName: activeReference.name, newName: activeReference.name, type: activeReference.type }); setRenameModalOpen(true); }}>Rename {activeReference.name}</button>}
      </>}
      exitCreation={<button type="button" className="creation-deck-exit"
        {...cb('storybook_toolbar', 'close', 'Open exit creation confirmation', 'setShowConfirmClose')}
        onClick={requestDeckCloseReview}>Exit creation</button>}
      topControls={preview ? <div style={{ display: 'grid', gap: 8 }}>
        <div className="creation-deck-split">
          <input {...cb('preview_choice', 'plan_edit', 'Edit generation plan instruction', 'setPlanEditText', 'text')}
            aria-label="Edit generation plan" placeholder="Edit generation plan…" value={planEditText}
            disabled={isPlanEditSubmitting || Boolean(editGenSnapshot)} onChange={event => setPlanEditText(event.target.value)}
            style={{ flex: 1, minWidth: 0 }} />
          <button type="button" {...cb('preview_choice', 'update_with_ai', 'Update generation plan with AI', 'handleEditGenerationPlan')}
            disabled={!planEditText.trim() || isPlanEditSubmitting || Boolean(editGenSnapshot) || allowSpin}
            onClick={handleEditGenerationPlan}>{isPlanEditSubmitting || editGenSnapshot ? 'Updating…' : 'Go'}</button>
        </div>
        {(isPlanEditSubmitting || editGenSnapshot) && <span role="status" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="creation-deck-status-spinner" aria-hidden="true" />Updating your scenes…
        </span>}
        {error && <span role="status">{error}</span>}
      </div> : characters ? <div style={{ display: 'grid', gap: 8 }}>
        <div className="creation-deck-split">
          <input {...cb('character_studio', 'casting_instruction', 'Character detection instruction', 'setCastingInstruction', 'text')}
            aria-label="Character detection instruction" placeholder="e.g. Extract all locations as well" value={castingInstruction}
            onChange={event => setCastingInstruction(event.target.value)} style={{ flex: 1, minWidth: 0 }} />
        </div>
      </div> : undefined}
      cardBottom={characters ? <>
        {renderCharacterStudioFeedback(true)}
        {detectedReferenceNames.length > 0 && <div className="creation-deck-cast-list" aria-label="Detected references">
          {detectedReferenceNames.map((name, index) => <span key={`${name}-${index}`}>{name}</span>)}
        </div>}
        <div className="creation-deck-character-actions">
          <Button className="creation-deck-character-button"
            {...cb('character_studio', 'close', 'Hide Characters studio', 'setShowStudioModal(false)')}
            onClick={closeCharacterStudio}>Close Characters</Button>
          {!characterWorkActive && (detectedReferences.length > 0 || castingInstruction.trim()) && <Button className="creation-deck-character-button"
            {...cb('character_studio', 'refresh', castingInstruction.trim() ? 'Find additional references with instruction' : 'Restart character detection', 'runAutoCastingPipeline(false)')}
            onClick={refreshStudioReferences}>Detect</Button>}
          {!stepTwoCastingCancelled && stepOneCastingReady && stepOneDetectedCount > 0 && stepTwoAuditInProgress
            ? <Button className="creation-deck-character-button"
              {...cb('character_studio', 'use_step_one', 'Use first-pass character results', 'useStepOneCharacterResults')}
              onClick={acceptStudioFirstPass}>Use This</Button>
            : studioButtonStage !== 'hidden' && skipCountdown === null ? renderStudioAction(true) : null}
        </div>
      </> : undefined}
      footer={preview ? <div className="creation-deck-split">
          <button className="deck-glass-button" type="button" {...cb('preview_choice', 'create_characters', 'Create characters from generated scenes', 'runAutoCastingPipeline')}
            disabled={isPlanEditSubmitting || Boolean(editGenSnapshot)} onClick={chooseCreateCharacters}>Characters</button>
          <button className="deck-glass-button" type="button" {...cb('preview_choice', 'skip', 'Skip characters and continue to storyboard', 'handleSkipCharacters')}
            disabled={isPlanEditSubmitting || Boolean(editGenSnapshot)} onClick={chooseSkipCharacters}>Proceed</button>
      </div> : undefined}
    />;
  };

  const isPcCompactActions = creationStage.isCompact && !matchMobile;
  useCreationControls('setup', 'PromptInput', creationStage.isComposer, {
    mode: isAllFeeds ? null : type, modeSelectionRequired: isAllFeeds,
    ratio: ratioKey, style: selectedStyle || 'Auto', imageModel: getCreationImageModelName(modelz),
    promptLength: prompt.length, editorOpen: isNotepadOpen, modelsOpen: open,
    stylesOpen: styleModalOpen, uploadOpen: showWorldModel, musicOpen: promptMusicPickerOpen,
    confirmationOpen: creationConfirmationOpen, interactionChoiceOpen: showInteractionExperienceChoice,
    worldId: selectedWorldId == null ? null : String(selectedWorldId),
    selectedWorldCharacterCount: Vipcharacters.filter((item: any) => item?.source === 'world').length,
    directImageReferenceCount: Vipcharacters.filter((item: any) => item?.source === 'upload').length,
  });
  useCreationControls('confirmation', 'PromptInput', creationConfirmationOpen, { mode: isAllFeeds ? null : type,
    modeSelectionRequired: isAllFeeds, goBlockedReason: isAllFeeds ? 'Choose Shorts, Games or Cinema to continue.' : null,
    promptPreviewOpen, ratio: ratioKey,
    imageModel: getCreationImageModelName(modelRedux || modelz) });
  useCreationControls('interaction', 'PromptInput', showInteractionExperienceChoice, { mode: type });
  useCreationControls('generation_progress', 'PromptInput', showNativeImagination || imaginationHasContent, {
    phase: planInfo, outlineCount: parsedKeyPointsx.length,
  });
  useCreationControls('preview_choice', 'PromptInput', showPathChoiceOverlay, {
    mode: type, sceneCount: parsedKeyPoints.length, previewCount: nanoImages.filter(Boolean).length,
    intentAvailable: Boolean(intentOverview?.overview), planEditLength: planEditText.length,
  });
  useCreationControls('intent_view', 'PromptInput', showIntentPanel, {
    sceneIntentCount: intentOverview?.scenes?.length || 0,
  });
  useCreationControls('character_studio', 'PromptInput', showStudioModal, {
    status: castingStatus, referenceCount: referenceImages.length,
    readyCount: referenceImages.filter((reference) => Boolean(getUsableReferenceImage(reference))).length,
    pendingCount: referencePendingCount, sceneCount: parsedKeyPoints.length,
    phase: studioButtonStage, instructionLength: castingInstruction.length,
    stepOneReady: stepOneCastingReady, stepTwoAudit: stepTwoAuditInProgress,
    autoCloseSeconds: studioActionTimer,
  });
  useCreationControls('character_scenes', 'PromptInput', showStudioModal && showScenesPopup, {
    sceneCount: parsedKeyPoints.length,
  });
  useCreationControls('character_scene_preview', 'PromptInput', selectedSceneIndex !== null, {
    selectedScene: selectedSceneIndex === null ? null : selectedSceneIndex + 1,
    sceneCount: parsedKeyPoints.length, expanded: expandedScene,
  });
  useCreationControls('reference_editor', 'PromptInput', editingRefIdx !== null, {
    projectId: creationProjectId,
    referenceId: activeEditingReference?.clientReferenceId || '', field: 'reference_appearance',
    promptRevision: creationValueRevision(imagePromptVal), instructionRevision: creationValueRevision(aiUpdateVal),
    committedPromptRevision: creationValueRevision(activeEditingReference?.prompt || ''),
    mediaRevision: creationValueRevision(getUsableReferenceImage(activeEditingReference) || ''),
    name: editingRefIdx !== null ? referenceImages[editingRefIdx]?.name || '' : '',
    type: editingRefIdx !== null ? referenceImages[editingRefIdx]?.type || '' : '',
    promptLength: imagePromptVal.length, updateLength: aiUpdateVal.length, zoom: zoomMode,
    imageGenerationMode: activeReferenceGenerationMode,
    canEditImage: activeReferenceCanEdit,
    isUploading: Boolean(activeEditingReference?.isUploading),
    imageModel: getCreationImageModelName(modelz),
  });
  useCreationControls('character_rename', 'PromptInput', renameModalOpen, {
    oldName: characterToRename?.oldName || '', newNameLength: characterToRename?.newName?.length || 0,
  });
  const PC_ACTION_HEIGHT = '40px';
  const PC_ACTION_RADIUS = '14px';
  const PC_ACTION_FONT = '0.68rem';
  const PC_ACTION_MIN_WIDTH = '96px';
  const PC_ACTION_ICON_WIDTH = '58px';
  const PC_CREATE_MIN_WIDTH = '168px';
  /** Breathing room between the prompt field and the action row (PC pill). */
  const PC_ACTION_ROW_TOP_GAP = '26px';
  /** Nudge the ratio box off the panel's right edge (PC pill). */
  const PC_RATIO_RIGHT_INSET = '14px';

  return (
    <CreationLedgerContext.Provider value={{ entries: creationLedgerEntries, reset: resetCreationLedger }}>
    <>
      {creationDeckEnabled && <div ref={characterStudioPortal} />}
      {renderPromptCreationDeck()}
      <ModelSelectionModal
        overlayZIndex={creationDeckEnabled ? 1000002 : undefined}
        open={open}
        setOpen={setOpen}
        handleSelect={handleSelect}
        updateModelWithoutClosing={(name: string, image: string) => {
          dispatch(setModel(name));
          dispatch(setImageModelPreview({ model: name, url: image }));
          setModelz(name);
        }}
        activeModelName={modelz}

        // Pass Data
        models={models}
        currentImage={GeneratedImage.length > 0 ? GeneratedImage[0] : ''}

        // Styles & Environment
        darkModeReducer={darkModeReducer}
        matchMobile={matchMobile}
        darkMode={darkMode}

        // Config
        gradient={GRADIENT}
        labelsByIndex={LABEL_BY_INDEX}
        colorsByLabel={COLOR_BY_LABEL}

        // Language-model cost estimate. parsedKeyPoints is the step
        // array, which is stage-indexed in Cinema (type === 1).
        sceneCount={parsedKeyPoints.length}
        cinemaMode={Number(type) === 1}
      />
      <Modal
        open={creationConfirmationOpen && !open && !styleModalOpen}
        onClose={() => { setPromptPreviewOpen(false); dispatch(setCreationConfirmationOpen(false)); }}
        aria-labelledby="creation-confirmation-title"
        disableEnforceFocus={guideEnabled}
        sx={{ zIndex: 50000 }}
        slotProps={{ backdrop: { sx: { backgroundColor: 'rgba(0,0,0,0.74)', backdropFilter: 'blur(7px)' } } }}
      >
        <Box sx={{
          '&:has(> [data-creation-confirmation-guide]:not(:empty))': {
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5,
            pt: 'calc(env(safe-area-inset-top, 0px) + 12px)', pb: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
            boxSizing: 'border-box', pointerEvents: 'none', outline: 'none',
            '& > [data-creation-confirmation-panel]': {
              position: 'relative', top: 'auto', left: 'auto', transform: 'none', minHeight: 0, pointerEvents: 'auto',
            },
          },
        }}>
        {!promptPreviewOpen && <Box ref={setConfirmationDockHost} data-creation-confirmation-guide
          sx={{ display: 'flex', justifyContent: 'center', width: 'calc(100% - 18px)', flexShrink: 0, '&:empty': { display: 'none' } }} />}
        <Box data-creation-confirmation-panel sx={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 'min(760px, calc(100vw - 28px))', maxHeight: 'calc(100dvh - 28px)',
          overflowY: 'auto', boxSizing: 'border-box', p: { xs: 2, sm: 3 }, borderRadius: '24px',
          color: darkModeReducer ? '#fff' : '#202020',
          background: darkModeReducer ? 'linear-gradient(145deg, #1b1c22, #101115)' : 'linear-gradient(145deg, #fff, #eef0f4)',
          border: `1px solid ${darkModeReducer ? appColorDark : appColorLight}`,
          boxShadow: '0 28px 90px rgba(0,0,0,0.55)', outline: 'none',
        }}>
          <IconButton {...cb('confirmation', 'close', 'Close setup review', 'setCreationConfirmationOpen(false)')} aria-label="Close creation confirmation" onClick={() => {
            setPromptPreviewOpen(false);
            dispatch(setCreationConfirmationOpen(false));
          }} sx={{ position: 'absolute', right: 12, top: 12, color: 'inherit' }}>
            <CloseIcon />
          </IconButton>
          <Typography id="creation-confirmation-title" sx={{ fontSize: '1.35rem', fontWeight: 800, pr: 5 }}>
            Confirm setup
          </Typography>
          <Button
            aria-label="Read full creation prompt"
            {...cb('confirmation', 'read_prompt', 'Read full prompt', 'setPromptPreviewOpen(true)')}
            onClick={() => setPromptPreviewOpen(true)}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.75, width: '100%', minWidth: 0,
              textAlign: 'left', mt: 1, mb: 2, px: 0, py: 0.5, textTransform: 'none',
              color: 'inherit', justifyContent: 'flex-start',
              '&:hover': { backgroundColor: 'transparent', opacity: 0.8 } }}
          >
            <Typography component="span" sx={{ fontSize: '0.88rem', opacity: 0.65, flexShrink: 0 }}>
              Prompt —
            </Typography>
            <Typography component="span" sx={{ minWidth: 0, fontSize: '0.88rem', fontWeight: 500,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {prompt.trim() || 'No prompt entered yet'}
            </Typography>
          </Button>
          {!isAllFeeds && ['/images', '/clikit', '/kickit'].includes(location.pathname.toLowerCase()) &&
            <Typography sx={{ color: appColor, fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1.5 }}>
              {location.pathname.toLowerCase() === '/images' ? 'Shorts' : location.pathname.toLowerCase() === '/clikit' ? 'Games' : 'Cinema'}
            </Typography>}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.5 }}>
            {(() => {
              const selectedImageModel = modelRedux || modelz;
              const imageModelNames: Record<string, string> = {
                Imagen2: 'Nano Banana', Imagen: 'Nano Banana 2.1', fluxUltra: 'Nano Banana 2 Lite',
                fluxUltra2: 'Nano Banana Pro', minimax: 'Seedream 5 Pro', minimax2: 'Seedream 4.5',
                Schnell: 'Klein', 'Gpt Image': 'GPT Image 2',
              };
              const imageModelUrl = imageModelPreview?.model === selectedImageModel
                && exampleSets.some(set => set.model_images[selectedImageModel] === imageModelPreview.url)
                  ? imageModelPreview.url : exampleSets.find(set => set.model_images[selectedImageModel])?.model_images[selectedImageModel];
              const selectedCreationModel = LANGUAGE_MODELS.find((item) => item.id === languageModel);
              const styleName = artstyleRedux || selectedStyle || 'Auto';
              const styleUrl = artstylePreview?.style === styleName ? artstylePreview.url : '';
              const cardStyle = {
                display: 'flex', flexDirection: 'column', textAlign: 'left', p: 0, overflow: 'hidden',
                minHeight: 170, borderRadius: '16px', border: '1px solid rgba(180,190,200,0.26)',
                background: darkModeReducer ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.045)',
                color: 'inherit', textTransform: 'none', justifyContent: 'flex-start',
                '&:hover': { borderColor: appColor },
              } as const;
              const imageStyle = { width: '100%', height: 108, objectFit: 'cover' } as const;
              const caption = (label: string, value: string) => <Box sx={{ p: 1.25, width: '100%', minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.68rem', opacity: 0.65, textTransform: 'uppercase', fontWeight: 700 }}>{label}</Typography>
                <Typography sx={{ fontSize: '0.92rem', fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</Typography>
              </Box>;
              return <>
                <Button aria-label={`Aspect ratio ${ratioKey === 3 ? '16:9' : ratioKey === 2 ? '1:1' : '9:16'}. Tap to cycle.`}
                  {...cb('confirmation', 'ratio', 'Cycle aspect ratio', 'cycleAspectRatio')}
                  onClick={() => dispatch(cycleAspectRatio())} sx={cardStyle}>
                  <Box sx={{ height: 108, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Box sx={{ width: ratioKey === 3 ? 82 : ratioKey === 2 ? 66 : 44, height: ratioKey === 3 ? 46 : ratioKey === 2 ? 66 : 82,
                      border: `2px solid ${appColor}`, borderRadius: '8px', boxShadow: `0 0 18px ${alpha(appColor, 0.3)}` }} />
                  </Box>
                  {caption('Aspect ratio', ratioKey === 3 ? '16:9' : ratioKey === 2 ? '1:1' : '9:16')}
                </Button>
                <Button {...cb('confirmation', 'image_model', 'Change image model', 'setOpen(true)')} aria-label="Change image model" onClick={() => setOpen(true)} sx={cardStyle}>
                  {imageModelUrl ? <Box component="img" src={imageModelUrl} alt="" sx={imageStyle} /> : <Box sx={{ height: 108 }} />}
                  {caption('Image model', imageModelNames[selectedImageModel] || getImageModelDisplayName(selectedImageModel))}
                </Button>
                <Button {...cb('confirmation', 'creation_model', 'Change Creation AI', 'setOpen(true)')} aria-label="Change Creation AI model" onClick={() => setOpen(true)} sx={cardStyle}>
                  {selectedCreationModel?.image ? <Box component="img" src={selectedCreationModel.image} alt="" sx={imageStyle} /> : <Box sx={{ height: 108 }} />}
                  {caption('Creation AI', selectedCreationModel?.name || languageModel)}
                </Button>
                <Button {...cb('confirmation', 'style', 'Change art style', 'setStyleModalOpen(true)')} aria-label="Change art style" onClick={() => setStyleModalOpen(true)} sx={cardStyle}>
                  {styleUrl ? <Box component="img" src={styleUrl} alt="" sx={imageStyle} />
                    : <Box sx={{ height: 108, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, opacity: 0.55 }}>✦</Box>}
                  {caption('Art style', styleName)}
                </Button>
              </>;
            })()}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 3, alignItems: 'center', flexWrap: 'wrap' }}>
            {isAllFeeds && <Box sx={{ display: 'flex', gap: 1, flex: 1, minWidth: 240 }}>
              {[{ label: 'Shorts', key: 'shorts', path: '/images' }, { label: 'Games', key: 'games', path: '/clikit' }, { label: 'Cinema', key: 'cinema', path: '/kickit' }].map((mode) =>
                <Button key={mode.path} {...cb('confirmation', `mode_${mode.key}`, `Choose ${mode.label}`, 'chooseCreationMode')}
                  onClick={() => chooseCreationMode(mode.path)} sx={{ flex: 1, color: 'inherit', border: `1px solid ${appColor}`, borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
                  {mode.label}
                </Button>)}
            </Box>}
            <Button {...cb('confirmation', 'go', type === 3 ? 'Continue to interaction choice' : 'Confirm and generate', 'confirmCreation', 'click', 'candidate')} onClick={confirmCreation} disabled={isAllFeeds}
              data-creation-disabled-reason={isAllFeeds ? 'Choose Shorts, Games or Cinema to continue.' : undefined}
              sx={{ ml: 'auto', minWidth: 130, minHeight: 46,
              borderRadius: 2, ...appAccentButtonSx(appColor, darkModeReducer), fontWeight: 800, '&:hover': { backgroundColor: appColor, opacity: 0.85 } }}>
              Go
            </Button>
          </Box>
          {isAllFeeds && <Typography sx={{ mt: 1, opacity: 0.65, fontSize: '0.78rem' }}>Choose Shorts, Games or Cinema to continue.</Typography>}
        </Box>
        </Box>
      </Modal>
      <Modal
        open={creationConfirmationOpen && promptPreviewOpen}
        onClose={() => setPromptPreviewOpen(false)}
        aria-labelledby="creation-prompt-preview-title"
        disableEnforceFocus={guideEnabled}
        sx={{ zIndex: 50001 }}
        slotProps={{ backdrop: { sx: { backgroundColor: 'rgba(0,0,0,0.76)', backdropFilter: 'blur(5px)' } } }}
      >
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 'min(680px, calc(100vw - 28px))', maxHeight: 'calc(100dvh - 28px)',
          boxSizing: 'border-box', p: { xs: 2, sm: 3 }, borderRadius: '22px', outline: 'none',
          color: darkModeReducer ? '#fff' : '#202020',
          background: darkModeReducer ? '#1b1c22' : '#fff',
          border: `1px solid ${appColor}`, boxShadow: '0 28px 90px rgba(0,0,0,0.55)' }}>
          <IconButton {...cb('confirmation', 'close_prompt', 'Close prompt preview', 'setPromptPreviewOpen(false)')} aria-label="Close prompt preview" onClick={() => setPromptPreviewOpen(false)}
            sx={{ position: 'absolute', right: 12, top: 12, color: 'inherit' }}>
            <CloseIcon />
          </IconButton>
          <Typography id="creation-prompt-preview-title" sx={{ fontSize: '1.2rem', fontWeight: 800, pr: 5, mb: 2 }}>
            Your prompt
          </Typography>
          <Box sx={{ maxHeight: 'calc(100dvh - 150px)', overflowY: 'auto', pr: 1 }}>
            <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.6 }}>
              {prompt.trim() || 'No prompt entered yet'}
            </Typography>
          </Box>
        </Box>
      </Modal>
      <Modal
        open={showInteractionExperienceChoice}
        onClose={cancelInteractionExperienceChoice}
        aria-labelledby="interaction-experience-title"
        sx={{ zIndex: 50000 }}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: darkModeReducer ? "rgba(2, 4, 10, 0.72)" : "rgba(12, 18, 28, 0.52)",
              backdropFilter: "blur(12px)",
            },
          },
        }}
      >
        <Box
          role="dialog"
          aria-modal="true"
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: matchMobile ? "calc(100vw - 28px)" : "min(760px, calc(100vw - 64px))",
            maxHeight: "calc(100dvh - 32px)",
            overflowY: "auto",
            borderRadius: matchMobile ? "26px" : "32px",
            border: `1px solid ${alpha(appColor, darkModeReducer ? 0.72 : 0.55)}`,
            background: darkModeReducer
              ? "linear-gradient(145deg, rgba(12,16,26,0.88), rgba(8,10,18,0.74))"
              : "linear-gradient(145deg, rgba(255,255,255,0.88), rgba(239,246,255,0.76))",
            backdropFilter: "blur(28px) saturate(155%)",
            WebkitBackdropFilter: "blur(28px) saturate(155%)",
            boxShadow: `0 28px 90px rgba(0,0,0,0.42), 0 0 42px ${alpha(appColor, 0.24)}`,
            px: matchMobile ? 2 : 4,
            pt: matchMobile ? 6.5 : 6,
            pb: matchMobile ? 2.5 : 4,
            outline: "none",
          }}
        >
          <IconButton
            aria-label="Cancel interaction creation"
            onClick={cancelInteractionExperienceChoice}
            {...cb('interaction', 'cancel', 'Cancel interaction choice', 'cancelInteractionExperienceChoice')}
            sx={{
              position: "absolute",
              top: 14,
              right: 14,
              width: 42,
              height: 42,
              color: darkModeReducer ? "#fff" : "#111827",
              border: `1px solid ${alpha(appColor, 0.42)}`,
              backgroundColor: darkModeReducer ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.64)",
              "&:hover": { backgroundColor: alpha(appColor, 0.2) },
            }}
          >
            <CloseIcon />
          </IconButton>

          <Typography
            id="interaction-experience-title"
            sx={{
              textAlign: "center",
              color: darkModeReducer ? "#fff" : "#111827",
              fontWeight: 800,
              fontSize: matchMobile ? "1.35rem" : "1.75rem",
              mb: 0.75,
            }}
          >
            Choose your interaction
          </Typography>
          <Typography
            sx={{
              textAlign: "center",
              color: darkModeReducer ? "rgba(255,255,255,0.7)" : "rgba(17,24,39,0.68)",
              fontSize: matchMobile ? "0.86rem" : "0.95rem",
              mb: matchMobile ? 2.25 : 3,
            }}
          >
            Select how people will explore this creation.
          </Typography>

          <Box
            sx={{
              display: "flex",
              flexDirection: matchMobile ? "column" : "row",
              gap: matchMobile ? 1.6 : 2.25,
            }}
          >
            <Button
              onClick={() => chooseInteractionExperience("spatial")}
              {...cb('interaction', 'spatial', 'Generate Spatial game', 'chooseInteractionExperience(spatial)', 'click', 'candidate')}
              aria-label="Create a spatial interaction"
              sx={{
                flex: 1,
                minHeight: matchMobile ? 132 : 210,
                borderRadius: "24px",
                display: "flex",
                flexDirection: "column",
                gap: 1.25,
                color: darkModeReducer ? "#fff" : "#111827",
                border: `1px solid ${alpha(appColor, 0.58)}`,
                background: `linear-gradient(145deg, ${alpha(appColor, 0.3)}, ${alpha(appColor, 0.08)})`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 12px 32px ${alpha(appColor, 0.16)}`,
                textTransform: "none",
                "&:hover": {
                  transform: "translateY(-2px)",
                  background: `linear-gradient(145deg, ${alpha(appColor, 0.42)}, ${alpha(appColor, 0.14)})`,
                  boxShadow: `0 18px 42px ${alpha(appColor, 0.28)}`,
                },
              }}
            >
              <PublicIcon sx={{ fontSize: matchMobile ? 38 : 54 }} />
              <Typography sx={{ fontWeight: 800, fontSize: matchMobile ? "1.1rem" : "1.35rem" }}>
                Spatial
              </Typography>
              <Typography sx={{ maxWidth: 260, opacity: 0.72, fontSize: "0.82rem", textAlign: "center" }}>
                Build movement, actions and connected spatial scenes.
              </Typography>
            </Button>

            <Button
              onClick={() => chooseInteractionExperience("hotspots")}
              {...cb('interaction', 'hotspots', 'Generate Hotspots game', 'chooseInteractionExperience(hotspots)', 'click', 'candidate')}
              aria-label="Create a hotspot interaction"
              sx={{
                flex: 1,
                minHeight: matchMobile ? 132 : 210,
                borderRadius: "24px",
                display: "flex",
                flexDirection: "column",
                gap: 1.25,
                color: darkModeReducer ? "#fff" : "#111827",
                border: `1px solid ${alpha(appColor, 0.44)}`,
                background: darkModeReducer
                  ? "linear-gradient(145deg, rgba(255,255,255,0.13), rgba(255,255,255,0.055))"
                  : "linear-gradient(145deg, rgba(255,255,255,0.82), rgba(255,255,255,0.46))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 12px 32px rgba(0,0,0,0.12)",
                textTransform: "none",
                "&:hover": {
                  transform: "translateY(-2px)",
                  borderColor: appColor,
                  backgroundColor: alpha(appColor, 0.16),
                  boxShadow: `0 18px 42px ${alpha(appColor, 0.2)}`,
                },
              }}
            >
              <ViewListIcon sx={{ fontSize: matchMobile ? 38 : 54 }} />
              <Typography sx={{ fontWeight: 800, fontSize: matchMobile ? "1.1rem" : "1.35rem" }}>
                Hotspots
              </Typography>
              <Typography sx={{ maxWidth: 260, opacity: 0.72, fontSize: "0.82rem", textAlign: "center" }}>
                Generate normal videos, then connect them with swipe or touch hotspots.
              </Typography>
            </Button>
          </Box>
        </Box>
      </Modal>

      <AudioPicker
        showVoicesList={promptMusicPickerOpen}
        selectedVoice=""
        onClose={() => setPromptMusicPickerOpen(false)}
        onSelectVoice={() => { }}
        darkMode={darkModeReducer}
        voices={[]}
        setName={() => { }}
        setMemeMusic={setPromptMusicMode}
        MemeMusic={promptMusicMode}
        setmusicname={setPromptMusicName}
        setmusic={(nextUrl: string) => {
          if (nextUrl !== promptMusicUrl) setPromptMusicDurationSec(0);
          setPromptMusicUrl(nextUrl);
        }}
        music={promptMusicUrl}
        type={type}
        VideMode={VideMode}
        forceMusicMode
      />

      {isMirrorFocused && (
        <div style={{
          ...(!isMirrorFocused ? {
            transform: 'scale(0.3)',
            opacity: 0,
            pointerEvents: 'none',
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            transformOrigin: 'top center',
            zIndex: 0,
          } : {
            transform: 'none',
            opacity: 1,
            pointerEvents: 'auto',
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            transformOrigin: 'top center',
            zIndex: 999999,
          })
        }}>
          <Mirror
            type={type}
            setType={setType}
            isMenuOpen={isMenuOpen}
            setModelz={setModelz}
            magicMode={true}
            prompt={prompt}
            setPrompt={(val) => {
              setPrompt(val);
              dispatch(setPromptRed(val));
            }}
            handleStartSubmit={handleStartSubmit}
            darkModeReducer={darkModeReducer}
            matchMobile={matchMobile}
            navigate={navigate}
            GeneratedImage={GeneratedImage}
            GeneratedImageFlux={GeneratedImageFlux}
            setGeneratedImage={setGeneratedImage}
            setGeneratedImageFlux={setGeneratedImageFlux}
            setminimisePrompt={setminimisePrompt}
            setinstantCall={setinstantCall}
            loggedUser={loggedUser}
            parsedKeyPoints={parsedKeyPoints}
            setParsedKeyPoints={setParsedKeyPoints}
            CreationMode={CreationMode}
            setCreationMode={setCreationMode}
            setallowgetImage={setallowgetImage}
            generatedImagesFluxx={generatedImagesFluxx}
            setGeneratedImagesFluxx={setGeneratedImagesFluxx}
            parsedKeyPoints2={parsedKeyPoints2}
            onClose={resetMagicMirror}
            startAgentCasting={startAgentCasting}
            referenceImages={referenceImages}
            referencePendingCount={referencePendingCount}
            castingStatus={castingStatus}
            isAgentCasting={isAgentCasting}
            nanoImages={nanoImages}
            loadersArray={loadersArray}
            onToggleSlideshow={() => setIsMirrorFocused(false)}
            isMirrorFocused={isMirrorFocused}
            /* Final-render slideshow preview inputs */
            videoArray={sceneCloudVideos}
            bShotImages={bShotImages}
            bShotVideos={bShotVideos}
            /* Prompt music is the soundtrack ONLY in music-video mode (type 1).
               Every other mode is not music-based and plays the story's own
               background track chosen in Storybook's AudioPicker. */
            musicModeActive={Boolean(promptMusicUrl) && type === 1}
            musicModeUrl={type === 1 ? promptMusicUrl : ""}
            musicModeName={type === 1 ? promptMusicName : ""}
            appBgMusicUrl={storyBgMusicUrl}
            appBgMusicName={storyBgMusicName}
          />
        </div>
      )}


      {/* === STANDARD UI (Scaled Down in Mirror Mode) === */}
      <Box
        // CAPTURE, not bubble: the intro must clear on the same gesture that
        // starts whatever the user actually reached for, and several controls
        // below stopPropagation on their own handlers. Pointer-down rather than
        // click so it also covers a drag, a scroll-start and a long-press.
        data-creation-deck-covered={promptDeckOpen ? 'true' : undefined}
        {...(promptDeckOpen ? { inert: '' } : {})}
        onPointerDownCapture={appIntroActive ? () => { dispatch(dismissAppIntro()); } : undefined}
        data-creation-stage={creationStage.stage}
        data-creation-material={darkModeReducer ? 'dark' : 'light'}
        data-composer-stage={creationStage.isComposer ? "true" : "false"}
        data-compact-stage={creationStage.isCompact ? "true" : "false"}
        sx={{
        // --- Mirror Mode Transition (Create mode backgrounding) ---
        transform: isMirrorFocused ? 'scale(0.92)' : 'none',
        opacity: isMirrorFocused ? 0 : 1,
        pointerEvents: isMirrorFocused ? 'none' : 'auto',
        transformOrigin: 'top center',

        // --- Dynamic Minimizing Modes ---
        // COMPACT COMPOSER (creationStage.isCompact): the panel stops being a
        // full-viewport slab and becomes a bottom-anchored glass pill. Height is
        // driven by its content instead of 100vh, so the feed behind stays
        // visible and behaves normally. Every other stage keeps the old geometry.
        display: minimisePrompt ? 'none' : 'block',
        position: 'fixed',
        zIndex: 1200,

        top: creationStage.isCompact ? 'auto' : 0,
        bottom: creationStage.isCompact ? { xs: '8px', sm: '14px' } : 'auto',
        // Compact pill: pinned across the content area (past the menu column when
        // it is open) with an explicit width and `margin: auto`, which centres a
        // fixed-position box between its left and right edges. Mobile keeps the
        // near-full-width inset since 50% of a phone is unusable.
        left: creationStage.isCompact
          ? (matchMobile ? '8px' : (isMenuOpen ? '20%' : 0))
          : (keepLandingFullscreenInMenuColumn ? 0 : (minimizeMode === 0 ? 0 : (matchMobile ? 0 : (isMenuOpen ? '20%' : 0)))),
        right: creationStage.isCompact
          ? (matchMobile ? '8px' : 0)
          : (minimizeMode === 0 ? 0 : (matchMobile ? 0 : (isMenuOpen ? 0 : 0))),
        marginLeft: creationStage.isCompact && !matchMobile ? 'auto' : undefined,
        marginRight: creationStage.isCompact && !matchMobile ? 'auto' : undefined,

        // Use auto width combined with left/right to fix scrollbar bulge
        width: creationStage.isCompact
          ? (matchMobile ? 'auto' : '50%')
          : (keepLandingFullscreenInMenuColumn ? '100%' : (minimizeMode === 0 ? '100%' : (matchMobile ? '100%' : 'auto'))),
        height: creationStage.isCompact
          ? 'auto'
          : (minimizeMode === 0 ? '100vh' : (minimizeMode === 1 ? 'auto' : '25vh')),
        maxHeight: creationStage.isCompact
          ? { xs: 'calc(100dvh - 16px)', sm: 'calc(100dvh - 28px)' }
          : (minimizeMode === 0 ? '100vh' : (minimizeMode === 1 ? '66dvh' : '25vh')),

        // Standard mapping: darkModeReducer true -> dark surface. (The previous
        // deliberate light/dark swap on this surface has been removed.)
        background: darkModeReducer
          ? 'linear-gradient(135deg, rgba(34,34,34,0.62) 0%, rgba(20,20,20,0.60) 55%, rgba(10,10,10,0.58) 100%)'
          : 'linear-gradient(135deg, rgba(255,255,255,0.46) 0%, rgba(255,255,255,0.40) 55%, rgba(238,238,238,0.36) 100%)',
        backdropFilter: darkModeReducer
          ? "blur(24px) saturate(140%)"
          : "blur(21.6px) saturate(140%)",

        // --- Premium Glassmorphism & 3D Effect ---
        border: creationStage.isCompact
          ? '1px solid rgba(255, 255, 255, 0.14)'
          : ((showPathChoiceOverlay || minimizeMode === 0) ? 'none' : '1px solid rgba(255, 255, 255, 0.12)'),
        boxShadow: darkModeReducer
          ? '12px 12px 40px rgba(0, 0, 0, 0.6)'
          : '0 12px 36px rgba(31, 41, 55, 0.16)',

        // Rounded on every corner now it floats clear of the viewport edges.
        borderRadius: creationStage.isCompact
          ? { xs: '22px', sm: '28px' }
          : (minimizeMode === 0 ? 0 : '0 0 24px 24px'),
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',

        paddingBottom: creationStage.isCompact
          ? (matchMobile ? '18px' : '1.2vh')
          : ((minimisePrompt && minimizeMode !== 0) ? '0px' : '4vh'),
        paddingTop: creationStage.isCompact
          ? '0.8vh'
          : ((minimisePrompt && minimizeMode !== 0) ? '0px' : '1.5vh'),
        overflowX: creationStage.isCompact ? 'visible' : 'hidden',
        // 'visible' rather than 'auto': an auto scroller was clipping the pill and
        // showing a rail even when the rows nearly fitted. Nothing scrolls inside
        // the pill now - it simply stretches to whatever its contents need.
        overflowY: creationStage.isCompact ? 'auto' : (minimizeMode === 1 ? 'auto' : 'hidden'),
      }}>

        <div style={{ position: 'fixed', top: '20vh', zIndex: 200, display: 'none' }}>
          {pollStatus && <p>{pollStatus}</p>}
          {/* existing UI */}
        </div>

        {
          minimisePrompt ?

            null
            :

            <>

              <PromptToolbar
                closeReviewRequest={deckCloseReviewRequest}
                creationDeckOpen={promptDeckOpen}
                draftSaved={draftStatus.saved}
                draftSaving={draftStatus.isSaving || draftStatus.pending}
                draftError={draftStatus.error}
                onDraftCloseReview={creationDraft ? async () => {
                  await draftImageSaveRef.current?.();
                  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
                  await creationDraft.flush();
                  const currentDraft = creationDraft.getState();
                  if (currentDraft.postId && (!currentDraft.saved || currentDraft.isSaving || currentDraft.pending)) {
                    throw new Error(currentDraft.error || 'The current draft is still saving. Please retry.');
                  }
                } : undefined}
                buttonTheme={buttonTheme}
                creationStage={creationStage.stage}
                isComposerStage={creationStage.isComposer}
                isLandingStage={creationStage.isLanding}
                isCompactStage={creationStage.isCompact}
                styleModalOpen={styleModalOpen}
                onStyleModalOpenChange={setStyleModalOpen}
                onCompactClose={() => {
                  if (isBlinking) cancelCountdown();
                  clearCreationReferences();
                  setstopFeeds(false);
                  setminimisePrompt(true);
                  handleCloseOverlay();
                }}
                onClearCreationReferences={clearCreationReferences}
                protectedImageUrls={(Vipcharacters || [])
                  .map((character: any) => String(character?.imageUrl || "").trim())
                  .filter(Boolean)}
                handleLoginSuccess={handleLoginSuccess}
                handleLoginError={handleLoginError}
                worldStyle={worldStyle}
                setDummyMode={setDummyMode}
                ImagesHdCloud={ImagesHdCloud}
                setImagesHdCloud={setImagesHdCloud}
                minimisePrompt={minimisePrompt}
                handleOpenCharacterStudio={() => openCharacterStudio(false)}
                setVideMode={setVideMode}
                isMenuOpen={isMenuOpen}
                destroyAllFluxCalls={destroyAllFluxCalls}
                Manual={Manual}
                type={type}
                setPrompt={setPrompt}
                selectedStyle={selectedStyle}
                setSelectedStyle={setSelectedStyle}

                parsedKeyPoints={parsedKeyPoints}
                GeneratedImageFlux={GeneratedImageFlux}
                handleCloseOverlay={handleCloseOverlay}
                referenceImages={referenceImages}
                setReferenceImages={setReferenceImagesManaged}

                allowSpin={allowSpin}
                isBlinking={isBlinking}
                onCancel={cancelCountdown}
                onClose={resetMagicMirror}
                minimizeMode={minimizeMode}
                setMinimizeMode={setMinimizeMode}
                isStorybookDone={isSaveButtonVisible}
                magicMode={magicMode}
                models={models}
                modelz={modelz}
                homeModel={homeModel}
                handleSelectModel={handleSelect}
                isBShotModeActive={isBShotModeActive}
                onOpenMusicPicker={() => {
                  setPromptMusicMode(true);
                  setPromptMusicPickerOpen(true);
                }}
                hasPromptMusic={Boolean(promptMusicUrl)}
                introActive={appIntroActive && showLandingWelcome}
                landingToolbarContent={appIntroActive && showLandingWelcome ? (
                  <PromptIntroUI isCompactStage={creationStage.isCompact} />
                ) : showLandingWelcome ? (
                  <PromptWelcomeUI
                    toolbarOnly
                    isCompactStage={creationStage.isCompact}
                    onBeforeNavigate={() => { }}
                    handleLoginSuccess={handleLoginSuccess}
                    handleLoginError={handleLoginError}
                  />
                ) : null}
                onToggleSlideshow={() => setIsMirrorFocused(true)}
              />

              {showLandingWelcome && (
                <PromptWelcomeUI
                  isCompactStage={creationStage.isCompact}
                  selectionItems={landingSelectionItems}
                  showcaseTemplates={showcaseTemplates}
                  onSelectTemplate={handleShowcaseTemplateSelect}
                  onOpenTemplates={handleOpenStandaloneTemplates}
                  onAskAiForPrompt={handleAskAiForPrompt}
                  isAskingAiForPrompt={isAskingAiForPrompt}
                  aiPromptLabel={type === 3 ? "Ask AI for hotspots" : "Ask AI for prompt"}
                  onReselectActiveMode={() => setminimisePrompt(true)}
                  onBeforeNavigate={() => {
                    setShowPromptWelcomeUI(true);
                    setminimisePrompt(false);
                  }}
                  handleLoginSuccess={handleLoginSuccess}
                  handleLoginError={handleLoginError}
                />
              )}




              {!isMirrorFocused && generatedImagesFluxx.length === 0 && parsedKeyPoints.length === 0 && (
                <Box
                  sx={{
                    // display: "flex",
                    width: creationStage.isCompact
                      ? "100%"
                      : { xs: "100%", sm: PROMPT_LANDING_CONTENT_WIDTH.sm },
                    mx: "auto",
                    mt: creationStage.isCompact ? "4px" : { xs: 0, sm: "1.4vh" },
                    px: { xs: 1.25, sm: 0 },
                    height: "auto",
                    minHeight: creationStage.isCompact ? 0 : (matchMobile ? "9svh" : "9vh"),
                    maxHeight: matchMobile ? "32dvh" : "42dvh",
                    borderBottom: "none",
                    display: "flex",
                    justifyContent: { xs: "space-between", sm: "center" },
                    alignItems: "center",
                  }}
                >
                  {showNativeImagination ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, py: 4, width: '100%' }}>
                      <PlanSteps planInfo={planInfo} parsedKeyPointsx={parsedKeyPointsx} darkMode={darkModeReducer} />
                    </Box>
                  ) : (
                    <>
                      {/* LEFT: read-only prompt shell; editing happens in Notepad */}
                      <Box
                        sx={{
                          flex: creationStage.isCompact ? "1 1 100%" : "1 1 20%",
                          minWidth: 0,
                          height: "auto",
                          boxSizing: "border-box",
                          overflow: "visible",
                          transform: { xs: "translateY(1.5svh)", sm: "none" },
                          px: creationStage.isCompact ? { xs: 1, sm: 1 } : { xs: 1.5, sm: 2 },
                          py: creationStage.isCompact ? { xs: 0.25, sm: 0.25 } : { xs: 0.5, sm: 1 },
                          borderRadius: { xs: "16px", sm: "20px" },
                          background: creationStage.isCompact
                            ? "transparent"
                            : (darkMode
                              ? "rgba(255, 255, 255, 0.07)"
                              : "rgba(255, 255, 255, 0.3)"),
                          border: creationStage.isCompact
                            ? "1px solid transparent"
                            : (darkMode
                              ? "1px solid rgba(255, 255, 255, 0.12)"
                              : "1px solid rgba(255, 255, 255, 0.72)"),
                          boxShadow: creationStage.isCompact
                            ? "none"
                            : (darkMode
                              ? "0 10px 28px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
                              : "0 10px 28px rgba(31, 41, 55, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.78)"),
                          backdropFilter: creationStage.isCompact ? "none" : "blur(16px) saturate(110%)",
                          WebkitBackdropFilter: creationStage.isCompact ? "none" : "blur(16px) saturate(110%)",
                          transition: "background 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
                          "&:hover": creationStage.isCompact ? {} : {
                            background: darkMode
                              ? "rgba(255, 255, 255, 0.1)"
                              : "rgba(255, 255, 255, 0.42)",
                            borderColor: darkMode
                              ? "rgba(255, 255, 255, 0.18)"
                              : "rgba(255, 255, 255, 0.9)",
                          },
                        }}
                      >
                        <TextField
                          value={prompt}
                          {...cb('setup', 'editor', 'Open Notepad editor', 'setIsNotepadOpen(true)')}
                          label=""
                          // Trigger Notepad on focus/click

                          onClick={(e: any) => {
                            // The shell opens Notepad; it is intentionally not an editable binding.
                            // âœ… get caret first
                            handlePromptShellCaret(e);

                            setIsMobileBackActive(true);
                            setIsNotepadOpen(true);
                          }}
                          onBlur={() => {
                            // let dialog manage UX; no need to auto-close here
                            setIsMobileBackActive(false);
                          }}
                          variant="filled"
                          fullWidth
                          multiline
                          minRows={creationStage.isCompact ? 1 : 2}
                          maxRows={matchMobile ? 10 : 14}
                          placeholder={
                            isAllFeeds ? "What would you like to create?" : type === 0
                              ? (GeneratedImage.length > 0
                                ? "Remix image into 1-9 creative scenes."
                                : "Describe 1-9 Creative scenes.")
                              : type === 1
                                ? (GeneratedImage.length > 0
                                  ? "Reimagine image in new story beats."
                                  : "Speak or type a story - even today's news.")
                                : type === 2
                                  ? "Ask anything - I'll reply with friendly audio and live context."
                                  : type === 3
                                    ? "Describe an interactive scene."
                                    : "Search anything - I can use current data."
                          }
                          helperText={error || `${prompt.length} / ${maxCharacters} characters`}
                          error={Boolean(error)}
                          slotProps={{
                            htmlInput: {
                              readOnly: true, // <-- important: editing happens in Notepad dialog
                              maxLength: maxCharacters,
                              "aria-label": "Prompt Input",
                              onKeyDown: (e: any) => {
                                // Optional: prevent typing in shell
                                e.preventDefault();
                              },
                              autoCorrect: "on",
                              spellCheck: true,
                              autoCapitalize: "sentences",
                              autoComplete: "off",
                            },
                          }}
                          sx={{
                            "& .MuiFilledInput-root": {
                              backgroundColor: "transparent",
                              alignItems: "flex-start",
                              pt: creationStage.isCompact ? "4px" : (matchMobile ? "6px" : undefined),
                              pb: creationStage.isCompact ? "2px" : (matchMobile ? "6px" : undefined),
                            },
                            "& .MuiFilledInput-root:hover": { backgroundColor: "transparent" },
                            "& .MuiFilledInput-root.Mui-focused": { backgroundColor: "transparent" },
                            "& .MuiInputBase-root:focus": { outline: "none" },
                            "& .MuiInputBase-input:focus-visible": { outline: "none" },
                            "& .Mui-focused": { outline: "none" },
                            "& .MuiInputBase-input": {
                              color: darkMode ? "#ffffff" : "#171717",
                              fontSize: creationStage.isCompact ? "0.82rem" : (matchMobile ? "0.85rem" : "1.3rem"),
                              // CARET_TEST_DISABLED promptinput-shell: caretColor: "transparent", // no caret in shell

                              // TextareaAutosize writes `overflow: hidden` inline, which is
                              // the whole reason the text was being cut rather than scrolled.
                              overflowY: "auto !important",
                              overscrollBehavior: "contain",

                              /* Transparent modern scroller: a thin translucent thumb on no
                               * track at all, so it reads as part of the glass rather than as
                               * a browser control bolted onto it. Firefox gets the same via
                               * scrollbar-color; both fall back to invisible-but-scrollable. */
                              scrollbarWidth: "thin",
                              scrollbarColor: darkMode
                                ? "rgba(255,255,255,0.28) transparent"
                                : "rgba(0,0,0,0.24) transparent",
                              "&::-webkit-scrollbar": {
                                width: "6px",
                                background: "transparent",
                              },
                              "&::-webkit-scrollbar-track": {
                                background: "transparent",
                                border: "none",
                              },
                              "&::-webkit-scrollbar-thumb": {
                                background: darkMode
                                  ? "rgba(255,255,255,0.24)"
                                  : "rgba(0,0,0,0.20)",
                                borderRadius: "999px",
                                // Insets the thumb off the text so it floats clear of the
                                // last character on each line.
                                border: "1px solid transparent",
                                backgroundClip: "content-box",
                              },
                              "&::-webkit-scrollbar-thumb:hover": {
                                background: darkMode
                                  ? "rgba(255,255,255,0.42)"
                                  : "rgba(0,0,0,0.36)",
                                backgroundClip: "content-box",
                              },
                              "&::-webkit-scrollbar-corner": { background: "transparent" },
                            },
                            "& textarea.MuiInputBase-inputMultiline:not([aria-hidden='true'])": {
                              overflowY: "auto !important",
                              overscrollBehaviorY: "contain",
                              WebkitOverflowScrolling: "touch",
                              touchAction: "pan-y",
                            },
                            "& .MuiInputBase-input:placeholder-shown": {
                              fontSize: matchMobile ? "1rem" : (creationStage.isCompact ? "1.125rem" : "1.4rem"),
                              lineHeight: 1.45,
                            },
                            "& .MuiInputBase-input::placeholder": {
                              color: darkMode ? "rgba(255, 255, 255, 0.48)" : "rgba(23, 23, 23, 0.48)",
                              opacity: 1,
                              fontSize: "inherit",
                              fontWeight: 400,
                            },
                            "& .MuiInputLabel-root": {
                              color: darkMode ? "#ffffff" : "#171717",
                            },
                            "& .MuiFormHelperText-root": {
                              color: error ? "#f44336" : darkMode ? "rgba(255, 255, 255, 0.62)" : "#3f3f46",
                              ...(creationStage.isCompact
                                ? { fontSize: "0.58rem", mt: "1px", mb: 0, lineHeight: 1.2 }
                                : {}),
                            },
                            /* kill the filled-input underline (default, hover & focus) */
                            "& .MuiFilledInput-root:before": {
                              borderBottom: "none !important",
                            },
                            "& .MuiFilledInput-root:hover:before": {
                              borderBottom: "none !important",
                            },
                            "& .MuiFilledInput-root:after": {
                              borderBottom: "none !important",
                            },
                            "& .MuiFilledInput-root.Mui-focused:after": {
                              borderBottom: "none !important",
                            },
                            opacity: isNotepadOpen ? "0.03" : "1",
                            /// backgroundColor: "rgb(255,255,255,0)",
                            zIndex: 0,
                            maxHeight: matchMobile ? "32dvh" : "42dvh",
                            overflow: "auto",

                          }}
                        />
                      </Box>

                      {/* RIGHT: Notepad panel trigger + dialog host */}

                      <Notepad
                        //hide={false}
                        mode={1}
                        guideContext="original-prompt"
                        alignWithInitialComposer={!matchMobile && isMenuOpen && creationStage.isComposer}
                        Caret={Caret}
                        handleKeyDown={handleKeyDown}
                        TextFieldactive={TextFieldactive}
                        setTextFieldactive={setTextFieldactive}

                        GeneratedImage={GeneratedImage}
                        panel
                        panelHeight={creationStage.isCompact && !matchMobile
                          ? "clamp(68px, 9vh, 90px)"
                          : undefined}
                        panelMobileHeight="56px"
                        panelMobileBasis={creationStage.isCompact && matchMobile ? "14%" : undefined}
                        panelMobileOffset="1.5svh"
                        type={type}
                        placeholder={
                          isAllFeeds ? "What would you like to create?" : type === 0
                            ? (GeneratedImage.length > 0
                              ? "Remix image into 1-9 creative scenes."
                              : "Describe 1-9 Creative scenes.")
                            : type === 1
                              ? (GeneratedImage.length > 0
                                ? "Reimagine image in new story beats."
                                : "Speak or type a story - even today's news.")
                              : type === 2
                                ? "Ask anything - I'll reply with friendly audio and live context."
                                : type === 3
                                  ? "Describe an interactive scene."
                                  : "Search anything - I can use current data."
                        }
                        setIsNotepadOpen={setIsNotepadOpen}
                        darkMode={darkModeReducer}
                        size={matchMobile ? "small" : "medium"}
                        open={isNotepadOpen}
                        value={prompt}
                        onChange={(v) => setPrompt(v)}
                        musicMode={Boolean(promptMusicUrl)}
                        musicUrl={promptMusicUrl}
                        musicName={promptMusicName}
                        musicBreakerSec={promptMusicBreakerSec}
                        musicDurationSec={promptMusicDurationSec}
                        onMusicBreakerChange={setPromptMusicBreakerSec}
                        onMusicDurationChange={setPromptMusicDurationSec}
                        onMusicSceneCountChange={setPromptMusicSceneCount}
                        onMusicSegmentsChange={setPromptMusicSegments}
                        onClose={() => {
                          setIsNotepadOpen(false);
                          setIsMobileBackActive(false);
                        }}

                        hide={parsedKeyPoints.length > 1 ? true : false}
                        onSpeak={() => {
                          console.log("Speak / mic with prompt:", prompt);
                        }}
                        showTemplates
                        templateList={templateLibrary}
                        hasMoreTemplates={hasMoreTemplates}
                        ensureTemplateLibraryLoaded={ensureTemplateLibraryLoaded}
                        loadMoreTemplates={loadMoreTemplates}
                        onTemplateLibraryChanged={onTemplateLibraryChanged}
                        onShowcaseTemplatesChanged={onShowcaseTemplatesChanged}
                        cachedImageGen={genCache}
                        onUpdateCachedImageGen={setGenCache}
                      />

                      {planInfo === 0 && parsedKeyPoints.length === 0 && !minimisePrompt && GeneratedImage.length === 0 && (
                        <Box
                          sx={{
                            // In the pill this inline placement is used on mobile too,
                            // so the ratio box sits beside the audio control exactly as
                            // it does on PC (the separate mobile control is hidden).
                            display: creationStage.isCompact ? "flex" : { xs: "none", sm: "flex" },
                            flex: "0 0 auto",
                            height: creationStage.isCompact && matchMobile
                              ? "56px"
                              : "clamp(68px, 9vh, 90px)",
                            alignSelf: "center",
                            transform: creationStage.isCompact
                              ? { xs: "translateY(1.5svh)", sm: "none" }
                              : "none",
                            ml: creationStage.isCompact ? { xs: 1, sm: 1.5 } : 1.5,
                            // PC pill only: the ratio box sat flush against the
                            // panel edge, so it read as clipped rather than placed.
                            mr: isPcCompactActions ? PC_RATIO_RIGHT_INSET : 0,
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "visible",
                          }}
                        >
                          <AspectRatioBox
                            desktopHeight={creationStage.isCompact && matchMobile
                              ? "56px"
                              : "clamp(68px, 9vh, 90px)"}
                            inline
                            models={models}
                            isBlinking={isBlinking}
                            onCancel={cancelCountdown}
                            showLabel={creationStage.isCompact}
                            labelPosition="center"
                          />
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              )}



            </>
        }

        {/* CLOSE ICON  modelz */}
        <IconButton
          onClick={() => {

            clearCreationReferences();

            handleCloseOverlay();

            setflip(false);
          }}
          sx={{
            position: "fixed",
            top: matchMobile ? '23vh' : '20vh',
            right: 12,
            color: darkMode ? "#ffffff" : "#000000",
            zIndex: 30,
            display: GeneratedImageFlux && type === 0 ? 'none' : 'none'
          }}
        >



          <CloseIcon style={{ fontSize: "2rem", opacity: 0.3 }} />
        </IconButton>
        {

          fluxLoaded && type === 0 || fluxLoaded && type === 1 || fluxLoaded && type === 3 ?
            <Box
              sx={{
                display: (GeneratedImageFlux || parsedKeyPoints.length > 0) ? "none" : (!minimisePrompt ? "flex" : "none"),
                position: { sm: "relative" },
                minHeight: creationStage.isCompact
                  ? 0
                  : { sm: (GeneratedImageFlux || parsedKeyPoints.length > 0) ? 0 : "10vh" },
                width: "100%",
                gap: 1,
                alignItems: "center",
                justifyContent: "center",
                // The mobile prompt/audio row is translated down by 1.5svh.
                // Reserve enough layout space here so the action buttons do not
                // visually touch or overlap that transformed row.
                mt: creationStage.isCompact
                  ? (matchMobile ? "calc(36px + 1.5svh)" : PC_ACTION_ROW_TOP_GAP)
                  : (matchMobile ? "calc(6svh + 18px)" : { xs: "6svh", sm: "2vh" }),
                px: { xs: 1, sm: 1.5 },
                py: creationStage.isCompact ? 0.25 : 1
              }}
            >

              {/* PC-only: title selector pinned to the far-left edge */}
              {planInfo === 0 && parsedKeyPoints.length === 0 && !minimisePrompt && GeneratedImage.length === 0 && !showLandingWelcome && (
                <Box sx={{ display: { xs: "none", sm: "flex" }, position: "absolute", left: 24, top: "calc(50% + 2vh)", transform: "translateY(-50%)", alignItems: "center" }}>
                  <TitleSelector inline isBlinking={isBlinking} onCancel={cancelCountdown} buttonTheme={buttonTheme} />
                </Box>
              )}


              {/* Main creation actions: centered */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: creationStage.isCompact ? "nowrap" : { xs: "wrap", sm: "nowrap" },
                  columnGap: creationStage.isCompact ? { xs: 0.5, sm: isPcCompactActions ? 1 : 0.6 } : { xs: 0.75, sm: 0.6 },
                  rowGap: creationStage.isCompact ? { xs: 1.25, sm: 0.6 } : { xs: 0.75, sm: 0.6 },
                  width: "100%",
                  justifyContent: "center",
                  // In the pill the row flows normally and spans the full width.
                  // The absolute centring below is what the full-height panel used
                  // and it fights a content-sized container.
                  position: creationStage.isCompact ? "static" : { sm: "absolute" },
                  left: creationStage.isCompact ? "auto" : { sm: "50%" },
                  top: creationStage.isCompact ? "auto" : { sm: "calc(50% + 2vh)" },
                  transform: creationStage.isCompact ? "none" : { sm: "translate(-50%, -50%)" },
                  px: creationStage.isCompact ? { xs: 0.75, sm: 1 } : 0,
                }}
              >

                {/* Slot C: STYLES, taking the spot the close icon vacated. */}
                {creationStage.isCompact && (
                  <Button
                    title={selectedStyle || 'Styles'}
                    aria-label={`Choose art style: ${selectedStyle || 'Auto'}`}
                    {...cb('setup', 'style', 'Open art styles', 'setStyleModalOpen(true)')}
                    variant="contained"
                    size="small"
                    disableRipple
                    disableFocusRipple
                    onClick={() => {
                      if (isBlinking) cancelCountdown();
                      setStyleModalOpen(true);
                    }}
                    sx={{
                      order: 0,
                      // No auto margin here: STYLES, model and upload are all creation
                      // options, so they sit tight together on the left. The single
                      // auto margin on upload is what pushes CREATE to the right.
                      flex: "0 0 auto",
                      minWidth: { xs: "62px", sm: isPcCompactActions ? PC_ACTION_MIN_WIDTH : "78px" },
                      width: { xs: "62px", sm: isPcCompactActions ? PC_ACTION_MIN_WIDTH : "78px" },
                      overflow: "hidden",
                      px: isPcCompactActions ? 2.25 : 1.5,
                      fontSize: isPcCompactActions ? PC_ACTION_FONT : "0.6rem",
                      fontWeight: 700,
                      letterSpacing: isPcCompactActions ? "0.02em" : undefined,
                      lineHeight: 1,
                      whiteSpace: "nowrap",
                      height: matchMobile ? '44px' : PC_ACTION_HEIGHT,
                      background: buttonTheme.bg,
                      backdropFilter: "blur(24px) saturate(120%)",
                      color: buttonTheme.text,
                      border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                      borderRadius: isPcCompactActions ? PC_ACTION_RADIUS : '12px',
                      boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.6)" : "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
                      transform: "translateY(-2px)",
                      transition: "background .25s ease, transform .12s ease",
                      "&:hover": {
                        background: buttonTheme.hoverBg,
                        color: buttonTheme.hoverText,
                        transform: "translateY(0)",
                      },
                    }}
                  >
                    <Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(!selectedStyle || selectedStyle === 'Auto') ? 'Styles' : selectedStyle}
                    </Box>
                  </Button>
                )}

                <Button
                  variant="contained"
                  disableRipple
                  disableFocusRipple
                  onClick={() => {
                    if (isBlinking) cancelCountdown();
                    setOpen(true);
                  }}
                  {...cb('setup', 'models', 'Open model selection', 'setOpen(true)')}
                  sx={{
                    order: creationStage.isCompact ? 1 : { xs: 1, sm: 1 },
                    flex: { xs: "0 1 auto", sm: "0 0 auto" },
                    flexBasis: { xs: "30%" },
                    minWidth: { xs: "84px", sm: isPcCompactActions ? PC_ACTION_MIN_WIDTH : "auto" },
                    px: { sm: isPcCompactActions ? 2.25 : 1.75 },
                    fontSize: creationStage.isCompact
                      ? (isPcCompactActions ? PC_ACTION_FONT : "0.6rem")
                      : { xs: "0.65rem", sm: "0.68rem" },
                    fontWeight: isPcCompactActions ? 700 : undefined,
                    letterSpacing: isPcCompactActions ? "0.02em" : undefined,

                    /* professional glass base */
                    background: buttonTheme.bg,
                    backdropFilter: "blur(24px) saturate(120%)",
                    color: buttonTheme.text,
                    textShadow: "none",
                    height: creationStage.isCompact
                      ? (matchMobile ? '44px' : PC_ACTION_HEIGHT)
                      : { xs: '38px', sm: '34px' },

                    border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                    borderRadius: creationStage.isCompact ? (isPcCompactActions ? PC_ACTION_RADIUS : '12px') : 12,
                    boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.6)" : "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
                    transform: "translateY(-2px)",
                    animation: isBlinking ? `${blinkOutline} 1s infinite` : "none",

                    transition:
                      "background .25s ease, box-shadow .25s ease, transform .12s ease, border .25s ease",

                    display:
                      GeneratedImageFlux || parsedKeyPoints.length > 0
                        ? "none"
                        : (isPcCompactActions ? "flex" : "block"),
                    alignItems: isPcCompactActions ? "center" : undefined,
                    justifyContent: isPcCompactActions ? "center" : undefined,

                    /* ---------- reflection overlay ---------- */
                    position: "relative",
                    overflow: "hidden",
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      top: "-40%",
                      left: 0,
                      width: "60%",
                      height: "180%",
                      background:
                        "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)",
                      opacity: 0,                      // hidden until hover / press
                      pointerEvents: "none",
                    },

                    /* ---------- hover ---------- */
                    "&:hover": {
                      background: buttonTheme.hoverBg,
                      color: buttonTheme.hoverText,
                      boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.8)" : "0 8px 32px 0 rgba(0, 0, 0, 0.2)",
                      transform: "translateY(0)",
                      "&::before": {
                        opacity: 0.8,
                        animation: `${glassSweep} 1.8s ease-out forwards`,
                      },
                    },

                    /* ---------- active ---------- */
                    "&:active": {
                      background: "rgba(5, 5, 5, 0.55)",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.30)",
                      transform: "translateY(0)",
                      color: darkMode ? "#ffffff" : "#000000",
                      "&::before": {
                        opacity: 0.9,
                        animation: `${glassSweep} 1.1s ease-out forwards`,
                      },
                    },
                  }}
                >

                  {
                    !hasOpenedModelSelection ? (
                      renderPretty(DEFAULT_IMAGE_MODEL, "Models")
                    ) : prettyLabel === "Imagenx" ? (
                      renderPretty("Imagenx", "Imagen")
                    ) :
                      isGptImageModel(prettyLabel) ? (
                        renderPretty(prettyLabel, getImageModelDisplayName(prettyLabel))
                      ) : prettyLabel === "FluxDev" ? (
                        renderPretty("FluxDev", "Reve")
                      ) : prettyLabel === "Imagen" ? (
                        renderPretty("Imagen", "Banana 2.1")
                      ) : prettyLabel === "Imagen2" ? (
                        renderPretty("Imagen2", "Banana")
                      ) : prettyLabel === "FluxUltra" ? (
                        renderPretty("FluxUltra", "Banana 2 Lite")
                      ) : prettyLabel === "FluxUltra2" ? (
                        renderPretty("FluxUltra2", "Pro")
                      ) : prettyLabel === "Minimax2" ? (
                        renderPretty("Minimax2", "Dream ")
                      ) : prettyLabel === "Minimax" ? (
                        renderPretty("Minimax", "Dream 5")

                      ) : prettyLabel === "Schnell" ? (
                        renderPretty("Schnell", "Klein")

                      ) : (
                        renderPretty(prettyLabel, prettyLabel)
                      )
                  }

                </Button>

                {planInfo === 0 && parsedKeyPoints.length === 0 && !minimisePrompt && GeneratedImage.length === 0 && (
                  <Box
                    sx={{
                      order: { xs: 4, sm: 2 },
                      // Superseded by the inline placement above while in the pill.
                      display: creationStage.isCompact ? "none" : { xs: "flex", sm: "none" },
                      flex: "0 0 75px",
                      width: 75,
                      height: 42,
                      boxSizing: "border-box",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 2,
                      backgroundColor: darkModeReducer
                        ? "rgba(0, 0, 0, 0.34)"
                        : "rgba(255, 255, 255, 0.42)",
                    }}
                  >
                    <AspectRatioBox compactMobile inline models={models} isBlinking={isBlinking} onCancel={cancelCountdown} />
                  </Box>
                )}





                {/* Image upload button */}
                <Button
                  {...cb('setup', 'upload', 'Open uploads and Worlds', 'setShowWorldModel(true)')}
                  variant="contained"
                  onClick={() => {
                    setShowWorldModel(true)
                  }}
                  disableRipple
                  disableFocusRipple
                  sx={{
                    order: creationStage.isCompact ? 2 : { xs: 2, sm: 3 },
                    marginRight: creationStage.isCompact ? "auto" : undefined,
                    /* premium glass skin */
                    // PC pill: share the exact glass recipe the other three use,
                    // otherwise this button reads as a different control entirely.
                    background: isPcCompactActions
                      ? buttonTheme.bg
                      : (darkMode
                        ? "linear-gradient(135deg, rgba(20,20,20,0.5) 0%, rgba(10,10,10,0.2) 100%)"
                        : "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 100%)"),
                    backdropFilter: isPcCompactActions ? "blur(24px) saturate(120%)" : "blur(40px) saturate(180%)",
                    color: isPcCompactActions ? buttonTheme.text : (darkMode ? "#ffffff" : "#000000"),
                    textShadow: "none",
                    height: creationStage.isCompact
                      ? (matchMobile ? '44px' : PC_ACTION_HEIGHT)
                      : { xs: '48px', sm: '42px' },
                    width: { xs: '48px', sm: isPcCompactActions ? PC_ACTION_ICON_WIDTH : '56px' },
                    minWidth: { xs: '48px', sm: isPcCompactActions ? PC_ACTION_ICON_WIDTH : '56px' },
                    padding: 0,
                    border: isPcCompactActions
                      ? (darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)")
                      : (darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(255, 255, 255, 0.6)"),
                    borderRadius: creationStage.isCompact ? (isPcCompactActions ? PC_ACTION_RADIUS : '12px') : 12,
                    boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.3)" : "0 8px 32px 0 rgba(31, 38, 135, 0.07)",
                    transform: "translateY(-2px)",
                    transition:
                      "background 250ms ease, box-shadow 250ms ease, transform 120ms ease, border 250ms ease",
                    position: "relative",
                    overflow: "hidden",

                    "&:hover": {
                      background: isPcCompactActions
                        ? buttonTheme.hoverBg
                        : (darkMode
                          ? "linear-gradient(135deg, rgba(30,30,30,0.6) 0%, rgba(20,20,20,0.3) 100%)"
                          : "linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.25) 100%)"),
                      color: isPcCompactActions ? buttonTheme.hoverText : undefined,
                      boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.4)" : "0 8px 32px 0 rgba(31, 38, 135, 0.12)",
                      transform: "translateY(0)",
                      border: isPcCompactActions
                        ? (darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)")
                        : (darkMode ? "1px solid rgba(255, 255, 255, 0.15)" : "1px solid rgba(255, 255, 255, 0.6)"), // clean white rim on hover
                    },

                    display:
                      GeneratedImageFlux || parsedKeyPoints.length > 0
                        ? "none"
                        : "block",
                  }}
                >
                  <UploadIcon
                    style={{
                      fontSize: creationStage.isCompact ? (isPcCompactActions ? '1.3rem' : '1.15rem') : '1.8rem',
                      display: 'block',
                      margin: 'auto',
                      color: appColor,
                    }}
                  />
                </Button>


                {/* Action button */}
                <Button
                  variant="contained"
                  onClick={handleStartSubmit}
                  {...cb('setup', 'create', 'Review creation setup', 'handleStartSubmit')}
                  color="inherit"
                  disableRipple
                  disableFocusRipple
                  sx={{
                    order: creationStage.isCompact ? 3 : { xs: 3, sm: 4 },
                    /* ------------- premium glassmorphism CREATE button ------------- */
                    flex: creationStage.isCompact ? "0 0 auto" : { xs: 1, sm: "0 0 auto" },
                    minWidth: creationStage.isCompact
                      ? { xs: "104px", sm: isPcCompactActions ? PC_CREATE_MIN_WIDTH : "132px" }
                      : { sm: "360px" },
                    px: creationStage.isCompact ? (isPcCompactActions ? 3 : 2) : undefined,
                    fontSize: creationStage.isCompact
                      ? (isPcCompactActions ? PC_ACTION_FONT : "0.6rem")
                      : { xs: "0.65rem", sm: "0.68rem" },
                    fontWeight: isPcCompactActions ? 700 : undefined,
                    letterSpacing: isPcCompactActions ? "0.02em" : undefined,
                    background: buttonTheme.bg,
                    backdropFilter: "blur(24px) saturate(120%)",
                    color: buttonTheme.text,
                    textShadow: "none",
                    height: creationStage.isCompact
                      ? (matchMobile ? '44px' : PC_ACTION_HEIGHT)
                      : { xs: '38px', sm: '34px' },
                    border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                    borderRadius: creationStage.isCompact ? (isPcCompactActions ? PC_ACTION_RADIUS : '12px') : 12,
                    boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.6)" : "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
                    transform: "translateY(-2px)",

                    transition:
                      "background .25s ease, box-shadow .25s ease, transform .12s ease, border .25s ease",
                    display:
                      GeneratedImageFlux || parsedKeyPoints.length > 0
                        ? "none"
                        : (isPcCompactActions ? "flex" : "block"),
                    alignItems: isPcCompactActions ? "center" : undefined,
                    justifyContent: isPcCompactActions ? "center" : undefined,

                    /* ---------- (NEW) container + hidden overlay ---------- */
                    position: "relative",
                    overflow: "hidden",
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      top: "-40%",
                      left: 0,
                      width: "60%",
                      height: "180%",
                      background:
                        "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)",
                      backgroundSize: "200% 200%",
                      transform: "translateX(-150%) rotate(20deg)",
                      opacity: 0,                       // invisible until hover/active
                      pointerEvents: "none",
                    },

                    /* ---------- focus highlight  del (unchanged) ---------- */
                    "&:focus, &:focus-visible, &.Mui-focusVisible": {
                      outline: "none",
                      boxShadow: "none",
                      backgroundColor: darkMode
                        ? "rgba(255,255,255,0.10)"
                        : "rgba(255,255,255,0.10)",
                      color: darkMode ? "#ffffff" : "#000000",
                    },

                    /* ---------- hover ---------- */
                    "&:hover": {
                      outline: "none",
                      background: buttonTheme.hoverBg,
                      color: buttonTheme.hoverText,
                      boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.8)" : "0 8px 32px 0 rgba(0, 0, 0, 0.2)",
                      transform: "translateY(0)",
                      border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                      "&::before": {
                        opacity: 0.8,
                        animation: `${glassSweep} 1.8s ease-out forwards`,
                      },
                    },

                    /* ---------- active ---------- */
                    "&:active": {
                      background: "rgba(5, 5, 5, 0.55)",
                      boxShadow: "0 4px 16px rgba(0,0,0,.30)",
                      transform: "translateY(0)",
                      color: darkMode ? "#ffffff" : "#000000",
                      border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                      "&::before": {
                        opacity: 0.8,
                        animation: `${glassSweep} 1.2s ease-out forwards`,
                      },
                    },

                    WebkitTapHighlightColor: "rgba(25,25,25,0.5)",
                    "::-moz-focus-inner": { border: 0 },
                  }}
                >


                  <span style={{
                    display:
                      allowSpin ? 'none' : 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%'
                  }}>
                    {type === 0 ? "Create" : type === 1 ? "Visualize" : type === 2 ? "Speak" : type === 3 ? "Create" : "Go"}

                  </span>

                  <span style={{
                    display:
                      allowSpin ? 'inline' : 'none',

                    opacity: blinkOn ? 1 : 0.35,
                    transition: "opacity 250ms linear",
                  }}>
                    {planInfo > 1 ? 'Running...' : '...'}

                  </span>


                </Button>




                {/* Action button */}


                <Box
                  sx={{
                    order: creationStage.isCompact ? 0 : { xs: 5, sm: 5 },
                    // In the pill this control has moved to the toolbar (Slot B).
                    display: creationStage.isCompact ? "none" : { xs: "flex", sm: "contents" },
                    flexBasis: creationStage.isCompact ? "auto" : { xs: "100%", sm: "auto" },
                    width: creationStage.isCompact ? "auto" : { xs: "100%", sm: "auto" },
                    marginRight: creationStage.isCompact ? "auto" : undefined,
                    alignItems: "center",
                    justifyContent: "center",
                    mt: creationStage.isCompact ? 0 : { xs: "5svh", sm: 0 },
                    pt: creationStage.isCompact ? 0 : { xs: 1.5, sm: 0 },
                    pb: creationStage.isCompact ? 0 : { xs: 1, sm: 0 },
                  }}
                >
                  <IconButton
                    onClick={async () => {
                      if (isBlinking) cancelCountdown();


                      /// GeneratedImage
                      clearCreationReferences();
                      setstopFeeds(false);
                      setminimisePrompt(true);


                      handleCloseOverlay();

                    }}
                    aria-label="close"
                    color="inherit"
                    disableRipple
                    disableFocusRipple
                    sx={{
                      width: { xs: '44px', sm: '44px' },
                      height: creationStage.isCompact ? { xs: '34px', sm: '34px' } : { xs: '44px', sm: '34px' },

                      /* professional glass base */
                      background: buttonTheme.bg,
                      backdropFilter: "blur(24px) saturate(120%)",
                      color: buttonTheme.text,
                      textShadow: "none",
                      padding: 0,
                      border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                      borderRadius: { xs: "50%", sm: 2 },
                      boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.6)" : "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
                      transform: "translateY(-2px)",

                      transition:
                        "background .25s ease, box-shadow .25s ease, transform .12s ease, border .25s ease",

                      display:
                        GeneratedImageFlux || parsedKeyPoints.length > 0 ? "none" : "inline-flex",

                      /* âœ¨ sweep overlay (invisible until hover/press) */
                      position: "relative",
                      overflow: "hidden",
                      "&::before": {
                        content: '""',
                        position: "absolute",
                        top: "-40%",
                        left: 0,
                        width: "60%",
                        height: "180%",
                        background:
                          "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)",
                        backgroundSize: "200% 200%",
                        transform: "translateX(-150%) rotate(20deg)",
                        opacity: 0,
                        pointerEvents: "none",
                      },

                      /* focus cue (unchanged) */
                      "&:focus, &:focus-visible, &.Mui-focusVisible": {
                        outline: "none",
                        boxShadow: "none",
                        backgroundColor: "rgba(255,255,255,0.007)",
                      },

                      WebkitTapHighlightColor: "transparent",
                      "::-moz-focus-inner": { border: 0 },

                      /* hover */
                      "&:hover": {
                        background: buttonTheme.hoverBg,
                        color: buttonTheme.hoverText,
                        boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.8)" : "0 8px 32px 0 rgba(0, 0, 0, 0.2)",
                        transform: "translateY(0)",
                        border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                        "&::before": {
                          opacity: 0.8,
                          animation: `${glassSweep} 1.8s ease-out forwards`,
                        },
                      },

                      /* active */
                      "&:active": {
                        background: "rgba(5, 5, 5, 0.55)",
                        boxShadow: "0 4px 16px rgba(0,0,0,.30)",
                        transform: "translateY(0)",
                        border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                        "&::before": {
                          opacity: 0.8,
                          animation: `${glassSweep} 1.2s ease-out forwards`,
                        },
                      },
                    }}
                  >
                    <CancelIcon />
                  </IconButton>
                </Box>

              </Box>

            </Box >

            :

            <Box
              sx={{
                display: showButton && !minimisePrompt ? 'flex' : 'none',
                width: '100%',
                maxWidth: { sm: '50%' }, // PC: cap button bar at half-width
                mx: { sm: 'auto' }, // PC: center the bar
                gap: 1, // Adds spacing between the two buttons
                alignItems: 'center',
                px: 1, // Optional: padding on the container so buttons don't touch the screen edges

              }}
            >


              {/* Right Button: Compute / Action Button */}
              <Button
                variant="contained"
                color="primary"
                onClick={handleStartSubmit}
                sx={{
                  flex: 1,
                  marginTop: "0px",

                  /* liquid-glass base */
                  background: buttonTheme.bg,
                  backdropFilter: "blur(24px) saturate(120%)",
                  color: buttonTheme.text,
                  height: creationStage.isCompact ? { xs: '34px', sm: '34px' } : { xs: '38px', sm: '34px' }, // Compact mobile!

                  border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                  borderRadius: creationStage.isCompact ? '12px' : 12,
                  boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.6)" : "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
                  transform: "translateY(-2px)",

                  transition:
                    "background .25s ease, box-shadow .25s ease, transform .12s ease, border .25s ease",

                  display:
                    GeneratedImageFlux || parsedKeyPoints.length > 0 ? "none" : "block",

                  /* === custom focus highlight === */
                  "&:focus, &:focus-visible, &.Mui-focusVisible": {
                    outline: "none",
                    boxShadow: "none",
                    backgroundColor: "rgba(255,255,255,0.10)",
                  },

                  "&:hover": {
                    outline: "none",
                    background: buttonTheme.hoverBg,
                    color: buttonTheme.hoverText,
                    boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.8)" : "0 8px 32px 0 rgba(0, 0, 0, 0.2)",
                    transform: "translateY(0)",
                    border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                  },
                  "&:active": {
                    background: "rgba(5, 5, 5, 0.55)",
                    boxShadow: "0 4px 16px rgba(0,0,0,.30)",
                    transform: "translateY(0)",
                    border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                  },

                  /* remove mobile tap rectangle */
                  WebkitTapHighlightColor: "rgba(25,25,25,0.5)",
                  /* remove Firefox inner border */
                  "::-moz-focus-inner": { border: 0 },
                }}
              >
                {type === 0 ? 'Create' : type === 1 ? 'Visualize' : type === 2 ? 'Speak' : type === 3 ? 'Create' : 'Go'}
              </Button>
            </Box>

        }

        {
          error && (
            <Box mt={1}>
              <Typography variant="body2" color="error">
                {error}
              </Typography>
            </Box>
          )
        }

        {/* **Image Display Container** */}
        <Box
          mt={creationStage.isCompact ? 0 : 4}
          display="flex"
          justifyContent="center"
          position="relative"
          sx={{ width: '100%', maxWidth: 600, margin: '0 auto' }} // Ensure consistent width
        >





          {isSubmitting && type === 0 && (
            <Box
              sx={{
                position: "absolute",
                top: matchMobile ? '-10vh' : "-8vh",
                left: 0,
                width: "100%",
                height: "100%",
                background: "rgba(0,0,0,.35)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 2,
                zIndex: 3,

              }}
            >
              <CircularProgress
                variant="determinate"
                value={loader}
                size={44}
                thickness={4}
                sx={{ color: 'yellow' }} // or any custom color you prefer
              />

              {/* numeric label (optional) */}


              <Typography
                sx={{
                  mt: 1,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fff",
                  fontFamily: "sans-serif",
                  textShadow: "0 1px 3px rgba(0, 0, 0, 0.8)", // strong shadow for contrast
                }}
              >
                {loader}%
              </Typography>

            </Box>
          )}


          {/* **Generated Image** */}
          {



            parsedKeyPoints.length > 0 ?
              null
              :

              // The fanned reference stack that used to live here is gone. It showed
              // only the last three items (slice(-3)) and pinned the world cover with
              // hard-coded vh/% offsets, so a fourth selection was simply invisible.
              // Selections now render in the landing top row (PromptWelcomeUI), which
              // scrolls horizontally and shows every item.
              null}

          {/* **Generated Image Flux** */}
          {

            parsedKeyPoints.length > 0 ?
              null : GeneratedImageFlux && (
                <Box
                  component="img"
                  src={GeneratedImageFlux}
                  alt="Generated Flux"
                  loading="lazy"
                  onClick={handleImageClick} // Allow toggling between images
                  sx={{
                    width: big ? '50%' : "34%",
                    height: "auto",
                    borderRadius: 2,


                    // border: "1px solid #ccc",
                    /// boxShadow: 3,
                    objectFit: "cover",
                    zIndex: 2, // Base z-index
                    cursor: "pointer",
                    transition: "z-index 0.3s ease",
                    filter: isFluxOnTop ? 'blur(0px)' : 'blur(0px)', // Consistent blur

                  }}
                />
              )}


          {big && GeneratedImageFlux ? (
            <Box
              onClick={() => {


                setstartEdit(true);
              }}

              sx={{
                cursor: 'pointer',
                position: "absolute",
                top: '12%',
                left: '0px',
                width: "100%",
                height: "0px",
                backgroundColor: "rgba(255, 255, 255, 0.6)", // Semi-transparent background
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 3, // Above overlay and images
                borderRadius: 2,
                fontSize: '3vh',
                fontWeight: "bold",
                color: "#ffffff", // Text color
                textShadow: "2px 2px 4px rgba(0, 0, 0, 0.6)" // Text shadow for visibility
              }}
            >
              <EditIcon sx={{ mr: 1, fontSize: "inherit" }} />
              Edit
            </Box>

          ) : null}

          {/* **Loader Overlay Within Image Area** */}
          {audioLoad && type === 2 && (
            <Box
              sx={{
                position: "absolute",
                top: '-10.2vh',
                left: 0,
                width: "100%",
                height: "100%",
                /// backgroundColor: "rgba(255, 255, 255, 0.6)", // Semi-transparent background
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 3, // Above overlay and images
                borderRadius: 2,
              }}
            >
              <CircularProgress />
            </Box>
          )}


        </Box>

        {
          GeneratedImageFlux ?
            <Button
              onClick={() => {
                // uploadAllImagesToS3();
                const stored = singleImageCurrentStoredRef.current;
                void GenerateSignedUrl(GeneratedImageFluxBlob instanceof Blob ? GeneratedImageFluxBlob : stored?.hdUrl || '', enhancedPromptx, loggedUser,
                  GeneratedImageFluxBlob instanceof Blob ? undefined : stored || undefined).catch(() => undefined);
              }}
              disabled={!(GeneratedImageFluxBlob instanceof Blob) && !(singleImageCurrentStoredRef.current && !singleImageCurrentStoredRef.current.persisted
                && [singleImageCurrentStoredRef.current.sdUrl, singleImageCurrentStoredRef.current.hdUrl].includes(GeneratedImageFlux))}
              variant="contained"
              color="inherit"         /* avoid theme-blue */
              disableRipple
              disableFocusRipple
              sx={{
                /* keep your sizing */
                width: "100%",
                flex: 1,
                mt: "3px",

                /* â”€â”€ liquid-glass design â”€â”€ */
                background: darkMode
                  ? "rgba(25,25,25,0.25)"
                  : "rgba(255,255,255,0.25)",
                color: darkMode ? "#ffffff" : "#000000",
                ...buttonPadding,

                border: "none",
                borderRadius: creationStage.isCompact ? '12px' : 12,
                boxShadow: "0 12px 32px rgba(0,0,0,0.8)",
                transform: "translateY(-2px)",



                transition:
                  "background 250ms ease, box-shadow 250ms ease, transform 120ms ease",

                display: "block",

                /* hover / press */
                "&:hover": {
                  background: darkMode
                    ? "rgba(25,25,25,0.35)"
                    : "rgba(255,255,255,0.35)",
                  transform: "translateY(0)",
                },
                "&:active": {
                  background: darkMode
                    ? "rgba(25,25,25,0.45)"
                    : "rgba(255,255,255,0.45)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.30)",
                  transform: "translateY(0)",
                },

                /* custom focus tint (no blue outline) */
                "&:focus, &:focus-visible, &.Mui-focusVisible": {
                  outline: "none",
                  boxShadow: "none",
                  backgroundColor: "rgba(255,255,255,0.10)",
                },
                WebkitTapHighlightColor: "transparent",
                "::-moz-focus-inner": { border: 0 },
              }}
            >
              Save
            </Button>


            : null
        }

        {!minimisePrompt
          && GeneratedImage.length === 0
          && parsedKeyPoints.length === 0
          && planInfo === 0
          && !showLandingWelcome && (
            <Box
              sx={{
                display: { xs: "flex", sm: "none" },
                width: "100%",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TitleSelector isBlinking={isBlinking} onCancel={cancelCountdown} buttonTheme={buttonTheme} />
            </Box>
          )}






        {
          parsedKeyPoints.length > 0 && draftHydrated ?
            <Storybook
              creationDeckCovered={promptDeckStage !== null || creationProgressRunKey !== null}
              creationImaginationCovered={promptDeckOpen && promptDeckStage === 'imagination'}
              creationImaginationReopen={creationDeckEnabled && imaginationHasContent && !promptDeckOpen
                ? renderOpenCreationDeck('generation_progress') : undefined}
              onCreationImaginationChange={setStorybookImagination}
              creationDeckPreferred={promptDeckVisible}
              onCreationDeckCharacters={(close: () => void, reopen: () => void) => {
                underlyingStoryboardDeck.current = { close, reopen };
                setPromptDeckVisible(true);
                openCharacterStudio(true);
              }}
              onCreationDeckCloseCreation={requestDeckCloseReview}
              onCreationDeckModels={() => setOpen(true)}
              key={creationProjectId}
              creationDraft={creationDraft}
              onRegisterDraftImageSave={registerDraftImageSave}
              creationProjectId={creationProjectId}
              narrationSummaryError={narrationSummaryError?.key === narrationPreparationKey ? narrationSummaryError.message : ''}
              onRetryNarrationSummary={retryNarrationSummary}
              cinemaNarrationEnabled={cinemaNarrationEnabled}
              onCinemaNarrationChange={setCinemaNarrationEnabled}
              narrationSummaryReady={!cinemaNarrationEnabled || narrationPreparedFor === narrationPreparationKey}
              buttonTheme={buttonTheme}
              Vipcharacters={Vipcharacters}
              setVipcharacters={setVipcharacters}
              setNanoImages={setNanoImages}
              nanoImages={nanoImages}
              showWorldModel={showWorldModel}
              setShowWorldModel={setShowWorldModel}
              stagePromptCache={stagePromptCache}
              allowgetImage={allowgetImage}
              setallowgetImage={setallowgetImage}
              onBackToInitial={() => setShowPathChoiceOverlay(true)}
              setSteps2={setParsedKeyPoints2}
              steps2={parsedKeyPoints2}
              allowSpin={allowSpin}
              setminimisePrompt={setminimisePrompt}
              stopFeeds={stopFeeds}
              ImagesHdCloud={ImagesHdCloud}
              setImagesHdCloud={setImagesHdCloud}
              drawFrameData={drawFrameData}
              setDrawFrameData={setDrawFrameData}
              autoDrawGuideData={autoDrawGuideData}
              setAutoDrawGuideData={setAutoDrawGuideData}
              autoDrawGuideModes={autoDrawGuideModes}
              setAutoDrawGuideModes={setAutoDrawGuideModes}

              VideMode={VideMode}
              setVideMode={setVideMode}
              interactionExperienceMode={interactionExperienceMode}


              selectedStyle={selectedStyle}

              setGeneratedImage={setGeneratedImage}
              timeoutsDisabledRef={timeoutsDisabledRef}
              timeoutRefsxp={timeoutRefsxp}
              destroyAllFluxCalls={destroyAllFluxCalls}
              referenceImages={referenceImages}
              setReferenceImages={setReferenceImagesManaged}
              detectedCharacters={detectedCharacters}
              detectedEnvironments={detectedEnvironments}
              DummyMode={DummyMode}
              setDummyMode={setDummyMode}
              Seed={Seed}
              PostId={PostId}
              setPostId={setPostId}
              GenerateSignedUrl={GenerateSignedUrl}
              type={type}
              isMenuOpen={isMenuOpen}
              Planx={Planx}
              modelz={modelz}
              generatedImagesFlux={generatedImagesFluxx}
              setGeneratedImagesFlux={setGeneratedImagesFluxx}
              loadersArray={loadersArray}
              setLoadersArray={setLoadersArray}
              GotIm={GotIm}
              setStopText={setStopText}
              GeneratedImage={GeneratedImage}
              stepsx={parsedKeyPointsb} setStepsx={setParsedKeyPointsb}
              steps={parsedKeyPoints} setSteps={setParsedKeyPoints} prompt={prompt} isSubmittingKick={isSubmittingKick} setIsSubmittingKick={setIsSubmittingKick}
              musicMode={Boolean(promptMusicUrl)}
              musicModeUrl={promptMusicUrl}
              musicModeName={promptMusicName}
              musicBreakerSec={promptMusicBreakerSec}
              musicSegments={promptMusicSegments}
              setcallFeeds={setcallFeeds}
              handleCloseOverlay={handleCloseOverlay}
              CreationMode={CreationMode} setCreationMode={setCreationMode}
              magicMode={magicMode}
              minimizeMode={minimizeMode}
              setMinimizeMode={setMinimizeMode}
              onAllPromptsGenerated={handlePromptsFinished}
              onIntentOverviewChange={setIntentOverview}
              onSaveVisibilityChange={setIsSaveButtonVisible}
              isAudioDirty={isAudioDirty}
              setIsAudioDirty={setIsAudioDirty}
              audioSceneStatuses={audioSceneStatuses}
              setAudioSceneStatuses={setAudioSceneStatuses}
              isAudioGenerating={isAudioGenerating}
              setIsAudioGenerating={setIsAudioGenerating}
              isBShotModeActive={isBShotModeActive}
              setIsBShotModeActive={setIsBShotModeActive}
              generatedAudios={generatedAudios}
              setGeneratedAudios={setGeneratedAudios}
              generatedAudioTexts={generatedAudioTexts}
              setGeneratedAudioTexts={setGeneratedAudioTexts}
              onVideosChange={setSceneCloudVideos}
              onBgMusicChange={(url: string, name: string) => {
                setStoryBgMusicUrl(url || STORY_DEFAULT_BG_MUSIC_URL);
                setStoryBgMusicName(name || "Music");
              }}
              bShotImages={bShotImages}
              setBShotImages={setBShotImages}
              bShotVideos={bShotVideos}
              setBShotVideos={setBShotVideos}
              bShotPrompts={bShotPrompts}
              setBShotPrompts={setBShotPrompts}
              bShotTextVideo={bShotTextVideo}
              setBShotTextVideo={setBShotTextVideo}
              spatialManifest={spatialManifest}
              setSpatialManifest={setSpatialManifest}
              bShotSpatialScenes={bShotSpatialScenes}
              setBShotSpatialScenes={setBShotSpatialScenes}
              bShotSpatialContexts={bShotSpatialContexts}
              setBShotSpatialContexts={setBShotSpatialContexts}
              spatialMotionContexts={spatialMotionContexts}
              setSpatialMotionContexts={setSpatialMotionContexts}
              bShotNanoImages={bShotNanoImages}
              setBShotNanoImages={setBShotNanoImages}
              bShotDrawFrameData={bShotDrawFrameData}
              setBShotDrawFrameData={setBShotDrawFrameData}
              bShotAutoDrawGuideData={bShotAutoDrawGuideData}
              setBShotAutoDrawGuideData={setBShotAutoDrawGuideData}
              bShotAutoDrawGuideModes={bShotAutoDrawGuideModes}
              setBShotAutoDrawGuideModes={setBShotAutoDrawGuideModes}
            /> : null
        }


        <WorldModel
          setWorldStyle={setWorldStyle}
          setRemixData={setRemixData}
          setWorldCover={setWorldCover}
          selectedWorldId={selectedWorldId}
          setSelectedWorldId={setSelectedWorldId}


          selectedImages={GeneratedImage}

          // Pass the toggle function
          handleSelection={handleToggleGeneratedImage}
          PostId={PostId}
          selectedStyle={selectedStyle}
          Seed={Seed}
          mode={0}
          open={showWorldModel}
          onClose={() => setShowWorldModel(false)}

          // Data Props
          steps={parsedKeyPoints}
          ImagesHdCloud={ImagesHdCloud}
          GeneratedText={[]}
          Planx={Planx}
          GeneratedImageFirst={generatedImagesFluxx[0]}
          // Action Props
          handleFileChange={handleFileChange} // <--- Pass your existing file handler here

          // UI Props
          darkMode={darkModeReducer}
          matchMobile={matchMobile}
          modelz={modelz}
          GeneratedImageFlux={generatedImagesFluxx} // or whatever state tracks generation
          parsedKeyPoints={parsedKeyPoints} // or [] if not available in this scope
          Vipcharacters={Vipcharacters}
          setVipcharacters={setVipcharacters}
        />

        {/* â”€â”€â”€â”€â”€â”€ VIP CHARACTER POPUP â”€â”€â”€â”€â”€â”€ */}
        <ManualCharacterDialog
          open={showVipPopup}
          preparedImage={vipDraft}
          darkMode={darkModeReducer}
          onClose={closeVipDialog}
          onCreate={handleVipCreate}
        />


        {/* â”€â”€â”€â”€â”€â”€ PATH CHOICE OVERLAY â”€â”€â”€â”€â”€â”€ */}
        {showPathChoiceOverlay && (
          <Box
            data-creation-deck-covered={promptDeckOpen ? 'true' : undefined}
            {...(promptDeckOpen ? { inert: '' } : {})}
            sx={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            bgcolor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(20px)',
            zIndex: 999999,
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Top 50% - Result scenes */}
            <Box className="hide-scrollbar" {...cb('preview_choice', 'scenes_scroll', 'Scroll created scene previews', 'scrollChoiceScenes', 'scroll')} sx={{
              height: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 2,
              overflowX: 'auto',
              p: 4,
              width: '100vw'
            }}>
              <style>{`
                  @keyframes pulsate {
                      0% { transform: scale(1); opacity: 0.3; }
                      50% { transform: scale(1.2); opacity: 0.1; }
                      100% { transform: scale(1); opacity: 0.3; }
                  }
                  .go-pulsate {
                      animation: pulsate 2s infinite ease-in-out;
                  }
                  .hide-scrollbar::-webkit-scrollbar {
                      display: none;
                  }
                  .hide-scrollbar {
                      -ms-overflow-style: none;
                      scrollbar-width: none;
                  }
                  @keyframes editgen-soft-blink {
                      0%, 100% { opacity: 1; }
                      50% { opacity: 0.45; }
                  }
                  .editgen-soft-blink {
                      animation: editgen-soft-blink 1.6s infinite ease-in-out;
                  }
                `}</style>
              {editGenSnapshot ? editGenSnapshot.map((img, i) => (
                <Box
                  key={`frozen-${i}`}
                  className="editgen-soft-blink"
                  sx={{
                    position: 'relative',
                    height: { xs: '70%', sm: '85%' },
                    flexShrink: 0,
                    borderRadius: 3,
                    overflow: 'hidden',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    maxWidth: '80vw',
                    pointerEvents: 'none'
                  }}
                >
                  <img src={img} alt={`Scene ${i + 1}`} style={{ height: '100%', width: 'auto', display: 'block', objectFit: 'contain' }} />
                </Box>
              )) : parsedKeyPoints.map((sceneText, i) => {
                const img = nanoImages[i];
                const isImageLarge = expandedChoiceScene > 0;
                const isTextLarge = expandedChoiceScene === 2;
                return (
                  <Box
                    key={i}
                    {...cb('preview_choice', `scene_${i + 1}_image`, `Expand scene ${i + 1} preview`, 'setExpandedChoiceScene')}
                    onClick={() => {
                      if (expandedChoiceScene === 2) {
                        setExpandedChoiceScene(1);
                      } else {
                        setExpandedChoiceScene(expandedChoiceScene === 1 ? 0 : 1);
                      }
                    }}
                    sx={{
                      position: 'relative',
                      height: isImageLarge ? { xs: '110%', sm: '120%' } : { xs: '70%', sm: '85%' },
                      flexShrink: 0,
                      borderRadius: 3,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      maxWidth: '80vw',
                      aspectRatio: img ? 'auto' : '1/1.5',
                      bgcolor: img ? 'transparent' : 'rgba(255,255,255,0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: img ? 'none' : '1px dashed rgba(255,255,255,0.2)'
                    }}
                  >
                    {img ? (
                      <img src={img} alt={`Scene ${i + 1}`} style={{ height: '100%', width: 'auto', display: 'block', objectFit: 'contain' }} />
                    ) : (
                      <div className="go-pulsate" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                    )}
                    {!((window.location.pathname.includes('kickit') || type === 1) && i % 2 !== 0) && (
                      <Box className="hide-scrollbar"
                        {...cb('preview_choice', `scene_${i + 1}_text`, `Expand scene ${i + 1} text`, 'setExpandedChoiceScene(2)')}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (expandedChoiceScene === 2) {
                            setExpandedChoiceScene(1);
                          } else {
                            setExpandedChoiceScene(2);
                          }
                        }}
                        sx={{
                          position: 'absolute',
                          bottom: 0, left: 0, right: 0,
                          maxHeight: '100%',
                          overflowY: isTextLarge ? 'auto' : 'hidden',
                          background: isTextLarge
                            ? 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.4) 85%, transparent 100%)'
                            : 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)',
                          p: isTextLarge ? { xs: 3, sm: 4 } : 2,
                          pt: isTextLarge ? 12 : 8,
                          transition: 'all 0.3s ease'
                        }}>
                        <Typography sx={{
                          color: '#fff',
                          fontSize: isTextLarge ? { xs: '0.85rem', sm: '0.95rem' } : '0.8rem',
                          fontWeight: 500,
                          display: isTextLarge ? 'block' : '-webkit-box',
                          WebkitLineClamp: isTextLarge ? 'unset' : 2,
                          WebkitBoxOrient: isTextLarge ? 'unset' : 'vertical',
                          overflow: isTextLarge ? 'visible' : 'hidden',
                          textShadow: isTextLarge ? '0 4px 10px rgba(0,0,0,1)' : '0 2px 4px rgba(0,0,0,0.8)'
                        }}>
                          {sceneText}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )
              })}
            </Box>

            {/* Bottom 50% - Buttons */}
            <Box sx={{
              height: '50%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: matchMobile ? 'flex-start' : 'center',
              position: 'relative',
              gap: 3,
              pt: matchMobile ? 2 : 0
            }}>
              <div style={{
                width: matchMobile ? '90%' : '50%',
                display: 'flex',
                alignItems: 'stretch',
                justifyContent: 'center',
                zIndex: 100,
              }}>
                {creationDeckEnabled && !promptDeckOpen && renderOpenCreationDeck('preview_choice')}
                <TextField
                  inputProps={cb('preview_choice', 'plan_edit', 'Edit generation plan instruction', 'setPlanEditText', 'text')}
                  value={planEditText}
                  disabled={isPlanEditSubmitting || Boolean(editGenSnapshot)}
                  onChange={(e) => setPlanEditText(e.target.value)}
                  placeholder="Edit generation plan..."
                  multiline
                  variant="standard"
                  InputProps={{ disableUnderline: true }}
                  sx={{
                    flex: 1,
                    minHeight: '40px',
                    borderRadius: '20px 0 0 20px',
                    padding: '10px 15px',
                    background: darkModeReducer ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                    backdropFilter: 'blur(10px)',
                    "& .MuiInputBase-root": {
                      padding: 0,
                    },
                    "& .MuiInputBase-input": {
                      // This overlay sits on a dark scrim in BOTH themes, so the
                      // text is always white — theming it made it black-on-black
                      // in light mode and impossible to read while typing.
                      color: "#ffffff",
                      WebkitTextFillColor: "#ffffff",
                      fontSize: matchMobile ? '0.7rem' : '0.8rem',
                      caretColor: '#ffffff !important',
                      "&::placeholder": {
                        color: "rgba(255,255,255,0.6)",
                        opacity: 1,
                      },
                    }
                  }}
                />
                <Button
                  {...cb('preview_choice', 'update_with_ai', 'Update generation plan with AI', 'handleEditGenerationPlan', 'click', 'candidate')}
                  disabled={!planEditText.trim() || isPlanEditSubmitting || Boolean(editGenSnapshot) || allowSpin}
                  onClick={handleEditGenerationPlan}
                  aria-label="Update generation plan with AI"
                  aria-busy={isPlanEditSubmitting || Boolean(editGenSnapshot)}
                  sx={{
                    ...appAccentButtonSx(appColor, darkModeReducer),
                    borderRadius: '0 20px 20px 0',
                    padding: '0 20px',
                    fontWeight: 'bold',
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {isPlanEditSubmitting || editGenSnapshot ? <CircularProgress size={18} aria-label="Updating generation plan" /> : 'Go'}
                </Button>
                {/* Under the hood. Only appears once intent exists, so it never
                    opens on an empty panel. */}
                {intentOverview?.overview && (
                  <Tooltip title="See what the engine understood" arrow placement="top">
                    <IconButton
                      {...cb('preview_choice', 'intent', 'Open what the engine understood', 'setShowIntentPanel(true)')}
                      onClick={() => setShowIntentPanel(true)}
                      aria-label="See what the engine understood"
                      sx={{
                        ml: 1.2,
                        width: 40,
                        height: 40,
                        alignSelf: 'center',
                        flexShrink: 0,
                        color: darkModeReducer ? "#000" : "#fff",
                        background: appColor,
                        boxShadow: `0 0 14px ${alpha(appColor, 0.45)}`,
                        "&:hover": { background: darken(appColor, 0.12) },
                      }}
                    >
                      <LightbulbOutlinedIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </div>
              {(error || isPlanEditSubmitting || editGenSnapshot) && <Box sx={{ width: matchMobile ? '90%' : '50%' }}>
                <SpatialNotice darkMode={true} accent={appColor} progress={isPlanEditSubmitting || editGenSnapshot ? 'working' : undefined}>
                  {isPlanEditSubmitting || editGenSnapshot ? 'Updating your scenes…' : error}
                </SpatialNotice>
              </Box>}
              {/* Read-only view of what the engine understood: the whole piece and
                  every scene in it. Opening it can never change a prompt. */}
              <Modal open={showIntentPanel} onClose={() => setShowIntentPanel(false)} sx={{ zIndex: 1000001 }}>
                <Box {...cb('intent_view', 'scroll', 'Scroll creation intent', 'scrollIntentPanel', 'scroll')} sx={{
                  position: "absolute", top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: matchMobile ? "92vw" : 640,
                  maxHeight: "82vh", overflowY: "auto",
                  bgcolor: "#0d0d0d", color: "rgba(255,255,255,0.92)",
                  border: `1px solid ${alpha(appColor, 0.35)}`,
                  borderRadius: 3, p: 3, outline: "none",
                }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, mb: 2 }}>
                    <LightbulbOutlinedIcon sx={{ color: appColor, fontSize: 20 }} />
                    <Typography sx={{ fontWeight: 800, fontSize: "1.05rem" }}>
                      {intentOverview?.title || "What the engine understood"}
                    </Typography>
                    <IconButton {...cb('intent_view', 'close', 'Close creation intent', 'setShowIntentPanel(false)')}
                      aria-label="Close creation intent" onClick={() => setShowIntentPanel(false)} sx={{ ml: 'auto', color: '#fff' }}>
                      <CloseIcon />
                    </IconButton>
                  </Box>
                  {intentOverview?.overview && (
                    <Typography sx={{ fontSize: "0.92rem", lineHeight: 1.65, mb: 2.5, fontStyle: "italic" }}>
                      {intentOverview.overview}
                    </Typography>
                  )}
                  {intentOverview?.scenes?.length
                    ? intentOverview.scenes.map((entry) => (
                      <Box key={entry.label} sx={{ mb: 2.2 }}>
                        <Typography sx={{
                          fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.06em",
                          textTransform: "uppercase", color: appColor, mb: 0.5,
                        }}>
                          {entry.label}
                        </Typography>
                        <Typography sx={{ fontSize: "0.86rem", lineHeight: 1.6 }}>
                          {entry.text}
                        </Typography>
                      </Box>
                    ))
                    : (
                      <Typography sx={{ fontSize: "0.86rem", opacity: 0.7 }}>
                        Still reading your idea.
                      </Typography>
                    )}
                </Box>
              </Modal>

              <div style={{
                position: 'relative',
                width: "100%", maxWidth: "500px", display: "flex", justifyContent: "center", alignItems: "center", gap: "15px",
                padding: "0 20px"
              }}>
                {/* Skip Circle  Extract all*/}
                <div style={{ position: 'relative', width: matchMobile ? "90px" : "40%", maxWidth: "160px", aspectRatio: "1/1", display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div className="go-pulsate" style={{ position: "absolute", width: "100%", height: "100%", borderRadius: "50%", background: "rgba(128,128,128,0.5)", opacity: 0.3, zIndex: 0 }} />
                  <button
                    {...cb('preview_choice', 'skip', 'Skip characters and continue to storyboard', 'handleSkipCharacters', 'click', 'candidate')}
                    disabled={isPlanEditSubmitting || Boolean(editGenSnapshot)}
                    onClick={chooseSkipCharacters}
                    style={{
                      position: 'relative',
                      width: "100%", height: "100%", borderRadius: "50%",
                      background: "rgba(128,128,128,0.2)", color: "#fff",
                      border: `2px solid ${alpha(appColor, 0.33)}`, fontWeight: 800,
                      fontSize: matchMobile ? "0.9rem" : "1.1rem", cursor: "pointer",
                      transition: "transform 0.2s ease", display: "flex",
                      alignItems: "center", justifyContent: "center", zIndex: 10,
                    }}
                  >
                    Skip
                  </button>
                </div>

                {/* Create Characters Circle */}
                <div style={{ position: 'relative', width: matchMobile ? "130px" : "55%", maxWidth: "220px", aspectRatio: "1/1", display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div className="go-pulsate" style={{ position: "absolute", width: "100%", height: "100%", borderRadius: "50%", background: appColor, opacity: 0.3, zIndex: 0 }} />
                  <button
                    {...cb('preview_choice', 'create_characters', 'Create characters from generated scenes', 'runAutoCastingPipeline', 'click', 'candidate')}
                    disabled={isPlanEditSubmitting || Boolean(editGenSnapshot)}
                    onClick={chooseCreateCharacters}
                    style={{
                      position: 'relative',
                      width: "100%", height: "100%", borderRadius: "50%",
                      background: appColor, color: darkModeReducer ? "#000" : "#fff", border: "none",
                      fontWeight: 900, fontSize: matchMobile ? "1.1rem" : "1.4rem",
                      cursor: "pointer", boxShadow: `0 15px 40px ${alpha(appColor, 0.47)}`,
                      transition: "transform 0.2s ease, box-shadow 0.2s ease", display: "flex",
                      alignItems: "center", justifyContent: "center", zIndex: 10,
                    }}
                  >
                    Create Characters
                  </button>
                </div>
              </div>
            </Box>
          </Box>
        )}

        {/* â”€â”€â”€â”€â”€â”€ CONCEPT GENERATION STUDIO MODAL (Phase 1) â”€â”€â”€â”€â”€â”€ */}
        <Modal
          open={showStudioModal}
          container={creationDeckEnabled ? () => characterStudioPortal.current : undefined}
          disableScrollLock={creationDeckEnabled}
          disableAutoFocus={promptDeckOpen}
          disableEnforceFocus
          aria-labelledby="studio-modal-title"
          aria-describedby="studio-modal-description"
          style={{ zIndex: 99999 }}
        >
          <Box
            data-creation-deck-covered={promptDeckOpen ? 'true' : undefined}
            {...(promptDeckOpen ? { inert: '' } : {})}
            sx={{
              zIndex: 99999,
              position: 'fixed',
              inset: 0, /* covers top, right, bottom, left */
              width: '100vw',
              height: '100dvh',
              bgcolor: darkModeReducer ? 'rgba(15, 15, 18, 0.55)' : '#ffffff',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              animation: 'majesticFade 0.4s ease-out forwards',
              '@keyframes majesticFade': {
                '0%': { opacity: 0 },
                '100%': { opacity: 1 }
              },
              '@keyframes bounceClick': {
                '0%, 100%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(0.85)' }
              }
            }}
          >
            {/* Unified Close / Skip Arrow Down Button */}
            {!showConfirmClose && ( /* close arrow now also available during detection */
              <IconButton
                {...cb('character_studio', 'close', 'Hide Characters studio', 'setShowStudioModal(false)')}
                onClick={closeCharacterStudio}
                sx={{
                  position: 'absolute',
                  top: 24,
                  right: 24,
                  zIndex: 100,
                  width: 44,
                  height: 44,
                  bgcolor: 'rgba(0,0,0,0.75)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  '&:hover': {
                    bgcolor: 'rgba(255,50,50,0.6)',
                    transform: 'scale(1.1)'
                  },
                  '&:active': {
                    transform: 'scale(1.3)',
                    animation: 'bounceClick 0.3s ease'
                  }
                }}
              >
                <KeyboardArrowDownIcon style={{ fontSize: '1.5rem', opacity: 0.9 }} />
              </IconButton>
            )}

            {/* STUDIO ACTION BUTTON (TOP MIDDLE / LEFT) */}
            {studioButtonStage !== 'hidden' && (
              <Box sx={{
                position: 'absolute',
                top: { xs: 24, sm: 24 },
                left: { xs: 16, sm: '50%' },
                transform: { xs: 'none', sm: 'translateX(-50%)' },
                width: { xs: 'calc(100vw - 90px)', sm: 'auto' },
                zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 1
              }}>
                {skipCountdown === null && renderStudioAction()}
              </Box>
            )}

            {/* Scenes Toggle Button */}
            {!showConfirmClose && !showScenesPopup && (
              <Button
                onClick={() => setShowScenesPopup(true)}
                startIcon={<ForumIcon style={{ fontSize: '1.2rem', opacity: 0.9 }} />}
                sx={{
                  display: 'none', // Hidden per user request
                  position: 'absolute',
                  top: { xs: 'auto', sm: 24 },
                  bottom: { xs: '20vh', sm: 'auto' },
                  left: { xs: 'auto', sm: 24 },
                  right: { xs: 24, sm: 'auto' },
                  transform: { xs: 'none', sm: 'none' },
                  zIndex: 100,
                  minWidth: { xs: 44, sm: 120 },
                  height: 44,
                  px: { xs: 0, sm: 3 },
                  borderRadius: { xs: '50%', sm: '22px' },
                  bgcolor: 'rgba(0,0,0,0.75)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  textTransform: 'none',
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  '& .MuiButton-startIcon': {
                    margin: { xs: 0, sm: '0 8px 0 0' }
                  },
                  '&:hover': {
                    bgcolor: 'rgba(0,0,0,0.85)',
                    transform: { xs: 'scale(1.1)', sm: 'scale(1.05)' },
                  },
                  '&:active': {
                    transform: { xs: 'scale(1.1)', sm: 'scale(0.95)' },
                    transition: 'transform 0.1s'
                  }
                }}
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  SCENES
                </Box>
              </Button>
            )}
            {/* SCROLLABLE INNER AREA */}
            <Box
              {...cb('character_studio', 'scroll', 'Scroll Characters studio', 'studioScrollRef.scrollBy', 'scroll')}
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                overflowX: 'hidden',
                p: matchMobile ? 3 : 6,
                pt: matchMobile ? 14 : 16,
                pb: matchMobile ? '15vh' : '10vh',
                '::-webkit-scrollbar': { width: '6px' },
                '::-webkit-scrollbar-track': { background: 'transparent' },
                '::-webkit-scrollbar-thumb': {
                  background: darkModeReducer ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                  borderRadius: '10px'
                },
                '::-webkit-scrollbar-thumb:hover': {
                  background: darkModeReducer ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'
                }
              }}
              ref={studioScrollRef}
            >
              {/* SECTION 1: Character & Environment Reference Images */}
              <Box sx={{ mb: 6 }}>
                <TextField
                  inputProps={cb('character_studio', 'casting_instruction', 'Character detection instruction', 'setCastingInstruction', 'text')}
                  fullWidth
                  variant="outlined"
                  placeholder="e.g. Extract all locations as well"
                  value={castingInstruction}
                  onChange={(e) => setCastingInstruction(e.target.value)}
                  sx={{
                    mb: 4,
                    '& .MuiOutlinedInput-root': {
                      color: darkModeReducer ? '#fff' : '#000',
                      bgcolor: darkModeReducer ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      borderRadius: 3,
                      backdropFilter: 'blur(10px)',
                      '& fieldset': {
                        borderColor: darkModeReducer ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      },
                      '&:hover fieldset': {
                        borderColor: darkModeReducer ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: appColor,
                      }
                    },
                    "& .MuiInputBase-input": {
                      color: darkModeReducer ? "#ffffff" : "#000000", // Text color
                      fontSize: matchMobile ? '1rem' : '1rem',
                      caretColor: 'auto !important',
                    }
                  }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  {creationDeckEnabled && !promptDeckOpen && renderOpenCreationDeck('character_studio')}
                  <Typography variant="overline" sx={{ color: darkModeReducer ? '#888' : '#777', letterSpacing: 2, fontWeight: 'bold' }}>
                    Character & Environment References
                  </Typography>
                  {(!castingPipelineActive && !stepTwoAuditInProgress && !referenceImages.some(isReferenceWorking) && referencePendingCount === 0) && (
                    <IconButton
                      {...cb('character_studio', 'refresh', castingInstruction.trim() ? 'Find additional references with instruction' : 'Restart character detection', 'runAutoCastingPipeline(false)', 'click', 'candidate')}
                      onClick={refreshStudioReferences}
                      size="small"
                      sx={{
                        color: darkModeReducer ? '#888' : '#777',
                        bgcolor: darkModeReducer ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                        '&:hover': { bgcolor: 'rgba(255,50,50,0.1)', color: '#ff4040' }
                      }}
                    >
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>

                {renderCharacterStudioFeedback()}

                {/* 2-column reference image grid */}
                {referenceImages.length > 0 && (
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(6, 1fr)' },
                    gap: 2
                  }}>
                    {referenceImages.map((ref, idx) => (
                      <Box key={idx}
                        {...cb('character_studio', `reference_${ref.clientReferenceId || idx}`, `Open ${ref.name} reference`, 'selectReferenceForEditing')}
                        onClick={() => openStudioReference(idx)}
                        onMouseLeave={() => {
                          setHideAllLabels(false);
                          setFadeAllLabels(false);
                          if (labelHideTimerRef.current) clearTimeout(labelHideTimerRef.current);
                        }}
                        onTouchEnd={() => {
                          setHideAllLabels(false);
                          setFadeAllLabels(false);
                          if (labelHideTimerRef.current) clearTimeout(labelHideTimerRef.current);
                        }}
                        sx={{
                          borderRadius: 3,
                          overflow: 'hidden',
                          position: 'relative',
                          bgcolor: '#ffffff',
                          boxShadow: darkModeReducer ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.1)',
                          aspectRatio: '9/16',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: studioButtonStage === 'continue-editing' ? 'default' : 'pointer'
                        }}>
                        {/* Reference removal is always available and requires confirmation. */}
                        <IconButton
                          {...cb('character_studio', `remove_${ref.clientReferenceId || idx}`, `Request removal of ${ref.name}`, 'setPendingReferenceRemoval')}
                          aria-label={"Remove " + ref.name}
                          title={"Remove " + ref.name}
                          onClick={(event) => {
                            event.stopPropagation();
                            setPendingReferenceRemoval({
                              name: ref.name,
                              type: ref.type
                            });
                          }}
                          sx={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            zIndex: 10,
                            bgcolor: 'rgba(0,0,0,0.68)',
                            color: '#fff',
                            width: 28,
                            height: 28,
                            '&:hover': { bgcolor: 'rgba(210,35,35,0.95)' }
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 18 }} />
                        </IconButton>

                        {pendingReferenceRemoval &&
                          referenceNamesMatch(
                            pendingReferenceRemoval.name,
                            ref.name
                          ) && (
                            <Box
                              onClick={(event) => event.stopPropagation()}
                              sx={{
                                position: 'absolute',
                                inset: 0,
                                zIndex: 20,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 2,
                                p: 2,
                                textAlign: 'center',
                                bgcolor: 'rgba(8,8,10,0.92)',
                                backdropFilter: 'blur(12px)'
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{
                                  color: '#fff',
                                  fontWeight: 700,
                                  overflowWrap: 'anywhere'
                                }}
                              >
                                Remove {ref.name}?
                              </Typography>
                              <Box
                                sx={{
                                  display: 'grid',
                                  gridTemplateColumns: '1fr 1fr',
                                  gap: 1,
                                  width: '100%'
                                }}
                              >
                                <Button
                                  {...cb('character_studio', `confirm_remove_${ref.clientReferenceId || idx}`, `Confirm remove ${ref.name}`, 'handleDeleteCharacter', 'click', 'needs_confirmation')}
                                  variant="contained"
                                  color="error"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDeleteCharacter(ref.name, ref.type);
                                    setPendingReferenceRemoval(null);
                                  }}
                                  sx={{ minWidth: 0 }}
                                >
                                  Yes
                                </Button>
                                <Button
                                  {...cb('character_studio', `cancel_remove_${ref.clientReferenceId || idx}`, `Keep ${ref.name}`, 'setPendingReferenceRemoval(null)')}
                                  variant="outlined"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setPendingReferenceRemoval(null);
                                  }}
                                  sx={{
                                    minWidth: 0,
                                    color: '#fff',
                                    borderColor: 'rgba(255,255,255,0.45)'
                                  }}
                                >
                                  No
                                </Button>
                              </Box>
                            </Box>
                          )}                        {/* Image or shimmer skeleton */}
                        {ref.imageUrl ? (
                          <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                            <img
                              src={ref.imageUrl}
                              alt={ref.name}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block'
                              }}
                            />
                            {(ref as any).isUpscaling && (
                              <Box sx={{
                                position: 'absolute', inset: 0,
                                bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center', gap: 1, zIndex: 10
                              }}>
                                <CircularProgress size={32} sx={{ color: appColor }} />
                                <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, letterSpacing: 1 }}>
                                  UPSCALING...
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        ) : ((ref as any).isGenerating) ? (
                          <Box sx={{
                            width: '100%',
                            height: '100%',
                            background: `linear-gradient(110deg, #f5f5f5 8%, #e0e0e0 18%, #f5f5f5 33%)`,
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.5s infinite linear',
                            '@keyframes shimmer': {
                              '0%': { backgroundPosition: '200% 0' },
                              '100%': { backgroundPosition: '-200% 0' }
                            }
                          }} />
                        ) : (
                          <Box sx={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: darkModeReducer ? '#2d2d2d' : '#f0f0f0',
                          }}>
                            {ref.type === 'Environment' ? (
                              <LandscapeIcon sx={{ fontSize: 80, color: darkModeReducer ? '#555' : '#ccc' }} />
                            ) : ref.type === 'Object' ? (
                              <CategoryIcon sx={{ fontSize: 80, color: darkModeReducer ? '#555' : '#ccc' }} />
                            ) : (
                              <PersonIcon sx={{ fontSize: 80, color: darkModeReducer ? '#555' : '#ccc' }} />
                            )}
                          </Box>
                        )}

                        {/* Glassmorphism bottom name tag */}
                        {!hideAllLabels && (
                          <Box
                            {...cb('character_studio', `rename_${ref.clientReferenceId || idx}`, `Rename ${ref.name}`, 'setRenameModalOpen(true)')}
                            onMouseEnter={(e) => {
                              e.stopPropagation();
                              setFadeAllLabels(true);
                              if (labelHideTimerRef.current) clearTimeout(labelHideTimerRef.current);
                              labelHideTimerRef.current = setTimeout(() => {
                                setHideAllLabels(true);
                              }, 1300);
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                              setFadeAllLabels(true);
                              if (labelHideTimerRef.current) clearTimeout(labelHideTimerRef.current);
                              labelHideTimerRef.current = setTimeout(() => {
                                setHideAllLabels(true);
                              }, 1300);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCharacterToRename({ idx, oldName: ref.name, newName: ref.name, type: ref.type });
                              setRenameModalOpen(true);
                            }}
                            sx={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              px: 2,
                              py: 1.5,
                              bgcolor: 'rgba(0,0,0,0.65)',
                              backdropFilter: 'blur(16px)',
                              borderTop: '1px solid rgba(255,255,255,0.1)',
                              cursor: 'pointer',
                              transition: 'all 0.2s, opacity 1.3s linear',
                              opacity: fadeAllLabels ? (hideAllLabels ? 0 : 0.2) : 1,
                              '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' }
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                              <Typography sx={{
                                color: '#fff',
                                fontSize: '0.9rem',
                                fontWeight: 700,
                                letterSpacing: 0.5,
                                textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                                textAlign: 'center'
                              }}>
                                {ref.name}
                              </Typography>
                              <IconButton
                                {...cb('character_studio', `rename_icon_${ref.clientReferenceId || idx}`, `Open rename for ${ref.name}`, 'setRenameModalOpen(true)')}
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCharacterToRename({ idx, oldName: ref.name, newName: ref.name, type: ref.type });
                                  setRenameModalOpen(true);
                                }}
                                onTouchStart={(e) => e.stopPropagation()}
                                sx={{ color: '#fff', p: 0.5 }}
                              >
                                <EditIcon fontSize="inherit" sx={{ fontSize: '1.1rem' }} />
                              </IconButton>
                            </Box>
                            {(ref.description || ref.prompt) && (
                              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', mt: 0.5, textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {ref.description || ref.prompt}
                              </Typography>
                            )}
                          </Box>
                        )}

                        {/* Generation top-right Spinner */}
                        {(ref.isGenerating || ref.isUploading) && (
                          <Box sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            zIndex: 20,
                            bgcolor: 'rgba(0,0,0,0.6)',
                            borderRadius: '50%',
                            p: 0.75,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            backdropFilter: 'blur(4px)'
                          }}>
                            <CircularProgress size={16} thickness={5} sx={{ color: appColor }} />
                          </Box>
                        )}
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              {/* SECTION 2: Scenes Scroll Anchor */}
              <Box ref={scenesAnchorRef} sx={{ mb: 28 }}>
                <Typography
                  variant="body1"
                  {...cb('character_studio', 'golden_prompt', 'Expand or collapse golden prompt', 'setIsGoldenPromptExpanded')}
                  onClick={() => setIsGoldenPromptExpanded(!isGoldenPromptExpanded)}
                  sx={{
                    color: darkModeReducer ? '#fff' : '#111',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    textShadow: darkModeReducer ? '0 2px 10px rgba(0,0,0,0.5)' : 'none',
                    maxHeight: isGoldenPromptExpanded ? '500px' : '150px',
                    overflowY: 'auto',
                    cursor: 'pointer',
                    transition: 'max-height 0.3s ease',
                    '&::-webkit-scrollbar': { display: 'none' },
                    msOverflowStyle: 'none',
                    scrollbarWidth: 'none',
                  }}>
                  {prompt || "Golden Prompt Not Provided"}
                </Typography>
                <Box sx={{ height: '1px', bgcolor: darkModeReducer ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', my: 3 }} />
                <Typography
                  variant="subtitle2"
                  {...cb('character_studio', 'show_scenes', 'Open creation scenes list', 'setShowScenesPopup(true)')}
                  onClick={() => setShowScenesPopup(true)}
                  sx={{
                    color: appColor,
                    mt: 1,
                    mb: 2,
                    textTransform: 'uppercase',
                    letterSpacing: 2,
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.7 }
                  }}
                >
                  Show Scenes
                </Typography>
              </Box>
            </Box>

            {/* SCENES SLIDE-UP POPUP Skip  */}
            {showScenesPopup && (
              <Box sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 500,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'stretch',
                bgcolor: 'rgba(0,0,0,0.3)', // Added subtle backdrop
              }}
                onClick={() => setShowScenesPopup(false)} // Background click closes popup
              >
                {!matchMobile && (
                  <Box
                    sx={{
                      height: '20%',
                      cursor: 'pointer'
                    }}
                  />
                )}
                {/* Bottom 80% â€” scenes content */}
                <Box
                  {...cb('character_scenes', 'scroll', 'Scroll character-studio scenes', 'scenesPopup.scrollBy', 'scroll')}
                  onClick={(e) => e.stopPropagation()}
                  sx={{
                    height: matchMobile ? '65vh' : '80%',
                    width: '100%',
                    bgcolor: darkModeReducer ? 'rgba(15, 15, 18, 0.75)' : '#ffffff',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    borderTop: '1px solid',
                    borderColor: darkModeReducer ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    borderRadius: '24px 24px 0 0',
                    overflowY: 'auto',
                    p: matchMobile ? 3 : 6,
                    pt: matchMobile ? 4 : 5,
                    pb: matchMobile ? '15vh' : '10vh',
                    animation: 'slideUpScenes 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                    '@keyframes slideUpScenes': {
                      '0%': { transform: 'translateY(100%)' },
                      '100%': { transform: 'translateY(0)' }
                    },
                    '::-webkit-scrollbar': { width: '6px' },
                    '::-webkit-scrollbar-track': { background: 'transparent' },
                    '::-webkit-scrollbar-thumb': {
                      background: darkModeReducer ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                      borderRadius: '10px'
                    }
                  }}
                >
                  {/* Drag handle indicator */}
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                    <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: darkModeReducer ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }} />
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
                    <Typography variant="subtitle2" sx={{
                      color: appColor, textTransform: 'uppercase', letterSpacing: 2,
                      fontSize: '0.75rem', fontWeight: 'bold'
                    }}>Scenes</Typography>
                    <IconButton {...cb('character_scenes', 'close', 'Close scenes list', 'setShowScenesPopup(false)')}
                      aria-label="Close scenes list" onClick={() => setShowScenesPopup(false)}
                      sx={{ color: darkModeReducer ? '#fff' : '#111' }}><CloseIcon /></IconButton>
                  </Box>

                  <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    px: { xs: 0, sm: 6, md: 16 }
                  }}>
                    {parsedKeyPoints && parsedKeyPoints.length > 0 ? (
                      parsedKeyPoints.map((scene: any, idx: number) => (
                        <Box
                          key={idx}
                          {...cb('character_scenes', `scene_${idx + 1}`, `Open scene ${idx + 1} preview`, 'setSelectedSceneIndex')}
                          sx={{
                            cursor: 'pointer',
                            p: { xs: 1.5, sm: 2 },
                            borderRadius: 1,
                            transition: 'background-color 0.2s',
                            '&:hover': {
                              bgcolor: darkModeReducer ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                            }
                          }}
                          onClick={() => {
                            setSelectedSceneIndex(idx);
                            setExpandedScene(false);
                          }}
                        >
                          <Typography variant="h6" sx={{
                            fontWeight: 'bold',
                            mb: 0.5,
                            fontSize: { xs: '0.95rem', sm: '1.05rem', md: '1.15rem' },
                            color: darkModeReducer ? appColor : "#888888"
                          }}>
                            Scene {idx + 1}.
                          </Typography>
                          <Typography variant="body1" sx={{
                            lineHeight: 1.5,
                            fontSize: { xs: '0.95rem', sm: '1.05rem', md: '1.15rem' },
                            textAlign: 'justify',
                            color: darkModeReducer ? '#cccccc' : '#333333'
                          }}>
                            {scene}
                          </Typography>
                        </Box>
                      ))
                    ) : (
                      [1, 2, 3].map((mock, idx) => (
                        <Box key={`mock-${idx}`} sx={{ p: { xs: 1.5, sm: 2 } }}>
                          <Typography variant="h6" sx={{ color: darkModeReducer ? '#777' : '#999', fontWeight: 'bold', mb: 0.5, fontSize: '0.95rem' }}>
                            Scene {idx + 1}. (Analysis Pending)
                          </Typography>
                          <Typography variant="body1" sx={{ color: darkModeReducer ? '#555' : '#888', lineHeight: 1.5, fontSize: '0.95rem', textAlign: 'justify' }}>
                            The model is currently analyzing the golden prompt to extract key narrative segments and determine the visual requirements for this scene.
                          </Typography>
                        </Box>
                      ))
                    )}
                  </Box>
                </Box>
              </Box>
            )}

            {/* CONFIRMATION OVERLAY */}
            {showConfirmClose && (
              <Box
                role="alertdialog"
                aria-modal="true"
                aria-label="Confirm close character studio"
                sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column'
              }}>
                <Box
                  {...cb('character_studio', 'confirm_close', 'Confirm clear character studio and references', 'handleCloseOverlay', 'click', 'needs_confirmation')}
                  onClick={() => {
                    setShowConfirmClose(false);
                    setShowStudioModal(false);
                    setShowScenesPopup(false);
                    updateReferenceImages(() => []);
                    setDetectedCharacters([]);
                    setDetectedEnvironments([]);
                    setCastingStatus("");
                    bulkDeleteImages();
                    handleCloseOverlay(); // Call close functionality from Storybook context
                    hasStartedCastingRef.current = false;
                    isGeneratingRefsRef.current = false;
                    referenceGenerationRunRef.current = null;
                  }}
                  sx={{
                    flex: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: darkModeReducer ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(20px)',
                    color: '#fff', fontSize: '2.5rem', fontWeight: 900, letterSpacing: 4, cursor: 'pointer',
                    transition: 'all 0.2s',
                    textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    '&:hover': { bgcolor: darkModeReducer ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.25)' }
                  }}
                >
                  YES
                </Box>
                <Box
                  {...cb('character_studio', 'cancel_close', 'Keep character studio open', 'setShowConfirmClose(false)')}
                  onClick={() => setShowConfirmClose(false)}
                  sx={{
                    flex: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: darkModeReducer ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(20px)',
                    color: '#fff', fontSize: '2.5rem', fontWeight: 900, letterSpacing: 4, cursor: 'pointer',
                    transition: 'all 0.2s',
                    textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                    '&:hover': { bgcolor: darkModeReducer ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.25)' }
                  }}
                >
                  NO
                </Box>
              </Box>
            )}
          </Box>
        </Modal>

        <Modal
          open={selectedSceneIndex !== null}
          onClose={() => setSelectedSceneIndex(null)}
          sx={{ zIndex: promptDeckOpen ? 1000002 : 999999 }}
        >
          <Box
            onClick={() => setSelectedSceneIndex(null)}
            sx={{
              position: 'fixed', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3,
              bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 9999
            }}
          >

            <IconButton {...cb('character_scene_preview', 'close', 'Close scene preview', 'setSelectedSceneIndex(null)')}
              aria-label="Close scene preview" onClick={(event) => { event.stopPropagation(); setSelectedSceneIndex(null); }}
              sx={{ position: 'fixed', top: 24, right: 24, zIndex: 100000, color: '#fff', bgcolor: 'rgba(0,0,0,0.7)' }}>
              <CloseIcon />
            </IconButton>

            <Box
              id="scenes-glass-slider"
              {...cb('character_scene_preview', 'scroll', 'Scroll scene previews horizontally', 'scenes-glass-slider.scrollBy', 'scroll')}
              sx={{
                width: '100%',
                maxWidth: '100vw',
                height: matchMobile ? '75vh' : '100vh',
                display: 'flex',
                alignItems: 'center',
                overflowX: 'auto',
                overflowY: 'hidden',
                scrollSnapType: 'x mandatory',
                '::-webkit-scrollbar': { display: 'none' },
                p: 0,
                outline: 'none'
              }}
            >
              {/* Left Hitbox */}
              <Box
                {...cb('character_scene_preview', 'previous', 'Previous scene preview', 'scenes-glass-slider.scrollBy(-width)')}
                onClick={(e) => {
                  e.stopPropagation();
                  const slider = document.getElementById('scenes-glass-slider');
                  if (slider) slider.scrollBy({ left: -window.innerWidth, behavior: 'smooth' });
                }}
                sx={{
                  position: 'fixed', left: 0, top: 0, bottom: 0, width: '20%',
                  display: matchMobile ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', zIndex: 99999, transition: 'background 0.2s',
                  background: 'transparent',
                  '&:hover': { background: 'linear-gradient(to right, rgba(255,255,255,0.05), transparent)' },
                  '&:active': { background: 'linear-gradient(to right, rgba(255,255,255,0.15), transparent)' }
                }}
              />

              {/* Right Hitbox */}
              <Box
                {...cb('character_scene_preview', 'next', 'Next scene preview', 'scenes-glass-slider.scrollBy(width)')}
                onClick={(e) => {
                  e.stopPropagation();
                  const slider = document.getElementById('scenes-glass-slider');
                  if (slider) slider.scrollBy({ left: window.innerWidth, behavior: 'smooth' });
                }}
                sx={{
                  position: 'fixed', right: 0, top: 0, bottom: 0, width: '20%',
                  display: matchMobile ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', zIndex: 99999, transition: 'background 0.2s',
                  background: 'transparent',
                  '&:hover': { background: 'linear-gradient(to left, rgba(255,255,255,0.05), transparent)' },
                  '&:active': { background: 'linear-gradient(to left, rgba(255,255,255,0.15), transparent)' }
                }}
              />

              {parsedKeyPoints && parsedKeyPoints.map((scene: any, idx: number) => {
                const previewImg = nanoImages[idx];
                const isExpanded = expandedScene;

                return (
                  <Box
                    key={idx}
                    ref={(el: HTMLDivElement | null) => { if (sceneElementsRef.current) sceneElementsRef.current[idx] = el; }}
                    sx={{
                      flex: '0 0 100vw',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      scrollSnapAlign: 'center',
                      px: { xs: 2, sm: 8 },
                      outline: 'none',
                      cursor: 'zoom-out'
                    }}
                  >
                    <Box
                      {...cb('character_scene_preview', `toggle_text_${idx + 1}`, `Expand scene ${idx + 1} text`, 'setExpandedScene')}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (previewImg) {
                          setExpandedScene(!expandedScene);
                        }
                      }}
                      sx={{
                        position: 'relative',
                        overflow: 'hidden',
                        borderRadius: 4,
                        minHeight: previewImg ? 'auto' : '40vh',
                        minWidth: previewImg ? 'auto' : '250px',
                        maxWidth: '100%',
                        bgcolor: darkModeReducer ? "rgba(20, 20, 25, 0.85)" : "rgba(255, 255, 255, 0.85)",
                        backdropFilter: 'blur(20px)',
                        boxShadow: darkModeReducer ? "0 8px 32px rgba(0,0,0,0.6)" : "0 8px 32px rgba(0,0,0,0.1)",
                        border: darkModeReducer ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(255,255,255,0.4)",
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: previewImg ? 'flex-end' : 'center',
                        cursor: previewImg ? 'pointer' : 'default',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {previewImg && (
                        <img
                          src={previewImg}
                          alt="Scene preview"
                          style={{
                            display: 'block',
                            maxWidth: '100%',
                            maxHeight: matchMobile ? '75vh' : '85vh',
                            width: 'auto',
                            height: 'auto',
                            objectFit: 'contain',
                            zIndex: 0,
                            opacity: 1,
                            animation: 'majesticFade 0.5s ease-out forwards',
                            filter: isExpanded ? 'brightness(0.45) blur(3px)' : 'none',
                            transition: 'all 0.3s ease'
                          }}
                        />
                      )}
                      {!previewImg && (
                        <Box sx={{
                          position: 'absolute', inset: 0, zIndex: 0, opacity: 0.1,
                          background: `linear-gradient(135deg, #FFB4B4 0%, ${appColor} 100%)`,
                          animation: 'pulseBg 2s infinite alternate'
                        }} />
                      )}

                      <Box sx={{
                        position: previewImg ? 'absolute' : 'relative',
                        bottom: previewImg ? 0 : 'auto',
                        left: previewImg ? 0 : 'auto',
                        width: previewImg ? '100%' : 'auto',
                        height: isExpanded ? (matchMobile ? '80%' : '100%') : 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: isExpanded ? 'center' : 'flex-end',
                        zIndex: 1,
                        background: previewImg
                          ? (isExpanded ? 'transparent' : (darkModeReducer ? 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.9))' : 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.8))'))
                          : (darkModeReducer ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)'),
                        p: previewImg ? (isExpanded ? { xs: 3, sm: 6 } : 2) : 2,
                        pt: previewImg ? (isExpanded ? { xs: 4, sm: 8 } : 4) : 2,
                        borderRadius: previewImg ? (isExpanded ? '12px' : 0) : 2,
                        backdropFilter: previewImg ? (isExpanded ? 'none' : 'none') : 'blur(10px)',
                        textAlign: previewImg ? (isExpanded ? 'center' : 'center') : 'center',
                        transition: 'all 0.3s ease'
                      }}>
                        {!previewImg && (
                          <Typography sx={{
                            color: appColor,
                            fontWeight: 800, mb: 1, fontSize: '1.2rem',
                            textShadow: darkModeReducer ? '0 2px 4px rgba(0,0,0,0.8)' : 'none'
                          }}>
                            Accessing Imagination...
                          </Typography>
                        )}
                        {/* Removed "Accessing imagination" for loaded images and instead present the scene number */}
                        {previewImg && isExpanded && (
                          <Typography sx={{
                            color: "#ffffff",
                            fontWeight: 900, mb: 1.5, fontSize: '1.2rem',
                            textTransform: 'uppercase', letterSpacing: 2,
                            textShadow: '0 2px 10px rgba(0,0,0,1)'
                          }}>
                            Scene {idx + 1}
                          </Typography>
                        )}
                        <Typography sx={{
                          color: previewImg ? "rgba(255,255,255,0.95)" : (darkModeReducer ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)"),
                          fontSize: previewImg ? (isExpanded ? { xs: '0.85rem', sm: '1.0rem' } : '0.8rem') : '0.9rem',
                          lineHeight: isExpanded ? 1.6 : 1.4,
                          fontStyle: previewImg && !isExpanded ? 'normal' : 'italic',
                          display: isExpanded ? 'block' : '-webkit-box',
                          overflow: isExpanded ? 'auto' : 'hidden',
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: isExpanded ? 'none' : (previewImg ? 2 : 4),
                          textShadow: previewImg ? '0 1px 5px rgba(0,0,0,0.9), 0 2px 10px rgba(0,0,0,1)' : (darkModeReducer ? '0 1px 3px rgba(0,0,0,0.8)' : 'none'),
                          transition: 'all 0.3s ease'
                        }}>
                          {scene}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Modal>

        {/* Reference Editor Popup */}
        <input
          ref={referenceUploadInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleReferenceImageUpload}
        />
        <Modal
          open={editingRefIdx !== null}
          disableEnforceFocus={guideEnabled}
          onClose={closeReferenceEditor}
          sx={{ zIndex: promptDeckOpen ? 1000002 : 999999 }}
        >
          <Box
            sx={{
              position: 'fixed', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 0, sm: 3 },
              bgcolor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)', zIndex: 999999
            }}
            onClick={closeReferenceEditor} // Click background closes
          >
            <Box
              onClick={(e) => {
                e.stopPropagation();
                if (zoomMode && !matchMobile) {
                  closeReferenceEditor();
                }
              }}
              sx={{
                width: '100%',
                maxWidth: (zoomMode && !matchMobile) ? '100vw' : '1000px',
                maxHeight: (zoomMode && !matchMobile) ? '100vh' : (matchMobile && zoomMode ? '100dvh' : { xs: '90vh', sm: '85vh' }),
                bgcolor: (zoomMode && !matchMobile) ? 'transparent' : (darkModeReducer ? '#0f0f12' : '#ffffff'),
                borderRadius: ((zoomMode && !matchMobile) || (matchMobile && zoomMode)) ? 0 : 6,
                overflowY: (matchMobile && zoomMode) ? 'auto' : 'hidden',
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                position: 'relative',
                boxShadow: (zoomMode && !matchMobile) ? 'none' : '0 24px 80px rgba(0,0,0,0.8)',
                border: (zoomMode && !matchMobile) ? 'none' : '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              {(zoomMode || matchMobile) && (
                <IconButton
                  {...cb('reference_editor', 'close_zoom', 'Close character reference editor', 'closeReferenceEditor')}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeReferenceEditor();
                  }}
                  sx={{
                    position: 'absolute',
                    top: { xs: '3.5vh', sm: 24 },
                    right: { xs: 16, sm: 24 },
                    bgcolor: 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    backdropFilter: 'blur(8px)',
                    zIndex: 9999,
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' }
                  }}
                >
                  <CloseIcon />
                </IconButton>
              )}
              {/* Left/Top: Image Section */}
              <Box
                onDragStart={(e) => e.preventDefault()}
                onWheel={(e) => {
                  if (Math.abs(e.deltaX) < 30) return;
                  const now = Date.now();
                  if (now - lastSwipeTimeRef.current < 600) return;
                  lastSwipeTimeRef.current = now;

                  if (e.deltaX > 0 && editingRefIdx !== null && editingRefIdx < referenceImages.length - 1) {
                    selectReferenceForEditing(editingRefIdx + 1);
                  }
                  if (e.deltaX < 0 && editingRefIdx !== null && editingRefIdx > 0) {
                    selectReferenceForEditing(editingRefIdx - 1);
                  }
                }}
                onTouchStart={(e) => {
                  touchStartXRef.current = e.targetTouches[0].clientX;
                }}
                onTouchMove={(e) => {
                  touchEndXRef.current = e.targetTouches[0].clientX;
                }}
                onTouchEnd={() => {
                  if (touchStartXRef.current === null || touchEndXRef.current === null) return;
                  const distance = touchStartXRef.current - touchEndXRef.current;
                  const isLeftSwipe = distance > 50;
                  const isRightSwipe = distance < -50;
                  if (isLeftSwipe || isRightSwipe) {
                    lastSwipeTimeRef.current = Date.now();
                  }
                  if (isLeftSwipe && editingRefIdx !== null && editingRefIdx < referenceImages.length - 1) {
                    selectReferenceForEditing(editingRefIdx + 1);
                  }
                  if (isRightSwipe && editingRefIdx !== null && editingRefIdx > 0) {
                    selectReferenceForEditing(editingRefIdx - 1);
                  }
                  touchStartXRef.current = null;
                  touchEndXRef.current = null;
                }}
                onMouseDown={(e) => {
                  if (!matchMobile) {
                    touchStartXRef.current = e.clientX;
                    touchEndXRef.current = e.clientX;
                  }
                }}
                onMouseMove={(e) => {
                  if (!matchMobile && e.buttons === 1 && touchStartXRef.current !== null) {
                    touchEndXRef.current = e.clientX;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!matchMobile && touchStartXRef.current !== null && touchEndXRef.current !== null) {
                    const distance = touchStartXRef.current - touchEndXRef.current;
                    if (Math.abs(distance) > 50) {
                      if (distance > 50 && editingRefIdx !== null && editingRefIdx < referenceImages.length - 1) {
                        selectReferenceForEditing(editingRefIdx + 1);
                      }
                      if (distance < -50 && editingRefIdx !== null && editingRefIdx > 0) {
                        selectReferenceForEditing(editingRefIdx - 1);
                      }
                    }
                  }
                  touchStartXRef.current = null;
                  touchEndXRef.current = null;
                }}
                onMouseUp={(e) => {
                  if (matchMobile) return;
                  if (touchStartXRef.current !== null && touchEndXRef.current !== null) {
                    const distance = touchStartXRef.current - touchEndXRef.current;
                    if (Math.abs(distance) > 50) {
                      if (distance > 50 && editingRefIdx !== null && editingRefIdx < referenceImages.length - 1) {
                        selectReferenceForEditing(editingRefIdx + 1);
                      }
                      if (distance < -50 && editingRefIdx !== null && editingRefIdx > 0) {
                        selectReferenceForEditing(editingRefIdx - 1);
                      }
                    } else if (zoomMode && Math.abs(distance) < 5) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      const edgeWidth = rect.width * 0.25;
                      if (clickX < edgeWidth && editingRefIdx !== null && editingRefIdx > 0) {
                        selectReferenceForEditing(editingRefIdx - 1);
                      } else if (clickX > rect.width - edgeWidth && editingRefIdx !== null && editingRefIdx < referenceImages.length - 1) {
                        selectReferenceForEditing(editingRefIdx + 1);
                      }
                    }
                  }
                  touchStartXRef.current = null;
                  touchEndXRef.current = null;
                }}
                sx={{
                  flex: (zoomMode && !matchMobile) ? '1 1 100%' : { xs: 'none', md: '0 0 45%' },
                  height: (zoomMode && !matchMobile) ? '100vh' : (matchMobile && zoomMode ? '100dvh' : { xs: '20vh', md: 'auto' }),
                  aspectRatio: (matchMobile && zoomMode) ? '9/16' : 'auto',
                  position: 'relative',
                  bgcolor: matchMobile ? (darkModeReducer ? '#0f0f12' : '#ffffff') : '#000',
                  overscrollBehaviorX: 'none',
                  touchAction: 'pan-y',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  '& .nav-arrow': { opacity: 0, transition: 'opacity 0.2s' },
                  '&:hover .nav-arrow': { opacity: 1 }
                }}>
                {(!matchMobile || (matchMobile && zoomMode)) && (
                  <>
                    {editingRefIdx !== null && referenceImages.length > 1 && (
                      <Box
                        className="nav-edge-left"
                        {...cb('reference_editor', 'previous', 'Previous character reference', 'selectReferenceForEditing(previous)')}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (editingRefIdx !== null) {
                            const newIdx = editingRefIdx > 0 ? editingRefIdx - 1 : referenceImages.length - 1;
                            selectReferenceForEditing(newIdx);
                          }
                        }}
                        sx={{
                          position: zoomMode ? "fixed" : "absolute",
                          left: 0,
                          top: 0,
                          width: zoomMode ? "18vw" : "18%",
                          height: "100%",
                          zIndex: 20,
                          cursor: "pointer",
                          transition: "background 0.3s ease",
                          "&:hover": {
                            background: darkMode
                              ? "linear-gradient(to right, rgba(255,255,255,0.15) 0%, transparent 100%)"
                              : "linear-gradient(to right, rgba(0,0,0,0.3) 0%, transparent 100%)"
                          },
                        }}
                      />
                    )}
                    {editingRefIdx !== null && referenceImages.length > 1 && (
                      <Box
                        className="nav-edge-right"
                        {...cb('reference_editor', 'next', 'Next character reference', 'selectReferenceForEditing(next)')}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (editingRefIdx !== null) {
                            const newIdx = editingRefIdx < referenceImages.length - 1 ? editingRefIdx + 1 : 0;
                            selectReferenceForEditing(newIdx);
                          }
                        }}
                        sx={{
                          position: zoomMode ? "fixed" : "absolute",
                          right: 0,
                          top: 0,
                          width: zoomMode ? "18vw" : "18%",
                          height: "100%",
                          zIndex: 20,
                          cursor: "pointer",
                          transition: "background 0.3s ease",
                          "&:hover": {
                            background: darkMode
                              ? "linear-gradient(to left, rgba(255,255,255,0.15) 0%, transparent 100%)"
                              : "linear-gradient(to left, rgba(0,0,0,0.3) 0%, transparent 100%)"
                          },
                        }}
                      />
                    )}
                  </>
                )}
                {editingRefIdx !== null && referenceImages[editingRefIdx]?.imageUrl ? (
                  <img
                    {...cb('reference_editor', 'zoom', zoomMode ? 'Exit reference image zoom' : 'Zoom reference image', 'setZoomMode')}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (Date.now() - lastSwipeTimeRef.current < 400) return;
                      setZoomMode(!zoomMode);
                    }}
                    src={referenceImages[editingRefIdx].imageUrl}
                    alt="Reference"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: (zoomMode && !matchMobile) ? 'contain' : (matchMobile && zoomMode ? 'contain' : 'cover'),
                      objectPosition: (matchMobile && !zoomMode) ? 'top center' : 'center',
                      cursor: 'pointer'
                    }}
                  />
                ) : (
                  <CircularProgress color="inherit" />
                )}
              </Box>

              {/* Right/Bottom: Controls Section (Hidden in zoom mode on PC) */}
              {(!zoomMode || matchMobile) && (
                <Box {...cb('reference_editor', 'controls_scroll', 'Scroll reference editor controls', 'referenceEditor.scrollBy', 'scroll')} sx={{
                  flex: 1,
                  p: { xs: 3, sm: 5 },
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  overflowY: 'auto'
                }}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: darkModeReducer ? '#fff' : '#000', mb: 1 }}>
                      {editingRefIdx !== null && referenceImages[editingRefIdx]?.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#888', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 'bold' }}>
                      Concept Refinement
                    </Typography>
                  </Box>

                  {/* Update with AI */}
                  <Box>
                    <Typography variant="overline" sx={{ color: appColor, fontWeight: 800, mb: 1, display: 'block', letterSpacing: 1 }}>
                      Update with AI
                    </Typography>
                    <Box sx={{ position: 'relative', display: 'flex' }}>
                      <Box
                        sx={{ flex: 1, position: 'relative' }}>
                        <TextField
                          fullWidth
                          multiline
                          minRows={2}
                          placeholder="Describe changes... (e.g. 'add a battle scar', 'blue cinematic lighting')"
                          {...cb('reference_editor', 'update_editor', 'Open character Update with AI editor', 'setIsNotepadOpenRefAI(true)')}
                          value={aiUpdateVal}
                          onChange={(e) => setAiUpdateVal(e.target.value)}
                          onClick={(e: any) => {
                            handlePromptShellCaret(e);
                            setIsNotepadOpenRefAI(true);
                          }}
                          slotProps={{
                            htmlInput: { readOnly: true }
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              bgcolor: darkModeReducer ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                              borderRadius: 3,
                              fontSize: '0.95rem',
                              pr: 7
                            },
                            '& .MuiInputBase-input': {
                              color: darkModeReducer ? '#fff' : '#000'
                            },
                            opacity: isNotepadOpenRefAI ? '0.03' : '1'
                          }}
                        />
                        <IconButton
                          {...cb('reference_editor', 'refine_ai', 'Refine character image prompt with AI', 'handleEditReferenceAI', 'click', 'candidate')}
                          onClick={(e) => { e.stopPropagation(); handleEditReferenceAI(); }}
                          disabled={isAILoading || !aiUpdateVal}
                          sx={{
                            position: 'absolute',
                            bottom: 8,
                            right: 8,
                            color: appColor,
                            '&.Mui-disabled': { color: 'rgba(255,255,255,0.1)' }
                          }}
                        >
                          {isAILoading ? <CircularProgress size={24} color="inherit" /> : <AutoFixHighIcon />}
                        </IconButton>
                      </Box>
                      <Notepad
                        zIndex={9999999}
                        hide={false}
                        Caret={Caret}
                        handleKeyDown={(e: any) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            setIsNotepadOpenRefAI(false);
                            handleRegenerateReference();
                          }
                        }}
                        TextFieldactive={false}
                        setTextFieldactive={() => { }}
                        GeneratedImage={''}
                        panel
                        type={200}
                        guideContext="character-update-instruction"
                        darkMode={darkModeReducer}
                        size={matchMobile ? "small" : "medium"}
                        open={isNotepadOpenRefAI}
                        setIsNotepadOpen={setIsNotepadOpenRefAI}
                        onClose={() => setIsNotepadOpenRefAI(false)}
                        placeholder="Describe changes... (e.g. 'add a battle scar', 'blue cinematic lighting')"
                        value={aiUpdateVal}
                        onChange={(v: string) => setAiUpdateVal(v)}
                      />
                    </Box>
                  </Box>

                  {/* Image Prompt */}
                  <Box>
                    <CharacterImageControls
                      mode={activeReferenceGenerationMode}
                      onModeChange={setActiveReferenceGenerationMode}
                      onUpload={openReferenceImageUpload}
                      disabled={activeReferenceIsWorking}
                      canEdit={activeReferenceCanEdit}
                      uploading={Boolean(activeEditingReference?.isUploading)}
                      darkMode={darkModeReducer}
                      appColor={appColor}
                    />
                    <Box sx={{ position: 'relative', display: 'flex' }}>
                      <Box
                        sx={{ flex: 1, position: 'relative' }}>
                        <TextField
                          fullWidth
                          multiline
                          minRows={3}
                          value={imagePromptVal}
                          {...cb('reference_editor', 'prompt_editor', 'Open character image prompt editor', 'setIsNotepadOpenRefPrompt(true)')}
                          onChange={(e) => setActiveReferencePromptDraft(e.target.value)}
                          onClick={(e: any) => {
                            handlePromptShellCaret(e);
                            setIsNotepadOpenRefPrompt(true);
                          }}
                          slotProps={{
                            htmlInput: { readOnly: true }
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              bgcolor: darkModeReducer ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                              borderRadius: 3,
                              fontSize: '0.85rem',
                              fontFamily: 'monospace',
                              color: darkModeReducer ? '#ccc' : '#444'
                            },
                            opacity: isNotepadOpenRefPrompt ? '0.03' : '1'
                          }}
                        />
                      </Box>
                      <Notepad
                        zIndex={9999999}
                        hide={false}
                        Caret={Caret}
                        handleKeyDown={(e: any) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            setIsNotepadOpenRefPrompt(false);
                            handleRegenerateReference();
                          }
                        }}
                        TextFieldactive={false}
                        setTextFieldactive={() => { }}
                        GeneratedImage={''}
                        panel
                        type={200}
                        guideContext="character-image-prompt"
                        darkMode={darkModeReducer}
                        size={matchMobile ? "small" : "medium"}
                        open={isNotepadOpenRefPrompt}
                        setIsNotepadOpen={setIsNotepadOpenRefPrompt}
                        onClose={() => setIsNotepadOpenRefPrompt(false)}
                        placeholder="Image Prompt"
                        value={imagePromptVal}
                        onChange={(v: string) => setActiveReferencePromptDraft(v)}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', mt: 1 }}>
                      <Button
                        {...cb('reference_editor', 'default_prompt', 'Restore default character image prompt', 'setActiveReferencePromptDraft')}
                        size="small"
                        onClick={() => {
                          if (editingRefIdx !== null) {
                            const ref = referenceImages[editingRefIdx];
                            const defaultPrompt = ref?.originalPrompt || ref?.prompt || ref?.description || "";
                            setActiveReferencePromptDraft(defaultPrompt);
                            setAiUpdateVal("");
                          }
                        }}
                        sx={{
                          ml: 'auto',
                          bgcolor: darkModeReducer ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                          color: darkModeReducer ? '#aaa' : '#666',
                          textTransform: 'none',
                          fontSize: '0.75rem',
                          borderRadius: '16px',
                          px: 2,
                          py: 0.5,
                          backdropFilter: 'blur(4px)',
                          border: '1px solid',
                          borderColor: darkModeReducer ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                          '&:hover': {
                            bgcolor: darkModeReducer ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                            color: darkModeReducer ? '#fff' : '#000',
                          }
                        }}
                      >
                        Default
                      </Button>
                    </Box>
                  </Box>

                  {/* Actions */}
                  <Box sx={{ mt: 'auto', pt: 2, pb: matchMobile ? 4 : 0, display: 'flex', gap: 2 }}>
                    <Button
                      {...cb('reference_editor', 'regenerate', activeReferenceGenerationMode === 'edit' ? 'Edit the current character image with the selected model' : 'Recreate the character image from its prompt', 'handleRegenerateReference', 'click', 'candidate')}
                      fullWidth
                      variant="contained"
                      onClick={handleRegenerateReference}
                      disabled={activeReferenceIsWorking || (activeReferenceGenerationMode === 'edit' && !activeReferenceCanEdit)}
                      startIcon={activeReferenceIsWorking ? <CircularProgress size={20} color="inherit" /> : activeReferenceGenerationMode === 'edit' ? <EditIcon /> : <RefreshIcon />}
                      sx={{
                        height: 56,
                        borderRadius: 4,
                        ...appAccentButtonSx(appColor, darkModeReducer),
                        fontWeight: 800,
                        fontSize: '1rem',
                        letterSpacing: 1,
                      }}
                    >
                      {activeEditingReference?.isUploading ? 'UPLOADING...' : activeReferenceIsWorking ? 'GENERATING...' : activeReferenceGenerationMode === 'edit' ? 'EDIT IMAGE' : 'RECREATE IMAGE'}
                    </Button>

                    <IconButton
                      {...cb('reference_editor', 'close', 'Return to character reference grid', 'closeReferenceEditor')}
                      onClick={closeReferenceEditor}
                      sx={{
                        width: 56, height: 56, borderRadius: 4,
                        bgcolor: darkModeReducer ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                        '&:hover': { bgcolor: darkModeReducer ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }
                      }}
                    >
                      <CloseIcon sx={{ color: darkModeReducer ? '#fff' : '#000' }} />
                    </IconButton>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </Modal>

        <Modal
          open={renameModalOpen}
          onClose={() => setRenameModalOpen(false)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: promptDeckOpen ? 1000002 : 999999
          }}
        >
          <Box sx={{
            width: matchMobile ? '90%' : 400,
            bgcolor: darkModeReducer ? '#1E1E1E' : '#FFFFFF',
            borderRadius: 3,
            p: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}>
            <Typography variant="h6" sx={{ color: darkModeReducer ? '#fff' : '#000', fontWeight: 'bold' }}>
              Rename Character
            </Typography>
            <TextField
              inputProps={cb('character_rename', 'name', 'New character or environment name', 'setCharacterToRename', 'text')}
              fullWidth
              variant="outlined"
              value={characterToRename?.newName || ''}
              onChange={(e) => setCharacterToRename(prev => prev ? { ...prev, newName: e.target.value } : null)}
              autoFocus
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: darkModeReducer ? '#fff' : '#000',
                  '& fieldset': {
                    borderColor: darkModeReducer ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                  },
                  '&:hover fieldset': {
                    borderColor: appColor,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: appColor,
                  },
                },
                "& .MuiInputBase-input": {
                  color: darkModeReducer ? "#ffffff" : "#000000", // Text color
                  fontSize: matchMobile ? '1.3rem' : '1.4rem',
                  caretColor: 'auto !important',
                }
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
              <Button
                {...cb('character_rename', 'cancel', 'Cancel character rename', 'setRenameModalOpen(false)')}
                onClick={() => setRenameModalOpen(false)}
                sx={{ color: darkModeReducer ? '#aaa' : '#666', fontWeight: 'bold' }}
              >
                Cancel
              </Button>
              <Button
                {...cb('character_rename', 'save', 'Save renamed character', 'updateReferenceImages', 'click', 'candidate')}
                variant="contained"
                onClick={() => {
                  if (characterToRename && characterToRename.newName.trim() !== '') {
                    const { idx, newName, oldName, type } = characterToRename;
                    const cleanName = newName.trim().replace(/\s+/g, ' ');
                    if (isReferenceWorking(referenceImages[idx]) || referenceImages.some((r, i) => i !== idx && referenceNamesMatch(r.name, cleanName))) return;
                    updateReferenceImages(prev => prev.map((r, i) => i === idx ? { ...r, name: cleanName } : r));
                    if (type.toLowerCase() === 'character') {
                      setDetectedCharacters(prev => prev.map((c: any) => referenceNamesMatch(c.name, oldName) ? { ...c, name: cleanName } : c));
                      setVipcharacters(prev => prev.map((c: any) => referenceNamesMatch(c.name, oldName) ? { ...c, name: cleanName } : c));
                    } else {
                      setDetectedEnvironments(prev => prev.map((env: any) => referenceNamesMatch(env.name, oldName) ? { ...env, name: cleanName } : env));
                    }
                    setQueuedCastingPrompts(prev => prev.map((item: any) => referenceNamesMatch(item.name, oldName) ? { ...item, name: cleanName } : item));
                    const previousRenderKey = renderedRefKey(oldName);
                    if (renderedRefsRef.current[previousRenderKey]) {
                      renderedRefsRef.current[renderedRefKey(cleanName)] = true;
                      delete renderedRefsRef.current[previousRenderKey];
                    }
                  }
                  setRenameModalOpen(false);
                }}
                disabled={!characterToRename?.newName?.trim()
                  || Boolean(characterToRename && isReferenceWorking(referenceImages[characterToRename.idx]))
                  || Boolean(characterToRename && referenceImages.some((r, i) => i !== characterToRename.idx && referenceNamesMatch(r.name, characterToRename.newName.trim())))}
                sx={{
                  ...appAccentButtonSx(appColor, darkModeReducer),
                  fontWeight: 'bold',
                  '&:hover': {
                    bgcolor: appColor,
                  }
                }}
              >
                GO
              </Button>
            </Box>
          </Box>
        </Modal>

        <Modal
          open={isStandaloneTemplatesOpen}
          disableEnforceFocus
          disableAutoFocus
          disableRestoreFocus
          onClose={(event, reason) => {
            if (templateGalleryRef.current?.handleBackOrClose?.()) {
              return;
            }
            setIsStandaloneTemplatesOpen(false);
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 13000,
            p: 0,
            backdropFilter: 'blur(12px)',
            bgcolor: 'rgba(0,0,0,0.62)',
          }}
        >
          <Box
            onClick={(e) => e.stopPropagation()}
            sx={{
              width: { xs: '100vw', sm: '80vw' },
              maxWidth: 1540,
              height: '100dvh',
              maxHeight: '100dvh',
              outline: 'none',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
            <TemplateLibrary
              ref={templateGalleryRef}
              standalone
              templates={templateLibrary}
              activeTemplateId={null}
              handleTemplateSelect={handleShowcaseTemplateSelect}
              darkMode={darkModeReducer}
              appColor={appColor}
              appColorHover={darken(appColor, 0.08)}
              onClose={() => setIsStandaloneTemplatesOpen(false)}
              onFetchMore={loadMoreTemplates}
              hasMore={hasMoreTemplates}
              onDeleteTemplate={handleStandaloneDeleteTemplate}
              onToggleShowcase={handleStandaloneToggleShowcase}
              onTemplateCreated={() => {
                void onTemplateLibraryChanged?.();
                void ensureTemplateLibraryLoaded?.();
              }}
              onOpenBrainstorm={(params) => {
                setIsStandaloneTemplatesOpen(false);
                setIsNotepadOpen(true);
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('clikb-open-brainstorm', { detail: params || { isAIEnabled: false } }));
                }, 50);
              }}
            />
          </Box>
        </Modal>

        <Box>
          {AudioResult === "" ? null : <AudioNarration text={AudioResult} />}
        </Box>
      </Box>
    </>
    </CreationLedgerContext.Provider>
  );
});

/** A ready entry remounts the existing funnel once, before any stage effects. */
const PromptInput: React.FC<any> = (props) => {
  const accountId = useSelector((state: RootState) => state.profile.loggedUser?.id);
  const entry = usePendingDraftEntry(accountId || 0);
  const [session, setSession] = useState(0);
  const promptHistoryOwner = useRef(createPromptInputHistoryOwner()).current;
  return <PromptInputSession key={`${accountId || 'anonymous'}:${entry?.requestId || session}`}
    {...props} promptHistoryOwner={promptHistoryOwner} type={entry?.record.snapshot.creationType ?? props.type} draftEntry={entry} onDraftSessionClosed={() => {
      if (entry) consumePendingDraftEntry(accountId || 0, entry.requestId);
      setSession(value => value + 1);
    }} />;
};

export default PromptInput;
