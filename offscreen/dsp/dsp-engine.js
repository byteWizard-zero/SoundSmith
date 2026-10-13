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
    try {
      if (state.masterPower !== undefined) this.setMasterPower(state.masterPower);

      // Equalizer (nested or flat)
      const eqState = state.equalizer || {};
      const eqEnabled = state.eqEnabled !== undefined ? state.eqEnabled : eqState.enabled;
      if (eqEnabled !== undefined) this.toggleModule('equalizer', eqEnabled);
      const eqGains = state.eqGains || eqState.gains;
      if (eqGains && Array.isArray(eqGains)) this.equalizer.setAllGains(eqGains);
      const eqFilterType = state.eqFilterType !== undefined ? state.eqFilterType : eqState.filterMode;
      if (eqFilterType !== undefined) this.equalizer.setFilterMode(eqFilterType);
      const eqInterp = state.eqInterpolation !== undefined ? state.eqInterpolation : eqState.interpolation;
      if (eqInterp !== undefined) this.equalizer.setInterpolation(eqInterp);

      // Dynamic Bass (nested or flat)
      const bassState = state.dynamicBass || {};
      const bassEnabled = state.dynamicBassEnabled !== undefined ? state.dynamicBassEnabled : bassState.enabled;
      if (bassEnabled !== undefined) this.toggleModule('dynamicBass', bassEnabled);
      const bassGain = state.dynamicBassGain !== undefined ? state.dynamicBassGain : bassState.maxGain;
      if (bassGain !== undefined) this.dynamicBass.setMaxGain(bassGain);
      const bassFreq = state.dynamicBassFreq !== undefined ? state.dynamicBassFreq : bassState.frequency;
      if (bassFreq !== undefined) this.dynamicBass.setFrequency(bassFreq);
      const bassMode = state.dynamicBassMode !== undefined ? state.dynamicBassMode : bassState.mode;
      if (bassMode !== undefined) this.dynamicBass.setMode(bassMode);

      // Compander (nested or flat)
      const compState = state.compander || {};
      const compEnabled = state.companderEnabled !== undefined ? state.companderEnabled : compState.enabled;
      if (compEnabled !== undefined) this.toggleModule('compander', compEnabled);
      if (state.compThreshold !== undefined) this.compander.setParam('threshold', state.compThreshold);
      if (state.compRatio !== undefined) this.compander.setParam('ratio', state.compRatio);
      if (state.compAttack !== undefined) this.compander.setParam('attack', state.compAttack);
      if (state.compRelease !== undefined) this.compander.setParam('release', state.compRelease);
      if (compState.params) {
        Object.entries(compState.params).forEach(([k, v]) => this.compander.setParam(k, v));
      }

      // Tube Saturation (nested or flat)
      const tubeState = state.tubeSaturation || {};
      const tubeEnabled = state.tubeEnabled !== undefined ? state.tubeEnabled : tubeState.enabled;
      if (tubeEnabled !== undefined) this.toggleModule('tubeSaturation', tubeEnabled);
      const tubeDrive = state.tubeDrive !== undefined ? state.tubeDrive : tubeState.drive;
      if (tubeDrive !== undefined) this.tubeSaturation.setDrive(tubeDrive);

      // ViPER-DDC
      const ddcState = state.ddc || {};
      const ddcEnabled = state.ddcEnabled !== undefined ? state.ddcEnabled : ddcState.enabled;
      if (ddcEnabled !== undefined) this.toggleModule('ddc', ddcEnabled);

      // Convolver
      const convState = state.convolver || {};
      const convEnabled = state.convolverEnabled !== undefined ? state.convolverEnabled : convState.enabled;
      if (convEnabled !== undefined) this.toggleModule('convolver', convEnabled);
      const convMode = state.convolverMode !== undefined ? state.convolverMode : convState.mode;
      if (convMode !== undefined) this.convolver.setMode(convMode);
      const convAdv = state.convolverAdvImp || convState.advImp;
      if (convAdv) this.convolver.setAdvImpString(convAdv);

      // Crossfeed
      const xfState = state.crossfeed || {};
      const xfEnabled = state.crossfeedEnabled !== undefined ? state.crossfeedEnabled : xfState.enabled;
      if (xfEnabled !== undefined) this.toggleModule('crossfeed', xfEnabled);
      const xfMode = state.crossfeedMode !== undefined ? state.crossfeedMode : xfState.mode;
      if (xfMode !== undefined) this.crossfeed.setMode(xfMode);
      if (xfState.customFcut && xfState.customFeed) {
        this.crossfeed.setCustomParams(xfState.customFcut, xfState.customFeed);
      }

      // Stereo Widen
      const widenState = state.stereoWiden || {};
      const widenEnabled = state.stereoWidenEnabled !== undefined ? state.stereoWidenEnabled : widenState.enabled;
      if (widenEnabled !== undefined) this.toggleModule('stereoWiden', widenEnabled);
      const stereoWidth = state.stereoWidth !== undefined ? (state.stereoWidth / 100) : widenState.width;
      if (stereoWidth !== undefined) this.stereoWiden.setWidth(stereoWidth);

      // Reverb
      const revState = state.reverb || {};
      const revEnabled = state.reverbEnabled !== undefined ? state.reverbEnabled : revState.enabled;
      if (revEnabled !== undefined) this.toggleModule('reverb', revEnabled);
      const revPreset = state.reverbPreset !== undefined ? state.reverbPreset : revState.preset;
      if (revPreset !== undefined) this.reverb.setPreset(revPreset);

      // LiveProg
      const lpState = state.liveprog || {};
      const lpEnabled = state.liveprogEnabled !== undefined ? state.liveprogEnabled : lpState.enabled;
      if (lpEnabled !== undefined) this.toggleModule('liveprog', lpEnabled);
      if (lpState.variables) {
        Object.entries(lpState.variables).forEach(([k, v]) => this.liveprog.setSliderValue(k, v));
      }

      // Limiter & Preamp
      const limState = state.limiter || {};
      const limEnabled = state.limiterEnabled !== undefined ? state.limiterEnabled : limState.enabled;
      if (limEnabled !== undefined) this.toggleModule('limiter', limEnabled);
      const preamp = state.preampGain !== undefined ? state.preampGain : limState.preampDb;
      if (preamp !== undefined) this.limiter.setPreampGain(preamp);
      const thresh = state.limiterThreshold !== undefined ? state.limiterThreshold : limState.thresholdDb;
      if (thresh !== undefined) this.limiter.setThreshold(thresh);
    } catch (err) {
      console.warn('[SoundSmith DspEngine] Error in applyPreset:', err);
    }
  }
}
