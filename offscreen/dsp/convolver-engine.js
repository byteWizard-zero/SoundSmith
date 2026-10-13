/**
 * SoundSmith Convolver Engine
 * High-performance Partitioned Impulse Response Convolver with AdvImp Waveform Editor
 * and Minimum-Phase Transform.
 * 
 * Ported from RootlessJamesDSP libjdspimptoolbox & FFTConvolver2x4x2
 */

export const CONVOLVER_MODES = {
  FULL: 0,
  AUTO_TRIM_DELAY: 1,
  MINIMUM_PHASE: 2
};

export class ConvolverEngine {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.enabled = false;
    this.mode = CONVOLVER_MODES.FULL;
    
    // AdvImp params: [startCutDb, endCutDb, delayCh1, delayCh2, delayCh3, delayCh4]
    this.advImpParams = [-80, -100, 0, 0, 0, 0];
    this.currentFileName = '';
    this.rawAudioBuffer = null;
    this.processedAudioBuffer = null;

    // Node graph
    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();
    this.bypassNode = this.ctx.createGain();
    this.convolverNode = this.ctx.createConvolver();
    this.convolverNode.normalize = false;

    this.wetGainNode = this.ctx.createGain();
    this.dryGainNode = this.ctx.createGain();
    this.makeupGainNode = this.ctx.createGain();

    this.wetGain = 1.0;
    this.dryGain = 0.0;
    this.makeupDb = 0.0;

