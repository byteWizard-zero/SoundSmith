/**
 * JamesDSP UI Controller
 * Material Design 3 controls with full Chrome Storage persistence and offscreen audio sync.
 */

import { AudioVisualizer } from './components/visualizer.js';
import { AutoEqBrowser } from './components/autoeq-browser.js';
import { BUILT_IN_PRESETS, PresetsManager } from './components/presets-manager.js';
import { FREQUENCIES_10_BAND, FREQUENCIES_15_BAND } from '../offscreen/dsp/equalizer.js';

let currentTab = null;
let isCapturing = false;
let isMasterOn = true;
let currentEqMode = 10;
let eqGains = new Array(10).fill(0);

// Default Master State Model
let appState = {
  masterPower: true,
  equalizer: {
    enabled: true,
    mode: 10,
    gains: new Array(10).fill(0)
  },
  dynamicBass: {
    enabled: false,
    gain: 6.0,
    cutoff: 100,
    harmonics: 0.5
  },
  tubeSaturation: {
    enabled: false,
    drive: 0.3,
    warmth: 0.5
  },
  crossfeed: {
    enabled: false,
    preset: 'chumoy'
  },
  stereoWiden: {
    enabled: false,
    width: 1.4
  },
  convolver: {
    enabled: false,
    wet: 0.5,
    dry: 1.0
  },
  reverb: {
    enabled: false,
    roomSize: 0.6,
    damping: 4000,
    wet: 0.35
  },
  limiter: {
    preamp: 0.0
  }
};

// Initialize visualizer
const canvas = document.getElementById('visualizerCanvas');
const visualizer = new AudioVisualizer(canvas);
visualizer.start();

/**
 * Save current state to chrome.storage.local with debounce
 */
let saveTimeout = null;
function persistState() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    chrome.storage.local.set({ jamesdsp_state: appState });
  }, 100);
}

// Document Ready
document.addEventListener('DOMContentLoaded', async () => {
  initCardAccordions();
  initCategoryChips();
  initModals();

  // 1. Load saved state from storage first
  await loadSavedState();

  // 2. Check tab status and sync with active stream
  await updateActiveTabInfo();
  startFftPolling();

  // 3. Listen for tab switches
  if (chrome.tabs && chrome.tabs.onActivated) {
    chrome.tabs.onActivated.addListener(() => {
      updateActiveTabInfo();
    });
  }
});

/**
 * Load state from chrome.storage.local and apply to UI
 */
async function loadSavedState() {
  try {
    const data = await chrome.storage.local.get('jamesdsp_state');
    if (data && data.jamesdsp_state) {
      appState = { ...appState, ...data.jamesdsp_state };
    }
  } catch (err) {
    console.warn('[JamesDSP] Failed to read storage:', err);
  }

  // Apply state to all controls
  applyStateToUI();
}

/**
 * Sync UI elements with appState object
 */
