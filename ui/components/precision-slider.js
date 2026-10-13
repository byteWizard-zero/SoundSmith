/**
 * Precision Slider Component with Dynamic Floating Tooltip Pill
 * Reverse-engineered from RootlessJamesDSP Android M3 sliders.
 */

export class PrecisionSlider {
  /**
   * @param {HTMLElement} wrapperElement - Container with .slider-track-wrapper
   * @param {Function} onChangeCallback - Called with formatted and raw values
   */
  constructor(wrapperElement, onChangeCallback) {
    this.wrapper = wrapperElement;
    this.input = this.wrapper.querySelector('input[type="range"]');
    this.tooltip = this.wrapper.querySelector('.floating-tooltip-pill');
    this.readout = this.wrapper.closest('.precision-slider-group')?.querySelector('.slider-readout');
    this.unit = this.input.dataset.unit || '';
    this.decimals = parseInt(this.input.dataset.decimals || '1', 10);
    this.onChange = onChangeCallback;

    this._bindEvents();
    this.updatePosition();
  }

  _bindEvents() {
    this.input.addEventListener('input', () => {
      this.updatePosition();
      const val = parseFloat(this.input.value);
      if (this.onChange) {
        this.onChange(val);
      }
    });

    const startDrag = () => this.wrapper.classList.add('is-dragging');
    const stopDrag = () => this.wrapper.classList.remove('is-dragging');

    this.input.addEventListener('pointerdown', startDrag);
    this.input.addEventListener('pointerup', stopDrag);
    this.input.addEventListener('pointercancel', stopDrag);
    this.input.addEventListener('touchstart', startDrag, { passive: true });
    this.input.addEventListener('touchend', stopDrag);
  }

  updatePosition() {
    const min = parseFloat(this.input.min) || 0;
    const max = parseFloat(this.input.max) || 100;
    const val = parseFloat(this.input.value);
    const percent = (val - min) / (max - min);

    // Format display string
    const sign = val > 0 && this.unit.includes('dB') ? '+' : '';
    const formatted = `${sign}${val.toFixed(this.decimals)}${this.unit}`;

    // Update floating tooltip
    if (this.tooltip) {
      this.tooltip.textContent = formatted;
      // Position tooltip directly above the thumb
      const thumbOffset = percent * (this.input.offsetWidth - 20) + 10;
      this.tooltip.style.left = `${thumbOffset}px`;
    }

    // Update static readout
    if (this.readout) {
      this.readout.textContent = formatted;
    }

    // Update dynamic track fill gradient
    const fillPercent = percent * 100;
    this.input.style.background = `linear-gradient(to right, var(--md-sys-color-primary) ${fillPercent}%, var(--md-sys-color-surface-container-highest) ${fillPercent}%)`;
  }

  setValue(val) {
    this.input.value = val;
    this.updatePosition();
  }
}
