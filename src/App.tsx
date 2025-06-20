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

import MenuIcon from '@mui/icons-material/Menu';

import MenuSlider from "./MenuSlider";

import { GoogleLogin, CredentialResponse } from '@react-oauth/google'; // Import GoogleLogin
import { jwtDecode } from "jwt-decode";

import { matchMobile } from "./DetectDevice";

import Images from "./Images";
import Settings from "./Settings";
import Clikit from "./Clikit";
import Mypage from "./Mypage";

import PrivacyPolicy from "./PrivacyPolicy";

import Audio from "./Audio";

import Kickit from "./Kickit";
import ClikBateFooter from "./ClikBateFooter";

import Footer from "./Footer";


import Home from "./Home";

// 1) ADDED: Import useLocation
import { Routes, Route, useLocation } from "react-router-dom";
import { match } from "assert";
import BottomMenu from "./BottomMenu";


function App() {
  const CLIK_URL = import.meta.env.VITE_CLIK_URL;
  const dispatch = useDispatch<AppDispatch>();


  const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
  const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [callFeeds, setcallFeeds] = useState(false);
  const [AllowPing, setAllowPing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [fluxLoaded, setFluxLoaded] = useState(true);


  const [HideBottom, setHideBottom] = useState(false);

  const [isSubmittingKick, setIsSubmittingKick] = useState<boolean>(false); // To handle loading state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false); // To handle loading state

  const iconTimeoutRefa = useRef<NodeJS.Timeout | null>(null);

  const iconTimeoutRefax = useRef<NodeJS.Timeout | null>(null);

  interface FeedItem {
    id: number;
    caption: string;
    item1: string;
    time: string;
  }

  const [feeds, setFeeds] = useState<FeedItem[]>([]);
  const [LastId, setLastId] = useState(0);



  const feedContainerRef = useRef<HTMLDivElement | null>(null);



  const [isCropOpen, setIsCropOpen] = useState(false);

  const [allowUploadText, setallowUploadText] = useState(false);

  const [x, setx] = useState(false);

  const [MenuOpenb, setMenuOpenb] = useState(false);

  const [Zoom1x, setZoom1x] = useState(false);

  // 2) ADDED: Provide a route-based default: we can still default to 2 for "Visualize"
  const [activeIndex, setActiveIndex] = useState(2);

  // 3) ADDED: Access the current location
  const location = useLocation();


  // 4) Helper to map route -> menu index
  const getIndexFromPathOld = (pathname: string) => {
    switch (pathname) {
      case "/pages":
        return 0;

      case "/clikit":
        return 1; // "Visualize" => Kickit
      case "/interactions":


      case "/":
        return 2; // "Visualize" => Kickit
      case "/images":
        return 3;
      case "/Audio":
        return 4;
      case "/settings":
        return 5;
      default:
        return 1; // fallback to "Visualize"
    }
  };

  // 4) Helper to map route -> menu index
  const getIndexFromPath = (pathname: string) => {
    switch (pathname) {
      case "/pages":
        return 0;

      case "/clikit":
        return 1;

      case "/":
        return 2;

      case "/images":
        return 3;

      case "/settings":
        return 4;
      default:
        return 2; // fallback to "Visualize"
    }
  };


  useEffect(() => {
    /*  const { hostname, pathname } = window.location;
      if (hostname === "clikbate.com" && pathname === "/") {
        window.location.replace("https://www.clikbate.com");
  
  
      }*/
  }, []);

  const { userId } = location.state || {};

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


  // 5) ADDED: Whenever pathname changes, set the activeIndex
  useEffect(() => {

    setActiveIndex(getIndexFromPath(location.pathname));


    setTimeout(() => {




    }, 2000)

  }, [location.pathname, loggedUser]);

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





  useEffect(() => {
    const el = feedContainerRef.current;
    if (!el) return;

    const onScroll = () => {
      // force the browser to think the page scrolled
      window.scrollTo(0, 1);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    // initial nudge in case they don’t scroll right away
    window.scrollTo(0, 1);

    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  const minipromptRefx2 = useRef<NodeJS.Timeout | null>(null);



  useEffect(() => {
    ///clikt
    // Skip if already minimised to prevent unnecessary re-calls

    minipromptRefx2.current = setTimeout(() => {
      setminimisePrompt(true);
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
      if (isDayTime && darkModeReducer) {
        dispatch(toggleDarkMode());
      } else if (!isDayTime && !darkModeReducer) {
        dispatch(toggleDarkMode());
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [darkModeReducer]);

  const delaymenu = matchMobile ? 10 : 10;

  useEffect(() => {
    // (Your existing code that triggers initial feed & login)
    const timer = setTimeout(() => {
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

      // Optionally return the googleUser data
      return googleUser;

    } catch (error) {
      ///alert("Guest login failed");
      console.error("Error during google signup:", error);
      throw new Error("Unable to signup as google user");
    }
  }


  const [minimisePrompt, setminimisePrompt] = useState(false); // Tracks which image is on top


  const [minp, setminp] = useState(false); // Tracks which image is on top


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
    <div className="app-container" style={{ padding: "0px", }}>


      {
        isMenuOpen && !matchMobile ? null :

          HideBottom ? null : <BottomMenu
            openMenuPc={openMenuPc}
            isMenuOpen={isMenuOpen}
            MenuOpenb={MenuOpenb}
            setIsMenuOpen={setIsMenuOpen}
            type={0}
            isFullscreen={isFullscreen}
            setx={setx}
            feedContainerRef={feedContainerRef}
            activeIndex={activeIndex}
            setActiveIndex={setActiveIndex}
            LastId={LastId}
            setFeeds={setFeeds}
          />
      }
      {/* Left Menu */}
      <div
        className={`${darkModeReducer ? "menudark" : "menu"} ${isMenuOpen ? "menu-open" : "menu-closed"
          }`}


        style={{
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
              userProfile={userProfile}
              setUserProfile={setUserProfile}
              minimise={false}
              setminimise={() => {

              }}
              isCropOpen={isCropOpen}
              setIsCropOpen={setIsCropOpen}
              feeds={feeds}
              loggedUser={loggedUser} isMenuOpen={isMenuOpen} x={x} handleLoginSuccess={handleLoginSuccess} handleLoginError={handleLoginError}
              MenuOpenb={MenuOpenb}
              setMenuOpenb={setMenuOpenb}
            />
        }


        {/* 
          Pass activeIndex & setActiveIndex down 
          so MenuSlider can highlight the right item 
        */}
        <MenuSlider

          type={0}
          isFullscreen={isFullscreen}
          setx={setx}
          feedContainerRef={feedContainerRef}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          LastId={LastId}
          setFeeds={setFeeds}
        />
      </div>

      {/* Right Content */}
      <div
        className={`${darkModeReducer ? "contentdark" : "content"} ${isMenuOpen ? "content-with-menu" : "content-full"
          }`}
        style={{ padding: "0px" }}
      >



        {







          matchMobile ? null :

            isMenuOpen ? null :

              MenuOpenb ?
                /* ─────────────  MENU VISIBLE ───────────── */
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
                    type={1}
                    isFullscreen={isFullscreen}
                    setx={setx}
                    feedContainerRef={feedContainerRef}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                    LastId={LastId}
                    setFeeds={setFeeds}
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

                setHideBottom={setHideBottom}
                isCropOpen={isCropOpen}
                setIsCropOpen={setIsCropOpen}
                loggedUser={loggedUser} x={x} handleLoginSuccess={handleLoginSuccess} handleLoginError={handleLoginError}


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
            path="/"
            element={
              <Kickit
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
        </Routes>




        <ClikBateFooter isMenuOpen={isMenuOpen} setIsFullscreen={setIsFullscreen}
          isFullscreen={isFullscreen}


          setIsMenuOpen={setIsMenuOpen} />



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







      </div>





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



      {HideBottom ? null : <div style={{ position: 'absolute', bottom: matchMobile ? '-2vh' : '-1vh', textAlign: 'left', }}>

        <Footer x={x} />
      </div>}





      <Home handleLoginSuccess={handleLoginSuccess} handleLoginError={handleLoginError} x={x} setx={setx} />



    </div >
  );
}

export default App;
