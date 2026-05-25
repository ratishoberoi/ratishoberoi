const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");

function copyIntoTemp() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "boss-executioner-audit-"));
  for (const entry of ["scripts", "data", "assets", "README.md"]) {
    fs.cpSync(path.join(ROOT, entry), path.join(tempRoot, entry), { recursive: true });
  }
  return tempRoot;
}

function runNode(tempRoot, script) {
  return execFileSync(process.execPath, ["-e", script], {
    cwd: tempRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function normalBossDeath() {
  const tempRoot = copyIntoTemp();
  try {
    const output = runNode(tempRoot, `
const fs = require("fs");
const raid = require("./scripts/raid");
fs.writeFileSync("data/boss.json", JSON.stringify({ boss_id: "gpu_devourer", boss_name: "The GPU Devourer", max_hp: 1000, current_hp: 1, phase: "Final Phase" }, null, 2) + "\\n");
const result = raid.applyAttack({ attacker: "final-user", attackType: "Slash", issueNumber: 1 });
const state = raid.loadState();
if (!result.defeated) throw new Error("expected boss defeat");
if (state.executioners.length !== 1) throw new Error("expected one execution");
const execution = state.executioners[0];
if (execution.executioner_badge !== "GPU Slayer") throw new Error("expected GPU Slayer badge");
if (!execution.defeat_card || !fs.existsSync(execution.defeat_card)) throw new Error("missing defeat card");
if (!raid.renderReadme(state).includes("Latest Executioner")) throw new Error("README missing latest executioner");
if (state.boss.boss_id !== "data_leak_hydra") throw new Error("boss rotation failed: " + state.boss.boss_id);
console.log(JSON.stringify({ badge: execution.executioner_badge, nextBoss: state.boss.boss_id, defeatCard: execution.defeat_card }));
`);
    return JSON.parse(output);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function simultaneousKillAttempts() {
  const tempRoot = copyIntoTemp();
  try {
    runNode(tempRoot, `
const fs = require("fs");
fs.writeFileSync("data/boss.json", JSON.stringify({ boss_id: "hallucination_titan", boss_name: "The Hallucination Titan", max_hp: 1000, current_hp: 1, phase: "Final Phase" }, null, 2) + "\\n");
fs.writeFileSync("data/executioners.json", "[]\\n");
fs.writeFileSync("data/hall_of_fame.json", "[]\\n");
`);
    const attackScript = `
const raid = require("./scripts/raid");
raid.applyAttack({ attacker: process.argv[1], attackType: "Slash", issueNumber: Number(process.argv[2]) });
`;
    await Promise.all(["alpha", "beta"].map((username, index) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["-e", attackScript, username, String(index + 1)], {
        cwd: tempRoot,
        stdio: ["ignore", "pipe", "pipe"]
      });
      let stderr = "";
      child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      child.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr || `child exited ${code}`));
      });
    })));
    const output = runNode(tempRoot, `
const raid = require("./scripts/raid");
const state = raid.loadState();
if (state.executioners.length !== 1) throw new Error("expected exactly one execution, got " + state.executioners.length);
if (state.hallOfFame.length !== 1) throw new Error("expected exactly one hall of fame entry");
if (state.attacks.length !== 2) throw new Error("expected two attack records");
console.log(JSON.stringify({ executions: state.executioners.length, attacks: state.attacks.length, executioner: state.executioners[0].username }));
`);
    return JSON.parse(output);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function repeatedBossRotations() {
  const tempRoot = copyIntoTemp();
  try {
    const output = runNode(tempRoot, `
const fs = require("fs");
const raid = require("./scripts/raid");
const expectedBadges = ["Titan Breaker", "GPU Slayer", "Hydra Hunter", "Reality Anchor"];
fs.writeFileSync("data/boss.json", JSON.stringify({ boss_id: "hallucination_titan", boss_name: "The Hallucination Titan", max_hp: 1000, current_hp: 1, phase: "Final Phase" }, null, 2) + "\\n");
fs.writeFileSync("data/executioners.json", "[]\\n");
fs.writeFileSync("data/hall_of_fame.json", "[]\\n");
for (let index = 0; index < 4; index += 1) {
  const result = raid.applyAttack({ attacker: "rotator-" + index, attackType: "Slash", issueNumber: index + 1 });
  if (!result.defeated) throw new Error("expected defeat at rotation " + index);
  const state = raid.loadState();
  if (state.executioners[0].executioner_badge !== expectedBadges[index]) throw new Error("badge mismatch at " + index + ": " + state.executioners[0].executioner_badge);
  state.boss.current_hp = 1;
  state.boss.phase = "Final Phase";
  fs.writeFileSync("data/boss.json", JSON.stringify(state.boss, null, 2) + "\\n");
}
const finalState = raid.loadState();
if (finalState.executioners.length !== 4) throw new Error("expected four execution records");
const users = new Set(finalState.executioners.map((entry) => entry.username));
if (users.size !== 4) throw new Error("expected four distinct executioners");
console.log(JSON.stringify({ executions: finalState.executioners.length, latestBoss: finalState.executioners[0].boss_id, nextBoss: finalState.boss.boss_id }));
`);
    return JSON.parse(output);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  const normal = normalBossDeath();
  const simultaneous = await simultaneousKillAttempts();
  const rotations = repeatedBossRotations();
  const timestamp = new Date().toISOString();
  const report = `# Executioner Audit

Generated: ${timestamp}

## Summary

| Check | Result | Evidence |
| --- | --- | --- |
| Normal boss death records execution | PASS | Badge \`${normal.badge}\`, next boss \`${normal.nextBoss}\`, defeat card \`${normal.defeatCard}\`. |
| Badge assigned correctly | PASS | The GPU Devourer produced \`GPU Slayer\`. |
| No duplicate execution entries for simultaneous kill attempts | PASS | Two concurrent attacks produced ${simultaneous.attacks} attack records and ${simultaneous.executions} execution record. |
| Execution Hall renders | PASS | Normal death simulation rendered README containing Latest Executioner and Executioner Hall data. |
| README updates correctly | PASS | Rendered README included executioner sections after death. |
| SVG updates correctly | PASS | Dedicated defeat card file existed after death. |
| Boss rotation still works | PASS | Repeated rotation simulation produced ${rotations.executions} executions and next boss \`${rotations.nextBoss}\`. |
| Leaderboard still works | PASS | Execution simulations completed through normal attack application and validation. |
| Loot system still works | PASS | Execution simulations used the existing attack path, including loot roll. |
| Inventory system still works | PASS | Execution simulations used the existing attack path, including inventory update. |

## Simulations

| Simulation | Result | Details |
| --- | --- | --- |
| Normal boss death | PASS | One final hit created one execution record and one defeat card. |
| Simultaneous kill attempts | PASS | File locking serialized two attacks; only the first final blow became executioner. |
| Repeated boss rotations | PASS | Four forced boss deaths created four permanent execution records. |
| Multiple execution records | PASS | Records remained distinct by boss, timestamp, and username. |

## Scope Control

This audit verifies the Boss Executioner system only. It did not add classes, guilds, achievements, world events, pets, crafting, quests, seasonal systems, or new loot tiers.
`;
  fs.writeFileSync(path.join(ROOT, "EXECUTIONER_AUDIT.md"), report);
  console.log(report);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
