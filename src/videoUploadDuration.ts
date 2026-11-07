// Nominal ten-second clips can include an extra frame/container tick.
// Preserve the measured duration and use the same tolerance at both upload entry points.
export const VIDEO_UPLOAD_MAX_SECONDS = 10;
export const VIDEO_UPLOAD_FRAME_TOLERANCE_SECONDS = 0.25;
export const isSupportedVideoUploadDuration = (duration: number): boolean =>
    Number.isFinite(duration) && duration > 0 &&
    duration <= VIDEO_UPLOAD_MAX_SECONDS + VIDEO_UPLOAD_FRAME_TOLERANCE_SECONDS;
