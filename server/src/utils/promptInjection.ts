export interface CharacterData {
  name: string;
  url?: string;
  imageUrl?: string;
  image?: string;
  description?: string;
}

/**
 * Common logic to extract the actual unified URL.
 */
function getUrl(char: CharacterData): string | null {
  const url = char.image || char.imageUrl || char.url || "";
  return url.trim() || null;
}

/**
 * Helper to strip the physical description from the prompt.
 */
function stripDescription(inputs: string, description?: string): string {
  if (!description || !description.trim()) return inputs;
  const descRegex = new RegExp(escapeRegExp(description.trim()), "gi");
  return inputs.replace(descRegex, "").replace(/\s{2,}/g, ' ').trim();
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/**
 * FLUX.2 Family (1-based index)
 * Replaces @Name with <image_X> where X is the 1-based index of the URL in the sampleImages array.
 */
export function injectFlux2(inputs: string, sampleImages: string[], sampleimagesnames: CharacterData[]): string {
  if (!inputs || !sampleimagesnames || !Array.isArray(sampleimagesnames) || !sampleImages || !Array.isArray(sampleImages)) {
    return inputs;
  }

  let finalInputs = inputs;

  for (const char of sampleimagesnames) {
    const rawUrl = getUrl(char);
    if (!rawUrl) continue;

    const index = sampleImages.findIndex(u => u === rawUrl);
    if (index !== -1) {
      // 1-based index tags for Flux 2
      const injectionTag = `<image_${index + 1}>`;
      const formattedName = char.name.replace(/\s+/g, ''); // Strip spaces for @Handle match
      const handleRegex = new RegExp(`@${escapeRegExp(formattedName)}\\b`, "gi");
      finalInputs = finalInputs.replace(handleRegex, injectionTag);
    }
  }

  return finalInputs;
}

/**
 * Seedream Vanguard Family (0-based index)
 * Replaces @Name with <subject_X> where X is the 0-based index of the URL in the sampleImages array.
 */
export function injectSeedream(inputs: string, sampleImages: string[], sampleimagesnames: CharacterData[]): string {
  if (!inputs || !sampleimagesnames || !Array.isArray(sampleimagesnames) || !sampleImages || !Array.isArray(sampleImages)) {
    return inputs;
  }

  let finalInputs = inputs;

  for (const char of sampleimagesnames) {
    const rawUrl = getUrl(char);
    if (!rawUrl) continue;

    const index = sampleImages.findIndex(u => u === rawUrl);
    if (index !== -1) {
      // 0-based index tags for Seedream 4.5
      const injectionTag = `<subject_${index}>`;
      const formattedName = char.name.replace(/\s+/g, ''); // Strip spaces for @Handle match
      const handleRegex = new RegExp(`@${escapeRegExp(formattedName)}\\b`, "gi");
      finalInputs = finalInputs.replace(handleRegex, injectionTag);
    }
  }

  return finalInputs;
}

/**
 * Google/Gemini Architectures (FAL.ai Semantic Labeling)
 * Replaces @Name with [Name] and constructs the strongly typed `reference_images` payload array.
 */
export function injectSemanticLabel(inputs: string, sampleImages: string[], sampleimagesnames: CharacterData[]) {
  if (!inputs || !sampleimagesnames || !Array.isArray(sampleimagesnames) || !sampleImages || !Array.isArray(sampleImages)) {
    return { updatedInputs: inputs, structuredRefs: [] };
  }

  let finalInputs = inputs;
  const structuredRefs: { url: string; label: string }[] = [];

  for (const char of sampleimagesnames) {
    const rawUrl = getUrl(char);
    if (!rawUrl) continue;

    if (sampleImages.includes(rawUrl)) {
      const formattedName = char.name.replace(/\s+/g, ''); // Strip spaces for @Handle match
      const injectionTag = `[${char.name}]`; // Keep original name in the semantic label
      const handleRegex = new RegExp(`@${escapeRegExp(formattedName)}\\b`, "gi");

      let newInputs = finalInputs.replace(handleRegex, injectionTag);
      newInputs = stripDescription(newInputs, char.description);

      // Attempt replace
      if (newInputs !== finalInputs) {
        finalInputs = newInputs;

        // Push structured definition
        // As per the User Plan constraint: Nano Banana 2 API Payload Structure demands exactly reference_images: [{ url, label }]
        structuredRefs.push({
          url: rawUrl,
          label: injectionTag
        });
      }
    }
  }

  return { updatedInputs: finalInputs, structuredRefs };
}

// 4. Conversational Positional Injection (For Google/Gemini Vanguard on Replicate)
export function injectConversational(inputs: string, sampleImages: string[], sampleimagesnames: CharacterData[]) {
  if (!inputs || !sampleimagesnames || !Array.isArray(sampleimagesnames) || !sampleImages || !Array.isArray(sampleImages)) {
    return inputs;
  }

  let finalInputs = inputs;
  const positions = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];

  for (const char of sampleimagesnames) {
    if (!char.name) continue;

    const rawUrl = getUrl(char);
    if (!rawUrl) continue;

    const index = sampleImages.findIndex(u => u === rawUrl);
    if (index !== -1 && index < positions.length) {
      const formattedName = char.name.replace(/\s+/g, ''); // Strip spaces for @Handle match
      const injectionTag = `the subject in the ${positions[index]} image`;

      const handleRegex = new RegExp(`@${escapeRegExp(formattedName)}\\b`, "gi");
      finalInputs = finalInputs.replace(handleRegex, injectionTag);
      finalInputs = stripDescription(finalInputs, char.description);
    }
  }

  return finalInputs;
}
