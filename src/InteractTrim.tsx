import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  IconButton,
  Slider,
  Stack,
  Typography,
  useTheme,
  Button,
} from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import { useSelector } from "react-redux";
import axios from "axios"; // Import Axios
import { RootState } from "./store";

import { matchMobile, matchPc } from "./DetectDevice";

interface InteractTrimProps {
  /** Video source URL (FileReader, S3 presigned URL, etc.) */
  videoURL: any;
  setShowTrim: any;
  /** Callback whenever the user changes the trim window */
  onSelectionChange?: (start: number, end: number) => void;
  /** Maximum window length in seconds (default 30) */
  duration?: number;
  trimmedUrl: any;
  setTrimmedUrl: any;
  type: number;
  setOpenIntMedia: any;

  setIsImg1: any;
  setIsImg2: any;
  isImage: any;
  Inttype: number;
  IntMediaType: number;
  setCloudvideoURL: any
}

/**
 * ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
 * ┃ VIDEO TRIMMER – FLEX‑30 TRIM WINDOW ┃
 * ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
 *
 * Behaviour rules (max window = `duration`, default 30 s):
 *
 * 1. **Independent below limit**
 *    – If, after dragging, the preview span is **≤ duration**, the other
 *      thumb stays put – you can freely shrink the window.
 *
 * 2. **Synced above limit**
 *    – If the span would exceed `duration`, the component reverts to the
 *      classic synced behaviour, pushing the opposite thumb to keep
 *      exactly `duration` seconds.
 *
 * 3. Video loops inside the current region.
 */
