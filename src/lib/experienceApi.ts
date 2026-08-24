import { z } from "zod";

export const chatMessageSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string() });

export const highlightSchema = z.object({
  id: z.string().optional(),
  title: z.string().default(""),
  situation: z.string().default(""),
  task: z.string().default(""),
  action: z.string().default(""),
  result: z.string().default(""),
  quantify: z.string().default(""),
  resumeBullet: z.string().default(""),
  tags: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
});

export const experienceInputSchema = z.object({
  title: z.string(),
  org: z.string(),
  type: z.enum(["intern", "project"]),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  location: z.string().default(""),
  rawInput: z.string(),
  chatHistory: z.array(chatMessageSchema).default([]),
  sessionId: z.string().optional(),
  highlights: z.array(highlightSchema).default([]),
});

type SerializableHighlight = { tags: string; skills: string; [key: string]: unknown };
type SerializableExperience = {
  chatHistory: string;
  highlights?: SerializableHighlight[];
  [key: string]: unknown;
};

export function serializeExperience<T extends SerializableExperience>(exp: T) {
  return {
    ...exp,
    chatHistory: JSON.parse(exp.chatHistory),
    highlights: (exp.highlights ?? []).map((h) => ({ ...h, tags: JSON.parse(h.tags), skills: JSON.parse(h.skills) })),
  };
}
