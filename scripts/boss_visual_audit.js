const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const REQUIRED_BOSSES = [
  "hallucination_titan",
  "gpu_devourer",
  "data_leak_hydra",
  "gradient_vanisher",
  "overfitted_beast",
  "prompt_goblin"
];
const REQUIRED_FIELDS = ["id", "name", "title", "lore", "theme", "phase_1", "phase_2", "phase_3", "phase_4"];

function parseJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validateSvgXml(filePath) {
  const code = `
import xml.etree.ElementTree as ET
ET.parse(${JSON.stringify(filePath)})
`;
  execFileSync("python3", ["-c", code], { stdio: ["ignore", "pipe", "pipe"] });
}

function copyIntoTemp() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "boss-visual-audit-"));
  for (const entry of ["scripts", "data", "assets", "README.md"]) {
    fs.cpSync(path.join(ROOT, entry), path.join(tempRoot, entry), { recursive: true });
  }
  return tempRoot;
}

function validateRegistry() {
  const registry = parseJson("data/boss_registry.json");
  const ids = registry.map((boss) => boss.id);
  for (const id of REQUIRED_BOSSES) {
    assert(ids.includes(id), `missing boss registry id: ${id}`);
  }
  for (const boss of registry) {
    for (const field of REQUIRED_FIELDS) {
      assert(typeof boss[field] === "string" && boss[field].trim(), `boss ${boss.id} missing ${field}`);
    }
  }
  return registry;
}

function validateBossSvgs(registry) {
  const rows = [];
  for (const boss of registry) {
    for (let phase = 1; phase <= 4; phase += 1) {
      const relativePath = `assets/bosses/${boss.id}_p${phase}.svg`;
      const filePath = path.join(ROOT, relativePath);
      assert(fs.existsSync(filePath), `missing ${relativePath}`);
      const svg = fs.readFileSync(filePath, "utf8");
      validateSvgXml(filePath);
      assert(svg.includes("@keyframes"), `${relativePath} missing animation keyframes`);
      assert(/animation:/.test(svg), `${relativePath} missing animation styles`);
      assert(svg.includes(`PHASE ${phase}`), `${relativePath} missing phase label`);
      rows.push({ boss: boss.name, phase, path: relativePath });
    }
  }
  return rows;
}

function validateReadmePath() {
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const match = readme.match(/\.\/(assets\/bosses\/[a-z0-9_]+_p[1-4]\.svg)/);
  assert(match, "README does not include a boss phase SVG path");
  assert(fs.existsSync(path.join(ROOT, match[1])), `README boss image path missing: ${match[1]}`);
  return match[1];
}

function validatePhaseSwitching() {
  const raid = require("./raid");
  const base = raid.loadState();
  const checks = [
    { hp: 1000, phase: "Phase 1", image: "hallucination_titan_p1.svg" },
    { hp: 700, phase: "Phase 2", image: "hallucination_titan_p2.svg" },
    { hp: 400, phase: "Phase 3", image: "hallucination_titan_p3.svg" },
    { hp: 100, phase: "Final Phase", image: "hallucination_titan_p4.svg" }
  ];

  for (const check of checks) {
    const state = raid.normalizeState({
      ...base,
      boss: {
        boss_id: "hallucination_titan",
        boss_name: "The Hallucination Titan",
        max_hp: 1000,
        current_hp: check.hp,
        phase: "Phase 1"
      }
    });
    const readme = raid.renderReadme(state);
    assert(readme.includes(check.phase), `phase switching missing ${check.phase}`);
    assert(readme.includes(check.image), `phase switching did not select ${check.image}`);
  }
}

function validateRotationAndDefeatPanel() {
  const tempRoot = copyIntoTemp();
  try {
    const script = `
const fs = require("fs");
const raid = require("./scripts/raid");
fs.writeFileSync("data/boss.json", JSON.stringify({
  boss_id: "hallucination_titan",
  boss_name: "The Hallucination Titan",
  max_hp: 1000,
  current_hp: 1,
  phase: "Final Phase"
}, null, 2) + "\\n");
const result = raid.applyAttack({ attacker: "visual-auditor", attackType: "Slash", issueNumber: 1 });
const state = raid.loadState();
if (!result.defeated) throw new Error("expected defeat");
if (state.boss.boss_id !== "gpu_devourer") throw new Error("expected gpu_devourer, got " + state.boss.boss_id);
if (!state.hallOfFame[0].boss_image.endsWith("hallucination_titan_p4.svg")) throw new Error("defeat image missing");
if (!raid.renderReadme(state).includes("Cinematic Defeat Archive")) throw new Error("defeat panel missing");
console.log(JSON.stringify({ nextBoss: state.boss.boss_id, defeatImage: state.hallOfFame[0].boss_image }));
`;
    return JSON.parse(execFileSync(process.execPath, ["-e", script], {
      cwd: tempRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim());
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

const timestamp = new Date().toISOString();
const registry = validateRegistry();
const svgRows = validateBossSvgs(registry);
const readmePath = validateReadmePath();
validatePhaseSwitching();
const rotation = validateRotationAndDefeatPanel();

const reportRows = svgRows.map((row) => (
  `| ${row.boss} | Phase ${row.phase} | ${row.path} | PASS |`
)).join("\n");

const report = `# Boss Visual Audit

Generated: ${timestamp}

## Summary

| Check | Result |
| --- | --- |
| Boss registry contains all required bosses and fields | PASS |
| All 24 boss phase SVG files exist | PASS |
| All boss phase SVG files parse as XML | PASS |
| Animation keyframes and animation styles exist in each SVG | PASS |
| README current boss image path exists | PASS |
| Phase image switching selects p1, p2, p3, and p4 correctly | PASS |
| Boss rotation after defeat advances to the next registry boss | PASS |
| Hall of Fame defeat panel stores and renders boss image metadata | PASS |

## Current README Boss Image

\`${readmePath}\`

## Rotation Check

Temporary defeat simulation spawned \`${rotation.nextBoss}\` and stored \`${rotation.defeatImage}\`.

## SVG Asset Matrix

| Boss | Phase | Path | Result |
| --- | --- | --- | --- |
${reportRows}

## Notes

- The audit validates SVG XML structure and animation declarations locally.
- Visual pixel rendering inside GitHub cannot be executed locally, but paths, XML validity, and animation style declarations were verified.
- Attack damage mechanics, loot roll logic, and inventory update logic were not modified for this visual pass.
`;

fs.writeFileSync(path.join(ROOT, "BOSS_VISUAL_AUDIT.md"), report);
console.log(report);
