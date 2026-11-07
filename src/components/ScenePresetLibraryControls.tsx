import { Alert, Box, Button, Typography } from '@mui/material';
import type { useScenePresetLibrary } from '../useScenePresetLibrary';

export default function ScenePresetLibraryControls({ library }: { library: ReturnType<typeof useScenePresetLibrary> }) {
    return <Box sx={{ display: 'grid', gap: .6, my: 1 }}>
        <Box sx={{ display: 'flex', gap: 1 }}><Button size="small" variant={!library.mine ? 'contained' : 'outlined'} onClick={() => library.setMine(false)}>All creators</Button><Button size="small" variant={library.mine ? 'contained' : 'outlined'} onClick={() => library.setMine(true)}>Mine</Button><Button size="small" onClick={() => void library.refresh()}>Refresh</Button></Box>
        {library.error && <Alert severity="error">{library.error}</Alert>}
        {library.loading && <Typography variant="caption">Loading shared presets…</Typography>}
        {library.items.map(item => <Box key={item.id} sx={{ display: 'flex', flexWrap: 'wrap', gap: .5, alignItems: 'center' }}><Typography variant="caption" sx={{ flex: 1 }}>{item.preset.title} · {item.creatorName}</Typography>{item.editable && <><Button size="small" onClick={() => { const title = window.prompt('Preset name', item.preset.title); if (title?.trim()) void library.save({ ...item.preset, title: title.trim() }, item).catch(() => {}); }}>Rename</Button><Button size="small" onClick={() => void library.remove(item)}>Delete</Button></>}</Box>)}
        {library.hasMore && <Button size="small" onClick={() => void library.refresh(library.items.length)}>More presets</Button>}
    </Box>;
}
