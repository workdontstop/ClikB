import { LaneId } from "./TouchInteractionModel";

/**
 * Pure state machine for Drag & Hold.
 *
 * No React and no DOM: the preview component decides WHICH element is being
 * controlled and performs play/pause, this file decides WHETHER it may. Same
 * split as TouchHoldPlaybackModel, and for the same reason — there is no
 * browser in the sandbox, so anything expressed here can be tested and anything
 * expressed in TouchPreviewStageUI cannot.
 *
 * The mechanism in one line: drag to a side and the clip plays under your
 * finger; hold it to the end and the route sticks; let go at any point and it
 * is gone.
 *
 * There is deliberately NO commit threshold. An earlier design let the route
 * stick after 2.5s and then played out hands-free, which meant handing media
 * ownership back mid-clip — and a component taking control of an already
 * playing video is exactly what the ownership gate exists to prevent. It showed
 * as a visible reload and opacity jump halfway through every action clip.
 *
 * Holding to the end instead keeps ownership for one continuous stretch, with a
 * single transition at a node boundary where the snapshot canvas already
 * handles it. It also splits the two clips cleanly: the action clip is entirely
 * effort, the payoff is entirely reward.
 */

/**
 * How far the Stick must travel before a lane locks, as a fraction of stage
 * width. Also the protection against an accidental nudge: an empty lane
 * replays the whole node, so crossing must be deliberate.
 */
export const LANE_THRESHOLD = 0.18;

/**
 * engaged                   — lane locked, clip advancing only while held
 * completed-awaiting-release — the clip reached its end with the finger still
 *                              down; the route is won and ownership is kept
 *                              until that release is consumed
 *
 * There is no paused phase. Releasing does not pause a Drag & Hold, it abandons
 * it: the attempt is spent and the viewer is returned to the drag node. That is
 * the difference in one word from Hold to Play, which survives release and
 * resumes mid-frame.
 */
export type DragPhase = "engaged" | "completed-awaiting-release";

export interface DragSession {
    sessionId: number;
    phase: DragPhase;
    lane: LaneId;
    /** Null once released. */
    pointerId: number | null;
    /**
     * The drag node this session started from — the destination of every
     * fallback. Held as an id because locking a lane replaces currentNode
     * immediately, so by the time the gesture matters the origin is gone from
     * component state.
     */
    originNodeId: string;
    /** The action node being driven. */
    actionNodeId: string;
    /**
     * The visitKey the controlled media is expected to mount under. Readiness
     * callbacks that do not match belong to an element the keyed remount has
     * already destroyed.
     */
    expectedVisitKey: string | null;
    /** The first activation seeks to zero exactly once. */
    hasStartedAtZero: boolean;
}

export type DragState = DragSession | null;

export type DragEvent =
    | {
          type: "ENGAGE";
          sessionId: number;
          lane: LaneId;
          pointerId: number | null;
          originNodeId: string;
          actionNodeId: string;
          expectedVisitKey: string | null;
      }
    | { type: "MEDIA_READY"; sessionId: number; visitKey: string | null }
    | { type: "MEDIA_ENDED"; sessionId: number }
    | { type: "RELEASE"; pointerId: number | null }
    | { type: "ABORT" };

const isSameSession = (state: DragState, sessionId: number): state is DragSession =>
    state !== null && state.sessionId === sessionId;

/**
 * Only the pointer that began the session may drive it. A null pointerId means
 * keyboard control, which matches a null event pointerId.
 */
const isControllingPointer = (state: DragSession, pointerId: number | null): boolean =>
    state.pointerId === null || state.pointerId === pointerId;

