import { createHash } from 'node:crypto';
import { CONVERSATION_PROFILES, VISIBLE_CONVERSATION_TIERS } from './conversationModels';
import { LANGUAGE_MODEL_TIERS } from './languageModels';
import { conciergeSurfaceLayers } from './ConciergeSnapshotBroker';

/** Select existing operational knowledge without executing or rewriting an uploaded packet. */
export type ConciergeKnowledgePacket = { ragId: string; title: string; instructions: string };
export type ConciergeKnowledgeSelection = {
  instructions: string;
  selectedSections: string[];
  fallback: boolean;
};

type Entry = { key: string; node: PacketNode };
type PacketNode = { kind: 'object' | 'array' | 'string' | 'scalar'; raw: string; text?: string; entries?: Entry[]; items?: PacketNode[] };

/** Packets use object/array/string literals with a descriptive prefix, not executable JS. */
const parsePacket = (source: string): PacketNode => {
  let offset = source.indexOf('{');
  if (offset < 0) throw new Error('Missing packet object');
  const whitespace = () => {
    while (offset < source.length) {
      if (/\s/.test(source[offset])) { offset++; continue; }
      if (source.startsWith('//', offset)) {
        const end = source.indexOf('\n', offset + 2);
        offset = end < 0 ? source.length : end + 1;
        continue;
      }
      if (source.startsWith('/*', offset)) {
        const end = source.indexOf('*/', offset + 2);
        if (end < 0) throw new Error('Unclosed packet comment');
        offset = end + 2;
        continue;
      }
      break;
    }
  };
  const string = (): PacketNode => {
    const start = offset;
    const quote = source[offset++];
    let text = '';
    while (offset < source.length) {
      const current = source[offset++];
      if (current === quote) return { kind: 'string', raw: source.slice(start, offset), text };
      if (current === '\\') {
        if (offset >= source.length) break;
        const escaped = source[offset++];
        text += escaped === 'n' ? '\n' : escaped === 'r' ? '\r' : escaped === 't' ? '\t' : escaped;
      } else {
        if (quote === '`' && current === '$' && source[offset] === '{') throw new Error('Executable template expression');
        text += current;
      }
    }
    throw new Error('Unclosed packet string');
  };
  const value = (depth: number): PacketNode => {
    if (depth > 40) throw new Error('Unsupported packet nesting');
    whitespace();
    const start = offset;
    const current = source[offset];
    if (current === '"' || current === "'" || current === '`') return string();
    if (current === '{') {
      offset++;
      const entries: Entry[] = [];
      whitespace();
      while (source[offset] !== '}') {
        if (offset >= source.length) throw new Error('Unclosed packet object');
        const quotedKey = source[offset] === '"' || source[offset] === "'";
        const key = quotedKey ? string().text!
          : source.slice(offset).match(/^[A-Za-z_$][A-Za-z0-9_$]*/)?.[0];
        if (!key) throw new Error('Unsupported packet key');
        if (!quotedKey) offset += key.length;
        whitespace();
        if (source[offset++] !== ':') throw new Error('Unsupported packet property');
        if (entries.some(entry => entry.key === key)) throw new Error('Duplicate packet property');
        entries.push({ key, node: value(depth + 1) });
        whitespace();
        if (source[offset] === ',') { offset++; whitespace(); }
        else if (source[offset] !== '}') throw new Error('Unsupported packet object separator');
      }
      offset++;
      return { kind: 'object', entries, raw: source.slice(start, offset) };
    }
    if (current === '[') {
      offset++;
      const items: PacketNode[] = [];
      whitespace();
      while (source[offset] !== ']') {
        if (offset >= source.length) throw new Error('Unclosed packet array');
        items.push(value(depth + 1));
        whitespace();
        if (source[offset] === ',') { offset++; whitespace(); }
        else if (source[offset] !== ']') throw new Error('Unsupported packet array separator');
      }
      offset++;
      return { kind: 'array', items, raw: source.slice(start, offset) };
    }
    const scalar = source.slice(offset).match(/^(?:true|false|null|-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(?=\s|,|\]|\})/);
    if (!scalar) throw new Error('Unsupported packet expression');
    offset += scalar[0].length;
    return { kind: 'scalar', raw: source.slice(start, offset) };
  };
  const result = value(0);
  whitespace();
  if (source[offset] === ';') { offset++; whitespace(); }
  if (offset !== source.length) throw new Error('Unsupported trailing packet text');
  return result;
};