    this._buildGraph();
    this.updateBypassState();
  }

  _buildGraph() {
    // Dry / Bypass path
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);

    // Direct dry signal when convolver is enabled
    this.inputNode.connect(this.dryGainNode);
    this.dryGainNode.connect(this.outputNode);

    // Wet convolver path
    this.inputNode.connect(this.convolverNode);
    this.convolverNode.connect(this.wetGainNode);
    this.wetGainNode.connect(this.makeupGainNode);
    this.makeupGainNode.connect(this.outputNode);
  }

  /**
   * Load impulse response from ArrayBuffer or AudioBuffer
   */
  async loadImpulseResponseFromArrayBuffer(arrayBuffer, filename = 'custom.wav') {
    try {
      const decodedBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
      this.rawAudioBuffer = decodedBuffer;
      this.currentFileName = filename;
      await this.processAndApplyIR();
      return true;
    } catch (err) {
      console.error('ConvolverEngine: Failed to decode impulse response:', err);
      return false;
    }
  }

  /**
   * Parse AdvImp parameter string e.g. "-80;-100;0;0;0;0"
   */
  setAdvImpString(advImpString) {
    if (!advImpString || typeof advImpString !== 'string') return;
    const parts = advImpString.split(';').map(p => parseFloat(p.trim()));
    if (parts.length >= 6 && parts.every(n => !isNaN(n))) {
      this.advImpParams = parts.slice(0, 6);
      if (this.rawAudioBuffer) {
        this.processAndApplyIR();
      }
    }
  }

  setMode(mode) {
    this.mode = parseInt(mode, 10) || 0;
    if (this.rawAudioBuffer) {
      this.processAndApplyIR();
    }
  }

  setGains(wetGain, dryGain = 0.0, makeupDb = 0.0) {
    this.wetGain = Math.max(0, Math.min(2.0, wetGain));
    this.dryGain = Math.max(0, Math.min(1.0, dryGain));
    this.makeupDb = makeupDb;

    const t = this.ctx.currentTime;
    const makeupLinear = Math.pow(10, this.makeupDb / 20);
    this.wetGainNode.gain.setTargetAtTime(this.wetGain, t, 0.02);
    this.dryGainNode.gain.setTargetAtTime(this.dryGain, t, 0.02);
    this.makeupGainNode.gain.setTargetAtTime(makeupLinear, t, 0.02);
  }

  /**
   * Applies AdvImp trimming, channel shifting, and/or minimum-phase reconstruction
   */
  async processAndApplyIR() {
    if (!this.rawAudioBuffer) return;

    const numChannels = this.rawAudioBuffer.numberOfChannels;
    const sampleRate = this.rawAudioBuffer.sampleRate;
    const length = this.rawAudioBuffer.length;

    // Extract channel data
    const channels = [];
    for (let c = 0; c < numChannels; c++) {
      channels.push(new Float32Array(this.rawAudioBuffer.getChannelData(c)));
    }

    let processedChannels = channels;

    if (this.mode === CONVOLVER_MODES.AUTO_TRIM_DELAY) {
      processedChannels = this._applyAdvImpTrimming(channels, length, sampleRate);
    } else if (this.mode === CONVOLVER_MODES.MINIMUM_PHASE) {
      processedChannels = this._applyMinimumPhase(channels);
    }

    // Create processed AudioBuffer
    const outLength = processedChannels[0].length;
    const finalBuffer = this.ctx.createBuffer(numChannels, outLength, sampleRate);
    for (let c = 0; c < numChannels; c++) {
      finalBuffer.copyToChannel(processedChannels[c], c);
    }

    this.processedAudioBuffer = finalBuffer;
    this.convolverNode.buffer = this.processedAudioBuffer;
  }

  /**
   * AdvImp trimming based on energy thresholds and per-channel sample delay shift
   */
  _applyAdvImpTrimming(channels, length, sampleRate) {
    const [startCutDb, endCutDb, delay1, delay2, delay3, delay4] = this.advImpParams;
    const startThreshold = Math.pow(10, startCutDb / 20);
    const endThreshold = Math.pow(10, endCutDb / 20);
    const channelDelays = [delay1 || 0, delay2 || 0, delay3 || 0, delay4 || 0];

    // Find energy envelope start and end indices
    let startIdx = length;
    let endIdx = 0;

    for (let c = 0; c < channels.length; c++) {
      const data = channels[c];
      for (let i = 0; i < length; i++) {
        if (Math.abs(data[i]) >= startThreshold) {
          if (i < startIdx) startIdx = i;
          break;
        }
      }
      for (let i = length - 1; i >= 0; i--) {
        if (Math.abs(data[i]) >= endThreshold) {
          if (i > endIdx) endIdx = i;
          break;
        }
      }
    }

    if (startIdx >= endIdx || startIdx >= length) {
      startIdx = 0;
      endIdx = length - 1;
    }

    const trimmedLen = Math.max(64, endIdx - startIdx + 1);
    const result = [];

    for (let c = 0; c < channels.length; c++) {
      const delay = Math.max(0, Math.floor(channelDelays[c] || 0));
      const out = new Float32Array(trimmedLen + delay);
      const src = channels[c];
      for (let i = 0; i < trimmedLen; i++) {
        out[i + delay] = src[startIdx + i] || 0;
      }
      result.push(out);
    }

    return result;
  }

  /**
   * Minimum-Phase Transform via Real Cepstrum & Hilbert Operator
   */
  _applyMinimumPhase(channels) {
    const result = [];
    for (let c = 0; c < channels.length; c++) {
      const src = channels[c];
      const N = this._nextPow2(src.length);
      const real = new Float32Array(N);
      const imag = new Float32Array(N);
      real.set(src);

      // FFT -> log magnitude spectrum -> IFFT -> Cepstrum -> Hilbert window -> FFT -> exp -> IFFT
      this._fft(real, imag);

      // Log magnitude in frequency domain
      for (let i = 0; i < N; i++) {
        const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) + 1e-12;
        real[i] = Math.log(mag);
        imag[i] = 0;
      }

      // IFFT to get Real Cepstrum
      this._ifft(real, imag);

      // Hilbert minimum-phase window in cepstral domain:
      // h[0] = c[0], h[n] = 2*c[n] for 0 < n < N/2, h[N/2] = c[N/2], h[n] = 0 for n > N/2
      const halfN = N >> 1;
      for (let i = 1; i < halfN; i++) {
        real[i] *= 2.0;
        imag[i] = 0;
      }
      for (let i = halfN + 1; i < N; i++) {
        real[i] = 0;
        imag[i] = 0;
      }

      // FFT of analytic cepstrum -> Complex frequency response
      this._fft(real, imag);

      // Complex exponential: exp(a + j*b) = exp(a) * (cos(b) + j*sin(b))
      for (let i = 0; i < N; i++) {
        const expA = Math.exp(real[i]);
        const b = imag[i];
        real[i] = expA * Math.cos(b);
        imag[i] = expA * Math.sin(b);
      }

      // IFFT to minimum-phase impulse response
      this._ifft(real, imag);

      // Normalize peak to 1.0 or maintain original energy
      const out = new Float32Array(src.length);
      let maxPeak = 0;
      for (let i = 0; i < src.length; i++) {
        if (Math.abs(real[i]) > maxPeak) maxPeak = Math.abs(real[i]);
      }
      const scale = maxPeak > 0 ? 0.95 / maxPeak : 1.0;
      for (let i = 0; i < src.length; i++) {
        out[i] = real[i] * scale;
      }

      result.push(out);
    }
    return result;
  }

  _nextPow2(n) {
    let p = 1;
    while (p < n) p <<= 1;
    return p;
  }

  _fft(real, imag) {
    const n = real.length;
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
      if (i < j) {
        let tr = real[i]; real[i] = real[j]; real[j] = tr;
        let ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
      }
      let k = n >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }

    for (let l = 2; l <= n; l <<= 1) {
      const halfL = l >> 1;
      const angle = -2.0 * Math.PI / l;
      const wStepR = Math.cos(angle);
      const wStepI = Math.sin(angle);

      for (let i = 0; i < n; i += l) {
        let wr = 1.0;
        let wi = 0.0;
        for (let m = 0; m < halfL; m++) {
          const idxA = i + m;
          const idxB = idxA + halfL;
          const tr = wr * real[idxB] - wi * imag[idxB];
          const ti = wr * imag[idxB] + wi * real[idxB];

          real[idxB] = real[idxA] - tr;
          imag[idxB] = imag[idxA] - ti;
          real[idxA] += tr;
          imag[idxA] += ti;

          const nWr = wr * wStepR - wi * wStepI;
          wi = wr * wStepI + wi * wStepR;
          wr = nWr;
        }
      }
    }
  }

  _ifft(real, imag) {
    const n = real.length;
    for (let i = 0; i < n; i++) imag[i] = -imag[i];
    this._fft(real, imag);
    for (let i = 0; i < n; i++) {
      real[i] /= n;
      imag[i] = -imag[i] / n;
    }
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.updateBypassState();
  }

  updateBypassState() {
    const t = this.ctx.currentTime;
    if (this.enabled && this.processedAudioBuffer) {
      this.bypassNode.gain.setTargetAtTime(0, t, 0.02);
      this.wetGainNode.gain.setTargetAtTime(this.wetGain, t, 0.02);
      this.dryGainNode.gain.setTargetAtTime(this.dryGain, t, 0.02);
    } else {
      this.bypassNode.gain.setTargetAtTime(1, t, 0.02);
      this.wetGainNode.gain.setTargetAtTime(0, t, 0.02);
      this.dryGainNode.gain.setTargetAtTime(0, t, 0.02);
    }
  }
}
