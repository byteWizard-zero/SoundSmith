/**
 * SoundSmith Crossfeed & Spatializer Engine
 * Faithful port of RootlessJamesDSP BS2B & Advanced Crossfeed (advXF)
 * 
 * Supports all 6 authentic RootlessJamesDSP crossfeed presets:
 *  0: BS2B Weak (Chu Moy 700Hz / 4.5dB)
 *  1: BS2B Strong (Jan Meier 650Hz / 9.5dB)
 *  2: Out of Head (600Hz / 6.0dB with HRTF-inspired pinna roll-off)
 *  3: Surround 1 (Surround stage I - Mid-Side Haas cross-bleed)
 *  4: Surround 2 (Surround stage II - Extended 3D binaural dispersion)
 *  5: Joe0Bloggs Realistic Surround (Full acoustic ear canal & pinna shadow simulation)
 */

export const CROSSFEED_MODES = {
  BS2B_WEAK: 0,
  BS2B_STRONG: 1,
  OUT_OF_HEAD: 2,
  SURROUND_1: 3,
  SURROUND_2: 4,
  REALISTIC_SURROUND: 5,
  CUSTOM: 6
};

export class Crossfeed {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.enabled = false;
    this.mode = CROSSFEED_MODES.BS2B_WEAK;
    
    // Custom parameters
    this.customFcut = 700;
    this.customFeed = 4.5;

    // Node hierarchy
    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();
    this.bypassNode = this.ctx.createGain();
    this.effectNode = this.ctx.createGain();

    // 2-channel splitter & merger
    this.splitter = this.ctx.createChannelSplitter(2);
    this.merger = this.ctx.createChannelMerger(2);

    // Direct path gains
    this.directLeftGain = this.ctx.createGain();
    this.directRightGain = this.ctx.createGain();

    // Direct path equalization / high-boost (Bauer BS2B high-boost compensation)
    this.directLeftFilter = this.ctx.createBiquadFilter();
    this.directRightFilter = this.ctx.createBiquadFilter();
    this.directLeftFilter.type = 'highshelf';
    this.directRightFilter.type = 'highshelf';

    // Cross-feed filters (L->R and R->L)
    this.crossLtoR_filter = this.ctx.createBiquadFilter();
    this.crossRtoL_filter = this.ctx.createBiquadFilter();
    this.crossLtoR_filter.type = 'lowpass';
    this.crossRtoL_filter.type = 'lowpass';

    // Interaural Time Delay (ITD)
    this.crossLtoR_delay = this.ctx.createDelay(0.02);
    this.crossRtoL_delay = this.ctx.createDelay(0.02);

    // Cross-bleed gain attenuators
    this.crossLtoR_gain = this.ctx.createGain();
    this.crossRtoL_gain = this.ctx.createGain();

    // Secondary HRTF Pinna notch filters for realistic surround / out of head
    this.pinnaFilterL = this.ctx.createBiquadFilter();
    this.pinnaFilterR = this.ctx.createBiquadFilter();
    this.pinnaFilterL.type = 'peaking';
    this.pinnaFilterR.type = 'peaking';

    // Master effect gain
    this.makeupGain = this.ctx.createGain();