const parsedPacketCache = new Map<string, PacketNode>();
const getParsedPacket = (ragId: string, source: string): PacketNode => {
  const hash = createHash('sha256').update(source).digest('hex');
  const cacheKey = `${ragId}:${hash}`;
  const cached = parsedPacketCache.get(cacheKey);
  if (cached) return cached;
  const parsed = parsePacket(source);
  if (parsedPacketCache.size >= 16) {
    const oldest = parsedPacketCache.keys().next().value;
    if (oldest) parsedPacketCache.delete(oldest);
  }
  parsedPacketCache.set(cacheKey, parsed);
  return parsed;
};

const property = (node: PacketNode, key: string): PacketNode | undefined => node.entries?.find(entry => entry.key === key)?.node;
const identifier = (key: string): string => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
const objectText = (entries: Entry[]): string => `{\n${entries.map(entry => `  ${identifier(entry.key)}: ${entry.node.raw}`).join(',\n')}\n}`;
const selectedObject = (node: PacketNode, keep: (key: string) => boolean): PacketNode => {
  if (node.kind !== 'object') throw new Error('Unsupported packet section object');
  return { ...node, raw: objectText((node.entries || []).filter(entry => keep(entry.key))) };
};
const selectedArray = (node: PacketNode, keep: (item: PacketNode) => boolean): PacketNode => {
  if (node.kind !== 'array') throw new Error('Unsupported packet section array');
  return { ...node, raw: `[\n${(node.items || []).filter(keep).map(item => `    ${item.raw}`).join(',\n')}\n  ]` };
};

/** Descriptive Creation knowledge for image writing, without Concierge control contracts. */
export const selectImagePacerWorkflowKnowledge = (packet: ConciergeKnowledgePacket): ConciergeKnowledgeSelection => {
  if (packet.ragId !== 'clikb_creation') return { instructions: '', selectedSections: [], fallback: true };
  try {
    const parsed = parsePacket(packet.instructions.replace(/\r\n/g, '\n'));
    if (parsed.kind !== 'object') throw new Error('Expected Creation packet object');
    const sections = ['modeOverview', 'visualHierarchy', 'modeSemantics', 'imagePromptPacing'];
    const selected: Entry[] = [];
    for (const key of sections) {
      let node = property(parsed, key);
      if (!node) continue;
      if (key === 'modeOverview') {
        if (node.kind !== 'string') throw new Error('Expected descriptive mode overview');
        // The operational packet also contains a paragraph directing Concierge
        // function execution. Keep complete descriptive paragraphs only.
        const text = (node.text || '').split(/\r?\n\s*\r?\n/)
          .filter(paragraph => !/virtualGate|userSnapshot\.|\bConcierge\b|\bJev\b|\brequires_video\b|\bactionId\b|\bscrollId\b/.test(paragraph))
          .join('\n\n').trim();
        node = { kind: 'string', raw: JSON.stringify(text), text };
      }
      selected.push({ key, node });
    }
    return { instructions: objectText(selected), selectedSections: selected.map(entry => entry.key), fallback: selected.length !== sections.length };
  } catch {
    // Never fall back to the entire operational packet for this writing role.
    return { instructions: '', selectedSections: [], fallback: true };
  }
};

const creationAreas = (snapshot: any): string[] =>
  snapshot?.ui?.minimisePrompt === true || snapshot?.creation?.isActive === false
    ? []
    : Object.keys(snapshot?.creation?.controls?.areas || {}).map(id => id.replace(/^clikb\.creation\./, ''));
const liveAreaIds = (snapshot: any): string[] => [...new Set<string>([
  ...(snapshot?.navigation?.activeAreaIds || []), ...(snapshot?.feeds?.activeAreaIds || []),
  ...conciergeSurfaceLayers(snapshot).areaIds,
])];

/** These are packet cross-references, not permissions or a whitelist of user requests. */
const CREATION_SECTION_DEPENDENCIES: Record<string, string[]> = {
  welcome: ['setup', 'confirmation', 'notepad'],
  setup: ['notepad', 'confirmation', 'models', 'styles', 'upload'],
  styles: ['style_list', 'music'],
  models: ['conversation_model'],
  upload: ['worlds', 'world_detail', 'direct_upload'],
  preview_choice: ['intent_view', 'character_entry', 'storybook_start'],
  storybook_grid: ['storybook_start', 'storybook_studio_selector', 'storybook_publish', 'storybook_bshot_warning'],
  storybook_studio_selector: ['storybook_grid', 'storybook_publish'],
  workstation_image: ['safety_conditioning'],
  workstation_video: ['workstation_video_guides', 'workstation_video_guide_advice', 'workstation_video_references',
    'workstation_video_characters', 'workstation_video_models', 'workstation_video_generate_sequence', 'workstation_planning_model', 'workstation_draw_director', 'safety_conditioning'],
  workstation_video_context: ['workstation_video_frame_history', 'workstation_draw_director', 'workstation_planning_model'],
  workstation_action_image: ['workstation_video_references'],
  workstation_storyboard_image: ['workstation_video_references'],
  workstation_action_image_viewer: ['workstation_video_references', 'workstation_video_frame_history'],
  workstation_visual_guide: ['workstation_video_guides'],
  workstation_motion_guide: ['workstation_video_guides', 'workstation_planning_model'],
  workstation_gpu_time: ['workstation_gpu'],
  storybook_voice_picker: ['music'],
  character_studio: ['character_entry'],
  reference_editor: ['notepad'],
};

