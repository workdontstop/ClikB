import { BranchId, Hotspot } from "./TouchInteractionModel";

/**
 * Pure state machine for Hold to Play.
 *
 * No React and no DOM: the preview component decides WHICH element is being
 * controlled and performs play/pause, this file decides WHETHER it may. Keeping
 * the transitions here makes them testable without mounting a video, and keeps
 * them out of TouchPreviewStageUI, which is already very large.
 */

/** Ordinary choice/autoplay window. */
export const DEFAULT_CHOICE_WINDOW_MS = 5000;

/**
 * Shortened window after a completed Hold route. The viewer has been actively
 * holding, so they are already engaged and do not need the full five seconds —
 * and a race-style route wants the reaction to feel tight.
 */
export const HOLD_CHOICE_WINDOW_MS = 2000;

export type HoldPlaybackPhase =
    | "idle"
    | "buffering"
    | "playing"
    | "paused"
    /**
     * The video finished while the finger was still down.
     *
     * The session MUST survive this. Ending it here releases every guard while the
     * physical pointerup is still pending, so that release lands on the video's own
     * handler and restarts it — no playback guard can prevent that, because the
     * restart path seeks to 0 first and so is indistinguishable from a legitimate
     * replay. Ownership is held until the matching release is consumed.
     */
    | "completed-awaiting-release";

export type HoldTargetKind = "sub" | "child" | "loop";

/**
 * A snapshot of the hotspot that STARTED the hold, not a live reference.
 *
 * Child and loop routes replace currentNode, so the source hotspot is gone from
 * state the moment navigation happens — without a copy the control the viewer is
 * physically holding would vanish or be replaced by destination hotspot data
 * mid-press.
 */
export interface HoldController {
    id: BranchId;
    x: number;
    y: number;
    r: number;
    customText?: string;
}

export interface HoldPlaybackSession {
    sessionId: number;
    phase: HoldPlaybackPhase;
    sourceNodeId: string;
    branch: BranchId;
    targetKind: HoldTargetKind;
    /** Null once released; a session survives release in the paused phase. */
    pointerId: number | null;
    controller: HoldController;
    /**
     * The visitKey the controlled media is expected to mount under. Readiness
     * callbacks that do not match are stale — they belong to an element that has
     * already been destroyed by the keyed remount.
     */
    expectedVisitKey: string | null;
    /** First activation seeks to zero exactly once; resuming must not seek. */
    hasStartedAtZero: boolean;
}

export type HoldPlaybackState = HoldPlaybackSession | null;

export type HoldPlaybackEvent =
    | {
          type: "START_SESSION";
          sessionId: number;
          sourceNodeId: string;
          branch: BranchId;
          targetKind: HoldTargetKind;
          pointerId: number | null;
          controller: HoldController;
          expectedVisitKey: string | null;
      }
    | { type: "MEDIA_READY"; sessionId: number; visitKey: string | null }
    | { type: "PRESS"; sessionId: number; pointerId: number | null }
    | { type: "RELEASE"; pointerId: number | null }
    | { type: "PAUSE_EXTERNAL" }
    | { type: "MEDIA_ENDED"; sessionId: number }
    | { type: "COMPLETE_RELEASED"; pointerId: number | null }
    | { type: "ABORT" };

const isSameSession = (state: HoldPlaybackState, sessionId: number): state is HoldPlaybackSession =>
    state !== null && state.sessionId === sessionId;

/**
 * Only the pointer that began the session may drive it. A null pointerId means
 * keyboard control, which matches a null event pointerId.
 */
const isControllingPointer = (state: HoldPlaybackSession, pointerId: number | null): boolean =>
    state.pointerId === null || state.pointerId === pointerId;

