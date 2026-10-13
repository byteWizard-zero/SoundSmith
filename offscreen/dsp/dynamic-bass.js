/**
 * Dynamic Bass Boost Module for JamesDSP
 * Implements frequency-selective harmonic synthesis and dynamic compression.
 */

export class DynamicBass {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.enabled = false;
    this.bassGainDb = 6.0;      // 0 to 15 dB
    this.cutoffFreq = 100;      // 55 to 200 Hz
    this.harmonics = 0.5;       // 0 to 1 (harmonic intensity)

    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();
    this.dryNode = this.ctx.createGain();
    this.wetNode = this.ctx.createGain();

    // Low-frequency extraction filter
    this.lowpassFilter = this.ctx.createBiquadFilter();
    this.lowpassFilter.type = 'lowpass';
    this.lowpassFilter.frequency.value = this.cutoffFreq;
    this.lowpassFilter.Q.value = 1.0;

    // Harmonic saturator for upper bass perceptual enhancement
    this.harmonicShaper = this.ctx.createWaveShaper();
    this.harmonicShaper.oversample = '2x';
    this._updateHarmonicCurve();

    // Bass dynamics compressor / limiter to avoid flabby blowout
    this.bassCompressor = this.ctx.createDynamicsCompressor();
    this.bassCompressor.threshold.value = -12; // dB
    this.bassCompressor.knee.value = 6;
    this.bassCompressor.ratio.value = 4;
    this.bassCompressor.attack.value = 0.01;
    this.bassCompressor.release.value = 0.1;

    // Bass boost gain
    this.boostGain = this.ctx.createGain();
    this.setGain(this.bassGainDb);

    // Audio Graph Routing:
    // Input -> Dry -> Output
    // Input -> Lowpass -> HarmonicShaper -> Compressor -> BoostGain -> Wet -> Output
    this.inputNode.connect(this.dryNode);
    this.dryNode.connect(this.outputNode);

    this.inputNode.connect(this.lowpassFilter);
    this.lowpassFilter.connect(this.harmonicShaper);
    this.harmonicShaper.connect(this.bassCompressor);
    this.bassCompressor.connect(this.boostGain);
    this.boostGain.connect(this.wetNode);
    this.wetNode.connect(this.outputNode);

    this.updateBypassState();
  }

  _updateHarmonicCurve() {
    const samples = 1024;
    const curve = new Float32Array(samples);
    const h = this.harmonics;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      // Soft saturation with even + odd harmonic blend
      const saturated = Math.tanh(1.5 * x);
      const evenHarmonic = 0.5 * h * (x * x * (x > 0 ? 1 : -1));
      curve[i] = saturated + evenHarmonic;
    }
    this.harmonicShaper.curve = curve;
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.updateBypassState();
  }

  setGain(gainDb) {
    this.bassGainDb = Math.max(0, Math.min(18, gainDb));
    const linearGain = Math.pow(10, this.bassGainDb / 20);
    this.boostGain.gain.setTargetAtTime(linearGain, this.ctx.currentTime, 0.02);
  }

  setCutoff(freq) {
    this.cutoffFreq = Math.max(50, Math.min(250, freq));
    this.lowpassFilter.frequency.setTargetAtTime(this.cutoffFreq, this.ctx.currentTime, 0.02);
  }

  setHarmonics(val) {
    this.harmonics = Math.max(0, Math.min(1, val));
    this._updateHarmonicCurve();
  }

  updateBypassState() {
    const t = this.ctx.currentTime;
    if (this.enabled) {
      this.wetNode.gain.setTargetAtTime(1.0, t, 0.02);
    } else {
      this.wetNode.gain.setTargetAtTime(0.0, t, 0.02);
    }
  }
}
