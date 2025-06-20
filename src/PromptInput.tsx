// PromptInput.tsx

import React, { useState, useCallback, useEffect, useRef } from "react";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import { Button, Box, Menu, MenuItem, Typography, CircularProgress, IconButton, Modal, Avatar } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close"; // Import CloseIcon
import { useSelector } from "react-redux";

import LockIcon from '@mui/icons-material/Lock';

import { RootState } from "./store";
import PingLoader from './ping';
import { matchMobile, matchPc, matchTablet } from "./DetectDevice";
import ImageIcon from '@mui/icons-material/Image';

import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';

import EditIcon from '@mui/icons-material/Edit';

import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import axios from "axios"; // Import Axios


import EditStory from "./EditStory";

import Storybook from './Storybook';

import PromptToolbar from './PromptToolbar';

import CheckIcon from '@mui/icons-material/Check';
///localhost

import SearchIcon from '@mui/icons-material/Search';
import { Scale } from "@mui/icons-material";
import AudioNarration from "./AudioNarration";

import { keyframes } from "@emotion/react";



// Define your CLIK_URL here or import it if it's defined elsewhere
const CLIK_URL = import.meta.env.VITE_CLIK_URL;
const VITE_HUGG = import.meta.env.VITE_HUGG;

// Predefined suggestions for autocomplete
const suggestions: string[] = [
  // Add more predefined prompts as needed
];

