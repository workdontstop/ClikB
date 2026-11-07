import { Request, Response } from "express";
import OpenAI from "openai";
import { createRoutedTextClient } from "./textGeneration";
import { recordOpenAiUsage } from "./aiUsageLedger";
import dotenv from "dotenv";
import {
  buildBrainstormSessionRecallContext,
  deleteBrainstormSessionMemoryItem,
  deleteBrainstormSessionMemoryScope,
  indexBrainstormSessionMemoryRecords,
  syncBrainstormCreationMemoryCards,
  type BrainstormSessionIdentity,
  type BrainstormSessionCanonOperationInput,
  type BrainstormSessionMemoryInputRecord,
} from "./BrainstormSessionMemoryService";

dotenv.config();

const GPTKey = process.env.OPENAI_API_KEY || process.env.DALLE_KEY || process.env.OPENIMAGE_KEY || process.env.APP_STATE_STABLE_KEY;
const openai = createRoutedTextClient(new OpenAI({ apiKey: GPTKey }));
const BRAINSTORM_MEMORY_MODEL = process.env.BRAINSTORM_MEMORY_MODEL || "gpt-6-luna";

const MEMORY_SLOT_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "brainstorm_memory_slot",
    strict: true,
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        fullSummary: { type: "string" },
        canonSummary: { type: "string" },
        rejectedIdeas: { type: "array", items: { type: "string" } },
        openQuestions: { type: "array", items: { type: "string" } },
        names: { type: "array", items: { type: "string" } },
        style: { type: "string" },
        memories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              memoryKind: { type: "string" },
              title: { type: "string" },
              text: { type: "string" },
              entities: { type: "array", items: { type: "string" } },
              sceneNumber: { type: "string" },
              importance: { type: "number" }
            },
            required: ["memoryKind", "title", "text", "entities", "sceneNumber", "importance"],
            additionalProperties: false
          }
        },
        canonOperations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              operation: { type: "string" },
              cardType: { type: "string" },
              title: { type: "string" },
              canonicalTitle: { type: "string" },
              aliases: { type: "array", items: { type: "string" } },
              domains: { type: "array", items: { type: "string" } },
              facts: { type: "array", items: { type: "string" } },
              text: { type: "string" },
              entities: { type: "array", items: { type: "string" } },
              sceneNumber: { type: "string" },
              importance: { type: "number" },
              confidence: { type: "number" }
            },
            required: ["operation", "cardType", "title", "canonicalTitle", "aliases", "domains", "facts", "text", "entities", "sceneNumber", "importance", "confidence"],
            additionalProperties: false
          }
        }
      },
      required: ["title", "fullSummary", "canonSummary", "rejectedIdeas", "openQuestions", "names", "style", "memories", "canonOperations"],
      additionalProperties: false
    }
  }
};
export const SummarizeBrainstormMemorySlot = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { turns, slotId, turnStart, turnEnd, sessionIdentity, mode } = req.body;

  try {
    const transcript = (Array.isArray(turns) ? turns : [])
      .map((t: any) => `${String(t.role || "user")}: ${String(t.content || "")}`)
      .join("\n");

    if (!transcript.trim()) {
      return res.status(400).send({ message: "No turns supplied" });
    }

    const completion = await openai.chat.completions.create({
      model: BRAINSTORM_MEMORY_MODEL,
      messages: [
        {
          role: "system",
          content: [
            "You are ClikB's Brainstorm session-memory writer.",
            "Extract durable session memory from this chat chunk so a later model can preserve continuity across creative work and app questions.",
            "Write compact but specific memory. Names, aliases, character traits, relationships, environments, events, story plot, synopsis, goals, scene sequence, camera details, app context, workflows, user preferences, corrections, and open questions matter more than generic summaries.",
            "Do not invent new ideas. Record only facts, decisions, preferences, constraints, rejected directions, and unresolved questions established in the conversation.",
            "Use memoryKind values such as character, environment, event, story_plot, synopsis, goal, scene, sequence, camera_direction, style_reference, app_context, app_feature, workflow, preference, decision, constraint, rejected_idea, open_question, canon_summary, or general_note.",
            "Also output canonOperations. These are dynamic active cards, not hardcoded names. Use create or update for current truths, merge_alias when speech/spelling variants refer to the same thing, supersede only when the user clearly replaces older truth, delete only when the user clearly removes something, and no_change when nothing durable changed.",
            "For canonOperations, cardType may be character, environment, event, story_plot, synopsis, goal, scene, sequence, camera_direction, style_reference, app_context, app_feature, workflow, preference, decision, constraint, open_question, or general_note. Mode can influence importance, but do not silo memory by mode."
          ].join(" ")
        },
        {
          role: "user",
          content: `Conversation chunk for memory slot ${slotId} (completed turns ${turnStart}-${turnEnd}):\n${transcript}`
        }
      ],
      response_format: MEMORY_SLOT_SCHEMA as any,
      n: 1
    });
    recordOpenAiUsage(BRAINSTORM_MEMORY_MODEL, completion, { memorySummary: true });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    const slotData = JSON.parse(raw);
    const normalizedSlotId = Number(slotId);
    const normalizedTurnStart = Number(turnStart);
    const normalizedTurnEnd = Number(turnEnd);
    let sessionMemoryIndex: any = null;

    const rawArchiveRecord: BrainstormSessionMemoryInputRecord = {
      recordType: "archive_chunk",
      memoryKind: "archive_chunk",
      title: `Raw chat turns ${normalizedTurnStart}-${normalizedTurnEnd}`,
      text: transcript,
      entities: Array.isArray(slotData.names) ? slotData.names.map(String) : [],
      sceneNumber: "",
      importance: 2,
      turnStart: normalizedTurnStart,
      turnEnd: normalizedTurnEnd,
      slotId: normalizedSlotId,
      mode,
    };

    const extractedRecords: BrainstormSessionMemoryInputRecord[] = Array.isArray(slotData.memories)
      ? slotData.memories.map((memory: any) => ({
          recordType: "memory_card",
          memoryKind: String(memory.memoryKind || "note"),
          title: String(memory.title || slotData.title || "Brainstorm memory"),
          text: String(memory.text || ""),
          entities: Array.isArray(memory.entities) ? memory.entities.map(String) : [],
          sceneNumber: String(memory.sceneNumber || ""),
          importance: Number(memory.importance || 3),
          turnStart: normalizedTurnStart,
          turnEnd: normalizedTurnEnd,
          slotId: normalizedSlotId,
          mode,
        }))
      : [];

    const canonSummary = String(slotData.canonSummary || slotData.fullSummary || "").trim();
    if (canonSummary) {
      extractedRecords.unshift({
        recordType: "memory_card",
        memoryKind: "canon_summary",
        title: String(slotData.title || `Brainstorm canon slot ${normalizedSlotId}`),
        text: canonSummary,
        entities: Array.isArray(slotData.names) ? slotData.names.map(String) : [],
        sceneNumber: "",
        importance: 5,
        turnStart: normalizedTurnStart,
        turnEnd: normalizedTurnEnd,
        slotId: normalizedSlotId,
        mode,
      });
    }


    const canonOperations: BrainstormSessionCanonOperationInput[] = Array.isArray(slotData.canonOperations)
      ? slotData.canonOperations.map((operation: any) => ({
          operation: String(operation.operation || "update"),
          cardType: String(operation.cardType || "general_note"),
          title: String(operation.title || operation.canonicalTitle || ""),
          canonicalTitle: String(operation.canonicalTitle || operation.title || ""),
          aliases: Array.isArray(operation.aliases) ? operation.aliases.map(String) : [],
          domains: Array.isArray(operation.domains) ? operation.domains.map(String) : [],
          facts: Array.isArray(operation.facts) ? operation.facts.map(String) : [],
          text: String(operation.text || ""),
          entities: Array.isArray(operation.entities) ? operation.entities.map(String) : [],
          sceneNumber: String(operation.sceneNumber || ""),
          importance: Number(operation.importance || 4),
          confidence: Number(operation.confidence || 0),
          turnStart: normalizedTurnStart,
          turnEnd: normalizedTurnEnd,
          slotId: normalizedSlotId,
          mode,
        }))
      : [];
    try {
      sessionMemoryIndex = await indexBrainstormSessionMemoryRecords({
        identity: sessionIdentity as BrainstormSessionIdentity,
        records: [rawArchiveRecord, ...extractedRecords],
        canonOperations,
      });
      if (!sessionMemoryIndex) {
        throw new Error("Missing scoped Brainstorm session identity");
      }
    } catch (indexError: any) {
      console.error("Brainstorm session memory index failed:", indexError?.message || indexError);
      // The client must retain the raw turns and retry instead of locking a
      // summary whose underlying session records were not stored.
      return res.status(503).send({ message: "Brainstorm session memory was not saved; retry later." });
    }

    return res.send({
      slot: {
        slotId: normalizedSlotId,
        turnStart: normalizedTurnStart,
        turnEnd: normalizedTurnEnd,
        ...slotData
      },
      sessionMemoryIndex,
    });
  } catch (e: any) {
    console.error("SummarizeBrainstormMemorySlot error:", e?.message || e);
    return res.status(500).send({ message: "Failed to summarize memory slot" });
  }
};

