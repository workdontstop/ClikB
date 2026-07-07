import { Request, Response } from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import Replicate from "replicate";

dotenv.config();

export const generateReplicateTtsAudio = async (req: Request, res: Response): Promise<any> => {
  try {
    const { text, voice, prompt, language_code } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Missing text parameter" });
    }

    const replicate = new Replicate({
      auth: process.env.REPLI_KEY || process.env.REPLICATE_API_TOKEN,
    });

    console.log("Calling Gemini TTS on Replicate with voice:", voice || "default");

    // https://replicate.com/google/gemini-3.1-flash-tts
    const output: any = await replicate.run(
      "google/gemini-3.1-flash-tts",
      {
        input: {
          text,
          voice,
          prompt,
          language_code: language_code || "en-US",
        },
      }
    );

    let buffer: Buffer;
    if (typeof output === "string") {
        // Old style replicate API returns URL
        const audioResp = await fetch(output);
        const audioArr = await audioResp.arrayBuffer();
        buffer = Buffer.from(audioArr);
    } else if (output && typeof output.arrayBuffer === "function") {
        // Stream or FileOutput object from replicate sdk
        const arr = await output.arrayBuffer();
        buffer = Buffer.from(arr);
    } else if (Array.isArray(output) && typeof output[0] === "string") {
        const audioResp = await fetch(output[0]);
        const audioArr = await audioResp.arrayBuffer();
        buffer = Buffer.from(audioArr);
    } else {
        // Fallback
        const audioResp = await fetch(String(output));
        const audioArr = await audioResp.arrayBuffer();
        buffer = Buffer.from(audioArr);
    }

    // Return base64 string matching Google TTS format
    const base64Audio = buffer.toString("base64");
    res.json({ audioContent: base64Audio });

  } catch (err: any) {
    console.error("generateReplicateTtsAudio Error:", err);
    res.status(500).json({ error: err.message });
  }
};
