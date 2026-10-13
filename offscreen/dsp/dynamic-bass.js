/**
 * Dynamic Bass Boost Module for SoundSmith
 * Matches RootlessJamesDSP PARAM_BASS_BOOST_* (118, 120).
 * Maximum Gain range: 3.0 dB to 15.0 dB (step 1.0 dB).
 */

export class DynamicBass {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.enabled = false;
    this.maxGainDb = 5.0; // 3.0 to 15.0 dB (Default: 5.0 dB)
    this.cutoffFreq = 100;

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
    this.harmonicShaper.oversample = '4x';
    this._updateHarmonicCurve();

    // Bass dynamics compressor
    this.bassCompressor = this.ctx.createDynamicsCompressor();
    this.bassCompressor.threshold.value = -12;
    this.bassCompressor.knee.value = 4;
    this.bassCompressor.ratio.value = 4;
    this.bassCompressor.attack.value = 0.01;
    this.bassCompressor.release.value = 0.08;

    this.boostGain = this.ctx.createGain();
    this.setMaxGain(this.maxGainDb);

    // Audio Graph Routing:
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
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      const saturated = Math.tanh(1.6 * x);
      const evenHarmonic = 0.4 * (x * x * (x > 0 ? 1 : -1));
      curve[i] = saturated + evenHarmonic;
    }
    this.harmonicShaper.curve = curve;
  }

  setMaxGain(gainDb) {
    this.maxGainDb = Math.max(3.0, Math.min(15.0, gainDb));
    const linearGain = Math.pow(10, this.maxGainDb / 20);
    this.boostGain.gain.value = linearGain;
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.updateBypassState();
  }

  updateBypassState() {
    this.wetNode.gain.value = this.enabled ? 1.0 : 0.0;
  }
}
