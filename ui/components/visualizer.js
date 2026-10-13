/**
 * Real-time Canvas Visualizer for JamesDSP
 * Renders dual-layer display: logarithmic EQ response curve + 60fps FFT spectrum analyzer.
 */

export class AudioVisualizer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.running = false;
    this.fftData = new Array(128).fill(0);
    this.eqGains = new Array(10).fill(0);
    this.frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

    // Handle high DPI displays
    this.resize();
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

  setEqGains(gains) {
    this.eqGains = [...gains];
  }

  updateFftData(fftArray) {
    if (fftArray && fftArray.length) {
      this.fftData = fftArray;
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

  draw() {
    const { ctx, width, height } = this;
    if (!width || !height) return;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    // Center 0 dB baseline
    const zeroY = height / 2;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(208, 188, 255, 0.15)';
    ctx.moveTo(0, zeroY);
    ctx.lineTo(width, zeroY);
    ctx.stroke();

    // 2. Draw FFT Spectrum (Smooth Gradient Fill)
    if (this.fftData && this.fftData.length > 0) {
      const barCount = Math.min(this.fftData.length, 64);
      const barWidth = width / barCount;
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, 'rgba(103, 80, 164, 0.1)');
      gradient.addColorStop(0.5, 'rgba(208, 188, 255, 0.35)');
      gradient.addColorStop(1, 'rgba(239, 184, 200, 0.6)');

      ctx.fillStyle = gradient;

      for (let i = 0; i < barCount; i++) {
        const val = this.fftData[i] / 255; // 0 to 1
        const barHeight = val * (height * 0.85);
        const x = i * barWidth;
        const y = height - barHeight;

        // Rounded bar top
        ctx.beginPath();
        ctx.roundRect(x + 1, y, Math.max(1, barWidth - 2), barHeight, [2, 2, 0, 0]);
        ctx.fill();
      }
    }

    // 3. Draw EQ Spline Curve
    if (this.eqGains && this.eqGains.length > 0) {
      ctx.beginPath();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#D0BCFF';
      ctx.shadowColor = '#D0BCFF';
      ctx.shadowBlur = 8;

      const points = [];
      const numBands = this.eqGains.length;

      for (let i = 0; i < numBands; i++) {
        const x = (i / (numBands - 1)) * (width - 24) + 12;
        // Gain range is -15dB to +15dB, zero at center
        const gain = this.eqGains[i];
        const y = zeroY - (gain / 15) * (height * 0.42);
        points.push({ x, y });
      }

      // Smooth cubic curve through points
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.stroke();
      ctx.shadowBlur = 0; // reset shadow

      // Draw points for each band
      points.forEach(pt => {
        ctx.fillStyle = '#EADDFF';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
}