const applicableCreationKeys = (snapshot: any): Set<string> => {
  const areas = creationAreas(snapshot);
  return new Set(['video_permission', ...areas, ...areas.flatMap(area => CREATION_SECTION_DEPENDENCIES[area] || [])]);
};
const relatedCreationKey = (key: string, keys: Set<string>): boolean => [...keys]
  .some(area => key === area || key.startsWith(`${area}_`) || area.startsWith(`${key}_`));

const creationMode = (snapshot: any): 'shorts' | 'cinema' | 'games' | null => {
  const mode = String(snapshot?.creation?.mode || '').toLowerCase();
  if (mode === 'shorts' || mode === 'memes') return 'shorts';
  if (mode === 'cinema' || mode === 'story') return 'cinema';
  if (mode === 'games' || mode === 'interactions') return 'games';
  return null;
};

const selectCreation = (packet: PacketNode, snapshot: any, add: (key: string, node?: PacketNode) => void) => {
  const keys = applicableCreationKeys(snapshot);
  const mode = creationMode(snapshot);
  const descriptions = property(packet, 'areas');
  if (!descriptions?.entries) throw new Error('Missing Creation area descriptions');
  for (const area of creationAreas(snapshot)) {
    const ownerKeys = new Set([area, ...(CREATION_SECTION_DEPENDENCIES[area] || [])]);
    if (!descriptions.entries.some(entry => relatedCreationKey(entry.key, ownerKeys))) {
      throw new Error('Unsupported Creation area section');
    }
  }
  // The existing cross-stage journey stays available from the start; detailed UI maps follow the current owner.
  for (const key of ['topic', 'mappedControlAudit', 'runtimeControlIndicators', 'globalControlRefs', 'modeOverview', 'overview', 'imagePromptPacing', 'currentStateRule']) add(key);
  const semantics = property(packet, 'modeSemantics');
  if (semantics) add('modeSemantics', selectedObject(semantics, key => !mode
    || !['aliases', 'shorts', 'cinema', 'cinemaMusicVideo', 'backgroundMusic', 'games'].includes(key) || key === 'aliases' || key === mode
    || (mode === 'cinema' && (key === 'cinemaMusicVideo' || key === 'backgroundMusic'))));
  const finish = property(packet, 'finishPipeline');
  if (finish) add('finishPipeline', selectedObject(finish, key => !mode
    || !['source', 'commonRender', 'shorts', 'cinemaNarrated', 'cinemaWithoutNarration', 'cinemaMusicVideo', 'spatial', 'hotspots', 'postFinish'].includes(key)
    || key === 'source' || key === 'postFinish'
    || (mode === 'shorts' && (key === 'shorts' || key === 'commonRender'))
    || (mode === 'cinema' && ['commonRender', 'cinemaNarrated', 'cinemaWithoutNarration', 'cinemaMusicVideo'].includes(key))
    || (mode === 'games' && (key === 'spatial' || key === 'hotspots'))));
  for (const key of ['controlKeys', 'areas']) {
    const map = property(packet, key);
    if (map) add(key, selectedObject(map, entry => relatedCreationKey(entry, keys)));
  }
};

const controlTexts = (snapshot: any): string[] => {
  const controls = [
    ...(snapshot?.navigation?.visibleControls || []), ...(snapshot?.navigation?.availableActions || []),
    ...(snapshot?.feeds?.visibleControls || []), ...(snapshot?.feeds?.availableActions || []),
  ];
  const ids = controls.filter(control => control?.enabled !== false)
    .flatMap(control => [control?.controlId, control?.candidateActionId, control?.actionId])
    .filter((id): id is string => typeof id === 'string' && id.startsWith('clikb.'));
  for (const [areaId, area] of Object.entries(snapshot?.navigation?.areas || {}) as Array<[string, any]>) {
    for (const [key, viewport] of Object.entries(area?.scrolls || {}) as Array<[string, any]>) {
      if (viewport?.canScrollForward || viewport?.canScrollBackward) ids.push(`${areaId}:${key}`);
    }
  }
  return [...new Set(ids.flatMap(id => [id, id.replace('.action.', '.control.')]))];
};

