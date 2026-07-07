import fetch from "node-fetch";
import dotenv from "dotenv";
import Replicate from "replicate";
import { Readable } from "stream";

import {
  injectFlux2,
  injectSeedream,
  injectSemanticLabel,
  injectConversational,
} from "./utils/promptInjection";

dotenv.config(); // Load environment variables from .env req.body?.Png

import { fal } from "@fal-ai/client";

const PI_KEY = process.env.PI_KEY;

// Helper to safely log payloads without flooding the console with Base64 data
function logPayloadSafely(modelName: string, payload: any) {
  try {
    const safePayload = JSON.parse(JSON.stringify(payload));

    // Truncate raw string arrays
    ["images", "image_urls", "image_input"].forEach((key) => {
      if (Array.isArray(safePayload[key])) {
        safePayload[key] = safePayload[key].map((img: string) =>
          img && img.length > 100
            ? img.substring(0, 50) + "...[TRUNCATED BASE64]"
            : img
        );
      }
    });

    // Truncate reference_images array of objects
    if (Array.isArray(safePayload.reference_images)) {
      safePayload.reference_images = safePayload.reference_images.map(
        (ref: any) => ({
          ...ref,
          url:
            ref.url && ref.url.length > 100
              ? ref.url.substring(0, 50) + "...[TRUNCATED BASE64]"
              : ref.url,
        })
      );
    }

    console.log(
      `ðŸš€ SENDING PAYLOAD TO ${modelName}:`,
      JSON.stringify(safePayload, null, 2)
    );
  } catch (e) {
    console.log(
      `ðŸš€ SENDING PAYLOAD TO ${modelName}: [Error stringifying payload]`
    );
  }
}

//klingProRoute

fal.config({
  credentials: process.env.FAL_KEY!, // or a literal string (not recommended)
});

/**
 * POST /fluxSchnell
 * Expects a JSON body with:
 *   {   url = 'BanannaRoute';
 *     inputs: string;  // the prompt
 *     image?: string;  // (optional) base64 data URI
 *     guidance?: number;
 *     width?: number;  // if not supplied, defaults to 1080
 *     height?: number; // if not supplied, defaults to 1920
 *   }
 */

export async function fluxProRoute(req: any, res: any) {
  try {
    // 1) Read data from req.body (with default width & height)
    const { inputs, image, width, height } = req.body;

    console.log("Received prompt:", inputs);
    console.log("Received optional image:", image ? "Yes" : "No");
    console.log("Using width:", width, "height:", height);

    // 2) Build the input object for Replicate
    // Check the model docs to confirm it accepts `width` and `height`
    const replicateInput: Record<string, any> = {
      prompt: inputs,
      aspect_ratio: "9:16",
      output_format: req.body?.Png ? "png" : "jpg",
      output_quality: 80,
      safety_tolerance: 2,
      prompt_upsampling: true,
    };

    const replicateInput2: Record<string, any> = {
      prompt: inputs,
      image_prompt: image,
      aspect_ratio: "9:16",
      output_format: req.body?.Png ? "png" : "jpg",
      output_quality: 80,
      safety_tolerance: 2,
      prompt_upsampling: true,
    };

    // 3) Make the initial POST to create the prediction
    const postResponse = await fetch(
      `https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions`,

      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.REPLI_KEY}`,
          Prefer: "wait", // optional; if you want a single call that waits until done
        },
        body: JSON.stringify({
          input: image ? replicateInput2 : replicateInput,
        }),
      }
    );

    if (!postResponse.ok) {
      const text = await postResponse.text();
      console.error("Replicate initial POST NOT OK:", text);
      throw new Error(`Replicate error: ${postResponse.status} - ${text}`);
    }

    const postData = await postResponse.json();
    let status = postData.status;
    const predictionId = postData.id;

    // 4) Poll until "succeeded" or "failed"
    while (status === "starting" || status === "processing") {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const pollResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.REPLI_KEY}`,
          },
        }
      );

      if (!pollResponse.ok) {
        const pollErr = await pollResponse.text();
        console.error("Replicate poll NOT OK:", pollErr);
        throw new Error(
          `Replicate poll error: ${pollResponse.status} - ${pollErr}`
        );
      }

      const pollData = await pollResponse.json();
      status = pollData.status;

      if (status === "succeeded") {
        // 5) Get the final image
        const outputUrl = pollData.output;
        console.log("Output URL:", outputUrl);

        const finalImageResponse = await fetch(outputUrl);
        if (!finalImageResponse.ok) {
          const finalErr = await finalImageResponse.text();
          throw new Error(
            `Failed to fetch final image: ${finalImageResponse.status} - ${finalErr}`
          );
        }

        // Convert final image to base64
        const finalImageBlob = await finalImageResponse.blob();
        const arrayBuffer = await finalImageBlob.arrayBuffer();
        const base64Encoded = Buffer.from(arrayBuffer).toString("base64");
        const imageBase64 = `data:image/png;base64,${base64Encoded}`;

        // Send to client
        return res.status(200).json({ imageBase64 });
      } else if (status === "failed" || status === "canceled") {
        console.error("Prediction failed or canceled");
        return res
          .status(500)
          .json({ error: "Prediction failed or canceled", detail: pollData });
      }
    }

    // If we somehow exit the loop, return an error
    return res
      .status(500)
      .json({ error: "Unexpected status after polling", status });
  } catch (err) {
    console.error("Error in fluxSchnellRoute:", err);
    return res.status(500).json({ error: (err as Error).message });
  }
}

/**
 * Generate an image with Seedreamâ€‘3 on Replicate
 *
 * POST body example:
 * {
 *   "inputs": "Your prompt here",
 *   "width": 2048,          // optional â€“ default 2048
 *   "height": 2048,         // optional â€“ default 2048
 *   "guidance_scale": 2.5,   // optional â€“ default 2.5
 *   "seed": 42              // optional â€“ random if omitted
 * }
 */

// Tip: If youâ€™re on NodeÂ â‰¥Â 18, `fetch` is global. If youâ€™re on 16/17, youâ€™ll
// need to `npm i node-fetch` and then `import fetch from "node-fetch";`.

/**
 * Seedreamâ€‘3 image generatorâ€”TypeScriptâ€‘errorâ€‘free version (liberal use of `any`).
 *
 * POST JSON shape:
 * {
 *   "inputs": "Your prompt here",   // required
 *   "width": 1024,                  // optional â€“ default 2048
 *   "height": 1024,                 // optional â€“ default 2048
 *   "guidance_scale": 3,            // optional â€“ default 2.5
 *   "seed": 1234                    // optional â€“ random if omitted
 * }
 */

const SDXL_VERSION =
  "7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc";

/**
 * POST /sdxlSchnell
 * Expects a JSON body with e.g.:flux
 * {
 *   prompt: string,           // The main text prompt seeDream
 *   image?: string,           // (optional) base64 data URI if doing img2img
 *   width?: number,           // default 768
 *   height?: number,          // default 768
 *   num_inference_steps?: number, // default 50
 *   guidance_scale?: number,  // default 7.5
 *   prompt_strength?: number, // used for img2img
 *   refine?: string           // e.g. "no_refiner" or "expert_ensemble_refiner"
 *   apply_watermark?: boolean
 * }
 */

export async function sdxlProRoute(req: any, res: any) {
  try {
    // 1) Read data from req.body (with default width & height)

    // 1) Read data from req.body
    const { inputs, image, width, height } = req.body;

    ///(refine = "no_refiner"),
    /// (apply_watermark = true),

    console.log("Received prompt:", inputs);
    console.log("Received optional image:", image ? "Yes" : "No");
    console.log("Width/Height:", width, height);

    // 2) Build the input for sdxl. Check the modelâ€™s input schema:
    //    https://replicate.com/stability-ai/sdxl

    const replicateInput1: Record<string, any> = {
      prompt: inputs,
      width: 1024,
      height: 1024,
      num_inference_steps: 50, // Increased for higher quality
      guidance_scale: 12.5, // Adjusted for better adherence to prompt
      refine: "expert_ensemble_refiner", // Enables refinement for enhanced detail
      refine_steps: 20, // Specifies steps for the refiner
      apply_watermark: false,
    };

    const replicateInput2: Record<string, any> = {
      prompt: inputs,
      width: 1024,
      height: 1024,
      num_inference_steps: 50, // Increased for higher quality
      guidance_scale: 12.5, // Adjusted for better adherence to prompt
      refine: "expert_ensemble_refiner", // Enables refinement for enhanced detail
      refine_steps: 20, // Specifies steps for the refiner
      apply_watermark: false,
      image: image,
      prompt_strength: 0.8, // Adjusts influence of prompt on input image
      disable_safety_checker: true,
    };

    // 3) POST to Replicate to create the prediction
    // NOTE: The recommended approach is to POST to https://api.replicate.com/v1/predictions
    //       with JSON: { version, input: replicateInput }.
    const postResponse = await fetch(
      `https://api.replicate.com/v1/predictions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.REPLI_KEY}`,
          Prefer: "wait", // optional; if you want a single call that waits until done
        },
        body: JSON.stringify({
          version: SDXL_VERSION,
          input: image ? replicateInput2 : replicateInput1,
        }),
      }
    );

    if (!postResponse.ok) {
      const text = await postResponse.text();
      console.error("Replicate initial POST NOT OK:", text);
      return res.status(postResponse.status).json({ error: text });
    }

    const postData = await postResponse.json();
    let status = postData.status;
    const predictionId = postData.id;

    console.log("Prediction created:", predictionId, "status:", status);

    // 4) Poll until "succeeded" or "failed"
    while (status === "starting" || status === "processing") {
      // Wait 3 seconds between polls
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const pollResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.REPLI_KEY}`,
          },
        }
      );

      if (!pollResponse.ok) {
        const pollErr = await pollResponse.text();
        console.error("Replicate poll NOT OK:", pollErr);
        throw new Error(
          `Replicate poll error: ${pollResponse.status} - ${pollErr}`
        );
      }

      const pollData = await pollResponse.json();
      status = pollData.status;

      if (status === "succeeded") {
        // 5) The output is an array of image URLs
        const outputUrls = pollData.output; // typically an array of URLs
        console.log("SDXL Output URLs:", outputUrls);

        // For simplicity, just take the first image:
        const outputUrl = Array.isArray(outputUrls) ? outputUrls[0] : null;
        if (!outputUrl) {
          return res.status(500).json({ error: "No output URL returned" });
        }

        // Fetch the final image from the output URL
        const finalImageResponse = await fetch(outputUrl);
        if (!finalImageResponse.ok) {
          const finalErr = await finalImageResponse.text();
          throw new Error(
            `Failed to fetch final image: ${finalImageResponse.status} - ${finalErr}`
          );
        }

        // Convert final image to base64
        const finalImageBlob = await finalImageResponse.arrayBuffer();
        const base64Encoded = Buffer.from(finalImageBlob).toString("base64");
        const imageBase64 = `data:image/png;base64,${base64Encoded}`;

        // Send the base64 back to client
        return res.status(200).json({ imageBase64 });
      } else if (status === "failed" || status === "canceled") {
        console.error("Prediction failed or canceled");
        return res
          .status(500)
          .json({ error: "Prediction failed or canceled", detail: pollData });
      }
    }

    // If we exit the loop unexpectedly
    return res
      .status(500)
      .json({ error: "Unexpected status after polling", status });
  } catch (err) {
    console.error("Error in sdxlSchnellRoute:", err);
    return res.status(500).json({ error: (err as Error).message });
  }
}

export async function sdxlDevRoute(req: any, res: any) {
  try {
    // 1) Read data from req.body (with default width & height)GptImageRoute

    // 1) Read data from req.body
    const { inputs, image, width, height } = req.body;

    ///(refine = "no_refiner"),
    /// (apply_watermark = true),

    var num_inference_steps = 35;
    var guidance_scale = 7.5;

    console.log("Received prompt:", inputs);
    console.log("Received optional image:", image ? "Yes" : "No");
    console.log("Width/Height:", width, height);

    // 2) Build the input for sdxl. Check the modelâ€™s input schema:
    //    https://replicate.com/stability-ai/sdxl
    var prompt_strength = 0.5;

    const replicateInput1: Record<string, any> = {
      prompt: inputs,
      width,
      height,
      num_inference_steps,
      guidance_scale,
      refine: "no_refiner", // "expert_ensemble_refiner" or "no_refiner"
      apply_watermark: false,
    };

    const replicateInput2: Record<string, any> = {
      prompt: inputs,
      width,
      height,
      num_inference_steps,
      guidance_scale,
      refine: "no_refiner", // "expert_ensemble_refiner" or "no_refiner"
      apply_watermark: false,
      image: image,
      prompt_strength: prompt_strength,
      disable_safety_checker: true,
    };

    // 3) POST to Replicate to create the prediction
    // NOTE: The recommended approach is to POST to https://api.replicate.com/v1/predictions
    //       with JSON: { version, input: replicateInput }.
    const postResponse = await fetch(
      `https://api.replicate.com/v1/predictions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.REPLI_KEY}`,
          Prefer: "wait", // optional; if you want a single call that waits until done
        },
        body: JSON.stringify({
          version: SDXL_VERSION,
          input: image ? replicateInput2 : replicateInput1,
        }),
      }
    );

    if (!postResponse.ok) {
      const text = await postResponse.text();
      console.error("Replicate initial POST NOT OK:", text);
      return res.status(postResponse.status).json({ error: text });
    }

    const postData = await postResponse.json();
    let status = postData.status;
    const predictionId = postData.id;

    console.log("Prediction created:", predictionId, "status:", status);

    // 4) Poll until "succeeded" or "failed"
    while (status === "starting" || status === "processing") {
      // Wait 3 seconds between polls
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const pollResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.REPLI_KEY}`,
          },
        }
      );

      if (!pollResponse.ok) {
        const pollErr = await pollResponse.text();
        console.error("Replicate poll NOT OK:", pollErr);
        throw new Error(
          `Replicate poll error: ${pollResponse.status} - ${pollErr}`
        );
      }

      const pollData = await pollResponse.json();
      status = pollData.status;

      if (status === "succeeded") {
        // 5) The output is an array of image URLs
        const outputUrls = pollData.output; // typically an array of URLs
        console.log("SDXL Output URLs:", outputUrls);

        // For simplicity, just take the first image:
        const outputUrl = Array.isArray(outputUrls) ? outputUrls[0] : null;
        if (!outputUrl) {
          return res.status(500).json({ error: "No output URL returned" });
        }

        // Fetch the final image from the output URL
        const finalImageResponse = await fetch(outputUrl);
        if (!finalImageResponse.ok) {
          const finalErr = await finalImageResponse.text();
          throw new Error(
            `Failed to fetch final image: ${finalImageResponse.status} - ${finalErr}`
          );
        }

        // Convert final image to base64
        const finalImageBlob = await finalImageResponse.arrayBuffer();
        const base64Encoded = Buffer.from(finalImageBlob).toString("base64");
        const imageBase64 = `data:image/png;base64,${base64Encoded}`;

        // Send the base64 back to client
        return res.status(200).json({ imageBase64 });
      } else if (status === "failed" || status === "canceled") {
        console.error("Prediction failed or canceled");
        return res
          .status(500)
          .json({ error: "Prediction failed or canceled", detail: pollData });
      }
    }

    // If we exit the loop unexpectedly
    return res
      .status(500)
      .json({ error: "Unexpected status after polling", status });
  } catch (err) {
    console.error("Error in sdxlSchnellRoute:", err);
    return res.status(500).json({ error: (err as Error).message });
  }
}

// Back-end route: GPT-4o Mini Transcribe on Replicate (drop-in for your pattern)
// - Accepts multipart/form-data with field "audio" (Blob/File) OR JSON { audioUrl }
// - Optional: body.language (ISO-639-1, e.g. "en")
// - Uses Replicate Files API to host the upload, then creates a prediction with Prefer: wait=60
// - Responds: { text: "transcript" }

// If you're using multer, ensure `req.file` exists (e.g., upload.single("audio"))
// Fixed backend route: uses VERSION (not model) for Replicate predictions.create
// Notes:
// - If you pass req.body.audioUrl, Replicate must be able to GET that URL (public or signed GET).
// - If no audioUrl is provided but multipart `file` exists (multer), we upload to Replicate Files API.
// - Optional: set REPLICATE_GPT4O_MINI_TRANSCRIBE_VERSION in env to override the hardcoded version.

export async function transcribeMiniRoute(req: any, res: any) {
  try {
    const REPLICATE_API_TOKEN =
      process.env.REPLICATE_API_TOKEN || process.env.REPLI_KEY;
    if (!REPLICATE_API_TOKEN) {
      return res.status(500).json({ error: "Missing REPLICATE_API_TOKEN" });
    }

    // Current version hash for openai/gpt-4o-mini-transcribe (verify on the model page)
    const DEFAULT_VERSION =
      "684265b6c4d23a4f5b3536a76e0b9e022ce5084f6da95fd7d0b5ebbc573a8261";
    const MODEL_VERSION =
      process.env.REPLICATE_GPT4O_MINI_TRANSCRIBE_VERSION || DEFAULT_VERSION;

    const language = (req.body?.language || "en").trim();
    const incomingUrl = (req.body?.audioUrl || "").trim();

    // 1) Ensure we have a fetchable audio URL for Replicate
    let audioFileUrl = incomingUrl;

    if (!audioFileUrl) {
      // Handle multipart upload (e.g., via multer)
      const file = (req as any).file; // { buffer, mimetype, originalname }
      if (!file || !file.buffer) {
        return res.status(400).json({
          error:
            "No audio provided. Send multipart 'audio' or JSON 'audioUrl'.",
        });
      }

      // Upload buffer to Replicate Files API to get a fetchable URL
      const upForm = new FormData();
      const blob = new Blob([file.buffer], {
        type: file.mimetype || "application/octet-stream",
      });
      upForm.append("file", blob, file.originalname || "audio.webm");

      const uploadResp = await fetch("https://api.replicate.com/v1/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        },
        body: upForm as any,
      });

      if (!uploadResp.ok) {
        const t = await uploadResp.text();
        console.error("Replicate file upload failed:", t);
        return res.status(uploadResp.status).json({ error: t });
      }
      const uploaded = await uploadResp.json();
      audioFileUrl = uploaded?.urls?.get;
      if (!audioFileUrl) {
        return res
          .status(500)
          .json({ error: "Upload succeeded but no file URL returned." });
      }
    }

    // 2) Create prediction (sync wait up to 60s). Must send "version", not "model".
    const createResp = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        Prefer: "wait=60",
        // Optionally: "Cancel-After": "2m",
      },
      body: JSON.stringify({
        version: MODEL_VERSION, // âœ… required
        input: {
          language,
          audio_file: audioFileUrl,
        },
      }),
    });

    if (!createResp.ok) {
      const txt = await createResp.text();
      console.error("Replicate prediction create failed:", txt);
      return res.status(createResp.status).json({ error: txt });
    }

    const prediction = await createResp.json();
    const status = prediction?.status;
    if (status !== "succeeded") {
      // If not done in 60s window, return 202 so client can retry/poll
      return res.status(202).json({
        status,
        id: prediction?.id,
        message: "Prediction not completed within wait window.",
      });
    }

    // 3) Extract transcript (output is typically string[])
    const out = prediction?.output;
    const text = Array.isArray(out)
      ? out.join("")
      : typeof out === "string"
      ? out
      : out?.text ?? "";

    return res.status(200).json({ text, id: prediction?.id });
  } catch (err: any) {
    console.error("transcribeMiniRoute error:", err);
    return res.status(500).json({ error: err?.message || "Unexpected error" });
  }
}

// routes/seedanceRoute.ts klingProRoute

// routes/seedanceRoute.ts

// Seedance PRO (Replicate HTTP + polling)
// - Env: REPLI_KEY or REPLICATE_API_TOKEN
// - Notes:
//   â€¢ If `startImage` is provided, PRO treats this as image-to-video and IGNOREs `aspect_ratio`.
//   â€¢ `resolution` defaults to "1080p". Change to "720p" if you want faster/cheaper.
//   â€¢ Your previous Lite code constrained duration to 5 or 10; we keep that for parity.

// WAN i2v route (Replicate)
// - Requires: startImage (URL or data URI)
// - Env: REPLI_KEY or REPLICATE_API_TOKEN

/**
 * Body: { prompt: string, startImage?: string, lastFrame?: string, videoLength?: number, aspect?: "16:9"|"9:16"|"1:1", resolution?: "720p"|"1080p", generateAudio?: boolean, negative_prompt?: string }
 */

export async function veo3fastxxx(req: any, res: any) {
  try {
    /* ------------------------------------------------------------------ */
    /* 1) Extract user-supplied fields                                     */
    /* ------------------------------------------------------------------ */
    const {
      prompt,
      startImage, // maps to input.image
      lastFrame, // maps to input.last_frame
      reference_images, // optional: string[]
      duration, // optional: integer seconds (Veo 3.1 default is 8)
      ty, // 1=9:16, 2=1:1, 3=16:9 (your convention)
      resolution = "1080p", // "720p" | "1080p" | "4k" (model default is "1080p")
      generateAudio = true, // boolean
      negative_prompt, // optional
      seed, // optional integer
    } = req.body ?? {};

    if (!prompt && !startImage) {
      return res.status(400).json({ error: "Missing prompt or startImage" });
    }

    /* ------------------------------------------------------------------ */
    /* 2) Normalize values & build input                                   */
    /* ------------------------------------------------------------------ */
    // Aspect ratio by your `ty` convention
    const aspect_ratio =
      ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "9:16";

    // Veo 3.1 schema (common fields)
    const input: Record<string, any> = {
      prompt,
      aspect_ratio, // "9:16" | "1:1" | "16:9"
      resolution, // e.g. "1080p"
      generate_audio: !!generateAudio,
    };

    // Optional inputs (only attach if present)
    if (typeof duration === "number") input.duration = duration;
    if (startImage) input.image = startImage;
    if (lastFrame) input.last_frame = lastFrame;
    if (Array.isArray(reference_images) && reference_images.length > 0) {
      input.reference_images = reference_images.slice(0, 3); // model allows 1-3
    }
    if (negative_prompt) input.negative_prompt = negative_prompt;
    if (Number.isInteger(seed)) input.seed = seed;

    /* ------------------------------------------------------------------ */
    /* 3) Kick off prediction (Replicate REST)                             */
    /* ------------------------------------------------------------------ */
    const token = process.env.REPLI_KEY || process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return res.status(500).json({
        error: "Missing REPLI_KEY or REPLICATE_API_TOKEN in environment.",
      });
    }

    // Normal (non-fast) model
    const replicateUrl =
      "https://api.replicate.com/v1/models/google/veo-3.1/predictions";

    const postResponse = await fetch(replicateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        // Optionally use sync mode for up to 60s:
        // Prefer: "wait=60",
      },
      body: JSON.stringify({ input }),
    });

    if (!postResponse.ok) {
      const text = await postResponse.text();
      console.error("Veo 3.1 POST error:", text);
      return res.status(502).json({ error: text });
    }

    const {
      id: predictionId,
      status: initialStatus,
    } = await postResponse.json();
    console.log(`Veo 3.1 prediction ID: ${predictionId}`);

    /* ------------------------------------------------------------------ */
    /* 4) Poll until finished (or bail on error)                           */
    /* ------------------------------------------------------------------ */
    let status = initialStatus;
    let videoUrl: string | null = null;

    while (
      status === "starting" ||
      status === "processing" ||
      status === "running"
    ) {
      await new Promise((r) => setTimeout(r, 3000));

      const poll = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!poll.ok) {
        const err = await poll.text();
        console.error("Veo 3.1 poll error:", err);
        return res.status(502).json({ error: err });
      }

      const pollData = await poll.json();
      status = pollData.status;

      if (status === "succeeded" || status === "successful") {
        const out = pollData.output;

        // Replicate outputs can be a string, array, or object with { url } / { video }
        if (typeof out === "string") {
          videoUrl = out;
        } else if (Array.isArray(out) && out.length > 0) {
          const last = out[out.length - 1];
          if (typeof last === "string") {
            videoUrl = last;
          } else if (last && typeof last === "object") {
            if (typeof (last as any).url === "string")
              videoUrl = (last as any).url;
            else if (typeof (last as any).video === "string")
              videoUrl = (last as any).video;
          }
        } else if (out && typeof out === "object") {
          if (typeof (out as any).url === "string") videoUrl = (out as any).url;
          else if (typeof (out as any).video === "string")
            videoUrl = (out as any).video;
        }

        if (!videoUrl && (pollData as any).output_url) {
          videoUrl = (pollData as any).output_url;
        }

        if (!videoUrl) {
          console.warn("Veo 3.1 succeeded but output URL not found:", out);
        }
      }

      if (status === "failed" || status === "canceled") {
        console.error("Veo 3.1 failed/canceled:", pollData);
        return res
          .status(500)
          .json({ error: "Veo 3.1 failed/canceled", detail: pollData });
      }
    }

    /* ------------------------------------------------------------------ */
    /* 5) Retrieve the finished MP4 & relay to caller (same shape)        */
    /* ------------------------------------------------------------------ */
    if (!videoUrl) {
      return res
        .status(500)
        .json({ error: "Veo 3.1 finished with no video URL" });
    }

    const vidResp = await fetch(videoUrl);
    if (!vidResp.ok) {
      const err = await vidResp.text();
      console.error("Fetch final video error:", err);
      return res.status(502).json({ error: err });
    }

    const buffer = Buffer.from(await vidResp.arrayBuffer());

    // return Base64 to match your existing WAN route shape
    const videoBase64 = `data:video/mp4;base64,${buffer.toString("base64")}`;

    // duration meta: prefer user-specified, else model default (8)
    const metaDuration =
      typeof duration === "number" && duration > 0 ? duration : 8;

    return res.status(200).json({
      videoBase64,
      meta: {
        duration: metaDuration,
        fps: 24, // leave as-is to match your existing meta shape
        resolution,
        aspect_ratio,
        used_i2v: !!startImage || !!reference_images,
        model: "google/veo-3.1",
      },
    });
  } catch (err: any) {
    console.error(
      "Error in veo31:",
      err?.response?.data || err?.message || err
    );
    return res
      .status(500)
      .json({ error: err.message || "Veo 3.1 generation failed." });
  }
}
export async function sora2(req: any, res: any) {
  try {
    const {
      prompt,
      startImage: imageUrl,
      endImageUrl,
      videoLength: duration = 5,
      ty, // 1=9:16, 2=1:1, 3=16:9
      generateAudio = true,
      asyncMode,
      activechracternames = [],
      lipSyncUrl,
      referenceVideoUrl,
      referenceVideos,
    } = req.body ?? {};

    const hasLipSync = typeof lipSyncUrl === "string" && lipSyncUrl.trim().length > 0;

    // Reference videos (Seedance 2.0 Fast): up to 3, total <= 15s. Referenced as [Video1]..[Video3].
    const refVideos: string[] = (Array.isArray(referenceVideos)
      ? referenceVideos
      : referenceVideoUrl
      ? [referenceVideoUrl]
      : []
    ).filter((u: any) => typeof u === "string" && u.trim().length > 0).slice(0, 3);

    const textPrompt = typeof prompt === "string" ? prompt.trim() : "";
    if (!textPrompt) {
      return res
        .status(400)
        .json({ error: "Missing prompt (string required)" });
    }

    let translatedPrompt = textPrompt;
    let image_urls: string[] = [];

    const hasImage = imageUrl && typeof imageUrl === "string" && imageUrl.trim().length > 0;

    if (hasImage) {
      image_urls.push(imageUrl);
      translatedPrompt += ` Use [Image1] as the 0-second start frame composition.`;
    }

    if (activechracternames && Array.isArray(activechracternames)) {
      activechracternames.forEach((char: any) => {
        if (!char.name || (!char.url && !char.imageUrl)) return;
        const charUrl = char.url || char.imageUrl;
        const handle = "@" + char.name.replace(/[^A-Za-z0-9_]/g, "");
        const regex = new RegExp(`\\s*${handle.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "ig");

        if (regex.test(translatedPrompt)) {
          image_urls.push(charUrl);
          const imageIndex = image_urls.length;
          const systemTag = `[Image${imageIndex}]`;
          translatedPrompt = translatedPrompt.replace(regex, ` ${systemTag}`);
          translatedPrompt += ` Use ${systemTag} as the strict facial identity lock and overall character silhouette.`;
        }
      });
    }

    const arMap: Record<number, string> = { 1: "9:16", 2: "1:1", 3: "16:9" };
    const metaAspectRatio = arMap[ty] || "16:9";
    const finalDuration = clamp(Number(duration), 2, 12);

    const payload: Record<string, any> = {
      prompt: translatedPrompt,
      duration: finalDuration,
      resolution: "720p",
      aspect_ratio: metaAspectRatio,
      generate_audio: !!generateAudio,
    };

    const hasCharacters = (hasImage && image_urls.length > 1) || (!hasImage && image_urls.length > 0);
    // Lip-sync requires the reference path: reference_audios needs at least one reference
    // image/video and cannot be combined with the strict first-frame `image` field.
    const useReferencePath = hasCharacters || (hasLipSync && image_urls.length > 0);

    if (image_urls.length > 0) {
      if (useReferencePath) {
        payload.reference_images = image_urls;
      } else {
        payload.image = image_urls[0];
        if (endImageUrl && typeof endImageUrl === "string") {
          payload.last_frame_image = endImageUrl;
        }
        // First frame is sent alone via `image` (not a numbered reference), so strip the
        // dangling [Image1] directive that would otherwise point at a non-existent reference.
        payload.prompt = translatedPrompt.replace(
          " Use [Image1] as the 0-second start frame composition.",
          ""
        );
      }
    }

    // Audio-driven lip-sync: only attach when a reference image/video exists (Replicate requirement).
    // Note: last_frame_image cannot combine with reference_images, so it is intentionally
    // not used on lip-sync shots that fall onto the reference path.
    if (hasLipSync && image_urls.length > 0) {
      payload.reference_audios = [lipSyncUrl];
      payload.prompt = `${payload.prompt} Use [Audio1] as the driving audio for lip-sync.`;
    }

    // Reference videos: motion/style reference. Attach and add numbered [VideoN] directives.
    if (refVideos.length > 0) {
      payload.reference_videos = refVideos;
      const directives = refVideos
        .map((_, n) => `[Video${n + 1}]`)
        .join(", ");
      payload.prompt = `${payload.prompt} Use ${directives} as motion and style reference.`;
    }

    const modelId = "bytedance/seedance-2.0-fast";
    console.log(
      `[Seedance 2.0 Fast] Calling ${modelId} (Duration: ${finalDuration}s, Audio: ${!!generateAudio})`
    );

    const rep = new Replicate({
      auth: process.env.REPLI_KEY || process.env.REPLICATE_API_TOKEN,
    });

    if (asyncMode) {
      const prediction = await rep.predictions.create({
        model: modelId as any,
        input: payload,
      });
      return res.status(200).json({
        status: "starting",
        jobId: prediction.id,
        provider: "replicate",
        modelEndpoint: modelId,
        meta: {
          duration: finalDuration,
          resolution: "720p",
          aspect_ratio: metaAspectRatio,
          used_i2v: hasImage,
          model: "seedance-2.0-fast",
        },
      });
    }

    const output: any = await rep.run(modelId as any, { input: payload });

    let videoUrl = "";
    if (typeof output === "string") videoUrl = output;
    else if (Array.isArray(output)) videoUrl = output[0];
    else if (output && typeof output.url === "string") videoUrl = output.url;

    if (!videoUrl) {
      throw new Error("Seedance 2.0 Fast returned no video URL.");
    }

    const videoBase64 = await fetchAsBase64(videoUrl);

    return res.status(200).json({
      videoBase64,
      videoUrl,
      meta: {
        model: "seedance-2.0-fast",
        duration: finalDuration,
        resolution: "720p",
        aspect_ratio: metaAspectRatio,
        used_i2v: hasImage,
      },
    });
  } catch (err: any) {
    const status = err?.status || 500;
    const details = err?.body || err?.response?.data;
    console.error("Seedance 2.0 Fast route error:", {
      status,
      details,
      message: err.message,
    });

    return res.status(status).json({
      error:
        details?.detail || err?.message || "Seedance 2.0 Fast request failed",
      details,
    });
  }
}

