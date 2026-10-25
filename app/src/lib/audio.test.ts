import { afterEach, describe, expect, it, vi } from 'vitest';
import { playBeep, playSound, resetAudioForTesting, unlockAudio, vibrate } from './audio';

function stubBeep(available: boolean, options: { throws?: boolean } = {}) {
  const oscillator = { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: { value: 0 } };
  const gain = { connect: vi.fn(), gain: { value: 0 } };
  const context = {
    destination: {},
    currentTime: 0,
    createOscillator: () => oscillator,
    createGain: () => gain,
  };
  class FakeAudioContext {
    destination = context.destination;
    currentTime = 0;
    createOscillator() {
      if (options.throws) throw new Error('no audio device');
      return context.createOscillator();
    }
    createGain() {
      return context.createGain();
    }
  }
  vi.stubGlobal('window', available ? { AudioContext: FakeAudioContext } : {});
  return { oscillator, gain };
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetAudioForTesting();
});

describe('playBeep', () => {
  it('reports true when the Web Audio API plays the beep', () => {
    const { oscillator, gain } = stubBeep(true);

    expect(playBeep(0.2, 0.3)).toBe(true);
    expect(oscillator.start).toHaveBeenCalledOnce();
    expect(gain.gain.value).toBe(0.3);
  });

  it('reports false when the browser has no AudioContext', () => {
    stubBeep(false);

    expect(playBeep()).toBe(false);
  });

  it('reports false instead of throwing when the device has no audio output', () => {
    stubBeep(true, { throws: true });

    expect(playBeep()).toBe(false);
  });
});

describe('vibrate', () => {
  it('reports false when the navigator cannot vibrate', () => {
    vi.stubGlobal('navigator', {});

    expect(vibrate([100])).toBe(false);
  });

  it('forwards the pattern and reports the device answer', () => {
    const impl = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate: impl });

    expect(vibrate([180, 90])).toBe(true);
    expect(impl).toHaveBeenCalledWith([180, 90]);
  });

  it('reports false when the vibration call throws', () => {
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('blocked');
      },
    });

    expect(vibrate(100)).toBe(false);
  });
});

describe('playSound', () => {
  it('reports false when there is no audio element support', async () => {
    vi.stubGlobal('Audio', undefined);

    await expect(playSound()).resolves.toBe(false);
  });

  it('reports false when playback is blocked', async () => {
    class BlockedAudio {
      volume = 1;
      play() {
        return Promise.reject(new Error('blocked'));
      }
    }
    vi.stubGlobal('Audio', BlockedAudio);

    await expect(playSound()).resolves.toBe(false);
  });

  it('reports true when the sound plays', async () => {
    class PlayingAudio {
      volume = 0;
      play() {
        return Promise.resolve();
      }
      pause() {}
    }
    vi.stubGlobal('Audio', PlayingAudio);

    await expect(playSound()).resolves.toBe(true);
  });
});

describe('unlockAudio', () => {
  it('reports false when the audio element cannot be created', () => {
    vi.stubGlobal('Audio', undefined);

    expect(unlockAudio()).toBe(false);
  });

  it('primes one muted element and restores its volume', () => {
    const calls: string[] = [];
    class PrimedAudio {
      volume = 1;
      play() {
        calls.push(`play:${this.volume}`);
        return Promise.resolve();
      }
      pause() {
        calls.push(`pause:${this.volume}`);
      }
    }
    vi.stubGlobal('Audio', PrimedAudio);

    expect(unlockAudio()).toBe(true);
    expect(calls).toEqual(['play:0', 'pause:0']);
  });

  it('primes the same element that later plays the sound', async () => {
    const played: string[] = [];
    class SharedAudio {
      volume = 1;
      play() {
        played.push(`play:${this.volume}`);
        return Promise.resolve();
      }
      pause() {}
    }
    vi.stubGlobal('Audio', SharedAudio);

    unlockAudio();
    await playSound(undefined, 0.8);

    expect(played).toEqual(['play:0', 'play:0.8']);
  });
});
