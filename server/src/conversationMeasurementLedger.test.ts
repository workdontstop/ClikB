import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCompactConversationSessionView,
  summarizeConversationRecords,
  type ConversationMeasurementRecord,
  type StoredSession,
} from "./conversationMeasurementLedger";

const record = (
  requestId: string,
  startedAt: string,
  completedAt: string,
  elapsedMs: number,
  provider: string,
  model: string,
  costUsd: number,
  timeToFirstTokenMs?: number | null,
): ConversationMeasurementRecord => ({
  sessionId: "test-session",
  requestId,
  route: "/startBrainstormStream",
  stage: "conversation",
  actionLabel: "Conversation",
  status: "succeeded",
  startedAt,
  completedAt,
  elapsedMs,
  events: [],
  calls: [{
    provider,
    model,
    inputTokens: 100,
    cachedInputTokens: 20,
    outputTokens: 50,
    toolCalls: 0,
    searchCalls: 0,
    providerCostUsd: costUsd,
    metadata: timeToFirstTokenMs === undefined ? {} : { timeToFirstTokenMs },
  }],
});

test("projects a measured thirty-minute conversation to one hour", () => {
  const summary = summarizeConversationRecords([
    record("one", "2026-09-27T12:00:00.000Z", "2026-09-27T12:00:02.000Z", 2000, "openai", "gpt-6-luna", 0.40, 250),
    record("two", "2026-09-27T12:29:58.000Z", "2026-09-27T12:30:00.000Z", 2000, "typesafe-via-openrouter", "typesafe/jev-1.13", 0.10, 150),
  ]);

  assert.equal(summary.measuredWindowSeconds, 1800);
  assert.equal(summary.totalCostUsd, 0.5);
  assert.equal(summary.projectedOneHourCostUsd, 1);
  assert.equal(summary.projectedRequestsPerHour, 4);
  assert.equal(summary.speedMs.averageRequest, 2000);
  assert.equal(summary.speedMs.averageTimeToFirstToken, 200);
  assert.equal(summary.speedMs.validFirstTokenSamples, 2);
  assert.equal(summary.speedMs.missingFirstTokenSamples, 0);
  assert.equal(summary.providerTotals.length, 2);
});

test("marks short tests as preliminary instead of presenting them as stable hourly cost", () => {
  const summary = summarizeConversationRecords([
    record("short", "2026-09-27T12:00:00.000Z", "2026-09-27T12:00:10.000Z", 10000, "openai", "gpt-6-luna", 0.01),
  ]);

  assert.equal(summary.projectionStatus, "preliminary_under_10_minutes");
  assert.equal(summary.projectedOneHourCostUsd, 3.6);
});

test("separates the same model by selected reasoning profile without changing total costs", () => {
  const records = ["medium", "xhigh"].map((effort, index) => {
    const entry = record(String(index), "2026-10-16T12:00:00.000Z", "2026-10-16T12:00:01.000Z", 1000, "openai", "gpt-6-luna", 0.01);
    entry.calls[0].metadata = { reasoningEffort: effort };
    return entry;
  });
  const summary = summarizeConversationRecords(records);
  assert.equal(summary.totalCostUsd, 0.02);
  assert.deepEqual(summary.providerTotals.map(row => row.reasoningEffort).sort(), ["medium", "xhigh"]);
});

test("does not coerce null or missing timeToFirstTokenMs to zero and reports valid/missing sample counts", () => {
  const records: ConversationMeasurementRecord[] = [
    record("r1", "2026-10-27T12:00:00.000Z", "2026-10-27T12:00:02.000Z", 2000, "openai", "gpt-6-luna", 0.01, null),
    record("r2", "2026-10-27T12:00:03.000Z", "2026-10-27T12:00:05.000Z", 2000, "openai", "gpt-6-luna", 0.01, undefined),
    record("r3", "2026-10-27T12:00:06.000Z", "2026-10-27T12:00:08.000Z", 2000, "openai", "gpt-6-luna", 0.01, 1400),
    record("r4", "2026-10-27T12:00:09.000Z", "2026-10-27T12:00:11.000Z", 2000, "openai", "gpt-6-luna", 0.01, 1800),
  ];
  const summary = summarizeConversationRecords(records);
  assert.equal(summary.speedMs.averageTimeToFirstToken, 1600);
  assert.equal(summary.speedMs.p95TimeToFirstToken, 1800);
  assert.equal(summary.speedMs.validFirstTokenSamples, 2);
  assert.equal(summary.speedMs.missingFirstTokenSamples, 2);

  const allMissing = summarizeConversationRecords([
    record("m1", "2026-10-27T12:00:00.000Z", "2026-10-27T12:00:02.000Z", 2000, "openai", "gpt-6-luna", 0.01, null),
  ]);
  assert.equal(allMissing.speedMs.averageTimeToFirstToken, null);
  assert.equal(allMissing.speedMs.p95TimeToFirstToken, null);
  assert.equal(allMissing.speedMs.validFirstTokenSamples, 0);
  assert.equal(allMissing.speedMs.missingFirstTokenSamples, 1);
});

