/**
 * Stereo Soundstage Widener Module for JamesDSP
 * Employs Mid/Side (M/S) matrix decomposition to adjust acoustic soundstage width.
 */

export class StereoWiden {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.enabled = false;
    this.width = 1.4; // 0.0 (Mono) to 2.5 (Extreme Wide), 1.0 = Normal

    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();
    this.bypassNode = this.ctx.createGain();
    this.effectNode = this.ctx.createGain();

    this.splitter = this.ctx.createChannelSplitter(2);
    this.merger = this.ctx.createChannelMerger(2);

    // Mid path: M = 0.5 * L + 0.5 * R
    this.midNode = this.ctx.createGain();
    this.midGainL = this.ctx.createGain();
    this.midGainL.gain.value = 0.5;
    this.midGainR = this.ctx.createGain();
    this.midGainR.gain.value = 0.5;

    // Side path: S = 0.5 * L - 0.5 * R
    this.sideGainL = this.ctx.createGain();
    this.sideGainL.gain.value = 0.5;
    this.sideGainR = this.ctx.createGain();
    this.sideGainR.gain.value = -0.5;

    // Width multiplier node applied to Side signal
    this.widthNode = this.ctx.createGain();
    this.widthNode.gain.value = this.width;

    // Reconstruction:
    // Left out = Mid + (Side * width)
    // Right out = Mid - (Side * width)
    this.outLeftFromSide = this.ctx.createGain();
    this.outLeftFromSide.gain.value = 1.0;
    this.outRightFromSide = this.ctx.createGain();
    this.outRightFromSide.gain.value = -1.0;

    // Wiring:
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);

    this.inputNode.connect(this.effectNode);
    this.effectNode.connect(this.splitter);

    // Create Mid:
    this.splitter.connect(this.midGainL, 0);
    this.splitter.connect(this.midGainR, 1);
    this.midGainL.connect(this.midNode);
    this.midGainR.connect(this.midNode);

    // Create Side:
    this.splitter.connect(this.sideGainL, 0);
    this.splitter.connect(this.sideGainR, 1);
    this.sideGainL.connect(this.widthNode);
    this.sideGainR.connect(this.widthNode);

    // Reconstruct Left: Mid + Side*width
    this.midNode.connect(this.merger, 0, 0);
    this.widthNode.connect(this.outLeftFromSide);
    this.outLeftFromSide.connect(this.merger, 0, 0);

    // Reconstruct Right: Mid - Side*width
    this.midNode.connect(this.merger, 0, 1);
    this.widthNode.connect(this.outRightFromSide);
    this.outRightFromSide.connect(this.merger, 0, 1);

    this.merger.connect(this.outputNode);

    this.updateBypassState();
  }

  setWidth(widthVal) {
    this.width = Math.max(0, Math.min(2.5, widthVal));
    this.widthNode.gain.setTargetAtTime(this.width, this.ctx.currentTime, 0.02);
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
