import { useState } from 'react';
import { Alert, Box, Button, Card, MenuItem, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { creationBinding as cb } from './creationControlSnapshot';
import { useCreationControls } from './useCreationControls';
import { normalizeImageUrlToS3 } from './imageCorsDownloadManager';
import { getReferenceGenerationRoute } from './characterReferenceEditing';
import { getWorldCharacterImagePrompt } from './worldCharacterDescription';
import { expectedMediaCharge } from './mediaPricing';
import type { RootState } from './store';

const api = import.meta.env.VITE_CLIK_URL;
export const WORLD_GROUPS = [
    ['character', 'Characters'], ['environment', 'Environments & Places'], ['object', 'Objects & Vehicles'],
] as const;
export type WorldAssetKind = typeof WORLD_GROUPS[number][0];
type Asset = { key: string; id?: number; kind: WorldAssetKind; name: string; description: string; image: string; originalImage?: string };
export type EditableWorld = { id: number; catalog_revision?: number; title: string; description: string; blueprint: string;
    characters: { id: number; kind?: WorldAssetKind; name: string; description: string; image: string }[] };
type Props = {
    open: boolean; darkMode: boolean; PRIMARY_COLOR: string; onClose: () => void; setCreationDone: (done: boolean) => void;
    Planx?: unknown; steps?: string[]; prompt?: string; ImagesHdCloud?: string[]; modelz?: string; Seed?: number;
    PostId?: number; selectedStyle?: string; GeneratedImageFirst?: string; Vipcharacters?: any[]; referenceImages?: any[];
    world?: EditableWorld; matchMobile?: boolean; GeneratedText?: string[];
};

export default function WorldCreation(props: Props) {
    const { open, darkMode, PRIMARY_COLOR, world, Planx, steps = [], ImagesHdCloud = [], modelz, Seed, PostId,
        selectedStyle, prompt, Vipcharacters = [], referenceImages = [], setCreationDone } = props;
    const tier = useSelector((state: RootState) => state.settings.languageModel);
    const pixels = useSelector((state: RootState) => state.settings.pixels);
    const ratio = useSelector((state: RootState) => state.settings.aspectRatio);
    const model = modelz || 'fluxUltra';
    const accent = { bgcolor: PRIMARY_COLOR, color: darkMode ? '#000' : '#fff', borderRadius: 5,
        '&:hover': { bgcolor: PRIMARY_COLOR, filter: 'brightness(1.08)' } };
    const [title, setTitle] = useState(world?.title || '');
    const [description, setDescription] = useState(world?.description || '');
    const [blueprint, setBlueprint] = useState(world?.blueprint || '');
    const [assets, setAssets] = useState<Asset[]>(() => (world?.characters || []).map(asset => ({
        ...asset, id: Number(asset.id), key: String(asset.id), kind: asset.kind || 'character',
        description: asset.description || '', image: asset.image || '', originalImage: asset.image || '',
    })));
    const coverPreview = props.GeneratedImageFirst || ImagesHdCloud[0];
    const [ready, setReady] = useState(Boolean(world));
    const [selected, setSelected] = useState('');
    const [mode, setMode] = useState<'recreate' | 'edit'>('recreate');
    const [reference, setReference] = useState('');
    const [instruction, setInstruction] = useState('');
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const asset = assets.find(item => item.key === selected);
    const update = (key: string, patch: Partial<Asset>) => setAssets(items => items.map(item => item.key === key ? { ...item, ...patch } : item));

    const sourceReferences = [...referenceImages, ...Vipcharacters].map(item => ({
        name: String(item.name || '').trim(), description: String(item.description || item.prompt || ''),
        kind: item.assetKind || (item.type === 'environment' ? 'environment' : 'character'),
        image: String(item.imageUrl || item.url || item.image || ''),
    })).filter(item => item.name);
    const references = [...sourceReferences, ...assets, ...ImagesHdCloud.map((image, index) => ({ image, name: 'Scene ' + (index + 1) }))]
        .filter((item, index, all) => item.image && all.findIndex(candidate => candidate.image === item.image) === index);

    const run = async (label: string, work: () => Promise<void>) => {
        if (busy) return;
        setBusy(label); setError('');
        try { await work(); }
        catch (reason: any) { setError(reason.response?.data?.error || reason.message || 'Please try again.'); }
        finally { setBusy(''); }
    };
    const generateBlueprint = () => run('Preparing blueprint…', async () => {
        const { data } = await axios.post<{ title: string; description: string; 'Plan Summary': string; Characters: Asset[]; Environments: Asset[]; Objects: Asset[] }>(api + '/generate-world-remix', {
            originalPrompt: prompt, rawPlan: Planx, sceneSteps: steps, llmTier: tier,
            references: sourceReferences.map(({ name, description, kind }) => ({ name, description, kind })),
        }, { withCredentials: true });
        if (!data || typeof data['Plan Summary'] !== 'string') throw new Error('The World blueprint was incomplete. Try again.');
        setTitle(data.title || ''); setDescription(data.description || ''); setBlueprint(data['Plan Summary']);
        setAssets(WORLD_GROUPS.flatMap(([kind], groupIndex) => {
            const values = data[(['Characters', 'Environments', 'Objects'] as const)[groupIndex]];
            return Array.isArray(values) ? values.filter(item => typeof item?.name === 'string' && item.name.trim()).map(item => ({
                key: crypto.randomUUID(), kind, name: item.name, description: String(item.description || ''),
                image: sourceReferences.find(ref => ref.image && ref.kind === kind &&
                    ref.name.toLowerCase() === item.name.trim().toLowerCase())?.image || '',
            })) : [];
        }));
        setReady(true);
    });

    const selectAsset = (item: Asset) => {
        setSelected(item.key); setMode('recreate'); setReference('');
        setInstruction(item.kind === 'character' ? getWorldCharacterImagePrompt(item.description) : item.description);
    };
    const generateImage = () => run('Generating image…', async () => {
        if (!asset || !instruction.trim()) return;
        const source = mode === 'edit' ? asset.image : reference;
        const route = getReferenceGenerationRoute(model, source ? 'edit' : 'recreate');
        const payload = { inputs: instruction, width: 1080, height: 1920, guidance: 7.5, num_inference_steps: 35, seed: Seed,
            ty: ratio, model, billingAction: 'world-character', billingReference: asset.name,
            ...(source ? { sampleImage: source, sampleImages: [source] } : {}) };
        const quote = expectedMediaCharge(api + '/' + route, payload);
        if (quote && Number(pixels) < quote.pixels) throw new Error('You need ' + quote.pixels + ' Pixels.');
        const { data } = await axios.post<{ imageBase64?: string }>(api + '/' + route, payload, { withCredentials: true });
        if (!data.imageBase64) throw new Error('The model returned no image.');
        update(asset.key, { image: data.imageBase64 });
    });
    const save = () => run('Saving World…', async () => {
        if (!title.trim() || (!world && !blueprint.trim()) ||
            assets.some(item => !item.name.trim() || (!item.image && (item.id == null || item.image !== item.originalImage)))) {
            throw new Error('Add a title and blueprint, and a name and image for each retained asset.');
        }
        const coverSource = !world ? ImagesHdCloud[0] || props.GeneratedImageFirst : undefined;
        const cover = coverSource?.startsWith('data:') || coverSource?.startsWith('blob:')
            ? await normalizeImageUrlToS3(coverSource, 'world-upload') : coverSource;
        const savedAssets = [];
        for (const item of assets) {
            const needsUpload = item.image.startsWith('data:') || item.image.startsWith('blob:');
            const image = needsUpload ? await normalizeImageUrlToS3(item.image, 'world-upload') : item.image;
            savedAssets.push({ id: item.id, name: item.name, description: item.description, kind: item.kind, image });
        }
        await axios.post(api + '/create_world_model', {
            worldId: world?.id, revision: world?.catalog_revision || 0, PostId, selectedStyle, title, description,
            blueprint, originalPrompt: prompt, planx: Planx, cover, assets: savedAssets,
        }, { withCredentials: true });
        setCreationDone(true);
    });
    useCreationControls('storybook_world', 'WorldCreation', open, {
        blueprintReady: ready, blueprintLoading: busy === 'Preparing blueprint…', characterCount: assets.filter(item => item.kind === 'character').length,
        environmentCount: assets.filter(item => item.kind === 'environment').length, objectCount: assets.filter(item => item.kind === 'object').length,
        editingSavedWorld: Boolean(world), worldId: world?.id ?? null, targetKey: world ? `world:${world.id}` : `world:new:${PostId ?? ''}`,
        selectedAsset: asset?.name || '', selectedAssetId: asset?.key || '', selectedAssetType: asset?.kind || '',
        title: title.trim(),
        imageMode: asset ? mode : '', busy: Boolean(busy),
    });

    return <Stack spacing={2} sx={{ height: '100%', overflowY: 'auto', p: { xs: 2, md: 3 }, color: 'text.primary' }}
        {...cb('storybook_world', 'scroll', 'Scroll World editor', 'scrollBy', 'scroll')}>
        <Typography variant="h5">{world ? 'Edit World' : 'World Creation'}</Typography>
        {coverPreview && <Box component="img" src={coverPreview} alt="World cover preview" sx={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 3 }} />}
        <TextField label="World title" value={title} onChange={event => setTitle(event.target.value)} disabled={Boolean(busy)}
            slotProps={{ htmlInput: cb('storybook_world', 'edit_title', 'World title', 'setTitle', 'text') }} />
        <TextField label="World description" value={description} onChange={event => setDescription(event.target.value)} disabled={Boolean(busy)}
            multiline minRows={2} slotProps={{ htmlInput: cb('storybook_world', 'edit_description', 'World description', 'setDescription', 'text') }} />
        {!ready && <Button variant="contained" sx={accent} onClick={generateBlueprint} disabled={Boolean(busy)}
            {...cb('storybook_world', 'generate_blueprint', 'Generate World Blueprint', 'generateBlueprint')}>Generate World Blueprint</Button>}
        {ready && <>
            <TextField label="World blueprint" value={blueprint} onChange={event => setBlueprint(event.target.value)} disabled={Boolean(busy)}
                multiline minRows={3} slotProps={{ htmlInput: cb('storybook_world', 'edit_blueprint', 'World blueprint text', 'setBlueprint', 'text') }} />
            {WORLD_GROUPS.map(([kind, group]) => <Card key={kind} variant="outlined" sx={{ p: 2, borderRadius: 3, flexShrink: 0 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">{group}</Typography>
                    <Button startIcon={<AddIcon />} disabled={Boolean(busy)} onClick={() => {
                        const item = { key: crypto.randomUUID(), kind, name: '', description: '', image: '' };
                        setAssets(current => [...current, item]); selectAsset(item);
                    }} {...cb('storybook_world', 'add_' + kind, 'Add to ' + group, 'addAsset')}>Add</Button>
                </Stack>
                {assets.filter(item => item.kind === kind).map(item => <Stack key={item.key} spacing={1} sx={{ mt: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        {item.image && <Box component="img" src={item.image} alt="" sx={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 2 }} />}
                        <Button disabled={Boolean(busy)} onClick={() => selectAsset(item)}
                            {...cb('storybook_world', 'asset_' + item.key, 'Open ' + (item.name || 'asset'), 'selectAsset')}>{item.name || 'Unnamed asset'}</Button>
                        <Button color="error" disabled={Boolean(busy)} onClick={() => {
                            setAssets(current => current.filter(entry => entry.key !== item.key));
                            if (selected === item.key) setSelected('');
                        }} {...cb('storybook_world', 'remove_' + item.key, 'Remove ' + (item.name || 'asset'), 'removeAsset')}>Remove</Button>
                    </Stack>
                    {asset?.key === item.key && <>
                        <TextField label="Asset name" value={item.name} disabled={Boolean(busy)} onChange={event => update(item.key, { name: event.target.value })}
                            slotProps={{ htmlInput: cb('storybook_world', 'asset_name', 'Asset name', 'update', 'text') }} />
                        <TextField label="Asset description" value={item.description} multiline minRows={2} disabled={Boolean(busy)} onChange={event => update(item.key, { description: event.target.value })}
                            slotProps={{ htmlInput: cb('storybook_world', 'asset_description', 'Asset description', 'update', 'text') }} />
                        <Stack direction="row" flexWrap="wrap" gap={1}>
                            {(['recreate', 'edit'] as const).map(value => <Button key={value} variant={mode === value ? 'contained' : 'outlined'} sx={mode === value ? accent : undefined}
                                aria-pressed={mode === value}
                                disabled={Boolean(busy) || (value === 'edit' && !item.image)} onClick={() => setMode(value)}
                                {...cb('storybook_world', 'mode_' + value, value === 'edit' ? 'Edit current asset image' : 'Recreate asset image', 'setMode')}>
                                {value === 'edit' ? 'Edit' : 'Recreate'}</Button>)}
                            <Button component="label" disabled={Boolean(busy)}
                                {...cb('storybook_world', 'upload_asset', 'Upload asset image', 'upload', 'click', 'needs_handoff')}>Upload image
                                <input hidden type="file" accept="image/*" onChange={event => {
                                    const file = event.target.files?.[0];
                                    if (!file) return;
                                    if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) { setError('Choose an image under 20 MB.'); return; }
                                    void run('Loading image…', () => new Promise<void>((resolve, reject) => {
                                        const reader = new FileReader();
                                        reader.onload = () => { update(item.key, { image: String(reader.result) }); resolve(); };
                                        reader.onerror = () => reject(new Error('Image could not be read.'));
                                        reader.readAsDataURL(file);
                                    }));
                                }} />
                            </Button>
                        </Stack>
                        {mode === 'recreate' && <TextField select label="Saved reference" value={reference} disabled={Boolean(busy)}
                            onChange={event => setReference(event.target.value)}
                            slotProps={{ select: { SelectDisplayProps: {
                                'aria-label': 'Saved reference',
                                ...cb('storybook_world', 'reference_picker', 'Choose a saved reference', 'openReferencePicker'),
                            }, MenuProps: { slotProps: { paper: {
                                tabIndex: 0,
                                ...cb('storybook_world', 'reference_scroll', 'Scroll saved references', 'referenceMenu.scrollBy', 'scroll'),
                            } } } } }}>
                            <MenuItem value="" {...cb('storybook_world', 'reference_none', 'Use no saved reference', 'setReference')}>No reference</MenuItem>
                            {references.map((ref, index) => <MenuItem value={ref.image} key={ref.image}
                                {...cb('storybook_world', 'reference_' + index, 'Select ' + ref.name, 'setReference')}>{ref.name}</MenuItem>)}
                        </TextField>}
                        {mode === 'recreate' && reference && <Button disabled={Boolean(busy)} onClick={() => update(item.key, { image: reference })}
                            {...cb('storybook_world', 'use_asset_reference', 'Use selected image directly', 'update')}>Use selected image</Button>}
                        <TextField label={mode === 'edit' ? 'Describe the changes' : 'Image prompt'} multiline value={instruction}
                            disabled={Boolean(busy)} onChange={event => setInstruction(event.target.value)}
                            slotProps={{ htmlInput: cb('storybook_world', 'image_prompt', 'Asset image prompt', 'setInstruction', 'text') }} />
                        <Button disabled={Boolean(busy) || !instruction.trim()} onClick={generateImage}
                            {...cb('storybook_world', 'generate_asset', 'Generate asset image', 'generateImage')}>Generate image</Button>
                    </>}
                </Stack>)}
            </Card>)}
        </>}
        {error && <Alert severity="error">{error}</Alert>}
        {busy && <Typography role="status">{busy}</Typography>}
        <Stack direction="row" justifyContent="flex-end" gap={1}>
            <Button disabled={Boolean(busy)} onClick={props.onClose}
                {...cb('storybook_world', 'close', 'Close the World editor', 'onClose')}>Close</Button>
            {ready && <Button variant="contained" sx={accent} disabled={Boolean(busy)} onClick={save}
                {...cb('storybook_world', 'create', world ? 'Save World changes' : 'Create World', 'save', 'click', 'needs_confirmation')}>
                {world ? 'Save changes' : 'Create World'}</Button>}
        </Stack>
    </Stack>;
}
