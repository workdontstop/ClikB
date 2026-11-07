import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Dialog, IconButton, TextField, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import UploadIcon from '@mui/icons-material/Upload';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { TEMPLATE_COVER_MODELS, type TemplateCoverQuality } from '../server/src/templateCoverModels';
import { calcModelPixels } from './ModelPixels';
import { publishNavigationArea, recordNavigationTransition, removeNavigationArea } from './brainstormSlice';
import { navigationControl } from './navigationControlSnapshot';
import { getExecutingNavigationAction } from './navigationActionProvenance';
import type { RootState } from './store';
import { useNavigationViewport } from './useNavigationViewport';
import { registerSharedBack } from './SharedBackControl';
import { creationValueRevision } from '../server/src/creationControlIdentity';
import './SocialChat.css';
import './ProfileImageLauncher.css';
import { CropImageModal } from './CropImageModal';

type Preview = { imageUrl: string; receipt: string; quality: TemplateCoverQuality | null; source: 'current' | 'direct' | 'generated' };
type ImageTarget = 'avatar' | 'cover';
type ProfileImageLauncherProps = {
  open: boolean;
  memberId: number;
  target: ImageTarget;
  currentImageUrl?: string;
  onClose: () => void;
  onGenerated: (imageUrl: string) => void;
};

const area = 'clikb.navigation.profile_image' as const;
const qualityChoices: TemplateCoverQuality[] = ['hd', 'sd2', 'sd'];

