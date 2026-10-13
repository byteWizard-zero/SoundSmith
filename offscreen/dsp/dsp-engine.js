/**
 * SoundSmith Master DSP Processing Engine
 * High-precision Audiophile Signal Processing Engine for Chrome
 * Faithful port of RootlessJamesDSP (Tim Schneeberger & James Fung)
 * 
 * Orchestrates 12 authentic DSP modules in a glitch-free serial graph:
 *  1. Input Preamp Gain (-20dB to +20dB)
 *  2. 15-Band Multimodal Equalizer (Graphic Spline, Arbitrary PEQ, AutoEQ)
 *  3. Dynamic Bass Exciter & Natural Bass Engine
 *  4. Multi-Band Dynamic Compander (Time-frequency STFT modeling)
 *  5. 12AX7 Vacuum Tube Triode Preamp Saturation
 *  6. ViPER-DDC Second-Order Section (SOS) Cascaded Matrix
 *  7. Partitioned Convolver with AdvImp Waveform Editor & Min-Phase
 *  8. BS2B & Spatializer Crossfeed (6 authentic modes)
 *  9. Center Channel / Stereo Field Expander
 * 10. Virtual Room Reverb (13 RootlessJamesDSP room acoustic models)
 * 11. LiveProg DSP Scripting VM & Dynamic Parameter Runner
 * 12. Master Brickwall Lookahead Safety Limiter
 */

import { EqualizerMultimodal } from './equalizer-multimodal.js';
import { ArbitraryEqualizer } from './arbitrary-equalizer.js';
import { DynamicBass } from './dynamic-bass.js';
import { DynamicCompander } from './dynamic-compander.js';
import { TubeSaturation } from './tube-saturation.js';
import { ViperDdc } from './viper-ddc.js';
import { ConvolverEngine } from './convolver-engine.js';
import { Crossfeed } from './crossfeed.js';
import { StereoWiden } from './stereo-widen.js';
import { Reverb } from './reverb.js';
import { LiveProgRunner } from './liveprog-runner.js';
import { MasterLimiter } from './limiter.js';

export class DspEngine {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.masterPower = true;

    // Master IO
    this.masterInput = this.ctx.createGain();
    this.masterOutput = this.ctx.createGain();

    // Master Bypass & Effect Gain nodes for smooth master toggling
    this.masterBypassGain = this.ctx.createGain();
    this.masterEffectGain = this.ctx.createGain();

    // FFT Spectrum Analyser for live visualizer
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.82;
    this.fftDataBuffer = new Uint8Array(this.analyser.frequencyBinCount);

    // Instantiate all 12 DSP modules
    this.limiter = new MasterLimiter(this.ctx); // Provides preampNode & limiterNode
    this.equalizer = new EqualizerMultimodal(this.ctx);
    this.arbitraryEq = new ArbitraryEqualizer(this.ctx);
    this.dynamicBass = new DynamicBass(this.ctx);
    this.compander = new DynamicCompander(this.ctx);
    this.tubeSaturation = new TubeSaturation(this.ctx);
    this.ddc = new ViperDdc(this.ctx);
    this.convolver = new ConvolverEngine(this.ctx);
    this.crossfeed = new Crossfeed(this.ctx);
    this.stereoWiden = new StereoWiden(this.ctx);
    this.reverb = new Reverb(this.ctx);
    this.liveprog = new LiveProgRunner(this.ctx);

