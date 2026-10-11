/**
 * Web Audio API chime generator and haptic vibration for queue calls & alerts
 * نغمات تنبيه واهتزاز للهواتف وشاشات العرض بدون ملفات خارجية
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a welcoming pickup chime (Ding-Dong / تكتين تنبيه واضحتين)
 */
export function playCallChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // First tone (higher pitch)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Second tone (lower pitch, pleasant resolution)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(440.0, now + 0.25); // A4
    gain2.gain.setValueAtTime(0.35, now + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.25);
    osc2.stop(now + 0.9);
  } catch (err) {
    console.warn("Audio chime failed to play:", err);
  }
}

/**
 * Play an urgent attention chime (ثلاث نغمات تنبيه للنداء المتكرر)
 */
export function playUrgentChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.15);
      gain.gain.setValueAtTime(0.3, now + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 0.4);
    });
  } catch (err) {
    console.warn("Urgent chime failed:", err);
  }
}

/**
 * Unlock audio context on user interaction to comply with mobile autoplay policies
 */
export function unlockAudioContext() {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume();
    }
  } catch {}
}

/**
 * Play a high-impact, loud alert sequence when a driver's turn is called (تنبيه قوي وواضح للمندوب)
 * Designed for noisy warehouse environments and motorcycles.
 */
export function playDriverTurnAlert() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Pattern: 2 rounds of distinct high-pitch attention alert bursts
    const bursts = [
      // Burst 1 (0.0s - 0.45s)
      { freq: 880, start: 0.0, dur: 0.12, type: "sine" as OscillatorType, vol: 0.7 },
      { freq: 1174.66, start: 0.14, dur: 0.12, type: "triangle" as OscillatorType, vol: 0.75 },
      { freq: 1567.98, start: 0.28, dur: 0.18, type: "sine" as OscillatorType, vol: 0.8 },
      // Burst 2 (0.55s - 1.05s) - repeat with higher impact
      { freq: 880, start: 0.55, dur: 0.12, type: "sine" as OscillatorType, vol: 0.75 },
      { freq: 1174.66, start: 0.69, dur: 0.12, type: "triangle" as OscillatorType, vol: 0.8 },
      { freq: 1760.0, start: 0.83, dur: 0.25, type: "triangle" as OscillatorType, vol: 0.85 },
    ];

    bursts.forEach(({ freq, start, dur, type, vol }) => {
      const t = now + start;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);

      // Fast attack, smooth decay
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + dur);
    });

    // Intense mobile vibration pattern: long pulses
    triggerVibration([500, 200, 500, 200, 800, 300, 800]);
  } catch (err) {
    console.warn("Driver turn alert failed to play:", err);
  }
}

/**
 * Trigger mobile haptic vibration
 */
export function triggerVibration(pattern: number[] = [200, 100, 200, 100, 400]) {
  if (typeof window !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors if blocked by browser policy
    }
  }
}
