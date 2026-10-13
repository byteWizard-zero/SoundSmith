/**
 * SoundSmith Master User Interface Controller
 * Faithful implementation of RootlessJamesDSP Material You (M3) UX
 * Based on frame-by-frame audit of RootlessJamesDSP v1.6.13
 */

import { SplineVisualizer, ISO_FREQUENCIES_15, SPLINE_PRESETS } from './components/spline-visualizer.js';
import { attachPrecisionSlider } from './components/precision-slider.js';
import { AutoEqClient } from './components/autoeq-cloud-client.js';
import { LiveprogGui } from './components/liveprog-gui.js';
import { LiveprogIde } from './components/liveprog-ide.js';

class SoundSmithApp {
  constructor() {
    this.currentProfile = 'headset';
    this.currentTheme = 'green-apple';
    this.isAmoled = false;
    this.masterPower = true;
    this.activeTabId = null;
    this.autoEqClient = new AutoEqClient();

    // Module states
    this.state = {
      masterPower: true,
      preampGain: 0,
      limiterThreshold: -0.1,
      limiterEnabled: true,
      eqEnabled: true,
      eqFilterType: 0,
      eqInterpolation: 1,
      eqGains: new Array(15).fill(0),
      dynamicBassEnabled: false,
      dynamicBassGain: 5,
      dynamicBassFreq: 80,
      dynamicBassMode: 0,
      companderEnabled: false,
      compThreshold: -18,
      compRatio: 2.5,
      compAttack: 20,
      compRelease: 120,
      tubeEnabled: false,
      tubeDrive: 15,
      ddcEnabled: false,
      ddcProfile: 'Butterworth.vdc',
      convolverEnabled: false,
      convolverIr: 'Church.wav',
      convolverMode: 0,
      convolverAdvImp: '-80;-100;0;0;0;0',
      crossfeedEnabled: false,
      crossfeedMode: 0,
      reverbEnabled: false,
      reverbPreset: 0,
      liveprogEnabled: false,
      liveprogScript: 'viper_dynamicbass.eel',
      stereoWidenEnabled: false,
      stereoWidth: 100
    };

    this.init();
  }

  async init() {
    this._initVisualizer();
    this._initFilterChips();
    this._initAccordionCards();
    this._initSliders();
    this._initModals();
    this._initLiveProg();
    this._initAutoEq();
    this._initMasterDock();
    this._initTabConnection();

    // Load persisted state
    await this._loadState();
  }

  // --- Visualizer & Presets ---
  _initVisualizer() {
    const canvas = document.getElementById('splineCanvas');
    if (canvas) {
      this.visualizer = new SplineVisualizer(canvas, (index, gain) => {
        this.state.eqGains[index] = gain;
        this._updateEqSliderUi(index, gain);
        this._sendDspParam('equalizer', 'band', { index, gain });
        this._saveStateDebounced();
      });

      // Build 18-preset ribbon carousel
      const ribbonContainer = document.getElementById('presetRibbonContainer');
      if (ribbonContainer) {
        ribbonContainer.innerHTML = '';
        Object.entries(SPLINE_PRESETS).forEach(([name, gains]) => {
          const chip = document.createElement('button');
          chip.className = 'preset-chip' + (name === 'Flat' ? ' active' : '');
          chip.textContent = name;
          chip.addEventListener('click', () => {
            ribbonContainer.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            this.visualizer.setGains(gains);
            this.state.eqGains = [...gains];
            this.state.eqGains.forEach((g, i) => this._updateEqSliderUi(i, g));
            this._sendDspParam('equalizer', 'allBands', gains);
            this._saveStateDebounced();
          });
          ribbonContainer.appendChild(chip);
        });
      }

      // Reset EQ curve
      document.getElementById('btnResetEqCurve')?.addEventListener('click', () => {
        const flat = new Array(15).fill(0);
        this.visualizer.setGains(flat);
        this.state.eqGains = flat;
        flat.forEach((g, i) => this._updateEqSliderUi(i, g));
        this._sendDspParam('equalizer', 'allBands', flat);
        this._saveStateDebounced();
      });
    }

    // Start FFT Visualizer Loop
    this._startFftLoop();
  }

