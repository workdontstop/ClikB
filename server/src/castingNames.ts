/** Keep automatic labels to one word, preferring the wording in the scene prompts. */
export const normalizeDetectedCharacterNames = <T extends { name?: string }>(
  characters: T[], scenes: unknown,
): T[] => {
  const sourceWords = new Map<string, string>();
  for (const word of JSON.stringify(scenes || '').match(/[\p{L}\p{N}_]+/gu) || []) {
    const key = word.toLocaleLowerCase();
    if (!sourceWords.has(key)) sourceWords.set(key, word);
  }
  return (Array.isArray(characters) ? characters : []).map((character) => {
    const original = String(character?.name || '').trim().replace(/\s+/g, ' ');
    const words = original.split(' ').filter(Boolean);
    const matchingWord = [...words].reverse().find((word) => sourceWords.has(word.toLocaleLowerCase()));
    const name = matchingWord
      ? sourceWords.get(matchingWord.toLocaleLowerCase())!
      : words[words.length - 1] || original;
    return { ...character, name };
  });
};

/** Automatic environment labels use the first identifying word from the scene. */
export const normalizeDetectedEnvironmentNames = <T extends { name?: string }>(
  environments: T[], scenes: unknown,
): T[] => {
  const sourceWords = new Map<string, string>();
  for (const word of JSON.stringify(scenes || '').match(/[\p{L}\p{N}_]+/gu) || []) {
    const key = word.toLocaleLowerCase();
    if (!sourceWords.has(key)) sourceWords.set(key, word);
  }
  return (Array.isArray(environments) ? environments : []).map((environment) => {
    const original = String(environment?.name || '').trim().replace(/\s+/g, ' ');
    const words = original.replace(/^(?:the|a|an)\s+/i, '').split(' ').filter(Boolean);
    const matchingWord = words.find((word) => sourceWords.has(word.toLocaleLowerCase()));
    const name = matchingWord
      ? sourceWords.get(matchingWord.toLocaleLowerCase())!
      : words[0] || original;
    return { ...environment, name };
  });
};

export const FACED_CHARACTER_SHEET = '3-panel character reference sheet on a pure white background: on the left, a full-body front view with the facial area obscured by a clean flat white geometric polygon cutout so full-body facial pixels are suppressed; in the center, a full-body back view; on the right, a large high-definition close-up chest-up portrait showing the complete, uncovered, ultra-detailed face, eyes, hair, skin texture and upper collar. Preserve the contextually established subject composition, membership, count, identities, shared traits, meaningful individual differences, scale and anatomy across corresponding views. Multiple views are not additional subjects. No unrelated scenery, unrequested subjects, labels or text.';

export const CHARACTER_TURNAROUND = '360-degree subject turnaround sheet: front, left profile, back and right profile full-body or complete-object views on a pure white background. Preserve the contextually established subject composition, membership, count, identities, shared traits, meaningful individual differences, scale and anatomy across corresponding views. Multiple views are not additional subjects. No unrelated scenery, unrequested subjects, labels or text.';
