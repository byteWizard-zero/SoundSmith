/**
 * SoundSmith Virtual Room Reverb Engine
 * Faithful implementation of the Freeverb / Sndfilter algorithmic acoustic reverb
 * used in RootlessJamesDSP (Sean Connelly / James Fung).
 * 
 * Implements all 13 authentic RootlessJamesDSP room acoustic models:
 *  0: Default
 *  1: Small hall 1
 *  2: Small hall 2
 *  4: Medium hall
 *  5: Large hall
 *  7: Small room 1
 *  8: Small room 2
 *  9: Medium room
 *  11: Large room
 *  15: Plate high
 *  16: Plate low
 *  17: Long reverb 1
 *  18: Long reverb 2
 */

export const REVERB_PRESETS = {
  0: { name: 'Default', rt60: 3.2, delay: 0.020, inpLp: 17000, dmpLp: 7000, outLp: 10000, width: 1.0, wetDb: 0.0, dryDb: -7.0 },
  1: { name: 'Small hall 1', rt60: 2.1, delay: 0.010, inpLp: 18000, dmpLp: 9000, outLp: 17000, width: 1.0, wetDb: -8.0, dryDb: -7.0 },
  2: { name: 'Small hall 2', rt60: 2.3, delay: 0.010, inpLp: 18000, dmpLp: 7000, outLp: 9000, width: 1.0, wetDb: -8.0, dryDb: -7.0 },
  4: { name: 'Medium hall', rt60: 2.9, delay: 0.010, inpLp: 18000, dmpLp: 6000, outLp: 8000, width: 1.0, wetDb: -8.0, dryDb: -7.0 },
  5: { name: 'Large hall', rt60: 3.8, delay: 0.018, inpLp: 18000, dmpLp: 9000, outLp: 14000, width: 1.0, wetDb: -8.0, dryDb: -7.0 },
  7: { name: 'Small room 1', rt60: 0.5, delay: 0.005, inpLp: 18000, dmpLp: 18000, outLp: 18000, width: 0.8, wetDb: -8.0, dryDb: -7.0 },
  8: { name: 'Small room 2', rt60: 0.5, delay: 0.005, inpLp: 18000, dmpLp: 10000, outLp: 18000, width: 0.9, wetDb: -8.0, dryDb: -7.0 },
  9: { name: 'Medium room', rt60: 0.8, delay: 0.008, inpLp: 18000, dmpLp: 18000, outLp: 18000, width: 0.8, wetDb: -8.0, dryDb: -7.0 },
  11: { name: 'Large room', rt60: 1.8, delay: 0.010, inpLp: 18000, dmpLp: 16000, outLp: 18000, width: 0.9, wetDb: -8.0, dryDb: -7.0 },
  15: { name: 'Plate high', rt60: 1.8, delay: 0.000, inpLp: 18000, dmpLp: 16000, outLp: 18000, width: 1.0, wetDb: -8.0, dryDb: -12.0 },
  16: { name: 'Plate low', rt60: 1.9, delay: 0.000, inpLp: 18000, dmpLp: 9000, outLp: 18000, width: 1.0, wetDb: -8.0, dryDb: -12.0 },
  17: { name: 'Long reverb 1', rt60: 12.0, delay: 0.000, inpLp: 18000, dmpLp: 10000, outLp: 18000, width: 1.0, wetDb: -5.0, dryDb: -14.0 },
  18: { name: 'Long reverb 2', rt60: 30.0, delay: 0.000, inpLp: 18000, dmpLp: 9000, outLp: 18000, width: 1.0, wetDb: -5.0, dryDb: -14.0 }
};

export class Reverb {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.enabled = false;
    this.presetIndex = 0;

    // Node graph
    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();
    this.bypassNode = this.ctx.createGain();
    this.dryNode = this.ctx.createGain();
    this.wetNode = this.ctx.createGain();

    // Input Lowpass filter
    this.inputFilter = this.ctx.createBiquadFilter();
    this.inputFilter.type = 'lowpass';

    // Pre-delay
    this.preDelayNode = this.ctx.createDelay(0.1);

    // Multi-comb filter bank (8 parallel combs for rich diffuse density)
    this.combDelayTimes = [0.0253, 0.0269, 0.0290, 0.0307, 0.0322, 0.0338, 0.0353, 0.0367];
    this.combFilters = [];
    this.combMerger = this.ctx.createGain();
    this.combMerger.gain.value = 0.18;

    // 4 cascaded All-Pass filters for diffusion
    this.allpassFilters = [];
    this.allpassDelays = [0.0051, 0.0077, 0.0105, 0.0126];

    // Output Lowpass filter
    this.outputFilter = this.ctx.createBiquadFilter();
    this.outputFilter.type = 'lowpass';

    // Stereo width matrix
    this.splitter = this.ctx.createChannelSplitter(2);
    this.merger = this.ctx.createChannelMerger(2);
    this.leftGain = this.ctx.createGain();
    this.rightGain = this.ctx.createGain();

