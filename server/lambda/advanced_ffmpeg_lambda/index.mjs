import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const REGION = process.env.AWS_REGION || "us-east-1";
const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET || "clikbatebucket";
const OUTPUT_PREFIX = process.env.OUTPUT_PREFIX || "lambda-ffmpeg/";
const FFMPEG_PATH = process.env.FFMPEG_PATH || "/opt/bin/ffmpeg";
const FFPROBE_PATH = process.env.FFPROBE_PATH || "/opt/bin/ffprobe";
const WORK_DIR = "/tmp/clikbate_ffmpeg";
const DEFAULT_WIDTH = Number(process.env.OUTPUT_WIDTH || 1080);
const DEFAULT_HEIGHT = Number(process.env.OUTPUT_HEIGHT || 1920);
const DEFAULT_FPS = Number(process.env.OUTPUT_FPS || 24);
const DEFAULT_IMAGE_XFADE_SEC = Number(process.env.IMAGE_XFADE_SEC || 0.2);

const s3 = new S3Client({ region: REGION }); // narration silence-trim build 2026-06-12

export const handler = async (event) => {
  let recipe = null;
  try {
    recipe = normalizeRecipeForMode(parseEvent(event));
    validateRecipe(recipe);

    const output = getOutputConfig(recipe);
    const width = Number(
      recipe.output?.width || recipe.outputWidth || DEFAULT_WIDTH
    );
    const height = Number(
      recipe.output?.height || recipe.outputHeight || DEFAULT_HEIGHT
    );
    const fps = Number(recipe.output?.fps || recipe.outputFps || DEFAULT_FPS);
    const transition = recipe.rules?.transition || {};
    const transitionType = String(transition.type || "cut").toLowerCase();
    const transitionEnabled =
      transition.betweenScenes === true && transitionType === "xfade";
    const transitionSec = Number(recipe.rules?.transition?.durationSec || 0.35);

    resetWorkspace();

    console.log("Lambda FFmpeg recipe:", JSON.stringify(recipe, null, 2));
    await writeStatus(recipe, {
      state: "processing",
      stage: "starting",
      progress: 2,
      message: "Preparing Lambda FFmpeg workspace.",
    });

    const processedScenePaths = [];
    const processedSceneDurations = [];

    for (let i = 0; i < recipe.scenes.length; i++) {
      await writeStatus(recipe, {
        state: "processing",
        stage: "scene",
        progress: Math.round(5 + (i / recipe.scenes.length) * 55),
        message: `Processing scene ${i + 1} of ${recipe.scenes.length}.`,
        sceneIndex: i,
      });

      const result = await processScene({
        scene: recipe.scenes[i],
        sceneIndex: i,
        width,
        height,
        fps,
        imageDurationSec: Number(
          recipe.rules?.imageDurationWithoutNarrationSec || 5
        ),
        imageTransitionSec:
          recipe.rules?.imageTransition?.enabled === false
            ? 0
            : Number(
                recipe.rules?.imageTransition?.durationSec ||
                  DEFAULT_IMAGE_XFADE_SEC
              ),
        videoAudioVolumeWithNarration: Number(
          recipe.rules?.videoAudioVolumeWithNarration ?? 0.4
        ),
        narrationTrim: {
          // TTS files often carry a long silent tail. Because the scene's
          // targetDuration is the narration FILE duration, that tail used to
          // hold/show trailing B-shot visuals with no voice. Default OFF unless explicitly enabled.
          enabled: recipe.rules?.narrationSilenceTrim?.enabled === true,
          noiseDb: Number(recipe.rules?.narrationSilenceTrim?.noiseDb ?? -35),
          minSilenceSec: Number(
            recipe.rules?.narrationSilenceTrim?.minSilenceSec ?? 0.3
          ),
          tailPadSec: Number(
            recipe.rules?.narrationSilenceTrim?.tailPadSec ?? 0.35
          ),
        },
      });

      if (result?.path && result.duration > 0) {
        processedScenePaths.push(result.path);
        processedSceneDurations.push(result.duration);
      }
    }

    if (processedScenePaths.length === 0) {
      throw new Error("No processable scenes were produced from the recipe.");
    }

    const stitchedPath = path.join(WORK_DIR, "stitched_without_bg.mp4");
    if (processedScenePaths.length === 1) {
      await writeStatus(recipe, {
        state: "processing",
        stage: "stitching",
        progress: 65,
        message: "Preparing final scene.",
      });
      fs.copyFileSync(processedScenePaths[0], stitchedPath);
    } else if (transitionEnabled) {
      await writeStatus(recipe, {
        state: "processing",
        stage: "stitching",
        progress: 65,
        message: "Stitching scenes with transitions.",
      });
      stitchScenesWithXfade({
        scenePaths: processedScenePaths,
        sceneDurations: processedSceneDurations,
        transitionSec,
        fps,
        outputPath: stitchedPath,
      });
    } else {
      await writeStatus(recipe, {
        state: "processing",
        stage: "stitching",
        progress: 65,
        message: "Stitching scenes without transitions.",
      });
      if (!isMusicVideoMode(recipe) && hasNarratedScenes(recipe)) {
        concatClipsWithCleanTimestamps({
          clipPaths: processedScenePaths,
          outputPath: stitchedPath,
          fps,
        });
      } else {
        concatClipsFast({
          clipPaths: processedScenePaths,
          outputPath: stitchedPath,
        });
      }
    }

    pruneWorkspaceForFinalRender({
      keepPaths: [stitchedPath],
    });

    const finalPath = path.join(WORK_DIR, "final_output.mp4");
    await writeStatus(recipe, {
      state: "processing",
      stage: "background-music",
      progress: 78,
      message: isMusicVideoMode(recipe)
        ? "Applying master song audio."
        : "Mixing global background music.",
    });
    await applyBackgroundMusic({
      recipe,
      inputPath: stitchedPath,
      outputPath: finalPath,
    });

    await writeStatus(recipe, {
      state: "processing",
      stage: "uploading",
      progress: 92,
      message: "Uploading final video to S3.",
    });
    await uploadFinalVideo({
      localPath: finalPath,
      bucket: output.bucket,
      key: output.key,
    });

    const finalVideoUrl = `https://${
      output.bucket
    }.s3.${REGION}.amazonaws.com/${encodeURI(output.key)}`;
    console.log("Final video URL:", finalVideoUrl);

    await writeStatus(recipe, {
      state: "complete",
      stage: "complete",
      progress: 100,
      message: "Final video is ready.",
      finalVideoUrl,
      bucket: output.bucket,
      key: output.key,
    });

    return jsonResponse(200, {
      message: "Video processed",
      finalVideoUrl,
      bucket: output.bucket,
      key: output.key,
    });
  } catch (error) {
    console.error("Lambda FFmpeg error:", error);
    if (recipe) {
      await writeStatus(recipe, {
        state: "failed",
        stage: "failed",
        progress: 100,
        message: error?.message || "Unknown Lambda FFmpeg error",
      }).catch((statusError) => {
        console.error("Could not write failure status:", statusError);
      });
    }
    return jsonResponse(500, {
      error: error?.message || "Unknown Lambda FFmpeg error",
    });
  }
};

