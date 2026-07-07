import Replicate from "replicate";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function fetchAsBase64(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to fetch file for base64: ${resp.status}`);
  }
  const buffer = Buffer.from(await resp.arrayBuffer());
  return `data:video/mp4;base64,${buffer.toString("base64")}`;
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
    } = req.body ?? {};

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

    if (image_urls.length > 0) {
      if (hasCharacters) {
        payload.reference_images = image_urls;
      } else {
        payload.image = image_urls[0];
        if (endImageUrl && typeof endImageUrl === "string") {
          payload.last_frame_image = endImageUrl;
        }
      }
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
