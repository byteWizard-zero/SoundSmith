/**
 * Master DSP Processing Engine for JamesDSP
 * Chains all DSP modules and orchestrates audio graph lifecycle.
 */

import { Equalizer, FREQUENCIES_10_BAND, FREQUENCIES_15_BAND } from './equalizer.js';
import { DynamicBass } from './dynamic-bass.js';
import { ConvolverModule } from './convolver.js';
import { TubeSaturation } from './tube-saturation.js';
import { Crossfeed } from './crossfeed.js';
import { StereoWiden } from './stereo-widen.js';
import { Reverb } from './reverb.js';
import { MasterLimiter } from './limiter.js';

export class DspEngine {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.masterPower = true;

    // Master in/out nodes
    this.masterInput = this.ctx.createGain();
    this.masterOutput = this.ctx.createGain();

    // Direct bypass path when master power is switched OFF
    this.masterBypassGain = this.ctx.createGain();
    this.masterEffectGain = this.ctx.createGain();

    // FFT Spectrum Analyser
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    this.fftDataBuffer = new Uint8Array(this.analyser.frequencyBinCount);

    // Instantiate Modules
    this.equalizer = new Equalizer(this.ctx);
    this.dynamicBass = new DynamicBass(this.ctx);
    this.convolver = new ConvolverModule(this.ctx);
    this.tubeSaturation = new TubeSaturation(this.ctx);
    this.crossfeed = new Crossfeed(this.ctx);
    this.stereoWiden = new StereoWiden(this.ctx);
    this.reverb = new Reverb(this.ctx);
    this.limiter = new MasterLimiter(this.ctx);

