/**
 * Precision Slider Component with Dynamic Floating Tooltip Pill
 * Reverse-engineered from RootlessJamesDSP Android M3 sliders.
 */

export class PrecisionSlider {
  /**
   * @param {HTMLElement} wrapperElement - Container with .slider-track-wrapper or .slider-row
   * @param {Function} onChangeCallback - Called with formatted and raw values
   */
  constructor(wrapperElement, onChangeCallback) {
    this.wrapper = wrapperElement;
    this.input = this.wrapper.querySelector('input[type="range"]') || (this.wrapper.tagName === 'INPUT' ? this.wrapper : null);
    if (!this.input) return;

    this.tooltip = this.wrapper.querySelector('.floating-tooltip-pill');
    this.readout = this.wrapper.closest('.precision-slider-group')?.querySelector('.slider-readout') || 
                   this.wrapper.querySelector('.value-badge') ||
                   this.wrapper.parentElement?.querySelector('.value-badge');
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
    if (!this.input) return;
    const min = parseFloat(this.input.min) || 0;
    const max = parseFloat(this.input.max) || 100;
    const val = parseFloat(this.input.value);
    const range = max - min || 1;
    const percent = Math.max(0, Math.min(1, (val - min) / range));

    // Format display string
    const sign = val > 0 && this.unit.includes('dB') ? '+' : '';
    const formatted = `${sign}${val.toFixed(this.decimals)}${this.unit}`;

    // Update floating tooltip
    if (this.tooltip) {
      this.tooltip.textContent = formatted;
      const width = this.input.offsetWidth || 200;
      const thumbOffset = percent * (width - 20) + 10;
      this.tooltip.style.left = `${thumbOffset}px`;
    }

    // Update static readout if present
    if (this.readout) {
      this.readout.textContent = formatted;
    }

    // Update dynamic track fill gradient
    const fillPercent = percent * 100;
    this.input.style.background = `linear-gradient(to right, var(--md-sys-color-primary) ${fillPercent}%, var(--md-sys-color-surface-container-highest) ${fillPercent}%)`;
  }

  setValue(val) {
    if (!this.input) return;
    this.input.value = val;
    this.updatePosition();
  }
}

/**
 * Convenience helper to attach precision slider behavior to a range input
 */
export function attachPrecisionSlider(inputElement, options = {}) {
  if (!inputElement) return null;
  const parent = inputElement.parentElement;
  if (!parent) return null;

  if (options.unit) inputElement.dataset.unit = options.unit;
  if (options.decimals !== undefined) inputElement.dataset.decimals = options.decimals;

  return new PrecisionSlider(parent, options.onChange);
}
