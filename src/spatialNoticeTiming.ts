/** Enough reading time for an inline notice, bounded so it never lingers forever. */
export function spatialNoticeDuration(message: string): number {
    const words = message.trim().split(/\s+/).filter(Boolean).length;
    return Math.min(14000, Math.max(4500, 1500 + Math.ceil(words / 3 * 1000)));
}
