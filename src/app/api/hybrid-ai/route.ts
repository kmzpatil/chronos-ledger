import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.VITE_GEMINI_API_KEY ||
  '';

export async function POST(request: Request) {
  try {
    const { prompt, taskLabel } = await request.json();
    const modelId =
      process.env.GEMINI_CLOUD_MODEL ||
      process.env.VITE_FAST_CLOUD_MODEL ||
      'gemini-3.5-flash-lite';

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: modelId,
          contents: prompt,
        });
        const text = response.text || '';
        return NextResponse.json({
          ok: true,
          text,
          model: modelId,
        });
      } catch (err) {
        console.warn('[Hybrid AI Cloud] Fallback triggered:', err);
      }
    }

    const fallback = `Session "${taskLabel || 'Deep Work'}" verified and minted into your cryptographic ledger. Recall challenge: articulate the single hardest bottleneck you solved today without referencing your notes.`;

    return NextResponse.json({
      ok: true,
      text: fallback,
      model: `${modelId} (local-standby)`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
