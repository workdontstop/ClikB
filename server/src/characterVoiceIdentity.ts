type VoiceCharacter = { id?: unknown; name?: unknown; voice_profile?: unknown; [key: string]: unknown };
const characterName = (value: unknown) => typeof value === 'string'
    ? value.trim().replace(/^@/, '').replace(/[^\p{L}\p{N}]/gu, '').toLocaleLowerCase() : '';
const characters = (plan: any): VoiceCharacter[] => Array.isArray(plan?.characters) ? plan.characters : [];
const hasProfile = (character: VoiceCharacter) => character.voice_profile !== null
    && typeof character.voice_profile === 'object' && !Array.isArray(character.voice_profile)
    && Object.keys(character.voice_profile as object).length > 0;

/** A scene/image refresh must not rewrite the authored voice of an existing actor. */
export const preserveAuthoredVoiceProfiles = (plan: any, ...sourcePlans: any[]): any => {
    const originals = sourcePlans.flatMap(characters).filter(hasProfile);
    if (!originals.length || !Array.isArray(plan?.characters)) return plan;
    return { ...plan, characters: plan.characters.map((character: VoiceCharacter) => {
        const name = characterName(character.name);
        const original = originals.find(candidate => name
            ? characterName(candidate.name) === name
            : !characterName(candidate.name) && !!character.id && candidate.id === character.id);
        return original ? { ...character, voice_profile: original.voice_profile } : character;
    }) };
};

export const buildCharacterVoiceIdentityPrompt = (value: unknown): string => {
    const profiles = (Array.isArray(value) ? value : []).filter(hasProfile)
        .map(character => ({ id: character.id, name: character.name, voice_profile: character.voice_profile }));
    return `CHARACTER VOICE IDENTITY:\n${JSON.stringify(profiles)}\nPreserve each named character's authored voice identity: accent, timbre, pitch and baseline speaking style. Include the relevant profile in that character's speech guidance. Shot-specific emotion, volume, speed and delivery may vary naturally while retaining that identity. Camera, scene and appearance descriptions do not define a replacement voice. Existing authored voice descriptions in the original prompt are authoritative unless the user explicitly changes the voice. Do not invent a new voice identity for an actor with no supplied profile.`;
};