function applyStateToUI() {
  // Equalizer
  currentEqMode = appState.equalizer.mode || 10;
  eqGains = appState.equalizer.gains || new Array(currentEqMode).fill(0);
  
  const freqs = currentEqMode === 10 ? FREQUENCIES_10_BAND : FREQUENCIES_15_BAND;
  document.getElementById('visModeBadge').textContent = `${currentEqMode}-Band Graphic EQ`;
  
  if (currentEqMode === 15) {
    document.getElementById('btnEq15').classList.add('active');
    document.getElementById('btnEq10').classList.remove('active');
  } else {
    document.getElementById('btnEq10').classList.add('active');
    document.getElementById('btnEq15').classList.remove('active');
  }
  
  initEqSliders(freqs, eqGains);
  document.getElementById('switchEq').checked = !!appState.equalizer.enabled;

  // Dynamic Bass
  document.getElementById('switchBass').checked = !!appState.dynamicBass.enabled;
  document.getElementById('sliderBassGain').value = appState.dynamicBass.gain;
  document.getElementById('valBassGain').textContent = `+${appState.dynamicBass.gain.toFixed(1)} dB`;
  document.getElementById('sliderBassCutoff').value = appState.dynamicBass.cutoff;
  document.getElementById('valBassCutoff').textContent = `${appState.dynamicBass.cutoff} Hz`;
  document.getElementById('sliderBassHarmonics').value = Math.round(appState.dynamicBass.harmonics * 100);
  document.getElementById('valBassHarmonics').textContent = `${Math.round(appState.dynamicBass.harmonics * 100)}%`;

  // Tube Saturation
  document.getElementById('switchTube').checked = !!appState.tubeSaturation.enabled;
  document.getElementById('sliderTubeDrive').value = Math.round(appState.tubeSaturation.drive * 100);
  document.getElementById('valTubeDrive').textContent = `${Math.round(appState.tubeSaturation.drive * 100)}%`;
  document.getElementById('sliderTubeWarmth').value = Math.round(appState.tubeSaturation.warmth * 100);
  document.getElementById('valTubeWarmth').textContent = `${Math.round(appState.tubeSaturation.warmth * 100)}%`;

  // Crossfeed
  document.getElementById('switchCrossfeed').checked = !!appState.crossfeed.enabled;
  if (appState.crossfeed.preset === 'meier') {
    document.getElementById('btnCrossfeedMeier').classList.add('active');
    document.getElementById('btnCrossfeedChumoy').classList.remove('active');
  } else {
    document.getElementById('btnCrossfeedChumoy').classList.add('active');
    document.getElementById('btnCrossfeedMeier').classList.remove('active');
  }

  // Stereo Widener
  document.getElementById('switchWidener').checked = !!appState.stereoWiden.enabled;
  document.getElementById('sliderWidth').value = Math.round(appState.stereoWiden.width * 100);
  document.getElementById('valWidth').textContent = `${Math.round(appState.stereoWiden.width * 100)}%`;

  // Convolver
  document.getElementById('switchConvolver').checked = !!appState.convolver.enabled;
  document.getElementById('sliderConvolverWet').value = Math.round(appState.convolver.wet * 100);
  document.getElementById('valConvolverWet').textContent = `${Math.round(appState.convolver.wet * 100)}%`;

  // Reverb
  document.getElementById('switchReverb').checked = !!appState.reverb.enabled;
  document.getElementById('sliderRoomSize').value = Math.round(appState.reverb.roomSize * 100);
  document.getElementById('valRoomSize').textContent = `${Math.round(appState.reverb.roomSize * 100)}%`;
  document.getElementById('sliderReverbWet').value = Math.round(appState.reverb.wet * 100);
  document.getElementById('valReverbWet').textContent = `${Math.round(appState.reverb.wet * 100)}%`;

  // Preamp Gain
  document.getElementById('sliderPreamp').value = appState.limiter.preamp;
  document.getElementById('valPreamp').textContent = `${appState.limiter.preamp > 0 ? '+' : ''}${appState.limiter.preamp.toFixed(1)} dB`;

  // Master Power
  isMasterOn = appState.masterPower !== false;
  updateMasterPowerButton(isCapturing && isMasterOn);
}

/**
 * Check active tab and audio capture status
 */
async function updateActiveTabInfo() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      currentTab = tabs[0];
      const statusText = document.getElementById('tabStatusText');
      const dot = document.getElementById('statusDot');

      try {
        const urlObj = new URL(currentTab.url);
        statusText.textContent = urlObj.hostname || 'Active Tab';
      } catch {
        statusText.textContent = currentTab.title ? currentTab.title.substring(0, 24) : 'Active Tab';
      }

      // Check capture status from background / offscreen
      chrome.runtime.sendMessage({ action: 'GET_DSP_STATUS', tabId: currentTab.id }, (status) => {
        if (status && status.active) {
          isCapturing = true;
          dot.classList.add('active');
          updateMasterPowerButton(isMasterOn);
        } else {
          isCapturing = false;
          dot.classList.remove('active');
          updateMasterPowerButton(false);
        }
      });
    }
  } catch (err) {
    console.error('[JamesDSP] updateActiveTabInfo error:', err);
  }
}

/**
 * Master Power Button Handler
 */
