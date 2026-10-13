/**
 * SoundSmith Offscreen Audio Controller
 * Manages tab audio capture, AudioContext lifecycle, and DSP graph communications.
 */

import { DspEngine } from './dsp/dsp-engine.js';

let audioCtx = null;
let activeMediaStream = null;
let currentSourceNode = null;
let dspEngine = null;
let activeTabId = null;

async function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: 'playback'
    });
    window._audioCtx = audioCtx;
    dspEngine = new DspEngine(audioCtx);
    window._dspEngine = dspEngine;
    console.log('[SoundSmith Offscreen] AudioContext and DSP Engine initialized with playback latency.');
    await restoreSavedSettings();
  }
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
}

// Restore saved settings on initial load or stream capture
async function restoreSavedSettings() {
  if (!dspEngine) return;
  try {
    const data = await chrome.storage.local.get([
      'soundsmith_current_profile',
      'soundsmith_headset',
      'soundsmith_speaker',
      'soundsmith_bluetooth',
      'soundsmith_usb',
      'jamesdsp_state'
    ]);
    const profile = data?.soundsmith_current_profile || 'headset';
    const state = data?.[`soundsmith_${profile}`] || data?.jamesdsp_state;
    if (state) {
      dspEngine.applyPreset(state);
      console.log('[SoundSmith Offscreen] Restored DSP state from storage for profile:', profile);
    }
  } catch (err) {
    console.warn('[SoundSmith Offscreen] Could not read storage:', err);
  }
}

// Auto-initialize AudioContext on load
initAudioContext().catch(console.warn);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'OFFSCREEN_INIT_STREAM') {
    handleInitStream(message.streamId, message.tabId, sendResponse);
    return true; // Async response
  }

  if (message.action === 'OFFSCREEN_STOP_STREAM') {
    handleStopStream(sendResponse);
    return true;
  }

  if (message.action === 'OFFSCREEN_GET_STATUS') {
    sendResponse({
      active: !!activeMediaStream,
      tabId: activeTabId,
      state: dspEngine ? dspEngine.exportState() : null
    });
    return false;
  }

  // Ensure AudioContext and dspEngine are ready before executing DSP commands
  const ensureReady = async () => {
    if (!dspEngine) await initAudioContext();
    return dspEngine;
  };

  if (message.action === 'DSP_SET_MASTER_POWER') {
    ensureReady().then(engine => {
      engine?.setMasterPower(message.enabled);
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === 'DSP_TOGGLE_MODULE') {
    ensureReady().then(engine => {
      engine?.toggleModule(message.module, message.enabled);
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === 'DSP_SET_PARAM') {
    ensureReady().then(engine => {
      engine?.setModuleParam(message.module, message.param, message.value);
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === 'DSP_APPLY_PRESET') {
    ensureReady().then(engine => {
      engine?.applyPreset(message.preset);
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === 'DSP_GET_FFT') {
    if (dspEngine) {
      sendResponse({ data: dspEngine.getFrequencyData() });
    } else {
      sendResponse({ data: [] });
    }
    return false;
  }

  if (message.action === 'DSP_GET_RESPONSE') {
    if (dspEngine) {
      sendResponse({ curve: dspEngine.getCombinedResponse(message.frequencies) });
    } else {
      sendResponse({ curve: [] });
    }
    return false;
  }

  if (message.action === 'DSP_LOAD_IR_BUFFER') {
    ensureReady().then(engine => {
      engine?.convolver.loadImpulseResponseFromArrayBuffer(message.buffer, message.name)
        .then(result => sendResponse({ success: result }))
        .catch(err => sendResponse({ success: false, error: err.message }));
    });
    return true;
  }

  if (message.action === 'DSP_LOAD_DDC') {
    ensureReady().then(engine => {
      const ok = engine?.ddc.parseVdcString(message.vdcText, message.name);
      sendResponse({ success: ok });
    });
    return true;
  }

  if (message.action === 'DSP_LOAD_LIVEPROG') {
    ensureReady().then(engine => {
      const res = engine?.liveprog.loadScript(message.scriptText, message.name);
      sendResponse(res);
    });
    return true;
  }

  if (message.action === 'DSP_EXPORT_STATE') {
    ensureReady().then(engine => {
      sendResponse({ state: engine?.exportState() });
    });
    return true;
  }
});

async function handleInitStream(streamId, tabId, sendResponse) {
  try {
    await initAudioContext();

    // Close any previous stream cleanly
    if (activeMediaStream) {
      const dummyAudio = document.getElementById('dummyKeepaliveAudio');
      if (dummyAudio) dummyAudio.srcObject = null;
      activeMediaStream.getTracks().forEach(track => {
        try {
          track.onended = null;
          track.stop();
        } catch (e) {}
      });
      activeMediaStream = null;
      window._activeMediaStream = null;
    }

    if (currentSourceNode) {
      try { currentSourceNode.disconnect(); } catch (e) {}
      currentSourceNode = null;
      window._currentSourceNode = null;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: false
    });

    activeMediaStream = stream;
    window._activeMediaStream = stream;
    activeTabId = tabId;

    // Anchor to dummy audio element to prevent Chromium GC stream dropping
    const dummyAudio = document.getElementById('dummyKeepaliveAudio');
    if (dummyAudio) {
      dummyAudio.srcObject = stream;
      dummyAudio.play().catch(() => {});
    }

    currentSourceNode = audioCtx.createMediaStreamSource(stream);
    window._currentSourceNode = currentSourceNode;
    currentSourceNode.connect(dspEngine.masterInput);

    // Apply stored user settings immediately to the active stream
    await restoreSavedSettings();

    // Resume AudioContext if suspended
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    // When the stream ends (e.g. user closes captured tab, navigates away)
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.onended = () => {
        if (activeMediaStream === stream) {
          console.log('[SoundSmith Offscreen] Captured tab audio track ended.');
          handleStopStream();
        }
      };
    }

    console.log('[SoundSmith Offscreen] Stream successfully attached to DSP graph for tab:', tabId);
    sendResponse({ success: true, active: true, tabId });
  } catch (err) {
    console.error('[SoundSmith Offscreen] Failed to attach stream:', err);
    sendResponse({ success: false, active: false, error: err.message });
  }
}

function handleStopStream(sendResponse) {
  try {
    const dummyAudio = document.getElementById('dummyKeepaliveAudio');
    if (dummyAudio) {
      dummyAudio.srcObject = null;
    }
    if (activeMediaStream) {
      activeMediaStream.getTracks().forEach(track => {
        try {
          track.onended = null;
          track.stop();
        } catch (e) {}
      });
      activeMediaStream = null;
      window._activeMediaStream = null;
    }
    if (currentSourceNode) {
      try { currentSourceNode.disconnect(); } catch (e) {}
      currentSourceNode = null;
      window._currentSourceNode = null;
    }
    activeTabId = null;
    console.log('[SoundSmith Offscreen] Tab audio capture stopped, tab audio restored.');
    if (sendResponse) sendResponse({ success: true, active: false });
  } catch (err) {
    console.error('[SoundSmith Offscreen] Error in handleStopStream:', err);
    if (sendResponse) sendResponse({ success: false, active: false, error: err.message });
  }
}