const creationForeground = (snapshot: any): boolean => conciergeSurfaceLayers(snapshot).mode === 'creation_workstation';

/** Some source paragraphs intentionally document several IDs under their first ID. */
const groupedKnowledgeIds = (ids: string[]): string[] => [...new Set(ids.flatMap(id => [id,
  ...(/clikb\.feeds\.fullscreen\..+\.(?:like_post|open_likes|open_likes_count|cancel_delete|close_deleted)$/.test(id)
    ? [id.replace(/\.[^.]+$/, '.open_plan')] : []),
  ...(/clikb\.feeds\.fullscreen\..+\.(?:collapse_caption|creator_profile)$/.test(id)
    ? [id.replace(/\.[^.]+$/, '.expand_caption')] : []),
  ...(id === 'clikb.feeds.deck.control.cycle_prev' ? ['clikb.feeds.deck.control.cycle_next'] : []),
  ...(/^clikb\.feeds\.deck\.control\.(?:run_search|select_search_section|search_section\..+)$/.test(id)
    ? ['clikb.feeds.deck.control.search_text'] : []),
  ...(/^clikb\.feeds\.search_keywords\.keyword_/.test(id) ? ['clikb.feeds.search_keywords.home'] : []),
]))];

/** Match source ID templates against exact live identities; all matching prose remains whole. */
const idPatternMatches = (pattern: string, id: string): boolean => {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/<[^>]+>/g, '[A-Za-z0-9_.:%+\\-]+');
  return new RegExp(`^${escaped}(?:$|[.:_])`, 'i').test(id);
};
const mentionsLiveOwner = (text: string, areas: string[], controls: string[]): boolean => {
  const patterns = (text.match(/clikb\.(?:[A-Za-z0-9_.:%+\-]|<[^>]+>)+/g) || []).map(pattern => pattern.replace(/\.+$/, ''));
  return patterns.some(pattern => [...controls, ...areas].some(id => idPatternMatches(pattern, id)));
};

const selectNavigation = (packet: PacketNode, snapshot: any, add: (key: string, node?: PacketNode) => void) => {
  const controls = groupedKnowledgeIds(controlTexts(snapshot).filter(id => !id.startsWith('clikb.feeds.')));
  const background = creationForeground(snapshot);
  add('topic');
  add('mappedControlAudit');
  add('contract');
  if (controls.some(id => id.includes('social_chat') || id.endsWith('.action.chat')) ||
    liveAreaIds(snapshot).includes('clikb.navigation.social_chat')) {
    add('socialChat');
    add('socialControlBoundaries');
    add('signupNotifications');
    const chatActions = property(packet, 'socialChatActions');
    if (chatActions) add('socialChatActions', selectedArray(chatActions, item => mentionsLiveOwner(item.text || '', [], controls)));
  }
  if (liveAreaIds(snapshot).includes('clikb.navigation.profile_image') ||
    controls.some(id => /clikb\.profile_header\.(?:action|control)\.change_(?:avatar|banner)$/.test(id))) {
    add('profileImageLauncher');
    const imageActions = property(packet, 'profileImageActions');
    if (imageActions) add('profileImageActions', selectedArray(imageActions, item => mentionsLiveOwner(item.text || '', liveAreaIds(snapshot), controls)));
  }
  if (liveAreaIds(snapshot).some(id => id === 'clikb.profile_header' || id === 'clikb.settings' || id.includes('creative_profiles'))) {
    add('creativeProfiles');
    add('creativeProfileAvailability');
    const profileActions = property(packet, 'creativeProfileActions');
    if (profileActions) add('creativeProfileActions', selectedArray(profileActions, item => mentionsLiveOwner(item.text || '', [], controls)));
  }
  for (const key of ['menuControls', 'compactControls', 'profileHeader', 'relationshipOverlay', 'settingsControls']) {
    const node = property(packet, key);
    if (!node) continue;
    const relevant = (node.items || []).some(item => mentionsLiveOwner(item.text || '', [], controls));
    if (relevant) add(key, selectedArray(node, item => !/clikb\./.test(item.text || '') || mentionsLiveOwner(item.text || '', [], controls)));
  }
  const rules = property(packet, 'liveStateRules');
  if (rules) add('liveStateRules', selectedArray(rules, item => (!background && !/clikb\./.test(item.text || '')) || mentionsLiveOwner(item.text || '', [], controls)));
  const actionIds = property(packet, 'virtualGateActionIds');
  if (actionIds) add('virtualGateActionIds', selectedArray(actionIds, item => (!background && !/clikb\./.test(item.text || '')) || mentionsLiveOwner(item.text || '', [], controls)));
  // Current profile facts are supplied once from server configuration, not an older uploaded description.
};

