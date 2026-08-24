// Web Audio API Synthesizer with crystal clear tones

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

  playBeep(freq: number = 880, duration: number = 0.1, type: OscillatorType = 'sine', volume: number = 0.12) {
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

      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio might be blocked until user interaction
    }
  }

  playPredictionCalculated() {
    this.playBeep(587.33, 0.08, 'triangle', 0.1);
    setTimeout(() => this.playBeep(880, 0.12, 'sine', 0.12), 80);
    setTimeout(() => this.playBeep(1174.66, 0.22, 'sine', 0.14), 180);
  }

  playCountdownTick() {
    this.playBeep(440, 0.04, 'sine', 0.05);
  }

  playCriticalTick() {
    this.playBeep(987.77, 0.06, 'triangle', 0.12);
  }

  playWinFanfare() {
    this.playBeep(523.25, 0.12, 'triangle', 0.15);
    setTimeout(() => this.playBeep(659.25, 0.12, 'triangle', 0.15), 110);
    setTimeout(() => this.playBeep(783.99, 0.15, 'triangle', 0.15), 220);
    setTimeout(() => this.playBeep(1046.50, 0.35, 'sine', 0.18), 340);
  }

  playJackpotFanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playBeep(freq, 0.25, 'triangle', 0.18), idx * 80);
    });
  }

  playLossSound() {
    this.playBeep(320, 0.2, 'sawtooth', 0.12);
    setTimeout(() => this.playBeep(220, 0.3, 'sawtooth', 0.12), 160);
  }

  playClick() {
    this.playBeep(800, 0.03, 'sine', 0.05);
  }
}

export const sound = new SoundEngine();
