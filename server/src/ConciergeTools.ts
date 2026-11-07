import { CONCIERGE_RESPONSE_POLICY } from './conciergeResponsePolicy';
import type { JevControlledOperation } from './JevActionGate';
import { CREATION_AUTONOMY_RULES } from './CreationExecutionContext';
import { isFeedsTextAction } from './FeedsExecutionContext';
import { navigationTextLimit } from './NavigationTextActions';

export type ConciergeToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
const nullableString = { type: ['string', 'null'] };
const userMessage = { ...nullableString, maxLength: 700,
  description: 'Optional natural conversation for this turn; null for routine/repeated controls. Tool results update knowledge, not a requirement to announce each action. Never permission.' };
const tool = (name: string, description: string, properties: object, required: string[]) => ({
  type: 'function' as const,
  function: { name, description, strict: true, parameters: { type: 'object', properties, required, additionalProperties: false } },
});

/** One app-wide contract, independent of RAG wording or the selected provider. */
export const CONCIERGE_TOOLS = [
  ...(['AppKnowledge', 'SessionMemory', 'CreationMemory'] as const).map((kind) => tool(`search${kind}`,
    kind === 'AppKnowledge' ? 'Read-only semantic search of ClikB operational instructions. Ask for a specific workflow or control meaning.'
      : kind === 'SessionMemory' ? 'Read-only semantic search of this authenticated user session. Recall preferences, requests and prior conversation.'
      : 'Read-only semantic search and exact scene-card lookup in this authenticated user current project. Ask for a specific scene, original brief, character, intent or result.', {
      query: { type: 'string', maxLength: 1000 },
      offset: { type: ['integer', 'null'], minimum: 0, description: 'null or 0 initially; otherwise nextOffset from the same query.' },
    }, ['query', 'offset'])),
  tool('virtualGate', 'Propose one click, mapped Creation/search text replacement, or scroll for the active real user task. Starts mandatory Jev intent/selection/approval and browser validation; never grants permission. Use live IDs only.', {
    kind: { type: 'string', enum: ['click', 'text', 'scroll'] },
    actionId: { ...nullableString, description: 'Exact live click/text action ID; null for scroll.' },
    scrollId: { ...nullableString, description: 'Exact live scroll owner ID, without the scroll: prefix or direction; null for click/text.' },
    direction: { type: ['string', 'null'], enum: ['forward', 'backward', null] },
    textValue: { ...nullableString, description: 'Full replacement field value for text; null otherwise.' },
    rationale: { type: 'string', description: 'Why this one operation advances the real user task.' },
    userMessage,
  }, ['kind', 'actionId', 'scrollId', 'direction', 'textValue', 'rationale', 'userMessage']),
  tool('getCurrentSnapshot', 'Read fresh foreground controls, progress and current text fields on demand. Background pages and saved project content are excluded. Repeated unchanged reads return a reference. Does not change the app or require Auto Control.', {}, []),
  tool('queryLiveSnapshot', 'Read selected foreground JSON-pointer fields, including full current text via its readPointer. Saved project content requires searchCreationMemory; absent fields return unknown.', {
    pointers: { type: 'array', items: { type: 'string' }, maxItems: 12 },
  }, ['pointers']),
  tool('finishAutoControlTask', 'Mark the active user task completed, or waiting for app state/timing. Waiting resumes on meaningful readiness changes or requested timing; completed stops task continuation. Never invent a task.', {
    status: { type: 'string', enum: ['completed', 'waiting'] },
    detail: { type: 'string' },
    userMessage,
  }, ['status', 'detail', 'userMessage']),
];

/** Luna and Terra accept Chat Completions function tools only with reasoning off.
 * Requests without tools and the Replicate providers keep their existing settings. */
export const buildConciergeCompletionRequest = (input: {
  model: string; messages: any[]; tools: typeof CONCIERGE_TOOLS; maxCompletionTokens: number;
}) => ({
  model: input.model,
  messages: input.messages,
  ...(input.tools.length ? {
    tools: input.tools, tool_choice: 'auto' as const, parallel_tool_calls: false,
    ...(['gpt-6-luna', 'gpt-5.6-terra', 'gpt-6.1-terra'].includes(input.model) ? { reasoning_effort: 'none' as const } : {}),
  } : {}),
  max_completion_tokens: input.maxCompletionTokens,
  stream: true as const,
  stream_options: { include_usage: true },
});

