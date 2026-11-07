import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Box, CssBaseline, ThemeProvider, Typography, createTheme } from '@mui/material';
import CharacterImageControls from '../../src/components/CharacterImageControls';
import type { ReferenceImageGenerationMode } from '../../src/characterReferenceEditing';

const darkMode = new URLSearchParams(location.search).get('theme') === 'dark';
const theme = createTheme({ palette: { mode: darkMode ? 'dark' : 'light' } });

function Fixture() {
  const [mode, setMode] = useState<ReferenceImageGenerationMode>('recreate');
  const [disabled, setDisabled] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState(0);
  (window as any).characterControlsFixture = { setDisabled, setCanEdit, setUploading };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: darkMode ? '#08080b' : '#f0f2f7', px: { xs: 0, sm: 3 } }}>
        <Box data-character-panel sx={{ width: '100%', maxWidth: 420, p: { xs: 3, sm: 5 }, bgcolor: darkMode ? '#0f0f12' : '#fff', borderRadius: 6, boxShadow: '0 24px 80px rgba(0,0,0,0.18)' }}>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Zuri</Typography>
          <Typography variant="body2" sx={{ color: '#888', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 'bold', mb: 3 }}>Concept Refinement</Typography>
          <CharacterImageControls mode={mode} onModeChange={setMode} onUpload={() => setUploads(value => value + 1)} disabled={disabled || uploading} canEdit={canEdit} uploading={uploading} darkMode={darkMode} appColor="#736EFE" />
          <Box data-prompt-preview sx={{ border: '1px solid', borderColor: darkMode ? '#323238' : '#ddd', bgcolor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: 3, p: 1.5, fontFamily: 'monospace', fontSize: '0.85rem', color: darkMode ? '#ccc' : '#444', minHeight: 120 }}>
            Full-body character reference for @Zuri, wearing a blue travel coat in soft cinematic lighting.
          </Box>
          <output data-mode hidden>{mode}</output>
          <output data-uploads hidden>{uploads}</output>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Fixture />);
