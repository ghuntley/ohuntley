/**
 * Arcade tokens: earn from game scores, spend at the prize counter.
 * Load before arcade-scores.js (auto-award on leaderboard entries) or call earnFromGameScore from games.
 */
(function (w) {
  const BAL_KEY = "arcade-tokens-balance-v1";
  const UP_KEY = "arcade-tokens-upgrades-v1";
  const DEBOUNCE_MS = 2400;
  const lastAward = Object.create(null);

  function readBal() {
    const v = parseInt(w.localStorage.getItem(BAL_KEY) || "0", 10);
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  }

  function writeBal(n) {
    w.localStorage.setItem(BAL_KEY, String(Math.max(0, Math.floor(n))));
    w.dispatchEvent(
      new CustomEvent("arcade-tokens-changed", { detail: { balance: readBal() } })
    );
  }

  function readUpgrades() {
    try {
      const o = JSON.parse(w.localStorage.getItem(UP_KEY) || "{}");
      return o && typeof o === "object" ? o : {};
    } catch {
      return {};
    }
  }

  function writeUpgrades(u) {
    w.localStorage.setItem(UP_KEY, JSON.stringify(u));
    w.dispatchEvent(
      new CustomEvent("arcade-tokens-changed", { detail: { balance: readBal(), upgrades: u } })
    );
  }

  w.ArcadeTokens = {
    getBalance() {
      return readBal();
    },

    /**
     * Convert a run score into tokens. Per-slug debounce limits spam from rhythm games.
     * @returns {number} tokens gained this call
     */
    earnFromGameScore(slug, score) {
      const n = Number(score);
      if (!Number.isFinite(n) || n === 0) return 0;
      const k = String(slug || "game");
      const now = Date.now();
      if (lastAward[k] && now - lastAward[k] < DEBOUNCE_MS) return 0;
      lastAward[k] = now;

      let gained = Math.floor(Math.abs(n) / 38);
      if (gained < 1) gained = 1;
      if (gained > 200) gained = 200;

      const u = readUpgrades();
      if (u.tokenMult && Number.isFinite(u.tokenMult) && u.tokenMult > 1) {
        gained = Math.floor(gained * u.tokenMult);
      }
      if (u.tokenBonusFlat && Number.isFinite(u.tokenBonusFlat) && u.tokenBonusFlat > 0) {
        gained += Math.floor(u.tokenBonusFlat);
      }
      if (gained < 1) gained = 1;
      if (gained > 240) gained = 240;

      writeBal(readBal() + gained);
      return gained;
    },

    trySpend(amount) {
      const a = Math.floor(Number(amount));
      if (a <= 0) return false;
      const b = readBal();
      if (b < a) return false;
      writeBal(b - a);
      return true;
    },

    getUpgrades() {
      return readUpgrades();
    },

    isPrizeOwned(id) {
      const u = readUpgrades();
      switch (id) {
        case "walk":
          return !!u.walkMult;
        case "neon":
          return !!u.neonBoost;
        case "souvenir":
          return !!u.souvenir;
        case "sticker":
          return !!u.sticker;
        case "lanyard":
          return !!u.lanyard;
        case "dime":
          return !!u.tokenBonusFlat;
        case "gridGlow":
          return !!u.gridGlow;
        case "spotBoost":
          return !!u.spotBoost;
        case "wideFov":
          return !!u.wideFov;
        case "wallet":
          return !!u.tokenMult;
        default:
          return false;
      }
    },

    EXCHANGE: Object.freeze([
      {
        id: "sticker",
        name: "High-score sticker",
        desc: "⭐ charm by your token readout (flavor).",
        cost: 18,
      },
      {
        id: "souvenir",
        name: "Souvenir quarter",
        desc: "A shiny keepsake by your token counter (flavor).",
        cost: 25,
      },
      {
        id: "lanyard",
        name: "Arcade lanyard",
        desc: "🎫 badge charm next to your tokens (flavor).",
        cost: 42,
      },
      {
        id: "dime",
        name: "Lucky dime",
        desc: "+1 bonus token whenever a game awards tokens from a score.",
        cost: 60,
      },
      {
        id: "gridGlow",
        name: "Disco floor wax",
        desc: "Brighter aisle grid lines in the lobby (one-time).",
        cost: 72,
      },
      {
        id: "walk",
        name: "Zip-sneakers",
        desc: "+8% walk speed in the 3D lobby (one-time).",
        cost: 80,
      },
      {
        id: "spotBoost",
        name: "Front-row spotlight",
        desc: "Stronger overhead spot & follow beam in the lobby (one-time).",
        cost: 88,
      },
      {
        id: "wideFov",
        name: "Wide-screen shades",
        desc: "A bit wider field of view while exploring (one-time).",
        cost: 95,
      },
      {
        id: "wallet",
        name: "Winner's wallet",
        desc: "~14% more tokens from game score awards (one-time).",
        cost: 115,
      },
      {
        id: "neon",
        name: "All-access neon pass",
        desc: "Extra bloom & wash lights in the lobby (one-time).",
        cost: 120,
      },
    ]),

    /**
     * @returns {{ ok: boolean, msg: string }}
     */
    buy(id) {
      const item = this.EXCHANGE.find((x) => x.id === id);
      if (!item) return { ok: false, msg: "Unknown prize." };
      if (this.isPrizeOwned(id)) return { ok: false, msg: "You already redeemed this prize." };
      if (!this.trySpend(item.cost)) return { ok: false, msg: "Not enough tokens." };

      const u = readUpgrades();
      const next = { ...u };
      if (id === "walk") next.walkMult = 1.08;
      if (id === "neon") next.neonBoost = 1;
      if (id === "souvenir") next.souvenir = 1;
      if (id === "sticker") next.sticker = 1;
      if (id === "lanyard") next.lanyard = 1;
      if (id === "dime") next.tokenBonusFlat = 1;
      if (id === "gridGlow") next.gridGlow = 1;
      if (id === "spotBoost") next.spotBoost = 1;
      if (id === "wideFov") next.wideFov = 1;
      if (id === "wallet") next.tokenMult = 1.14;
      writeUpgrades(next);
      return { ok: true, msg: "Redeemed — thanks for playing!" };
    },
  };

  w.AT = w.ArcadeTokens;
})(typeof window !== "undefined" ? window : globalThis);
