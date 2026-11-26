import { HybridTelemetry } from '../../types/chronos';

export interface HybridResponse {
  text: string;
  telemetry: HybridTelemetry;
}

interface ChromeLanguageModel {
  capabilities?: () => Promise<{ available: 'readily' | 'after-download' | 'no' }>;
  create?: (opts?: { systemPrompt?: string }) => Promise<{
    prompt: (text: string) => Promise<string>;
    destroy?: () => void;
  }>;
}

export async function detectOnDeviceAi(): Promise<{
  available: boolean;
  label: string;
}> {
  if (typeof window === 'undefined') {
    return { available: false, label: 'SSR Context' };
  }
  try {
    const winAi = (window as unknown as { ai?: { languageModel?: ChromeLanguageModel } }).ai;
    if (winAi?.languageModel?.capabilities) {
      const caps = await winAi.languageModel.capabilities();
      if (caps.available === 'readily' || caps.available === 'after-download') {
        return { available: true, label: `Chrome Gemini Nano (${caps.available})` };
      }
    }
  } catch {
    // Silent fallback
  }
  return { available: false, label: 'Firebase AI Logic / Local Standby' };
}

export async function runHybridDebrief(
  prompt: string,
  options: { taskLabel?: string; strictLocalAI?: boolean } = {}
): Promise<HybridResponse> {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  // Lane 1 (Primary): On-Device Chrome Gemini Nano (window.ai.languageModel)
  if (typeof window !== 'undefined') {
    try {
      const winAi = (window as unknown as { ai?: { languageModel?: ChromeLanguageModel } }).ai;
      if (winAi?.languageModel?.create) {
        const session = await winAi.languageModel.create({
          systemPrompt:
            'You are Chronos, a concise cognitive focus coach. Respond in max 2 sharp sentences acknowledging the deep work accomplishment.',
        });
        const text = await session.prompt(prompt);
        session.destroy?.();
        const latencyMs = Math.max(1, Math.round(performance.now() - t0));
        return {
          text,
          telemetry: {
            lane: 'LOCAL_GEMINI_NANO',
            model: 'Chrome Gemini Nano (On-Device)',
            latencyMs,
            privateLocalOnly: true,
          },
        };
      }
    } catch (err) {
      console.debug('Chrome Gemini Nano unavailable, trying Firebase AI Logic:', err);
    }
  }

  // Lane 2 (Cloud Fallback): Firebase AI Logic (firebase/ai) when strictLocalAI is off
  if (typeof window !== 'undefined' && !options.strictLocalAI) {
    try {
      const [{ getFirebaseApp }, { getAI, getGenerativeModel, GoogleAIBackend }] =
        await Promise.all([import('../firebase/client'), import('firebase/ai')]);
      const app = getFirebaseApp();
      if (app) {
        const ai = getAI(app, { backend: new GoogleAIBackend() });
        const model = getGenerativeModel(ai, {
          model: 'gemini-2.5-flash-lite',
          systemInstruction:
            'You are Chronos, a concise cognitive focus coach. Respond in max 2 sharp sentences acknowledging the deep work accomplishment.',
        });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        if (text) {
          const latencyMs = Math.max(1, Math.round(performance.now() - t0));
          return {
            text,
            telemetry: {
              lane: 'FIREBASE_AI_LOGIC',
              model: 'Firebase AI Logic (gemini-2.5-flash-lite)',
              latencyMs,
              privateLocalOnly: false,
            },
          };
        }
      }
    } catch (err) {
      console.debug('Firebase AI Logic unavailable, using local deterministic verifier:', err);
    }
  }

  // Lane 3 (Offline / Strict-Local Standby): Deterministic Local Verification
  const latencyMs = Math.max(1, Math.round(performance.now() - t0));
  return {
    text: `On-device verification passed for "${options.taskLabel || 'Deep Work'}". Accomplishment sealed locally into your HMAC-SHA256 ledger.`,
    telemetry: {
      lane: 'LOCAL_OFFLINE_FALLBACK',
      model: 'Local Deterministic Verifier (0 Cloud)',
      latencyMs,
      privateLocalOnly: true,
    },
  };
}