export async function Seedance2(req: any, res: any) {
  try {
    const {
      prompt,
      startImage: imageUrl,
      lastFrame: endImageUrl,
      videoLength: duration = 5,
      ty, // 1=9:16, 2=1:1, 3=16:9
      generateAudio = true,
      generate_audio,
      asyncMode,
      activechracternames = [],
    } = req.body ?? {};

    // Use whichever boolean evaluates correctly from the camelCase/snake_case destructuring
    const isAudioEnabled =
      generate_audio !== undefined ? !!generate_audio : !!generateAudio;

    const textPrompt = typeof prompt === "string" ? prompt.trim() : "";

    // --- KLING V3 (ELEMENTS 3.0) TRANSLATION NODE ---
    let translatedPrompt = textPrompt;
    let elements: any[] = [];

    if (activechracternames && Array.isArray(activechracternames)) {
      activechracternames.forEach((char: any) => {
        if (!char.name || (!char.url && !char.imageUrl)) return;
        const charUrl = char.url || char.imageUrl;

        // Format UI handle
        const handle = "@" + char.name.replace(/[^A-Za-z0-9_]/g, "");
        const regex = new RegExp(
          `\\s*${handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "ig"
        );

        if (regex.test(translatedPrompt)) {
          // Kling V3 requires a strict object structure for Elements
          elements.push({
            frontal_image_url: charUrl,
            reference_image_urls: [charUrl],
          });

          const elementIndex = elements.length; // e.g., 1 for @Element1
          const systemTag = `@Element${elementIndex}`;

          // Silence Rule: Replace conversational tag directly with Kling's syntax
          translatedPrompt = translatedPrompt.replace(regex, ` ${systemTag}`);
        }
      });
    }

    const hasImage =
      imageUrl && typeof imageUrl === "string" && imageUrl.trim().length > 0;

    const hasCharacters = elements.length > 0;

    const endpoint = (hasImage || hasCharacters)
      ? "fal-ai/kling-video/v3/pro/image-to-video"
      : "fal-ai/kling-video/v3/pro/text-to-video";

    const finalDuration = clamp(Number(duration), 5, 10); // Keep the current product-level 5s/10s limits.

    const payload: Record<string, any> = {
      duration: finalDuration,
      generate_audio: isAudioEnabled,
    };

    if (translatedPrompt) {
      payload.prompt = translatedPrompt;
    } else if (!hasImage) {
      return res
        .status(400)
        .json({ error: "Missing prompt for Text-to-Video (string required)" });
    }

    if (elements.length > 0) {
      payload.elements = elements;
    }

    let metaAspectRatio = "16:9";

    if (hasImage) {
      payload.start_image_url = imageUrl;
      if (endImageUrl && typeof endImageUrl === "string") {
        payload.end_image_url = endImageUrl;
      }
    } else {
      const arMap: Record<number, string> = { 1: "9:16", 2: "1:1", 3: "16:9" };
      metaAspectRatio = arMap[ty] || "16:9";
      payload.aspect_ratio = metaAspectRatio;
    }

    console.log(
      `[Kling v3 Pro] Calling ${endpoint} (Duration: ${finalDuration}s, Audio: ${isAudioEnabled})`
    );

    if (asyncMode) {
      const response = await fal.queue.submit(endpoint, {
        input: payload as any,
      });
      return res.status(200).json({
        status: "starting",
        jobId: response.request_id,
        provider: "fal",
        modelEndpoint: endpoint,
        meta: {
          duration: finalDuration,
          aspect_ratio: metaAspectRatio,
          used_i2v: hasImage,
          model: "kling-v3-pro",
        },
      });
    }

    const result = await fal.subscribe(endpoint, {
      input: payload as any,
      logs: true,
      onQueueUpdate: (u) => {
        if (u.status === "IN_PROGRESS") {
          u.logs?.forEach((l: any) => console.log("[Kling v3]", l.message));
        }
      },
    });

    const videoUrl = result?.data?.video?.url;

    if (!videoUrl) {
      throw new Error("Kling v3 Pro returned no video URL.");
    }

    const videoBase64 = await fetchAsBase64(videoUrl);

    return res.status(200).json({
      videoBase64,
      videoUrl,
      meta: {
        model: "kling-v3-pro",
        duration: finalDuration,
        aspect_ratio: metaAspectRatio,
        used_i2v: hasImage,
      },
    });
  } catch (err: any) {
    const status = err?.status || 500;
    const details = err?.body || err?.response?.data;
    console.error("Kling v3 route error:", {
      status,
      details,
      message: err.message,
    });

    return res.status(status).json({
      error: details?.detail || err?.message || "Kling v3 generation failed",
      details,
    });
  }
}

export async function veo3fast_paused(req: any, res: any) {
  try {
    /* ------------------------------------------------------------------ */
    /* 1) Extract user-supplied fields                                    */
    /* ------------------------------------------------------------------ */
    const {
      prompt,
      startImage,
      lastFrame,
      videoLength,
      ty, // 1=9:16, 2=1:1, 3=16:9
      resolution = "720p", // "720p" | "1080p"
      generateAudio = true,
      negative_prompt,
      asyncMode,
    } = req.body ?? {};

    // 1. Prompt is generally required for Veo
    if (!prompt || typeof prompt !== "string") {
      return res
        .status(400)
        .json({ error: "Missing prompt (string required)" });
    }

    /* ------------------------------------------------------------------ */
    /* 2) Normalize values & build input                                  */
    /* ------------------------------------------------------------------ */

    // FIX: Calculate aspect ratio first, regardless of image presence
    const aspect_ratio =
      ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "9:16";

    // Build base input object
    // FIX: We now ALWAYS include 'aspect_ratio' so Veo doesn't default to landscape
    const input: Record<string, any> = {
      prompt,
      duration: videoLength, // seconds
      resolution, // "720p" | "1080p"
      generate_audio: generateAudio,
      aspect_ratio: aspect_ratio,
    };

    // Add Image if it exists
    if (
      startImage &&
      typeof startImage === "string" &&
      startImage.trim().length > 0
    ) {
      input.image = startImage;
    }

    // Add optional extras
    if (lastFrame) input.last_frame = lastFrame;
    if (negative_prompt) input.negative_prompt = negative_prompt;

    /* ------------------------------------------------------------------ */
    /* 3) Kick off prediction (Replicate REST)                            */
    /* ------------------------------------------------------------------ */
    const token = process.env.REPLI_KEY || process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return res.status(500).json({
        error: "Missing REPLI_KEY or REPLICATE_API_TOKEN in environment.",
      });
    }

    const replicateUrl =
      "https://api.replicate.com/v1/models/google/veo-3.1-fast/predictions";

    const postResponse = await fetch(replicateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ input }),
    });

    if (!postResponse.ok) {
      const text = await postResponse.text();
      console.error("Veo 3.1 Fast POST error:", text);
      return res.status(502).json({ error: text });
    }

    const {
      id: predictionId,
      status: initialStatus,
    } = await postResponse.json();
    console.log(`Veo 3.1 Fast prediction ID: ${predictionId}`);

    // Metadata calculation for frontend consistency
    let metaAspectRatio = "custom";
    if (!startImage) {
      metaAspectRatio =
        ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "9:16";
    } else {
      metaAspectRatio = "match_input";
    }

    if (asyncMode) {
      return res.status(200).json({
        status: "starting",
        jobId: predictionId,
        provider: "replicate",
        type: "veo3fast",
        meta: {
          duration: videoLength || 4,
          fps: 24,
          resolution,
          aspect_ratio: metaAspectRatio,
          used_i2v: !!startImage,
          model: "google/veo-3.1-fast",
        },
      });
    }

    /* ------------------------------------------------------------------ */
    /* 4) Poll until finished (or bail on error)                          */
    /* ------------------------------------------------------------------ */
    let status = initialStatus;
    let videoUrl: string | null = null;

    while (
      status === "starting" ||
      status === "processing" ||
      status === "running"
    ) {
      await new Promise((r) => setTimeout(r, 3000));

      const poll = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!poll.ok) {
        const err = await poll.text();
        console.error("Veo 3.1 Fast poll error:", err);
        return res.status(502).json({ error: err });
      }

      const pollData = await poll.json();
      status = pollData.status;

      if (status === "succeeded" || status === "successful") {
        const out = pollData.output;

        if (typeof out === "string") {
          videoUrl = out;
        } else if (Array.isArray(out) && out.length > 0) {
          const last = out[out.length - 1];
          if (typeof last === "string") {
            videoUrl = last;
          } else if (last && typeof last === "object") {
            if (typeof last.url === "string") videoUrl = last.url;
            else if (typeof last.video === "string") videoUrl = last.video;
          }
        } else if (out && typeof out === "object") {
          if (typeof out.url === "string") videoUrl = out.url;
          else if (typeof out.video === "string") videoUrl = out.video;
        }

        if (!videoUrl && pollData.output_url) {
          videoUrl = pollData.output_url;
        }

        if (!videoUrl) {
          console.warn("Veo 3.1 Fast succeeded but output URL not found:", out);
        }
      }

      if (status === "failed" || status === "canceled") {
        console.error("Veo 3.1 Fast failed/canceled:", pollData);
        return res
          .status(500)
          .json({ error: "Veo 3.1 Fast failed/canceled", detail: pollData });
      }
    }

    /* ------------------------------------------------------------------ */
    /* 5) Retrieve the finished MP4 & relay to caller (same shape)        */
    /* ------------------------------------------------------------------ */
    if (!videoUrl) {
      return res
        .status(500)
        .json({ error: "Veo 3.1 Fast finished with no video URL" });
    }

    const vidResp = await fetch(videoUrl);
    if (!vidResp.ok) {
      const err = await vidResp.text();
      console.error("Fetch final video error:", err);
      return res.status(502).json({ error: err });
    }

    const buffer = Buffer.from(await vidResp.arrayBuffer());
    const videoBase64 = `data:video/mp4;base64,${buffer.toString("base64")}`;

    // Metadata calculation already done above for asyncMode

    return res.status(200).json({
      videoBase64,
      meta: {
        duration: videoLength || 4,
        fps: 24,
        resolution,
        aspect_ratio: metaAspectRatio,
        used_i2v: !!startImage,
        model: "google/veo-3.1-fast",
      },
    });
  } catch (err: any) {
    console.error(
      "Error in veo3fast:",
      err?.response?.data || err?.message || err
    );
    return res
      .status(500)
      .json({ error: err.message || "Veo generation failed." });
  }
}

export async function veo3fast(req: any, res: any) {
  try {
    /* ------------------------------------------------------------------ */
    /* 1) Extract user-supplied fields for GROK                           */
    /* ------------------------------------------------------------------ */
    const {
      prompt,
      startImage,
      videoLength,
      ty, // 1=9:16, 2=1:1, 3=16:9
      resolution = "720p", // "720p"
      asyncMode,
    } = req.body ?? {};

    if (!prompt || typeof prompt !== "string") {
      return res
        .status(400)
        .json({ error: "Missing prompt (string required)" });
    }

    /* ------------------------------------------------------------------ */
    /* 2) Normalize values & build input                                  */
    /* ------------------------------------------------------------------ */
    let aspect_ratio =
      ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "16:9";

    const input: Record<string, any> = {
      prompt,
      // Grok accepts duration 1-15.
      duration: videoLength || 5,
      aspect_ratio: aspect_ratio,
    };

    if (
      startImage &&
      typeof startImage === "string" &&
      startImage.trim().length > 0
    ) {
      input.image = startImage;
      // If we provide image to Grok, aspect ratio becomes input image's ratio by default if "auto" or can be forced,
      // let's leave aspect_ratio as provided by frontend or auto. Grok accepts: 16:9, 9:16, 1:1.
    }

    /* ------------------------------------------------------------------ */
    /* 3) Kick off prediction (Replicate REST)                            */
    /* ------------------------------------------------------------------ */
    const token = process.env.REPLI_KEY || process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return res.status(500).json({
        error: "Missing REPLI_KEY or REPLICATE_API_TOKEN in environment.",
      });
    }

    const replicateUrl =
      "https://api.replicate.com/v1/models/xai/grok-imagine-video-1.5/predictions";

    const postResponse = await fetch(replicateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ input }),
    });

    if (!postResponse.ok) {
      const text = await postResponse.text();
      console.error("Grok POST error:", text);
      return res.status(502).json({ error: text });
    }

    const {
      id: predictionId,
      status: initialStatus,
    } = await postResponse.json();
    console.log(`Grok prediction ID: ${predictionId}`);

    let metaAspectRatio = "custom";
    if (!startImage) {
      metaAspectRatio =
        ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "16:9";
    } else {
      metaAspectRatio = "match_input";
    }

    if (asyncMode) {
      return res.status(200).json({
        status: "starting",
        jobId: predictionId,
        provider: "replicate",
        type: "veo3fast", // Keeping identifier as requested so frontend hits same route
        meta: {
          duration: videoLength || 5,
          fps: 30, // Grok is typically 30 fps
          resolution,
          aspect_ratio: metaAspectRatio,
          used_i2v: !!startImage,
          model: "xai/grok-imagine-video-1.5",
        },
      });
    }

    /* ------------------------------------------------------------------ */
    /* 4) Poll until finished                                             */
    /* ------------------------------------------------------------------ */
    let status = initialStatus;
    let videoUrl: string | null = null;

    while (
      status === "starting" ||
      status === "processing" ||
      status === "running"
    ) {
      await new Promise((r) => setTimeout(r, 3000));

      const poll = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!poll.ok) {
        const err = await poll.text();
        console.error("Grok poll error:", err);
        return res.status(502).json({ error: err });
      }

      const pollData = await poll.json();
      status = pollData.status;

      if (status === "succeeded" || status === "successful") {
        const out = pollData.output;
        if (typeof out === "string") {
          videoUrl = out;
        } else if (Array.isArray(out) && out.length > 0) {
          const last = out[out.length - 1];
          if (typeof last === "string") videoUrl = last;
          else if (last && typeof last === "object") {
            if (typeof last.url === "string") videoUrl = last.url;
            else if (typeof last.video === "string") videoUrl = last.video;
          }
        } else if (out && typeof out === "object") {
          if (typeof out.url === "string") videoUrl = out.url;
          else if (typeof out.video === "string") videoUrl = out.video;
        }

        if (!videoUrl && pollData.output_url) {
          videoUrl = pollData.output_url;
        }

        if (!videoUrl) console.warn("Grok succeeded but url missing:", out);
      }

      if (status === "failed" || status === "canceled") {
        console.error("Grok failed/canceled:", pollData);
        return res
          .status(500)
          .json({ error: "Grok failed/canceled", detail: pollData });
      }
    }

    /* ------------------------------------------------------------------ */
    /* 5) Retrieve the finished MP4 & relay to caller                     */
    /* ------------------------------------------------------------------ */
    if (!videoUrl) {
      return res.status(500).json({ error: "Grok finished with no video URL" });
    }

    const vidResp = await fetch(videoUrl);
    if (!vidResp.ok) {
      const err = await vidResp.text();
      console.error("Fetch final video error:", err);
      return res.status(502).json({ error: err });
    }

    const buffer = Buffer.from(await vidResp.arrayBuffer());
    const videoBase64 = `data:video/mp4;base64,${buffer.toString("base64")}`;

    return res.status(200).json({
      videoBase64,
      meta: {
        duration: videoLength || 5,
        fps: 30,
        resolution,
        aspect_ratio: metaAspectRatio,
        used_i2v: !!startImage,
        model: "xai/grok-imagine-video-1.5",
      },
    });
  } catch (err: any) {
    console.error(
      "Error in Grok generation:",
      err?.response?.data || err?.message || err
    );
    return res
      .status(500)
      .json({ error: err.message || "Grok generation failed." });
  }
}

export async function wan25FastRoute(req: any, res: any) {
  try {
    /* ------------------------------------------------------------------ */
    /* 1) Extract user-supplied fields                                     */
    /* ------------------------------------------------------------------ */
    const {
      prompt, // text prompt to guide motion/style
      startImage, // REQUIRED: URL or data URI for the first frame
      videoLength, // desired seconds, e.g. 5 or 10
      ty, // your aspect convention: 1=portrait, 2=square, 3=landscape
      negative_prompt, // optional: stuff to avoid
      seed, // optional reproducibility
      resolution, // optional override ("720p" | "1080p")
    } = req.body ?? {};

    // WAN 2.5 i2v-fast needs an image.
    if (!startImage) {
      return res.status(400).json({
        error: "wan-2.5-i2v-fast requires startImage (image-to-video).",
      });
    }

    // at minimum we also want either prompt or negative prompt,
    // but WAN will accept empty-ish prompt. We'll allow empty,
    // because sometimes you just animate the image.
    console.log("WAN 2.5 FAST prompt:", prompt, "startImage?", !!startImage);

    /* ------------------------------------------------------------------ */
    /* 2) Normalize inputs to WAN 2.5 FAST schema                          */
    /* ------------------------------------------------------------------ */
    // According to wan-2.5-i2v-fast:
    // {
    //   image: uri,
    //   prompt: string,
    //   duration: integer (default 5),
    //   resolution: "720p" | "1080p" (default "720p"),
    //   negative_prompt?: string,
    //   enable_prompt_expansion?: boolean (default true),
    //   seed?: integer
    //   // (audio exists in the schema, but we're not wiring that yet)
    // }
    //
    // We'll mirror your old behavior:
    // - duration: only allow 5 or 10, default 5.
    // - aspect_ratio metadata from ty for the response only.
    //   (WAN doesn't take aspect_ratio directly in this fast endpoint.)
    //
    // We'll also pick a resolution default. You had 1080p hardcoded in one route,
    // but WAN fast defaults to 720p. We'll let caller override with req.body.resolution.

    const duration = [5, 10].includes(Number(videoLength))
      ? Number(videoLength)
      : 5;

    // for metadata only, keep your appâ€™s aspect semantics veo
    const aspect_ratio =
      ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "9:16";

    // actual param we send to WAN
    const finalResolution =
      typeof resolution === "string" && resolution.trim().length > 0
        ? resolution
        : "720p"; // WAN fast default

    // Build the Replicate input object
    const replicateInput: Record<string, any> = {
      image: startImage,
      prompt: prompt ?? "",
      duration, // seconds
      resolution: finalResolution, // "720p" or "1080p"
      enable_prompt_expansion: true,
    };

    if (negative_prompt) {
      replicateInput.negative_prompt = negative_prompt;
    }

    if (typeof seed === "number") {
      replicateInput.seed = seed;
    }

    /* ------------------------------------------------------------------ */
    /* 3) Fire prediction against wan-2.5-i2v-fast                         */
    /* ------------------------------------------------------------------ */
    // Auth: Bearer <REPLICATE_API_TOKEN>
    // Endpoint style: model-scoped, so we DO NOT send {model: "..."} in body
    const token = process.env.REPLI_KEY || process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return res.status(500).json({
        error: "Missing REPLI_KEY or REPLICATE_API_TOKEN in environment.",
      });
    }

    // model-scoped predictions endpoint so we don't need version hash
    const createResp = await fetch(
      "https://api.replicate.com/v1/models/wan-video/wan-2.5-i2v-fast/predictions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          // Optional sync window if you want:
          // Prefer: "wait=60",
        },
        body: JSON.stringify({ input: replicateInput }),
      }
    );

    if (!createResp.ok) {
      const text = await createResp.text();
      console.error("WAN 2.5 FAST POST error:", text);
      return res.status(502).json({ error: text });
    }

    const { id: predictionId, status: initialStatus } = await createResp.json();

    console.log(`WAN 2.5 FAST prediction ID: ${predictionId}`);

    /* ------------------------------------------------------------------ */
    /* 4) Poll Replicate until finished                                   */
    /* ------------------------------------------------------------------ */
    // We'll mirror the same polling pattern youâ€™re already using elsewhere.
    let status = initialStatus;
    let videoUrl: string | null = null;

    while (
      status === "starting" ||
      status === "processing" ||
      status === "running"
    ) {
      // pause between polls
      await new Promise((r) => setTimeout(r, 3000));

      const poll = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!poll.ok) {
        const err = await poll.text();
        console.error("WAN 2.5 FAST poll error:", err);
        return res.status(502).json({ error: err });
      }

      const pollData = await poll.json();
      status = pollData.status;

      if (status === "succeeded" || status === "successful") {
        // Replicate output can be:
        //   - single string URL
        //   - array of URLs / objects
        //   - object { url, video }
        const out = pollData.output;

        if (typeof out === "string") {
          videoUrl = out;
        } else if (Array.isArray(out) && out.length > 0) {
          const last = out[out.length - 1];
          if (typeof last === "string") {
            videoUrl = last;
          } else if (last && typeof last === "object") {
            if (typeof (last as any).url === "string") {
              videoUrl = (last as any).url;
            } else if (typeof (last as any).video === "string") {
              videoUrl = (last as any).video;
            }
          }
        } else if (out && typeof out === "object") {
          if (typeof (out as any).url === "string") {
            videoUrl = (out as any).url;
          } else if (typeof (out as any).video === "string") {
            videoUrl = (out as any).video;
          }
        }

        if (!videoUrl && pollData.output_url) {
          // sometimes present at top-level
          videoUrl = pollData.output_url;
        }

        if (!videoUrl) {
          console.warn(
            "wan-2.5-i2v-fast succeeded but output URL not found:",
            out
          );
        }
      }

      if (status === "failed" || status === "canceled") {
        console.error("WAN 2.5 FAST failed/canceled:", pollData);
        return res.status(500).json({
          error: "wan-2.5-i2v-fast failed/canceled",
          detail: pollData,
        });
      }
    }

    /* ------------------------------------------------------------------ */
    /* 5) Download final MP4, convert to base64, send back                 */
    /* ------------------------------------------------------------------ */
    if (!videoUrl) {
      return res.status(500).json({
        error: "wan-2.5-i2v-fast finished with no video URL",
      });
    }

    const vidResp = await fetch(videoUrl);
    if (!vidResp.ok) {
      const err = await vidResp.text();
      console.error("Fetch final video error:", err);
      return res.status(502).json({ error: err });
    }

    const buffer = Buffer.from(await vidResp.arrayBuffer());
    const videoBase64 = `data:video/mp4;base64,${buffer.toString("base64")}`;

    /* ------------------------------------------------------------------ */
    /* 6) Respond in the same contract shape youâ€™re already using         */
    /* ------------------------------------------------------------------ */
    return res.status(200).json({
      videoBase64,
      meta: {
        duration, // seconds requested
        fps: 24, // we keep a stable fps meta like your other routes
        resolution: finalResolution, // "720p"/"1080p" requested from model
        aspect_ratio, // your app metadata (model doesn't actually take 1:1 yet)
        used_i2v: true, // wan-2.5-fast is i2v by design here
        model: "wan-video/wan-2.5-i2v-fast",
      },
    });
  } catch (err: any) {
    console.error(
      "Error in wan25FastRoute:",
      err?.response?.data || err?.message || err
    );
    return res
      .status(500)
      .json({ error: err?.message || "WAN 2.5 fast generation failed." });
  }
}

export async function minimax23Route(req: any, res: any) {
  try {
    const {
      prompt,
      startImage: imageUrl,
      videoLength: duration = 5,
      ty, // 1=9:16, 2=1:1, 3=16:9
      generateAudio = true,
      asyncMode,
    } = req.body ?? {};

    const textPrompt = typeof prompt === "string" ? prompt.trim() : "";
    if (!textPrompt) {
      return res
        .status(400)
        .json({ error: "Missing prompt (string required)" });
    }

    const hasImage = imageUrl && typeof imageUrl === "string" && imageUrl.trim().length > 0;

    const arMap: Record<number, string> = { 1: "9:16", 2: "1:1", 3: "16:9" };
    const metaAspectRatio = arMap[ty] || "16:9";
    const finalDuration = clamp(Number(duration), 2, 12);

    const payload: Record<string, any> = {
      prompt: textPrompt,
      duration: finalDuration,
      resolution: "720p",
      aspect_ratio: metaAspectRatio,
      generate_audio: !!generateAudio,
    };

    if (hasImage) {
      payload.image = imageUrl;
    }

    const modelId = "bytedance/seedance-1.5-pro";
    console.log(
      `[Seedance 1.5 Pro] Calling ${modelId} (Duration: ${finalDuration}s, Audio: ${!!generateAudio})`
    );

    const rep = new Replicate({
      auth: process.env.REPLI_KEY || process.env.REPLICATE_API_TOKEN,
    });

    if (asyncMode) {
      const prediction = await rep.predictions.create({
        model: modelId as any,
        input: payload,
      });
      return res.status(200).json({
        status: "starting",
        jobId: prediction.id,
        provider: "replicate",
        modelEndpoint: modelId,
        meta: {
          duration: finalDuration,
          resolution: "720p",
          aspect_ratio: metaAspectRatio,
          used_i2v: hasImage,
          model: "seedance-1.5-pro",
        },
      });
    }

    const output: any = await rep.run(modelId as any, { input: payload });

    let videoUrl = "";
    if (typeof output === "string") videoUrl = output;
    else if (Array.isArray(output)) videoUrl = output[0];
    else if (output && typeof output.url === "function") videoUrl = output.url();
    else if (output && typeof output.url === "string") videoUrl = output.url;

    if (!videoUrl) {
      throw new Error("Seedance 1.5 Pro returned no video URL.");
    }

    const videoBase64 = await fetchAsBase64(videoUrl);

    return res.status(200).json({
      videoBase64,
      videoUrl,
      meta: {
        model: "seedance-1.5-pro",
        duration: finalDuration,
        resolution: "720p",
        aspect_ratio: metaAspectRatio,
        used_i2v: hasImage,
      },
    });
  } catch (err: any) {
    const status = err?.status || 500;
    const details = err?.body || err?.response?.data;
    console.error("Seedance 1.5 Pro route error:", {
      status,
      details,
      message: err.message,
    });

    return res.status(status).json({
      error:
        details?.detail || err?.message || "Seedance 1.5 Pro request failed",
      details,
    });
  }
}

export async function KlingRouteo1(req: any, res: any) {
  try {
    const {
      prompt,
      startImage: imageUrl,
      videoLength = 6,
      ty,
      asyncMode,
    } = req.body ?? {};

    const textPrompt = typeof prompt === "string" ? prompt.trim() : "";
    const hasImage =
      imageUrl && typeof imageUrl === "string" && imageUrl.trim().length > 0;

    let duration = Number(videoLength);
    if (duration !== 6 && duration !== 10) {
      duration = 6;
    }

    const payload: Record<string, any> = {
      prompt: textPrompt || "A cinematic scene",
      resolution: "768p",
      duration: duration,
      prompt_optimizer: true,
    };

    if (hasImage) {
      payload.first_frame_image = imageUrl;
    } else {
      const arMap: Record<number, string> = { 1: "9:16", 2: "1:1", 3: "16:9" };
      payload.aspect_ratio = arMap[ty] || "16:9";
    }

    const modelId = "minimax/hailuo-2.3";
    console.log(
      `[Hailuo 2.3] Calling ${modelId} (Duration: ${duration}s, Res: 768p)`
    );

    const rep = new Replicate({
      auth: process.env.REPLI_KEY || process.env.REPLICATE_API_TOKEN,
    });

    if (asyncMode) {
      const prediction = await rep.predictions.create({
        model: modelId as any,
        input: payload,
      });
      return res.status(200).json({
        status: "starting",
        jobId: prediction.id,
        provider: "replicate",
        modelEndpoint: modelId,
        meta: {
          duration,
          resolution: "768p",
          aspect_ratio: "match_input",
          used_i2v: hasImage,
          model: "hailuo-2.3",
        },
      });
    }

    const output: any = await rep.run(modelId as any, { input: payload });

    let videoUrl = "";
    if (typeof output === "string") videoUrl = output;
    else if (Array.isArray(output)) videoUrl = output[0];
    else if (output && typeof output.url === "string") videoUrl = output.url;

    if (!videoUrl) {
      throw new Error("Hailuo 2.3 returned no video URL.");
    }

    const videoBase64 = await fetchAsBase64(videoUrl);

    return res.status(200).json({
      videoBase64,
      videoUrl,
      meta: {
        model: "hailuo-2.3",
        duration,
        resolution: "768p",
        aspect_ratio: "match_input",
        used_i2v: hasImage,
      },
    });
  } catch (err: any) {
    const status = err?.status || 500;
    const details = err?.body || err?.response?.data;
    console.error("Hailuo 2.3 route error:", {
      status,
      details,
      message: err.message,
    });

    return res.status(status).json({
      error: details?.detail || err?.message || "Hailuo 2.3 request failed",
      details,
    });
  }
}

type AnyReq = { body: any };
type AnyRes = { status: (n: number) => AnyRes; json: (x: any) => any };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function fetchAsBase64(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Fetch video failed: ${resp.status} ${errText}`);
  }
  const buffer = Buffer.from(await resp.arrayBuffer());
  return `data:video/mp4;base64,${buffer.toString("base64")}`;
}

/**
 * Input contract (ONLY these are read from req.body):
 * - prompt: string (required)
 * - startImage: string URL or data URI (required)
 * - videoLength: number|string (desired seconds)
 * - negative_prompt: any (accepted but IGNORED)
 * - seed: any (accepted but IGNORED)
 * - resolution: "720p" | "1080p" (defaults to "720p" per your note)
 *
 * Notes on model:
 * - Seedance Pro Fast accepts duration ~2â€“12s, resolution default "1080p".
 * - aspect_ratio is ignored when image is provided (we're image-to-video).
 */

export async function minimax23Routex(req: AnyReq, res: AnyRes) {
  try {
    /* ------------------------------------------------------------------ */
    /* 1) Extract user-supplied fields                                    */
    /* ------------------------------------------------------------------ */
    const {
      prompt,
      startImage, // URL or data URI
      videoLength,
      resolution = "720p", // Default to 720p
      ty, // 1=Portrait(9:16), 2=Square(1:1), 3=Landscape(16:9)
      generateAudio = true,
      asyncMode,
    } = req.body ?? {};

    // Prompt is required
    if (!prompt || typeof prompt !== "string") {
      return res
        .status(400)
        .json({ error: "Missing prompt (string required)" });
    }

    // Determine Mode (T2V vs I2V)
    const hasImage =
      startImage &&
      typeof startImage === "string" &&
      startImage.trim().length > 0;

    /* ------------------------------------------------------------------ */
    /* 2) Select Endpoint & Prepare Input                                 */
    /* ------------------------------------------------------------------ */

    // Switch endpoints based on whether an image is provided
    const modelEndpoint = hasImage
      ? "fal-ai/pixverse/v6/image-to-video"
      : "fal-ai/pixverse/v6/text-to-video";

    // Duration: Pro Fast usually supports 5 or 10.
    const duration = clamp(Number(videoLength ?? 5), 2, 10);

    // Build the Input Object
    const input: Record<string, any> = {
      prompt: prompt.trim(),
      duration: duration,
      resolution:
        String(resolution).toLowerCase() === "1080p" ? "1080p" : "720p",
      with_audio: !!generateAudio,
      generate_audio: !!generateAudio,
      generate_audio_switch: !!generateAudio ? 1 : 0,
      audio: !!generateAudio,
    };

    if (hasImage) {
      // --- IMAGE TO VIDEO ---
      input.image_url = startImage;
      // Note: Seedance I2V typically ignores aspect_ratio and uses the image's ratio
    } else {
      // --- TEXT TO VIDEO ---
      const aspect_ratio =
        ty === 1
          ? "9:16" // Portrait
          : ty === 2
          ? "1:1" // Square
          : ty === 3
          ? "16:9" // Landscape
          : "9:16"; // Default

      input.aspect_ratio = aspect_ratio;
    }

    console.log(
      `[PixVerse v6] Calling ${modelEndpoint} (Duration: ${duration}s, Res: ${
        input.resolution
      }, Audio: ${!!generateAudio})`
    );

    const metaAspectRatio = hasImage ? "match_input" : input.aspect_ratio;

    if (asyncMode) {
      const response = await fal.queue.submit(modelEndpoint, {
        input: input as any,
      });
      return res.status(200).json({
        status: "starting",
        jobId: response.request_id,
        provider: "fal",
        modelEndpoint,
        meta: {
          duration,
          resolution,
          aspect_ratio: metaAspectRatio,
        },
      });
    }

    /* ------------------------------------------------------------------ */
    /* 3) Call Fal AI via fal.subscribe                                   */
    /* ------------------------------------------------------------------ */
    const result = await fal.subscribe(modelEndpoint, {
      input: input as any, // <--- FIXED: 'as any' bypasses the strict type check
      logs: true,
      onQueueUpdate: (u) => {
        if (u.status === "IN_PROGRESS") {
          u.logs?.forEach((l: any) => console.log("[PixVerse v6]", l.message));
        }
      },
    });

    const videoUrl = result?.data?.video?.url;

    if (!videoUrl) {
      throw new Error("PixVerse returned no video URL.");
    }

    /* ------------------------------------------------------------------ */
    /* 4) Download & Return Base64                                        */
    /* ------------------------------------------------------------------ */
    const videoBase64 = await fetchAsBase64(videoUrl);

    return res.status(200).json({
      videoBase64,
      videoUrl,
      meta: {
        model: "pixverse-v6",
        duration,
        resolution: input.resolution,
        aspect_ratio: metaAspectRatio,
        used_i2v: hasImage,
      },
    });
  } catch (err: any) {
    const status = err?.status || 500;
    const details = err?.body || err?.response?.data;
    console.error("PixVerse route error:", {
      status,
      details,
      message: err.message,
    });

    return res.status(status).json({
      error: details?.detail || err?.message || "PixVerse request failed",
      details,
    });
  }
}

export async function klingProRouteWan(req: any, res: any) {
  try {
    /* ------------------------------------------------------------------ */
    /* 1) Extract user-supplied fields                                     */
    /* ------------------------------------------------------------------ */
    const {
      prompt,
      startImage, // URL | data-URI (REQUIRED for WAN i2v)
      videoLength, // seconds (e.g., 5 or 10)
      ty, // 1=portrait, 2=square, 3=landscape (your app's convention)
      // optional tunables you might pass through:
      sample_steps, // 1..50 (WAN default 40)
      go_fast, // boolean
      seed, // integer
    } = req.body;

    if (!startImage) {
      return res
        .status(400)
        .json({ error: "WAN i2v requires 'startImage' (image-to-video)." });
    }

    console.log("WAN prompt:", prompt, "startImage?", !!startImage);

    /* ------------------------------------------------------------------ */
    /* 2) Build request for Replicate (WAN i2v)                            */
    /*    Model: wan-video/wan-2.2-i2v-a14b                                */
    /* ------------------------------------------------------------------ */
    const replicateUrl =
      "https://api.replicate.com/v1/models/wan-video/wan-2.2-i2v-a14b/predictions";

    // Map your `ty` to WAN's resolution.
    // WAN examples: "832x480" (16:9), "480x832" (9:16), also accepts "480p".
    const resolution =
      ty === 1
        ? "480x832" // portrait 9:16
        : ty === 3
        ? "832x480" // landscape 16:9
        : "480p"; // fallback for square/unknown

    // Map your videoLength (seconds) to WAN's num_frames (81..100) + fps (5..24)
    const targetSeconds = Math.max(1, Number(videoLength) || 5);
    // Choose an fps that keeps frames <= 100 while matching the target duration
    // Simple strategy: fps = clamp(round(100 / seconds), 5..24), then frames = clamp(round(seconds * fps), 81..100)
    const fps = Math.max(5, Math.min(24, Math.round(100 / targetSeconds)));
    const frames = Math.max(81, Math.min(100, Math.round(targetSeconds * fps)));

    const replicateInput: Record<string, any> = {
      image: startImage,
      prompt,
      resolution,
      frames_per_second: fps,
      num_frames: frames,
      sample_steps: typeof sample_steps === "number" ? sample_steps : 40, // your old code used 30; WAN default is 40
      go_fast: !!go_fast,
    };
    if (typeof seed === "number") replicateInput.seed = seed;

    /* ------------------------------------------------------------------ */
    /* 3) Kick off prediction                                             */
    /* ------------------------------------------------------------------ */
    const token = process.env.REPLI_KEY || process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return res.status(500).json({
        error: "Missing REPLI_KEY or REPLICATE_API_TOKEN in environment.",
      });
    }

    const postResponse = await fetch(replicateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify({ input: replicateInput }),
    });

    if (!postResponse.ok) {
      const text = await postResponse.text();
      console.error("WAN POST error:", text);
      return res.status(502).json({ error: text });
    }

    const {
      id: predictionId,
      status: initialStatus,
    } = await postResponse.json();
    console.log(`WAN prediction ID: ${predictionId}`);

    /* ------------------------------------------------------------------ */
    /* 4) Poll until finished (or bail on error)                           */
    /* ------------------------------------------------------------------ */
    let status = initialStatus;
    let videoUrl: string | null = null;

    while (status === "starting" || status === "processing") {
      await new Promise((r) => setTimeout(r, 3000));

      const poll = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: { Authorization: `Token ${token}` },
        }
      );

      if (!poll.ok) {
        const err = await poll.text();
        console.error("WAN poll error:", err);
        return res.status(502).json({ error: err });
      }

      const pollData = await poll.json();
      status = pollData.status;

      if (status === "succeeded") {
        // Replicate outputs can be a string or an array of URIs. Handle both.
        const out = pollData.output;
        if (typeof out === "string") {
          videoUrl = out;
        } else if (Array.isArray(out) && out.length > 0) {
          // pick the last output if multiple
          videoUrl = out[out.length - 1];
        } else {
          console.warn("WAN succeeded but output not found:", out);
        }
      }

      if (status === "failed" || status === "canceled") {
        console.error("WAN failed/canceled:", pollData);
        return res
          .status(500)
          .json({ error: "WAN failed/canceled", detail: pollData });
      }
    }

    /* ------------------------------------------------------------------ */
    /* 5) Retrieve the finished MP4 & relay to caller                      */
    /* ------------------------------------------------------------------ */
    if (!videoUrl) {
      return res.status(500).json({ error: "WAN finished with no video URL" });
    }

    const vidResp = await fetch(videoUrl);
    if (!vidResp.ok) {
      const err = await vidResp.text();
      console.error("Fetch final video error:", err);
      return res.status(502).json({ error: err });
    }

    const buffer = Buffer.from(await vidResp.arrayBuffer());
    const videoBase64 = `data:video/mp4;base64,${buffer.toString("base64")}`;

    return res.status(200).json({
      videoBase64,
      meta: {
        fps,
        num_frames: frames,
        resolution,
        // duration estimate:
        approx_seconds: Number((frames / fps).toFixed(2)),
      },
    });
    //// seedream
  } catch (err: any) {
    console.error("Error in wan i2v route:", err);
    return res.status(500).json({ error: err.message });
  }
}

