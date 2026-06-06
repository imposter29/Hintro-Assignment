import Groq from 'groq-sdk';
import { z } from 'zod';
import { env } from '../config/env';
import { logger } from './logger';

const MODEL = 'llama-3.3-70b-versatile';

let client: Groq | null = null;
function getClient(): Groq {
  if (!env.groqApiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }
  if (!client) {
    client = new Groq({ apiKey: env.groqApiKey });
  }
  return client;
}

/** A single transcript line as supplied by the client. */
export interface TranscriptEntry {
  timestamp: string;
  speaker: string;
  text: string;
}

const citationSchema = z.object({
  timestamp: z.string(),
  speaker: z.string(),
  quote: z.string(),
});

/** Strict shape the model is required to return. We validate after parsing. */
const analysisSchema = z.object({
  summary: z.array(
    z.object({ text: z.string(), citations: z.array(citationSchema).default([]) })
  ),
  actionItems: z.array(
    z.object({
      task: z.string(),
      assignee: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
      citations: z.array(citationSchema).default([]),
    })
  ),
  decisions: z.array(
    z.object({ decision: z.string(), citations: z.array(citationSchema).default([]) })
  ),
  followUpSuggestions: z.array(
    z.object({ suggestion: z.string(), citations: z.array(citationSchema).default([]) })
  ),
});

export type MeetingAnalysisResult = z.infer<typeof analysisSchema>;

const SYSTEM_PROMPT = `You are a meticulous meeting analyst. You extract structured intelligence from meeting transcripts.

STRICT RULES — these are non-negotiable:
1. ONLY use information explicitly present in the transcript provided. Do not use outside knowledge or assumptions.
2. EVERY insight (summary point, action item, decision, follow-up) MUST include one or more citations. Each citation references a real "timestamp" and "speaker" from the transcript and a verbatim "quote" copied from that line.
3. NEVER invent attendees, action items, or decisions. If something is not in the transcript, do not include it.
4. If the transcript contains no action items or no decisions, return an empty array for that field rather than inventing entries.
5. Quotes in citations must be copied verbatim from the transcript text. Timestamps and speakers must match exactly.

Return STRICT JSON only, with exactly this shape (no extra keys, no commentary):
{
  "summary": [
    { "text": "...", "citations": [{ "timestamp": "00:10", "speaker": "John", "quote": "..." }] }
  ],
  "actionItems": [
    { "task": "...", "assignee": "...", "dueDate": null, "citations": [{ "timestamp": "...", "speaker": "...", "quote": "..." }] }
  ],
  "decisions": [
    { "decision": "...", "citations": [{ "timestamp": "...", "speaker": "...", "quote": "..." }] }
  ],
  "followUpSuggestions": [
    { "suggestion": "...", "citations": [{ "timestamp": "...", "speaker": "...", "quote": "..." }] }
  ]
}`;

function formatTranscript(transcript: TranscriptEntry[]): string {
  return transcript
    .map((line) => `[${line.timestamp}] ${line.speaker}: ${line.text}`)
    .join('\n');
}

/**
 * Run the Groq model over a transcript and return validated, structured analysis.
 * Throws if the model output cannot be parsed/validated.
 */
export async function analyzeTranscript(
  transcript: TranscriptEntry[],
  meta: { title: string; participants: string[]; meetingDate: Date },
  traceId?: string
): Promise<MeetingAnalysisResult> {
  const userPrompt = `Meeting title: ${meta.title}
Listed participants: ${meta.participants.join(', ') || 'none provided'}
Meeting date: ${meta.meetingDate.toISOString()}

TRANSCRIPT (each line is "[timestamp] speaker: text"):
${formatTranscript(transcript)}

Analyze the transcript above following the strict rules. Return the JSON object only.`;

  logger.info('Calling Groq for transcript analysis', {
    traceId,
    model: MODEL,
    transcriptLines: transcript.length,
  });

  const completion = await getClient().chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('Groq returned an empty response');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Groq returned invalid JSON');
  }

  const result = analysisSchema.safeParse(parsed);
  if (!result.success) {
    logger.error('Groq output failed schema validation', {
      traceId,
      issues: result.error.issues,
    });
    throw new Error('AI analysis did not match the expected schema');
  }

  return result.data;
}
