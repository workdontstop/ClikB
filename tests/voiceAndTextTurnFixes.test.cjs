const fs = require('node:fs');
const ts = require('typescript');
const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./loadTs.cjs');

function extractCallback(file, name, bindings) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText(source) === name) {
      found = n.initializer.arguments ? n.initializer.arguments[0] : n.initializer;
    }
    ts.forEachChild(n, visit);
  }
  visit(source);
  const js = ts.transpileModule('const fn=' + found.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(bindings), js + ';return fn;')(...Object.values(bindings));
}

function loadVoiceHelpers(source) {
  const start = source.indexOf('function normalizeTranscript');
  const end = source.indexOf('function getFrameRms');
  const ast = ts.createSourceFile('voice.ts', source, ts.ScriptTarget.Latest, true);
  const fns = ast.statements
    .filter(node => ts.isFunctionDeclaration(node) && ['isLikelyEchoTranscript', 'mergeTranscript', 'correctClikbAliasTranscript'].includes(node.name?.text))
    .map(node => node.getText(ast))
    .join('\n');
  const js = ts.transpileModule(source.slice(start, end) + '\n' + fns, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(js + ';return {normalizeTranscript,isFillerOnly,isLikelySttKeytermLeak,isImmediateInterruptTranscript,isConfirmedUserSpeechTranscript,isLikelyEchoTranscript,collapseRepeatedShortTranscript,mergeTranscript,correctClikbAliasTranscript};')();
}

test('xAI normal listening waits 1800ms and merges multi-clause speech across natural pauses', async () => {
  const source = fs.readFileSync('src/hooks/useGeminiVoice.ts', 'utf8');
  const filters = loadVoiceHelpers(source);
  const timers = [];
  let nowMs = 1000;
  const refs = {};
  for (const [, name] of source.matchAll(/\b(\w+Ref)\.current\b/g)) refs[name] = { current: null };
  Object.assign(refs, {
    closedRef: { current: false },
    activeRef: { current: true },
    transcriptRef: { current: '' },
    transcriptFinalizeTimerRef: { current: null },
    lastMicSpeechAtRef: { current: 0 },
    lastXaiBargeInTranscriptAtRef: { current: 0 },
    lastXaiBargeInTranscriptNormRef: { current: '' },
    xaiBargeInTurnActiveRef: { current: false },
    xaiUnconfirmedNoiseRef: { current: false },
    xaiNoiseQuietFramesRef: { current: 0 },
    processingTranscriptRef: { current: false },
    activeTranscriptNormRef: { current: '' },
    inFlightSpeechTextRef: { current: '' },
    inFlightSpeechAnsweredRef: { current: false },
    lastBargeInAtRef: { current: 0 },
    lastTtsEndedAtRef: { current: 0 },
    currentTtsTextNormRef: { current: '' },
    lastTtsTextNormRef: { current: '' },
    ttsDuckedRef: { current: false },
  });

  const processed = [];
  const baseBindings = {
    ...refs,
    ...filters,
    XAI_SPEECH_FINAL_SETTLE_MS: 1800,
    XAI_CHUNK_FINAL_FALLBACK_MS: 5000,
    XAI_BARGE_IN_TRANSCRIPT_IDLE_MS: 1800,
    XAI_BARGE_IN_RECHECK_PADDING_MS: 50,
    TRANSCRIPT_SETTLE_MS: 1700,
    MIC_ACTIVITY_HOLD_MS: 1200,
    BARGE_IN_TRANSCRIPT_WINDOW_MS: 4500,
    TTS_ECHO_GRACE_MS: 900,
    TTS_BARGE_IN_PROVISIONAL_SETTLE_MS: 950,
    performance: { now: () => nowMs },
    window: {
      setTimeout: (fn, delay) => {
        const item = { id: timers.length + 1, fn, delay, cleared: false };
        timers.push(item);
        return item.id;
      },
      clearTimeout: (id) => {
        const item = timers.find(t => t.id === id);
        if (item) item.cleared = true;
      },
    },
    L: () => {},
    processTranscript: async (text) => { processed.push(text); },
    handleConciergeMeteredBillingEvent: () => {},
    cleanup: () => {},
    setActive: () => {},
    setError: () => {},
    setStatus: () => {},
    setCaptureConnected: () => {},
    resolveSttReadyWaiters: () => {},
    hasActiveTts: () => false,
    hasAudiblePlayback: () => false,
    armTtsInterruptionRecovery: () => {},
    clearNoTranscriptWatchdog: () => {},
    scheduleTtsRestore: () => {},
    stopPlayback: () => {},
    setAcceptedSpeechPending: () => {},
    setInputReceipt: () => {},
  };

  const scheduleTranscriptProcessing = extractCallback('src/hooks/useGeminiVoice.ts', 'scheduleTranscriptProcessing', baseBindings);
  const handleXaiSttEvent = extractCallback('src/hooks/useGeminiVoice.ts', 'handleXaiSttEvent', {
    ...baseBindings,
    scheduleTranscriptProcessing,
  });

  // 1. User speaks first clause in normal listening (AI silent) and xAI emits speech_final
  handleXaiSttEvent({
    type: 'transcript.partial',
    text: 'Hey, make three images of Santa Claus delivering a golden present.',
    is_final: true,
    speech_final: true,
  });

  const activeTimers1 = timers.filter(t => !t.cleared);
  assert.equal(activeTimers1.length, 1);
  assert.equal(activeTimers1[0].delay, 1800, 'xAI speech_final should wait 1800ms instead of 200ms');
  assert.equal(processed.length, 0);

  // 2. 1100ms later (during a natural 1.1s pause), user continues speaking ("Through GTA 6")
  nowMs += 1100;
  handleXaiSttEvent({
    type: 'transcript.partial',
    text: 'Through GTA',
    is_final: false,
    speech_final: false,
  });

  // Even if the original 1800ms timer fires at +1800ms, transcript liveness guard holds it open
  nowMs += 700;
  const latestTimerBeforeFinal = timers.filter(t => !t.cleared).at(-1);
  latestTimerBeforeFinal.fn();
  assert.equal(processed.length, 0, 'Recent interim speech liveness must hold the turn open');

  // 3. Final transcript for second clause arrives and merges into the same utterance
  nowMs += 300;
  handleXaiSttEvent({
    type: 'transcript.partial',
    text: 'Through GTA 6.',
    is_final: true,
    speech_final: true,
  });

  assert.equal(
    refs.transcriptRef.current,
    'Hey, make three images of Santa Claus delivering a golden present. Through GTA 6.',
  );

  // 4. After 1800ms of actual silence, the combined utterance is sent in one turn
  nowMs += 1850;
  timers.filter(t => !t.cleared).at(-1).fn();
  assert.deepEqual(processed, [
    'Hey, make three images of Santa Claus delivering a golden present. Through GTA 6.',
  ]);
});

test('continuing speech while an unanswered brain turn is thinking aborts it and merges the first clause', async () => {
  const source = fs.readFileSync('src/hooks/useGeminiVoice.ts', 'utf8');
  const filters = loadVoiceHelpers(source);
  const aborted = [];
  const refs = {
    closedRef: { current: false },
    activeRef: { current: true },
    transcriptRef: { current: '' },
    transcriptFinalizeTimerRef: { current: null },
    lastMicSpeechAtRef: { current: 0 },
    lastXaiBargeInTranscriptAtRef: { current: 0 },
    lastXaiBargeInTranscriptNormRef: { current: '' },
    xaiBargeInTurnActiveRef: { current: false },
    xaiUnconfirmedNoiseRef: { current: false },
    xaiNoiseQuietFramesRef: { current: 0 },
    processingTranscriptRef: { current: true },
    activeTranscriptNormRef: { current: 'hey make three images of santa claus delivering a golden present' },
    inFlightSpeechTextRef: { current: 'Hey, make three images of Santa Claus delivering a golden present.' },
    inFlightSpeechAnsweredRef: { current: false },
    brainAbortRef: { current: { abort: () => aborted.push(true) } },
    lastBargeInAtRef: { current: 0 },
    lastTtsEndedAtRef: { current: 0 },
    currentTtsTextNormRef: { current: '' },
    lastTtsTextNormRef: { current: '' },
    ttsDuckedRef: { current: false },
  };

  const handleXaiSttEvent = extractCallback('src/hooks/useGeminiVoice.ts', 'handleXaiSttEvent', {
    ...refs,
    ...filters,
    XAI_SPEECH_FINAL_SETTLE_MS: 1800,
    XAI_CHUNK_FINAL_FALLBACK_MS: 5000,
    BARGE_IN_TRANSCRIPT_WINDOW_MS: 4500,
    TTS_ECHO_GRACE_MS: 900,
    TTS_BARGE_IN_PROVISIONAL_SETTLE_MS: 950,
    performance: { now: () => 5000 },
    L: () => {},
    handleConciergeMeteredBillingEvent: () => {},
    cleanup: () => {},
    setActive: () => {},
    setError: () => {},
    setStatus: () => {},
    setCaptureConnected: () => {},
    resolveSttReadyWaiters: () => {},
    hasActiveTts: () => false,
    hasAudiblePlayback: () => false,
    armTtsInterruptionRecovery: () => {},
    clearNoTranscriptWatchdog: () => {},
    scheduleTtsRestore: () => {},
    stopPlayback: () => {},
    setAcceptedSpeechPending: () => {},
    setInputReceipt: () => {},
    scheduleTranscriptProcessing: () => {},
  });

  handleXaiSttEvent({
    type: 'transcript.partial',
    text: 'Through Minecraft and Elden Ring. Use shorts mode.',
    is_final: true,
    speech_final: true,
  });

  assert.equal(aborted.length, 1, 'In-flight unanswered brain turn should be aborted immediately');
  assert.equal(refs.processingTranscriptRef.current, false);
  assert.equal(
    refs.transcriptRef.current,
    'Hey, make three images of Santa Claus delivering a golden present. Through Minecraft and Elden Ring. Use shorts mode.',
  );
});

test('handleSendDraft clears input immediately and allows sending while previous request is still thinking', async () => {
  const drafts = [];
  const calls = [];
  let resolveFirst;
  const firstPromise = new Promise(r => { resolveFirst = r; });

  const draftRevisionRef = { current: 1 };
  const activeAskRunRef = { current: 0 };
  let busy = true; // Simulate AI already thinking from previous turn

  const handleSendDraft = extractCallback('src/components/GlobalBrainstormGuide.tsx', 'handleSendDraft', {
    cancelAutoOffTimer: () => {},
    draft: 'Use shorts mode instead',
    askBusy: busy,
    activeAskRunRef,
    draftRevisionRef,
    setAskBusy: (v) => { busy = v; },
    setAskError: () => {},
    setTextBody: () => {},
    setDraft: (v) => drafts.push(v),
    voiceMode: false,
    guidePlayMode: false,
    askTextWithVoice: async () => {},
    textAsk: (q) => {
      calls.push(q);
      return firstPromise;
    },
    console: { error: () => {} },
  });

  const sendWork = handleSendDraft();
  assert.deepEqual(drafts, [''], 'Draft must be cleared immediately when submitted, before textAsk finishes');
  assert.deepEqual(calls, ['Use shorts mode instead'], 'Should not lock out sending when askBusy is true');
  resolveFirst();
  await sendWork;
});

test('unanswered user turns are preserved in unsummarized payload tail and combined in auto-control pending context', () => {
  const getCompletedTurns = extractCallback('src/components/BrainstormSessionProvider.tsx', 'getCompletedTurns', {});
  const getUnsummarizedTailMessages = extractCallback('src/components/BrainstormSessionProvider.tsx', 'getUnsummarizedTailMessages', {});

  const history = [
    { id: '1', role: 'user', content: 'Hey, make three images of Santa Claus delivering a golden present.', timestamp: 1 },
    // Aborted turn's empty AI bubble was removed (or had empty content)
    { id: '2', role: 'user', content: 'Through GTA 6.', timestamp: 2 },
    { id: '3', role: 'ai', content: 'What should I take through GTA 6 to mean?', timestamp: 3, streaming: false },
  ];

  const completed = getCompletedTurns(history);
  assert.equal(completed.length, 1);

  const tail = getUnsummarizedTailMessages(history, completed, 0);
  assert.deepEqual(
    tail.map(m => ({ role: m.role, content: m.content })),
    [
      { role: 'user', content: 'Hey, make three images of Santa Claus delivering a golden present.' },
      { role: 'user', content: 'Through GTA 6.' },
      { role: 'ai', content: 'What should I take through GTA 6 to mean?' },
    ],
  );

  const autoControl = loadTs('src/autoControlContinuation.ts');
  autoControl.noteAutoControlUserTurn('stop');
  autoControl.noteAutoControlUserTurn('Hey, make three images of Santa Claus delivering a golden present.');
  // First turn is aborted before committing, then second clause arrives:
  autoControl.noteAutoControlUserTurn('Through GTA 6.');
  const ctx = autoControl.autoControlRequestContext('Through GTA 6.');
  assert.equal(
    ctx.latestRealControlInstruction,
    'Hey, make three images of Santa Claus delivering a golden present. Through GTA 6.',
  );
  assert.equal(
    ctx.activeAutoControlGoal,
    'Hey, make three images of Santa Claus delivering a golden present. Through GTA 6.',
  );

  // When voice turn-taking already prepended the partial prefix into the next turn, do not duplicate the prefix:
  autoControl.noteAutoControlUserTurn('stop');
  autoControl.noteAutoControlUserTurn('Alright, so I want to create');
  autoControl.noteAutoControlUserTurn('Alright, so I want to create, I want to create three images of Santa Claus.');
  const mergedCtx = autoControl.autoControlRequestContext('Alright, so I want to create, I want to create three images of Santa Claus.');
  assert.equal(
    mergedCtx.activeAutoControlGoal,
    'Alright, so I want to create, I want to create three images of Santa Claus.',
  );
});
