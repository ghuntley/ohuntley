/**
 * Shared localStorage leaderboards for arcade games (top N scores per slug).
 * Depends on global `document` and `localStorage`.
 * Load `arcade-tokens.js` before this file to auto-award tokens on each `record()`.
 */
(function (w) {
  const PREFIX = "arcade-lb-v2:";
  const DEFAULT_MAX = 10;

  function storageKey(slug) {
    return PREFIX + slug;
  }

  function parse(slug) {
    try {
      const raw = w.localStorage.getItem(storageKey(slug));
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function save(slug, rows) {
    w.localStorage.setItem(storageKey(slug), JSON.stringify(rows));
  }

  function sortRows(rows, lowerIsBetter) {
    const copy = rows.slice();
    if (lowerIsBetter) {
      copy.sort((a, b) => a.score - b.score || b.at - a.at);
    } else {
      copy.sort((a, b) => b.score - a.score || b.at - a.at);
    }
    return copy;
  }

  w.ArcadeScores = {
    list(slug, lowerIsBetter) {
      return sortRows(parse(slug), !!lowerIsBetter);
    },

    /**
     * @param {string} slug
     * @param {number} score
     * @param {{ max?: number, lowerIsBetter?: boolean }} [options]
     */
    record(slug, score, options) {
      const max = (options && options.max) || DEFAULT_MAX;
      const lowerIsBetter = options && options.lowerIsBetter;
      const n = Number(score);
      if (!Number.isFinite(n)) return this.list(slug, lowerIsBetter);
      const rows = parse(slug);
      rows.push({ score: n, at: Date.now() });
      const sorted = sortRows(rows, lowerIsBetter);
      save(slug, sorted.slice(0, max));
      if (w.ArcadeTokens && typeof w.ArcadeTokens.earnFromGameScore === "function") {
        w.ArcadeTokens.earnFromGameScore(slug, n);
      }
      return sorted.slice(0, max);
    },

    /**
     * @param {HTMLElement | null} ol
     * @param {string} slug
     * @param {{ formatScore?: (n: number) => string, lowerIsBetter?: boolean }} [options]
     */
    renderList(ol, slug, options) {
      if (!ol) return;
      const fmt = (options && options.formatScore) || ((s) => String(Math.round(s * 100) / 100));
      const lowerIsBetter = options && options.lowerIsBetter;
      const list = this.list(slug, lowerIsBetter);
      ol.innerHTML = "";
      if (!list.length) {
        const li = w.document.createElement("li");
        li.className = "arcade-lb-empty";
        li.textContent = "No runs yet";
        ol.appendChild(li);
        return;
      }
      list.forEach((row, i) => {
        const li = w.document.createElement("li");
        const d = new Date(row.at);
        const when = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        li.textContent = `${i + 1}. ${fmt(row.score)} · ${when}`;
        ol.appendChild(li);
      });
    },

    refresh(slug, options) {
      const ol = w.document.getElementById("arcade-lb");
      this.renderList(ol, slug, options);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
