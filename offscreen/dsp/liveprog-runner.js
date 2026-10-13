/**
 * SoundSmith LiveProg EEL Runtime Engine
 * Compiles and evaluates Cockos EEL / JamesDSP LiveProg DSP scripts in real-time
 * using Web Audio ScriptProcessor / AudioWorklet execution.
 */

export class LiveProgRunner {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.enabled = false;
    this.scriptName = '';
    this.rawScript = '';
    
    // Extracted metadata and sliders
    this.description = '';
    this.author = '';
    this.tags = '';
    this.sliders = []; // [{ id, default, min, max, step, label, value }]
    this.variables = {}; // variable values

    // Node graph
    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();
    this.bypassNode = this.ctx.createGain();
    
    // Processor node (512-sample buffer for low latency real-time EEL processing)
    this.bufferSize = 512;
    this.procNode = this.ctx.createScriptProcessor(this.bufferSize, 2, 2);

    // Compiled JS functions
    this.initFn = null;
    this.sampleFn = null;
    this.memory = new Float64Array(65536); // Shared EEL memory space

    this._buildGraph();
    this.updateBypassState();
  }

  _buildGraph() {
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);

    this.inputNode.connect(this.procNode);
    this.procNode.connect(this.outputNode);

    // Real-time audio callback
    this.procNode.onaudioprocess = (e) => {
      if (!this.enabled || !this.sampleFn) return;

      const inputL = e.inputBuffer.getChannelData(0);
      const inputR = e.inputBuffer.getChannelData(1);
      const outputL = e.outputBuffer.getChannelData(0);
      const outputR = e.outputBuffer.getChannelData(1);
      const len = inputL.length;

      try {
        for (let i = 0; i < len; i++) {
          const res = this.sampleFn(inputL[i], inputR[i]);
          outputL[i] = res[0];
          outputR[i] = res[1];
        }
      } catch (err) {
        // Fallback to passthrough on runtime error
        outputL.set(inputL);
        outputR.set(inputR);
      }
    };
  }

  /**
   * Parse EEL headers, extract sliders, and compile script
   */
  loadScript(scriptText, scriptName = 'custom.eel') {
    this.rawScript = scriptText;
    this.scriptName = scriptName;
    this.sliders = [];
    this.variables = {};

    const lines = scriptText.split('\n');
    let initCode = '';
    let sampleCode = '';
    let section = 'header'; // 'header', 'init', 'sample'

    // Slider regex: varName:default<min,max,step>Label
    const sliderRegex = /^([a-zA-Z0-9_]+)\s*:\s*([-0-9.]+)\s*<\s*([-0-9.]+)\s*,\s*([-0-9.]+)\s*,\s*([-0-9.]+)\s*>\s*(.*)$/;

    for (let rawLine of lines) {
      const line = rawLine.trim();

      if (line.startsWith('desc:')) {
        this.description = line.substring(5).trim();
        continue;
      }
      if (line.startsWith('author:')) {
        this.author = line.substring(7).trim();
        continue;
      }
      if (line.startsWith('tags:')) {
        this.tags = line.substring(5).trim();
        continue;
      }
      if (line === '@init') {
        section = 'init';
        continue;
      }
      if (line === '@sample') {
        section = 'sample';
        continue;
      }

      if (section === 'header') {
        const m = line.match(sliderRegex);
        if (m) {
          const id = m[1];
          const defVal = parseFloat(m[2]);
          const min = parseFloat(m[3]);
          const max = parseFloat(m[4]);
          const step = parseFloat(m[5]);
          const label = m[6].trim() || id;

          this.sliders.push({ id, default: defVal, min, max, step, label, value: defVal });
          this.variables[id] = defVal;
        }
      } else if (section === 'init') {
        initCode += rawLine + '\n';
      } else if (section === 'sample') {
        sampleCode += rawLine + '\n';
      }
    }

    return this._compile(initCode, sampleCode);
  }

  setSliderValue(id, value) {
    const sl = this.sliders.find(s => s.id === id);
    if (sl) {
      sl.value = parseFloat(value);
      this.variables[id] = sl.value;
      if (this.scope) {
        this.scope[id] = sl.value;
      }
    }
  }

  /**
   * Compiles EEL into high-performance JS execution functions
   */
  _compile(initCode, sampleCode) {
    try {
      this.memory.fill(0);
      const srate = this.ctx.sampleRate;

      // Transpile EEL syntax to valid JS
      const jsInit = this._transpileEelToJs(initCode);
      const jsSample = this._transpileEelToJs(sampleCode);

      // Construct Execution Scope
      const scope = {
        srate,
        $PI: Math.PI,
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        sqrt: Math.sqrt,
        exp: Math.exp,
        log: Math.log,
        pow: Math.pow,
        abs: Math.abs,
        min: Math.min,
        max: Math.max,
        floor: Math.floor,
        ceil: Math.ceil,
        mem: this.memory,
        ...this.variables
      };
      this.scope = scope;

      // Compile Init
      const initFunction = new Function('scope', `
        with(scope) {
          ${jsInit}
        }
      `);
      initFunction(scope);

      // Compile Sample
      const sampleFunction = new Function('scope', 'spl0', 'spl1', `
        with(scope) {
          ${jsSample}
          return [spl0, spl1];
        }
      `);

      this.sampleFn = (l, r) => sampleFunction(scope, l, r);
      return { success: true, sliders: this.sliders };
    } catch (err) {
      console.error('LiveProg compilation error:', err);
      return { success: false, error: err.message };
    }
  }

  _transpileEelToJs(code) {
    if (!code) return '';

    let js = code;

    // Comments //
    // Replace $PI with Math.PI
    js = js.replace(/\$PI/g, 'Math.PI');

    // Float literals like 1.f or 2.0f -> 1.0, 2.0
    js = js.replace(/([0-9]+(?:\.[0-9]*)?)[fF]\b/g, '$1');

    // Simple EEL function declarations: function name(args) ( body )
    // -> function name(args) { body }
    js = js.replace(/function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*\(([\s\S]*?)\)/g, (match, name, args, body) => {
      // Convert space-separated or comma args
      const cleanArgs = args.trim().replace(/\s+/g, ', ');
      return `function ${name}(${cleanArgs}) { ${body}; }`;
    });

    // Replace basic EEL array access mem[x]
    return js;
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.updateBypassState();
  }

  updateBypassState() {
    const t = this.ctx.currentTime;
    if (this.enabled) {
      this.bypassNode.gain.setTargetAtTime(0, t, 0.02);
      this.procNode.connect(this.outputNode);
    } else {
      this.bypassNode.gain.setTargetAtTime(1, t, 0.02);
    }
  }
}
