/**
 * Robert Bristow-Johnson (RBJ) Audio EQ Cookbook Transfer Functions
 * Reverse-engineered from BiquadUtils.kt in RootlessJamesDSP.
 */

export class BiquadMath {
  /**
   * Computes RBJ Biquad coefficients
   * @param {string} type - 'PK', 'LSC', 'HSC', 'LP', 'HP'
   * @param {number} fc - Center / cutoff frequency (Hz)
   * @param {number} gainDb - Gain in decibels
   * @param {number} Q - Quality factor
   * @param {number} srate - Sample rate (e.g. 44100 or 48000)
   */
  static computeCoefficients(type, fc, gainDb, Q = 1.414, srate = 48000) {
    const omega = (2 * Math.PI * fc) / srate;
    const sinOmega = Math.sin(omega);
    const cosOmega = Math.cos(omega);
    const alpha = sinOmega / (2 * Math.max(0.01, Q));
    const A = Math.pow(10, gainDb / 40); // sqrt of linear gain

    let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;

    switch (type.toUpperCase()) {
      case 'PK': // Peaking Bell
        b0 = 1 + alpha * A;
        b1 = -2 * cosOmega;
        b2 = 1 - alpha * A;
        a0 = 1 + alpha / A;
        a1 = -2 * cosOmega;
        a2 = 1 - alpha / A;
        break;

      case 'LSC': // Low Shelf
        {
          const aPlus1 = A + 1;
          const aMinus1 = A - 1;
          const sqrtA2Alpha = 2 * Math.sqrt(A) * alpha;
          b0 = A * (aPlus1 - aMinus1 * cosOmega + sqrtA2Alpha);
          b1 = 2 * A * (aMinus1 - aPlus1 * cosOmega);
          b2 = A * (aPlus1 - aMinus1 * cosOmega - sqrtA2Alpha);
          a0 = aPlus1 + aMinus1 * cosOmega + sqrtA2Alpha;
          a1 = -2 * (aMinus1 + aPlus1 * cosOmega);
          a2 = aPlus1 + aMinus1 * cosOmega - sqrtA2Alpha;
        }
        break;

      case 'HSC': // High Shelf
        {
          const aPlus1 = A + 1;
          const aMinus1 = A - 1;
          const sqrtA2Alpha = 2 * Math.sqrt(A) * alpha;
          b0 = A * (aPlus1 + aMinus1 * cosOmega + sqrtA2Alpha);
          b1 = -2 * A * (aMinus1 + aPlus1 * cosOmega);
          b2 = A * (aPlus1 + aMinus1 * cosOmega - sqrtA2Alpha);
          a0 = aPlus1 - aMinus1 * cosOmega + sqrtA2Alpha;
          a1 = 2 * (aMinus1 - aPlus1 * cosOmega);
          a2 = aPlus1 - aMinus1 * cosOmega - sqrtA2Alpha;
        }
        break;

      default:
        return { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 };
    }

    // Normalize by a0
    return {
      b0: b0 / a0,
      b1: b1 / a0,
      b2: b2 / a0,
      a1: a1 / a0,
      a2: a2 / a0
    };
  }

  /**
   * Evaluates magnitude response in dB at a target frequency
   */
  static evaluateMagnitudeDb(coeffs, freq, srate = 48000) {
    const { b0, b1, b2, a1, a2 } = coeffs;
    const phi = (2 * Math.PI * freq) / srate;
    const cosPhi = Math.cos(phi);
    const cos2Phi = Math.cos(2 * phi);

    const num = b0 * b0 + b1 * b1 + b2 * b2 + 2 * (b0 * b1 + b1 * b2) * cosPhi + 2 * b0 * b2 * cos2Phi;
    const den = 1.0 + a1 * a1 + a2 * a2 + 2 * (a1 + a1 * a2) * cosPhi + 2 * a2 * cos2Phi;

    const magSquared = Math.max(1e-12, num / Math.max(1e-12, den));
    return 10 * Math.log10(magSquared);
  }

  static peaking(fc, gainDb, Q = 1.414, srate = 48000) {
    return this.computeCoefficients('PK', fc, gainDb, Q, srate);
  }

  static lowShelf(fc, gainDb, Q = 0.707, srate = 48000) {
    return this.computeCoefficients('LSC', fc, gainDb, Q, srate);
  }

  static highShelf(fc, gainDb, Q = 0.707, srate = 48000) {
    return this.computeCoefficients('HSC', fc, gainDb, Q, srate);
  }
}
