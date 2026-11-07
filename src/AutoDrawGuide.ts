import type { MotionGuideData } from './motionGuide';
export type AutoDrawGuideMode = "text" | "visual" | "motion";

export type AutoDrawGuideData = {
    motion?: MotionGuideData;
    imageUrl?: string;
    sourcePrompt?: string;
    sourceFrameUrl?: string;
    referenceSignature?: string;
    model?: string;
    createdAt?: number;
};

export const AUTO_DRAW_REF_NAME = "autoDraw1";
export const AUTO_DRAW_REF_INSTRUCTION = "Follow Camera Direction and Motion from @autoDraw1. Treat its arrows, lines, labels, numbers, and annotations as directing instructions only. Do not render or animate these guide markings in the generated video; show only the clean scene and the intended motion.";

// Remove both the original instruction and the expanded version when switching
// modes or refreshing the instruction, so the annotation rule never accumulates.
const AUTO_DRAW_INSTRUCTION_REGEX = /\s*Follow\s+Camera\s+Direction\s+and\s+Motion\s+from\s+@autoDraw1\.?(?:\s*Treat its arrows, lines, labels, numbers, and annotations as directing instructions only\. Do not render or animate these guide markings in the generated video; show only the clean scene and the intended motion\.)?\s*/gi;

const AUTO_DRAW_REFERENCE_REGEX = /(^|[^A-Za-z0-9_])@autoDraw1\b/i;

export const promptHasAutoDrawReference = (promptValue: unknown) =>
    AUTO_DRAW_REFERENCE_REGEX.test(String(promptValue || ""));

export const stripAutoDrawInstruction = (promptValue: unknown) =>
    String(promptValue || "")
        .replace(AUTO_DRAW_INSTRUCTION_REGEX, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

export const insertInstructionIntoCameraSection = (
    promptValue: unknown,
    instructionValue: unknown,
) => {
    const prompt = String(promptValue || "").trim();
    const instruction = String(instructionValue || "").trim();
    if (!instruction) return prompt;
    if (!prompt) return instruction;

    const cameraHeading = /(^|\n)[ \t]*CAMERA\s*:/i.exec(prompt);
    if (!cameraHeading) return `${prompt}\n\n${instruction}`;

    const headingEnd = cameraHeading.index + cameraHeading[0].length;
    const lineEnd = prompt.indexOf("\n", headingEnd);
    if (lineEnd === -1) return `${prompt}\n${instruction}`;

    return `${prompt.slice(0, lineEnd)}\n${instruction}${prompt.slice(lineEnd)}`;
};

export const ensureAutoDrawInstruction = (promptValue: unknown) => {
    const prompt = stripAutoDrawInstruction(promptValue);
    return insertInstructionIntoCameraSection(prompt, AUTO_DRAW_REF_INSTRUCTION);
};

export const buildAutoDrawReference = (data?: AutoDrawGuideData | null) => {
    const imageUrl = String(data?.imageUrl || "").trim();
    if (!imageUrl) return null;

    return {
        name: AUTO_DRAW_REF_NAME,
        url: imageUrl,
        imageUrl,
        image: imageUrl,
        isAutoDraw: true,
    };
};

export const createAutoDrawReferenceSignature = (
    promptValue: unknown,
    sourceFrameUrl: unknown,
    references: any[] = [],
) => JSON.stringify([
    stripAutoDrawInstruction(promptValue),
    String(sourceFrameUrl || "").trim(),
    references
        .map((reference) => ({
            name: String(reference?.name || "").trim(),
            url: String(reference?.imageUrl || reference?.url || reference?.image || "").trim(),
        }))
        .filter((reference) => reference.name || reference.url)
        .sort((left, right) => `${left.name}:${left.url}`.localeCompare(`${right.name}:${right.url}`)),
]);
