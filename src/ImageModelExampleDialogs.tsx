import { useEffect, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './store';
import { deleteImageModelExamples, loadImageModelExampleSets, saveImageModelExamples } from './imageModelExamplesSlice';
import { chooseModelExampleImages, type ImageModelExampleSet, type ModelExampleImages } from '../server/src/imageModelExamples';
import { getCreationImageModelName } from './imageModels';

const dialogSx = (dark: boolean) => ({ bgcolor: dark ? '#151519' : '#fff', color: dark ? '#fff' : '#111', borderRadius: 3 });
const errorMessage = (error: any) => error?.response?.data?.message || error?.message || 'The request failed. Please try again.';

export function SaveImageModelExampleSetDialog({ open, onClose, candidates, darkMode }: {
  open: boolean; onClose: () => void; candidates: Array<{ model: string; url: string }>; darkMode: boolean;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const [name, setName] = useState('');
  const [images, setImages] = useState<ModelExampleImages>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setName(''); setImages(chooseModelExampleImages(candidates)); setError(''); setSaved(false);
  }, [open, candidates]);
  const save = async () => {
    if (busy) return;
    setBusy(true); setError('');
    let persisted = saved;
    try {
      if (!persisted) { await saveImageModelExamples(name.trim(), images); persisted = true; setSaved(true); }
      // The database is authoritative. Do not synthesize a Redux set after a write.
      await dispatch(loadImageModelExampleSets(true)).unwrap();
      onClose();
    } catch (failure) {
      setError(persisted ? 'The set is saved. Refreshing the list failed; retry the refresh or reload the page.' : errorMessage(failure));
    } finally { setBusy(false); }
  };
  return <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" PaperProps={{ sx: dialogSx(darkMode) }}>
    <DialogTitle>Add image model example set</DialogTitle>
    <DialogContent>
      <Typography sx={{ mb: 2 }}>Save one image per model from this creation for everyone’s model selector.</Typography>
      <TextField autoFocus fullWidth label="Set name" value={name} onChange={event => setName(event.target.value)}
        disabled={busy || saved} inputProps={{ maxLength: 160 }} sx={{ my: 1,
          '& .MuiInputBase-root': { color: darkMode ? '#fff' : '#111' },
          '& .MuiInputLabel-root': { color: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: darkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)' } }} />
      <Typography sx={{ my: 1 }}>{Object.keys(images).length} models represented</Typography>
      {!Object.keys(images).length && <Alert severity="info">No stored images with a known generating model are ready in this creation yet.</Alert>}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {Object.entries(images).map(([model, url]) => <Box key={model} sx={{ width: 112 }}>
          <Box component="img" src={url} alt={getCreationImageModelName(model)} sx={{ width: 112, height: 112, objectFit: 'cover', borderRadius: 1 }} />
          <Typography sx={{ fontSize: 11 }}>{getCreationImageModelName(model)}</Typography>
        </Box>)}
      </Box>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    </DialogContent>
    <DialogActions>
      <Button disabled={busy} onClick={onClose}>Cancel</Button>
      <Button variant="contained" disabled={busy || !Object.keys(images).length || !saved && !name.trim()} onClick={() => void save()}>
        {busy ? 'Saving…' : saved ? 'Refresh list' : 'Add set'}
      </Button>
    </DialogActions>
  </Dialog>;
}

export function ImageModelExampleSetManager({ open, onClose, darkMode }: { open: boolean; onClose: () => void; darkMode: boolean }) {
  const dispatch = useDispatch<AppDispatch>();
  const { sets, error: loadError } = useSelector((state: RootState) => state.imageModelExamples);
  const [selected, setSelected] = useState<ImageModelExampleSet | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (!open) { setSelected(null); setError(''); setDeleted(false); } }, [open]);
  const remove = async () => {
    if (!selected || busy) return;
    setBusy(true); setError(''); let persisted = deleted;
    try {
      if (!persisted) { await deleteImageModelExamples(selected.id); persisted = true; setDeleted(true); }
      await dispatch(loadImageModelExampleSets(true)).unwrap();
      setSelected(null); setDeleted(false);
    } catch (failure) {
      setError(persisted ? 'The set is deleted. Refreshing the list failed; retry the refresh or reload the page.' : errorMessage(failure));
    } finally { setBusy(false); }
  };
  return <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" PaperProps={{ sx: dialogSx(darkMode) }}>
    <DialogTitle>{selected ? `Delete “${selected.name}”?` : 'Image model example sets'}</DialogTitle>
    <DialogContent>
      {selected ? <Typography>This removes the set from every model and deletes its images from storage. Images still used by another example set are kept.</Typography>
        : <>
          {!sets.length && <Typography>No example sets saved yet.</Typography>}
          {sets.map(set => <Box key={set.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
            <Box component="img" src={Object.values(set.model_images)[0]} alt="" loading="lazy" sx={{ width: 56, height: 64, objectFit: 'cover', borderRadius: 1 }} />
            <Box sx={{ flex: 1 }}><Typography>{set.name}</Typography><Typography sx={{ fontSize: 12, opacity: 0.65 }}>{Object.keys(set.model_images).length} models</Typography></Box>
            <Button color="error" onClick={() => { setSelected(set); setError(''); setDeleted(false); }}>Delete</Button>
          </Box>)}
        </>}
      {(error || loadError) && <Alert severity="error" sx={{ mt: 2 }}>{error || loadError}</Alert>}
    </DialogContent>
    <DialogActions>
      <Button disabled={busy} onClick={selected ? () => { setSelected(null); setError(''); } : onClose}>{selected ? 'Cancel' : 'Close'}</Button>
      {selected && <Button color="error" variant="contained" disabled={busy} onClick={() => void remove()}>{busy ? 'Deleting…' : deleted ? 'Refresh list' : 'Delete set and images'}</Button>}
    </DialogActions>
  </Dialog>;
}