  _startFftLoop() {
    const fetchFft = () => {
      if (this.masterPower && this.visualizer) {
        chrome.runtime.sendMessage({ action: 'DSP_GET_FFT' }, (res) => {
          if (res && res.data && res.data.length > 0) {
            this.visualizer.setFftData(res.data);
          }
        });
      }
      requestAnimationFrame(fetchFft);
    };
    requestAnimationFrame(fetchFft);
  }

  // --- Accordion Cards & Header Toggles ---
  _initAccordionCards() {
    document.querySelectorAll('.m3-card').forEach(card => {
      const header = card.querySelector('.m3-card-header');
      const switchInput = card.querySelector('.m3-switch input');

      // Click card header to expand/collapse (unless clicking switch)
      header?.addEventListener('click', (e) => {
        if (e.target.closest('.m3-switch') || e.target.closest('button')) return;
        card.classList.toggle('expanded');
      });

      // Switch toggle color transformation
      if (switchInput) {
        const updateHeaderActive = () => {
          if (switchInput.checked) {
            header.classList.add('active-card');
          } else {
            header.classList.remove('active-card');
          }
        };
        switchInput.addEventListener('change', updateHeaderActive);
        updateHeaderActive();
      }
    });

    // Wire individual module toggle switches
    this._bindSwitch('toggleLimiter', 'limiter', 'limiterEnabled');
    this._bindSwitch('toggleEqualizer', 'equalizer', 'eqEnabled');
    this._bindSwitch('toggleDynamicBass', 'dynamicBass', 'dynamicBassEnabled');
    this._bindSwitch('toggleCompander', 'compander', 'companderEnabled');
    this._bindSwitch('toggleTube', 'tubeSaturation', 'tubeEnabled');
    this._bindSwitch('toggleDdc', 'ddc', 'ddcEnabled');
    this._bindSwitch('toggleConvolver', 'convolver', 'convolverEnabled');
    this._bindSwitch('toggleCrossfeed', 'crossfeed', 'crossfeedEnabled');
    this._bindSwitch('toggleReverb', 'reverb', 'reverbEnabled');
    this._bindSwitch('toggleLiveprog', 'liveprog', 'liveprogEnabled');
    this._bindSwitch('toggleStereoWiden', 'stereoWiden', 'stereoWidenEnabled');
  }

