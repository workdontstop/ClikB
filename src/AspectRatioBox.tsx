import React from 'react';
import { creationBinding as cb } from './creationControlSnapshot';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from './store'; // <-- adjust path if different
import { cycleAspectRatio, toggleDarkMode } from './settingsSlice'; // <-- adjust path


/**
 * ratioMap kept local (pure) – state only stores numeric key in Redux.
 * 1 -> 9:16, 2 -> 1:1, 3 -> 16:9
 */
const ratioMap: Record<number, { w: number; h: number; label: string }> = {
    1: { w: 9, h: 16, label: '9:16' },
    2: { w: 1, h: 1, label: '1:1' },
    3: { w: 16, h: 9, label: '16:9' },
};

interface AspectRatioBoxProps {
    models: any; // you can replace `any` with a stricter type if you know the shape
    isBlinking?: boolean;
    onCancel?: () => void;
    /** when true the box renders in normal flow (used to flank the button bar on PC) */
    inline?: boolean;
    /** compact action-row sizing used only by the mobile PromptInput controls */
    compactMobile?: boolean;
    /** optional height for an inline desktop placement */
    desktopHeight?: string;
    /** Show the current ratio inside the tile (used by the compact mobile row). */
    showLabel?: boolean;
    /** Placement of the visible ratio label. */
    labelPosition?: 'center' | 'top';
}

export const AspectRatioBox: React.FC<AspectRatioBoxProps> = ({ models, isBlinking, onCancel, inline = false, compactMobile = false, desktopHeight, showLabel = false, labelPosition = 'center' }) => {
    const dispatch = useDispatch();

    // Pull dark mode + numeric aspect ratio key directly from Redux
    const darkMode = useSelector((s: RootState) => s.settings.darkMode);
    const ratioKey = useSelector((s: RootState) => s.settings.aspectRatio);

    const { w, h, label } = ratioMap[ratioKey] || ratioMap[1];

    const handleCycle = () => dispatch(cycleAspectRatio());
    const handleToggleDark = () => dispatch(toggleDarkMode());

    return (
        <>
            <style>
                {`
                @keyframes blink-visibility {
                    0% { opacity: 1; }
                    50% { opacity: 0; }
                    100% { opacity: 1; }
                }
                `}
            </style>
            {(() => {
                const isMobile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
                const box = (
                    <div
                        onClick={() => {
                            if (isBlinking && onCancel) onCancel();
                            handleCycle();
                        }}
                        role="button"
                        {...cb('setup', 'ratio', 'Cycle aspect ratio', 'cycleAspectRatio')}
                        aria-label={`Aspect ratio box ${label}`}
                        className={[
                            'relative flex items-center justify-center select-none cursor-pointer',
                            'rounded-xl border-2 border-solid',
                            'transition-colors duration-200'
                        ].join(' ')}
                        style={{
                            backgroundColor: "var(--creation-ratio-background, rgba(255, 255, 255, 0.05))",
                            border: "none",
                            borderBottom: "var(--creation-ratio-border, 2px solid rgba(255, 255, 255, 0.8))",
                            boxShadow: "var(--creation-ratio-shadow, 0 4px 10px rgba(0, 0, 0, 0.6))",
                            aspectRatio: `${w} / ${h}`,
                            margin: inline ? 0 : 'auto',
                            marginRight: inline ? 0 : '3vw',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            // An explicit desktopHeight now wins on every viewport, so a
                            // caller can opt a mobile placement into the PC treatment.
                            // Without this, isMobile short-circuited before reaching it.
                            height: desktopHeight
                                ? desktopHeight
                                : (isMobile && compactMobile ? '42px' : isMobile ? '10svh' : '11vh'),
                            animation: isBlinking ? 'blink-visibility 1.2s infinite' : 'none',
                        }}
                    >
                        {showLabel && (
                            <span style={{
                                color: 'var(--creation-ratio-label, rgba(255,255,255,0.92))',
                                fontSize: '0.48rem',
                                fontWeight: 800,
                                lineHeight: 1,
                                textShadow: 'var(--creation-ratio-text-shadow, 0 1px 3px rgba(0,0,0,0.9))',
                                pointerEvents: 'none',
                                position: labelPosition === 'top' ? 'absolute' : 'static',
                                top: labelPosition === 'top' ? '7px' : undefined,
                                left: labelPosition === 'top' ? '50%' : undefined,
                                transform: labelPosition === 'top' ? 'translateX(-50%)' : undefined,
                                whiteSpace: 'nowrap',
                            }}>
                                {label}
                            </span>
                        )}
                    </div>
                );

                // PC flank: render the box in normal flow (no full-screen overlay)
                if (inline) return box;

                // default: full-screen overlay; nudge the box up a bit on mobile
                return (
                    <div
                        className="fixed inset-0 flex items-center justify-center transition-colors duration-300"
                        style={{ background: 'transparent', paddingTop: isMobile ? '4vh' : '7vh', opacity: 0.4 }}
                    >
                        {box}
                    </div>
                );
            })()}
        </>
    );
};

export default AspectRatioBox;