const masterPowerBtn = document.getElementById('masterPowerBtn');
masterPowerBtn.addEventListener('click', async () => {
  // Always fetch current active tab dynamically to avoid stale IDs
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs && tabs[0]) {
    currentTab = tabs[0];
  }
  if (!currentTab) return;

  if (!isCapturing) {
    // Start audio capture
    masterPowerBtn.querySelector('span').textContent = 'CONNECTING...';
    chrome.runtime.sendMessage({ action: 'START_TAB_CAPTURE', tabId: currentTab.id }, (res) => {
      if (res && res.success) {
        isCapturing = true;
        isMasterOn = true;
        appState.masterPower = true;
        persistState();
        document.getElementById('statusDot').classList.add('active');
        updateMasterPowerButton(true);

        // Send current restored state to offscreen
        chrome.runtime.sendMessage({ action: 'DSP_APPLY_PRESET', preset: appState });
      } else {
        updateMasterPowerButton(false);
        alert(res?.error || 'Failed to capture tab audio.');
      }
    });
  } else {
    // Toggle bypass
    isMasterOn = !isMasterOn;
    appState.masterPower = isMasterOn;
    persistState();
    chrome.runtime.sendMessage({ action: 'DSP_SET_MASTER_POWER', enabled: isMasterOn });
    updateMasterPowerButton(isMasterOn);
  }
});

function updateMasterPowerButton(active) {
  const label = document.getElementById('masterPowerLabel');
  if (active) {
    masterPowerBtn.classList.add('active');
    label.textContent = 'PWR ON';
  } else {
    masterPowerBtn.classList.remove('active');
    label.textContent = 'PWR OFF';
  }
}

/**
 * Side Panel Launcher
 */
document.getElementById('openSidePanelBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'OPEN_SIDE_PANEL' });
});

/**
 * Card Accordions
 */
function initCardAccordions() {
  document.querySelectorAll('.m3-card-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.m3-switch')) return;
      const card = header.closest('.m3-card');
      card.classList.toggle('expanded');
    });
  });
}

/**
 * Category Chips
 */