export const holdPlaybackReducer = (
    state: HoldPlaybackState,
    event: HoldPlaybackEvent
): HoldPlaybackState => {
    switch (event.type) {
        case "START_SESSION":
            // Buffering rather than playing: the controlled element may not exist
            // yet when the destination is a child or loop, because navigation
            // remounts it.
            return {
                sessionId: event.sessionId,
                phase: "buffering",
                sourceNodeId: event.sourceNodeId,
                branch: event.branch,
                targetKind: event.targetKind,
                pointerId: event.pointerId,
                controller: event.controller,
                expectedVisitKey: event.expectedVisitKey,
                hasStartedAtZero: false,
            };

        case "MEDIA_READY": {
            if (!isSameSession(state, event.sessionId)) return state;
            // A readiness report from an element mounted under a different visit
            // belongs to a destroyed element.
            if (state.expectedVisitKey !== null && state.expectedVisitKey !== event.visitKey) {
                return state;
            }
            if (state.phase !== "buffering") return state;
            return {
                ...state,
                // Still held when the media became playable → play. Released while
                // it loaded → stay paused at zero and wait for the next press.
                phase: state.pointerId !== null ? "playing" : "paused",
                hasStartedAtZero: true,
            };
        }

        case "PRESS": {
            if (!isSameSession(state, event.sessionId)) return state;
            if (state.phase === "completed-awaiting-release") return state;
            if (state.phase === "buffering") {
                return { ...state, pointerId: event.pointerId };
            }
            if (state.phase !== "paused") return state;
            return { ...state, pointerId: event.pointerId, phase: "playing" };
        }

        case "RELEASE": {
            if (state === null) return state;
            if (!isControllingPointer(state, event.pointerId)) return state;
            // A completed route is finished by COMPLETE_RELEASED, not by RELEASE.
            if (state.phase === "completed-awaiting-release") return state;
            // The session survives release — it is paused, not destroyed, so the
            // same hotspot stays on screen and re-pressing resumes mid-frame.
            return { ...state, pointerId: null, phase: "paused" };
        }

        case "PAUSE_EXTERNAL": {
            if (state === null) return state;
            if (state.phase === "completed-awaiting-release") return state;
            return { ...state, pointerId: null, phase: "paused" };
        }

        case "MEDIA_ENDED": {
            if (!isSameSession(state, event.sessionId)) return state;
            if (state.phase === "completed-awaiting-release") return state;
            // Finger still down: keep ownership until the release is consumed.
            if (state.pointerId !== null) {
                return { ...state, phase: "completed-awaiting-release" };
            }
            // Already released, so there is no pending pointerup to protect against.
            return null;
        }

        case "COMPLETE_RELEASED": {
            if (state === null) return state;
            if (state.phase !== "completed-awaiting-release") return state;
            // Not pointer-matched: requiring the original id left this state
            // undischargeable if the release was ever missed, which locked the
            // whole interaction up.
            return null;
        }

        case "ABORT":
            return null;

        default:
            return state;
    }
};

/** True while the session owns an element and forbids autonomous playback. */
export const holdOwnsMedia = (state: HoldPlaybackState): boolean => state !== null;

/** Choices may be drawn but must not be clickable while the finger is still down. */
export const holdChoicesEnabled = (state: HoldPlaybackState): boolean =>
    state === null || state.phase !== "completed-awaiting-release";

/** The route finished and is waiting for the physical release to be consumed. */
export const holdAwaitingRelease = (state: HoldPlaybackState): boolean =>
    state?.phase === "completed-awaiting-release";

/** True only when the controlled element should actually be advancing. */
export const holdIsPlaying = (state: HoldPlaybackState): boolean => state?.phase === "playing";

/**
 * 2s only for the window produced by completing a Hold route; everything else
 * keeps the standard 5s. Both the timeout and the bar animation read this.
 */
export const choiceWindowMs = (afterHoldRoute: boolean): number =>
    afterHoldRoute ? HOLD_CHOICE_WINDOW_MS : DEFAULT_CHOICE_WINDOW_MS;

export const controllerFromHotspot = (hotspot: Hotspot): HoldController => ({
    id: hotspot.id,
    x: hotspot.x,
    y: hotspot.y,
    r: hotspot.r,
    customText: hotspot.customText,
});
