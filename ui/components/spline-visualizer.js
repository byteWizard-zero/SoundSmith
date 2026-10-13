/**
 * Interactive Akima Spline & PCHIP Equalizer Visualizer
 * Reverse-engineered from RootlessJamesDSP Android GraphicEqualizerSurface.
 */

import { AkimaSpline, PchipSpline } from '../../offscreen/dsp/math/akima-spline.js';

export const ISO_FREQUENCIES_15 = [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000];

export const ROOTLESS_JAMESDSP_PRESETS = {
  'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Acoustic': [4.5, 4.0, 3.0, 1.5, 0.5, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 3.5, 3.0, 2.0],
  'Bass': [7.0, 6.5, 6.0, 5.0, 3.5, 2.0, 0.5, 0.0, 0.0, 0.0, 0.5, 1.0, 1.5, 2.0, 2.5],
  'Beats': [6.0, 5.5, 4.0, 2.0, -1.0, -2.0, -1.0, 1.0, 2.5, 3.5, 4.0, 4.5, 5.0, 5.0, 4.5],
  'Classic': [5.0, 4.0, 3.0, 2.5, -1.5, -1.5, 0.0, 2.0, 3.0, 3.5, 3.5, 3.0, 2.5, 2.0, 1.5],
  'Clear': [2.0, 1.5, 0.5, 0.0, 0.5, 1.0, 2.0, 3.0, 4.0, 4.5, 5.0, 5.5, 6.0, 6.0, 5.5],
  'Deep': [8.0, 7.0, 5.5, 3.0, 1.0, 0.0, -1.0, -1.5, -1.0, 0.0, 1.0, 2.0, 2.5, 3.0, 3.0],
  'Dubstep': [7.5, 7.0, 5.0, 2.0, -1.5, -2.0, 0.5, 2.0, 3.5, 4.5, 5.0, 5.5, 6.0, 6.0, 5.5],
  'Electronic': [6.5, 5.5, 3.0, 0.5, -1.5, -1.5, 0.0, 2.0, 3.5, 4.5, 5.0, 5.5, 6.0, 6.5, 6.0],
  'Hardstyle': [8.5, 7.5, 4.5, 1.0, -2.0, -1.5, 0.5, 3.0, 4.5, 5.5, 6.0, 6.5, 7.0, 7.0, 6.5],
  'Hip-Hop': [6.5, 6.0, 5.0, 3.0, 1.0, -1.0, -1.0, 1.0, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 4.0],
  'Jazz': [4.0, 3.0, 1.5, 2.0, -1.5, -1.5, 0.0, 1.5, 2.5, 3.0, 3.5, 4.0, 3.5, 2.5, 1.5],
  'Metal': [6.5, 5.0, 2.0, -1.0, -3.0, -2.0, 1.0, 3.5, 5.0, 6.0, 6.5, 7.0, 7.0, 6.5, 6.0],
  'Movie': [5.0, 4.0, 2.0, 0.0, -1.0, 0.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.0],
  'Pop': [-1.5, -1.0, 0.5, 2.0, 3.5, 4.0, 3.5, 2.0, 0.5, -0.5, -1.0, -1.5, -1.0, 0.0, 1.0],
  'R&B': [5.5, 5.0, 4.0, 2.0, -1.0, -2.0, 1.0, 2.5, 3.0, 3.5, 4.0, 4.5, 4.5, 4.0, 3.5],
  'Rock': [6.0, 4.5, 2.5, -1.0, -2.5, -1.5, 1.0, 3.0, 4.5, 5.0, 5.5, 6.0, 6.0, 5.5, 5.0],
  'Vocal Booster': [-2.0, -2.0, -1.5, 0.0, 1.5, 3.5, 5.0, 5.5, 5.0, 3.5, 2.0, 1.0, 0.0, -1.0, -2.0]
};

export class SplineVisualizer {
  /**
   * @param {HTMLCanvasElement} canvasElement
   * @param {HTMLElement} readoutStripElement
   * @param {Function} onGainsChangeCallback
   */
  constructor(canvasElement, readoutStripElement, onGainsChangeCallback) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.readoutStrip = readoutStripElement;
    this.onGainsChange = onGainsChangeCallback;

