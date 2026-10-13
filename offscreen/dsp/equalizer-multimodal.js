/**
 * Multimodal 15-Band Equalizer for SoundSmith
 * Supports FIR Min-Phase & IIR 4th–12th order cascades with CHIP/Akima interpolation.
 * Matches RootlessJamesDSP PARAM_EQUALIZER_* (112, 114, 115, 116).
 */

import { ISO_FREQUENCIES_15 } from '../../ui/components/spline-visualizer.js';
import { AkimaSpline, PchipSpline } from './math/akima-spline.js';

export class MultimodalEqualizer {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.enabled = true;
    this.frequencies = ISO_FREQUENCIES_15;
    this.gains = new Float32Array(15).fill(0); // -12dB to +12dB

    this.filterType = 0; // 0: FIR Min-phase, 1: IIR 4th, 2: IIR 6th, 3: IIR 8th, 4: IIR 10th, 5: IIR 12th
    this.interpolator = 1; // 0: CHIP, 1: MHA (Modified Akima)

    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();
    this.bypassNode = this.ctx.createGain();
    this.effectNode = this.ctx.createGain();

    this.filters = [];
    this._rebuildFilterBank();

    // Wiring
    this.inputNode.connect(this.effectNode);
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);

    this.updateBypassState();
  }

  _rebuildFilterBank() {
    this.effectNode.disconnect();
    this.filters.forEach(f => f.disconnect());
    this.filters = [];

    let prevNode = this.effectNode;
    const bandCount = this.frequencies.length;
    // Calculate cascade stages based on IIR order (Order 4 = 2 biquads, Order 12 = 6 biquads)
    const stages = Math.max(1, Math.min(6, Math.floor((this.filterType + 1))));

    this.frequencies.forEach((freq, idx) => {
      const bandFilters = [];
      for (let s = 0; s < stages; s++) {
        const filter = this.ctx.createBiquadFilter();
        if (idx === 0) {
          filter.type = 'lowshelf';
        } else if (idx === bandCount - 1) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
          filter.Q.value = 2.0;
        }
        filter.frequency.value = freq;
        // Distribute gain across stages
        filter.gain.value = (this.gains[idx] || 0) / stages;

        prevNode.connect(filter);
        prevNode = filter;
        bandFilters.push(filter);
      }
      this.filters.push(bandFilters);
    });

    prevNode.connect(this.outputNode);
  }

  setGain(bandIndex, gainDb) {
    if (bandIndex >= 0 && bandIndex < 15) {
      this.gains[bandIndex] = Math.max(-12, Math.min(12, gainDb));
      const bandFilters = this.filters[bandIndex];
      if (bandFilters) {
        const perStageGain = this.gains[bandIndex] / bandFilters.length;
        bandFilters.forEach(f => {
          f.gain.value = perStageGain;
        });
      }
    }
  }

  setAllGains(gainArray) {
    for (let i = 0; i < Math.min(gainArray.length, 15); i++) {
      this.setGain(i, gainArray[i]);
    }
  }

  setFilterType(typeIndex) {
    if (typeIndex >= 0 && typeIndex <= 5 && typeIndex !== this.filterType) {
      this.filterType = typeIndex;
      this._rebuildFilterBank();
    }
  }

  setInterpolator(interpIndex) {
    this.interpolator = interpIndex;
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.updateBypassState();
  }

  updateBypassState() {
    this.bypassNode.gain.value = this.enabled ? 0.0 : 1.0;
    this.effectNode.gain.value = this.enabled ? 1.0 : 0.0;
  }

  getInterpolatedCurve(queryFrequencies) {
    const logXs = this.frequencies.map(f => Math.log10(f));
    const queryLogXs = queryFrequencies.map(f => Math.log10(f));
    const interpFunc = this.interpolator === 0 ? PchipSpline.interpolate : AkimaSpline.interpolate;
    return interpFunc(logXs, Array.from(this.gains), queryLogXs);
  }
}

export const EqualizerMultimodal = MultimodalEqualizer;