const selectFeeds = (packet: PacketNode, snapshot: any, add: (key: string, node?: PacketNode) => void, deck: boolean) => {
  const areas = liveAreaIds(snapshot).filter(id => id.startsWith('clikb.feeds.') && (deck ? id === 'clikb.feeds.deck' : id !== 'clikb.feeds.deck'));
  const controls = groupedKnowledgeIds(controlTexts(snapshot).filter(id => id.startsWith('clikb.feeds.') && (deck ? id.startsWith('clikb.feeds.deck.') : !id.startsWith('clikb.feeds.deck.'))));
  const background = creationForeground(snapshot);
  add('topic');
  if (background && !controls.length) return;
  add('mappedControlAudit');
  if (!deck && controls.some(id => id.endsWith('.open_post_chat'))) add('socialPostNavigation');
  // Keep existing journey and return semantics; diagrams and full data catalogues are separately retrievable.
  if (!background) add('modeOverview');
  for (const key of ['dataDictionary', 'stateDictionary', 'virtualGateActionIds', 'controls', 'flows', 'boundaries']) {
    const node = property(packet, key);
    if (node) add(key, selectedArray(node, item => (!background && !/clikb\./.test(item.text || ''))
      || mentionsLiveOwner(item.text || '', key === 'controls' ? [] : areas, controls)));
  }
};

/** Return source sections, never a rewritten summary or a character-truncated instruction. */
export const selectConciergePacketKnowledge = (packet: ConciergeKnowledgePacket, snapshot: any): ConciergeKnowledgeSelection => {
  try {
    const parsed = getParsedPacket(packet.ragId, packet.instructions);
    if (parsed.kind !== 'object') throw new Error('Expected packet object');
    const selected: Entry[] = [];
    const add = (key: string, replacement?: PacketNode) => {
      const node = replacement || property(parsed, key);
      if (node && !selected.some(entry => entry.key === key)) selected.push({ key, node });
    };
    if (packet.ragId === 'clikb_creation') selectCreation(parsed, snapshot, add);
    else if (packet.ragId === 'clikb_navigation_shell') selectNavigation(parsed, snapshot, add);
    else if (packet.ragId === 'clikb_feeds' || packet.ragId === 'clikb_deck') selectFeeds(parsed, snapshot, add, packet.ragId === 'clikb_deck');
    else return { instructions: packet.instructions, selectedSections: ['*'], fallback: false };
    const knownSections = new Set(['topic', 'mappedControlAudit', 'runtimeControlIndicators', 'metadata', 'surfaceId', 'surfaceTitle',
      'ragDocId', 'schemaVersion', 'controlExecutionContract', 'globalControlRefs', 'modeOverview', 'visualHierarchy', 'overview',
      'modeSemantics', 'imagePromptPacing', 'finishPipeline', 'controlKeys', 'areas', 'currentStateRule', 'contract', 'virtualGateActionIds',
      'menuControls', 'compactControls', 'profileHeader', 'relationshipOverlay', 'settingsControls', 'liveStateRules',
      'currentConversationProfiles', 'dataDictionary', 'stateDictionary', 'controls', 'flows', 'boundaries',
      'socialChat', 'socialChatActions', 'socialControlBoundaries', 'signupNotifications', 'socialPostNavigation',
      'creativeProfiles', 'creativeProfileActions', 'creativeProfileAvailability', 'profileImageLauncher', 'profileImageActions']);
    // A later uploaded section is preserved rather than silently becoming unavailable.
    for (const entry of parsed.entries || []) if (!knownSections.has(entry.key)) add(entry.key);
    if (!selected.length) throw new Error('Packet has no recognized knowledge sections');
    return { instructions: objectText(selected), selectedSections: selected.map(entry => entry.key), fallback: false };
  } catch {
    // Older/custom packets retain all their meanings until their structure is supported.
    return { instructions: `PACKET_SECTION_SELECTION: full original packet retained because its structure was not recognized.\n${packet.instructions}`,
      selectedSections: ['*'], fallback: true };
  }
};

