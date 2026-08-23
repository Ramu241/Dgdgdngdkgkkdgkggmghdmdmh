// Lightweight Web Audio API synthesizer for clean futuristic sound effects

class SoundEngine {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  playBeep(freq: number = 880, duration: number = 0.1, type: OscillatorType = 'sine') {
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio might be blocked by browser policy
    }
  }

  playPredictionCalculated() {
    this.playBeep(587.33, 0.08, 'triangle');
    setTimeout(() => this.playBeep(880, 0.15, 'sine'), 90);
    setTimeout(() => this.playBeep(1174.66, 0.25, 'sine'), 200);
  }

  playCountdownTick() {
    this.playBeep(440, 0.05, 'sine');
  }

  playCriticalTick() {
    this.playBeep(987.77, 0.08, 'square');
  }

  playWinFanfare() {
    this.playBeep(523.25, 0.1, 'triangle');
    setTimeout(() => this.playBeep(659.25, 0.1, 'triangle'), 120);
    setTimeout(() => this.playBeep(783.99, 0.15, 'triangle'), 240);
    setTimeout(() => this.playBeep(1046.50, 0.35, 'sine'), 380);
  }
}

export const sound = new SoundEngine();
