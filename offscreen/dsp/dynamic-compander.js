/**
 * Multi-Band Dynamic Compander for SoundSmith
 * Implements RootlessJamesDSP PARAM_COMPANDER_* (121, 123, 124).
 * 7-Band dynamic spectral processing with selectable time-frequency transform.
 */

export const COMPANDER_CROSSOVERS = [95, 200, 400, 800, 1600, 3400, 7500];

export class DynamicCompander {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.enabled = false;
    this.timeConstant = 0.22; // 0.06s to 0.30s
    this.granularity = 0;     // 0 to 4
    this.tfTransform = 0;     // 0: STFT, 1: Wavelet, 2: Undersampling, 3: Time Domain

    // 7 band ratios/gains (-1.2 to +1.2)
    this.ratios = new Float32Array(7).fill(0.0);

    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();
    this.bypassNode = this.ctx.createGain();
    this.effectNode = this.ctx.createGain();

    this.bands = [];
    this._buildMultibandMatrix();

    // Wiring
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);

    this.inputNode.connect(this.effectNode);

    this.updateBypassState();
  }

  _buildMultibandMatrix() {
    this.bands.forEach(b => {
      b.filter.disconnect();
      b.comp.disconnect();
      b.gain.disconnect();
    });
    this.bands = [];

    const freqs = COMPANDER_CROSSOVERS;

    for (let i = 0; i < 7; i++) {
      const filter = this.ctx.createBiquadFilter();
      if (i === 0) {
        filter.type = 'lowpass';
        filter.frequency.value = freqs[0];
      } else if (i === 6) {
        filter.type = 'highpass';
        filter.frequency.value = freqs[6];
      } else {
        filter.type = 'bandpass';
        filter.frequency.value = (freqs[i - 1] + freqs[i]) / 2;
        filter.Q.value = 1.0;
      }

      const comp = this.ctx.createDynamicsCompressor();
      comp.attack.value = Math.max(0.005, this.timeConstant * 0.1);
      comp.release.value = Math.max(0.05, this.timeConstant);
      comp.threshold.value = -16.0;
      comp.ratio.value = 2.0;

      const gain = this.ctx.createGain();
      gain.gain.value = 1.0;

      // effectNode -> filter -> comp -> gain -> outputNode
      this.effectNode.connect(filter);
      filter.connect(comp);
      comp.connect(gain);
      gain.connect(this.outputNode);

      this.bands.push({ filter, comp, gain });
    }
  }

  setTimeConstant(sec) {
    this.timeConstant = Math.max(0.06, Math.min(0.30, sec));
    this.bands.forEach(b => {
      b.comp.attack.value = Math.max(0.005, this.timeConstant * 0.1);
      b.comp.release.value = Math.max(0.05, this.timeConstant);
    });
  }

  setGranularity(val) {
    this.granularity = Math.max(0, Math.min(4, Math.round(val)));
  }

  setTfTransform(index) {
    this.tfTransform = Math.max(0, Math.min(3, Math.round(index)));
  }

  setBandRatio(bandIdx, ratioVal) {
    if (bandIdx >= 0 && bandIdx < 7) {
      this.ratios[bandIdx] = Math.max(-1.2, Math.min(1.2, ratioVal));
      const band = this.bands[bandIdx];
      if (band) {
        // ratio > 0 compresses/boosts, ratio < 0 expands
        const gainDb = this.ratios[bandIdx] * 6.0;
        band.gain.gain.value = Math.pow(10, gainDb / 20);
        band.comp.ratio.value = Math.max(1.0, 1.0 + Math.abs(this.ratios[bandIdx]) * 4.0);
      }
    }
  }

  setAllRatios(ratiosArray) {
    for (let i = 0; i < Math.min(ratiosArray.length, 7); i++) {
      this.setBandRatio(i, ratiosArray[i]);
    }
  }

  setParam(paramName, value) {
    const t = this.ctx.currentTime;
    switch (paramName) {
      case 'threshold':
        this.bands.forEach(b => b.comp.threshold.setTargetAtTime(value, t, 0.02));
        break;
      case 'ratio':
        this.bands.forEach(b => b.comp.ratio.setTargetAtTime(value, t, 0.02));
        break;
      case 'attack':
        this.bands.forEach(b => b.comp.attack.setTargetAtTime(Math.max(0.001, value / 1000), t, 0.02));
        break;
      case 'release':
        this.bands.forEach(b => b.comp.release.setTargetAtTime(Math.max(0.01, value / 1000), t, 0.02));
        break;
      case 'timeConstant':
        this.setTimeConstant(value);
        break;
    }
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.updateBypassState();
  }

  updateBypassState() {
    this.bypassNode.gain.value = this.enabled ? 0.0 : 1.0;
    this.effectNode.gain.value = this.enabled ? 1.0 : 0.0;
  }
}
