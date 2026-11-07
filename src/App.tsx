import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import "./App.css";
import { isScheduledDarkMode } from "./themeSchedule";
import "./theme.css";
import axios from "axios";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch, store } from "./store";
import { syncScheduledTheme } from "./settingsSlice";
import { setLoggedUser } from "./profileSlice";
import { loadImageModelExampleSets } from './imageModelExamplesSlice';
import MenuToggle from "./MenuToggle";
import LeftEdgeMenuPeek from "./components/LeftEdgeMenuPeek";
import ProfileInfo from "./ProfileInfo";

import Box from "@mui/material/Box";

import ThumbnailYoutube from "./ThumbnailYoutube";

import EmotionsGate from "./EmotionsGate";

import { setLogin } from "./settingsSlice";


import MenuIcon from '@mui/icons-material/Menu';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

import MenuSlider from "./MenuSlider";
import { ChatProvider } from './SocialChat';

import { CredentialResponse } from '@react-oauth/google';

import { matchMobile } from "./DetectDevice";

import Images from "./Images";
import Settings from "./Settings";
import { isAllFeedsLanding, useInitialAllFeedsComposer } from './allFeedsLanding';
import Clikit from "./Clikit";
import Mypage from "./Mypage";

import PrivacyPolicy from "./PrivacyPolicy";

import Audio from "./Audio";

import Kickit from "./Kickit";
import Feeds from "./Feeds";

import Homepage from "./Homepage";
import ClikBateFooter from "./ClikBateFooter";

import Footer from "./Footer";


// 1) ADDED: Import useLocation scale MenuToggle
import { Navigate, Routes, Route, useLocation } from "react-router-dom";

import { useNavigate } from 'react-router-dom';


import BottomMenu from "./BottomMenu";
import { DeckRuntimeProvider } from './DeckRuntimeContext';
import { BrainstormSessionProvider } from "./components/BrainstormSessionProvider";
import { patchUserSnapshot, publishNavigationArea, removeNavigationArea, recordNavigationTransition, recordUserAction } from "./brainstormSlice";
import { navigationControl } from './navigationControlSnapshot';
import { useNavigationViewport } from './useNavigationViewport';
import MiloVerseDemo from "./MiloVerseDemo";
import DemoTimer from "./components/DemoTimer";
import {
  CreationReferenceDraftProvider,
  useCreationReferenceDraftState,
} from "./CreationReferenceDraftContext";
import type { ShowcaseMode, Template } from "./PromptConstructorMock";
import { EXTRAPOLATED_TEMPLATE_SEEDS, unpackTemplateMeta } from "./templateCatalog";
import PixelChargeNotice from "./PixelChargeNotice";
import AiProviderNotice from "./AiProviderNotice";
import AutoControlPill from "./AutoControlPill";
import { observeCurrentAppSnapshot, startNavigationActionRegistry } from './navigationBrowserControl';

type ShowcaseTemplateSets = Record<ShowcaseMode, Template[]>;
const EMPTY_SHOWCASE_TEMPLATES: Template[] = [];

const createEmptyShowcaseTemplateSets = (): ShowcaseTemplateSets => ({
  shorts: [],
  cinema: [],
  games: [],
});

const getTemplateShowcaseOrders = (template: any): Record<ShowcaseMode, number> => ({
  shorts: Math.max(0, Number(template.useforshowcase) || 0),
  cinema: Math.max(0, Number(template.useforshowcase2) || 0),
  games: Math.max(0, Number(template.useforshowcase3) || 0),
});

const SNAPSHOT_TEXT_LIMIT = 1500;

const getSnapshotPageName = (pathname: string): string => {
  const route = pathname.toLowerCase();
  if (route.includes('magicmirror')) return 'Images';
  if (route.includes('images')) return 'Images';
  if (route.includes('kickit')) return 'Stories';
  if (route.includes('clikit')) return 'Interactions';
  if (route.includes('feeds')) return 'Feeds';
  if (route.includes('pages')) return 'Profile';
  if (route.includes('settings')) return 'Settings';
  if (route === '/') return 'Images';
  if (route === '/search') return 'Search';
  return pathname.replace(/^\/+/, '') || 'Home';
};

const trimSnapshotText = (value: unknown): string => {
  return String(value || '').slice(0, SNAPSHOT_TEXT_LIMIT);
};

const getSnapshotElementLabel = (element: Element): string => {
  const label =
    element.getAttribute('data-ai-label') ||
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    (element.textContent || '').replace(/\s+/g, ' ').trim() ||
    element.tagName.toLowerCase();

  return label.slice(0, 120);
};

