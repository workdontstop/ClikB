let activeActionId: string | null = null;
let activeScrollAreaId: string | null = null;

export const setExecutingNavigationAction = (actionId: string | null) => { activeActionId = actionId; };
export const getExecutingNavigationAction = () => activeActionId;
export const setExecutingNavigationScroll = (areaId: string | null) => { activeScrollAreaId = areaId; };
export const getExecutingNavigationScroll = () => activeScrollAreaId;
export const navigationScrollActorFor = (areaId?: string): 'unknown' | 'ai' =>
  activeScrollAreaId && areaId === activeScrollAreaId ? 'ai' : 'unknown';
export const navigationActorFor = (controlId?: string): 'manual' | 'ai' =>
  activeActionId && controlId && activeActionId.replace('.action.', '.control.') === controlId ? 'ai' : 'manual';
