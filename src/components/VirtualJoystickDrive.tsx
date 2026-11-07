import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { spatialRingDirection } from "../spatialRingInput";
import "./VirtualJoystickDrive.css";

export interface JoystickDriveSample {
    x: number;
    y: number;
    radius: number;
    angle: number;
    active: boolean;
    timestamp: number;
}

export interface JoystickDirectionAvailability {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
}

interface VirtualJoystickDriveProps {
    onDrive: (sample: JoystickDriveSample) => void;
    onDriveEnd?: (sample: JoystickDriveSample) => void;
    onDriveCancel?: () => void;
    initialControlMode?: "analog" | "dpad" | "hover";
    allowHoverMode?: boolean;
    showSwitchHint?: boolean;
    switchHintColor?: string;
    switchHintTextColor?: string;
    switchHintLabel?: string;
    onSwitchMode?: (mode: "analog" | "dpad" | "hover") => void;
    size?: number;
    disabled?: boolean;
    hidden?: boolean;
    /** Cancel held input after graph navigation without changing analogue/D-pad preference. */
    resetKey?: number;
    availableDirections?: JoystickDirectionAvailability;
    limitToAvailableDirections?: boolean;
    onEditMotion?: () => void;
    editMotionDisabled?: boolean;
    hasCustomMotionHint?: boolean;
    accentColor?: string;
    darkMode?: boolean;
}

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

const idleSample = (): JoystickDriveSample => ({
    x: 0,
    y: 0,
    radius: 0,
    angle: 0,
    active: false,
    timestamp: performance.now(),
});

type DriveControlMode = "analog" | "dpad" | "hover";
type PadDirection = "top" | "right" | "bottom" | "left";

const DPAD_VECTOR: Record<PadDirection, Pick<JoystickDriveSample, "x" | "y" | "angle">> = {
    top: { x: 0, y: 1, angle: Math.PI / 2 },
    right: { x: 1, y: 0, angle: 0 },
    bottom: { x: 0, y: -1, angle: -Math.PI / 2 },
    left: { x: -1, y: 0, angle: Math.PI },
};

