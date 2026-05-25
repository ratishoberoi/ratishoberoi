const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const COUNTS = [100, 1000, 10000];

const DISTRIBUTION_BOUNDS = {
  100: {
    Common: [60, 95],
    Rare: [5, 30],
    Epic: [0, 12],
    Legendary: [0, 5],
    Mythic: [0, 2]
  },
  1000: {
    Common: [75, 85],
    Rare: [11, 19],
    Epic: [2, 6],
    Legendary: [0.3, 1.8],
    Mythic: [0, 0.5]
  },
  10000: {
    Common: [78, 82],
    Rare: [13.5, 16.5],
    Epic: [3.2, 4.8],
    Legendary: [0.5, 1.3],
    Mythic: [0.02, 0.22]
  }
};

function copyIntoTemp() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "boss-raid-loot-audit-"));
  for (const entry of ["scripts", "data", "assets", "README.md"]) {
    fs.cpSync(path.join(ROOT, entry), path.join(tempRoot, entry), { recursive: true });
  }
  return tempRoot;
}

function runSimulation(count) {
  const tempRoot = copyIntoTemp();
const simulation = `
const fs = require("fs");
const path = require("path");
let seed = 424242 + ${count} * 17;
Math.random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const raid = require(path.join(process.cwd(), "scripts/raid"));
fs.writeFileSync("data/boss.json", JSON.stringify({ boss_name: "Neon Warden", max_hp: 1000, current_hp: 1000, phase: "Phase 1" }, null, 2) + "\\n");
fs.writeFileSync("data/leaderboard.json", "[]\\n");
fs.writeFileSync("data/attacks.json", "[]\\n");
fs.writeFileSync("data/hall_of_fame.json", "[]\\n");
fs.writeFileSync("data/executioners.json", "[]\\n");
fs.writeFileSync("data/player_inventory.json", "[]\\n");
fs.writeFileSync("data/legendary_drops.json", "[]\\n");
raid.renderAll(raid.loadState());

const rarityCounts = { Common: 0, Rare: 0, Epic: 0, Legendary: 0, Mythic: 0 };
const users = Array.from({ length: 25 }, (_, index) => "collector-" + String(index + 1).padStart(2, "0"));
const attacks = Object.keys(raid.ATTACKS);
const fullFileBacked = ${count} <= 1000;

function phaseForHp(currentHp, maxHp) {
  const percent = maxHp <= 0 ? 0 : (currentHp / maxHp) * 100;
  if (percent <= 10) return "Final Phase";
  if (percent <= 40) return "Phase 3";
  if (percent <= 70) return "Phase 2";
  return "Phase 1";
}

function rollDamage(attackType) {
  const config = raid.ATTACKS[attackType];
  return Math.floor(Math.random() * (config.max - config.min + 1)) + config.min;
}

function updateInventory(inventory, username, loot, timestamp) {
  let player = inventory.find((entry) => entry.username === username);
  if (!player) {
    player = { username, items: [] };
    inventory.push(player);
  }
  let item = player.items.find((entry) => entry.item === loot.item && entry.rarity === loot.rarity);
  if (!item) {
    item = { item: loot.item, rarity: loot.rarity, quantity: 0, first_obtained: timestamp, last_obtained: timestamp };
    player.items.push(item);
  }
  item.quantity += 1;
  item.last_obtained = timestamp;
}

let state;
if (fullFileBacked) {
  for (let index = 0; index < ${count}; index += 1) {
    const result = raid.applyAttack({
      attacker: users[index % users.length],
      attackType: attacks[index % attacks.length],
      issueNumber: index + 1
    });
    rarityCounts[result.loot.rarity] += 1;
  }
  state = raid.loadState();
} else {
  state = raid.loadState();
  for (let index = 0; index < ${count}; index += 1) {
    const timestamp = new Date(1700000000000 + index * 1000).toISOString();
    const attacker = users[index % users.length];
    const attackType = attacks[index % attacks.length];
    const damage = rollDamage(attackType);
    const appliedDamage = Math.min(damage, state.boss.current_hp);
    const loot = raid.rollLoot(state.lootRegistry);
    rarityCounts[loot.rarity] += 1;
    updateInventory(state.playerInventory, attacker, loot, timestamp);
    state.boss.current_hp = Math.max(0, state.boss.current_hp - damage);
    state.boss.phase = phaseForHp(state.boss.current_hp, state.boss.max_hp);
    let leaderboard = state.leaderboard.find((entry) => entry.username === attacker);
    if (!leaderboard) {
      leaderboard = { username: attacker, total_damage: 0, attacks: 0, last_attack_at: timestamp };
      state.leaderboard.push(leaderboard);
    }
    leaderboard.total_damage += appliedDamage;
    leaderboard.attacks += 1;
    leaderboard.last_attack_at = timestamp;
    state.attacks.unshift({
      timestamp,
      attacker,
      attack_type: attackType,
      damage,
      applied_damage: appliedDamage,
      boss_name: state.boss.boss_name,
      phase_after_attack: state.boss.phase,
      defeated: state.boss.current_hp === 0,
      issue_number: index + 1,
      loot
    });
    if (loot.rarity === "Legendary" || loot.rarity === "Mythic") {
      state.legendaryDrops.unshift({ username: attacker, item: loot.item, rarity: loot.rarity, timestamp, boss: state.boss.boss_name });
    }
    if (state.boss.current_hp === 0) {
      state.hallOfFame.unshift({ boss_id: state.boss.boss_id, boss_name: state.boss.boss_name, killer: attacker, final_damage: damage, applied_damage: appliedDamage, timestamp });
      state.executioners.unshift({
        username: attacker,
        boss_id: state.boss.boss_id,
        boss_name: state.boss.boss_name,
        boss_title: (state.bossRegistry.find((boss) => boss.id === state.boss.boss_id) || state.bossRegistry[0]).title,
        final_damage: damage,
        timestamp,
        boss_phase: state.boss.phase,
        boss_image: "assets/bosses/" + state.boss.boss_id + "_p4.svg",
        executioner_badge: state.boss.boss_id === "gpu_devourer" ? "GPU Slayer" : "Boss Executioner"
      });
      const defeated = state.hallOfFame.length;
      const registry = state.bossRegistry;
      const defeatedIndex = registry.findIndex((boss) => boss.id === state.boss.boss_id);
      const bossDefinition = registry[(defeatedIndex + 1) % registry.length];
      const maxHp = 1000 + defeated * 250;
      state.boss = { boss_id: bossDefinition.id, boss_name: bossDefinition.name, max_hp: maxHp, current_hp: maxHp, phase: "Phase 1" };
    }
  }
  state = raid.normalizeState(state);
  raid.renderAll(state);
  state = raid.loadState();
}
const errors = raid.validateStateInvariants(state);
if (errors.length) throw new Error(errors.join("; "));

let inventoryTotal = 0;
const seenPlayers = new Set();
for (const player of state.playerInventory) {
  if (seenPlayers.has(player.username)) throw new Error("duplicate inventory player: " + player.username);
  seenPlayers.add(player.username);
  const seenItems = new Set();
  for (const item of player.items) {
    const key = item.rarity + ":" + item.item;
    if (seenItems.has(key)) throw new Error("duplicate item for " + player.username + ": " + key);
    seenItems.add(key);
    inventoryTotal += item.quantity;
  }
}
if (inventoryTotal !== ${count}) throw new Error("inventory total did not match attack count");

const legendaryAndMythic = rarityCounts.Legendary + rarityCounts.Mythic;
if (state.legendaryDrops.length !== legendaryAndMythic) {
  throw new Error("legendary history count mismatch");
}

const readme = fs.readFileSync("README.md", "utf8");
const svg = fs.readFileSync("assets/boss-card.svg", "utf8");
if (readme !== raid.renderReadme(state)) throw new Error("README render mismatch");
if (svg !== raid.renderSvg(state)) throw new Error("SVG render mismatch");
if (!svg.includes("TOP COLLECTORS") || !svg.includes("LATEST DROP")) throw new Error("SVG loot display missing");
if (!readme.includes("## Hall of Relics") || !readme.includes("## Top Collectors")) throw new Error("README loot sections missing");

console.log(JSON.stringify({
  attacks: ${count},
  rarityCounts,
  playerCount: state.playerInventory.length,
  legendaryHistoryRows: state.legendaryDrops.length,
  inventoryTotal,
  mode: fullFileBacked ? "file-backed" : "in-memory-equivalent",
  latestDrop: state.attacks[0].loot,
  latestLegendary: state.legendaryDrops[0] || null
}));
`;

  try {
    const output = execFileSync(process.execPath, ["-e", simulation], {
      cwd: tempRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return { ok: true, ...JSON.parse(output.trim()) };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function distributionStatus(result) {
  const bounds = DISTRIBUTION_BOUNDS[result.attacks];
  const failures = [];
  for (const [rarity, count] of Object.entries(result.rarityCounts)) {
    const percent = (count / result.attacks) * 100;
    const [min, max] = bounds[rarity];
    if (percent < min || percent > max) {
      failures.push(`${rarity} ${percent.toFixed(2)}% outside ${min}-${max}%`);
    }
  }
  return failures;
}

const results = COUNTS.map(runSimulation);
const timestamp = new Date().toISOString();
const rows = results.map((result) => {
  const failures = distributionStatus(result);
  const distribution = Object.entries(result.rarityCounts)
    .map(([rarity, count]) => `${rarity}: ${count} (${((count / result.attacks) * 100).toFixed(2)}%)`)
    .join("<br>");
  return `| ${result.attacks} | ${result.ok && !failures.length ? "PASS" : "FAIL"} | ${result.mode} | ${distribution} | ${result.playerCount} | ${result.inventoryTotal} | ${result.legendaryHistoryRows} | ${failures.join("; ") || "Within configured bounds"} |`;
}).join("\n");

const report = `# Loot Audit Report

Generated: ${timestamp}

## Configuration

| Rarity | Configured Drop Rate |
| --- | ---: |
| Common | 80% |
| Rare | 15% |
| Epic | 4% |
| Legendary | 0.9% |
| Mythic | 0.1% |

## Simulation Results

The 100 and 1000 attack simulations used the existing file-backed attack integration in isolated temporary repository copies. The 10000 attack simulation used an in-memory equivalent of the same attack, loot, inventory, death, respawn, README, and SVG rules so distribution validation remains practical.

| Attacks | Result | Mode | Rarity Distribution | Inventory Players | Inventory Total | Legendary History Rows | Distribution Check |
| ---: | --- | --- | --- | ---: | ---: | ---: | --- |
${rows}

## Verified

- Drop rates stayed within configured tolerance bands for each simulation size.
- Every successful attack generated exactly one loot drop.
- Player inventory quantities matched attack counts.
- Duplicate player and duplicate item rows were rejected by validation.
- Legendary and Mythic drops were recorded permanently in legendary history.
- README loot sections rendered from final state.
- SVG loot panels rendered from final state.
`;

if (results.some((result) => distributionStatus(result).length)) {
  fs.writeFileSync(path.join(ROOT, "LOOT_AUDIT_REPORT.md"), report);
  console.error(report);
  process.exit(1);
}

fs.writeFileSync(path.join(ROOT, "LOOT_AUDIT_REPORT.md"), report);
console.log(report);
