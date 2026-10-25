/**
 * Best-effort browser audio and haptics.
 *
 * Every helper reports its outcome instead of swallowing the failure: callers
 * decide whether a blocked sound is worth telling the user about.
 */

/** Safari still ships the constructor under a `webkit` prefix. */
interface WebkitWindow {
  webkitAudioContext?: typeof AudioContext;
}

/** Phones expose vibration outside the standard `Navigator` type. */
interface VibratingNavigator {
  vibrate?: (pattern: number | number[]) => boolean;
}

const REST_SOUND = '/sounds/item-found.mp3';

function audioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
}

/** Short beep through the Web Audio API. Returns false when the API is missing or throws. */
export function playBeep(durationSec = 0.2, volume = 0.3): boolean {
  const Ctx = audioContextCtor();
  if (!Ctx) return false;
  try {
    const context = new Ctx();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.frequency.value = 880;
    gain.gain.value = volume;
    oscillator.start();
    oscillator.stop(context.currentTime + durationSec);
    return true;
  } catch {
    return false;
  }
}

/** Vibration pattern. Returns false when the device has no vibration support. */
export function vibrate(pattern: number | number[]): boolean {
  if (typeof navigator === 'undefined') return false;
  const navigatorWithHaptics = navigator as Navigator & VibratingNavigator;
  if (typeof navigatorWithHaptics.vibrate !== 'function') return false;
  try {
    return navigatorWithHaptics.vibrate(pattern);
  } catch {
    return false;
  }
}

/** Plays a local sound file. Resolves false when playback is blocked or unsupported. */
export async function playSound(src: string = REST_SOUND, volume = 1): Promise<boolean> {
  if (typeof Audio === 'undefined') return false;
  try {
    const sound = new Audio(src);
    sound.volume = volume;
    await sound.play();
    return true;
  } catch {
    return false;
  }
}

/**
 * Primes the audio element during a user gesture so the rest sound can play
 * after a timer (mobile browsers block audio started without one).
 * Returns false when the element cannot even be created.
 */
export function unlockAudio(src: string = REST_SOUND): boolean {
  if (typeof Audio === 'undefined') return false;
  try {
    const sound = new Audio(src);
    sound.volume = 0;
    void sound.play().catch(() => false);
    sound.pause();
    sound.volume = 1;
    return true;
  } catch {
    return false;
  }
}
