import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { refreshFishVoices, useFishVoices } from '../fishVoices';

/** Human-only developer tool. Deliberately has no app-control bindings. */
export function FishVoicePreviewManager() {
  const [open, setOpen] = useState(false), voices = useFishVoices(open);
  const [voiceId, setVoiceId] = useState(voices[0].id);
  const [text, setText] = useState('Hello! Let’s bring your next idea to life.'), [direction, setDirection] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState('');
  const [draft, setDraft] = useState<{ id: string; url: string } | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null), draftUrl = useRef('');
  const request = useRef<{ signature: string; id: string }>();
  const api = String(import.meta.env.VITE_CLIK_URL || '').replace(/\/$/, '');
  const signature = JSON.stringify([voiceId, text, direction]);
  const draftSignature = useRef('');
  const clearDraft = () => {
    audio.current?.pause(); audio.current = null;
    if (draftUrl.current) URL.revokeObjectURL(draftUrl.current);
    draftUrl.current = ''; setDraft(null); setSaved('');
  };
  useEffect(() => () => { audio.current?.pause(); if (draftUrl.current) URL.revokeObjectURL(draftUrl.current); }, []);
  const close = () => { if (!busy) { audio.current?.pause(); setOpen(false); } };
  const post = async (path: string, body: object) => {
    const response = await fetch(`${api}/api/fish-voices/${path}`, { method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Voice preview request failed');
    return data;
  };
  const generate = async () => {
    setBusy(true); setError('');
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    try {
      const data = await post('generate-preview', { requestId: request.current!.id, voiceId, text, direction });
      const bytes = Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0));
      clearDraft();
      const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
      draftUrl.current = url; draftSignature.current = signature; setDraft({ id: data.draftId, url });
    } catch (e) { setError(e instanceof Error ? e.message : 'Preview generation failed.'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!draft || draftSignature.current !== signature) return;
    setBusy(true); setError('');
    try { const data = await post('save-preview', { draftId: draft.id }); setSaved(data.s3Url); await refreshFishVoices(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'Save failed; the generated draft is retained.'); }
    finally { setBusy(false); }
  };
  if (import.meta.env.VITE_APPX_STATE !== 'dev') return null;
  return <>
    <Button size="small" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Add</Button>
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm" aria-labelledby="fish-preview-title">
      <DialogTitle id="fish-preview-title">Add Fish voice preview</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2">Generate one preview, listen, then save it to S3. This uses Fish credit. Voices work without saved previews.</Typography>
          <TextField select label="Fish voice" value={voiceId} disabled={busy} onChange={e => { setVoiceId(e.target.value); clearDraft(); }}>
            {voices.map(v => <MenuItem key={v.id} value={v.id}>{v.name} · {v.tone}</MenuItem>)}
          </TextField>
          <TextField label="Preview text" multiline minRows={3} value={text} inputProps={{ maxLength: 1200 }} disabled={busy}
            onChange={e => { setText(e.target.value); clearDraft(); }} />
          <TextField label="Delivery direction (optional)" value={direction} inputProps={{ maxLength: 500 }} disabled={busy}
            onChange={e => { setDirection(e.target.value); clearDraft(); }} />
          {error && <Alert severity="error">{error}</Alert>}
          {saved && <Alert severity="success">Saved. Both voice lists now use the stored preview.</Alert>}
          {draft && <Stack direction="row" spacing={1}>
            <Button onClick={() => { audio.current?.pause(); audio.current = new Audio(draft.url); void audio.current.play().catch(() => setError('Audio playback was blocked. Try Play again.')); }}>Play preview</Button>
            <Button onClick={() => audio.current?.pause()}>Stop</Button>
          </Stack>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={busy}>Close</Button>
        <Button disabled={busy || !text.trim()} onClick={() => { if (draft) request.current = undefined; void generate(); }}>{busy ? 'Working…' : draft ? 'Regenerate' : 'Generate'}</Button>
        <Button variant="contained" disabled={busy || !draft || Boolean(saved)} onClick={() => void save()}>Save preview</Button>
      </DialogActions>
    </Dialog>
  </>;
}