export default function ProfileImageLauncher({ open, memberId, target, currentImageUrl = '', onClose, onGenerated }: ProfileImageLauncherProps) {
  const dispatch = useDispatch();
  const dark = useSelector((state: RootState) => state.settings.darkMode);
  const accent = useSelector((state: RootState) => dark ? state.settings.appColorDark : state.settings.appColorLight);
  const pixels = useSelector((state: RootState) => state.settings.pixels);
  const activeId = useSelector((state: RootState) => state.profile.loggedUser?.id);
  const llmTier = useSelector((state: RootState) => state.settings.languageModel);
  const [aiPrompt, setAiPrompt] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState<'recreate' | 'edit'>('recreate');
  const [quality, setQuality] = useState<TemplateCoverQuality>('hd');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [savedImage, setSavedImage] = useState<Preview | null>(null);
  const [removePending, setRemovePending] = useState(false);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [busy, setBusy] = useState<'' | 'rewrite' | 'generate' | 'use' | 'upload'>('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const runId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const previewRef = useRef<Preview | null>(null);
  const visibleRef = useRef(false);
  const applyingRef = useRef(false);
  const rewriteRequest = useRef<{ signature: string; id: string } | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const cropImageRef = useRef<string | null>(null);
  const currentImageUrlRef = useRef(currentImageUrl);
  currentImageUrlRef.current = currentImageUrl;
  const viewport = useNavigationViewport('vertical', `${open}:${memberId}:${target}:${revision}:${busy}:${aiPrompt.length}:${imagePrompt.length}`);
  const base = import.meta.env.VITE_CLIK_URL || '';
  const allowed = Number(activeId) === memberId && Number.isSafeInteger(memberId) && memberId > 0;
  const config = TEMPLATE_COVER_MODELS[quality];
  const quote = calcModelPixels({ model: config.model, baseImagesPerDollar: 333 });
  const updatesPrompt = promptExpanded && Boolean(aiPrompt.trim());
  const generationPrompt = promptExpanded ? imagePrompt : aiPrompt;
  const canGenerate = updatesPrompt || Boolean(generationPrompt.trim()) && pixels >= quote
    && (imageMode !== 'edit' || Boolean(preview?.receipt));
  const canUse = Boolean(preview && preview.source !== 'current' || removePending && savedImage?.receipt);
  const mapped = (key: string) => `${area}.action.${key}`;
  const record = (key: string, outcome: 'succeeded' | 'failed' | 'unknown') => dispatch(recordNavigationTransition({
    actor: getExecutingNavigationAction() === mapped(key) ? 'ai' : 'manual', kind: 'control', outcome,
    before: { areaId: area, entityId: memberId },
    after: { areaId: area, entityId: memberId, controlId: `${area}.control.${key}`, state: { target } },
    authoritativeSource: 'ProfileImageLauncher',
  }));

  const discard = useCallback(() => {
    const previous = previewRef.current;
    previewRef.current = null;
    if (previous && previous.source !== 'current') void axios.post(`${base}/profile-image/discard`, { memberId, kind: target,
      imageUrl: previous.imageUrl, receipt: previous.receipt }, { withCredentials: true }).catch(() => {});
  }, [base, memberId, target]);
  const clearPreview = () => {
    discard();
    setPreview(null);
  };

  useEffect(() => {
    if (!open) return;
    visibleRef.current = true;
    const initial: Preview | null = allowed && currentImageUrlRef.current
      ? { imageUrl: currentImageUrlRef.current, receipt: '', quality: null, source: 'current' } : null;
    previewRef.current = initial;
    setAiPrompt(''); setImagePrompt(''); setPromptExpanded(false); setInspectOpen(false); setCropImage(null);
    setImageMode(initial ? 'edit' : 'recreate'); setQuality('hd'); setPreview(initial); setSavedImage(null);
    setRemovePending(false); setBusy(''); setError(''); setRevision(0); setLoadingCurrent(allowed);
    const loadController = new AbortController();
    if (allowed) void (async () => {
      try {
        const options = { withCredentials: true, signal: loadController.signal };
        const { data } = await axios.post<{ imageUrl: string; profileImageReceipt: string | null }>(`${base}/profile-image/current`,
          { memberId, kind: target }, options);
        if (loadController.signal.aborted) return;
        const current: Preview | null = data.imageUrl && data.profileImageReceipt
          ? { imageUrl: data.imageUrl, receipt: data.profileImageReceipt, quality: null, source: 'current' } : null;
        setSavedImage(current);
        if (previewRef.current === initial) {
          previewRef.current = current; setPreview(current); setImageMode(current ? 'edit' : 'recreate');
          setRevision(value => value + 1);
        }
      } catch {
        if (!loadController.signal.aborted) setError('The saved image could not be loaded for editing. Close and reopen to retry.');
      } finally {
        if (!loadController.signal.aborted) setLoadingCurrent(false);
      }
    })();
    return () => {
      visibleRef.current = false;
      loadController.abort();
      runId.current += 1;
      // Applying an already generated image may commit after native Back.
      // Keep its response alive so the owning profile can reconcile the save.
      if (applyingRef.current) return;
      controller.current?.abort();
      controller.current = null;
      discard();
    };
  }, [open, memberId, target, activeId, allowed, base, discard]);

  useEffect(() => {
    if (!open) return;
    const control = (key: string, enabled = true) => navigationControl(area, key, `ProfileImageLauncher.${key}`, 'candidate', enabled, memberId);
    dispatch(publishNavigationArea({
      areaId: area, source: 'ProfileImageLauncher',
      state: { memberId, target, quality, busy: Boolean(busy), operation: busy, aiPromptLength: aiPrompt.length,
        imagePromptLength: imagePrompt.length, hasPreview: Boolean(preview), previewRevision: revision, error,
        aiPromptRevision: creationValueRevision(aiPrompt), imagePromptRevision: creationValueRevision(imagePrompt),
        quotedPixels: quote, previewQuality: preview?.quality || null, permitted: allowed, promptExpanded, inspectOpen,
        primaryMode: updatesPrompt ? 'update_prompt' : 'generate', imageMode, previewSource: preview?.source || null,
        cropOpen: Boolean(cropImage), loadingCurrent, removePending, hasChanges: canUse },
      ...(viewport.viewport ? { scrolls: { content: viewport.viewport } } : {}),
      visibleControls: [
        ...(cropImage ? [] : inspectOpen ? [control('close_inspect')] : [
          control('close', busy !== 'use'),
          navigationControl(area, 'upload', 'ProfileImageLauncher.fileInput.click', 'needs_handoff', !busy && allowed, memberId),
          { ...control('ai_prompt', !busy && allowed), kind: 'text' as const },
          control('toggle_prompt', !busy),
          control('mode_recreate', !busy && imageMode !== 'recreate'),
          control('mode_edit', !busy && imageMode !== 'edit' && Boolean(preview?.receipt)),
          ...(promptExpanded ? [{ ...control('image_prompt', !busy && allowed), kind: 'text' as const }] : []),
          ...qualityChoices.map(key => control(`quality_${key}`, !busy && quality !== key)),
          control('generate', !busy && allowed && canGenerate),
          ...(preview ? [control('remove', !busy && allowed && !loadingCurrent), control('inspect', !busy)] : []),
          ...(preview || removePending ? [control('use', !busy && allowed && canUse)] : []),
        ]),
      ],
    }));
    return () => { dispatch(removeNavigationArea({ areaId: area, source: 'ProfileImageLauncher' })); };
  }, [dispatch, open, memberId, target, quality, busy, aiPrompt, imagePrompt, preview, revision, error, quote, allowed, pixels, viewport.viewport, promptExpanded, inspectOpen, cropImage, imageMode, loadingCurrent, removePending, canUse, canGenerate]);

  useEffect(() => () => { if (cropImage) URL.revokeObjectURL(cropImage); }, [cropImage]);

  const closeInspect = () => {
    setInspectOpen(false);
    if (window.history.state?.profileImageInspect) window.history.back();
    record('close_inspect', 'succeeded');
  };
  const inspect = () => {
    if (!preview) return;
    window.history.pushState({ ...window.history.state, profileImageInspect: { memberId, target } }, '');
    setInspectOpen(true);
    record('inspect', 'succeeded');
  };
  useEffect(() => {
    const restore = () => {
      setInspectOpen(Boolean(window.history.state?.profileImageInspect?.memberId === memberId
        && window.history.state?.profileImageInspect?.target === target));
      const crop = window.history.state?.profileImageCrop;
      if (cropImageRef.current && (crop?.memberId !== memberId || crop?.target !== target)) {
        cropImageRef.current = null;
        runId.current += 1; controller.current?.abort(); setBusy(''); setCropImage(null);
      }
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [memberId, target]);

  const close = () => {
    if (cropImage) { window.history.back(); return; }
    if (inspectOpen) { closeInspect(); return; }
    if (busy === 'use') return;
    runId.current += 1;
    controller.current?.abort();
    clearPreview();
    onClose();
    record('close', 'succeeded');
  };
  useEffect(() => {
    if (open) return registerSharedBack('profileImage', { priority: 320, label: cropImage ? 'Close image crop' : inspectOpen ? 'Close image preview' : 'Close image creator', back: close });
  }, [open, busy, onClose, discard, inspectOpen, cropImage]);
  const run = async (key: 'rewrite' | 'generate' | 'use', work: (signal: AbortSignal) => Promise<void>, actionKey: string = key) => {
    if (busy || !allowed) return;
    const id = ++runId.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(key); setError('');
    try {
      await work(abort.signal);
      if (id === runId.current && !abort.signal.aborted) record(actionKey, 'succeeded');
    } catch (reason) {
      if (id === runId.current && !abort.signal.aborted) {
        const failure = reason as { response?: { data?: { error?: string; message?: string } }; message?: string } | null;
        setError(failure?.response?.data?.error || failure?.response?.data?.message || failure?.message || 'That image request could not be completed.');
        record(actionKey, 'failed');
      }
    } finally {
      if (id === runId.current) { setBusy(''); controller.current = null; }
    }
  };
  const rewrite = () => void run('rewrite', async signal => {
    const signature = JSON.stringify([memberId, target, aiPrompt, imagePrompt, llmTier]);
    if (rewriteRequest.current?.signature !== signature) rewriteRequest.current = { signature,
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}` };
    const options = { signal, withCredentials: true };
    const { data } = await axios.post<{ imagePrompt: string }>(`${base}/profile-image/prompt`, {
      memberId, kind: target, request: aiPrompt, imagePrompt, llmTier, promptOperationId: rewriteRequest.current.id,
    }, options);
    if (signal.aborted) return;
    if (typeof data.imagePrompt !== 'string' || !data.imagePrompt.trim()) throw new Error('The image prompt was not returned.');
    rewriteRequest.current = null;
    setImagePrompt(data.imagePrompt.slice(0, 6000));
    setAiPrompt('');
    setRevision(value => value + 1);
  }, 'generate');
  const generate = () => void run('generate', async signal => {
    if (pixels < quote) throw new Error(`This image needs ${quote} P.`);
    const options = { signal, withCredentials: true, timeout: config.timeoutMs };
    if (imageMode === 'edit' && !preview?.receipt) throw new Error('Choose a verified image before editing it.');
    const { data } = await axios.post<{ imageUrl: string; profileImageReceipt: string }>(`${base}/${config.route}`, {
      inputs: generationPrompt, width: target === 'avatar' ? 1024 : 1920, height: target === 'avatar' ? 1024 : 1080,
      ty: target === 'avatar' ? 2 : 3, size: '2K', guidance: 7.5, num_inference_steps: config.steps,
      seed: Math.floor(Math.random() * 1000000), linkmode: true,
      billingAction: 'profile-image', profileImage: { memberId, kind: target,
        ...(imageMode === 'edit' && preview ? { source: { imageUrl: preview.imageUrl, receipt: preview.receipt } } : {}) },
      ...(imageMode === 'edit' && preview ? { sampleImages: [preview.imageUrl] } : {}),
    }, options);
    if (signal.aborted) return;
    if (!data.imageUrl || !data.profileImageReceipt) throw new Error('The generated image could not be verified.');
    discard();
    const next: Preview = { imageUrl: String(data.imageUrl), receipt: String(data.profileImageReceipt), quality, source: 'generated' };
    previewRef.current = next;
    setPreview(next);
    setRemovePending(false);
    setImageMode('recreate');
    setRevision(value => value + 1);
  });
  const selectDirectImage = async (imageBase64: string) => {
    if (!visibleRef.current || !allowed || busy) throw new Error('This profile image cannot be changed now.');
    const id = ++runId.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy('upload'); setError('');
    try {
      const options = { withCredentials: true, signal: abort.signal };
      const { data } = await axios.post<{ imageUrl: string; profileImageReceipt: string }>(`${base}/profile-image/upload`, {
        memberId, kind: target, imageBase64,
      }, options);
      if (abort.signal.aborted || id !== runId.current) throw new Error('The image selection was cancelled.');
      if (!data.imageUrl || !data.profileImageReceipt) throw new Error('The uploaded image could not be verified.');
      discard();
      const next: Preview = { imageUrl: data.imageUrl, receipt: data.profileImageReceipt, quality: null, source: 'direct' };
      previewRef.current = next; setPreview(next); setRemovePending(false); setImageMode('edit'); setRevision(value => value + 1);
      record('upload', 'succeeded');
    } catch (reason) {
      if (!abort.signal.aborted && id === runId.current) {
        setError(reason instanceof Error ? reason.message : 'That upload could not be completed.');
        record('upload', 'failed');
      }
      throw reason;
    } finally {
      if (id === runId.current) { setBusy(''); controller.current = null; }
    }
  };
  const removeImage = () => {
    if (busy || !allowed || loadingCurrent) return;
    clearPreview(); setRemovePending(Boolean(savedImage)); setImageMode('recreate');
    setRevision(value => value + 1); record('remove', 'succeeded');
  };
  const useImage = () => void run('use', async () => {
    if (!canUse) return;
    const image = removePending ? savedImage : preview;
    if (!image) return;
    const expectedUrl = removePending ? '' : image.imageUrl;
    const applyingRun = runId.current;
    applyingRef.current = true;
    try {
      const options = { withCredentials: true };
      const { data } = await axios.post<{ memberId: number; kind: ImageTarget; imageUrl: string }>(`${base}/profile-image/${removePending ? 'remove' : 'use'}`, {
        memberId, kind: target, imageUrl: image.imageUrl, receipt: image.receipt,
      }, options);
      if (Number(data.memberId) !== memberId || data.kind !== target || data.imageUrl !== expectedUrl) throw new Error('The profile image update could not be verified.');
      if (previewRef.current === preview) previewRef.current = null;
      record('use', 'succeeded');
      onGenerated(data.imageUrl);
      if (visibleRef.current && applyingRun === runId.current) onClose();
    } finally {
      applyingRef.current = false;
      if (!visibleRef.current) discard();
    }
  });

  return <><Dialog open={open} onClose={close} maxWidth={false} disableEnforceFocus={inspectOpen || Boolean(cropImage)} aria-labelledby="profile-image-title" sx={{ zIndex: 11010,
    '@media (max-width: 600px)': { '& .MuiDialog-container': { alignItems: 'flex-end' } } }}
    slotProps={{ backdrop: { className: 'social-panel-backdrop' } }}
    PaperProps={{ className: `social-panel profile-image-launcher profile-image-launcher--${target}${dark ? ' social-panel-dark' : ''}`,
      style: { '--chat-accent': accent, '--chat-accent-text': dark ? '#000' : '#fff',
        visibility: inspectOpen || cropImage ? 'hidden' : undefined } as CSSProperties }}>
    <header className="profile-image-header"><h2 id="profile-image-title">{target === 'avatar' ? 'Profile picture' : 'Cover image'}</h2>
      <Button className="profile-image-upload" aria-label="Upload image" disabled={Boolean(busy) || !allowed} data-ai-action={mapped('upload')}
        startIcon={<UploadIcon />} onClick={() => fileInput.current?.click()}>Direct</Button>
      <IconButton aria-label="Close image creator" data-ai-action={mapped('close')} disabled={busy === 'use'} onClick={close}><CloseIcon /></IconButton>
    </header>
    <input ref={fileInput} type="file" accept="image/*" hidden onChange={event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (!file) return;
      const objectUrl = URL.createObjectURL(file); cropImageRef.current = objectUrl; setCropImage(objectUrl);
      window.history.pushState({ ...window.history.state, profileImageCrop: { memberId, target } }, '');
    }} />
    <div className="profile-image-content" ref={element => { viewport.ref.current = element; }} onScroll={viewport.onScroll} data-ai-scroll={`${area}:content`}>
      {preview && <div className={`profile-image-result profile-image-preview-wrap--${target}`}>
        <button type="button" className="profile-image-preview-wrap" aria-label="Inspect image" data-ai-action={mapped('inspect')} onClick={inspect} disabled={Boolean(busy)}>
          <img className={`profile-image-preview profile-image-preview--${target}`} src={preview.imageUrl} alt={`${preview.source === 'current' ? 'Current' : 'Selected'} ${target === 'avatar' ? 'profile picture' : 'cover image'}`} /></button>
        <IconButton className="profile-image-remove" size="small" aria-label="Remove image" data-ai-action={mapped('remove')}
          disabled={Boolean(busy) || !allowed || loadingCurrent} onClick={removeImage}><DeleteOutlineIcon fontSize="small" /></IconButton>
      </div>}
      {removePending && <p>Image removed from this preview. Press Use image to save the removal.</p>}
      <TextField label="Update with AI" value={aiPrompt} multiline minRows={2} disabled={Boolean(busy) || !allowed}
        onChange={event => setAiPrompt(event.target.value)} slotProps={{ htmlInput: { maxLength: 1000, 'data-ai-action': mapped('ai_prompt') } }} />
      <div className="profile-image-prompt-row"><Button className="profile-image-toggle" endIcon={<ExpandMoreIcon style={{ transform: promptExpanded ? 'rotate(180deg)' : undefined }} />}
        aria-expanded={promptExpanded} data-ai-action={mapped('toggle_prompt')} disabled={Boolean(busy)}
        onClick={() => { setPromptExpanded(value => !value); record('toggle_prompt', 'succeeded'); }}>Image prompt</Button>
        <div className="profile-image-modes" role="group" aria-label="Image generation mode">{(['recreate', 'edit'] as const).map(mode =>
          <button key={mode} type="button" aria-pressed={imageMode === mode} disabled={Boolean(busy) || (mode === 'edit' && !preview?.receipt)}
            data-ai-action={imageMode !== mode ? mapped(`mode_${mode}`) : undefined}
            onClick={() => { setImageMode(mode); record(`mode_${mode}`, 'succeeded'); }}>{mode === 'edit' ? 'Edit' : 'Recreate'}</button>)}</div>
      </div>
      {promptExpanded && <TextField label="Image prompt" value={imagePrompt} multiline minRows={3} disabled={Boolean(busy) || !allowed}
        onChange={event => setImagePrompt(event.target.value)}
        slotProps={{ htmlInput: { maxLength: 6000, 'data-ai-action': mapped('image_prompt') } }} />}
      <div className="profile-image-qualities">{qualityChoices.map(key => {
        const model = TEMPLATE_COVER_MODELS[key];
        const cost = calcModelPixels({ model: model.model, baseImagesPerDollar: 333 });
        return <Tooltip key={key} title={model.label}><button type="button" aria-pressed={quality === key} disabled={Boolean(busy)}
          data-ai-action={quality !== key ? mapped(`quality_${key}`) : undefined}
          onClick={() => { setQuality(key); record(`quality_${key}`, 'succeeded'); }}>
          <strong>{key.toUpperCase()}</strong><span>{cost} P</span>
        </button></Tooltip>;
      })}</div>
      {!allowed && <p role="alert">Switch to this profile before changing its image.</p>}
      {error && <p role="alert">{error}</p>}
    </div>
    <footer className="profile-image-actions"><Button data-ai-action={mapped('generate')}
      disabled={Boolean(busy) || !allowed || !canGenerate}
      startIcon={updatesPrompt ? <AutoFixHighIcon /> : undefined} onClick={updatesPrompt ? rewrite : generate}>
      {busy === 'rewrite' ? 'Updating…' : busy === 'generate' ? 'Generating…' : updatesPrompt ? 'Update with AI' : `Generate · ${quote} P`}</Button>
      {(preview || removePending) && <Button data-ai-action={mapped('use')} disabled={Boolean(busy) || !allowed || !canUse} onClick={useImage}>{busy === 'use' ? 'Saving…' : 'Use image'}</Button>}
    </footer>
  </Dialog>
    {inspectOpen && preview && createPortal(<div className="profile-image-inspection" role="dialog" aria-modal="true" aria-label="Image preview" onClick={closeInspect}>
      <IconButton aria-label="Close image preview" data-ai-action={mapped('close_inspect')}
        onClick={event => { event.stopPropagation(); closeInspect(); }}><CloseIcon /></IconButton>
      <div className={`profile-image-inspection-frame profile-image-inspection-frame--${target}`}>
        <img src={preview.imageUrl} alt="Full size profile image preview" onClick={event => event.stopPropagation()} />
      </div>
    </div>, document.body)}
    {cropImage && createPortal(<CropImageModal isOpen imageUrl={cropImage} typeVal={target === 'cover' ? 1 : 0}
      setUserProfile={() => {}} onClose={() => {
        if (busy === 'upload') { runId.current += 1; controller.current?.abort(); setBusy(''); }
        cropImageRef.current = null; setCropImage(null);
      }} onSelect={selectDirectImage} />, document.body)}
  </>;
}
