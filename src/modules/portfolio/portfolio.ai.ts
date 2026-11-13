// ============================================================================
// Portfolio Module - AI project drafting
// ----------------------------------------------------------------------------
// Turns raw notes about a project into every field of the project form.
// Reuses the form-filler's multi-provider fallback (Groq -> Cerebras ->
// OpenRouter -> Gemini), so it needs no extra API keys.
// ============================================================================

import { z } from 'zod';
import { executeFormFillerFallbackText } from '../form-filler/form-filler.ai';
import { AppError } from '../../core/errors/AppError';

const SYSTEM_PROMPT = `You write project case studies for the portfolio of Aditya Agarwal, a software engineer (backend, full-stack and GenAI).
You get his raw, unstructured notes about one project. Turn them into polished portfolio content.

Rules:
- Use only facts from the notes. Never invent numbers, users, companies, links or technologies. If the notes give no numbers, return an empty "metrics" array.
- Write in first person ("I built..."), plain and specific, no hype words ("revolutionary", "cutting-edge", "seamless").
- Copy any URLs from the notes into the matching link field; otherwise use "".
- Reply with ONE JSON object and nothing else (no markdown fences), with exactly these keys:
{
  "title": "short product name",
  "category": "one of: Full Stack, Backend, Frontend, GenAI, Mobile, E-commerce, Tool, Game, Other",
  "shortDescription": "one sentence, max 160 characters, for project cards",
  "description": "overview paragraph, 2-4 sentences",
  "problem": "the problem it solves, 1-3 sentences",
  "solution": "what I built and how, 2-4 sentences",
  "features": ["4-7 key features, each one short line"],
  "metrics": ["impact numbers from the notes only, e.g. '500+ daily users'"],
  "technologies": ["technologies named or clearly implied by the notes"],
  "liveLink": "",
  "githubLink": "",
  "youtubeVideoUrl": ""
}`;

const str = (max: number) =>
  z.coerce
    .string()
    .trim()
    .transform((v) => v.slice(0, max))
    .catch('');
const list = (maxItems: number) =>
  z
    .array(z.coerce.string().trim())
    .transform((v) => v.filter(Boolean).slice(0, maxItems))
    .catch([]);
const url = z.coerce
  .string()
  .trim()
  .transform((v) => (/^https?:\/\//i.test(v) ? v : ''))
  .catch('');

const draftSchema = z.object({
  title: str(120),
  category: str(40),
  shortDescription: str(200),
  description: str(3000),
  problem: str(3000),
  solution: str(3000),
  features: list(10),
  metrics: list(6),
  technologies: list(20),
  liveLink: url,
  githubLink: url,
  youtubeVideoUrl: url,
});

export type ProjectDraft = z.infer<typeof draftSchema>;

/** Pulls the first {...} block out of a model reply (tolerates code fences or chatter around it). */
const extractJson = (text: string): unknown => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object in reply');
  return JSON.parse(text.slice(start, end + 1));
};

export const draftProjectFromNotes = async (
  notes: string,
): Promise<{ draft: ProjectDraft; provider: string; model: string }> => {
  const result = await executeFormFillerFallbackText({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Raw notes:\n"""\n${notes}\n"""`,
    temperature: 0.4,
    maxTokens: 1800,
  });

  let parsed: unknown;
  try {
    parsed = extractJson(result.text);
  } catch {
    throw new AppError(
      'The AI reply couldn’t be read. Try again, or add a bit more detail to your notes.',
      502,
      'INTERNAL_SERVER_ERROR',
    );
  }

  const draft = draftSchema.parse(parsed);
  if (!draft.title && !draft.description) {
    throw new AppError(
      'The AI couldn’t make a draft from these notes. Add a bit more detail and try again.',
      422,
      'BAD_REQUEST',
    );
  }
  return { draft, provider: result.provider, model: result.model };
};

// ----------------------------------------------------------------------------
// Reply drafts for contact messages
// ----------------------------------------------------------------------------

const REPLY_PROMPT = `You draft email replies for Aditya Agarwal, a software engineer (backend, full-stack, GenAI; ex-SWE intern at PayPal; B.Tech CSE at BIT Mesra), answering messages sent through his portfolio's contact form.

Rules:
- Warm, professional and brief (60-150 words). Plain text, no markdown.
- Answer what they asked. Never invent commitments, dates, prices, availability or facts about Aditya beyond the profile above; where a decision is needed, propose a call or ask a clarifying question.
- If the message is spam, abusive or empty, return a short polite acknowledgement.
- Sign off as "Aditya".
- Reply with ONE JSON object and nothing else: {"subject": "Re: ...", "body": "..."}`;

const replySchema = z.object({ subject: str(200), body: str(5000) });

export const draftReply = async (msg: {
  name: string;
  subject: string;
  message: string;
}): Promise<{ subject: string; body: string }> => {
  const result = await executeFormFillerFallbackText({
    systemPrompt: REPLY_PROMPT,
    userPrompt: `From: ${msg.name}\n${msg.subject ? `Subject: ${msg.subject}\n` : ''}Message:\n"""\n${msg.message.slice(0, 8000)}\n"""`,
    temperature: 0.5,
    maxTokens: 700,
  });
  let parsed: z.infer<typeof replySchema>;
  try {
    parsed = replySchema.parse(extractJson(result.text));
  } catch {
    throw new AppError('The AI reply couldn’t be read. Try again.', 502, 'INTERNAL_SERVER_ERROR');
  }
  if (!parsed.body)
    throw new AppError('The AI returned an empty reply. Try again.', 502, 'INTERNAL_SERVER_ERROR');
  const fallback = `Re: ${msg.subject || 'your message'}`;
  const subject = !parsed.subject || /\(none\)/i.test(parsed.subject) ? fallback : parsed.subject;
  return { subject, body: parsed.body };
};

// ----------------------------------------------------------------------------
// Light polish for review text (typos and grammar only)
// ----------------------------------------------------------------------------

const POLISH_PROMPT = `You lightly proofread a testimonial that someone wrote about Aditya Agarwal for his portfolio.
Fix spelling, grammar, punctuation and capitalisation only. Keep the writer's words, meaning, tone and length. Do not add praise, facts or sentences, and do not remove any. If it is already fine, return it unchanged.
Reply with ONE JSON object and nothing else: {"message": "..."}`;

export const polishReview = async (message: string): Promise<string> => {
  const result = await executeFormFillerFallbackText({
    systemPrompt: POLISH_PROMPT,
    userPrompt: `"""\n${message.slice(0, 6000)}\n"""`,
    temperature: 0.1,
    maxTokens: 1200,
  });
  let polished = '';
  try {
    polished = z.object({ message: str(6000) }).parse(extractJson(result.text)).message;
  } catch {
    throw new AppError('The AI reply couldn’t be read. Try again.', 502, 'INTERNAL_SERVER_ERROR');
  }
  return polished || message;
};
