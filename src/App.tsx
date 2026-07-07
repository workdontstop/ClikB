import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import "./App.css";
import "./theme.css";
import axios from "axios";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "./store";
import { toggleDarkMode } from "./settingsSlice";
import { setLoggedUser } from "./profileSlice";
import MenuToggle from "./MenuToggle";
import ProfileInfo from "./ProfileInfo";

import Box from "@mui/material/Box";

import ThumbnailYoutube from "./ThumbnailYoutube";

import EmotionsGate from "./EmotionsGate";

import { setLogin } from "./settingsSlice";


import MenuIcon from '@mui/icons-material/Menu';

import MenuSlider from "./MenuSlider";

import { GoogleLogin, CredentialResponse } from '@react-oauth/google'; // Import GoogleLogin isme
import { jwtDecode } from "jwt-decode";

import { matchMobile } from "./DetectDevice";

import Images from "./Images";
import Settings from "./Settings";
import Clikit from "./Clikit";
import Mypage from "./Mypage";

import PrivacyPolicy from "./PrivacyPolicy";

import Audio from "./Audio";

import Kickit from "./Kickit";
import Feeds from "./Feeds";

import Homepage from "./Homepage";
import ClikBateFooter from "./ClikBateFooter";

import Footer from "./Footer";


import Home from "./Home";

// 1) ADDED: Import useLocation scale MenuToggle
import { Routes, Route, useLocation } from "react-router-dom";

import { useNavigate } from 'react-router-dom';


import BottomMenu from "./BottomMenu";
import FirstLoader from "./FirstLoader";
import MagicMirror from "./MagicMirror";
import { GlobalBrainstormVoice } from "./components/GlobalBrainstormVoice";
import { BrainstormSessionProvider } from "./components/BrainstormSessionProvider";
import { patchUserSnapshot, recordUserAction } from "./brainstormSlice";
import MiloVerseDemo from "./MiloVerseDemo";

const SNAPSHOT_TEXT_LIMIT = 1500;

