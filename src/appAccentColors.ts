export interface AppAccentColor {
    name: string;
    value: string;
}

export const DEFAULT_APP_ACCENT_COLORS = { light: '#101010', dark: '#FFFFFF' } as const;

export function savedAppAccentColor(mode: 'light' | 'dark', value: unknown): string {
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) return DEFAULT_APP_ACCENT_COLORS[mode];
    const [r, g, b] = value.slice(1).match(/../g)!.map(channel => parseInt(channel, 16) / 255)
        .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const contrast = mode === 'light' ? 1.05 / (luminance + 0.05) : (luminance + 0.05) / 0.05;
    return contrast >= 4.5 ? value.toUpperCase() : DEFAULT_APP_ACCENT_COLORS[mode];
}

// Light-mode accent fills use white text; dark-mode fills use black text.
// Keep separate palettes so changing one mode never overwrites the other.
// Prefer distinct hues, saturation and brightness over neighboring shades.
export const APP_ACCENT_COLORS: Record<'light' | 'dark', readonly AppAccentColor[]> = {
    light: [
        { name: 'Blue', value: '#3157C8' },
        { name: 'Indigo', value: '#4B2C83' },
        { name: 'Purple', value: '#7E22CE' },
        { name: 'Pink', value: '#AD1457' },
        { name: 'Red', value: '#B91C1C' },
        { name: 'Orange', value: '#A64800' },
        { name: 'Mustard', value: '#806800' },
        { name: 'Lime', value: '#586D08' },
        { name: 'Olive', value: '#45542A' },
        { name: 'Green', value: '#17603A' },
        { name: 'Teal', value: '#006B69' },
        { name: 'Cyan', value: '#056A87' },
        { name: 'Burgundy', value: '#651D32' },
        { name: 'Copper', value: '#9A4333' },
        { name: 'Brown', value: '#693706' },
        { name: 'Khaki', value: '#72603D' },
        { name: 'Slate', value: '#3D5266' },
        { name: 'Gray', value: '#6A6A6A' },
        { name: 'Taupe', value: '#44342E' },
        { name: 'Black', value: '#101010' },
    ],
    dark: [
        { name: 'Cyan', value: '#39DDF5' },
        { name: 'Blue', value: '#70A9FF' },
        { name: 'Indigo', value: '#9691F3' },
        { name: 'Purple', value: '#C77DEE' },
        { name: 'Pink', value: '#F26AA2' },
        { name: 'Red', value: '#F46848' },
        { name: 'Orange', value: '#FF9B23' },
        { name: 'Yellow', value: '#F2E535' },
        { name: 'Lime', value: '#B9DE31' },
        { name: 'Green', value: '#49CC68' },
        { name: 'Teal', value: '#2FC3AC' },
        { name: 'Olive', value: '#A3A966' },
        { name: 'Gold', value: '#D5B33F' },
        { name: 'Copper', value: '#D28D54' },
        { name: 'Brown', value: '#A8876A' },
        { name: 'Sand', value: '#E4D0AD' },
        { name: 'Taupe', value: '#AB9690' },
        { name: 'Slate', value: '#7FA1A9' },
        { name: 'Silver', value: '#B9BEC4' },
        { name: 'White', value: '#FFFFFF' },
    ],
};
