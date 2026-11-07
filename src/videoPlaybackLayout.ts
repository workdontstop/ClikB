export interface VideoControlBounds {
  left: number;
  bottom: number;
  width: number;
}

export function containedMediaRect(element: { left: number; top: number; width: number; height: number }, intrinsicWidth: number, intrinsicHeight: number) {
  const scale = intrinsicWidth > 0 && intrinsicHeight > 0 ? Math.min(element.width / intrinsicWidth, element.height / intrinsicHeight) : 0;
  const width = scale ? intrinsicWidth * scale : element.width;
  const height = scale ? intrinsicHeight * scale : element.height;
  const left = element.left + (element.width - width) / 2, top = element.top + (element.height - height) / 2;
  return { left, top, width, height, right: left + width, bottom: top + height };
}

/** Fit controls to the pixels displayed by object-fit:contain in a video element. */
export function getVideoControlBounds(
  element: { left: number; top: number; width: number; height: number },
  containerHeight: number,
  intrinsicWidth: number,
  intrinsicHeight: number,
): VideoControlBounds {
  const ready = intrinsicWidth > 0 && intrinsicHeight > 0;
  const scale = ready ? Math.min(element.width / intrinsicWidth, element.height / intrinsicHeight) : 1;
  const width = ready ? intrinsicWidth * scale : element.width;
  const height = ready ? intrinsicHeight * scale : element.height;
  return {
    left: element.left + (element.width - width) / 2,
    bottom: containerHeight - element.top - (element.height + height) / 2,
    width,
  };
}

export function videoPlaybackKey(postId: string | number, source: string): string {
  return JSON.stringify([postId, source]);
}

export function shouldHideVideoCaption(normalVideo: boolean, playing: boolean, seekerOpen: boolean): boolean {
  return normalVideo && (playing || seekerOpen);
}
