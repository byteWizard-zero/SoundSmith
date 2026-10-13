# JamesDSP for Chrome 🎵

A high-fidelity web audio digital signal processing extension inspired by **RootlessJamesDSP for Android**, styled with a **Material You (Material Design 3)** interface.

Brings professional-grade audio equalization, tube emulation, crossfeed, and acoustic modeling directly to your browser (YouTube, Spotify Web, SoundCloud, Bandcamp, Netflix, Twitch).

---

## ✨ Features

* **🎨 Material You (M3) Interface**:
  * Tonal surfaces, responsive pill switches, fluid sliders, and card accordions.
  * **Dual-Layer Canvas Visualizer**: Combines a logarithmic spline EQ response curve with a live 60fps FFT audio spectrum analyzer.
  * **Chrome Side Panel Support**: Pin JamesDSP to the right of your browser while enjoying music or videos without the popup closing!
* **🎚️ Equalizer**:
  * Switchable **10-Band** and **15-Band** graphic equalizer.
  * Interactive dB sliders with instant zero-flat reset.
* **🎧 AutoEQ Database Browser**:
  * Built-in calibrated Harman Target compensation profiles for 18+ popular audiophile headphones (Sennheiser HD 600/650/560S, Sony WH-1000XM4/XM5, Apple AirPods Pro 2 / Max, Beyerdynamic DT 770/990, Moondrop IEMs, Hifiman Planars).
  * 1-click apply to your active EQ.
* **💡 Vacuum Tube Modeling (12AX7)**:
  * Emulates classic dual-triode tube transfer characteristics.
  * Asymmetric saturation producing warm, musical 2nd-order even harmonics.
  * 4x oversampling to eliminate digital aliasing.
* **🔊 Dynamic Bass Boost**:
  * Low-frequency extraction with non-linear harmonic synthesis (audible sub-bass on headphones).
  * Dynamic compressor to prevent muddy bass blowout.
* **🎧 BS2B Binaural Crossfeed**:
  * Bauer Stereophonic-to-Binaural processor.
  * Eliminates harsh stereo headphone fatigue by modeling acoustic cross-bleed and head shadow.
  * Chu Moy (700Hz/4.5dB) and Jan Meier (650Hz/9.5dB) modes.
* **🌐 Stereo Soundstage Widener**:
  * Mid/Side (M/S) matrix expander to open up the soundstage without losing vocal presence.
* **🏛️ Virtual Room Reverb & Convolver**:
  * Algorithmic room acoustic simulation with decay and damping controls.
  * FIR Convolver engine supporting custom `.wav` and `.irs` impulse response files.
* **🛡️ Master Preamp & Safety Limiter**:
  * Preamp gain trim (-12dB to +12dB).
  * Transparent -0.5 dBFS brickwall peak limiter to protect ears and prevent digital clipping.
* **💾 Presets System**:
  * Bundled presets: *Studio Flat, Deep Bass Impact, 12AX7 Tube Warmth, Vocal Clarity, Immersive Cinema, EDM V-Shape, Anti-Fatigue*.
  * Export & Import custom presets in JSON format.

---

## 🚀 How to Load in Google Chrome

1. Open Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked** in the top-left.
4. Select the project folder:
   ```
   C:\Users\soumya\.gemini\antigravity\scratch\jamesdsp-extension
   ```
5. Pin **JamesDSP Audio Studio** to your Chrome toolbar.
6. Open any tab playing audio (e.g. YouTube, Spotify Web), click the extension icon, and click **PWR OFF** to activate!
7. *(Optional)* Click the **Side Panel** button in the top bar to dock JamesDSP alongside your tab.

---

## 🏗️ Architecture (Manifest V3)

```
[ Active Audio Tab ] ──► [ Service Worker (background.js) ]
                                   │
                                   ▼ (Stream ID delegation)
                         [ Offscreen Document (offscreen.html/.js) ]
                                   │
                                   ▼
                         [ Web Audio DSP Graph ]
    Source ──► Preamp ──► EQ ──► Bass ──► Convolver ──► Tube ──► Crossfeed ──► Widener ──► Reverb ──► Limiter ──► Destination
                                   ▲
                                   │ (Parameters & FFT data)
                         [ Material You UI (ui/index.html/.js) ]
```

---

## 🧪 Testing

Run the automated test suite verifying DSP mathematics, transfer curves, AutoEQ data, and Manifest V3 integrity:

```powershell
node test-dsp.js
```
