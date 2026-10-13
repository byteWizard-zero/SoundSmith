/**
 * AutoEQ Headphone Database Browser for JamesDSP
 * Pre-calibrated Harman Target compensation curves for top audiophile headphones & IEMs.
 */

export const POPULAR_AUTOEQ_PROFILES = [
  {
    name: 'Sennheiser HD 600',
    type: 'Over-Ear Open',
    gains: [6.5, 4.0, 1.0, -0.5, 0.0, 0.5, -1.5, 2.0, -1.0, 1.5]
  },
  {
    name: 'Sennheiser HD 650',
    type: 'Over-Ear Open',
    gains: [6.0, 3.5, 0.5, -1.0, -0.5, 0.5, -1.0, 2.5, 0.0, 2.0]
  },
  {
    name: 'Sennheiser HD 560S',
    type: 'Over-Ear Open',
    gains: [4.5, 2.0, -0.5, -1.0, 0.0, 0.0, -2.0, 1.0, -1.5, 0.5]
  },
  {
    name: 'Sony WH-1000XM4',
    type: 'Over-Ear ANC',
    gains: [-4.0, -3.5, -2.0, 0.0, 1.5, 2.5, 3.0, -1.5, 1.0, 2.0]
  },
  {
    name: 'Sony WH-1000XM5',
    type: 'Over-Ear ANC',
    gains: [-3.0, -2.5, -1.5, 0.5, 1.0, 2.0, 2.5, -2.0, 1.5, 1.0]
  },
  {
    name: 'Apple AirPods Pro 2',
    type: 'TWS In-Ear',
    gains: [1.5, 0.5, -0.5, 0.0, 0.5, 1.0, -1.5, 2.0, 0.5, -1.0]
  },
  {
    name: 'Apple AirPods Max',
    type: 'Over-Ear ANC',
    gains: [2.0, 0.5, -1.0, -0.5, 0.0, 1.0, -2.0, 1.5, -1.0, 0.5]
  },
  {
    name: 'Beyerdynamic DT 770 Pro (80Ω)',
    type: 'Over-Ear Closed',
    gains: [-2.0, -1.0, 1.0, 1.5, 0.0, -1.5, 0.5, -4.5, -3.0, 1.5]
  },
  {
    name: 'Beyerdynamic DT 990 Pro (250Ω)',
    type: 'Over-Ear Open',
    gains: [2.5, 0.0, -1.0, 0.5, 1.0, -1.0, 1.5, -5.5, -4.0, 0.5]
  },
  {
    name: 'Audio-Technica ATH-M50x',
    type: 'Over-Ear Closed',
    gains: [-3.0, -1.5, 0.5, 1.0, -0.5, 1.5, -2.0, -3.0, 1.0, 0.5]
  },
  {
    name: 'Moondrop Aria',
    type: 'IEM',
    gains: [1.0, 0.5, 0.0, -0.5, 0.5, 1.0, -1.5, 1.0, -1.0, 2.0]
  },
  {
    name: 'Moondrop Chu / Chu II',
    type: 'IEM',
    gains: [2.5, 1.0, 0.0, -0.5, 0.0, 0.5, -2.0, 1.5, -0.5, 1.5]
  },
  {
    name: 'Moondrop Blessing 2',
    type: 'IEM',
    gains: [3.5, 2.0, 0.5, 0.0, -0.5, 0.5, -1.0, 0.5, 0.0, 1.0]
  },
  {
    name: 'Samsung Galaxy Buds 2 Pro',
    type: 'TWS In-Ear',
    gains: [0.5, 0.0, -0.5, 0.5, 1.0, 0.5, -1.0, 1.5, 0.5, 0.0]
  },
  {
    name: 'Hifiman Sundara',
    type: 'Planar Magnetic',
    gains: [5.0, 3.0, 1.0, 0.0, -0.5, 0.0, -1.5, 1.0, -1.0, 0.5]
  },
  {
    name: 'Hifiman Edition XS',
    type: 'Planar Magnetic',
    gains: [4.0, 2.5, 0.5, -0.5, 0.0, 0.5, -1.0, 0.5, -2.0, 1.0]
  },
  {
    name: 'Bose QuietComfort 35 II',
    type: 'Over-Ear ANC',
    gains: [1.0, 0.5, -1.5, 0.0, 1.5, 2.0, 0.5, -1.0, 1.5, 2.0]
  },
  {
    name: 'AKG K371',
    type: 'Over-Ear Closed',
    gains: [0.5, -0.5, -0.5, 0.0, 0.5, 0.0, -1.0, 0.5, 0.0, 0.5]
  }
];

export class AutoEqBrowser {
  constructor(containerElement, onSelectCallback) {
    this.container = containerElement;
    this.onSelect = onSelectCallback;
    this.profiles = POPULAR_AUTOEQ_PROFILES;
  }

  render(filterText = '') {
    const query = filterText.toLowerCase().trim();
    const filtered = this.profiles.filter(p => 
      p.name.toLowerCase().includes(query) || p.type.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      this.container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--md-sys-color-on-surface-variant);">
          No matching headphone profiles found.
        </div>
      `;
      return;
    }

    this.container.innerHTML = filtered.map((p, idx) => `
      <div class="autoeq-item" data-index="${idx}">
        <div>
          <div style="font-weight: 600; font-size: 13px;">${p.name}</div>
          <div style="font-size: 11px; color: var(--md-sys-color-outline);">${p.type} • Harman Compensation</div>
        </div>
        <button class="m3-action-btn" style="padding: 4px 10px; font-size: 11px;">Apply</button>
      </div>
    `).join('');

    // Attach click events
    this.container.querySelectorAll('.autoeq-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.index, 10);
        const selected = filtered[idx];
        if (selected && this.onSelect) {
          this.onSelect(selected);
        }
      });
    });
  }
}