  _bindSwitch(elementId, dspModuleName, stateKey) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      this.state[stateKey] = enabled;
      chrome.runtime.sendMessage({
        action: 'DSP_TOGGLE_MODULE',
        module: dspModuleName,
        enabled
      });
      this._saveStateDebounced();
    });
  }

  // --- Category Chips ---
  _initFilterChips() {
    const chips = document.querySelectorAll('.chips-scroll .m3-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const cat = chip.getAttribute('data-category');
        document.querySelectorAll('.m3-card').forEach(card => {
          const cardCat = card.getAttribute('data-category');
          if (cat === 'all' || cardCat === cat || cardCat === 'all') {
            card.style.display = 'block';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  // --- Precision Sliders ---
  _initSliders() {
    // 15 EQ Sliders
    const eqContainer = document.getElementById('eqSlidersContainer');
    if (eqContainer) {
      eqContainer.innerHTML = '';
      ISO_FREQUENCIES_15.forEach((freq, i) => {
        const col = document.createElement('div');
        col.className = 'eq-band-col';
        col.style.display = 'flex';
        col.style.flexDirection = 'column';
        col.style.alignItems = 'center';
        col.style.gap = '6px';

        const gainLabel = document.createElement('span');
        gainLabel.id = `eqGainVal_${i}`;
        gainLabel.style.fontSize = '11px';
        gainLabel.style.fontWeight = '600';
        gainLabel.textContent = '0dB';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'm3-slider vertical';
        slider.min = -12;
        slider.max = 12;
        slider.step = 0.5;
        slider.value = 0;
        slider.id = `sliderEq_${i}`;

        const freqLabel = document.createElement('span');
        freqLabel.style.fontSize = '10px';
        freqLabel.style.color = 'var(--md-sys-color-on-surface-variant)';
        freqLabel.textContent = freq >= 1000 ? `${freq / 1000}k` : freq;

        col.appendChild(gainLabel);
        col.appendChild(slider);
        col.appendChild(freqLabel);
        eqContainer.appendChild(col);

        slider.addEventListener('input', (e) => {
          const gain = parseFloat(e.target.value);
          gainLabel.textContent = `${gain >= 0 ? '+' : ''}${gain}dB`;
          this.state.eqGains[i] = gain;
          this.visualizer?.setBandGain(i, gain);
          this._sendDspParam('equalizer', 'band', { index: i, gain });
          this._saveStateDebounced();
        });
      });
    }

    // Preamp & Limiter
    this._bindSlider('sliderPreampGain', 'valPreampGain', ' dB', (v) => {
      this.state.preampGain = v;
      this._sendDspParam('limiter', 'preamp', v);
    });
    this._bindSlider('sliderLimiterThreshold', 'valLimiterThreshold', ' dBFS', (v) => {
      this.state.limiterThreshold = v;
      this._sendDspParam('limiter', 'threshold', v);
    });

    // Dynamic Bass
    this._bindSlider('sliderBassGain', 'valBassGain', ' dB', (v) => {
      this.state.dynamicBassGain = v;
      this._sendDspParam('dynamicBass', 'maxGain', v);
    });
    this._bindSlider('sliderBassFreq', 'valBassFreq', ' Hz', (v) => {
      this.state.dynamicBassFreq = v;
      this._sendDspParam('dynamicBass', 'frequency', v);
    });

    // Compander
    this._bindSlider('sliderCompThreshold', 'valCompThreshold', ' dBFS', (v) => {
      this.state.compThreshold = v;
      this._sendDspParam('compander', 'threshold', v);
    });
    this._bindSlider('sliderCompRatio', 'valCompRatio', ' : 1', (v) => {
      this.state.compRatio = v;
      this._sendDspParam('compander', 'ratio', v);
    });
    this._bindSlider('sliderCompAttack', 'valCompAttack', ' ms', (v) => {
      this.state.compAttack = v;
      this._sendDspParam('compander', 'attack', v);
    });
    this._bindSlider('sliderCompRelease', 'valCompRelease', ' ms', (v) => {
      this.state.compRelease = v;
      this._sendDspParam('compander', 'release', v);
    });

    // Tube Saturation
    this._bindSlider('sliderTubeDrive', 'valTubeDrive', ' %', (v) => {
      this.state.tubeDrive = v;
      this._sendDspParam('tubeSaturation', 'drive', v);
    });

    // Stereo Width
    this._bindSlider('sliderStereoWidth', 'valStereoWidth', ' %', (v) => {
      this.state.stereoWidth = v;
      this._sendDspParam('stereoWiden', 'width', v / 100);
    });

    // Dropdowns
    this._bindSelect('eqFilterTypeSelect', (v) => {
      this.state.eqFilterType = parseInt(v, 10);
      this._sendDspParam('equalizer', 'filterMode', this.state.eqFilterType);
    });
    this._bindSelect('eqInterpSelect', (v) => {
      this.state.eqInterpolation = parseInt(v, 10);
      this._sendDspParam('equalizer', 'interpolation', this.state.eqInterpolation);
      this.visualizer?.setInterpolation(this.state.eqInterpolation);
    });
    this._bindSelect('bassModeSelect', (v) => {
      this.state.dynamicBassMode = parseInt(v, 10);
      this._sendDspParam('dynamicBass', 'mode', this.state.dynamicBassMode);
    });
    this._bindSelect('crossfeedModeSelect', (v) => {
      this.state.crossfeedMode = parseInt(v, 10);
      this._sendDspParam('crossfeed', 'mode', this.state.crossfeedMode);
    });
    this._bindSelect('reverbPresetSelect', (v) => {
      this.state.reverbPreset = parseInt(v, 10);
      this._sendDspParam('reverb', 'preset', this.state.reverbPreset);
    });
  }

  _bindSlider(sliderId, badgeId, unit, onChange) {
    const slider = document.getElementById(sliderId);
    const badge = document.getElementById(badgeId);
    if (!slider) return;
    slider.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (badge) badge.textContent = `${v}${unit}`;
      onChange(v);
      this._saveStateDebounced();
    });
    attachPrecisionSlider(slider, { unit });
  }

  _bindSelect(selectId, onChange) {
    const el = document.getElementById(selectId);
    if (!el) return;
    el.addEventListener('change', (e) => {
      onChange(e.target.value);
      this._saveStateDebounced();
    });
  }

  _updateEqSliderUi(index, gain) {
    const slider = document.getElementById(`sliderEq_${index}`);
    const badge = document.getElementById(`eqGainVal_${index}`);
    if (slider) slider.value = gain;
    if (badge) badge.textContent = `${gain >= 0 ? '+' : ''}${gain}dB`;
  }

  // --- LiveProg Scripting & IDE ---
  _initLiveProg() {
    const container = document.getElementById('liveprogDynamicGuiContainer');
    this.liveprogGui = new LiveprogGui(container, (id, val) => {
      this._sendDspParam('liveprog', 'slider', { id, value: val });
      this._saveStateDebounced();
    });

    const scriptSelect = document.getElementById('liveprogScriptSelect');
    scriptSelect?.addEventListener('change', (e) => {
      this.loadLiveprogScript(e.target.value);
    });

    // Open IDE Modal
    const ideDialog = document.getElementById('liveprogIdeDialog');
    const ideContainer = document.getElementById('liveprogIdeContainer');
    document.getElementById('btnOpenLiveprogIde')?.addEventListener('click', () => {
      if (ideDialog) {
        ideDialog.showModal();
        if (!this.liveprogIde) {
          this.liveprogIde = new LiveprogIde(ideContainer, (name, code) => {
            return this._compileLiveprogCode(name, code);
          });
          this.liveprogIde.render();
        }
      }
    });
    document.getElementById('btnCloseIde')?.addEventListener('click', () => {
      ideDialog?.close();
    });

    // Load initial script
    this.loadLiveprogScript('viper_dynamicbass.eel');
  }

  async loadLiveprogScript(scriptName) {
    try {
      const url = chrome.runtime.getURL(`ui/assets/Liveprog/${scriptName}`);
      const res = await fetch(url);
      const text = await res.text();
      this._compileLiveprogCode(scriptName, text);
    } catch (err) {
      console.warn('Could not load Liveprog script:', err);
    }
  }

  _compileLiveprogCode(name, text) {
    this.state.liveprogScript = name;
    chrome.runtime.sendMessage({
      action: 'DSP_LOAD_LIVEPROG',
      name,
      scriptText: text
    }, (res) => {
      if (res && res.sliders) {
        this.liveprogGui?.render(res.sliders);
      }
    });
  }

  // --- AutoEQ Headphone Database ---
  _initAutoEq() {
    const searchBtn = document.getElementById('btnAutoEqSearch');
    const searchInput = document.getElementById('inputAutoEqSearch');
    const resultsContainer = document.getElementById('autoEqSearchResults');

    const doSearch = async () => {
      const q = searchInput.value.trim();
      if (!q) return;
      resultsContainer.innerHTML = '<span style="font-size: 12px; color: var(--md-sys-color-on-surface-variant);">Searching AutoEQ database...</span>';
      const results = await this.autoEqClient.searchProfiles(q);
      resultsContainer.innerHTML = '';

      if (results.length === 0) {
        resultsContainer.innerHTML = '<span style="font-size: 12px; font-style: italic;">No matching headphone models found.</span>';
        return;
      }

      results.forEach(item => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '8px 12px';
        row.style.background = 'var(--md-sys-color-surface-container)';
        row.style.borderRadius = '8px';

        const nameSpan = document.createElement('span');
        nameSpan.style.fontSize = '13px';
        nameSpan.style.fontWeight = '500';
        nameSpan.textContent = item.name;

        const applyBtn = document.createElement('button');
        applyBtn.className = 'm3-button primary';
        applyBtn.style.padding = '4px 12px';
        applyBtn.style.fontSize = '12px';
        applyBtn.textContent = 'Apply';

        applyBtn.addEventListener('click', async () => {
          applyBtn.textContent = 'Loading...';
          const profile = await this.autoEqClient.fetchParametricEq(item.path);
          if (profile && profile.fixed15Gains) {
            this.visualizer?.setGains(profile.fixed15Gains);
            this.state.eqGains = [...profile.fixed15Gains];
            this.state.eqGains.forEach((g, i) => this._updateEqSliderUi(i, g));
            this._sendDspParam('equalizer', 'allBands', profile.fixed15Gains);
            this._saveStateDebounced();
            applyBtn.textContent = 'Applied ✓';
          } else {
            applyBtn.textContent = 'Failed';
          }
        });

        row.appendChild(nameSpan);
        row.appendChild(applyBtn);
        resultsContainer.appendChild(row);
      });
    };

    searchBtn?.addEventListener('click', doSearch);
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSearch();
    });
  }

  // --- Master Dock & Controls ---
  _initMasterDock() {
    const fab = document.getElementById('dockMasterFab');
    const settingsBtn = document.getElementById('dockSettingsBtn');
    const overflowBtn = document.getElementById('dockOverflowBtn');

    // Elevated Master Power FAB
    fab?.addEventListener('click', () => {
      this.masterPower = !this.masterPower;
      if (this.masterPower) {
        fab.classList.add('active');
      } else {
        fab.classList.remove('active');
      }
      this.state.masterPower = this.masterPower;
      chrome.runtime.sendMessage({
        action: 'DSP_SET_MASTER_POWER',
        enabled: this.masterPower
      });
      this._saveStateDebounced();
    });

    // Settings Modal
    const settingsDialog = document.getElementById('settingsDialog');
    settingsBtn?.addEventListener('click', () => settingsDialog?.showModal());
    document.getElementById('btnCloseSettings')?.addEventListener('click', () => settingsDialog?.close());

    // Presets Modal
    const presetsDialog = document.getElementById('presetsDialog');
    overflowBtn?.addEventListener('click', () => presetsDialog?.showModal());
    document.getElementById('btnClosePresets')?.addEventListener('click', () => presetsDialog?.close());

    // Device Profile Switcher
    const profileSelect = document.getElementById('deviceProfileSelect');
    profileSelect?.addEventListener('change', (e) => {
      this.switchDeviceProfile(e.target.value);
    });
  }

  // --- Modals & Themes ---
  _initModals() {
    // Theme buttons
    document.querySelectorAll('.theme-palette-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.theme-palette-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.setTheme(chip.getAttribute('data-theme'));
      });
    });

    // AMOLED toggle
    const amoledToggle = document.getElementById('toggleAmoled');
    amoledToggle?.addEventListener('change', (e) => {
      this.isAmoled = e.target.checked;
      document.documentElement.setAttribute('data-theme-amoled', this.isAmoled ? 'true' : 'false');
      this._saveStateDebounced();
    });

    // Presets Export / Import
    document.getElementById('btnExportPresetArchive')?.addEventListener('click', () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.state, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `SoundSmith_Backup_${Date.now()}.json`);
      downloadAnchor.click();
    });

    document.getElementById('inputImportPresetArchive')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const imported = JSON.parse(event.target.result);
            this.state = { ...this.state, ...imported };
            this._applyStateToUi();
            chrome.runtime.sendMessage({ action: 'DSP_APPLY_PRESET', preset: this.state });
            this._saveStateDebounced();
            alert('SoundSmith preset archive restored successfully!');
          } catch (err) {
            alert('Failed to parse preset file: ' + err.message);
          }
        };
        reader.readAsText(file);
      }
    });

    document.getElementById('btnResetToDefaults')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all audio effects to defaults?')) {
        chrome.storage.local.clear(() => {
          location.reload();
        });
      }
    });
  }

  setTheme(themeName) {
    this.currentTheme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);
    this._saveStateDebounced();
  }

  switchDeviceProfile(profileKey) {
    this.currentProfile = profileKey;
    this._loadProfileState(profileKey);
  }

  // --- Tab Audio Connection ---
  _initTabConnection() {
    const attachBtn = document.getElementById('attachTabBtn');
    const sidePanelBtn = document.getElementById('openSidePanelBtn');
    const statusText = document.getElementById('tabStatusText');
    const statusDot = document.getElementById('statusDot');

    const updateStatus = (active, tabId) => {
      if (active) {
        statusText.textContent = `Attached to Tab #${tabId}`;
        statusDot.style.background = '#4CAF50';
      } else {
        statusText.textContent = 'No audio stream attached';
        statusDot.style.background = '#888';
      }
    };

    // Check status
    chrome.runtime.sendMessage({ action: 'OFFSCREEN_GET_STATUS' }, (res) => {
      if (res) updateStatus(res.active, res.tabId);
    });

    // Attach Tab button
    attachBtn?.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          chrome.runtime.sendMessage({
            action: 'POPUP_START_CAPTURE',
            tabId: tabs[0].id
          }, (res) => {
            if (res && res.success) {
              updateStatus(true, tabs[0].id);
            }
          });
        }
      });
    });

    // Side panel button
    sidePanelBtn?.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && chrome.sidePanel) {
          chrome.sidePanel.open({ tabId: tabs[0].id });
        }
      });
    });
  }

  _sendDspParam(module, param, value) {
    chrome.runtime.sendMessage({
      action: 'DSP_SET_PARAM',
      module,
      param,
      value
    });
  }

  _saveStateDebounced() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      const storageKey = `soundsmith_${this.currentProfile}`;
      chrome.storage.local.set({
        [storageKey]: this.state,
        soundsmith_theme: this.currentTheme,
        soundsmith_amoled: this.isAmoled,
        soundsmith_current_profile: this.currentProfile
      });
    }, 150);
  }

  async _loadState() {
    const data = await chrome.storage.local.get([
      'soundsmith_current_profile',
      'soundsmith_theme',
      'soundsmith_amoled'
    ]);
    if (data.soundsmith_theme) this.setTheme(data.soundsmith_theme);
    if (data.soundsmith_amoled !== undefined) {
      this.isAmoled = !!data.soundsmith_amoled;
      document.documentElement.setAttribute('data-theme-amoled', this.isAmoled ? 'true' : 'false');
      const toggle = document.getElementById('toggleAmoled');
      if (toggle) toggle.checked = this.isAmoled;
    }
    const profile = data.soundsmith_current_profile || 'headset';
    this.currentProfile = profile;
    const select = document.getElementById('deviceProfileSelect');
    if (select) select.value = profile;
    await this._loadProfileState(profile);
  }

  async _loadProfileState(profile) {
    const storageKey = `soundsmith_${profile}`;
    const data = await chrome.storage.local.get(storageKey);
    if (data && data[storageKey]) {
      this.state = { ...this.state, ...data[storageKey] };
      this._applyStateToUi();
      chrome.runtime.sendMessage({ action: 'DSP_APPLY_PRESET', preset: this.state });
    }
  }

  _applyStateToUi() {
    // Sliders
    this.state.eqGains.forEach((g, i) => this._updateEqSliderUi(i, g));
    this.visualizer?.setGains(this.state.eqGains);

    // Switches
    this._setSwitchState('toggleLimiter', this.state.limiterEnabled);
    this._setSwitchState('toggleEqualizer', this.state.eqEnabled);
    this._setSwitchState('toggleDynamicBass', this.state.dynamicBassEnabled);
    this._setSwitchState('toggleCompander', this.state.companderEnabled);
    this._setSwitchState('toggleTube', this.state.tubeEnabled);
    this._setSwitchState('toggleDdc', this.state.ddcEnabled);
    this._setSwitchState('toggleConvolver', this.state.convolverEnabled);
    this._setSwitchState('toggleCrossfeed', this.state.crossfeedEnabled);
    this._setSwitchState('toggleReverb', this.state.reverbEnabled);
    this._setSwitchState('toggleLiveprog', this.state.liveprogEnabled);
    this._setSwitchState('toggleStereoWiden', this.state.stereoWidenEnabled);
  }

  _setSwitchState(id, checked) {
    const el = document.getElementById(id);
    if (el) {
      el.checked = !!checked;
      el.dispatchEvent(new Event('change'));
    }
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.soundSmithApp = new SoundSmithApp();
});
