/**
 * Vacuum Tube Analog Modeller for SoundSmith
 * Matches RootlessJamesDSP PARAM_TUBE_* (132, 134).
 * 12AX7 triode simulation with Preamp Drive range: -3.0 dB to +12.0 dB (Default: 2.0 dB).
 */

export class TubeSaturation {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.enabled = false;
    this.preampDb = 2.0; // -3.0 to +12.0 dB (Default: 2.0 dB)

    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();
    this.bypassNode = this.ctx.createGain();
    this.effectNode = this.ctx.createGain();

    this.preGainNode = this.ctx.createGain();
    this.postGainNode = this.ctx.createGain();

    this.shaperNode = this.ctx.createWaveShaper();
    this.shaperNode.oversample = '4x'; // Antialiasing oversampling

    this._updateCurve();

    // Wiring
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);

    this.inputNode.connect(this.effectNode);
    this.effectNode.connect(this.preGainNode);
    this.preGainNode.connect(this.shaperNode);
    this.shaperNode.connect(this.postGainNode);
    this.postGainNode.connect(this.outputNode);

    this.updateBypassState();
  }

  _updateCurve() {
    const samples = 4096;
    const curve = new Float32Array(samples);
    const driveLinear = Math.pow(10, this.preampDb / 20);
    this.preGainNode.gain.value = driveLinear;

    // Asymmetric 12AX7 triode model generating 2nd-order warm harmonics
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      let y;
      if (x >= 0) {
        y = Math.tanh(1.5 * x) + 0.15 * (x / (1 + x * x));
      } else {
        y = Math.tanh(1.2 * x) - 0.15 * (x * x * 0.5);
      }
      curve[i] = Math.max(-1.0, Math.min(1.0, y * 0.9));
    }

    this.shaperNode.curve = curve;
    // Makeup gain
    this.postGainNode.gain.value = 1.0 / Math.max(0.5, driveLinear * 0.8);
  }

  setPreamp(gainDb) {
    this.preampDb = Math.max(-3.0, Math.min(12.0, gainDb));
    this._updateCurve();
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
