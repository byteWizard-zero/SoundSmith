/**
 * AutoEQ Cloud Client for SoundSmith
 * Connects to the RootlessJamesDSP AutoEQ backend: https://aeq.timschneeberger.me/
 * Falls back gracefully to bundled high-fidelity profiles.
 */

import { POPULAR_AUTOEQ_PROFILES } from './autoeq-browser.js';

export class AutoEqCloudClient {
  constructor() {
    this.baseUrl = 'https://aeq.timschneeberger.me/api';
  }

  /**
   * Search headphone database
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async searchHeadphones(query) {
    if (!query || query.trim().length < 2) {
      return POPULAR_AUTOEQ_PROFILES;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const resp = await fetch(`${this.baseUrl}/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const results = await resp.json();
        if (Array.isArray(results) && results.length > 0) {
          return results.map(r => ({
            name: r.name || r.model,
            type: r.source || 'Cloud Profile',
            gains: r.fixedBand10 || r.fixedBand15 || POPULAR_AUTOEQ_PROFILES[0].gains,
            rawUrl: r.rawUrl
          }));
        }
      }
    } catch {
      // Offline or network error -> use local filter
    }

    // Local fallback search
    const q = query.toLowerCase().trim();
    return POPULAR_AUTOEQ_PROFILES.filter(p =>
      p.name.toLowerCase().includes(q) || p.type.toLowerCase().includes(q)
    );
  }
}

export { AutoEqCloudClient as AutoEqClient };
