/**
 * Vacuum Tube Modeling Module for JamesDSP
 * Emulates 12AX7 dual-triode tube transfer characteristics with 2nd-order harmonic warmth.
 */

export class TubeSaturation {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.enabled = false;
    this.drive = 0.3;    // 0 to 1
    this.warmth = 0.5;   // 0 to 1 (2nd harmonic presence)

    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();
    this.bypassNode = this.ctx.createGain();
    this.effectNode = this.ctx.createGain();

    this.preGainNode = this.ctx.createGain();
    this.postGainNode = this.ctx.createGain();

    this.shaperNode = this.ctx.createWaveShaper();
    this.shaperNode.oversample = '4x'; // Eliminate anti-aliasing artifacts

    this._updateCurve();

    // Wiring:
    // input -> bypass -> output
    // input -> effectNode -> preGain -> shaper -> postGain -> output
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
    const driveAmount = 1.0 + this.drive * 4.0;
    const warmthBias = this.warmth * 0.35; // 2nd harmonic bias

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      const xDriven = x * driveAmount;

      // Asymmetric 12AX7 triode model transfer curve
      // Positive swing compresses smoothly, negative swing introduces soft quadratic curvature
      let y;
      if (xDriven >= 0) {
        y = Math.tanh(xDriven) + warmthBias * (xDriven / (1 + xDriven * xDriven));
      } else {
        // Soft cutoff
        y = Math.tanh(xDriven * 0.85) - warmthBias * (xDriven * xDriven * 0.5);
      }

      // Normalize output between -1 and 1
      curve[i] = Math.max(-1.0, Math.min(1.0, y * 0.85));
    }

    this.shaperNode.curve = curve;

    // Automatic makeup gain compensation
    const compensation = 1.0 / (1.0 + this.drive * 0.8);
    this.postGainNode.gain.setTargetAtTime(compensation, this.ctx.currentTime, 0.02);
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.updateBypassState();
  }

  setDrive(val) {
    this.drive = Math.max(0, Math.min(1, val));
    this._updateCurve();
  }

  setWarmth(val) {
    this.warmth = Math.max(0, Math.min(1, val));
    this._updateCurve();
  }

  updateBypassState() {
    const t = this.ctx.currentTime;
    if (this.enabled) {
      this.bypassNode.gain.setTargetAtTime(0, t, 0.02);
      this.effectNode.gain.setTargetAtTime(1, t, 0.02);
    } else {
      this.bypassNode.gain.setTargetAtTime(1, t, 0.02);
      this.effectNode.gain.setTargetAtTime(0, t, 0.02);
    }
  }
}
