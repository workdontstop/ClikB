import { buildSceneDisplayMap, sceneDisplayLabel, type SceneDisplaySource } from './creationSceneDisplay';
import { hasFinalSceneImage } from './sceneImageReadiness';
import { renderCreationMemorySections, type CreationMemoryCard } from './creationMemory';

const usable = (value: unknown): boolean => typeof value === 'string' && /^(https?:|blob:)/i.test(value);

/** Complete saved content is readable before any of its conditional editors mount. */
export function buildDraftCreationMemory(snapshot: any): CreationMemoryCard[] {
  const projectId = String(snapshot?.creationProjectId || '');
  if (!projectId) return [];
  const p = snapshot.sections?.prompt || {}, s = snapshot.sections?.storybook || {}, e = snapshot.sections?.editor || {};
  const scenes = p.parsedKeyPoints || p.parsedKeyPointsb || [];
  if (!Array.isArray(scenes) || !scenes.length) return [];
  const cinema = Number(snapshot.creationType) === 1, mode = cinema ? 'Cinema' : Number(snapshot.creationType) === 3 ? 'Games' : 'Shorts';
  const key = `project:${projectId}`;
  const sources: SceneDisplaySource[] = [];
  const cards: CreationMemoryCard[] = [];
  const add = (cardKey: string, title: string, fields: Array<[string, unknown]>, scene?: number) => cards.push({
    cardKey, title, cardType: 'creation_scene_state', mode, ...(scene ? { sceneNumber: String(scene) } : {}),
    text: renderCreationMemorySections(fields),
  });
  const editorFields = (target: string) => ({
    ...Object.fromEntries(Object.entries(e).flatMap(([field, value]: [string, any]) =>
      value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, target) ? [[field, value[target]]] : [])),
    currentImagePromptDraft: e.promptDrafts?.image?.[target],
    currentVideoPromptDraft: e.promptDrafts?.video?.[target],
    imagePromptHasUncommittedEdit: e.promptDrafts?.dirtyImage?.includes(target),
    videoPromptHasUncommittedEdit: e.promptDrafts?.dirtyVideo?.includes(target),
  });
  scenes.forEach((scene: unknown, i: number) => {
    const target = `A:${i}`, receipt = s.imageReceipts?.[target];
    const binding = s.intentSceneBindings?.[i];
    const intent = s.intentBlueprintState?.scenes?.[binding?.sceneId];
    const image = p.ImagesHdCloud?.[i] || p.generatedImagesFluxx?.[i];
    const preview = p.nanoImages?.[i];
    const hasImage = hasFinalSceneImage({ hdImageUrl: image, nanoImageUrl: preview, quality: receipt?.quality });
    const hasVideo = usable(s.VideoArrayCloud?.[i] || s.VideoArray?.[i]);
    sources.push({ type: 'A', index: i, originalIndex: sources.length, hasHdImage: hasImage,
      hasPreviewImage: !hasImage && usable(image || preview), hasVideo });
    add(`${key}:scene:${i + 1}:state`, `A-roll scene ${i + 1} current state`, [
      ['Native slot', target], ['Cinema stage', cinema ? `${i % 2 ? 'Stage B' : 'Stage A'} of logical scene ${Math.floor(i / 2) + 1}` : undefined],
      ['Full generated scene', scene], ['Scene intent', p.intentOverview?.scenes?.[i]?.text],
      ['Image prompt', s.GeneratedText?.[i]], ['Original image prompt', s.GeneratedTextx?.[i]],
      ['Compiled scene intent and image pacing', intent],
      ['Video prompt', s.TextVideo?.[i]], ['Narration', p.parsedKeyPoints2?.[cinema ? Math.floor(i / 2) : i]],
      ['Image references', s.sceneActiveCharacters?.[i]], ['Video references', s.sceneActiveCharactersVideo?.[i]],
      ['Readiness', { hasFinalImage: hasImage, hasPreview: !hasImage && usable(image || preview), hasVideo,
        previewIsFinalOutput: false, directVideoWithoutStartFrame: s.noImagePrompt?.[i] }],
      ['Duration seconds', s.clipDurations?.[i]], ['Saved workstation context', editorFields(target)],
      ['Draw reference', p.drawFrameData?.[i]], ['Visual guide', p.autoDrawGuideData?.[i]],
      ['Video result history', s.videoHistory?.[target]], ['Narration metadata', s.narrationMetadata?.[i]],
      ['Supporting B-roll prompts', p.bShotPrompts?.[i]],
    ], i + 1);
    (p.bShotPrompts?.[i] || []).forEach((prompt: string, b: number) => {
      const target = `B:${i}:${b}`, receipt = s.imageReceipts?.[target];
      const image = p.bShotImages?.[i]?.[b], preview = p.bShotNanoImages?.[i]?.[b], video = p.bShotVideos?.[i]?.[b];
      const hasImage = hasFinalSceneImage({ hdImageUrl: image, nanoImageUrl: preview, quality: receipt?.quality });
      sources.push({ type: 'B', index: i, bIndex: b, originalIndex: sources.length, hasHdImage: hasImage,
        hasPreviewImage: !hasImage && usable(image || preview), hasVideo: usable(video) });
      add(`${key}:scene:${i + 1}:broll:${b + 1}:state`, `B-roll ${b + 1} for A-roll scene ${i + 1}`, [
        ['Native slot', target], ['Parent A-roll native scene', i + 1],
        ['Cinema parent stage', cinema ? (i % 2 ? 'Stage B' : 'Stage A') : undefined],
        ['Image prompt', prompt], ['Video prompt', p.bShotTextVideo?.[i]?.[b]],
        ['Image references', s.bShotSceneActiveCharacters?.[i]?.[b]], ['Video references', s.bShotSceneActiveCharactersVideo?.[i]?.[b]],
        ['Readiness', { hasFinalImage: hasImage, hasPreview: !hasImage && usable(image || preview), hasVideo: usable(video),
          previewIsFinalOutput: false, directVideoWithoutStartFrame: s.bShotNoImagePrompt?.[i]?.[b] }],
        ['Saved workstation context', editorFields(target)],
        ['Draw reference', p.bShotDrawFrameData?.[i]?.[b]], ['Visual guide', p.bShotAutoDrawGuideData?.[i]?.[b]],
        ['Video result history', s.videoHistory?.[target]],
      ], i + 1);
    });
  });
  // Bootstrap the A-roll view; the mounted grid publishes its own current display index.
  const display = buildSceneDisplayMap(sources.filter(source => source.type === 'A'), cinema);
  add(`${key}:scene_index`, 'Current creation scene index', [['Scene count', display.count],
    ['Scenes', display.entries.map(entry => ({ ...entry, label: sceneDisplayLabel(entry) }))]]);
  add(`${key}:video_plan`, 'Current video plan', [['Video plan', s.PlanVid]]);
  return cards;
}

