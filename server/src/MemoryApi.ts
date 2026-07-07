import { Request, Response } from "express";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const GPTKey = process.env.DALLE_KEY;
const openai = new OpenAI({ apiKey: GPTKey });

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
        rejectedIdeas: { type: "array", items: { type: "string" } },
        openQuestions: { type: "array", items: { type: "string" } },
        names: { type: "array", items: { type: "string" } },
        style: { type: "string" }
      },
      required: ["title", "fullSummary", "rejectedIdeas", "openQuestions", "names", "style"],
      additionalProperties: false
    }
  }
};

export const SummarizeBrainstormMemorySlot = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { turns, slotId, turnStart, turnEnd } = req.body;

  try {
    const transcript = (Array.isArray(turns) ? turns : [])
      .map((t: any) => `${String(t.role || "user")}: ${String(t.content || "")}`)
      .join("\n");

    if (!transcript.trim()) {
      return res.status(400).send({ message: "No turns supplied" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "system",
          content: [
            "You compress a chunk of a ClikB creative brainstorm chat into a factual session memory slot.",
            "Write a strong standalone title that another model can recognize later from vague callbacks.",
            "Bad title: Family idea. Good title: Jetsons family reimagined across historical eras.",
            "Capture decisions, user preferences, rejected ideas, names, visual/style direction, and open questions.",
            "Do not invent new creative ideas. Record only facts established in the conversation. Be concise."
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

    const raw = completion.choices?.[0]?.message?.content || "{}";
    const slotData = JSON.parse(raw);

    return res.send({
      slot: {
        slotId: Number(slotId),
        turnStart: Number(turnStart),
        turnEnd: Number(turnEnd),
        ...slotData
      }
    });
  } catch (e: any) {
    console.error("SummarizeBrainstormMemorySlot error:", e?.message || e);
    return res.status(500).send({ message: "Failed to summarize memory slot" });
  }
};
