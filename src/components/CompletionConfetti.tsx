import React, { useMemo } from "react";

type Props = {
    appColor: string;
    alternateColor?: string;
    accentColor?: string;
    variant?: "fall" | "burst";
    count?: number;
    originX?: string;
    originY?: string;
};

const pickColor = (roll: number, appColor: string, alternateColor: string, accentColor: string) => {
    if (roll < 0.55) return appColor;
    if (roll < 0.70) return accentColor;
    if (roll < 0.80) return alternateColor;
    if (roll < 0.90) return "#ffd166";
    return "#ffffff";
};

/** One-shot branded celebration shared by hotspot and spatial completions. */
const CompletionConfetti: React.FC<Props> = ({
    appColor,
    alternateColor = appColor,
    accentColor = "#ff334f",
    variant = "burst",
    count = variant === "burst" ? 64 : 50,
    originX = "50%",
    originY = "80%",
}) => {
    const particles = useMemo(() => Array.from({ length: count }, (_, index) => ({
        id: index,
        color: pickColor(Math.random(), appColor, alternateColor, accentColor),
        left: Math.random() * 100,
        width: 5 + Math.random() * 5,
        height: 8 + Math.random() * 10,
        radius: Math.random() > 0.72 ? "50%" : "2px",
        delay: Math.random() * (variant === "burst" ? 180 : 1000),
        duration: variant === "burst" ? 1350 + Math.random() * 850 : 2000 + Math.random() * 2000,
        startRotation: Math.random() * 360,
        endRotation: 540 + Math.random() * 900,
        dx: (Math.random() - 0.5) * 94,
        dy: -(24 + Math.random() * 86),
        opacity: 0.72 + Math.random() * 0.28,
    })), [appColor, alternateColor, accentColor, count, variant]);

    return <div className="clikb-completion-confetti" aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
        {particles.map(particle => variant === "burst" ? <i key={particle.id} style={{
            position: "absolute",
            left: originX,
            top: originY,
            width: particle.width,
            height: particle.height,
            borderRadius: particle.radius,
            backgroundColor: particle.color,
            opacity: 0,
            transform: `translate(-50%,-50%) rotate(${particle.startRotation}deg)`,
            animation: `clikbCompletionBurst ${particle.duration}ms cubic-bezier(.18,.72,.22,1) ${particle.delay}ms forwards`,
            "--confetti-dx": `${particle.dx}vw`,
            "--confetti-dy": `${particle.dy}vh`,
            "--confetti-rotation": `${particle.endRotation}deg`,
        } as React.CSSProperties} /> : <i key={particle.id} style={{
            position: "absolute",
            top: "-10%",
            left: `${particle.left}%`,
            width: particle.width,
            height: particle.height,
            borderRadius: particle.radius,
            backgroundColor: particle.color,
            opacity: particle.opacity,
            transform: `rotate(${particle.startRotation}deg)`,
            animation: `clikbCompletionFall ${particle.duration}ms linear ${particle.delay}ms forwards`,
        }} />)}
        <style>{`
            @keyframes clikbCompletionBurst {
                0% { opacity: 0; transform: translate(-50%,-50%) scale(.35) rotate(0deg); }
                12% { opacity: 1; }
                78% { opacity: 1; }
                100% { opacity: 0; transform: translate(calc(-50% + var(--confetti-dx)), calc(-50% + var(--confetti-dy))) scale(.92) rotate(var(--confetti-rotation)); }
            }
            @keyframes clikbCompletionFall {
                to { transform: translateY(120vh) rotate(720deg); opacity: 0; }
            }
            @media (prefers-reduced-motion: reduce) {
                .clikb-completion-confetti > i { display: none !important; }
            }
        `}</style>
    </div>;
};

export default CompletionConfetti;
