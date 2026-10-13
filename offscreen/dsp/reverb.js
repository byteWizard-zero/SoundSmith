/**
 * Virtual Room Reverb Module for JamesDSP
 * Implements algorithmic acoustic space reverberation with damping and decay controls.
 */

export class Reverb {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.enabled = false;
    this.roomSize = 0.6; // 0.1 to 0.95
    this.dampingFreq = 4000; // Hz
    this.wetGain = 0.35;
    this.dryGain = 1.0;

    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();
    this.dryNode = this.ctx.createGain();
    this.wetNode = this.ctx.createGain();

    // Multi-comb and all-pass delay network
    this.delayTimes = [0.0297, 0.0371, 0.0411, 0.0437];
    this.combFilters = [];

    const combMerger = this.ctx.createGain();
    combMerger.gain.value = 0.25;

    this.delayTimes.forEach(delaySec => {
      const delay = this.ctx.createDelay();
      delay.delayTime.value = delaySec;

      const feedback = this.ctx.createGain();
      feedback.gain.value = this.roomSize;

      const dampFilter = this.ctx.createBiquadFilter();
      dampFilter.type = 'lowpass';
      dampFilter.frequency.value = this.dampingFreq;

      // Input -> Delay -> Damp -> Feedback -> Delay
      this.inputNode.connect(delay);
      delay.connect(dampFilter);
      dampFilter.connect(feedback);
      feedback.connect(delay);

      // Tap output into combMerger
      dampFilter.connect(combMerger);

      this.combFilters.push({ delay, feedback, dampFilter });
    });

    combMerger.connect(this.wetNode);

    // Direct routing
    this.inputNode.connect(this.dryNode);
    this.dryNode.connect(this.outputNode);
    this.wetNode.connect(this.outputNode);

    this.updateBypassState();
  }

  setRoomSize(size) {
    this.roomSize = Math.max(0.1, Math.min(0.92, size));
    const t = this.ctx.currentTime;
    this.combFilters.forEach(cf => {
      cf.feedback.gain.setTargetAtTime(this.roomSize, t, 0.02);
    });
  }

  setDamping(freqHz) {
    this.dampingFreq = Math.max(1000, Math.min(16000, freqHz));
    const t = this.ctx.currentTime;
    this.combFilters.forEach(cf => {
      cf.dampFilter.frequency.setTargetAtTime(this.dampingFreq, t, 0.02);
    });
  }

  setWetDry(wet, dry = 1.0) {
    this.wetGain = Math.max(0, Math.min(1.0, wet));
    this.dryGain = Math.max(0, Math.min(1.0, dry));
    this.updateBypassState();
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.updateBypassState();
  }

  updateBypassState() {
    const t = this.ctx.currentTime;
    if (this.enabled) {
      this.dryNode.gain.setTargetAtTime(this.dryGain, t, 0.02);
      this.wetNode.gain.setTargetAtTime(this.wetGain, t, 0.02);
    } else {
      this.dryNode.gain.setTargetAtTime(1.0, t, 0.02);
      this.wetNode.gain.setTargetAtTime(0.0, t, 0.02);
    }
  }
}