export const CONCIERGE_CONTROL_PROMPT = `APP-WIDE CONTROL CONTRACT: To operate ClikB, CALL the virtualGate function with one structured operation. Speaking or writing VirtualGate and an ID never executes anything. This contract overrides old invocation wording in retrieved RAG; the RAG still supplies control meanings and manual/confirmation boundaries. For clicks use kind=click and the exact live actionId; for mapped Creation or Deck search text use kind=text, actionId and the full replacement textValue; for scroll use kind=scroll, the live scrollId and direction separately (no scroll: wrapper). Set unused fields to null. Copy IDs from current navigation.availableActions, feeds.availableActions, or enabled Creation controls; .control. IDs and static RAG patterns are not executable. Forward is down/right and backward is up/left according to the live axis. Explain actions in ordinary words without reading internal IDs aloud.
The server owns the real user goal, obtains fresh browser facts, and requires Jev intent, exact action selection and approval before any mutation. The browser rechecks permission, confirmations, mounted bindings and freshness, invokes the existing handler, and returns observed results plus a new snapshot. Continue immediately from successful feedback; a dispatched handler is not completed generation. Use getCurrentSnapshot or queryLiveSnapshot to observe loading, current fields or recovery. Creation text replaces the full field: preserve the user's exact wording when asked to paste it, or compose a complete draft grounded in their brief only when asked to write one. A bounded field hint is not the full original text; do not invent its missing content. Tool errors include whether a mutation was sent and whether correction is allowed. Correct a repairable argument, stale state or ordinary-action selection failure through fresh evidence and Jev, up to three attempts at an unchanged step. Never bypass Jev or replay an uncertain paid request. Auto Control is user-owned and cannot be changed by tools. Video is an independent opt-in: Video Off never means Auto Control Off. Explicit confirmation boundaries still require the exact latest real user turn.
Maintain the user's unfinished task across steps, including its exact stopping boundary. Stop at Publish means reach the visible storyboard Publish button (or music-video direct Publish), without clicking it; completed images and ordinary Enter Studio are intermediate stages. The server retains this destination and rejects completion before it is observed. Complete requested media and required narrated-Cinema B-shots first. Continue alone preserves the boundary; a later explicit publish instruction may replace it. Shorts/Cinema use image or video source media to assemble a final FFmpeg video with the selected audio/music; images-only does not mean independent image-file delivery. Call finishAutoControlTask(completed) only when the requested end state is observed; call it with waiting when timing/loading or the per-turn action limit requires a later check. Saying "I can't" does not finish an actionable request: supply your precise blocked step and RAG-informed next plan so the server can ask Jev whether to retry, continue, wait, complete, or report a real blocker. Recovery never authorizes replay of accepted/uncertain generation and every resumed mutation still needs the full gate chain. No idle polling without an active task and no autonomous recovery, proactive progress commentary, or companion banter with Auto Control Off. Only while Auto Control is On: on continuation turns perform at most one approved mutation, report meaningful new milestones and completion accurately ("I finished X, doing Y now"), and stop on user interruption. ${CONCIERGE_RESPONSE_POLICY} Automatic progress/review/audit messages are observation-only and have no control tools. Before speaking, distinguish an attempted action, dispatched handler, observed state change, running generation, and completed media. Report the exact missing next control rather than denying completed earlier steps.
STORYBOARD HANDOFFS: Images Continue is storybook_grid.action.continue_images; Videos Next (or music Debut) is storybook_grid.action.next_videos and opens the studio selector. They are separate ordinary actions. Their live IDs carry the full clikb.creation prefix. Video Off permits both for an image-only task; neither generates video nor publishes. Action evidence records the sourceStage and controlLabel: an Images handoff is not evidence that the Videos handoff executed. B-shot/final-scene Publish remains the separate storybook_grid.action.publish confirmation boundary; music-video selector Publish retains its separate publish_music_video confirmation. Main A-shot and B-shot slots keep separate identities/readiness on the combined grid.
DECK SEARCH: Requests such as "show me videos of cars", "find clowns" or "search for cars" mean browse existing ClikB content unless the user requests new creation. Stay in Deck: select_category then category.search opens Homepage's Search Deck. Use kind=text with live clikb.feeds.deck.action.search_text and the complete query (maximum 500 characters), then click run_search. Typing alone never submits. Search landing and keyword results both have Games, Shorts and Cinema as three independent row choices. Games keyword search is now supported and submitting from Games retains that collection. Choose an available search_section through select_search_section; Shorts and Cinema can include still posts, so inspect live video capabilities rather than promise a video-only filter. Preserve the query while switching rows. The live Deck state summarizes every available row, even the inactive row: searchGamesLoadedCount/Status/HasMore, searchShortsLoadedCount/Status/HasMore and searchCinemaLoadedCount/Status/HasMore. For example, accurately report four loaded Shorts results and seven loaded Cinema results before switching collections. These are independently loaded result counts, not global totals or a video-only count. A row still loading or in error is not empty. The Go button submits run_search. Observe actual ready/empty/error results and report their outcome accurately, then focus a matching live card or paginate. Play enters the existing experience; Back returns to the Search Deck. The same Concierge conversation continues in its dock. Auto Control On suffices for search and browsing; Video creation permission is unrelated. Only the mapped Deck search field accepts Feeds text; do not type into arbitrary feed fields or use creation tools to invent search results.
GAME SEARCH METADATA: On confirmed Start Hotspot Setup, game title/tags/categories are generated and saved before the separate creator opens. On confirmed Spatial Publish, metadata is prepared and saved before final spatial publication; preview alone never triggers tagging. Pending metadata does not mean the creator opened or publishing finished. Failure retains the review for retry; successful metadata generation is reused for an index-write retry. Deleting the existing post through normal post deletion also removes its post_search row, including an abandoned or failed Hotspots/Spatial workflow. These are built-in steps of the existing controls, not new standalone AI action IDs.
CREATION OUTPUT: Before paid creation, ask once whether the user wants image sources only or also generated video when their request leaves that choice unclear. An explicit request for images already answers it; do not ask again or generate unrequested videos. Preserve preview-only preparation when full images are unnecessary.
CINEMA AUDIO: Ordinary Cinema defaults to narration unless the user requests dialogue, silence or another audio treatment. Generating video without requested dialogue still retains narration. Narrated Cinema's dynamically calculated B-shots are required to cover narration duration; complete those required slots with the requested image/video treatment rather than skipping them or looping a base shot. Shorts and Games do not use this Cinema narration path. Music video instead uses its exact song-timed scenes, bypasses B-shots and has its own confirmation-gated direct Publish action. Direct Video without first-frame images is an explicit requested workflow, never the default for ordinary video creation and never a consequence of searching existing videos.
${CREATION_AUTONOMY_RULES}
Use economical Luna and GPT image defaults only when unspecified; preserve user-selected models. For multiple scenes with a recurring main character, use character creation and reuse the smallest sufficient set of distinct reference images. Honor explicit Skip/single-image instructions. World draft prerequisites must be checked against the current World controls and actual draft/source state; do not invent a mandatory character-creation prerequisite. Prompt and plan text can support a textual review, but never claim you watched a video or visually verified motion from text alone.`;

