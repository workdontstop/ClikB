// Worlds keep one description for storage and storytelling. Character images
// use only its visual section; descriptions saved before sections remain intact.
const getDescriptionHeadings = (description: string) =>
    Array.from(description.matchAll(
        /^[\t ]*(?:#{1,6}[\t ]+)?(?:\*\*|__)?(Visual description|Personality)(?:\*\*|__)?[\t ]*:(?:\*\*|__)?[\t ]*/gim,
    ));

export const getWorldCharacterImagePrompt = (savedDescription?: string | null): string => {
    const description = savedDescription ?? '';
    const headings = getDescriptionHeadings(description);
    const visualIndex = headings.findIndex((heading) => heading[1].toLowerCase() === 'visual description');
    if (visualIndex !== -1) {
        const heading = headings[visualIndex];
        const start = heading.index! + heading[0].length;
        const end = headings[visualIndex + 1]?.index ?? description.length;
        return description.slice(start, end).trim();
    }

    // An edited description may retain only the Personality heading. Never send
    // that section to an image model, even if the visual heading was removed.
    const personality = headings.find((heading) => heading[1].toLowerCase() === 'personality');
    return personality ? description.slice(0, personality.index).trim() : description;
};

export const getWorldCharacterPersonality = (savedDescription?: string | null): string => {
    const description = savedDescription ?? '';
    const headings = getDescriptionHeadings(description);
    const personalityIndex = headings.findIndex((heading) => heading[1].toLowerCase() === 'personality');
    if (personalityIndex === -1) return '';
    const heading = headings[personalityIndex];
    return description.slice(
        heading.index! + heading[0].length,
        headings[personalityIndex + 1]?.index ?? description.length,
    ).trim();
};
