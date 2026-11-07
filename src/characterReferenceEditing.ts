import { getGptImageRoute } from './imageModels';

export type ReferenceImageGenerationMode = 'recreate' | 'edit';

type ImageReference = {
  imageUrl?: string;
  url?: string;
  image?: string;
  vipSourceImageUrl?: string;
  sourceImageUrl?: string;
  inputImageUrl?: string;
  isVip?: boolean;
  assetKind?: 'character' | 'environment' | 'object';
  source?: string;
  imageGenerationMode?: ReferenceImageGenerationMode;
};

export function getReferenceImageGenerationMode(
  reference?: ImageReference | null,
  vipReference?: ImageReference,
): ReferenceImageGenerationMode {
  if (reference?.imageGenerationMode) return reference.imageGenerationMode;
  const kind = reference?.assetKind || vipReference?.assetKind;
  if (kind === 'environment' || kind === 'object') return 'recreate';
  return reference?.isVip || reference?.source === 'upload' || reference?.source === 'world' || vipReference
    ? 'edit'
    : 'recreate';
}

/** Edits always start with the displayed result, including a manual replacement. */
export function getReferenceGenerationInput(reference?: ImageReference | null, vipReference?: ImageReference): string {
  return String(reference?.imageUrl || reference?.url || reference?.image
    || reference?.vipSourceImageUrl || reference?.sourceImageUrl || reference?.inputImageUrl
    || vipReference?.imageUrl || '').trim();
}

export function getReferenceGenerationRoute(model: string, mode: ReferenceImageGenerationMode): string {
  const gptRoute = getGptImageRoute(model);
  if (gptRoute) return gptRoute;
  if (model === 'Schnell' || model === 'Models') return 'fluxschnell';
  if (model === 'Imagen' || model === 'Bannana') return mode === 'edit' ? 'Bannana' : 'Imagen';
  if (model === 'Imagen2' || model === 'Bannana2') return mode === 'edit' ? 'Bannana2' : 'Imagen2';
  if (model === 'Hi Dream') return 'HiDream';
  if (['minimax', 'minimax2', 'fluxUltra', 'fluxUltra2', 'fluxDev', 'seeDream'].includes(model)) return model;
  return mode === 'edit' ? 'minimax' : 'fluxschnell';
}

export function applyReferenceImageReplacement<T extends ImageReference>(reference: T, imageUrl: string) {
  return {
    ...reference,
    imageUrl,
    url: imageUrl,
    image: imageUrl,
    renderProvenance: null,
    imageGenerationMode: 'edit' as const,
    hasManualImage: true,
    isUploading: false,
    isGenerating: false,
    isUpscaling: false,
  };
}