export const ResetBrainstormSessionMemory = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { sessionIdentity } = req.body || {};

  try {
    const deletion = await deleteBrainstormSessionMemoryScope({
      identity: sessionIdentity as BrainstormSessionIdentity,
    });

    if (!deletion) {
      return res.status(400).send({ message: "Missing Brainstorm session identity" });
    }

    return res.send({
      message: "Brainstorm session memory reset",
      deletion,
    });
  } catch (e: any) {
    console.error("ResetBrainstormSessionMemory error:", e?.message || e);
    return res.status(500).send({ message: "Failed to reset Brainstorm session memory" });
  }
};

export const DeleteBrainstormSessionMemoryItem = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { sessionIdentity, vectorId, confirmation } = req.body || {};

  if (confirmation !== "delete") {
    return res.status(400).send({ message: "Type delete to confirm session memory deletion" });
  }

  try {
    const deletion = await deleteBrainstormSessionMemoryItem({
      identity: sessionIdentity as BrainstormSessionIdentity,
      vectorId: String(vectorId || ""),
    });

    if (!deletion) {
      return res.status(400).send({ message: "Missing Brainstorm session memory id or identity" });
    }

    return res.send({
      message: "Brainstorm session memory deleted",
      deletion,
    });
  } catch (e: any) {
    console.error("DeleteBrainstormSessionMemoryItem error:", e?.message || e);
    return res.status(500).send({ message: "Failed to delete Brainstorm session memory" });
  }
};

