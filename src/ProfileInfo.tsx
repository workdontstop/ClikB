// ProfileInfo.tsx
import CreativeProfiles from './CreativeProfiles';
import ProfileImageLauncher from './ProfileImageLauncher';
import { updateBillboard, updateProfilePic } from './profileSlice';
import { getExecutingNavigationAction } from './navigationActionProvenance';
import { useState, useEffect, useRef, useCallback } from "react";
import { useSelector, useStore } from "react-redux";

import { useDispatch } from "react-redux";

import { RootState } from "./store";
import { useLocation } from "react-router-dom";
import axios from "axios";
import StarIcon from '@mui/icons-material/Star';
import { Box, Typography, Stack, useTheme, Button } from "@mui/material";
import FollowButton from "./FollowButton";
import FollowersButton from "./FollowersButton";
import StartFollowButton from "./FollowStartButton";
import { useFanStatus } from "./useFanStatus";
import FollowPanel from "./FollowPanel";
import { publishNavigationArea, recordNavigationTransition, removeNavigationArea } from './brainstormSlice';
import { navigationControl } from './navigationControlSnapshot';



import { useFanList } from "./FanListClient";

// Import the newly created component
import { CropImageModal } from "./CropImageModal";
import { match } from "assert";
import { matchMobile } from "./DetectDevice";
import './ProfileInfo.css';


import { setFollowersCount, setFollowingCount, incrementFollowingCount } from "./settingsSlice";

//import FollowersAndFollowing from "./FollowersAndFollowing";

// Helper to convert base64 to a File for uploading:
function dataURLtoFile(dataUrl: string, fileName: string): File {
  const arr = dataUrl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  if (!mimeMatch) {
    throw new Error("Invalid base64 string");
  }
  const mime = mimeMatch[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], fileName, { type: mime });
}