// req.body:
// {
//   video: string;            // required: motion source video URL
//   characterImage: string;   // required: character image URL
//   goFast?: boolean;         // optional
//   referFrames?: number;     // optional: 1 or 5
//   resolution?: string;      // optional: "720" etc, default "720"
//   mergeAudio?: boolean;     // optional, default true
//   fps?: number;             // optional, default 24 (5â€“60)
//   seed?: number;            // optional
// }

// Shared function for handling Kling O3 requests
async function runKlingO3(
  res: any,
  video: string,
  characterImage: string,
  prompt: string,
  durationInput: any,
  keepAudio: boolean = true,
  asyncMode: boolean = false
) {
  try {
    // 1. Validation
    if (!video || !characterImage) {
      return res.status(400).json({
        error: "Missing required fields: video and characterImage (URLs).",
      });
    }

    if (!process.env.FAL_KEY) {
      return res
        .status(500)
        .json({ error: "Missing FAL_KEY in environment variables." });
    }

    // 2. Format Duration (Must be String "5" or "10")
    const d = Number(durationInput);
    const validDuration = d;

    console.log(
      `ðŸš€ Submitting to Kling O3 (Video-to-Video) | Duration: ${validDuration}s | KeepAudio: ${keepAudio}`
    );

    const modelEndpoint = "fal-ai/kling-video/o3/standard/video-to-video/edit";
    const inputOptions = {
      prompt: prompt,
      video_url: video, // Source video
      duration: validDuration,
      keep_audio: keepAudio, // Logic from frontend
      elements: [
        {
          frontal_image_url: characterImage, // Target character
          reference_image_urls: [characterImage],
        },
      ],
    };

    if (asyncMode) {
      const response = await fal.queue.submit(modelEndpoint, {
        input: inputOptions,
      });
      return res.status(200).json({
        status: "starting",
        jobId: response.request_id,
        provider: "fal",
        modelEndpoint,
        meta: {
          duration: validDuration,
          keepAudio,
        },
      });
    }

    // 3. Submit to Fal.ai
    const result: any = await fal.subscribe(modelEndpoint, {
      input: inputOptions,
      logs: true,
    });

    // 4. Handle Result
    const videoUrl = result.data?.video?.url;

    if (!videoUrl) {
      return res.status(500).json({
        error: "Kling O3 succeeded but no output video URL was found",
        details: result,
      });
    }

    // 5. Download & Convert to Base64 (Legacy support)
    const vidResp = await fetch(videoUrl);
    if (!vidResp.ok) {
      const err = await vidResp.text();
      return res
        .status(502)
        .json({ error: `Failed to fetch output video: ${err}` });
    }

    const buffer = Buffer.from(await vidResp.arrayBuffer());
    const videoBase64 = `data:video/mp4;base64,${buffer.toString("base64")}`;

    return res.status(200).json({
      videoBase64,
      videoUrl,
      meta: {
        model: "fal-ai/kling-video/o3/standard/video-to-video/edit",
        duration: validDuration,
        prompt_used: prompt,
      },
    });
  } catch (err: any) {
    console.error(
      "âŒ Kling O3 Error:",
      JSON.stringify(err.body || err, null, 2)
    );
    return res.status(500).json({
      error: err.message || "An unexpected error occurred with Kling API.",
      details: err.body?.detail || null,
    });
  }
}

