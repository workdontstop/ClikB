import type { Template } from './PromptConstructorMock';

/** Preserve a card's creation rank while fallback seeds hydrate from the DB.
 * Cover changes can promote that card; equal timestamps and response arrival
 * order cannot reshuffle other cards. Preset identity survives seed -> DB IDs. */
export function createTemplateOrdering(hasImage: (url?: string | null) => boolean) {
  const createdAt = new Map<string, number>();
  const identity = (template: Template) => template.presetKey || template.id;
  return (templates: Template[]): Template[] => {
    for (const template of templates) {
      const key = identity(template);
      if (!createdAt.has(key)) createdAt.set(key, template.createdAt || 0);
    }
    return [...templates].sort((a, b) => {
      const imageRank = Number(hasImage(b.thumbnailUrl)) - Number(hasImage(a.thumbnailUrl));
      if (imageRank) return imageRank;
      const aKey = identity(a), bKey = identity(b);
      const timeRank = createdAt.get(bKey)! - createdAt.get(aKey)!;
      return timeRank || (aKey < bKey ? -1 : aKey > bKey ? 1 : 0);
    });
  };
}
