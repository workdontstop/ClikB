// creationStage.ts
//
// Single source of truth for "where is the user in the creation flow".
//
// PromptInput renders four visually different things out of one component, and
// until now each of them was recognised by re-typing the same ad-hoc condition
// (`GeneratedImageFlux || parsedKeyPoints.length > 0`, `planInfo === 0 &&
// parsedKeyPoints.length === 0 && !minimisePrompt && GeneratedImage.length === 0`,
// ...) at every call site. That works, but it means a restyle of one stage has
// to be repeated in ~10 places and can silently drift out of sync.
//
// This module derives the stage from the SAME real data those conditions already
// read - no new flag anyone has to remember to set, nothing that can go stale.
// The stage is a pure function of state that the generation pipeline itself
// writes, so it is correct by construction:
//
//   parsedKeyPoints   <- set by StartPlan when a storyboard comes back
//   GeneratedImageFlux / generatedImagesFluxx
//                     <- set by the image submit handlers when a result lands
//   CreationReferenceDraft.generatedImages
//                     <- input/reference images only; never advances the stage
//   planInfo          <- 0 idle, 1 request sent, 2 keypoints back, 3 plan back
//   allowSpin         <- true for the whole StartStory round-trip
//   isSubmittingKick  <- true from the moment a submit is accepted
//   minimisePrompt    <- the panel is hidden entirely (user is in the feed)
//
// Priority is "most advanced state wins", so `composer` can never be reported
// while later-stage data exists. That is the guarantee the layout needs: if
// isComposer is true, there is genuinely nothing generated yet.

export type CreationStage =
    /** Prompt panel is hidden; the user is browsing feeds. */
    | 'browsing'
    /** THE INITIAL LOOK: prompt entry, nothing generated yet. Restyle target. */
    | 'composer'
    /** A submit is in flight - plan/scenes/images are being fetched. */
    | 'generating'
    /** Image results are back, but no storyboard yet. */
    | 'preview'
    /** A storyboard exists - Storybook / scene review owns the screen. */
    | 'story';

export interface CreationStageInputs {
    /** Panel hidden entirely (PromptInput `minimisePrompt`). */
    minimisePrompt: boolean;
    /** `parsedKeyPoints.length` - non-zero means a storyboard exists. */
    parsedKeyPointsCount: number;
    /** `GeneratedImageFlux` - single flux result URL, '' when none. */
    generatedImageFlux: string;
    /** `generatedImagesFluxx.length`. */
    generatedImagesFluxCount: number;
    /** `planInfo`: 0 idle, 1 sent, 2 keypoints back, 3 plan back. */
    planInfo: number;
    /** `allowSpin` - true for the whole StartStory round-trip. */
    allowSpin: boolean;
    /** `isSubmittingKick` - true once a submit is accepted. */
    isSubmittingKick: boolean;
    /** `countdown` - the pre-submit safety clock, null when not armed. */
    countdown: number | null;
    /** `showLandingWelcome` - PromptWelcomeUI is on screen. */
    showLandingWelcome: boolean;
    /**
     * `minimizeMode` - the MANUAL size the user picked with the minimise button
     * in PromptToolbar: 0 full, 1 inline, 2 compact strip.
     *
     * This is a separate axis from `stage`, and the two cannot currently collide:
     * the minimise button only renders when PromptToolbar's `isStorybookOpen`
     * (GeneratedImageFlux || parsedKeyPoints.length > 0) is true, i.e. only in
     * 'preview' / 'story', and every route back to the composer resets it to 0
     * (handleCloseOverlay, the parsedKeyPoints effect, the mobile image handlers).
     * It is taken as an input anyway so the stage-driven compact look can never
     * fight a manual size the user chose - certainty beats an invariant that
     * happens to hold today.
     */
    minimizeMode: number;
}