export const virtualGateOperation = (args: any): JevControlledOperation => {
  if (!args || typeof args !== 'object' || Array.isArray(args) ||
      Object.keys(args).some(key => !['kind', 'actionId', 'scrollId', 'direction', 'textValue', 'rationale'].includes(key)) ||
      typeof args.rationale !== 'string' || args.rationale.length > 1200) throw new Error('Invalid VirtualGate arguments');
  const empty = (value: unknown) => value == null || value === '';
  const validId = (value: unknown) => typeof value === 'string' && /^clikb\.[A-Za-z0-9_.:%+-]+$/.test(value) && value.length <= 240;
  const normScroll = (value: unknown) => typeof value === 'string' ? value.replace(/^scroll:/, '').replace(/:(?:forward|backward)$/, '').replace(/^clikb\.creation\.([A-Za-z0-9_]+)\.control\./, 'clikb.creation.$1.action.') : null;
  const sId = normScroll(args.scrollId), aId = normScroll(args.actionId);
  const scrollTarget = validId(sId) && (empty(args.actionId) || aId === sId) ? sId : validId(aId) && empty(args.scrollId) ? aId : null;
  if ((args.kind === 'scroll' || (args.kind === 'click' && scrollTarget?.includes('scroll'))) && scrollTarget && empty(args.textValue) &&
      (args.direction === 'forward' || args.direction === 'backward')) {
    return { kind: 'scroll', scrollId: scrollTarget, direction: args.direction };
  }
  if (validId(args.actionId) && args.actionId.includes('.action.') && empty(args.scrollId) && empty(args.direction)) {
    const controlId = args.actionId.replace('.action.', '.control.');
    if (args.kind === 'click' && empty(args.textValue)) return { kind: 'click', actionId: args.actionId, controlId };
    if (args.kind === 'text' && args.actionId.startsWith('clikb.creation.') && typeof args.textValue === 'string' && args.textValue.length <= 30000)
      return { kind: 'text', actionId: args.actionId, controlId, text: args.textValue };
    if (args.kind === 'text' && isFeedsTextAction(args.actionId) && typeof args.textValue === 'string' && args.textValue.length <= 500)
      return { kind: 'text', actionId: args.actionId, controlId, text: args.textValue };
    if (args.kind === 'text' && typeof args.actionId === 'string' && navigationTextLimit(args.actionId) > 0 &&
        typeof args.textValue === 'string' && args.textValue.length <= navigationTextLimit(args.actionId))
      return { kind: 'text', actionId: args.actionId, controlId, text: args.textValue };
  }
  // Feeds click IDs predate the .action. convention; live selection resolves their controlId.
  if (args.kind === 'click' && validId(args.actionId) && args.actionId.startsWith('clikb.feeds.') &&
      empty(args.scrollId) && empty(args.direction) && empty(args.textValue)) return { kind: 'click', actionId: args.actionId, controlId: '' };
  throw new Error('Use a live click/text actionId or a scrollId with a separate direction; unused fields must be null');
};