/** Existing semantic retrieval can find offscreen knowledge without a user-verb routing gate. */
export const buildConciergeKnowledgeQuery = (query: string, snapshot: any, userGoal?: string): string => [
  userGoal && userGoal !== query ? `Active user goal: ${userGoal}` : '',
  query,
  `Current ClikB mode: ${String(snapshot?.creation?.mode || snapshot?.feeds?.route || snapshot?.navigation?.route || 'unknown')}`,
  `Current component areas: ${liveAreaIds(snapshot).join(', ')}`,
].filter(Boolean).join('\n');

/** Shared current facts also cover old profile descriptions returned by semantic retrieval. */
export const conciergeWorkflowFacts = (query: string): string | undefined =>
  /\b(publish|publishing|stitch|assembl\w*|ffmpeg|final\s+(?:video|mp4|review|render))\b/i.test(query)
    ? 'Current ordinary Shorts/Cinema workflow (Storybook.startLambdaFfmpegPublish, PublishLoader2, advanced_ffmpeg_lambda.renderFullRecipe): the storyboard Publish button opens final review only. Processing from that review uses FFmpeg to assemble images, videos or mixed scene media with configured narration/music into the final MP4. The Videos grid contains source clips; it has not already stitched that final video. Opening review, rendering and final saving/publication are distinct actions with their existing consent checks. Games/spatial use their separate workflow. Images-only source media needs no generated motion videos.'
    : undefined;

export const conciergeConversationProfileFacts = (): string => {
  const names: Record<string, string> = { luna_none: 'Luna · None', luna: 'Luna · Low', luna_xhigh: 'Luna · Medium', terra: 'Terra · Low', sol_low: 'Sol · Low', luna_max: 'Luna · Max', sol: 'Sol', deepseek: 'DeepSeek', kimi: 'Kimi' };
  return `CURRENT CONVERSATION MODEL CONFIGURATION (server-owned current facts, newer than uploaded model descriptions):\n${JSON.stringify({
    defaultPreferenceId: 'luna',
    profiles: VISIBLE_CONVERSATION_TIERS.map(preferenceId => ({ preferenceId, name: names[preferenceId], ...CONVERSATION_PROFILES[preferenceId] })),
    creationAiModels: [
      { id: 'luna', name: 'Luna', model: LANGUAGE_MODEL_TIERS.luna.model, reasoningEffort: 'low', pixels: LANGUAGE_MODEL_TIERS.luna.pixels },
      { id: 'luna_extra', name: 'Luna Extra', model: LANGUAGE_MODEL_TIERS.luna_extra.model, reasoningEffort: 'high', pixels: LANGUAGE_MODEL_TIERS.luna_extra.pixels },
      { id: 'terra', name: 'Terra', model: LANGUAGE_MODEL_TIERS.terra.model, reasoningEffort: 'high', pixels: LANGUAGE_MODEL_TIERS.terra.pixels },
      { id: 'sol', name: 'Sol', model: LANGUAGE_MODEL_TIERS.sol.model, reasoningEffort: 'high', pixels: LANGUAGE_MODEL_TIERS.sol.pixels },
      { id: 'deepseek', name: 'DeepSeek', model: LANGUAGE_MODEL_TIERS.deepseek.model, reasoningEffort: 'none', pixels: LANGUAGE_MODEL_TIERS.deepseek.pixels },
      { id: 'kimi', name: 'Kimi', model: LANGUAGE_MODEL_TIERS.kimi.model, reasoningEffort: 'low', pixels: LANGUAGE_MODEL_TIERS.kimi.pixels },
    ],
    threeJsPlanningModels: [
      { id: 'luna', name: 'Luna · Low', model: 'gpt-6-luna', reasoningEffort: 'low', billingMode: 'metered' },
      { id: 'terra', name: 'Terra · Low', model: 'gpt-6.1-terra', reasoningEffort: 'low', billingMode: 'metered' },
      { id: 'sol', name: 'Sol · Low', model: 'gpt-6.1-sol', reasoningEffort: 'low', billingMode: 'metered' },
      { id: 'deepseek', name: 'DeepSeek · Low', model: 'deepseek-ai/deepseek-v3.1', reasoningEffort: 'none', billingMode: 'metered' },
      { id: 'kimi', name: 'Kimi · Low', model: 'moonshotai/kimi-k2.6', reasoningEffort: 'low', billingMode: 'metered' },
    ],
  })}`;
};

