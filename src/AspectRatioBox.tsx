import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from './store'; // <-- adjust path if different
import { cycleAspectRatio, toggleDarkMode } from './settingsSlice'; // <-- adjust path


/**
 * ratioMap kept local (pure) â€“ state only stores numeric key in Redux.
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
}

export const AspectRatioBox: React.FC<AspectRatioBoxProps> = ({ models, isBlinking, onCancel, inline = false }) => {
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
                        aria-label={`Aspect ratio box ${label}`}
                        className={[
                            'relative flex items-center justify-center select-none cursor-pointer',
                            'rounded-xl border-2 border-solid',
                            'transition-colors duration-200'
                        ].join(' ')}
                        style={{
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            border: "none",
                            borderBottom: "2px solid rgba(255, 255, 255, 0.8)",
                            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.6)",
                            aspectRatio: `${w} / ${h}`,
                            margin: inline ? 0 : 'auto',
                            marginRight: inline ? 0 : '3vw',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            height: isMobile ? '10vh' : '11vh',
                            animation: isBlinking ? 'blink-visibility 1.2s infinite' : 'none',
                        }}
                    >
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
