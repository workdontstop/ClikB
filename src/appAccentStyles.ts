import { alpha, darken, lighten } from '@mui/material/styles';

/** Explicit product rule; do not use automatic contrast colour on accent fills. */
export const appAccentForeground = (darkMode: boolean) => darkMode ? '#000' : '#fff';

export function appAccentButtonSx(appColor: string, darkMode: boolean, finish: { contrast?: number; borderWidth?: number } = {}) {
    const foreground = appAccentForeground(darkMode);
    const contrast = finish.contrast ?? .13;
    return {
        bgcolor: alpha(appColor, .86), color: foreground,
        backgroundImage: finish.contrast === undefined
            ? `linear-gradient(135deg, ${alpha(lighten(appColor, .14), .95)} 0%, ${alpha(lighten(appColor, .08), .84)} 48%, ${alpha(darken(appColor, .13), .94)} 52%, ${alpha(darken(appColor, .08), .88)} 100%)`
            : `linear-gradient(135deg, ${alpha(lighten(appColor, contrast), .95)} 0%, ${alpha(lighten(appColor, contrast * .6), .9)} 47%, ${alpha(darken(appColor, contrast), .94)} 53%, ${alpha(darken(appColor, contrast * .7), .9)} 100%)`,
        border: `${finish.borderWidth ?? 1}px solid ${darkMode ? '#000' : '#fff'}`,
        backdropFilter: 'blur(18px) saturate(160%)',
        boxShadow: `inset 0 1px 0 ${alpha('#fff', .26)}, 0 4px 12px ${alpha('#000', .16)}`,
        transition: 'background-color 160ms, box-shadow 160ms',
        '&:hover': { bgcolor: appColor, color: foreground, boxShadow: `inset 0 1px 0 ${alpha('#fff', .4)}, 0 5px 16px ${alpha(appColor, .22)}` },
        '&:focus-visible': { outline: `2px solid ${appColor}`, outlineOffset: 3 },
        '&.Mui-disabled': { color: foreground, bgcolor: alpha(appColor, darkMode ? .32 : .64), backgroundImage: 'none', boxShadow: 'none', borderColor: darkMode ? '#000' : '#fff', opacity: .8 },
        '& .MuiSvgIcon-root, & .MuiTypography-root, & .MuiCircularProgress-root': { color: 'inherit' },
    };
}
