import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { draftJson, stableDraftJson, type DraftSectionName } from '../server/src/creationDrafts/schema';
import type { DraftController } from './creationDrafts/store';

const videoStages = new WeakMap<DraftController, boolean>();
export const setDraftVideoStage = (controller: DraftController | undefined, active: boolean) => {
  if (controller) videoStages.set(controller, active);
};

/** Explicit creative fields only: the native setter and result consumers stay intact. */
export function usePersistedCreationState<T>(
  controller: DraftController | null | undefined,
  section: DraftSectionName,
  field: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const saved = controller?.section<Record<string, any>>(section);
    return saved && Object.prototype.hasOwnProperty.call(saved, field)
      ? saved[field] as T : typeof initial === 'function' ? (initial as () => T)() : initial;
  });
  const first = useRef(true);
  useEffect(() => {
    if (!controller || controller.getState().closed || controller.getState().hydrating) return;
    const saved = controller.section<Record<string, any>>(section);
    // A mounted stage's missing defaults do not overwrite unvisited saved data.
    if (first.current && controller.getState().postId && !Object.prototype.hasOwnProperty.call(saved || {}, field)) {
      first.current = false;
      return;
    }
    first.current = false;
    const json = draftJson(value);
    if (json === undefined || stableDraftJson(saved?.[field]) === stableDraftJson(json)) return;
    const inVideo = Boolean(videoStages.get(controller));
    const structural = ['parsedKeyPoints', 'parsedKeyPointsb', 'sceneTopologyVersion', 'aSceneTopologyVersion'].includes(field);
    controller.capture(section, { [field]: json }, { quiet: inVideo || structural });
  }, [controller, section, field, value]);
  return [value, setValue];
}

/** Capture a creative cache changed inside an awaited native result handler. */
export function captureCreationCache(controller: DraftController | undefined, section: DraftSectionName, patch: Record<string, unknown>) {
  if (!controller || controller.getState().closed || controller.getState().hydrating) return;
  const json = draftJson(patch);
  if (json && typeof json === 'object' && !Array.isArray(json)) controller.capture(section, json, {
    quiet: Boolean(controller.getState().postId && videoStages.get(controller)),
  });
}
