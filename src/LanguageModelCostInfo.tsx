import React from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    Box,
    Typography,
    IconButton,
    Divider,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import {
    LANGUAGE_MODELS,
    EXAMPLE_SCENE_COUNT,
    estimateStoryLlmPixels,
    languageModelInfo,
    type LanguageModelTier,
} from "./languageModels";

/**
 * Explains the small flat charge for AI prompt writing, and shows a rough
 * estimate for the current story.
 *
 * Estimate only. Nothing here deducts anything — the backend charges, and the
 * balance the user sees always comes from a server response.
 */

export interface LanguageModelCostInfoProps {
    open: boolean;
    onClose: () => void;
    tier: LanguageModelTier;
    /**
     * Length of the step array (stage-indexed in Cinema mode). Omit or pass 0
     * when no story exists yet — a worked example is shown instead.
     */
    sceneCount?: number;
    cinemaMode?: boolean;
    darkMode?: boolean;
}

/** The info button that opens this dialog, styled in the app colour. */
export const LanguageModelCostButton: React.FC<{
    onClick: (event: React.MouseEvent<HTMLElement>) => void;
    appColor: string;
    label?: string;
}> = ({ onClick, appColor, label = "About AI prompt costs" }) => (
    <IconButton
        onClick={onClick}
        size="small"
        aria-label={label}
        sx={{
            color: appColor,
            p: 0.5,
            "&:focus-visible": {
                outline: `2px solid ${appColor}`,
                outlineOffset: 2,
            },
        }}
    >
        <InfoOutlinedIcon sx={{ fontSize: 18 }} />
    </IconButton>
);

const LanguageModelCostInfo: React.FC<LanguageModelCostInfoProps> = ({
    open,
    onClose,
    tier,
    sceneCount = 0,
    cinemaMode = false,
    darkMode: darkModeProp,
}) => {
    const darkModeReducer = useSelector(
        (state: RootState) => state.settings.darkMode
    );
    const darkMode = darkModeProp ?? darkModeReducer;

    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const appColor = (darkMode ? appColorDark : appColorLight)
        || (darkMode ? '#E8BAFA' : '#0099cc');

    const info = languageModelInfo(tier);
    const hasStory = sceneCount > 0;
    const effectiveScenes = hasStory ? sceneCount : EXAMPLE_SCENE_COUNT;

    const withoutVideo = estimateStoryLlmPixels({
        tier,
        sceneCount: effectiveScenes,
        cinemaMode,
        includeVideoAutoPrompts: false,
    });
    const withVideo = estimateStoryLlmPixels({
        tier,
        sceneCount: effectiveScenes,
        cinemaMode,
        includeVideoAutoPrompts: true,
    });

    const textColor = darkMode ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.87)";
    const mutedColor = darkMode ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)";

    const Line: React.FC<{ label: string; value: string; strong?: boolean }> = ({
        label,
        value,
        strong,
    }) => (
        <Box
            sx={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 2,
                py: 0.75,
            }}
        >
            <Typography
                sx={{
                    fontSize: 13,
                    color: strong ? textColor : mutedColor,
                    fontWeight: strong ? 700 : 400,
                }}
            >
                {label}
            </Typography>
            <Typography
                sx={{
                    fontSize: 13,
                    fontWeight: strong ? 700 : 600,
                    color: strong ? appColor : textColor,
                    whiteSpace: "nowrap",
                }}
            >
                {value}
            </Typography>
        </Box>
    );

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    background: darkMode
                        ? "rgba(18, 18, 18, 0.96)"
                        : "rgba(255, 255, 255, 0.98)",
                    backdropFilter: "blur(24px)",
                    border: `1px solid ${alpha(appColor, 0.35)}`,
                },
            }}
        >
            <DialogTitle
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 16,
                    fontWeight: 700,
                    color: textColor,
                    pb: 1,
                }}
            >
                AI prompt costs
                <IconButton
                    onClick={onClose}
                    size="small"
                    aria-label="Close"
                    sx={{ color: mutedColor }}
                >
                    <CloseIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pt: 0 }}>
                <Typography sx={{ fontSize: 13, color: mutedColor, lineHeight: 1.6 }}>
                    AI prompt preparation uses a flat pixel charge. Luna costs 1 P,
                    Luna Extra 2 P, Terra 6.1 5 P and Sol 6.1 15 P for each prompt operation.
                    A batched operation is charged once, even when it creates more than
                    one prompt. Image, video, audio, upscale and GPU generation have
                    their own separate prices.
                </Typography>

                <Box
                    sx={{
                        mt: 2,
                        p: 1.5,
                        borderRadius: 2,
                        border: `1px solid ${alpha(appColor, 0.4)}`,
                        background: alpha(appColor, 0.08),
                    }}
                >
                    <Line
                        label={`${info.name} — per prompt operation`}
                        value={`${info.pixels} P`}
                        strong
                    />
                </Box>

                <Divider
                    sx={{
                        my: 2,
                        borderColor: alpha(appColor, 0.35),
                    }}
                />

                <Typography
                    sx={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: 0.4,
                        textTransform: "uppercase",
                        color: mutedColor,
                        mb: 0.5,
                    }}
                >
                    {hasStory
                        ? `Estimate for this story (${sceneCount} ${cinemaMode ? "stages" : "scenes"})`
                        : `Example — a ${EXAMPLE_SCENE_COUNT}-scene story`}
                </Typography>

                {!hasStory && (
                    <Typography
                        sx={{ fontSize: 12, color: mutedColor, mb: 1, lineHeight: 1.5 }}
                    >
                        Your own total appears here once a plan has been created.
                    </Typography>
                )}

                <Line
                    label={`Story understanding (1 operation)`}
                    value={`${withoutVideo.blueprintPixels} P`}
                />
                <Line
                    label={`Image prompts (${withoutVideo.imagePromptOperations} operations)`}
                    value={`${withoutVideo.imagePromptPixels} P`}
                />
                <Line
                    label={`Image Prompt Pacer (${withoutVideo.imagePacerOperations} operations)`}
                    value={`${withoutVideo.imagePacerPixels} P`}
                />
                <Line
                    label="Story image-prompt preparation"
                    value={`${withoutVideo.totalPixels} P`}
                    strong
                />

                <Divider sx={{ my: 1.5, borderColor: alpha(appColor, 0.2) }} />

                <Line
                    label={`If Auto Prompt is clicked for every video (up to ${withVideo.videoPromptOperations} operations)`}
                    value={`up to +${withVideo.videoPromptPixels} P`}
                />
                <Line
                    label="Total with video Auto Prompts"
                    value={`up to ${withVideo.totalPixels} P`}
                    strong
                />

                <Typography
                    sx={{ mt: 0.5, fontSize: 11, color: mutedColor, lineHeight: 1.5 }}
                >
                    The first automatic pass that fills every video prompt at
                    once is one batched operation — {info.pixels} P in total, not
                    per scene. The figure above is the most you could spend if you
                    then re-ran Auto Prompt on every scene by hand.
                </Typography>

                <Typography
                    sx={{
                        mt: 2,
                        fontSize: 11,
                        color: mutedColor,
                        fontStyle: "italic",
                        lineHeight: 1.5,
                    }}
                >
                    Estimate only. Not included: image, video and audio generation,
                    upscaling, denoise, lip sync and GPU time; and B-shot and
                    Update-with-AI prompts, which are outside this charge.
                    Failed operations are not charged. Successfully completed
                    earlier operations remain charged if later work fails.
                </Typography>
            </DialogContent>
        </Dialog>
    );
};

export default LanguageModelCostInfo;
export { LANGUAGE_MODELS };