// ------------------------------------------------------------------
// ROUTE 1: Character Replacement (Formerly "Replace")
// ------------------------------------------------------------------
export async function wanAnimateRouteRep(req: any, res: any) {
  const { video, characterImage, duration, useaudio, asyncMode } =
    req.body || {};

  const finalPrompt =
    "High quality video of @Element1 acting as the character in @Video1. Maintain exact motion, lighting, and style of @Video1.";

  // Use the provided useaudio boolean, or default to true
  const keepAudio = typeof useaudio === "boolean" ? useaudio : true;

  return runKlingO3(
    res,
    video,
    characterImage,
    finalPrompt,
    duration,
    keepAudio,
    asyncMode
  );
}

// ------------------------------------------------------------------
// ROUTE 2: Motion/Animation (Formerly "Animate")
// ------------------------------------------------------------------
export async function wanAnimateRoute(req: any, res: any) {
  const { video, characterImage, duration, useaudio, asyncMode } =
    req.body || {};

  // Slightly different prompt to emphasize "Motion" over "Replacement"
  const finalPrompt =
    "High quality video of @Element1 performing the exact action seen in @Video1. Keep the style and background of @Element1 where possible.";

  // Use the provided useaudio boolean, or default to true
  const keepAudio = typeof useaudio === "boolean" ? useaudio : true;

  return runKlingO3(
    res,
    video,
    characterImage,
    finalPrompt,
    duration,
    keepAudio,
    asyncMode
  );
}

function isHttpUrl(s: string) {
  return /^https?:\/\//i.test(s);
}
function isDataImageUri(s: string) {
  return /^data:image\/(png|jpeg|jpg|webp|bmp);base64,/i.test(s);
}
function isDataAudioUri(s: string) {
  return /^data:audio\/(wav|mpeg|mp3|x-wav|m4a);base64,/i.test(s);
}

export async function klingProRoute(req: any, res: any) {
  try {
    const {
      prompt,
      inputs,
      startImage: imageUrl,
      videoLength: duration = "auto",
      ty, // 1=9:16, 2=1:1, 3=16:9
      asyncMode,
      activechracternames = [],
      generateAudio = true,
      lipSyncUrl,
      referenceVideoUrl,
      referenceVideos,
    } = req.body ?? {};

    const hasLipSync = typeof lipSyncUrl === "string" && lipSyncUrl.trim().length > 0;

    // Reference videos (Seedance 2.0): up to 3, total <= 15s. Referenced as [Video1]..[Video3].
    const refVideos: string[] = (Array.isArray(referenceVideos)
      ? referenceVideos
      : referenceVideoUrl
      ? [referenceVideoUrl]
      : []
    ).filter((u: any) => typeof u === "string" && u.trim().length > 0).slice(0, 3);

    const textPrompt = (typeof prompt === "string"
      ? prompt
      : typeof inputs === "string"
      ? inputs
      : ""
    ).trim();

    if (!textPrompt) {
      return res
        .status(400)
        .json({ error: "Missing 'prompt' (or 'inputs') string" });
    }

    // --- SEEDANCE 2.0 TRANSLATION NODE ---
    let translatedPrompt = textPrompt;
    let image_urls: string[] = [];

    // 1. Handle Start Frame (The 0-second Anchor)
    const hasStartFrame = imageUrl && typeof imageUrl === "string" && imageUrl.trim().length > 0;
    if (hasStartFrame) {
      image_urls.push(imageUrl);
      translatedPrompt += ` Use [Image1] as the 0-second start frame composition.`;
    }

    // 2. Handle Character References (Identity Locks)
    if (activechracternames && Array.isArray(activechracternames)) {
      activechracternames.forEach((char: any) => {
        if (!char.name || (!char.url && !char.imageUrl)) return;
        const charUrl = char.url || char.imageUrl;

        // Format UI handle
        const handle = "@" + char.name.replace(/[^A-Za-z0-9_]/g, "");
        const regex = new RegExp(
          `\\s*${handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "ig"
        );

        if (regex.test(translatedPrompt)) {
          image_urls.push(charUrl);
          const imageIndex = image_urls.length; // Will correctly be 2 if start frame exists, or 1 if no start frame exists
          const systemTag = `[Image${imageIndex}]`; // Replicate Seedance tag

          // Replace conversational tag with Seedance syntax
          translatedPrompt = translatedPrompt.replace(regex, ` ${systemTag}`);

          // Append the strict Identity Lock directive to enforce character consistency
          translatedPrompt += ` Use ${systemTag} as the strict facial identity lock and overall character silhouette.`;
        }
      });
    }

    const arMap: Record<number, string> = { 1: "9:16", 2: "1:1", 3: "16:9" };
    const aspect_ratio = arMap[ty] || "16:9";

    let finalDuration: string | number = "5";
    if (duration && duration !== "auto") {
      finalDuration = String(clamp(Number(duration), 4, 15));
    }

    const payload: Record<string, any> = {
      prompt: translatedPrompt,
      duration: Number(finalDuration),
      aspect_ratio: aspect_ratio,
      resolution: "720p",
      generate_audio: !!generateAudio,
    };

    const hasCharacters = (hasStartFrame && image_urls.length > 1) || (!hasStartFrame && image_urls.length > 0);
    // Lip-sync requires the reference path: reference_audios needs at least one reference
    // image/video and cannot be combined with the strict first-frame `image` field.
    const useReferencePath = hasCharacters || (hasLipSync && image_urls.length > 0);

    if (image_urls.length > 0) {
      if (useReferencePath) {
        payload.reference_images = image_urls;
      } else {
        payload.image = image_urls[0];
        // First frame is sent alone via `image` (not a numbered reference), so strip the
        // dangling [Image1] directive that would otherwise point at a non-existent reference.
        payload.prompt = translatedPrompt.replace(
          " Use [Image1] as the 0-second start frame composition.",
          ""
        );
      }
    }

    // Audio-driven lip-sync: only attach when a reference image/video exists (Replicate requirement).
    if (hasLipSync && image_urls.length > 0) {
      payload.reference_audios = [lipSyncUrl];
      payload.prompt = `${payload.prompt} Use [Audio1] as the driving audio for lip-sync.`;
    }

    // Reference videos: motion/style reference. Attach and add numbered [VideoN] directives.
    if (refVideos.length > 0) {
      payload.reference_videos = refVideos;
      const directives = refVideos
        .map((_, n) => `[Video${n + 1}]`)
        .join(", ");
      payload.prompt = `${payload.prompt} Use ${directives} as motion and style reference.`;
    }

    const modelId = "bytedance/seedance-2.0";
    console.log(
      `[Seedance 2.0 Normal Replicate] Calling ${modelId} (Duration: ${payload.duration}, Audio: ${!!generateAudio})`
    );

    const rep = new Replicate({
      auth: process.env.REPLI_KEY || process.env.REPLICATE_API_TOKEN,
    });

    if (asyncMode) {
      const prediction = await rep.predictions.create({
        model: modelId as any,
        input: payload,
      });
      return res.status(200).json({
        status: "starting",
        jobId: prediction.id,
        provider: "replicate",
        modelEndpoint: modelId,
        meta: {
          duration: payload.duration,
          aspect_ratio: payload.aspect_ratio,
          used_i2v: hasStartFrame,
          model: "seedance-2.0-standard",
        },
      });
    }

    const output: any = await rep.run(modelId as any, { input: payload });

    let videoUrl = "";
    if (typeof output === "string") videoUrl = output;
    else if (Array.isArray(output)) videoUrl = output[0];
    else if (output && typeof output.url === "string") videoUrl = output.url;

    if (!videoUrl) {
      throw new Error("Seedance 2.0 (Replicate) returned no video URL.");
    }

    const videoBase64 = await fetchAsBase64(videoUrl);

    return res.status(200).json({
      videoBase64,
      videoUrl,
      meta: {
        model: "seedance-2.0-standard",
        duration: payload.duration,
        aspect_ratio: payload.aspect_ratio,
        used_i2v: hasStartFrame,
      },
    });
  } catch (err: any) {
    const status = err?.status || 500;
    const details = err?.body || err?.response?.data;
    console.error("Seedance 2.0 Standard route error:", {
      status,
      details,
      message: err.message,
    });

    return res.status(status).json({
      error:
        details?.detail || err?.message || "Seedance 2.0 generation failed.",
      details,
    });
  }
}

// bytedance/omni-human-1.5 â€” film-grade digital human, audio-driven lip-sync.
// image (the scene's first frame) + audio (trimmed lip-sync clip) + optional prompt.
export async function omniHuman(req: any, res: any) {
  try {
    const {
      prompt,
      startImage: imageUrl,
      lipSyncUrl,
      asyncMode,
      seed,
      fast_mode,
    } = req.body ?? {};

    const image = typeof imageUrl === "string" ? imageUrl.trim() : "";
    const audio = typeof lipSyncUrl === "string" ? lipSyncUrl.trim() : "";

    if (!image) {
      return res
        .status(400)
        .json({ error: "OmniHuman requires an image (startImage)." });
    }
    if (!audio) {
      return res
        .status(400)
        .json({ error: "OmniHuman requires an audio clip (lipSyncUrl)." });
    }

    const textPrompt = typeof prompt === "string" ? prompt.trim() : "";

    const payload: Record<string, any> = {
      image,
      audio,
      // Quality over speed (fast_mode sacrifices some effects).
      fast_mode: typeof fast_mode === "boolean" ? fast_mode : false,
    };
    if (textPrompt) payload.prompt = textPrompt;
    if (Number.isFinite(Number(seed))) payload.seed = Number(seed);

    const modelId = "bytedance/omni-human-1.5";
    console.log(
      `[OmniHuman 1.5] Calling ${modelId} (fast_mode: ${payload.fast_mode}, hasPrompt: ${!!textPrompt})`
    );

    const rep = new Replicate({
      auth: process.env.REPLI_KEY || process.env.REPLICATE_API_TOKEN,
    });

    if (asyncMode) {
      const prediction = await rep.predictions.create({
        model: modelId as any,
        input: payload,
      });
      return res.status(200).json({
        status: "starting",
        jobId: prediction.id,
        provider: "replicate",
        modelEndpoint: modelId,
        meta: { model: "omni-human-1.5" },
      });
    }

    const output: any = await rep.run(modelId as any, { input: payload });

    let videoUrl = "";
    if (typeof output === "string") videoUrl = output;
    else if (Array.isArray(output)) videoUrl = output[0];
    else if (output && typeof output.url === "string") videoUrl = output.url;

    if (!videoUrl) {
      throw new Error("OmniHuman returned no video URL.");
    }

    const videoBase64 = await fetchAsBase64(videoUrl);

    return res.status(200).json({
      videoBase64,
      videoUrl,
      meta: { model: "omni-human-1.5" },
    });
  } catch (err: any) {
    const status = err?.status || 500;
    const details = err?.body || err?.response?.data;
    console.error("OmniHuman route error:", {
      status,
      details,
      message: err.message,
    });

    return res.status(status).json({
      error: details?.detail || err?.message || "OmniHuman generation failed.",
      details,
    });
  }
}

export async function RouteWAN26(req: any, res: any) {
  try {
    /* ------------------------------------------------------------------ */
    /* 1) Extract user-supplied fields                                    */
    /* ------------------------------------------------------------------ */
    const {
      prompt,
      inputs,
      startImage,
      videoLength,
      resolution: reqResolution,
      negative_prompt,
      seed,
      ty, // <--- 1. Get 'ty' for T2V aspect ratio
      enable_prompt_expansion = true,
      multi_shots = false,
      enable_safety_checker = true,
      audio_url,
      musicKling,
    } = req.body ?? {};

    const textPrompt = (typeof prompt === "string"
      ? prompt
      : typeof inputs === "string"
      ? inputs
      : ""
    ).trim();

    if (!textPrompt) {
      return res
        .status(400)
        .json({ error: "Missing 'prompt' (or 'inputs') string" });
    }

    // --- REMOVED STRICT startImage CHECK ---

    if (startImage && startImage.startsWith("blob:")) {
      return res.status(400).json({
        error:
          "startImage is a blob: URL. Send a public https:// URL or a data:image/...;base64,... URI.",
      });
    }

    /* ------------------------------------------------------------------ */
    /* 2) Normalize fields                                                */
    /* ------------------------------------------------------------------ */
    const duration: "5" | "10" | "15" =
      Number(videoLength) === 15
        ? "15"
        : Number(videoLength) === 10
        ? "10"
        : "5";

    // 3. Determine Mode (T2V vs I2V)
    const hasImage =
      startImage &&
      typeof startImage === "string" &&
      startImage.trim().length > 0;

    // Select the correct model endpoint
    const modelEndpoint = hasImage
      ? "wan/v2.6/image-to-video"
      : "wan/v2.6/text-to-video";

    const wanInput: Record<string, any> = {
      prompt: textPrompt.slice(0, 800),
      // resolution is often implicit in T2V via aspect_ratio, but we can pass it if the model accepts it
      // For I2V it preserves aspect ratio of image usually.
      // We'll keep passing it as your previous code did.
      resolution:
        String(reqResolution || "").toLowerCase() === "1080p"
          ? "1080p"
          : "720p",
      duration,
      negative_prompt:
        typeof negative_prompt === "string"
          ? negative_prompt.slice(0, 500)
          : "",
      enable_prompt_expansion: !!enable_prompt_expansion,
      enable_safety_checker: !!enable_safety_checker,
    };

    // 4. Configure based on mode
    if (hasImage) {
      // --- IMAGE TO VIDEO SETUP ---
      let image_url = startImage.trim();

      // Handle data URIs upload
      if (isDataImageUri(image_url)) {
        const base64 = image_url.split(",")[1];
        const bytes = Buffer.from(base64, "base64");
        const blob = new Blob([bytes], { type: "image/png" });
        image_url = await fal.storage.upload(blob);
      } else if (!isHttpUrl(image_url)) {
        return res.status(400).json({
          error:
            "startImage must be a public http(s) URL OR data:image/...;base64,...",
        });
      }

      wanInput.image_url = image_url;
    } else {
      // --- TEXT TO VIDEO SETUP ---
      // Map 'ty' to aspect ratio string
      // 1=9:16, 2=1:1, 3=16:9
      const aspect_ratio =
        ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "9:16";

      wanInput.aspect_ratio = aspect_ratio;
    }

    // Optional audio handling
    let finalAudioUrl: string | undefined = undefined;
    if (
      musicKling !== false &&
      typeof audio_url === "string" &&
      audio_url.trim()
    ) {
      const a = audio_url.trim();
      if (isDataAudioUri(a)) {
        const base64 = a.split(",")[1];
        const bytes = Buffer.from(base64, "base64");
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        finalAudioUrl = await fal.storage.upload(blob);
      } else if (isHttpUrl(a)) {
        finalAudioUrl = a;
      } else {
        return res.status(400).json({
          error:
            "audio_url must be a public http(s) URL (or a data:audio/... base64 URI).",
        });
      }
    }

    if (wanInput.enable_prompt_expansion) {
      wanInput.multi_shots = !!multi_shots;
    }

    if (typeof seed === "number") wanInput.seed = seed;
    if (finalAudioUrl) wanInput.audio_url = finalAudioUrl;

    /* ------------------------------------------------------------------ */
    /* 3) Call WAN v2.6 on fal                                            */
    /* ------------------------------------------------------------------ */
    console.log(
      `[WAN2.6] Calling ${modelEndpoint} with ty=${ty}, hasImage=${hasImage}`
    );

    const result = await fal.subscribe(modelEndpoint, {
      input: wanInput,
      logs: true,
      onQueueUpdate: (u) => {
        if (u.status === "IN_PROGRESS") {
          u.logs?.forEach((l: any) => console.log("[wan2.6]", l.message));
        }
      },
    });

    const videoUrl = result?.data?.video?.url;
    if (!videoUrl) {
      throw new Error("WAN 2.6 returned no video url");
    }

    /* ------------------------------------------------------------------ */
    /* 4) Fetch MP4 + return base64                                       */
    /* ------------------------------------------------------------------ */
    const vidResp = await fetch(videoUrl);
    if (!vidResp.ok) {
      throw new Error(
        `Fetch final video failed: ${vidResp.status} â€“ ${await vidResp.text()}`
      );
    }

    const buffer = Buffer.from(await vidResp.arrayBuffer());
    const videoBase64 = `data:video/mp4;base64,${buffer.toString("base64")}`;

    // Metadata for frontend
    const metaAspectRatio = hasImage
      ? "match_input"
      : ty === 1
      ? "9:16"
      : ty === 2
      ? "1:1"
      : ty === 3
      ? "16:9"
      : "9:16";

    return res.status(200).json({
      videoBase64,
      meta: {
        duration: Number(duration),
        fps: 24,
        resolution: wanInput.resolution, // Pass back what we requested
        used_i2v: hasImage,
        model: modelEndpoint,
        aspect_ratio: metaAspectRatio,
        seed: result?.data?.seed,
        actual_prompt: result?.data?.actual_prompt,
      },
    });
  } catch (err: any) {
    const status = err?.status || err?.response?.status || 500;
    const details = err?.body || err?.response?.data;

    console.error("Error in klingProRoute (WAN):", { status, details, err });

    return res.status(status).json({
      error: details?.detail || err?.message || "WAN 2.6 generation failed.",
      details,
    });
  }
}
export async function klingProRouteLite(req: any, res: any) {
  try {
    /* ------------------------------------------------------------------ */
    /* 1)  Extract user-supplied fields                                    */
    /* ------------------------------------------------------------------ */
    const { prompt, startImage, videoLength, ty, model } = req.body; // startImage = URL | data-URI
    console.log("Seedance prompt:", prompt, "startImage?", !!startImage);

    /* ------------------------------------------------------------------ */
    /* 2)  Build request for Replicate                                     */
    /*      Model path: bytedance/seedance-1-lite                          */
    /* ------------------------------------------------------------------ */
    const replicateUrl =
      "https://api.replicate.com/v1/models/bytedance/seedance-1-lite/predictions";

    const replicateInput: Record<string, any> = {
      prompt,
      // Seedance duration must be 5 or 10 seconds
      duration: [5, 10].includes(Number(videoLength)) ? Number(videoLength) : 5,
      aspect_ratio:
        model === "Gpt Image"
          ? ty === 1
            ? "3:4"
            : ty === 2
            ? "1:1"
            : ty === 3
            ? "4:3"
            : "3:4"
          : ///////////////  cut//////////////
          ty === 1
          ? "9:16"
          : ty === 2
          ? "1:1"
          : ty === 3
          ? "16:9"
          : "9:16",
    };

    // Optional extras
    if (startImage) replicateInput.image = startImage; // image-to-video

    // replicateInput.aspect_ratio = "16:9";                // override defaults as needed seedream
    replicateInput.resolution = "720p"; // 480p | 720p
    // replicateInput.fps          = 24;                    // fixed at 24 for now
    // replicateInput.seed         = 1234;                  // reproducible runs
    // replicateInput.camera_fixed = false;                 // keep / move camera

    /* ------------------------------------------------------------------ */
    /* 3)  Kick off prediction                                             */
    /* ------------------------------------------------------------------ */
    const postResponse = await fetch(replicateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${process.env.REPLI_KEY}`,
      },
      body: JSON.stringify({ input: replicateInput }),
    });

    if (!postResponse.ok) {
      const text = await postResponse.text();
      console.error("Seedance POST error:", text);
      return res.status(502).json({ error: text });
    }

    const {
      id: predictionId,
      status: initialStatus,
    } = await postResponse.json();
    console.log(`Seedance prediction ID: ${predictionId}`);

    /* ------------------------------------------------------------------ */
    /* 4)  Poll until finished (or bail on error)                          */
    /* ------------------------------------------------------------------ */
    let status = initialStatus;
    let videoUrl: string | null = null;

    while (status === "starting" || status === "processing") {
      await new Promise((r) => setTimeout(r, 3000));

      const poll = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            Authorization: `Token ${process.env.REPLI_KEY}`,
          },
        }
      );

      if (!poll.ok) {
        const err = await poll.text();
        console.error("Seedance poll error:", err);
        return res.status(502).json({ error: err });
      }

      const pollData = await poll.json();
      status = pollData.status;
      if (status === "succeeded") videoUrl = pollData.output as string;
      if (status === "failed" || status === "canceled") {
        console.error("Seedance failed/canceled:", pollData);
        return res
          .status(500)
          .json({ error: "Seedance failed/canceled", detail: pollData });
      }
    }

    /* ------------------------------------------------------------------ */
    /* 5)  Retrieve the finished MP4 & relay to caller                     */
    /* ------------------------------------------------------------------ */
    if (!videoUrl) {
      return res
        .status(500)
        .json({ error: "Seedance finished with no video URL" });
    }

    const vidResp = await fetch(videoUrl);
    if (!vidResp.ok) {
      const err = await vidResp.text();
      console.error("Fetch final video error:", err);
      return res.status(502).json({ error: err });
    }

    const buffer = Buffer.from(await vidResp.arrayBuffer());
    const videoBase64 = `data:video/mp4;base64,${buffer.toString("base64")}`;
    return res.status(200).json({ videoBase64 });
  } catch (err: any) {
    console.error("Error in seedanceRoute:", err);
    return res.status(500).json({ error: err.message });
  }
}

