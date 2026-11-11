import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_PROMPT_LENGTH = 4000;
const DEFAULT_MODEL = 'gemini-3.8-flash';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function safeGeminiError(err: unknown): { message: string; status: number } {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const status = typeof e.status === 'number' ? e.status : undefined;

    if (status === 401 || status === 403) {
      return {
        message: 'The Gemini API key is missing or invalid. Please check the server configuration.',
        status: 500,
      };
    }

    if (status === 429) {
      return {
        message: 'The AI service is busy or the free-tier rate limit was reached. Please try again shortly.',
        status: 503,
      };
    }

    if (status && status >= 500) {
      return {
        message: 'The AI service is temporarily unavailable. Please try again.',
        status: 502,
      };
    }
  }

  const rawMessage = err instanceof Error ? err.message : 'Unexpected error from the AI service.';
  const sanitized = rawMessage
    .replace(/AIza[^\s"']+/gi, 'AIza***')
    .replace(/AQ\.[^\s"']+/gi, 'AQ.***');
  return { message: sanitized, status: 502 };
}

export async function GET() {
  return jsonResponse({
    endpoint: '/api/ai',
    method: 'POST',
    description: 'Send a prompt and receive an AI-generated response.',
    requiredField: 'prompt (string, max 4000 chars)',
  }, 200);
}

export async function POST(req: NextRequest) {
  let apiKey: string;
  try {
    apiKey = (process.env.GEMINI_API_KEY ?? '').trim();
  } catch {
    return jsonResponse({ error: 'Server configuration error.' }, 500);
  }

  if (!apiKey) {
    return jsonResponse(
      { error: 'Gemini API key is not configured on the server.' },
      500,
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON in request body.' }, 400);
  }

  const prompt = (body as Record<string, unknown>)?.prompt;

  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    return jsonResponse(
      { error: 'A non-empty "prompt" string is required.' },
      400,
    );
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return jsonResponse(
      { error: `Prompt is too long. Maximum length is ${MAX_PROMPT_LENGTH} characters.` },
      400,
    );
  }

  let client: GoogleGenAI;
  try {
    client = new GoogleGenAI({ apiKey });
  } catch {
    return jsonResponse(
      { error: 'Failed to initialize the AI client.' },
      500,
    );
  }

  try {
    const response = await client.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
    });

    const text = response.text ?? '';

    if (!text) {
      return jsonResponse(
        { error: 'The AI returned an empty response. Please try again.' },
        502,
      );
    }

    return jsonResponse({ response: text }, 200);
  } catch (err) {
    const { message, status } = safeGeminiError(err);
    return jsonResponse({ error: message }, status);
  }
}
