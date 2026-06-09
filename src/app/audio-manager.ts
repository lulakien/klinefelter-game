import { getSettings } from "../settings/settings-store.js";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export type SfxType = "click" | "success" | "fail" | "hit" | "swap" | "error" | "levelup";

/** Play a synthesized sfx using the Web Audio API. */
export function playSfx(type: SfxType): void {
  const settings = getSettings();
  if (!settings.audioEnabled || !settings.soundEffectsEnabled) return;

  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    switch (type) {
      case "click":
        osc.type = "sine";
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
        break;

      case "success":
        // Arpeggio sound
        osc.type = "triangle";
        osc.frequency.setValueAtTime(330, now); // E4
        osc.frequency.setValueAtTime(440, now + 0.07); // A4
        osc.frequency.setValueAtTime(554, now + 0.14); // C#5
        osc.frequency.setValueAtTime(660, now + 0.21); // E5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
        break;

      case "fail":
        // Falling tone sound
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.linearRampToValueAtTime(75, now + 0.35);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
        break;

      case "hit":
        // Short low impact
        osc.type = "triangle";
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.18);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
        break;

      case "swap":
        // Tile swap sound - quick chirp
        osc.type = "sine";
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(680, now + 0.06);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
        break;

      case "error":
        // Error buzz - harsh descending tone
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(90, now + 0.15);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
        break;

      case "levelup":
        // Achievement unlocked - ascending arpeggio
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now); // A4
        osc.frequency.setValueAtTime(554, now + 0.08); // C#5
        osc.frequency.setValueAtTime(659, now + 0.16); // E5
        osc.frequency.setValueAtTime(880, now + 0.24); // A5
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
        break;
    }
  } catch (err) {
    // Suppress Web Audio autoplay/blocking errors
  }
}


/** Trigger haptic feedback if enabled and supported. */
export function vibrate(pattern: number | number[]): void {
  const settings = getSettings();
  if (!settings.vibrationEnabled) return;
  if ("vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}
