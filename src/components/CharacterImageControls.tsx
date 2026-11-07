import { Box, CircularProgress, IconButton, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import { alpha } from '@mui/material/styles';
import { creationBinding as cb } from '../creationControlSnapshot';
import type { ReferenceImageGenerationMode } from '../characterReferenceEditing';

type Props = {
  mode: ReferenceImageGenerationMode;
  onModeChange: (mode: ReferenceImageGenerationMode) => void;
  onUpload: () => void;
  disabled: boolean;
  canEdit: boolean;
  uploading: boolean;
  darkMode: boolean;
  appColor: string;
};

export default function CharacterImageControls({ mode, onModeChange, onUpload, disabled, canEdit, uploading, darkMode, appColor }: Props) {
  const glassSx = {
    background: darkMode
      ? 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
      : 'linear-gradient(135deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.46) 100%)',
    backdropFilter: 'blur(18px) saturate(180%)',
    border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
    boxShadow: darkMode ? '0 8px 20px rgba(0,0,0,0.18)' : '0 8px 20px rgba(31,38,135,0.06)',
    color: darkMode ? '#fff' : '#111',
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1 }}>
      <Typography variant="overline" sx={{ color: '#888', fontWeight: 800, letterSpacing: 1 }}>
        Image Prompt
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, ml: 'auto' }}>
        <ToggleButtonGroup
          exclusive
          value={mode}
          onChange={(_, next: ReferenceImageGenerationMode | null) => { if (next) onModeChange(next); }}
          disabled={disabled}
          aria-label="Character image generation mode"
          sx={{
            ...glassSx,
            borderRadius: 999,
            p: 0.3,
            '& .MuiToggleButtonGroup-grouped': {
              border: 0,
              borderRadius: '999px !important',
              minHeight: 30,
              px: 1.35,
              py: 0.45,
              fontSize: '0.76rem',
              fontWeight: 700,
              textTransform: 'none',
              color: darkMode ? 'rgba(255,255,255,0.58)' : 'rgba(0,0,0,0.55)',
              '&.Mui-selected': {
                backgroundColor: alpha(appColor, darkMode ? 0.2 : 0.14),
                color: darkMode ? '#fff' : '#111',
                boxShadow: `inset 0 0 0 1px ${alpha(appColor, 0.45)}`,
                '&:hover': { backgroundColor: alpha(appColor, 0.24) },
              },
              '&.Mui-disabled': { opacity: 0.45, color: darkMode ? '#aaa' : '#666' },
            },
          }}
        >
          <ToggleButton value="recreate" {...cb('reference_editor', 'recreate_mode', 'Create a fresh character image from the prompt', 'setActiveReferenceGenerationMode')}>
            Recreate
          </ToggleButton>
          <ToggleButton value="edit" disabled={disabled || !canEdit} {...cb('reference_editor', 'edit_mode', 'Edit the current character image with the selected model', 'setActiveReferenceGenerationMode')}>
            Edit
          </ToggleButton>
        </ToggleButtonGroup>
        <Tooltip title="Upload a replacement character image">
          <span>
            <IconButton
              {...cb('reference_editor', 'upload_image', 'Choose a replacement character image file (user-operated)', 'openReferenceImageUpload', 'click', 'information_only')}
              aria-label="Upload replacement character image"
              onClick={onUpload}
              disabled={disabled}
              sx={{ ...glassSx, width: 36, height: 36, borderRadius: 999, '&:hover': { backgroundColor: alpha(appColor, 0.12) } }}
            >
              {uploading ? <CircularProgress size={18} color="inherit" /> : <UploadIcon sx={{ fontSize: 19 }} />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}
