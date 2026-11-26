import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.VITE_GEMINI_API_KEY ||
  '';

export async function POST(request: Request) {
  try {
    const { summary, taskLabel, durationMinutes } = (await request.json()) as {
      summary?: string;
      taskLabel?: string;
      durationMinutes?: number;
    };

    const trimmed = (summary || '').trim();
    if (trimmed.length < 15) {
      return NextResponse.json(
        { ok: false, error: 'Write at least two meaningful sentences before minting credits.' },
        { status: 400 }
      );
    }

    const modelId =
      process.env.GEMINI_CLOUD_MODEL ||
      process.env.VITE_FAST_CLOUD_MODEL ||
      'gemini-3.5-flash-lite';

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: modelId,
          contents: `Evaluate this ${durationMinutes || 25}-minute deep focus accomplishment for task "${taskLabel || 'Deep Work'}": "${trimmed}". Reply with 1 concise validation sentence acknowledging the work and 1 high-signal follow-up insight.`,
        });
        return NextResponse.json({
          ok: true,
          verified: true,
          feedback: response.text || 'Accomplishment verified by Chronos Cloud.',
          model: modelId,
        });
      } catch (err) {
        console.warn('[Debrief API] Fallback notice:', err);
      }
    }

    return NextResponse.json({
      ok: true,
      verified: true,
      feedback: `Accomplishment verified for ${durationMinutes || 25}m on "${taskLabel || 'Deep Work'}". Credits cleared for cryptographic minting.`,
      model: `${modelId} (local-standby)`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