const InteractTrim: FC<InteractTrimProps> = ({
  videoURL,
  onSelectionChange,
  duration = 30,
  setShowTrim,
  trimmedUrl,
  setTrimmedUrl,
  type,
  setOpenIntMedia,

  setIsImg1,
  setIsImg2,
  isImage,
  Inttype,
  IntMediaType,
  setCloudvideoURL
}) => {


  const CLIK_URL = import.meta.env.VITE_CLIK_URL;

  const theme = useTheme();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [videoDuration, setVideoDuration] = useState(0);
  const [region, setRegion] = useState<[number, number]>([0, duration]);
  const [isPlaying, setIsPlaying] = useState(false);

  // ───────────────────────── Helpers ─────────────────────────
  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(sec % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };


  const [isProcessing, setIsProcessing] = useState(false);

  const [isProcessingx, setIsProcessingx] = useState(false);


  // ───────────────────────── Loop inside region ─────────────────────────
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const loopHandler = () => {
      const [start, end] = region;
      if (vid.currentTime >= end) vid.currentTime = start;
    };

    vid.addEventListener("timeupdate", loopHandler);
    return () => vid.removeEventListener("timeupdate", loopHandler);
  }, [region]);

  // Customize padding for both buttons here.
  const buttonPadding = { px: 3, py: 1.5 };


  const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);

  // ───────────────────────── Play / Pause ─────────────────────────
  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;

    if (isPlaying) {
      vid.pause();
      setIsPlaying(false);
    } else {
      vid.currentTime = region[0];
      vid.play();
      setIsPlaying(true);
    }
  };

  // ───────────────────────── Util ─────────────────────────
  const clamp = (num: number, min: number, max: number) =>
    Math.min(Math.max(num, min), max);

  // ───────────────────────── Slider handler ─────────────────────────
  const handleSliderChange = (
    _: any,
    value: number | number[],
    activeThumb: number
  ) => {
    if (!Array.isArray(value)) return;

    let [start, end] = region;
    const [incomingStart, incomingEnd] = value as [number, number];

    if (activeThumb === 0) {
      // ── Dragging start thumb ──
      const newStart = clamp(incomingStart, 0, end);
      const span = end - newStart;

      if (span > duration) {
        // Exceeds limit → push end to keep fixed window
        start = newStart;
        end = clamp(start + duration, 0, videoDuration);
      } else {
        // Within limit → leave end as‑is
        start = newStart;
      }
    } else {
      // ── Dragging end thumb ──
      const newEnd = clamp(incomingEnd, start, videoDuration);
      const span = newEnd - start;

      if (span > duration) {
        // Exceeds limit → pull start to keep fixed window
        end = newEnd;
        start = clamp(end - duration, 0, videoDuration);
      } else {
        // Within limit → leave start as‑is
        end = newEnd;
      }
    }

    setRegion([start, end]);

    // Update playback preview
    const vid = videoRef.current;
    if (!vid) return;
    if (activeThumb === 0) {
      vid.currentTime = start;
    } else {
      vid.currentTime = Math.max(end - 5, start);
    }
  };


  const uploadS3 = useCallback(async () => {
    try {
      // Fetch the video as a blob
      const response = await fetch(videoURL);
      const blob = await response.blob();

      // Optional: Check size in MB
      const sizeInMB = blob.size / (1024 * 1024);
      if (sizeInMB > 500) {
        alert('Video size exceeds 500MB limit.');
        return;
      }


      if (IntMediaType === 0 && type === 2) {

        callTrimVid(videoURL, 0);

      } else {
        // Pass blob to your upload handler
        await GenerateSignedUrlForVideo(blob);

      }



    } catch (error) {
      console.error('Error fetching video blob:', error);
    }
  }, [fmt(region[0]), fmt(region[1]), videoURL]);



  // ask the backend for a presigned DELETE URL, then call it
  const DeleteVideoFromS3 = useCallback(
    async (uploadedVideoUrl: string) => {
      //setIsProcessingx(true);

      try {
        // 1. extract the S3 key from the public URL you kept after upload
        //    e.g. https://my‑bucket.s3.eu‑west‑1.amazonaws.com/video‑abcdef.mp4
        //    ──────────────────────────────────────────────^^ the “key”
        ///  const key = uploadedVideoUrl.split("/").slice(3).join("/"); // crude but works

        const url = new URL(uploadedVideoUrl);
        const keyx = url.pathname.slice(1);          // e.g. "videos/abc123.mp4"
        const key = `${keyx}`
        console.log("CLIENT → deleting S3 key:", key);

        // 2. ask your server for a signed DELETE url
        const { data } = await axios.post<any>(
          `${CLIK_URL}/get_signed_delete_url_video`,
          { key },                        // body
          { withCredentials: true }
        );

        const holder = data.holder;
        if (!holder || holder.length !== 1 || !holder[0].deleteUrl) {
          throw new Error("Invalid signed‑delete response");
        }
        const { deleteUrl } = holder[0];

        // 3. call the signed URL – Axios maps DELETE nicely
        const resp = await axios.delete(deleteUrl);

        if (resp.status !== 200 && resp.status !== 204) {
          throw new Error(`Delete failed with status ${resp.status}`);
        }

        console.log("Video deleted from S3 ✅");
      } catch (err: any) {
        console.error("Error deleting video:", err);
      } finally {
        // setIsProcessingx(false);
        setOpenIntMedia(false);
      }
    },
    []
  );



  // 1) Generate S3 signed URL
  const GenerateSignedUrlForVideo = useCallback(



    async (videoBlob: Blob) => {

      setIsProcessingx(true);

      if (!videoBlob) {
        ///  setError("No video blob for upload.");
        return;
      }

      try {
        // Example: pass any needed metadata or parameters in requestData

        const requestData = {
          values: { count: 1 },
        };

        // Request a signed URL from your server
        const response = await axios.post<any>(
          `${CLIK_URL}/get_signed_url_video`,
          requestData,
          { withCredentials: true } // If your server requires credentials/cookies
        );

        // Expect the server to respond with { signedUrl: "...", ... }

        const holder = response.data.holder;

        if (!holder || holder.length !== 1) {
          throw new Error("Invalid signed URL response.");
        }

        const signedUrl = holder[0];


        if (!signedUrl) {
          throw new Error("No signedUrl returned from server");
        }

        const { urlVideo } = signedUrl;

        // 2) Once we have a signed URL, PUT the video blob to S3
        await PutVideoInS3WithURL(videoBlob, urlVideo,);

        console.log("signed URL:", signedUrl);
      } catch (err: any) {

        setIsProcessingx(false);

        console.error("Error generating video signed URL:", err);
        /// setError(err.message || "Error generating video signed URL");
      }
    },
    [fmt(region[0]), fmt(region[1]), videoURL]
  );

  // 2) Upload video to S3 using the signed URL
  const PutVideoInS3WithURL = useCallback(
    async (videoBlob: Blob, signedUrl: string) => {
      try {
        const uploadResponse = await axios.put(signedUrl, videoBlob, {
          headers: {
            "Content-Type": videoBlob.type || "video/mp4",
          },
        });

        if (uploadResponse.status !== 200 && uploadResponse.status !== 204) {
          throw new Error(`Video upload failed with status ${uploadResponse.status}`);
        }

        console.log("Video uploaded successfully to S3.");

        // The final S3 link is the signedUrl minus the query parameters
        const uploadedVideoUrl = signedUrl.split("?")[0];
        console.log("Uploaded  Main iNTERACTION  URL:", uploadedVideoUrl);


        // create a URL object so we can pull out pathname
        const urlObj = new URL(uploadedVideoUrl);
        // pathname === '/videos/video-abc123.mp4'
        const fullKey = urlObj.pathname.substring(1);            // 'videos/video-abc123.mp4'
        const fileName = fullKey.split('/').pop();               // 'video-abc123.mp4'

        console.log('S3 object key:', fullKey);
        console.log('Uploaded filename:', fileName);


        setIsProcessingx(false);


        if (type === 1) {

          setCloudvideoURL(uploadedVideoUrl);
        }



        callTrimVid(uploadedVideoUrl, 1);

        // (Optional) Save the final URL to your database
        // e.g.: await saveToDatabase(uploadedVideoUrl, promptData, userData);
      } catch (err: any) {


        setIsProcessingx(false);

        console.error("Error uploading video to S3:", err);
        /// setError(err.message || "Error uploading video to S3");
      }
    },
    [fmt(region[0]), fmt(region[1]), videoURL, type]
  );





  const callTrimVid = useCallback(
    async (signedVideoUrl: string, ty: number) => {
      try {
        setIsProcessing(true);

        const { data } = await axios.post<any>(`${CLIK_URL}/Trim-video`, {
          video: signedVideoUrl,                      // signed HTTPS S3 URL
          start: fmt(region[0]),                      // "MM:SS" or "HH:MM:SS"
          end: fmt(region[1]),
          outputBucket: "s3://clikbatebucket/videos/",// folder path only
          pathx: type === 1 ? 0 : 1

        });


        setTrimmedUrl(data.videoUrl);



        if (type === 1) {

          setShowTrim(false);
        } else {





          if (Inttype === 1) {

            setIsImg1(isImage);
          } else {
            setIsImg2(isImage);

          }



          if (ty === 1) {
            setOpenIntMedia(false);
            // somewhere after you’re done with the file
            setTimeout(() => {
              DeleteVideoFromS3(signedVideoUrl);
            }, 1000);
          } else {

            setOpenIntMedia(false);
          }

        }

        console.log("Trim", data.videoUrl);// ready mp4 URL
      } catch (err) {
        console.error("Trim failed", err);
      } finally {
        setIsProcessing(false);
      }
    },
    [CLIK_URL, fmt, region, type, Inttype]
  );


  const handleSliderCommit = () => {
    onSelectionChange?.(region[0], region[1]);
  };

  // ───────────────────────── CSS Wave rail ─────────────────────────
  const railWave = useMemo(
    () =>
      `repeating-linear-gradient(90deg, ${theme.palette.grey[400]} 0px, ${theme.palette.grey[400]} 2px, transparent 2px, transparent 6px)`,
    [theme.palette.grey]
  );

  const buttonStylesx = {
    flex: 0.4,
    backgroundColor: 'red',
    color: '#ffffff',
    ...buttonPadding,
    borderRadius: 2,
    boxShadow: '0px 4px 6px rgba(0,0,0,0.3)',
    '&:hover': {
      backgroundColor: darkModeReducer ? '#bbbbbb' : '#555555',
      color: darkModeReducer ? '#000000' : '#ffffff',
      boxShadow: '0px 6px 8px rgba(0,0,0,0.2)',
    },
  };



  const buttonStyles = {
    flex: 1,
    backgroundColor: darkModeReducer ? '#1e1e1e' : '#f5f5f5',
    color: darkModeReducer ? '#ffffff' : '#000000',
    ...buttonPadding,
    borderRadius: 2,
    boxShadow: '0px 4px 6px rgba(0,0,0,0.3)',
    '&:hover': {
      backgroundColor: darkModeReducer ? '#bbbbbb' : '#555555',
      color: darkModeReducer ? '#000000' : '#ffffff',
      boxShadow: '0px 6px 8px rgba(0,0,0,0.2)',
    },
  };


  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 800,
        mx: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >





      {isProcessingx ? <div
        style={{
          position: "fixed",
          top: "0vh",
          zIndex: 9999,

          width: matchMobile ? "100%" : '100%',
          left: matchMobile ? "0px" : '-0vw',
          height: "100vh",
          textAlign: "center",
          color: '#ffffff',
          backgroundColor: 'rgb(0,0,0,0.45)'
        }}
      > <div
        style={{

          marginTop: "20vh",

        }}
      >  Uploading MP4 </div>   </div> : null
      }


      {isProcessing ? <div
        style={{
          position: "fixed",
          top: "0vh",
          zIndex: 9999,

          width: matchMobile ? "100%" : '100%',
          left: matchMobile ? "0px" : '-0vw',
          height: "100vh",
          textAlign: "center",
          color: '#ffffff',
          backgroundColor: 'rgb(0,0,0,0.45)'
        }}
      > <div
        style={{

          marginTop: "20vh",

        }}
      >  Applying Trim </div>   </div> : null
      }


      {/* ░░░ 
      Video ░░░ */}
      <Box
        sx={{
          position: "relative",
          borderRadius: 2,
          overflow: "hidden",
          boxShadow: 4,
          aspectRatio: "16/9",
          background: "black",
        }}
      >
        <video
          ref={videoRef}
          src={videoURL}
          playsInline
          style={{ width: "100%", height: "100%", display: "block" }}
          onLoadedMetadata={(e) => {
            const dur = (e.target as HTMLVideoElement).duration;
            setVideoDuration(dur);
            setRegion([0, Math.min(duration, dur)]);
          }}
        />


        {/* Play / Pause overlay */}
        <IconButton
          onClick={togglePlay}
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            bgcolor: "rgba(0,0,0,0.55)",
            color: "white",
            p: 2,
            "&:hover": { bgcolor: "rgba(0,0,0,0.75)" },
          }}
        >
          {isPlaying ? (
            <PauseRoundedIcon fontSize="large" />
          ) : (
            <PlayArrowRoundedIcon fontSize="large" />
          )}
        </IconButton>
      </Box>

      {/* ░░░ Wave‑look slider ░░░ */}
      {videoDuration > 0 && (
        <Slider
          value={region}
          min={0}
          max={videoDuration}
          step={0.05}
          onChange={handleSliderChange as any}
          onChangeCommitted={handleSliderCommit}
          sx={{
            height: 130,
            px: 1,
            "& .MuiSlider-rail": {
              height: 130,
              backgroundImage: railWave,
              backgroundSize: "100% 100%",
              opacity: 1,
            },
            "& .MuiSlider-track": {
              height: 130,
              bgcolor: theme.palette.primary.main,
              opacity: 0.35,
            },
            "& .MuiSlider-thumb": {
              width: 14,
              height: 130,
              borderRadius: 1,
              bgcolor: theme.palette.primary.main,
              boxShadow: 1,
              "&:hover, &.Mui-active": { boxShadow: 3 },
            },
          }}
        />
      )}

      {/* ░░░ Timecodes ░░░ */}
      <Stack direction="row" justifyContent="space-between" px={0.5}>
        <Typography variant="caption" >
          Start: {fmt(region[0])}
        </Typography>
        <Typography variant="caption" >
          End: {fmt(region[1])}
        </Typography>
        <Typography variant="caption" >
          Total: {fmt(videoDuration)}
        </Typography>
      </Stack>
      {type === 1 ?

        <Button
          variant="contained"
          onClick={() => { uploadS3(); }}
          sx={{
            flex: 1,
            backgroundColor: darkModeReducer ? "#1e1e1e" : "#f5f5f5",
            color: darkModeReducer ? "#ffffff" : "#000000",
            ...buttonPadding,
            borderRadius: 2,
            boxShadow: "0px 4px 6px rgba(0,0,0,.3)",
            display:
              "block",
            "&:hover": {
              backgroundColor: darkModeReducer ? "#bbbbbb" : "#555555",
              color: darkModeReducer ? "#000000" : "#ffffff",
              boxShadow: "0px 6px 8px rgba(0,0,0,.2)",
            },
          }}
        >
          Trim
        </Button> :
        <>
          <Box sx={{ display: 'flex', width: '100%', gap: 21 }}>
            <Button variant="contained" onClick={() => {
              setOpenIntMedia(false);
            }} sx={buttonStylesx}>
              Close
            </Button>
            <Button variant="contained" onClick={uploadS3} sx={buttonStyles}>
              Trim
            </Button>
          </Box>
        </>}

    </Box >
  );
};

export default InteractTrim;
