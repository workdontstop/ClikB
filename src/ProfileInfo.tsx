// ProfileInfo.tsx
import { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import { useLocation } from "react-router-dom";
import axios from "axios";

// Import the newly created component
import { CropImageModal } from "./CropImageModal";
import { match } from "assert";
import { matchMobile } from "./DetectDevice";

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
  x,
  feeds,
  isCropOpen,
  setIsCropOpen,
  minimise,
  setminimise,
  MenuOpenb,
  setMenuOpenb,
  userProfile,
  setUserProfile
}: any) => {


  const VITE__CLOUNDFRONT = import.meta.env.VITE__CLOUNDFRONT;
  const CLIK_URL = import.meta.env.VITE_CLIK_URL;

  const location = useLocation();
  const { userId } = location.state || {};

  const [Zoom1x, setZoom1x] = useState(false);
  const [typeVal, settypeVal] = useState(0);
  const [userIdx, setuserIdx] = useState(0);

  // For storing the user-selected image (object URL) before cropping
  const [tempImageUrl, setTempImageUrl] = useState<string | null>(null);
  // For controlling whether the crop modal is open



  // Hidden file input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  // If user clicks the profile pic (and if it's their own profile), open file dialog
  const handleImageClick = () => {

    settypeVal(0);
    if (loggedUser?.id === userId || !userId) {
      fileInputRef.current?.click();
    }
  };

  const handleImageClick2 = () => {

    settypeVal(1);
    if (loggedUser?.id === userId || !userId) {
      fileInputRef.current?.click();
    }
  };

  // After user selects a file, open the crop modal
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    setTempImageUrl(url);
    setIsCropOpen(true);



    // Push an entry so that pressing Back will close the modal
    window.history.pushState({ fullscreen: true }, "");







    // Clear the input so they can pick again if needed
    e.target.value = "";
  };



  // Called if user cancels cropping
  const handleCropCancel = () => {
    setIsCropOpen(false);
    setTempImageUrl(null);
  };

  // Fetch user data
  const callGetuser = async (userId: number) => {
    const dataHold = {
      memberId: userId
    };
    try {
      const response = await axios.post(
        `${CLIK_URL}/profileInfo`,
        { values: dataHold },
        { withCredentials: true }
      );
      const memberData: any = response.data;
      const user = memberData.payload[0];

      setUserProfile({
        profilePic: user.profile_image || "",
        profilePicThumb: user.profile_image_thumb || "",
        billboard: user.billboard1 || "",
        billboardThumb: user.billboardthumb1 || "",
        username: user.username || "",
        followers: 0,
        following: 0
      });
    } catch (error) {
      console.error("Error fetching profile info:", error);
    }
  };

  // UseEffect to load profile data
  useEffect(() => {
    if (userId && loggedUser) {
      setuserIdx(userId);
      if (userId === loggedUser.id) {
        // My own profile
        setUserProfile({
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
        callGetuser(userId);
      }
    } else {
      setuserIdx(0);
      // If we do have a loggedUser but no userId, fallback:
      if (loggedUser) {
        setUserProfile({
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
  }, [userId, location.pathname, loggedUser, feeds]);

  const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);

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


  return (
    <div className="profile-info" onClick={

      () => {


        if (minimise) {

          setminimise(false);
        } else {


        }
      }


    }>

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
          height: '',
          objectFit: 'cover', // or "contain"
          ///filter: "blur(4px)",
          ///  display: minimise ? 'none' : 'block'
        }}
        className="profile-banner"
        onLoad={(e: any) => {
          const img = e.target;
          img.src = img.getAttribute("data-src");
        }}
      />


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

        {/* Right: Username + Followers/Following */}
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
            <p className="username" style={{ textAlign: 'center', margin: 'auto', ...textShadowStyle, }}>
              {userProfile.username || ""}
            </p>
          </div>
          <div className="right-inner bottom" style={{ display: 'flex' }}>
            <div className="followers">
              <p style={textShadowStyle}>Followers</p>
              <span style={textShadowStyle}>{userProfile.followers}</span>
            </div>
            <div className="following">
              <p style={textShadowStyle}>Following</p>
              <span style={textShadowStyle}>{userProfile.following}</span>
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
              display: x ? "none" : "none"
            }}
          >
            {/* Admin or special content */}
          </div>
        )
      }

      {/* The Crop modal */}
      <CropImageModal
        typeVal={typeVal}
        isOpen={isCropOpen}
        imageUrl={tempImageUrl}
        setUserProfile={setUserProfile}
        onClose={handleCropCancel}
      />

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
    </div >
  );
};

export default ProfileInfo;