const ProfileInfo = ({
  loggedUser,
  isMenuOpen,
  feeds,
  isCropOpen,
  setIsCropOpen,
  minimise,
  setminimise,
  MenuOpenb,
  setMenuOpenb,
  userProfile,
  setUserProfile,
  setShowThumb,
  showThumb,
  setShowEmotions,
  setfollowType,
  isFullscreen,
  setIsFullscreen,
  isFullscreen1,
  isFullscreen2,
  isFullscreen3
  , snapshotPlacement, snapshotScrollHandler


}: any) => {


  const VITE__CLOUNDFRONT = import.meta.env.VITE__CLOUNDFRONT;
  const CLIK_URL = import.meta.env.VITE_CLIK_URL;

  const location = useLocation();

  const dispatch = useDispatch<any>();
  const appStore = useStore<RootState>();
  const [Zoom1x, setZoom1x] = useState(false);
  const [typeVal, settypeVal] = useState(0);
  const [userIdx, setuserIdx] = useState(0);

  // For storing the user-selected image (object URL) before cropping
  const [tempImageUrl, setTempImageUrl] = useState<string | null>(null);
  const [imageLauncher, setImageLauncher] = useState<{ memberId: number; target: 'avatar' | 'cover' } | null>(null);
  // For controlling whether the crop modal is open

  const followersReducer = useSelector((s: RootState) => s.settings.followersCount);
  const followingReducer = useSelector((s: RootState) => s.settings.followingCount);
  const { routeScrollPos, routelastId, userId, upload } = location.state || {};
  const viewerId = Number(loggedUser?.id) || 0;
  const viewedId = Number(userId || viewerId) || 0;
  const followScope = `${viewerId}:${viewedId}`;

  ///const { loading, error, followers, following, counts, refresh } =
  const { followers, following, counts, refresh } =
    useFanList({
      id: viewerId ? viewedId : 0, CLIK_URL, limit: 50
    });




  //const { status, loading, error, refresh } = useFanStatus({
  const { status, loading: fanStatusLoading, error: fanStatusError, refresh: refreshFanStatus } = useFanStatus({
    userid: viewerId,
    favid: viewedId,
    CLIK_URL,
    auto: Boolean(viewerId && viewedId && viewerId !== viewedId),
  });

  const showList = useCallback(() => {
    if (isFullscreen || isFullscreen1 || isFullscreen2 || isFullscreen3) {
      /// window.history.back();
      setShowEmotions(true);
    } else {

      setShowEmotions(true);
    }






  }, [isFullscreen, isFullscreen1, isFullscreen2, isFullscreen3])

  const [confirmedFollowScope, setConfirmedFollowScope] = useState('');
  const connected = Boolean(status?.following || confirmedFollowScope === followScope);
  const [scopedFollowVisual, setScopedFollowVisual] = useState({ scope: '', following: false, loading: false });
  const followVisual = scopedFollowVisual.scope === followScope ? scopedFollowVisual : { following: false, loading: false };
  const setFollowVisual = useCallback((state: { following: boolean; loading: boolean }) => {
    setScopedFollowVisual({ scope: followScope, ...state });
  }, [followScope]);
  const completeFollow = useCallback(() => {
    setConfirmedFollowScope(followScope);
    void refreshFanStatus().then(result => {
      if (result?.following === false) setConfirmedFollowScope(current => current === followScope ? '' : current);
    });
  }, [followScope, refreshFanStatus]);
  useEffect(() => { setConfirmedFollowScope(''); }, [followScope]);
  const [showbut, setshowbut] = useState(false);

  const snapshotSource = `ProfileInfo:${snapshotPlacement || 'unmapped'}`;
  const snapshotVisible = snapshotPlacement === 'sidebar'
    ? !matchMobile && Boolean(isMenuOpen)
    : snapshotPlacement === 'page_top' && (matchMobile || !isMenuOpen);
  const isOwnProfileDisplay = !viewedId || viewedId === viewerId;
  const canFollowViewedProfile = Boolean(viewerId && Number(userProfile.id) === viewedId && !fanStatusLoading && !fanStatusError && status?.following === false);
  const [creativeCoverActions, setCreativeCoverActions] = useState<HTMLElement | null>(null);
  const [creativePairedAvatar, setCreativePairedAvatar] = useState<HTMLElement | null>(null);
  const canOpenImagePicker = viewerId > 0 && viewedId === viewerId;

  useEffect(() => {
    if (!snapshotVisible) {
      dispatch(removeNavigationArea({ areaId: 'clikb.profile_header', source: snapshotSource }));
      return;
    }
    const areaId = 'clikb.profile_header';
    const controls = [
      navigationControl(areaId, 'change_banner', 'ProfileInfo.handleImageClick2', 'candidate', canOpenImagePicker, viewedId, canOpenImagePicker ? undefined : 'Another profile cannot be edited'),
      navigationControl(areaId, 'change_avatar', 'ProfileInfo.handleImageClick', 'candidate', canOpenImagePicker, viewedId, canOpenImagePicker ? undefined : 'Another profile cannot be edited'),
    ];
    if (isOwnProfileDisplay || connected) {
      controls.push(navigationControl(areaId, 'following', 'FollowPanel.followOpen', 'candidate', true, viewedId));
      controls.push(navigationControl(areaId, 'followers', 'FollowPanel.followingOpen', 'candidate', true, viewedId));
    } else {
      controls.push(followVisual.following
        ? navigationControl(areaId, 'follow_complete', 'StartFollowButton.onProfileFollowed', 'manual_only', false, viewedId, 'Following and Followers controls are loading')
        : navigationControl(areaId, 'follow', 'StartFollowButton.handleClick', 'needs_confirmation', canFollowViewedProfile && !followVisual.loading, viewedId, !canFollowViewedProfile ? fanStatusError || 'Profile or relationship status not yet known' : undefined));
    }
    if (isCropOpen) {
      controls.push(navigationControl(areaId, 'crop_back', 'CropImageModal.window.history.back', 'needs_handoff'));
      controls.push(navigationControl(areaId, 'crop_save', 'CropImageModal.handleSave', 'needs_handoff'));
    }
    if (snapshotPlacement === 'page_top' && minimise && snapshotScrollHandler) {
      controls.push(navigationControl(areaId, 'floating_avatar_scroll_top', snapshotScrollHandler, 'candidate', true, userProfile?.id || null));
    }
    if (minimise) controls.push(navigationControl(areaId, 'expand_header', 'ProfileInfo.root.onClick'));
    if (import.meta.env.VITE_APPX_STATE !== 'prod' && showbut && snapshotPlacement === 'sidebar') controls.push(navigationControl(areaId, 'thumbnail_creator', 'ProfileInfo.setShowThumb(true)'));
    dispatch(publishNavigationArea({
      areaId,
      source: snapshotSource,
      state: {
        placement: snapshotPlacement,
        profileId: viewedId,
        profileName: Number(userProfile.id) === viewedId ? userProfile.username || '' : '',
        isOwnProfile: isOwnProfileDisplay,
        canOpenImagePicker,
        cropOpen: Boolean(isCropOpen),
        imageLauncherOpen: Boolean(imageLauncher),
        floatingAvatarVisible: Boolean(snapshotPlacement === 'page_top' && minimise),
        thumbnailCreatorVisible: Boolean(import.meta.env.VITE_APPX_STATE !== 'prod' && showbut && snapshotPlacement === 'sidebar'),
        thumbnailCreatorOpen: Boolean(showThumb),
        relationshipLoading: fanStatusLoading,
        relationship: status?.relationship || 'unknown',
        connected: Boolean(connected),
        followButtonFollowing: followVisual.following,
        followButtonLoading: followVisual.loading,
        followingCount: isOwnProfileDisplay ? followingReducer : Number(counts?.following || 0),
        followersCount: isOwnProfileDisplay ? followersReducer : Number(counts?.followers || 0),
      },
      visibleControls: controls,
    }));
  }, [dispatch, snapshotVisible, snapshotSource, snapshotPlacement, snapshotScrollHandler, minimise, showbut, showThumb, userProfile?.id, userProfile?.username, loggedUser?.id, userId, viewedId, isOwnProfileDisplay, canFollowViewedProfile, canOpenImagePicker, isCropOpen, imageLauncher, fanStatusLoading, fanStatusError, status?.relationship, connected, followVisual.following, followVisual.loading, followingReducer, followersReducer, counts?.following, counts?.followers]);

  useEffect(() => () => {
    dispatch(removeNavigationArea({ areaId: 'clikb.profile_header', source: snapshotSource }));
  }, [dispatch, snapshotSource]);

  // here’s your path name:
  const pathName = location.pathname;
  // Now these will be `undefined` if no state was passed



  useEffect(() => {

    if (loggedUser) {

      if (isOwnProfileDisplay) {

        dispatch(setFollowersCount(counts.followers));
        dispatch(setFollowingCount(counts.following));
        // dispatch(incrementFollowingCount());          // +1
        // or variable step:
        // dispatch(incrementFollowingCount(delta));   // where delta is 1 or -1 if you add an unfollow version later
      }




    }



  }, [counts, followers, following, loggedUser, isOwnProfileDisplay, dispatch])
  // Hidden file input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  const openImageLauncher = (target: 'avatar' | 'cover') => {
    if (!canOpenImagePicker) return;
    settypeVal(target === 'cover' ? 1 : 0);
    const editor = { memberId: viewerId, target, source: snapshotSource };
    window.history.pushState({ ...window.history.state, profileImageEditor: editor }, '');
    setImageLauncher(editor);
    const key = target === 'cover' ? 'change_banner' : 'change_avatar';
    dispatch(recordNavigationTransition({
      actor: getExecutingNavigationAction() === `clikb.profile_header.action.${key}` ? 'ai' : 'manual', kind: 'area',
      before: { route: location.pathname, areaId: 'clikb.profile_header', entityId: viewerId },
      after: { route: location.pathname, areaId: 'clikb.navigation.profile_image', entityId: viewerId,
        controlId: `clikb.profile_header.control.${key}`, state: { imageLauncherOpen: true, target } },
      outcome: 'succeeded', authoritativeSource: 'ProfileInfo image launcher',
    }));
  };
  const handleImageClick = () => openImageLauncher('avatar');
  const handleImageClick2 = () => openImageLauncher('cover');

  const closeImageLauncher = () => {
    setImageLauncher(null);
    if (window.history.state?.profileImageEditor?.source === snapshotSource) window.history.back();
  };

  useEffect(() => {
    const restore = () => {
      const editor = window.history.state?.profileImageEditor;
      setImageLauncher(editor?.source === snapshotSource && editor.memberId === viewerId && canOpenImagePicker
        ? editor : null);
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [viewerId, canOpenImagePicker, snapshotSource]);

  useEffect(() => {
    setImageLauncher(null);
    setTempImageUrl(null);
    setIsCropOpen(false);
  }, [viewerId, viewedId]);

  useEffect(() => () => {
    if (tempImageUrl?.startsWith('blob:')) URL.revokeObjectURL(tempImageUrl);
  }, [tempImageUrl]);

  const applyGeneratedImage = (imageUrl: string) => {
    if (!imageLauncher || imageLauncher.memberId !== Number(appStore.getState().profile.loggedUser?.id)) return;
    const memberId = imageLauncher.memberId;
    if (imageLauncher.target === 'cover') {
      setUserProfile((previous: any) => Number(previous?.id) === memberId ? { ...previous, billboard: imageUrl, billboardThumb: imageUrl } : previous);
      dispatch(updateBillboard({ userbillboard1: imageUrl, userbillboardthumb1: imageUrl }));
    } else {
      setUserProfile((previous: any) => Number(previous?.id) === memberId ? { ...previous, profilePic: imageUrl, profilePicThumb: imageUrl } : previous);
      dispatch(updateProfilePic({ image: imageUrl, imageThumb: imageUrl }));
    }
  };

  // After user selects a file, open the crop modal
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    setTempImageUrl(url);
    setIsCropOpen(true);
    dispatch(recordNavigationTransition({
      actor: 'manual', kind: 'area',
      before: { route: location.pathname, areaId: 'clikb.profile_header', entityId: userProfile?.id || loggedUser?.id, state: { cropOpen: false } },
      after: { route: location.pathname, areaId: 'clikb.profile_header', controlId: `clikb.profile_header.control.${typeVal === 1 ? 'change_banner' : 'change_avatar'}`, entityId: userProfile?.id || loggedUser?.id, state: { cropOpen: true, imageType: typeVal === 1 ? 'banner' : 'avatar' } },
      outcome: 'succeeded', authoritativeSource: 'profile file-input change event',
    }));



    // Push an entry so that pressing Back will close the modal
    window.history.pushState({ ...window.history.state, profileCrop: true }, "");







    // Clear the input so they can pick again if needed
    e.target.value = "";
  };





  // Called if user cancels cropping
  const handleCropCancel = (reason: 'cancelled' | 'completed' = 'cancelled') => {
    setIsCropOpen(false);
    setTempImageUrl(null);
    dispatch(recordNavigationTransition({
      actor: 'manual', kind: 'area',
      before: { route: location.pathname, areaId: 'clikb.profile_header', entityId: userProfile?.id || loggedUser?.id, state: { cropOpen: true } },
      after: { route: location.pathname, areaId: 'clikb.profile_header', controlId: `clikb.profile_header.control.${reason === 'completed' ? 'crop_save' : 'crop_back'}`, entityId: userProfile?.id || loggedUser?.id, state: { cropOpen: false } },
      outcome: reason === 'completed' ? 'succeeded' : 'cancelled',
      authoritativeSource: reason === 'completed' ? 'CropImageModal post-save history return' : 'CropImageModal close/back handler',
    }));
  };

  const handleProfileRootClick = () => {
    if (!minimise) return;
    setminimise(false);
    dispatch(recordNavigationTransition({
      actor: 'manual', kind: 'area',
      before: { route: location.pathname, areaId: 'clikb.profile_header', entityId: userProfile?.id || loggedUser?.id, state: { minimised: true } },
      after: { route: location.pathname, areaId: 'clikb.profile_header', controlId: 'clikb.profile_header.control.expand_header', entityId: userProfile?.id || loggedUser?.id, state: { minimised: false } },
      outcome: 'succeeded', authoritativeSource: 'ProfileInfo minimised-state handler',
    }));
  };

  // Fetch user data
  const callGetuser = async (userId: number, signal: AbortSignal) => {
    const dataHold = {
      memberId: userId
    };
    try {
      const config = { withCredentials: true, signal };
      const response = await axios.post(
        `${CLIK_URL}/profileInfo`,
        { values: dataHold },
        config
      );
      const memberData: any = response.data;
      const user = memberData.payload[0];
      if (signal.aborted || Number(user?.id) !== Number(userId)) return;

      setUserProfile({
        id: user.id || 0,
        profilePic: user.profile_image || "",
        profilePicThumb: user.profile_image_thumb || "",
        billboard: user.billboard1 || "",
        billboardThumb: user.billboardthumb1 || "",
        username: user.username || "",
        followers: 0,
        following: 0
      });
    } catch (error) {
      if (!signal.aborted) console.error("Error fetching profile info:", error);
    }
  };

  // UseEffect to load profile data
  useEffect(() => {
    const controller = new AbortController();
    if (userId && loggedUser) {

      if (userId === loggedUser.id) {
        setuserIdx(loggedUser.id);
        // My own profile
        setUserProfile({
          id: loggedUser.id || 0,
          profilePic: loggedUser.image || "",
          profilePicThumb: loggedUser.imageThumb || "",
          billboard: loggedUser.userbillboard1 || "",
          billboardThumb: loggedUser.userbillboardthumb1 || "",
          username: loggedUser.username || "",
          followers: 0,
          following: 0
        });
      } else {
        // Another user's profile
        if (userId === 0) {
          setuserIdx(loggedUser.id);

          // If we do have a loggedUser but no userId, fallback:

          void callGetuser(loggedUser.id, controller.signal);

        } else {
          /// alert(pathName)
          setuserIdx(userId);

          // Another user's profile
          void callGetuser(userId, controller.signal);
        }

      }




    } else {
      setuserIdx(0);
      // If we do have a loggedUser but no userId, fallback:
      if (loggedUser) {
        setUserProfile({
          id: loggedUser.id || 0,
          profilePic: loggedUser.image || "",
          profilePicThumb: loggedUser.imageThumb || "",
          billboard: loggedUser.userbillboard1 || "",
          billboardThumb: loggedUser.userbillboardthumb1 || "",
          username: loggedUser.username || "",
          followers: 0,
          following: 0
        });
      }
    }
    return () => controller.abort();
  }, [userId, location.pathname, loggedUser, feeds]);

  const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
  const desktopPageHeader = !matchMobile && !isMenuOpen && snapshotPlacement === 'page_top';

  const textShadowStylex = {
    textShadow: `
        0px 0px 10px rgba(0, 0, 0, 0.9), 
        0px 0px 20px rgba(0, 0, 0, 0.8), 
        0px 0px 30px rgba(0, 0, 0, 0.7)
      `,
    color: '#ffffff',
    fontWeight: 'bold',
  };


  const textShadowStyle = {

  };




  useEffect(() => {
    if (isMenuOpen && !matchMobile) {

      setminimise(false);
    }

  }, [])



  const iconTimeoutRefax = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {

    setshowbut(loggedUser?.id === userId);



    if (iconTimeoutRefax.current) {
      clearTimeout(iconTimeoutRefax.current);
    }

    // Set a timeout to open the menu after 2 seconds
    iconTimeoutRefax.current = setTimeout(() => {

      setshowbut(false);
    }, 5000)



  }, [loggedUser, userId])

  return (
    <div className={`profile-info${desktopPageHeader ? ' profile-info--desktop-page' : ''}${darkModeReducer ? ' profile-info--dark' : ''}`} data-ai-action={minimise ? 'clikb.profile_header.action.expand_header' : undefined} onClick={handleProfileRootClick}>
      <div className="creative-profile-cover-actions" ref={setCreativeCoverActions} />


      {!isMenuOpen || matchMobile ?


        <img
          onClick={
            () => {
              /// if (minimise) {
              handleImageClick2();
            }
          }
          src={userProfile.billboardThumb ? userProfile.billboardThumb : ""}
          data-src={userProfile.billboard ? userProfile.billboard : ""}
          alt={userProfile.username ? `${userProfile.username}'s banner` : "Banner"}
          style={{
            cursor: "pointer",
            height: '',
            objectFit: 'cover', // or "contain"
            ///filter: "blur(4px)",
            ///  display: minimise ? 'none' : 'block'
          }}
          data-ai-action={canOpenImagePicker ? 'clikb.profile_header.action.change_banner' : undefined}
          className="profile-banner"
          onLoad={(e: any) => {
            const img = e.target;
            const fullSource = img.getAttribute("data-src");
            if (fullSource && img.getAttribute("src") !== fullSource) img.src = fullSource;
          }}
        />

        : <Box sx={{ position: 'relative', display: 'inline-block' }}>
          {/* Banner Image */}
          <img
            onClick={
              () => {
                /// if (minimise) {
                handleImageClick2();
              }
            }
            src={userProfile.billboardThumb ? userProfile.billboardThumb : ""}
            data-src={userProfile.billboard ? userProfile.billboard : ""}
            alt={userProfile.username ? `${userProfile.username}'s banner` : "Banner"}
            style={{
              cursor: "pointer",
              width: '100%',
              height: 'auto',
              objectFit: 'scale-down', // or "contain"
              ///filter: "blur(4px)",
              ///  display: minimise ? 'none' : 'block'
            }}
            data-ai-action={canOpenImagePicker ? 'clikb.profile_header.action.change_banner' : undefined}
          className="profile-banner"
            onLoad={(e: any) => {
              const img = e.target;
              const fullSource = img.getAttribute("data-src");
            if (fullSource && img.getAttribute("src") !== fullSource) img.src = fullSource;
            }}
          />




          {import.meta.env.VITE_APPX_STATE !== 'prod' && showbut ?
            <Button
              data-ai-action="clikb.profile_header.action.thumbnail_creator"
              variant="outlined"
              size="medium"
              sx={{
                position: 'absolute',
                top: '2vh',
                margin: 'auto',
                opacity: '0.9',
                left: '0.7vw',
                minWidth: 110,
                borderColor: darkModeReducer ? '#F6BB56' : '#ff8a00',
                color: '#FFFFFF',
                textShadow: '0px 1px 3px rgba(0,0,0,0.96)',
                '&:hover': {
                  bgcolor: darkModeReducer ? '#F6BB56' : '#ff8a00',
                  borderColor: darkModeReducer ? '#F6BB56' : '#ff8a00',
                  color: '#000000',
                  textShadow: 'none',
                },
                '&:active': {
                  bgcolor: darkModeReducer ? '#F6BB56' : '#ff8a00',
                  borderColor: darkModeReducer ? '#F6BB56' : '#ff8a00',
                  color: '#000000',
                  textShadow: 'none',
                },
              }}
              onClick={() => {
                setShowThumb(true);
                dispatch(recordNavigationTransition({
                  actor: 'manual', kind: 'area',
                  before: { route: location.pathname, areaId: 'clikb.profile_header', state: { thumbnailCreatorOpen: false } },
                  after: { route: location.pathname, areaId: 'clikb.profile_header', controlId: 'clikb.profile_header.control.thumbnail_creator', state: { thumbnailCreatorOpen: true } },
                  outcome: 'succeeded', authoritativeSource: 'ProfileInfo thumbnail-creator handler',
                }));



              }}
              startIcon={<StarIcon style={{}} />}
            >
              Thumbnail Creator
            </Button>

            : null}

        </Box>
      }

      {/* Info Box */}
      <div className="profile-box" style={{

        transition: 'transform 0s ease-in-out, opacity 0.5s ease-in-out',
        transform: matchMobile ? 'translateY(0)'
          : 'translateY(0)',
        position: 'relative',
        zIndex: 200,

      }}>
        {/* Left: Profile Image */}
        <div className="left-box">
          <span className="creative-profile-paired-avatar" ref={setCreativePairedAvatar} />

          <img
            onMouseEnter={() => setZoom1x(true)}
            onMouseLeave={() => setZoom1x(false)}
            onTouchStart={() => setZoom1x(true)}
            onTouchEnd={() => setZoom1x(false)}
            onClick={

              () => {


                /// if (minimise) {


                handleImageClick();

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

              transform: matchMobile ? minimise ? 'scale(0)' : 'scale(1)' : minimise ? 'scale(0)' : 'scale(1)',
              marginLeft: matchMobile ? '2vw' : '0px',


              cursor: "pointer",
              transition: isMenuOpen
                ? "transform 1s ease-in-out"
                : "transform 1s ease-in-out",
              borderRadius: "50%",
              width: "80px",
              height: "80px",


            }}
            data-ai-action={canOpenImagePicker ? 'clikb.profile_header.action.change_avatar' : undefined}
            className="profile-image"
          />
          {/* Hidden file input */}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          <input
            type="file"
            accept="image/*"
            ref={fileInputRef2}
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </div>

        {/* Right: Username + Followers/Following Creator */}
        <div
          className="right-box"
          style={{
            transform: 'scale(1)',
            cursor: "pointer",
            transition: isMenuOpen ? "transform 0s ease-in-out" : "transform 0s ease-in-out",
            marginTop: matchMobile ? '' : '',
            visibility: 'visible'
          }}
        >
          <div className="right-inner top" >
            <p className="username" style={{ textAlign: desktopPageHeader ? 'left' : 'center', margin: desktopPageHeader ? 0 : 'auto', ...textShadowStyle, }}>
              {userProfile.username || ""}
            </p>
          </div>
          <div className="right-inner bottom" style={{ display: 'flex', opacity: 0.9 }}>
            <div className="followers">
              <p style={textShadowStyle}>Posts</p>
              <p style={textShadowStyle}>...</p>
            </div>
            <div className="following">
              <p style={textShadowStyle}>Ranking</p>
              <p style={textShadowStyle}>Hero</p>

              {/*     <span style={textShadowStyle}>{userProfile.following}</span> */}
            </div>
          </div>
        </div>



      </div>


      {/* Possibly other user-specific content */}
      {
        loggedUser && loggedUser.id === 1 && (
          <div
            style={{
              transform: isMenuOpen ? "scale(1)" : "scale(0)",
              marginTop: "0vh",
              width: "100%",
              display: "none"
            }}
          >
            {/* Admin or special content */}
          </div>
        )
      }

      {imageLauncher && snapshotVisible && <ProfileImageLauncher
        open memberId={imageLauncher.memberId} target={imageLauncher.target}
        currentImageUrl={imageLauncher.target === 'cover' ? userProfile?.billboard : userProfile?.profilePic}
        onClose={closeImageLauncher}
        onGenerated={applyGeneratedImage}
      />}

      {/* The Crop modal */}
      {tempImageUrl && <CropImageModal
        typeVal={typeVal}
        isOpen={isCropOpen}
        imageUrl={tempImageUrl}
        setUserProfile={setUserProfile}
        onClose={handleCropCancel}
      />}

      {/* Inline styles or external CSS */}
      <style>
        {`
          .profile-info {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          .profile-banner {
            width: 100%;
            height: 200px;
            object-fit: cover;
            border-radius: 1vw;
            margin-top: 3px;
            padding: 10px;
          }

          .profile-box {
            display: flex;
            width: 100%;
            max-width: 600px;
            margin-top: 0px;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
          }

          .left-box {
            flex: 0 0 auto;
            display: flex;
            justify-content: center;
            align-items: center;
          }

          .right-box {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            min-width: 0;
          }

          .right-inner.top {
            margin-bottom: 10px;
            width: 100%;
          }

          .username {
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
            font-weight: bold;
            font-size: 1.1rem;
          }

          .right-inner.bottom {
            display: flex;
            justify-content: space-around;
            gap: 1rem;
          }

          .followers, .following {
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          .followers p, .following p {
            margin: 0;
            font-size: 0.9rem;
          }

          .followers span, .following span {
            font-size: 1.2rem;
            font-weight: bold;
          }

          @media (max-width: 768px) {
            .profile-banner {
              height: 150px;
              border-radius: 1vw;
              margin-top: 0px;
              padding: 8px;
            }

            .profile-box {
              flex-direction: column;
              align-items: center;
            }

            .left-box {
              margin-bottom: 10px;
            }
          }
/* ─────────────────────────  MOBILE ≤ 480 px  ────────────────────────── */
@media (max-width: 480px) {
  /* 1️⃣  keep banner as you already had */
  .profile-banner {
    height: 120px;
    border-radius: 2vw;
    margin-top: 0;
    padding: 4px;
  }

  /* 2️⃣  main info row (pic | text)  */
  .profile-box {
    flex-direction: row;      /* 🔄 horizontal instead of column */
    align-items: center;
    justify-content: flex-start;
    padding: 6px 8px;
  }

  /* 3️⃣  avatar left */
  .left-box {
    margin: 0;                /* remove bottom gap */
    margin-right: 12px;       /* little breathing room */
  }
  .left-box .profile-image {
    width: 64px;
    height: 64px;
  }

  /* 4️⃣  text block right */
  .right-box {
    align-items: center; 
     /* left-align internal text */
    text-align: center;
  }
  .right-inner.top .username {
     align-items: center; 
     /* left-align internal text */
    text-align: center;
  
    font-size: 1.05rem;
    max-width: 220px;         /* stop long names wrapping under pic */
  }

  .right-inner.bottom {
  
    flex-direction: row;      /* already row but make sure */
    gap:2rem;
    margin-top: 2px;
  }
  .followers p,
  .following p {
    font-size: 0.75rem;
  }
  .followers span,
  .following span {
    font-size: 0.95rem;
    font-weight: 600;
  }
}

          }
        `}
      </style>



      {!minimise && location.pathname === '/pages' && snapshotVisible && <CreativeProfiles surface="profile" profileId={Number(userId || loggedUser?.id)}
        coverOnly={snapshotPlacement === 'sidebar'}
        coverActions={creativeCoverActions} pairedAvatar={creativePairedAvatar} />}
      <div className="profile-relationships" style={{
        display: 'flex',
        gap: '4px',
        padding: '2px',
        width: desktopPageHeader ? '100%' : matchMobile ? '98%' : isMenuOpen ? '100%' : '400px',
        margin: desktopPageHeader ? 0 : '0 auto',
        justifyContent: 'center',
        opacity: desktopPageHeader ? 1 : 0.8,
        paddingBottom: desktopPageHeader ? 0 : '3vh'
      }}>

        <FollowPanel key={followScope}
          onSnapshotState={setFollowVisual}
          setShowEmotions={showList}
          setfollowType={setfollowType}

          typex={false}
          type={0}
          userProfile={viewedId}
          loggedUser={loggedUser}
          connected={connected}
          onProfileFollowed={completeFollow}
          followDisabled={!canFollowViewedProfile}
          counts={counts}
          followersReducer={followersReducer}
          followingReducer={followingReducer}
          refresh={refresh}
          onFollowersClick={() => console.log("open followers list")}
          onFollowToggle={(next) => console.log("follow ->", next)}
        />


      </div>



    </div >
  );
};

export default ProfileInfo;
