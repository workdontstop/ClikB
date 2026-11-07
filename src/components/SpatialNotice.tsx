import { Box, IconButton, LinearProgress, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

/** Shared inline surface for progress, errors and provider messages. */
export default function SpatialNotice({ children, darkMode, accent, onClose, progress }: {
    children: React.ReactNode; darkMode: boolean; accent: string; onClose?: () => void; progress?: number | 'working';
}) {
    return <Box role={onClose ? 'alert' : 'status'} sx={{ px: 1.25, py: 1, borderRadius: 3, width: '100%', boxSizing: 'border-box',
        background: darkMode ? 'rgba(16,18,21,.94)' : 'rgba(255,255,255,.95)', color: darkMode ? '#fff' : '#111',
        border: `1px solid ${accent}`, backdropFilter: 'blur(18px)', overflowWrap: 'anywhere' }}>
        {onClose && <IconButton size="small" aria-label="Dismiss notification" onClick={onClose} sx={{ float: 'right', color: 'inherit' }}><CloseIcon fontSize="small" /></IconButton>}
        <Typography component="div" variant="body2">{children}</Typography>
        {progress !== undefined && <LinearProgress variant={progress === 'working' ? 'indeterminate' : 'determinate'} value={typeof progress === 'number' ? progress : undefined} sx={{ mt: 1 }} />}
    </Box>;
}