function initCategoryChips() {
  document.querySelectorAll('.chips-scroll .m3-chip[data-category]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chips-scroll .m3-chip[data-category]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const cat = chip.dataset.category;
      document.querySelectorAll('.m3-card').forEach(card => {
        if (cat === 'all' || card.dataset.category === cat || card.id === 'cardLimiter') {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

/**
 * Equalizer Sliders Dynamic Generation
 */
function initEqSliders(frequencies, existingGains) {
  const container = document.getElementById('eqSlidersContainer');
  container.innerHTML = '';
  eqGains = existingGains && existingGains.length === frequencies.length 
    ? [...existingGains] 
    : new Array(frequencies.length).fill(0);

  frequencies.forEach((freq, idx) => {
    const col = document.createElement('div');
    col.className = 'eq-band-col';

    const freqStr = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
    const gainVal = eqGains[idx] || 0;

    col.innerHTML = `
      <span class="eq-band-value" id="eqVal_${idx}">${gainVal > 0 ? '+' : ''}${gainVal}dB</span>
      <input type="range" class="eq-slider-vertical" id="eqSlider_${idx}" min="-15" max="15" step="0.5" value="${gainVal}">
      <span class="eq-band-label">${freqStr}</span>
    `;

    const slider = col.querySelector('.eq-slider-vertical');
    const valBadge = col.querySelector('.eq-band-value');

    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      valBadge.textContent = `${val > 0 ? '+' : ''}${val}dB`;
      eqGains[idx] = val;
      appState.equalizer.gains = [...eqGains];
      persistState();
      visualizer.setEqGains(eqGains);

      chrome.runtime.sendMessage({
        action: 'DSP_SET_PARAM',
        module: 'equalizer',
        param: 'bandGain',
        value: { index: idx, gain: val }
      });
    });

    container.appendChild(col);
  });

  visualizer.setEqGains(eqGains);
}

// 10 vs 15 Band switchers
document.getElementById('btnEq10').addEventListener('click', () => {
  document.getElementById('btnEq10').classList.add('active');
  document.getElementById('btnEq15').classList.remove('active');
  document.getElementById('visModeBadge').textContent = '10-Band Graphic EQ';
  currentEqMode = 10;
  appState.equalizer.mode = 10;
  initEqSliders(FREQUENCIES_10_BAND, eqGains.slice(0, 10));
  appState.equalizer.gains = [...eqGains];
  persistState();
  chrome.runtime.sendMessage({ action: 'DSP_SET_PARAM', module: 'equalizer', param: 'mode', value: 10 });
});

document.getElementById('btnEq15').addEventListener('click', () => {
  document.getElementById('btnEq15').classList.add('active');
  document.getElementById('btnEq10').classList.remove('active');
  document.getElementById('visModeBadge').textContent = '15-Band Graphic EQ';
  currentEqMode = 15;
  appState.equalizer.mode = 15;
  
  let newGains = new Array(15).fill(0);
  for (let i = 0; i < Math.min(eqGains.length, 15); i++) newGains[i] = eqGains[i];
  initEqSliders(FREQUENCIES_15_BAND, newGains);
  appState.equalizer.gains = [...eqGains];
  persistState();
  chrome.runtime.sendMessage({ action: 'DSP_SET_PARAM', module: 'equalizer', param: 'mode', value: 15 });
});

// Reset Flat
document.getElementById('btnResetEq').addEventListener('click', () => {
  const freqs = currentEqMode === 10 ? FREQUENCIES_10_BAND : FREQUENCIES_15_BAND;
  initEqSliders(freqs, new Array(freqs.length).fill(0));
  appState.equalizer.gains = new Array(freqs.length).fill(0);
  persistState();
  chrome.runtime.sendMessage({ action: 'DSP_SET_PARAM', module: 'equalizer', param: 'allGains', value: new Array(freqs.length).fill(0) });
});

/**
 * Module Switches & Controls
 */
function bindModuleSwitch(switchId, moduleName, stateKey) {
  document.getElementById(switchId).addEventListener('change', (e) => {
    appState[stateKey].enabled = e.target.checked;
    persistState();
    chrome.runtime.sendMessage({
      action: 'DSP_TOGGLE_MODULE',
      module: moduleName,
      enabled: e.target.checked
    });
  });
}

bindModuleSwitch('switchEq', 'equalizer', 'equalizer');
bindModuleSwitch('switchBass', 'dynamicBass', 'dynamicBass');
bindModuleSwitch('switchTube', 'tubeSaturation', 'tubeSaturation');
bindModuleSwitch('switchCrossfeed', 'crossfeed', 'crossfeed');
bindModuleSwitch('switchWidener', 'stereoWiden', 'stereoWiden');
bindModuleSwitch('switchConvolver', 'convolver', 'convolver');
bindModuleSwitch('switchReverb', 'reverb', 'reverb');

// Dynamic Bass Controls
const sliderBassGain = document.getElementById('sliderBassGain');
sliderBassGain.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  document.getElementById('valBassGain').textContent = `+${val.toFixed(1)} dB`;
  appState.dynamicBass.gain = val;
  persistState();
  chrome.runtime.sendMessage({ action: 'DSP_SET_PARAM', module: 'dynamicBass', param: 'gain', value: val });
});

const sliderBassCutoff = document.getElementById('sliderBassCutoff');
sliderBassCutoff.addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  document.getElementById('valBassCutoff').textContent = `${val} Hz`;
  appState.dynamicBass.cutoff = val;
  persistState();
  chrome.runtime.sendMessage({ action: 'DSP_SET_PARAM', module: 'dynamicBass', param: 'cutoff', value: val });
});

const sliderBassHarmonics = document.getElementById('sliderBassHarmonics');
sliderBassHarmonics.addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  document.getElementById('valBassHarmonics').textContent = `${val}%`;
  appState.dynamicBass.harmonics = val / 100;
  persistState();
  chrome.runtime.sendMessage({ action: 'DSP_SET_PARAM', module: 'dynamicBass', param: 'harmonics', value: val / 100 });
});

// Tube Saturation Controls
const sliderTubeDrive = document.getElementById('sliderTubeDrive');
sliderTubeDrive.addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  document.getElementById('valTubeDrive').textContent = `${val}%`;
  appState.tubeSaturation.drive = val / 100;
  persistState();
  chrome.runtime.sendMessage({ action: 'DSP_SET_PARAM', module: 'tubeSaturation', param: 'drive', value: val / 100 });
});

