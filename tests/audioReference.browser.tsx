import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Button, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import axios from 'axios';
import AudioReferenceDialog from '../src/components/AudioReferenceDialog';
import type { AudioReference } from '../server/src/audioReference';
const store = configureStore({ reducer: (state = { settings: { darkMode: false, appColorLight: '#4059cc' }, profile: { loggedUser: { id: 1 } } }) => state });
axios.defaults.adapter = async config => {
    const endpoint = String(config.url || ''), data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    const calls = JSON.parse(document.documentElement.dataset.audioCalls || '[]'); calls.push(endpoint); document.documentElement.dataset.audioCalls = JSON.stringify(calls);
    let output: object = {};
    if (endpoint.endsWith('/get_signed_url_audioStory')) output = { holder: [{ urlAudio: 'https://assets.test/original.mp3?upload=fixture' }] };
    else if (endpoint.endsWith('/create-lipsync-trimaudio')) { document.documentElement.dataset.trim = JSON.stringify(data); output = { audioUrl: 'https://assets.test/trimmed.mp3' }; }
    else if (config.method !== 'put') throw new Error('Unexpected API request: ' + endpoint);
    return { data: output, status: 200, statusText: 'OK', headers: {}, config };
};
function Host() {
    const [target, setTarget] = useState<string>(), [values, setValues] = useState<Record<string, AudioReference>>({});
    document.documentElement.dataset.audioReferences = JSON.stringify(values);
    return <><Button onClick={() => setTarget('A')}>Lipsync A</Button><Button onClick={() => setTarget('B')}>Lipsync B</Button>
        <AudioReferenceDialog open={Boolean(target)} duration={5} value={target ? values[target] : undefined} onClose={() => setTarget(undefined)} onSave={reference => {
            setValues(previous => { const next = { ...previous }; if (reference) next[target!] = reference; else delete next[target!]; return next; });
        }} />
    </>;
}
createRoot(document.getElementById('root')!).render(<Provider store={store}><ThemeProvider theme={createTheme()}><CssBaseline /><Host /></ThemeProvider></Provider>);
