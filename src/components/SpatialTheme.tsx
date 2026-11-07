import { useMemo, type ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { createTheme, ThemeProvider, useTheme } from '@mui/material/styles';
import type { RootState } from '../store';

/** Local theme also reaches portalled dialogs, menus and drawers. */
export default function SpatialTheme({ darkMode, children }: { darkMode: boolean; children: ReactNode }) {
    const outer = useTheme();
    const accent = useSelector((state: RootState) => darkMode ? state.settings.appColorDark : state.settings.appColorLight);
    const theme = useMemo(() => {
        const palette = createTheme({ palette: { mode: darkMode ? 'dark' : 'light', primary: { main: accent, contrastText: darkMode ? '#000' : '#fff' }, secondary: { main: accent, contrastText: darkMode ? '#000' : '#fff' },
            background: { default: darkMode ? '#111111' : '#fafafa', paper: darkMode ? '#1b1b1b' : '#ffffff' },
            text: { primary: darkMode ? '#ffffff' : '#171717', secondary: darkMode ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.65)' } } }).palette;
        return createTheme(outer, { palette, components: {
            MuiButton: { styleOverrides: { root: { border: `2px solid ${darkMode ? '#000' : '#fff'}`, borderRadius: 999, padding: '6px 12px', backgroundColor: darkMode ? 'rgba(15,18,24,.62)' : 'rgba(255,255,255,.68)', backgroundImage: 'linear-gradient(135deg,rgba(255,255,255,.14),rgba(255,255,255,0) 52%,rgba(0,0,0,.08))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.16)', backdropFilter: 'blur(18px) saturate(150%)', textTransform: 'none' } } },
            MuiIconButton: { styleOverrides: { root: { border: `2px solid ${darkMode ? '#000' : '#fff'}`, backgroundImage: 'linear-gradient(135deg,rgba(255,255,255,.14),rgba(255,255,255,0) 52%,rgba(0,0,0,.08))', backdropFilter: 'blur(18px) saturate(150%)' } } },
            MuiAlert: { styleOverrides: { root: { borderRadius: 20, backgroundImage: 'none', backgroundColor: darkMode ? 'rgba(16,18,21,.94)' : 'rgba(255,255,255,.96)', color: darkMode ? '#fff' : '#111', border: `1px solid ${accent}`, backdropFilter: 'blur(18px)', fontSize: '.8rem' }, icon: { color: 'inherit' } } },
            // Select menus portal to document.body, outside the high-layer
            // editor dialogs. Keep them visible and clickable above those dialogs.
            MuiPopover: { styleOverrides: { root: { zIndex: 2147483006 } } },
            MuiMenu: { styleOverrides: { root: { zIndex: 2147483006 } } },
            MuiTooltip: { styleOverrides: { popper: { zIndex: 2147483008 } } },
        } });
    }, [outer, accent, darkMode]);
    return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