// src/routes/fluxSchnellRoute.js
// A lightweight Express/NextÂ API handler for the **black-forest-labs/flux-schnell** model
// Assumes `REPLICATE_API_TOKEN` is set in your environment (.env, CI secret, etc.)
// This version drops *all* imageâ€‘prompt logic and width/height handling.

const replicate = new Replicate({
  auth: process.env.REPLI_KEY, // keep your token in .env
});

/* ---------- helpers --------------------------------------------------- */
function isAsyncIterable(obj: any): obj is AsyncIterable<Uint8Array> {
  return obj && typeof obj[Symbol.asyncIterator] === "function";
}

export async function fluxDevRoutem(req: any, res: any) {
  try {
    // 1) Read data from req.body (with default width & height)
    const {
      inputs,
      image,
      guidance,
      width,
      height,
      num_inference_steps,
      ty,
    } = req.body;

    console.log("Received prompt:", inputs);
    console.log("Received optional image:", image ? "Yes" : "No");
    console.log("Using width:", width, "height:", height);

    // 2) Build the input object for Replicate
    // Check the model docs to confirm it accepts `width` and `height`
    const replicateInput: Record<string, any> = {
      prompt: inputs,
      guidance,
      aspect_ratio:
        ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "9:16",
      num_inference_steps,
      seed: 100,
    };

    const replicateInput2: Record<string, any> = {
      prompt: inputs,
      guidance,
      image,
      prompt_strength: 0.92,
      num_inference_steps,
      seed: Math.floor(Math.random() * 10000), // random seed each time
    };

    // 3) Make the initial POST to create the prediction
    const postResponse = await fetch(
      `https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions`,

      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.REPLI_KEY}`,
          Prefer: "wait", // optional; if you want a single call that waits until done seedream
        },
        body: JSON.stringify({
          input: image ? replicateInput2 : replicateInput,
        }),
      }
    );

    if (!postResponse.ok) {
      const text = await postResponse.text();
      console.error("Replicate initial POST NOT OK:", text);
      throw new Error(`Replicate error: ${postResponse.status} - ${text}`);
    }

    const postData = await postResponse.json();
    let status = postData.status;
    const predictionId = postData.id;

    // 4) Poll until "succeeded" or "failed"
    while (status === "starting" || status === "processing") {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const pollResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.REPLI_KEY}`,
          },
        }
      );

      if (!pollResponse.ok) {
        const pollErr = await pollResponse.text();
        console.error("Replicate poll NOT OK:", pollErr);
        throw new Error(
          `Replicate poll error: ${pollResponse.status} - ${pollErr}`
        );
      }

      const pollData = await pollResponse.json();
      status = pollData.status;

      if (status === "succeeded") {
        // 5) Get the final image
        const outputUrl = pollData.output[0];
        console.log("Output URL:", outputUrl);

        const finalImageResponse = await fetch(outputUrl);
        if (!finalImageResponse.ok) {
          const finalErr = await finalImageResponse.text();
          throw new Error(
            `Failed to fetch final image: ${finalImageResponse.status} - ${finalErr}`
          );
        }

        // Convert final image to base64
        const finalImageBlob = await finalImageResponse.blob();
        const arrayBuffer = await finalImageBlob.arrayBuffer();
        const base64Encoded = Buffer.from(arrayBuffer).toString("base64");
        const imageBase64 = `data:image/png;base64,${base64Encoded}`;

        // Send to client
        return res.status(200).json({ imageBase64 });
      } else if (status === "failed" || status === "canceled") {
        console.error("Prediction failed or canceled");
        return res
          .status(500)
          .json({ error: "Prediction failed or canceled", detail: pollData });
      }
    }

    // If we somehow exit the loop, return an error
    return res
      .status(500)
      .json({ error: "Unexpected status after polling", status });
  } catch (err) {
    console.error("Error in fluxSchnellRoute:", err);
    return res.status(500).json({ error: (err as Error).message });
  }
}

/* ---------- main route ------------------------------------------------ */

export async function fluxUltraKRe(req: any, res: any) {
  console.log("âž¡ï¸  fluxUltra called");
  try {
    /* ------------------------------------------------------------------ */
    /* 0) Extract & validate   gpt                                            */
    /* ------------------------------------------------------------------ */
    const {
      inputs,
      seed,
      ty,
      guidance = 4.5,
      output_quality = 80,
      num_inference_steps = 28,
      num_outputs = 1,
    } = req.body;

    console.log("ðŸ“  Raw body:", req.body);
    if (!inputs || typeof inputs !== "string" || !inputs.trim()) {
      console.error("âŒ  Missing or empty 'inputs' prompt");
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }

    /* ------------------------------------------------------------------ */
    /* 1) Build input payload                                             */
    /* ------------------------------------------------------------------ */
    const replicateInput = {
      prompt: inputs.trim(),
      seed,
      guidance,
      output_quality,
      num_inference_steps,
      num_outputs,
      aspect_ratio:
        ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "1:1",
      go_fast: true,
      output_format: req.body?.Png ? "png" : "jpg",
    };
    console.log("ðŸ“¦  replicateInput:", replicateInput);

    /* ------------------------------------------------------------------ */
    /* 2) Run prediction                                                  */
    /* ------------------------------------------------------------------ */
    console.log("ðŸš€  Calling replicate.run...");
    const output = await replicate.run("black-forest-labs/flux-krea-dev", {
      input: replicateInput,
    });
    console.log("âœ…  replicate.run returned:", output);

    /* ------------------------------------------------------------------ */
    /* 3) Detect & drain any ReadableStream                              */
    /* ------------------------------------------------------------------ */
    let imgBuf: Buffer | null = null;

    // case A: an Array whose first element is a Readable stream
    if (
      Array.isArray(output) &&
      output.length > 0 &&
      output[0] instanceof Readable
    ) {
      console.log("ðŸ–¼ï¸  Received Readable stream in array â€“ drainingâ€¦");
      const chunks: Buffer[] = [];
      for await (const chunk of output[0]) {
        chunks.push(Buffer.from(chunk));
      }
      imgBuf = Buffer.concat(chunks);
    }
    // case B: a standalone Readable
    else if (output instanceof Readable) {
      console.log("ðŸ–¼ï¸  Received standalone Readable â€“ drainingâ€¦");
      const chunks: Buffer[] = [];
      for await (const chunk of output) {
        chunks.push(Buffer.from(chunk));
      }
      imgBuf = Buffer.concat(chunks);
    }
    // case C: a Buffer
    else if (Buffer.isBuffer(output)) {
      console.log("ðŸ–¼ï¸  Received Buffer directly");
      imgBuf = output;
    }

    if (imgBuf) {
      console.log("ðŸ“¥  Drained â€“", imgBuf.length, "bytes");
      const imageBase64 = `data:image/jpeg;base64,${imgBuf.toString("base64")}`;
      return res.status(200).json({ imageBase64 });
    }

    /* ------------------------------------------------------------------ */
    /* 4) Fallback: URL or data-uri handling                              */
    /* ------------------------------------------------------------------ */
    const outputUrl =
      typeof output === "string"
        ? output
        : Array.isArray(output) && output.length
        ? output[0]
        : null;

    console.log("ðŸ”—  Resolved outputUrl:", outputUrl);
    if (!outputUrl) {
      console.error("âŒ  No image output received from Flux Krea");
      return res
        .status(500)
        .json({ error: "No image output received from Flux Krea." });
    }

    if (typeof outputUrl === "string" && outputUrl.startsWith("data:")) {
      console.log("ðŸ–¼ï¸  Output already data URI â€“ returning.");
      return res.status(200).json({ imageBase64: outputUrl });
    }

    /* ------------------------------------------------------------------ */
    /* 5) Fetch external image                                            */
    /* ------------------------------------------------------------------ */
    console.log("ðŸŒ  Fetching image from:", outputUrl);
    const imgResp = await fetch(outputUrl as string);
    console.log("ðŸŒ  Fetch status:", imgResp.status);
    if (!imgResp.ok) {
      const errTxt = await imgResp.text();
      console.error("âŒ  Image fetch failed:", imgResp.status, errTxt);
      throw new Error(`Image fetch failed: ${imgResp.status} â€“ ${errTxt}`);
    }

    const buf = Buffer.from(await imgResp.arrayBuffer());
    console.log("ðŸ“¥  Image downloaded â€“", buf.length, "bytes");
    const imageBase64 = `data:image/jpeg;base64,${buf.toString("base64")}`;
    console.log("âœ…  Returning base64 image (length:", imageBase64.length, ")");

    return res.status(200).json({ imageBase64 });
  } catch (err: any) {
    console.error("ðŸ’¥  Error in fluxUltra:", err);
    return res.status(500).json({ error: err.message });
  }
}

/** Convert Replicate FileOutput / URL / data URI into a Buffer */
async function fileOutputToBuffer(item: any): Promise<Buffer> {
  if (!item) throw new Error("Empty output item");

  // New FileOutput supports arrayBuffer()
  if (typeof item === "object" && typeof item.arrayBuffer === "function") {
    const ab = await item.arrayBuffer();
    return Buffer.from(ab);
  }

  // Some environments expose blob()
  if (typeof item === "object" && typeof item.blob === "function") {
    const blob = await item.blob();
    return Buffer.from(await blob.arrayBuffer());
  }

  // Resolve to URL, then fetch
  if (typeof item === "object" && typeof item.url === "function") {
    const url = item.url();
    const resp = await fetch(url);
    if (!resp.ok)
      throw new Error(
        `Image fetch failed: ${resp.status} â€“ ${await resp.text()}`
      );
    return Buffer.from(await resp.arrayBuffer());
  }

  // Plain string: data URI or URL
  if (typeof item === "string") {
    if (item.startsWith("data:")) {
      const [, b64] = item.split(",");
      if (!b64) throw new Error("Malformed data URI");
      return Buffer.from(b64, "base64");
    }
    const resp = await fetch(item);
    if (!resp.ok)
      throw new Error(
        `Image fetch failed: ${resp.status} â€“ ${await resp.text()}`
      );
    return Buffer.from(await resp.arrayBuffer());
  }

  if (Buffer.isBuffer(item)) return item;

  throw new Error("Unsupported output type from Replicate");
}

/** ty â†’ aspect ratio */
function tyToAspect(
  ty?: number,
  fallback: "1:1" | "16:9" | "9:16" = "1:1"
): "1:1" | "16:9" | "9:16" {
  return ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : fallback;
}

export async function fluxUltra2(req: any, res: any) {
  try {
    const {
      inputs, // required prompt text
      outputFormat = "png", // "jpg" | "png" | "webp"
      ty, // aspect ratio selector
      sampleImage, // legacy/singular
      sampleImages, // new plural
      imageInputs, // alias
      sampleimagesnames, // Active character mapping
      resolution, // "1K" | "2K" | "4K"
    } = req.body || {};

    if (!inputs || typeof inputs !== "string" || !inputs.trim()) {
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }

    // ---------- build image array ----------
    let image_input: string[] = [];

    if (Array.isArray(sampleImages)) {
      image_input = sampleImages.filter(Boolean).slice(0, 8);
    } else if (Array.isArray(imageInputs)) {
      image_input = imageInputs.filter(Boolean);
    } else if (Array.isArray(sampleImage)) {
      image_input = sampleImage.filter(Boolean);
    } else if (typeof sampleImage === "string" && sampleImage.trim()) {
      image_input = [sampleImage.trim()];
    }

    if (image_input.length === 0) {
      // ==========================================
      // BRANCH A: No Reference Images (ImagenRoute2 code)
      // ==========================================

      // Map 'ty' to aspect ratios supported by fal-ai/nano-banana-pro
      const aspectRatio =
        ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "9:16";

      // Fal expects "jpeg" instead of "jpg"
      const validOutputFormat = outputFormat === "jpg" ? "jpeg" : outputFormat;

      const falInput = {
        prompt: inputs.trim(),
        output_format: req.body?.Png ? validOutputFormat : "jpeg",
        aspect_ratio: aspectRatio,
        resolution: "2K", // Defaulting to 4K for better quality
        num_images: 1,
        safety_tolerance: "6",
      };

      logPayloadSafely("fal-ai/nano-banana-pro", falInput);
      const result: any = await fal.subscribe("fal-ai/nano-banana-pro", {
        input: falInput as any,
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            update.logs.map((log: any) => log.message).forEach(console.log);
          }
        },
      });

      if (
        !result.data ||
        !result.data.images ||
        result.data.images.length === 0
      ) {
        throw new Error("No output returned from Fal.ai");
      }

      const fileOutput = result.data.images[0];
      const resp = await fetch(fileOutput.url);
      if (!resp.ok) {
        throw new Error(
          `Image fetch failed: ${resp.status} â€“ ${await resp.text()}`
        );
      }

      const buf = Buffer.from(await resp.arrayBuffer());
      const imageBase64 = `data:image/${outputFormat};base64,${buf.toString(
        "base64"
      )}`;

      return res.status(200).json({ imageBase64 });
    } else {
      // ==========================================
      // BRANCH B: Has Reference Images (BanannaRoute2 code)
      // ==========================================

      type AspectRatio =
        | "auto"
        | "21:9"
        | "16:9"
        | "3:2"
        | "4:3"
        | "5:4"
        | "1:1"
        | "4:5"
        | "3:4"
        | "2:3"
        | "9:16";
      type OutputFormat = "jpeg" | "png" | "webp";
      type Resolution = "1K" | "2K" | "4K";

      const finalAspectRatio: AspectRatio = tyToAspect(ty, "9:16");

      const normalizedFormat =
        outputFormat === "jpg" ? "jpeg" : String(outputFormat || "png");
      const allowedFormats: OutputFormat[] = ["jpeg", "png", "webp"];
      const validOutputFormat: OutputFormat = allowedFormats.includes(
        normalizedFormat as OutputFormat
      )
        ? (normalizedFormat as OutputFormat)
        : "png";

      const normalizedRes = String(resolution || "2K");
      const allowedRes: Resolution[] = ["1K", "2K", "4K"];
      const finalResolution: Resolution = allowedRes.includes(
        normalizedRes as Resolution
      )
        ? (normalizedRes as Resolution) : "2K";

      // --- ANTIGRAVITY ENGINE: Conversational Positional Injection ---
      const updatedInputs = injectConversational(
        inputs,
        image_input,
        sampleimagesnames || []
      );

      const falInput: any = {
        prompt: updatedInputs.trim(),
        image_urls: image_input,
        output_format: req.body?.Png ? validOutputFormat : "jpeg",
        aspect_ratio: finalAspectRatio,
        resolution: finalResolution,
        safety_tolerance: "6",
      };

      logPayloadSafely("fal-ai/nano-banana-pro/edit", falInput);
      const result: any = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
        input: falInput as any,
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            update.logs.map((log: any) => log.message).forEach(console.log);
          }
        },
      });

      if (!result?.data?.images || result.data.images.length === 0) {
        throw new Error("No output returned from Fal.ai");
      }

      const fileOutput = result.data.images[0];
      const fileResponse = await fetch(fileOutput.url);

      if (!fileResponse.ok) {
        throw new Error(
          `Failed to fetch output image: ${fileResponse.statusText}`
        );
      }

      const buf = Buffer.from(await fileResponse.arrayBuffer());

      const mime = req.body?.Png ? (typeof validOutputFormat !== "undefined" ? validOutputFormat : "png") : "jpeg";
      const imageBase64 = `data:image/${mime};base64,${buf.toString("base64")}`;
      return res.status(200).json({ imageBase64 });
    }
  } catch (err: any) {
    console.error("Error in fluxUltra2 (hijacked NanoBananaPro):", err);
    return res.status(err?.response?.status || err?.status || 500).json({
      error: err?.message || "Unknown error",
      details: err?.response?.data || err?.body || undefined,
    });
  }
}

export async function fluxUltra(req: any, res: any) {
  try {
    const {
      inputs, // required prompt
      ty, // 1=9:16, 2=1:1, 3=16:9
      seed,

      // FLUX.2 [max] schema fields
      resolution = "4 MP", // e.g. "0.5 MP" | "1 MP" | "2 MP" | "4 MP" (per docs)
      safety_tolerance = 2, // 1..5
      output_format = req.body?.Png ? "png" : "jpg", // "webp" | "png" | "jpeg"
      output_quality = 80, // 0..100 (ignored for png)

      // img2img / multi-reference
      input_images, // string[] (urls or data uris)
      image, // (optional) keep compat with your old param: single url/data-uri
      sampleImage, // (optional compat) string|string[]
      sampleImages, // plural
      imageInputs, // (optional compat) string[]
      sampleimagesnames, // active character mapping


      // your existing return header choice
      // outputFormat = "png", // only used for data URL mime header
    } = req.body || {};

    if (!inputs || typeof inputs !== "string" || !inputs.trim()) {
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }

    // Build reference images (max 10 as per explicit requirement for PRO/Flex)
    let tempRefs: string[] = [];
    if (Array.isArray(sampleImages)) tempRefs = sampleImages.filter(Boolean);
    else if (Array.isArray(input_images))
      tempRefs = input_images.filter(Boolean);
    else if (Array.isArray(imageInputs)) tempRefs = imageInputs.filter(Boolean);
    else if (Array.isArray(sampleImage)) tempRefs = sampleImage.filter(Boolean);
    else if (typeof image === "string" && image.trim())
      tempRefs = [image.trim()];
    else if (typeof sampleImage === "string" && sampleImage.trim())
      tempRefs = [sampleImage.trim()];

    const refs = tempRefs.slice(0, 8);

    // --- ANTIGRAVITY ENGINE: FLUX.2 Subject Parsing ---
    const updatedInputs = injectFlux2(inputs, refs, sampleimagesnames || []);

    // `ty` is authoritative for every Flux Max request.
    const aspect_ratio = tyToAspect(ty, "1:1");

    const replicateInput: Record<string, unknown> = {
      prompt: updatedInputs.trim(),
      seed,
      resolution,
      aspect_ratio,
      input_images: refs,
      output_format,
      output_quality,
      safety_tolerance,
    };


    const output: any = await replicate.run("black-forest-labs/flux-2-max", {
      input: replicateInput,
    });

    // flux-2-max returns a single file (NOT array)
    const buf = await fileOutputToBuffer(output);

    // Data URL mime header (your choice, independent of replicate output_format)
    const mime = req.body?.Png ? "png" : "jpeg";
    const imageBase64 = `data:image/${mime};base64,${buf.toString("base64")}`;
    return res.status(200).json({ imageBase64 });
  } catch (err: any) {
    console.error("Error in flux2Max:", err);
    return res.status(err?.response?.status || err?.status || 500).json({
      error: err?.message || "Unknown error",
      details: err?.response?.data || err?.body || undefined,
    });
  }
}

export async function fluxUltrax(req: any, res: any) {
  console.log("âž¡ï¸  fluxUltra called");
  try {
    /* ------------------------------------------------------------------ */
    /* 0) Extract & validate                                              */
    /* ------------------------------------------------------------------ */
    const {
      inputs,
      seed,
      ty,
      width,
      height,
      guidance,
      num_inference_steps,
    } = req.body;
    console.log("ðŸ“  Raw body:", req.body);

    if (!inputs || typeof inputs !== "string" || !inputs.trim()) {
      console.error("âŒ  Missing or empty 'inputs' prompt");
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }

    /* ------------------------------------------------------------------ */
    /* 1) Build input payload                                             */
    /* ------------------------------------------------------------------ */
    const replicateInput: Record<string, any> = {
      prompt: inputs.trim(),
      aspect_ratio:
        ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "9:16",
      output_format: req.body?.Png ? "png" : "jpg",
      seed,
      width,
      height,
      guidance,
      num_inference_steps,
    };
    console.log("ðŸ“¦  replicateInput:", replicateInput);

    /* ------------------------------------------------------------------ */
    /* 2) Run prediction                                                  */
    /* ------------------------------------------------------------------ */
    console.log("ðŸš€  Calling replicate.run...");
    const output: unknown = await replicate.run(
      "black-forest-labs/flux-1.1-pro-ultra",
      { input: replicateInput }
    );
    console.log("âœ…  replicate.run returned:", output);

    /* ------------------------------------------------------------------ */
    /* 3) Stream or Buffer handling nano                                       */
    /* ------------------------------------------------------------------ */
    if (output instanceof Readable) {
      console.log("ðŸ–¼ï¸  Received Node Readable stream â€“ drainingâ€¦");
      const chunks: Buffer[] = [];
      for await (const chunk of output) chunks.push(Buffer.from(chunk));
      const jpgBuf = Buffer.concat(chunks);
      console.log("ðŸ“¥  Stream drained â€“", jpgBuf.length, "bytes");
      const imageBase64 = `data:image/jpeg;base64,${jpgBuf.toString("base64")}`;
      return res.status(200).json({ imageBase64 });
    }

    if (isAsyncIterable(output)) {
      console.log("ðŸ–¼ï¸  Received async-iterable stream â€“ drainingâ€¦");
      const chunks: Buffer[] = [];
      for await (const chunk of output) chunks.push(Buffer.from(chunk));
      const jpgBuf = Buffer.concat(chunks);
      console.log("ðŸ“¥  Stream drained â€“", jpgBuf.length, "bytes");
      const imageBase64 = `data:image/jpeg;base64,${jpgBuf.toString("base64")}`;
      return res.status(200).json({ imageBase64 });
    }

    if (Buffer.isBuffer(output)) {
      console.log("ðŸ–¼ï¸  Received Buffer");
      const imageBase64 = `data:image/jpeg;base64,${output.toString("base64")}`;
      return res.status(200).json({ imageBase64 });
    }

    /* ------------------------------------------------------------------ */
    /* 4) String / URL handling                                           */
    /* ------------------------------------------------------------------ */
    const outputUrl =
      typeof output === "string"
        ? output
        : Array.isArray(output) && output.length
        ? output[0]
        : null;

    console.log("ðŸ”—  Resolved outputUrl:", outputUrl);

    if (!outputUrl) {
      console.error("âŒ  No image output received from Flux Pro Ultra");
      return res
        .status(500)
        .json({ error: "No image output received from Flux Pro Ultra." });
    }

    if (outputUrl.startsWith("data:")) {
      console.log("ðŸ–¼ï¸  Output already data URI â€“ returning.");
      return res.status(200).json({ imageBase64: outputUrl });
    }

    /* ------------------------------------------------------------------ */
    /* 5) Fetch external image                                            */
    /* ------------------------------------------------------------------ */
    console.log("ðŸŒ  Fetching image from:", outputUrl);
    const imgResp = await fetch(outputUrl);
    console.log("ðŸŒ  Fetch status:", imgResp.status);

    if (!imgResp.ok) {
      const errTxt = await imgResp.text();
      console.error("âŒ  Image fetch failed:", imgResp.status, errTxt);
      throw new Error(`Image fetch failed: ${imgResp.status} â€“ ${errTxt}`);
    }

    const buf = Buffer.from(await imgResp.arrayBuffer());
    console.log("ðŸ“¥  Image downloaded â€“", buf.length, "bytes");

    const mime = req.body?.Png ? "png" : "jpeg";
    const imageBase64 = `data:image/${mime};base64,${buf.toString("base64")}`;
    console.log("âœ…  Returning base64 image (length:", imageBase64.length, ")");

    return res.status(200).json({ imageBase64 });
  } catch (err: any) {
    console.error("ðŸ’¥  Error in fluxUltra:", err);
    return res.status(500).json({ error: err.message });
  }
}

