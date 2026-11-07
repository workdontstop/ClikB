import { useState } from 'react';
import { Alert, Box, Button, MenuItem, TextField } from '@mui/material';
import { applyActionPreset, extractActionNodePreset, fitPresetDuration, applyRigAssetPreset, extractRigAssetPreset, type ActionNodePreset, type RigAssetPreset } from '../../server/src/scenePresets';
import type { SceneAuthoringDraft } from '../../server/src/sceneAuthoring';
import type { useScenePresetLibrary } from '../useScenePresetLibrary';

/** Same saved choreography and explicit participant binding in both editors. */
export default function SceneActionPresets({ draft, library, onChange, disabled = false }: { draft: SceneAuthoringDraft; library: ReturnType<typeof useScenePresetLibrary>; onChange: (draft: SceneAuthoringDraft) => void; disabled?: boolean }) {
    const presets = library.items.map(item => item.preset).filter((preset): preset is ActionNodePreset => preset.kind === 'action_preset');
    const [selected, setSelected] = useState(''), [bindings, setBindings] = useState<Record<string, string>>({}), [notice, setNotice] = useState('');
    const preset = presets.find(item => item.presetId === selected);
    const [objectId, setObjectId] = useState(''), [name, setName] = useState('');
    const assets = library.items.map(item => item.preset).filter((item): item is RigAssetPreset => item.kind === 'rig_asset');
    return <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .75, alignItems: 'center', mt: 1 }}>
        <TextField size="small" label="Preset name" value={name} onChange={event => setName(event.target.value)} inputProps={{ maxLength: 120 }} sx={{ minWidth: 130, flex: '1 1 130px' }} />
        <Button size="small" disabled={disabled} onClick={() => {
            try {
                const participants = draft.plan.objects.filter(object => object.surface !== 'ground' && object.role !== 'scenery');
                const roles = Object.fromEntries(participants.map(object => [object.id, object.id]));
                const saved = extractActionNodePreset(draft, roles, { presetId: crypto.randomUUID(), title: name.trim() || `Action ${library.items.length + 1}`, description: 'Complete participant motion and timed events' });
                void library.save(saved).then(() => setNotice('Action saved to shared library.')).catch(error => setNotice(error.message));
            } catch (error) { setNotice((error as Error).message); }
        }}>Save action preset</Button>
        {presets.length > 0 && <TextField select size="small" label="Action preset" value={selected} disabled={disabled} sx={{ minWidth: 150 }} onChange={event => { const next = presets.find(item => item.presetId === event.target.value); setSelected(event.target.value); setBindings(Object.fromEntries((next?.roles || []).map(role => [role.role, draft.plan.objects.some(object => object.id === role.role) ? role.role : '']))); }}>
            <MenuItem value="">Choose action</MenuItem>{presets.map(item => <MenuItem key={item.presetId} value={item.presetId}>{item.title}</MenuItem>)}
        </TextField>}
        {preset?.roles.map(role => <TextField select key={role.role} size="small" label={role.role} value={bindings[role.role] || ''} disabled={disabled} sx={{ minWidth: 120 }} onChange={event => setBindings({ ...bindings, [role.role]: event.target.value })}>
            <MenuItem value="">Choose participant</MenuItem>{draft.plan.objects.filter(object => object.surface !== 'ground').map(object => <MenuItem key={object.id} value={object.id}>{object.id}</MenuItem>)}
        </TextField>)}
        {preset && <Button size="small" disabled={disabled || preset.roles.some(role => !bindings[role.role])} onClick={() => { try { onChange(applyActionPreset(draft, fitPresetDuration(preset, draft.plan.duration), bindings).draft); setNotice('Action applied. Review the full timeline before saving.'); } catch (error) { setNotice((error as Error).message); } }}>Apply action · fit clip</Button>}
        <TextField select size="small" label="Rigged subject" value={objectId && draft.rigs[objectId] ? objectId : ''} disabled={disabled} sx={{ minWidth: 140 }} onChange={event => setObjectId(event.target.value)}><MenuItem value="">Choose subject</MenuItem>{draft.plan.objects.filter(object => draft.rigs[object.id]).map(object => <MenuItem key={object.id} value={object.id}>{object.id}</MenuItem>)}</TextField>
        <Button size="small" disabled={disabled || !objectId || !draft.rigs[objectId]} onClick={() => { try { const saved = extractRigAssetPreset(draft, objectId, { presetId: crypto.randomUUID(), title: name.trim() || `${objectId} object` }); void library.save(saved).then(() => setNotice('Object saved to shared library.')).catch(error => setNotice(error.message)); } catch (error) { setNotice((error as Error).message); } }}>Save object preset</Button>
        {assets.map(asset => <Button key={asset.presetId} size="small" disabled={disabled} onClick={() => { try { onChange(applyRigAssetPreset(draft, asset, `asset_${crypto.randomUUID().slice(0, 8)}`)); setNotice(`Added ${asset.title}. Arrange it in the viewport.`); } catch (error) { setNotice((error as Error).message); } }}>Add {asset.title}</Button>)}
        {notice && <Alert severity="info" onClose={() => setNotice('')} sx={{ width: '100%' }}>{notice}</Alert>}
    </Box>;
}