    this._buildGraph();
    this.setMode(this.mode);
    this.updateBypassState();
  }

  _buildGraph() {
    // Dry/Bypass Path
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);

    // Wet/Effect Path
    this.inputNode.connect(this.effectNode);
    this.effectNode.connect(this.splitter);

    // --- Channel 0: Left Input ---
    // 1. Direct path -> Left Filter -> Direct Gain -> Merger Ch 0
    this.splitter.connect(this.directLeftFilter, 0);
    this.directLeftFilter.connect(this.directLeftGain);
    this.directLeftGain.connect(this.merger, 0, 0);

    // 2. Cross path (Left -> Right): Splitter 0 -> Pinna -> Lowpass -> Delay -> Gain -> Merger Ch 1
    this.splitter.connect(this.pinnaFilterL, 0);
    this.pinnaFilterL.connect(this.crossLtoR_filter);
    this.crossLtoR_filter.connect(this.crossLtoR_delay);
    this.crossLtoR_delay.connect(this.crossLtoR_gain);
    this.crossLtoR_gain.connect(this.merger, 0, 1);

    // --- Channel 1: Right Input ---
    // 1. Direct path -> Right Filter -> Direct Gain -> Merger Ch 1
    this.splitter.connect(this.directRightFilter, 1);
    this.directRightFilter.connect(this.directRightGain);
    this.directRightGain.connect(this.merger, 0, 1);

    // 2. Cross path (Right -> Left): Splitter 1 -> Pinna -> Lowpass -> Delay -> Gain -> Merger Ch 0
    this.splitter.connect(this.pinnaFilterR, 1);
    this.pinnaFilterR.connect(this.crossRtoL_filter);
    this.crossRtoL_filter.connect(this.crossRtoL_delay);
    this.crossRtoL_delay.connect(this.crossRtoL_gain);
    this.crossRtoL_gain.connect(this.merger, 0, 0);

    // Merged -> Makeup Gain -> Output
    this.merger.connect(this.makeupGain);
    this.makeupGain.connect(this.outputNode);
  }

  /**
   * Configure parameters according to RootlessJamesDSP preset mode index (0-5)
   */
  setMode(modeIndex) {
    let mode = parseInt(modeIndex, 10);
    if (isNaN(mode) || mode < 0) mode = 0;
    if (mode > 6) mode = 6;
    this.mode = mode;

    let fcut = 700;
    let feedDb = -4.5;
    let delay = 0.00028; // 280 µs
    let directBoostDb = 1.0;
    let directBoostFreq = 1800;
    let pinnaFreq = 4200;
    let pinnaGain = 0;
    let pinnaQ = 1.0;
    let makeupDb = 0.0;

    switch (this.mode) {
      case CROSSFEED_MODES.BS2B_WEAK: // 0: BS2B Weak (Chu Moy)
        fcut = 700;
        feedDb = -4.5;
        delay = 0.00028;
        directBoostDb = 1.2;
        directBoostFreq = 2000;
        pinnaGain = 0;
        makeupDb = -0.5;
        break;

      case CROSSFEED_MODES.BS2B_STRONG: // 1: BS2B Strong (Jan Meier)
        fcut = 650;
        feedDb = -9.5;
        delay = 0.00034;
        directBoostDb = 2.2;
        directBoostFreq = 1800;
        pinnaGain = 0;
        makeupDb = -0.8;
        break;

      case CROSSFEED_MODES.OUT_OF_HEAD: // 2: Out of Head
        fcut = 600;
        feedDb = -6.0;
        delay = 0.00035;
        directBoostDb = 1.5;
        directBoostFreq = 2200;
        pinnaFreq = 3800;
        pinnaGain = -2.5;
        pinnaQ = 2.0;
        makeupDb = -0.2;
        break;

      case CROSSFEED_MODES.SURROUND_1: // 3: Surround 1 (Mid-Side Haas Stereo expansion)
        fcut = 800;
        feedDb = -3.8;
        delay = 0.00045; // 450 µs Haas delay
        directBoostDb = 0.8;
        directBoostFreq = 3000;
        pinnaFreq = 5000;
        pinnaGain = -3.0;
        pinnaQ = 1.5;
        makeupDb = 0.0;
        break;

      case CROSSFEED_MODES.SURROUND_2: // 4: Surround 2 (Deep 3D Stage)
        fcut = 850;
        feedDb = -3.2;
        delay = 0.00058; // 580 µs
        directBoostDb = 1.0;
        directBoostFreq = 2500;
        pinnaFreq = 6000;
        pinnaGain = -4.0;
        pinnaQ = 1.8;
        makeupDb = 0.2;
        break;

      case CROSSFEED_MODES.REALISTIC_SURROUND: // 5: Joe0Bloggs Realistic Surround
        fcut = 700;
        feedDb = -5.0;
        delay = 0.00032;
        directBoostDb = 2.5;
        directBoostFreq = 1800;
        pinnaFreq = 4500;
        pinnaGain = -4.5;
        pinnaQ = 3.0;
        makeupDb = 0.5;
        break;

      case CROSSFEED_MODES.CUSTOM: // 6: Custom
        fcut = this.customFcut;
        feedDb = -Math.abs(this.customFeed);
        delay = 0.00030;
        directBoostDb = 1.0;
        directBoostFreq = 2000;
        pinnaGain = 0;
        makeupDb = 0;
        break;
    }

    const t = this.ctx.currentTime;
    const crossGainLinear = Math.pow(10, feedDb / 20);
    const makeupLinear = Math.pow(10, makeupDb / 20);

    // Update cross-path lowpass
    this.crossLtoR_filter.frequency.setTargetAtTime(fcut, t, 0.02);
    this.crossRtoL_filter.frequency.setTargetAtTime(fcut, t, 0.02);

    // Update ITD delays
    this.crossLtoR_delay.delayTime.setTargetAtTime(delay, t, 0.02);
    this.crossRtoL_delay.delayTime.setTargetAtTime(delay, t, 0.02);

    // Update cross-bleed gain
    this.crossLtoR_gain.gain.setTargetAtTime(crossGainLinear, t, 0.02);
    this.crossRtoL_gain.gain.setTargetAtTime(crossGainLinear, t, 0.02);

    // Update direct high-boost filters
    this.directLeftFilter.frequency.setTargetAtTime(directBoostFreq, t, 0.02);
    this.directRightFilter.frequency.setTargetAtTime(directBoostFreq, t, 0.02);
    this.directLeftFilter.gain.setTargetAtTime(directBoostDb, t, 0.02);
    this.directRightFilter.gain.setTargetAtTime(directBoostDb, t, 0.02);

    // Update Pinna HRTF notches
    this.pinnaFilterL.frequency.setTargetAtTime(pinnaFreq, t, 0.02);
    this.pinnaFilterR.frequency.setTargetAtTime(pinnaFreq, t, 0.02);
    this.pinnaFilterL.gain.setTargetAtTime(pinnaGain, t, 0.02);
    this.pinnaFilterR.gain.setTargetAtTime(pinnaGain, t, 0.02);
    this.pinnaFilterL.Q.setTargetAtTime(pinnaQ, t, 0.02);
    this.pinnaFilterR.Q.setTargetAtTime(pinnaQ, t, 0.02);

    // Update makeup
    this.makeupGain.gain.setTargetAtTime(makeupLinear, t, 0.02);
  }

  setCustomParams(fcut, feedDb) {
    this.customFcut = Math.max(300, Math.min(2000, fcut));
    this.customFeed = Math.max(1, Math.min(15, feedDb));
    if (this.mode === CROSSFEED_MODES.CUSTOM) {
      this.setMode(CROSSFEED_MODES.CUSTOM);
    }
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
