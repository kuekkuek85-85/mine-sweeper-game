/** 효과음과 진동. 설정에서 끌 수 있고, 지원하지 않는 기기에서는 조용히 무시된다. */

type Tone = 'open' | 'flag' | 'win' | 'lose' | 'blocked';

const TONES: Record<Tone, { freq: number; duration: number; type: OscillatorType }> = {
  open: { freq: 660, duration: 0.05, type: 'triangle' },
  flag: { freq: 880, duration: 0.06, type: 'square' },
  win: { freq: 1046, duration: 0.35, type: 'sine' },
  lose: { freq: 160, duration: 0.4, type: 'sawtooth' },
  blocked: { freq: 220, duration: 0.08, type: 'sine' },
};

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!context) context = new Ctor();
  if (context.state === 'suspended') void context.resume();
  return context;
}

export function playTone(tone: Tone, enabled: boolean): void {
  if (!enabled) return;
  try {
    const audio = getContext();
    if (!audio) return;
    const { freq, duration, type } = TONES[tone];
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = freq;
    gain.gain.setValueAtTime(0.08, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  } catch {
    /* 소리 재생 실패는 무시 */
  }
}

export function vibrate(pattern: number | number[], enabled: boolean): void {
  if (!enabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* 진동 미지원 기기 무시 */
  }
}