const PromptInput: React.FC<any> = React.memo(({ isMenuOpen, setcallFeeds, setAllowPing, AllowPing, minimisePrompt, setminimisePrompt, type, callFeeds, setFluxLoaded,
  fluxLoaded,
  isSubmittingKick,
  setIsSubmittingKick,
  setIsSubmitting,
  isSubmitting,
  IsMobileBackActive,
  setIsMobileBackActive,
  clikt,
  setclikt,
  setHideBottom

}) => {


  const VITE_REPLI_KEY = import.meta.env.VITE_REPLI_KEY;
  const [prompt, setPrompt] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [IsColdStart, setIsColdStart] = useState<boolean>(false); // Optional: To handle cold start state
  const [StopText, setStopText] = useState(false);


  const [promptx, setPromptx] = useState<string>("");

  ///seed

  const [Seed, setSeed] = useState<number>(100);

  const [big, setBig] = useState(false);

  const [narrate, setnarrate] = useState(false);

  const [flip, setflip] = useState(false);

  const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
  const maxCharacters = 1000; // Example character limit



  const [base, setbase] = useState<string[]>([]);
  const [startEdit, setstartEdit] = useState(false);


  const [parsedKeyPoints, setParsedKeyPoints] = useState<string[]>([]);

  const [Planx, setPlanx] = useState<any>(null);

  const [allowSpin, setallowSpin] = useState<any>(false);

  const [DummyMode, setDummyMode] = useState<any>(false);



  // Redux selector for dark mode

  const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
  const darkMode = darkModeReducer;

  const handleChange = useCallback(
    (_: React.SyntheticEvent, newValue: string) => {




      if (StopText) { } else { }



      if (newValue.length <= maxCharacters) {
        if (minipromptRefx.current) {
          clearTimeout(minipromptRefx.current);
        }

        setPrompt(newValue);
        setError("");
      } else {
        setError(`Maximum character limit of ${maxCharacters} exceeded.`);


      }
    },
    [maxCharacters, StopText]
  );

  // State variables for signed URLs
  const [signedUrlThumb, setSignedUrlThumb] = useState<string | null>(null);
  const [signedUrlHD, setSignedUrlHD] = useState<string | null>(null);

  const [GeneratedImageFlux, setGeneratedImageFlux] = useState('');


  const [generatedImagesFluxx, setGeneratedImagesFluxx] = useState<string[]>(
    Array(parsedKeyPoints.length).fill("")
  );



  const [GeneratedImageFluxBlob, setGeneratedImageFluxBlob] = useState<any>(null);
  const [enhancedPromptx, setenhancedPromptx] = useState('');



  const [GeneratedImage, setGeneratedImage] = useState('');



  const [im, setim] = useState(false);

  const [textchange, settextchange] = useState(false);

  const [GotIm, setGotIm] = useState(false);

  const [AudioResult, setAudioResult] = useState('');

  const [selectedStyle, setSelectedStyle] = useState<string>("Auto");

  const applyArtStyleToPlan = (
    plan: any,
    style: string
  ): any => {
    if (style === "Auto") {
      console.log("Plan Created:", plan); // <- ✨ here’s your plan
      return plan;
    }

    const token = `${style} art style`;
    const updatedPlan = {
      ...plan,
      art_style: { style_token: token },
      characters: (plan.characters || []).map((char: any) => ({
        ...char,
        style_token: token,
      })),
    };

    console.log("Plan Updated:", updatedPlan);
    return updatedPlan;
  };


  useEffect(() => {


    console.log(signedUrlHD);
    console.log(signedUrlThumb);
  }, [signedUrlThumb, signedUrlHD]);

  useEffect(() => {


    if (parsedKeyPoints.length > 0) {

      setHideBottom(true);
    } else {

      setHideBottom(false)
    }
  }, [parsedKeyPoints]);


  var timerb: any = null;
  var timerbc: any = null;

  const minipromptRefx = useRef<NodeJS.Timeout | null>(null);


  const minipromptRefx2 = useRef<NodeJS.Timeout | null>(null);


  const [PostId, setPostId] = useState(0);


  const glassSweep = keyframes`
  from { transform: translateX(-150%) rotate(20deg); }
  to   { transform: translateX(150%)  rotate(20deg); }
`;

  useEffect(() => {
    ///clikt
    // Skip if already minimised to prevent unnecessary re-calls
    if (prompt === '' && !minimisePrompt) {
      minipromptRefx2.current = setTimeout(() => {
        setminimisePrompt(true);
      }, 9000);
    }

    // Cleanup
    return () => {
      if (minipromptRefx2.current) {
        clearTimeout(minipromptRefx2.current);
      }
    };
  }, [prompt, minimisePrompt, type]); // still valid




  const [generatedImagesFluxBlobHd, setGeneratedImagesFluxBlobHd] = useState<Blob[]>(
    []
  );

  const [modelz, setModelz] = useState("Schnell");
  const [anchorEl, setAnchorEl] = useState(null);


  useEffect(() => {
    // This code runs every time the URL changes
    // alert('The URL has changed:');
    /// handleCloseOverlay
    // You can perform any other actions here,
    // like fetching data or logging analytics events.
  }, [location]);





  // Function to generate signed URLs
  const GenerateSignedUrl = useCallback(async (GeneratedImageFluxBlob: any, enhancedTextData: any, loggedUserx: any) => {
    if (!GeneratedImageFluxBlob) {
      setError("Image blobs are not available for uploading.");
      return;
    }

    try {
      const requestData = {
        values: { count: 2 },
      };

      // Make the POST request to get signed URLs
      const response: any = await axios.post(
        `${CLIK_URL}/get_signed_url_image`,
        requestData,
        { withCredentials: true } // Include if your backend requires credentials
      );

      const holder = response.data.holder;

      if (!holder || holder.length !== 1) {
        throw new Error("Invalid signed URL response.");
      }

      const signedUrls = holder[0];

      if (!signedUrls.urlBase || !signedUrls.urlHD) {
        throw new Error("Missing signed URLs for images.");
      }

      PutImagesInS3WithURL(GeneratedImageFluxBlob, signedUrls, enhancedTextData, loggedUserx);

      console.log("Signed URLs generated successfully:", signedUrls);
    } catch (err: any) {
      console.error("Error generating signed URLs:", err);
      setError(err.message || "An error occurred while generating signed URLs.");
    }
  }, [CLIK_URL, prompt, promptx]);



  // Function to upload images to S3 using signed URLs
  const PutImagesInS3WithURL = useCallback(
    async (GeneratedImageFluxBlob: any, signedUrls: any, enhancedTextData: any, loggedUserx: any) => {
      if (!signedUrls.urlBase || !signedUrls.urlHD) {
        setError("Signed URLs are not available for uploading.");
        return;
      }

      if (!GeneratedImageFluxBlob) {
        setError("Image blob is not available for uploading.");
        return;
      }

      setError(""); // Clear any existing errors

      try {
        // Upload HD Image
        console.log(`Uploading HD: 10secs Image to ${signedUrls.urlHD}`);
        const uploadHD = await axios.put(signedUrls.urlHD, GeneratedImageFluxBlob, {
          headers: {
            "Content-Type": GeneratedImageFluxBlob.type || "application/octet-stream",
          },
        });

        if (uploadHD.status !== 200 && uploadHD.status !== 204) {
          throw new Error(`HD image upload failed with status ${uploadHD.status}`);
        }

        console.log("HD image uploaded successfully.");

        // Extract the uploaded image URLs (remove query parameters)
        const uploadedHdUrl = signedUrls.urlHD.split("?")[0];
        console.log(uploadedHdUrl);

        // Update state with uploaded URLs
        saveToDastabase(uploadedHdUrl, enhancedTextData, loggedUserx);

      } catch (err: any) {
        console.error("Error during image upload:", err);
        setError(err.message || "An error occurred during the image upload.");
      }
    },
    [promptx]
  );

  /**
   * Detects if the user agent is an iPhone.
   * (Very simple check; can be refined if needed.)
   */
  function isIphone(): boolean {
    return /iPhone/i.test(navigator.userAgent);
  }

  /**
   * Converts an input Blob (PNG/JPEG/etc.) into a resized image Blob at 1080×1920.
   * On iPhone, always use JPEG. On other devices, use WebP.
   *
   * @param inputBlob - The original image as a Blob
   * @returns A Promise resolving to the converted image as a Blob
   */
  async function convertToHDWebpOrJpegByDevice(inputBlob: Blob, modelx: any): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      // Step 1: Read the Blob into a Data URL
      const reader = new FileReader();
      reader.readAsDataURL(inputBlob);

      reader.onload = () => {
        const imageUrl = reader.result as string;
        const img = new Image();

        // Step 2: When the image loads, draw it onto a 1080×1920 canvas
        img.onload = () => {

          const canvas = document.createElement("canvas");

          if (modelx === 'Gpt Image') {
            canvas.width = 1024;
            canvas.height = 1536;

          } else {
            canvas.width = 1080;
            canvas.height = 1920;

          }

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return reject(new Error("Unable to get 2D context from canvas."));
          }

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Decide the format based on iPhone detection
          const format = isIphone() ? "image/jpeg" : "image/webp";
          /// alert(` Using format ${format}`);

          // Step 3: Convert the canvas to a Blob
          canvas.toBlob(
            (outputBlob) => {
              if (outputBlob) {
                resolve(outputBlob);
              } else {
                reject(new Error("Canvas toBlob returned null."));
              }
            },
            format,
            0.8 // 80% quality
          );
        };

        // Handle errors while loading the image
        img.onerror = (error) => {
          reject(error);
        };

        // Begin loading the image
        img.src = imageUrl;
      };

      // Handle file-reading errors
      reader.onerror = (error) => {
        reject(error);
      };
    });
  }


  // Example usage:
  async function exampleUsage() {
    // Suppose you have a file input or some Blob
    const inputBlob = new Blob(); // Placeholder

    try {
      const convertedBlob = await convertToHDWebpOrJpegByDevice(inputBlob, '');
      console.log("Successfully converted image. Blob:", convertedBlob);
      // Do something with the converted Blob (e.g., upload, display, etc.)
    } catch (e) {
      console.error("Failed to convert image:", e);
    }
  }


  // Customize padding for both buttons here.
  const buttonPadding = { px: 3, py: 1.5 };




  // Example callback that submits a Flux generation request using the BFL API.



  // Add a new piece of state to track poll status flux pro
  const [pollStatus, setPollStatus] = useState<string>("");


  // Example updated handleSubmitFluxImage
  const handleSubmitSdxlImageRepli = useCallback(
    async (
      imageUrlFromSdxl: string,   // optional image URL from another model
      enhancedPrompt: string,     // user prompt
      loggedUserx: any            // user object
    ) => {


      setIsSubmitting(true);
      setPollStatus("Polling Replicate...");

      setBig(false);

      try {
        let base64Image = "";

        // If we have an image URL from SDXL (or anywhere)
        if (imageUrlFromSdxl && imageUrlFromSdxl.trim() !== "") {
          const imageResponse = await fetch(imageUrlFromSdxl);
          if (!imageResponse.ok) {
            throw new Error(
              `Failed to fetch image: ${imageResponse.statusText}`
            );
          }
          const imageBlob = await imageResponse.blob();

          // Convert Blob -> base64
          base64Image = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(imageBlob);
          });
        }

        // Build the payload
        const payload: any = {
          inputs: enhancedPrompt,
          // any extra parameters you need
          width: 1080,
          height: 1920,
          guidance: 7.5,
          num_inference_steps: 35,
        };

        // Conditionally include the image if available
        var url = 'sdxlReplicatePro';

        if (base64Image) {
          payload.image = base64Image;
          url = 'sdxlReplicate';
        }

        // Make the POST request
        const response: any = await axios.post(`${CLIK_URL}/${url}`, payload, {
          withCredentials: true,
        });

        if (response.status !== 200) {
          throw new Error(`FluxSchnell route error: ${response.status}`);
        }

        // Extract final base64 from server
        const { imageBase64 } = response.data;
        if (!imageBase64) {
          throw new Error("No imageBase64 returned from server");
        }

        // Convert the returned base64 back to a Blob
        const fluxImageBlob = await (async () => {
          const fetchRes = await fetch(imageBase64);
          return await fetchRes.blob();
        })();

        // Now do whatever you need (convert to HD, etc.)
        const finalBlob = await convertToHDWebpOrJpegByDevice(fluxImageBlob, '');
        const finalUrl = URL.createObjectURL(finalBlob);



        setGeneratedImage(finalUrl);

        handleSubmitFluxImage(finalUrl, enhancedPrompt, loggedUserx, 2200);

      } catch (err) {
        console.error("Error calling Flux Inference Endpoint:", err);
        setPollStatus("Failed!");
      }
    },
    [prompt, modelz]
  );



  // Example updated handleSubmitFluxImage
  const handleSubmitFluxImage = useCallback(
    async (
      imageUrlFromSdxl: string,   // optional image URL from another model
      enhancedPrompt: string,     // user prompt
      loggedUserx: any,
      seed: any         // user object
    ) => {
      setIsSubmitting(true);
      setPollStatus("Polling Replicate...");

      setBig(false);

      try {
        let base64Image = "";

        // If we have an image URL from SDXL (or anywhere)
        if (imageUrlFromSdxl && imageUrlFromSdxl.trim() !== "") {
          const imageResponse = await fetch(imageUrlFromSdxl);
          if (!imageResponse.ok) {
            throw new Error(
              `Failed to fetch image: ${imageResponse.statusText}`
            );
          }
          const imageBlob = await imageResponse.blob();

          // Convert Blob -> base64
          base64Image = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(imageBlob);
          });
        }

        // Build the payload
        const payload: any = {
          inputs: enhancedPrompt,
          // any extra parameters you need
          width: 1080,
          height: 1920,
          guidance: 7.5,
          num_inference_steps: 35,
          seed: seed
        };

        // Conditionally include the image if available
        var url = 'fluxDev';

        if (modelz === 'Flux Pro') {
          ///  url = 'fluxPro';

          if (base64Image) {
            payload.image = base64Image;
            url = 'fluxDev';
          }
        } else if (modelz === 'Schnell') {
          url = 'fluxschnell';

        } else if (modelz === 'Hi Dream') {

          url = 'HiDream';
        }
        else if (modelz === 'Ideogram') {

          url = 'Ideogram';
        }
        else if (modelz === 'Imagen') {

          url = 'Imagen';
        }
        else if (modelz === 'Gpt Image') {

          url = 'GptImage';
        } else {

          url = 'fluxschnell';


        }



        // Make the POST request
        const response: any = await axios.post(`${CLIK_URL}/${url}`, payload, {
          withCredentials: true,
        });

        if (response.status !== 200) {
          throw new Error(`FluxSchnell route error: ${response.status}`);
        }
        setLoader(100);


        setTimeout(async () => {


          // Extract final base64 from server
          const { imageBase64 } = response.data;
          if (!imageBase64) {
            throw new Error("No imageBase64 returned from server");
          }

          // Convert the returned base64 back to a Blob
          const fluxImageBlob = await (async () => {
            const fetchRes = await fetch(imageBase64);
            return await fetchRes.blob();
          })();

          // Now do whatever you need (convert to HD, etc.)
          const finalBlob = await convertToHDWebpOrJpegByDevice(fluxImageBlob, modelz);
          const finalUrl = URL.createObjectURL(finalBlob);

          // Show it in your UI
          setGeneratedImageFlux(finalUrl);
          setGeneratedImageFluxBlob(finalBlob);
          setenhancedPromptx(enhancedPrompt);

          setIsSubmitting(false);

          // Optionally push it to your storage

          /// GenerateSignedUrl(finalBlob, enhancedPrompt, loggedUserx);
          setBig(true);
          setPollStatus("Succeeded");

        }, 1000)



      } catch (err) {
        setLoader(100);
        console.error("Error calling Flux Inference Endpoint:", err);
        setPollStatus("Failed!");
      }
    },
    [prompt, modelz]
  );




  type ModelName = 'Schnell' | 'Hi Dream' | 'Ideogram' | 'Gpt Image' | 'Imagen';

  interface Model {
    name: ModelName;
    img: string;
  }


  const MODELS: Model[] = [
    {
      name: "Gpt Image",
      img: "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-4fcf6d5e800c3383ffebd74ec7a942dd.png",
    },
    {
      name: "Imagen",
      img: "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-e24ad34dff260dc914809380e323be7e.png",
    },


    {
      name: "Ideogram",
      img: "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-6435f7be3285745c833b714525e87269.png",
    },

    {
      name: "Hi Dream",
      img: "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-325dfa0100fac12f81437b5a61fc2a32.png",
    },
    {
      name: "Schnell",
      img: "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-325dfa0100fac12f81437b5a61fc2a32.png",
    },



  ];

  /** the three demo batches you supplied ---------------------------------- */
  const DEMO_SETS: Record<ModelName, string>[][] = [
    /* 1 */
    [
      {
        'Gpt Image': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-44436e043dd754b3b0d4bcc07251a7e5.png",
        'Imagen': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-7cb8cd547024001bad495fc4c576d8d4.png",
        'Ideogram': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-9cb89fbdb00d28fee54ec438c989699d.png",
        'Hi Dream': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-5ac948abd76e3593332fe1520ac8458f.png",
        'Schnell': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-faefd11606ccd381a1aeeb4500fa7e0d.png",
      },
    ],
    /* 2 */
    [
      {
        'Gpt Image': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-14052339b97030047eab1335c6e7ae57.png",
        "Imagen":
          "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-e25f3ba98929e2693cbb4641337e7019.png",

        'Ideogram': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-0968126f0da9849a5f7aa03639246a61.png",
        'Hi Dream': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-f4f5c547e3328758c2ab39cbebe1149f.png",
        'Schnell': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-c77a574eadf3582ddd6db0369b06aaf0.png",
      },
    ],
    /* 3 */
    [
      {
        'Gpt Image': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-5604f8a4589eb0abbb382b7f6f3d6e82.png",
        "Imagen":
          "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-338107e75b5364d55db188a84d824915.png",

        'Ideogram': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-4c3d573a1e73f1c7081bbbd9a1a524a3.png",
        'Hi Dream': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-fbb408f308ea5d94dad2c54ad2cbf3fb.png",
        'Schnell': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-50e8ecb0099bd2afc880e77e64a99d4a.png",
      },
    ],
    /* 4 */
    [
      {
        'Gpt Image': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-4fcf6d5e800c3383ffebd74ec7a942dd.png",
        "Imagen":
          "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-1ac3b5bd814f2006837761d18bed64bb.png",

        'Ideogram': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-6435f7be3285745c833b714525e87269.png",
        'Hi Dream': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-df8ba377a739c0bb56f2606df3672951.png",
        'Schnell': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-84e8aea68a3e5c421338005377641cdf.png",
      },
    ],
  ];

  /** helper to flatten a demo record into a Model[] ------------------------ */
  function recordToModels(
    base: Model[],
    record: Record<ModelName, string>
  ): Model[] {
    return base.map((m) => ({
      ...m,
      img: record[m.name] ?? m.img, // keep fallback if missing
    }));
  }

  const [open, setOpen] = useState(false);

  const [models, setModels] = useState<Model[]>(MODELS); // initial = fallback

  /* choose a random set whenever `open` toggles ------------------------- */
  useEffect(() => {
    if (!open) return;

    const randomRecord =
      DEMO_SETS[Math.floor(Math.random() * DEMO_SETS.length)][0];
    setModels(recordToModels(MODELS, randomRecord));
  }, [open]);


  const prettyLabel = modelz.charAt(0).toUpperCase() + modelz.slice(1);

  const handleSelect = (name: string) => {
    setModelz(name);
    setOpen(false);
  };


  const handleSubmitFlux = useCallback(
    async (enhancedPrompt: string, loggedUserx: any) => {
      try {
        // If you're controlling any UI state (loading, labels, etc.)
        // from your original code, you can keep those here:
        settextchange(false);
        setIsSubmitting(true);
        setLabel('Loading Hd: 10secs');
        setShowLabel(true);

        // Construct the payload WITHOUT extra image data
        const payload = {
          inputs: enhancedPrompt,


        };

        const fluxEndpoint =
          'https://slll6h6mzbbr88gv.us-east-1.aws.endpoints.huggingface.cloud';

        const response = await fetch(fluxEndpoint, {
          method: 'POST',
          headers: {
            Accept: 'image/png',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VITE_HUGG}`, // replace with your token variable
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Flux API Error: ${response.status} - ${errorData}`);
        }

        // Stop ping timer if you have one
        setAllowPing(false);

        // Convert the Flux response into a Blob (PNG)
        const fluxImageBlob = await response.blob();

        // (Optional) If you have a function to store the image in the backend:
        GenerateSignedUrl(fluxImageBlob, enhancedPrompt, loggedUserx);

        // Create a local object URL for preview
        const fluxImageUrl = URL.createObjectURL(fluxImageBlob);
        setGeneratedImageFlux(fluxImageUrl);

        // Reset or finalize UI state
        setIsSubmitting(false);
        setIsFluxOnTop(true);


      } catch (err) {

        handleCloseOverlay();

        console.error('Error calling Flux Inference Endpoint:', err);
        setIsSubmitting(false);
        // Optionally handle errors in your UI
      }
    },
    [/* dependencies if needed */]
  );



  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);

    // 1) Create an HTML Image object
    const img = new Image();
    img.onload = async () => {
      // 2) Once the image is loaded, create a canvas
      const desiredWidth = 1080;
      const desiredHeight = 1920;

      const canvas = document.createElement("canvas");
      canvas.width = desiredWidth;
      canvas.height = desiredHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Original aspect ratio
      const originalWidth = img.width;
      const originalHeight = img.height;
      const originalAspect = originalWidth / originalHeight;

      // Desired aspect ratio
      const desiredAspect = desiredWidth / desiredHeight;

      let drawWidth, drawHeight;
      let offsetX = 0, offsetY = 0;

      // 3) Calculate the scaled width/height so that
      //    the original image’s aspect ratio is preserved.
      if (originalAspect > desiredAspect) {
        // Image is relatively "wide", so match the canvas height
        drawHeight = desiredHeight;
        drawWidth = drawHeight * originalAspect;
        // Center the image horizontally (negative offset if too wide)
        offsetX = (desiredWidth - drawWidth) * 0.5;
      } else {
        // Image is relatively "tall", so match the canvas width
        drawWidth = desiredWidth;
        drawHeight = drawWidth / originalAspect;
        // Center the image vertically (negative offset if too tall)
        offsetY = (desiredHeight - drawHeight) * 0.5;
      }

      // 4) Create the image onto the canvas at the calculated scale & offsets
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

      // 5) Convert canvas to a Blob (JPEG at 90% quality)
      const resizedBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
      });

      if (!resizedBlob) return;

      // 6) Create a preview URL from the blob
      const resizedImageUrl = URL.createObjectURL(resizedBlob);
      setGeneratedImage(resizedImageUrl);

      setGotIm(true);
      // 7) (Optional) If you want to upload the blob to your server or S3:
      // await uploadResizedImage(resizedBlob);
      event.target.value = '';

    };

    // Trigger the loading process
    img.src = imageUrl;
  };



  const handleImageSubmit = useCallback((enhancedTextx: any, loggedUserx: any, seed: any) => {


    if (GeneratedImage) {
      ///alert('im');
      handleSubmitSdxlImageRepli(GeneratedImage, enhancedTextx, loggedUserx);

    } else {
      //alert('no');
      ///handleSubmitSdxlImageRepli('', enhancedTextx, loggedUserx);

      handleSubmitFluxImage('', enhancedTextx, loggedUserx, seed);
    }
  }, [GeneratedImage, modelz]);



  const handleSubmitSdxl = useCallback(async (enhancedText: any, loggedUserx: any) => {
    // Immediately show loader
    setIsSubmitting(true);

    // Keep forcing the loader to true on an interval
    const intervalId = setInterval(() => {
      setIsSubmitting(true);
    }, 500);

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError("Prompt cannot be empty.");
      return;
    }

    try {
      const response = await fetch(
        "https://mjuutqlkaw0l3v21.us-east-1.aws.endpoints.huggingface.cloud",
        {
          method: "POST",
          headers: {
            Accept: "image/png",
            "Content-Type": "application/json",
            Authorization: `Bearer ${VITE_HUGG}`,
          },
          body: JSON.stringify({
            inputs: trimmedPrompt,
            parameters: {
              height: 1024,
              width: 1024,
              num_inference_steps: 35,
              guidance_scale: 7.5,
            },
          }),
        }
      );

      if (response.ok) {

        setAllowPing(false);
        ///setIsFluxOnTop(true);

        const imageBlob = await response.blob();
        //setGeneratedImageBlob(imageBlob);
        const imageUrl = URL.createObjectURL(imageBlob);
        setGeneratedImage(imageUrl);

        setim(true)

        ///handleSubmitFlux(imageUrl)

        ///EnhanceText(prompt, imageUrl, loggedUser);

        handleSubmitFluxImage(imageUrl, enhancedText, loggedUserx, 100)


        ///setIsSubmitting(true); // Set loading state
        /// setLabel('Loading Hd: 10secs');
        /// setShowLabel(true);
      } else {
        setAllowPing(true);
        /// handleSubmitDefaultSdxl();
      }
    } catch (err) {

      handleCloseOverlay();
      console.error("Error calling Hugging Face Inference Endpoint:", err);
      setError("An error occurred while generating the image. Please try again.");
    } finally {
      // Clear the interval and hide loader
      clearInterval(intervalId);
      // setIsSubmitting(false);
    }
  }, [prompt, loggedUser, modelz]);

  const handleSubmitDefaultSdxl = useCallback(async () => {
    setGeneratedImageFlux('');

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError("Prompt cannot be empty.");
      return;
    }

    setIsSubmitting(true); // Set loading state
    console.log('using Serverless Api');
    try {
      // Make the fetch request to the Hugging Face Inference Endpoint
      const response = await fetch(
        "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0", // Replace with your actual endpoint URL
        {
          method: "POST",
          headers: {
            Accept: "image/png", // Request image response
            "Content-Type": "application/json", // Specify JSON format for request
            Authorization: `Bearer ${VITE_HUGG}`, // Hugging Face API token
          },
          body: JSON.stringify({
            inputs: trimmedPrompt,
            parameters: {
              height: 1024, // Optional: Specify image height
              width: 1024,  // Optional: Specify image width
              num_inference_steps: 50, // Optional: Number of steps for better image quality
              guidance_scale: 7.5, // Optional: Higher value for better adherence to prompt
            },
          }),
        }
      );

      // Convert the Blob response into a URL for display
      const imageBlob = await response.blob();
      const imageUrl = URL.createObjectURL(imageBlob);

      // Update your state to display the image
      if (imageUrl) { setGeneratedImage(imageUrl); }
      // setIsSubmitting(false);

      // Clear input and error
      // setPrompt("");
      setError("");

      if (response.ok) {
        ///handleSubmitFlux(imageUrl);
        setIsFluxOnTop(false);
        ///setIsSubmitting(true); // Set loading state
        /// setLabel('Loading Hd: 10secs');
        /// setShowLabel(true);
      } else {
      }
    } catch (err) {
      console.error("Error calling Hugging Face Inference Endpoint:", err);
      setError("An error occurred while generating the image. Please try again.");
    } finally {
      // setIsSubmitting(false); // Reset loading state
    }
  }, [prompt]);

  const handleSubmit = useCallback(() => {
    setGeneratedImageFlux('');
    setParsedKeyPoints([]);
    /// handleSubmitSdxl();


    EnhanceText(prompt, loggedUser);

  }, [handleSubmitSdxl, prompt, loggedUser, GeneratedImage]);

  // Define TypeScript interfaces
  interface EnhanceTextRequest {
    pp: string;
    prompt: string;

  }

  interface EnhanceTextResponse {
    message: string;
    initialSteps: string;

  }


  // State variables
  const [enhancedText, setEnhancedText] = useState<string>('');



  // Define the EnhanceText function
  const StartStory = async (pp: any, loggedUserx: any, selectedStyle: any, typex: any) => {
    setIsSubmittingKick(true);

    setallowSpin(true);

    setError('');
    try {
      // Prepare the request payload
      const requestData: EnhanceTextRequest = { pp, prompt };


      var url = 'startStory';

      if (typex === 0) {
        url = 'startMemes';
      }

      // Make the POST request to the server
      const response = await axios.post<EnhanceTextResponse>(
        `${CLIK_URL}/${url}`,
        requestData,
        { withCredentials: true }
      );

      // Extract data from the response
      const data = response.data;


      console.log("log:", data);


      const parsed: any = data.initialSteps;


      ///setParsedKeyPoints(parsed.keyPoints);


      StartPlan(pp, parsed.keyPoints, selectedStyle);


      console.log("Enhancement Completed:", parsed.keyPoints);

      // Update state with the enhanced text


      //setPrompt(data.initialSteps);

      console.log(data.initialSteps);


    } catch (error: any) {

      setshowButton(true);

      setallowSpin(false);
      // Handle different error scenarios
      if (error.response) {
        // Server responded with a status other than 2xx
        console.error("Server Error:", error.response.data);
        setError(error.response.data.message || "Server Error");
      } else if (error.request) {
        // Request was made but no response received
        console.error("No response received:", error.request);
        setError("Network Error: No response received from server.");
      } else {
        // Other errors
        console.error("Error:", error.message);
        setError(error.message);
      }
    } finally {
      ///setIsLoading(false);
    }
  }




  // Define the EnhanceText function
  const StartPlan = async (pp: any, x: any, selectedStyle: any) => {
    setIsSubmittingKick(true);

    setError('');
    try {
      // Prepare the request payload

      const requestData: any = { pp, x };

      // Make the POST request to the server
      const response = await axios.post<any>(
        `${CLIK_URL}/startPlan`,
        requestData,
        { withCredentials: true }
      );

      const { plan } = response.data                     // <- ✨ here’s your plan
      console.log("Plan Created:", plan)

      // example use:



      var finalPlan = plan;

      if (selectedStyle === 'Auto') {


      } else {


        finalPlan = applyArtStyleToPlan(plan, selectedStyle);
        // do something with finalPlan…



      }


      setPlanx(finalPlan);




      setallowSpin(false);
      setParsedKeyPoints(x);






      // Update state with the enhanced text


      //setPrompt(data.initialSteps);




    } catch (error: any) {
      setallowSpin(false);
      // Handle different error scenarios
      if (error.response) {
        // Server responded with a status other than 2xx
        console.error("Server Error:", error.response.data);
        setError(error.response.data.message || "Server Error");
      } else if (error.request) {
        // Request was made but no response received
        console.error("No response received:", error.request);
        setError("Network Error: No response received from server.");
      } else {
        // Other errors
        console.error("Error:", error.message);
        setError(error.message);
      }
    } finally {
      ///setIsLoading(false);
    }
  }


  const callAudio = async () => {


    try {
      // Prepare the request payload
      const requestData: any = { prompt };
      setAudioResult('');

      setaudioLoad(true);
      // Make the POST request to the server
      const response = await axios.post<any>(
        `${CLIK_URL}/ChatGPTApiAudio`,
        requestData,
        { withCredentials: true }
      );

      // Extract data from the response
      const data = response.data;

      console.log("Enhancement Completed:", data.responseText);

      // Update state with the enhanced text
      //setEnhancedText(data.initialSteps);
      //setPrompt(data.initialSteps);

      setAudioResult(data.responseText);
      setaudioLoad(false)


    } catch (error: any) {
      handleCloseOverlay();



      // Handle different error scenarios
      if (error.response) {
        // Server responded with a status other than 2xx
        console.error("Server Error:", error.response.data);
        setError(error.response.data.message || "Server Error");
      } else if (error.request) {
        // Request was made but no response received
        console.error("No response received:", error.request);
        setError("Network Error: No response received from server.");
      } else {
        // Other errors
        console.error("Error:", error.message);
        setError(error.message);
      }
    } finally {
      ///setIsLoading(false);
    }
  }




  // Define the EnhanceText function
  const EnhanceText = async (pp: any, loggedUserx: any) => {

    setIsSubmitting(true);
    setError('');
    var long = 0

    if (modelz === 'Flux Pro') {

      long = 1
    }


    try {
      // Prepare the request payload
      const requestData: any = { pp, prompt, long };

      // Make the POST request to the server
      const response = await axios.post<EnhanceTextResponse>(
        `${CLIK_URL}/ChatGPTApiDesign4`,
        requestData,
        { withCredentials: true }
      );

      // Extract data from the response
      const data = response.data;

      console.log("Enhancement Completed:", data.initialSteps);

      const seed = Math.floor(Math.random() * 1_000_000_000);


      setSeed(seed);

      // Update state with the enhanced text
      setEnhancedText(data.initialSteps);
      //setPrompt(data.initialSteps);

      ///handleSubmitFluxImage(img, data.initialSteps, loggedUserx)

      /// handleSubmitSdxl(data.initialSteps, loggedUserx);

      handleImageSubmit(data.initialSteps, loggedUserx, seed)

    } catch (error: any) {
      handleCloseOverlay();

      // Handle different error scenarios
      if (error.response) {
        // Server responded with a status other than 2xx
        console.error("Server Error:", error.response.data);
        setError(error.response.data.message || "Server Error");
      } else if (error.request) {
        // Request was made but no response received
        console.error("No response received:", error.request);
        setError("Network Error: No response received from server.");
      } else {
        // Other errors
        console.error("Error:", error.message);
        setError(error.message);
      }
    } finally {
      ///setIsLoading(false);
    }
  }



  const [showButton, setshowButton] = useState(false);


  useEffect(() => {
    if (prompt.trim() === "") return; // Do not submit if prompt is empty

    if (type === 0 || type === 1) {



      if (!AllowPing) {

        setAllowPing(true);
        //// alert('lkjh');
      }
    }



    setshowButton(true);

    const handler = setTimeout(() => {


      setshowButton(false);

    }, 50000); // 500 milliseconds = 0.5 seconds

    // Cleanup the timeout if prompt changes before 0.5 seconds
    return () => {
      clearTimeout(handler);
    };
  }, [prompt, handleSubmit]);



  const handleStartSubmit = useCallback(() => {


    setshowButton(false);

    if (GeneratedImage) {
      setGotIm(true);
    } else {
      setGotIm(false);
    }

    if (type === 1 || type === 0) {

      ///  settextchange(true);
      /// handleSubmit();
      StartStory(prompt, loggedUser, selectedStyle, type);

    }

    else if (type === 2) {

      callAudio();

    }

    else {


    }


  }, [type, handleSubmit, GeneratedImageFlux, GeneratedImage, selectedStyle, type])



  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();


        handleStartSubmit();

      }
    },
    [handleStartSubmit, type]
  );





  const [isFluxOnTop, setIsFluxOnTop] = useState(true); // Tracks which image is on top
  const [label, setLabel] = useState<string>("");

  const [showLabel, setShowLabel] = useState<boolean>(false);

  const handleImageClick = useCallback(() => {


    if (big) {

      setstartEdit(true);
    }
  }, [big]);

  useEffect(() => {
    if (GeneratedImageFlux) {
      setLabel('');
    }
  }, [GeneratedImageFlux]);

  useEffect(() => {
    if (showLabel) {
      const timer = setTimeout(() => {
        setShowLabel(false);
      },
        label === 'Loading Hd: 10secs' ? 900000 : 5000); // 900000 ms = 15 minutes or 5000 ms = 5 sec

      // Cleanup the timer when the component unmounts or when showLabel changes
      return () => clearTimeout(timer);
    }
  }, [showLabel]);

  const saveToDastabase = useCallback((uploadedHdUrluploadedHdUrl: any, enhancedTextData: any, loggedUserx: any) => {
    var Datall = ({
      id: loggedUserx ? loggedUserx.id : null,
      caption: promptx ? promptx : enhancedTextData,
      imagehd: uploadedHdUrluploadedHdUrl,
    });

    axios.post(`${CLIK_URL}/generatedImagePost`, {
      values: Datall,
    })
      .then((response: any) => {
        console.log(response);


        const newRowId = response.data.go;

        setPostId(newRowId);


        setStopText(false);

        ///   setTimeout(() => { setcallFeeds(true); }, 500);

        ///  setTimeout(() => { handleCloseOverlay(); }, 10);


      })
      .catch((error) => {
        handleCloseOverlay();
        console.log(error);
      });

  }, [promptx])

  // **New State Variable to Control Overlay Visibility**
  const [showOverlay, setShowOverlay] = useState<boolean>(false);

  const [audioLoad, setaudioLoad] = useState<boolean>(false);

  // **Trigger Overlay When Image Generation Starts**
  useEffect(() => {
    if (isSubmitting) {
      setShowOverlay(true);
    } else {
      setShowOverlay(false);

    }
  }, [isSubmitting]);

  // **Function to Close Overlay**
  const handleCloseOverlay = () => {
    setbase([]);
    /// setPromptx('');
    // setPrompt('');
    setaudioLoad(false)
    setAllowPing(true);

    setGeneratedImage('');
    setGeneratedImageFlux('');
    setGeneratedImagesFluxx([]);
    setParsedKeyPoints([]);
    setIsSubmittingKick(false);
    setGeneratedImageFluxBlob([]);

    setShowOverlay(false);

  };


  const handleCloseOverlay2 = () => {
    setbase([]);
    setaudioLoad(false)
    setAllowPing(true);
    setShowOverlay(true);
    setGeneratedImageFlux('');
    setParsedKeyPoints([]);
  }




  useEffect(() => {


    if (GeneratedImageFlux && isSubmitting || isSubmittingKick) {





      setStopText(true);
    } else {

      setStopText(false);
    }



  }, [GeneratedImageFlux, isSubmitting, isSubmittingKick]);



  /* ------------------------------------------------------------------ */
  const [loader, setLoader] = useState(0);          // 0 – 100 %

  /* ------------------------------------------------------------------ */
  /* Kick off / reset when isSubmitting flips                           */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (isSubmitting) {
      const start = Date.now();                 // ms
      const DURATION = 3 * 60 * 1000;           // 5 minutes in ms
      const CAP = 95;                           // never exceed 95 %

      // reset immediately
      setLoader(0);

      timer = setInterval(() => {
        const elapsed = Date.now() - start;     // ms since start
        const t = Math.min(elapsed / DURATION, 1); // 0 – 1 timeline

        /* cubic-easing curve  → fast start, slow finish              *
         *   easeOutCubic(t) = 1 – (1 – t)^3                          */
        const eased = 1 - Math.pow(1 - t, 3);

        const pct = Math.round(eased * CAP);   // 0 → 95 % non-linear
        setLoader(prev => (pct > prev ? pct : prev));
      }, 200);                                  // update every 0.2 s
    }

    /* cleanup on unmount / when isSubmitting flips to false */
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isSubmitting]);
  /* ------------------------------------------------------------------ */
  /* When the generation completes, bump to 100 % then hide overlay     */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!isSubmitting && loader < 100) {
      // when you set isSubmitting = false, bump to 100 first
      setLoader(100);
      // overlay will disappear because isSubmitting === false
    }
  }, [isSubmitting]);                                // runs once on finish



  const Manual = () => {


    setIsSubmittingKick(false);

    setParsedKeyPoints(
      ["",
        "",
        " ",
        "",
      ]);

    setDummyMode(true)
  }

  return (
    <>




      <Box sx={{
        paddingTop: "0vh",
        backgroundColor: darkModeReducer ? 'rgb(5,5,5,0.25)' : "rgb(205,205,205,0.25)",
        backdropFilter: darkModeReducer ? matchMobile ? "blur(18px)" : "blur(30px)" : matchMobile ? "blur(12px)" : "blur(18px)",
        zIndex: 2, position: 'fixed',

        width: matchMobile ? '100%' :
          isMenuOpen ? '80%' : '100%'
      }}>

        <div style={{ position: 'fixed', top: '20vh', zIndex: 200, display: 'none' }}>
          {pollStatus && <p>{pollStatus}</p>}
          {/* existing UI */}
        </div>

        {
          minimisePrompt ?

            null
            :

            <>

              <PromptToolbar
                Manual={Manual}
                type={type}
                setPrompt={setPrompt}
                selectedStyle={selectedStyle}
                setSelectedStyle={setSelectedStyle}

                parsedKeyPoints={parsedKeyPoints}
                GeneratedImageFlux={GeneratedImageFlux}
                handleCloseOverlay={handleCloseOverlay}

                allowSpin={allowSpin}

                onClose={() => { }}
              />

              <Autocomplete
                freeSolo
                options={suggestions}
                inputValue={prompt}
                onInputChange={handleChange}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label=""
                    onFocus={() => {
                      ///  setclikt(true);
                      if (minipromptRefx2.current) {
                        clearTimeout(minipromptRefx2.current);
                      }
                      setIsMobileBackActive(true)
                    }}
                    onBlur={() => {
                      /// setclikt(false);
                      setIsMobileBackActive(false)
                    }}

                    variant="filled"
                    fullWidth
                    multiline
                    minRows={2}
                    placeholder={type === 0 ? "Describe max 4 images" : type === 1 ? "Enter anything but be specific to generate a visual" :
                      type === 2 ? "Ask anything, I will reply with a friendly audio" :
                        type === 3 ? "oops, Interactions Still In Development" :
                          "oops, Search Bar In Development"}
                    helperText={error || `${prompt.length} / ${maxCharacters} characters`}
                    error={Boolean(error)}
                    slotProps={{
                      htmlInput: {
                        ...params.inputProps,
                        maxLength: maxCharacters,
                        "aria-label": "Image Prompt Input",
                        onKeyDown: handleKeyDown,
                        // Enabling attributes that could help with autocorrect
                        autoCorrect: "on",
                        spellCheck: true,
                        autoCapitalize: "sentences",
                        autoComplete: "on"
                      },
                    }}
                    sx={{
                      "& .MuiInputBase-root:focus": {
                        outline: "none", // Remove focus outline on the input root
                      },
                      "& .MuiInputBase-input:focus-visible": {
                        outline: "none", // Remove focus outline on the input
                      },
                      "& .Mui-focused": {
                        outline: "none", // Remove Material-UI's focus outline
                      },
                      "& .MuiInputBase-input": {
                        color: darkMode ? "#ffffff" : "#000000", // Text color
                        fontSize: matchMobile ? '1.3rem' : '1.4rem',
                      },
                      "& .MuiInputLabel-root": {
                        color: darkMode ? "#ffffff" : "#000000", // Label color
                      },
                      "& .MuiFormHelperText-root": {
                        color: error ? "#f44336" : darkMode ? "#ffffff" : "#000000",
                      },

                      '& .MuiFilledInput-underline:after': {
                        borderBottomColor: '#F6BB56', // focused underline color
                      },
                      '& .Mui-focused .MuiFilledInput-underline:after': {
                        borderBottomColor: '#F6BB56', // explicitly force color when focused red
                      },


                      backgroundColor: "rgb(255,255,255,0)",
                      zIndex: 0,
                      maxHeight: matchMobile ? '18vh' : '14vh',
                      overflow: 'auto',
                      display: GeneratedImageFlux || parsedKeyPoints.length > 0 ? 'none' : 'block'
                    }}
                  />

                )

                }
              />
            </>
        }

        {/* CLOSE ICON */}
        <IconButton
          onClick={() => {
            handleCloseOverlay();
            setflip(false);
          }}
          sx={{
            position: "fixed",
            top: matchMobile ? '23vh' : '20vh',
            right: 12,
            color: darkMode ? "#ffffff" : "#000000",
            zIndex: 30,
            display: GeneratedImageFlux && type === 0 ? 'none' : 'none'
          }}
        >



          <CloseIcon style={{ fontSize: "2rem", opacity: 0.3 }} />
        </IconButton>
        {

          fluxLoaded && type === 0 || fluxLoaded && type === 1 ?
            <Box
              sx={{
                display: !minimisePrompt ? "flex" : "none",
                width: "100%",
                gap: 1,
                alignItems: "center",
                px: 1,
                py: 1
              }}
            >

              <Button
                variant="contained"
                disableRipple
                disableFocusRipple
                onClick={() => setOpen(true)}
                sx={{
                  flex: 1,

                  /* glass base */
                  background: darkMode
                    ? "rgba(25,25,25,0.25)"
                    : "rgba(255,255,255,0.25)",
                  color: darkMode ? "#F6BB56" : "#000",
                  ...buttonPadding,

                  border: "1px solid rgba(255,255,255,0.45)",
                  borderRadius: 12,
                  boxShadow: darkMode
                    ? "0 8px 32px rgba(0,0,0,.55)"
                    : "0 8px 32px rgba(0,0,0,.15)",
                  transform: "translateY(-2px)",

                  transition:
                    "background .25s ease, box-shadow .25s ease, transform .12s ease",

                  display:
                    GeneratedImageFlux || parsedKeyPoints.length > 0 ? "none" : "block",

                  /* ---------- reflection overlay ---------- */
                  position: "relative",
                  overflow: "hidden",
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    top: "-40%",
                    left: 0,
                    width: "60%",
                    height: "180%",
                    background:
                      "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)",
                    opacity: 0,                      // hidden until hover / press
                    pointerEvents: "none",
                  },

                  /* ---------- hover ---------- */
                  "&:hover": {
                    background: darkMode
                      ? "rgba(25,25,25,0.35)"
                      : "rgba(255,255,255,0.35)",
                    transform: "translateY(0)",
                    "&::before": {
                      opacity: 0.8,
                      animation: `${glassSweep} 1.8s ease-out forwards`,
                    },
                  },

                  /* ---------- active ---------- */
                  "&:active": {
                    background: darkMode
                      ? "rgba(25,25,25,0.45)"
                      : "rgba(255,255,255,0.45)",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.30)",
                    transform: "translateY(0)",
                    "&::before": {
                      opacity: 0.9,
                      animation: `${glassSweep} 1.1s ease-out forwards`,
                    },
                  },
                }}
              >
                &#129302; {prettyLabel}
              </Button>



              {/* ---------- Full-screen modal ---------- */}
              <Modal
                open={open}
                onClose={() => setOpen(false)}
                closeAfterTransition
                BackdropProps={{
                  sx: { backgroundColor: "rgba(0,0,0,.4)" }, // dark semi-transparent backdrop
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: matchMobile ? "60%" : "90%",
                    height: matchMobile ? "90vh" : "50vh",
                    backgroundColor: darkModeReducer ? 'rgb(5,5,5,0.25)' : "rgb(205,205,205,0.25)",
                    backdropFilter: darkModeReducer ? matchMobile ? "blur(18px)" : "blur(30px)" : matchMobile ? "blur(12px)" : "blur(18px)",
                    borderRadius: 3,
                    p: 0,
                    outline: "none",
                    display: "flex",
                    flexDirection: matchMobile ? "column" : "row", // vertical on mobile, horizontal on PC
                    overflowY: "auto",
                    "&::-webkit-scrollbar": {
                      width: "8px",
                    },
                    "&::-webkit-scrollbar-track": {
                      background: "rgb(255,255,255,0.1)",
                    },
                    "&::-webkit-scrollbar-thumb": {
                      background: "rgb(255,255,255,0.2)",
                      borderRadius: "4px",
                    },
                    "&::-webkit-scrollbar-thumb:hover": {
                      background: "rgb(255,255,255,0.4)",
                    },
                  }}
                >
                  {/* Close icon */}
                  <IconButton
                    onClick={() => setOpen(false)}
                    sx={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      color: darkMode ? "#fff" : "#000",
                      zIndex: 1,
                      display: "none",
                    }}
                    aria-label="close"
                  >
                    <CloseIcon />
                  </IconButton>

                  {/* -------- Model options (three equal-height sections) -------- */}
                  {models.map((m, index) => (
                    <Box
                      key={m.name}
                      onClick={() => {
                        if (index === 3) {
                          handleSelect(m.name);
                        } else {
                          handleSelect(m.name);
                        }
                      }}
                      sx={{
                        width: "100%",
                        p: matchMobile ? 1 : 4,
                        flex: 1,                        // equal-height (or equal-width in horizontal layout)
                        display: "flex",
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      {/* Image fills the row vertically; crop from the top */}
                      <Box
                        component="img"
                        src={m.img}
                        alt={m.name}
                        sx={{
                          borderRadius: 2,
                          height: matchMobile ? "auto" : "100%",
                          width: matchMobile ? "60%" : "auto", // 60% width on mobile (vertical), 35% on PC (horizontal)
                          objectFit: "cover",
                          objectPosition: "top",         // show upper part of picture
                          flexShrink: 0,
                        }}
                      />

                      <Typography
                        variant={matchMobile ? "body1" : "h5"}  // smaller text on mobile
                        sx={{
                          ml: 2,
                          fontWeight: matchMobile ? 900 : 600,
                          flexGrow: 1,
                          textTransform: "capitalize",
                          color: darkMode ? "#fff" : "#fff",
                        }}
                      >
                        <span>{m.name}
                          <span style={{ opacity: 1 }}>{' '}
                            {index === 0 ? '🔴' :

                              index === 1 ? " 🟠 " :

                                index === 2 ? " 🟡" :


                                  "🔵"

                            }
                          </span>
                        </span>
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Modal>





              {/* Image upload button */}
              <Button
                variant="contained"
                component="label"
                sx={{
                  flex: 1,
                  backgroundColor: darkMode ? "rgb(255,255,255,0.4)" : "rgb(255,255,255,0.4)",
                  color: darkMode ? "#ffffff" : "#000000",
                  ...buttonPadding,
                  borderRadius: 2,
                  boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.3)",
                  display:
                    GeneratedImageFlux || parsedKeyPoints.length > 0 ? "none" : modelz === 'Flux Pro' ? "block" : 'none',
                  "&:hover": {
                    backgroundColor: darkMode ? "#bbbbbb" : "#555555",
                    color: darkMode ? "#000000" : "#ffffff",
                    boxShadow: "0px 6px 8px rgba(0, 0, 0, 0.2)",
                  },
                }}
                startIcon={<ImageIcon />}
              >
                <input hidden type="file" accept="image/*" onChange={handleFileChange} />
                {/* Label hidden when menu is open in mobile view */}
                {isMenuOpen && matchMobile ? "" : ""}
              </Button>

              {/* Action button */}
              <Button
                variant="contained"
                onClick={handleStartSubmit}
                color="inherit"
                disableRipple
                disableFocusRipple
                sx={{
                  /* ------------- your existing styles: keep untouched ------------- */
                  flex: 1,
                  mt: "3px",
                  background: darkMode
                    ? "rgba(25,25,25,0.25)"
                    : "rgba(255,255,255,0.25)",
                  color: darkMode ? "#F6BB56" : "#000",
                  ...buttonPadding,
                  border: "2px solid #F6BB56",
                  borderRadius: 12,
                  boxShadow: darkMode
                    ? "0 12px 32px rgba(0,0,0,0.8)"
                    : "0 12px 32px rgba(130,130,130,0.8)",
                  transform: "translateY(-2px)",

                  transition:
                    "background .25s ease, box-shadow .25s ease, transform .12s ease",
                  display:
                    GeneratedImageFlux || parsedKeyPoints.length > 0 ? "none" : "block",

                  /* ---------- (NEW) container + hidden overlay ---------- */
                  position: "relative",
                  overflow: "hidden",
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    top: "-40%",
                    left: 0,
                    width: "60%",
                    height: "180%",
                    background:
                      "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)",
                    backgroundSize: "200% 200%",
                    transform: "translateX(-150%) rotate(20deg)",
                    opacity: 0,                       // invisible until hover/active
                    pointerEvents: "none",
                  },

                  /* ---------- focus highlight (unchanged) ---------- */
                  "&:focus, &:focus-visible, &.Mui-focusVisible": {
                    outline: "none",
                    boxShadow: "none",
                    backgroundColor: darkMode
                      ? "rgba(255,255,255,0.10)"
                      : "rgba(255,255,255,0.10)",
                  },

                  /* ---------- hover ---------- */
                  "&:hover": {
                    outline: "none",
                    background: darkMode
                      ? "rgba(25,25,25,0.35)"
                      : "rgba(255,255,255,0.35)",
                    boxShadow: darkMode
                      ? "0 12px 32px rgba(0,0,0,0.8)"
                      : "0 12px 32px rgba(0,0,0,0.3)",
                    transform: "translateY(0)",
                    border: "2px solid #F6BB56",
                    "&::before": {
                      opacity: 0.8,
                      animation: `${glassSweep} 1.8s ease-out forwards`,
                    },
                  },

                  /* ---------- active ---------- */
                  "&:active": {
                    background: darkMode
                      ? "rgba(25,25,25,0.45)"
                      : "rgba(255,255,255,0.45)",
                    boxShadow: "0 4px 16px rgba(0,0,0,.30)",
                    transform: "translateY(0)",
                    border: "2px solid #F6BB56",
                    "&::before": {
                      opacity: 0.8,
                      animation: `${glassSweep} 1.2s ease-out forwards`,
                    },
                  },

                  WebkitTapHighlightColor: "rgba(25,25,25,0.5)",
                  "::-moz-focus-inner": { border: 0 },
                }}
              >
                {type === 0 ? "Create" : type === 1 ? "Visualize" : type === 2 ? "Speak" : "Go"}
              </Button>




              {/* Action button */}


              <IconButton
                onClick={() => setminimisePrompt(true)}
                aria-label="close"
                color="inherit"
                disableRipple
                disableFocusRipple
                sx={{
                  width: 40,
                  height: 40,
                  mt: "3px",

                  /* liquid-glass base */
                  background: darkMode
                    ? "rgba(25,25,25,0.05)"
                    : "rgba(255,255,255,0.05)",
                  color: darkMode ? "#F6BB56" : "#000000",
                  ...buttonPadding,

                  border: "2px solid #F6BB56",
                  borderRadius: 2,
                  boxShadow: darkMode
                    ? "0 12px 32px rgba(0,0,0,0.8)"
                    : "0 12px 32px rgba(160,160,160,0.8)",
                  transform: "translateY(-2px)",

                  backdropFilter: darkMode ? "blur(12px) saturate(180%)" : "",
                  WebkitBackdropFilter: darkMode ? "blur(12px) saturate(180%)" : "",

                  transition:
                    "background .25s ease, box-shadow .25s ease, transform .12s ease",

                  display:
                    GeneratedImageFlux || parsedKeyPoints.length > 0 ? "none" : "inline-flex",

                  /* ✨ sweep overlay (invisible until hover/press) */
                  position: "relative",
                  overflow: "hidden",
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    top: "-40%",
                    left: 0,
                    width: "60%",
                    height: "180%",
                    background:
                      "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)",
                    backgroundSize: "200% 200%",
                    transform: "translateX(-150%) rotate(20deg)",
                    opacity: 0,
                    pointerEvents: "none",
                  },

                  /* focus cue (unchanged) */
                  "&:focus, &:focus-visible, &.Mui-focusVisible": {
                    outline: "none",
                    boxShadow: "none",
                    backgroundColor: "rgba(255,255,255,0.007)",
                  },

                  WebkitTapHighlightColor: "transparent",
                  "::-moz-focus-inner": { border: 0 },

                  /* hover */
                  "&:hover": {
                    background: darkMode
                      ? "rgba(25,25,25,0.35)"
                      : "rgba(255,255,255,0.35)",
                    boxShadow: darkMode
                      ? "0 12px 32px rgba(0,0,0,0.8)"
                      : "0 12px 32px rgba(0,0,0,0.3)",
                    transform: "translateY(0)",
                    border: "2px solid #F6BB56",
                    "&::before": {
                      opacity: 0.8,
                      animation: `${glassSweep} 1.8s ease-out forwards`,
                    },
                  },

                  /* active */
                  "&:active": {
                    background: darkMode
                      ? "rgba(25,25,25,0.45)"
                      : "rgba(255,255,255,0.45)",
                    boxShadow: "0 4px 16px rgba(0,0,0,.30)",
                    transform: "translateY(0)",
                    border: "2px solid #F6BB56",
                    "&::before": {
                      opacity: 0.8,
                      animation: `${glassSweep} 1.2s ease-out forwards`,
                    },
                  },
                }}
              >
                <CloseIcon />
              </IconButton>


            </Box >

            :

            <Box
              sx={{
                display: showButton && !minimisePrompt ? 'flex' : 'none',
                width: '100%',
                gap: 1, // Adds spacing between the two buttons
                alignItems: 'center',
                px: 1, // Optional: padding on the container so buttons don't touch the screen edges

              }}
            >


              {/* Right Button: Compute / Action Button */}
              <Button
                variant="contained"
                color="primary"
                onClick={handleStartSubmit}
                sx={{
                  flex: 1,
                  marginTop: "3px",

                  /* liquid-glass base */
                  background: darkMode
                    ? "rgba(25,25,25,0.25)"
                    : "rgba(255,255,255,0.25)",
                  color: darkMode ? "#F6BB56" : "#DA8E0B",
                  ...buttonPadding,

                  border: "2px solid #F6BB56",
                  borderRadius: 12,
                  boxShadow: "0 12px 32px rgba(0,0,0,0.8)",
                  transform: "translateY(-2px)",

                  transition:
                    "background .25s ease, box-shadow .25s ease, transform .12s ease",

                  display:
                    GeneratedImageFlux || parsedKeyPoints.length > 0 ? "none" : "block",

                  /* === custom focus highlight === */
                  "&:focus, &:focus-visible, &.Mui-focusVisible": {
                    outline: "none",
                    boxShadow: "none",
                    backgroundColor: darkMode
                      ? "rgba(255,255,255,0.10)"  // same tint for both modes
                      : "rgba(255,255,255,0.10)",
                  },

                  "&:hover": {
                    outline: "none",
                    background: darkMode
                      ? "rgba(25,25,25,0.35)"
                      : "rgba(255,255,255,0.35)",
                    boxShadow: "0 12px 32px rgba(0,0,0,.28)",
                    transform: "translateY(0)",
                    border: "2px solid #F6BB56",
                  },
                  "&:active": {
                    background: darkMode
                      ? "rgba(25,25,25,0.45)"
                      : "rgba(255,255,255,0.45)",
                    boxShadow: "0 4px 16px rgba(0,0,0,.30)",
                    transform: "translateY(0)",
                    border: "2px solid #F6BB56",
                  },

                  /* remove mobile tap rectangle */
                  WebkitTapHighlightColor: "rgba(25,25,25,0.5)",
                  /* remove Firefox inner border */
                  "::-moz-focus-inner": { border: 0 },
                }}
              >
                {type === 0
                  ? 'Create'
                  : type === 1
                    ? 'Visualize'
                    : type === 2
                      ? 'Speak'
                      : 'Go'}
              </Button>
            </Box>

        }

        {
          error && (
            <Box mt={1}>
              <Typography variant="body2" color="error">
                {error}
              </Typography>
            </Box>
          )
        }

        {/* **Image Display Container** */}
        <Box
          mt={4}
          display="flex"
          justifyContent="center"
          position="relative"
          sx={{ width: '100%', maxWidth: 600, margin: '0 auto' }} // Ensure consistent width
        >





          {isSubmitting && type === 0 && (
            <Box
              sx={{
                position: "absolute",
                top: matchMobile ? '-10vh' : "-8vh",
                left: 0,
                width: "100%",
                height: "100%",
                background: "rgba(0,0,0,.35)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 2,
                zIndex: 3,

              }}
            >
              <CircularProgress
                variant="determinate"
                value={loader}
                size={44}
                thickness={4}
                sx={{ color: '#F6BB56' }} // or any custom color you prefer
              />

              {/* numeric label (optional) */}


              <Typography
                sx={{
                  mt: 1,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fff",
                  fontFamily: "sans-serif",
                  textShadow: "0 1px 3px rgba(0, 0, 0, 0.8)", // strong shadow for contrast
                }}
              >
                {loader}%
              </Typography>

            </Box>
          )}


          {/* **Generated Image** */}
          {



            parsedKeyPoints.length > 0 ?
              null
              :

              GeneratedImage && (
                <>


                  <Box
                    component="img"
                    src={GeneratedImage}
                    alt="Generated"
                    loading="lazy"
                    /// onClick={handleImageClick} // Allow toggling between images
                    sx={{
                      width: big ? '44%' : "34%",
                      height: "auto",
                      borderRadius: 2,
                      // border: "1px solid #ccc",
                      /// boxShadow: 3,
                      objectFit: "cover",
                      zIndex: 1, // Base z-index
                      display: GeneratedImageFlux ? 'none' : 'block',
                      cursor: "pointer",
                      transition: "z-index 0.3s ease",
                      filter: isFluxOnTop ? 'blur(0px)' : 'blur(0px)', // Consistent blur
                    }}
                  />
                </>
              )}

          {/* **Generated Image Flux** */}
          {

            parsedKeyPoints.length > 0 ?
              null : GeneratedImageFlux && (
                <Box
                  component="img"
                  src={GeneratedImageFlux}
                  alt="Generated Flux"
                  loading="lazy"
                  onClick={handleImageClick} // Allow toggling between images
                  sx={{
                    width: big ? '50%' : "34%",
                    height: "auto",
                    borderRadius: 2,


                    // border: "1px solid #ccc",
                    /// boxShadow: 3,
                    objectFit: "cover",
                    zIndex: 2, // Base z-index
                    cursor: "pointer",
                    transition: "z-index 0.3s ease",
                    filter: isFluxOnTop ? 'blur(0px)' : 'blur(0px)', // Consistent blur

                  }}
                />
              )}


          {big && GeneratedImageFlux ? (
            <Box
              onClick={() => {


                setstartEdit(true);
              }}

              sx={{
                cursor: 'pointer',
                position: "absolute",
                top: '12%',
                left: '0px',
                width: "100%",
                height: "0px",
                backgroundColor: "rgba(255, 255, 255, 0.6)", // Semi-transparent background
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 3, // Above overlay and images
                borderRadius: 2,
                fontSize: '3vh',
                fontWeight: "bold",
                color: "#ffffff", // Text color
                textShadow: "2px 2px 4px rgba(0, 0, 0, 0.6)" // Text shadow for visibility
              }}
            >
              <EditIcon sx={{ mr: 1, fontSize: "inherit" }} />
              Edit
            </Box>

          ) : null}

          {/* **Loader Overlay Within Image Area** */}
          {audioLoad && type === 2 && (
            <Box
              sx={{
                position: "absolute",
                top: '-10.2vh',
                left: 0,
                width: "100%",
                height: "100%",
                /// backgroundColor: "rgba(255, 255, 255, 0.6)", // Semi-transparent background
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 3, // Above overlay and images
                borderRadius: 2,
              }}
            >
              <CircularProgress />
            </Box>
          )}


        </Box>

        {
          GeneratedImageFlux ?
            <Button
              onClick={() => {
                // uploadAllImagesToS3();
                GenerateSignedUrl(GeneratedImageFluxBlob, enhancedPromptx, loggedUser);
              }}
              variant="contained"
              color="inherit"         /* avoid theme-blue */
              disableRipple
              disableFocusRipple
              sx={{
                /* keep your sizing */
                width: "100%",
                flex: 1,
                mt: "3px",

                /* ── liquid-glass design ── */
                background: darkMode
                  ? "rgba(25,25,25,0.25)"
                  : "rgba(255,255,255,0.25)",
                color: darkMode ? "#ffffff" : "#000000",
                ...buttonPadding,

                border: "none",
                borderRadius: 12,
                boxShadow: "0 12px 32px rgba(0,0,0,0.8)",
                transform: "translateY(-2px)",



                transition:
                  "background 250ms ease, box-shadow 250ms ease, transform 120ms ease",

                display: "block",

                /* hover / press */
                "&:hover": {
                  background: darkMode
                    ? "rgba(25,25,25,0.35)"
                    : "rgba(255,255,255,0.35)",
                  transform: "translateY(0)",
                },
                "&:active": {
                  background: darkMode
                    ? "rgba(25,25,25,0.45)"
                    : "rgba(255,255,255,0.45)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.30)",
                  transform: "translateY(0)",
                },

                /* custom focus tint (no blue outline) */
                "&:focus, &:focus-visible, &.Mui-focusVisible": {
                  outline: "none",
                  boxShadow: "none",
                  backgroundColor: "rgba(255,255,255,0.10)",
                },
                WebkitTapHighlightColor: "transparent",
                "::-moz-focus-inner": { border: 0 },
              }}
            >
              Save
            </Button>


            : null
        }

        {
          parsedKeyPoints.length > 0 ?
            <Storybook
              DummyMode={DummyMode}
              Seed={Seed}
              PostId={PostId}
              setPostId={setPostId}
              GenerateSignedUrl={GenerateSignedUrl}
              type={type}
              isMenuOpen={isMenuOpen}
              Planx={Planx}
              modelz={modelz}
              generatedImagesFlux={generatedImagesFluxx}
              setGeneratedImagesFlux={setGeneratedImagesFluxx}
              GotIm={GotIm}
              setStopText={setStopText}
              GeneratedImage={GeneratedImage}
              steps={parsedKeyPoints} setSteps={setParsedKeyPoints} prompt={prompt} isSubmittingKick={isSubmittingKick} setIsSubmittingKick={setIsSubmittingKick}
              handleCloseOverlay={handleCloseOverlay} setcallFeeds={setcallFeeds} /> : null
        }




      </Box >




      <Box >
        {

          AudioResult === '' ? null : <AudioNarration text={AudioResult} />
        }


      </Box >



    </>
  );
});

export default PromptInput;
