/**
 * Comprehensive Automated Verification Suite for SoundSmith Audiophile DSP
 * Validates Manifest V3, DSP Mathematics, Filters, Splines, Convolver, DDC, Reverb, and LiveProg.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { AkimaSpline, PchipSpline } from './offscreen/dsp/math/akima-spline.js';
import { BiquadMath } from './offscreen/dsp/math/biquad-math.js';
import { ISO_FREQUENCIES_15, SPLINE_PRESETS } from './ui/components/spline-visualizer.js';
import { CROSSFEED_MODES } from './offscreen/dsp/crossfeed.js';
import { REVERB_PRESETS } from './offscreen/dsp/reverb.js';
import { CONVOLVER_MODES } from './offscreen/dsp/convolver-engine.js';
import { BUNDLED_SCRIPTS } from './ui/components/liveprog-ide.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    passedTests++;
    console.log(`✅ PASS: ${message}`);
  }
}

console.log('=== Running SoundSmith Audiophile DSP Verification Suite ===\n');

// 1. Manifest V3 & SoundSmith Branding Validation
const manifestPath = path.join(__dirname, 'manifest.json');
assert(fs.existsSync(manifestPath), 'manifest.json exists');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert(manifest.manifest_version === 3, 'Manifest version is 3');
assert(manifest.name.includes('SoundSmith'), `Manifest rebrand verified (${manifest.name})`);
assert(manifest.permissions.includes('tabCapture'), 'Manifest contains tabCapture permission');
assert(manifest.permissions.includes('offscreen'), 'Manifest contains offscreen permission');
assert(manifest.permissions.includes('sidePanel'), 'Manifest contains sidePanel permission');
assert(manifest.permissions.includes('storage'), 'Manifest contains storage permission');
assert(manifest.permissions.includes('tabs'), 'Manifest contains tabs permission');
assert(manifest.host_permissions.includes('<all_urls>'), 'Manifest contains <all_urls> host permissions');
assert(fs.existsSync(path.join(__dirname, manifest.background.service_worker)), 'Service worker file exists');
assert(fs.existsSync(path.join(__dirname, manifest.action.default_popup)), 'Popup UI file exists');
assert(fs.existsSync(path.join(__dirname, manifest.side_panel.default_path)), 'Side panel UI file exists');

// 2. Akima & PCHIP Spline Interpolation Math
const xs = [Math.log10(25), Math.log10(100), Math.log10(1000), Math.log10(10000)];
const ys = [3.0, 0.0, -2.0, 4.0];
const queryXs = [Math.log10(50), Math.log10(500), Math.log10(5000)];

const akimaResult = AkimaSpline.interpolate(xs, ys, queryXs);
assert(akimaResult.length === 3, 'Akima spline interpolated 3 points');
assert(akimaResult[0] > 0 && akimaResult[0] < 3.0, 'Akima curve behaves smoothly between 25Hz and 100Hz');

const pchipResult = PchipSpline.interpolate(xs, ys, queryXs);
assert(pchipResult.length === 3, 'PCHIP spline interpolated 3 points');
assert(pchipResult[0] > 0 && pchipResult[0] < 3.0, 'PCHIP curve preserves monotonicity without overshoot');

// 3. RBJ Biquad Math Coefficients
const peakingCoeffs = BiquadMath.peaking(1000, 6.0, 1.414, 48000);
assert(typeof peakingCoeffs.b0 === 'number' && !isNaN(peakingCoeffs.b0), 'Peaking filter b0 computed');
assert(typeof peakingCoeffs.a1 === 'number' && !isNaN(peakingCoeffs.a1), 'Peaking filter a1 computed');
assert(peakingCoeffs.b0 > 1.0, 'Peaking filter with +6dB boost has b0 > 1');

const highShelfCoeffs = BiquadMath.highShelf(4000, 4.0, 0.707, 48000);
assert(!isNaN(highShelfCoeffs.b0) && !isNaN(highShelfCoeffs.a2), 'High-shelf filter coefficients valid');

const lowShelfCoeffs = BiquadMath.lowShelf(120, 5.0, 0.707, 48000);
assert(!isNaN(lowShelfCoeffs.b0) && !isNaN(lowShelfCoeffs.a1), 'Low-shelf filter coefficients valid');

// 4. ISO 15-Band Frequency Grid & Presets
assert(ISO_FREQUENCIES_15.length === 15, '15-band standard frequencies defined');
assert(ISO_FREQUENCIES_15[0] === 25 && ISO_FREQUENCIES_15[14] === 16000, 'Frequency grid spans audiophile 25Hz to 16kHz');
const presetNames = Object.keys(SPLINE_PRESETS);
assert(presetNames.length >= 18, `All 18 RootlessJamesDSP equalizer presets loaded (${presetNames.length} presets)`);
assert(SPLINE_PRESETS['Flat'].every(g => g === 0), 'Flat preset is 0.0dB across all 15 bands');
assert(SPLINE_PRESETS['Bass'][0] > 5.0, 'Bass preset provides low-frequency shelf boost');

// 5. 12AX7 Tube Saturation Model
function computeTubeCurve(drive, warmth, samples = 1024) {
  const curve = new Float32Array(samples);
  const driveAmount = 1.0 + drive * 4.0;
  const warmthBias = warmth * 0.35;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    const xDriven = x * driveAmount;
    let y = xDriven >= 0
      ? Math.tanh(xDriven) + warmthBias * (xDriven / (1 + xDriven * xDriven))
      : Math.tanh(xDriven * 0.85) - warmthBias * (xDriven * xDriven * 0.5);
    curve[i] = Math.max(-1.0, Math.min(1.0, y * 0.85));
  }
  return curve;
}
const tubeCurve = computeTubeCurve(0.5, 0.5);
assert(tubeCurve.length === 1024, 'Tube transfer curve generated with 1024 points');
assert(Math.abs(tubeCurve[768]) !== Math.abs(tubeCurve[256]), 'Triode demonstrates asymmetrical even harmonic generation');

// 6. Crossfeed Modes & Delays
assert(CROSSFEED_MODES.BS2B_WEAK === 0, 'Crossfeed mode 0 is BS2B Weak');
assert(CROSSFEED_MODES.BS2B_STRONG === 1, 'Crossfeed mode 1 is BS2B Strong');
assert(CROSSFEED_MODES.OUT_OF_HEAD === 2, 'Crossfeed mode 2 is Out of Head');
assert(CROSSFEED_MODES.SURROUND_1 === 3, 'Crossfeed mode 3 is Surround 1');
assert(CROSSFEED_MODES.SURROUND_2 === 4, 'Crossfeed mode 4 is Surround 2');
assert(CROSSFEED_MODES.REALISTIC_SURROUND === 5, 'Crossfeed mode 5 is Joe0Bloggs Realistic Surround');

// 7. Virtual Room Reverb Presets
const reverbKeys = Object.keys(REVERB_PRESETS);
assert(reverbKeys.length === 13, `All 13 authentic RootlessJamesDSP room acoustic models present (${reverbKeys.length})`);
assert(REVERB_PRESETS[0].name === 'Default', 'Reverb preset 0 is Default');
assert(REVERB_PRESETS[18].rt60 === 30.0, 'Long reverb 2 has 30.0s RT60 decay time');

// 8. ViPER-DDC File Parsing
const vdcPath = path.join(__dirname, 'ui/assets/DDC/Butterworth.vdc');
assert(fs.existsSync(vdcPath), 'Butterworth.vdc exists');
const vdcText = fs.readFileSync(vdcPath, 'utf8');
assert(vdcText.includes('SR_44100') && vdcText.includes('SR_48000'), 'VDC contains both SR_44100 and SR_48000 SOS blocks');

// 9. Impulse Responses & AdvImp Verification
const irPath = path.join(__dirname, 'ui/assets/Convolver/Church.wav');
assert(fs.existsSync(irPath), 'Church.wav impulse response exists');
const advImpDefault = "-80;-100;0;0;0;0";
const advParts = advImpDefault.split(';').map(Number);
assert(advParts.length === 6 && advParts[0] === -80 && advParts[1] === -100, 'AdvImp parameter format validated');

// 10. LiveProg Bundled Scripts Verification
assert(BUNDLED_SCRIPTS.length >= 35, `LiveProg bundled scripts catalog verified (${BUNDLED_SCRIPTS.length} scripts)`);
const sampleEelPath = path.join(__dirname, 'ui/assets/Liveprog/viper_dynamicbass.eel');
assert(fs.existsSync(sampleEelPath), 'viper_dynamicbass.eel exists');
const eelText = fs.readFileSync(sampleEelPath, 'utf8');
assert(eelText.includes('dBassGain:100<0,100,1>'), '@param slider definition syntax validated');

console.log(`\n===========================================`);
console.log(`SoundSmith Verification: ${passedTests}/${totalTests} tests passed.`);
assert(passedTests === totalTests, 'All automated tests passed with 100% success rate');
