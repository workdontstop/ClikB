import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Alert, Avatar, Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import type { RootState } from './store';
import { prepareDraftForProfileSwitch } from './creationDrafts/entry';
import { navigationControl } from './navigationControlSnapshot';
import { publishNavigationArea, recordNavigationTransition, removeNavigationArea } from './brainstormSlice';
import { setLoggedUser } from './profileSlice';
import { useNavigationViewport } from './useNavigationViewport';
import { getExecutingNavigationAction } from './navigationActionProvenance';
import { resetConversationMeasurementSessionId } from './conversationMeasurementSession';

type Profile = { id: number; username: string; image: string };
type Catalogue = { main: Profile | null; profiles: Profile[]; managed: boolean; canCreate?: boolean };
const API = `${import.meta.env.VITE_CLIK_URL}/creative-profiles`;

async function request<T>(path = '', init?: RequestInit): Promise<T> {
  const response = await fetch(API + path, { credentials: 'include', ...init });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Could not complete that action. Try again.');
  return data as T;
}
const json = (method: string, body: unknown): RequestInit => ({
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

export default function CreativeProfiles({ surface, profileId, coverActions, pairedAvatar, coverOnly = false }: {
  surface: 'settings' | 'profile'; profileId?: number; coverActions?: HTMLElement | null; pairedAvatar?: HTMLElement | null; coverOnly?: boolean;
}) {
  const { loggedUser } = useSelector((state: RootState) => state.profile);
  const dark = useSelector((state: RootState) => state.settings.darkMode);
  const accent = useSelector((state: RootState) => dark ? state.settings.appColorDark : state.settings.appColorLight);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const active = Number(loggedUser?.id);
  const mainId = Number(loggedUser?.ownerId || active);
  const target = Number(profileId || active);
  const catalogueKey = `${mainId}:${active}:${target}`;
  const [loadedCatalogue, setLoadedCatalogue] = useState<{ key: string; data: Catalogue } | null>(null);
  const catalogue = loadedCatalogue?.key === catalogueKey ? loadedCatalogue.data : null;
  const [catalogueError, setCatalogueError] = useState('');
  const [dialog, setDialog] = useState<'list' | 'create' | 'delete' | 'details' | null>(null);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [biography, setBiography] = useState('');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [usernameCheckPending, setUsernameCheckPending] = useState(false);
  const [usernameCheckError, setUsernameCheckError] = useState('');
  const [usernameCheckAttempt, setUsernameCheckAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inSettings = surface === 'settings';
  const isOwner = catalogue?.main?.id === mainId && mainId > 0;
  const canCreate = isOwner && catalogue?.canCreate === true && (inSettings || !catalogue.managed);
  const canEdit = !inSettings && isOwner && catalogue?.managed && active === target;
  const area = inSettings ? 'clikb.navigation.creative_profiles_settings' :
    coverOnly ? 'clikb.navigation.creative_profiles_cover' : 'clikb.navigation.creative_profiles_profile';
  const mapped = (key: string) => `${area}.action.${key}`;
  const canOpenCard = (id: number) => inSettings ? id !== active : id !== target || location.pathname !== '/pages';
  const rowViewport = useNavigationViewport('horizontal', `${catalogueKey}:${Boolean(catalogue)}:${dialog}`);
  const listViewport = useNavigationViewport('vertical', `${catalogueKey}:${dialog}`);
  const glass = { bgcolor: dark ? '#161619ed' : '#f9f9fbee', backdropFilter: 'blur(24px)', color: dark ? '#fff' : '#161616' };
  const action = { bgcolor: accent, color: dark ? '#000' : '#fff', '&:hover': { bgcolor: accent, opacity: 0.92 } };
  const circleFocus = {
    '&:focus, &:focus-visible': { outline: 'none' },
    '&.Mui-focusVisible .MuiAvatar-root': { boxShadow: `0 0 0 4px color-mix(in srgb, ${accent} 30%, transparent)` },
    '&:active': { bgcolor: dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.12)' },
  };
  const coverAction = { ...action, borderRadius: 999, textTransform: 'none', px: 1.5 };
  const evidence = (key: string, entityId?: number) => {
    const actor = getExecutingNavigationAction() === mapped(key) ? 'ai' : 'manual';
    return (outcome: 'succeeded' | 'failed' | 'unknown', detail?: string) => dispatch(recordNavigationTransition({
      actor, outcome, detail, kind: 'control', authoritativeSource: 'CreativeProfiles',
      before: { areaId: area, entityId: target },
      after: { areaId: area, controlId: `${area}.control.${key}`, entityId },
    }));
  };
  const move = (key: string, handler: () => void, entityId?: number) => {
    handler();
    evidence(key, entityId)('succeeded');
  };

  useEffect(() => {
    setLoadedCatalogue(null);
    setCatalogueError('');
    setDialog(null);
    if (!Number.isSafeInteger(target) || target < 1) return;
    const controller = new AbortController();
    void request<Catalogue>(`/${target}/catalogue`, { signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return;
        setLoadedCatalogue({ key: catalogueKey, data });
        if (!data.main && target === mainId) setCatalogueError('Creative Profiles are unavailable on this server.');
      })
      .catch(() => {
        if (!controller.signal.aborted && target === mainId) setCatalogueError('Creative Profiles could not load.');
      });
    return () => controller.abort();
  }, [target, mainId, catalogueKey]);

  useEffect(() => {
    setAvailable(null);
    setUsernameCheckError('');
    setUsernameCheckPending(false);
    if (dialog !== 'create' || !/^[a-zA-Z0-9_]{3,32}$/.test(name.trim())) return;
    const controller = new AbortController();
    setUsernameCheckPending(true);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      timeout = setTimeout(() => {
        controller.abort();
        setUsernameCheckPending(false);
        setUsernameCheckError('The username check timed out. Try again.');
      }, 8000);
      void request<{ available: boolean }>(`/username?username=${encodeURIComponent(name.trim())}`, { signal: controller.signal })
        .then(data => {
          if (controller.signal.aborted) return;
          if (typeof data.available !== 'boolean') throw new Error('The username check is unavailable. Try again.');
          setAvailable(data.available);
        })
        .catch(reason => {
          if (!controller.signal.aborted) setUsernameCheckError(reason instanceof TypeError || reason instanceof SyntaxError
            ? 'The username check is unavailable. Try again.'
            : reason instanceof Error ? reason.message : 'Could not check this username. Try again.');
        })
        .finally(() => {
          clearTimeout(timeout);
          if (!controller.signal.aborted) setUsernameCheckPending(false);
        });
    }, 250);
    return () => { clearTimeout(timer); clearTimeout(timeout); controller.abort(); };
  }, [dialog, name, catalogueKey, usernameCheckAttempt]);

  useEffect(() => {
    if (!catalogue?.main || (coverOnly && !catalogue.managed) || (!canCreate && !catalogue.profiles.length && !catalogue.managed && !inSettings)) return;
    const control = (key: string, id?: number | string, enabled = !busy) => navigationControl(area, key, `CreativeProfiles.${key}`, 'candidate', enabled, id);
    const profiles = inSettings ? [catalogue.main, ...catalogue.profiles] : catalogue.profiles;
    const coverMounted = !dialog && !inSettings && Boolean(coverActions);
    const cardEnabled = (id: number) => !busy && (inSettings ? id !== active : id !== target || location.pathname !== '/pages');
    const viewport = dialog === 'list' ? listViewport.viewport : dialog ? null : rowViewport.viewport;
    dispatch(publishNavigationArea({
      areaId: area, source: 'CreativeProfiles',
      state: { activeMemberId: active || null, mainMemberId: catalogue.main.id, viewedMemberId: target,
        managed: catalogue.managed, canManage: Boolean(isOwner), canCreate, profileCount: catalogue.profiles.length, dialog, busy,
        proposedUsername: dialog === 'create' ? name.trim() : null, usernameAvailable: available,
        usernameCheckPending, usernameCheckError: usernameCheckError.slice(0, 200), usernameCheckAttempt,
        nameLength: name.length, bioLength: biography.length,
        selectedProfileId: dialog === 'delete' ? selected?.id ?? null : null,
        selectedProfileUsername: dialog === 'delete' ? selected?.username ?? null : null,
        ...Object.fromEntries((viewport?.visibleIds ?? []).flatMap(id => {
          const profile = profiles.find(profile => String(profile.id) === id);
          return profile ? [[`profileUsername_${id}`, profile.username]] : [];
        })) },
      ...(!coverOnly && viewport ? { scrolls: { [dialog === 'list' ? 'list' : 'row']: viewport } } : {}),
      visibleControls: [
        ...(!coverOnly && !dialog ? [control('expand'), ...(canCreate ? [control('create')] : [])] : []),
        ...(!coverOnly && (!dialog || dialog === 'list') ? profiles.map(profile => control(`profile_${profile.id}`, profile.id, cardEnabled(profile.id))) : []),
        ...(coverMounted && canEdit ? [control('details', target)] : []),
        ...(coverMounted && isOwner && catalogue.managed ? [active === target ? control('main', mainId) : control('use', target)] : []),
        ...(!dialog && !inSettings && !isOwner && catalogue.managed && pairedAvatar ? [control('visit_main', catalogue.main.id)] : []),
        ...(dialog ? [control('close_dialog')] : []),
        ...(dialog === 'create' ? [{ ...control('username'), kind: 'text' as const },
          ...(usernameCheckError && !usernameCheckPending ? [control('retry_username')] : []),
          navigationControl(area, 'create_submit', 'CreativeProfiles.createAccount', 'needs_confirmation', !busy && available === true, name.trim())] : []),
        ...(dialog === 'details' ? [{ ...control('profile_name'), kind: 'text' as const }, { ...control('profile_bio'), kind: 'text' as const },
          control('save_details', target)] : []),
        ...(dialog === 'list' && inSettings && isOwner ? profiles.filter(profile => profile.id !== mainId).map(profile => control(`delete_${profile.id}`, profile.id)) : []),
        ...(dialog === 'delete' && selected ? [navigationControl(area, 'delete_submit', 'CreativeProfiles.delete_submit', 'needs_confirmation', !busy, selected.id)] : []),
      ],
    }));
    return () => { dispatch(removeNavigationArea({ areaId: area, source: 'CreativeProfiles' })); };
  }, [active, area, busy, canCreate, canEdit, catalogue, coverOnly, coverActions, pairedAvatar, dialog, dispatch, inSettings, isOwner, mainId, target, name, biography, available, usernameCheckPending, usernameCheckError, usernameCheckAttempt, selected, listViewport.viewport, rowViewport.viewport, location.pathname]);

  const visit = (id: number, key: string) => {
    if (id === target && location.pathname === '/pages') return;
    move(key, () => navigate('/pages', { state: { userId: id } }), id);
  };
  const mutate = async (kind: 'create' | 'switch' | 'delete', key: string, id?: number) => {
    if (busy) return;
    const record = evidence(key, id);
    setBusy(true); setError('');
    record('unknown', 'Creative Profile operation started; the session reloads after the server confirms it.');
    try {
      if (kind !== 'delete' || id === active) await prepareDraftForProfileSwitch(active);
      const result = kind === 'create' ? await request<{ activeId: number }>('', json('POST', { username: name.trim() }))
        : kind === 'switch' ? await request<{ activeId: number }>('/switch', json('POST', { memberId: id }))
          : await request<{ activeId: number }>(`/${id}`, { method: 'DELETE' });
      record('succeeded');
      resetConversationMeasurementSessionId();
      const state = inSettings ? { ...location.state } : { userId: result.activeId };
      window.history.replaceState({ ...window.history.state, usr: { ...state, creativeProfileSwitch: true } }, '',
        inSettings ? window.location.href : '/pages');
      window.location.reload();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Could not complete that action. Try again.';
      record('failed', message);
      setError(message);
      setBusy(false);
    }
  };

  const saveDetails = async () => {
    if (busy || !canEdit) return;
    const record = evidence('save_details', target);
    setBusy(true); setError('');
    try {
      const data = await request<{ name: string; biography: string }>(`/${target}/details`, json('PATCH', { name, biography }));
      if (loggedUser) dispatch(setLoggedUser({ ...loggedUser, name: data.name, biography: data.biography }));
      setDialog(null);
      record('succeeded');
    } catch (reason) {
      record('failed');
      setError(reason instanceof Error ? reason.message : 'Could not save profile.');
    } finally { setBusy(false); }
  };
  if (catalogueError && !coverOnly) return <Typography variant="caption" role="status" sx={{ px: 1 }}>{catalogueError}</Typography>;
  if (coverOnly && !catalogue?.managed) return null;
  if (!catalogue?.main || (!canCreate && !catalogue.profiles.length && !catalogue.managed && !inSettings)) return null;
  const main = catalogue.main;
  const cards = inSettings ? [main, ...catalogue.profiles] : catalogue.profiles;
  const renderCard = (profile: Profile, inList = false) => (
    <Box key={profile.id} data-navigation-scroll-id={String(profile.id)} sx={{ minWidth: 62, textAlign: 'center', position: 'relative' }}>
      <Button disabled={busy} onClick={() => { if (canOpenCard(profile.id)) inSettings ? void mutate('switch', `profile_${profile.id}`, profile.id) : visit(profile.id, `profile_${profile.id}`); }}
        data-ai-action={canOpenCard(profile.id) && (!dialog || inList) ? mapped(`profile_${profile.id}`) : undefined}
        aria-current={profile.id === active ? 'true' : undefined} aria-label={inSettings ? `Use ${profile.username}` : `Visit ${profile.username}`}
        sx={{ ...circleFocus, minWidth: 0, p: 0.5, display: 'inline-flex', flexDirection: 'column', textTransform: 'none', color: 'inherit' }}>
        <Avatar src={profile.image} alt="" sx={{ width: 46, height: 46, outline: profile.id === active ? `2px solid ${accent}` : 'none', outlineOffset: 2 }}>{profile.username[0]}</Avatar>
        <Typography variant="caption" noWrap sx={{ maxWidth: 76, mt: 0.5 }}>{inSettings && profile.id === main.id ? 'Main' : profile.username}</Typography>
      </Button>
      {inList && inSettings && isOwner && profile.id !== main.id &&
        <IconButton disabled={busy} size="small" aria-label={`Remove ${profile.username}`} data-ai-action={mapped(`delete_${profile.id}`)}
          sx={{ color: 'inherit', width: 36, height: 36 }}
          onClick={() => move(`delete_${profile.id}`, () => { setSelected(profile); setError(''); setDialog('delete'); }, profile.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>}
    </Box>
  );
  return (
    <Box className="creative-profile-circles" onClick={event => event.stopPropagation()} sx={coverOnly ? { display: 'contents' } : { position: 'relative', width: '100%', minWidth: 0, px: 1, pt: 1 }}>
      {!inSettings && catalogue.managed && isOwner && coverActions && createPortal(
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ pb: 0.5 }}>
          {canEdit && <Button data-ai-action={mapped('details')} onClick={() => move('details', () => { setName(loggedUser?.name?.trim() || ''); setBiography(loggedUser?.biography || ''); setError(''); setDialog('details'); }, target)}
            sx={{ color: 'inherit', textTransform: 'none' }}>Edit profile</Button>}
          {active === target
              ? <Button data-ai-action={mapped('main')} startIcon={<Avatar src={main.image} sx={{ width: 24, height: 24 }} />} disabled={busy} sx={coverAction} onClick={() => void mutate('switch', 'main', main.id)}>Main</Button>
              : <Button data-ai-action={mapped('use')} disabled={busy} sx={coverAction} onClick={() => void mutate('switch', 'use', target)}>Use</Button>}
        </Stack>, coverActions)}
      {!inSettings && catalogue.managed && !isOwner && pairedAvatar && createPortal(
        <IconButton aria-label={`Visit Main profile ${main.username}`} data-ai-action={mapped('visit_main')} onClick={() => visit(main.id, 'visit_main')}
          sx={{ ...circleFocus, p: 0, position: 'absolute', right: -9, bottom: -3, border: `2px solid ${dark ? '#161616' : '#fff'}` }}>
          <Avatar src={main.image} alt={main.username} sx={{ width: 30, height: 30 }}>{main.username[0]}</Avatar>
        </IconButton>, pairedAvatar)}
      {!coverOnly && <><IconButton data-ai-action={mapped('expand')} aria-label="Expand Creative Profiles" size="small" onClick={() => move('expand', () => setDialog('list'))}
        sx={{ position: 'absolute', right: 6, top: 0, color: 'inherit' }}><OpenInFullIcon fontSize="small" /></IconButton>
      <Stack ref={element => { rowViewport.ref.current = element; }} onScroll={rowViewport.onScroll}
        data-ai-scroll={!dialog ? `${area}:row` : undefined} direction="row" spacing={0.5} sx={{ overflowX: 'auto', pt: 2.5, pb: 0.5 }}>
        {cards.map(profile => renderCard(profile))}
        {canCreate && <Button data-ai-action={mapped('create')} onClick={() => move('create', () => { setName(''); setError(''); setDialog('create'); })} sx={{ ...circleFocus, minWidth: 80, p: 0.5, flexDirection: 'column', color: 'inherit', textTransform: 'none' }}>
          <Avatar sx={{ ...action, width: 46, height: 46, backdropFilter: 'blur(12px)' }}><AddIcon /></Avatar>
          <Typography variant="caption" sx={{ mt: 0.5 }}>Create Profile</Typography>
        </Button>}
      </Stack>
      </>}
      {!dialog && error && <Alert severity="error">{error}</Alert>}
      <Dialog open={Boolean(dialog)} onClose={() => { if (!busy) { setDialog(null); setError(''); } }} fullWidth maxWidth="sm"
        PaperProps={{ sx: { ...glass, borderRadius: 3, ...(dialog === 'list' ? { height: '80dvh' } : {}) } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {dialog === 'create' ? 'Create Profile' : dialog === 'delete' ? 'Remove Creative Profile?' : dialog === 'details' ? 'Edit profile' : 'Creative Profiles'}
          <IconButton aria-label="Close" data-ai-action={mapped('close_dialog')} disabled={busy} onClick={() => move('close_dialog', () => { setDialog(null); setError(''); })} sx={{ color: 'inherit' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent ref={dialog === 'list' ? listViewport.ref : undefined} onScroll={listViewport.onScroll}
          data-ai-scroll={dialog === 'list' ? `${area}:list` : undefined} sx={{ overflowY: 'auto' }}>
          {dialog === 'list' && <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>{cards.map(profile => renderCard(profile, true))}</Stack>}
          {dialog === 'create' && <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>Give your characters, worlds, and creative ideas their own identity.</Typography>
            <TextField autoFocus label="Username" value={name} disabled={busy} onChange={event => { setAvailable(null); setUsernameCheckError(''); setName(event.target.value); }}
              slotProps={{ htmlInput: { maxLength: 32, 'data-ai-action': mapped('username') } }}
              error={available === false || Boolean(usernameCheckError)}
              helperText={usernameCheckPending ? 'Checking username…' : usernameCheckError || (available === true ? 'Username available' : available === false ? 'Username is taken' : '3 to 32 letters, numbers, or underscores')} />
            {usernameCheckError && !usernameCheckPending && <Button data-ai-action={mapped('retry_username')} disabled={busy}
              onClick={() => move('retry_username', () => setUsernameCheckAttempt(attempt => attempt + 1))} sx={{ color: 'inherit' }}>Try again</Button>}
            <Button data-ai-action={mapped('create_submit')} sx={action} disabled={busy || available !== true} onClick={() => void mutate('create', 'create_submit')}>Create Profile</Button>
          </Stack>}
          {dialog === 'delete' && selected && <Stack spacing={2}>
            <Typography>Remove @{selected.username} from Main. This profile must have no posts or saved drafts.</Typography>
            <Button data-ai-action={mapped('delete_submit')} color="error" variant="contained" disabled={busy} onClick={() => void mutate('delete', 'delete_submit', selected.id)}>Remove Creative Profile</Button>
          </Stack>}
          {dialog === 'details' && <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Name" value={name} slotProps={{ htmlInput: { maxLength: 60, 'data-ai-action': mapped('profile_name') } }} onChange={event => setName(event.target.value)} />
            <TextField label="Bio" value={biography} multiline minRows={3} slotProps={{ htmlInput: { maxLength: 500, 'data-ai-action': mapped('profile_bio') } }} onChange={event => setBiography(event.target.value)} />
            <Button data-ai-action={mapped('save_details')} sx={action} disabled={busy} onClick={() => void saveDetails()}>Save profile</Button>
          </Stack>}
          {dialog && error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
