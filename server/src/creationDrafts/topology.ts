import type { DraftSnapshot } from './schema';

/** Native indices are visual slots (Cinema A/B are two consecutive slots). */
export function reindexDraftTargets(value: any, start: number, count: number, cinema = false, columns = false): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, item] of Object.entries(value || {})) {
    const match = columns ? /^xv(\d+)(B?)$/.exec(key) : /^([AB]):(\d+)(:\d+)?$/.exec(key);
    if (!match) { result[key] = item; continue; }
    const index = columns ? (Number(match[1]) - 1) * (cinema ? 2 : 1) + (match[2] ? 1 : 0) : Number(match[2]);
    if (index >= start && index < start + count) continue;
    const next = index >= start + count ? index - count : index;
    const nextKey = columns ? `xv${cinema ? Math.floor(next / 2) + 1 : next + 1}${cinema && next % 2 ? 'B' : ''}` : `${match[1]}:${next}${match[3] || ''}`;
    result[nextKey] = item;
  }
  return result;
}

/** Build the complete retained state before React commits deletion setters. */
export function removeDraftScenes(snapshot: DraftSnapshot, start: number, count: number, narrationIndex: number): DraftSnapshot {
  const result: DraftSnapshot = JSON.parse(JSON.stringify(snapshot));
  const prompt = result.sections.prompt || {}, studio = result.sections.storybook || {}, editor = result.sections.editor || {};
  const raw = (value: any) => Array.isArray(value) ? value.filter((_: any, index: number) => index < start || index >= start + count) : value;
  const narration = (value: any) => Array.isArray(value) ? value.filter((_: any, index: number) => index !== narrationIndex) : value;
  for (const key of ['parsedKeyPoints','parsedKeyPointsb','parsedKeyPointsx','ImagesHdCloud','generatedImagesFluxx','nanoImages','drawFrameData',
    'autoDrawGuideData','autoDrawGuideModes','bShotImages','bShotVideos','bShotPrompts','bShotTextVideo','bShotNanoImages','bShotDrawFrameData','bShotAutoDrawGuideData','bShotAutoDrawGuideModes']) {
    if (key in prompt) prompt[key] = raw(prompt[key]);
  }
  for (const key of ['parsedKeyPoints2','generatedAudios','generatedAudioTexts']) if (key in prompt) prompt[key] = narration(prompt[key]);
  for (const key of ['GeneratedText','GeneratedTextx','TextVideo','VideoArray','VideoArrayCloud','savedSceneImages','defaultVideoStartFrames','clipDurations',
    'noImagePrompt','sceneActiveCharacters','sceneActiveCharactersVideo','intentSceneBindings','lipSyncAudioUrls','lipSyncActiveList','lipSyncInstructions',
    'lipSyncInstructionMeta','lipSyncPromptBackup','bShotNoImagePrompt','bShotSceneActiveCharacters','bShotSceneActiveCharactersVideo']) {
    if (key in studio) studio[key] = raw(studio[key]);
  }
  if (Array.isArray(studio.intentSceneBindings)) studio.intentSceneBindings = studio.intentSceneBindings.map((item: any, orderIndex: number) => ({ ...item, orderIndex }));
  if ('generatedAudiosCloud' in studio) studio.generatedAudiosCloud = narration(studio.generatedAudiosCloud);
  for (const key of ['videoHistory','imageReceipts','audioReferences']) if (key in studio) studio[key] = reindexDraftTargets(studio[key], start, count);
  if ('savedVideoUpscales' in studio) studio.savedVideoUpscales = reindexDraftTargets(studio.savedVideoUpscales, start, count, snapshot.creationType === 1, true);
  studio.sceneTopologyVersion = Number(studio.sceneTopologyVersion || 0) + 1;
  studio.aSceneTopologyVersion = Number(studio.aSceneTopologyVersion || 0) + 1;
  for (const key of ['vidGenCaches','actionImagesMap','activeActionImagesMap','motionImagesMap','activeMotionImagesMap','selectedPromptsMap',
    'selectedFinalsMap','resultHistory','resultImagePrompt','resultIntent','firstFrameModeChoices']) if (key in editor) editor[key] = reindexDraftTargets(editor[key], start, count);
  if ('restoredVideoUpscales' in editor) editor.restoredVideoUpscales = reindexDraftTargets(editor.restoredVideoUpscales, start, count, snapshot.creationType === 1, true);
  if (editor.promptDrafts && typeof editor.promptDrafts === 'object' && !Array.isArray(editor.promptDrafts)) {
    const drafts: any = editor.promptDrafts;
    for (const key of ['image','video']) drafts[key] = reindexDraftTargets(drafts[key], start, count);
    for (const key of ['dirtyImage','dirtyVideo']) drafts[key] = Object.keys(reindexDraftTargets(Object.fromEntries((drafts[key] || []).map((item: string) => [item, true])), start, count));
    drafts.nativeTopology = JSON.stringify(Array.from({ length: (prompt.parsedKeyPoints as any[])?.length || 0 }, (_, index) => index));
  }
  editor.dialogueCache = {};
  editor.remappedASceneTopologyVersion = studio.aSceneTopologyVersion;
  result.sections = { ...result.sections, prompt, storybook: studio, editor };
  return result;
}