const VirtualJoystickDrive: React.FC<VirtualJoystickDriveProps> = ({
    onDrive,
    onDriveEnd,
    onDriveCancel,
    initialControlMode = "analog",
    allowHoverMode = false,
    showSwitchHint = false,
    switchHintColor = "#d8f13b",
    switchHintTextColor = "#111",
    switchHintLabel = "Double-tap to switch",
    onSwitchMode,
    size = 132,
    disabled = false,
    hidden = false,
    resetKey = 0,
    availableDirections = { top: false, right: false, bottom: false, left: false },
    limitToAvailableDirections = false,
    onEditMotion,
    editMotionDisabled = disabled,
    hasCustomMotionHint = false,
    accentColor = "#d8f13b",
    darkMode = true,
}) => {
    const ink = darkMode ? '#fff' : '#111';
    const surfaceColor = darkMode ? 'rgba(8,10,16,0.82)' : 'rgba(255,255,255,0.94)';
    const faintInk = darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
    const surfaceRef = useRef<HTMLDivElement | null>(null);
    const sampleRef = useRef<JoystickDriveSample>(idleSample());
    const frameRef = useRef<number | null>(null);
    const activePointerRef = useRef<number | null>(null);
    const gestureRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        driveStarted: boolean;
        holdTimer: number | null;
        direction?: PadDirection;
    } | null>(null);
    const lastTapRef = useRef(0);
    const onDriveRef = useRef(onDrive);
    const onDriveEndRef = useRef(onDriveEnd);
    const onDriveCancelRef = useRef(onDriveCancel);
    const hoverTimerRef = useRef<number | null>(null);
    const hoverCandidateRef = useRef<JoystickDriveSample | null>(null);
    const [controlMode, setControlMode] = useState<DriveControlMode>(initialControlMode);
    const [hasSwitchedMode, setHasSwitchedMode] = useState(false);
    const [visualSample, setVisualSample] = useState<JoystickDriveSample>(sampleRef.current);
    onDriveRef.current = onDrive;
    onDriveEndRef.current = onDriveEnd;
    onDriveCancelRef.current = onDriveCancel;

    const updateFromPointer = useCallback((clientX: number, clientY: number) => {
        const surface = surfaceRef.current;
        if (!surface) return;

        const rect = surface.getBoundingClientRect();
        const half = rect.width / 2;
        const rawX = (clientX - (rect.left + half)) / half;
        const rawY = ((rect.top + half) - clientY) / half;
        const rawRadius = Math.hypot(rawX, rawY);
        const scale = rawRadius > 1 ? 1 / rawRadius : 1;
        const x = clamp(rawX * scale, -1, 1);
        const y = clamp(rawY * scale, -1, 1);
        const radius = clamp(Math.hypot(x, y), 0, 1);

        sampleRef.current = {
            x,
            y,
            radius,
            angle: Math.atan2(y, x),
            active: true,
            timestamp: performance.now(),
        };
        setVisualSample(sampleRef.current);
    }, []);

    const startPublishLoop = useCallback(() => {
        if (frameRef.current !== null) return;
        const publish = () => {
            if (!sampleRef.current.active) {
                frameRef.current = null;
                return;
            }
            const next = { ...sampleRef.current, timestamp: performance.now() };
            sampleRef.current = next;
            onDriveRef.current(next);
            frameRef.current = requestAnimationFrame(publish);
        };
        frameRef.current = requestAnimationFrame(publish);
    }, []);

    const registerModeTap = useCallback((currentMode: DriveControlMode) => {
        const now = performance.now();
        if (now - lastTapRef.current <= 360) {
            lastTapRef.current = 0;
            const nextMode = allowHoverMode
                ? currentMode === "analog" ? "dpad" : currentMode === "dpad" ? "hover" : "analog"
                : currentMode === "analog" ? "dpad" : "analog";
            setControlMode(nextMode);
            setHasSwitchedMode(true);
            onSwitchMode?.(nextMode);
            return;
        }
        lastTapRef.current = now;
    }, [allowHoverMode, onSwitchMode]);

    const clearGestureTimer = useCallback(() => {
        const gesture = gestureRef.current;
        if (gesture?.holdTimer !== null && gesture?.holdTimer !== undefined) {
            window.clearTimeout(gesture.holdTimer);
            gesture.holdTimer = null;
        }
    }, []);

    // Cancellation must stop both the visible stick and the parent's drive.
    // Do not call onDriveEnd: an interrupted gesture must not create a draft.
    const cancelDrive = useCallback(() => {
        const wasActive = sampleRef.current.active;
        const idle = idleSample();
        clearGestureTimer();
        if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
        hoverCandidateRef.current = null;
        gestureRef.current = null;
        sampleRef.current = idle;
        const pointerId = activePointerRef.current;
        activePointerRef.current = null;
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        if (pointerId !== null && surfaceRef.current?.hasPointerCapture(pointerId)) {
            surfaceRef.current.releasePointerCapture(pointerId);
        }
        if (wasActive) { onDriveRef.current(idle); onDriveCancelRef.current?.(); }
        return idle;
    }, [clearGestureTimer]);

    useEffect(() => {
        const stop = () => setVisualSample(cancelDrive());
        const visibility = () => { if (document.hidden) stop(); };
        window.addEventListener("blur", stop);
        document.addEventListener("visibilitychange", visibility);
        return () => {
            window.removeEventListener("blur", stop);
            document.removeEventListener("visibilitychange", visibility);
            cancelDrive();
        };
    }, [cancelDrive]);

    useEffect(() => {
        const suppressNativeSelection = (event: Event) => {
            if (activePointerRef.current !== null || (event.target instanceof Node && surfaceRef.current?.contains(event.target))) {
                event.preventDefault();
            }
        };
        document.addEventListener("selectstart", suppressNativeSelection, true);
        document.addEventListener("contextmenu", suppressNativeSelection, true);
        return () => {
            document.removeEventListener("selectstart", suppressNativeSelection, true);
            document.removeEventListener("contextmenu", suppressNativeSelection, true);
        };
    }, []);

    useEffect(() => {
        if (disabled) setVisualSample(cancelDrive());
    }, [cancelDrive, disabled]);

    useLayoutEffect(() => {
        // Navigation resets must cancel the held gesture before another frame
        // can publish it against the newly selected checkpoint.
        setVisualSample(cancelDrive());
    }, [cancelDrive, resetKey]);

    const finishDrive = useCallback((pointerId?: number) => {
        if (pointerId !== undefined && activePointerRef.current !== pointerId) return;
        const finalSample = { ...sampleRef.current, active: false, timestamp: performance.now() };
        const idle = idleSample();
        clearGestureTimer();
        sampleRef.current = idle;
        activePointerRef.current = null;
        gestureRef.current = null;
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        setVisualSample(idle);
        onDrive(idle);
        onDriveEnd?.(finalSample);
    }, [clearGestureTimer, onDrive, onDriveEnd]);

    const cancelUndrivenGesture = useCallback(() => {
        clearGestureTimer();
        activePointerRef.current = null;
        gestureRef.current = null;
    }, [clearGestureTimer]);

    const stopRingDrive = useCallback(() => {
        if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
        hoverCandidateRef.current = null;
        const previous = sampleRef.current;
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        sampleRef.current = idleSample();
        if (previous.active) {
            setVisualSample(sampleRef.current);
            onDriveRef.current(sampleRef.current);
            onDriveEndRef.current?.({ ...previous, active: false, timestamp: performance.now() });
        }
    }, []);

    const updateRingFromPointer = useCallback((event: React.PointerEvent<HTMLDivElement>, contact: boolean) => {
        const surface = surfaceRef.current;
        if (!surface) return;
        const direction = spatialRingDirection(surface.getBoundingClientRect(), event.clientX, event.clientY, sampleRef.current.active);
        if (!direction) { stopRingDrive(); return; }
        const sample = { ...direction, active: true, timestamp: performance.now() };
        if (contact || sampleRef.current.active) {
            if (contact && gestureRef.current) gestureRef.current.driveStarted = true;
            sampleRef.current = sample;
            setVisualSample(sample);
            startPublishLoop();
            return;
        }
        // A short dwell prevents crossing the control from launching a route.
        hoverCandidateRef.current = sample;
        if (hoverTimerRef.current !== null) return;
        hoverTimerRef.current = window.setTimeout(() => {
            hoverTimerRef.current = null;
            const candidate = hoverCandidateRef.current;
            hoverCandidateRef.current = null;
            if (!candidate) return;
            sampleRef.current = candidate;
            setVisualSample(candidate);
            startPublishLoop();
        }, 120);
    }, [startPublishLoop, stopRingDrive]);

    const startDpadDirection = useCallback((direction: PadDirection, pointerId: number) => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.pointerId !== pointerId || gesture.direction !== direction) return;
        const vector = DPAD_VECTOR[direction];
        const sample: JoystickDriveSample = {
            ...vector,
            radius: 1,
            active: true,
            timestamp: performance.now(),
        };
        gesture.driveStarted = true;
        gesture.holdTimer = null;
        sampleRef.current = sample;
        setVisualSample(sample);
        startPublishLoop();
    }, [startPublishLoop]);

    const travel = size * 0.27;
    const directionHints = [
        { key: "top", active: availableDirections.top, style: { top: 7, left: "50%", transform: "translateX(-50%)" } },
        { key: "right", active: availableDirections.right, style: { right: 7, top: "50%", transform: "translateY(-50%)" } },
        { key: "bottom", active: availableDirections.bottom, style: { bottom: 7, left: "50%", transform: "translateX(-50%)" } },
        { key: "left", active: availableDirections.left, style: { left: 7, top: "50%", transform: "translateY(-50%)" } },
    ] as const;
    const dpadButtons = [
        { direction: "top", label: "Move forward", glyph: "▲", style: { top: 9, left: "50%", transform: "translateX(-50%)" } },
        { direction: "right", label: "Move right", glyph: "▶", style: { right: 9, top: "50%", transform: "translateY(-50%)" } },
        { direction: "bottom", label: "Move backward", glyph: "▼", style: { bottom: 9, left: "50%", transform: "translateX(-50%)" } },
        { direction: "left", label: "Move left", glyph: "◀", style: { left: 9, top: "50%", transform: "translateY(-50%)" } },
    ] as const;

    return (
        <div
            ref={surfaceRef}
            className="spatial-drive-control"
            data-control-mode={controlMode}
            role={controlMode === "analog" ? "slider" : "group"}
            aria-label={`${controlMode === "analog" ? "Spatial analogue drive" : controlMode === "hover" ? "Spatial donut drive" : "Spatial directional drive"}; ${switchHintLabel}`}
            aria-valuemin={controlMode === "analog" ? 0 : undefined}
            aria-valuemax={controlMode === "analog" ? 100 : undefined}
            aria-valuenow={controlMode === "analog" ? Math.round(visualSample.radius * 100) : undefined}
            aria-disabled={disabled}
            tabIndex={0}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
            }}
            onPointerEnter={(event) => {
                if (!disabled && controlMode === "hover" && event.pointerType === "mouse") updateRingFromPointer(event, false);
            }}
            onPointerLeave={(event) => {
                if (controlMode === "hover" && event.pointerType === "mouse") {
                    stopRingDrive();
                    cancelUndrivenGesture();
                }
            }}
            onPointerDown={(event) => {
                if (disabled) return;
                event.preventDefault();
                event.stopPropagation();
                if (controlMode === "hover") {
                    if (event.pointerType === "mouse") {
                        // Clicks in the hollow centre switch modes; ring hover needs no press.
                        const centre = !spatialRingDirection(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY, false);
                        if (centre && !sampleRef.current.active) {
                            activePointerRef.current = event.pointerId;
                            gestureRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, driveStarted: false, holdTimer: null };
                        }
                        return;
                    }
                    activePointerRef.current = event.pointerId;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    gestureRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, driveStarted: false, holdTimer: null };
                    updateRingFromPointer(event, true);
                    return;
                }
                activePointerRef.current = event.pointerId;
                event.currentTarget.setPointerCapture(event.pointerId);
                const directionElement = (event.target as HTMLElement).closest<HTMLElement>("[data-drive-direction]");
                const direction = directionElement?.dataset.driveDirection as PadDirection | undefined;
                const gesture = {
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    driveStarted: false,
                    holdTimer: null as number | null,
                    direction: controlMode === "dpad" ? direction : undefined,
                };
                gestureRef.current = gesture;
                if (controlMode === "dpad" && direction && DPAD_VECTOR[direction]) {
                    // A short tap is reserved for the double-tap mode switch.
                    // A deliberate hold starts driving quickly without creating
                    // accidental micro-movements during the switch gesture.
                    gesture.holdTimer = window.setTimeout(
                        () => startDpadDirection(direction, event.pointerId),
                        140,
                    );
                }
            }}
            onPointerMove={(event) => {
                if (disabled) return;
                if (controlMode === "hover") {
                    if (event.pointerType === "mouse") updateRingFromPointer(event, false);
                    else if (activePointerRef.current === event.pointerId) {
                        event.preventDefault();
                        event.stopPropagation();
                        updateRingFromPointer(event, true);
                    }
                    return;
                }
                if (activePointerRef.current !== event.pointerId) return;
                event.preventDefault();
                event.stopPropagation();
                if (controlMode === "dpad") return;
                const gesture = gestureRef.current;
                if (!gesture) return;
                if (!gesture.driveStarted) {
                    const moved = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
                    if (moved < 5) return;
                    gesture.driveStarted = true;
                    updateFromPointer(event.clientX, event.clientY);
                    startPublishLoop();
                    return;
                }
                updateFromPointer(event.clientX, event.clientY);
            }}
            onPointerUp={(event) => {
                if (disabled) return;
                event.preventDefault();
                event.stopPropagation();
                if (controlMode === "hover") {
                    const gesture = gestureRef.current;
                    if (event.pointerType === "mouse") {
                        if (gesture?.pointerId === event.pointerId) {
                            const wasCentreTap = !gesture.driveStarted && !spatialRingDirection(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY, false);
                            cancelUndrivenGesture();
                            if (wasCentreTap) registerModeTap(controlMode);
                        }
                    } else if (activePointerRef.current === event.pointerId) {
                        const wasCentreTap = !gesture?.driveStarted && !spatialRingDirection(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY, false);
                        // Touch directions latch after release. The centre is the
                        // explicit stop target; pointer cancellation still stops.
                        if (wasCentreTap) stopRingDrive();
                        else {
                            activePointerRef.current = null;
                            clearGestureTimer();
                            gestureRef.current = null;
                        }
                        cancelUndrivenGesture();
                        if (wasCentreTap) registerModeTap(controlMode);
                    }
                    return;
                }
                const gesture = gestureRef.current;
                if (!gesture || gesture.pointerId !== event.pointerId) return;
                if (gesture.driveStarted) finishDrive(event.pointerId);
                else {
                    const shouldRegisterModeTap = controlMode === "analog" || Boolean(gesture.direction);
                    cancelUndrivenGesture();
                    if (shouldRegisterModeTap) registerModeTap(controlMode);
                }
            }}
            onPointerCancel={(event) => {
                if (activePointerRef.current === event.pointerId || controlMode === "hover") setVisualSample(cancelDrive());
            }}
            onLostPointerCapture={(event) => {
                if (activePointerRef.current === event.pointerId) setVisualSample(cancelDrive());
            }}
            onKeyDown={(event) => {
                if (disabled) return;
                if (event.key === "Escape") {
                    setVisualSample(cancelDrive());
                }
            }}
            style={{
                display: hidden ? 'none' : undefined,
                boxSizing: 'border-box',
                position: "absolute",
                left: "50%",
                top: "auto",
                bottom: "clamp(24px, 5vh, 56px)",
                transform: "translateX(-50%)",
                width: size,
                height: size,
                zIndex: 32,
                borderRadius: "50%",
                touchAction: "none",
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
                WebkitTapHighlightColor: "transparent",
                background: controlMode === "hover" ? "transparent" : darkMode ? "radial-gradient(circle, rgba(16,18,24,0.30) 0 24%, rgba(8,10,16,0.76) 68%, rgba(0,0,0,0.88) 100%)" : 'radial-gradient(circle, rgba(255,255,255,0.86) 0 24%, rgba(255,255,255,0.94) 68%, #fff 100%)',
                border: controlMode === "hover" ? "none" : `1px solid ${darkMode ? 'rgba(255,255,255,0.64)' : 'rgba(0,0,0,0.32)'}`,
                boxShadow: controlMode === "hover" ? "none" : "0 14px 38px rgba(0,0,0,0.42), inset 0 0 28px rgba(255,255,255,0.08)",
                backdropFilter: controlMode === "hover" ? "none" : "blur(12px)",
                WebkitBackdropFilter: controlMode === "hover" ? "none" : "blur(12px)",
                cursor: disabled ? "not-allowed" : controlMode === "hover" ? "crosshair" : visualSample.active ? "grabbing" : controlMode === "analog" ? "grab" : "default",
                opacity: disabled ? 0.46 : 1,
                filter: disabled ? "grayscale(0.65)" : "none",
                transition: "opacity 160ms ease, filter 160ms ease",
            }}
        >
            {showSwitchHint && !hasSwitchedMode && !visualSample.active && (
                <>
                    <div aria-hidden="true" style={{ position: "absolute", left: "50%", bottom: "calc(100% + 10px)", transform: "translateX(-50%)", zIndex: 6, padding: "5px 10px", borderRadius: 999, background: "rgba(8,10,16,0.82)", color: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,0.35)", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", pointerEvents: "none" }}>{switchHintLabel}</div>
                    <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: 24, height: 22, zIndex: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 999, background: switchHintColor, color: switchHintTextColor, boxShadow: `0 2px 10px ${switchHintColor}88`, fontWeight: 900, lineHeight: 1, pointerEvents: "none" }}><span style={{ fontSize: 9 }}>2×</span><span style={{ fontSize: 7 }}>↔</span></div>
                </>
            )}
            {onEditMotion && (
                <button
                    type="button"
                    aria-label="Edit intelligent motion helper"
                    disabled={editMotionDisabled}
                    aria-disabled={editMotionDisabled}
                    title="Edit motion helper"
                    onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onEditMotion();
                    }}
                    style={{
                        position: "absolute",
                        top: -12,
                        left: -12,
                        width: 34,
                        height: 34,
                        zIndex: 8,
                        display: "grid",
                        placeItems: "center",
                        padding: 0,
                        borderRadius: "50%",
                        border: `1px solid ${hasCustomMotionHint ? accentColor : "rgba(255,255,255,0.64)"}`,
                        color: hasCustomMotionHint ? switchHintTextColor : ink,
                        background: hasCustomMotionHint ? accentColor : surfaceColor,
                        boxShadow: hasCustomMotionHint
                            ? `0 0 0 3px ${accentColor}33, 0 8px 22px rgba(0,0,0,0.5)`
                            : "0 8px 22px rgba(0,0,0,0.5)",
                        cursor: "pointer",
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M4 20h4l11-11-4-4L4 16v4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        <path d="m13.5 6.5 4 4" stroke="currentColor" strokeWidth="2" />
                    </svg>
                </button>
            )}
            {controlMode !== "hover" && <div style={{ position: "absolute", left: "50%", top: 12, bottom: 12, width: 1, background: faintInk }} />}
            {controlMode !== "hover" && <div style={{ position: "absolute", top: "50%", left: 12, right: 12, height: 1, background: faintInk }} />}
            {controlMode !== "hover" && directionHints.map((hint) => (
                <div
                    key={hint.key}
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        width: hint.active ? 8 : 5,
                        height: hint.active ? 8 : 5,
                        borderRadius: "50%",
                        background: !darkMode ? (hint.active ? '#111' : 'rgba(0,0,0,0.2)') : hint.active
                            ? "radial-gradient(circle at 35% 30%, #ffffff 0 28%, #eaf8ff 55%, #b9e8ff 100%)"
                            : "rgba(255,255,255,0.20)",
                        border: hint.active ? `1px solid ${ink}` : "1px solid rgba(0,0,0,0.34)",
                        boxShadow: !darkMode ? '0 1px 3px rgba(0,0,0,0.24)' : hint.active
                            ? "0 2px 5px rgba(0,0,0,0.92), 0 0 9px rgba(255,255,255,0.92)"
                            : "0 1px 3px rgba(0,0,0,0.72)",
                        opacity: hint.active ? 1 : 0.34,
                        transition: "width 140ms ease, height 140ms ease, opacity 140ms ease, box-shadow 140ms ease",
                        pointerEvents: "none",
                        zIndex: 3,
                        ...hint.style,
                    }}
                />
            ))}
            {controlMode === "hover" ? (
                <>
                    <div aria-hidden="true" style={{ position: "absolute", inset: 0, boxSizing: "border-box", borderRadius: "50%", border: `${size * 0.27}px solid ${surfaceColor}`, boxShadow: "0 12px 30px rgba(0,0,0,0.42), inset 0 0 0 1px rgba(255,255,255,0.45), 0 0 0 1px rgba(255,255,255,0.45)", pointerEvents: "none" }} />
                    {visualSample.active && <svg aria-hidden="true" viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}><circle cx="50" cy="50" r="36" fill="none" stroke={switchHintColor} strokeWidth="27" strokeDasharray="50 226" strokeLinecap="round" transform={`rotate(${-visualSample.angle * 180 / Math.PI - 40} 50 50)`} /></svg>}
                    {dpadButtons.map(button => {
                        const vector = DPAD_VECTOR[button.direction];
                        const selected = visualSample.active && visualSample.x * vector.x + visualSample.y * vector.y > 0.84;
                        const available = availableDirections[button.direction];
                        return <span key={button.direction} className="spatial-drive-hover-arrow" aria-hidden="true" style={{ position: "absolute", fontSize: size * 0.16, fontWeight: 900, color: selected ? switchHintTextColor : available ? ink : faintInk, textShadow: selected || !darkMode ? "none" : "0 2px 6px rgba(0,0,0,0.9)", pointerEvents: "none", ...button.style }}><span className="spatial-drive-hover-arrow-text">{button.glyph}</span><svg className="spatial-drive-hover-arrow-shape" width={size * 0.16} height={size * 0.16} viewBox="0 0 24 24" focusable="false" aria-hidden="true" style={{ transform: `rotate(${button.direction === "top" ? 0 : button.direction === "right" ? 90 : button.direction === "bottom" ? 180 : 270}deg)` }}><path d="M12 3 22 21H2Z" fill="currentColor" /></svg></span>;
                    })}
                    {visualSample.active && <div aria-hidden="true" style={{ position: "absolute", left: `calc(50% + ${visualSample.x * size * 0.35}px)`, top: `calc(50% - ${visualSample.y * size * 0.35}px)`, transform: "translate(-50%, -50%)", width: 10, height: 10, borderRadius: "50%", background: switchHintTextColor, boxShadow: `0 0 0 3px ${switchHintColor}88`, pointerEvents: "none" }} />}
                </>
            ) : controlMode === "analog" ? (
                <div
                    style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        width: size * 0.38,
                        height: size * 0.38,
                        borderRadius: "50%",
                        transform: `translate(calc(-50% + ${visualSample.x * travel}px), calc(-50% + ${-visualSample.y * travel}px))`,
                        background: !darkMode ? 'linear-gradient(145deg, #222, #050505)' : visualSample.active
                            ? "linear-gradient(145deg, #ffffff, #a9dfff)"
                            : "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(214,222,232,0.76))",
                        boxShadow: visualSample.active
                            ? `0 0 0 6px ${accentColor}33, 0 8px 22px rgba(0,0,0,0.48)`
                            : "0 8px 22px rgba(0,0,0,0.42)",
                        transition: visualSample.active ? "none" : "transform 140ms ease-out",
                        pointerEvents: "none",
                    }}
                />
            ) : (
                dpadButtons.map((button) => {
                    const active = visualSample.active
                        && visualSample.x === DPAD_VECTOR[button.direction].x
                        && visualSample.y === DPAD_VECTOR[button.direction].y;
                    const available = availableDirections[button.direction];
                    return (
                        <button
                            key={button.direction}
                            className="spatial-drive-dpad-button"
                            type="button"
                            data-drive-direction={button.direction}
                            aria-label={`${button.label}; hold to drive, double-tap to use analogue stick`}
                            title={`${button.label} · hold to drive · double-click for analogue`}
                            style={{
                                position: "absolute",
                                width: size * 0.31,
                                height: size * 0.31,
                                display: "grid",
                                placeItems: "center",
                                padding: 0,
                                border: `1px solid ${active ? accentColor : faintInk}`,
                                borderRadius: 10,
                                color: active ? switchHintTextColor : ink,
                                background: active ? accentColor : darkMode ? "rgba(255,255,255,0.075)" : '#fff',
                                boxShadow: active ? `0 0 16px ${accentColor}88` : "inset 0 1px 0 rgba(255,255,255,0.08)",
                                fontSize: size * 0.13,
                                lineHeight: 1,
                                cursor: "pointer",
                                touchAction: "none",
                                userSelect: "none",
                                WebkitUserSelect: "none",
                                WebkitTouchCallout: "none",
                                WebkitTapHighlightColor: "transparent",
                                opacity: limitToAvailableDirections && !available ? 0 : 1,
                                pointerEvents: limitToAvailableDirections && !available ? "none" : "auto",
                                transition: "opacity 120ms ease, background 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
                                ...button.style,
                            }}
                        >
                            {button.glyph}
                        </button>
                    );
                })
            )}
        </div>
    );
};

export default VirtualJoystickDrive;