    this.interpolatorType = 'akima'; // 'akima' or 'pchip'
    this.frequencies = ISO_FREQUENCIES_15;
    this.gains = new Float32Array(15).fill(0);
    this.fftData = new Uint8Array(128).fill(0);

    this.minFreq = 20;
    this.maxFreq = 20000;
    this.minDb = -15;
    this.maxDb = 15;

    this.draggedNodeIndex = -1;
    this.running = false;

    this.resize();
    this._bindTouchEvents();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  setGains(gainsArray) {
    for (let i = 0; i < Math.min(gainsArray.length, 15); i++) {
      this.gains[i] = Math.max(-15, Math.min(15, gainsArray[i]));
    }
    this.updateReadoutStrip();
  }

  setFftData(data) {
    if (data && data.length) {
      this.fftData = data;
    }
  }

  setInterpolator(type) {
    if (type === 'akima' || type === 'pchip') {
      this.interpolatorType = type;
    }
  }

  start() {
    if (!this.running) {
      this.running = true;
      this._renderLoop();
    }
  }

  stop() {
    this.running = false;
  }

  _renderLoop() {
    if (!this.running) return;
    this.draw();
    requestAnimationFrame(() => this._renderLoop());
  }

  freqToX(freq) {
    const logMin = Math.log10(this.minFreq);
    const logMax = Math.log10(this.maxFreq);
    const logFreq = Math.log10(freq);
    return ((logFreq - logMin) / (logMax - logMin)) * (this.width - 24) + 12;
  }

  dbToY(db) {
    const norm = (db - this.minDb) / (this.maxDb - this.minDb);
    return this.height - norm * (this.height - 24) - 12;
  }

  yToDb(y) {
    const norm = 1.0 - (y - 12) / (this.height - 24);
    return Math.max(-15, Math.min(15, norm * (this.maxDb - this.minDb) + this.minDb));
  }

  _bindTouchEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const handlePointerDown = (e) => {
      const pos = getPos(e);
      // Find nearest node
      let closestIdx = -1;
      let minDistance = 24; // 24px hit radius

      for (let i = 0; i < this.frequencies.length; i++) {
        const nx = this.freqToX(this.frequencies[i]);
        const ny = this.dbToY(this.gains[i]);
        const dist = Math.hypot(pos.x - nx, pos.y - ny);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      }

      if (closestIdx !== -1) {
        this.draggedNodeIndex = closestIdx;
        e.preventDefault();
      }
    };

    const handlePointerMove = (e) => {
      if (this.draggedNodeIndex !== -1) {
        const pos = getPos(e);
        const newDb = parseFloat(this.yToDb(pos.y).toFixed(1));
        this.gains[this.draggedNodeIndex] = newDb;
        this.updateReadoutStrip();
        if (this.onGainsChange) {
          this.onGainsChange(Array.from(this.gains));
        }
        e.preventDefault();
      }
    };

    const handlePointerUp = () => {
      this.draggedNodeIndex = -1;
    };

