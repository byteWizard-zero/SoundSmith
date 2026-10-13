/**
 * BS2B (Bauer Stereophonic-to-Binaural) Crossfeed Module for JamesDSP
 * Reduces headphone listening fatigue by simulating speaker acoustic cross-bleed and head shadow.
 */

export class Crossfeed {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.enabled = false;
    this.preset = 'chumoy'; // 'chumoy', 'meier', 'custom'
    this.cutoffFreq = 700;   // Hz
    this.crossGainDb = -4.5; // dB attenuation for crossfeed
    this.delayTime = 0.00028; // ~280 microseconds interaural time difference

    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();
    this.bypassNode = this.ctx.createGain();
    this.effectNode = this.ctx.createGain();

    // Channel Splitter & Merger
    this.splitter = this.ctx.createChannelSplitter(2);
    this.merger = this.ctx.createChannelMerger(2);

    // Direct paths
    this.directLeftGain = this.ctx.createGain();
    this.directRightGain = this.ctx.createGain();

    // Cross paths (Left -> Right, Right -> Left)
    this.crossLtoR_filter = this.ctx.createBiquadFilter();
    this.crossLtoR_filter.type = 'lowpass';
    this.crossLtoR_filter.frequency.value = this.cutoffFreq;

    this.crossLtoR_delay = this.ctx.createDelay();
    this.crossLtoR_delay.delayTime.value = this.delayTime;

    this.crossLtoR_gain = this.ctx.createGain();

    this.crossRtoL_filter = this.ctx.createBiquadFilter();
    this.crossRtoL_filter.type = 'lowpass';
    this.crossRtoL_filter.frequency.value = this.cutoffFreq;

    this.crossRtoL_delay = this.ctx.createDelay();
    this.crossRtoL_delay.delayTime.value = this.delayTime;

    this.crossRtoL_gain = this.ctx.createGain();

    this._applyPresetParams('chumoy');

    // Routing:
    // Input -> Bypass -> Output
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);

    // Input -> EffectNode -> Splitter
    this.inputNode.connect(this.effectNode);
    this.effectNode.connect(this.splitter);

    // Channel 0 (Left):
    // Direct -> Merger Ch 0
    this.splitter.connect(this.directLeftGain, 0);
    this.directLeftGain.connect(this.merger, 0, 0);

    // Cross: Left -> Filter -> Delay -> Gain -> Merger Ch 1 (Right)
    this.splitter.connect(this.crossLtoR_filter, 0);
    this.crossLtoR_filter.connect(this.crossLtoR_delay);
    this.crossLtoR_delay.connect(this.crossLtoR_gain);
    this.crossLtoR_gain.connect(this.merger, 0, 1);

    // Channel 1 (Right):
    // Direct -> Merger Ch 1
    this.splitter.connect(this.directRightGain, 1);
    this.directRightGain.connect(this.merger, 0, 1);

    // Cross: Right -> Filter -> Delay -> Gain -> Merger Ch 0 (Left)
    this.splitter.connect(this.crossRtoL_filter, 1);
    this.crossRtoL_filter.connect(this.crossRtoL_delay);
    this.crossRtoL_delay.connect(this.crossRtoL_gain);
    this.crossRtoL_gain.connect(this.merger, 0, 0);

    this.merger.connect(this.outputNode);

    this.updateBypassState();
  }

  _applyPresetParams(presetName) {
    this.preset = presetName;
    if (presetName === 'chumoy') {
      this.cutoffFreq = 700;
      this.crossGainDb = -4.5;
      this.delayTime = 0.00028;
    } else if (presetName === 'meier') {
      this.cutoffFreq = 650;
      this.crossGainDb = -9.5;
      this.delayTime = 0.00034;
    }

    const t = this.ctx.currentTime;
    const crossLinear = Math.pow(10, this.crossGainDb / 20);

    this.crossLtoR_filter.frequency.setTargetAtTime(this.cutoffFreq, t, 0.02);
    this.crossRtoL_filter.frequency.setTargetAtTime(this.cutoffFreq, t, 0.02);
    this.crossLtoR_delay.delayTime.setTargetAtTime(this.delayTime, t, 0.02);
    this.crossRtoL_delay.delayTime.setTargetAtTime(this.delayTime, t, 0.02);
    this.crossLtoR_gain.gain.setTargetAtTime(crossLinear, t, 0.02);
    this.crossRtoL_gain.gain.setTargetAtTime(crossLinear, t, 0.02);
  }

  setPreset(preset) {
    this._applyPresetParams(preset);
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.updateBypassState();
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
