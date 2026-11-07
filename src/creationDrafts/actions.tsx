import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Switch, FormControlLabel, Typography } from '@mui/material';
import EditNoteIcon from '@mui/icons-material/EditNote';
import AddIcon from '@mui/icons-material/Add';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import type { RootState } from '../store';
import type { DraftCapabilities } from '../../server/src/creationDrafts/schema';
import { appAccentButtonSx } from '../appAccentStyles';
import { useDeckRuntime } from '../DeckRuntimeContext';
import { openDeckCreation } from '../useDeckNavigation';
import { createDraftApi } from './api';
import { creationDraftPath, prepareDraftEntry } from './entry';

const api = createDraftApi(import.meta.env.VITE_CLIK_URL);
const capabilities = new Map<string, { value: DraftCapabilities | null; expires: number; pending?: Promise<void> }>();
const subscribers = new Set<() => void>();
const emit = () => subscribers.forEach(listener => listener());
const subscribe = (listener: () => void) => { subscribers.add(listener); return () => { subscribers.delete(listener); }; };

function updateCapabilities(key: string, value: DraftCapabilities) {
  capabilities.set(key, { value, expires: Date.now() + 30_000 }); emit();
}

/** Public rows carry only capability metadata; snapshots are fetched on Yes. */
export function usePostCreationCapabilities(post: Record<string, any>, publishedBlueprint = false) {
  const accountId = useSelector((state: RootState) => state.profile.loggedUser?.id);
  const id = Number(post?.id), key = `${accountId || ''}:${id}`;
  const owner = accountId != null && String(post?.sender) === String(accountId);
  const publication = post?.publicationVideo ?? post?.video;
  const candidate = publishedBlueprint || (owner && (publication == null || Number(publication) === 100 || post?.draftReady === true));
  const value = useSyncExternalStore(subscribe, () => capabilities.get(key)?.value || null, () => null);
  useEffect(() => {
    if (!candidate || !accountId || !Number.isSafeInteger(id) || id <= 0) return;
    const cached = capabilities.get(key);
    if (cached?.pending || (cached && cached.expires > Date.now())) return;
    const pending = api.capabilities(id).then(value => updateCapabilities(key, value)).catch(() => {
      // A missing migration/old post cannot expose a broken action or affect playback.
      capabilities.set(key, { value: null, expires: Date.now() + 30_000 }); emit();
    });
    capabilities.set(key, { value: cached?.value || null, expires: 0, pending });
  }, [accountId, id, key, candidate]);
  return { capabilities: value, key };
}

function useActionTheme() {
  const dark = useSelector((state: RootState) => state.settings.darkMode);
  const color = useSelector((state: RootState) => dark ? state.settings.appColorDark : state.settings.appColorLight) || (dark ? '#fff' : '#111');
  return { dark, color, accent: appAccentButtonSx(color, dark) };
}

