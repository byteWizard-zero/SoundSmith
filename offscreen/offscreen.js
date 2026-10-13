/**
 * JamesDSP Offscreen Audio Controller
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
      latencyHint: 'interactive'
    });
    dspEngine = new DspEngine(audioCtx);
    console.log('[JamesDSP Offscreen] AudioContext and DSP Engine initialized.');
  }
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
}

// Restore saved settings on initial load or stream capture
async function restoreSavedSettings() {
  if (!dspEngine) return;
  try {
    const data = await chrome.storage.local.get('jamesdsp_state');
    if (data && data.jamesdsp_state) {
      dspEngine.applyPreset(data.jamesdsp_state);
      console.log('[JamesDSP Offscreen] Restored DSP state from storage.');
    }
  } catch (err) {
    console.warn('[JamesDSP Offscreen] Could not read storage:', err);
  }
}

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

  // DSP Commands from UI
  if (dspEngine) {
    if (message.action === 'DSP_SET_MASTER_POWER') {
      dspEngine.setMasterPower(message.enabled);
      sendResponse({ success: true });
      return false;
    }

    if (message.action === 'DSP_TOGGLE_MODULE') {
      dspEngine.toggleModule(message.module, message.enabled);
      sendResponse({ success: true });
      return false;
    }

    if (message.action === 'DSP_SET_PARAM') {
      dspEngine.setModuleParam(message.module, message.param, message.value);
      sendResponse({ success: true });
      return false;
    }

    if (message.action === 'DSP_APPLY_PRESET') {
      dspEngine.applyPreset(message.preset);
      sendResponse({ success: true });
      return false;
    }

    if (message.action === 'DSP_GET_FFT') {
      sendResponse({ data: dspEngine.getFrequencyData() });
      return false;
    }

    if (message.action === 'DSP_GET_RESPONSE') {
      sendResponse({ curve: dspEngine.getCombinedResponse(message.frequencies) });
      return false;
    }

    if (message.action === 'DSP_LOAD_IR_BUFFER') {
      dspEngine.convolver.loadImpulseResponseFromArrayBuffer(message.buffer, message.name)
        .then(result => sendResponse({ success: result }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (message.action === 'DSP_LOAD_DDC') {
      const ok = dspEngine.ddc.parseVdcString(message.vdcText, message.name);
      sendResponse({ success: ok });
      return false;
    }

    if (message.action === 'DSP_LOAD_LIVEPROG') {
      const res = dspEngine.liveprog.loadScript(message.scriptText, message.name);
      sendResponse(res);
      return false;
    }

    if (message.action === 'DSP_EXPORT_STATE') {
      sendResponse({ state: dspEngine.exportState() });
      return false;
    }
  }
});

async function handleInitStream(streamId, tabId, sendResponse) {
  try {
    await initAudioContext();

    // Close any previous stream
    if (activeMediaStream) {
      activeMediaStream.getTracks().forEach(track => track.stop());
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
    activeTabId = tabId;

    if (currentSourceNode) {
      currentSourceNode.disconnect();
    }

    currentSourceNode = audioCtx.createMediaStreamSource(stream);
    currentSourceNode.connect(dspEngine.masterInput);

    // Apply stored user settings immediately to the active stream
    await restoreSavedSettings();

    // When the stream ends (e.g. user closes tab or navigates away)
    stream.getAudioTracks()[0].onended = () => {
      console.log('[JamesDSP Offscreen] Tab audio capture ended.');
      activeMediaStream = null;
      activeTabId = null;
    };

    console.log('[JamesDSP Offscreen] Stream successfully attached to DSP graph for tab:', tabId);
    sendResponse({ success: true, tabId });
  } catch (err) {
    console.error('[JamesDSP Offscreen] Failed to attach stream:', err);
    sendResponse({ success: false, error: err.message });
  }
}

function handleStopStream(sendResponse) {
  if (activeMediaStream) {
    activeMediaStream.getTracks().forEach(track => track.stop());
    activeMediaStream = null;
  }
  if (currentSourceNode) {
    currentSourceNode.disconnect();
    currentSourceNode = null;
  }
  activeTabId = null;
  sendResponse({ success: true });
}