test("separates workload totals (main_concierge, jev, embedding, memory, voice) and aggregates context-size events", () => {
  const mainRec = record("main-1", "2026-10-27T12:00:00.000Z", "2026-10-27T12:00:02.000Z", 2000, "openai", "gpt-6-luna", 0.05, 1200);
  mainRec.events = [{
    name: "concierge.input_size",
    at: "2026-10-27T12:00:01.000Z",
    elapsedMs: 100,
    detail: {
      reason: "user_turn",
      knowledgeChars: 4200,
      snapshotChars: 3100,
      systemChars: 2400,
      memoryChars: 1100,
      actionEvidenceChars: 500,
      conversationChars: 700,
    },
  }];
  const jevRec = record("jev-1", "2026-10-27T12:00:02.000Z", "2026-10-27T12:00:03.000Z", 1000, "typesafe-via-openrouter", "typesafe/jev-1.13", 0.002);
  const embRec = record("emb-1", "2026-10-27T12:00:03.000Z", "2026-10-27T12:00:04.000Z", 500, "fal", "openai/text-embedding-3-small", 0.0001);
  const memRec: ConversationMeasurementRecord = {
    ...record("mem-1", "2026-10-27T12:00:04.000Z", "2026-10-27T12:00:05.000Z", 600, "openai", "gpt-6-luna", 0.003),
    route: "/memory/summarizeSlot",
    actionLabel: "Memory Rollup",
  };
  const voiceRec: ConversationMeasurementRecord = {
    ...record("voice-1", "2026-10-27T12:00:05.000Z", "2026-10-27T12:00:06.000Z", 800, "google", "gemini-2.5-flash-preview-tts", 0.004),
    route: "/voiceTtsStream",
    actionLabel: "Conversation Voice Playback",
  };

  const summary = summarizeConversationRecords([mainRec, jevRec, embRec, memRec, voiceRec]);
  const categories = Object.fromEntries(summary.workloadTotals.map(row => [row.category, row]));
  assert.equal(categories.main_concierge.calls, 1);
  assert.equal(categories.jev.calls, 1);
  assert.equal(categories.embedding.calls, 1);
  assert.equal(categories.memory.calls, 1);
  assert.equal(categories.voice.calls, 1);
  assert.equal(summary.contextSize.eventCount, 1);
  assert.equal(summary.contextSize.totalCharacters, 12000);
  assert.equal(summary.contextSize.averageCharacters, 12000);
  assert.equal(summary.contextSize.byReason.user_turn.count, 1);
});

test("builds a bounded compact view from a large multi-MB synthetic session without losing summary accuracy", () => {
  const hugeString = "x".repeat(40_000);
  const records: ConversationMeasurementRecord[] = Array.from({ length: 220 }, (_, index) => {
    const r = record(
      `req-${index + 1}`,
      new Date(Date.UTC(2026, 9, 27, 12, 0, index)).toISOString(),
      new Date(Date.UTC(2026, 9, 27, 12, 0, index + 1)).toISOString(),
      1000,
      "openai",
      "gpt-6-luna",
      0.01,
      index % 2 === 0 ? 900 : null,
    );
    r.events = [{
      name: "concierge.input_size",
      at: r.startedAt,
      elapsedMs: 50,
      detail: {
        reason: "tool_continuation",
        knowledgeChars: 5000,
        snapshotChars: 3000,
        rawDebugDump: hugeString,
      },
    }];
    return r;
  });

  const session: StoredSession = {
    sessionId: "large-session",
    startedAt: records[0].startedAt,
    updatedAt: records[records.length - 1].completedAt,
    measuredWindowMs: 220_000,
    summary: summarizeConversationRecords(records),
    records,
  };

  const compact = buildCompactConversationSessionView(session, { offset: 0, limit: 25 });
  const serializedCompact = JSON.stringify(compact);
  assert.equal(compact.totalRecordCount, 220);
  assert.equal(compact.records.length, 25);
  assert.equal(compact.page.hasMore, true);
  assert.equal(compact.summary.requestCount, 220);
  assert.equal(compact.summary.speedMs.validFirstTokenSamples, 110);
  assert.equal(compact.summary.speedMs.missingFirstTokenSamples, 110);
  assert.ok(serializedCompact.length < 60_000, `Expected compact payload < 60 KB, got ${serializedCompact.length} bytes`);
});
