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
        return { available: true, label: `Gemini Nano (${caps.available})` };
      }
    }
  } catch {
    // Silent fallback
  }
  return { available: false, label: 'Cloud Standby (gemini-3.5-flash-lite)' };
}

export async function runHybridDebrief(
  prompt: string,
  options: { strictLocalAI?: boolean; taskLabel?: string } = {}
): Promise<HybridResponse> {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  // 1. Primary Lane: Chrome Built-in AI (Gemini Nano)
  if (typeof window !== 'undefined') {
    try {
      const winAi = (window as unknown as { ai?: { languageModel?: ChromeLanguageModel } }).ai;
      if (winAi?.languageModel?.create) {
        const session = await winAi.languageModel.create({
          systemPrompt:
            'You are Chronos, a concise cognitive focus coach. Respond in max 2 sharp sentences plus 1 recall verification question.',
        });
        const text = await session.prompt(prompt);
        session.destroy?.();
        const latencyMs = Math.max(1, Math.round(performance.now() - t0));
        return {
          text,
          telemetry: {
            lane: 'LOCAL_GEMINI_NANO',
            model: 'Gemini Nano (On-Device)',
            latencyMs,
            privateLocalOnly: true,
          },
        };
      }
    } catch (err) {
      console.debug('Gemini Nano lane unavailable:', err);
    }
  }

  // Respect strict local privacy setting
  if (options.strictLocalAI) {
    const latencyMs = Math.max(1, Math.round(performance.now() - t0));
    return {
      text: `Strict Local Mode active: "${options.taskLabel || 'Deep Work'}" logged on-device without cloud transmission. Verify key mental takeaways before spending earned credits.`,
      telemetry: {
        lane: 'LOCAL_OFFLINE_FALLBACK',
        model: 'On-Device Policy Lock',
        latencyMs,
        privateLocalOnly: true,
      },
    };
  }

  // 2. Cloud Lane: Firebase AI Logic / Vertex AI (gemini-3.5-flash-lite)
  try {
    const res = await fetch('/api/hybrid-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, taskLabel: options.taskLabel }),
    });
    if (res.ok) {
      const data = await res.json();
      const latencyMs = Math.max(1, Math.round(performance.now() - t0));
      return {
        text: data.text,
        telemetry: {
          lane: 'CLOUD_GEMINI_3_5_FLASH_LITE',
          model: data.model || 'gemini-3.5-flash-lite',
          latencyMs,
          privateLocalOnly: false,
        },
      };
    }
  } catch {
    // Offline fallback
  }

  const latencyMs = Math.max(1, Math.round(performance.now() - t0));
  return {
    text: `Session "${options.taskLabel || 'Focus Block'}" sealed into local HMAC ledger. Summarize the core concept you solved in one sentence to lock in retention.`,
    telemetry: {
      lane: 'LOCAL_OFFLINE_FALLBACK',
      model: 'Local Deterministic Synthesizer',
      latencyMs,
      privateLocalOnly: true,
    },
  };
}