    this._wireGraph();
    this.updateMasterPower(true);
  }

  _wireGraph() {
    // Master input splits to effect path and bypass path
    this.masterInput.connect(this.masterEffectGain);
    this.masterInput.connect(this.masterBypassGain);

    // Bypass path connects straight to master output
    this.masterBypassGain.connect(this.masterOutput);

    // SERIAL EFFECT CHAIN:
    // masterEffectGain -> preampNode -> equalizer -> dynamicBass -> compander
    // -> tubeSaturation -> ddc -> convolver -> crossfeed -> stereoWiden
    // -> reverb -> liveprog -> limiterNode -> masterOutput
    this.masterEffectGain.connect(this.limiter.preampNode);
    this.limiter.preampNode.connect(this.equalizer.inputNode);
    this.equalizer.outputNode.connect(this.dynamicBass.inputNode);
    this.dynamicBass.outputNode.connect(this.compander.inputNode);
    this.compander.outputNode.connect(this.tubeSaturation.inputNode);
    this.tubeSaturation.outputNode.connect(this.ddc.inputNode);
    this.ddc.outputNode.connect(this.convolver.inputNode);
    this.convolver.outputNode.connect(this.crossfeed.inputNode);
    this.crossfeed.outputNode.connect(this.stereoWiden.inputNode);
    this.stereoWiden.outputNode.connect(this.reverb.inputNode);
    this.reverb.outputNode.connect(this.liveprog.inputNode);
    this.liveprog.outputNode.connect(this.limiter.limiterNode);
    this.limiter.limiterNode.connect(this.masterOutput);

    // Master Output connects to Analyser and AudioContext Destination
    this.masterOutput.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  setMasterPower(enabled) {
    this.masterPower = !!enabled;
    this.updateMasterPower(this.masterPower);
  }

  updateMasterPower(enabled) {
    const t = this.ctx.currentTime;
    if (enabled) {
      this.masterBypassGain.gain.setTargetAtTime(0.0, t, 0.02);
      this.masterEffectGain.gain.setTargetAtTime(1.0, t, 0.02);
    } else {
      this.masterBypassGain.gain.setTargetAtTime(1.0, t, 0.02);
      this.masterEffectGain.gain.setTargetAtTime(0.0, t, 0.02);
    }
  }

  getFrequencyData() {
    this.analyser.getByteFrequencyData(this.fftDataBuffer);
    return Array.from(this.fftDataBuffer);
  }

  getCombinedResponse(frequencies) {
    return Array.from(this.equalizer.getFrequencyResponse(frequencies));
  }

  toggleModule(moduleName, enabled) {
    switch (moduleName) {
      case 'equalizer':
        this.equalizer.setEnabled(enabled);
        break;
      case 'dynamicBass':
        this.dynamicBass.setEnabled(enabled);
        break;
      case 'compander':
        this.compander.setEnabled(enabled);
        break;
      case 'tubeSaturation':
        this.tubeSaturation.setEnabled(enabled);
        break;
      case 'ddc':
        this.ddc.setEnabled(enabled);
        break;
      case 'convolver':
        this.convolver.setEnabled(enabled);
        break;
      case 'crossfeed':
        this.crossfeed.setEnabled(enabled);
        break;
      case 'stereoWiden':
        this.stereoWiden.setEnabled(enabled);
        break;
      case 'reverb':
        this.reverb.setEnabled(enabled);
        break;
      case 'liveprog':
        this.liveprog.setEnabled(enabled);
        break;
      case 'limiter':
        this.limiter.setEnabled(enabled);
        break;
    }
  }

  updateParam(moduleName, paramName, value) {
    switch (moduleName) {
      case 'equalizer':
        if (paramName === 'band') {
          this.equalizer.setBandGain(value.index, value.gain);
        } else if (paramName === 'allBands') {
          this.equalizer.setAllGains(value);
        } else if (paramName === 'filterMode') {
          this.equalizer.setFilterMode(value);
        } else if (paramName === 'interpolation') {
          this.equalizer.setInterpolation(value);
        }
        break;

      case 'dynamicBass':
        if (paramName === 'maxGain') this.dynamicBass.setMaxGain(value);
        else if (paramName === 'frequency') this.dynamicBass.setFrequency(value);
        else if (paramName === 'mode') this.dynamicBass.setMode(value);
        break;

      case 'compander':
        this.compander.setParam(paramName, value);
        break;

      case 'tubeSaturation':
        if (paramName === 'drive') this.tubeSaturation.setDrive(value);
        break;

      case 'convolver':
        if (paramName === 'advImp') this.convolver.setAdvImpString(value);
        else if (paramName === 'mode') this.convolver.setMode(value);
        else if (paramName === 'wet') this.convolver.setGains(value, this.convolver.dryGain);
        break;

      case 'crossfeed':
        if (paramName === 'mode') this.crossfeed.setMode(value);
        else if (paramName === 'custom') this.crossfeed.setCustomParams(value.fcut, value.feed);
        break;

      case 'stereoWiden':
        if (paramName === 'width') this.stereoWiden.setWidth(value);
        break;

      case 'reverb':
        if (paramName === 'preset') this.reverb.setPreset(value);
        break;

      case 'liveprog':
        if (paramName === 'slider') this.liveprog.setSliderValue(value.id, value.value);
        break;

      case 'limiter':
        if (paramName === 'preamp') this.limiter.setPreampGain(value);
        else if (paramName === 'threshold') this.limiter.setThreshold(value);
        break;
    }
  }

  setModuleParam(moduleName, paramName, value) {
    this.updateParam(moduleName, paramName, value);
  }

  exportState() {
    return {
      masterPower: this.masterPower,
      equalizer: {
        enabled: this.equalizer.enabled,
        gains: [...this.equalizer.gains],
        filterMode: this.equalizer.filterMode,
        interpolation: this.equalizer.interpolation
      },
      dynamicBass: {
        enabled: this.dynamicBass.enabled,
        maxGain: this.dynamicBass.maxGain,
        frequency: this.dynamicBass.frequency,
        mode: this.dynamicBass.mode
      },
      compander: {
        enabled: this.compander.enabled,
        params: { ...this.compander.params }
      },
      tubeSaturation: {
        enabled: this.tubeSaturation.enabled,
        drive: this.tubeSaturation.drive
      },
      ddc: {
        enabled: this.ddc.enabled,
        profile: this.ddc.currentProfileName
      },
      convolver: {
        enabled: this.convolver.enabled,
        mode: this.convolver.mode,
        advImp: this.convolver.advImpParams.join(';'),
        fileName: this.convolver.currentFileName
      },
      crossfeed: {
        enabled: this.crossfeed.enabled,
        mode: this.crossfeed.mode,
        customFcut: this.crossfeed.customFcut,
        customFeed: this.crossfeed.customFeed
      },
      stereoWiden: {
        enabled: this.stereoWiden.enabled,
        width: this.stereoWiden.width
      },
      reverb: {
        enabled: this.reverb.enabled,
        preset: this.reverb.presetIndex
      },
      liveprog: {
        enabled: this.liveprog.enabled,
        scriptName: this.liveprog.scriptName,
        variables: { ...this.liveprog.variables }
      },
      limiter: {
        enabled: this.limiter.enabled,
        preampDb: this.limiter.preampDb,
        thresholdDb: this.limiter.thresholdDb
      }
    };
  }

  applyPreset(state) {
    if (!state) return;
    if (state.masterPower !== undefined) this.setMasterPower(state.masterPower);
    if (state.equalizer) {
      if (state.equalizer.enabled !== undefined) this.toggleModule('equalizer', state.equalizer.enabled);
      if (state.equalizer.gains) this.equalizer.setAllGains(state.equalizer.gains);
      if (state.equalizer.filterMode) this.equalizer.setFilterMode(state.equalizer.filterMode);
      if (state.equalizer.interpolation) this.equalizer.setInterpolation(state.equalizer.interpolation);
    }
    if (state.dynamicBass) {
      if (state.dynamicBass.enabled !== undefined) this.toggleModule('dynamicBass', state.dynamicBass.enabled);
      if (state.dynamicBass.maxGain !== undefined) this.dynamicBass.setMaxGain(state.dynamicBass.maxGain);
      if (state.dynamicBass.frequency !== undefined) this.dynamicBass.setFrequency(state.dynamicBass.frequency);
      if (state.dynamicBass.mode !== undefined) this.dynamicBass.setMode(state.dynamicBass.mode);
    }
    if (state.compander) {
      if (state.compander.enabled !== undefined) this.toggleModule('compander', state.compander.enabled);
      if (state.compander.params) {
        Object.entries(state.compander.params).forEach(([k, v]) => this.compander.setParam(k, v));
      }
    }
    if (state.tubeSaturation) {
      if (state.tubeSaturation.enabled !== undefined) this.toggleModule('tubeSaturation', state.tubeSaturation.enabled);
      if (state.tubeSaturation.drive !== undefined) this.tubeSaturation.setDrive(state.tubeSaturation.drive);
    }
    if (state.ddc) {
      if (state.ddc.enabled !== undefined) this.toggleModule('ddc', state.ddc.enabled);
    }
    if (state.convolver) {
      if (state.convolver.enabled !== undefined) this.toggleModule('convolver', state.convolver.enabled);
      if (state.convolver.mode !== undefined) this.convolver.setMode(state.convolver.mode);
      if (state.convolver.advImp) this.convolver.setAdvImpString(state.convolver.advImp);
    }
    if (state.crossfeed) {
      if (state.crossfeed.enabled !== undefined) this.toggleModule('crossfeed', state.crossfeed.enabled);
      if (state.crossfeed.mode !== undefined) this.crossfeed.setMode(state.crossfeed.mode);
      if (state.crossfeed.customFcut && state.crossfeed.customFeed) {
        this.crossfeed.setCustomParams(state.crossfeed.customFcut, state.crossfeed.customFeed);
      }
    }
    if (state.stereoWiden) {
      if (state.stereoWiden.enabled !== undefined) this.toggleModule('stereoWiden', state.stereoWiden.enabled);
      if (state.stereoWiden.width !== undefined) this.stereoWiden.setWidth(state.stereoWiden.width);
    }
    if (state.reverb) {
      if (state.reverb.enabled !== undefined) this.toggleModule('reverb', state.reverb.enabled);
      if (state.reverb.preset !== undefined) this.reverb.setPreset(state.reverb.preset);
    }
    if (state.liveprog) {
      if (state.liveprog.enabled !== undefined) this.toggleModule('liveprog', state.liveprog.enabled);
      if (state.liveprog.variables) {
        Object.entries(state.liveprog.variables).forEach(([k, v]) => this.liveprog.setSliderValue(k, v));
      }
    }
    if (state.limiter) {
      if (state.limiter.enabled !== undefined) this.toggleModule('limiter', state.limiter.enabled);
      if (state.limiter.preampDb !== undefined) this.limiter.setPreampGain(state.limiter.preampDb);
      if (state.limiter.thresholdDb !== undefined) this.limiter.setThreshold(state.limiter.thresholdDb);
    }
  }
}
