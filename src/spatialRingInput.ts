/** Geometry shared by mouse hover and touch contact on the spatial donut. */
export function spatialRingDirection(
    bounds: Pick<DOMRect, "left" | "top" | "width" | "height">,
    clientX: number,
    clientY: number,
    wasActive: boolean,
) {
    const half = Math.min(bounds.width, bounds.height) / 2;
    if (half <= 0) return null;
    const x = (clientX - bounds.left - bounds.width / 2) / half;
    const y = (bounds.top + bounds.height / 2 - clientY) / half;
    const distance = Math.hypot(x, y);
    // The gap between start and stop thresholds prevents edge flicker.
    if (distance < (wasActive ? 0.36 : 0.44) || distance > 1.05) return null;
    return { x: x / distance, y: y / distance, radius: 1, angle: Math.atan2(y, x) };
}
