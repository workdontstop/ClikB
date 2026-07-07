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
import { Height, Padding } from "@mui/icons-material";

import FeedLayout from './FeedLayout';


import FeedLayoutHorizontal from './FeedLayoutHorizontal';




const CLIK_URL = import.meta.env.VITE_CLIK_URL;

interface FeedItem {
  id: number;
  caption: string;
  username: string;
  profile_image: string;
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



}


interface FeedResponse {
  message: string;
  payload: FeedItem[];
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
  setfeedScrollPosNav
}) => {


  const dispatch = useDispatch();
  const navigate = useNavigate();

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
  const itemRefs = useRef<HTMLDivElement[]>([]);

  const [captionVisibility, setCaptionVisibility] = useState<{
    [key: number]: boolean;
  }>({});

  const timeoutRefs = useRef<{ [key: number]: any }>({});
  const timeoutRefsx = useRef<{ [key: number]: any }>({});
  const timeoutRefsxp = useRef<{ [key: number]: any }>({});

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

      let response: any;

      if (searchData && !vertical) {

        ///window.back();
        const reqDatak = {
          values: {
            id: loggedUser ? loggedUser.id : 0,
            id2: loggedUser ? loggedUser.id : 0,
            searchData,
            typex: type === 1 ? 0 : 1,
          },
        };

        response = await axios.post<FeedResponse>(`${CLIK_URL}/getSearch`, reqDatak);


      } else {

        if (type === 1) {
          response = await axios.post<FeedResponse>(`${CLIK_URL}/getFeed`, reqData);
          // console.log('feed params:', { viewerIdForFav: reqData });

        } else if (type === 2) {
          response = await axios.post<FeedResponse>(
            `${CLIK_URL}/getFeedStory`,
            reqData
          );
        }

        else if (type === 3) {
          response = await axios.post<FeedResponse>(
            `${CLIK_URL}/getFeedsclik`,
            reqData
          );
        }

        else if (type === 4) {
          response = await axios.post<FeedResponse>(
            `${CLIK_URL}/getFeedsFeeds`,
            reqData
          );
        }
        else if (type === 10) {
          response = await axios.post<FeedResponse>(
            `${CLIK_URL}/getProfile`,
            reqData2
          );
        }
      }


      // ... else if ?

      const data = response.data.payload || [];

      console.log(data);
      if (data.length === 0) {
        setHasMore(false);
      }
      console.log(data)
      setFeeds(data);

      setFetchCount(1);
    } catch (err: any) {
      console.error("Error fetching initial feeds:", err);
      setError(err.response?.data?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
      setcallFeeds(false);
    }
  }, [loggedUser, setcallFeeds, setFeeds, type, MyPageId, searchData, vertical]);

  // 2. Pagination: fetchFeedsPagination
  // ADDED an optional parameter to override the lastId
  const fetchFeedsPagination = useCallback(
    async (overrideLastId?: number | null) => {
      if (!hasMore || loading) return;

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
          overrideLastId ?? (feeds.length > 0 ? feeds[feeds.length - ff].id : null);

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
              typex: type === 1 ? 0 : 1,
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
              reqData2


            );

            setViewUserId(MyPageId);
          }

        }
        // else ?

        const newData = response.data.payload || [];
        console.log("New data count:", newData.length);

        if (newData.length === 0) {

          setHasMore(false);
        } else {

          setFeeds((prev: FeedItem[]) => {
            return [...prev, ...newData];
          });

          if (fetchCount >= 3) {
            setFetchCount(0);
          } else {
            setFetchCount((prev) => prev + 1);
          }
        }
      } catch (err: any) {
        console.error("Error fetching more feeds:", err);
        setError(err.response?.data?.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
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
      vertical
    ]
  );



  const location = useLocation();


  // useEffect: initial load, but skip if routelastId != 0
  useLayoutEffect(() => {
    if (callFeeds) {
      // Always clear old data before loading
      setFeeds([]);
      setFetchCount(0);

      // If routelastId is nonzero, skip fetchFeeds, use pagination with override
      if (routelastId && routelastId !== 0) {
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
    location.pathname

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

      if (feeds && feeds.length > 0) {

        if (!callonce) {




          if (FullscreenRoute) {

            if (iconTimeoutRefxlmx.current) {
              clearTimeout(iconTimeoutRefxlmx.current);
            }
            iconTimeoutRefxlmx.current = setTimeout(() => {


              /// alert(routelastId);

              if (vertical) {

                setcallonce(true);
                handleOpenFullscreen(0, true);
              } else {

                if (feedtypeForHorizontalBackNavigate === type) {
                  setcallonce(true);
                  handleOpenFullscreen(0, true);

                }
              }

            }, 600)

          }
        }


      } else {


      }


    }, 200)


  }, [FullscreenRoute, feeds, callFeeds, vertical, feedtypeForHorizontalBackNavigate, type, location, emotionRoute, lastId]);


  // Intersection Observer for pagination
  // 4s window
  const COOLDOWN_MS = 3000;

  const [locked, setLocked] = useState(false);
  // mirror in a ref so the observer callback always sees latest value
  const lockedRef = useRef(false);
  useEffect(() => { lockedRef.current = locked; }, [locked]);

  useEffect(() => {
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
      { threshold: matchMobile ? 0.05 : 0.02 }
    );

    const sentinel = bottomSentinelRef.current;
    if (sentinel) observer.observe(sentinel);

    return () => {
      if (sentinel) observer.unobserve(sentinel);
    };
  }, [fetchFeedsPagination, matchMobile]); // observer unchanged

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
              setCaptionVisibility((prev) => ({ ...prev, [idx]: false }));
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
    if (feeds.length > 0) {
      const handlePopState = () => {
        closePop();
      };

      window.addEventListener("popstate", handlePopState);
      return () => window.removeEventListener("popstate", handlePopState);

    }
  }, [isFullscreen, activeIndexHold, feeds]);


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
      if (e.key === "Escape" && isFullscreen) {
        window.history.back();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

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
          setIsFullscreen(true);
        }

      } else {


        if (!matchMobile && MenuOpenb) {
          setMenuOpenb(false);



          if (not) {
            dispatch(setShowmenuToggle(false));
            setActiveIndexHold(index);
            setActiveIndex(index);
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
          setIsFullscreen(true);
        }
      }
    },
    [isMenuOpen, MenuOpenb, viewUserId, routeUrl]
  );

  // Audio / Video stuff...
  const [horizontalActiveIndex, setHorizontalActiveIndex] = useState<number>(0);
  const [verticalActiveIndex, setverticalActiveIndex] = useState<number>(0);
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
    if (!feeds || feeds.length === 0) return;

    // Update the video array if necessary (your existing logic)
    setVideoArray((prevVideoArray) => {
      if (prevVideoArray.length === feeds.length) {
        let updated = false;
        const newArray = prevVideoArray.map((videoItem, i) => {
          if (!videoItem) {
            updated = true;
            return feeds[i].videoUrl;
          }
          return videoItem;
        });
        return updated ? newArray : prevVideoArray;
      }
      const newArray = feeds.map((feedItem: any, i: any) => {
        if (prevVideoArray[i]) {
          return prevVideoArray[i];
        }
        return feedItem.videoUrl;
      });
      return newArray;
    });

    // Update storyVidArray based on feeds[i].xv1 ... feeds[i].xv8
    setStoryVidArray((prevStoryVidArray) => {
      if (prevStoryVidArray.length === feeds.length) {
        let updated = false;
        const newArray = prevStoryVidArray.map((storyItem, i) => {
          // If there is no story or the current story array is empty,
          // iterate through xv1 to xv8 from the feed and build a new story array.
          if (!storyItem || storyItem.length === 0) {
            const newStoryVideos = [];
            for (let j = 1; j <= 8; j++) {
              const key = 'xv' + j;
              const video = feeds[i][key];

              const keyx = 'x' + j;
              const itemImg = feeds[i][keyx];

              if (itemImg != null) {
                newStoryVideos.push(video);
              }
            }
            // Update only if we got any videos
            if (newStoryVideos.length > 0) {
              updated = true;
              return newStoryVideos;
            }
          }
          // Otherwise, leave the existing story array intact.
          return storyItem;
        });
        return updated ? newArray : prevStoryVidArray;
      }
      // Handle the case when lengths don't match (e.g., new feeds added)
      const newArray = feeds.map((feedItem: any, i: any) => {
        if (prevStoryVidArray[i] && prevStoryVidArray[i].length > 0) {
          return prevStoryVidArray[i];
        }
        const newStoryVideos = [];
        for (let j = 1; j <= 8; j++) {
          const key = 'xv' + j;
          const video = feedItem[key];

          const keyx = 'x' + j;
          const itemImg = feedItem[keyx];

          if (itemImg != null) {
            newStoryVideos.push(video);
          }
        }
        return newStoryVideos;
      });
      return newArray;
    });

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

        // Update videoArray from scratch using videoUrl for each feed


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


    const timerc = setTimeout(() => {
      setitemLoadArray(prev =>
        feeds.map((_: any, i: any) => (prev && prev[i] === true ? true : false))
      );
    }, 500);

  }, [callFeeds, feeds, fetchCount]);



  // Load audio array
  useEffect(() => {
    if (!feeds || feeds.length === 0) return;
    console.log(feeds);
    setAudioArray((prevAudioArray) => {
      if (prevAudioArray.length === feeds.length) {
        let updated = false;
        const newArray = prevAudioArray.map((audioItem, i) => {
          if (!audioItem) {
            updated = true;
            const feedItem = feeds[i];
            return {
              captionSummary: feedItem.captionSummary,
              captionAudio: feedItem.captionAudio,
              xa1: feedItem.xa1,
              xa2: feedItem.xa2,
              xa3: feedItem.xa3,
              xa4: feedItem.xa4,
              xa5: feedItem.xa5,
              xa6: feedItem.xa6,
              xa7: feedItem.xa7,
              xa8: feedItem.xa8,
            };
          }
          return audioItem;
        });
        return updated ? newArray : prevAudioArray;
      }
      const newArray = feeds.map((feedItem: any, i: any) => {
        if (prevAudioArray[i]) {
          return prevAudioArray[i];
        }
        return {
          captionSummary: feedItem.captionSummary,
          captionAudio: feedItem.captionAudio,
          xa1: feedItem.xa1,
          xa2: feedItem.xa2,
          xa3: feedItem.xa3,
          xa4: feedItem.xa4,
          xa5: feedItem.xa5,
          xa6: feedItem.xa6,
          xa7: feedItem.xa7,
          xa8: feedItem.xa8,
        };
      });
      return newArray;
    });
  }, [feeds, verticalActiveIndex]);

  useEffect(() => {
    console.log(videoArray);
  }, [videoArray]);

  // Render
  return (
    <>


      {vertical ?
        <FeedLayout
          setsearchDataNav={setsearchDataNav}
          setMyPageIdNav={setMyPageIdNav}
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
          handleOpenFullscreen={handleOpenFullscreen}
        />
        : <FeedLayoutHorizontal

          setsearchDataNav={setsearchDataNav}
          setMyPageIdNav={setMyPageIdNav}
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
          handleOpenFullscreen={handleOpenFullscreen}
        />
      }

    </>
  );
});

export default Feedgate;
