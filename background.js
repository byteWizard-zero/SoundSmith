/**
 * SoundSmith for Chrome - Background Service Worker
 * Manages tab audio capture, offscreen document lifecycle, and message routing.
 */

const OFFSCREEN_PATH = 'offscreen/offscreen.html';

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
  console.log('[SoundSmith] Extension installed and initialized.');
});

// Clean up capture when captured tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.runtime.sendMessage({ action: 'OFFSCREEN_STOP_STREAM', tabId }, () => {
    if (chrome.runtime.lastError) {} // Suppress
  });
});

/**
 * Ensures an offscreen document is running with proper AUDIO_PLAYBACK + USER_MEDIA permissions.
 */
async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_PATH);
  
  if (chrome.runtime.getContexts) {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl]
    });
    if (existingContexts.length > 0) {
      return;
    }
  }

  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['AUDIO_PLAYBACK', 'USER_MEDIA'],
      justification: 'Capture and process tab audio via Web Audio API'
    });
    console.log('[SoundSmith] Offscreen document created with AUDIO_PLAYBACK and USER_MEDIA.');
  } catch (err) {
    if (!err.message.includes('Only a single offscreen document may be created')) {
      console.error('[SoundSmith] Error creating offscreen document:', err);
      throw err;
    }
  }
}

/**
 * Handle incoming messages from UI or Offscreen
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'GET_CURRENT_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs && tabs[0] ? tabs[0] : null });
    });
    return true; // Async response
  }

  if (message.action === 'START_TAB_CAPTURE' || message.action === 'POPUP_START_CAPTURE') {
    handleStartCapture(message.tabId, sendResponse);
    return true; // Async response
  }

  if (message.action === 'STOP_TAB_CAPTURE' || message.action === 'POPUP_STOP_CAPTURE') {
    handleStopCapture(message.tabId, sendResponse);
    return true;
  }

  if (message.action === 'POPUP_TOGGLE_CAPTURE') {
    handleToggleCapture(message.tabId, sendResponse);
    return true;
  }

  if (message.action === 'GET_DSP_STATUS' || message.action === 'OFFSCREEN_GET_STATUS') {
    // Relay query to offscreen
    ensureOffscreenDocument().then(() => {
      chrome.runtime.sendMessage({ action: 'OFFSCREEN_GET_STATUS', tabId: message.tabId }, (response) => {
        sendResponse(response || { active: false });
      });
    }).catch(() => sendResponse({ active: false }));
    return true;
  }

  if (message.action === 'OPEN_SIDE_PANEL') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && chrome.sidePanel) {
        chrome.sidePanel.open({ windowId: tabs[0].windowId }).catch(console.error);
      }
    });
    sendResponse({ success: true });
    return false;
  }
});

async function handleToggleCapture(targetTabId, sendResponse) {
  try {
    await ensureOffscreenDocument();
    chrome.runtime.sendMessage({ action: 'OFFSCREEN_GET_STATUS' }, (status) => {
      if (status && status.active) {
        // Active -> Stop capture and release tab
        handleStopCapture(targetTabId, sendResponse);
      } else {
        // Inactive -> Start capture
        handleStartCapture(targetTabId, sendResponse);
      }
    });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

async function handleStartCapture(targetTabId, sendResponse) {
  try {
    await ensureOffscreenDocument();

    // Release any previous capture first so Chrome doesn't throw a conflict
    chrome.runtime.sendMessage({ action: 'OFFSCREEN_STOP_STREAM' }, () => {
      if (chrome.runtime.lastError) {} // Ignore

      // Small delay to let Chrome release previous stream
      setTimeout(() => {
        // Acquire streamId from chrome.tabCapture
        chrome.tabCapture.getMediaStreamId({ targetTabId }, (streamId) => {
          if (chrome.runtime.lastError || !streamId) {
            const errMsg = chrome.runtime.lastError?.message || 'Failed to capture tab audio.';
            console.error('[SoundSmith] Failed to getMediaStreamId:', errMsg);
            sendResponse({ success: false, active: false, error: errMsg });
            return;
          }

          // Forward streamId to offscreen document
          chrome.runtime.sendMessage({
            action: 'OFFSCREEN_INIT_STREAM',
            streamId,
            tabId: targetTabId
          }, (res) => {
            sendResponse(res || { success: true, active: true });
          });
        });
      }, 50);
    });
  } catch (err) {
    console.error('[SoundSmith] handleStartCapture error:', err);
    sendResponse({ success: false, active: false, error: err.message });
  }
}

async function handleStopCapture(targetTabId, sendResponse) {
  try {
    chrome.runtime.sendMessage({
      action: 'OFFSCREEN_STOP_STREAM',
      tabId: targetTabId
    }, (res) => {
      sendResponse(res || { success: true, active: false });
    });
  } catch (err) {
    sendResponse({ success: false, active: false, error: err.message });
  }
}