const goalReferencedCreationAreas = (text: string): string[] => {
  const lower = String(text || '').toLowerCase();
  const extra: string[] = [];
  if (/\b(model|luna|terra|sol|price|cost|pixel)\b/.test(lower)) extra.push('models', 'conversation_model', 'workstation_planning_model');
  if (/\b(style|art\s*style|music|song|voice|narration)\b/.test(lower)) extra.push('styles', 'music', 'storybook_voice_picker');
  if (/\b(character|cast|reference|wardrobe|vip)\b/.test(lower)) extra.push('character_entry', 'character_studio', 'reference_editor');
  if (/\bworlds?\b/.test(lower)) extra.push('upload', 'worlds', 'world_detail', 'storybook_grid', 'storybook_world_entry', 'storybook_world');
  if (/\bupload\b/.test(lower)) extra.push('upload', 'worlds', 'world_detail', 'direct_upload');
  if (/\b(publish|finish|export|render)\b/.test(lower)) extra.push('storybook_grid', 'storybook_publish', 'storybook_studio_selector');
  if (/\b(grid|storyboard)\b/.test(lower)) extra.push('storybook_grid', 'storybook_start');
  if (/\b(motion|three\.?js|spatial|camera|blockout|guide)\b/.test(lower)) extra.push('workstation_video', 'workstation_motion_guide', 'workstation_planning_model', 'workstation_video_guides');
  if (/\b(seedance|pixverse|minimax|grok|omni|fal|video\s*model)\b/.test(lower)) extra.push('workstation_video', 'workstation_video_models');
  if (/\b(gpu|ltx)\b/.test(lower)) extra.push('workstation_video', 'workstation_gpu');
  return extra;
};

const compactRelatedCreationKey = (key: string, keys: Set<string>): boolean => {
  if (keys.has(key)) return true;
  if (keys.has('storybook_grid') && key.startsWith('storybook_grid_')) return true;
  if (keys.has('workstation_video') && key === 'workstation_video_generate_sequence') return true;
  return false;
};