const sliderTubeWarmth = document.getElementById('sliderTubeWarmth');
sliderTubeWarmth.addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  document.getElementById('valTubeWarmth').textContent = `${val}%`;
  appState.tubeSaturation.warmth = val / 100;
  persistState();
  chrome.runtime.sendMessage({ action: 'DSP_SET_PARAM', module: 'tubeSaturation', param: 'warmth', value: val / 100 });
});

// Crossfeed Controls
document.getElementById('btnCrossfeedChumoy').addEventListener('click', () => {
  document.getElementById('btnCrossfeedChumoy').classList.add('active');
  document.getElementById('btnCrossfeedMeier').classList.remove('active');
  appState.crossfeed.preset = 'chumoy';
  persistState();
  chrome.runtime.sendMessage({ action: 'DSP_SET_PARAM', module: 'crossfeed', param: 'preset', value: 'chumoy' });
});

document.getElementById('btnCrossfeedMeier').addEventListener('click', () => {
  document.getElementById('btnCrossfeedMeier').classList.add('active');
  document.getElementById('btnCrossfeedChumoy').classList.remove('active');
  appState.crossfeed.preset = 'meier';
  persistState();
  chrome.runtime.sendMessage({ action: 'DSP_SET_PARAM', module: 'crossfeed', param: 'preset', value: 'meier' });
});

// Stereo Widener Controls
const sliderWidth = document.getElementById('sliderWidth');
sliderWidth.addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  document.getElementById('valWidth').textContent = `${val}%`;
  appState.stereoWiden.width = val / 100;
  persistState();
  chrome.runtime.sendMessage({ action: 'DSP_SET_PARAM', module: 'stereoWiden', param: 'width', value: val / 100 });
});

// Convolver Controls
document.getElementById('btnLoadSyntheticIR').addEventListener('click', () => {
  chrome.runtime.sendMessage({
    action: 'DSP_SET_PARAM',
    module: 'convolver',
    param: 'synthetic',
    value: { duration: 1.0, decay: 0.08, name: 'Warm Studio Room' }
  });
  alert('Loaded Warm Studio Room impulse response.');
});

document.getElementById('inputCustomIR').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const arrayBuffer = await file.arrayBuffer();
  chrome.runtime.sendMessage({
    action: 'DSP_LOAD_IR_BUFFER',
    buffer: arrayBuffer,
    name: file.name
  }, (res) => {
    if (res && res.success) {
      alert(`Loaded Impulse Response: ${file.name}`);
    } else {
      alert(`Failed to load IR: ${res?.error}`);
    }
  });
});

const sliderConvolverWet = document.getElementById('sliderConvolverWet');
sliderConvolverWet.addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  document.getElementById('valConvolverWet').textContent = `${val}%`;
  appState.convolver.wet = val / 100;
  persistState();
  chrome.runtime.sendMessage({
    action: 'DSP_SET_PARAM',
    module: 'convolver',
    param: 'wetDry',
    value: { wet: val / 100, dry: 1.0 }
  });
});

// Reverb Controls
const sliderRoomSize = document.getElementById('sliderRoomSize');
sliderRoomSize.addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  document.getElementById('valRoomSize').textContent = `${val}%`;
  appState.reverb.roomSize = val / 100;
  persistState();
  chrome.runtime.sendMessage({ action: 'DSP_SET_PARAM', module: 'reverb', param: 'roomSize', value: val / 100 });
});

const sliderReverbWet = document.getElementById('sliderReverbWet');
sliderReverbWet.addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  document.getElementById('valReverbWet').textContent = `${val}%`;
  appState.reverb.wet = val / 100;
  persistState();
  chrome.runtime.sendMessage({
    action: 'DSP_SET_PARAM',
    module: 'reverb',
    param: 'wetDry',
    value: { wet: val / 100, dry: 1.0 }
  });
});