// ðŸ” retry config
const MAX_TRIES = 10;

// âœ… wait range: 7â€“13 seconds
const WAIT_MIN_MS = 10_000;
const WAIT_MAX_MS = 20_000;

const GLOBAL_MAX = 1;

// @ts-ignore
globalThis.__replicateLimiter = globalThis.__replicateLimiter || {
  running: 0,
  waiters: [] as Array<() => void>,
};
// @ts-ignore
const limiter = globalThis.__replicateLimiter as {
  running: number;
  waiters: Array<() => void>;
};

const withGlobalSlot = async <T>(fn: () => Promise<T>): Promise<T> => {
  if (limiter.running >= GLOBAL_MAX) {
    await new Promise<void>((resolve) => limiter.waiters.push(resolve));
  }
  limiter.running++;
  try {
    return await fn();
  } finally {
    limiter.running--;
    const next = limiter.waiters.shift();
    if (next) next();
  }
};

export async function fluxschnellRoutex(req: any, res: any) {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const randInt = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;
  const getWaitMs = () => randInt(WAIT_MIN_MS, WAIT_MAX_MS);

  const errMsg = (e: any) => (e?.message ? String(e.message) : String(e));

  /**
   * âœ… GLOBAL QUEUE / CONCURRENCY LIMITER
   * This makes "50 users at once" become a line.
   * Set GLOBAL_MAX = 1 for the scenario you described.
   */
  // IMPORTANT: these must live outside the function in real code
  // If you paste this into a module, move them to top-level scope.
  // I'm keeping them here for copy-paste clarity:

  try {
    const { inputs, seed, ty, sampleImages } = req.body;

    if (!inputs || typeof inputs !== "string" || !inputs.trim()) {
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }

    console.log("Aspect Ratio Type:", ty);

    // --- Parse Images for Character References ---
    let imagesConfig: string[] = [];
    if (Array.isArray(sampleImages)) {
      // Replicate's flux-2-klein-4b ONLY supports exactly up to 5 images max
      imagesConfig = sampleImages.filter(Boolean).slice(0, 5);
      console.log(
        `[fluxschnell] Character references attached: ${imagesConfig.length}`
      );
    }

    const aspectRatio =
      ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "9:16";

    const replicateInput: any = {
      prompt: inputs,
      aspect_ratio: aspectRatio,
      num_outputs: 1,
      output_format: req.body?.Png ? "png" : "jpg",
      output_quality: 80,
      go_fast: true,
      seed: seed ? Number(seed) : undefined,
    };

    // Attach valid character reference multi-payload array if present
    if (imagesConfig.length > 0) {
      replicateInput.images = imagesConfig;
    }

    let lastErr: any = null;

    // âœ… Each request waits for a global slot so we don't stampede Replicate
    return await withGlobalSlot(async () => {
      for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
        try {
          console.log(`[replicate] attempt ${attempt}/${MAX_TRIES}`);

          const output = await replicate.run(
            "black-forest-labs/flux-2-klein-4b",
            {
              input: replicateInput,
            }
          );

          const firstOutput =
            Array.isArray(output) && output.length ? output[0] : null;

          if (!firstOutput) {
            throw new Error("No output received from model.");
          }

          let buffer: Buffer;

          if (typeof (firstOutput as any).arrayBuffer === "function") {
            console.log("Processing output as Stream/Blob...");
            const arrayBuffer = await (firstOutput as any).arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
          } else {
            console.log("Processing output as URL...");

            let urlString = "";

            if (typeof firstOutput === "string") {
              urlString = firstOutput;
            } else if (
              typeof firstOutput === "object" &&
              (firstOutput as any).url
            ) {
              const rawUrl =
                typeof (firstOutput as any).url === "function"
                  ? (firstOutput as any).url()
                  : (firstOutput as any).url;
              urlString = String(rawUrl);
            } else {
              urlString = String(firstOutput);
            }

            const imgResp = await fetch(urlString);
            if (!imgResp.ok) {
              const errTxt = await imgResp.text();
              throw new Error(
                `Image fetch failed: ${imgResp.status} â€“ ${errTxt}`
              );
            }
            buffer = Buffer.from(await imgResp.arrayBuffer());
          }

          const mime = req.body?.Png ? "png" : "jpeg";
          const imageBase64 = `data:image/${mime};base64,${buffer.toString("base64")}`;
          return res.status(200).json({ imageBase64, attempt });
        } catch (e: any) {
          lastErr = e;
          console.error(`[replicate] attempt ${attempt} failed:`, errMsg(e));

          if (attempt < MAX_TRIES) {
            const waitMs = getWaitMs();
            console.log(
              `[replicate] waiting ${Math.round(
                waitMs / 1000
              )}s before retry...`
            );
            await sleep(waitMs);
            continue;
          }

          break;
        }
      }

      // only after final attempt
      return res.status(500).json({
        error: `Generation failed after ${MAX_TRIES} attempts: ${errMsg(
          lastErr
        )}`,
      });
    });
  } catch (err: any) {
    console.error("Error in fluxschnellRoutex:", err);
    return res.status(500).json({ error: errMsg(err) });
  }
}

export async function IdeogramRoute(req: any, res: any) {
  try {
    const { inputs, seed, ty } = req.body; // text prompt (string) fluxDevRoute

    if (!inputs || typeof inputs !== "string" || !inputs.trim()) {
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }

    // âš™ï¸  Build the payload that matches ideogram-ai/ideogram-v2a-turbo's schema
    const replicateInput = {
      prompt: inputs, // ðŸ§  Write a detailed, vivid prompt
      aspect_ratio:
        ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "9:16",
      seed: seed,
    };
    /**
     * replicate.run() waits for completion and returns the **output(s)** directly.
     * We reference a *specific* model version so you get stable behaviour.
     * If Replicate releases a newer version youâ€™ll opt-in explicitly.
     */
    const output = await replicate.run("ideogram-ai/ideogram-v2a-turbo", {
      input: replicateInput,
    });

    // ideogram-ai/ideogram-v2a-turbo returns a single URL (or data-URI) string, not an array
    const firstOutput =
      Array.isArray(output) && output.length ? output[0] : output;

    // If Replicate already gave us a data-URI, weâ€™re done
    if (typeof firstOutput === "string" && firstOutput.startsWith("data:")) {
      return res.status(200).json({ imageBase64: firstOutput });
    }

    // Otherwise, download the file and convert to a data-URI so the frontend
    // doesnâ€™t need to fetch it separately.
    const imgResp = await fetch(firstOutput as string);
    if (!imgResp.ok) {
      const errTxt = await imgResp.text();
      throw new Error(`Image fetch failed: ${imgResp.status} â€“ ${errTxt}`);
    }
    const buf = Buffer.from(await imgResp.arrayBuffer());
    const imageBase64 = `data:image/png;base64,${buf.toString("base64")}`;

    return res.status(200).json({ imageBase64 });
  } catch (err: any) {
    console.error("Error in ideogramRoutex:", err);
    return res.status(500).json({ error: err.message });
  }
}

// src/seedreamRoute.ts

/**
 * POST /api/seedream
 * Body:
 * {
 *   inputs: string,          // prompt   (required) fluxUltra
 *   guidance_scale?: number, // default 2.5
 *   seed?: number,           // default random
 *   ty?: 0 | 1               // 0 = landscape (1920Ã—1080), 1 = portrait (1080Ã—1920)
 * }
 */

/**
 * POST /api/seedream
 * Body:
 * {
 *   inputs: string,          // prompt   (required)
 *   guidance_scale?: number, // default 2.5
 *   seed?: number,           // default random
 *   ty?: 0 | 1               // 0 = landscape (1920Ã—1080), 1 = portrait (1080Ã—1920)
 * }
 */

// src/seedreamRoute.ts

/**
 * POST /api/seedream
 * Body:
 * {
 *   inputs: string,          // prompt   (required)
 *   guidance_scale?: number, // default 2.5
 *   seed?: number,           // default random
 *   ty?: 0 | 1               // 0 = portrait (9:16), 1 = landscape (16:9)
 * }
 */