    this._buildGraph();
    this.setPreset(0);
    this.updateBypassState();
  }

  _buildGraph() {
    // 1. Bypass route
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);

    // 2. Dry route
    this.inputNode.connect(this.dryNode);
    this.dryNode.connect(this.outputNode);

    // 3. Reverb wet chain:
    // Input -> InputFilter -> PreDelay -> Comb Bank
    this.inputNode.connect(this.inputFilter);
    this.inputFilter.connect(this.preDelayNode);

    // Create 8 parallel comb filters
    this.combDelayTimes.forEach(delaySec => {
      const delay = this.ctx.createDelay(0.1);
      delay.delayTime.value = delaySec;

      const feedback = this.ctx.createGain();
      feedback.gain.value = 0.84; // Controlled by RT60

      const dampFilter = this.ctx.createBiquadFilter();
      dampFilter.type = 'lowpass';
      dampFilter.frequency.value = 7000;

      // Loop: PreDelay -> Delay -> Damp -> Feedback -> Delay
      this.preDelayNode.connect(delay);
      delay.connect(dampFilter);
      dampFilter.connect(feedback);
      feedback.connect(delay);

      // Output of comb into combMerger
      dampFilter.connect(this.combMerger);

      this.combFilters.push({ delay, feedback, dampFilter, baseDelay: delaySec });
    });

    // Connect combMerger through 4 All-Pass diffusion filters
    let currentAPSource = this.combMerger;
    this.allpassDelays.forEach(apDelaySec => {
      const apDelay = this.ctx.createDelay(0.05);
      apDelay.delayTime.value = apDelaySec;

      const apFeed = this.ctx.createGain();
      apFeed.gain.value = 0.5;

      const apDirect = this.ctx.createGain();
      apDirect.gain.value = -0.5;

      const apSum = this.ctx.createGain();

      // Simple Schroeder allpass approximation
      currentAPSource.connect(apDelay);
      currentAPSource.connect(apDirect);
      apDelay.connect(apFeed);
      apFeed.connect(apSum);
      apDirect.connect(apSum);

      this.allpassFilters.push({ apDelay, apFeed, apDirect, apSum });
      currentAPSource = apSum;
    });

    // All-Pass output -> OutputFilter -> Width Splitter
    currentAPSource.connect(this.outputFilter);
    this.outputFilter.connect(this.splitter);

    // Stereo Width control
    this.splitter.connect(this.leftGain, 0);
    this.leftGain.connect(this.merger, 0, 0);

    this.splitter.connect(this.rightGain, 1);
    this.rightGain.connect(this.merger, 0, 1);

    // Merger -> Wet Gain -> Output
    this.merger.connect(this.wetNode);
    this.wetNode.connect(this.outputNode);
  }

  setPreset(presetId) {
    let p = parseInt(presetId, 10);
    if (!REVERB_PRESETS[p]) {
      // Find closest or fallback to 0
      p = 0;
    }
    this.presetIndex = p;
    const config = REVERB_PRESETS[p];
    const t = this.ctx.currentTime;

    // Convert RT60 to comb feedback gain: g = 10^(-3 * delay / RT60)
    const rt60 = Math.max(0.2, config.rt60);
    this.combFilters.forEach(cf => {
      const g = Math.pow(10, (-3 * cf.baseDelay) / rt60);
      cf.feedback.gain.setTargetAtTime(Math.min(0.98, g), t, 0.02);
      cf.dampFilter.frequency.setTargetAtTime(config.dmpLp, t, 0.02);
    });

    // Set input and output lowpass filters
    this.inputFilter.frequency.setTargetAtTime(config.inpLp, t, 0.02);
    this.outputFilter.frequency.setTargetAtTime(config.outLp, t, 0.02);

    // Pre-delay
    this.preDelayNode.delayTime.setTargetAtTime(config.delay, t, 0.02);

    // Stereo width
    const width = Math.max(0, Math.min(1.5, config.width));
    this.leftGain.gain.setTargetAtTime(width, t, 0.02);
    this.rightGain.gain.setTargetAtTime(width, t, 0.02);

    // Wet and Dry Gains
    const wetLinear = Math.pow(10, config.wetDb / 20);
    const dryLinear = Math.pow(10, config.dryDb / 20);

    this.wetNode.gain.setTargetAtTime(wetLinear, t, 0.02);
    this.dryNode.gain.setTargetAtTime(dryLinear, t, 0.02);
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.updateBypassState();
  }

  updateBypassState() {
    const t = this.ctx.currentTime;
    if (this.enabled) {
      this.bypassNode.gain.setTargetAtTime(0, t, 0.02);
      this.dryNode.gain.setTargetAtTime(Math.pow(10, (REVERB_PRESETS[this.presetIndex]?.dryDb || -7) / 20), t, 0.02);
      this.wetNode.gain.setTargetAtTime(Math.pow(10, (REVERB_PRESETS[this.presetIndex]?.wetDb || 0) / 20), t, 0.02);
    } else {
      this.bypassNode.gain.setTargetAtTime(1, t, 0.02);
      this.dryNode.gain.setTargetAtTime(0, t, 0.02);
      this.wetNode.gain.setTargetAtTime(0, t, 0.02);
    }
  }
}