    // Build the DSP Serial Chain:
    // masterInput -> masterEffectGain -> limiter.preampNode -> equalizer -> dynamicBass -> convolver
    // -> tubeSaturation -> crossfeed -> stereoWiden -> reverb -> limiter.limiterNode -> masterOutput -> analyser -> destination
    this._wireGraph();
    this.updateMasterPower(true);
  }

  _wireGraph() {
    // Master input splits to effect path and bypass path
    this.masterInput.connect(this.masterEffectGain);
    this.masterInput.connect(this.masterBypassGain);

    // Bypass path connects straight to master output
    this.masterBypassGain.connect(this.masterOutput);

    // PURE SERIAL Effect chain connections:
    this.masterEffectGain.connect(this.limiter.preampNode);
    this.limiter.preampNode.connect(this.equalizer.inputNode);
    this.equalizer.outputNode.connect(this.dynamicBass.inputNode);
    this.dynamicBass.outputNode.connect(this.convolver.inputNode);
    this.convolver.outputNode.connect(this.tubeSaturation.inputNode);
    this.tubeSaturation.outputNode.connect(this.crossfeed.inputNode);
    this.crossfeed.outputNode.connect(this.stereoWiden.inputNode);
    this.stereoWiden.outputNode.connect(this.reverb.inputNode);
    this.reverb.outputNode.connect(this.limiter.limiterNode);
    this.limiter.limiterNode.connect(this.masterOutput);

    // Master output connects to Analyser and AudioContext Destination
    this.masterOutput.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  setMasterPower(enabled) {
    this.masterPower = !!enabled;
    this.updateMasterPower(this.masterPower);
  }

  updateMasterPower(enabled) {
    if (enabled) {
      this.masterBypassGain.gain.value = 0.0;
      this.masterEffectGain.gain.value = 1.0;
    } else {
      this.masterBypassGain.gain.value = 1.0;
      this.masterEffectGain.gain.value = 0.0;
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
      case 'convolver':
        this.convolver.setEnabled(enabled);
        break;
      case 'tubeSaturation':
        this.tubeSaturation.setEnabled(enabled);
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
    }
  }

  setModuleParam(moduleName, paramName, value) {
    switch (moduleName) {
      case 'equalizer':
        if (paramName === 'bandGain') {
          this.equalizer.setBandGain(value.index, value.gain);
        } else if (paramName === 'mode') {
          this.equalizer.setMode(value);
        } else if (paramName === 'allGains') {
          this.equalizer.setAllGains(value);
        }
        break;
      case 'dynamicBass':
        if (paramName === 'gain') this.dynamicBass.setGain(value);
        if (paramName === 'cutoff') this.dynamicBass.setCutoff(value);
        if (paramName === 'harmonics') this.dynamicBass.setHarmonics(value);
        break;
      case 'convolver':
        if (paramName === 'wetDry') this.convolver.setWetDry(value.wet, value.dry);
        if (paramName === 'synthetic') this.convolver.generateSyntheticImpulse(value.duration, value.decay, value.name);
        break;
      case 'tubeSaturation':
        if (paramName === 'drive') this.tubeSaturation.setDrive(value);
        if (paramName === 'warmth') this.tubeSaturation.setWarmth(value);
        break;
      case 'crossfeed':
        if (paramName === 'preset') this.crossfeed.setPreset(value);
        break;
      case 'stereoWiden':
        if (paramName === 'width') this.stereoWiden.setWidth(value);
        break;
      case 'reverb':
        if (paramName === 'roomSize') this.reverb.setRoomSize(value);
        if (paramName === 'damping') this.reverb.setDamping(value);
        if (paramName === 'wetDry') this.reverb.setWetDry(value.wet, value.dry);
        break;
      case 'limiter':
        if (paramName === 'preamp') this.limiter.setPreampGain(value);
        break;
    }
  }

  applyPreset(preset) {
    if (!preset) return;
    if (preset.equalizer) {
      if (preset.equalizer.mode !== undefined) this.equalizer.setMode(preset.equalizer.mode);
      if (preset.equalizer.enabled !== undefined) this.equalizer.setEnabled(preset.equalizer.enabled);
      if (preset.equalizer.gains) this.equalizer.setAllGains(preset.equalizer.gains);
    }
    if (preset.dynamicBass) {
      if (preset.dynamicBass.enabled !== undefined) this.dynamicBass.setEnabled(preset.dynamicBass.enabled);
      if (preset.dynamicBass.gain !== undefined) this.dynamicBass.setGain(preset.dynamicBass.gain);
      if (preset.dynamicBass.cutoff !== undefined) this.dynamicBass.setCutoff(preset.dynamicBass.cutoff);
      if (preset.dynamicBass.harmonics !== undefined) this.dynamicBass.setHarmonics(preset.dynamicBass.harmonics);
    }
    if (preset.tubeSaturation) {
      if (preset.tubeSaturation.enabled !== undefined) this.tubeSaturation.setEnabled(preset.tubeSaturation.enabled);
      if (preset.tubeSaturation.drive !== undefined) this.tubeSaturation.setDrive(preset.tubeSaturation.drive);
      if (preset.tubeSaturation.warmth !== undefined) this.tubeSaturation.setWarmth(preset.tubeSaturation.warmth);
    }
    if (preset.crossfeed) {
      if (preset.crossfeed.enabled !== undefined) this.crossfeed.setEnabled(preset.crossfeed.enabled);
      if (preset.crossfeed.preset) this.crossfeed.setPreset(preset.crossfeed.preset);
    }
    if (preset.stereoWiden) {
      if (preset.stereoWiden.enabled !== undefined) this.stereoWiden.setEnabled(preset.stereoWiden.enabled);
      if (preset.stereoWiden.width !== undefined) this.stereoWiden.setWidth(preset.stereoWiden.width);
    }
    if (preset.reverb) {
      if (preset.reverb.enabled !== undefined) this.reverb.setEnabled(preset.reverb.enabled);
      if (preset.reverb.roomSize !== undefined) this.reverb.setRoomSize(preset.reverb.roomSize);
      if (preset.reverb.damping !== undefined) this.reverb.setDamping(preset.reverb.damping);
      if (preset.reverb.wet !== undefined) this.reverb.setWetDry(preset.reverb.wet);
    }
    if (preset.limiter) {
      if (preset.limiter.preamp !== undefined) this.limiter.setPreampGain(preset.limiter.preamp);
    }
  }

  exportState() {
    return {
      masterPower: this.masterPower,
      equalizer: {
        enabled: this.equalizer.enabled,
        mode: this.equalizer.mode,
        gains: [...this.equalizer.gains]
      },
      dynamicBass: {
        enabled: this.dynamicBass.enabled,
        gain: this.dynamicBass.bassGainDb,
        cutoff: this.dynamicBass.cutoffFreq,
        harmonics: this.dynamicBass.harmonics
      },
      convolver: {
        enabled: this.convolver.enabled,
        presetName: this.convolver.currentPresetName,
        wet: this.convolver.wetGainVal,
        dry: this.convolver.dryGainVal
      },
      tubeSaturation: {
        enabled: this.tubeSaturation.enabled,
        drive: this.tubeSaturation.drive,
        warmth: this.tubeSaturation.warmth
      },
      crossfeed: {
        enabled: this.crossfeed.enabled,
        preset: this.crossfeed.preset
      },
      stereoWiden: {
        enabled: this.stereoWiden.enabled,
        width: this.stereoWiden.width
      },
      reverb: {
        enabled: this.reverb.enabled,
        roomSize: this.reverb.roomSize,
        damping: this.reverb.dampingFreq,
        wet: this.reverb.wetGain
      },
      limiter: {
        preamp: this.limiter.preampGainDb
      }
    };
  }
}