export const selectCompactConciergePacketKnowledge = (
  packet: ConciergeKnowledgePacket,
  snapshot: any,
  options: { query?: string; userGoal?: string } | string = {},
): ConciergeKnowledgeSelection => {
  try {
    const parsed = getParsedPacket(packet.ragId, packet.instructions);
    if (parsed.kind !== 'object') throw new Error('Expected packet object');
    const opts = typeof options === 'string' ? { userGoal: options } : (options || {});
    const combinedGoal = `${opts.userGoal || ''}\n${opts.query || ''}`.trim();
    const foregroundCreation = creationForeground(snapshot);
    const manuallyMinimisedCreation = snapshot?.creation?.minimizeMode === 1 || snapshot?.creation?.minimizeMode === 2;
    const mentionsNav = /\b(setting|settings|theme|dark|light|accent|color|colour|profiles?|chat|rooms?|notifications?|follow|follower|following|menu|sidebar|logout|privacy|install|conversation\s*model|voice|pill|guide|concierge|shortcuts?|deck|games|shorts|cinema|clikit|kickit|images|grid|my\s*page|pages|create|popup|composer|close|back|switch|navigate)\b/i.test(combinedGoal);
    const mentionsFeeds = /\b(feed|feeds|deck|search|post|posts|chat|browse|watch|discover|home|like|comment|share|games|shorts|cinema|clikit|kickit|images|grid|my\s*page|pages|backdrop)\b/i.test(combinedGoal);

    if (packet.ragId === 'clikb_navigation_shell' && foregroundCreation && !manuallyMinimisedCreation && !mentionsNav) {
      const topic = property(parsed, 'topic');
      const directory = 'Navigation shell (menu, sidebar, profile, Settings, theme/accent, and conversation model picker) is available in background; query or navigate if the user requests a navigation or Settings action.';
      return {
        instructions: objectText([
          ...(topic ? [{ key: 'topic', node: topic }] : []),
          { key: 'backgroundDirectory', node: { kind: 'string', raw: JSON.stringify(directory), text: directory } },
        ]),
        selectedSections: ['topic', 'backgroundDirectory'],
        fallback: false,
      };
    }

    if ((packet.ragId === 'clikb_feeds' || packet.ragId === 'clikb_deck') && foregroundCreation && !mentionsFeeds) {
      const topic = property(parsed, 'topic');
      const directory = `${packet.ragId === 'clikb_deck' ? 'Deck' : 'Feeds'} browsing and search controls remain available when exiting Creation or interacting with the backdrop.`;
      return {
        instructions: objectText([
          ...(topic ? [{ key: 'topic', node: topic }] : []),
          { key: 'backgroundDirectory', node: { kind: 'string', raw: JSON.stringify(directory), text: directory } },
        ]),
        selectedSections: ['topic', 'backgroundDirectory'],
        fallback: false,
      };
    }

    if (packet.ragId !== 'clikb_creation') {
      return selectConciergePacketKnowledge(packet, snapshot);
    }

    const selected: Entry[] = [];
    const add = (key: string, replacement?: PacketNode) => {
      const node = replacement || property(parsed, key);
      if (node && !selected.some(entry => entry.key === key)) selected.push({ key, node });
    };

    const mountedAreas = creationAreas(snapshot);
    const workstationOpen = snapshot?.creation?.editStoryIsOpen === true
      && mountedAreas.some(a => a.startsWith('workstation_'));
    const primaryMountedAreas = workstationOpen
      ? mountedAreas.filter(a => !a.startsWith('storybook_'))
      : mountedAreas;
    const directQuery = String(opts.query || '').trim();
    const isOffscreenQuestion = /\b(how|what|where|which|why|explain|tell me)\b|\?/i.test(directQuery || combinedGoal);
    const goalAreas = primaryMountedAreas.length === 0
      ? goalReferencedCreationAreas(combinedGoal)
      : isOffscreenQuestion
        ? goalReferencedCreationAreas(directQuery || combinedGoal)
        : [];
    const activeKeys = new Set<string>([
      'video_permission',
      ...primaryMountedAreas,
      ...primaryMountedAreas.flatMap(area => (CREATION_SECTION_DEPENDENCIES[area] || []).slice(0, 1)),
      ...goalAreas,
    ]);
    const mode = creationMode(snapshot);

    for (const key of ['topic', 'currentStateRule']) add(key);
    if (/\b(pacer|pacing|image prompt pacer|visual hierarchy)\b/i.test(directQuery || (isOffscreenQuestion ? combinedGoal : ''))) {
      add('imagePromptPacing');
    }
    const semantics = property(parsed, 'modeSemantics');
    if (semantics && (primaryMountedAreas.some(a => a === 'welcome' || a === 'setup' || a === 'confirmation' || a === 'storybook_publish') || isOffscreenQuestion)) {
      add('modeSemantics', selectedObject(semantics, key => !mode
        || !['aliases', 'shorts', 'cinema', 'cinemaMusicVideo', 'backgroundMusic', 'games'].includes(key) || key === 'aliases' || key === mode
        || (mode === 'cinema' && (key === 'cinemaMusicVideo' || key === 'backgroundMusic'))));
    }
    const finish = property(parsed, 'finishPipeline');
    if (finish && (primaryMountedAreas.some(a => a === 'storybook_publish' || a === 'storybook_studio_selector' || a === 'post_finish')
        || (isOffscreenQuestion && /\b(publish|finish|export|render)\b/i.test(directQuery || combinedGoal)))) {
      add('finishPipeline', selectedObject(finish, key => !mode
        || !['source', 'commonRender', 'shorts', 'cinemaNarrated', 'cinemaWithoutNarration', 'cinemaMusicVideo', 'spatial', 'hotspots', 'postFinish'].includes(key)
        || key === 'source' || key === 'postFinish'
        || (mode === 'shorts' && (key === 'shorts' || key === 'commonRender'))
        || (mode === 'cinema' && ['commonRender', 'cinemaNarrated', 'cinemaWithoutNarration', 'cinemaMusicVideo'].includes(key))
        || (mode === 'games' && (key === 'spatial' || key === 'hotspots'))));
    }
    for (const key of ['controlKeys', 'areas']) {
      const map = property(parsed, key);
      if (map) add(key, selectedObject(map, entry => compactRelatedCreationKey(entry, activeKeys)));
    }
    const allAreaKeys = (property(parsed, 'areas')?.entries || []).map(e => e.key);
    const offscreenAreas = allAreaKeys.filter(k => !compactRelatedCreationKey(k, activeKeys));
    if (offscreenAreas.length > 0) {
      const dirText = `Offscreen Creation areas (loaded automatically when mounted or queried): ${offscreenAreas.join(', ')}`;
      add('availableAreaDirectory', { kind: 'string', raw: JSON.stringify(dirText), text: dirText });
    }
    if (workstationOpen || (isOffscreenQuestion && /\b(recreate|generate|render|image|video|voice|speech|tts)\b/i.test(directQuery || combinedGoal))) {
      add('renderAndSpeechOwnership');
    }
    if (mentionsFeeds || /\b(backdrop|deck)\b/i.test(combinedGoal)) {
      add('deckPresentationUpdate');
    }
    return {
      instructions: objectText(selected),
      selectedSections: selected.map(entry => entry.key),
      fallback: false,
    };
  } catch {
    return selectConciergePacketKnowledge(packet, snapshot);
  }
};
