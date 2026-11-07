import { reindexPostMedia } from './postMediaState';
import { cachedFeedCollection, isDeletedFeedPost, rememberFeedCollection, requestFeedCollection } from './feedCollectionCache';
import React, {
  FC,
  memo,
  useEffect,
  useState,
  useRef,
  useCallback,
  useLayoutEffect
} from "react";
import axios from "axios";
import {
  Box,
  Typography,
  CircularProgress,
  Card,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "./store";
import { setShowmenuToggle, } from "./settingsSlice";
import { matchMobile } from "./DetectDevice";
import "./theme.css";
import StoryAutoScroller from "./StoryAutoScroller";
import FullScreenStories from "./FullScreenStories";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Footer from "./Footer";
import ProfileInfo from "./ProfileInfo";

import { useLocation } from 'react-router-dom';

import FeedLayout from './FeedLayout';


import FeedLayoutHorizontal from './FeedLayoutHorizontal';
import { publishFeedsArea, removeFeedsArea } from './brainstormSlice';
import { appendUnseenFeedPosts } from './feedsPagination';
import { searchFeedMode, searchFeedCursor } from './feedSearch';
import { feedDisplayName, feedInstanceId, feedMode, type FeedAreaId } from './feedsControlSnapshot';
import DeckOverlay from './DeckOverlay';
import { cachedDeckFeeds, deckRouteTransition, useDeckNavigation, type DeckCategory } from './useDeckNavigation';
import { useDeckRuntime } from './DeckRuntimeContext';
import { type DeckSearchSection } from './deckControlSnapshot';




const CLIK_URL = import.meta.env.VITE_CLIK_URL;

interface FeedItem {
  id: number;
  caption: string;
  username: string;
  profile_image: string;
  profile_image_thumb?: string;
  sender: number;

  // Existing fields
  x1: string;
  xt1?: string;
  x2?: string;
  xt2?: string;
  x3?: string;
  xt3?: string;
  x4?: string;
  xt4?: string;
  x5?: string;
  xt5?: string;
  x6?: string;
  xt6?: string;
  x7?: string;
  xt7?: string;
  x8?: string;
  xt8?: string;
  x9?: string;
  xt9?: string;
  item1?: string; // For type 1 items

  // New fields
  captionSummary?: string;
  captionAudio?: string;
  xa1?: string;
  xa2?: string;
  xa3?: string;
  xa4?: string;
  xa5?: string;
  xa6?: string;
  xa7?: string;
  xa8?: string;
  xa9?: string;
  videoUrl: String;

  xh1?: string;
  xh2?: string;
  xh3?: string;
  xh4?: string;
  xh5?: string;
  xh6?: string;
  xh7?: string;
  xh8?: string;
  xh9?: string;

  xv1?: string;
  xv2?: string;
  xv3?: string;
  xv4?: string;
  xv5?: string;
  xv6?: string;
  xv7?: string;
  xv8?: string;
  xv9?: string;

  mainint?: string;
  int1?: any;
  inttime1?: any;
  intx1?: any;
  inty1?: any;

  int2?: any;
  inttime2?: any;
  intx2?: any;
  inty2?: any;
  mode?: any;

  nobgmvideo?: string;

  kontext?: string;
  prompt?: string;

  ratio?: number;
  model?: string;


  main?: string;                  // main video URL
  inttype?: number;
  subl?: string;                  // left sub-video URL
  subr?: string;                  // right sub-video URL

  // touch hotspots (normalized 0..1)
  touchl?: "left";                // label (optional if you store it)
  touchlx?: number;               // left hotspot x
  touchly?: number;               // left hotspot y
  touchlr?: number;               // left hotspot radius

  touchr?: "right";               // label
  touchrx?: number;               // right hotspot x
  touchry?: number;               // right hotspot y
  touchrr?: number;


  mainaud?: string;
  sub1aud?: string;
  sub2aud?: string;

  favCount?: number;

  intbg?: number;
  has_more_data?: boolean;
}


interface FeedResponse {
  message: string;
  payload: FeedItem[];
  hasMore?: boolean;
}

interface FeedgateProps {
  isMenuOpen: boolean;
  callFeeds: boolean;
  setcallFeeds: React.Dispatch<React.SetStateAction<boolean>>;
  feedContainerRef: React.RefObject<HTMLDivElement>;
  feeds: FeedItem[];
  setFeeds: React.Dispatch<React.SetStateAction<FeedItem[]>>;
  LastId: number | null;
  setLastId: React.Dispatch<React.SetStateAction<number | null>>;
  type: number;
  setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
  isFullscreen: boolean;
  showEmotions: boolean
}

const Feedgate: FC<any> = memo(({
  callFeeds,
  setcallFeeds,
  isMenuOpen,
  feedContainerRef,
  feeds,
  setFeeds,
  LastId,
  setLastId,
  type,
  setIsFullscreen,
  isFullscreen,
  setIsMenuOpen,
  MyPageId,
  routelastId,
  MenuOpenb,
  setMenuOpenb,
  setminimiseProfile,
  minimiseProfile,
  isCropOpen,
  setIsCropOpen,
  minimisePrompt,
  vertical,
  feedtypeForHorizontalBackNavigate,
  searchData,
  showEmotions,

  setfollowType,

  setLikesPostid,
  setLikes,
  setShowEmotions,

  setsearchDataNav,
  setMyPageIdNav,
  setfeedLastIdNav,
  setfeedScrollPosNav,
  searchDeck,
}) => {


  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const iconTimeoutRefa = useRef<any>(null);
  const iconTimeoutRefax = useRef<any>(null);

  const iconTimeoutRef = useRef<any>(null);
  const iconTimeoutRefx = useRef<any>(null);
  const iconTimeoutRefx2 = useRef<any>(null);
  const iconTimeoutRefxl = useRef<any>(null);
  const iconTimeoutRefxlm = useRef<any>(null);
  const iconTimeoutRefxlmx = useRef<any>(null);

  const [Zoom1x, setZoom1x] = useState(false);

  const darkModeReducer = useSelector(
    (state: RootState) => state.settings.darkMode
  );

  const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

  // Component State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [fetchCount, setFetchCount] = useState(0);
  const [Viewing, setViewing] = useState(-1);
  const [deckLoaded, setDeckLoaded] = useState(false);
  const [loadedScope, setLoadedScope] = useState('');
  const profilePostId = type === 10 ? Number(location.state?.profilePostId) : 0;
  const profileAnchor = Number.isSafeInteger(profilePostId) && profilePostId > 0 ? profilePostId : undefined;
  const relatedChatPosts = location.state?.socialChatPost === true && Array.isArray(location.state?.socialChatPostIds)
    ? location.state.socialChatPostIds.slice(1, 28).map(Number).filter((id: number) => Number.isSafeInteger(id) && id > 0).join(',')
    : '';
  const requestScope = `${location.pathname.toLowerCase()}:${type}:${MyPageId ?? ''}:${searchData ?? ''}:${new URLSearchParams(location.search).get('post') ?? ''}:${new URLSearchParams(location.search).get('before') ?? ''}:viewer:${loggedUser?.id ?? ''}:layout:${Boolean(vertical)}${searchDeck ? `:${location.state?.clikbSearchRequestId || ''}` : ''}${relatedChatPosts ? `:chat:${relatedChatPosts}` : ''}${profileAnchor ? `:profile-post:${profileAnchor}` : ''}`;
  const currentRequestScope = useRef(requestScope); currentRequestScope.current = requestScope;
  const deckDataReady = deckLoaded && loadedScope === requestScope;
  useEffect(() => {
    if (!isFullscreen && feeds.some((item: any) => isDeletedFeedPost(item?.id))) {
      setFeeds((prev: FeedItem[]) => prev.some(item => isDeletedFeedPost(item?.id)) ? prev.filter(item => !isDeletedFeedPost(item?.id)) : prev);
      return;
    }
    if (deckDataReady && !loading && !callFeeds && !error) {
      rememberFeedCollection(requestScope, { feeds, hasMore, fetchCount });
    }
  }, [isFullscreen, deckDataReady, loading, callFeeds, error, requestScope, feeds, hasMore, fetchCount, setFeeds]);
  const paginationInFlight = useRef(false);
  const requestEpoch = useRef(0); const inFlightScopeRef = useRef<string | null>(null);
  useEffect(() => () => { requestEpoch.current++; inFlightScopeRef.current = null; }, []);
  const deckRuntime = useDeckRuntime();
  const savedDeckEnabled = useSelector((state: RootState) => state.settings.deckEnabled !== false);
  // Login supplies the member preference; do not insert a default Deck entry
  // while an account with Deck Off is still resolving.
  const deckAllowed = Boolean(loggedUser) && savedDeckEnabled;
  const searchSection: DeckSearchSection = type === 3 ? 'games' : type === 2 ? 'cinema' : 'shorts';
  const deckCategory: DeckCategory = searchDeck ? 'search' : type === 1 ? 'shorts' : type === 2 ? 'cinema' : type === 3 ? 'games' : type === 10 ? 'page' : 'all';
  const deckEnabled = ((Boolean(vertical) && /^\/(feeds|images|kickit|clikit|pages)?\/?$/i.test(location.pathname))
    || (Boolean(searchDeck) && location.pathname.toLowerCase() === '/search' && searchDeck.section === searchSection))
    && !new URLSearchParams(location.search).has('post')
    && !location.state?.fullscreen && !location.state?.upload;

  const instanceId = feedInstanceId(type, Boolean(vertical));
  const contextAreaId: FeedAreaId = `clikb.feeds.context.${instanceId}`;
  const sharedLink = type === 4 && /^\/experience\//i.test(location.pathname);
  useEffect(() => {
    dispatch(publishFeedsArea({
      areaId: contextAreaId, source: 'FeedsGate', instanceId,
      state: {
        route: location.pathname,
        mode: feedMode(type, Boolean(vertical)),
        displayName: feedDisplayName(type, Boolean(vertical), sharedLink ? 'shared_link' : 'feed'),
        layout: vertical ? 'vertical' : 'horizontal',
        entryKind: sharedLink ? 'shared_link' : 'feed',
        profileOwnerId: type === 10 && MyPageId ? Number(MyPageId) || null : null,
        query: !vertical && searchData ? String(searchData).slice(0, 500) : '',
        status: loading || (searchDeck && !deckDataReady) ? 'loading' : error ? 'error' : feeds.length ? 'ready' : 'empty',
        errorHint: error ? String(error).slice(0, 120) : '',
        loadedCount: searchDeck && !deckDataReady ? 0 : Math.min(feeds.length, 10000),
        hasMore,
        paginationStatus: sharedLink ? 'unavailable' : 'unverified',
      },
      visiblePosts: [], visibleControls: sharedLink && (error || (!loading && feeds.length === 0)) ? [{
        controlId: `${contextAreaId}.browse_all_feeds`, areaId: contextAreaId,
        handlerRef: 'FeedLayout.Browse All Feeds navigate(/feeds, replace)', enabled: true,
        aiPolicy: 'candidate', candidateActionId: `${contextAreaId}.browse_all_feeds`,
      }] : [],
    }));
  }, [dispatch, contextAreaId, instanceId, location.pathname, type, vertical, sharedLink, MyPageId, searchData, loading, error, feeds.length, hasMore, Boolean(searchDeck), deckDataReady]);
  useEffect(() => () => {
    dispatch(removeFeedsArea({ areaId: contextAreaId, source: 'FeedsGate' }));
  }, [dispatch, contextAreaId]);

  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

  const useDocumentFeedScroll = matchMobile && vertical;

  const getFeedScrollTop = useCallback(() => {
    if (useDocumentFeedScroll) {
      return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    }

    return feedContainerRef.current?.scrollTop ?? 0;
  }, [feedContainerRef, useDocumentFeedScroll]);

  const scrollVerticalItemIntoView = useCallback(
    (itemEl: HTMLElement, topPadding = 10, behavior: ScrollBehavior | "instant" = "auto") => {
      if (useDocumentFeedScroll) {
        const top = itemEl.getBoundingClientRect().top + window.scrollY - topPadding;
        window.scrollTo({ top, behavior: behavior as ScrollBehavior });
        return;
      }

      const feedContainer = feedContainerRef.current;
      if (!feedContainer) return;

      const containerRect = feedContainer.getBoundingClientRect();
      const itemRect = itemEl.getBoundingClientRect();
      const scrollOffset = itemRect.top - containerRect.top + feedContainer.scrollTop;
      feedContainer.scrollTo({ top: scrollOffset - topPadding, behavior: behavior as ScrollBehavior });
    },
    [feedContainerRef, useDocumentFeedScroll]
  );

  // Fullscreen states
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeIndexHold, setActiveIndexHold] = useState<number | null>(null);
  const [closingIndex, setClosingIndex] = useState<number | null>(null);

  const fullScreenContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenRefs = useRef<any[]>([]);
  const fullscreenRefsX = useRef<any[]>([]);
  const [horizontalActiveIndex, setHorizontalActiveIndex] = useState<number>(0);
  const [verticalActiveIndex, setverticalActiveIndex] = useState<number>(0);
  const scopedFeeds = deckDataReady ? feeds : [];
  const deck = useDeckNavigation({ feeds: scopedFeeds, category: deckCategory, enabled: deckEnabled,
    deckEnabled: deckAllowed,
    collectionScope: requestScope,
    creationEpoch: deckRuntime.creationEpoch,
    fullscreenPostId: isFullscreen && deckDataReady ? Number(feeds[verticalActiveIndex]?.id) || null : null,
    autoOpen: !location.state?.deckCreate, hasMore, fetchCount,
    loading: loading || callFeeds || !deckDataReady, minimisePrompt: deckRuntime.minimisePrompt,
    prepareDeck: deckRuntime.prepareDeck,
    onFullscreen: (postId) => {
      const index = postId == null || !deckDataReady ? -1 : feeds.findIndex((post: any) => Number(post.id) === postId);
      dispatch(setShowmenuToggle(index < 0));
      setIsFullscreen(index >= 0);
      setActiveIndex(index >= 0 ? index : null);
      if (index >= 0) { setActiveIndexHold(index); setverticalActiveIndex(index); }
    },
    getScroll: () => ({ x: useDocumentFeedScroll ? window.scrollX : feedContainerRef.current?.scrollLeft ?? 0,
      y: getFeedScrollTop() }),
    restoreScroll: (point) => {
      if (useDocumentFeedScroll) window.scrollTo(point.x, point.y);
      else feedContainerRef.current?.scrollTo({ left: point.x, top: point.y, behavior: 'instant' });
    },
    onGridReturn: (postId) => {
      deckRuntime.dismissCreationBackdrop();
      if (location.state?.clikbGridScroll?.scope === requestScope) return;
      const index = feeds.findIndex((post: any) => Number(post.id) === postId);
      if (index >= 0) setClosingIndex(index);
    },
    onCreate: () => {
      deckRuntime.openCreate();
    },
  });
  const deckPrefetchedSpatialRef = useRef<Set<number>>(new Set());
  const savedGridScroll = location.state?.clikbGridScroll?.scope === requestScope
    ? location.state.clikbGridScroll : undefined;
  const restoredGridLocation = useRef('');
  useLayoutEffect(() => {
    if (!savedGridScroll) {
      restoredGridLocation.current = '';
      return;
    }
    if (!deckDataReady || deck.isDeckOpen || isFullscreen || restoredGridLocation.current === location.key) return;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ left: savedGridScroll.windowX, top: savedGridScroll.windowY, behavior: 'instant' });
      feedContainerRef.current?.scrollTo({ left: savedGridScroll.x, top: savedGridScroll.y, behavior: 'instant' });
      restoredGridLocation.current = location.key;
    });
    return () => cancelAnimationFrame(frame);
  }, [savedGridScroll, deckDataReady, deck.isDeckOpen, isFullscreen, location.key, feedContainerRef]);
  const visitCreatorFromGrid = useCallback((memberId: number, postId: number) => {
    if (!deckDataReady || !Number.isSafeInteger(memberId) || memberId <= 0 || !Number.isSafeInteger(postId) || postId <= 0) return;
    const collectionKey = `grid-visit:${location.key}:${requestScope}`;
    rememberFeedCollection(collectionKey, { feeds, hasMore, fetchCount });
    navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, {
      replace: true, state: { ...location.state, clikbGridScroll: {
        scope: requestScope, collectionKey, x: feedContainerRef.current?.scrollLeft ?? 0, y: feedContainerRef.current?.scrollTop ?? 0,
        windowX: window.scrollX, windowY: window.scrollY,
      } },
    });
    const transition = deckRouteTransition(location, '/pages', { userId: memberId, profilePostId: postId }, {
      openDeck: deckAllowed, deckEnabled: deckAllowed, ...(deckAllowed ? { activePostId: postId } : {}),
    });
    navigate(transition.to, { ...transition.options, replace: false });
  }, [deckDataReady, deckAllowed, location, requestScope, feeds, hasMore, fetchCount, feedContainerRef, navigate]);
  useEffect(() => {
    if (!deck.isDeckOpen || !deckDataReady || !CLIK_URL) return;
    const activeCard = scopedFeeds.find((post: any) => Number(post?.id) === Number(deck.activePostId)) ?? deck.cards[0];
    const postId = Number(activeCard?.id);
    if (
      !postId ||
      activeCard?.interactionFormat !== 'spatial-v1' ||
      activeCard?.spatialExperienceJson ||
      deckPrefetchedSpatialRef.current.has(postId)
    ) {
      return;
    }
    deckPrefetchedSpatialRef.current.add(postId);
    axios
      .post(`${CLIK_URL}/getPostSpatial`, { postId })
      .then((res) => {
        const spatialJson = res.data?.spatialExperienceJson;
        if (spatialJson) {
          activeCard.spatialExperienceJson = spatialJson;
        }
      })
      .catch(() => {
        deckPrefetchedSpatialRef.current.delete(postId);
      });
  }, [deck.isDeckOpen, deck.activePostId, deck.cards, deckDataReady, scopedFeeds, CLIK_URL]);
  const itemRefs = useRef<HTMLDivElement[]>([]);

  const [captionVisibility, setCaptionVisibility] = useState<{
    [key: number]: boolean;
  }>({});
  const [captionPadVisibility, setCaptionPadVisibility] = useState<{
    [key: number]: boolean;
  }>({});

  const timeoutRefs = useRef<{ [key: number]: any }>({});
  const timeoutRefsx = useRef<{ [key: number]: any }>({});
  const timeoutRefsxp = useRef<{ [key: number]: any }>({});
  const captionPadTimeoutRefs = useRef<{
    [key: number]: ReturnType<typeof setTimeout>;
  }>({});

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

  const deckProfileId = type === 10 ? Number(MyPageId || loggedUser?.id) : 0;
  const deckProfilePost = scopedFeeds.find((post: FeedItem) => Number(post.sender) === deckProfileId);
  const deckProfile = !deckProfileId ? undefined : {
    id: deckProfileId,
    username: userProfile.id === deckProfileId ? userProfile.username
      : Number(loggedUser?.id) === deckProfileId ? loggedUser?.username || '' : deckProfilePost?.username || '',
    image: userProfile.id === deckProfileId ? userProfile.profilePicThumb || userProfile.profilePic
      : Number(loggedUser?.id) === deckProfileId ? loggedUser?.imageThumb || loggedUser?.image
        : deckProfilePost?.profile_image_thumb || deckProfilePost?.profile_image || '',
  };
  useEffect(() => {
    if (!deck.isDeckOpen || !deckProfileId || userProfile.id === deckProfileId || Number(loggedUser?.id) === deckProfileId) return;
    const controller = new AbortController();
    const config = { withCredentials: true, signal: controller.signal };
    void axios.post<{ payload?: Array<{ id: number; username?: string; profile_image?: string; profile_image_thumb?: string; billboard1?: string; billboardthumb1?: string }> }>(
      `${CLIK_URL}/profileInfo`, { values: { memberId: deckProfileId } }, config)
      .then(({ data }) => {
        const member = data?.payload?.[0];
        if (!member || controller.signal.aborted || Number(member.id) !== deckProfileId) return;
        setUserProfile({ id: deckProfileId, username: member.username || '', profilePic: member.profile_image || '',
          profilePicThumb: member.profile_image_thumb || '', billboard: member.billboard1 || '',
          billboardThumb: member.billboardthumb1 || '', followers: 0, following: 0 });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [deck.isDeckOpen, deckProfileId, loggedUser?.id, userProfile.id, CLIK_URL]);


  const stop = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = "";
      audioElementRef.current.removeAttribute("src");
      audioElementRef.current.load();
    }
  };
  ///videoArray randomcolor
  const [halt, sethalt] = useState(false);

  const [delayMore, setdelayMore] = useState(false);


  useEffect(() => {
    setdelayMore(true)

    if (iconTimeoutRefax.current) {
      clearTimeout(iconTimeoutRefax.current);
    }
    iconTimeoutRefax.current = setTimeout(() => {
      setdelayMore(false);
    }, 50);
  }, [feeds]);


  useEffect(() => {
    sethalt(true);
    if (iconTimeoutRefa.current) {
      clearTimeout(iconTimeoutRefa.current);
    }
    iconTimeoutRefa.current = setTimeout(() => {
      sethalt(false);
    }, 2000);
  }, [isMenuOpen]);

  // 1. Initial Load: fetchFeeds
  const fetchFeeds = useCallback(async () => {
    const epoch = ++requestEpoch.current; inFlightScopeRef.current = requestScope;
    const scope = requestScope;
    setLoading(true);
    setError(null);


    try {
      const reqData = {
        values: {
          id: loggedUser ? loggedUser.id : 0,
          id2: loggedUser ? loggedUser.id : 0,
        },
      };
      const reqData2 = {
        values: {
          id: MyPageId ? MyPageId : 0,
          id2: MyPageId ? MyPageId : 0,
          id3: loggedUser ? loggedUser.id : 0,

        },
      };


      const publicParams = new URLSearchParams(location.search);
      const experienceMatch = location.pathname.match(/^\/experience\/([1-9]\d{0,14})\/?$/i);
      const publicPost = type === 4 ? (experienceMatch?.[1] ?? publicParams.get("post")) : null;
      const publicBefore = type === 4 ? publicParams.get("before") : null;
      const validPublicId = (value: string | null) => !!value && /^[1-9]\d{0,14}$/.test(value);

      if (type === 4 && /^\/experience\//i.test(location.pathname) && !validPublicId(publicPost)) {
        setFeeds([]);
        setHasMore(false);
        setError('Invalid shared post link.');
        return;
      }

      const response = await requestFeedCollection(scope, async () => {
        let response: any;
        if (validPublicId(publicPost)) {
          response = await axios.get<FeedResponse>(`${CLIK_URL}/api/public-post/${publicPost}`,
            relatedChatPosts ? { params: { related: relatedChatPosts } } : undefined);
        } else if (validPublicId(publicBefore)) {
          response = await axios.post<FeedResponse>(`${CLIK_URL}/getFeedsMoreFeeds`, {
            values: { ...reqData.values, lastId: Number(publicBefore) },
          });
        } else if (searchData && !vertical) {
          const reqDatak = {
            values: {
              id: loggedUser ? loggedUser.id : 0,
              id2: loggedUser ? loggedUser.id : 0,
              searchData,
              typex: searchFeedMode(type),
            },
          };
          response = await axios.post<FeedResponse>(`${CLIK_URL}/getSearch`, reqDatak);
        } else {
          if (type === 1) {
            response = await axios.post<FeedResponse>(`${CLIK_URL}/getFeed`, reqData);
          } else if (type === 2) {
            response = await axios.post<FeedResponse>(`${CLIK_URL}/getFeedStory`, reqData);
          } else if (type === 3) {
            response = await axios.post<FeedResponse>(`${CLIK_URL}/getFeedsclik`, reqData);
          } else if (type === 4) {
            response = await axios.post<FeedResponse>(`${CLIK_URL}/getFeedsFeeds`, reqData);
          } else if (type === 10) {
            response = profileAnchor
              ? await axios.post<FeedResponse>(`${CLIK_URL}/getProfileMore`, { values: { ...reqData2.values, lastId: profileAnchor, override: true } }, { withCredentials: true })
              : await axios.post<FeedResponse>(`${CLIK_URL}/getProfile`, reqData2, { withCredentials: true });
          }
        }
        return response;
      });

      if (!Array.isArray(response.data?.payload)) {
        throw new Error(response.data?.message || 'The feed response did not contain a collection.');
      }
      const data = response.data.payload;
      if (epoch !== requestEpoch.current || scope !== currentRequestScope.current) return;

      console.log(data);
      if (data.length === 0 || validPublicId(publicPost)) {
        setHasMore(false);
      } else if (typeof response.data.hasMore === 'boolean') {
        setHasMore(response.data.hasMore);
      } else if (typeof data[0]?.has_more_data === 'boolean') {
        setHasMore(Boolean(data[0].has_more_data));
      } else {
        setHasMore(data.length >= 28);
      }
      console.log(data)
      setFeeds(data);

      setFetchCount(1);
    } catch (err: any) {
      if (epoch !== requestEpoch.current || scope !== currentRequestScope.current) return;
      console.error("Error fetching initial feeds:", err);
      setError(err.response?.data?.message || "An unexpected error occurred.");
    } finally {
      if (epoch === requestEpoch.current && scope === currentRequestScope.current) { inFlightScopeRef.current = null;
        setLoading(false);
        setcallFeeds(false);
        setDeckLoaded(true);
        setLoadedScope(scope);
      }
    }
  }, [loggedUser, setcallFeeds, setFeeds, type, MyPageId, searchData, vertical, location.pathname, location.search, requestScope, relatedChatPosts]);

  // 2. Pagination: fetchFeedsPagination
  // ADDED an optional parameter to override the lastId
  const fetchFeedsPagination = useCallback(
    async (overrideLastId?: number | null) => {
      if (!hasMore || loading || paginationInFlight.current) return [];
      paginationInFlight.current = true;
      const epoch = requestEpoch.current;
      const scope = requestScope;

      setLoading(true);
      setError(null);



      try {
        // If overrideLastId is given, use that. Otherwise, use the final feed item ID.


        var ff = 1;


        if (fetchCount >= 3) {
          if (matchMobile) {

            ff = 10;

          } else if (isMenuOpen) {

            ff = 8;
          } else {

            ff = 10;


          }
        }


        const lastIdValue =
          overrideLastId ?? (feeds.length > 0 ? feeds[Math.max(0, feeds.length - ff)].id : null);

        const reqData = {
          values: {
            id: loggedUser ? loggedUser.id : 0,
            id2: loggedUser ? loggedUser.id : 0,
            lastId: lastIdValue,
            override: overrideLastId,
          },
        };
        const reqData2 = {
          values: {
            id: MyPageId ? MyPageId : 0,
            id2: MyPageId ? MyPageId : 0,
            id3: loggedUser ? loggedUser.id : 0,
            lastId: lastIdValue,
            overrideLastId: overrideLastId,
          },
        };

        console.log("Fetching more feeds. Type:", type);
        console.log("Request data:", reqData);
        /// vertical

        let response: any;

        if (searchData && !vertical) {

          const reqDatak = {
            values: {
              id: loggedUser ? loggedUser.id : 0,
              id2: loggedUser ? loggedUser.id : 0,
              lastId: lastIdValue,
              override: overrideLastId,

              searchData,
              typex: searchFeedMode(type),
              cursor: overrideLastId ? undefined : searchFeedCursor(searchData, type, feeds.at(-1)),
            },
          };



          response = await axios.post<FeedResponse>(
            `${CLIK_URL}/getSearchMore`,
            reqDatak
          );

          setViewUserId(loggedUser ? loggedUser.id : 0);

        }

        else {

          if (type === 1) {


            response = await axios.post<FeedResponse>(
              `${CLIK_URL}/getFeedMore`,
              reqData
            );


            setViewUserId(loggedUser ? loggedUser.id : 0);

          } else if (type === 2) {
            response = await axios.post<FeedResponse>(
              `${CLIK_URL}/getFeedMoreStory`,
              reqData
            );


            setViewUserId(loggedUser ? loggedUser.id : 0);
          }

          else if (type === 3) {
            response = await axios.post<FeedResponse>(
              `${CLIK_URL}/getFeedClikmore`,
              reqData
            );


            setViewUserId(loggedUser ? loggedUser.id : 0);
          }

          else if (type === 4) {
            response = await axios.post<FeedResponse>(
              `${CLIK_URL}/getFeedsMoreFeeds`,
              reqData
            );


            setViewUserId(loggedUser ? loggedUser.id : 0);
          }

          else if (type === 10) {

            response = await axios.post<FeedResponse>(
              `${CLIK_URL}/getProfileMore`,
              reqData2, { withCredentials: true }


            );

          }

        }
        // else ?

        const newData = response.data.payload || [];
        if (epoch !== requestEpoch.current || scope !== currentRequestScope.current) return [];
        console.log("New data count:", newData.length);

        const unseen = appendUnseenFeedPosts(feeds, newData).slice(feeds.length);
        const serverHasMore =
          typeof response.data.hasMore === 'boolean'
            ? response.data.hasMore
            : typeof newData[0]?.has_more_data === 'boolean'
              ? Boolean(newData[0].has_more_data)
              : newData.length >= 28;
        if (unseen.length === 0) {
          setHasMore(false);
        } else {
          setHasMore(serverHasMore);
          setFeeds((prev: FeedItem[]) => {
            return appendUnseenFeedPosts(prev, newData);
          });
          
          if (fetchCount >= 3) {
            setFetchCount(0);
          } else {
            setFetchCount((prev) => prev + 1);
          }
        }
        return unseen.map(post => Number(post.id));
      } catch (err: any) {
        if (epoch !== requestEpoch.current || scope !== currentRequestScope.current) return [];
        console.error("Error fetching more feeds:", err);
        setError(err.response?.data?.message || "An unexpected error occurred.");
      } finally {
        paginationInFlight.current = false;
        if (epoch === requestEpoch.current && scope === currentRequestScope.current) { inFlightScopeRef.current = null;
          setLoading(false);
          setDeckLoaded(true);
          setLoadedScope(scope);
        }
      }
    },
    [
      isMenuOpen,
      hasMore,
      loading,
      fetchCount,
      loggedUser,
      feeds,
      setFeeds,
      type,
      MyPageId,
      CLIK_URL,
      matchMobile,
      searchData,
      vertical,
      requestScope
    ]
  );



  const publicFeedKey = `${new URLSearchParams(location.search).get('post') ?? ''}:${new URLSearchParams(location.search).get('before') ?? ''}`;
  useEffect(() => {
    if (type === 4) setcallFeeds(true);
  }, [publicFeedKey, type, setcallFeeds]);


  // useEffect: initial load, but skip if routelastId != 0
  useLayoutEffect(() => {
    // Homepage rows share callFeeds. A sibling finishing an old request must
    // not prevent this row from fetching its newly selected keyword scope.
    if ((callFeeds || !deckDataReady) && inFlightScopeRef.current !== requestScope) {
      const cached = !location.state?.upload && (
        (savedGridScroll?.collectionKey ? cachedFeedCollection<FeedItem>(savedGridScroll.collectionKey, { allowStale: true }) : undefined)
        ?? (deckEnabled ? cachedDeckFeeds(location.state, requestScope) : undefined)
        ?? (!routelastId ? cachedFeedCollection<FeedItem>(requestScope) : undefined)
      );
      if (cached) {
        requestEpoch.current++;
        inFlightScopeRef.current = null;
        setLoading(false); setError(null);
        setFeeds(cached.feeds); setDeckLoaded(true); setHasMore(cached.hasMore ?? true);
        setLoadedScope(requestScope);
        setFetchCount(cached.fetchCount ?? 1);
        setcallFeeds(false);
        return;
      }
      const retained = !location.state?.upload && !routelastId
        ? cachedFeedCollection<FeedItem>(requestScope, { allowStale: true }) : undefined;
      if (retained) {
        setFeeds(retained.feeds);
        setDeckLoaded(true); setLoadedScope(requestScope);
        setHasMore(retained.hasMore); setFetchCount(retained.fetchCount);
      } else if (!deckDataReady) {
        // A different collection must never display the previous route's posts.
        // Reloading the current collection can keep its cards until the response.
        setFeeds([]);
        setFetchCount(0);
      }

      // If routelastId is nonzero, skip fetchFeeds, use pagination with override
      const publicLink = type === 4 && (
        /(?:^|[?&])(?:post|before)=[1-9]\d*(?:&|$)/.test(location.search)
        || /^\/experience\/[1-9]\d{0,14}\/?$/i.test(location.pathname)
      );
      if (!publicLink && routelastId && routelastId !== 0) {
        setcallFeeds(false);
        fetchFeedsPagination(routelastId);
      } else {
        setHasMore(true);
        // Normal initial load
        fetchFeeds();
      }
    }
  }, [
    callFeeds,
    routelastId,
    loggedUser,
    location.pathname,
    requestScope,
    savedGridScroll?.collectionKey,

  ]);

  // Keep track of lastId
  useEffect(() => {

    if (feeds && feeds.length > 0) {
      setLastId(feeds[0].id);
      /// alert(feeds[0].id);
    }
  }, [feeds, setLastId,]);


  const [callonce, setcallonce] = useState(false);




  useEffect(() => {
    if (iconTimeoutRefx2.current) {
      clearTimeout(iconTimeoutRefx2.current);
    }
    iconTimeoutRefx2.current = setTimeout(() => {
      setcallonce(false);

    }, 500)
  }, [location.pathname]);





  const [FullscreenRoute, setFullscreenRoute] = useState<boolean>(!!location.state?.fullscreen);
  const [emotionRoute, setEmotionRoute] = useState<boolean>(!!location.state?.follow);
  const [lastId, setlastId] = useState<boolean>(!!location.state?.routelastId);
  const [routeUrl, setRouteUrl] = useState<string>(`${location.pathname}${location.search}${location.hash}`);
  const [viewUserId, setViewUserId] = useState<string | number | null>(MyPageId);

  // Optional: keep the previous URL too (handy for ESC/back)



  const prevUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // store previous before updating current
    prevUrlRef.current = routeUrl;

    // update current URL + state fields whenever location changes
    setRouteUrl(`${location.pathname}${location.search}${location.hash}`);
    setFullscreenRoute(!!location.state?.fullscreen);
    setEmotionRoute(!!location.state?.follow);
    setlastId(!!location.state?.routelastId);
    setViewUserId(MyPageId);

  }, [location.pathname, MyPageId]);





  useEffect(() => {

    if (iconTimeoutRefxlm.current) {
      clearTimeout(iconTimeoutRefxlm.current);
    }

    if (iconTimeoutRefxlmx.current) {
      clearTimeout(iconTimeoutRefxlmx.current);
    }
    iconTimeoutRefxlm.current = setTimeout(() => {

      if (deckDataReady && feeds.length > 0) {

        if (!callonce) {




          const directExperienceRoute = type === 4
            && /^\/experience\/[1-9]\d{0,14}\/?$/i.test(location.pathname);

          if (FullscreenRoute || directExperienceRoute) {
            const postId = Number(location.state?.fullscreenPostId);
            const restoredIndex = postId > 0 ? feeds.findIndex((post: FeedItem) => Number(post.id) === postId) : 0;
            if (restoredIndex < 0) return;

            if (iconTimeoutRefxlmx.current) {
              clearTimeout(iconTimeoutRefxlmx.current);
            }
            iconTimeoutRefxlmx.current = setTimeout(() => {


              /// alert(routelastId);

              if (vertical) {

                setcallonce(true);
                handleOpenFullscreen(restoredIndex, true);
              } else {

                if (feedtypeForHorizontalBackNavigate === type) {
                  setcallonce(true);
                  handleOpenFullscreen(restoredIndex, true);

                }
              }

            }, 600)

          }
        }


      } else {


      }


    }, 200)


    return () => {
      clearTimeout(iconTimeoutRefxlm.current);
      clearTimeout(iconTimeoutRefxlmx.current);
    };
  }, [FullscreenRoute, feeds, callFeeds, vertical, feedtypeForHorizontalBackNavigate, type, location, emotionRoute, lastId, deckDataReady]);


  // Intersection Observer for pagination
  // 4s window
  const COOLDOWN_MS = 3000;

  const [locked, setLocked] = useState(false);
  // mirror in a ref so the observer callback always sees latest value
  const lockedRef = useRef(false);
  useEffect(() => { lockedRef.current = locked; }, [locked]);

  useEffect(() => {
    if (deck.ownsHistory || (searchDeck && (location.state?.clikbDeck || location.state?.clikbDeckEntrance)) || !deckDataReady) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;

        // just return if locked
        if (lockedRef.current) return;

        // call once, then lock
        fetchFeedsPagination();
        setLocked(true);
      },
      { threshold: matchMobile ? 0.05 : 0.02, rootMargin: matchMobile ? '650px 0px' : '500px 0px' }
    );

    const sentinel = bottomSentinelRef.current;
    if (sentinel) observer.observe(sentinel);

    return () => {
      if (sentinel) observer.unobserve(sentinel);
    };
  }, [fetchFeedsPagination, matchMobile, deck.ownsHistory, deckDataReady, searchDeck, location.state]);

  // separate timer to reset the lock after each call
  useEffect(() => {
    if (!locked) return;
    const id = setTimeout(() => setLocked(false), COOLDOWN_MS);
    return () => clearTimeout(id);
  }, [locked]);




  // IntersectionObserver for caption visibility
  useEffect(() => {

    const xx = matchMobile ? 1 : isMenuOpen ? 0.8 : 0.98;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idxStr = entry.target.getAttribute("data-index");
          if (idxStr !== null) {
            const idx = parseInt(idxStr, 10);
            if (entry.intersectionRatio >= xx) {
              if (timeoutRefs.current[idx]) {
                clearTimeout(timeoutRefs.current[idx] as number);
              }
              if (timeoutRefsx.current[idx]) {
                clearTimeout(timeoutRefsx.current[idx] as number);
                timeoutRefsx.current[idx] = null;
              }
              timeoutRefsx.current[idx] = setTimeout(() => {
                setViewing(idx);
              }, 500);

              if (timeoutRefsxp.current[idx]) {
                clearTimeout(timeoutRefsxp.current[idx] as number);
                timeoutRefsxp.current[idx] = null;
              }
              timeoutRefsxp.current[idx] = setTimeout(() => {
                /// alert(idx)
                setCaptionVisibility((prev) => ({ ...prev, [idx]: true }));
              }, matchMobile ? (type === 10 ? 0 : 0) : isMenuOpen ? 0 : 0);

              if (captionPadTimeoutRefs.current[idx]) {
                clearTimeout(captionPadTimeoutRefs.current[idx]);
              }
              captionPadTimeoutRefs.current[idx] = setTimeout(() => {
                setCaptionPadVisibility((prev) => ({ ...prev, [idx]: true }));
                delete captionPadTimeoutRefs.current[idx];
              }, 6000);

              timeoutRefs.current[idx] = setTimeout(() => {
                setCaptionVisibility((prev) => ({ ...prev, [idx]: false }));
                timeoutRefs.current[idx] = null;
              }, 40000);
            } else {
              if (timeoutRefsxp.current[idx]) {
                clearTimeout(timeoutRefsxp.current[idx] as number);
                timeoutRefsxp.current[idx] = null;
              }
              if (timeoutRefs.current[idx]) {
                clearTimeout(timeoutRefs.current[idx] as number);
                timeoutRefs.current[idx] = null;
              }
              if (captionPadTimeoutRefs.current[idx]) {
                clearTimeout(captionPadTimeoutRefs.current[idx]);
                delete captionPadTimeoutRefs.current[idx];
              }
              setCaptionVisibility((prev) => ({ ...prev, [idx]: false }));
              // Caption pads disappear immediately when their row is no longer active.
              setCaptionPadVisibility((prev) => ({ ...prev, [idx]: false }));
            }
          }
        });
      },
      { threshold: [0, xx] }
    );

    itemRefs.current.forEach((el, idx) => {
      if (el) {
        //  el.setAttribute("data-index", String(idx));
        observer.observe(el);
      }
    });

    return () => {
      observer.disconnect();
      Object.values(timeoutRefs.current).forEach((timeout) => {
        if (timeout) clearTimeout(timeout as number);
      });
      Object.values(timeoutRefsxp.current).forEach((timeout) => {
        if (timeout) clearTimeout(timeout as number);
      });
      Object.values(captionPadTimeoutRefs.current).forEach((timeout) => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, [feeds, isMenuOpen]);





  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = getFeedScrollTop();

      console.log("Scroll Top:", scrollTop);

      if (scrollTop === 0) {
        console.log("Scroll position is less than 11");
        if (minimiseProfile) {


          setminimiseProfile(false);
        }
      }
      else if (scrollTop > 500) {


        if (!minimiseProfile) {
          setminimiseProfile(true);




        }


      } else {


      }
    };

    // Attaching the scroll listener to the active feed scroll target
    const scrollTarget = useDocumentFeedScroll ? window : feedContainerRef.current;
    scrollTarget?.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      scrollTarget?.removeEventListener("scroll", handleScroll);
    };
  }, [minimiseProfile, feeds, callFeeds, getFeedScrollTop, useDocumentFeedScroll]);


  const closePop = () => {
    if (deck.ownsHistory) { deck.close(); return; }
    if (iconTimeoutRefxl.current) {
      clearTimeout(iconTimeoutRefxl.current);
    }
    iconTimeoutRefxl.current = setTimeout(() => {
      if (isFullscreen) {
        setTimeout(() => {
          setClosingIndex(activeIndexHold);
        }, 300);
        dispatch(setShowmenuToggle(true));
        setIsFullscreen(false);
        setActiveIndex(null);
      }

    }, 500)
  }

  ///instant
  // Handle BACK BUTTON
  useEffect(() => {
    if (deck.ownsHistory) return;
    if (feeds.length > 0) {
      const handlePopState = () => {
        closePop();
      };

      window.addEventListener("popstate", handlePopState);
      return () => window.removeEventListener("popstate", handlePopState);

    }
  }, [isFullscreen, activeIndexHold, feeds, deck.ownsHistory]);


  useEffect(() => {
    if (!isFullscreen || fullscreenRefsX.current.length === 0) return;

    let lastIndex = activeIndex;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = fullscreenRefsX.current.indexOf(
              entry.target as HTMLDivElement
            );
            if (idx >= 0 && idx !== lastIndex) {
              lastIndex = idx;
              setActiveIndexHold(idx);
            }
          }
        });
      },
      { threshold: 0.6 }
    );

    fullscreenRefsX.current.forEach((el: any) => {
      if (el) observer.observe(el);
    });
    return () => {
      observer.disconnect();
    };
  }, [isFullscreen, fullscreenRefs, activeIndex, fullscreenRefsX, type]);

  // If entering fullscreen, push a new history state.



  ////////////////////////////////////
  ////////////////////////

  // Handle ESC Key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen && !e.defaultPrevented && !location.state?.socialChat) {
        if (sharedLink && location.state?.socialChatPost !== true) navigate('/feeds', { replace: true });
        else window.history.back();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, sharedLink, navigate, location.state]);

  // IntersectionObserver in Fullscreen to update activeIndex
  useEffect(() => {
    if (isFullscreen && fullScreenContainerRef.current && feeds.length > 0) {
      const container = fullScreenContainerRef.current;
      const handleIntersections = (entries: IntersectionObserverEntry[]) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idxStr = entry.target.getAttribute("data-index");
            if (idxStr) {
              const idx = parseInt(idxStr, 10);
              setActiveIndex(idx);
            }
          }
        });
      };
      const observer = new IntersectionObserver(handleIntersections, {
        threshold: 0.6,
      });
      feeds.forEach((_: any, i: any) => {
        const el = document.getElementById(`fullscreenItem-${i}`);
        if (el) observer.observe(el);
      });
      return () => {
        observer.disconnect();
      };
    }
  }, [isFullscreen, feeds]);

  // Scroll to the item when closing fullscreen
  const [MobileClick, setMobileClick] = useState(false);
  useEffect(() => {
    if (MobileClick) {
      setMobileClick(false);
    } else {

      if (matchMobile) { }
      else {

        if (Viewing !== -1) {
          if (iconTimeoutRefxl.current) {
            clearTimeout(iconTimeoutRefxl.current);
          }
          iconTimeoutRefxl.current = setTimeout(() => {
            const itemEl = itemRefs.current[Viewing];
            if (itemEl) {
              scrollVerticalItemIntoView(itemEl, 10, "instant");
            }
          }, 1500);
        }
      }
    }
  }, [isMenuOpen]);

  useEffect(() => {
    if (closingIndex != null) {
      if (vertical) {
        const itemEl = itemRefs.current[closingIndex];
        if (itemEl) {
          scrollVerticalItemIntoView(itemEl, 10, "instant");
        }
        setClosingIndex(null);
      } else {
        const feedContainer = feedContainerRef.current;
        const itemEl = itemRefs.current[closingIndex];
        if (feedContainer && itemEl) {
          const containerRect = feedContainer.getBoundingClientRect();
          const itemRect = itemEl.getBoundingClientRect();
          const scrollOffset =
            itemRect.left - containerRect.left + feedContainer.scrollLeft;
          feedContainer.scrollTo({
            left: scrollOffset - 10,
            behavior: "instant",
          });
        }
        setClosingIndex(null);
      }


    }
  }, [closingIndex, vertical, scrollVerticalItemIntoView]);

  // Open Fullscreen
  const handleOpenFullscreen = useCallback(
    (index: number, not: boolean) => {
      if (isMenuOpen && matchMobile) {
        setIsMenuOpen(false);
        setMobileClick(true);

        /*    if (iconTimeoutRefx.current) {
              clearTimeout(iconTimeoutRefx.current);
            }
            iconTimeoutRefx.current = setTimeout(() => {
              const feedContainer = feedContainerRef.current;
              const itemEl = itemRefs.current[index];
              if (feedContainer && itemEl) {
                const containerRect = feedContainer.getBoundingClientRect();
                const itemRect = itemEl.getBoundingClientRect();
                const scrollOffset =
                  itemRect.top - containerRect.top + feedContainer.scrollTop;
                feedContainer.scrollTo({
                  top: scrollOffset - 10,
                  behavior: "instant",
                });
              }
            }, 200);
    
            */

        if (not) {
          dispatch(setShowmenuToggle(false));
          setActiveIndexHold(index);
          setActiveIndex(index);
          setverticalActiveIndex(index);
          setIsFullscreen(true);
        }

      } else {


        if (!matchMobile && MenuOpenb) {
          setMenuOpenb(false);



          if (not) {
            dispatch(setShowmenuToggle(false));
            setActiveIndexHold(index);
            setActiveIndex(index);
            setverticalActiveIndex(index);
            setIsFullscreen(true);
          }


        } else {
          if (not) { } else {


            if (iconTimeoutRefx.current) {
              clearTimeout(iconTimeoutRefx.current);
            }
            iconTimeoutRefx.current = setTimeout(() => {
              ///  alert('jj');
              // Get the current state (if any)
              ///const currentState = location.state || {};

              // Merge the current state with the fullscreen flag
              /// const newState = { ...currentState, fullscreen: true };


              ///navigate(window.location.pathname, { state: newState });


              const routeState2 = {
                userId: viewUserId,
                fullscreen: true,
                fullscreenPostId: Number(feeds[index]?.id) || undefined,
                follow: false,
              };

              console.log('sssssssssssssssssssssssssssssssssssssss', routeState2)



              navigate(routeUrl, { state: routeState2, });

            }, 20);



          }

          // alert(index)

          dispatch(setShowmenuToggle(false));
          setActiveIndexHold(index);
          setActiveIndex(index);
          setverticalActiveIndex(index);
          setIsFullscreen(true);
        }
      }
    },
    [isMenuOpen, MenuOpenb, viewUserId, routeUrl, feeds]
  );

  // Resolve identity at click time; pagination/reordering must not retarget a card.
  const liveFeedsForOpen = useRef(feeds);
  liveFeedsForOpen.current = feeds;
  const handleOpenPostId = (postId: number, flag: boolean) => {
    if (deckEnabled && !flag) { deck.openPost(postId); return; }
    if (searchDeck && !flag) { searchDeck.onOpenPost(searchSection, postId); return; }
    const index = liveFeedsForOpen.current.findIndex((post: FeedItem) => Number(post.id) === Number(postId));
    if (index >= 0) handleOpenFullscreen(index, flag);
  };

  // Audio / Video stuff...
  const [audioPlaying, setAudioPlaying] = useState<boolean>(false);
  const [generatedAudios, setGeneratedAudios] = useState<string[]>([]);

  interface AudioFields {
    captionSummary?: string;
    captionAudio?: string;
    xa1?: string;
    xa2?: string;
    xa3?: string;
    xa4?: string;
    xa5?: string;
    xa6?: string;
    xa7?: string;
    xa8?: string;
  }

  const [AudioArray, setAudioArray] = useState<AudioFields[]>([]);
  const [videoArray, setVideoArray] = useState<string[]>([]);
  const mediaPostIds = useRef<number[]>([]);
  const audioPostIds = useRef<number[]>([]);

  const [storyVidArray, setStoryVidArray] = useState<string[]>([]);


  const [itemLoadArray, setitemLoadArray] = useState<boolean[]>([]);


  const stopAudio = () => {
    stop();
    speechSynthesis.cancel();
    setAudioPlaying(false);
  };

  useEffect(() => {
    if (!isFullscreen) {
      stopAudio();
    }
  }, [isFullscreen]);


  useEffect(() => {
    // Create a new object where each feed index is set to false.
    const newCaptionVisibility: { [key: number]: boolean } = {};
    feeds.forEach((_: any, index: any) => {
      newCaptionVisibility[index] = true;
    });

    // Log the state before updating (optional)
    console.log('Updating captionVisibility:', newCaptionVisibility);

    // Update the state with the new object.
    setCaptionVisibility(newCaptionVisibility);
  }, [feeds]);

  useEffect(() => {
    setCaptionPadVisibility((previous) => {
      const nextVisibility: { [key: number]: boolean } = {};
      feeds.forEach((_: any, index: number) => {
        nextVisibility[index] = previous[index] ?? false;
      });
      return nextVisibility;
    });
  }, [feeds]);

  useEffect(() => {
    if (!feeds || feeds.length === 0) return;

    const previousIds = mediaPostIds.current;
    mediaPostIds.current = feeds.map((post: any) => Number(post.id));
    setVideoArray(previous => reindexPostMedia(previous, previousIds, feeds, post => post.videoUrl || ''));
    setStoryVidArray(previous => reindexPostMedia(previous, previousIds, feeds, post =>
      Array.from({ length: 8 }, (_, index) => index + 1)
        .filter(index => post['x' + index] != null).map(index => post['xv' + index])));

    setitemLoadArray(prev =>
      feeds.map((_: any, i: any) => prev?.[i] === true)   // keep true; otherwise false
    );

  }, [feeds]);


  // states
  const [likedArray, setLikedArray] = useState<Array<{ postId: number; liked: boolean }>>([]);
  const [likeCountArray, setLikeCountArray] = useState<Array<{ postId: number; count: number }>>([]);

  // helper
  const toBool = (v: any) => v === 1 || v === "1" || v === true || v === "true";

  useEffect(() => {
    if (!Array.isArray(feeds)) return;

    // --- LIKED ARRAY ---
    setLikedArray(prev => {
      // fresh page: rebuild entirely
      if (fetchCount === 0) {
        return feeds.map((f: any) => ({
          postId: Number(f?.id),
          liked: toBool(f?.EmoIn),
        }));
      }

      // append-only when loading more
      const prevLen = prev.length;
      const feedLen = feeds.length;

      if (feedLen > prevLen) {
        const appended = feeds.slice(prevLen).map((f: any) => ({
          postId: Number(f?.id),
          liked: toBool(f?.EmoIn),
        }));
        return prev.concat(appended);
      }

      // same length or shorter -> keep what we have
      return prev;
    });

    // --- LIKE COUNT ARRAY ---
    setLikeCountArray(prev => {
      if (fetchCount === 0) {
        return feeds.map((f: any) => ({
          postId: Number(f?.id),
          count: Number(f?.lovely ?? 0) || 0,
        }));
      }

      const prevLen = prev.length;
      const feedLen = feeds.length;

      if (feedLen > prevLen) {
        const appended = feeds.slice(prevLen).map((f: any) => ({
          postId: Number(f?.id),
          count: Number(f?.lovely ?? 0) || 0,
        }));
        return prev.concat(appended);
      }

      return prev;
    });
  }, [feeds, fetchCount]);



  useEffect(() => {
    if (!feeds || feeds.length === 0) return;

    if (fetchCount === 1) {
      const timer = setTimeout(() => {

        // Update videoArray from scratch using videoUrl for each feed (already handled on line 1443)
        if (feeds.length > 0) return;


        setVideoArray(feeds.map((feedItem: any) => feedItem.videoUrl));
        // alert('jj');
        // Update storyVidArray from scratch: build array of story videos for each feed using xv1...xv8 keys
        setStoryVidArray(
          feeds.map((feedItem: any) => {
            const storyVideos = [];
            for (let j = 1; j <= 8; j++) {
              const key = 'xv' + j;
              const video = feedItem[key];

              const keyx = 'x' + j;
              const itemImg = feedItem[keyx];

              if (itemImg != null) {
                storyVideos.push(video);
              }
            }

            return storyVideos;
          })
        );
      }, 500);


      return () => clearTimeout(timer);



    }


    if (feeds.length > 0) return; const timerc = setTimeout(() => {
      setitemLoadArray(prev =>
        feeds.map((_: any, i: any) => (prev && prev[i] === true ? true : false))
      );
    }, 500);

  }, [callFeeds, feeds, fetchCount]);



  // Load audio array
  useEffect(() => {
    if (!feeds || feeds.length === 0) return;
    console.log(feeds);
    const previousIds = audioPostIds.current;
    audioPostIds.current = feeds.map((post: any) => Number(post.id));
    setAudioArray(previous => reindexPostMedia(previous, previousIds, feeds, post => ({
      captionSummary: post.captionSummary, captionAudio: post.captionAudio,
      xa1: post.xa1, xa2: post.xa2, xa3: post.xa3, xa4: post.xa4,
      xa5: post.xa5, xa6: post.xa6, xa7: post.xa7, xa8: post.xa8,
    })));
  }, [feeds]);

  useEffect(() => {
    console.log(videoArray);
  }, [videoArray]);

  // Render
  return (
    <>
      {deck.isDeckOpen && <DeckOverlay cards={deck.cards.length > 0 ? deck.cards : (scopedFeeds.length > 0 ? (scopedFeeds as any[]).slice(0, 20) : deck.cards)} activePostId={deck.activePostId ?? (deck.cards[0] ? Number(deck.cards[0].id) : scopedFeeds[0] ? Number(scopedFeeds[0].id) : null)}
        category={deckCategory} profile={deckProfile} loading={loading || callFeeds || !deckDataReady} hasMore={hasMore} error={error}
        isMenuOpen={isMenuOpen} MenuOpenb={MenuOpenb} onSelectPost={deck.selectPost} onPlay={deck.play}
        onClose={deck.close} onCreate={deck.create} onDockHost={deckRuntime.setDockHost}
        onVisitProfile={(memberId, postId) => {
          if (!Number.isSafeInteger(memberId) || memberId <= 0) return;
          if (deckCategory === 'page' && memberId === Number(MyPageId || loggedUser?.id)) {
            deck.close();
            return;
          }
          const transition = deckRouteTransition(location, '/pages', { userId: memberId, profilePostId: postId }, {
            deckEnabled: deckAllowed, ...(deckAllowed ? { activePostId: postId } : {}),
          });
          navigate(transition.to, { ...transition.options, replace: false });
        }}
        composing={!deckRuntime.minimisePrompt}
        search={searchDeck ? { section: searchSection, query: searchDeck.query, collections: searchDeck.collections, requestId: location.state?.clikbDeck?.sessionId, onSection: searchDeck.onSection, onSearch: searchDeck.onSearch } : undefined}
        onPaginate={async () => {
          const ids = await fetchFeedsPagination();
          if (ids?.length) deck.showPage(ids);
        }}
        onCategory={(category: DeckCategory) => {
          if (category === 'page' && (!loggedUser || Number(loggedUser.id) === 1)) {
            deck.create();
            if (type === 10) return;
            navigate('/images', { state: { deckCreate: true } });
            return;
          }
          const path = { all: '/feeds', games: '/clikit', shorts: '/images', cinema: '/kickit', page: '/pages', search: '/search' }[category];
          if (category !== deckCategory || (category === 'page' && deckProfileId !== Number(loggedUser?.id))) {
            const transition = deckRouteTransition(location, path, category === 'page' ? { userId: loggedUser?.id } : {}, { deckEnabled: deckAllowed });
            navigate(transition.to, transition.options);
          }
        }} />}


      {vertical ?
        <FeedLayout
          hasMore={hasMore}
          deckOpen={deck.isDeckOpen}
          sharedLink={sharedLink}
          setsearchDataNav={setsearchDataNav}
          setMyPageIdNav={setMyPageIdNav}
          onVisitProfile={visitCreatorFromGrid}
          setfeedLastIdNav={setfeedLastIdNav}
          setfeedScrollPosNav={setfeedScrollPosNav}


          setShowEmotions={setShowEmotions}
          setLikesPostid={setLikesPostid}
          setLikes={setLikes}

          likedArray={likedArray}
          likeCountArray={likeCountArray}
          setLikedArray={setLikedArray}
          setLikeCountArray={setLikeCountArray}


          MyPageId={MyPageId}

          setfollowType={setfollowType}

          showEmotions={showEmotions}
          searchData={''}
          /* pass the same variables / refs / callbacks your old code used */
          matchMobile={matchMobile}
          isMenuOpen={isMenuOpen}
          audioElementRef={audioElementRef}
          loading={loading}
          error={error}
          feeds={feeds}
          feedContainerRef={feedContainerRef}
          darkModeReducer={darkModeReducer}
          type={type}

          userProfile={userProfile}
          setUserProfile={setUserProfile}
          setminimiseProfile={setminimiseProfile}
          minimiseProfile={minimiseProfile}
          isCropOpen={isCropOpen}
          setIsCropOpen={setIsCropOpen}
          loggedUser={loggedUser}
          MenuOpenb={MenuOpenb}
          setMenuOpenb={setMenuOpenb}
          Zoom1x={Zoom1x}
          setZoom1x={setZoom1x}
          itemRefs={itemRefs}
          minimisePrompt={minimisePrompt}
          itemLoadArray={itemLoadArray}
          setitemLoadArray={setitemLoadArray}
          captionVisibility={captionVisibility}
          captionPadVisibility={captionPadVisibility}
          halt={halt}
          bottomSentinelRef={bottomSentinelRef}
          delayMore={delayMore}
          isFullscreen={isFullscreen}
          storyVidArray={storyVidArray}
          setStoryVidArray={setStoryVidArray}
          closePop={closePop}
          LastId={LastId}
          setLastId={setLastId}
          setVideoArray={setVideoArray}
          videoArray={videoArray}
          AudioArray={AudioArray}
          setAudioArray={setAudioArray}
          generatedAudios={generatedAudios}
          setGeneratedAudios={setGeneratedAudios}
          fullScreenContainerRef={fullScreenContainerRef}
          setHorizontalActiveIndex={setHorizontalActiveIndex}
          horizontalActiveIndex={horizontalActiveIndex}
          verticalActiveIndex={verticalActiveIndex}
          setverticalActiveIndex={setverticalActiveIndex}
          audioPlaying={audioPlaying}
          setAudioPlaying={setAudioPlaying}
          fullscreenRefsX={fullscreenRefsX}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          setIsFullscreen={setIsFullscreen}
          handleOpenPostId={handleOpenPostId}
        />
        : <FeedLayoutHorizontal
          deckOpen={searchDeck ? deckAllowed && Boolean(location.state?.clikbDeck || location.state?.clikbDeckEntrance) : deck.isDeckOpen}

          setsearchDataNav={setsearchDataNav}
          setMyPageIdNav={setMyPageIdNav}
          onVisitProfile={visitCreatorFromGrid}
          initialGridScrollLeft={savedGridScroll?.x}
          setfeedLastIdNav={setfeedLastIdNav}
          setfeedScrollPosNav={setfeedScrollPosNav}


          setShowEmotions={setShowEmotions}
          setLikesPostid={setLikesPostid}
          setLikes={setLikes}

          likedArray={likedArray}
          likeCountArray={likeCountArray}

          setLikedArray={setLikedArray}
          setLikeCountArray={setLikeCountArray}

          MyPageId={0}
          showEmotions={showEmotions}
          /* pass the same variables / refs / callbacks your old code used */
          searchData={searchData}
          vertical={vertical}
          fetchFeedsPagination={fetchFeedsPagination}
          matchMobile={matchMobile}
          isMenuOpen={isMenuOpen}
          audioElementRef={audioElementRef}
          loading={loading}
          error={error}
          feeds={feeds}
          feedContainerRef={feedContainerRef}
          darkModeReducer={darkModeReducer}
          type={type}

          userProfile={userProfile}
          setUserProfile={setUserProfile}
          setminimiseProfile={setminimiseProfile}
          minimiseProfile={minimiseProfile}
          isCropOpen={isCropOpen}
          setIsCropOpen={setIsCropOpen}
          loggedUser={loggedUser}
          MenuOpenb={MenuOpenb}
          setMenuOpenb={setMenuOpenb}
          Zoom1x={Zoom1x}
          setZoom1x={setZoom1x}
          itemRefs={itemRefs}
          minimisePrompt={minimisePrompt}
          itemLoadArray={itemLoadArray}
          setitemLoadArray={setitemLoadArray}
          captionVisibility={captionVisibility}
          captionPadVisibility={captionPadVisibility}
          halt={halt}
          bottomSentinelRef={bottomSentinelRef}
          delayMore={delayMore}
          isFullscreen={isFullscreen}
          storyVidArray={storyVidArray}
          setStoryVidArray={setStoryVidArray}
          closePop={closePop}
          LastId={LastId}
          setLastId={setLastId}
          setVideoArray={setVideoArray}
          videoArray={videoArray}
          AudioArray={AudioArray}
          setAudioArray={setAudioArray}
          generatedAudios={generatedAudios}
          setGeneratedAudios={setGeneratedAudios}
          fullScreenContainerRef={fullScreenContainerRef}
          setHorizontalActiveIndex={setHorizontalActiveIndex}
          horizontalActiveIndex={horizontalActiveIndex}
          verticalActiveIndex={verticalActiveIndex}
          setverticalActiveIndex={setverticalActiveIndex}
          audioPlaying={audioPlaying}
          setAudioPlaying={setAudioPlaying}
          fullscreenRefsX={fullscreenRefsX}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          setIsFullscreen={setIsFullscreen}
          handleOpenPostId={handleOpenPostId}
        />
      }

    </>
  );
});

export default Feedgate;