function parseEvent(event) {
  if (!event) return {};

  if (event.body) {
    return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  }

  return typeof event === "string" ? JSON.parse(event) : event;
}

function validateRecipe(recipe) {
  if (!recipe || typeof recipe !== "object") {
    throw new Error("Missing recipe payload.");
  }

  if (!Array.isArray(recipe.scenes) || recipe.scenes.length === 0) {
    throw new Error("Recipe must include a non-empty scenes array.");
  }

  if (isMusicVideoMode(recipe)) {
    validateMusicVideoRecipe(recipe);
  }
}

function normalizeRecipeForMode(recipe) {
  if (!isMusicVideoMode(recipe)) return recipe;

  return {
    ...recipe,
    hasNarration: false,
    scenes: Array.isArray(recipe.scenes)
      ? recipe.scenes.map((scene) => ({
          ...scene,
          narration: null,
        }))
      : recipe.scenes,
  };
}

function validateMusicVideoRecipe(recipe) {
  const songUrl = recipe.backgroundMusic?.url || recipe.bgMusic || null;
  if (!isUsableUrl(songUrl)) {
    throw new Error("Music video mode requires a song URL.");
  }

  recipe.scenes.forEach((scene, sceneIndex) => {
    const visuals = normalizeVisualArray(scene.visuals);
    if (visuals.length === 0) {
      throw new Error(`Music video scene ${sceneIndex + 1} has no generated videos.`);
    }

    visuals.forEach((visual, visualIndex) => {
      const role = String(visual.role || "").toLowerCase();
      const type = String(visual.type || "").toLowerCase();

      if (role === "b-shot" || role === "bshot") {
        throw new Error(
          `Music video mode does not accept B-shots. Scene ${sceneIndex + 1}, visual ${visualIndex + 1}.`
        );
      }

      if (type === "image" || looksLikeImageUrl(visual.url)) {
        throw new Error(
          `Music video mode requires video for every shot. Missing video at scene ${sceneIndex + 1}, visual ${visualIndex + 1}.`
        );
      }
    });
  });
}

