/** Grid Sentinel — maps, towers, enemies, waves (data-only). */
window.GS_MAPS = (function () {
  "use strict";

  const TOWER_TYPES = [
    {
      id: "pulse",
      name: "Pulse",
      cost: 50,
      accent: "#7df9ff",
      range: 2.4,
      fireRate: 0.35,
      damage: 8,
      projectileSpeed: 14,
      splash: 0,
      slow: 0,
      chain: 0,
      desc: "Fast single-target blaster",
    },
    {
      id: "mortar",
      name: "Mortar",
      cost: 90,
      accent: "#ffe27a",
      range: 3.2,
      fireRate: 1.1,
      damage: 22,
      projectileSpeed: 7,
      splash: 1.1,
      slow: 0,
      chain: 0,
      desc: "Splash damage vs clusters",
    },
    {
      id: "frost",
      name: "Frost",
      cost: 75,
      accent: "#a8d8ff",
      range: 2.2,
      fireRate: 0.55,
      damage: 4,
      projectileSpeed: 10,
      splash: 0,
      slow: 0.45,
      chain: 0,
      desc: "Slows enemies on hit",
    },
    {
      id: "rail",
      name: "Rail",
      cost: 140,
      accent: "#ff6eb4",
      range: 4.5,
      fireRate: 1.6,
      damage: 55,
      projectileSpeed: 22,
      splash: 0,
      slow: 0,
      chain: 0,
      desc: "Long range, heavy hit",
    },
    {
      id: "tesla",
      name: "Tesla",
      cost: 110,
      accent: "#c77dff",
      range: 2.8,
      fireRate: 0.75,
      damage: 12,
      projectileSpeed: 18,
      splash: 0,
      slow: 0,
      chain: 3,
      desc: "Chain lightning · 3 targets",
    },
    {
      id: "sniper",
      name: "Sniper",
      cost: 160,
      accent: "#ff4757",
      range: 99,
      fireRate: 2.2,
      damage: 95,
      projectileSpeed: 30,
      splash: 0,
      slow: 0,
      chain: 0,
      desc: "Global range · anti-boss",
    },
  ];

  const ENEMY_TYPES = {
    scout: { name: "Scout", hp: 26, speed: 1.35, reward: 6, radius: 0.28, color: "#b8ff6a" },
    grunt: { name: "Grunt", hp: 52, speed: 0.95, reward: 10, radius: 0.32, color: "#ff9f43" },
    shield: { name: "Shield", hp: 115, speed: 0.72, reward: 18, radius: 0.38, color: "#7df9ff" },
    swarm: { name: "Swarm", hp: 15, speed: 1.55, reward: 4, radius: 0.22, color: "#e056fd" },
    boss: { name: "Boss", hp: 580, speed: 0.55, reward: 80, radius: 0.52, color: "#ff4757" },
  };

  const TRAITS = {
    armored: { label: "Armored", color: "#888899", pulseResist: 0.5 },
    fast: { label: "Fast", color: "#ffe27a", speedMult: 1.4 },
    regen: { label: "Regen", color: "#b8ff6a", regenPerSec: 2 },
    shielded: { label: "Shielded", color: "#7df9ff", shieldHp: 30 },
  };

  function wave(n, groups) {
    return { groups };
  }

  const CORE_WAVES = [
    wave(1, [{ type: "scout", count: 8, gap: 0.55 }]),
    wave(2, [{ type: "scout", count: 12, gap: 0.45 }]),
    wave(3, [{ type: "grunt", count: 6, gap: 0.7 }, { type: "scout", count: 6, gap: 0.4 }]),
    wave(4, [{ type: "swarm", count: 18, gap: 0.25 }]),
    wave(5, [{ type: "grunt", count: 8, gap: 0.55 }, { type: "shield", count: 2, gap: 1.2, traits: ["armored"] }]),
    wave(6, [{ type: "scout", count: 8, gap: 0.35, traits: ["fast"] }, { type: "swarm", count: 14, gap: 0.22 }]),
    wave(7, [{ type: "shield", count: 5, gap: 0.85, traits: ["shielded"] }]),
    wave(8, [{ type: "grunt", count: 12, gap: 0.5 }, { type: "scout", count: 6, gap: 0.4, traits: ["fast"] }]),
    wave(9, [{ type: "swarm", count: 22, gap: 0.18 }, { type: "shield", count: 3, gap: 0.9, traits: ["armored"] }]),
    wave(10, [{ type: "boss", count: 1, gap: 0 }, { type: "scout", count: 10, gap: 0.4 }]),
    wave(11, [{ type: "grunt", count: 10, gap: 0.45, traits: ["regen"] }, { type: "shield", count: 5, gap: 0.75 }]),
    wave(12, [{ type: "swarm", count: 28, gap: 0.16 }]),
    wave(13, [{ type: "shield", count: 7, gap: 0.65, traits: ["shielded", "armored"] }, { type: "grunt", count: 8, gap: 0.45 }]),
    wave(14, [{ type: "scout", count: 14, gap: 0.3, traits: ["fast"] }, { type: "boss", count: 1, gap: 2 }]),
    wave(15, [{ type: "grunt", count: 16, gap: 0.4, traits: ["regen"] }, { type: "shield", count: 6, gap: 0.6 }]),
    wave(16, [{ type: "swarm", count: 32, gap: 0.14 }, { type: "shield", count: 4, gap: 0.7, traits: ["shielded"] }]),
    wave(17, [{ type: "boss", count: 2, gap: 3 }, { type: "grunt", count: 10, gap: 0.45, traits: ["armored"] }]),
    wave(18, [{ type: "shield", count: 10, gap: 0.55, traits: ["regen"] }]),
    wave(19, [{ type: "swarm", count: 36, gap: 0.12 }, { type: "grunt", count: 12, gap: 0.35, traits: ["fast"] }]),
    wave(20, [
      { type: "boss", count: 2, gap: 2.5, traits: ["shielded"] },
      { type: "shield", count: 8, gap: 0.5, traits: ["armored"] },
      { type: "swarm", count: 18, gap: 0.15 },
    ]),
  ];

  const SPIRAL_PATH = [
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0], [14, 0], [15, 0],
    [15, 1], [15, 2], [15, 3], [15, 4], [15, 5], [15, 6], [15, 7], [15, 8],
    [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], [8, 8], [7, 8], [6, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
    [0, 7], [0, 6], [0, 5], [0, 4], [0, 3], [0, 2], [0, 1],
    [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1], [14, 1],
    [14, 2], [14, 3], [14, 4], [14, 5], [14, 6], [14, 7],
    [13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7], [7, 7], [6, 7], [5, 7], [4, 7], [3, 7], [2, 7], [1, 7],
    [1, 6], [1, 5], [1, 4], [1, 3], [1, 2],
    [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2],
    [13, 3], [13, 4], [13, 5], [13, 6],
    [12, 6], [11, 6], [10, 6], [9, 6], [8, 6], [7, 6], [6, 6], [5, 6], [4, 6], [3, 6], [2, 6],
    [2, 5], [2, 4], [2, 3],
    [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3], [12, 3],
    [12, 4], [12, 5],
    [11, 5], [10, 5], [9, 5], [8, 5], [7, 5], [6, 5], [5, 5], [4, 5], [3, 5],
    [3, 4],
    [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4],
    [11, 4],
    [7, 4],
  ].filter((p, i, arr) => i === 0 || p[0] !== arr[i - 1][0] || p[1] !== arr[i - 1][1]);

  // Fix spiral path end - use clean core at center
  const SPIRAL_PATH_CLEAN = [
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0], [14, 0], [15, 0],
    [15, 1], [15, 2], [15, 3], [15, 4], [15, 5], [15, 6], [15, 7], [15, 8],
    [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], [8, 8], [7, 8], [6, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
    [0, 7], [0, 6], [0, 5], [0, 4], [0, 3], [0, 2], [0, 1],
    [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1], [14, 1],
    [14, 2], [14, 3], [14, 4], [14, 5], [14, 6], [14, 7],
    [13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7], [7, 7], [6, 7], [5, 7], [4, 7], [3, 7], [2, 7], [1, 7],
    [1, 6], [1, 5], [1, 4], [1, 3], [1, 2],
    [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2],
    [13, 3], [13, 4], [13, 5], [13, 6],
    [12, 6], [11, 6], [10, 6], [9, 6], [8, 6], [7, 6],
  ];

  const SPLIT_PATH = [
    [7, 0], [7, 1], [7, 2], [7, 3],
    [6, 3], [5, 3], [4, 3], [3, 3], [2, 3], [1, 3], [0, 3],
    [0, 4], [0, 5], [0, 6], [0, 7], [0, 8],
    [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [15, 8],
    [15, 7], [15, 6], [15, 5], [15, 4], [15, 3],
    [14, 3], [13, 3], [12, 3], [11, 3], [10, 3], [9, 3], [8, 3],
    [8, 4], [8, 5], [8, 6], [8, 7],
    [9, 7], [10, 7], [11, 7], [12, 7], [13, 7], [14, 7],
    [14, 6], [14, 5], [14, 4],
    [13, 4], [12, 4], [11, 4], [10, 4], [9, 4],
    [9, 5], [9, 6],
    [10, 6], [11, 6], [12, 6], [13, 6],
    [13, 5],
    [12, 5], [11, 5], [10, 5],
    [10, 4],
    [11, 4], [12, 4],
    [11, 3],
    [7, 4], [7, 5], [7, 6], [7, 7],
  ].filter((p, i, arr) => i === 0 || p[0] !== arr[i - 1][0] || p[1] !== arr[i - 1][1]);

  const SPLIT_PATH_CLEAN = [
    [7, 0], [7, 1], [7, 2], [7, 3],
    [6, 3], [5, 3], [4, 3], [3, 3], [2, 3], [1, 3], [0, 3],
    [0, 4], [0, 5], [0, 6], [0, 7], [0, 8],
    [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [15, 8],
    [15, 7], [15, 6], [15, 5], [15, 4], [15, 3],
    [14, 3], [13, 3], [12, 3], [11, 3], [10, 3], [9, 3], [8, 3],
    [8, 4], [8, 5], [8, 6], [8, 7],
    [9, 7], [10, 7], [11, 7], [12, 7], [13, 7], [14, 7],
    [14, 6], [14, 5],
    [13, 5], [12, 5], [11, 5], [10, 5], [9, 5],
    [9, 6], [9, 7],
    [10, 7], [11, 7],
    [11, 6], [11, 5],
    [7, 4], [7, 5], [7, 6], [7, 7], [7, 8],
  ].filter((p, i, arr) => i === 0 || p[0] !== arr[i - 1][0] || p[1] !== arr[i - 1][1]);

  const CORE_PATH = [
    [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
    [6, 2], [6, 3], [6, 4],
    [5, 4], [4, 4], [3, 4], [2, 4], [1, 4], [0, 4],
    [0, 5], [0, 6],
    [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [15, 6],
    [15, 5], [15, 4], [15, 3], [15, 2],
    [14, 2], [13, 2], [12, 2], [11, 2], [10, 2], [9, 2], [8, 2],
    [8, 3], [8, 4], [8, 5],
    [9, 5], [10, 5], [11, 5], [12, 5], [13, 5], [14, 5],
    [14, 4], [14, 3],
    [13, 3], [12, 3], [11, 3], [10, 3], [9, 3],
    [9, 4],
    [10, 4], [11, 4], [12, 4], [13, 4],
  ];

  const SPIRAL_WAVES = CORE_WAVES.map((w, i) => {
    if (i < 4) return w;
    const groups = w.groups.map((g) => {
      if (g.type === "swarm" || g.type === "scout") {
        return { ...g, count: Math.ceil(g.count * 1.15) };
      }
      return g;
    });
    return { groups };
  });

  const SPLIT_WAVES = CORE_WAVES.map((w, i) => {
    if (i < 3) return w;
    const groups = w.groups.map((g) => ({
      ...g,
      count: g.type === "boss" ? g.count : Math.max(1, Math.ceil(g.count * 0.9)),
      gap: (g.gap ?? 0.6) * 1.05,
    }));
    return { groups };
  });

  const ACHIEVEMENTS = [
    { id: "no_leak_10", name: "Perfect Gate", desc: "Reach wave 10 without losing a life" },
    { id: "quad_build", name: "Arsenal", desc: "Win using 4+ tower types" },
    { id: "hard_win", name: "Hard Mode Hero", desc: "Clear all waves on Hard" },
    { id: "spiral_clear", name: "Spiral Master", desc: "Beat Spiral map" },
    { id: "split_clear", name: "Split Decision", desc: "Beat Split map" },
  ];

  return {
    TOWER_TYPES,
    ENEMY_TYPES,
    TRAITS,
    ACHIEVEMENTS,
    TARGET_MODES: ["first", "strong", "close"],
    maps: [
      {
        id: "core-run",
        name: "Core Run",
        blurb: "Classic serpentine · balanced waves",
        cols: 16,
        rows: 9,
        path: CORE_PATH,
        startGold: 120,
        startLives: 20,
        waves: CORE_WAVES,
      },
      {
        id: "spiral",
        name: "Spiral",
        blurb: "Tight coils · swarm heavy",
        cols: 16,
        rows: 9,
        path: SPIRAL_PATH_CLEAN,
        startGold: 130,
        startLives: 20,
        waves: SPIRAL_WAVES,
      },
      {
        id: "split",
        name: "Split",
        blurb: "Long fork · fewer pads",
        cols: 16,
        rows: 9,
        path: SPLIT_PATH_CLEAN,
        startGold: 140,
        startLives: 20,
        waves: SPLIT_WAVES,
      },
    ],
  };
})();
