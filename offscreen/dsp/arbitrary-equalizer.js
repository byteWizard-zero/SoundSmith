/**
 * Arbitrary Response Equalizer (PEQ + GEQ) for SoundSmith
 * Implements RootlessJamesDSP PARAM_ARBITRARY_RESPONSE_EQUALIZER (Key 150).
 * Merges EqualizerAPO Parametric filters + GraphicEQ arbitrary nodes into 512-point response.
 */

import { BiquadMath } from './math/biquad-math.js';

export class ArbitraryEqualizer {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.enabled = false;
    this.preampDb = 0.0;
    this.peqFilters = []; // Array of { type: 'PK'|'LSC'|'HSC', fc, gain, Q, enabled }
    this.geqNodes = [];   // Array of { freq, gain }

    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();
    this.bypassNode = this.ctx.createGain();
    this.effectNode = this.ctx.createGain();

    this.preampNode = this.ctx.createGain();
    this.biquadNodes = [];

    // Wiring
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);

    this.inputNode.connect(this.effectNode);
    this.effectNode.connect(this.preampNode);
    this.preampNode.connect(this.outputNode);

    this.updateBypassState();
  }

  /**
   * Parses EqualizerAPO Parametric EQ text syntax
   */
  loadFromEqualizerApoText(text) {
    this.peqFilters = [];
    const lines = text.split('\n');

    lines.forEach(line => {
      const clean = line.trim();
      if (!clean || clean.startsWith('#')) return;

      if (clean.toLowerCase().startsWith('preamp:')) {
        const match = clean.match(/Preamp:\s*([+-]?\d+(?:\.\d+)?)\s*dB/i);
        if (match) {
          this.setPreamp(parseFloat(match[1]));
        }
      } else if (clean.toLowerCase().startsWith('filter')) {
        // e.g. "Filter 1: ON PK Fc 105 Hz Gain -4.2 dB Q 1.41"
        const isEnabled = !clean.includes('OFF');
        const typeMatch = clean.match(/\b(PK|LSC|HSC|LP|HP)\b/i);
        const fcMatch = clean.match(/Fc\s+([0-9.]+)\s*Hz/i);
        const gainMatch = clean.match(/Gain\s+([+-]?[0-9.]+)\s*dB/i);
        const qMatch = clean.match(/Q\s+([0-9.]+)/i);

        if (typeMatch && fcMatch) {
          this.peqFilters.push({
            type: typeMatch[1].toUpperCase(),
            fc: parseFloat(fcMatch[1]),
            gain: gainMatch ? parseFloat(gainMatch[1]) : 0.0,
            Q: qMatch ? parseFloat(qMatch[1]) : 1.414,
            enabled: isEnabled
          });
        }
      }
    });

    this._rebuildBiquadChain();
  }

  /**
   * Parses GraphicEQ node list: "GraphicEQ: 20 0; 50 3.5; 100 -2.0; ..."
   */
  loadFromGraphicEqString(text) {
    this.geqNodes = [];
    const clean = text.replace(/^GraphicEQ:\s*/i, '');
    const tokens = clean.split(';').map(t => t.trim()).filter(Boolean);

    tokens.forEach(tok => {
      const parts = tok.split(/\s+/);
      if (parts.length >= 2) {
        const freq = parseFloat(parts[0]);
        const gain = parseFloat(parts[1]);
        if (!isNaN(freq) && !isNaN(gain)) {
          this.geqNodes.push({ freq, gain });
        }
      }
    });

    // Sort by frequency
    this.geqNodes.sort((a, b) => a.freq - b.freq);
  }

  setPreamp(gainDb) {
    this.preampDb = Math.max(-30, Math.min(0, gainDb));
    this.preampNode.gain.value = Math.pow(10, this.preampDb / 20);
  }

  _rebuildBiquadChain() {
    this.biquadNodes.forEach(n => n.disconnect());
    this.biquadNodes = [];

    let prev = this.preampNode;
    this.peqFilters.forEach(f => {
      if (!f.enabled) return;
      const biquad = this.ctx.createBiquadFilter();
      if (f.type === 'PK') biquad.type = 'peaking';
      else if (f.type === 'LSC') biquad.type = 'lowshelf';
      else if (f.type === 'HSC') biquad.type = 'highshelf';
      else biquad.type = 'peaking';

      biquad.frequency.value = f.fc;
      biquad.gain.value = f.gain;
      biquad.Q.value = f.Q;

      prev.connect(biquad);
      prev = biquad;
      this.biquadNodes.push(biquad);
    });

    prev.connect(this.outputNode);
  }

  /**
   * Generates RootlessJamesDSP 512-point magnitude response string
   */
  generate512PointMagnitudeString() {
    const numPoints = 512;
    const minFreq = 20;
    const maxFreq = 20000;
    const srate = this.ctx.sampleRate || 48000;
    const responseArray = new Float32Array(numPoints);

    // Evaluate PEQ biquads
    const peqCoeffs = this.peqFilters
      .filter(f => f.enabled)
      .map(f => BiquadMath.computeCoefficients(f.type, f.fc, f.gain, f.Q, srate));

    for (let i = 0; i < numPoints; i++) {
      const logFreq = Math.log10(minFreq) + (i / (numPoints - 1)) * (Math.log10(maxFreq) - Math.log10(minFreq));
      const freq = Math.pow(10, logFreq);

      let totalDb = this.preampDb;
      peqCoeffs.forEach(coeffs => {
        totalDb += BiquadMath.evaluateMagnitudeDb(coeffs, freq, srate);
      });

      // Linear interpolation of GEQ nodes
      if (this.geqNodes.length > 0) {
        if (freq <= this.geqNodes[0].freq) {
          totalDb += this.geqNodes[0].gain;
        } else if (freq >= this.geqNodes[this.geqNodes.length - 1].freq) {
          totalDb += this.geqNodes[this.geqNodes.length - 1].gain;
        } else {
          for (let k = 0; k < this.geqNodes.length - 1; k++) {
            if (freq >= this.geqNodes[k].freq && freq <= this.geqNodes[k + 1].freq) {
              const span = this.geqNodes[k + 1].freq - this.geqNodes[k].freq;
              const frac = (freq - this.geqNodes[k].freq) / span;
              totalDb += this.geqNodes[k].gain + frac * (this.geqNodes[k + 1].gain - this.geqNodes[k].gain);
              break;
            }
          }
        }
      }

      responseArray[i] = totalDb;
    }

    return Array.from(responseArray).map(v => v.toFixed(2)).join(';');
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.updateBypassState();
  }

  updateBypassState() {
    this.bypassNode.gain.value = this.enabled ? 0.0 : 1.0;
    this.effectNode.gain.value = this.enabled ? 1.0 : 0.0;
  }
}