export const SearchBrainstormSessionMemory = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { sessionIdentity, query, recentContext, topK, minScore } = req.body || {};

  try {
    const result = await buildBrainstormSessionRecallContext({
      identity: sessionIdentity as BrainstormSessionIdentity,
      query: String(query || ""),
      recentContext: String(recentContext || ""),
      topK: topK == null ? undefined : Number(topK),
      minScore: minScore == null ? undefined : Number(minScore),
    });

    return res.send({ message: "Brainstorm session memory searched", result });
  } catch (e: any) {
    console.error("SearchBrainstormSessionMemory error:", e?.message || e);
    return res.status(500).send({ message: "Failed to search Brainstorm session memory" });
  }
};
export const SyncBrainstormCreationMemoryCards = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { sessionIdentity, operations } = req.body || {};

  try {
    const result = await syncBrainstormCreationMemoryCards({
      identity: sessionIdentity as BrainstormSessionIdentity,
      operations: Array.isArray(operations) ? operations : [],
    });

    if (!result) {
      return res.status(400).send({ message: "Missing Brainstorm session identity" });
    }

    return res.send({ message: "Creation memory synchronized", result });
  } catch (e: any) {
    console.error("SyncBrainstormCreationMemoryCards error:", e?.message || e);
    return res.status(500).send({ message: "Failed to synchronize creation memory" });
  }
};
