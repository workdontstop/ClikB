import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import type { AnyScenePreset } from '../server/src/scenePresets';

export type SavedScenePreset = { schema: 'clikb.scene-preset.v1'; id: string; revision: number; creatorId: string; creatorName: string; editable: boolean; preset: AnyScenePreset };
export function useScenePresetLibrary(api: string) {
    const account = useSelector((state: any) => String(state.profile?.loggedUser?.id || ''));
    const [items, setItems] = useState<SavedScenePreset[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(false), [hasMore, setHasMore] = useState(false);
    const [mine, setMine] = useState(false);
    const generation = useRef(0), requests = useRef(new Map<string, string>());
    const refresh = useCallback(async (offset = 0) => {
        const captured = ++generation.current;
        setLoading(true);
        try {
            const { data } = await axios.post<{ items: SavedScenePreset[]; hasMore: boolean }>(`${api}/scene-presets`, { action: 'list', mine, offset }, { withCredentials: true });
            if (generation.current !== captured) return;
            setItems(previous => offset ? [...previous, ...data.items] : data.items); setHasMore(data.hasMore); setError('');
        } catch (e: any) { if (generation.current === captured) setError(e.response?.data?.message || e.message); }
        finally { if (generation.current === captured) setLoading(false); }
    }, [api, account, mine]);
    useEffect(() => { setItems([]); requests.current.clear(); void refresh(); return () => { generation.current++; }; }, [refresh]);
    useEffect(() => { const changed = () => { void refresh(); }; window.addEventListener('clikb:scene-presets-changed', changed); return () => window.removeEventListener('clikb:scene-presets-changed', changed); }, [refresh]);
    const save = async (preset: AnyScenePreset, existing?: SavedScenePreset) => {
        const { presetId: _id, versionId: _version, createdAt: _time, ...content } = preset;
        const key = JSON.stringify(content);
        let requestId = requests.current.get(key);
        if (!requestId) { requestId = crypto.randomUUID(); requests.current.set(key, requestId); }
        try {
            const { data } = await axios.post<SavedScenePreset>(`${api}/scene-presets`, { action: 'save', preset, requestId, id: existing?.id, revision: existing?.revision }, { withCredentials: true });
            setError(''); window.dispatchEvent(new Event('clikb:scene-presets-changed')); return data;
        } catch (e: any) { setError(e.response?.data?.message || e.message); throw e; }
    };
    const remove = async (item: SavedScenePreset) => {
        try { await axios.post(`${api}/scene-presets`, { action: 'delete', id: item.id, revision: item.revision }, { withCredentials: true }); window.dispatchEvent(new Event('clikb:scene-presets-changed')); }
        catch (e: any) { setError(e.response?.data?.message || e.message); }
    };
    return { items, save, remove, refresh, error, loading, hasMore, mine, setMine };
}