/** A bounded, project-scoped copy supports answers while session-memory sync retries. */
export function selectCreationMemoryFallback(cards: CreationMemoryCard[], projectId: string, query: string, slots: any[] = []): CreationMemoryCard[] {
  const prefix = `project:${projectId}:`;
  const number = Number(query.match(/\bscene\s*(?:number\s*)?#?\s*(\d+)/i)?.[1]);
  const slot = slots.find(slot => Number(slot.displaySceneNumber) === number);
  const native = slot?.nativeSlotNumber || number;
  const bRoll = slot?.role === 'b-shot' ? `broll:${slot.bShotNumber}:` : '';
  const sceneKey = native > 0 ? `${prefix}scene:${native}:${bRoll}` : '';
  const topic = /\b(character|environment|reference)\b/i.test(query) ? 'characters'
    : /\b(video\s*plan|motion\s*plan)\b/i.test(query) ? 'video_plan'
      : /\b(plan|pacing)\b/i.test(query) ? 'generation_plan'
        : /\b(intent|overview)\b/i.test(query) ? 'intent_overview' : 'scene_index';
  const candidates = cards.filter(card => card.cardKey.startsWith(prefix) && card.text);
  const ranked = candidates.map(card => ({ card, rank: !sceneKey && card.cardKey.endsWith(':selected_reference') ? 0
    : sceneKey && card.cardKey.startsWith(sceneKey) ? 0
    : card.cardKey.startsWith(`${prefix}${topic}`) ? 1 : card.cardKey === `${prefix}overview` ? 2 : 3 }))
    .filter(item => item.rank < 3).sort((a, b) => a.rank - b.rank);
  let remaining = 18000;
  return ranked.slice(0, 4).flatMap(({ card }) => {
    if (remaining <= 0) return [];
    const text = card.text.slice(0, Math.min(remaining, 12000));
    remaining -= text.length;
    return [{ ...card, text }];
  });
}

/** Each surface replaces its own contribution; higher priority owns overlapping keys. */
export class CreationMemoryComposition {
  private owners = new Map<string, { priority: number; cards: Map<string, CreationMemoryCard> }>();
  private combined = new Map<string, CreationMemoryCard>();
  update(owner: string, priority: number, cards: CreationMemoryCard[]): CreationMemoryCard[] {
    const previous = this.combined;
    this.owners.set(owner, { priority, cards: new Map(cards.map(card => [card.cardKey, card])) });
    const next = new Map<string, CreationMemoryCard>();
    [...this.owners.values()].sort((a, b) => a.priority - b.priority).forEach(contribution =>
      contribution.cards.forEach((card, key) => next.set(key, card)));
    this.combined = next;
    return [...next.values(), ...[...previous.values()].filter(card => !next.has(card.cardKey)).map(card => ({ ...card, text: '' }))];
  }
  cards(projectId: string): CreationMemoryCard[] {
    return [...this.combined.values()].filter(card => card.cardKey.startsWith(`project:${projectId}:`) && card.text);
  }
  clear(): void { this.owners.clear(); this.combined.clear(); }
}