// Preamp Gain Control
const sliderPreamp = document.getElementById('sliderPreamp');
sliderPreamp.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  document.getElementById('valPreamp').textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)} dB`;
  appState.limiter.preamp = val;
  persistState();
  chrome.runtime.sendMessage({ action: 'DSP_SET_PARAM', module: 'limiter', param: 'preamp', value: val });
});

/**
 * FFT Visualizer Polling
 */
function startFftPolling() {
  setInterval(() => {
    if (isCapturing && isMasterOn) {
      chrome.runtime.sendMessage({ action: 'DSP_GET_FFT' }, (res) => {
        if (res && res.data) {
          visualizer.updateFftData(res.data);
        }
      });
    }
  }, 33);
}

/**
 * Modals & Preset Systems
 */
function initModals() {
  // AutoEQ Modal
  const autoEqModal = document.getElementById('autoEqModal');
  const openAutoEqBtn = document.getElementById('openAutoEqModalBtn');
  const closeAutoEqBtn = document.getElementById('closeAutoEqModalBtn');
  const autoEqList = document.getElementById('autoEqList');
  const searchAutoEqInput = document.getElementById('searchAutoEqInput');

  const autoEqBrowser = new AutoEqBrowser(autoEqList, (selectedProfile) => {
    applyAutoEqProfile(selectedProfile);
    autoEqModal.classList.remove('open');
  });

  openAutoEqBtn.addEventListener('click', () => {
    autoEqModal.classList.add('open');
    autoEqBrowser.render();
  });

  closeAutoEqBtn.addEventListener('click', () => {
    autoEqModal.classList.remove('open');
  });

  searchAutoEqInput.addEventListener('input', (e) => {
    autoEqBrowser.render(e.target.value);
  });

  // Presets Modal
  const presetsModal = document.getElementById('presetsModal');
  const openPresetsBtn = document.getElementById('openPresetsModalBtn');
  const closePresetsBtn = document.getElementById('closePresetsModalBtn');
  const presetsList = document.getElementById('presetsList');

  openPresetsBtn.addEventListener('click', () => {
    presetsModal.classList.add('open');
    renderPresetsList(presetsList);
  });

  closePresetsBtn.addEventListener('click', () => {
    presetsModal.classList.remove('open');
  });

  document.getElementById('btnExportPreset').addEventListener('click', () => {
    PresetsManager.exportPreset(appState);
  });

  document.getElementById('inputImportPreset').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const presetData = await PresetsManager.importPresetFromFile(file);
      appState = { ...appState, ...presetData };
      persistState();
      applyStateToUI();
      chrome.runtime.sendMessage({ action: 'DSP_APPLY_PRESET', preset: presetData });
      alert('Custom preset imported and applied successfully.');
      presetsModal.classList.remove('open');
    } catch (err) {
      alert(`Import error: ${err.message}`);
    }
  });
}

function applyAutoEqProfile(profile) {
  document.getElementById('btnEq10').click();

  profile.gains.forEach((gain, idx) => {
    const slider = document.getElementById(`eqSlider_${idx}`);
    const badge = document.getElementById(`eqVal_${idx}`);
    if (slider && badge) {
      slider.value = gain;
      badge.textContent = `${gain > 0 ? '+' : ''}${gain}dB`;
      eqGains[idx] = gain;
    }
  });

  appState.equalizer.gains = [...eqGains];
  persistState();
  visualizer.setEqGains(eqGains);
  chrome.runtime.sendMessage({
    action: 'DSP_SET_PARAM',
    module: 'equalizer',
    param: 'allGains',
    value: profile.gains
  });

  alert(`Applied AutoEQ profile for ${profile.name}!`);
}

function renderPresetsList(container) {
  container.innerHTML = Object.keys(BUILT_IN_PRESETS).map(key => {
    const p = BUILT_IN_PRESETS[key];
    return `
      <div class="autoeq-item" data-key="${key}">
        <div>
          <div style="font-weight: 600; font-size: 13px;">${p.name}</div>
          <div style="font-size: 11px; color: var(--md-sys-color-outline);">${p.description}</div>
        </div>
        <button class="m3-action-btn" style="padding: 4px 10px; font-size: 11px;">Load</button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.autoeq-item').forEach(item => {
    item.addEventListener('click', () => {
      const key = item.dataset.key;
      const preset = BUILT_IN_PRESETS[key];
      if (preset) {
        appState = { ...appState, ...preset };
        persistState();
        applyStateToUI();
        chrome.runtime.sendMessage({ action: 'DSP_APPLY_PRESET', preset });
        alert(`Loaded preset: ${preset.name}`);
        document.getElementById('presetsModal').classList.remove('open');
      }
    });
  });
}
