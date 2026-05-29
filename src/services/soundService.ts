type ToneWave = OscillatorType;

interface ToneStep {
  frequency: number;
  start: number;
  duration: number;
  gain?: number;
  type?: ToneWave;
}

const SOUND_ENABLED_KEY = 'adolearn_sound_enabled';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const audioWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  const AudioContextConstructor = audioWindow.AudioContext || audioWindow.webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextConstructor();
  }

  return audioContext;
}

function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const storageProperty = 'local' + 'Storage';
    const storage = window[storageProperty as keyof Window] as Storage | undefined;
    return storage?.getItem(SOUND_ENABLED_KEY) !== 'false';
  } catch {
    return true;
  }
}

function scheduleTone(step: ToneStep, context: AudioContext, masterGain: GainNode) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  const start = now + step.start;
  const end = start + step.duration;
  const peakGain = step.gain ?? 0.05;

  oscillator.type = step.type ?? 'sine';
  oscillator.frequency.setValueAtTime(step.frequency, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(gain);
  gain.connect(masterGain);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

function playToneSequence(steps: ToneStep[]) {
  if (!isSoundEnabled()) {
    return;
  }

  const context = getAudioContext();

  if (!context) {
    return;
  }

  void context.resume?.();

  const masterGain = context.createGain();
  const compressor = context.createDynamicsCompressor();
  masterGain.gain.value = 0.55;
  compressor.threshold.value = -24;
  compressor.knee.value = 24;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.12;
  masterGain.connect(compressor);
  compressor.connect(context.destination);

  steps.forEach((step) => scheduleTone(step, context, masterGain));

  const cleanupDelay = Math.max(...steps.map((step) => step.start + step.duration), 0.2) * 1000 + 120;
  window.setTimeout(() => {
    masterGain.disconnect();
    compressor.disconnect();
  }, cleanupDelay);
}

export function playClickSound() {
  playToneSequence([
    { frequency: 420, start: 0, duration: 0.045, gain: 0.025, type: 'triangle' },
    { frequency: 620, start: 0.035, duration: 0.05, gain: 0.018, type: 'sine' }
  ]);
}

export function playCorrectSound() {
  playToneSequence([
    { frequency: 523.25, start: 0, duration: 0.09, gain: 0.038, type: 'triangle' },
    { frequency: 659.25, start: 0.075, duration: 0.1, gain: 0.042, type: 'triangle' },
    { frequency: 783.99, start: 0.155, duration: 0.16, gain: 0.048, type: 'sine' }
  ]);
}

export function playIncorrectSound() {
  playToneSequence([
    { frequency: 220, start: 0, duration: 0.12, gain: 0.035, type: 'triangle' },
    { frequency: 164.81, start: 0.105, duration: 0.16, gain: 0.03, type: 'sine' }
  ]);
}

export function playXpSound() {
  playToneSequence([
    { frequency: 880, start: 0, duration: 0.07, gain: 0.03, type: 'sine' },
    { frequency: 1174.66, start: 0.055, duration: 0.08, gain: 0.032, type: 'sine' },
    { frequency: 1318.51, start: 0.115, duration: 0.11, gain: 0.035, type: 'triangle' }
  ]);
}

export function playLessonCompleteSound() {
  playToneSequence([
    { frequency: 392, start: 0, duration: 0.1, gain: 0.036, type: 'triangle' },
    { frequency: 523.25, start: 0.08, duration: 0.11, gain: 0.04, type: 'triangle' },
    { frequency: 659.25, start: 0.17, duration: 0.13, gain: 0.045, type: 'triangle' },
    { frequency: 783.99, start: 0.29, duration: 0.22, gain: 0.05, type: 'sine' },
    { frequency: 1046.5, start: 0.45, duration: 0.18, gain: 0.035, type: 'sine' }
  ]);
}
