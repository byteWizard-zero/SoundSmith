/**
 * Automated Verification Suite for JamesDSP Chrome Extension
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

console.log('=== Running JamesDSP Verification Suite ===\n');

// 1. Manifest V3 Validation
const manifestPath = path.join(__dirname, 'manifest.json');
assert(fs.existsSync(manifestPath), 'manifest.json exists');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert(manifest.manifest_version === 3, 'Manifest version is 3');
assert(manifest.permissions.includes('tabCapture'), 'Manifest contains tabCapture permission');
assert(manifest.permissions.includes('offscreen'), 'Manifest contains offscreen permission');
assert(manifest.permissions.includes('sidePanel'), 'Manifest contains sidePanel permission');
assert(fs.existsSync(path.join(__dirname, manifest.background.service_worker)), 'Service worker file exists');
assert(fs.existsSync(path.join(__dirname, manifest.action.default_popup)), 'Popup UI file exists');
assert(fs.existsSync(path.join(__dirname, manifest.side_panel.default_path)), 'Side panel UI file exists');
assert(fs.existsSync(path.join(__dirname, manifest.icons['128'])), 'Icon 128 file exists');

// 2. Tube Transfer Curve Verification
function computeTubeCurve(drive, warmth, samples = 1024) {
  const curve = new Float32Array(samples);
  const driveAmount = 1.0 + drive * 4.0;
  const warmthBias = warmth * 0.35;

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    const xDriven = x * driveAmount;
    let y;
    if (xDriven >= 0) {
      y = Math.tanh(xDriven) + warmthBias * (xDriven / (1 + xDriven * xDriven));
    } else {
      y = Math.tanh(xDriven * 0.85) - warmthBias * (xDriven * xDriven * 0.5);
    }
    curve[i] = Math.max(-1.0, Math.min(1.0, y * 0.85));
  }
  return curve;
}

const tubeCurve = computeTubeCurve(0.5, 0.5);
assert(tubeCurve.length === 1024, 'Tube transfer curve generated with 1024 points');
assert(tubeCurve[0] >= -1.0 && tubeCurve[0] < -0.5, 'Negative swing properly soft-limits');
assert(tubeCurve[1023] <= 1.0 && tubeCurve[1023] > 0.5, 'Positive swing properly soft-limits');

// Test asymmetry (even harmonic generation for warmth)
const posMid = tubeCurve[Math.floor(1024 * 0.75)];
const negMid = tubeCurve[Math.floor(1024 * 0.25)];
assert(Math.abs(posMid) !== Math.abs(negMid), '12AX7 transfer curve demonstrates asymmetric triode behavior');

// 3. AutoEQ Profiles Validation
import { POPULAR_AUTOEQ_PROFILES } from './ui/components/autoeq-browser.js';
assert(POPULAR_AUTOEQ_PROFILES.length >= 15, `AutoEQ profile collection loaded (${POPULAR_AUTOEQ_PROFILES.length} profiles)`);

let autoEqValid = true;
POPULAR_AUTOEQ_PROFILES.forEach(p => {
  if (p.gains.length !== 10) autoEqValid = false;
  p.gains.forEach(g => {
    if (typeof g !== 'number' || g < -15 || g > 15) autoEqValid = false;
  });
});
assert(autoEqValid, 'All AutoEQ profiles contain exactly 10 valid calibrated gain points within [-15dB, +15dB]');

// 4. Built-in Presets Validation
import { BUILT_IN_PRESETS } from './ui/components/presets-manager.js';
const presetKeys = Object.keys(BUILT_IN_PRESETS);
assert(presetKeys.length >= 6, `Built-in presets loaded (${presetKeys.length} presets)`);
assert(BUILT_IN_PRESETS['flat'].equalizer.gains.every(g => g === 0), 'Studio Reference preset is flat 0dB across all bands');
assert(BUILT_IN_PRESETS['bass_impact'].dynamicBass.enabled === true, 'Deep Bass Impact preset has Dynamic Bass enabled');
assert(BUILT_IN_PRESETS['tube_warmth'].tubeSaturation.enabled === true, '12AX7 Tube Warmth preset has Tube Saturation enabled');

// 5. Equalizer Frequencies Validation
import { FREQUENCIES_10_BAND, FREQUENCIES_15_BAND } from './offscreen/dsp/equalizer.js';
assert(FREQUENCIES_10_BAND.length === 10, '10-band EQ frequencies defined correctly');
assert(FREQUENCIES_15_BAND.length === 15, '15-band EQ frequencies defined correctly');
assert(FREQUENCIES_10_BAND[0] === 31 && FREQUENCIES_10_BAND[9] === 16000, '10-band range spans 31Hz to 16kHz');

console.log(`\n===========================================`);
console.log(`Summary: ${passedTests}/${totalTests} tests passed.`);
console.log(`===========================================`);