export const dragHoldReducer = (state: DragState, event: DragEvent): DragState => {
    switch (event.type) {
        case "ENGAGE":
            // Always replaces. A lane locks once and cannot be re-aimed without
            // releasing first, so a second ENGAGE is a fresh attempt.
            return {
                sessionId: event.sessionId,
                phase: "engaged",
                lane: event.lane,
                pointerId: event.pointerId,
                originNodeId: event.originNodeId,
                actionNodeId: event.actionNodeId,
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
            if (state.phase !== "engaged") return state;
            return { ...state, hasStartedAtZero: true };
        }

        case "MEDIA_ENDED": {
            if (!isSameSession(state, event.sessionId)) return state;
            if (state.phase !== "engaged") return state;
            // The route is won. Ownership is HELD until the release is consumed.
            //
            // Ending the session here would release every guard while the
            // physical pointerup is still pending, and that release lands on
            // the destination's own handler — where a single tap restarts the
            // video. The viewer would see the next scene start and instantly
            // restart. Hold to Play has the identical state for the identical
            // reason.
            return { ...state, phase: "completed-awaiting-release" };
        }

        case "RELEASE": {
            if (state === null) return state;
            // A won route is discharged by ANY release, deliberately not
            // pointer-matched. Requiring the original id left the state
            // undischargeable whenever a release was missed — and the Stick
            // unmounts the instant the clip ends, taking its pointer capture
            // with it, so a missed release is the NORMAL case here. That is
            // exactly what locked Hold up before.
            if (state.phase === "completed-awaiting-release") return null;
            // An unfinished attempt is abandoned only by the pointer driving it.
            if (!isControllingPointer(state, event.pointerId)) return state;
            return null;
        }

        case "ABORT":
            return null;

        default:
            return state;
    }
};

/* ------------------------------------------------------------------ *
 * Predicates — components use these instead of reading `phase`
 * ------------------------------------------------------------------ */

/**
 * True while the session owns an element and forbids autonomous playback.
 *
 * ENGAGED ONLY. Ownership ends when the effort ends.
 *
 * It once covered the completed phase too, on the theory that holding on until
 * the release was consumed was safer. It was not: ownership suppresses every
 * one of TouchPreviewMedia's play paths, so the payoff mounted, reported ready,
 * and then sat frozen until the session cleared — which only happened via the
 * caller's 1.2s safety net. That was a full second of dead frame between the
 * action clip ending and the payoff starting.
 *
 * The pending release is handled where it actually lands — as a suppressed tap
 * on the destination — not by keeping the video hostage.
 */
export const dragOwnsMedia = (state: DragState): boolean => state?.phase === "engaged";

/** True only when the action clip should actually be advancing. */
export const dragIsPlaying = (state: DragState): boolean =>
    state?.phase === "engaged" && state.pointerId !== null;

/** The clip is still running and the route is not yet won. */
export const dragEngaged = (state: DragState): boolean => state?.phase === "engaged";

/** The clip finished under the finger; waiting for that release. */
export const dragAwaitingRelease = (state: DragState): boolean =>
    state?.phase === "completed-awaiting-release";

/**
 * Whether the Stick should be on screen.
 *
 * The Stick is fixed chrome, rendered outside <React.Fragment key={visitKey}>
 * and on top of everything, so it is never destroyed by a node change. This
 * function is therefore the ONLY thing that hides it.
 *
 *   drag node, choices up → visible, armed
 *   engaged               → visible; the finger is on it for the whole clip
 *   won, awaiting release → hidden; the effort is over
 *   anywhere else         → hidden, like any other control
 *
 * Keeping it mounted across the lane lock is load-bearing rather than cosmetic:
 * locking a lane navigates immediately, and an unmounted element loses its
 * pointer capture, so the browser fires pointercancel and the release handler
 * reads it as the viewer letting go. Every drag snapped back before the finger
 * had moved, and the action clip never played.
 */
export const stickVisible = (state: DragState, nodeIsDrag: boolean): boolean => {
    if (state !== null) return state.phase === "engaged";
    return nodeIsDrag;
};

/**
 * Which lane a horizontal displacement selects, or null if it has not travelled
 * far enough to lock one.
 *
 * Vertical displacement is deliberately ignored — a drag up and to the left is
 * a left, and the control is meant to feel like a real joystick rather than a
 * gesture the viewer has to aim.
 */
export const laneForOffset = (
    offsetX: number,
    stageWidth: number,
    threshold: number = LANE_THRESHOLD
): LaneId | null => {
    if (!stageWidth || stageWidth <= 0) return null;
    const travel = offsetX / stageWidth;
    if (travel <= -threshold) return "left";
    if (travel >= threshold) return "right";
    return null;
};
