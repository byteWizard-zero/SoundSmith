/**
 * Equalizer Module for JamesDSP
 * Implements 10-band and 15-band graphic equalizer with arbitrary response support.
 */

export const FREQUENCIES_10_BAND = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const FREQUENCIES_15_BAND = [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000];

export class Equalizer {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.enabled = true;
    this.mode = 10; // 10 or 15 bands
    this.gains = new Array(15).fill(0); // in dB (-15dB to +15dB)

    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();
    this.bypassNode = this.ctx.createGain();
    this.effectNode = this.ctx.createGain();

    this.filters = [];
    this._buildFilterBank(FREQUENCIES_10_BAND);

    // Initial routing
    this.inputNode.connect(this.effectNode);
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);

    this.updateBypassState();
  }

  _buildFilterBank(frequencies) {
    // Disconnect old filters and effectNode to ensure clean rebuilding
    this.effectNode.disconnect();
    this.filters.forEach(f => f.disconnect());
    this.filters = [];

    let prevNode = this.effectNode;
    const bandCount = frequencies.length;

    frequencies.forEach((freq, idx) => {
      const filter = this.ctx.createBiquadFilter();
      if (idx === 0) {
        filter.type = 'lowshelf';
      } else if (idx === bandCount - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
        filter.Q.value = bandCount === 10 ? 1.414 : 2.0;
      }
      filter.frequency.value = freq;
      filter.gain.value = this.gains[idx] || 0;

      prevNode.connect(filter);
      prevNode = filter;
      this.filters.push(filter);
    });

    prevNode.connect(this.outputNode);
  }

  setMode(bandMode) {
    if (bandMode === 10 || bandMode === 15) {
      this.mode = bandMode;
      const freqs = bandMode === 10 ? FREQUENCIES_10_BAND : FREQUENCIES_15_BAND;
      this._buildFilterBank(freqs);
    }
  }

  setBandGain(index, gainDb) {
    if (index >= 0 && index < this.filters.length) {
      this.gains[index] = gainDb;
      const filter = this.filters[index];
      filter.gain.value = gainDb;
    }
  }

  setAllGains(gainArray) {
    gainArray.forEach((gain, idx) => {
      this.setBandGain(idx, gain);
    });
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.updateBypassState();
  }

  updateBypassState() {
    this.bypassNode.gain.value = this.enabled ? 0.0 : 1.0;
    this.effectNode.gain.value = this.enabled ? 1.0 : 0.0;
  }

  /**
   * Computes the combined frequency response across all active EQ filters.
   * Useful for drawing the exact curve in the Canvas UI.
   */
  getFrequencyResponse(frequencies) {
    if (!this.enabled || this.filters.length === 0) {
      return new Float32Array(frequencies.length).fill(0);
    }

    const freqArray = new Float32Array(frequencies);
    const totalMag = new Float32Array(frequencies.length).fill(1.0);
    const magResponse = new Float32Array(frequencies.length);
    const phaseResponse = new Float32Array(frequencies.length);

    this.filters.forEach(filter => {
      filter.getFrequencyResponse(freqArray, magResponse, phaseResponse);
      for (let i = 0; i < frequencies.length; i++) {
        totalMag[i] *= magResponse[i];
      }
    });

    const dbResponse = new Float32Array(frequencies.length);
    for (let i = 0; i < frequencies.length; i++) {
      dbResponse[i] = 20 * Math.log10(Math.max(totalMag[i], 1e-4));
    }
    return dbResponse;
  }
}
