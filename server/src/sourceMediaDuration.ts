import { MediaConvertClient, ProbeCommand, type ProbeResult } from "@aws-sdk/client-mediaconvert";
import dotenv from "dotenv";
import { probeMp4Duration } from './mp4Duration';

dotenv.config();

/**
 * Backend authority for source-media generation limits.
 *
 * EditStory currently offers 5s/10s creation and music-breaker durations.
 * Any future duration increase must be made here as well; the client value is
 * Upscaling may use the selected app duration when source measurement fails.
 * The other routes require a server measurement.
 */
export const SOURCE_MEDIA_MAX_SECONDS = 10;

export const SERVER_MEASURED_DURATION_FIELD = "__serverMeasuredDurationSeconds";

const SOURCE_MEDIA_ROUTES = new Set([
  "/omnihuman",
  "/dreamactorroute",
  "/lipsync2pro",
  "/upscalevideo",
]);

const mediaConvertClient = new MediaConvertClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
  endpoint:
    process.env.MEDIA_CONVERT_ENDPOINT ||
    "https://q25wbt2lc.mediaconvert.us-east-1.amazonaws.com",
});

const normalizedRoute = (route: string): string =>
  String(route || "").split("?")[0].toLowerCase();

const validMediaUrl = (value: unknown): string => {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate) throw new Error("The source media URL is missing.");
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("The source media URL is invalid.");
  }
  if (!["http:", "https:", "s3:"].includes(parsed.protocol)) {
    throw new Error("Source media must use an HTTP(S) or S3 URL.");
  }
  return candidate;
};

const sourceUrlsFor = (route: string, body: any): string[] => {
  switch (route) {
    case "/omnihuman":
      return [validMediaUrl(body?.lipSyncUrl)];
    case "/dreamactorroute":
      return [validMediaUrl(body?.video)];
    case "/lipsync2pro":
      // Loop/bounce/remap output can be governed by either input. Measuring
      // both and reserving against the longer source prevents underbilling.
      return [validMediaUrl(body?.videoUrl), validMediaUrl(body?.audioUrl)];
    case "/upscalevideo":
      return [validMediaUrl(body?.video || body?.url)];
    default:
      return [];
  }
};

const durationFromProbe = (result: ProbeResult | undefined): number => {
  const candidates = [
    Number(result?.Container?.Duration),
    ...(result?.Container?.Tracks || []).map((track) => Number(track?.Duration)),
  ].filter((value) => Number.isFinite(value) && value > 0);
  return candidates.length ? Math.max(...candidates) : 0;
};

/**
 * Measures source media before reservation/provider execution and stores the
 * billable duration as a non-enumerable server-only request field. For upscale,
 * use the selected app duration only when both measurement methods fail.
 */
export const attachMeasuredSourceDuration = async (routeValue: string, bodyValue: any): Promise<void> => {
  const route = normalizedRoute(routeValue);
  if (!SOURCE_MEDIA_ROUTES.has(route)) return;

  const body = bodyValue && typeof bodyValue === "object" ? bodyValue : {};
  // A client may submit this property, so always remove it before probing.
  delete body[SERVER_MEASURED_DURATION_FIELD];

  const sourceUrls = sourceUrlsFor(route, body);
  let durations: number[] = [];
  try {
    const response = await mediaConvertClient.send(new ProbeCommand({ InputFiles: sourceUrls.map((FileUrl) => ({ FileUrl })) }));
    durations = (response.ProbeResults || []).map(durationFromProbe);
  } catch (error: any) {
    console.warn('[Source duration] MediaConvert probe unavailable:', String(error?.name || 'probe failure'));
  }
  // Generated MP4s must remain usable when the optional Probe API lacks IAM
  // access. Measure real container metadata; never trust client duration.
  if (route === '/upscalevideo' && (durations.length !== 1 || !(durations[0] > 0))) {
    durations = [await probeMp4Duration(sourceUrls[0]).catch(() => 0)];
  }
  if (route === '/upscalevideo' && (durations.length !== 1 || !(durations[0] > 0) || !Number.isFinite(durations[0]))) {
    const selectedSeconds = Number(body.duration);
    if (Number.isFinite(selectedSeconds) && selectedSeconds >= 1 && selectedSeconds <= SOURCE_MEDIA_MAX_SECONDS) {
      durations = [selectedSeconds];
    }
  }
  if (durations.length !== sourceUrls.length || durations.some((duration) => duration <= 0)) {
    throw new Error("The server could not measure the source media duration.");
  }

  const measuredSeconds = Math.max(...durations);
  // Allow a small container/encoding tolerance around an intended 10s clip.
  if (measuredSeconds > SOURCE_MEDIA_MAX_SECONDS + 0.25) {
    throw new Error(`Source media cannot exceed ${SOURCE_MEDIA_MAX_SECONDS} seconds for this action.`);
  }

  const billableSeconds = Math.min(
    SOURCE_MEDIA_MAX_SECONDS,
    Math.max(1, Math.ceil(measuredSeconds)),
  );
  Object.defineProperty(body, SERVER_MEASURED_DURATION_FIELD, {
    value: billableSeconds,
    enumerable: false,
    configurable: true,
  });
};