export interface CreationStageInfo {
    stage: CreationStage;
    /**
     * The flag layout code should branch on. True ONLY for the untouched
     * prompt-entry screen, before anything has been generated.
     */
    isComposer: boolean;
    /** Composer with the welcome/landing cards showing (a sub-state, not a stage). */
    isLanding: boolean;
    /**
     * The 5s pre-submit countdown is running. Still `composer` - the layout has
     * not changed yet, only the blink - but useful for suppressing interactions.
     */
    isArming: boolean;
    /** True once anything has been generated: preview or story. */
    hasOutput: boolean;
    /** The user has manually shrunk the panel (minimizeMode 1 or 2). */
    isManuallyMinimised: boolean;
    /**
     * THE RESIZE FLAG. True for 'composer' AND 'generating'.
     *
     * The compact look must survive the whole pre-result run, not just the idle
     * composer: while a request is in flight PlanSteps renders its progress text
     * INSIDE the same shell (PromptInput, the `isSubmittingKick &&
     * parsedKeyPoints.length === 0` branch), so the panel must stay small there
     * too - otherwise it would pop open the moment Create is pressed.
     *
     * It releases at exactly the point the "Accessing Imagination" scene cards
     * appear: `parsedKeyPoints.length > 0` is both the trigger for stage 'story'
     * and the mount condition for Storybook, which owns those cards. A single
     * image result ('preview') releases it too.
     *
     * Also false whenever the user has manually minimised, so the compact
     * composer styling never overrides a size they picked themselves.
     */
    isCompact: boolean;
}

const hasAnyImageOutput = (i: CreationStageInputs): boolean =>
    Boolean(i.generatedImageFlux)
    || i.generatedImagesFluxCount > 0;

/**
 * Derive the current creation stage. Pure - safe to call in a useMemo, in a
 * selector, or in a test.
 */
export const getCreationStage = (inputs: CreationStageInputs): CreationStage => {
    // 1. Panel hidden wins over everything: nothing of PromptInput is on screen.
    //    (Matches the existing `stage` snapshot logic, which reports
    //    'feed_browsing' whenever minimisePrompt is set.)
    if (inputs.minimisePrompt) return 'browsing';

    // 2. A storyboard is the most advanced state - Storybook owns the screen.
    if (inputs.parsedKeyPointsCount > 0) return 'story';

    // 3. Image results are back but no scenes: the preview view.
    if (hasAnyImageOutput(inputs)) return 'preview';

    // 4. A request is in flight. planInfo returns to 0 at the end of StartPlan
    //    in the same batch that sets parsedKeyPoints, so checking it here (after
    //    the storyboard check) never produces a false 'generating'.
    if (
        inputs.planInfo !== 0
        || inputs.allowSpin
        || inputs.isSubmittingKick
    ) return 'generating';

    // 5. Nothing generated, nothing in flight: the initial composer look.
    return 'composer';
};

/**
 * Full stage info, including the sub-flags the layout needs.
 * Note the countdown is deliberately NOT treated as 'generating': while it runs
 * the composer is still fully on screen, so collapsing it would resize the UI a
 * beat too early.
 */
export const getCreationStageInfo = (inputs: CreationStageInputs): CreationStageInfo => {
    const stage = getCreationStage(inputs);
    const isComposer = stage === 'composer';

    return {
        stage,
        isComposer,
        isLanding: isComposer && inputs.showLandingWelcome,
        isArming: isComposer && inputs.countdown !== null,
        hasOutput: stage === 'preview' || stage === 'story',
        isManuallyMinimised: inputs.minimizeMode !== 0,
        isCompact:
            (stage === 'composer' || stage === 'generating')
            && inputs.minimizeMode === 0,
    };
};

/** Safe default for consumers that render before PromptInput passes the real value. */
export const DEFAULT_CREATION_STAGE_INFO: CreationStageInfo = {
    stage: 'composer',
    isComposer: true,
    isLanding: false,
    isArming: false,
    hasOutput: false,
    isManuallyMinimised: false,
    isCompact: true,
};
