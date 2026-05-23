export class AudioManager {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  playLaunch() {
    this.playTone(220, 0.08, 'sine', 0.15);
  }

  playMerge(level: number) {
    const freq = 260 + level * 80;
    this.playTone(freq, 0.3, 'sine', 0.25);
    setTimeout(() => this.playTone(freq * 1.25, 0.2, 'sine', 0.2), 80);
  }

  playGameOver() {
    this.playTone(200, 0.4, 'sawtooth', 0.5);
    setTimeout(() => this.playTone(150, 0.4, 'sawtooth', 0.5), 300);
    setTimeout(() => this.playTone(100, 0.6, 'sawtooth', 0.8), 600);
  }

  private playTone(freq: number, volume: number, type: OscillatorType, duration: number) {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }
}
