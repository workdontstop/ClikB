/** Movement is already authored in the animatic. Never reintroduce the scene's
 * narrative (or the forward command on a return) as a competing choreography. */
export function spatialClipPrompt(operation: 'movement' | 'action' | 'return', instruction = ''): string {
    if (operation === 'action') return instruction.trim().slice(0, 1100);
    return operation === 'return'
        ? 'Follow the return motion reference from its start to its end.'
        : 'Follow the motion reference from its start to its end.';
}

export function explicitSpatialClipPrompt(job: { prompt: string; promptVersion?: number }): string | undefined {
    const prompt = job.prompt.trim();
    return job.promptVersion === 2 && prompt && !/^Follow the (?:return )?motion reference from its start to its end\.$/.test(prompt)
        ? prompt.slice(0, 1100) : undefined;
}

export function effectiveSpatialClipPrompt(job: { prompt: string; promptVersion?: number; direction: 'forward' | 'backward'; kind?: 'movement' | 'action'; guidance?: { instruction: string } }): string {
    const edited = explicitSpatialClipPrompt(job);
    if (edited) return edited;
    if (job.guidance?.instruction && job.kind !== 'action') return job.guidance.instruction;
    if (job.promptVersion === 2) return job.prompt.trim().slice(0, 1100);
    return spatialClipPrompt(job.kind === 'action' ? 'action' : job.direction === 'backward' ? 'return' : 'movement', job.prompt);
}
