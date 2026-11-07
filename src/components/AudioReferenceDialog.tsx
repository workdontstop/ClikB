import { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import AudioPickerPlayer from '../AudioPickerPlayer';
import type { AudioReference } from '../../server/src/audioReference';

export default function AudioReferenceDialog({ open, duration, value, onClose, onSave }: {
    open: boolean; duration: number; value?: AudioReference; onClose: () => void; onSave: (value?: AudioReference) => void | Promise<void>;
}) {
    const [file, setFile] = useState<{ url: string; name: string }>();
    const [error, setError] = useState('');
    useEffect(() => () => { if (file?.url.startsWith('blob:')) URL.revokeObjectURL(file.url); }, [file]);
    useEffect(() => { if (!open) { setFile(undefined); setError(''); } }, [open]);
    return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" sx={{ zIndex: 2147483010 }}>
        <DialogTitle>Audio reference</DialogTitle>
        <DialogContent>
            {error && <Typography role="alert" color="error">{error}</Typography>}
            <Typography sx={{ mb: 2 }}>Choose sounds for this video. Select a {duration}-second section by moving the trim window; shorter audio uses its full length. No lyrics or dialogue are added to your prompt.</Typography>
            <Button component="label" sx={{ borderRadius: 999 }}>Upload audio<input aria-label="Upload audio reference" type="file" accept="audio/*" hidden onChange={event => {
                const upload = event.target.files?.[0]; if (upload) setFile({ url: URL.createObjectURL(upload), name: upload.name }); event.target.value = '';
            }} /></Button>
            {(file || value) && <AudioPickerPlayer key={file?.url || value?.sourceUrl || value?.url} src={file?.url || value?.sourceUrl || value?.url}
                AudioName={file?.name || value?.name} setGotmp3={() => {}} callMusic={() => {}}
                referenceDuration={Math.min(15, duration)} referenceStart={file ? 0 : value?.start} onReferenceReady={async reference => { await onSave(reference); onClose(); }} />}
        </DialogContent>
        <DialogActions>{value && <Button onClick={() => void Promise.resolve().then(() => onSave(undefined)).then(onClose).catch(() => setError('Audio could not be removed. Please try again.'))}>Remove audio</Button>}<Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>;
}
