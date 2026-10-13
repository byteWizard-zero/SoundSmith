/**
 * SoundSmith ViPER-DDC Engine
 * Direct Form II Second-Order Section (SOS) Cascaded Matrix
 * 
 * Ported faithfully from RootlessJamesDSP vdc.c
 * Parses .vdc files with SR_44100 and SR_48000 coefficient sections
 * and constructs real-time Web Audio IIRFilterNode cascades.
 */

export class ViperDdc {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.enabled = false;
    this.currentProfileName = '';
    this.rawVdcContent = '';
    
    // Parsed SOS sections: array of { b0, b1, b2, a1, a2 }
    this.sections441 = [];
    this.sections480 = [];
    this.activeFilterNodes = [];

    // Master node graph
    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();
    this.bypassNode = this.ctx.createGain();
    this.effectChainInput = this.ctx.createGain();
    this.effectChainOutput = this.ctx.createGain();

    this._buildGraph();
    this.updateBypassState();
  }

  _buildGraph() {
    // Bypass route
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);

    // Effect route
    this.inputNode.connect(this.effectChainInput);
    this.effectChainOutput.connect(this.outputNode);
  }

  /**
   * Parse a .vdc text string into Direct Form 2 SOS coefficient matrices
   */
  parseVdcString(vdcText, profileName = 'Custom') {
    if (!vdcText || typeof vdcText !== 'string') return false;

    try {
      this.rawVdcContent = vdcText;
      this.currentProfileName = profileName;

      this.sections441 = this._extractSosSections(vdcText, 'SR_44100');
      this.sections480 = this._extractSosSections(vdcText, 'SR_48000');

      if (this.sections441.length === 0 && this.sections480.length === 0) {
        console.warn('ViperDdc: No valid SR_44100 or SR_48000 SOS sections found in VDC');
        return false;
      }

      this._rebuildFilterCascade();
      return true;
    } catch (err) {
      console.error('ViperDdc: Error parsing VDC file:', err);
      return false;
    }
  }

  _extractSosSections(text, tag) {
    const idx = text.indexOf(tag);
    if (idx === -1) return [];

    const colonIdx = text.indexOf(':', idx);
    if (colonIdx === -1) return [];

    // Extract numbers until end of line or next tag
    const endLineIdx = text.indexOf('\n', colonIdx);
    const line = endLineIdx !== -1 ? text.substring(colonIdx + 1, endLineIdx) : text.substring(colonIdx + 1);

    const values = line.split(',')
      .map(s => parseFloat(s.trim()))
      .filter(n => !isNaN(n));

    const sosCount = Math.floor(values.length / 5);
    const sections = [];

    for (let i = 0; i < sosCount; i++) {
      const base = i * 5;
      const b0 = values[base];
      const b1 = values[base + 1];
      const b2 = values[base + 2];
      // In JamesDSP vdc.c: a1 = -val, a2 = -val
      const a1 = -values[base + 3];
      const a2 = -values[base + 4];

      // Ignore dummy trailing null SOS (e.g. 9.99e-13, 0, 0, 0, 0)
      if (Math.abs(b0) < 1e-9 && Math.abs(b1) < 1e-9 && Math.abs(b2) < 1e-9) {
        continue;
      }

      sections.push({ b0, b1, b2, a1, a2 });
    }

    return sections;
  }

  /**
   * Rebuild the Web Audio IIRFilterNode cascade
   */
  _rebuildFilterCascade() {
    // Tear down existing cascade
    this._disconnectActiveFilters();

    // Pick appropriate sections based on AudioContext sample rate
    const targetSections = (this.ctx.sampleRate <= 46000 && this.sections441.length > 0)
      ? this.sections441
      : (this.sections480.length > 0 ? this.sections480 : this.sections441);

    if (targetSections.length === 0) {
      this.effectChainInput.connect(this.effectChainOutput);
      return;
    }

    this.activeFilterNodes = [];

    // Create IIRFilterNode for each SOS
    for (let i = 0; i < targetSections.length; i++) {
      const { b0, b1, b2, a1, a2 } = targetSections[i];
      const feedforward = [b0, b1, b2];
      const feedback = [1.0, a1, a2];

      try {
        const iirNode = this.ctx.createIIRFilter(feedforward, feedback);
        this.activeFilterNodes.push(iirNode);
      } catch (err) {
        // Fallback for edge cases with non-causal or unstable poles
        console.warn(`ViperDdc: IIRFilter creation fallback for section ${i}:`, err);
      }
    }

    if (this.activeFilterNodes.length === 0) {
      this.effectChainInput.connect(this.effectChainOutput);
      return;
    }

    // Connect in series: input -> SOS[0] -> SOS[1] -> ... -> SOS[N-1] -> output
    this.effectChainInput.connect(this.activeFilterNodes[0]);
    for (let i = 0; i < this.activeFilterNodes.length - 1; i++) {
      this.activeFilterNodes[i].connect(this.activeFilterNodes[i + 1]);
    }
    this.activeFilterNodes[this.activeFilterNodes.length - 1].connect(this.effectChainOutput);
  }

  _disconnectActiveFilters() {
    try {
      this.effectChainInput.disconnect();
    } catch (_) {}

    this.activeFilterNodes.forEach(node => {
      try {
        node.disconnect();
      } catch (_) {}
    });
    this.activeFilterNodes = [];
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.updateBypassState();
  }

  updateBypassState() {
    const t = this.ctx.currentTime;
    if (this.enabled && this.activeFilterNodes.length > 0) {
      this.bypassNode.gain.setTargetAtTime(0, t, 0.02);
      this.effectChainOutput.gain.setTargetAtTime(1, t, 0.02);
    } else {
      this.bypassNode.gain.setTargetAtTime(1, t, 0.02);
      this.effectChainOutput.gain.setTargetAtTime(0, t, 0.02);
    }
  }
}
