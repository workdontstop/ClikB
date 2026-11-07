/** Display numbering is a projection. Native scene addresses and array offsets never change here. */
export type SceneDisplaySource = {
  type: 'A' | 'B'; index: number; bIndex?: number; originalIndex: number;
  hasPreviewImage: boolean; hasHdImage: boolean; hasVideo: boolean;
};
export type SceneDisplayEntry = SceneDisplaySource & {
  slotKey: string;
  displaySceneNumber?: number;
  parentDisplaySceneNumber?: number;
  nativeSlotNumber: number;
  logicalSceneNumber: number;
  cinemaStage?: 'Stage A' | 'Stage B';
  displayRole: 'A-roll' | 'B-roll';
};
export type SceneDisplayMap = { entries: SceneDisplayEntry[]; count: number; revision: string };

export function buildSceneDisplayMap(slots: readonly SceneDisplaySource[], cinema = false): SceneDisplayMap {
  let count = 0;
  const entries: SceneDisplayEntry[] = slots.map(slot => ({
    ...slot,
    slotKey: slot.type === 'B' ? `B:${slot.index}:${slot.bIndex ?? 0}` : `A:${slot.index}`,
    ...(slot.type === 'A' || slot.hasPreviewImage || slot.hasHdImage || slot.hasVideo
      ? { displaySceneNumber: ++count } : {}),
    nativeSlotNumber: slot.index + 1,
    logicalSceneNumber: cinema ? Math.floor(slot.index / 2) + 1 : slot.index + 1,
    ...(cinema ? { cinemaStage: slot.index % 2 ? 'Stage B' as const : 'Stage A' as const } : {}),
    displayRole: slot.type === 'A' ? 'A-roll' : 'B-roll',
  }));
  const main = new Map(entries.filter(entry => entry.type === 'A').map(entry => [entry.index, entry.displaySceneNumber]));
  entries.forEach(entry => { if (entry.type === 'B') entry.parentDisplaySceneNumber = main.get(entry.index); });
  // Topology and materialization only; playback and prompt edits do not renumber cards.
  const layout = entries.map(entry => `${entry.slotKey}=${entry.displaySceneNumber ?? '-'}`).join('|');
  let hash = 2166136261;
  for (let i = 0; i < layout.length; i++) hash = Math.imul(hash ^ layout.charCodeAt(i), 16777619);
  return { entries, count, revision: `${cinema ? 'cinema' : 'main'}:${layout.length}:${(hash >>> 0).toString(16)}` };
}

export function sceneDisplayForTarget(entries: readonly SceneDisplayEntry[] | undefined,
  target: { type: 'A' | 'B'; index: number; bIndex?: number }): SceneDisplayEntry | undefined {
  return entries?.find(entry => entry.type === target.type && entry.index === target.index
    && (target.type === 'A' || (entry.bIndex ?? 0) === (target.bIndex ?? 0)));
}

export function sceneDisplayLabel(entry: SceneDisplayEntry | undefined, fallback = 'Scene'): string {
  if (!entry) return fallback;
  const number = entry.displaySceneNumber ? `Scene ${entry.displaySceneNumber}` : 'Unprepared B-roll';
  return `${number} · ${entry.displayRole}${entry.cinemaStage ? ` · ${entry.cinemaStage}` : ''}`
    + (entry.type === 'B' ? ` (for A-roll scene ${entry.parentDisplaySceneNumber ?? entry.nativeSlotNumber})` : '');
}