    this.canvas.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    this.canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
  }

  updateReadoutStrip() {
    if (!this.readoutStrip) return;
    this.readoutStrip.innerHTML = Array.from(this.gains).map((g, idx) => {
      const isDragging = idx === this.draggedNodeIndex;
      const color = isDragging ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-text-secondary)';
      const sign = g > 0 ? '+' : '';
      return `<span style="font-size: 10px; font-weight: ${isDragging ? 700 : 500}; color: ${color};">${sign}${g.toFixed(1)}</span>`;
    }).join('');
  }

  draw() {
    const { ctx, width, height } = this;
    if (!width || !height) return;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw Horizontal dB Grid Lines
    const dBLines = [-12, -6, 0, 6, 12];
    ctx.lineWidth = 1;
    dBLines.forEach(db => {
      const y = this.dbToY(db);
      ctx.beginPath();
      ctx.strokeStyle = db === 0 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)';
      ctx.moveTo(12, y);
      ctx.lineTo(width - 12, y);
      ctx.stroke();
    });

    // 2. Draw 15 Vertical Frequency Grid Lines
    this.frequencies.forEach((freq, idx) => {
      const x = this.freqToX(freq);
      ctx.beginPath();
      ctx.strokeStyle = idx === this.draggedNodeIndex ? 'rgba(82, 220, 116, 0.3)' : 'rgba(255, 255, 255, 0.04)';
      ctx.moveTo(x, 12);
      ctx.lineTo(x, height - 12);
      ctx.stroke();
    });

    // 3. Draw Real-time FFT Spectrum Analyzer (Underneath curve)
    if (this.fftData && this.fftData.length > 0) {
      const numBins = Math.min(this.fftData.length, 64);
      const binWidth = (width - 24) / numBins;
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, 'rgba(18, 112, 44, 0.05)');
      gradient.addColorStop(0.6, 'rgba(82, 220, 116, 0.25)');
      gradient.addColorStop(1, 'rgba(131, 252, 163, 0.45)');

      ctx.fillStyle = gradient;
      for (let i = 0; i < numBins; i++) {
        const val = this.fftData[i] / 255;
        const barHeight = val * (height * 0.75);
        const x = 12 + i * binWidth;
        const y = height - 12 - barHeight;
        ctx.fillRect(x + 1, y, Math.max(1, binWidth - 2), barHeight);
      }
    }

    // 4. Calculate 256-Point Smooth Akima / PCHIP Spline
    const numEvalPoints = 256;
    const logXs = this.frequencies.map(f => Math.log10(f));
    const queryLogXs = new Float64Array(numEvalPoints);
    const logMin = Math.log10(this.minFreq);
    const logMax = Math.log10(this.maxFreq);

    for (let i = 0; i < numEvalPoints; i++) {
      queryLogXs[i] = logMin + (i / (numEvalPoints - 1)) * (logMax - logMin);
    }

    const interpFunction = this.interpolatorType === 'pchip' ? PchipSpline.interpolate : AkimaSpline.interpolate;
    const interpDbs = interpFunction(logXs, Array.from(this.gains), Array.from(queryLogXs));

    // 5. Draw Glowing Spline Area Fill
    ctx.beginPath();
    ctx.moveTo(12, this.dbToY(interpDbs[0]));
    for (let i = 1; i < numEvalPoints; i++) {
      const x = 12 + (i / (numEvalPoints - 1)) * (width - 24);
      const y = this.dbToY(interpDbs[i]);
      ctx.lineTo(x, y);
    }
    const zeroY = this.dbToY(0);
    ctx.lineTo(width - 12, zeroY);
    ctx.lineTo(12, zeroY);
    ctx.closePath();

    const fillGrad = ctx.createLinearGradient(0, 0, 0, height);
    fillGrad.addColorStop(0, 'rgba(82, 220, 116, 0.28)');
    fillGrad.addColorStop(1, 'rgba(82, 220, 116, 0.02)');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // 6. Draw Glowing Spline Curve Stroke
    ctx.beginPath();
    ctx.moveTo(12, this.dbToY(interpDbs[0]));
    for (let i = 1; i < numEvalPoints; i++) {
      const x = 12 + (i / (numEvalPoints - 1)) * (width - 24);
      const y = this.dbToY(interpDbs[i]);
      ctx.lineTo(x, y);
    }
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#52dc74';
    ctx.shadowColor = 'rgba(82, 220, 116, 0.8)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0; // reset glow

    // 7. Draw 15 Draggable Circular Nodes
    this.frequencies.forEach((freq, idx) => {
      const x = this.freqToX(freq);
      const y = this.dbToY(this.gains[idx]);
      const isDragging = idx === this.draggedNodeIndex;

      // Outer halo when dragging
      if (isDragging) {
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(82, 220, 116, 0.3)';
        ctx.fill();
      }

      // Circular node
      ctx.beginPath();
      ctx.arc(x, y, isDragging ? 5.5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isDragging ? '#ffffff' : '#52dc74';
      ctx.strokeStyle = '#141c16';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    });
  }
}
