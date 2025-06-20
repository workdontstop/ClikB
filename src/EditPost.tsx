import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Card,
  TextField,
  Typography,
} from "@mui/material";

import { CircularProgress } from '@mui/material';

import LockIcon from '@mui/icons-material/Lock';

import { useSelector, useDispatch } from "react-redux";


import { RootState, } from "./store";

import axios from "axios"; // Import Axios

import { matchMobile, matchPc, matchTablet } from "./DetectDevice";


interface StoryVideoEditorProps {
  isOpen: boolean;
  feeds: any;
  verticalActiveIndex: number;
  storyVidArray: any;
  setStoryVidArray: any;
  EnhanceCaptionx: any
  setmp4type: any;
  firstImageDims: any;
  setFirstImageDims: any
}

export default function StoryVideoEditor({ isOpen, feeds, verticalActiveIndex, storyVidArray, setStoryVidArray, EnhanceCaptionx, setmp4type,
  firstImageDims, setFirstImageDims
}: StoryVideoEditorProps) {
  // State for the story text

  const CLIK_URL = import.meta.env.VITE_CLIK_URL;
  const VITE_HUGG = import.meta.env.VITE_HUGG;

  const [storyText, setStoryText] = useState<string>("");

  // State for the images
  const [images, setImages] = useState<string[]>([]);

  const [loader, setloader] = useState<boolean[]>([]);

  const [showbut, setshowbut] = useState(false);

  const [description, setDescription] = useState<string[]>([]);

  const [descriptionHold, setDescriptionHold] = useState<string[]>([]);
  // State for the selected image from the image slider
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);

  // Dummy functions for button actions
  const handleGenerateVideo = () => {
    console.log("Generate Video clicked", { storyText, selectedImageIndex });
  };


  const handlePublish = () => {
    console.log("Publish clicked", { storyText, selectedImageIndex });
  };


  interface ReplicateResponse {
    id: string;
    status: string;
    output?: string; // Some models may not always include "output", so keep it optional
  }


  const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
  const darkMode = darkModeReducer;


  const [tempText, setTempText] = useState("");
  const [submitcheck, setsubmitcheck] = useState(false);

  // Whenever the selected image or its source description changes,
  // refresh the local copy but DON'T touch the original arrays.
  useEffect(() => {
    const initialText = loader[selectedImageIndex]
      ? descriptionHold[selectedImageIndex]
      : description[selectedImageIndex];

    if (submitcheck) {
      loader[selectedImageIndex]
        ? null :
        setTempText(descriptionHold[selectedImageIndex] ?? ""); // fall back to empty string
    } else {
      setTempText(initialText ?? ""); // fall back to empty string
    }
  }, [selectedImageIndex, loader, descriptionHold, description, submitcheck]);


  useEffect(() => {
    console.log(storyVidArray[verticalActiveIndex])
  }, [storyVidArray, verticalActiveIndex, feeds])

  useEffect(() => {
    if (feeds && feeds.length > 0) {
      const feedItem = feeds[verticalActiveIndex];
      // Gather story images from this feed item.

      const storyImages = [
        feedItem.x1,
        feedItem.x2,
        feedItem.x3,
        feedItem.x4,
        feedItem.x5,
        feedItem.x6,
        feedItem.x7,
        feedItem.x8,
      ].filter(Boolean) as string[];



      /*
            const storyImages = [
              feedItem.xh1,
              feedItem.xh2,
              feedItem.xh3,
              feedItem.xh4,
              feedItem.xh5,
              feedItem.xh6,
              feedItem.xh7,
              feedItem.xh8,
            ].filter(Boolean) as string[];
      
      
      */

      setImages(storyImages);

      setloader(Array(storyImages.length).fill(false));

      const storyDescribe = [
        feedItem.gent1,
        feedItem.gent2,
        feedItem.gent3,
        feedItem.gent4,
        feedItem.gent5,
        feedItem.gent6,
        feedItem.gent7,
        feedItem.gent8,
      ].filter(Boolean) as string[];




      setDescription(storyDescribe);

      setDescriptionHold(storyDescribe);


    } else {
      setImages([]);
      setDescription([]);
      setDescriptionHold([]);
    }
  }, [feeds, verticalActiveIndex]);

  // Customize padding for both buttons here.
  const buttonPadding = { px: 3, py: 1.5 };






  const fetchAndGenerateImage = useCallback(
    async (i: number) => {
      try {
        // 1) Ask backend for the visual prompt
        const requestData = {
          imageDescription: description[i === 100 ? selectedImageIndex : i],
          question: feeds[verticalActiveIndex].caption
        };


        const response = await axios.post<any>(
          `${CLIK_URL}/VideoDesign`,
          requestData,
          { withCredentials: true }
        );
        const datax = response.data;

        const visualPromptText = datax.visualPrompt;

        //alert(visualPromptText);

        setDescriptionHold((prevLoader) => {
          const newLoader = [...prevLoader];
          newLoader[i === 100 ? selectedImageIndex : i] = visualPromptText;
          return newLoader;
        });

        if (i === 100) {

          setsubmitcheck(true);

        } else {

          GenerateVideo(visualPromptText, i);

        }

      } catch (error: any) {

        if (error.response) {
          console.error("Server Error:", error.response.data);
        } else if (error.request) {
          console.error("No response received:", error.request);
        } else {
          console.error("Error:", error.message);
        }
      }
    },
    [prompt, description, selectedImageIndex, feeds, verticalActiveIndex, firstImageDims]
  );


  const handleGenerateAll = useCallback(async () => {
    if (!images || images.length === 0) return;

    const initialDelay = 1000; // initial delay before processing the first image (1 second)
    const delayBetweenImages = 10000; // wait 10 seconds before calling the next image

    for (let i = 0; i < images.length; i++) {
      // Update the selected image index so that the UI reflects the current image.
      setSelectedImageIndex(i);

      // Wait for an initial delay based on the index (for the first image it'll be initialDelay,
      // for subsequent images, initialDelay + i * delayBetweenImages can be used if you want more delay)
      await new Promise((resolve) => setTimeout(resolve, initialDelay));

      // Call your async video generation function for the current image.
      // Note: You can pass the index if you need it.
      await fetchAndGenerateImage(i);

      // Wait before processing the next image.
      await new Promise((resolve) => setTimeout(resolve, delayBetweenImages));
    }
  }, [prompt, description, selectedImageIndex, feeds, verticalActiveIndex, images, fetchAndGenerateImage, firstImageDims]);




  // Helper to convert a base64 data-URI to a Blob
  async function base64ToBlob(base64Data: string): Promise<Blob> {
    // base64Data should look like: "data:video/mp4;base64,AAAA..."
    const res = await fetch(base64Data);
    return res.blob();
  }

  const REPLICATE_API_TOKEN = import.meta.env.VITE_REPLI_KEY;

  // Example states you might have in your component or custom hook:
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pollStatus, setPollStatus] = useState("");
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState("");
  const [generatedVideoBlob, setGeneratedVideoBlob] = useState<Blob | null>(null);



  // Inside your component
  const [allVideosPresent, setAllVideosPresent] = useState(false);

  useEffect(() => {
    const isComplete =
      Array.isArray(storyVidArray[verticalActiveIndex]) &&
      storyVidArray[verticalActiveIndex].every(item => item !== '' && item !== null);

    setAllVideosPresent(isComplete);
  }, [storyVidArray, verticalActiveIndex]); // Dependencies


  const GenerateVideo = useCallback(
    async (prompt: string, i: number) => {
      // Mark the current loader element as active.
      setloader((prevLoader) => {
        const newLoader = [...prevLoader];
        newLoader[i === 100 ? selectedImageIndex : i] = true;
        return newLoader;
      });

      try {
        setIsSubmitting(true);
        setPollStatus("Generating Kling video. This can take up to 3 minutes...");

        // Prepare the payload.
        const payload = {
          prompt,
          startImage: images[i === 100 ? selectedImageIndex : i],
          videoLength: 5,

        };

        // Make a POST to your backend route (/klingPro) with an extended timeout of 5 minutes (300000 ms)
        const response = await axios.post<{ videoBase64: string }>(
          `${CLIK_URL}/klingPro`,
          payload,
          { timeout: 400000 } // 5 minute timeout for long-running video generation
        );

        if (response.status !== 200) {
          throw new Error(`Error from server: ${response.status}`);
        }

        // Extract the videoBase64 from the server’s response.
        const { videoBase64 } = response.data;
        if (!videoBase64) {
          throw new Error("No videoBase64 returned from server");
        }

        // Convert the base64 string into a Blob and then create an Object URL.
        const blob = await base64ToBlob(videoBase64);
        const videoObjectUrl = URL.createObjectURL(blob);

        // Save the object URL so that the video can be displayed.
        setGeneratedVideoUrl(videoObjectUrl);
        setPollStatus("Success!");

        // Optionally, generate a signed URL for the video if needed.
        GenerateSignedUrlForVideo(blob, i);
      } catch (err) {
        // Reset loader state when an error occurs.
        setloader((prevLoader) => {
          const newLoader = [...prevLoader];
          newLoader[i === 100 ? selectedImageIndex : i] = false;
          return newLoader;
        });
        console.error("Error generating Kling Pro video:", err);
        setPollStatus("Failed");
      } finally {
        setIsSubmitting(false);
      }
    },
    [images, selectedImageIndex, verticalActiveIndex, feeds, firstImageDims]
  );



  const [error, setError] = useState("");

  // 1) Generate S3 signed URL
  const GenerateSignedUrlForVideo = useCallback(
    async (videoBlob: Blob, i: number) => {
      if (!videoBlob) {
        setError("No video blob for upload.");
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
        await PutVideoInS3WithURL(videoBlob, urlVideo, i);

        console.log("signed URL:", signedUrl);
      } catch (err: any) {

        setloader((prevLoader) => {
          const newLoader = [...prevLoader];
          newLoader[i === 100 ? selectedImageIndex : i] = false;
          return newLoader;
        });

        console.error("Error generating video signed URL:", err);
        setError(err.message || "Error generating video signed URL");
      }
    },
    [verticalActiveIndex, feeds, selectedImageIndex]
  );

  // 2) Upload video to S3 using the signed URL
  const PutVideoInS3WithURL = useCallback(
    async (videoBlob: Blob, signedUrl: string, i: number) => {
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
        console.log("Uploaded video URL:", uploadedVideoUrl);

        saveToDatabase(uploadedVideoUrl, i);

        // (Optional) Save the final URL to your database
        // e.g.: await saveToDatabase(uploadedVideoUrl, promptData, userData);
      } catch (err: any) {

        setloader((prevLoader) => {
          const newLoader = [...prevLoader];
          newLoader[i === 100 ? selectedImageIndex : i] = false;
          return newLoader;
        });

        console.error("Error uploading video to S3:", err);
        setError(err.message || "Error uploading video to S3");
      }
    },
    [verticalActiveIndex, feeds, selectedImageIndex]
  );


  const saveToDatabase = useCallback((vid: any, i: number) => {
    const Data = {
      postId: feeds[verticalActiveIndex].id,
      type: i === 100 ? selectedImageIndex : i,
      vid: vid,
    };

    axios.put(`${CLIK_URL}/UpdatePostAIVideo`, { values: Data })
      .then((response) => {
        if (response) {
          // Update loader state
          setloader((prevLoader) => {
            const newLoader = [...prevLoader];
            newLoader[i === 100 ? selectedImageIndex : i] = false;
            return newLoader;
          });

          // Update the storyVidArray state by setting the 'vid' in the appropriate index.
          setStoryVidArray((prevStoryVidArray: any) => {
            // Create a shallow copy of the state array
            const newStoryVidArray = [...prevStoryVidArray];

            // Get or initialize the story video subarray for the active vertical index
            const currentStoryVideos = newStoryVidArray[verticalActiveIndex]
              ? [...newStoryVidArray[verticalActiveIndex]]
              : [];

            // Update the subarray using the provided 'vid' at the index corresponding to the selected image.
            currentStoryVideos[i === 100 ? selectedImageIndex : i] = vid;

            // Replace the subarray at the vertical index with the updated array
            newStoryVidArray[verticalActiveIndex] = currentStoryVideos;

            return newStoryVidArray;
          });
        }
      })
      .catch((error) => {
        setloader((prevLoader) => {
          const newLoader = [...prevLoader];
          newLoader[i === 100 ? selectedImageIndex : i] = false;
          return newLoader;
        });
        console.log(error);
      });
  }, [verticalActiveIndex, feeds, selectedImageIndex]);





  /* ------------------------------------------------------------------ */
  /* 2️⃣  EFFECT  –– fires whenever the images array changes            */
  useEffect(() => {
    // if there’s no image at index-0 yet, bail out early
    if (!images || images.length === 0 || !images[0]) return;

    let cancelled = false;           // clean-up flag in case the component unmounts
    const probe = new Image();       // off-DOM loader
    probe.src = images[0];

    probe.onload = () => {
      if (cancelled) return;
      setFirstImageDims({
        width: probe.naturalWidth,
        height: probe.naturalHeight,
      });
    };

    // if the fetch errors out we still want to avoid a stuck spinner
    probe.onerror = () => {
      if (cancelled) return;
      setFirstImageDims(null);
    };

    // clean-up to avoid setting state on an unmounted component
    return () => {
      cancelled = true;
    };
  }, [images]);                       // 🔑 re-run only when the image list changes


  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: darkModeReducer ? "rgba(40,40,40,0.85)" : "rgba(240,240,240,0.7)",
        zIndex: 9999,
        display: isOpen ? "flex" : "none",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* White Box Container */}
      <Box

        className={`${darkModeReducer ? "contentdark" : "content"}`}
        sx={{
          /// backgroundColor: "#fff",
          boxShadow: 3,
          borderRadius: matchMobile ? 0 : 2,
          p: 0.5,
          width: { xs: "100%", md: "50%" },
          height: { xs: "100%", md: "100%" },
          display: "flex",
          flexDirection: "column",

        }}
      >
        {/* Story Text Input */}
        <Box>
          <TextField
            fullWidth
            multiline
            rows={4}
            variant="filled"
            value={tempText}
            onChange={(e) => setTempText(e.target.value)}
            sx={{
              "& .MuiInputBase-root:focus": { outline: "none" },
              "& .MuiInputBase-input:focus-visible": { outline: "none" },
              "& .Mui-focused": { outline: "none" },
              "& .MuiInputBase-input": {
                color: darkMode ? "#ffffff" : "#000000",
              },
              "& .MuiInputLabel-root": {
                color: darkMode ? "#ffffff" : "#000000",
              },
            }}
          />
        </Box>

        {/* Generate Video Button - directly under text field */}
        <Box

          onClick={() => {
            if (submitcheck) {


              // GenerateVideo(tempText, 100);
            }

            else {
              /// fetchAndGenerateImage(100);
            }

          }}
          sx={{ mt: 0, mb: 2, }}>
          <Button variant="contained" sx={{
            ...buttonPadding,
            backgroundColor: !darkModeReducer ? "#1e1e1e" : "#f5f5f5",
            color: !darkModeReducer ? "#ffffff" : "#000000",
            "&:hover": {
              backgroundColor: !darkModeReducer ? "#bbbbbb" : "#555555",
              color: !darkModeReducer ? "#000000" : "#ffffff",
              boxShadow: "0px 6px 8px rgba(0, 0, 0, 0.2)",

            }
          }} color="primary" fullWidth>
            <LockIcon fontSize="small" />
            {submitcheck ? 'Go' : 'Generate Video'}
          </Button>
        </Box>

        {/* Horizontal Image Slider */}
        <Box sx={{ mb: 2, p: 0 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Select an Image:
          </Typography>
          <Box
            sx={{
              display: "flex",
              gap: 1,
              overflowX: "auto",
              p: 0,
              borderRadius: 2,
              scrollBehavior: "smooth",
              "&::-webkit-scrollbar": {
                width: "4px",
              },
              "&::-webkit-scrollbar-track": {
                background: "rgb(255,255,255,0)",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "rgb(255,255,255,0)",
                borderRadius: "4px",
              },
              "&::-webkit-scrollbar-thumb:hover": {
                background: "rgb(255,255,255,0)",
              },
            }}
          >
            {images.map((img, index) => {
              // Check if we have a story video for the current verticalActiveIndex and index.
              const storyVideoExists =
                storyVidArray[verticalActiveIndex] &&
                storyVidArray[verticalActiveIndex][index];

              const feedId = feeds[verticalActiveIndex]?.id || "unknown";

              return (
                <Card
                  key={`card-${feedId}-${index}`}
                  sx={{
                    cursor: "pointer",
                    flexShrink: 0,
                    padding: "0px",
                    position: "relative", // enables absolute positioning for the spinner overlay
                    transition: "transform 1s ease",
                    transform:
                      selectedImageIndex === index ? "scale(0.8)" : "scale(1)",
                  }}
                  onClick={() => {
                    setSelectedImageIndex(index);

                    setsubmitcheck(false);

                  }
                  }
                >
                  {storyVideoExists ? (
                    <video
                      src={storyVidArray[verticalActiveIndex][index]}
                      poster={images[index]} // Use a corresponding image as the preview key
                      style={{
                        width: matchMobile ? "150px" : "200px",
                        height: "auto",
                        objectFit: "contain",
                        display: "block",
                        filter: loader[index] ? "brightness(50%)" : "none",
                      }}
                      controls
                      preload="metadata"
                      playsInline
                    />

                  ) : (
                    <img
                      src={img}
                      alt={`Image ${index + 1}`}
                      style={{
                        width: matchMobile ? "150px" : "200px", // Fixed width based on screen size
                        height: "auto", // Maintain aspect ratio
                        objectFit: "contain", // Display the full image without cropping
                        display: "block",
                        filter: loader[index] ? "brightness(50%)" : "none", // Reduce brightness if loading
                      }}
                    />
                  )}
                  {loader[index] && (
                    <CircularProgress
                      size={24}
                      sx={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                      }}
                    />
                  )}
                </Card>
              );
            })}
          </Box>
        </Box>

        {/* Generate All Button - directly under image slider key */}
        <Box sx={{ mb: 2, marginTop: '-1vh' }}>
          <Button variant="outlined" sx={{
            ...buttonPadding, backgroundColor: !darkModeReducer ? "#1e1e1e" : "#f5f5f5",
            color: !darkModeReducer ? "#ffffff" : "#000000",
            "&:hover": {
              backgroundColor: !darkModeReducer ? "#bbbbbb" : "#555555",
              color: !darkModeReducer ? "#000000" : "#ffffff",
              boxShadow: "0px 6px 8px rgba(0, 0, 0, 0.2)",

            }
          }} color="secondary" onClick={
            () => {
              ///handleGenerateAll
            }
          }

            fullWidth>
            <LockIcon fontSize="small" />
            Generate All Videos
          </Button>
        </Box>

        {/* Publish Button (centered) */}


        {showbut ? <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            gap: 2, // space between buttons
            marginTop: matchMobile ? '3vh' : '5vh'
          }}
        >
          <Button

            onClick={() => {

              EnhanceCaptionx('');
              setmp4type(0);

            }}
            sx={{ ...buttonPadding }}
            variant="contained"
            color='info'

          >
            use Images
          </Button>

          <Button

            onClick={() => {

              if (allVideosPresent) {
                EnhanceCaptionx('');
                setmp4type(1);
              }

            }}

            sx={{
              ...buttonPadding, opacity: allVideosPresent ? 1 : 0.3,
              cursor: allVideosPresent ? 'pointer' : 'default'
            }}
            variant="contained"
            color='secondary'

          >
            {allVideosPresent ? 'Use Videos' : 'All Videos Not Created'}
          </Button>
        </Box>
          : <Box onClick={() => {

            setshowbut(true);

          }} sx={{ display: "flex", justifyContent: "center", marginTop: matchMobile ? '3vh' : '5vh' }}>
            <Button sx={{ ...buttonPadding, }} variant="contained" color="success" onClick={handlePublish}>
              Publish
            </Button>


          </Box>}
      </Box>
    </Box>
  );
}
