import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { beginLlmRequest, mergeLlmBilling, runBilledLlmOperation } from './llmBilling';
import type { CreationInference } from './creationModelProfiles';
import { getImagePacerWorkflowKnowledge } from './creationWorkflowKnowledge';
import { IMAGE_PACER_SYSTEM_PROMPT, imagePacingFingerprint, parsePacedImages } from './imagePromptPacer';

type Scene = { id: string; fullScene: string; sceneIntent?: unknown };
type PreparedImage = {
    version: 1; originalImagePrompt: string; pacedImagePrompt: string; handoff: string; fullScene: string;
};

/** One initial operation, two separately charged and retryable model stages. */
export async function prepareInitialImagePrompts(req: Request, res: Response, config: {
    fallbackModel: string;
    cameraLanguage: string;
    baseMessages: unknown[];
    scenes: Scene[];
    context: unknown;
    generate: (messages: any[], model: string, inference?: CreationInference) => Promise<unknown>;
    parseOriginal: (raw: unknown) => string[];
}): Promise<{ images: PreparedImage[]; llmBilling?: unknown } | null> {
    const workflow = await getImagePacerWorkflowKnowledge();
    const fingerprint = imagePacingFingerprint({
        version: 1, baseMessages: config.baseMessages, scenes: config.scenes, context: config.context,
        pacingInstructions: IMAGE_PACER_SYSTEM_PROMPT, cameraLanguage: config.cameraLanguage, workflow,
    });
    const runId = typeof req.body.promptOperationId === 'string' && req.body.promptOperationId.length <= 240
        ? req.body.promptOperationId : randomUUID();
    const baseOperation = { operationKey: `${runId}:original`, fingerprint };
    const pacingOperation = { operationKey: `${runId}:pacing`, fingerprint };
    const llm = await beginLlmRequest(req, res, config.fallbackModel, { operations: [baseOperation, pacingOperation] });
    if (!llm) return null;
    const original = await runBilledLlmOperation(llm, {
        ...baseOperation, stage: 'image_prompt', actionLabel: config.scenes.length > 1 ? 'Cinema Prompts' : 'Image Prompt',
    }, async () => {
        const prompts = config.parseOriginal(await config.generate(config.baseMessages as any[], llm.model, llm.inference));
        if (prompts.length !== config.scenes.length || prompts.some(prompt => !prompt.trim())) {
            throw new Error('Initial image writer returned an incomplete scene or stage.');
        }
        return prompts;
    });
    const sources = config.scenes.map((scene, index) => ({ ...scene, originalImagePrompt: original.value[index] }));
    const paced = await runBilledLlmOperation(llm, {
        ...pacingOperation, stage: 'image_prompt_pacer', actionLabel: 'Image Prompt Pacer',
    }, async () => {
        const messages = [
            { role: 'system', content: `${config.cameraLanguage}\n\n${workflow}\n\n${IMAGE_PACER_SYSTEM_PROMPT}` },
            { role: 'user', content: JSON.stringify({ images: sources, creationContext: config.context }) },
        ];
        return parsePacedImages(await config.generate(messages, llm.model, llm.inference), sources);
    });
    const billing = mergeLlmBilling([original.billing, paced.billing]);
    return {
        images: sources.map((source, index) => ({ version: 1,
            originalImagePrompt: source.originalImagePrompt, fullScene: source.fullScene, ...paced.value[index] })),
        ...(billing ? { llmBilling: billing } : {}),
    };
}

export function initialImagePromptError(res: Response, error: unknown): unknown {
    const detail = error as { status?: number; message?: string; pixels?: number; required?: number };
    const status = detail.status === 402 ? 402 : 500;
    return res.status(status).send({ message: status === 402 ? detail.message : 'Image prompt preparation failed. Completed prompt stages are retained for retry.',
        ...(typeof detail.pixels === 'number' ? { pixels: detail.pixels } : {}),
        ...(typeof detail.required === 'number' ? { required: detail.required } : {}),
    });
}
