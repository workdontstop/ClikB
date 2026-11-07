import { darken, lighten } from '@mui/material/styles';

/** Match the active Auto Control pill, with the theme's required fill text. */
export function pricingAccentStyle(appColor: string, darkMode: boolean) {
    return {
        background: darkMode
            ? `linear-gradient(135deg, ${lighten(appColor, 0.08)}, #35bfa3)`
            : `linear-gradient(135deg, ${darken(appColor, 0.12)}, #7657d8)`,
        color: darkMode ? '#000000' : '#FFFFFF',
    };
}
