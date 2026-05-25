const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const COUNTS = [10, 50, 100, 500];

function copyIntoTemp() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "boss-raid-stress-"));
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
let seed = ${count} * 7919;
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

const expectedTotals = new Map();
const expectedLootTotals = new Map();
let expectedAttackCount = 0;
let expectedHallCount = 0;
let expectedLegendaryHistory = 0;
const users = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"];
const attacks = Object.keys(raid.ATTACKS);

for (let index = 0; index < ${count}; index += 1) {
  const before = raid.loadState();
  const attacker = users[index % users.length];
  const attackType = attacks[index % attacks.length];
  const result = raid.applyAttack({ attacker, attackType, issueNumber: index + 1 });
  const after = raid.loadState();
  expectedAttackCount += 1;
  expectedTotals.set(attacker, (expectedTotals.get(attacker) || 0) + result.appliedDamage);
  expectedLootTotals.set(attacker, (expectedLootTotals.get(attacker) || 0) + 1);
  if (result.loot.rarity === "Legendary" || result.loot.rarity === "Mythic") expectedLegendaryHistory += 1;

  if (result.defeated) {
    expectedHallCount += 1;
    if (result.appliedDamage !== before.boss.current_hp) throw new Error("defeat applied damage mismatch");
    if (after.boss.current_hp !== after.boss.max_hp) throw new Error("new boss did not spawn at full HP");
  } else {
    const expectedHp = Math.max(0, before.boss.current_hp - result.rolledDamage);
    if (after.boss.current_hp !== expectedHp) throw new Error("HP mismatch after attack");
  }
}

const state = raid.loadState();
const errors = raid.validateStateInvariants(state);
if (errors.length) throw new Error(errors.join("; "));
for (const file of ["data/boss.json", "data/leaderboard.json", "data/attacks.json", "data/hall_of_fame.json", "data/loot_registry.json", "data/player_inventory.json", "data/legendary_drops.json"]) {
  JSON.parse(fs.readFileSync(file, "utf8"));
}
const seen = new Set();
for (const row of state.leaderboard) {
  if (seen.has(row.username)) throw new Error("duplicate leaderboard entry");
  seen.add(row.username);
  if (row.total_damage !== expectedTotals.get(row.username)) throw new Error("leaderboard total mismatch for " + row.username);
}
if (state.attacks.length !== expectedAttackCount) throw new Error("attack history count mismatch");
if (state.hallOfFame.length !== expectedHallCount) throw new Error("hall of fame count mismatch");
if (state.executioners.length !== expectedHallCount) throw new Error("executioner count mismatch");
if (state.legendaryDrops.length !== expectedLegendaryHistory) throw new Error("legendary history count mismatch");
let inventoryItemCount = 0;
for (const player of state.playerInventory) {
  const playerTotal = player.items.reduce((sum, item) => sum + item.quantity, 0);
  inventoryItemCount += playerTotal;
  if (playerTotal !== expectedLootTotals.get(player.username)) throw new Error("inventory total mismatch for " + player.username);
}
if (inventoryItemCount !== expectedAttackCount) throw new Error("inventory item count mismatch");
const readme = fs.readFileSync("README.md", "utf8");
const svg = fs.readFileSync("assets/boss-card.svg", "utf8");
if (readme !== raid.renderReadme(state)) throw new Error("README render mismatch");
if (svg !== raid.renderSvg(state)) throw new Error("SVG render mismatch");
if (!svg.trim().startsWith("<svg") || !svg.trim().endsWith("</svg>")) throw new Error("SVG is incomplete");
console.log(JSON.stringify({
  attacks: ${count},
  finalBoss: state.boss.boss_name,
  finalHp: state.boss.current_hp,
  maxHp: state.boss.max_hp,
  leaderboardRows: state.leaderboard.length,
  attackHistoryRows: state.attacks.length,
  hallOfFameRows: state.hallOfFame.length,
  inventoryRows: state.playerInventory.length,
  legendaryHistoryRows: state.legendaryDrops.length
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

const results = COUNTS.map(runSimulation);
const timestamp = new Date().toISOString();
const table = results.map((result) => (
  `| ${result.attacks} | ${result.ok ? "PASS" : "FAIL"} | ${result.finalBoss} | ${result.finalHp} / ${result.maxHp} | ${result.leaderboardRows} | ${result.attackHistoryRows} | ${result.hallOfFameRows} | ${result.inventoryRows} | ${result.legendaryHistoryRows} |`
)).join("\n");

const report = `# Stress Test Report

Generated: ${timestamp}

## Summary

All simulations were run in isolated temporary repository copies. The working repository state was not mutated by the simulations.

| Attack Count | Result | Final Boss | Final HP | Leaderboard Rows | Attack History Rows | Hall of Fame Rows | Inventory Players | Legendary History Rows |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
${table}

## Checks Per Simulation

- HP after every attack matched the rolled damage and clamp rules.
- Boss death recorded a hall-of-fame entry and spawned the next boss at full HP.
- Leaderboard totals matched the sum of applied damage per attacker.
- No duplicate leaderboard entries were present.
- Inventory totals matched one loot drop per successful attack.
- Legendary and Mythic drops were permanently recorded.
- JSON files parsed after the run.
- README and SVG matched deterministic regeneration from final state.
- SVG output had a complete root document.
`;

fs.writeFileSync(path.join(ROOT, "STRESS_TEST_REPORT.md"), report);
console.log(report);