function App() {
  const CLIK_URL = import.meta.env.VITE_CLIK_URL;

  const [showcaseTemplates, setShowcaseTemplates] = useState<ShowcaseTemplateSets>(
    createEmptyShowcaseTemplateSets,
  );
  const showcaseTemplatesFingerprintRef = useRef("");
  const showcaseFetchVersionRef = useRef(0);
  const showcaseInitialLoadStartedRef = useRef(false);

  const refreshShowcaseTemplates = useCallback(async (): Promise<void> => {
    const requestVersion = showcaseFetchVersionRef.current + 1;
    showcaseFetchVersionRef.current = requestVersion;

    try {
      const { data } = await axios.get<{ templates?: any[] }>(
        `${CLIK_URL}/get_showcase_templates_prompt`,
        {
          params: { limit: 12 },
          withCredentials: true,
          timeout: 20_000,
        },
      );

      if (requestVersion !== showcaseFetchVersionRef.current) return;

      const nextTemplates = createEmptyShowcaseTemplateSets();
      if (Array.isArray(data?.templates)) {
        data.templates.forEach((template: any) => {
          const requestedMode = String(template.showcase_mode || "shorts") as ShowcaseMode;
          const mode: ShowcaseMode = requestedMode === "cinema" || requestedMode === "games"
            ? requestedMode
            : "shorts";
          const showcaseOrders = getTemplateShowcaseOrders(template);
          const orderFromResponse = Math.max(0, Number(template.showcase_order) || showcaseOrders[mode]);
          showcaseOrders[mode] = orderFromResponse;
          const unpacked = unpackTemplateMeta(
            template.artstyle || template.artStyle,
            template.title || "",
            template.template_prompt || "",
          );

          nextTemplates[mode].push({
            id: String(template.id),
            name: String(template.title || "Untitled template"),
            basePrompt: String(template.template_prompt || ""),
            thumbnailUrl: String(template.template_image || "https://clikbatebucket.s3.us-east-1.amazonaws.com/clik-bg.png"),
            createdAt: new Date(template.time).getTime() || 0,
            isCustom: true,
            userId: Number(template.userid),
            artStyle: String(unpacked.artStyle || template.artstyle || template.artStyle || ""),
            category: String(template.category || unpacked.category || "Shorts & Viral"),
            inLibrary: typeof template.inLibrary === "boolean" ? template.inLibrary : unpacked.inLibrary,
            presetKey: template.presetKey || unpacked.presetKey,
            useForShowcase: orderFromResponse > 0,
            showcaseOrder: orderFromResponse,
            showcaseOrders,
          });
        });
      }

      const nextFingerprint = JSON.stringify(nextTemplates);

      if (nextFingerprint === showcaseTemplatesFingerprintRef.current) return;

      showcaseTemplatesFingerprintRef.current = nextFingerprint;
      setShowcaseTemplates(nextTemplates);
    } catch (error) {
      console.error("Failed to refresh showcase templates:", error);
    }
  }, [CLIK_URL]);

  useEffect(() => {
    if (showcaseInitialLoadStartedRef.current) return;
    showcaseInitialLoadStartedRef.current = true;
    void refreshShowcaseTemplates();
  }, [refreshShowcaseTemplates]);

  const [templateLibrary, setTemplateLibrary] = useState<Template[]>(() => [...EXTRAPOLATED_TEMPLATE_SEEDS]);
  const [hasMoreTemplates, setHasMoreTemplates] = useState(true);
  const templateLibraryRef = useRef<Template[]>([...EXTRAPOLATED_TEMPLATE_SEEDS]);
  const dbTemplatesRef = useRef<Template[]>([]);
  const templateLibraryRevisionRef = useRef(0);
  const templateLibraryLoadedRevisionRef = useRef(-1);
  const templateLibraryFetchVersionRef = useRef(0);
  const templateLibraryRequestRef = useRef<{
    reset: boolean;
    revision: number;
    promise: Promise<void>;
  } | null>(null);

  const activeTemplateUserIdRef = useRef<number>(1);

  const mergeDbWithExtrapolatedTemplates = useCallback((dbTemplates: Template[]): Template[] => {
    const matchedSeedKeys = new Set<string>();
    const seedByKey = new Map<string, Template>();
    const seedByTitle = new Map<string, Template>();

    EXTRAPOLATED_TEMPLATE_SEEDS.forEach((seed) => {
      if (seed.presetKey) seedByKey.set(seed.presetKey.toLowerCase(), seed);
      seedByTitle.set(seed.name.trim().toLowerCase(), seed);
    });

    const normalizedDb = dbTemplates.map((item) => {
      const keyMatch = item.presetKey ? seedByKey.get(item.presetKey.toLowerCase()) : undefined;
      const titleMatch = !keyMatch ? seedByTitle.get(item.name.trim().toLowerCase()) : undefined;
      const matchedSeed = keyMatch || titleMatch;
      if (matchedSeed) {
        matchedSeedKeys.add(matchedSeed.id);
        return {
          ...matchedSeed,
          ...item,
          id: item.id,
          presetKey: item.presetKey || matchedSeed.presetKey,
          category: item.category || matchedSeed.category,
          artStyle: item.artStyle || matchedSeed.artStyle,
          thumbnailUrl: item.thumbnailUrl || matchedSeed.thumbnailUrl || "",
          inLibrary: Boolean(item.inLibrary),
        };
      }
      return {
        ...item,
        inLibrary: Boolean(item.inLibrary),
      };
    });

    const remainingSeeds = EXTRAPOLATED_TEMPLATE_SEEDS.filter(
      (seed) => !matchedSeedKeys.has(seed.id),
    );

    return [...normalizedDb, ...remainingSeeds];
  }, []);

  const fetchTemplateLibraryPage = useCallback(async (
    reset: boolean,
    revision = templateLibraryRevisionRef.current,
  ): Promise<void> => {
    const currentRequest = templateLibraryRequestRef.current;
    if (currentRequest) {
      if (!reset || (currentRequest.reset && currentRequest.revision === revision)) {
        await currentRequest.promise;
        return;
      }
    }

    const requestVersion = templateLibraryFetchVersionRef.current + 1;
    templateLibraryFetchVersionRef.current = requestVersion;
    const limit = 200;
    const offset = reset ? 0 : dbTemplatesRef.current.length;

    const request = (async (): Promise<void> => {
      try {
        const { data } = await axios.get<{ templates?: any[] }>(
          `${CLIK_URL}/get_templates_prompt`,
          {
            params: { limit, offset, userid: activeTemplateUserIdRef.current || 1 },
            withCredentials: true,
            timeout: 20_000,
          },
        );

        if (requestVersion !== templateLibraryFetchVersionRef.current) return;

        const page: Template[] = Array.isArray(data?.templates)
          ? data.templates.map((template: any) => {
            const showcaseOrders = getTemplateShowcaseOrders(template);
            const activeOrder = showcaseOrders.shorts || showcaseOrders.cinema || showcaseOrders.games;
            const unpacked = unpackTemplateMeta(
              template.artstyle || template.artStyle,
              template.title || "",
              template.template_prompt || "",
            );
            return {
              id: String(template.id),
              name: String(template.title || "Untitled template"),
              basePrompt: String(template.template_prompt || ""),
              thumbnailUrl: String(template.template_image || ""),
              coverQuality: template.coverQuality,
              createdAt: new Date(template.time).getTime() || 0,
              isCustom: true,
              userId: Number(template.userid),
              artStyle: String(unpacked.artStyle || template.artstyle || template.artStyle || ""),
              category: String(template.category || unpacked.category || "Shorts & Viral"),
              inLibrary: Boolean(template.inLibrary),
              presetKey: template.presetKey || unpacked.presetKey,
              useForShowcase: activeOrder > 0,
              showcaseOrder: activeOrder,
              showcaseOrders,
            };
          })
          : [];

        const nextDb = reset
          ? page
          : [...dbTemplatesRef.current, ...page.filter((candidate) => (
            !dbTemplatesRef.current.some((current) => current.id === candidate.id)
          ))];

        dbTemplatesRef.current = nextDb;
        const merged = mergeDbWithExtrapolatedTemplates(nextDb);
        templateLibraryRef.current = merged;
        setTemplateLibrary(merged);
        setHasMoreTemplates(page.length === limit);
        if (reset) templateLibraryLoadedRevisionRef.current = revision;
      } catch (error: any) {
        console.error("Failed to fetch template library:", error);
      }
    })();

    templateLibraryRequestRef.current = { reset, revision, promise: request };
    try {
      await request;
    } finally {
      if (requestVersion === templateLibraryFetchVersionRef.current) {
        templateLibraryRequestRef.current = null;
      }
    }
  }, [CLIK_URL, mergeDbWithExtrapolatedTemplates]);

  const ensureTemplateLibraryLoaded = useCallback(async (): Promise<void> => {
    if (templateLibraryLoadedRevisionRef.current === templateLibraryRevisionRef.current) return;
    await fetchTemplateLibraryPage(true, templateLibraryRevisionRef.current);
  }, [fetchTemplateLibraryPage]);

  const loadMoreTemplates = useCallback(async (): Promise<void> => {
    if (templateLibraryLoadedRevisionRef.current !== templateLibraryRevisionRef.current) {
      await fetchTemplateLibraryPage(true, templateLibraryRevisionRef.current);
      return;
    }
    if (!hasMoreTemplates) return;
    await fetchTemplateLibraryPage(false, templateLibraryRevisionRef.current);
  }, [fetchTemplateLibraryPage, hasMoreTemplates]);

  const markTemplateLibraryChanged = useCallback(async (): Promise<void> => {
    templateLibraryRevisionRef.current += 1;
  }, []);

  useEffect(() => () => {
    templateLibraryFetchVersionRef.current += 1;
    templateLibraryRequestRef.current = null;
  }, []);


  const VITE_CLIK_URL = import.meta.env.VITE_CLIK_URL;



  useEffect(() => {
    console.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', VITE_CLIK_URL);

  }, [VITE_CLIK_URL]);



  const dispatch = useDispatch<AppDispatch>();
  useEffect(() => { void dispatch(loadImageModelExampleSets()); }, [dispatch]);


  const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
  const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

  useEffect(() => {
    const nextUid = Number(loggedUser?.id) || 1;
    if (activeTemplateUserIdRef.current !== nextUid) {
      activeTemplateUserIdRef.current = nextUid;
      templateLibraryRevisionRef.current += 1;
      void fetchTemplateLibraryPage(true, templateLibraryRevisionRef.current);
    }
  }, [loggedUser?.id, fetchTemplateLibraryPage]);

  const isBrainstormChatOpen = useSelector((state: RootState) => state.brainstorm.isChatOpen);
  const deckOpen = useSelector((state: RootState) => state.brainstorm.userSnapshot.feeds?.areas['clikb.feeds.deck']?.state.isOpen === true);
  const snapshotPrompt = useSelector((state: RootState) => state.settings.prompt);
  const snapshotArtstyle = useSelector((state: RootState) => state.settings.artstyle);
  const snapshotModel = useSelector((state: RootState) => state.settings.model);
  const snapshotAspectRatio = useSelector((state: RootState) => state.settings.aspectRatio);
  const snapshotPixels = useSelector((state: RootState) => state.settings.pixels);
  const snapshotThemePreference = useSelector((state: RootState) => state.settings.themePreference);
  const snapshotAppColorDark = useSelector((state: RootState) => state.settings.appColorDark);
  const snapshotAppColorLight = useSelector((state: RootState) => state.settings.appColorLight);
  const snapshotAutoControlEnabled = useSelector((state: RootState) => state.settings.autoControlEnabled);
  const snapshotConciergeEnabled = useSelector((state: RootState) => state.settings.conciergeEnabled);
  const snapshotAutoControlVisible = useSelector((state: RootState) => state.settings.autoControlVisible);
  const snapshotAutoControlEntryPoints = useSelector((state: RootState) => state.settings.autoControlEntryPoints);
  const snapshotAutoControlChangedAt = useSelector((state: RootState) => state.settings.autoControlChangedAt);
  const snapshotAutoControlChangedBy = useSelector((state: RootState) => state.settings.autoControlChangedBy);
  const snapshotVideoControlEnabled = useSelector((state: RootState) => state.settings.videoControlEnabled);
  const snapshotConversationModel = useSelector((state: RootState) => state.settings.conversationModel);
  const snapshotShowMenuToggle = useSelector((state: RootState) => state.settings.showmenuToggle);
  const snapshotDeckEnabled = useSelector((state: RootState) => state.settings.deckEnabled !== false);
  const snapshotDeckCleanMode = useSelector((state: RootState) => state.settings.deckCleanMode);
  useEffect(() => startNavigationActionRegistry(), []);

  const [lastActionsCopied, setLastActionsCopied] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(matchMobile ? false : true);
  const [menuCategoriesExpanded, setMenuCategoriesExpanded] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [callFeeds, setcallFeeds] = useState(false);
  const [AllowPing, setAllowPing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [fluxLoaded, setFluxLoaded] = useState(true);
  const [HideBottom, setHideBottom] = useState(false);

  const [isSubmittingKick, setIsSubmittingKick] = useState<boolean>(false); // To handle loading state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false); // To handle loading state minimiseprompt

  const iconTimeoutRefa = useRef<ReturnType<typeof setTimeout> | null>(null);

  const iconTimeoutRefax = useRef<ReturnType<typeof setTimeout> | null>(null);

  interface FeedItem {
    id: number;
    caption: string;
    item1: string;
    time: string;
  }

  const [feeds, setFeeds] = useState<FeedItem[]>([]);
  const [LastId, setLastId] = useState(0);


  const [isFullscreen1, setIsFullscreen1] = useState(false);
  const [isFullscreen2, setIsFullscreen2] = useState(false);
  const [isFullscreen3, setIsFullscreen3] = useState(false);
  const anyFullscreen = Boolean(isFullscreen || isFullscreen1 || isFullscreen2 || isFullscreen3);


  const feedContainerRef = useRef<HTMLDivElement | null>(null);



  const [isCropOpen, setIsCropOpen] = useState(false);

  const [allowUploadText, setallowUploadText] = useState(false);



  const [MenuOpenb, setMenuOpenb] = useState(false);
  const isBMenuVisible = Boolean(!isMenuOpen && MenuOpenb);

  const [Zoom1x, setZoom1x] = useState(false);


  const [showThumb, setShowThumb] = useState(false);


  const [showEmotions, setShowEmotions] = useState(false);



  const [followType, setfollowType] = useState(1);

  const [viewType, setViewType] = useState<number>(0); //  0=following 1=Likes


  // 2) ADDED: Provide a route-based default: we can still default to 2 for "Visualize"
  const [activeIndex, setActiveIndex] = useState(2);

  // 3) ADDED: Access the current location

  const location = useLocation();
  const navigate = useNavigate();
  const navigationRouteRef = useRef(`${location.pathname}${location.search}${location.hash}`);

  useEffect(() => {
    const route = `${location.pathname}${location.search}${location.hash}`;
    const previousRoute = navigationRouteRef.current;
    if (route !== previousRoute) {
      const recentRequest = [...(store.getState().brainstorm.userSnapshot.navigation?.recentTransitions ?? [])].reverse().find(event =>
        event.outcome === 'unknown'
        && event.after.route?.toLowerCase() === route.toLowerCase()
        && Date.now() - event.timestamp < 5000
      );
      dispatch(recordNavigationTransition({
        actor: recentRequest?.actor ?? 'unknown',
        kind: 'route',
        before: { route: previousRoute },
        after: { route },
        outcome: 'succeeded',
        authoritativeSource: 'react-router location',
        ...(recentRequest ? { detail: `Arrival after ${recentRequest.eventId}` } : {}),
      }));
      navigationRouteRef.current = route;
    }
  }, [dispatch, location.pathname, location.search, location.hash]);
  const isCategoryRoute = /^\/(images|clikit|kickit)\/?$/i.test(location.pathname);
  const categoriesExpanded = isCategoryRoute || menuCategoriesExpanded;
  const sidebarViewport = useNavigationViewport('vertical', `${categoriesExpanded}:${isMenuOpen}`);
  const previousSettledSidebarViewport = useRef<typeof sidebarViewport.viewport>(null);
  useEffect(() => {
    if (matchMobile || !isMenuOpen) {
      dispatch(removeNavigationArea({ areaId: 'clikb.navigation.sidebar', source: 'App desktop sidebar' }));
      return;
    }
    dispatch(publishNavigationArea({
      areaId: 'clikb.navigation.sidebar', source: 'App desktop sidebar',
      state: { open: true }, visibleControls: [],
      scrolls: sidebarViewport.viewport ? { sidebar: sidebarViewport.viewport } : undefined,
    }));
  }, [dispatch, isMenuOpen, sidebarViewport.viewport]);
  useEffect(() => () => {
    dispatch(removeNavigationArea({ areaId: 'clikb.navigation.sidebar', source: 'App desktop sidebar' }));
  }, [dispatch]);
  useEffect(() => {
    const current = sidebarViewport.viewport;
    if (matchMobile || !isMenuOpen || !current?.settledAt || current.isScrolling) return;
    const previous = previousSettledSidebarViewport.current;
    if (previous?.settledAt === current.settledAt) return;
    previousSettledSidebarViewport.current = current;
    if (!previous || (previous.region === current.region && previous.visibleIds.join('|') === current.visibleIds.join('|'))) return;
    dispatch(recordNavigationTransition({
      actor: 'unknown', kind: 'area',
      before: { route: location.pathname, areaId: 'clikb.navigation.sidebar', state: { scrollRegion: previous.region, visibleIds: previous.visibleIds.join(',') } },
      after: { route: location.pathname, areaId: 'clikb.navigation.sidebar', state: { scrollRegion: current.region, visibleIds: current.visibleIds.join(',') } },
      outcome: 'succeeded', authoritativeSource: 'App desktop sidebar scroll settlement',
    }));
  }, [dispatch, isMenuOpen, location.pathname, sidebarViewport.viewport]);

  useLayoutEffect(() => {
    setMenuCategoriesExpanded(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuCategoriesExpanded || isCategoryRoute) return;
    const timeout = window.setTimeout(() => {
      setMenuCategoriesExpanded(false);
      dispatch(recordNavigationTransition({
        actor: 'unknown', kind: 'area',
        before: { route: location.pathname, areaId: 'clikb.navigation.menu', state: { categoriesExpanded: true } },
        after: { route: location.pathname, areaId: 'clikb.navigation.menu', state: { categoriesExpanded: false } },
        outcome: 'succeeded', authoritativeSource: 'App categories-expiry timer',
      }));
    }, 15000);
    return () => window.clearTimeout(timeout);
  }, [dispatch, location.pathname, menuCategoriesExpanded, isCategoryRoute]);

  const [Likes, setLikes] = useState(true);

  const [LikesPostid, setLikesPostid] = useState(0);

  // 4) Helper to map route -> menu index
  const getIndexFromPath = (pathname: string) => {
    switch (pathname) {
      case "/MagicMirror":
      case "/":
        return 2; // Canonical Shorts creation landing
      case "/uploadxxjhg":
      case "/uploadxxxxs":
        return 0; // Create
      case "/clikit":
        return 1; // Interactions
      case "/images":
        return 2; // Memes
      case "/kickit":
        return 3; // Stories
      case "/pages":
        return 4; // My Page
      case "/feeds":
      case "/Feeds":
        return 5; // All Feeds
      case "/search":
        return 6; // Search page
      case "/settings":
        return 7; // Settings
      default:
        return -1;
    }
  };

  const creationReferenceDraft = useCreationReferenceDraftState();
  const {
    generatedImages: GeneratedImage,
    setGeneratedImages: setGeneratedImage,
  } = creationReferenceDraft;


  useEffect(() => {
    /*  const { hostname, pathname } = window.location;
      if (hostname === "clikbate.com" && pathname === "/") {
        window.location.replace("https://www.clikbate.com");
  
  
      }*/
  }, []);




  const LOCAL_KEY = "S3fromprompt";

  /**
   * Persists the most-recent S3 URL.  
   * On mount it checks localStorage; if a previous URL exists it
   * calls `startDelete` and then clears the key.
   */

  // keep last value so we don't spam localStorage on every re-render
  const last = useRef<string | null>(null);

  /* 1️⃣ On mount – clean up the URL saved from the *previous* session */
  useEffect(() => {
    const oldUrl = localStorage.getItem(LOCAL_KEY);
    if (oldUrl) {
      ///  startDelete(oldUrl);
      //  localStorage.removeItem(LOCAL_KEY);
    }
  }, []);


  const { userId } = location.state || {};

  // State for user profile info
  const [userProfile, setUserProfile] = useState({
    id: 0,
    profilePic: "",
    profilePicThumb: "",
    billboard: "",
    billboardThumb: "",
    username: "",
    followers: 0,
    following: 0
  });


  // 5) ADDED: Whenever pathname changes, set the activeIndex
  useLayoutEffect(() => {
    // 1️⃣ keep nav state in sync
    setActiveIndex(getIndexFromPath(location.pathname));

    // 2️⃣ recycle the previously-saved S3 object, if any
    const oldUrl = localStorage.getItem(LOCAL_KEY);
    if (oldUrl) {
      ///  startDelete(oldUrl);           // ← delete the one stored last session
      //  localStorage.removeItem(LOCAL_KEY);
    }
  }, [location.pathname, loggedUser]);  // no GeneratedImage ref inside, so no dep



  useEffect(() => {
    if (userId && location.pathname === '/pages') {
      // If there's an existing timeout, clear it



      if (iconTimeoutRefa.current) {
        clearTimeout(iconTimeoutRefa.current);
      }

      // Set a timeout to open the menu after 2 seconds
      iconTimeoutRefa.current = setTimeout(() => {
        //  setIsMenuOpen(true);
      }, delaymenu);


    }

  }, [userId, location.pathname,]);


  const [minimisePrompt, setminimisePrompt] = useState(true);
  const [instantCall, setinstantCall] = useState(false);
  const liveLandingLocation = useRef(location); liveLandingLocation.current = location;

  useInitialAllFeedsComposer(location, Boolean(loggedUser), snapshotDeckEnabled, setminimisePrompt);

  const navigateToCreationLanding = useCallback(() => {
    // Delayed guest/auth resolution must preserve the current Deck and Grid history.
    const current = liveLandingLocation.current;
    if (current.state?.creativeProfileSwitch) return;
    if (current.state?.clikbDeck || current.state?.clikbDeckGrid || current.state?.deckCreate) return;
    // Guest resolution must preserve the initial composer choice, including X.
    if (isAllFeedsLanding(current.pathname, current.search)) return;
    // Public experience links must survive the delayed guest-login resolution.
    // Other login flows still return to the ordinary All Feeds landing route.
    const isExperienceRoute = /^\/experience\/[1-9]\d{0,14}\/?$/i.test(location.pathname);
    setminimisePrompt(true);
    navigate(
      {
        pathname: isExperienceRoute ? location.pathname : '/feeds',
        search: location.search,
        hash: location.hash,
      },
      { replace: true }
    );
  }, [location.hash, location.pathname, location.search, navigate]);

  const [Like, setLike] = useState<boolean>(false);

  const [FullscreenRoute, setFullscreenRoute] = useState<boolean>(!!location.state?.fullscreen);
  const [emotionRoute, setEmotionRoute] = useState<boolean>(!!location.state?.follow);



  const [LikeyRoute, setLikeyRoute] = useState<boolean>(!!location.state?.Likey);

  const [likePostidRoute, setlikePostidRoute] = useState<number>(location.state?.likePostid);




  const [MyPageIdNav, setMyPageIdNav] = useState<number>(0);

  const [feedScrollPosNav, setfeedScrollPosNav] = useState<number>(0);

  const [feedLastIdNav, setfeedLastIdNav] = useState<number>(0);

  const [searchDataNav, setsearchDataNav] = useState<any>('');




  const [lastId, setlastId] = useState<number>(location.state?.routelastIdee);


  const [viewx, setviewx] = useState<string>(`${location.state?.viewx}`);


  const [routeUrl, setRouteUrl] = useState<string>(`${location.pathname}${location.search}${location.hash}`);

  const mobileDocumentScrollRoutes = ["/", "/images", "/kickit", "/clikit", "/feeds", "/pages", "/search", "/homepage", "/home"];
  const useMobileDocumentScroll =
    matchMobile && (
      mobileDocumentScrollRoutes.includes(location.pathname.toLowerCase())
      || /^\/experience\/[1-9]\d{0,14}\/?$/i.test(location.pathname)
    );

  useEffect(() => {
    const promptText = String(snapshotPrompt || '');
    dispatch(patchUserSnapshot({
      autoControl: {
        surfaceId: 'clikb.global.auto_control',
        conciergeEnabled: snapshotConciergeEnabled,
        enabled: snapshotAutoControlEnabled,
        videoEnabled: snapshotVideoControlEnabled,
        visible: snapshotAutoControlVisible,
        visibleEntryPoints: snapshotAutoControlEntryPoints,
        visibleControlIds: [
          ...(snapshotAutoControlEntryPoints.length ? ['clikb.global.auto_control.control.reveal'] : []),
          ...(snapshotAutoControlVisible ? ['clikb.global.auto_control.control.toggle', 'clikb.global.auto_control.control.hide'] : []),
        ],
        changedAt: snapshotAutoControlChangedAt,
        changedBy: snapshotAutoControlChangedBy,
      },
      route: `${location.pathname}${location.search}${location.hash}`,
      pageName: getSnapshotPageName(location.pathname),
      device: matchMobile ? 'mobile' : 'desktop',
      loggedUserName: loggedUser?.username || loggedUser?.name || 'Guest',
      ui: {
        isMenuOpen,
        minimisePrompt,
        isBrainstormChatOpen,
        deckEnabled: snapshotDeckEnabled,
        ...(snapshotDeckEnabled ? { deckCleanMode: snapshotDeckCleanMode } : {}),
        guideShortcuts: 'text-input: voice, model, deck',
      },
      app: {
        prompt: trimSnapshotText(promptText),
        promptLength: promptText.length,
        artstyle: String(snapshotArtstyle || ''),
        model: String(snapshotModel || ''),
        aspectRatio: Number(snapshotAspectRatio) || 1,
        pixels: Number(snapshotPixels) || 0,
        appearance: { themePreference: snapshotThemePreference, effectiveDarkMode: darkModeReducer,
          appColor: darkModeReducer ? snapshotAppColorDark : snapshotAppColorLight,
          appColorDark: snapshotAppColorDark, appColorLight: snapshotAppColorLight },
      },
      navigation: {
        route: `${location.pathname}${location.search}${location.hash}`,
        presentation: !matchMobile && isMenuOpen ? 'desktop_open' : 'compact',
      },
      feeds: { route: location.pathname },
    }));
  }, [
    dispatch,
    location.pathname,
    location.search,
    location.hash,
    loggedUser,
    isMenuOpen,
    minimisePrompt,
    isBrainstormChatOpen,
    snapshotPrompt,
    snapshotArtstyle,
    snapshotModel,
    snapshotAspectRatio,
    snapshotPixels,
    snapshotThemePreference,
    snapshotAppColorDark,
    snapshotAppColorLight,
    snapshotAutoControlEnabled,
    snapshotConciergeEnabled,
    snapshotAutoControlVisible,
    snapshotAutoControlEntryPoints,
    snapshotAutoControlChangedAt,
    snapshotAutoControlChangedBy,
    snapshotVideoControlEnabled,
    snapshotConversationModel,
    snapshotShowMenuToggle,
    snapshotDeckEnabled,
    snapshotDeckCleanMode,
    darkModeReducer,
    MenuOpenb,
    categoriesExpanded,
    HideBottom,
    isFullscreen,
    isFullscreen1,
    isFullscreen2,
    isFullscreen3,
    showEmotions,
    followType,
    isCropOpen,
    userProfile?.id,
    userId,
  ]);

  useEffect(() => {
    const areaId = 'clikb.navigation.menu_backdrop';
    const mobileBackdrop = !HideBottom && matchMobile && isMenuOpen;
    const desktopBackdrop = !HideBottom && !matchMobile && MenuOpenb;
    if (!mobileBackdrop && !desktopBackdrop) {
      dispatch(removeNavigationArea({ areaId, source: 'App.menuBackdrop' }));
      return;
    }
    dispatch(publishNavigationArea({
      areaId,
      source: 'App.menuBackdrop',
      state: { mobile: mobileBackdrop, desktopCompact: desktopBackdrop },
      visibleControls: [navigationControl(areaId, 'close', mobileBackdrop ? 'App.setIsMenuOpen(false)' : 'App.setMenuOpenb(false)')],
    }));
  }, [dispatch, isMenuOpen, MenuOpenb, HideBottom]);

  const handleCopyLastActions = useCallback(async () => {
    // Diagnostic payloads are captured on request, not subscribed to by App.
    // A changing control snapshot must not re-render the entire application.
    const snapshot = observeCurrentAppSnapshot();
    const lastActions = snapshot.lastActions?.length ? snapshot.lastActions : (snapshot.recentActions || []).slice(0, 3);
    const clipboardText = JSON.stringify({
      captureType: 'clikb-guide-detection',
      route: snapshot.route, pageName: snapshot.pageName, device: snapshot.device,
      loggedUserName: snapshot.loggedUserName, ui: snapshot.ui, app: snapshot.app,
      creation: snapshot.creation, navigation: snapshot.navigation, feeds: snapshot.feeds,
      lastAction: snapshot.lastAction,
      lastActions: lastActions.length ? lastActions : (snapshot.lastAction ? [snapshot.lastAction] : []),
      timestamp: snapshot.timestamp,
    }, null, 2);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(clipboardText);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = clipboardText;
      textArea.setAttribute('readonly', 'true');
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }

    setLastActionsCopied(true);
    window.setTimeout(() => setLastActionsCopied(false), 900);
  }, []);

  useEffect(() => {
    const handleSnapshotClick = (event: MouseEvent) => {
      // Browser-bridge .click() is an AI action, not a user gesture. Its
      // provenance is recorded with the navigation transition instead.
      if (!event.isTrusted) return;
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (isBrainstormChatOpen) return;

      if (target.closest([
        '[data-dev-guide-copy="true"]',
        '[data-dev-timer="true"]',
        '[data-ai-snapshot-ignore="true"]',
        '[data-brainstorm-ui="true"]',
        '[data-guide-ui="true"]',
      ].join(','))) return;

      const interactive = target.closest('[data-ai-action], button, [role="button"], a, input, textarea, select');
      if (!interactive) return;

      dispatch(recordUserAction({
        type: interactive.getAttribute('data-ai-action') || interactive.getAttribute('type') || interactive.tagName.toLowerCase(),
        label: getSnapshotElementLabel(interactive),
        target: interactive.getAttribute('data-ai-target') || interactive.getAttribute('id') || undefined,
        tagName: interactive.tagName.toLowerCase(),
        route: `${location.pathname}${location.search}${location.hash}`,
      }));
    };

    document.addEventListener('click', handleSnapshotClick, true);
    return () => document.removeEventListener('click', handleSnapshotClick, true);
  }, [dispatch, isBrainstormChatOpen, location.pathname, location.search, location.hash]);


  // Optional: keep the previous URL too (handy for ESC/back)



  const prevUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // store previous before updating current
    prevUrlRef.current = routeUrl;

    // update current URL + state fields whenever location changes
    setRouteUrl(`${location.pathname}${location.search}${location.hash} `);
    setFullscreenRoute(!!location.state?.fullscreen);
    setEmotionRoute(!!location.state?.follow);
    setlastId(location.state?.routelastIdee);


    setviewx(location.state?.viewx);

    setlikePostidRoute(location.state?.likePostid);

    setLikeyRoute(!!location.state?.Likey)

  }, [location.pathname, feeds, loggedUser]);



  useEffect(() => {

    setLikes(LikeyRoute);
    setLikesPostid(likePostidRoute)

  }, [likePostidRoute, LikeyRoute]);







  useEffect(() => {

    if (emotionRoute) {


      setShowEmotions(true);





    } else {
      setShowEmotions(false);

    }

  }, [location.pathname, feeds, userId, loggedUser, callFeeds]);

  useEffect(() => {

    if (showEmotions) {

    } else {
      setLikes(false);

    }

  }, [showEmotions]);



  useEffect(() => {
    if (!showEmotions && emotionRoute) {



      setEmotionRoute(false);
      setLikeyRoute(false);
      setlikePostidRoute(0);

      setlastId(0);
    }

  }, [showEmotions])





  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.classList.toggle("mobile-document-scroll", useMobileDocumentScroll);
    body.classList.toggle("mobile-document-scroll", useMobileDocumentScroll);

    // Prevent the browser's native pull-to-refresh (scroll-up at the very top
    // reloading the app) on the routes where the document itself is the scroller.
    // Works on iOS Safari too, where CSS overscroll-behavior alone isn't enough.
    let startX = 0;
    let startY = 0;
    let watching = false;
    const getScrollTop = () =>
      window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const isFullscreenTouchTarget = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest('[data-fullscreen-stories="true"]'));
    const getVerticalScroller = (target: EventTarget | null) => {
      let el = target as HTMLElement | null;
      while (el && el !== document.body && el !== document.documentElement) {
        const cs = getComputedStyle(el);
        const canScrollY =
          (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
          el.scrollHeight > el.clientHeight;
        if (canScrollY) return el;
        el = el.parentElement;
      }
      return null;
    };
    const onTouchStart = (e: TouchEvent) => {
      if (isFullscreenTouchTarget(e.target)) { watching = false; return; }
      if (e.touches.length !== 1) { watching = false; return; }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      const verticalScroller = getVerticalScroller(e.target);
      watching = getScrollTop() <= 0 && (!verticalScroller || verticalScroller.scrollTop <= 0);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (isFullscreenTouchTarget(e.target)) return;
      if (!watching || e.touches.length !== 1) return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;
      const verticalScroller = getVerticalScroller(e.target);
      // Block only the downward top-edge pull that triggers browser refresh. model
      // Horizontal swipes and normal upward page scrolling are left untouched.
      if (
        dy > 0 &&
        dy > Math.abs(dx) &&
        getScrollTop() <= 0 &&
        (!verticalScroller || verticalScroller.scrollTop <= 0) &&
        e.cancelable
      ) {
        e.preventDefault();
      }
    };

    if (useMobileDocumentScroll) {
      window.addEventListener("touchstart", onTouchStart, { passive: true });
      window.addEventListener("touchmove", onTouchMove, { passive: false });
    }

    return () => {
      root.classList.remove("mobile-document-scroll");
      body.classList.remove("mobile-document-scroll");
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [useMobileDocumentScroll]);

  // Confirmation popup before any full page reload / tab close.
  // Shows the browser's native "Leave site?" dialog on desktop and Android
  // Chrome. iOS Safari intentionally suppresses this dialog (WebKit limitation),
  // but the pull-to-refresh guard above prevents accidental reloads there.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const minipromptRefx2 = useRef<ReturnType<typeof setTimeout> | null>(null);




  useEffect(() => {
    ///clikt
    // Skip if already minimised to prevent unnecessary re-calls


    minipromptRefx2.current = setTimeout(() => {
      // setminimisePrompt(true);
    }, 3000);



    // Cleanup
    return () => {
      if (minipromptRefx2.current) {
        clearTimeout(minipromptRefx2.current);
      }
    };
  }, []); // still valid








  useLayoutEffect(() => {
    // Timing lives in ./themeSchedule.ts: the early HTML cover and Redux use
    // that SAME function. Change its hours once to keep all three in sync.
    const sync = () => dispatch(syncScheduledTheme(isScheduledDarkMode(new Date().getHours())));
    sync();
    const timer = window.setInterval(sync, 60_000);
    return () => window.clearInterval(timer);
  }, [dispatch]);

  const delaymenu = matchMobile ? 10 : 10;

  useEffect(() => {
    // (Your existing code that triggers initial feed & login)
    const timer = setTimeout(() => {

      ///alert('jj'); loggeduser
      setcallFeeds(true);
      Login();

      if (iconTimeoutRefax.current) {
        clearTimeout(iconTimeoutRefax.current);
      }

      // Set a timeout to open the menu after 2 seconds
      iconTimeoutRefax.current = setTimeout(() => {
        matchMobile ? null : setIsMenuOpen(true);
      }, delaymenu);


      setIsInitialLoad(false);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const dataHold = {
    myId: null,///guest id is hard coded backend
    friendId: "",
  };

  const openMenuPc = useCallback(() => {


    setMenuOpenb(!MenuOpenb);      // reveal the menu

  }, [MenuOpenb]);




  const Login = async () => {
    try {
      const response = await axios.post(
        `${CLIK_URL}/checkIsLogged`,
        { values: dataHold },
        { withCredentials: true }
      );
      const guestUser: any = response.data;

      if (guestUser.payload.id === 1) {

        dispatch(setLogin(true));
      }

      const loggedUser = {
        id: guestUser.payload.id,
        ownerId: guestUser.payload.ownerId || guestUser.payload.id,
        name: `${guestUser.payload.userfirstname} ${guestUser.payload.usersurname}`,
        username: guestUser.payload.username,
        image: guestUser.payload.userimage,
        imageThumb: guestUser.payload.userimage,
        deckEnabled: guestUser.payload.deckEnabled !== false,
        usercolor1: guestUser.payload.usercolor1,
        usercolor2: guestUser.payload.usercolor2,
        usercolortype: guestUser.payload.usercolortype,
        userquote: guestUser.payload.userquote,
        biography: guestUser.payload.biography,
        fans: guestUser.payload.fans,
        favorites: guestUser.payload.favorites,
        userbillboard1: guestUser.payload.userbillboard1,
        userbillboardthumb1: guestUser.payload.userbillboardthumb1,
      };
      dispatch(setLoggedUser(loggedUser));
      console.log("logged user:", guestUser.payload.username);


      navigateToCreationLanding();

      return guestUser;
    } catch (error) {
      console.error("Error during guest login:", error);
      throw new Error("Unable to login as guest");
    }
  };


  const Signup = async (credential: string) => {


    var dataHold = {
      credential,
      friendId: "", ////fill in on history integration
    };

    try {
      const response = await axios.post(`${CLIK_URL}/RegGoogle`,
        { values: dataHold },
        { withCredentials: true }
      );


      const googleUser: any = response.data;




      // Map the payload data to the loggedUser structure

      const loggedUser = {
        id: googleUser.payload.id,
        name: `${googleUser.payload.userfirstname} ${googleUser.payload.usersurname}`,
        username: googleUser.payload.username,
        image: googleUser.payload.userimage,
        imageThumb: googleUser.payload.userimage,
        deckEnabled: googleUser.payload.deckEnabled !== false,
        usercolor1: googleUser.payload.usercolor1,
        usercolor2: googleUser.payload.usercolor2,
        usercolortype: googleUser.payload.usercolortype,
        userquote: googleUser.payload.userquote,
        biography: googleUser.payload.biography,
        fans: googleUser.payload.fans,
        favorites: googleUser.payload.favorites,
        userbillboard1: googleUser.payload.userbillboard1,
        userbillboardthumb1: googleUser.payload.userbillboardthumb1,
      };

      // Dispatch the action to update the loggedUser state
      dispatch(setLoggedUser(loggedUser));

      // Access the user payload if needed
      console.log("logged user:", googleUser.payload.username);

      // First path segment, lowercased ('' for '/')
      navigateToCreationLanding();



      // Optionally return the googleUser data
      return googleUser;

    } catch (error) {
      ///alert("Guest login failed");
      console.error("Error during google signup:", error);
      throw new Error("Unable to signup as google user");
    }
  }



  const [minp, setminp] = useState(false); // Tracks which image is on top

  // Close MenuOpenb if PromptInput is opened
  useEffect(() => {
    if (!minimisePrompt && MenuOpenb) {
      setMenuOpenb(false);
    }
  }, [minimisePrompt, MenuOpenb]);


  const Loginxx = async (credential: string) => {


    var dataHold = {
      credential,
      friendId: "", ////fill in on history integration
    };

    try {
      const response: any = await axios.post(`${CLIK_URL}/checkIsLoggedGoogle`,
        { values: dataHold },
        { withCredentials: true }
      );


      const googleUser: any = response.data;


      dispatch(setLogin(false));


      // Map the payload data to the loggedUser structure

      const loggedUser = {
        id: googleUser.payload.id,
        name: `${googleUser.payload.userfirstname} ${googleUser.payload.usersurname}`,
        username: googleUser.payload.username,
        image: googleUser.payload.userimage,
        imageThumb: googleUser.payload.userimage,
        deckEnabled: googleUser.payload.deckEnabled !== false,
        usercolor1: googleUser.payload.usercolor1,
        usercolor2: googleUser.payload.usercolor2,
        usercolortype: googleUser.payload.usercolortype,
        userquote: googleUser.payload.userquote,
        biography: googleUser.payload.biography,
        fans: googleUser.payload.fans,
        favorites: googleUser.payload.favorites,
        userbillboard1: googleUser.payload.userbillboard1,
        userbillboardthumb1: googleUser.payload.userbillboardthumb1,
      };

      // Dispatch the action to update the loggedUser state
      dispatch(setLoggedUser(loggedUser));

      // Access the user payload if needed
      console.log("logged user:", googleUser.payload.username);



      // First path segment, lowercased ('' for '/')
      navigateToCreationLanding();



      // Optionally return the googleUser data
      return googleUser;

    } catch (error: any) {
      ///alert("Guest login failed");
      console.error("Error during guest login:", error);

      if (error.response?.status === 404) return Signup(credential);

      throw new Error("Unable to login as google user");

    }
  }











  // Handler for successful login
  const handleLoginSuccess = async (credentialResponse: CredentialResponse) => {
    if (credentialResponse.credential) {

      await Loginxx(credentialResponse.credential);


      // Dispatch the user information to Redux store
      ///   dispatch(setUser({
      //  sub: decoded.sub,
      /// name: decoded.name,
      /// email: decoded.email,
      ///   picture: decoded.picture,
      // username: decoded.name.replace(/\s+/g, '').toLowerCase(), // Example username
      /// userbillboardthumb1: decoded.picture, // Example fields
      ///     userbillboard1: decoded.picture,
      ///    image: decoded.picture
      ///  }));

      // Optionally, send the token to your backend for further verification
      // fetch('/api/auth/google', { 
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify({ token: credentialResponse.credential })
      // })
      // .then(response => response.json())
      // .then(data => {
      //     // Handle response from backend
      // })
      // .catch(error => {
      //     console.error('Error:', error);
      // });
    }
  };

  // Handler for login failure
  const handleLoginError = () => {
    console.error('Google Login Failed');
  };









  return (
    <div contentEditable={false}
      className="app-container" style={{
        padding: "0px",
      }}>
      <CreationReferenceDraftProvider value={creationReferenceDraft}>
        <ChatProvider minimisePrompt={minimisePrompt} onMinimisePrompt={() => setminimisePrompt(true)}>
        <BrainstormSessionProvider clikUrl={CLIK_URL}>
        <DeckRuntimeProvider minimisePrompt={minimisePrompt} setminimisePrompt={setminimisePrompt}
          clikUrl={CLIK_URL} isMenuOpen={isMenuOpen} MenuOpenb={MenuOpenb} matchMobile={matchMobile}>

          <AutoControlPill hidden={!minimisePrompt || deckOpen} isMenuOpen={isMenuOpen} MenuOpenb={MenuOpenb} />

          {import.meta.env.DEV ? <DemoTimer /> : null}
          {import.meta.env.DEV ? (
            <Box
              component="button"
              type="button"
              aria-label="Copy guide detection"
              title={lastActionsCopied ? "Copied guide detection" : "Copy guide detection"}
              data-dev-guide-copy="true"
              onClick={handleCopyLastActions}
              sx={{
                position: "fixed",
                left: { xs: 48, sm: 52 },
                bottom: { xs: 84, sm: 22 },
                width: 23,
                height: 23,
                minWidth: 23,
                p: 0,
                border: "1px solid rgba(0,0,0,0.16)",
                borderRadius: "50%",
                bgcolor: lastActionsCopied ? "#00c853" : "#ffffff",
                color: "#111111",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                appearance: "none",
                WebkitAppearance: "none",
                WebkitTapHighlightColor: "transparent",
                boxShadow: lastActionsCopied ? "0 0 10px #00c853" : "0 0 9px rgba(0,0,0,0.18)",
                transition: "transform 150ms ease, box-shadow 150ms ease, background-color 150ms ease",
                zIndex: 2147482991,
                "&:hover": {
                  transform: "translateY(-2px) scale(1.04)",
                  boxShadow: lastActionsCopied ? "0 0 12px #00c853" : "0 0 12px rgba(0,0,0,0.24)",
                },
                "&:active": { transform: "scale(0.96)" },
                "&:focus-visible": {
                  outline: "3px solid #00c853",
                  outlineOffset: 3,
                },
              }}
            >
              <ContentCopyIcon sx={{ fontSize: 13 }} />
            </Box>
          ) : null}

          <style dangerouslySetInnerHTML={{
            __html: `
        @media (hover: hover) and (pointer: fine) {
          /* WebKit browsers (Chrome, Safari, Edge, Opera) */
          ::-webkit-scrollbar {
            width: 8px !important;
            height: 8px !important;
          }
          ::-webkit-scrollbar-track {
            background: transparent !important;
          }
          ::-webkit-scrollbar-thumb {
            background: ${darkModeReducer ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.12)"} !important;
            backdrop-filter: blur(4px) !important;
            -webkit-backdrop-filter: blur(4px) !important;
            border: 2px solid transparent !important;
            border-radius: 8px !important;
            background-clip: padding-box !important;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: ${darkModeReducer ? "rgba(255, 255, 255, 0.24)" : "rgba(0, 0, 0, 0.24)"} !important;
            background-clip: padding-box !important;
          }
          
          /* Firefox styling */
          * {
            scrollbar-width: thin !important;
            scrollbar-color: ${darkModeReducer ? "rgba(255, 255, 255, 0.15) transparent" : "rgba(0, 0, 0, 0.15) transparent"} !important;
          }
        }
      ` }} />




          {
            isMenuOpen && !matchMobile ? null :

              HideBottom ? null :


                <>
                  {isBMenuVisible ?
                    <Box
                      data-ai-action="clikb.navigation.menu_backdrop.action.close"


                      onClick={() => {
                        setMenuOpenb(false);
                        if (anyFullscreen || deckOpen) {
                          setIsMenuOpen(false);
                        }
                        dispatch(recordNavigationTransition({
                          actor: 'manual', kind: 'area',
                          before: { route: location.pathname, areaId: 'clikb.navigation.menu_backdrop', state: { menuOverlayOpen: true } },
                          after: { route: location.pathname, areaId: 'clikb.navigation.bottom_menu', controlId: 'clikb.navigation.menu_backdrop.control.close', state: { menuOverlayOpen: false } },
                          outcome: 'succeeded', authoritativeSource: 'App desktop menu-backdrop handler',
                        }));
                      }}

                      sx={{
                        height: '100dvh', width: '100vw', position: 'fixed', top: 0, left: 0,
                        backgroundColor: 'transparent', backdropFilter: 'none', zIndex: 10015,
                        cursor: 'default'
                      }} >



                    </Box > : null

                  }


                  {isMenuOpen && matchMobile ?
                    <Box
                      data-ai-action="clikb.navigation.menu_backdrop.action.close"


                      onClick={() => {
                        setIsMenuOpen(false)
                        dispatch(recordNavigationTransition({
                          actor: 'manual', kind: 'area',
                          before: { route: location.pathname, areaId: 'clikb.navigation.menu_backdrop', state: { menuOverlayOpen: true } },
                          after: { route: location.pathname, areaId: 'clikb.navigation.bottom_menu', controlId: 'clikb.navigation.menu_backdrop.control.close', state: { menuOverlayOpen: false } },
                          outcome: 'succeeded', authoritativeSource: 'App mobile menu-backdrop handler',
                        }));
                      }}

                      sx={{
                        height: '100vh', width: '100%', position: 'fixed', top: '0vh',
                        backgroundColor: 'transparent', zIndex: '1',
                        cursor: 'pointer'
                      }} >



                    </Box > : null

                  }

                  {minimisePrompt ?
                    <BottomMenu
                      openMenuPc={openMenuPc}
                      isMenuOpen={isMenuOpen}
                      MenuOpenb={MenuOpenb}
                      setMenuOpenb={setMenuOpenb}          // ← added
                      setIsMenuOpen={setIsMenuOpen}
                      setminimisePrompt={setminimisePrompt} // ← added
                      type={0}
                      isFullscreen={isFullscreen}
                      feedContainerRef={feedContainerRef}
                      activeIndex={activeIndex}
                      setActiveIndex={setActiveIndex}
                      LastId={LastId}
                      setFeeds={setFeeds}

                    /> : null}


                </>
          }
          {/* Left Menu darkModeReducer */}
          <div
            ref={sidebarViewport.ref as React.Ref<HTMLDivElement>}
            data-ai-scroll="clikb.navigation.sidebar:sidebar"
            onScroll={sidebarViewport.onScroll}
            className={`${darkModeReducer ? "menudark" : "menu"} ${isMenuOpen ? "menu-open" : "menu-closed"
              }`}
            style={{
              // CARET_TEST_DISABLED app-menu: caretColor: 'transparent !important',
              outline: 'none',
              position: matchMobile ? 'fixed' : 'static',
              top: matchMobile ? '0vh' : '0vh',
              zIndex: matchMobile ? deckOpen ? 1201 : 2 : undefined,
              overflow: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              backgroundColor: matchMobile ? 'rgb(255,255,255,0)' : ''


            }}

          >



            {

              matchMobile ? null :

                <div data-navigation-scroll-id="clikb.profile_header">
                <ProfileInfo
                  snapshotPlacement="sidebar"
                  setShowEmotions={setShowEmotions}
                  setfollowType={setfollowType}

                  isFullscreen1={isFullscreen1}
                  isFullscreen2={isFullscreen2}
                  isFullscreen3={isFullscreen3}



                  isFullscreen={isFullscreen}
                  setIsFullscreen={setIsFullscreen}

                  setShowThumb={setShowThumb}
                  showThumb={showThumb}
                  userProfile={userProfile}
                  setUserProfile={setUserProfile}
                  minimise={false}
                  setminimise={() => {

                  }}
                  isCropOpen={isCropOpen}
                  setIsCropOpen={setIsCropOpen}
                  feeds={feeds}
                  loggedUser={loggedUser} isMenuOpen={isMenuOpen} handleLoginSuccess={handleLoginSuccess} handleLoginError={handleLoginError}
                  MenuOpenb={MenuOpenb}
                  setMenuOpenb={setMenuOpenb}
                />
                </div>
            }


            {/* 
          Pass activeIndex & setActiveIndex down font 
          so MenuSlider can highlight the right item 
        */}
            <MenuSlider
              isMenuOpen={isMenuOpen}
              MenuOpenb={MenuOpenb}
              categoriesExpanded={categoriesExpanded}
              onExpandCategories={() => setMenuCategoriesExpanded(true)}
              setShowThumb={setShowThumb}
              showThumb={showThumb}

              setminimisePrompt={setminimisePrompt}  // ← add this
              type={0}
              isFullscreen={isFullscreen}
              setIsFullscreen={setIsFullscreen}
              feedContainerRef={feedContainerRef}
              activeIndex={activeIndex}
              setActiveIndex={setActiveIndex}
              LastId={LastId}       // (can remove; unused)
              setFeeds={setFeeds}   // (can remove; unused)
              setIsMenuOpen={setIsMenuOpen}
              setMenuOpenb={setMenuOpenb}
            />

          </div>

          {/* Right Content contentEditable={true} */}
          <div
            className={`${darkModeReducer ? "contentdark" : "content"} ${isMenuOpen ? "content-with-menu" : "content-full"
              }`}
            style={{
              padding: "0px", // CARET_TEST_DISABLED app-content: caretColor: 'transparent !important',
              outline: 'none',
              position: !minimisePrompt ? 'relative' : undefined,
              zIndex: !minimisePrompt ? 999 : undefined
            }}
          >



            {







              isBMenuVisible ?
                    /* ─────────────  MENU VISIBLE (ON TOP OF FULLSCREEN & DECK) ───────────── */
                    <div
                      className="b-menu-drawer"
                      style={{
                        position: 'fixed',
                        top: '0vh',
                        left: '0vw',
                        width: matchMobile ? 'min(75vw, 300px)' : '18vw',
                        minWidth: matchMobile ? '240px' : '220px',
                        maxWidth: matchMobile ? '320px' : '360px',
                        height: '100dvh',
                        zIndex: 10020,
                        overflowX: 'hidden',
                        overflowY: 'auto',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        backgroundColor: darkModeReducer ? '#181a1e' : '#ffffff',
                        boxShadow: darkModeReducer ? '4px 0 24px rgba(0,0,0,0.5)' : '4px 0 24px rgba(0,0,0,0.12)',
                        backdropFilter: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                      }}
                    >
                      <MenuSlider
                        isMenuOpen={isMenuOpen}
                        MenuOpenb={MenuOpenb}
                        categoriesExpanded={categoriesExpanded}
                        onExpandCategories={() => setMenuCategoriesExpanded(true)}
                        setShowThumb={setShowThumb}
                        showThumb={showThumb}
                        setminimisePrompt={setminimisePrompt}  // ← add this
                        type={1}
                        isFullscreen={isFullscreen}
                        setIsFullscreen={setIsFullscreen}
                        feedContainerRef={feedContainerRef}
                        activeIndex={activeIndex}
                        setActiveIndex={setActiveIndex}
                        LastId={LastId}       // (can remove; unused)
                        setFeeds={setFeeds}   // (can remove; unused)
                        setIsMenuOpen={setIsMenuOpen}
                        setMenuOpenb={setMenuOpenb}
                      />
                    </div>
                    :

                    null



            }


            <Routes>

              <Route
                path="/pages"
                element={
                  <Mypage
                    setsearchDataNav={setsearchDataNav}
                    setMyPageIdNav={setMyPageIdNav}
                    setfeedLastIdNav={setfeedLastIdNav}
                    setfeedScrollPosNav={setfeedScrollPosNav}


                    setShowEmotions={setShowEmotions}
                    setLikesPostid={setLikesPostid}
                    setLikes={setLikes}



                    setfollowType={setfollowType}

                    showEmotions={showEmotions}
                    setHideBottom={setHideBottom}
                    isCropOpen={isCropOpen}
                    setIsCropOpen={setIsCropOpen}
                    loggedUser={loggedUser}

                    handleLoginSuccess={handleLoginSuccess} handleLoginError={handleLoginError}

                    MenuOpenb={MenuOpenb}
                    setMenuOpenb={setMenuOpenb}
                    minimisePrompt={minimisePrompt}
                    setminimisePrompt={setminimisePrompt}
                    setIsMenuOpen={setIsMenuOpen}
                    setIsFullscreen={setIsFullscreen}
                    isFullscreen={isFullscreen}
                    LastId={LastId}
                    setLastId={setLastId}
                    callFeeds={callFeeds}
                    isMenuOpen={isMenuOpen}
                    setcallFeeds={setcallFeeds}
                    setAllowPing={setAllowPing}
                    AllowPing={AllowPing}
                    feedContainerRef={feedContainerRef}
                    feeds={feeds}
                    setFeeds={setFeeds}
                  />
                }
              />

              <Route
                path="/settings"
                element={
                  <Settings
                    callFeeds={callFeeds}
                    isMenuOpen={isMenuOpen}
                    setcallFeeds={setcallFeeds}
                    setAllowPing={setAllowPing}
                    AllowPing={AllowPing}

                  />
                }
              />


              <Route
                path="/images"
                element={
                  <Images
                    setsearchDataNav={setsearchDataNav}
                    setMyPageIdNav={setMyPageIdNav}
                    setfeedLastIdNav={setfeedLastIdNav}
                    setfeedScrollPosNav={setfeedScrollPosNav}


                    setShowEmotions={setShowEmotions}
                    setLikesPostid={setLikesPostid}
                    setLikes={setLikes}


                    showEmotions={showEmotions}
                    GeneratedImage={GeneratedImage}
                    setGeneratedImage={setGeneratedImage}


                    setHideBottom={setHideBottom}
                    allowUploadText={allowUploadText}
                    setallowUploadText={setallowUploadText}

                    MenuOpenb={MenuOpenb}
                    setMenuOpenb={setMenuOpenb}
                    minimisePrompt={minimisePrompt}
                    setminimisePrompt={setminimisePrompt}
                    setIsMenuOpen={setIsMenuOpen}
                    setFluxLoaded={setFluxLoaded}
                    fluxLoaded={fluxLoaded}
                    isSubmittingKick={isSubmittingKick}
                    setIsSubmittingKick={setIsSubmittingKick}

                    setIsSubmitting={setIsSubmitting}
                    isSubmitting={isSubmitting}



                    setIsFullscreen={setIsFullscreen}
                    isFullscreen={isFullscreen}
                    LastId={LastId}
                    setLastId={setLastId}
                    callFeeds={callFeeds}
                    isMenuOpen={isMenuOpen}
                    setcallFeeds={setcallFeeds}
                    setAllowPing={setAllowPing}
                    AllowPing={AllowPing}
                    feedContainerRef={feedContainerRef}
                    feeds={feeds}
                    setFeeds={setFeeds}
                    instantCall={instantCall}
                    setinstantCall={setinstantCall}
                    handleLoginSuccess={handleLoginSuccess}
                    handleLoginError={handleLoginError}
                    showcaseTemplates={showcaseTemplates.shorts}
                    onShowcaseTemplatesChanged={import.meta.env.DEV ? refreshShowcaseTemplates : undefined}
                    templateLibrary={templateLibrary}
                    hasMoreTemplates={hasMoreTemplates}
                    ensureTemplateLibraryLoaded={ensureTemplateLibraryLoaded}
                    loadMoreTemplates={loadMoreTemplates}
                    onTemplateLibraryChanged={markTemplateLibraryChanged}
                  />
                }
              />

              <Route
                path="/audio"
                element={
                  <Audio
                    setIsMenuOpen={setIsMenuOpen}
                    setIsFullscreen={setIsFullscreen}
                    isFullscreen={isFullscreen}
                    LastId={LastId}
                    setLastId={setLastId}
                    callFeeds={callFeeds}
                    isMenuOpen={isMenuOpen}
                    setcallFeeds={setcallFeeds}
                    setAllowPing={setAllowPing}
                    AllowPing={AllowPing}
                    feedContainerRef={feedContainerRef}
                    feeds={feeds}
                    setFeeds={setFeeds}
                    showcaseTemplates={EMPTY_SHOWCASE_TEMPLATES}
                    onShowcaseTemplatesChanged={import.meta.env.DEV ? refreshShowcaseTemplates : undefined}
                    templateLibrary={templateLibrary}
                    hasMoreTemplates={hasMoreTemplates}
                    ensureTemplateLibraryLoaded={ensureTemplateLibraryLoaded}
                    loadMoreTemplates={loadMoreTemplates}
                    onTemplateLibraryChanged={markTemplateLibraryChanged}
                  />
                }
              />


              <Route
                path="/clikit"
                element={
                  <Clikit
                    setsearchDataNav={setsearchDataNav}
                    setMyPageIdNav={setMyPageIdNav}
                    setfeedLastIdNav={setfeedLastIdNav}
                    setfeedScrollPosNav={setfeedScrollPosNav}


                    setShowEmotions={setShowEmotions}
                    setLikesPostid={setLikesPostid}
                    setLikes={setLikes}


                    showEmotions={showEmotions}
                    GeneratedImage={GeneratedImage}
                    setGeneratedImage={setGeneratedImage}


                    setHideBottom={setHideBottom}
                    allowUploadText={allowUploadText}
                    setallowUploadText={setallowUploadText}

                    MenuOpenb={MenuOpenb}
                    setMenuOpenb={setMenuOpenb}
                    minimisePrompt={minimisePrompt}
                    setminimisePrompt={setminimisePrompt}
                    setIsMenuOpen={setIsMenuOpen}
                    setFluxLoaded={setFluxLoaded}
                    fluxLoaded={fluxLoaded}
                    isSubmittingKick={isSubmittingKick}
                    setIsSubmittingKick={setIsSubmittingKick}

                    setIsSubmitting={setIsSubmitting}
                    isSubmitting={isSubmitting}



                    setIsFullscreen={setIsFullscreen}
                    isFullscreen={isFullscreen}
                    LastId={LastId}
                    setLastId={setLastId}
                    callFeeds={callFeeds}
                    isMenuOpen={isMenuOpen}
                    setcallFeeds={setcallFeeds}
                    setAllowPing={setAllowPing}
                    AllowPing={AllowPing}
                    feedContainerRef={feedContainerRef}
                    feeds={feeds}
                    setFeeds={setFeeds}
                    handleLoginSuccess={handleLoginSuccess}
                    handleLoginError={handleLoginError}
                    showcaseTemplates={showcaseTemplates.games}
                    onShowcaseTemplatesChanged={import.meta.env.DEV ? refreshShowcaseTemplates : undefined}
                    templateLibrary={templateLibrary}
                    hasMoreTemplates={hasMoreTemplates}
                    ensureTemplateLibraryLoaded={ensureTemplateLibraryLoaded}
                    loadMoreTemplates={loadMoreTemplates}
                    onTemplateLibraryChanged={markTemplateLibraryChanged}

                  />
                }
              />




              <Route
                path="/privacy-policy"
                element={
                  <PrivacyPolicy />
                }
              />



              {["/feeds", "/experience/:postId"].map((feedPath) => (
              <Route
                key={feedPath}
                path={feedPath}
                element={
                  <Feeds
                    handleLoginSuccess={handleLoginSuccess}
                    handleLoginError={handleLoginError}
                    setsearchDataNav={setsearchDataNav}
                    setMyPageIdNav={setMyPageIdNav}
                    setfeedLastIdNav={setfeedLastIdNav}
                    setfeedScrollPosNav={setfeedScrollPosNav}


                    setShowEmotions={setShowEmotions}
                    setLikesPostid={setLikesPostid}
                    setLikes={setLikes}


                    showEmotions={showEmotions}
                    GeneratedImage={GeneratedImage}
                    setGeneratedImage={setGeneratedImage}


                    setHideBottom={setHideBottom}
                    allowUploadText={allowUploadText}
                    setallowUploadText={setallowUploadText}
                    MenuOpenb={MenuOpenb}
                    setMenuOpenb={setMenuOpenb}
                    minimisePrompt={minimisePrompt}
                    setminimisePrompt={setminimisePrompt}
                    setIsMenuOpen={setIsMenuOpen}
                    setFluxLoaded={setFluxLoaded}
                    fluxLoaded={fluxLoaded}
                    isSubmittingKick={isSubmittingKick}
                    setIsSubmittingKick={setIsSubmittingKick}

                    setIsSubmitting={setIsSubmitting}
                    isSubmitting={isSubmitting}

                    setIsFullscreen={setIsFullscreen}
                    isFullscreen={isFullscreen}
                    LastId={LastId}
                    setLastId={setLastId}
                    callFeeds={callFeeds}
                    isMenuOpen={isMenuOpen}
                    setcallFeeds={setcallFeeds}
                    setAllowPing={setAllowPing}
                    AllowPing={AllowPing}
                    feedContainerRef={feedContainerRef}
                    feeds={feeds}
                    setFeeds={setFeeds}
                    showcaseTemplates={EMPTY_SHOWCASE_TEMPLATES}
                    onShowcaseTemplatesChanged={import.meta.env.DEV ? refreshShowcaseTemplates : undefined}
                    templateLibrary={templateLibrary}
                    hasMoreTemplates={hasMoreTemplates}
                    ensureTemplateLibraryLoaded={ensureTemplateLibraryLoaded}
                    loadMoreTemplates={loadMoreTemplates}
                    onTemplateLibraryChanged={markTemplateLibraryChanged}
                  />
                }
              />
              ))}

              <Route
                path="/kickit"
                element={
                  <Kickit
                    setsearchDataNav={setsearchDataNav}
                    setMyPageIdNav={setMyPageIdNav}
                    setfeedLastIdNav={setfeedLastIdNav}
                    setfeedScrollPosNav={setfeedScrollPosNav}


                    setShowEmotions={setShowEmotions}
                    setLikesPostid={setLikesPostid}
                    setLikes={setLikes}

                    showEmotions={showEmotions}
                    GeneratedImage={GeneratedImage}
                    setGeneratedImage={setGeneratedImage}


                    setHideBottom={setHideBottom}
                    allowUploadText={allowUploadText}
                    setallowUploadText={setallowUploadText}
                    MenuOpenb={MenuOpenb}
                    setMenuOpenb={setMenuOpenb}
                    minimisePrompt={minimisePrompt}
                    setminimisePrompt={setminimisePrompt}
                    setIsMenuOpen={setIsMenuOpen}
                    setFluxLoaded={setFluxLoaded}
                    fluxLoaded={fluxLoaded}
                    isSubmittingKick={isSubmittingKick}
                    setIsSubmittingKick={setIsSubmittingKick}

                    setIsSubmitting={setIsSubmitting}
                    isSubmitting={isSubmitting}

                    setIsFullscreen={setIsFullscreen}
                    isFullscreen={isFullscreen}
                    LastId={LastId}
                    setLastId={setLastId}
                    callFeeds={callFeeds}
                    isMenuOpen={isMenuOpen}
                    setcallFeeds={setcallFeeds}
                    setAllowPing={setAllowPing}
                    AllowPing={AllowPing}
                    feedContainerRef={feedContainerRef}
                    feeds={feeds}
                    setFeeds={setFeeds}
                    instantCall={instantCall}
                    setinstantCall={setinstantCall}
                    handleLoginSuccess={handleLoginSuccess}
                    handleLoginError={handleLoginError}
                    showcaseTemplates={showcaseTemplates.cinema}
                    onShowcaseTemplatesChanged={import.meta.env.DEV ? refreshShowcaseTemplates : undefined}
                    templateLibrary={templateLibrary}
                    hasMoreTemplates={hasMoreTemplates}
                    ensureTemplateLibraryLoaded={ensureTemplateLibraryLoaded}
                    loadMoreTemplates={loadMoreTemplates}
                    onTemplateLibraryChanged={markTemplateLibraryChanged}
                  />
                }
              />


              <Route
                path="/search"
                element={
                  <Homepage

                    setsearchDataNav={setsearchDataNav}
                    setMyPageIdNav={setMyPageIdNav}
                    setfeedLastIdNav={setfeedLastIdNav}
                    setfeedScrollPosNav={setfeedScrollPosNav}


                    setShowEmotions={setShowEmotions}
                    setLikesPostid={setLikesPostid}
                    setLikes={setLikes}


                    showEmotions={showEmotions}
                    setShowThumb={setShowThumb}
                    setHideBottom={setHideBottom}
                    allowUploadText={allowUploadText}
                    setallowUploadText={setallowUploadText}
                    MenuOpenb={MenuOpenb}
                    setMenuOpenb={setMenuOpenb}
                    minimisePrompt={minimisePrompt}
                    setminimisePrompt={setminimisePrompt}
                    setIsMenuOpen={setIsMenuOpen}
                    setFluxLoaded={setFluxLoaded}
                    fluxLoaded={fluxLoaded}
                    isSubmittingKick={isSubmittingKick}
                    setIsSubmittingKick={setIsSubmittingKick}
                    setIsSubmitting={setIsSubmitting}
                    isSubmitting={isSubmitting}
                    setIsFullscreen={setIsFullscreen}

                    setIsFullscreen1={setIsFullscreen1}
                    setIsFullscreen2={setIsFullscreen2}
                    setIsFullscreen3={setIsFullscreen3}

                    isFullscreen1={isFullscreen1}
                    isFullscreen2={isFullscreen2}
                    isFullscreen3={isFullscreen3}



                    isFullscreen={isFullscreen}
                    LastId={LastId}
                    setLastId={setLastId}
                    callFeeds={callFeeds}
                    isMenuOpen={isMenuOpen}
                    setcallFeeds={setcallFeeds}
                    setAllowPing={setAllowPing}
                    AllowPing={AllowPing}
                    feedContainerRef={feedContainerRef}
                    feeds={feeds}
                    setFeeds={setFeeds}

                  />
                }
              />

              <Route
                path="/"
                element={
                  <Navigate
                    to={{ pathname: "/feeds", search: location.search, hash: location.hash }}
                    replace
                  />
                }
              />
              <Route
                path="/MagicMirror"
                element={
                  <Navigate
                    to={{ pathname: "/images", search: location.search, hash: location.hash }}
                    replace
                  />
                }
              />
              <Route path="/miloverse" element={<MiloVerseDemo />} />
            </Routes>




            {showEmotions && (


              <EmotionsGate

                setIsFullscreen1={setIsFullscreen1}
                setIsFullscreen2={setIsFullscreen2}
                setIsFullscreen3={setIsFullscreen3}

                isFullscreen1={isFullscreen1}
                isFullscreen2={isFullscreen2}
                isFullscreen3={isFullscreen3}



                searchDataNav={searchDataNav}
                MyPageIdNav={MyPageIdNav}
                feedLastIdNav={feedLastIdNav}
                feedScrollPosNav={feedScrollPosNav}



                Likes={Likes}
                Postid={LikesPostid}
                setEmotionRoute={setEmotionRoute}
                emotionRoute={emotionRoute}
                viewx={viewx}
                setlastid={setlastId}
                lastId={lastId}
                isFullscreen={isFullscreen}
                setIsFullscreen={setIsFullscreen}
                initiallastidfan={0}
                showEmotions={showEmotions}
                onClose={() => {

                  setShowEmotions(false)
                }}

                ownerId={Likes ? loggedUser ? loggedUser.id : null : userId ? userId : loggedUser ? loggedUser.id : null}
                type={followType}                 // 0 followers / 1 following (initial)
                lastIdFromArray={0}
                // e.g. CLIK_URL
                limit={50}
                offset={0}
                onViewChange={(v) => setViewType(v === "following" ? 1 : 0)}
              />




            )}



            {
              matchMobile ? null : (
                <MenuToggle
                  isCropOpen={isCropOpen}
                  minimisePrompt={minimisePrompt}
                  setminimisePrompt={setminimisePrompt}
                  setIsFullscreen={setIsFullscreen}
                  isFullscreen={anyFullscreen}
                  loggedUser={loggedUser}
                  isMenuOpen={isMenuOpen}
                  setIsMenuOpen={setIsMenuOpen}
                  isInitialLoad={isInitialLoad}
                  MenuOpenb={MenuOpenb}
                  setMenuOpenb={setMenuOpenb}
                  deckOpen={deckOpen}
                />
              )
            }
            <LeftEdgeMenuPeek
              isMenuOpen={isMenuOpen}
              setIsMenuOpen={setIsMenuOpen}
              MenuOpenb={MenuOpenb}
              setMenuOpenb={setMenuOpenb}
              isFullscreen={anyFullscreen}
            />







          </div>






          {
            HideBottom ? null :
              <div style={{


                textAlign: 'center',
                padding: '1rem',
                position: 'fixed',
                bottom: matchMobile ? HideBottom ? '0vh' : '7vh' : '7vh',
                display: matchMobile ? 'block' : isMenuOpen ? 'none' : 'block',
                marginTop: 'auto',

              }}>

                <a href="https://www.clikb.com/privacy-policy"
                  style={{
                    textDecoration: 'none',
                    color: darkModeReducer ? '#eee' : '#111',
                    fontSize: matchMobile ? '0.6rem' : '0.67rem',
                  }}>

                  © {new Date().getFullYear()} Clikb™
                </a>

              </div>
          }




          {
            showThumb ?

              <div style={{
                position: 'fixed', width: '100%', top: matchMobile ? '0vh' : '0vh', margin: 'auto',
                textAlign: 'center',
                padding: '0px',
                zIndex: 10000
              }}>


                <ThumbnailYoutube
                  showThumb={showThumb}
                  imagex={loggedUser ? loggedUser.image : ''}
                  setShowThumb={setShowThumb}
                  userProfile={userProfile}
                  minimisePrompt={minimisePrompt}
                  isMenuOpen={isMenuOpen}

                />
              </div>

              : null
          }


          {
            HideBottom || !isMenuOpen || !minimisePrompt ? null : <div style={{ position: 'absolute', bottom: matchMobile ? '-2vh' : '-1vh', textAlign: 'left', }}>

              <Footer />
            </div>
          }







        </DeckRuntimeProvider>
        </BrainstormSessionProvider>
        <PixelChargeNotice />
        <AiProviderNotice />
        </ChatProvider>
      </CreationReferenceDraftProvider>
    </div >
  );
}

export default App;
