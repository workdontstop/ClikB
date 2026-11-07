import assert from 'node:assert/strict';
import test from 'node:test';
import { buildJevDecisionBody, consultJev, selectJevSnapshotFacts } from './JevDecisionService';

const snapshot = {
  timestamp: 42,
  navigation: {
    stateVersion: 7,
    route: '/settings',
    areas: { 'clikb.settings': { state: { themePreference: 'dark' } } },
  },
  lastGuideCall: { callId: 'intro', status: 'succeeded', attempts: 1 },
  loggedUserName: 'not sent',
};

test('Jev receives only concierge-selected live facts with explicit unknowns', () => {
  const facts = selectJevSnapshotFacts(snapshot, [
    '/navigation/areas/clikb.settings/state/themePreference',
    '/lastGuideCall/status',
    '/navigation/areas/clikb.settings/state/missing',
    '/loggedUserName',
    '/autoControl',
  ]);
  assert.deepEqual(facts, [
    { pointer: '/navigation/areas/clikb.settings/state/themePreference', value: 'dark', status: 'found' },
    { pointer: '/lastGuideCall/status', value: 'succeeded', status: 'found' },
    { pointer: '/navigation/areas/clikb.settings/state/missing', value: null, status: 'unknown' },
    { pointer: '/autoControl', value: null, status: 'unknown' },
  ]);
});

test('live Auto Control On and Video Off reach Jev without being conflated', () => {
  const live = { ...snapshot, autoControl: { enabled: true, videoEnabled: false, visible: true } };
  const body = buildJevDecisionBody({ question: 'Which permission is enabled?', kind: 'choice',
    options: ['auto_only', 'both'], snapshotPointers: ['/autoControl'],
  }, live);
  assert.deepEqual(body.state.selectedFacts, [
    { pointer: '/autoControl', value: live.autoControl, status: 'found' },
  ]);
});

test('Jev request is typed, bounded, and does not automatically dump the snapshot', () => {
  const body = buildJevDecisionBody({
    question: 'Which location should be described?', kind: 'choice',
    options: ['settings', 'menu', 'unknown'],
    snapshotPointers: ['/navigation/route', '/lastGuideCall/status'],
    context: 'The concierge wants to verify the current location.',
  }, snapshot);
  assert.equal(body.state.navigationStateVersion, 7);
  assert.equal(body.model, 'typesafe/jev-1.13');
  assert.equal(body.state.selectedFacts.length, 2);
  assert.equal(body.questions.consultation.type, 'choice');
  assert.deepEqual(body.questions.consultation.criteria, { settings: 'settings', menu: 'menu', unknown: 'unknown' });
  assert.ok(!JSON.stringify(body).includes('not sent'));
  assert.throws(() => buildJevDecisionBody({ question: 'Pick', kind: 'choice', options: ['one'] }, snapshot));
});

test('Jev choice criteria use bounded descriptions while preserving exact choice IDs', () => {
  const body = buildJevDecisionBody({
    question: 'Which action fits?', kind: 'choice', options: ['clikb.navigation.menu.action.settings', 'no_action'],
    optionDescriptions: {
      'clikb.navigation.menu.action.settings': 'Click Settings in navigation menu.',
      no_action: 'Do not perform an app action.',
    },
  }, snapshot);
  assert.deepEqual(body.questions.consultation.criteria, {
    'clikb.navigation.menu.action.settings': 'Click Settings in navigation menu.',
    no_action: 'Do not perform an app action.',
  });
});

test('OpenRouter boolean questions use Jev noul contract', () => {
  const body = buildJevDecisionBody({ question: 'Is the call running?', kind: 'boolean', snapshotPointers: ['/lastGuideCall/status'] }, snapshot);
  assert.deepEqual(body.questions.consultation, { type: 'noul', instructions: 'Is the call running?' });
});

test('Jev control frame keeps only live validated options and includes current movement', () => {
  const live = { ...snapshot, navigation: {
    ...snapshot.navigation,
    surfaceId: 'clikb.navigation.shell',
    availableActions: [{ actionId: 'clikb.settings.action.theme_light' }],
    recentTransitions: [{ sequence: 4, actor: 'manual', before: { route: '/Feeds' }, after: { route: '/settings' }, outcome: 'succeeded' }],
  } };
  const body = buildJevDecisionBody({ question: 'Which action fits?', kind: 'choice', options: ['light', 'stay'], controlFrame: {
    goal: 'Use light mode', tentativeActionId: 'clikb.settings.action.theme_light',
    alternativeActionIds: ['clikb.settings.action.theme_light', 'invented.action'],
    relevantRagRule: 'Light changes the appearance preference.',
  } }, live);
  assert.equal(body.state.controlFrame?.tentativeActionId, 'clikb.settings.action.theme_light');
  assert.deepEqual(body.state.controlFrame?.alternativeActionIds, ['clikb.settings.action.theme_light']);
  assert.equal(body.state.controlFrame?.recentTransitions[0].sequence, 4);
});

test('HTTP 429 is reported once without an immediate second paid request', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.JEV_API_KEY;
  let requests = 0;
  let requestUrl = '';
  const diagnostics: Array<{ stage: string; status?: unknown; retryAfter?: unknown }> = [];
  process.env.JEV_API_KEY = 'test-only-key';
  globalThis.fetch = async (url) => {
    requests += 1;
    requestUrl = String(url);
    return new Response(JSON.stringify({ error: { code: 'rate_limit_exceeded' } }), {
      status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '30' },
    });
  };
  try {
    const result = await consultJev({
      question: 'Is an app action requested?', kind: 'choice', options: ['yes', 'no'],
      onDiagnostic: event => diagnostics.push(event),
    }, snapshot);
    assert.equal(requests, 1);
    assert.equal(requestUrl, 'https://openrouter.ai/api/alpha/decisions');
    assert.equal(result.status, 'unavailable');
    assert.equal(result.reason, 'Jev HTTP 429');
    assert.ok(diagnostics.some(event => event.stage === 'http_response' && event.status === 429 && event.retryAfter === '30'));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.JEV_API_KEY;
    else process.env.JEV_API_KEY = originalKey;
  }
});
