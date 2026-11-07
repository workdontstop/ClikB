import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useRef, useEffect } from 'react';
import { alpha } from '@mui/material/styles';
import { LANGUAGE_MODELS } from '../languageModels';
import type { PlanningTier } from '../../server/src/spatialWorld';
import { creationBinding as cb } from '../creationControlSnapshot';
import { useCreationControls } from '../useCreationControls';

const PLANNING_MODEL_LABELS: Record<string, string> = {
    luna: 'Luna · Low',
    terra: 'Terra · Low',
    sol: 'Sol · Low',
};

const STANDARD_TIERS: PlanningTier[] = ['luna', 'terra', 'sol'];

export default function PlanningModelSelector({ value, onChange, appColor, disabled = false }: {
    value: PlanningTier; onChange: (value: PlanningTier) => void; appColor: string; disabled?: boolean;
}) {
    const owner = useRef<HTMLDivElement>(null);
    useCreationControls('workstation_planning_model', 'PlanningModelSelector', true, { selectedModel: value, busy: disabled }, owner);

    useEffect(() => {
        if (!STANDARD_TIERS.includes(value)) {
            onChange('luna');
        }
    }, [value, onChange]);

    return (
        <Box ref={owner} sx={{ p: 1, mb: 1, borderRadius: 3, backdropFilter: 'blur(24px) saturate(160%)',
            background: `linear-gradient(130deg,${alpha(appColor, .16)},rgba(128,128,128,.06))`, border: `1px solid ${alpha(appColor, .35)}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ letterSpacing: '.14em', color: appColor }}>MODEL · MOTION PLANNING · USAGE BILLED</Typography>
            </Box>
            <ToggleButtonGroup exclusive fullWidth size="small" value={value} onChange={(_, next) => next && onChange(next)} disabled={disabled} aria-label="Motion planning model" sx={{ flexWrap: 'nowrap', gap: .25 }}>
                {LANGUAGE_MODELS.filter(model => STANDARD_TIERS.includes(model.id as PlanningTier)).map(model => (
                    <ToggleButton key={model.id} value={model.id}
                        {...cb('workstation_planning_model', `model_${model.id}`, `Select ${model.name} planning model`, 'onChange')}
                        sx={{ border: 0, borderRadius: '12px !important', color: 'inherit', gap: .5, flex: '1 1 64px', minWidth: 0, px: .6, flexDirection: 'column', fontSize: '.72rem', '&.Mui-selected': { color: appColor, bgcolor: alpha(appColor, .15) } }}>
                        <img src={model.image} alt="" width={26} height={26} style={{ borderRadius: '50%' }} />{PLANNING_MODEL_LABELS[model.id] || model.name}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>
        </Box>
    );
}