export const operationId = (operation: JevControlledOperation): string => operation.kind === 'scroll'
  ? `scroll:${operation.scrollId}:${operation.direction}` : operation.actionId;

/** Arguments arrive across many chunks; never execute a partial function call. */
export const accumulateToolCalls = (calls: Map<number, ConciergeToolCall>, deltas: any[]): void => {
  for (const delta of deltas || []) {
    if (!Number.isInteger(delta.index) || delta.index < 0 || delta.index > 15) continue;
    const call = calls.get(delta.index) || { id: '', type: 'function' as const, function: { name: '', arguments: '' } };
    if (delta.id) call.id = delta.id;
    if (delta.function?.name) call.function.name += delta.function.name;
    if (delta.function?.arguments) call.function.arguments += delta.function.arguments;
    if (call.function.arguments.length > 70000) throw new Error('Concierge tool arguments exceed the limit');
    calls.set(delta.index, call);
  }
};

export const querySnapshotFields = (snapshot: any, pointers: unknown) => {
  if (!Array.isArray(pointers) || pointers.length > 12) throw new Error('Provide at most twelve JSON pointers');
  return pointers.map(pointer => {
    if (typeof pointer !== 'string' || pointer.length > 240 || !/^\/(navigation|feeds|creation|autoControl|conciergeFocus|route|pageName|ui|app|lastAction|lastActions|recentActions)(\/|$)/.test(pointer))
      throw new Error('Unsupported snapshot pointer');
    let value: any = snapshot;
    for (const part of pointer.slice(1).split('/').map((item: string) => item.replace(/~1/g, '/').replace(/~0/g, '~'))) {
      if (['__proto__', 'constructor', 'prototype'].includes(part) || !value || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, part)) { value = undefined; break; }
      value = value[part];
    }
    return { pointer, status: value === undefined ? 'unknown' : 'found', ...(value === undefined ? {} : { value }) };
  });
};