function getOutputConfig(recipe) {
  const output = recipe.output || {};
  const rawBucket = output.bucket || recipe.outputBucket || OUTPUT_BUCKET;
  const bucket = String(rawBucket)
    .replace(/^s3:\/\//, "")
    .replace(/\/.*$/, "");
  const filename =
    output.filename ||
    recipe.outputFilename ||
    `post_${recipe.postId || "unknown"}_${Date.now()}.mp4`;
  const prefix = output.prefix || recipe.outputPrefix || OUTPUT_PREFIX;
  const cleanPrefix = prefix
    ? String(prefix).replace(/^\/+/, "").replace(/\/?$/, "/")
    : "";
  const key = output.key || recipe.outputKey || `${cleanPrefix}${filename}`;

  return { bucket, key };
}

function resetWorkspace() {
  fs.rmSync(WORK_DIR, { recursive: true, force: true });
  fs.mkdirSync(WORK_DIR, { recursive: true });
}

function pruneWorkspaceForFinalRender({ keepPaths }) {
  const keep = new Set(keepPaths.map((keepPath) => path.resolve(keepPath)));

  for (const entry of fs.readdirSync(WORK_DIR)) {
    const entryPath = path.resolve(path.join(WORK_DIR, entry));
    if (keep.has(entryPath)) continue;
    fs.rmSync(entryPath, { recursive: true, force: true });
  }
}

async function processScene({
  scene,
  sceneIndex,
  width,
  height,
  fps,
  imageDurationSec,
  imageTransitionSec,
  videoAudioVolumeWithNarration,
  narrationTrim,
}) {
  const sceneDir = path.join(WORK_DIR, `scene_${sceneIndex}`);
  fs.mkdirSync(sceneDir, { recursive: true });

  const narrationUrl = getNarrationUrl(scene.narration);
  const usesFixedVideoTimeline = !isUsableUrl(narrationUrl) &&
    isFinitePositiveNumber(scene?.targetDurationSec);
  let narrationPath = null;
  let narrationDuration = 0;

  if (isUsableUrl(narrationUrl)) {
    narrationPath = path.join(sceneDir, "narration");
    await downloadUrlToFile(narrationUrl, narrationPath);
    narrationDuration = getDuration(narrationPath);
    console.log(
      `Scene ${sceneIndex}: narration file duration ${narrationDuration}s`
    );

    if (narrationTrim?.enabled === true && narrationDuration > 0) {
      const trimmed = trimTrailingNarrationSilence({
        inputPath: narrationPath,
        outputPath: path.join(sceneDir, "narration_trimmed.m4a"),
        fileDuration: narrationDuration,
        noiseDb: narrationTrim?.noiseDb ?? -35,
        minSilenceSec: narrationTrim?.minSilenceSec ?? 0.3,
        tailPadSec: narrationTrim?.tailPadSec ?? 0.35,
      });
      if (trimmed) {
        console.log(
          `Scene ${sceneIndex}: trimmed trailing narration silence ` +
            `${(narrationDuration - trimmed.duration).toFixed(2)}s ` +
            `(speech-based duration ${trimmed.duration.toFixed(2)}s)`
        );
        narrationPath = trimmed.path;
        narrationDuration = trimmed.duration;
      }
    }
  }

  const normalizedVisuals = [];
  const visuals = normalizeVisualArray(scene.visuals);

  for (let visualIndex = 0; visualIndex < visuals.length; visualIndex++) {
    const visual = visuals[visualIndex];
    if (!isUsableUrl(visual.url)) continue;

    const rawPath = path.join(
      sceneDir,
      `raw_visual_${visualIndex}${extensionForVisual(visual)}`
    );
    const normalizedPath = path.join(
      sceneDir,
      `normalized_visual_${visualIndex}.mp4`
    );
    await downloadUrlToFile(visual.url, rawPath);

    const isImage = visual.type === "image" || looksLikeImageUrl(visual.url);
    const requestedSlotDuration = Number(visual.targetDurationSec);
    const duration = usesFixedVideoTimeline && isFinitePositiveNumber(requestedSlotDuration)
      ? requestedSlotDuration
      : isImage
        ? imageDurationSec
        : Math.max(getDuration(rawPath), imageDurationSec);

    if (isImage) {
      createImageClip({
        inputPath: rawPath,
        outputPath: normalizedPath,
        duration,
        width,
        height,
        fps,
      });
    } else {
      createVideoClip({
        inputPath: rawPath,
        outputPath: normalizedPath,
        duration,
        width,
        height,
        fps,
        enforceDuration: usesFixedVideoTimeline,
      });
    }

    normalizedVisuals.push({
      path: normalizedPath,
      duration,
      type: isImage ? "image" : "video",
    });
  }

  if (normalizedVisuals.length === 0 && narrationDuration > 0) {
    const blackClipPath = path.join(sceneDir, "black_visual.mp4");
    createBlackClip({
      outputPath: blackClipPath,
      duration: narrationDuration,
      width,
      height,
      fps,
    });
    normalizedVisuals.push({
      path: blackClipPath,
      duration: narrationDuration,
      type: "video",
    });
  }

  if (normalizedVisuals.length === 0) {
    console.warn(`Scene ${sceneIndex}: no visuals and no narration, skipped.`);
    return null;
  }

  const rawScenePath = path.join(sceneDir, "raw_scene.mp4");
  stitchVisualClips({
    clips: normalizedVisuals,
    outputPath: rawScenePath,
    imageTransitionSec,
    clipsAlreadyNormalized: usesFixedVideoTimeline,
    fps,
    useCleanAudioConcat: narrationDuration > 0,
  });

  const rawSceneDuration = getDuration(rawScenePath);
  const visualDuration =
    rawSceneDuration > 0
      ? rawSceneDuration
      : normalizedVisuals.reduce((sum, visual) => sum + visual.duration, 0);
  const targetDuration = usesFixedVideoTimeline
    ? Number(scene.targetDurationSec)
    : narrationDuration > 0
      ? Math.max(narrationDuration, visualDuration)
      : visualDuration;
  const fittedScenePath = path.join(sceneDir, "fitted_scene.mp4");

  if (usesFixedVideoTimeline) {
    fs.copyFileSync(rawScenePath, fittedScenePath);
  } else {
    fitSceneDuration({
      inputPath: rawScenePath,
      outputPath: fittedScenePath,
      targetDuration,
      width,
      height,
      fps,
    });
  }

  const finalScenePath = path.join(WORK_DIR, `final_scene_${sceneIndex}.mp4`);

  if (narrationPath && narrationDuration > 0) {
    mixSceneNarration({
      sceneVideoPath: fittedScenePath,
      narrationPath,
      outputPath: finalScenePath,
      targetDuration,
      videoAudioVolume: videoAudioVolumeWithNarration,
    });
  } else {
    fs.copyFileSync(fittedScenePath, finalScenePath);
  }

  const finalDuration = getDuration(finalScenePath);
  console.log(`Scene ${sceneIndex}: final duration ${finalDuration}s`);

  return {
    path: finalScenePath,
    duration: finalDuration,
  };
}

function createImageClip({
  inputPath,
  outputPath,
  duration,
  width,
  height,
  fps,
}) {
  const vf = normalizeVideoFilter({ width, height, fps });
  runFfmpeg(
    [
      "-y",
      "-loop",
      "1",
      "-framerate",
      String(fps),
      "-t",
      String(duration),
      "-i",
      inputPath,
      "-f",
      "lavfi",
      "-t",
      String(duration),
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=48000",
      "-filter_complex",
      `[0:v]${vf}[v];[1:a]atrim=0:${duration},asetpts=PTS-STARTPTS[a]`,
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-t",
      String(duration),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    "create image clip"
  );
}

function createVideoClip({
  inputPath,
  outputPath,
  duration,
  width,
  height,
  fps,
  enforceDuration = false,
}) {
  const vf = normalizeVideoFilter({ width, height, fps });
  const videoFilter = enforceDuration
    ? `setpts=PTS-STARTPTS,${vf},tpad=stop_mode=clone:stop_duration=${duration},trim=0:${duration},setpts=PTS-STARTPTS`
    : vf;
  const inputHasAudio = hasAudio(inputPath);

  if (inputHasAudio) {
    runFfmpeg(
      [
        "-y",
        "-fflags",
        "+genpts",
        "-i",
        inputPath,
        "-filter_complex",
        `[0:v]${videoFilter}[v];[0:a:0]aformat=channel_layouts=stereo,apad,atrim=0:${duration},asetpts=PTS-STARTPTS[a]`,
        "-map",
        "[v]",
        "-map",
        "[a]",
        "-t",
        String(duration),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-avoid_negative_ts",
        "make_zero",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      "create video clip with native audio"
    );
  } else {
    runFfmpeg(
      [
        "-y",
        "-i",
        inputPath,
        "-f",
        "lavfi",
        "-t",
        String(duration),
        "-fflags",
        "+genpts",
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=48000",
        "-filter_complex",
        `[0:v]${videoFilter}[v];[1:a]atrim=0:${duration},asetpts=PTS-STARTPTS[a]`,
        "-map",
        "[v]",
        "-map",
        "[a]",
        "-t",
        String(duration),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-avoid_negative_ts",
        "make_zero",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      "create video clip with injected silence"
    );
  }
}

function createBlackClip({ outputPath, duration, width, height, fps }) {
  runFfmpeg(
    [
      "-y",
      "-f",
      "lavfi",
      "-t",
      String(duration),
      "-i",
      `color=c=black:s=${width}x${height}:r=${fps}`,
      "-f",
      "lavfi",
      "-t",
      String(duration),
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=48000",
      "-map",
      "0:v",
      "-map",
      "1:a",
      "-t",
      String(duration),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    "create black fallback clip"
  );
}

function stitchVisualClips({
  clips,
  outputPath,
  imageTransitionSec,
  clipsAlreadyNormalized = false,
  fps,
  useCleanAudioConcat = false,
}) {
  if (clipsAlreadyNormalized) {
    concatClipsFast({
      clipPaths: clips.map((clip) => clip.path),
      outputPath,
    });
    return;
  }
  if (clips.length === 1) {
    fs.copyFileSync(clips[0].path, outputPath);
    return;
  }

  const joinClips = (clipPaths) =>
    useCleanAudioConcat
      ? concatClipsWithCleanTimestamps({ clipPaths, outputPath, fps })
      : concatClipsFast({ clipPaths, outputPath });

  const hasImageToImageBoundary = clips.some(
    (clip, index) =>
      index > 0 && clip.type === "image" && clips[index - 1].type === "image"
  );

  if (!hasImageToImageBoundary || imageTransitionSec <= 0) {
    joinClips(clips.map((clip) => clip.path));
    return;
  }

  const groupedClipPaths = [];
  let groupIndex = 0;

  for (let index = 0; index < clips.length; ) {
    const clip = clips[index];

    if (clip.type !== "image") {
      groupedClipPaths.push(clip.path);
      index++;
      continue;
    }

    const imageGroup = [];
    while (index < clips.length && clips[index].type === "image") {
      imageGroup.push(clips[index]);
      index++;
    }

    if (imageGroup.length === 1) {
      groupedClipPaths.push(imageGroup[0].path);
      continue;
    }

    const groupPath = outputPath.replace(
      /\.mp4$/,
      `_image_xfade_${groupIndex++}.mp4`
    );

    xfadeImageGroup({
      clips: imageGroup,
      outputPath: groupPath,
      transitionSec: imageTransitionSec,
      fps,
    });

    groupedClipPaths.push(groupPath);
  }

  joinClips(groupedClipPaths);
}

function xfadeImageGroup({ clips, outputPath, transitionSec, fps }) {
  const shortestClip = Math.min(
    ...clips.map((clip) => clip.duration).filter((value) => value > 0)
  );
  const safeTransition = Math.max(
    0.05,
    Math.min(transitionSec, shortestClip / 3)
  );
  const args = ["-y"];

  clips.forEach((clip) => {
    args.push("-i", clip.path);
  });

  const filters = [];
  for (let i = 0; i < clips.length; i++) {
    filters.push(
      `[${i}:v]settb=AVTB,setpts=PTS-STARTPTS,fps=${fps},format=yuv420p[v${i}]`
    );
    filters.push(
      `[${i}:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS[a${i}]`
    );
  }

  let vPrev = "v0";
  let aPrev = "a0";
  let currentDuration = clips[0].duration;

  for (let i = 1; i < clips.length; i++) {
    const vOut = `ivx${i}`;
    const aOut = `iax${i}`;
    const offset = Math.max(0, currentDuration - safeTransition);

    filters.push(
      `[${vPrev}][v${i}]xfade=transition=fade:duration=${safeTransition}:offset=${offset}[${vOut}]`
    );
    filters.push(
      `[${aPrev}][a${i}]acrossfade=d=${safeTransition}:c1=tri:c2=tri[${aOut}]`
    );

    vPrev = vOut;
    aPrev = aOut;
    currentDuration = currentDuration + clips[i].duration - safeTransition;
  }

  runFfmpeg(
    [
      ...args,
      "-filter_complex",
      filters.join(";"),
      "-map",
      `[${vPrev}]`,
      "-map",
      `[${aPrev}]`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    "xfade consecutive image clips"
  );
}

function concatClipsFast({ clipPaths, outputPath }) {
  const listPath = outputPath.replace(/\.mp4$/, "_concat.txt");
  fs.writeFileSync(
    listPath,
    clipPaths.map((clipPath) => `file '${clipPath}'`).join("\n")
  );

  try {
    runFfmpeg(
      [
        "-y",
        "-fflags",
        "+genpts",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listPath,
        "-c",
        "copy",
        "-avoid_negative_ts",
        "make_zero",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      "fast concat visual clips"
    );
  } catch (error) {
    console.warn(
      "Fast concat failed; falling back to re-encoded concat:",
      error?.message || error
    );
    concatClips({
      clipPaths,
      outputPath,
    });
  }
}

function concatClips({ clipPaths, outputPath }) {
  const listPath = outputPath.replace(/\.mp4$/, "_concat.txt");
  fs.writeFileSync(
    listPath,
    clipPaths.map((clipPath) => `file '${clipPath}'`).join("\n")
  );

  runFfmpeg(
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    "concat visual clips"
  );
}

function concatClipsWithCleanTimestamps({ clipPaths, outputPath, fps }) {
  const args = ["-y"];
  const filters = [];
  const concatInputs = [];

  clipPaths.forEach((clipPath, index) => {
    args.push("-i", clipPath);
    filters.push(
      `[${index}:v]setpts=PTS-STARTPTS,fps=${fps},format=yuv420p[v${index}]`
    );
    filters.push(
      `[${index}:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS[a${index}]`
    );
    concatInputs.push(`[v${index}][a${index}]`);
  });

  filters.push(
    `${concatInputs.join("")}concat=n=${clipPaths.length}:v=1:a=1[vout][aout]`
  );

  runFfmpeg(
    [
      ...args,
      "-filter_complex",
      filters.join(";"),
      "-map",
      "[vout]",
      "-map",
      "[aout]",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    "concat clips with clean timestamps"
  );
}


function fitSceneDuration({
  inputPath,
  outputPath,
  targetDuration,
  width,
  height,
  fps,
}) {
  const currentDuration = getDuration(inputPath);
  const safeTarget = Math.max(targetDuration, 0.1);
  const stopDuration = Math.max(0, safeTarget - currentDuration);
  const vf = normalizeVideoFilter({ width, height, fps });

  runFfmpeg(
    [
      "-y",
      "-i",
      inputPath,
      "-filter_complex",
      `[0:v]${vf},tpad=stop_mode=clone:stop_duration=${stopDuration},trim=0:${safeTarget},setpts=PTS-STARTPTS[v];` +
        `[0:a]aformat=channel_layouts=stereo,apad,atrim=0:${safeTarget},asetpts=PTS-STARTPTS[a]`,
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-t",
      String(safeTarget),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    "fit scene duration"
  );
}

function mixSceneNarration({
  sceneVideoPath,
  narrationPath,
  outputPath,
  targetDuration,
  videoAudioVolume,
}) {
  const safeTarget = Math.max(targetDuration, 0.1);

  runFfmpeg(
    [
      "-y",
      "-i",
      sceneVideoPath,
      "-i",
      narrationPath,
      "-filter_complex",
      `[0:v]tpad=stop_mode=clone:stop_duration=${safeTarget},trim=0:${safeTarget},setpts=PTS-STARTPTS[vout];` +
        `[0:a]volume=${videoAudioVolume},apad,atrim=0:${safeTarget},asetpts=PTS-STARTPTS[ambient];` +
        `[1:a]volume=1.0,apad,atrim=0:${safeTarget},asetpts=PTS-STARTPTS[narration];` +
        `[ambient][narration]amix=inputs=2:duration=first:dropout_transition=0[aout]`,
      "-map",
      "[vout]",
      "-map",
      "[aout]",
      "-t",
      String(safeTarget),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    "mix narration with ducked scene audio (locked a/v duration)"
  );
}

function stitchScenesWithXfade({
  scenePaths,
  sceneDurations,
  transitionSec,
  fps,
  outputPath,
}) {
  const shortestScene = Math.min(
    ...sceneDurations.filter((value) => value > 0)
  );
  const safeTransition = Math.max(
    0.05,
    Math.min(transitionSec, shortestScene / 3)
  );
  const args = ["-y"];

  scenePaths.forEach((scenePath) => {
    args.push("-i", scenePath);
  });

  const filters = [];
  for (let i = 0; i < scenePaths.length; i++) {
    filters.push(
      `[${i}:v]settb=AVTB,setpts=PTS-STARTPTS,fps=${fps},format=yuv420p[v${i}]`
    );
    filters.push(
      `[${i}:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS[a${i}]`
    );
  }

  let vPrev = "v0";
  let aPrev = "a0";
  let currentDuration = sceneDurations[0];

  for (let i = 1; i < scenePaths.length; i++) {
    const vOut = `vx${i}`;
    const aOut = `ax${i}`;
    const offset = Math.max(0, currentDuration - safeTransition);

    filters.push(
      `[${vPrev}][v${i}]xfade=transition=fade:duration=${safeTransition}:offset=${offset}[${vOut}]`
    );
    filters.push(
      `[${aPrev}][a${i}]acrossfade=d=${safeTransition}:c1=tri:c2=tri[${aOut}]`
    );

    vPrev = vOut;
    aPrev = aOut;
    currentDuration = currentDuration + sceneDurations[i] - safeTransition;
  }

  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    `[${vPrev}]`,
    "-map",
    `[${aPrev}]`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    outputPath
  );

  try {
    runFfmpeg(args, "stitch scenes with xfade");
  } catch (error) {
    console.warn(
      "Scene xfade failed; falling back to direct scene concat:",
      error?.message || error
    );
    concatClipsFast({
      clipPaths: scenePaths,
      outputPath,
    });
  }
}

async function applyBackgroundMusic({ recipe, inputPath, outputPath }) {
  const bgUrl = recipe.backgroundMusic?.url || recipe.bgMusic || null;
  const musicVideoMode = isMusicVideoMode(recipe);

  if (!isUsableUrl(bgUrl)) {
    if (musicVideoMode) {
      throw new Error("Music video mode requires a song URL.");
    }

    console.warn(
      "No background music URL supplied; copying stitched video without global music."
    );
    fs.copyFileSync(inputPath, outputPath);
    return;
  }

  const bgPath = path.join(WORK_DIR, "background_music");
  await downloadUrlToFile(bgUrl, bgPath);

  const finalDuration = getDuration(inputPath);
  const bgDuration = getDuration(bgPath);
  const bgDb = resolveBackgroundDb(recipe);

  if (musicVideoMode) {
    const requestedTimelineDuration = Number(recipe.musicTimelineDurationSec);
    const masterDuration = isFinitePositiveNumber(requestedTimelineDuration)
      ? requestedTimelineDuration
      : bgDuration > 0 ? bgDuration : finalDuration;
    const videoPadDuration = Math.max(0, masterDuration - finalDuration);

    if (finalDuration <= 0) {
      throw new Error("Music video mode could not read stitched video duration.");
    }

    if (masterDuration <= 0) {
      throw new Error("Music video mode could not read song duration.");
    }

    if (!hasAudio(bgPath)) {
      throw new Error("Music video mode song has no readable audio stream.");
    }

    if (bgDuration > 0 && bgDuration + 0.25 < masterDuration) {
      throw new Error(
        `Music video song is ${bgDuration.toFixed(2)}s but the visual timeline requires ${masterDuration.toFixed(2)}s.`
      );
    }

    console.log(
      `Music video timeline duration ${masterDuration}s ` +
        `(video ${finalDuration}s, song ${bgDuration}s)`
    );

    if (finalDuration + 0.25 >= masterDuration) {
      runFfmpeg(
        [
          "-y",
          "-i",
          inputPath,
          "-i",
          bgPath,
          "-map",
          "0:v:0",
          "-map",
          "1:a:0",
          "-t",
          String(masterDuration),
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-ar",
          "48000",
          "-ac",
          "2",
          "-movflags",
          "+faststart",
          outputPath,
        ],
        "mux master music video audio"
      );
      return;
    }

    runFfmpeg(
      [
        "-y",
        "-i",
        inputPath,
        "-i",
        bgPath,
        "-filter_complex",
        `[0:v]tpad=stop_mode=clone:stop_duration=${videoPadDuration},trim=0:${masterDuration},setpts=PTS-STARTPTS[vout];` +
          `[1:a]aformat=channel_layouts=stereo,volume=${bgDb}dB,atrim=0:${masterDuration},asetpts=PTS-STARTPTS[aout]`,
        "-map",
        "[vout]",
        "-map",
        "[aout]",
        "-t",
        String(masterDuration),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      "apply master music video audio"
    );
    return;
  }

  runFfmpeg(
    [
      "-y",
      "-i",
      inputPath,
      "-stream_loop",
      "-1",
      "-i",
      bgPath,
      "-filter_complex",
      `[0:a]aformat=channel_layouts=stereo,volume=1.0[a0];` +
        `[1:a]aformat=channel_layouts=stereo,volume=${bgDb}dB,atrim=0:${finalDuration},asetpts=PTS-STARTPTS[bg];` +
        `[a0][bg]amix=inputs=2:duration=first:dropout_transition=0[aout]`,
      "-map",
      "0:v",
      "-map",
      "[aout]",
      "-t",
      String(finalDuration),
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    "apply global background music"
  );
}

function resolveBackgroundDb(recipe) {
  if (isMusicVideoMode(recipe)) return 0;

  if (Number.isFinite(Number(recipe.backgroundMusic?.db))) {
    return Number(recipe.backgroundMusic.db);
  }

  if (recipe.usedanimate) return -60;
  if (recipe.mode === "meme" || Number(recipe.type) === 0) return -13;
  if (recipe.hasNarration) return -25;
  return -13;
}

function isMusicVideoMode(recipe) {
  const mode = String(recipe?.mode || "").toLowerCase();
  return mode === "music-video" || mode === "music_video" || mode === "musicvideo";
}

function hasNarratedScenes(recipe) {
  return (
    recipe?.hasNarration === true ||
    (Array.isArray(recipe?.scenes) &&
      recipe.scenes.some((scene) => isUsableUrl(getNarrationUrl(scene?.narration))))
  );
}

async function uploadFinalVideo({ localPath, bucket, key }) {
  if (!bucket || !key) {
    throw new Error(
      `Invalid final upload target: bucket="${bucket || ""}", key="${
        key || ""
      }"`
    );
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(localPath),
      ContentType: "video/mp4",
      ACL: "public-read",
    })
  );
}

async function writeStatus(recipe, status) {
  const statusBucket = recipe.status?.bucket || OUTPUT_BUCKET;
  const statusKey = recipe.status?.key;
  if (!statusBucket || !statusKey) return;

  const payload = {
    jobId: recipe.jobId || null,
    postId: recipe.postId || null,
    updatedAt: new Date().toISOString(),
    ...status,
  };

  console.log("Writing Lambda status:", JSON.stringify(payload));

  await s3.send(
    new PutObjectCommand({
      Bucket: statusBucket,
      Key: statusKey,
      Body: JSON.stringify(payload),
      ContentType: "application/json",
    })
  );
}

async function downloadUrlToFile(url, dest) {
  const { bucket, key } = parseS3Url(url);
  if (!bucket || !key) {
    throw new Error(
      `Invalid S3 input URL. Parsed bucket="${bucket || ""}", key="${
        key || ""
      }" from "${url}"`
    );
  }

  console.log(`Downloading s3://${bucket}/${key} -> ${dest}`);
  const response = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  await pipeline(response.Body, fs.createWriteStream(dest));
}

function parseS3Url(rawUrl) {
  if (!isUsableUrl(rawUrl)) {
    throw new Error(`Invalid empty media URL: "${rawUrl}"`);
  }

  if (rawUrl.startsWith("s3://")) {
    const withoutScheme = rawUrl.replace(/^s3:\/\//, "");
    const slashIndex = withoutScheme.indexOf("/");
    if (slashIndex <= 0) {
      throw new Error(
        `Invalid s3:// media URL, missing bucket/key: "${rawUrl}"`
      );
    }

    return {
      bucket: withoutScheme.slice(0, slashIndex),
      key: decodeURIComponent(withoutScheme.slice(slashIndex + 1)),
    };
  }

  const url = new URL(rawUrl);
  const host = url.hostname;
  const pathParts = url.pathname.replace(/^\/+/, "").split("/");

  if (host === "s3.amazonaws.com" || host.startsWith("s3.")) {
    const [bucket, ...keyParts] = pathParts;
    if (!bucket || keyParts.length === 0) {
      throw new Error(
        `Invalid path-style S3 URL, missing bucket/key: "${rawUrl}"`
      );
    }

    return {
      bucket,
      key: decodeURIComponent(keyParts.join("/")),
    };
  }

  const bucket = host.split(".s3")[0];
  const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!bucket || !key) {
    throw new Error(
      `Invalid virtual-host S3 URL, missing bucket/key: "${rawUrl}"`
    );
  }

  return {
    bucket,
    key,
  };
}

function normalizeVisualArray(visuals) {
  if (!Array.isArray(visuals)) return [];

  return visuals
    .map((visual, index) => {
      if (typeof visual === "string") {
        return {
          role: index === 0 ? "a-shot" : "b-shot",
          type: looksLikeImageUrl(visual) ? "image" : "video",
          url: visual,
        };
      }
      return visual;
    })
    .filter((visual) => visual && isUsableUrl(visual.url));
}

function getNarrationUrl(narration) {
  if (!narration) return null;
  if (typeof narration === "string") return narration;
  return narration.url || null;
}

function isUsableUrl(url) {
  return (
    typeof url === "string" &&
    url.trim() !== "" &&

    url !== "EMPTY" &&
    url !== "EMPTY_BSHOT" &&
    url !== "ERROR"
  );
}

function isFinitePositiveNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function looksLikeImageUrl(url) {
  return /\.(png|jpe?g|webp)(\?|#|$)/i.test(url || "");
}

function extensionForVisual(visual) {
  if (visual.type === "image" || looksLikeImageUrl(visual.url)) {
    const match = String(visual.url || "").match(/\.(png|jpe?g|webp)(\?|#|$)/i);
    return match ? `.${match[1].toLowerCase()}` : ".jpg";
  }
  return ".mp4";
}

function normalizeVideoFilter({ width, height, fps }) {
  return (
    `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,` +
    `fps=${fps},setsar=1`
  );
}

/**
 * Detects trailing silence in a narration file (silencedetect) and, when the
 * file ends in silence, re-encodes it cut at speech end + tailPadSec.
 * Returns { path, duration } for the trimmed file, or null when no meaningful
 * trailing silence exists (or detection fails â€” fail open, keep original).
 */
function trimTrailingNarrationSilence({
  inputPath,
  outputPath,
  fileDuration,
  noiseDb = -35,
  minSilenceSec = 0.3,
  tailPadSec = 0.35,
}) {
  try {
    const probe = spawnSync(
      FFMPEG_PATH,
      [
        "-hide_banner",
        "-nostats",
        "-i",
        inputPath,
        "-af",
        `silencedetect=noise=${noiseDb}dB:d=${minSilenceSec}`,
        "-f",
        "null",
        "-",
      ],
      { encoding: "utf8" }
    );

    const log = `${probe.stderr || ""}${probe.stdout || ""}`;
    const events = [];
    const eventRegex = /silence_(start|end):\s*([0-9.]+)/g;
    let match;
    while ((match = eventRegex.exec(log)) !== null) {
      events.push({ kind: match[1], time: Number.parseFloat(match[2]) });
    }
    if (events.length === 0) return null;

    // Trailing silence: the last silence_start either has no matching
    // silence_end (silence runs to EOF) or its end lands at/near EOF.
    const last = events[events.length - 1];
    let trailingSilenceStart = null;
    if (last.kind === "start") {
      trailingSilenceStart = last.time;
    } else if (last.time >= fileDuration - 0.15 && events.length >= 2) {
      const prev = events[events.length - 2];
      if (prev.kind === "start") trailingSilenceStart = prev.time;
    }
    if (trailingSilenceStart === null) return null;

    const trimmedDuration = Math.min(
      fileDuration,
      trailingSilenceStart + tailPadSec
    );

    // Not worth a re-encode for a tail shorter than ~0.25s,
    // and never trim away effectively the whole file.
    if (fileDuration - trimmedDuration < 0.25 || trimmedDuration < 0.5) {
      return null;
    }

    runFfmpeg(
      [
        "-y",
        "-i",
        inputPath,
        "-t",
        trimmedDuration.toFixed(3),
        "-vn",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        outputPath,
      ],
      "trim trailing narration silence"
    );

    const actualDuration = getDuration(outputPath);
    if (actualDuration <= 0) return null;
    return { path: outputPath, duration: actualDuration };
  } catch (error) {
    console.warn(
      `Trailing-silence trim failed for ${inputPath}, keeping original:`,
      error?.message || error
    );
    return null;
  }
}

function getDuration(filePath) {
  try {
    const output = execFileSync(
      FFPROBE_PATH,
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath,
      ],
      { encoding: "utf8" }
    );

    const duration = Number.parseFloat(output.trim());
    return Number.isFinite(duration) ? duration : 0;
  } catch (error) {
    console.warn(
      `Could not probe duration for ${filePath}:`,
      error?.message || error
    );
    return 0;
  }
}

function hasAudio(filePath) {
  try {
    const output = execFileSync(
      FFPROBE_PATH,
      [
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=codec_type",
        "-of",
        "csv=p=0",
        filePath,
      ],
      { encoding: "utf8" }
    );

    return output.trim().includes("audio");
  } catch {
    return false;
  }
}

function runFfmpeg(args, label) {
  console.log(`FFmpeg: ${label}`);
  console.log(`${FFMPEG_PATH} ${args.join(" ")}`);

  const result = spawnSync(FFMPEG_PATH, args, {
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `FFmpeg failed during "${label}" with exit code ${result.status}`
    );
  }
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}
