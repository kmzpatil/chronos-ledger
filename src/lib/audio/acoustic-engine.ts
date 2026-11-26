import { RingtoneStyle } from '../../types/chronos';

export interface AcousticAlertEvent {
  id: string;
  title: string;
  subtitle: string;
  kind: 'warning' | 'expired' | 'complete';
  canLockEarly?: boolean;
}

type AlertListener = (event: AcousticAlertEvent) => void;
type NoiseListener = (playing: boolean) => void;

class AcousticEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private volume = 0.75;
  private style: RingtoneStyle = 'BRAUN_CHIME';
  private listeners = new Set<AlertListener>();
  private noiseListeners = new Set<NoiseListener>();
  private noiseBuffer: AudioBuffer | null = null;

  // Ambient Brown Noise state
  private brownSource: AudioBufferSourceNode | null = null;
  private brownGain: GainNode | null = null;
  private brownActive = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public configure(opts: { enabled?: boolean; volume?: number; style?: RingtoneStyle }) {
    if (typeof opts.enabled === 'boolean') {
      this.enabled = opts.enabled;
      if (!opts.enabled && this.brownActive) {
        this.stopBrownNoise();
      }
    }
    if (typeof opts.volume === 'number') {
      this.volume = Math.max(0, Math.min(1, opts.volume));
      if (this.brownGain && this.ctx) {
        this.brownGain.gain.setTargetAtTime(0.14 * this.volume, this.ctx.currentTime, 0.08);
      }
    }
    if (opts.style) this.style = opts.style;
  }

  public onAlert(listener: AlertListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public onBrownNoiseChange(listener: NoiseListener): () => void {
    this.noiseListeners.add(listener);
    return () => this.noiseListeners.delete(listener);
  }

  public isBrownNoisePlaying(): boolean {
    return this.brownActive;
  }

  private emitAlert(event: AcousticAlertEvent) {
    this.listeners.forEach((fn) => fn(event));
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const length = Math.floor(ctx.sampleRate * 0.02);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.004));
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  /**
   * Warm Ambient Brown Noise Generator (filtered low-rumble focus masking)
   */
  public startBrownNoise() {
    if (!this.enabled || this.brownActive) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const bufferSize = ctx.sampleRate * 4; // 4s seamless loop
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.14 * this.volume, ctx.currentTime + 0.45);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    this.brownSource = src;
    this.brownGain = gain;
    this.brownActive = true;
    this.noiseListeners.forEach((fn) => fn(true));
  }

  public stopBrownNoise() {
    if (!this.brownActive) return;
    const ctx = this.ctx;
    const src = this.brownSource;
    const gain = this.brownGain;

    this.brownSource = null;
    this.brownGain = null;
    this.brownActive = false;
    this.noiseListeners.forEach((fn) => fn(false));

    if (ctx && gain && src) {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      setTimeout(() => {
        try {
          src.stop();
          src.disconnect();
        } catch {
          // already stopped
        }
      }, 280);
    }
  }

  public toggleBrownNoise(): boolean {
    if (this.brownActive) {
      this.stopBrownNoise();
    } else {
      this.startBrownNoise();
    }
    return this.brownActive;
  }

  private playTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    durationSec: number,
    gainPeak: number,
    waveform: OscillatorType = 'triangle',
    addSubHarmonic = true
  ) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = waveform;
    osc.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 3.8, startTime);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(220, freq * 1.4),
      startTime + durationSec
    );

    const scaledGain = gainPeak * this.volume;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(scaledGain, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + durationSec + 0.02);

    if (addSubHarmonic) {
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(freq * 0.5, startTime);

      subGain.gain.setValueAtTime(0.0001, startTime);
      subGain.gain.linearRampToValueAtTime(scaledGain * 0.35, startTime + 0.01);
      subGain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start(startTime);
      sub.stop(startTime + durationSec + 0.02);
    }
  }

  public playPassWarningRingtone(opts?: {
    overrideStyle?: RingtoneStyle;
    domainLabel?: string;
    silentToastOnly?: boolean;
  }) {
    const style = opts?.overrideStyle || this.style;
    const domain = opts?.domainLabel || 'Active Pass';

    this.emitAlert({
      id: `warn_${Date.now()}`,
      title: `${domain} — 2m Remaining`,
      subtitle: 'Wrap up and lock early to refund unused credits.',
      kind: 'warning',
      canLockEarly: true,
    });

    if (!this.enabled || opts?.silentToastOnly) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + 0.02;
    const notes =
      style === 'MARIMBA_PULSE'
        ? [349.23, 440.0, 523.25, 659.25]
        : style === 'MINIMAL_BELL'
        ? [523.25, 659.25, 783.99, 987.77]
        : [349.23, 440.0, 523.25, 659.25];

    const stepGap = style === 'MARIMBA_PULSE' ? 0.13 : 0.16;
    const release = style === 'MINIMAL_BELL' ? 0.55 : 0.42;
    const wave: OscillatorType = style === 'MINIMAL_BELL' ? 'sine' : 'triangle';

    [0, 1.2 + notes.length * stepGap].forEach((cycleOffset) => {
      notes.forEach((freq, i) => {
        this.playTone(ctx, freq, now + cycleOffset + i * stepGap, release, 0.14, wave, true);
      });
    });
  }

  public playPassExpiredTone(domainLabel = 'Shield') {
    this.emitAlert({
      id: `exp_${Date.now()}`,
      title: `${domainLabel} Shield Re-Engaged`,
      subtitle: 'Timed unlock cleared. Domain enforcement locked.',
      kind: 'expired',
      canLockEarly: false,
    });

    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + 0.01;
    this.playTone(ctx, 293.66, now, 0.28, 0.16, 'triangle', true);
    this.playTone(ctx, 196.0, now + 0.14, 0.45, 0.18, 'triangle', true);
    this.playTickInternal(ctx, now + 0.14, 0.08);
  }

  public playFocusCompleteChime(earnedCR?: number) {
    this.emitAlert({
      id: `comp_${Date.now()}`,
      title: 'Focus Chamber Sealed Complete',
      subtitle: earnedCR
        ? `+${earnedCR} CR ready to mint after AI debrief.`
        : 'Complete 2-sentence debrief to mint credits.',
      kind: 'complete',
      canLockEarly: false,
    });

    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + 0.02;
    const chord = [261.63, 392.0, 587.33, 659.25];
    chord.forEach((freq, idx) => {
      this.playTone(ctx, freq, now + idx * 0.045, 0.95, 0.11, 'triangle', idx === 0);
    });
  }

  private playTickInternal(ctx: AudioContext, atTime: number, amp = 0.05) {
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, atTime);
    filter.Q.setValueAtTime(1.8, atTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(amp * this.volume, atTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, atTime + 0.012);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    src.start(atTime);
    src.stop(atTime + 0.016);
  }

  public playTick() {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.playTickInternal(ctx, ctx.currentTime, 0.06);
  }

  public playVaultEngage(progress = 1) {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.playTickInternal(ctx, now, 0.05);
    if (progress >= 1) {
      this.playTone(ctx, 392.0, now, 0.18, 0.1, 'sine', false);
      this.playTone(ctx, 587.33, now + 0.06, 0.28, 0.12, 'sine', false);
    }
  }
}

export const acousticEngine = new AcousticEngine();
