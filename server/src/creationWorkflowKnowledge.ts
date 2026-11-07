import { findUploadedRagInstructionById } from './PostDatabase';
import { selectImagePacerWorkflowKnowledge, type ConciergeKnowledgePacket } from './ConciergeKnowledge';
import { BUNDLED_IMAGE_PACER_WORKFLOW_KNOWLEDGE } from './imagePacerWorkflowSnapshot';

const CREATION_RAG_ID = 'clikb_creation';
const CACHE_MS = 30_000;
const LOOKUP_TIMEOUT_MS = 1_500;

type WorkflowLookup = (ragId: string) => Promise<ConciergeKnowledgePacket | null>;

/** Share one exact lookup across concurrent scenes; never make a model call for workflow knowledge. */
export function createImagePacerWorkflowKnowledgeLoader({
  lookup = findUploadedRagInstructionById,
  now = Date.now,
  cacheMs = CACHE_MS,
  lookupTimeoutMs = LOOKUP_TIMEOUT_MS,
}: {
  lookup?: WorkflowLookup;
  now?: () => number;
  cacheMs?: number;
  lookupTimeoutMs?: number;
} = {}): () => Promise<string> {
  let cached: { instructions: string; expiresAt: number } | undefined;
  let pending: Promise<string> | undefined;

  return async () => {
    if (cached && now() < cached.expiresAt) return cached.instructions;
    if (pending) return pending;

    pending = (async () => {
      let instructions = BUNDLED_IMAGE_PACER_WORKFLOW_KNOWLEDGE;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const packet = await Promise.race([
          lookup(CREATION_RAG_ID),
          new Promise<null>(resolve => { timeout = setTimeout(() => resolve(null), lookupTimeoutMs); }),
        ]);
        if (packet) {
          const selection = selectImagePacerWorkflowKnowledge(packet);
          // Older uploads without the matching pacing contract use the exact
          // bundled local packet selection until the user replaces the upload.
          if (!selection.fallback && selection.instructions) instructions = selection.instructions;
        }
      } catch {
        // RAG/database availability cannot discard completed paid prompt work.
        // The bundled selection ships with the compiled server, including Docker.
      } finally {
        if (timeout !== undefined) clearTimeout(timeout);
      }
      cached = { instructions, expiresAt: now() + cacheMs };
      return instructions;
    })();

    try { return await pending; }
    finally { pending = undefined; }
  };
}

export const getImagePacerWorkflowKnowledge = createImagePacerWorkflowKnowledgeLoader();