export async function seeDream(req: any, res: any) {
  try {
    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€ 1. validate â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    const {
      inputs,
      guidance_scale = 2.5,
      seed = Math.floor(Math.random() * 10_000),
      ty = 0,
    } = req.body ?? {};

    if (!inputs || typeof inputs !== "string" || !inputs.trim()) {
      return res
        .status(400)
        .json({ error: "`inputs` (prompt) field required" });
    }

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€ 2. auth token â”€â”€â”€â”€â”€â”€â”€ */
    const apiKey = process.env.REPLI_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Missing REPLI_KEY environment variable (Replicate API token).",
      });
    }

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€ 3. build input â”€â”€â”€â”€â”€â”€ */
    const replicateInput = {
      prompt: inputs,
      guidance_scale,
      seed,
      aspect_ratio:
        ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "9:16",
    };
    console.log("[Seedream] replicateInput:", replicateInput);

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€ 4. create prediction â”€ */
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        version:
          "bf61da3d106321b05b4a24fef615928ba343856849079560c45d627ae0d94d4c",
        input: replicateInput,
      }),
    });

    if (!createRes.ok) {
      const txt = await createRes.text();
      throw new Error(`Replicate create error: ${createRes.status} â€“ ${txt}`);
    }

    let prediction: any = await createRes.json();
    console.log(
      `[Seedream] created prediction ${prediction.id} â€“ initial status: ${prediction.status}`
    );

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€ 5. poll until done â”€â”€ */
    let { status, output } = prediction;
    while (status === "starting" || status === "processing") {
      await new Promise((r) => setTimeout(r, 3000));

      const pollRes = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );

      if (!pollRes.ok) {
        const txt = await pollRes.text();
        throw new Error(`Replicate poll error: ${pollRes.status} â€“ ${txt}`);
      }

      prediction = await pollRes.json();
      status = prediction.status;
      output = prediction.output;
      console.log(
        `[Seedream] poll ${
          prediction.id
        } â€“ status: ${status} â€“ hasOutput: ${!!output}`
      );
    }

    if (status !== "succeeded" || !output) {
      return res
        .status(502)
        .json({ error: `Prediction ${status}`, detail: { id: prediction.id } });
    }

    const firstOutput = Array.isArray(output) ? output[0] : output;
    console.log("[Seedream] final image URL:", firstOutput);

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€ 6. convert to base-64 â”€ */
    return await streamOrFetchToBase64(firstOutput, res);
  } catch (err: any) {
    console.error("Error in seedream route:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}

/**
 * seeDream
 * Body: {
 *   inputs: string (prompt)            <-- required
 *   ty?: 0|1|2|3                       <-- aspect ratio hint
 *   seed?: number                      <-- optional, reproducibility
 * }
 *
 * Response:
 *   200 { base64, url }
 *   4xx/5xx { error }  IdeogramRoute,
 */
export async function fluxDevRoute(req: any, res: any) {
  try {
    const {
      inputs,
      seed = Math.floor(Math.random() * 10000),
      ty = 0,
    } = req.body;
    if (!inputs || typeof inputs !== "string" || !inputs.trim()) {
      return res
        .status(400)
        .json({ error: "`inputs` (prompt) field required" });
    }
    ///kling
    const token = process.env.REPLI_KEY || process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return res
        .status(500)
        .json({ error: "Missing REPLI_KEY / REPLICATE_API_TOKEN env var." });
    }

    const aspect_ratio =
      ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "9:16";

    const inputPayload = {
      prompt: inputs,
      seed,
      aspect_ratio,
    };
    console.log("[fluxDevRoute] payload:", inputPayload);

    const createResp = await fetch(
      "https://api.replicate.com/v1/models/reve/create/predictions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Prefer: "wait", // you may omit if polling manually
        },
        body: JSON.stringify({ input: inputPayload }),
      }
    );

    if (!createResp.ok) {
      const txt = await createResp.text();
      console.error("[fluxDevRoute] create NOT OK:", txt);
      return res.status(createResp.status).json({ error: txt });
    }

    let { id: predictionId, status } = await createResp.json();
    console.log("[fluxDevRoute] created id:", predictionId, "status:", status);

    while (status === "starting" || status === "processing") {
      await new Promise((r) => setTimeout(r, 3000));
      const poll = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!poll.ok) {
        const txt = await poll.text();
        console.error("[fluxDevRoute] poll NOT OK:", txt);
        return res.status(502).json({ error: txt });
      }
      const pollData = await poll.json();
      status = pollData.status;
      console.log("[fluxDevRoute] poll id:", predictionId, "status:", status);
    }

    const final = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const finalData = await final.json();

    if (status !== "succeeded" || !finalData.output) {
      console.error("[fluxDevRoute] failed status:", status, finalData);
      return res
        .status(500)
        .json({ error: `Prediction ${status}`, detail: finalData });
    }

    const output = finalData.output;
    const outputUrl = Array.isArray(output) ? output[0] : output;
    console.log("[fluxDevRoute] outputUrl:", outputUrl);

    const imgResp = await fetch(outputUrl);
    if (!imgResp.ok) {
      const errTxt = await imgResp.text();
      console.error("[fluxDevRoute] image fetch failed:", errTxt);
      return res.status(502).json({
        error: `Image fetch failed ${imgResp.status}`,
        detail: errTxt,
      });
    }

    const buf = Buffer.from(await imgResp.arrayBuffer());
    const imageBase64 = `data:image/png;base64,${buf.toString("base64")}`;

    return res.status(200).json({ imageBase64 });
  } catch (err: any) {
    console.error("[fluxDevRoute] caught error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}

async function waitForMetrics(id: string, token: any) {
  const url = `https://api.replicate.com/v1/predictions/${id}`;
  while (true) {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const p = await r.json();

    // terminal state?
    if (["succeeded", "failed", "canceled"].includes(p.status)) {
      return p; // will now include metrics
    }
    await new Promise((res) => setTimeout(res, 1500)); // 1.5 s back-off
  }
}

// -----------------------------------------------------------------------------
// 2. hiDreamFastRoute ----------------------------------------------------------
//    prunaai/hidream-l1-fast â€“ ðŸ”¥ ultrafast SDXLâ€‘quality generations
// -----------------------------------------------------------------------------
export async function hiDreamFastRoute(req: any, res: any) {
  try {
    const { inputs, seed, ty } = req.body;
    if (!inputs || typeof inputs !== "string" || !inputs.trim()) {
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }

    const replicateInput = {
      seed,
      prompt: inputs,
      speed_mode: "Unsqueezed ðŸ‹ (highest quality)",
      output_format: req.body?.Png ? "png" : "jpg",
      output_quality: 80,
      model_type: "fast",
      resolution:
        ty === 1
          ? "768 Ã— 1360 (Portrait)"
          : ty === 2
          ? "1024 Ã— 1024 (Square)"
          : ty === 3
          ? "1360 Ã— 768 (Landscape)"
          : "768 Ã— 1360 (Portrait)",
    };

    const postResponse = await fetch(
      "https://api.replicate.com/v1/predictions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.REPLI_KEY}`,
          Prefer: "wait", // â† returns the *completed* prediction
        },
        body: JSON.stringify({
          version:
            "17c237d753218fed0ed477cb553902b6b75735f48c128537ab829096ef3d3645",
          input: replicateInput,
        }),
      }
    );

    if (!postResponse.ok) {
      const text = await postResponse.text();
      throw new Error(`Replicate error: ${postResponse.status} - ${text}`);
    }

    // per-second prices from https://replicate.com/pricing (2025-07-06)
    // inside hiDreamFastRoute ---------------------------------------
    const prediction = await postResponse.json(); // first reply
    const finished = await waitForMetrics(prediction.id, process.env.REPLI_KEY);

    const secs = finished.metrics?.predict_time; // now present!
    const hw = finished.hardware?.slug ?? finished.hardware ?? "gpu-h100";
    const PRICE: any = { "gpu-h100": 0.001525, "gpu-l40s": 0.000975 /* â€¦ */ };

    if (typeof secs === "number") {
      console.log(
        `Replicate cost: $${(secs * PRICE[hw]).toFixed(4)} ` +
          `(${secs.toFixed(2)} s on ${hw})`
      );
    } else {
      console.log("Replicate cost: metrics missing even after poll.");
    }
    // ----------------------------------------------------------------------

    const firstOutput = Array.isArray(prediction.output)
      ? prediction.output[0]
      : prediction.output;

    return await streamOrFetchToBase64(firstOutput, res);
  } catch (err: any) {
    console.error("Error in hiDreamFastRoute:", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function ImagenRouteOld(req: any, res: any) {
  try {
    const {
      inputs, // required prompt text wan
      outputFormat = "png", // "jpg" | "png" | "webp"
      ty,
      sampleImages, // Array of images
      sampleimagesnames, // Active character mapping
    } = req.body as {
      inputs: string;
      outputFormat?: "jpg" | "png" | "webp";
      safetyLevel?: string;
      seed?: number;
      ty?: number;
      sampleImages?: string[];
      sampleimagesnames?: any[];
    };

    if (!inputs?.trim()) {
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }

    let image_input: string[] = [];
    if (Array.isArray(sampleImages)) {
      image_input = sampleImages.filter(Boolean).slice(0, 8);
    }

    // --- ANTIGRAVITY ENGINE: Conversational Positional Parsing ---
    const updatedInputs = injectConversational(
      inputs,
      image_input,
      sampleimagesnames || []
    );

    // Build payload for google/gemini-2.5-flash-image
    const replicateInput: Record<string, unknown> = {
      prompt: updatedInputs.trim(),
      image_input: image_input, // âœ… Replicate uses image_input
      output_format: req.body?.Png ? outputFormat : "jpg",
      aspect_ratio:
        ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "9:16",
    };

    // Run the model (returns a FileOutput for file-producing models)
    logPayloadSafely("google/gemini-2.5-flash-image", replicateInput);
    const output = await replicate.run("google/gemini-2.5-flash-image", {
      input: replicateInput,
    });

    // Normalize output to a single file
    const file = Array.isArray(output) ? output[0] : output;

    let buf: Buffer | null = null;

    // Prefer reading bytes directly from FileOutput (Response-like)
    if (
      file &&
      typeof file === "object" &&
      typeof (file as any).arrayBuffer === "function"
    ) {
      const ab = await (file as any).arrayBuffer();
      buf = Buffer.from(ab);
    } else if (file && typeof (file as any).blob === "function") {
      const blob = await (file as any).blob();
      buf = Buffer.from(await blob.arrayBuffer());
    } else if (file && typeof (file as any).url === "function") {
      // Fallback: resolve URL then fetch
      const url = (file as any).url();
      const resp = await fetch(url);
      if (!resp.ok)
        throw new Error(
          `Image fetch failed: ${resp.status} â€“ ${await resp.text()}`
        );
      buf = Buffer.from(await resp.arrayBuffer());
    } else if (typeof file === "string") {
      // Older behavior if you opt out of FileOutput or model returns a URL string
      const resp = await fetch(file);
      if (!resp.ok)
        throw new Error(
          `Image fetch failed: ${resp.status} â€“ ${await resp.text()}`
        );
      buf = Buffer.from(await resp.arrayBuffer());
    }

    if (!buf) throw new Error("Unexpected output type from Replicate");

    const imageBase64 = `data:image/${outputFormat};base64,${buf.toString(
      "base64"
    )}`;
    return res.status(200).json({ imageBase64 });
  } catch (err: any) {
    console.error("Error in ImagenRoute:", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function ImagenRoutex(req: any, res: any) {
  try {
    const {
      inputs, // prompt text   (required)
      // aspectRatio = "9:16", // e.g. "1:1", "16:9", "9:16"
      safetyLevel = "block_only_high", // or "block_low_and_above", "block_medium_and_above"
      outputFormat = "jpg", // "jpg" | "png" | "webp"
      seed, // optional â€“ reproducible runs if model supports it
      ty, // if 0 use callerâ€™s aspectRatio, else force 16:9
    } = req.body as {
      inputs: string;
      aspectRatio?: string;
      safetyLevel?: string;
      outputFormat?: string;
      seed?: number;
      ty?: number;
    };

    if (!inputs?.trim()) {
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }

    // Build the payload for google/imagen-4-ultra
    const replicateInput: Record<string, unknown> = {
      prompt: inputs.trim(),
      aspect_ratio:
        ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "9:16",
      safety_filter_level: safetyLevel,
      output_format: req.body?.Png ? outputFormat : "jpg",
    };
    if (typeof seed === "number") replicateInput.seed = seed;

    /**
     *  â€¢ replicate.run() waits for completion and returns the output URI(s). fluxUltra
     *  â€¢ Pin a version for reproducible builds if you like, e.g.
     *    "google/imagen-4-ultra:21e13b1ffc6a2d1c51af3fd71f15df763e13c6a613c1b3ef7b6b9a2bcb8e5a14"
     *    (published 21 Jun 2025).
     */
    const output = await replicate.run("google/imagen-4-ultra", {
      input: replicateInput,
    });

    const uri = Array.isArray(output) ? output[0] : output;

    // Replicate may already return a data-URI; if so we can send it straight back
    if (typeof uri === "string" && uri.startsWith("data:")) {
      return res.status(200).json({ imageBase64: uri });
    }

    // Otherwise fetch the file and convert to base64 so the front-end needs only one request
    const imgResp = await fetch(uri as string);
    if (!imgResp.ok) {
      throw new Error(
        `Image fetch failed: ${imgResp.status} â€“ ${await imgResp.text()}`
      );
    }
    const buf = Buffer.from(await imgResp.arrayBuffer());
    const imageBase64 = `data:image/${outputFormat};base64,${buf.toString(
      "base64"
    )}`;

    return res.status(200).json({ imageBase64 });
  } catch (err: any) {
    console.error("Error in ImagenUltraRoute:", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function MinimaxImageRoutex(req: any, res: any) {
  try {
    const {
      inputs, // prompt text  (required) BanannaRoute  seedream
      /// aspectRatio = "1:1", // see model enum below
      numImages = 1, // 1-9
      promptOpt = true, // enable/disable prompt optimiser
      subjectReference, // optional image URL / data-URI / Buffer
      ty, // if 0 use callerâ€™s aspectRatio, else force 16:9
    } = req.body as {
      inputs: string;
      aspectRatio?: string;
      numImages?: number;
      promptOpt?: boolean;
      subjectReference?: string;
      ty?: number;
    };

    if (!inputs?.trim()) {
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }
    if (numImages < 1 || numImages > 9) {
      return res.status(400).json({ error: "'numImages' must be 1-9" });
    }

    // Build the payload for minimax/image-01
    const replicateInput: Record<string, unknown> = {
      prompt: inputs.trim(),
      aspect_ratio:
        ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "9:16",
      number_of_images: numImages,
      prompt_optimizer: promptOpt,
    };
    if (subjectReference) replicateInput.subject_reference = subjectReference;

    /**
     *  â€¢ replicate.run() waits until generation is complete.
     *  â€¢ Pin a version for deterministic builds if you like, e.g.
     *    "minimax/image-01:abbfceebd9f32eba5a69624c59fe3d434ed8d8208aa858f9734040062c03d8c9"
     *    (published May 2025).
     */
    logPayloadSafely("minimax/image-01", replicateInput);
    const output = await replicate.run("minimax/image-01", {
      input: replicateInput,
    });

    if (!Array.isArray(output) || output.length === 0) {
      throw new Error("Model returned no images");
    }

    // Convert every image to base64 so the front-end only needs this request
    const imagesBase64: string[] = [];
    for (const uri of output) {
      if (typeof uri === "string" && uri.startsWith("data:")) {
        imagesBase64.push(uri); // data-URI already
        continue;
      }
      const imgResp = await fetch(uri as string);
      if (!imgResp.ok) {
        throw new Error(
          `Fetch failed: ${imgResp.status} â€“ ${await imgResp.text()}`
        );
      }
      const buf = Buffer.from(await imgResp.arrayBuffer());
      imagesBase64.push(`data:image/jpeg;base64,${buf.toString("base64")}`);
    }

    // â€¦after imagesBase64 has been built   aspectRatio
    if (imagesBase64.length === 1) {
      // ðŸ‘‡ FOR OLD CLIENTS THAT EXPECT imageBase64
      return res.status(200).json({
        imageBase64: imagesBase64[0], // first image
        imagesBase64, // still include the array for new code
      });
    }
    return res.status(200).json({ imagesBase64 }); // always returns an array
  } catch (err: any) {
    console.error("Error in MinimaxImageRoute:", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function GptImageRoute(req: any, res: any) {
  try {
    const {
      inputs, // prompt text (required)
      outputFormat = "png", // Keeping PNG to preserve standard HD clarity upscale

      // Image Inputs (Legacy & New)
      sampleImage,
      sampleImages,
      imageInputs,
      sampleimagesnames,

      // Aspect Ratio
      ty, // 1 => 9:16, 2 => 1:1, 3 => 16:9
    } = req.body || {};

    if (!inputs || typeof inputs !== "string" || !inputs.trim()) {
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }

    // --- Build Input Images Array ---
    let input_images: string[] = [];

    if (Array.isArray(sampleImages)) {
      input_images = sampleImages.filter(Boolean).slice(0, 8);
    } else if (Array.isArray(imageInputs)) {
      input_images = imageInputs.filter(Boolean);
    } else if (Array.isArray(sampleImage)) {
      input_images = sampleImage.filter(Boolean);
    } else if (typeof sampleImage === "string" && sampleImage.trim()) {
      input_images = [sampleImage.trim()];
    }

    // Map output format to fal enums
    const falOutputFormat =
      outputFormat === "jpg" ? "jpeg" : (outputFormat as "png" | "webp");

    // --- 1080p Custom Resolutions (Multiple of 16) ---
    const imageSize =
      ty === 2
        ? { width: 1440, height: 1440 } // 1:1 (Approx 1080p area)
        : ty === 3
        ? { width: 1920, height: 1088 } // 16:9 1080p (Multiple of 16)
        : { width: 1088, height: 1920 }; // 9:16 1080p (Multiple of 16)

    // --- CONVERSATIONAL ENGINE: Positional Label Binding for OpenAI ---
    const finalPrompt = injectConversational(
      inputs,
      input_images,
      sampleimagesnames || []
    );

    // --- DYNAMIC ROUTING ---
    const isEditMode = input_images.length > 0;
    const endpoint = isEditMode
      ? "openai/gpt-image-2/edit"
      : "openai/gpt-image-2";

    /*
     * GPT Image 2 Pricing Details:
     * Text tokens (per 1M): $5.00 input, $1.25 cached, $10.00 output.
     * Image tokens (per 1M): $8.00 input, $2.00 cached, $30.00 output.
     * Changing the quality parameter significantly affects cost; by default we use high. Adjust it to your preference.
     * See the description at the bottom of this page for more details on how much canonical image sizes cost. Token cost is ceiled to the closest cent.
     */
    const falInput: any = {
      prompt: finalPrompt.trim(),
      output_format: req.body?.Png ? falOutputFormat : "jpeg",
      quality: "medium", // Updated to medium since it's the same price for 1080p
      num_images: 1,
    };

    // `ty` controls output dimensions for text and reference-image requests.
    if (isEditMode) {
      falInput.image_urls = input_images;
    }
    falInput.image_size = imageSize;

    // Run fal model
    console.log(`Payload to ${endpoint}:`, falInput);

    const result = await fal.subscribe(endpoint, {
      input: falInput,
    });

    // Process Result
    const first = result?.data?.images?.[0];
    if (!first) {
      throw new Error("No image returned from fal");
    }

    // Check for Data URI
    const maybeDataUri =
      (first as any).file_data ||
      (typeof first.url === "string" ? first.url : undefined);

    if (typeof maybeDataUri === "string" && maybeDataUri.startsWith("data:")) {
      return res.status(200).json({ imageBase64: maybeDataUri });
    }

    // Fallback: Fetch hosted file
    const imgUrl = first.url;
    if (!imgUrl || typeof imgUrl !== "string") {
      throw new Error("fal returned no usable image url/data");
    }

    const imgResp = await fetch(imgUrl);
    if (!imgResp.ok) {
      throw new Error(
        `Image fetch failed: ${imgResp.status} â€“ ${await imgResp.text()}`
      );
    }

    const buf = Buffer.from(await imgResp.arrayBuffer());
    const imageBase64 = `data:image/${
      outputFormat === "jpg" ? "jpeg" : outputFormat
    };base64,${buf.toString("base64")}`;

    return res.status(200).json({ imageBase64 });
  } catch (err: any) {
    console.error("Error in GptImageRoute:", err);
    return res.status(500).json({ error: err.message });
  }
}
// -----------------------------------------------------------------------------//

async function streamOrFetchToBase64(src: any, res: any) {
  // If Replicate already returns a data: URI, just forward it gpt image 2 .
  if (typeof src === "string" && src.startsWith("data:")) {
    return res.status(200).json({ imageBase64: src });
  }

  // Otherwise, fetch the remote asset and convert to base64 data URI.
  const imgResp = await fetch(src);
  if (!imgResp.ok) {
    const errText = await imgResp.text();
    throw new Error(`Failed to fetch image: ${imgResp.status} - ${errText}`);
  }

  const buff = Buffer.from(await imgResp.arrayBuffer()).toString("base64");
  return res.status(200).json({ imageBase64: `data:image/png;base64,${buff}` });
}

/**
 * Route:  POST /api/kontext seedance Kling
 * Body:   {
 *   inputs:        string   // prompt or instruction
 *   sampleImage:   string   // HTTP URL or data-URL (< 256 KB) of the image to edit
 *   seed?:         number   // optional â€“ â€“1 for random
 *   outputFormat?: "png" | "jpg" | "webp"
 *   safety?:       0-6      // optional, default 2
 * }
 */

// pages/api/kontext.ts  (or wherever your server routes live)

export async function KontextRoutePRO(req: any, res: any) {
  try {
    const {
      inputs,
      sampleImage,
      seed = -1,
      outputFormat = "png",
      // safety = 2,
      ty,
    } = req.body;

    // --- validation --------------------------------------------------------
    if (!inputs || typeof inputs !== "string" || !inputs.trim()) {
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }
    if (!sampleImage || typeof sampleImage !== "string") {
      return res
        .status(400)
        .json({ error: "Missing 'sampleImage' URL/data-URL" });
    }

    // --- build replicate input --------------------------------------------
    const replicateInput = {
      prompt: inputs,
      input_image: sampleImage,
      seed,
      aspect_ratio:
        ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "9:16",
      output_format: req.body?.Png ? outputFormat : "jpg",
      safety_tolerance: 5,
    };

    // --- POST to the model-scoped endpoint (no version needed) ------------
    const response = await fetch(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer  ${process.env.REPLI_KEY}`,
          Prefer: "wait",
        },
        body: JSON.stringify({ input: replicateInput }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Replicate error ${response.status}: ${text}`);
    }

    // The sync call returns { output: [...] } or { output: "uri" }
    const { output } = await response.json();
    const firstOutput = Array.isArray(output) ? output[0] : output;

    // Stream the image back to the client as base64
    return await streamOrFetchToBase64(firstOutput, res);
  } catch (err: any) {
    console.error("Error in KontextRoute:", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function KontextRouteM(req: any, res: any) {
  try {
    // ---------- gather & validate input ----------
    const {
      inputs, // prompt (required)
      sampleImage, // string or array (back-compat) ImagenRoutex
      imageInputs, // optional alias for multiple images
      // Qwen Image Edit defaults to webp/95 + match_input_image
      outputFormat = "png", // "webp" | "png" | "jpg"
      output_quality = 95, // 0..100 (ignored for png)
      // aspect_ratio, // optional; default is "match_input_image"
      seed, // optional
      go_fast = false, // optional
      disable_safety_checker = true, // optional
      ty,
    } = req.body || {};

    if (!inputs || typeof inputs !== "string" || !inputs.trim()) {
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }

    // Qwen Image Edit uses a SINGLE 'image' (URL/data-URI/Blob/Buffer)
    let image: string | undefined;
    if (Array.isArray(imageInputs) && imageInputs.length)
      image = String(imageInputs[0]);
    else if (Array.isArray(sampleImage) && sampleImage.length)
      image = String(sampleImage[0]);
    else if (typeof sampleImage === "string" && sampleImage.trim())
      image = sampleImage.trim();

    if (!image) {
      return res.status(400).json({
        error: "Provide at least one 'sampleImage' (URL or data-URL)",
      });
    }

    // ---------- build payload ----------
    const replicateInput: Record<string, unknown> = {
      image, // single reference image
      prompt: inputs.trim(), // your edit instruction
      output_format: req.body?.Png ? outputFormat : "jpg", // default 'webp'
      output_quality, // default 95 (ignored for png)
      go_fast,
      seed,
      disable_safety_checker,
    };

    if (ty === 3) {
      replicateInput.aspect_ratio = "16:9";
    } else {
      replicateInput.aspect_ratio = "match_input_image";
    }
    // else defaults to "match_input_image"

    // ---------- run qwen/qwen-image-edit ----------
    const output = await replicate.run("qwen/qwen-image-edit", {
      input: replicateInput,
    });

    // qwen-image-edit returns an array of files (usually one) â†’ take first
    const first = Array.isArray(output) ? output[0] : output;
    const buf = await fileOutputToBuffer(first);

    const mime =
      outputFormat === "png"
        ? "png"
        : outputFormat === "jpg" || outputFormat === "jpeg"
        ? "jpeg"
        : "webp";

    const imageBase64 = `data:image/${mime};base64,${buf.toString("base64")}`;
    return res.status(200).json({ imageBase64 });
  } catch (err: any) {
    console.error("Error in QwenImageEdit route:", err);
    return res.status(500).json({ error: err.message });
  }
}

// Assuming fileOutputToBuffer is defined in your project
// import { fileOutputToBuffer } from "./utils";
export async function KontextRoute(req: any, res: any) {
  try {
    const {
      inputs, // prompt (required)
      sampleImage, // optional: legacy singular
      sampleImages, // <--- ADD THIS (Matches new Frontend)
      imageInputs, // optional: alias
      sampleimagesnames, // Active character mapping
      seed = -1,

      // aspect ratio control
      ty, // 1=Portrait(9:16), 2=Square(1:1), 3=Landscape(16:9)

      // FLUX.2 [flex] knobs
      steps = 30, // 1..50
      guidance = 4.5, // 1.5..10
      resolution = "4 MP",
      //safety_tolerance = 2, // 1..5
      prompt_upsampling = true,

      // output control
      output_format = req.body?.Png ? "png" : "jpg",
      output_quality = 80,


      // mime header preference
      // outputFormat = "png",
    } = req.body || {};

    if (!inputs || typeof inputs !== "string" || !inputs.trim()) {
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }

    // --- 1. Build input_images array (Schema: "array", Max 10) ---
    let collected_images: string[] = [];

    // Check all possible keys for the image array
    if (Array.isArray(sampleImages)) {
      collected_images = sampleImages.filter(Boolean);
    } else if (Array.isArray(imageInputs)) {
      collected_images = imageInputs.filter(Boolean);
    } else if (Array.isArray(sampleImage)) {
      collected_images = sampleImage.filter(Boolean);
    } else if (typeof sampleImage === "string" && sampleImage.trim()) {
      collected_images = [sampleImage.trim()];
    }

    // Enforce Schema Limit: Maximum 8 images
    const input_images = collected_images.slice(0, 8);

    // --- ANTIGRAVITY ENGINE: FLUX.2 Subject Parsing ---
    const updatedInputs = injectFlux2(
      inputs,
      input_images,
      sampleimagesnames || []
    );

    // `ty` is authoritative for reference-image generation too.
    const aspect_ratio = tyToAspect(ty, "1:1");

    // --- 3. Build Replicate Payload ---
    const replicateInput: Record<string, any> = {
      prompt: updatedInputs.trim(),
      seed: typeof seed === "number" && seed >= 0 ? seed : undefined,

      // Parameters
      steps: Number(steps) || 30,
      guidance: Number(guidance) || 4.5,
      resolution: resolution || "1 MP",
      aspect_ratio: aspect_ratio,

      // !!! CORRECT SCHEMA FIELD !!!
      input_images: input_images, // Sending the ARRAY here

      output_format: req.body?.Png ? output_format : "jpg",
      output_quality: Number(output_quality) || 80,
      safety_tolerance: 5,
      prompt_upsampling: !!prompt_upsampling,
    };


    // --- 4. Run Model ---
    const output: any = await replicate.run("black-forest-labs/flux-2-flex", {
      input: replicateInput,
    });

    // --- 5. Process Output ---
    // The model returns a URL string (or an array of strings).
    // Usually Flux Flex returns a single file URL string.
    const fileUrl = Array.isArray(output) ? output[0] : output;

    // Fetch the image to buffer (assuming you have a helper for this)
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) throw new Error("Failed to fetch Replicate output");
    const buf = Buffer.from(await fileResponse.arrayBuffer());

    const mime = req.body?.Png ? "png" : "jpeg";
    const imageBase64 = `data:image/${mime};base64,${buf.toString("base64")}`;
    return res.status(200).json({ imageBase64 });
  } catch (err: any) {
    console.error("Error in KontextRoute (flux-2-flex):", err);
    return res.status(err?.response?.status || 500).json({
      error: err?.message || "Unknown error",
      details: err?.response?.data || undefined,
    });
  }
}
// src/routes/nanoBanana.ts KontextRoute

/** Normalize Replicate FileOutput / URL / data-URI -> Plan Buffer */

/** Move from Kontext â†’ Nano Banana */

export async function ImagenRoute2(req: any, res: any) {
  try {
    const {
      inputs, // required prompt text
      outputFormat = "png", // "jpg" | "png" | "webp"
      ty, // aspect ratio selector
      //safetyLevel, // Note: Safety level is not explicitly exposed in the standard Nano Banana Pro T2I schema, so it is omitted.
    } = req.body as {
      inputs: string;
      outputFormat?: "jpg" | "png" | "webp";
      safetyLevel?: string;
      seed?: number;
      ty?: number;
    };

    if (!inputs?.trim()) {
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }

    // Map 'ty' to aspect ratios supported by fal-ai/nano-banana-pro
    // ty=1 -> 9:16 (Portrait)
    // ty=2 -> 1:1  (Square)
    // ty=3 -> 16:9 (Landscape)
    // Fallback -> 9:16
    const aspectRatio =
      ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "9:16";

    // Fal expects "jpeg" instead of "jpg"
    const validOutputFormat = outputFormat === "jpg" ? "jpeg" : outputFormat;

    // Run the Text-to-Image model
    // Endpoint: fal-ai/nano-banana-pro (without /edit)
    const falInput = {
      prompt: inputs.trim(),
      output_format: req.body?.Png ? validOutputFormat : "jpeg",
      aspect_ratio: aspectRatio,
      resolution: "2K", // Defaulting to 4K for better quality
      num_images: 1,
      safety_tolerance: "6",
    };

    logPayloadSafely("fal-ai/nano-banana-pro", falInput);
    const result: any = await fal.subscribe("fal-ai/nano-banana-pro", {
      input: falInput as any,
      logs: true, // Optional: enables server logs
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs.map((log) => log.message).forEach(console.log);
        }
      },
    });

    // Validate Output ImagenRoute2
    if (
      !result.data ||
      !result.data.images ||
      result.data.images.length === 0
    ) {
      throw new Error("No output returned from Fal.ai");
    }

    // Fal returns an object with a URL: { url: "...", content_type: "...", ... }
    const fileOutput = result.data.images[0];

    // Fetch the image from the URL provided by Fal
    const resp = await fetch(fileOutput.url);
    if (!resp.ok) {
      throw new Error(
        `Image fetch failed: ${resp.status} â€“ ${await resp.text()}`
      );
    }

    // Convert to Buffer -> Base64 to match your original response contract
    const buf = Buffer.from(await resp.arrayBuffer());
    const imageBase64 = `data:image/${outputFormat};base64,${buf.toString(
      "base64"
    )}`;

    return res.status(200).json({ imageBase64 });
  } catch (err: any) {
    console.error("Error in NanoBananaProRoute (Fal):", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function ImagenRoute(req: any, res: any) {
  try {
    const {
      inputs, // required prompt text
      outputFormat = "png", // "jpg" | "png" | "webp"
      ty, // aspect ratio selector
      sampleImages, // Array of images
      sampleimagesnames, // Active character mapping
    } = req.body || {};

    if (!inputs?.trim()) {
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }

    let image_input: string[] = [];
    if (Array.isArray(sampleImages)) {
      image_input = sampleImages.filter(Boolean).slice(0, 8);
    }

    // Map 'ty' to aspect ratios supported by fal-ai/nano-banana-pro
    // ty=1 -> 9:16 (Portrait)
    // ty=2 -> 1:1  (Square)
    // ty=3 -> 16:9 (Landscape)
    // Fallback -> 9:16
    const aspectRatio =
      ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "9:16";

    // Fal expects "jpeg" instead of "jpg"
    const validOutputFormat = outputFormat === "jpg" ? "jpeg" : outputFormat;

    // --- ANTIGRAVITY ENGINE: Semantic Label Binding ---
    const { updatedInputs, structuredRefs } = injectSemanticLabel(
      inputs,
      image_input,
      sampleimagesnames || []
    );

    const falInput: any = {
      prompt: updatedInputs.trim(),
      output_format: req.body?.Png ? validOutputFormat : "jpeg",
      aspect_ratio: aspectRatio,
      resolution: "2K", // Defaulting to 4K for better quality
      num_images: 1,
      safety_tolerance: "6", // Least restrictive mode
    };

    if (structuredRefs && structuredRefs.length > 0) {
      falInput.reference_images = structuredRefs;
    }

    // Run the Text-to-Image model
    // Endpoint: fal-ai/nano-banana-pro (without /edit)
    logPayloadSafely("fal-ai/nano-banana-2", falInput);
    const result: any = await fal.subscribe("fal-ai/nano-banana-2", {
      input: falInput,
      logs: true, // Optional: enables server logs
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs.map((log) => log.message).forEach(console.log);
        }
      },
    });

    // Validate Output
    if (
      !result.data ||
      !result.data.images ||
      result.data.images.length === 0
    ) {
      throw new Error("No output returned from Fal.ai");
    }

    // Fal returns an object with a URL: { url: "...", content_type: "...", ... }
    const fileOutput = result.data.images[0];

    // Fetch the image from the URL provided by Fal
    const resp = await fetch(fileOutput.url);
    if (!resp.ok) {
      throw new Error(
        `Image fetch failed: ${resp.status} â€“ ${await resp.text()}`
      );
    }

    // Convert to Buffer -> Base64 to match your original response contract
    const buf = Buffer.from(await resp.arrayBuffer());
    const imageBase64 = `data:image/${outputFormat};base64,${buf.toString(
      "base64"
    )}`;

    return res.status(200).json({ imageBase64 });
  } catch (err: any) {
    console.error("Error in NanoBananaProRoute (Fal):", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function BanannaRoute2(req: any, res: any) {
  try {
    // ---------- gather & validate wan input ----------
    const {
      inputs,
      sampleImage, // legacy/singular
      sampleImages, // âœ… new plural
      imageInputs, // alias
      sampleimagesnames, // Active character mapping
      outputFormat = "png",
      ty, // âœ… ONLY use ty for aspect ratio
      resolution, // "1K" | "2K" | "4K"
    } = req.body || {};

    if (!inputs || typeof inputs !== "string" || !inputs.trim()) {
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }

    // ---------- build image array ----------
    let image_input: string[] = [];

    if (Array.isArray(sampleImages)) {
      image_input = sampleImages.filter(Boolean).slice(0, 8);
    } else if (Array.isArray(imageInputs)) {
      image_input = imageInputs.filter(Boolean);
    } else if (Array.isArray(sampleImage)) {
      image_input = sampleImage.filter(Boolean);
    } else if (typeof sampleImage === "string" && sampleImage.trim()) {
      image_input = [sampleImage.trim()];
    }

    if (image_input.length === 0) {
      return res.status(400).json({
        error:
          "Provide at least one image in 'sampleImages', 'sampleImage', or 'imageInputs'",
      });
    }

    // ---------- normalize types EXACTLY like schema ----------
    type AspectRatio =
      | "auto"
      | "21:9"
      | "16:9"
      | "3:2"
      | "4:3"
      | "5:4"
      | "1:1"
      | "4:5"
      | "3:4"
      | "2:3"
      | "9:16";

    type OutputFormat = "jpeg" | "png" | "webp";
    type Resolution = "1K" | "2K" | "4K";

    // 1) Normalize aspect ratio (ONLY ty)
    const finalAspectRatio: AspectRatio = tyToAspect(ty, "9:16");

    // 2) Normalize output format
    const normalizedFormat =
      outputFormat === "jpg" ? "jpeg" : String(outputFormat || "png");
    const allowedFormats: OutputFormat[] = ["jpeg", "png", "webp"];
    const validOutputFormat: OutputFormat = allowedFormats.includes(
      normalizedFormat as OutputFormat
    )
      ? (normalizedFormat as OutputFormat)
      : "png";

    // 3) Normalize resolution
    const normalizedRes = String(resolution || "2K");
    const allowedRes: Resolution[] = ["1K", "2K", "4K"];
    const finalResolution: Resolution = allowedRes.includes(
      normalizedRes as Resolution
    )
      ? (normalizedRes as Resolution) : "2K";

    // --- ANTIGRAVITY ENGINE: Conversational Positional Injection ---
    const updatedInputs = injectConversational(
      inputs,
      image_input,
      sampleimagesnames || []
    );

    // ---------- build payload (matches docs schema) ----------
    const falInput: any = {
      prompt: updatedInputs.trim(),
      image_urls: image_input,
      output_format: req.body?.Png ? validOutputFormat : "jpeg",
      aspect_ratio: finalAspectRatio,
      resolution: finalResolution,
      safety_tolerance: "6",
    };

    // ---------- run fal-ai/nano-banana-pro/edit ----------
    logPayloadSafely("fal-ai/nano-banana-pro/edit", falInput);
    const result: any = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
      input: falInput as any,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs.map((log: any) => log.message).forEach(console.log);
        }
      },
    });

    // ---------- process output ----------
    if (!result?.data?.images || result.data.images.length === 0) {
      throw new Error("No output returned from Fal.ai");
    }

    const fileOutput = result.data.images[0];
    const fileResponse = await fetch(fileOutput.url);

    if (!fileResponse.ok) {
      throw new Error(
        `Failed to fetch output image: ${fileResponse.statusText}`
      );
    }

    const buf = Buffer.from(await fileResponse.arrayBuffer());

    const mime = req.body?.Png ? (typeof validOutputFormat !== "undefined" ? validOutputFormat : "png") : "jpeg";
      const imageBase64 = `data:image/${mime};base64,${buf.toString("base64")}`;
    return res.status(200).json({ imageBase64 });
  } catch (err: any) {
    console.error("Error in BanannaRoute (Fal):", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function BanannaRoute(req: any, res: any) {
  try {
    // ---------- gather & validate wan input ----------
    const {
      inputs,
      sampleImage, // legacy/singular
      sampleImages, // âœ… new plural
      imageInputs, // alias
      sampleimagesnames, // Active character mapping
      outputFormat = "png",
      ty, // âœ… ONLY use ty for aspect ratio
      resolution, // "1K" | "2K" | "4K"
    } = req.body || {};

    if (!inputs || typeof inputs !== "string" || !inputs.trim()) {
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }

    // ---------- build image array ----------
    let image_input: string[] = [];

    if (Array.isArray(sampleImages)) {
      image_input = sampleImages.filter(Boolean).slice(0, 8);
    } else if (Array.isArray(imageInputs)) {
      image_input = imageInputs.filter(Boolean);
    } else if (Array.isArray(sampleImage)) {
      image_input = sampleImage.filter(Boolean);
    } else if (typeof sampleImage === "string" && sampleImage.trim()) {
      image_input = [sampleImage.trim()];
    }

    if (image_input.length === 0) {
      return res.status(400).json({
        error:
          "Provide at least one image in 'sampleImages', 'sampleImage', or 'imageInputs'",
      });
    }

    // ---------- normalize types EXACTLY like schema ----------
    type AspectRatio =
      | "auto"
      | "21:9"
      | "16:9"
      | "3:2"
      | "4:3"
      | "5:4"
      | "1:1"
      | "4:5"
      | "3:4"
      | "2:3"
      | "9:16";

    type OutputFormat = "jpeg" | "png" | "webp";
    type Resolution = "1K" | "2K" | "4K";

    // 1) Normalize aspect ratio (ONLY ty)
    const finalAspectRatio: AspectRatio = tyToAspect(ty, "9:16");

    // 2) Normalize output format
    const normalizedFormat =
      outputFormat === "jpg" ? "jpeg" : String(outputFormat || "png");
    const allowedFormats: OutputFormat[] = ["jpeg", "png", "webp"];
    const validOutputFormat: OutputFormat = allowedFormats.includes(
      normalizedFormat as OutputFormat
    )
      ? (normalizedFormat as OutputFormat)
      : "png";

    // 3) Normalize resolution
    const normalizedRes = String(resolution || "2K");
    const allowedRes: Resolution[] = ["1K", "2K", "4K"];
    const finalResolution: Resolution = allowedRes.includes(
      normalizedRes as Resolution
    )
      ? (normalizedRes as Resolution)
      : "2K";

    // --- ANTIGRAVITY ENGINE: Conversational Positional Injection ---
    const updatedInputs = injectConversational(
      inputs,
      image_input,
      sampleimagesnames || []
    );

    // ---------- build payload (matches docs schema) ----------
    const falInput: any = {
      prompt: updatedInputs.trim(),
      image_urls: image_input,
      output_format: req.body?.Png ? validOutputFormat : "jpeg",
      aspect_ratio: finalAspectRatio,
      resolution: finalResolution,
      safety_tolerance: "6", // Least restrictive mode
    };

    // ---------- run fal-ai/nano-banana-2/edit ----------
    logPayloadSafely("fal-ai/nano-banana-2/edit", falInput);
    const result: any = await fal.subscribe("fal-ai/nano-banana-2/edit", {
      input: falInput,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs.map((log: any) => log.message).forEach(console.log);
        }
      },
    });

    // ---------- process output ----------
    if (!result?.data?.images || result.data.images.length === 0) {
      throw new Error("No output returned from Fal.ai");
    }

    const fileOutput = result.data.images[0];
    const fileResponse = await fetch(fileOutput.url);

    if (!fileResponse.ok) {
      throw new Error(
        `Failed to fetch output image: ${fileResponse.statusText}`
      );
    }

    const buf = Buffer.from(await fileResponse.arrayBuffer());

    const mime = req.body?.Png ? (typeof validOutputFormat !== "undefined" ? validOutputFormat : "png") : "jpeg";
      const imageBase64 = `data:image/${mime};base64,${buf.toString("base64")}`;
    return res.status(200).json({ imageBase64 });
  } catch (err: any) {
    console.error("Error in BanannaRoute (Fal):", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function BanannaRouteOld(req: any, res: any) {
  try {
    // ---------- gather & validate input ----------
    const {
      inputs, // prompt (required)
      sampleImages, // âœ… NEW: array of urls/data-urls
      sampleimagesnames, // Active character mapping
      outputFormat = "png", // nano-banana default is "jpg"
    } = req.body || {};

    if (!inputs || typeof inputs !== "string" || !inputs.trim()) {
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }

    // sampleImages can be: string | string[] | undefined | null
    const image_input: string[] = Array.isArray(sampleImages)
      ? sampleImages
          .map((s: any) => (typeof s === "string" ? s.trim() : ""))
          .filter(Boolean)
          .slice(0, 8)
      : typeof sampleImages === "string"
      ? [sampleImages.trim()].filter(Boolean)
      : [];

    if (image_input.length === 0) {
      return res.status(400).json({
        error: "Provide at least one 'sampleImages' item (URL or data-URL)",
      });
    }

    // ---------- build payload ----------
    // Map 'ty' to aspect ratios
    // ty=1 -> 9:16 (Portrait)
    // ty=2 -> 1:1  (Square)
    // ty=3 -> 16:9 (Landscape)
    const { ty } = req.body;
    const typeNum = Number(ty);
    let aspect_ratio = "9:16";
    if (typeNum === 2) aspect_ratio = "1:1";
    if (typeNum === 3) aspect_ratio = "16:9";

    // --- ANTIGRAVITY ENGINE: Conversational Positional Parsing ---
    const updatedInputs = injectConversational(
      inputs,
      image_input,
      sampleimagesnames || []
    );

    const replicateInput: Record<string, unknown> = {
      prompt: updatedInputs.trim(),
      image_input, // âœ… nano-banana expects image_input[]
      output_format: req.body?.Png ? outputFormat : "jpg", // "jpg" | "png" | "webp"
      aspect_ratio,
      disable_safety_checker: true,
    };

    // ---------- run google/nano-banana ----------
    logPayloadSafely("google/nano-banana", replicateInput);
    const output = await replicate.run("google/nano-banana", {
      input: replicateInput,
    });

    // nano-banana returns a single file (FileOutput or URL). Handle both.
    const buf = await fileOutputToBuffer(output);

    const mime = req.body?.Png ? "png" : "jpeg";
    const imageBase64 = `data:image/${mime};base64,${buf.toString("base64")}`;
    return res.status(200).json({ imageBase64 });
  } catch (err: any) {
    console.error("Error in NanoBananaRoute:", err);
    return res.status(500).json({ error: err.message });
  }
}

// Seedream-4 route using your existing fileOutputToBuffer
// MinimaxImageRoute.ts â€” Seedream-4 (image+prompt OR prompt-only) nano Banana

export async function MinimaxImageRoute2(req: any, res: any) {
  try {
    const {
      inputs, // prompt
      sampleImage,
      sampleImages,
      imageInputs,
      sampleimagesnames, // Active character mapping
      // outputFormat = "png",
      ty, // 1 => 9:16, 2 => 1:1, 3 => 16:9

      sequential_image_generation = "disabled", // "disabled" | "auto"
      max_images = 1, // 1..15 (when sequential_image_generation="auto")
      enhance_prompt, // optional boolean (model default true)
    }: any = req.body || {};

    if (!inputs || typeof inputs !== "string" || !inputs.trim()) {
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }

    // --- 1) Robust image extraction (image_input[]) ---
    let image_input: string[] = [];

    if (Array.isArray(sampleImages)) {
      image_input = sampleImages.filter(Boolean).slice(0, 8);
    } else if (Array.isArray(imageInputs)) {
      image_input = imageInputs.filter(Boolean);
    } else if (Array.isArray(sampleImage)) {
      image_input = sampleImage.filter(Boolean);
    } else if (typeof sampleImage === "string" && sampleImage.trim()) {
      image_input = [sampleImage.trim()];
    }

    // `ty` controls the result shape, including image-to-image requests.
    const aspect_ratio = tyToAspect(ty, "9:16");

    // --- ANTIGRAVITY ENGINE: Seedream Vanguard Subject Parsing ---
    const updatedInputs = injectSeedream(
      inputs,
      image_input,
      sampleimagesnames || []
    );

    // --- 3) Construct input object for Seedream 4 ---
    const input: any = {
      prompt: updatedInputs.trim(),
      aspect_ratio,
      sequential_image_generation,
      max_images,
      //size: "4K",
      size: "2K",
    };

    // Only attach images if present
    if (image_input.length > 0) {
      input.images = image_input;
    }

    // Only attach enhance_prompt if caller provided it (otherwise let model default)
    if (typeof enhance_prompt === "boolean") {
      input.enhance_prompt = enhance_prompt;
    }

    // --- 4) Run Seedream 4 ---
    const output: any = await replicate.run("bytedance/seedream-4", { input });

    // --- 5) Handle output (Seedream-4 returns uri[]; pick first) ---
    const first: any = Array.isArray(output) ? output[0] : output;

    let buf: Buffer;

    // Replicate File-like object
    if (first && typeof first.blob === "function") {
      const blob = await first.blob();
      const ab = await blob.arrayBuffer();
      buf = Buffer.from(ab);
    } else if (first && typeof first.url === "function") {
      const url = first.url();
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Image fetch failed: ${r.status}`);
      buf = Buffer.from(await r.arrayBuffer());
    } else if (typeof first === "string") {
      const r = await fetch(first);
      if (!r.ok) throw new Error(`Image fetch failed: ${r.status}`);
      buf = Buffer.from(await r.arrayBuffer());
    } else {
      throw new Error("Unknown output type from replicate.run()");
    }

    const mime = req.body?.Png ? "png" : "jpeg";
    const imageBase64 = `data:image/${mime};base64,${buf.toString("base64")}`;
    return res.status(200).json({ imageBase64 });
  } catch (err: any) {
    console.error("Seedream4Route ERROR:", err?.message || err);
    if (err?.response?.data)
      console.error("Replicate Details:", err.response.data);

    const status = err?.response?.status || err?.status || 500;
    return res.status(status).json({
      error: err?.message || "Unknown error",
      details: err?.response?.data || err?.body || undefined,
    });
  }
}

export async function MinimaxImageRoute(req: any, res: any) {
  try {
    const {
      inputs, // prompt
      sampleImage,
      sampleImages,
      imageInputs,
      sampleimagesnames, // Active character mapping
      // outputFormat = "png",
      ty, // 1 => 9:16, 2 => 1:1, 3 => 16:9
      size = "2K",
      //size = "4K",
      width,
      height,
      sequential_image_generation = "disabled",
      max_images = 1,
    }: any = req.body || {};

    if (!inputs || typeof inputs !== "string" || !inputs.trim()) {
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }

    // --- 1. Robust Image Extraction ---
    let image_input: string[] = [];

    if (Array.isArray(sampleImages)) {
      image_input = sampleImages.filter(Boolean).slice(0, 8);
    } else if (Array.isArray(imageInputs)) {
      image_input = imageInputs.filter(Boolean);
    } else if (Array.isArray(sampleImage)) {
      image_input = sampleImage.filter(Boolean);
    } else if (typeof sampleImage === "string" && sampleImage.trim()) {
      image_input = [sampleImage.trim()];
    }

    // `ty` controls the result shape, including image-to-image requests.
    const aspect_ratio = tyToAspect(ty, "9:16");

    // --- ANTIGRAVITY ENGINE: Seedream Vanguard Subject Parsing ---
    const updatedInputs = injectSeedream(
      inputs,
      image_input,
      sampleimagesnames || []
    );

    // --- 3. Construct Input Object ---
    const input: any = {
      prompt: updatedInputs.trim(),
      aspect_ratio,
      sequential_image_generation,
      max_images,
      size,
    };

    // Only attach image_input if it contains data
    if (image_input.length > 0) {
      input.image_input = image_input;
    }

    // Custom size validation
    if (size === "custom") {
      if (
        typeof width !== "number" ||
        typeof height !== "number" ||
        width < 1024 ||
        width > 4096 ||
        height < 1024 ||
        height > 4096
      ) {
        return res.status(400).json({
          error:
            "When size='custom', width/height must be between 1024 and 4096.",
        });
      }
      input.width = width;
      input.height = height;
    }

    // --- 4. Run Seedream 4.5 ---
    // Note: If image_input contains Base64 strings, this might still be flaky depending on payload size.
    // HTTP URLs are recommended for the 'image_input' array.
    const output: any = await replicate.run("bytedance/seedream-4.5", {
      input,
    });

    // --- 5. Handle Output ---
    const first: any = Array.isArray(output) ? output[0] : output;

    let buf: Buffer;

    if (first && typeof first.blob === "function") {
      const blob = await first.blob();
      const ab = await blob.arrayBuffer();
      buf = Buffer.from(ab);
    } else if (typeof first?.url === "function") {
      const url = first.url();
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Image fetch failed: ${r.status}`);
      buf = Buffer.from(await r.arrayBuffer());
    } else if (typeof first === "string") {
      const r = await fetch(first);
      if (!r.ok) throw new Error(`Image fetch failed: ${r.status}`);
      buf = Buffer.from(await r.arrayBuffer());
    } else {
      throw new Error("Unknown output type from replicate.run()");
    }

    const mime = req.body?.Png ? "png" : "jpeg";
    const imageBase64 = `data:image/${mime};base64,${buf.toString("base64")}`;
    return res.status(200).json({ imageBase64 });
  } catch (err: any) {
    console.error("Seedream45Route ERROR:", err?.message || err);
    // Log detailed Replicate API errors if available
    if (err?.response?.data)
      console.error("Replicate Details:", err.response.data);

    const status = err?.response?.status || err?.status || 500;
    return res.status(status).json({
      error: err?.message || "Unknown error",
      details: err?.response?.data || err?.body || undefined,
    });
  }
}
// ---- helpers ----
// Node 18+ has global fetch.

// src/routes/kontext.ts
export async function KontextRouteDEV(req: any, res: any) {
  try {
    // ----------------------- gather & validate input -----------------------
    const {
      inputs, // prompt string
      sampleImage, // URL or data-URL Kling
      seed = -1,
      outputFormat = "png",
      //safety = 2, // keep numeric for compatibility
      guidance = 2.5, // expose if you want finer control
      numSteps = 32, // a bit above default 28 for quality
      goFast = false, // turn OFF fast mode â†’ better detail
      ty,
    } = req.body;

    if (!inputs || typeof inputs !== "string" || !inputs.trim()) {
      return res.status(400).json({ error: "Missing 'inputs' prompt string" });
    }
    if (!sampleImage || typeof sampleImage !== "string") {
      return res
        .status(400)
        .json({ error: "Missing 'sampleImage' URL or data-URL" });
    }

    // ----------------------- build Replicate payload -----------------------
    const replicateInput = {
      prompt: inputs,
      input_image: sampleImage,
      seed,
      aspect_ratio:
        ty === 1 ? "9:16" : ty === 2 ? "1:1" : ty === 3 ? "16:9" : "9:16",
      output_format: req.body?.Png ? outputFormat : "jpg",
      guidance, // â‡¢ more prompt adherence
      go_fast: goFast, // â‡¢ high quality when false
      num_inference_steps: numSteps,
      // Dev model uses a simple switch instead of tolerance scale
      safety_tolerance: 6, // â‡¢ Max-specific wan
    };

    // ----------------------- call Kontext-dev ------------------------------
    const response = await fetch(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-dev/predictions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.REPLI_KEY}`,
          Prefer: "wait", // sync â€“ same as before
        },
        body: JSON.stringify({ input: replicateInput }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Replicate error ${response.status}: ${text}`);
    }

    // The dev model returns either an array or a single URI
    const { output } = await response.json();
    const firstOutput = Array.isArray(output) ? output[0] : output;

    // ----------------------- stream image back -----------------------------
    return await streamOrFetchToBase64(firstOutput, res);
  } catch (err: any) {
    console.error("Error in KontextRoute:", err);
    return res.status(500).json({ error: err.message });
  }
}

/** Run Sync Lipsync 2 Pro without using the normal delete-on-replace flow. */
export async function lipsync2Pro(req: any, res: any) {
  try {
    const { videoUrl, audioUrl, syncMode = "loop", temperature = 0.5, activeSpeaker = true, asyncMode = true } = req.body ?? {};
    const video = typeof videoUrl === "string" ? videoUrl.trim() : "";
    const audio = typeof audioUrl === "string" ? audioUrl.trim() : "";
    if (!video || !audio) return res.status(400).json({ error: "Lipsync 2 Pro requires videoUrl and audioUrl." });
    const modelId = "sync/lipsync-2-pro";
    const input = {
      video,
      audio,
      sync_mode: syncMode === "cut" ? "cut" : "loop",
      temperature: Math.max(0, Math.min(1, Number(temperature) || 0.5)),
      active_speaker: Boolean(activeSpeaker),
    };
    const replicate = new Replicate({ auth: process.env.REPLI_KEY || process.env.REPLICATE_API_TOKEN });
    if (asyncMode) {
      const prediction = await replicate.predictions.create({ model: modelId as any, input });
      return res.status(200).json({ status: "starting", jobId: prediction.id, provider: "replicate", modelEndpoint: modelId, meta: { model: modelId } });
    }
    const output: any = await replicate.run(modelId as any, { input });
    const videoOutput = typeof output === "string" ? output : Array.isArray(output) ? output[0] : output?.url?.() || output?.url;
    if (!videoOutput) throw new Error("Lipsync 2 Pro returned no video URL.");
    return res.status(200).json({ status: "succeeded", videoBase64: await fetchAsBase64(videoOutput), videoUrl: videoOutput });
  } catch (err: any) {
    const details = err?.body || err?.response?.data;
    console.error("Lipsync 2 Pro route error:", { message: err?.message, details });
    return res.status(err?.status || 500).json({ error: details?.detail || err?.message || "Lipsync 2 Pro generation failed." });
  }
}
export async function pollVideoStatus(req: any, res: any) {
  try {
    const { jobId, provider, modelEndpoint } = req.body || {};

    if (!jobId || !provider) {
      return res.status(400).json({ error: "Missing jobId or provider" });
    }

    if (provider === "replicate") {
      const token = process.env.REPLI_KEY || process.env.REPLICATE_API_TOKEN;
      const resp = await fetch(
        `https://api.replicate.com/v1/predictions/${jobId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!resp.ok) {
        const text = await resp.text();
        // Throw transient errors to trigger a 500 status so the frontend loader keeps polling
        throw new Error(`Replicate polling error (${resp.status}): ${text}`);
      }

      const data = await resp.json();
      const status = data.status; // "starting", "processing", "succeeded", "failed", "canceled"

      if (status === "succeeded") {
        let videoUrl = Array.isArray(data.output)
          ? data.output[0]
          : data.output;
        if (!videoUrl)
          throw new Error("Replicate status succeeded but no video output");

        // Ensure minimax outputs string or handles object
        if (typeof videoUrl === "object" && videoUrl.url)
          videoUrl = videoUrl.url;

        const videoBase64 = await fetchAsBase64(videoUrl);
        return res
          .status(200)
          .json({ status: "succeeded", videoBase64, videoUrl });
      } else if (status === "failed" || status === "canceled") {
        return res
          .status(200)
          .json({ status: "failed", error: data.error || "Generation failed" });
      } else {
        return res.status(200).json({ status: "processing" });
      }
    } else if (provider === "fal") {
      if (!modelEndpoint)
        return res
          .status(400)
          .json({ error: "Missing modelEndpoint for fal provider" });

      try {
        const statusResponse = await fal.queue.status(modelEndpoint, {
          requestId: jobId,
          logs: false,
        });
        if (statusResponse.status === "COMPLETED") {
          const result = await fal.queue.result(modelEndpoint, {
            requestId: jobId,
          });
          // Fal sometimes returns { video: { url } } or { videos: [ { url } ] }
          const videoUrl =
            result.data?.video?.url ||
            result.data?.video?.[0]?.url ||
            result.data?.videos?.[0]?.url ||
            result.data?.url;
          if (!videoUrl)
            throw new Error("Fal completed but no video URL returned");

          const videoBase64 = await fetchAsBase64(videoUrl);
          return res
            .status(200)
            .json({ status: "succeeded", videoBase64, videoUrl });
        } else if ((statusResponse as any).status === "FAILED") {
          return res
            .status(200)
            .json({ status: "failed", error: "Fal generation failed" });
        } else {
          return res.status(200).json({ status: "processing" });
        }
      } catch (err: any) {
        console.log("Fal polling error:", err.message);
        // Return 200 OK so Axios doesn't treat it as a transient network crash.
        // The frontend will see status: "failed", trigger HARD_FAIL, and clear the loader!
        return res.status(200).json({ status: "failed", error: err.message });
      }
    } else if (provider === "piapi") {
      if (!PI_KEY) throw new Error("Missing PI_KEY");
      const resp = await fetch(`https://api.piapi.ai/api/v1/task/${jobId}`, {
        headers: { "X-API-Key": PI_KEY },
      });
      if (!resp.ok) throw new Error("PiAPI polling error");
      const { data } = await resp.json();
      const status = data.status.toLowerCase();

      if (status === "completed") {
        const videoUrl = data.output?.video_url || data.output;
        if (!videoUrl) throw new Error("PiAPI status completed but no video");

        const videoBase64 = await fetchAsBase64(videoUrl);
        return res
          .status(200)
          .json({ status: "succeeded", videoBase64, videoUrl });
      } else if (status === "failed") {
        return res
          .status(200)
          .json({ status: "failed", error: "PiAPI task failed" });
      } else {
        return res.status(200).json({ status: "processing" });
      }
    } else {
      return res.status(400).json({ error: "Unknown provider " + provider });
    }
  } catch (err: any) {
    console.error("pollVideoStatus error:", err);
    return res.status(500).json({ error: err.message, status: "failed" });
  }
}

export async function dreamActorRoute(req: any, res: any) {
  try {
    const { video, characterImage, startImage } = req.body;
    const imageToUse = characterImage || startImage;

    if (!imageToUse || !video) {
      return res.status(400).json({ error: "DreamActor requires both an image and a video." });
    }

    const token = process.env.REPLI_KEY || process.env.REPLICATE_API_TOKEN;
    if (!token) return res.status(500).json({ error: "Missing Replicate Token" });

    const input = {
      image: imageToUse,
      video: video,
      cut_first_second: true
    };

    const replicateUrl = "https://api.replicate.com/v1/models/bytedance/dreamactor-m2.0/predictions";
    const postResponse = await fetch(replicateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ input })
    });

    if (!postResponse.ok) {
      const text = await postResponse.text();
      console.error("DreamActor POST error:", text);
      return res.status(502).json({ error: text });
    }

    const prediction = await postResponse.json();
    return res.status(200).json({
      status: "starting",
      jobId: prediction.id,
      provider: "replicate",
      modelEndpoint: "dreamActorRoute"
    });
  } catch (err: any) {
    console.error("dreamActorRoute error:", err);
    return res.status(500).json({ error: err.message });
  }
}