const getSnapshotPageName = (pathname: string): string => {
  const route = pathname.toLowerCase();
  if (route.includes('magicmirror')) return 'MagicMirror';
  if (route.includes('images')) return 'Images';
  if (route.includes('kickit')) return 'Stories';
  if (route.includes('clikit')) return 'Interactions';
  if (route.includes('feeds')) return 'Feeds';
  if (route.includes('pages')) return 'Profile';
  if (route.includes('settings')) return 'Settings';
  if (route === '/') return 'Home';
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


  const VITE_CLIK_URL = import.meta.env.VITE_CLIK_URL;



  useEffect(() => {
    console.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', VITE_CLIK_URL);

  }, [VITE_CLIK_URL]);



  const dispatch = useDispatch<AppDispatch>();


  const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
  const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

  const isBrainstormChatOpen = useSelector((state: RootState) => state.brainstorm.isChatOpen);
  const snapshotPrompt = useSelector((state: RootState) => state.settings.prompt);
  const snapshotArtstyle = useSelector((state: RootState) => state.settings.artstyle);
  const snapshotModel = useSelector((state: RootState) => state.settings.model);
  const snapshotAspectRatio = useSelector((state: RootState) => state.settings.aspectRatio);

  const [isMenuOpen, setIsMenuOpen] = useState(matchMobile ? false : true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [callFeeds, setcallFeeds] = useState(false);
  const [AllowPing, setAllowPing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [fluxLoaded, setFluxLoaded] = useState(true);
  const [hasAutoRedirected, setHasAutoRedirected] = useState(false);

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


  const feedContainerRef = useRef<HTMLDivElement | null>(null);



  const [isCropOpen, setIsCropOpen] = useState(false);

  const [allowUploadText, setallowUploadText] = useState(false);



  const [MenuOpenb, setMenuOpenb] = useState(false);

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

  const [Likes, setLikes] = useState(true);

  const [LikesPostid, setLikesPostid] = useState(0);

  // 4) Helper to map route -> menu index
  const getIndexFromPath = (pathname: string) => {
    switch (pathname) {
      case "/MagicMirror":
        return 0; // Quick Mode
      case "/uploadxxjhg":
      case "/uploadxxxxs":
        return 1; // Create
      case "/clikit":
        return 2; // Interactions
      case "/images":
        return 3; // Memes
      case "/kickit":
        return 4; // Stories
      case "/pages":
        return 5; // My Page
      case "/feeds":
      case "/Feeds":
        return 6; // All Feeds
      case "/":
        return 7; // HomePage
      case "/settings":
        return 8; // Settings
      default:
        return -1;
    }
  };

  // Old
  // const [GeneratedImage, setGeneratedImage] = useState('');

  // New
  const [GeneratedImage, setGeneratedImage] = useState<string[]>([]);


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

  /* 1ï¸âƒ£ On mount â€“ clean up the URL saved from the *previous* session */
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
    // 1ï¸âƒ£ keep nav state in sync
    setActiveIndex(getIndexFromPath(location.pathname));

    // 2ï¸âƒ£ recycle the previously-saved S3 object, if any
    const oldUrl = localStorage.getItem(LOCAL_KEY);
    if (oldUrl) {
      ///  startDelete(oldUrl);           // â† delete the one stored last session
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


  const [minimisePrompt, setminimisePrompt] = useState(true); // Tracks which image is on top
  const [instantCall, setinstantCall] = useState(false);

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

  const mobileDocumentScrollRoutes = ["/", "/images", "/kickit", "/clikit", "/feeds", "/pages"];
  const useMobileDocumentScroll =
    matchMobile && mobileDocumentScrollRoutes.includes(location.pathname.toLowerCase());

  useEffect(() => {
    const promptText = String(snapshotPrompt || '');
    dispatch(patchUserSnapshot({
      route: `${location.pathname}${location.search}${location.hash}`,
      pageName: getSnapshotPageName(location.pathname),
      device: matchMobile ? 'mobile' : 'desktop',
      loggedUserName: loggedUser?.username || loggedUser?.name || 'Guest',
      ui: {
        isMenuOpen,
        minimisePrompt,
        isBrainstormChatOpen,
      },
      app: {
        prompt: trimSnapshotText(promptText),
        promptLength: promptText.length,
        artstyle: String(snapshotArtstyle || ''),
        model: String(snapshotModel || ''),
        aspectRatio: Number(snapshotAspectRatio) || 1,
      },
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
  ]);

  useEffect(() => {
    const handleSnapshotClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

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
  }, [dispatch, location.pathname, location.search, location.hash]);


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
      if (e.touches.length !== 1) { watching = false; return; }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      const verticalScroller = getVerticalScroller(e.target);
      watching = getScrollTop() <= 0 && (!verticalScroller || verticalScroller.scrollTop <= 0);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!watching || e.touches.length !== 1) return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;
      const verticalScroller = getVerticalScroller(e.target);
      // Block only the downward top-edge pull that triggers browser refresh.
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



  const APP_STATE = import.meta.env.VITE_APPX_STATE;


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
    // (Your existing code for day/night theme)
    const timer = setTimeout(() => {
      const hour = new Date().getHours();
      const isDayTime = hour >= 6 && hour < 18;
      if (!isDayTime && darkModeReducer) {
        dispatch(toggleDarkMode());
      } else if (isDayTime && !darkModeReducer) {
        dispatch(toggleDarkMode());
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [darkModeReducer]);

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
        name: `${guestUser.payload.userfirstname} ${guestUser.payload.usersurname}`,
        username: guestUser.payload.username,
        image: guestUser.payload.userimage,
        imageThumb: guestUser.payload.userimage,
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


      if (APP_STATE !== 'prod') {
        navigate({ pathname: '/MagicMirror', search: location.search }, { replace: true });


      } else {



        if (loggedUser.id === 1) {
          navigate({ pathname: '/MagicMirror', search: location.search }, { replace: true });

        }


      }

      return guestUser;
    } catch (error) {
      console.error("Error during guest login:", error);
      throw new Error("Unable to login as guest");
    }
  };


  const Signup = async (email: string) => {


    var dataHold = {
      email: email,
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
      navigate({ pathname: '/MagicMirror', search: location.search }, { replace: true });



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


  const Loginxx = async (email: string) => {


    var dataHold = {
      email: email,
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
      navigate({ pathname: '/MagicMirror', search: location.search }, { replace: true });



      // Optionally return the googleUser data
      return googleUser;

    } catch (error: any) {
      ///alert("Guest login failed");
      console.error("Error during guest login:", error);

      console.log(error.response.data.message);

      if (error.response.data.message === 'No user found') {

        Signup(email);

      }

      throw new Error("Unable to login as google user");

    }
  }











  // Handler for successful login
  const handleLoginSuccess = async (credentialResponse: CredentialResponse) => {
    if (credentialResponse.credential) {

      console.log(credentialResponse);
      // Decode the JWT token to get user information
      const decoded: any = await jwtDecode(credentialResponse.credential);



      console.log(decoded.email);



      Loginxx(decoded.email);


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
      <BrainstormSessionProvider clikUrl={CLIK_URL}>

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
                {MenuOpenb && !matchMobile ?
                  <Box


                    onClick={() => {
                      setMenuOpenb(false)
                    }}

                    sx={{
                      height: '100vh', width: '100%', position: 'fixed', top: '0vh',
                      backgroundColor: '', zIndex: '1',
                      cursor: 'pointer'
                    }} >



                  </Box > : null

                }


                {isMenuOpen && matchMobile ?
                  <Box


                    onClick={() => {
                      setIsMenuOpen(false)
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
                    setMenuOpenb={setMenuOpenb}          // â† added
                    setIsMenuOpen={setIsMenuOpen}
                    setminimisePrompt={setminimisePrompt} // â† added
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
          className={`${darkModeReducer ? "menudark" : "menu"} ${(isMenuOpen && !location.pathname.toLowerCase().includes('magicmirror')) ? "menu-open" : "menu-closed"
            }`}
          style={{
            display: location.pathname.toLowerCase().includes('magicmirror') ? 'none' : '',
            caretColor: 'transparent !important',
            outline: 'none',
            position: matchMobile ? 'fixed' : 'static',
            top: matchMobile ? '0vh' : '0vh',
            zIndex: matchMobile ? 2 : undefined,
            overflow: 'auto',
            backgroundColor: matchMobile ? 'rgb(255,255,255,0)' : ''


          }}

        >



          {

            matchMobile ? null :

              <ProfileInfo
                setShowEmotions={setShowEmotions}
                setfollowType={setfollowType}

                isFullscreen1={isFullscreen1}
                isFullscreen2={isFullscreen2}
                isFullscreen3={isFullscreen3}



                isFullscreen={isFullscreen}
                setIsFullscreen={setIsFullscreen}

                setShowThumb={setShowThumb}
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
          }


          {/*
          Pass activeIndex & setActiveIndex down font
          so MenuSlider can highlight the right item
        */}
          <MenuSlider
            setShowThumb={setShowThumb}

            setminimisePrompt={setminimisePrompt}  // â† add this
            type={0}
            isFullscreen={isFullscreen}
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
          className={`${darkModeReducer ? "contentdark" : "content"} ${(isMenuOpen && !location.pathname.toLowerCase().includes('magicmirror')) ? "content-with-menu" : "content-full"
            }`}
          style={{
            padding: "0px", caretColor: 'transparent !important',
            outline: 'none',
            position: !minimisePrompt ? 'relative' : undefined,
            zIndex: !minimisePrompt ? 999 : undefined
          }}
        >



          {







            matchMobile ? null :

              isMenuOpen ? null :

                MenuOpenb ?
                  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€  MENU VISIBLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
                  <div
                    style={{
                      position: 'fixed',
                      top: '0vh',
                      width: '18vw',
                      zIndex: 20,
                      overflow: 'auto',
                      backgroundColor: 'rgba(255,255,255,0)',
                    }}
                  >
                    <MenuSlider
                      setShowThumb={setShowThumb}
                      setminimisePrompt={setminimisePrompt}  // â† add this
                      type={1}
                      isFullscreen={isFullscreen}
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

                />
              }
            />




            <Route
              path="/privacy-policy"
              element={
                <PrivacyPolicy />
              }
            />



            <Route
              path="/feeds"
              element={
                <Feeds
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
                />
              }
            />

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
                />
              }
            />


            <Route
              path="/"
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


            <Route path="/MagicMirror" element={
              <MagicMirror
                handleLoginSuccess={handleLoginSuccess}
                handleLoginError={handleLoginError}
                setminimisePrompt={setminimisePrompt}
                hasAutoRedirected={hasAutoRedirected}
                setHasAutoRedirected={setHasAutoRedirected}
                instantCall={instantCall}
                setinstantCall={setinstantCall}
              />
            } />
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

            minimisePrompt ?


              !location.pathname.toLowerCase().includes('magicmirror') && (


                <MenuToggle
                  isCropOpen={isCropOpen}

                  minimisePrompt={minimisePrompt}
                  setminimisePrompt={setminimisePrompt}
                  setIsFullscreen={setIsFullscreen}
                  isFullscreen={isFullscreen}
                  loggedUser={loggedUser}
                  isMenuOpen={isMenuOpen}
                  setIsMenuOpen={setIsMenuOpen}
                  isInitialLoad={isInitialLoad}
                />
              )


              : null
          }







        </div>






        {
          (HideBottom || location.pathname.toLowerCase().includes('magicmirror')) ? null :
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

                Â© {new Date().getFullYear()} Clikbâ„¢
              </a>

            </div>
        }



        {
          CLIK_URL ? (
            <GlobalBrainstormVoice
              clikUrl={CLIK_URL}
              isMenuOpen={isMenuOpen}
              minimisePrompt={minimisePrompt}
              matchMobile={matchMobile}
            />
          ) : null
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
          HideBottom || !isMenuOpen || location.pathname.toLowerCase().includes('magicmirror') ? null : <div style={{ position: 'absolute', bottom: matchMobile ? '-2vh' : '-1vh', textAlign: 'left', }}>

            <Footer />
          </div>
        }







      </BrainstormSessionProvider>
    </div >
  );
}

export default App;
