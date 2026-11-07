export type PreciseRectangle = { x: number; y: number; width: number; height: number };
/** Touching edges are allowed; positive interior overlap is rejected. */
export function preciseRectanglesIntersect(a: PreciseRectangle, b: PreciseRectangle): boolean {
    return a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0
        && a.x < b.x + b.width - 1e-7 && a.x + a.width > b.x + 1e-7
        && a.y < b.y + b.height - 1e-7 && a.y + a.height > b.y + 1e-7;
}
export function preciseRegionConflicts<T extends PreciseRectangle & { id: string }>(candidate: T, regions: T[]): boolean {
    return regions.some(region => region.id !== candidate.id && preciseRectanglesIntersect(candidate, region));
}
export function preciseFreeRectangle(regions: PreciseRectangle[], center?: { x: number; y: number }): PreciseRectangle | null {
    const width = .16, height = .16;
    if (center) {
        const candidate = { x: Math.max(0, Math.min(1 - width, center.x - width / 2)), y: Math.max(0, Math.min(1 - height, center.y - height / 2)), width, height };
        return regions.some(region => preciseRectanglesIntersect(candidate, region)) ? null : candidate;
    }
    for (let row = 0; row < 5; row++) for (let column = 0; column < 5; column++) {
        const candidate = { x: .02 + column * .19, y: .02 + row * .19, width, height };
        if (!regions.some(region => preciseRectanglesIntersect(candidate, region))) return candidate;
    }
    return null;
}
