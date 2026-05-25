const fs = require("fs");
const path = require("path");
const {
  loadState,
  renderReadme,
  renderSvg,
  validateStateInvariants
} = require("./raid");

const ROOT = path.join(__dirname, "..");
const jsonFiles = [
  "data/boss.json",
  "data/boss_registry.json",
  "data/executioners.json",
  "data/leaderboard.json",
  "data/attacks.json",
  "data/hall_of_fame.json",
  "data/loot_registry.json",
  "data/player_inventory.json",
  "data/legendary_drops.json"
];

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

for (const file of jsonFiles) {
  try {
    JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
  } catch (error) {
    fail(`${file} is not valid JSON: ${error.message}`);
  }
}

const state = loadState();
const invariantErrors = validateStateInvariants(state);
if (invariantErrors.length) {
  fail(`State invariant errors:\n${invariantErrors.map((error) => `- ${error}`).join("\n")}`);
}

const expectedReadme = renderReadme(state);
const actualReadme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
if (actualReadme !== expectedReadme) {
  fail("README.md is not in sync with rendered state. Run node scripts/render_readme.js.");
}

const expectedSvg = renderSvg(state);
const actualSvg = fs.readFileSync(path.join(ROOT, "assets/boss-card.svg"), "utf8");
if (actualSvg !== expectedSvg) {
  fail("assets/boss-card.svg is not in sync with rendered state. Run node scripts/render_readme.js.");
}

if (!actualSvg.trim().startsWith("<svg") || !actualSvg.trim().endsWith("</svg>")) {
  fail("assets/boss-card.svg does not look like a complete SVG document.");
}

for (const execution of state.executioners) {
  if (!execution.defeat_card) {
    fail(`Execution for ${execution.username} is missing defeat_card.`);
  }
  const defeatCardPath = path.join(ROOT, execution.defeat_card);
  if (!fs.existsSync(defeatCardPath)) {
    fail(`Missing defeat card: ${execution.defeat_card}. Run node scripts/render_readme.js.`);
  }
}

console.log("validation ok");
