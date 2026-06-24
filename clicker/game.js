/* Neon Forge — a cyberpunk idle/clicker.
 *
 * Core loop:
 *   - Click the anvil to earn `sparks`.
 *   - Spend sparks on `generators` (auto-smiths) that earn sparks per second.
 *   - Spend sparks on `upgrades` that multiply click power and generators.
 *   - Earn `achievements` for milestones; each gives +1% global output.
 *   - Once you've earned enough lifetime sparks, ascend for `shards` that grant
 *     a permanent +2% per shard.
 *
 * State persists in localStorage. Idle progress is granted on reload, capped
 * at 4 hours and at 50% of online efficiency.
 */

(function () {
  "use strict";

  // ===== CONFIG =====
  /** Touch-friendly controls (tap anvil, larger targets, no double-fire). Default on. */
  const TOUCH_COMPATIBLE_BY_DEFAULT =
    document.documentElement.dataset.touchCompatible !== "false";

  const SAVE_KEY = "neon-forge-save-v1";
  const SAVE_VERSION = 1;
  const COST_GROWTH = 1.15;
  const ASCEND_THRESHOLD = 1e6;
  const MAX_OFFLINE_HOURS = 4;
  const OFFLINE_EFFICIENCY = 0.5;
  const AUTO_SAVE_MS = 10000;
  const STORE_RENDER_HZ = 6;

  /** @type {Array<{id:string,name:string,icon:string,baseCost:number,baseRate:number,flavor:string}>} */
  const GENERATORS = [
    {
      id: "apprentice",
      name: "Apprentice Smith",
      icon: "AP",
      baseCost: 15,
      baseRate: 0.6,
      flavor: "A junior runner taps the anvil with a memory shard.",
    },
    {
      id: "crank",
      name: "Hand-Cranked Forge",
      icon: "CK",
      baseCost: 110,
      baseRate: 5,
      flavor: "A pedal-powered conduit hums to life.",
    },
    {
      id: "bellows",
      name: "Steam Bellows",
      icon: "SB",
      baseCost: 1200,
      baseRate: 32,
      flavor: "Steam hisses through copper veins still alight.",
    },
    {
      id: "voltaic",
      name: "Voltaic Furnace",
      icon: "VF",
      baseCost: 14000,
      baseRate: 180,
      flavor: "Lightning courses through gridded coils.",
    },
    {
      id: "plasma",
      name: "Plasma Forge",
      icon: "PL",
      baseCost: 165000,
      baseRate: 980,
      flavor: "A magnetic bottle holds star-stuff still long enough to write.",
    },
    {
      id: "quantum",
      name: "Quantum Press",
      icon: "QP",
      baseCost: 1.9e6,
      baseRate: 5400,
      flavor: "Probability collapses into pure intent.",
    },
    {
      id: "singular",
      name: "Singularity Anvil",
      icon: "SI",
      baseCost: 2.4e7,
      baseRate: 30000,
      flavor: "An event horizon shaped like a hammer.",
    },
    {
      id: "cosmic",
      name: "Cosmic Inscriptor",
      icon: "CO",
      baseCost: 3.5e8,
      baseRate: 175000,
      flavor: "The universe carves your sigil into spacetime.",
    },
    {
      id: "dream",
      name: "Dreamfracture Loom",
      icon: "DR",
      baseCost: 6.2e9,
      baseRate: 1.05e6,
      flavor: "Sparks woven from the regrets of forgotten gods.",
    },
  ];

  // Each upgrade either multiplies the click power, a single generator, or all output.
  // `unlock` is a predicate: an upgrade is offered once it returns true. Already
  // purchased upgrades stay visible (greyed). Upgrades disappear once owned.
  /** @type {Array<{id:string,name:string,desc:string,cost:number,target:string,mult:number,unlock?:(s:any)=>boolean,kind?:string}>} */
  const UPGRADES = [
    // Click power
    {
      id: "click-1",
      name: "Steel Knuckles",
      desc: "Click power ×2.",
      cost: 100,
      target: "click",
      mult: 2,
      unlock: (s) => s.totalClicks >= 12,
    },
    {
      id: "click-2",
      name: "Photon Gauntlets",
      desc: "Click power ×3.",
      cost: 5000,
      target: "click",
      mult: 3,
      unlock: (s) => s.totalClicks >= 100 && s.totalSparks >= 1500,
    },
    {
      id: "click-3",
      name: "Phase Hammer",
      desc: "Click power ×3.",
      cost: 250000,
      target: "click",
      mult: 3,
      unlock: (s) => s.totalSparks >= 80000,
    },
    {
      id: "click-4",
      name: "Reality Strike",
      desc: "Click power ×5.",
      cost: 5e7,
      target: "click",
      mult: 5,
      unlock: (s) => s.totalSparks >= 1e7,
    },

    // Synergy / global
    {
      id: "synergy-network",
      name: "Forge Network",
      desc: "Click power +1% per generator owned.",
      cost: 7500,
      target: "synergy:network",
      mult: 1,
      unlock: (s) => totalGeneratorsOwned(s) >= 15,
    },
    {
      id: "synergy-resonance",
      name: "Resonance Loop",
      desc: "All generator output +25%.",
      cost: 1.5e6,
      target: "all",
      mult: 1.25,
      unlock: (s) => totalGeneratorsOwned(s) >= 70,
    },
    {
      id: "synergy-overdrive",
      name: "Overdrive Coil",
      desc: "All generator output +50%.",
      cost: 1.5e8,
      target: "all",
      mult: 1.5,
      unlock: (s) => totalGeneratorsOwned(s) >= 150,
    },
    {
      id: "synergy-oracle",
      name: "Oracular Cadence",
      desc: "All output +50%.",
      cost: 5e9,
      target: "all",
      mult: 1.5,
      unlock: (s) => s.shards >= 5,
    },

    // Per-generator: 2 multipliers per generator (×2, ×2)
    ...GENERATORS.flatMap((g, idx) => {
      const tier = idx + 1;
      const ownThreshold1 = 5;
      const ownThreshold2 = 25;
      return [
        {
          id: `gen-${g.id}-1`,
          name: `${g.name}: Refinement`,
          desc: `${g.name} output ×2.`,
          cost: g.baseCost * 12,
          target: `gen:${g.id}`,
          mult: 2,
          unlock: (s) => s.generators[g.id] >= ownThreshold1,
        },
        {
          id: `gen-${g.id}-2`,
          name: `${g.name}: Mastery`,
          desc: `${g.name} output ×2.`,
          cost: g.baseCost * 80,
          target: `gen:${g.id}`,
          mult: 2,
          unlock: (s) => s.generators[g.id] >= ownThreshold2,
        },
        // Tier 3 mastery for first six tiers (mid/late game power curve)
        ...(tier <= 6
          ? [
              {
                id: `gen-${g.id}-3`,
                name: `${g.name}: Apex`,
                desc: `${g.name} output ×3.`,
                cost: g.baseCost * 600,
                target: `gen:${g.id}`,
                mult: 3,
                unlock: (s) => s.generators[g.id] >= 60,
              },
            ]
          : []),
      ];
    }),
  ];

  /** @type {Array<{id:string,name:string,desc:string,when:(s:any)=>boolean,icon:string}>} */
  const ACHIEVEMENTS = [
    { id: "first-click", name: "First Spark", desc: "Click the anvil.", when: (s) => s.totalClicks >= 1, icon: "·" },
    { id: "click-100", name: "Hundredfold", desc: "Click 100 times.", when: (s) => s.totalClicks >= 100, icon: "C100" },
    { id: "click-1k", name: "Thousand Strikes", desc: "Click 1,000 times.", when: (s) => s.totalClicks >= 1000, icon: "C1K" },
    { id: "click-10k", name: "Carpal Mastery", desc: "Click 10,000 times.", when: (s) => s.totalClicks >= 10000, icon: "C10K" },
    { id: "spk-1k", name: "Glow", desc: "Earn 1,000 sparks total.", when: (s) => s.totalSparks >= 1e3, icon: "1K" },
    { id: "spk-1m", name: "Aurora", desc: "Earn 1,000,000 sparks total.", when: (s) => s.totalSparks >= 1e6, icon: "1M" },
    { id: "spk-1b", name: "Solar", desc: "Earn 1,000,000,000 sparks total.", when: (s) => s.totalSparks >= 1e9, icon: "1B" },
    { id: "spk-1t", name: "Quasar", desc: "Earn 1 trillion sparks total.", when: (s) => s.totalSparks >= 1e12, icon: "1T" },
    { id: "spk-1p", name: "Galactic", desc: "Earn 1 quadrillion sparks total.", when: (s) => s.totalSparks >= 1e15, icon: "1Qa" },
    { id: "rate-1k", name: "Hum", desc: "Reach 1,000 sparks/sec.", when: (s) => totalRate(s) >= 1e3, icon: "/s1K" },
    { id: "rate-1m", name: "Roar", desc: "Reach 1,000,000 sparks/sec.", when: (s) => totalRate(s) >= 1e6, icon: "/s1M" },
    { id: "rate-1b", name: "Symphony", desc: "Reach 1 billion sparks/sec.", when: (s) => totalRate(s) >= 1e9, icon: "/s1B" },
    ...GENERATORS.map((g, i) => ({
      id: `own-${g.id}-1`,
      name: g.name,
      desc: `Hire your first ${g.name}.`,
      when: (s) => s.generators[g.id] >= 1,
      icon: g.icon,
    })),
    ...GENERATORS.slice(0, 7).map((g, i) => ({
      id: `own-${g.id}-25`,
      name: `${g.name} ×25`,
      desc: `Own 25 of ${g.name}.`,
      when: (s) => s.generators[g.id] >= 25,
      icon: g.icon + "25",
    })),
    { id: "asc-1", name: "Ascended", desc: "Ascend for the first time.", when: (s) => s.ascensions >= 1, icon: "A1" },
    { id: "asc-5", name: "Reborn", desc: "Ascend 5 times.", when: (s) => s.ascensions >= 5, icon: "A5" },
    { id: "asc-25", name: "Ouroboros", desc: "Ascend 25 times.", when: (s) => s.ascensions >= 25, icon: "A25" },
    { id: "shards-10", name: "Shardspeaker", desc: "Hold 10 shards.", when: (s) => s.shards >= 10, icon: "S10" },
    { id: "shards-100", name: "Shardlord", desc: "Hold 100 shards.", when: (s) => s.shards >= 100, icon: "S100" },
    { id: "shards-1000", name: "Shardgod", desc: "Hold 1,000 shards.", when: (s) => s.shards >= 1000, icon: "S1K" },
  ];

  // ===== STATE =====
  const state = {
    sparks: 0,
    totalSparks: 0,
    totalClicks: 0,
    totalSpent: 0,
    generators: Object.fromEntries(GENERATORS.map((g) => [g.id, 0])),
    upgrades: new Set(),
    achievements: new Set(),
    shards: 0,
    ascensions: 0,
    runStart: Date.now(),
    sessionStart: Date.now(),
    muted: false,
  };

  // ===== HELPERS =====
  const NUM_TIERS = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

  function fmt(n) {
    if (!Number.isFinite(n)) return "∞";
    if (n < 0) return "-" + fmt(-n);
    if (n === 0) return "0";
    if (n < 1) return n.toFixed(2);
    if (n < 1000) {
      if (Number.isInteger(n)) return n.toFixed(0);
      return n < 10 ? n.toFixed(1) : n.toFixed(0);
    }
    const tier = Math.min(NUM_TIERS.length - 1, Math.floor(Math.log10(n) / 3));
    const v = n / Math.pow(1000, tier);
    let digits;
    if (v >= 100) digits = 1;
    else if (v >= 10) digits = 2;
    else digits = 3;
    return v.toFixed(digits) + NUM_TIERS[tier];
  }

  function fmtTime(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function totalGeneratorsOwned(s = state) {
    let n = 0;
    for (const g of GENERATORS) n += s.generators[g.id] || 0;
    return n;
  }

  function genCost(g) {
    return Math.ceil(g.baseCost * Math.pow(COST_GROWTH, state.generators[g.id]));
  }

  function generatorMult(genId, s = state) {
    let m = 1;
    for (const upId of s.upgrades) {
      const up = UPGRADES.find((u) => u.id === upId);
      if (!up) continue;
      if (up.target === `gen:${genId}`) m *= up.mult;
      if (up.target === "all") m *= up.mult;
    }
    return m;
  }

  function generatorRate(genId, s = state) {
    const g = GENERATORS.find((x) => x.id === genId);
    if (!g) return 0;
    return s.generators[genId] * g.baseRate * generatorMult(genId, s);
  }

  function globalMult(s = state) {
    const shardMult = 1 + (s.shards || 0) * 0.02;
    const achiMult = 1 + s.achievements.size * 0.01;
    return shardMult * achiMult;
  }

  function totalRate(s = state) {
    let sum = 0;
    for (const g of GENERATORS) sum += generatorRate(g.id, s);
    return sum * globalMult(s);
  }

  function clickPower(s = state) {
    let p = 1;
    for (const upId of s.upgrades) {
      const up = UPGRADES.find((u) => u.id === upId);
      if (!up) continue;
      if (up.target === "click") p *= up.mult;
      if (up.target === "all") p *= up.mult;
    }
    if (s.upgrades.has("synergy-network")) {
      p *= 1 + 0.01 * totalGeneratorsOwned(s);
    }
    return p * globalMult(s);
  }

  function computeAscendReward(s = state) {
    if (s.totalSparks < ASCEND_THRESHOLD) return 0;
    return Math.max(0, Math.floor(0.5 * Math.sqrt(s.totalSparks / 1e6)));
  }

  function ascendDeficitText(s = state) {
    const need = ASCEND_THRESHOLD;
    if (s.totalSparks >= need) return "";
    return `Reach ${fmt(need)} lifetime sparks to ascend (you have ${fmt(s.totalSparks)}).`;
  }

  // ===== TOUCH (enabled when TOUCH_COMPATIBLE_BY_DEFAULT) =====
  function initTouchCompat() {
    if (!TOUCH_COMPATIBLE_BY_DEFAULT) return;
    document.documentElement.classList.add("touch-compatible");
    const coarse =
      window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
      navigator.maxTouchPoints > 0;
    if (coarse) {
      document.documentElement.classList.add("touch-device");
      const hint = document.getElementById("anvilHint");
      if (hint) hint.textContent = "Tap the anvil";
    }
  }

  /** Primary tap/click without double-firing on touch (synthetic click). */
  function bindTap(el, handler) {
    if (!el) return;
    if (!TOUCH_COMPATIBLE_BY_DEFAULT) {
      el.addEventListener("click", handler);
      return;
    }
    let suppressClickUntil = 0;
    el.addEventListener(
      "pointerdown",
      (e) => {
        if (e.button !== 0) return;
        if (e.pointerType === "touch" || e.pointerType === "pen") {
          e.preventDefault();
          suppressClickUntil = Date.now() + 500;
          handler(e);
        }
      },
      { passive: false },
    );
    el.addEventListener("click", (e) => {
      if (Date.now() < suppressClickUntil) return;
      handler(e);
    });
  }

  // ===== AUDIO =====
  let audioCtx = null;
  function ensureAudio() {
    if (audioCtx || state.muted) return audioCtx;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    try {
      audioCtx = new C();
    } catch {
      return null;
    }
    return audioCtx;
  }

  function playClickSound() {
    if (state.muted) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(820 + (Math.random() * 80 - 40), t0);
    osc.frequency.exponentialRampToValueAtTime(380, t0 + 0.07);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1500;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.18, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.11);
  }

  function playBuySound(big = false) {
    if (state.muted) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const t0 = ctx.currentTime;
    const baseFreq = big ? 660 : 520;
    const harmonics = big ? [1, 1.5, 2.0] : [1, 1.5];
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, t0);
    gainNode.gain.linearRampToValueAtTime(big ? 0.18 : 0.12, t0 + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + (big ? 0.5 : 0.3));
    gainNode.connect(ctx.destination);
    for (const h of harmonics) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = baseFreq * h;
      osc.connect(gainNode);
      osc.start(t0);
      osc.stop(t0 + (big ? 0.55 : 0.35));
    }
  }

  function playAscendSound() {
    if (state.muted) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const t0 = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, t0);
    gainNode.gain.linearRampToValueAtTime(0.22, t0 + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
    gainNode.connect(ctx.destination);
    [330, 440, 660, 880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 === 0 ? "sine" : "triangle";
      o.frequency.value = f;
      o.connect(gainNode);
      o.start(t0 + i * 0.04);
      o.stop(t0 + 1.5);
    });
  }

  // ===== DOM =====
  const dom = {
    sparksVal: document.getElementById("sparksVal"),
    rateVal: document.getElementById("rateVal"),
    shardsVal: document.getElementById("shardsVal"),
    clickPowerVal: document.getElementById("clickPowerVal"),
    clicksVal: document.getElementById("clicksVal"),
    totalSparksVal: document.getElementById("totalSparksVal"),
    runTimeVal: document.getElementById("runTimeVal"),
    ascensionsVal: document.getElementById("ascensionsVal"),
    anvilBtn: document.getElementById("anvilBtn"),
    floaters: document.getElementById("floaters"),
    particleLayer: document.getElementById("particleLayer"),
    generatorList: document.getElementById("generatorList"),
    upgradeList: document.getElementById("upgradeList"),
    achievementList: document.getElementById("achievementList"),
    achiCount: document.getElementById("achiCount"),
    ascendBtn: document.getElementById("ascendBtn"),
    ascendInfo: document.getElementById("ascendInfo"),
    ascendModal: document.getElementById("ascendModal"),
    ascendShards: document.getElementById("ascendShards"),
    ascendCancel: document.getElementById("ascendCancel"),
    ascendConfirm: document.getElementById("ascendConfirm"),
    muteBtn: document.getElementById("muteBtn"),
    saveBtn: document.getElementById("saveBtn"),
    resetBtn: document.getElementById("resetBtn"),
    toast: document.getElementById("toast"),
  };

  // ===== EFFECTS =====
  function spawnFloater(x, y, text) {
    const f = document.createElement("div");
    f.className = "floater";
    f.textContent = text;
    f.style.left = x + "px";
    f.style.top = y + "px";
    dom.particleLayer.appendChild(f);
    setTimeout(() => f.remove(), 950);
  }

  const PARTICLE_COLORS = ["#ff5cd2", "#00fff2", "#ffe27a", "#ff8aff"];
  function spawnParticles(x, y, count = 7) {
    for (let i = 0; i < count; i += 1) {
      const p = document.createElement("span");
      p.className = "particle";
      p.style.left = x + "px";
      p.style.top = y + "px";
      p.style.color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
      const ang = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 60;
      p.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      p.style.setProperty("--dy", Math.sin(ang) * dist + "px");
      dom.particleLayer.appendChild(p);
      setTimeout(() => p.remove(), 720);
    }
  }

  function showToast(msg, ms = 4500) {
    dom.toast.textContent = msg;
    dom.toast.classList.add("show");
    if (showToast._t) clearTimeout(showToast._t);
    showToast._t = setTimeout(() => dom.toast.classList.remove("show"), ms);
  }

  // ===== CLICK =====
  function clickAnvil(evt) {
    ensureAudio();
    const power = clickPower();
    state.sparks += power;
    state.totalSparks += power;
    state.totalClicks += 1;

    // Determine the position for floaters/particles. Touch and pointer give
    // different shapes; fall back to anvil center if absent.
    let x;
    let y;
    if (evt && evt.clientX != null) {
      x = evt.clientX;
      y = evt.clientY;
    } else if (evt && evt.changedTouches && evt.changedTouches[0]) {
      const t = evt.changedTouches[0];
      x = t.clientX;
      y = t.clientY;
    } else {
      const r = dom.anvilBtn.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }

    spawnFloater(x, y - 12, "+" + fmt(power));
    spawnParticles(x, y);
    playClickSound();

    dom.anvilBtn.classList.add("struck", "has-clicked");
    if (clickAnvil._t) clearTimeout(clickAnvil._t);
    clickAnvil._t = setTimeout(() => dom.anvilBtn.classList.remove("struck"), 70);

    checkAchievements();
  }

  // ===== STORE ACTIONS =====
  function buyGenerator(g) {
    const cost = genCost(g);
    if (state.sparks < cost) return false;
    state.sparks -= cost;
    state.totalSpent += cost;
    state.generators[g.id] += 1;
    playBuySound(false);
    checkAchievements();
    renderTopbar();
    renderStore();
    return true;
  }

  function buyUpgrade(up) {
    if (state.upgrades.has(up.id)) return false;
    if (state.sparks < up.cost) return false;
    state.sparks -= up.cost;
    state.totalSpent += up.cost;
    state.upgrades.add(up.id);
    playBuySound(true);
    checkAchievements();
    renderTopbar();
    renderStore();
    return true;
  }

  // ===== ACHIEVEMENTS =====
  function checkAchievements() {
    let any = false;
    for (const a of ACHIEVEMENTS) {
      if (state.achievements.has(a.id)) continue;
      if (!a.when(state)) continue;
      state.achievements.add(a.id);
      any = true;
      showToast(`Achievement: ${a.name}\n${a.desc}`);
    }
    if (any) {
      // unlocking achievements changes globalMult
      renderTopbar();
      renderAchievements();
    }
  }

  // ===== ASCENSION =====
  function openAscendModal() {
    const reward = computeAscendReward();
    if (reward <= 0) {
      showToast(ascendDeficitText());
      return;
    }
    dom.ascendShards.textContent = String(reward);
    dom.ascendModal.hidden = false;
  }

  function closeAscendModal() {
    dom.ascendModal.hidden = true;
  }

  function performAscend() {
    const reward = computeAscendReward();
    if (reward <= 0) return;
    state.shards += reward;
    state.ascensions += 1;
    state.sparks = 0;
    state.totalSpent = 0;
    for (const g of GENERATORS) state.generators[g.id] = 0;
    state.upgrades = new Set();
    state.runStart = Date.now();
    closeAscendModal();
    playAscendSound();
    saveGame();
    showToast(`Ascended! +${reward} shard${reward === 1 ? "" : "s"} earned.`);
    checkAchievements();
    renderAll();
  }

  // ===== RENDERING =====
  function renderTopbar() {
    dom.sparksVal.textContent = fmt(state.sparks);
    dom.rateVal.textContent = fmt(totalRate());
    dom.shardsVal.textContent = fmt(state.shards);
    dom.clickPowerVal.textContent = fmt(clickPower());
    dom.clicksVal.textContent = fmt(state.totalClicks);
    dom.totalSparksVal.textContent = fmt(state.totalSparks);
    dom.ascensionsVal.textContent = fmt(state.ascensions);
    const runSeconds = (Date.now() - state.runStart) / 1000;
    dom.runTimeVal.textContent = fmtTime(runSeconds);
  }

  function buildStoreItem({ icon, name, flavor, meta, cost, owned, affordable, locked, onClick, lockedHint }) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "store-item";
    if (affordable) btn.classList.add("affordable");
    if (locked) btn.classList.add("locked");
    btn.disabled = !affordable && !locked;

    const iconEl = document.createElement("div");
    iconEl.className = "store-icon";
    iconEl.textContent = icon;

    const text = document.createElement("div");
    text.className = "store-text";

    const nameEl = document.createElement("div");
    nameEl.className = "store-name";
    nameEl.textContent = name;
    text.appendChild(nameEl);

    if (flavor) {
      const flavorEl = document.createElement("div");
      flavorEl.className = "store-flavor";
      flavorEl.textContent = locked ? lockedHint || flavor : flavor;
      text.appendChild(flavorEl);
    }

    if (meta) {
      const metaEl = document.createElement("div");
      metaEl.className = "store-meta";
      metaEl.innerHTML = meta;
      text.appendChild(metaEl);
    }

    const buy = document.createElement("div");
    buy.className = "store-buy";
    const costEl = document.createElement("div");
    costEl.className = "store-cost";
    costEl.textContent = cost;
    buy.appendChild(costEl);
    if (owned !== undefined) {
      const ownedEl = document.createElement("div");
      ownedEl.className = "store-owned";
      ownedEl.textContent = owned;
      buy.appendChild(ownedEl);
    }

    btn.appendChild(iconEl);
    btn.appendChild(text);
    btn.appendChild(buy);
    if (onClick && !locked) bindTap(btn, onClick);
    li.appendChild(btn);
    return li;
  }

  function renderGenerators() {
    const frag = document.createDocumentFragment();
    let firstShown = true;
    for (let i = 0; i < GENERATORS.length; i += 1) {
      const g = GENERATORS[i];
      const owned = state.generators[g.id];
      const cost = genCost(g);
      // Lock generators we haven't reached yet, except show one tier above the
      // most-recent owned to tease the next purchase.
      const prev = i === 0 ? 1 : state.generators[GENERATORS[i - 1].id];
      const locked = owned === 0 && i > 0 && prev < 1;
      const affordable = !locked && state.sparks >= cost;
      const rate = generatorRate(g.id);
      const eachRate = g.baseRate * generatorMult(g.id) * globalMult();
      const meta =
        owned > 0
          ? `producing <strong>${fmt(rate)}</strong>/s · each <strong>${fmt(eachRate)}</strong>/s`
          : `each produces <strong>${fmt(eachRate)}</strong>/s`;
      frag.appendChild(
        buildStoreItem({
          icon: g.icon,
          name: g.name,
          flavor: g.flavor,
          meta,
          cost: fmt(cost) + " sp",
          owned: `owned ${owned}`,
          affordable,
          locked,
          lockedHint: i > 0 ? `Hire a ${GENERATORS[i - 1].name} first.` : "",
          onClick: () => buyGenerator(g),
        }),
      );
      if (locked && firstShown) firstShown = false;
    }
    replaceChildren(dom.generatorList, frag);
  }

  function renderUpgrades() {
    const frag = document.createDocumentFragment();
    const visible = UPGRADES.filter((u) => !state.upgrades.has(u.id) && (!u.unlock || u.unlock(state)));
    if (visible.length === 0) {
      const li = document.createElement("li");
      li.className = "muted";
      li.style.padding = "0.5rem";
      li.textContent = "No new upgrades right now. Keep clicking and hiring.";
      frag.appendChild(li);
    }
    for (const up of visible) {
      const affordable = state.sparks >= up.cost;
      frag.appendChild(
        buildStoreItem({
          icon: up.target === "click" ? "CL" : up.target === "all" ? "ALL" : up.target.startsWith("synergy") ? "SY" : "UP",
          name: up.name,
          flavor: up.desc,
          cost: fmt(up.cost) + " sp",
          affordable,
          onClick: () => buyUpgrade(up),
        }),
      );
    }
    replaceChildren(dom.upgradeList, frag);
  }

  function renderAchievements() {
    const frag = document.createDocumentFragment();
    for (const a of ACHIEVEMENTS) {
      const unlocked = state.achievements.has(a.id);
      const li = document.createElement("li");
      li.className = "achievement" + (unlocked ? " unlocked" : "");
      li.textContent = unlocked ? a.icon : "?";
      li.tabIndex = 0;
      const tip = document.createElement("span");
      tip.className = "achievement-tooltip";
      const hd = document.createElement("strong");
      hd.textContent = a.name;
      tip.appendChild(hd);
      tip.appendChild(document.createTextNode(unlocked ? a.desc : "Locked: " + a.desc));
      li.appendChild(tip);
      frag.appendChild(li);
    }
    replaceChildren(dom.achievementList, frag);
    dom.achiCount.textContent = `${state.achievements.size}/${ACHIEVEMENTS.length}`;
  }

  function renderAscension() {
    const reward = computeAscendReward();
    if (reward > 0) {
      dom.ascendBtn.disabled = false;
      dom.ascendInfo.innerHTML = `Ascending now grants <strong>${reward}</strong> shard${reward === 1 ? "" : "s"} (each shard = +2% global). Sparks/generators/upgrades will reset; achievements stay.`;
    } else {
      dom.ascendBtn.disabled = true;
      dom.ascendInfo.textContent = ascendDeficitText();
    }
  }

  function renderStore() {
    renderGenerators();
    renderUpgrades();
    renderAscension();
  }

  function renderAll() {
    renderTopbar();
    renderStore();
    renderAchievements();
  }

  function replaceChildren(parent, newChild) {
    parent.innerHTML = "";
    parent.appendChild(newChild);
  }

  // ===== SAVE / LOAD =====
  function saveGame() {
    try {
      const data = {
        v: SAVE_VERSION,
        sp: state.sparks,
        ts: state.totalSparks,
        tc: state.totalClicks,
        tsp: state.totalSpent,
        gens: state.generators,
        ups: Array.from(state.upgrades),
        ach: Array.from(state.achievements),
        sh: state.shards,
        asc: state.ascensions,
        rs: state.runStart,
        lt: Date.now(),
        mu: state.muted,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (_e) {
      /* localStorage may be unavailable in private mode; ignore. */
    }
  }

  function loadGame() {
    let raw = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch (_e) {
      return;
    }
    if (!raw) return;
    let d;
    try {
      d = JSON.parse(raw);
    } catch (_e) {
      return;
    }
    if (!d || d.v !== SAVE_VERSION) return;

    state.sparks = Number(d.sp) || 0;
    state.totalSparks = Number(d.ts) || 0;
    state.totalClicks = Number(d.tc) || 0;
    state.totalSpent = Number(d.tsp) || 0;
    if (d.gens) {
      for (const g of GENERATORS) state.generators[g.id] = Number(d.gens[g.id]) || 0;
    }
    state.upgrades = new Set(Array.isArray(d.ups) ? d.ups : []);
    state.achievements = new Set(Array.isArray(d.ach) ? d.ach : []);
    state.shards = Number(d.sh) || 0;
    state.ascensions = Number(d.asc) || 0;
    state.runStart = Number(d.rs) || Date.now();
    state.muted = !!d.mu;

    // Offline progress
    if (d.lt) {
      const elapsedMs = Date.now() - Number(d.lt);
      if (elapsedMs > 5000) {
        const cap = MAX_OFFLINE_HOURS * 3600 * 1000;
        const eff = Math.min(elapsedMs, cap) / 1000;
        const r = totalRate();
        if (r > 0 && eff > 0) {
          const earned = r * eff * OFFLINE_EFFICIENCY;
          state.sparks += earned;
          state.totalSparks += earned;
          showToast(
            `Welcome back. While you were away (${fmtTime(elapsedMs / 1000)}):\n+${fmt(earned)} sparks (50% offline rate, capped at ${MAX_OFFLINE_HOURS}h).`,
            6500,
          );
        }
      }
    }
  }

  function hardReset() {
    if (!confirm("Wipe all Neon Forge progress? This cannot be undone.")) return;
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (_e) {
      /* ignore */
    }
    location.reload();
  }

  // ===== TICK LOOP =====
  let lastNow = performance.now();
  function tick(now) {
    const dt = Math.min(0.5, (now - lastNow) / 1000);
    lastNow = now;
    const r = totalRate();
    if (r > 0) {
      const gain = r * dt;
      state.sparks += gain;
      state.totalSparks += gain;
    }
    renderTopbar();
    requestAnimationFrame(tick);
  }

  // ===== EVENT WIRING =====
  function wireEvents() {
    initTouchCompat();
    bindTap(dom.anvilBtn, clickAnvil);
    // Spacebar / Enter triggers click while focused on the anvil
    dom.anvilBtn.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        clickAnvil(e);
      }
    });

    bindTap(dom.ascendBtn, openAscendModal);
    bindTap(dom.ascendCancel, closeAscendModal);
    bindTap(dom.ascendConfirm, performAscend);
    dom.ascendModal.addEventListener("click", (e) => {
      if (e.target === dom.ascendModal) closeAscendModal();
    });

    bindTap(dom.muteBtn, () => {
      state.muted = !state.muted;
      dom.muteBtn.textContent = state.muted ? "Unmute" : "Mute";
      saveGame();
    });
    dom.muteBtn.textContent = state.muted ? "Unmute" : "Mute";

    bindTap(dom.saveBtn, () => {
      saveGame();
      showToast("Saved.", 1500);
    });

    bindTap(dom.resetBtn, hardReset);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) saveGame();
    });
    window.addEventListener("beforeunload", saveGame);

    // Auto-save
    setInterval(saveGame, AUTO_SAVE_MS);
    // Re-render the store at a steady cadence; topbar is updated each frame.
    setInterval(() => {
      renderStore();
      checkAchievements();
    }, 1000 / STORE_RENDER_HZ);

    // ArcadeScores integration: log lifetime sparks each save so the lobby
    // can surface a leaderboard.
    if (typeof window.ArcadeScores !== "undefined" && typeof window.ArcadeScores.refresh === "function") {
      try {
        window.ArcadeScores.refresh("clicker");
      } catch (_e) {
        /* ignore */
      }
    }
    // Periodically record the best lifetime sparks.
    setInterval(() => {
      if (typeof window.ArcadeScores !== "undefined" && typeof window.ArcadeScores.record === "function") {
        try {
          window.ArcadeScores.record("clicker", Math.floor(state.totalSparks));
        } catch (_e) {
          /* ignore */
        }
      }
    }, 30000);
  }

  // ===== BOOT =====
  function boot() {
    loadGame();
    wireEvents();
    if (state.totalClicks > 0) {
      dom.anvilBtn.classList.add("has-clicked");
    }
    renderAll();
    requestAnimationFrame((t) => {
      lastNow = t;
      tick(t);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
