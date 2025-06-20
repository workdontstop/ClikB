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



const CLIK_URL = import.meta.env.VITE_CLIK_URL;


interface FeedItem {
  id: number;
  caption: string;
  username: string;
  profile_image: string;
  sender: number;

  // Existing fields
  x1?: string;
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
  videoUrl?: String;

  xh1?: string;
  xh2?: string;
  xh3?: string;
  xh4?: string;
  xh5?: string;
  xh6?: string;
  xh7?: string;
  xh8?: string;

  xv1?: string;
  xv2?: string;
  xv3?: string;
  xv4?: string;
  xv5?: string;
  xv6?: string;
  xv7?: string;
  xv8?: string;



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
  x,
  minimisePrompt
}) => {
  const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const iconTimeoutRefa = useRef<NodeJS.Timeout | null>(null);
  const iconTimeoutRefax = useRef<NodeJS.Timeout | null>(null);

  const iconTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const iconTimeoutRefx = useRef<NodeJS.Timeout | null>(null);
  const iconTimeoutRefx2 = useRef<NodeJS.Timeout | null>(null);
  const iconTimeoutRefxl = useRef<NodeJS.Timeout | null>(null);
  const iconTimeoutRefxlm = useRef<NodeJS.Timeout | null>(null);

  const [Zoom1x, setZoom1x] = useState(false);

  const darkModeReducer = useSelector(
    (state: RootState) => state.settings.darkMode
  );

  // Component State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [fetchCount, setFetchCount] = useState(0);
  const [Viewing, setViewing] = useState(-1);

  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

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
        },
      };

      let response: any;
      if (type === 1) {
        response = await axios.post<FeedResponse>(`${CLIK_URL}/getFeed`, reqData);
      } else if (type === 2) {
        response = await axios.post<FeedResponse>(
          `${CLIK_URL}/getFeedStory`,
          reqData
        );
      }

      else if (type === 3) {
        response = await axios.post<FeedResponse>(
          `${CLIK_URL}/getFeedClik`,
          reqData
        );
      }
      else if (type === 10) {
        response = await axios.post<FeedResponse>(
          `${CLIK_URL}/getProfile`,
          reqData2
        );
      }
      // ... else if ?

      const data = response.data.payload || [];
      if (data.length === 0) {
        setHasMore(false);
      }
      setFeeds(data);
      setFetchCount(1);
    } catch (err: any) {
      console.error("Error fetching initial feeds:", err);
      setError(err.response?.data?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
      setcallFeeds(false);
    }
  }, [loggedUser, setcallFeeds, setFeeds, type, MyPageId]);

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
            lastId: lastIdValue,
            overrideLastId: overrideLastId,
          },
        };

        console.log("Fetching more feeds. Type:", type);
        console.log("Request data:", reqData);

        let response: any;
        if (type === 1) {


          response = await axios.post<FeedResponse>(
            `${CLIK_URL}/getFeedMore`,
            reqData
          );
        } else if (type === 2) {
          response = await axios.post<FeedResponse>(
            `${CLIK_URL}/getFeedMoreStory`,
            reqData
          );
        } else if (type === 10) {

          response = await axios.post<FeedResponse>(
            `${CLIK_URL}/getProfileMore`,
            reqData2
          );
        }
        // else ?

        const newData = response.data.payload || [];
        console.log("New data count:", newData.length);

        if (newData.length === 0) {

          setHasMore(false);
        } else {
          setFeeds((prev: FeedItem[]) => {
            const combined = [...prev, ...newData];
            //alert(fetchCount);
            if (fetchCount >= 3) {
              setFetchCount(0);

              const feedContainer = feedContainerRef.current;

              setTimeout(() => {
                feedContainer.scrollTo({
                  top: 0,
                  behavior: "instant",
                });
              }, 1000)



              setVideoArray([]);
              setCaptionVisibility([]);

              return combined.slice(-25);



            }
            return combined;
          });
          setFetchCount((prev) => prev + 1);
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
      matchMobile
    ]
  );

  // useEffect: initial load, but skip if routelastId != 0
  useLayoutEffect(() => {
    if (callFeeds) {
      if (iconTimeoutRef.current) {
        clearTimeout(iconTimeoutRef.current);
      }
      iconTimeoutRef.current = setTimeout(() => {
        // Always clear old data before loading
        setFeeds([]);
        setFetchCount(0);


        // If routelastId is nonzero, skip fetchFeeds, use pagination with override
        if (routelastId && routelastId !== 0) {

          /// alert(routelastId);
          setcallFeeds(false);
          //alert(routelastId);
          fetchFeedsPagination(routelastId);

        } else {
          setHasMore(true);
          // Normal initial load
          fetchFeeds();
        }
      }, 700);
    }
  }, [
    callFeeds,
    routelastId
  ]);

  // Keep track of lastId
  useEffect(() => {

    if (feeds && feeds.length > 0) {
      setLastId(feeds[0].id);
      /// alert(feeds[0].id);
    }
  }, [feeds, setLastId,]);


  const [callonce, setcallonce] = useState(false);


  const location = useLocation();



  useEffect(() => {
    if (iconTimeoutRefx2.current) {
      clearTimeout(iconTimeoutRefx2.current);
    }
    iconTimeoutRefx2.current = setTimeout(() => {
      setcallonce(false);

    }, 500)
  }, [location.pathname]);


  const FullscreenRoute = location.state && location.state.fullscreen === true;

  useEffect(() => {
    if (feeds && feeds.length > 0) {
      if (iconTimeoutRefxlm.current) {
        clearTimeout(iconTimeoutRefxlm.current);
      }
      iconTimeoutRefxlm.current = setTimeout(() => {


        if (!callonce) {


          setcallonce(true);
          if (FullscreenRoute) {

            setTimeout(() => {
              /// alert(routelastId);
              handleOpenFullscreen(0, true);
            }, 1500)

          }

        } else {


        }

      }, 100)
    }

  }, [FullscreenRoute, feeds,]);


  // Intersection Observer for pagination
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          fetchFeedsPagination();
        }
      },
      { threshold: 0.1 }
    );

    const sentinel = bottomSentinelRef.current;
    if (sentinel) observer.observe(sentinel);

    return () => {
      if (sentinel) observer.unobserve(sentinel);
    };
  }, [fetchFeedsPagination]);



  // IntersectionObserver for caption visibility
  useEffect(() => {
    const xx = matchMobile ? feeds.length === 1 ? 0.2 : 0.6 : isMenuOpen ? 0.6 : 0.6;
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
              }, 25000);
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
      if (!feedContainerRef.current) return;

      // Detecting scroll position using the ref
      const scrollTop = feedContainerRef.current.scrollTop;

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

    // Attaching the scroll listener to the container ref
    const container = feedContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
    };
  }, [minimiseProfile, feeds, callFeeds]);


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
            const feedContainer = feedContainerRef.current;
            const itemEl = itemRefs.current[Viewing];
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
          }, 1500);
        }
      }
    }
  }, [isMenuOpen]);

  useEffect(() => {
    if (closingIndex != null) {
      const feedContainer = feedContainerRef.current;
      const itemEl = itemRefs.current[closingIndex];
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
      setClosingIndex(null);
    }
  }, [closingIndex]);

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
              const currentState = location.state || {};

              // Merge the current state with the fullscreen flag
              const newState = { ...currentState, fullscreen: true };

              // Navigate to the same URL with the updated state
              navigate(window.location.pathname, { state: newState });

            }, 20);

          }



          dispatch(setShowmenuToggle(false));
          setActiveIndexHold(index);
          setActiveIndex(index);
          setIsFullscreen(true);
        }
      }
    },
    [isMenuOpen, MenuOpenb]
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


      {/* Main Feed Layout */}
      <Box
        width="100%"
        p={matchMobile ? (isMenuOpen ? 1 : 0) : 2}
        style={{ padding: 0 }}
      >





        <audio
          ref={audioElementRef}
          style={{ display: "none" }}
        />

        {loading && (
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            my={4}
            style={{ display: "none" }}
          >
            <CircularProgress size={48} />
          </Box>
        )}

        {error && (
          <Box mt={2} textAlign="center" style={{ display: "none" }}>
            <Typography variant="body1" color="error">
              {error}
            </Typography>
          </Box>
        )}

        {feeds.length > 0 && (
          <Box
            className={darkModeReducer ? "contentdarkcolor" : "contentcolor"}
            ref={feedContainerRef}
            sx={{
              maxHeight: "100vh",
              overflowY: "auto",
              overflowX: "hidden",
              scrollBehavior: "smooth",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
              boxSizing: "border-box",
              width: "100%",
              padding: matchMobile
                ? isMenuOpen
                  ? "0px"
                  : "0px"
                : isMenuOpen
                  ? "16px"
                  : "1vh",
              "&::-webkit-scrollbar": {
                width: "8px",
              },
              "&::-webkit-scrollbar-track": {
                background: "#f1f1f1",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "#888",
                borderRadius: "4px",
              },
              "&::-webkit-scrollbar-thumb:hover": {
                background: "#555",
              },
            }}
          >



            {

              matchMobile && type === 10 || !isMenuOpen && type === 10 ?
                <>   <ProfileInfo
                  userProfile={userProfile}
                  setUserProfile={setUserProfile}
                  setminimise={setminimiseProfile}
                  minimise={minimiseProfile}
                  isCropOpen={isCropOpen}
                  setIsCropOpen={setIsCropOpen}
                  feeds={feeds}
                  loggedUser={loggedUser} isMenuOpen={isMenuOpen} x={x}
                  MenuOpenb={MenuOpenb}
                  setMenuOpenb={setMenuOpenb}
                />


                  <img

                    onMouseEnter={() => setZoom1x(true)}
                    onMouseOver={() => setZoom1x(true)}
                    onMouseLeave={() => setZoom1x(false)}

                    onTouchStart={() => setZoom1x(true)}
                    onTouchEnd={() => setZoom1x(false)}
                    onClick={

                      () => {

                        setZoom1x(true);
                        setTimeout(() => setZoom1x(false), 300);
                        const feedContainer = feedContainerRef.current;


                        feedContainer.scrollTo({
                          top: 0,
                          behavior: "instant",
                        });


                        setminimiseProfile(false);
                      }


                    }


                    /*
                  
                    data-src={ }
                  
                  src={
                    userProfile.profilePicThumb
                      ? `${userProfile.profilePicThumb}`
                      : `${userProfile.profilePic}`
                  }*/

                    src={
                      userProfile.profilePic
                        ? `${userProfile.profilePic}`
                        : ""
                    }
                    alt={

                      userProfile.username
                        ? `${userProfile.username}'s profile`
                        : "Profile"
                    }
                    style={{
                      position: 'fixed',
                      top: matchMobile ? '5vh' : '9vh',
                      left: matchMobile ? '0vw' : '2.5vw',
                      transform:
                        matchMobile ? minimiseProfile ? Zoom1x ? 'scale(1.3)' : 'scale(0.8)' : 'scale(0)' :

                          minimiseProfile ? Zoom1x ? 'scale(1.3)' : 'scale(0.9)' : 'scale(0)',
                      marginLeft: minimiseProfile ? matchMobile ? '2vw' : '0px' : matchMobile ? '2vw' : '0px',
                      cursor: "pointer",
                      transition: isMenuOpen
                        ? "transform 0.2s ease-in-out"
                        : "transform 0.2s ease-in-out",
                      borderRadius: "50%",
                      width: "80px",
                      height: "80px",
                      zIndex: 2000,

                      marginTop: matchMobile ? minimiseProfile ? '-5vh' : '' : minimiseProfile ? '-8vh' : ''
                    }}
                    className="profile-image"
                  />

                </> : null

            }
            <Grid
              container
              spacing={matchMobile ? type === 10 ? 0.3 : 1.1 :
                isMenuOpen ? 2 : 4}

              sx={{
                margin: 0,
                // <-- here, use "pl" (paddingLeft) with the same logic
                p: matchMobile ? (type === 10 ? 0 : 1.5) : isMenuOpen ? 0 : 4,
              }}

            >




              <AnimatePresence>
                {feeds.map((item: FeedItem, idx: number) => {
                  const storyImages =
                    type === 2 || type === 10 || type === 1
                      ? [item.x1, item.x2, item.x3, item.x4, item.x5, item.x6,
                      item.x7, item.x8,].filter(Boolean)
                      : [];

                  const feedx = feeds[idx];
                  /// console.log('jjjjjjjjjjj', feedx.mode)

                  return (
                    <Grid
                      ref={(el) => {
                        if (el) itemRefs.current[idx] = el;
                      }}
                      data-index={idx}
                      key={`${item.id}${idx}`}
                      size={{
                        xs: feeds.length === 1 ? 12 : type === 10 ? 4 : 6,
                        sm: isMenuOpen ? feeds.length === 1 ? 6 : 6 : 4,
                        md: isMenuOpen ? feeds.length === 1 ? 3 : 3 : 2
                      }}
                      component={motion.div}
                      style={{ padding: feeds.length === 1 && matchMobile ? '10vw' : '0px' }}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{
                        duration: matchMobile ? 0.6 : 0.6,
                        ease: "easeInOut",
                      }}
                    >
                      <Card
                        sx={{
                          position: "relative",
                          borderRadius: matchMobile ?
                            type === 10 ? 0 : 2
                            : 2,
                          overflow: "hidden",
                          boxShadow: 3,
                          transition: "transform 0.3s, box-shadow 0.3s",
                          minHeight: 100,
                          "&:hover": {
                            transform: "scale(1.02)",
                            boxShadow: 6,
                          },
                        }}
                      >
                        {/* Story Mode */}
                        <StoryAutoScroller
                          minimisePrompt={minimisePrompt}
                          itemLoadArray={itemLoadArray}
                          setitemLoadArray={setitemLoadArray}
                          videoUrl={item.videoUrl}
                          videoUrlItem={item.xv2}
                          videoUrlItem2={item.xv3}
                          MenuOpenb={MenuOpenb}
                          idx={idx}
                          captionVisibility={captionVisibility}
                          isMenuOpen={isMenuOpen}
                          image={item.item1}
                          images={storyImages}
                          caption={item.caption}
                          onClick={() => handleOpenFullscreen(idx, false)}
                          type={type}
                        />

                        {/* Caption – only show if captionVisibility[idx] is true */}
                        {captionVisibility[idx] && (
                          <Box
                            sx={{
                              position: "absolute",
                              bottom: matchMobile ? '0vh' : '0vh',
                              left: 0,
                              width: "100%",

                              color: "#fff",
                              padding: "0px",
                              paddingLeft: "1vw",
                              paddingBottom: matchMobile ? "2.5vh" : "3vh",
                              p: isMenuOpen ? 1 : matchMobile ? 1 : 1,
                              boxSizing: "border-box",
                              visibility: halt ? "hidden" : "visible",
                              display:
                                matchMobile && isMenuOpen
                                  ? "none"
                                  : type === 2 ? "none" :
                                    feedx.mode === 1 ? 'none' : 'block',
                            }}
                          >
                            <Typography
                              variant="body1"
                              sx={{
                                fontFamily: '"Roboto", sans-serif',
                                fontSize: matchMobile
                                  ? isMenuOpen
                                    ? "0.75rem"
                                    : "1.3rem"
                                  : isMenuOpen
                                    ? "1.6rem"
                                    : "1.8rem",
                                width: "100%",
                                opacity: 1,
                                textAlign: "left",


                                /* → Remove any whiteSpace: "nowrap" or textOverflow here. */
                                /* Keep wordWrap/breaking so super-long words still wrap. */
                                wordBreak: "break-word",
                                textShadow: "2px 2px 4px rgba(0, 0, 0, 1)",
                                margin: "0 auto",
                                padding: "0px",
                                fontWeight: matchMobile ? 400 : 400,

                                /* ─── START: multiline clamp rules ─── */
                                display: "-webkit-box",
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 2,
                                overflow: "hidden",
                                /* ───  END:   multiline clamp rules ─── */
                              }}
                            >
                              <span style={{
                                background:
                                  darkModeReducer ?

                                    'linear-gradient(to bottom, rgba(70, 70, 70, 0) 0%, rgba(70, 70, 70, 0.7) 50%, rgba(70, 70, 70, 0) 100%)'
                                    :
                                    'linear-gradient(to bottom, rgba(90, 90, 100, 0) 0%, rgba(90, 90, 100, 0.7) 50%, rgba(90, 90, 100, 0) 100%)',
                              }}>

                                <>

                                  {isMenuOpen
                                    ? item.caption.length > 40
                                      ? `${item.caption.slice(0, 40)}...`
                                      : item.caption
                                    : matchMobile
                                      ? item.caption.length > 30
                                        ? `${item.caption.slice(0, 30)}...`
                                        : item.caption
                                      : item.caption.length > 40
                                        ? `${item.caption.slice(0, 40)}...`
                                        : item.caption}
                                </>
                              </span>
                            </Typography>



                          </Box>
                        )}
                      </Card>
                    </Grid>
                  );
                })}
              </AnimatePresence>
            </Grid>
            {/* Sentinel triggers pagination type === 10*/}
            <div
              ref={bottomSentinelRef}
              style={{
                backgroundColor: 'red',
                height: matchMobile ? "55vh" :
                  isMenuOpen ? '30vh' :
                    '60vh',


                background: "transparent", display: delayMore ? 'none' : 'block'
              }}
            />
          </Box >
        )}

        {
          !loading && feeds.length === 0 && !error && (
            <Box mt={2} textAlign="center" style={{ marginTop: '10vh' }}  >
              <Typography variant="body1">No feeds available.</Typography>
            </Box>
          )
        }
      </Box >

      {/* Fullscreen overlay */}
      {
        isFullscreen ? (
          <FullScreenStories
            storyVidArray={storyVidArray}
            setStoryVidArray={setStoryVidArray}
            closePop={closePop}
            type={type}
            isMenuOpen={isMenuOpen}
            feedContainerRef={feedContainerRef}
            LastId={LastId}
            setLastId={setLastId}
            setVideoArray={setVideoArray}
            videoArray={videoArray}
            audioElementRef={audioElementRef}
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
            feeds={feeds}
            activeIndex={activeIndex}
            setActiveIndex={setActiveIndex}
            setIsFullscreen={setIsFullscreen}
            IsFullscreen={isFullscreen}
          />
        ) : null
      }
    </>
  );
});

export default Feedgate;
