/**
 * SoundSmith In-App LiveProg IDE
 * Monospace code editor with line numbers gutter, syntax validation,
 * script preset switcher, and instant runtime compilation.
 */

export const BUNDLED_SCRIPTS = [
  'viper_dynamicbass.eel',
  '3bandSplitting.eel',
  '8bandSplitting.eel',
  'audioGlitchGenerator.eel',
  'autopeakfilter.eel',
  'autoWideness.eel',
  'butterworth3Band.eel',
  'butterworth8Band.eel',
  'dc_remove.eel',
  'decimate.eel',
  'delayChorus.eel',
  'depthsurround.eel',
  'downmixer.eel',
  'firFilter.eel',
  'firlsProc.eel',
  'fractionalDelayline.eel',
  'gainControl.eel',
  'hadamVerb.eel',
  'highpass.eel',
  'Joe0Bloggs DRX10K compander-HR.eel',
  'lofiDistortionMangler.eel',
  'lowpass.eel',
  'metallic-reverb.eel',
  'msCentreBoost.eel',
  'phaseshifter.eel',
  'pitchDownshift.eel',
  'polyphaseFilterbank.eel',
  'polyphaseFilterbankEqualization.eel',
  'stereoFieldManipulator.eel',
  'stereoPhaseInvert.eel',
  'stereowide.eel',
  'stftCentreBoost.eel',
  'stftCentreCut.eel',
  'stftFilter.eel',
  'swapChannels.eel',
  'timeAdjustment.eel'
];

export class LiveprogIde {
  constructor(containerElement, onSaveScript) {
    this.container = containerElement;
    this.onSaveScript = onSaveScript; // callback(scriptName, code)
    this.currentScriptName = 'viper_dynamicbass.eel';
    this.currentCode = '';
  }

  render() {
    this.container.innerHTML = `
      <div class="liveprog-ide-wrapper" style="display: flex; flex-direction: column; height: 100%; gap: 12px;">
        <!-- IDE Toolbar -->
        <div class="ide-toolbar" style="display: flex; gap: 8px; align-items: center; justify-content: space-between;">
          <div style="display: flex; gap: 8px; align-items: center; flex: 1;">
            <select id="ide-script-select" class="m3-select" style="background: var(--md-sys-color-surface-container); color: var(--md-sys-color-on-surface); border: 1px solid var(--md-sys-color-outline-variant); border-radius: 8px; padding: 6px 12px; font-size: 13px; max-width: 260px;">
              ${BUNDLED_SCRIPTS.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
            <span id="ide-status-pill" style="font-size: 11px; padding: 3px 8px; border-radius: 6px; background: var(--md-sys-color-surface-variant); color: var(--md-sys-color-on-surface-variant);">Ready</span>
          </div>
          <button id="btn-ide-compile" class="m3-button primary" style="padding: 6px 16px; font-size: 13px; border-radius: 18px; background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); border: none; cursor: pointer; font-weight: 500;">
            Apply Script
          </button>
        </div>

        <!-- Editor Box with Line Numbers -->
        <div class="ide-editor-container" style="display: flex; flex: 1; border: 1px solid var(--md-sys-color-outline-variant); border-radius: 12px; overflow: hidden; background: #121411;">
          <div id="ide-line-numbers" style="width: 44px; padding: 12px 6px; text-align: right; color: #586054; font-family: 'Roboto Mono', monospace; font-size: 12px; line-height: 20px; user-select: none; background: #0c0e0b; border-right: 1px solid #232720;">
            1
          </div>
          <textarea id="ide-code-textarea" spellcheck="false" style="flex: 1; border: none; outline: none; background: transparent; color: #e1e3de; font-family: 'Roboto Mono', monospace; font-size: 12px; line-height: 20px; padding: 12px; resize: none; tab-size: 2; white-space: pre; overflow-x: auto;"></textarea>
        </div>
      </div>
    `;

    this._bindEvents();
    this.loadScriptByName(this.currentScriptName);
  }

  _bindEvents() {
    const select = this.container.querySelector('#ide-script-select');
    const textarea = this.container.querySelector('#ide-code-textarea');
    const lineNumbers = this.container.querySelector('#ide-line-numbers');
    const compileBtn = this.container.querySelector('#btn-ide-compile');
    const statusPill = this.container.querySelector('#ide-status-pill');

    // Sync line numbers on edit & scroll
    const updateLineNumbers = () => {
      const lineCount = textarea.value.split('\n').length;
      let nums = '';
      for (let i = 1; i <= lineCount; i++) {
        nums += i + '\n';
      }
      lineNumbers.textContent = nums;
    };

    textarea.addEventListener('input', updateLineNumbers);
    textarea.addEventListener('scroll', () => {
      lineNumbers.scrollTop = textarea.scrollTop;
    });

    // Tab key support
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        updateLineNumbers();
      }
    });

    // Script change
    select.addEventListener('change', (e) => {
      this.loadScriptByName(e.target.value);
    });

    // Compile button
    compileBtn.addEventListener('click', () => {
      this.currentCode = textarea.value;
      if (this.onSaveScript) {
        const res = this.onSaveScript(this.currentScriptName, this.currentCode);
        if (res && res.error) {
          statusPill.textContent = 'Syntax Error';
          statusPill.style.background = 'var(--md-sys-color-error-container)';
          statusPill.style.color = 'var(--md-sys-color-on-error-container)';
        } else {
          statusPill.textContent = 'Compiled & Active';
          statusPill.style.background = 'var(--md-sys-color-primary-container)';
          statusPill.style.color = 'var(--md-sys-color-on-primary-container)';
        }
      }
    });
  }

  async loadScriptByName(name) {
    this.currentScriptName = name;
    const textarea = this.container.querySelector('#ide-code-textarea');
    const lineNumbers = this.container.querySelector('#ide-line-numbers');
    const statusPill = this.container.querySelector('#ide-status-pill');

    try {
      const url = chrome.runtime.getURL(`ui/assets/Liveprog/${name}`);
      const res = await fetch(url);
      const text = await res.text();
      this.currentCode = text;
      textarea.value = text;

      // Update line numbers
      const lineCount = text.split('\n').length;
      let nums = '';
      for (let i = 1; i <= lineCount; i++) {
        nums += i + '\n';
      }
      lineNumbers.textContent = nums;

      statusPill.textContent = 'Loaded';
      statusPill.style.background = 'var(--md-sys-color-surface-variant)';
      statusPill.style.color = 'var(--md-sys-color-on-surface-variant)';
    } catch (err) {
      console.warn('Could not load bundled script:', err);
    }
  }
}
