/**
 * Master Dock Component for SoundSmith
 * Controls floating elevated power FAB, theme dialog, and overflow context menu.
 */

export class MasterDock {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.dockElement
   * @param {Function} options.onPowerToggle
   * @param {Function} options.onSettingsClick
   * @param {Function} options.onResetDefaults
   * @param {Function} options.onPresetsClick
   */
  constructor(options) {
    this.dock = options.dockElement;
    this.powerFab = this.dock.querySelector('#masterPowerFab');
    this.settingsBtn = this.dock.querySelector('#dockSettingsBtn');
    this.moreBtn = this.dock.querySelector('#dockMoreBtn');
    this.overflowMenu = this.dock.querySelector('#dockOverflowMenu');

    this.onPowerToggle = options.onPowerToggle;
    this.onSettingsClick = options.onSettingsClick;
    this.onResetDefaults = options.onResetDefaults;
    this.onPresetsClick = options.onPresetsClick;

    this._bindEvents();
  }

  _bindEvents() {
    this.powerFab.addEventListener('click', () => {
      if (this.onPowerToggle) {
        this.onPowerToggle();
      }
    });

    this.settingsBtn.addEventListener('click', () => {
      if (this.onSettingsClick) {
        this.onSettingsClick();
      }
    });

    this.moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.overflowMenu.classList.toggle('open');
    });

    // Close menu when clicking outside
    document.addEventListener('click', () => {
      this.overflowMenu.classList.remove('open');
    });

    // Menu Item Actions
    const presetItem = this.overflowMenu.querySelector('[data-action="presets"]');
    if (presetItem) {
      presetItem.addEventListener('click', () => {
        this.overflowMenu.classList.remove('open');
        if (this.onPresetsClick) this.onPresetsClick();
      });
    }

    const resetItem = this.overflowMenu.querySelector('[data-action="reset"]');
    if (resetItem) {
      resetItem.addEventListener('click', () => {
        this.overflowMenu.classList.remove('open');
        if (this.onResetDefaults) this.onResetDefaults();
      });
    }
  }

  setPowerState(isOn) {
    if (isOn) {
      this.powerFab.classList.add('is-on');
    } else {
      this.powerFab.classList.remove('is-on');
    }
  }
}
