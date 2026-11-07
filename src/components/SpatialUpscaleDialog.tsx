import { Alert, Box, Button, Dialog, DialogContent, DialogTitle, Typography } from '@mui/material';
import type { VideoUpscaleResolution } from '../../server/src/videoUpscaleSpec';

export type SpatialUpscaleQuote = {
    jobId: string;
    selected: VideoUpscaleResolution;
    choices?: Record<VideoUpscaleResolution, { pixels: number; key: string; duration: number }>;
};
type Props = { quote?: SpatialUpscaleQuote; busy: boolean; error?: string; pill: any; glass: any; onDismissError: () => void; onSelect: (resolution: VideoUpscaleResolution) => void; onCancel: () => void; onConfirm: () => void };

export default function SpatialUpscaleDialog({ quote, busy, error, pill, glass, onDismissError, onSelect, onCancel, onConfirm }: Props) {
    return <Dialog open={Boolean(quote)} onClose={onCancel} sx={{ zIndex: 2147483001 }}><DialogTitle>Upscale this moment?</DialogTitle><DialogContent>
        {error && <Alert severity="error" onClose={onDismissError}>{error}</Alert>}
        <Typography>Standard · AIGC · 60 fps</Typography>
        <Box role="group" aria-label="Video upscale resolution" sx={{ display: 'flex', gap: 1, my: 2 }}>{(['1080p', '2k'] as const).map(resolution => <Button key={resolution} sx={quote?.selected === resolution ? pill : glass} aria-pressed={quote?.selected === resolution} disabled={busy || !quote?.choices} onClick={() => onSelect(resolution)}>{resolution === '2k' ? '2K' : '1080p'} · {quote?.choices?.[resolution].pixels ?? '…'} P</Button>)}</Box>
        <Button disabled={busy || !quote?.choices} onClick={onConfirm}>Confirm upscale · {quote?.choices?.[quote.selected].pixels ?? '…'} P</Button>
        <Button onClick={onCancel}>Cancel</Button>
    </DialogContent></Dialog>;
}
