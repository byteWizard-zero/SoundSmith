/**
 * Master Gain and Safety Limiter Module for JamesDSP
 * Provides input preamp trim and output brickwall peak limiting.
 */

export class MasterLimiter {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.preampGainDb = 0.0; // -12dB to +12dB

    // Input Preamp Stage (connects to head of effect chain)
    this.preampNode = this.ctx.createGain();
    this.setPreampGain(0.0);

    // Output Safety Brickwall Limiter (connects to tail of effect chain)
    this.limiterNode = this.ctx.createDynamicsCompressor();
    this.limiterNode.threshold.value = -0.5; // Catch everything below -0.5 dBFS
    this.limiterNode.knee.value = 0.0;       // Hard brickwall knee
    this.limiterNode.ratio.value = 20.0;     // High compression ratio
    this.limiterNode.attack.value = 0.002;
    this.limiterNode.release.value = 0.05;

    // NOTE: preampNode and limiterNode are purposely NOT connected together here.
    // They are connected at opposite ends of the DSP chain in dsp-engine.js.
  }

  setPreampGain(gainDb) {
    this.preampGainDb = Math.max(-15, Math.min(15, gainDb));
    const linearGain = Math.pow(10, this.preampGainDb / 20);
    this.preampNode.gain.value = linearGain;
  }

  setThreshold(thresholdDb) {
    this.thresholdDb = Math.max(-12, Math.min(0, thresholdDb));
    this.limiterNode.threshold.setTargetAtTime(this.thresholdDb, this.ctx.currentTime, 0.02);
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    const t = this.ctx.currentTime;
    if (this.enabled) {
      this.limiterNode.threshold.setTargetAtTime(this.thresholdDb || -0.5, t, 0.02);
      this.limiterNode.ratio.setTargetAtTime(20.0, t, 0.02);
    } else {
      this.limiterNode.threshold.setTargetAtTime(0.0, t, 0.02);
      this.limiterNode.ratio.setTargetAtTime(1.0, t, 0.02);
    }
  }
}
