import { creationValueRevision } from '../server/src/creationControlIdentity';
export function referenceMedia(reference: any): string { return reference.imageUrl || reference.url || reference.image || ''; }
/** Written only by a successful render owner, using the submitted request. */
export function generatedReferenceProvenance(media: string, prompt: string, inputMedia?: string) {
  return { kind: 'generated', mediaRevision: creationValueRevision(media), promptRevision: creationValueRevision(prompt),
    operation: inputMedia ? 'edit' : 'generate', sourceMediaRevision: inputMedia ? creationValueRevision(inputMedia) : null };
}
/** Upscale changes the media identity, but never supplies missing prompt provenance. */
export function upscaledReferenceProvenance(reference: any, media: string) {
  const provenance = reference.renderProvenance;
  return provenance?.kind === 'generated' && provenance.mediaRevision === creationValueRevision(referenceMedia(reference))
    ? { ...provenance, mediaRevision: creationValueRevision(media), operation: 'upscale', sourceMediaRevision: provenance.mediaRevision }
    : null;
}
/** Current owner evidence, not a completion flag inferred from words in a prompt. */
export function referenceEditEvidence(reference: any, draft?: string) {
  const committed = String(reference.prompt || '');
  const current = draft ?? committed;
  const media = referenceMedia(reference);
  const provenance = reference.renderProvenance;
  const known = media && provenance?.kind === 'generated' && provenance.mediaRevision === creationValueRevision(media);
  return { referenceId: String(reference.clientReferenceId || ''), field: 'reference_appearance',
    promptRevision: creationValueRevision(current), committedPromptRevision: creationValueRevision(committed),
    mediaRevision: creationValueRevision(media), hasMedia: Boolean(media),
    renderedPromptRevision: known ? provenance.promptRevision : null,
    draftOnly: current !== committed, busy: Boolean(reference.isGenerating || reference.isUploading || reference.isUpscaling) };
}
