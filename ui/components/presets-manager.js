/**
 * Presets Manager for JamesDSP
 * Bundles audiophile tuning configurations and supports JSON import/export.
 */

export const BUILT_IN_PRESETS = {
  'flat': {
    name: 'Studio Reference (Flat)',
    description: 'Completely uncolored, accurate reference monitoring',
    equalizer: { enabled: true, gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    dynamicBass: { enabled: false },
    tubeSaturation: { enabled: false },
    crossfeed: { enabled: false },
    stereoWiden: { enabled: false },
    reverb: { enabled: false },
    limiter: { preamp: 0.0 }
  },
  'bass_impact': {
    name: 'Deep Bass Impact',
    description: 'Sub-bass extension and dynamic punch without flab',
    equalizer: { enabled: true, gains: [6.0, 5.5, 3.0, 0.5, 0.0, 0.0, 1.0, 1.5, 2.0, 2.5] },
    dynamicBass: { enabled: true, gain: 8.0, cutoff: 105, harmonics: 0.6 },
    tubeSaturation: { enabled: false },
    crossfeed: { enabled: false },
    stereoWiden: { enabled: false },
    reverb: { enabled: false },
    limiter: { preamp: -1.5 }
  },
  'tube_warmth': {
    name: '12AX7 Tube Warmth',
    description: 'Analog triode harmonic warmth and headphone crossfeed',
    equalizer: { enabled: true, gains: [2.0, 2.0, 1.0, 0.5, 0.0, 0.5, 1.0, 0.5, -0.5, -1.0] },
    dynamicBass: { enabled: false },
    tubeSaturation: { enabled: true, drive: 0.45, warmth: 0.75 },
    crossfeed: { enabled: true, preset: 'chumoy' },
    stereoWiden: { enabled: false },
    reverb: { enabled: false },
    limiter: { preamp: -1.0 }
  },
  'vocal_clarity': {
    name: 'Vocal Clarity & Presence',
    description: 'Clears muddiness and pushes lead vocals forward',
    equalizer: { enabled: true, gains: [-1.5, -1.0, -1.5, 0.0, 1.5, 3.5, 2.5, 1.5, 2.0, 1.0] },
    dynamicBass: { enabled: false },
    tubeSaturation: { enabled: false },
    crossfeed: { enabled: false },
    stereoWiden: { enabled: true, width: 1.3 },
    reverb: { enabled: false },
    limiter: { preamp: 0.0 }
  },
  'binaural_cinema': {
    name: 'Immersive Binaural Cinema',
    description: 'Expanded acoustic stage with natural room spatialization',
    equalizer: { enabled: true, gains: [4.0, 3.0, 1.0, 0.0, -0.5, 0.5, 1.5, 2.5, 3.0, 3.5] },
    dynamicBass: { enabled: true, gain: 5.0, cutoff: 90, harmonics: 0.4 },
    tubeSaturation: { enabled: false },
    crossfeed: { enabled: true, preset: 'meier' },
    stereoWiden: { enabled: true, width: 1.6 },
    reverb: { enabled: true, roomSize: 0.55, damping: 5000, wet: 0.25 },
    limiter: { preamp: -2.0 }
  },
  'edm_vshape': {
    name: 'Electronic / EDM V-Shape',
    description: 'Deep thumping low-end and crystal highs',
    equalizer: { enabled: true, gains: [7.0, 6.0, 3.0, -0.5, -2.0, -1.5, 0.5, 3.0, 5.0, 6.5] },
    dynamicBass: { enabled: true, gain: 7.0, cutoff: 110, harmonics: 0.5 },
    tubeSaturation: { enabled: true, drive: 0.25, warmth: 0.4 },
    crossfeed: { enabled: false },
    stereoWiden: { enabled: true, width: 1.4 },
    reverb: { enabled: false },
    limiter: { preamp: -2.5 }
  },
  'anti_fatigue': {
    name: 'Anti-Fatigue Night Mode',
    description: 'Softened highs and BS2B crossfeed for long sessions',
    equalizer: { enabled: true, gains: [1.5, 1.5, 1.0, 0.5, 0.0, 0.0, -1.0, -2.5, -4.0, -5.0] },
    dynamicBass: { enabled: false },
    tubeSaturation: { enabled: false },
    crossfeed: { enabled: true, preset: 'chumoy' },
    stereoWiden: { enabled: false },
    reverb: { enabled: false },
    limiter: { preamp: -1.0 }
  }
};

export class PresetsManager {
  static exportPreset(state, filename = 'jamesdsp-preset.json') {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  static async importPresetFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          resolve(parsed);
        } catch (err) {
          reject(new Error('Invalid preset file format.'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsText(file);
    });
  }
}
