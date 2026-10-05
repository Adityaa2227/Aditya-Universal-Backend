// ============================================================================
// Form Filler Module - Multi-AI Fallback Engine
// Ported from resume-engine's ai-multi-fallback.js pattern
// Providers: Groq -> Cerebras -> OpenRouter -> Gemini
// ============================================================================

import { logger } from '../../core/utils/logger';
import { AppError } from '../../core/errors/AppError';
import { env } from '../../config/env';

export interface AIProviderConfig {
  groqApiKey?: string;
  cerebrasApiKey?: string;
  openrouterApiKey?: string;
  geminiApiKey?: string;
  groqModel?: string;
  cerebrasModel?: string;
  openrouterModel?: string;
  geminiModel?: string;
}

interface ProviderEntry {
  name: string;
  apiKey: string;
  models: string[];
  call: (args: ProviderCallArgs) => Promise<string>;
}

interface ProviderCallArgs {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
}

export interface MultiFallbackResult {
  text: string;
  provider: string;
  model: string;
}

// ---------------------------------------------------------------------------
// Build the provider chain dynamically from env
// ---------------------------------------------------------------------------
export function getFormFillerProviderChain(config?: AIProviderConfig): ProviderEntry[] {
  const chain: ProviderEntry[] = [];

  const groqKey = config?.groqApiKey || env.GROQ_API_KEY || process.env.GROQ_API_KEY;
  const groqModel = config?.groqModel || (env as Record<string, unknown>)['GROQ_MODEL'] as string || 'openai/gpt-oss-20b';

  const cerebrasKey = config?.cerebrasApiKey || env.CEREBRAS_API_KEY || process.env.CEREBRAS_API_KEY;
  const cerebrasModel = config?.cerebrasModel || (env as Record<string, unknown>)['CEREBRAS_MODEL'] as string || 'llama3.1-70b';

  const openrouterKey = config?.openrouterApiKey || env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
  const openrouterModel = config?.openrouterModel || (env as Record<string, unknown>)['OPENROUTER_MODEL'] as string || 'meta-llama/llama-3.3-70b-instruct:free';

  const geminiKey = config?.geminiApiKey || env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const geminiModel = config?.geminiModel || (env as Record<string, unknown>)['GEMINI_MODEL'] as string || 'gemini-2.5-flash';

  // 1. Groq (Fast inference)
  if (groqKey?.trim()) {
    chain.push({
      name: 'groq',
      apiKey: groqKey.trim(),
      models: [...new Set([groqModel, 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b'].filter(Boolean))],
      call: callGroqProvider,
    });
  }

  // 2. Cerebras Cloud (Ultra-fast 450 tok/s free tier)
  if (cerebrasKey?.trim()) {
    chain.push({
      name: 'cerebras',
      apiKey: cerebrasKey.trim(),
      models: [...new Set([cerebrasModel, 'qwen-3.8-27b', 'gemma-4-31b', 'gpt-oss-120b'].filter(Boolean))],
      call: callCerebrasProvider,
    });
  }

  // 3. OpenRouter (Free models)
  if (openrouterKey?.trim()) {
    chain.push({
      name: 'openrouter',
      apiKey: openrouterKey.trim(),
      models: [...new Set([openrouterModel, 'nvidia/nemotron-3.5-lightning:free', 'liquid/lfm-2.5-2.6b:free'].filter(Boolean))],
      call: callOpenRouterProvider,
    });
  }

  // 4. Google Gemini (Massive free TPM ceiling)
  if (geminiKey?.trim()) {
    chain.push({
      name: 'gemini',
      apiKey: geminiKey.trim(),
      models: [...new Set([geminiModel, 'gemini-2.5-flash', 'gemini-flash-latest'].filter(Boolean))],
      call: callGeminiProvider,
    });
  }

  return chain;
}

// ---------------------------------------------------------------------------
// Execute with cascading fallback - returns text
// ---------------------------------------------------------------------------
export async function executeFormFillerFallbackText({
  systemPrompt = '',
  userPrompt = '',
  temperature = 0.1,
  maxTokens = 400,
  config,
}: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  config?: AIProviderConfig;
}): Promise<MultiFallbackResult> {
  const chain = getFormFillerProviderChain(config);

  if (chain.length === 0) {
    throw new AppError('No AI provider API keys configured. Add GROQ_API_KEY, GEMINI_API_KEY, CEREBRAS_API_KEY, or OPENROUTER_API_KEY to .env', 500, 'INTERNAL_SERVER_ERROR');
  }

  const errors: Array<{ provider: string; model: string; error: string }> = [];

  for (const provider of chain) {
    for (const model of provider.models) {
      try {
        const text = await provider.call({ apiKey: provider.apiKey, model, systemPrompt, userPrompt, temperature, maxTokens });

        if (text && typeof text === 'string' && text.trim().length > 0) {
          logger.debug({ provider: provider.name, model }, '[FormFiller AI] Success');
          return { text: text.trim(), provider: provider.name, model };
        }
      } catch (err: unknown) {
        const error = err as Error & { status?: number };
        const isRateLimit =
          error.status === 429 ||
          /rate.limit|too many requests|tokens per minute/i.test(error.message || '');

        logger.warn(
          { provider: provider.name, model, isRateLimit, error: error.message },
          `[FormFiller AI] Provider failed${isRateLimit ? ' [RATE-LIMITED]' : ''}. Trying next...`,
        );
        errors.push({ provider: provider.name, model, error: error.message });

        // On 429, skip all remaining models for this provider immediately
        if (isRateLimit) break;
      }
    }
  }

  throw new AppError(
    `All AI providers failed for form fill: ${JSON.stringify(errors.map((e) => `${e.provider}/${e.model}: ${e.error}`))}`,
    503,
    'INTERNAL_SERVER_ERROR',
  );
}

// ---------------------------------------------------------------------------
// Provider HTTP Callers
// ---------------------------------------------------------------------------

async function callGroqProvider({ apiKey, model, systemPrompt, userPrompt, temperature, maxTokens }: ProviderCallArgs): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  const body = await res.json() as { error?: { message?: string }; choices?: Array<{ message?: { content?: string } }> };
  if (!res.ok) {
    const err = Object.assign(new Error(body?.error?.message || `Groq HTTP ${res.status}`), { status: res.status });
    throw err;
  }
  return body.choices?.[0]?.message?.content || '';
}

async function callCerebrasProvider({ apiKey, model, systemPrompt, userPrompt, temperature, maxTokens }: ProviderCallArgs): Promise<string> {
  const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model || 'llama3.1-70b',
      temperature,
      max_tokens: maxTokens,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  const body = await res.json() as { error?: { message?: string }; choices?: Array<{ message?: { content?: string } }> };
  if (!res.ok) {
    const err = Object.assign(new Error(body?.error?.message || `Cerebras HTTP ${res.status}`), { status: res.status });
    throw err;
  }
  return body.choices?.[0]?.message?.content || '';
}

async function callOpenRouterProvider({ apiKey, model, systemPrompt, userPrompt, temperature, maxTokens }: ProviderCallArgs): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://aditya-backend.onrender.com',
      'X-Title': 'Aditya Form Filler',
    },
    body: JSON.stringify({
      model: model || 'meta-llama/llama-3.3-70b-instruct:free',
      temperature,
      max_tokens: maxTokens,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  const body = await res.json() as { error?: { message?: string }; choices?: Array<{ message?: { content?: string } }> };
  if (!res.ok) {
    const err = Object.assign(new Error(body?.error?.message || `OpenRouter HTTP ${res.status}`), { status: res.status });
    throw err;
  }
  return body.choices?.[0]?.message?.content || '';
}

async function callGeminiProvider({ apiKey, model, systemPrompt, userPrompt, temperature, maxTokens }: ProviderCallArgs): Promise<string> {
  const effectiveModel = model || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(effectiveModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const combined = systemPrompt ? `${systemPrompt}\n\nUser Request:\n${userPrompt}` : userPrompt;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: combined }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  });
  const body = await res.json() as { error?: { message?: string }; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  if (!res.ok) {
    const err = Object.assign(new Error(body?.error?.message || `Gemini HTTP ${res.status}`), { status: res.status });
    throw err;
  }
  return body.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim() || '';
}
