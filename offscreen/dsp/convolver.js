/**
 * Convolver / FIR Engine Module for JamesDSP
 * Loads impulse responses (.wav, .irs) and AutoEQ compensation profiles.
 */

export class ConvolverModule {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.enabled = false;
    this.wetGainVal = 0.5; // 0 to 1
    this.dryGainVal = 1.0; // 0 to 1
    this.currentPresetName = 'None';

    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();
    this.dryNode = this.ctx.createGain();
    this.wetNode = this.ctx.createGain();

    this.convolverNode = this.ctx.createConvolver();
    this.convolverNode.normalize = true;

    // Connect routing
    this.inputNode.connect(this.dryNode);
    this.dryNode.connect(this.outputNode);

    this.inputNode.connect(this.convolverNode);
    this.convolverNode.connect(this.wetNode);
    this.wetNode.connect(this.outputNode);

    // Generate a default subtle acoustic studio impulse response
    this.generateSyntheticImpulse(0.8, 0.05);

    this.updateBypassState();
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.updateBypassState();
  }

  setWetDry(wet, dry = 1.0) {
    this.wetGainVal = Math.max(0, Math.min(1, wet));
    this.dryGainVal = Math.max(0, Math.min(1, dry));
    this.updateBypassState();
  }

  updateBypassState() {
    const t = this.ctx.currentTime;
    if (this.enabled) {
      this.dryNode.gain.setTargetAtTime(this.dryGainVal, t, 0.02);
      this.wetNode.gain.setTargetAtTime(this.wetGainVal, t, 0.02);
    } else {
      this.dryNode.gain.setTargetAtTime(1.0, t, 0.02);
      this.wetNode.gain.setTargetAtTime(0.0, t, 0.02);
    }
  }

  /**
   * Load an audio buffer into the convolver from an ArrayBuffer (e.g. user uploaded .wav or .irs file)
   */
  async loadImpulseFromArrayBuffer(arrayBuffer, name = 'Custom IR') {
    try {
      const decodedBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.convolverNode.buffer = decodedBuffer;
      this.currentPresetName = name;
      return { success: true, name };
    } catch (err) {
      console.error('[JamesDSP Convolver] Failed to decode impulse response:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Synthesize a realistic stereo room impulse response
   * @param {number} durationSeconds - reverb length (e.g. 0.5s to 2.5s)
   * @param {number} decayRate - exponential decay factor
   */
  generateSyntheticImpulse(durationSeconds = 1.2, decayRate = 0.08, name = 'Warm Studio Room') {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * durationSeconds);
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / length;
      const envelope = Math.exp(-t / decayRate);
      // Diffuse noise with early reflection density
      left[i] = (Math.random() * 2 - 1) * envelope;
      right[i] = (Math.random() * 2 - 1) * envelope;
    }

    this.convolverNode.buffer = impulse;
    this.currentPresetName = name;
  }
}
