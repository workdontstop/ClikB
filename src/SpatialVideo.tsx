import React, { forwardRef } from "react";
/** Common video element for creation, preview and feed playback. */
const SpatialVideo = forwardRef<HTMLVideoElement, React.VideoHTMLAttributes<HTMLVideoElement>>((props, ref) => (
  <video playsInline preload="auto" {...props} ref={ref} />
));
SpatialVideo.displayName = "SpatialVideo";
export default SpatialVideo;
