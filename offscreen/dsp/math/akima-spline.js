/**
 * Modified Hiroshi Akima & PCHIP Spline Interpolators
 * Reverse-engineered from JdspImpResToolbox in RootlessJamesDSP.
 */

export class AkimaSpline {
  /**
   * Evaluates Modified Akima spline interpolation
   * @param {number[]} xs - Strictly ascending x coordinates
   * @param {number[]} ys - Corresponding y values
   * @param {number[]} queryXs - Interpolation target points
   * @returns {Float32Array} - Interpolated values
   */
  static interpolate(xs, ys, queryXs) {
    const n = xs.length;
    if (n < 2) return new Float32Array(queryXs.length).fill(ys[0] || 0);

    // Compute finite differences
    const dx = new Float64Array(n - 1);
    const m = new Float64Array(n - 1);
    for (let i = 0; i < n - 1; i++) {
      dx[i] = xs[i + 1] - xs[i];
      m[i] = (ys[i + 1] - ys[i]) / dx[i];
    }

    // Extrapolate slopes at endpoints (m[-2], m[-1], m[n-1], m[n])
    const mExt = new Float64Array(n + 3);
    for (let i = 0; i < n - 1; i++) {
      mExt[i + 2] = m[i];
    }
    mExt[1] = 2 * m[0] - m[1];
    mExt[0] = 2 * mExt[1] - m[0];
    mExt[n + 1] = 2 * m[n - 2] - m[n - 3];
    mExt[n + 2] = 2 * mExt[n + 1] - m[n - 2];

    // Calculate Modified Akima derivative weights
    const t = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const w1 = Math.abs(mExt[i + 3] - mExt[i + 2]) + Math.abs(mExt[i + 3] + mExt[i + 2]) / 2;
      const w2 = Math.abs(mExt[i + 1] - mExt[i]) + Math.abs(mExt[i + 1] + mExt[i]) / 2;
      if (w1 + w2 === 0) {
        t[i] = (mExt[i + 1] + mExt[i + 2]) / 2;
      } else {
        t[i] = (w1 * mExt[i + 1] + w2 * mExt[i + 2]) / (w1 + w2);
      }
    }

    // Evaluate query points
    const out = new Float32Array(queryXs.length);
    for (let q = 0; q < queryXs.length; q++) {
      const x = queryXs[q];
      if (x <= xs[0]) {
        out[q] = ys[0];
        continue;
      }
      if (x >= xs[n - 1]) {
        out[q] = ys[n - 1];
        continue;
      }

      // Binary search segment
      let low = 0, high = n - 2;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (x >= xs[mid] && x <= xs[mid + 1]) {
          const h = xs[mid + 1] - xs[mid];
          const s = (x - xs[mid]) / h;
          const s2 = s * s;
          const s3 = s2 * s;

          // Hermite basis functions
          const h00 = 2 * s3 - 3 * s2 + 1;
          const h10 = s3 - 2 * s2 + s;
          const h01 = -2 * s3 + 3 * s2;
          const h11 = s3 - s2;

          out[q] = h00 * ys[mid] + h10 * h * t[mid] + h01 * ys[mid + 1] + h11 * h * t[mid + 1];
          break;
        } else if (x < xs[mid]) {
          high = mid - 1;
        } else {
          low = mid + 1;
        }
      }
    }
    return out;
  }
}

export class PchipSpline {
  /**
   * Monotonicity-preserving cubic Hermite interpolation (PCHIP)
   */
  static interpolate(xs, ys, queryXs) {
    const n = xs.length;
    if (n < 2) return new Float32Array(queryXs.length).fill(ys[0] || 0);

    const h = new Float64Array(n - 1);
    const delta = new Float64Array(n - 1);
    for (let i = 0; i < n - 1; i++) {
      h[i] = xs[i + 1] - xs[i];
      delta[i] = (ys[i + 1] - ys[i]) / h[i];
    }

    const d = new Float64Array(n);
    for (let i = 1; i < n - 1; i++) {
      if (delta[i - 1] * delta[i] > 0) {
        const w1 = 2 * h[i] + h[i - 1];
        const w2 = h[i] + 2 * h[i - 1];
        d[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i]);
      } else {
        d[i] = 0;
      }
    }
    d[0] = delta[0];
    d[n - 1] = delta[n - 2];

    const out = new Float32Array(queryXs.length);
    for (let q = 0; q < queryXs.length; q++) {
      const x = queryXs[q];
      if (x <= xs[0]) { out[q] = ys[0]; continue; }
      if (x >= xs[n - 1]) { out[q] = ys[n - 1]; continue; }

      let k = 0;
      for (let i = 0; i < n - 1; i++) {
        if (x >= xs[i] && x <= xs[i + 1]) {
          k = i;
          break;
        }
      }

      const s = (x - xs[k]) / h[k];
      const s2 = s * s;
      const s3 = s2 * s;
      out[q] = (2 * s3 - 3 * s2 + 1) * ys[k] +
               (s3 - 2 * s2 + s) * h[k] * d[k] +
               (-2 * s3 + 3 * s2) * ys[k + 1] +
               (s3 - s2) * h[k] * d[k + 1];
    }
    return out;
  }
}
