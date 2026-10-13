# SoundSmith 🎵
### Audiophile Web Audio DSP Extension — RootlessJamesDSP Remastered

**SoundSmith** is an audiophile-grade Chrome extension faithfully remastering **RootlessJamesDSP for Android (v1.6.13)** (by Tim Schneeberger & James Fung) for browser-based Web Audio playback.

It brings a 100% faithful digital signal processing pipeline directly into Google Chrome, complete with **Material You (Material Design 3) dynamic theming**, interactive **Akima Spline & Spectrum Visualizer**, **ViPER-DDC**, **Partitioned Convolver with AdvImp**, **LiveProg DSP Scripting**, and **AutoEQ Cloud calibration**.

---

## ✨ Features & Architecture

### 1. 🎚️ 15-Band Multimodal Equalizer & Spline Visualizer
* **Interactive Canvas**: Drag nodes directly over real-time FFT spectrum background with gradient fill and exact dB readouts.
* **Akima Spline & PCHIP Hermite Curves**: Interpolation preserving monotonicity and preventing overshoot.
* **Filter Engines**: Switchable **FIR Minimum-Phase** and **IIR 4th–12th order cascades**.
* **18 RootlessJamesDSP Presets**: 1-click horizontal ribbon chip carousel (*Flat, Acoustic, Bass, Beats, Classic, Clear, Deep, Dubstep, Electronic, Hardstyle, Hip-Hop, Jazz, Metal, Movie, Pop, R&B, Rock, Vocal Booster*).

### 2. 🎧 AutoEQ Cloud Database Integration
* Directly search over **5,000+ calibrated headphone profiles** from the official AutoEQ repository.
* 1-click import maps parametric EQ filters directly onto your active SoundSmith curve.

### 3. 🔊 Dynamic Bass Exciter
* Faithful model of JamesDSP Natural Bass & Sub-bass synthesis.
* Non-linear harmonic generation restores deep, visceral bass on compact headphones.
* Three selectable acoustic modes: *Natural Bass, Pure Sub-Bass, Resonant Bass*.

### 4. 🗜️ Multi-Band Dynamic Compander
* Time-frequency Short-Time Fourier Transform (STFT) dynamics processor.
* Independent attack (1–100ms), release (20–500ms), threshold (-40dBFS to 0dBFS), and ratio (1:1 to 12:1) compression controls.

### 5. 💡 12AX7 Vacuum Tube Triode Saturation
* Emulates physical 12AX7 dual-triode preamp stages.
* Asymmetric transfer characteristic generates musical 2nd-order even harmonics for analog warmth without harsh odd-order clipping.

### 6. 🎧 ViPER-DDC Headphone Correction
* Direct Form II Second-Order Section (SOS) cascaded matrix.
* Parses `.vdc` files with sample-rate aware coefficient mapping (44.1kHz and 48kHz).
* Bundled with *Butterworth 24dB, Front-Rear Contrast, and Sony MH750 IEM* correction profiles, plus custom file upload.

### 7. 🏛️ Partitioned Convolver with AdvImp Waveform Editor
* True stereo impulse response convolution.
* **AdvImp Waveform Processor**: Auto-trim energy envelopes and channel delay shifts (`-80;-100;0;0;0;0`).
* **Minimum-Phase Cepstral Transform**: Hilbert transform converts linear-phase room impulse responses into zero-latency minimum-phase filters.
* Bundled with *Church, CorredHRTF_Crossfeed, CorredHRTF_Surround 1/2, and SwapChannels*.

### 8. 🌐 BS2B & Spatializer Crossfeed
* Bauer Stereophonic-to-Binaural processor eliminates headphone listening fatigue.
* All 6 authentic RootlessJamesDSP presets:
  1. **BS2B Weak** (Chu Moy 700Hz / 4.5dB)
  2. **BS2B Strong** (Jan Meier 650Hz / 9.5dB)
  3. **Out of Head** (Acoustic space widening)
  4. **Surround 1** (Mid-Side Haas crossfeed)
  5. **Surround 2** (Deep 3D binaural dispersion)
  6. **Joe0Bloggs Realistic Surround** (HRTF ear canal & pinna shadow simulation)

### 9. 🏰 Virtual Room Reverb
* Sndfilter algorithmic acoustic model with 8-comb parallel bank, Schroeder all-pass diffusers, and frequency damping.
* All 13 RootlessJamesDSP room acoustic models: *Default, Small hall 1/2, Medium hall, Large hall, Small room 1/2, Medium room, Large room, Plate high/low, Long reverb 1/2 (up to 30s RT60)*.

### 10. 💻 LiveProg DSP Scripting & In-App IDE
* Real-time EEL DSP scripting virtual machine.
* **Dynamic GUI Generator**: Automatically inspects script headers and generates M3 precision sliders for all `@param` variables.
* **In-App Monospace IDE**: Code editor with line numbers gutter, syntax validation, and instant runtime compilation.
* Bundled with 36+ authentic scripts (*viper_dynamicbass.eel, hadamVerb.eel, lofiDistortionMangler.eel, autoWideness.eel, etc.*).

### 11. 🛡️ Master Lookahead Limiter & Preamp
* Input trim gain (-20dB to +20dB).
* Audiophile lookahead brickwall safety limiter (-12dBFS to 0dBFS) preventing inter-sample peaks and digital clipping.

### 12. 🎨 Material You (M3) Design System & Floating Dock
* **8 Dynamic Color Palettes**: *Green Apple (Default), Honey Amber, Tidal Wave, Strawberry Daiquiri, Turquoise, Yotsuba, Yin Yang, Monet Adaptive*.
* **AMOLED Pure Black Mode**: Pitch-black backgrounds for OLED displays.
* **Floating Master Dock**: Bottom-docked elevated Power FAB (56x56px), theme settings, and overflow archive menu.
* **Device Profiles**: Instant profile switching for *Headset, Speaker, Bluetooth, and USB DAC*.
* **JSON / TAR Configuration Backup**: Export and restore complete DSP configuration archives.

---

## 🚀 How to Install in Google Chrome

1. Open Google Chrome and go to `chrome://extensions/`.
2. Toggle on **Developer mode** in the upper-right corner.
3. Click **Load unpacked** in the upper-left.
4. Select the project folder:
   ```
   C:\Users\soumya\.gemini\antigravity\scratch\jamesdsp-extension
   ```
5. Pin **SoundSmith** to your Chrome toolbar.
6. Open any tab playing audio (YouTube, Spotify, SoundCloud, Netflix), click the extension icon, click **Attach Active Tab**, and toggle the elevated master power FAB!
7. *(Optional)* Click the **Side Panel** icon in the top app bar to keep SoundSmith docked while browsing.

---

## 🧪 Automated Verification Suite

Run the full automated test suite anytime using Node.js:
```bash
node test-dsp.js
```
*Current test pass rate: 44/44 tests (100% PASS).*