/** Existing create handoff is kept; a prepared entry only supplies its identity. */
function useCreationDraftAction(postId: number, mode: 'resume' | 'remix') {
  const accountId = useSelector((state: RootState) => state.profile.loggedUser?.id);
  const deckEnabled = useSelector((state: RootState) => state.settings.deckEnabled !== false);
  const runtime = useDeckRuntime(), location = useLocation(), navigate = useNavigate();
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const theme = useActionTheme();
  const proceed = async () => {
    if (busy || !accountId) return;
    setBusy(true); setError('');
    try {
      const entry = await prepareDraftEntry({ accountId, postId, mode, api });
      setConfirm(false);
      openDeckCreation(location, navigate, runtime.openCreate, deckEnabled, {
        targetPath: creationDraftPath(entry.record), requestId: entry.requestId,
      });
    } catch (error: any) { setError(error?.message || 'Creation could not be opened.'); }
    finally { setBusy(false); }
  };
  const dialog = <Dialog open={confirm} sx={{ zIndex: 100050 }} onClose={() => { if (!busy) { setConfirm(false); setError(''); } }}
    onClick={event => event.stopPropagation()} aria-labelledby={`creation-confirm-${postId}-${mode}`}
    PaperProps={{ sx: { borderRadius: 4, bgcolor: theme.dark ? '#151619' : '#fff', color: theme.dark ? '#fff' : '#111', minWidth: 280 } }}>
    <DialogTitle id={`creation-confirm-${postId}-${mode}`}>{mode === 'resume' ? 'Continue creation?' : 'Remix this post?'}</DialogTitle>
    {error && <DialogContent><Typography color="error" role="alert">{error}</Typography></DialogContent>}
    <DialogActions sx={{ p: 2, gap: 1 }}>
      <Button disabled={busy} color="inherit" onClick={() => { setConfirm(false); setError(''); }}>No</Button>
      <Button disabled={busy} onClick={proceed} sx={theme.accent}>{busy ? <CircularProgress color="inherit" size={20} /> : 'Yes'}</Button>
    </DialogActions>
  </Dialog>;
  return { open: (event: any) => { event.stopPropagation(); setError(''); setConfirm(true); }, dialog, busy, theme };
}

export function CreationDraftAction({ post, surface }: { post: Record<string, any>; surface: 'grid' | 'deck' | 'fullscreen' }) {
  const { capabilities: capability } = usePostCreationCapabilities(post);
  const action = useCreationDraftAction(Number(post?.id), 'resume');
  if (!capability?.canResume || !capability.draftReady || !capability.isDraft) return null;
  const position = surface === 'fullscreen' ? { top: 12, left: '50%', transform: 'translateX(-50%)' }
    : surface === 'deck' ? { top: 12, left: 12 } : { top: 8, right: 8 };
  const props = { 'aria-label': 'Continue creation', 'data-deck-no-drag': 'true', 'data-creation-draft-action': surface,
    onClick: action.open, onPointerDown: (event: any) => event.stopPropagation(), onTouchStart: (event: any) => event.stopPropagation() };
  return <>
    {surface === 'fullscreen' ? <Button {...props} startIcon={<AddIcon />} sx={{ ...action.theme.accent, ...position,
      position: 'absolute', zIndex: 30, borderRadius: 999, fontWeight: 800 }}>Create</Button>
      : <IconButton {...props} className={`creation-draft-action--${surface}`} sx={{ ...action.theme.accent, ...position,
        position: 'absolute', zIndex: 12, width: 36, height: 36, borderRadius: 999 }}><EditNoteIcon fontSize="small" /></IconButton>}
    {action.dialog}
  </>;
}

export function BlueprintRemixAction({ post }: { post: Record<string, any> }) {
  const { capabilities: capability } = usePostCreationCapabilities(post, true);
  const action = useCreationDraftAction(Number(post?.id), 'remix');
  if (!capability?.canRemix || !capability.draftReady || capability.isDraft) return null;
  return <><Button size="small" onClick={action.open} startIcon={<AutoFixHighIcon />} sx={{ ...action.theme.accent, borderRadius: 999, fontWeight: 800 }}>Remix</Button>{action.dialog}</>;
}

export function BlueprintAllowRemix({ post }: { post: Record<string, any> }) {
  const { capabilities: capability, key } = usePostCreationCapabilities(post, true);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const theme = useActionTheme();
  if (!capability?.canToggleRemix || capability.isDraft) return null;
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
    <FormControlLabel label="Allow remix" control={<Switch checked={capability.allowRemix} disabled={busy}
      onChange={async (_event, checked) => {
        if (busy) return;
        setBusy(true); setError('');
        try { updateCapabilities(key, { ...capability, ...await api.allowRemix(Number(post.id), checked) }); }
        catch (error: any) { setError(error?.message || 'Remix permission could not be updated.'); }
        finally { setBusy(false); }
      }} sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: theme.color },
        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: theme.color } }} />} />
    {error && <Typography role="alert" variant="caption" color="error">{error}</Typography>}
  </div>;
}
