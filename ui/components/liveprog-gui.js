/**
 * SoundSmith LiveProg Dynamic GUI Generator
 * Parses @param slider definitions from active EEL script and dynamically
 * generates native M3 precision sliders with floating tooltips.
 */

export class LiveprogGui {
  constructor(containerElement, onSliderChange) {
    this.container = containerElement;
    this.onSliderChange = onSliderChange; // callback(sliderId, value)
  }

  /**
   * Render sliders for the given slider definition list:
   * [{ id, default, min, max, step, label, value }]
   */
  render(sliders = []) {
    this.container.innerHTML = '';

    if (!sliders || sliders.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'liveprog-empty-state';
      emptyState.style.padding = '12px 16px';
      emptyState.style.color = 'var(--md-sys-color-on-surface-variant)';
      emptyState.style.fontSize = '13px';
      emptyState.style.fontStyle = 'italic';
      emptyState.textContent = 'No dynamic @param parameters found in this script.';
      this.container.appendChild(emptyState);
      return;
    }

    const sliderGroup = document.createElement('div');
    sliderGroup.className = 'liveprog-slider-group';
    sliderGroup.style.display = 'flex';
    sliderGroup.style.flexDirection = 'column';
    sliderGroup.style.gap = '16px';
    sliderGroup.style.marginTop = '8px';

    sliders.forEach(slider => {
      const row = document.createElement('div');
      row.className = 'liveprog-slider-row';

      // Header: Label and current value
      const header = document.createElement('div');
      header.className = 'slider-header';
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.marginBottom = '6px';

      const label = document.createElement('span');
      label.className = 'slider-title';
      label.style.fontSize = '13px';
      label.style.fontWeight = '500';
      label.style.color = 'var(--md-sys-color-on-surface)';
      label.textContent = slider.label || slider.id;

      const valueBadge = document.createElement('span');
      valueBadge.className = 'slider-value-pill';
      valueBadge.style.fontSize = '12px';
      valueBadge.style.fontWeight = '600';
      valueBadge.style.color = 'var(--md-sys-color-primary)';
      valueBadge.style.backgroundColor = 'var(--md-sys-color-surface-container-highest)';
      valueBadge.style.padding = '2px 8px';
      valueBadge.style.borderRadius = '8px';
      valueBadge.textContent = slider.value !== undefined ? slider.value : slider.default;

      header.appendChild(label);
      header.appendChild(valueBadge);

      // M3 Range Input
      const input = document.createElement('input');
      input.type = 'range';
      input.className = 'm3-slider';
      input.min = slider.min;
      input.max = slider.max;
      input.step = slider.step || 1;
      input.value = slider.value !== undefined ? slider.value : slider.default;
      input.style.width = '100%';
      input.style.accentColor = 'var(--md-sys-color-primary)';

      input.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        valueBadge.textContent = val;
        if (this.onSliderChange) {
          this.onSliderChange(slider.id, val);
        }
      });

      row.appendChild(header);
      row.appendChild(input);
      sliderGroup.appendChild(row);
    });

    this.container.appendChild(sliderGroup);
  }
}
