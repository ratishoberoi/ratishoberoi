const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const ASSETS_DIR = path.join(ROOT, "assets");
const BOSS_PHASE_ART_DIR = path.join(ASSETS_DIR, "boss_phases");

const BOSS_PATH = path.join(DATA_DIR, "boss.json");
const LEADERBOARD_PATH = path.join(DATA_DIR, "leaderboard.json");
const ATTACKS_PATH = path.join(DATA_DIR, "attacks.json");
const HALL_OF_FAME_PATH = path.join(DATA_DIR, "hall_of_fame.json");
const BOSS_REGISTRY_PATH = path.join(DATA_DIR, "boss_registry.json");
const EXECUTIONERS_PATH = path.join(DATA_DIR, "executioners.json");
const LOOT_REGISTRY_PATH = path.join(DATA_DIR, "loot_registry.json");
const PLAYER_INVENTORY_PATH = path.join(DATA_DIR, "player_inventory.json");
const LEGENDARY_DROPS_PATH = path.join(DATA_DIR, "legendary_drops.json");
const LOCK_PATH = path.join(DATA_DIR, ".raid.lock");
const README_PATH = path.join(ROOT, "README.md");
const SVG_PATH = path.join(ASSETS_DIR, "boss-card.svg");
const BOSS_ASSET_DIR = path.join(ASSETS_DIR, "bosses");
const DEFEAT_ASSET_DIR = path.join(ASSETS_DIR, "defeats");

const DEFAULT_BOSS = {
  boss_id: "hallucination_titan",
  boss_name: "The Hallucination Titan",
  max_hp: 1000,
  current_hp: 1000,
  phase: "Phase 1"
};

const DEFAULT_BOSS_REGISTRY = [
  {
    id: "hallucination_titan",
    name: "The Hallucination Titan",
    title: "Corrupted AI God",
    lore: "A towering oracle that speaks in impossible outputs and bends reality around false predictions.",
    theme: "Corrupted AI god",
    phase_1: "Normal form: a luminous titan wrapped in stable prediction rings.",
    phase_2: "Mutated form: duplicate faces split from its skull and argue across the arena.",
    phase_3: "Corrupted form: error sigils tear through its body as hallucinated limbs emerge.",
    phase_4: "Final Nightmare form: a fractured godhead broadcasting contradictory realities."
  }
];

const ATTACKS = {
  "Slash": { min: 5, max: 20 },
  "Critical Strike": { min: 0, max: 100 },
  "Lucky Attack": { min: 1, max: 500 }
};

const RARITIES = ["Common", "Rare", "Epic", "Legendary", "Mythic"];

const DEFAULT_LOOT_REGISTRY = {
  drop_rates: {
    Common: 80,
    Rare: 15,
    Epic: 4,
    Legendary: 0.9,
    Mythic: 0.1
  },
  items: {
    Common: ["Broken Dataset", "Corrupted CSV", "Memory Fragment", "Lost Token"],
    Rare: ["Neural Fragment", "Gradient Crystal", "Training Core", "Prompt Shard"],
    Epic: ["Ancient GPU", "Quantum Cache", "Model Heart", "Tensor Prism"],
    Legendary: ["Golden Tensor", "AGI Fragment", "Infinity Prompt", "Neural Crown"],
    Mythic: ["Source Code of Consciousness", "The First Model", "The Final Dataset"]
  }
};

const NEXT_BOSSES = [
  "Chrome Revenant",
  "Circuit Lich",
  "Void Compiler",
  "Quantum Tyrant",
  "Null Hydra",
  "Obsidian Daemon",
  "Static Overlord",
  "Cipher Colossus"
];

const BOSS_CAMPAIGN_ORDER = [
  "gpu_devourer",
  "data_leak_hydra",
  "gradient_vanisher",
  "hallucination_titan",
  "overfitted_beast",
  "prompt_goblin"
];

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  fs.mkdirSync(BOSS_PHASE_ART_DIR, { recursive: true });
  fs.mkdirSync(BOSS_ASSET_DIR, { recursive: true });
  fs.mkdirSync(DEFEAT_ASSET_DIR, { recursive: true });
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function warn(message) {
  process.stderr.write(`[raid] ${message}\n`);
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return deepClone(fallback);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    warn(`Recovering from malformed JSON in ${path.relative(ROOT, filePath)}: ${error.message}`);
    return deepClone(fallback);
  }
}

function fsyncDirectory(dirPath) {
  try {
    const dirFd = fs.openSync(dirPath, "r");
    try {
      fs.fsyncSync(dirFd);
    } finally {
      fs.closeSync(dirFd);
    }
  } catch (_error) {
    // Directory fsync is best-effort across platforms.
  }
}

function atomicWriteFile(filePath, contents) {
  ensureDirs();
  const dirPath = path.dirname(filePath);
  const tempPath = path.join(
    dirPath,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );
  const fd = fs.openSync(tempPath, "w");
  try {
    fs.writeFileSync(fd, contents);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tempPath, filePath);
  fsyncDirectory(dirPath);
}

function writeJson(filePath, value) {
  atomicWriteFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withFileLock(callback) {
  ensureDirs();
  const staleMs = 5 * 60 * 1000;
  const started = Date.now();

  while (Date.now() - started < 10000) {
    let fd = null;
    try {
      fd = fs.openSync(LOCK_PATH, "wx");
      fs.writeFileSync(fd, `${process.pid}\n${new Date().toISOString()}\n`);
      return callback();
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }

      try {
        const stat = fs.statSync(LOCK_PATH);
        if (Date.now() - stat.mtimeMs > staleMs) {
          fs.unlinkSync(LOCK_PATH);
          continue;
        }
      } catch (statError) {
        if (statError.code !== "ENOENT") {
          throw statError;
        }
      }

      sleepSync(100);
    } finally {
      if (fd !== null) {
        fs.closeSync(fd);
        try {
          fs.unlinkSync(LOCK_PATH);
        } catch (unlockError) {
          if (unlockError.code !== "ENOENT") {
            throw unlockError;
          }
        }
      }
    }
  }

  throw new Error("Timed out waiting for raid state lock.");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return clamp(Math.round(number), min, max);
}

function singleLine(value, fallback = "", maxLength = 120) {
  const text = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = text || fallback;
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function truncate(value, maxLength) {
  const text = singleLine(value, "", maxLength + 1);
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 3))}...` : text;
}

function sanitizeUsername(value) {
  const raw = singleLine(value, "unknown", 80).replace(/^@+/, "");
  const cleaned = raw
    .replace(/[^A-Za-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 39)
    .replace(/^-+|-+$/g, "");

  if (!cleaned) {
    return "unknown";
  }
  return cleaned;
}

function markdownCell(value) {
  return singleLine(value, "", 160)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\|/g, "\\|");
}

function markdownUser(username) {
  return `@${markdownCell(sanitizeUsername(username))}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function validTimestamp(value) {
  const text = singleLine(value, "", 40);
  return Number.isFinite(Date.parse(text)) ? text : new Date(0).toISOString();
}

function rollDamage(attackType) {
  const config = ATTACKS[attackType];
  if (!config) {
    throw new Error(`Unknown attack type: ${attackType}`);
  }
  return Math.floor(Math.random() * (config.max - config.min + 1)) + config.min;
}

function phaseForHp(currentHp, maxHp) {
  const percent = maxHp <= 0 ? 0 : (currentHp / maxHp) * 100;
  if (percent <= 10) return "Final Phase";
  if (percent <= 40) return "Phase 3";
  if (percent <= 70) return "Phase 2";
  return "Phase 1";
}

function hpPercent(boss) {
  if (!boss.max_hp) return 0;
  return clamp(Math.round((boss.current_hp / boss.max_hp) * 100), 0, 100);
}

function progressBar(percent, width = 24) {
  const safePercent = toInteger(percent, 0, 0, 100);
  const filled = Math.round((safePercent / 100) * width);
  return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
}

function slugify(value, fallback = "boss") {
  const slug = singleLine(value, fallback, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || fallback;
}

function normalizeBossDefinition(rawBoss, index = 0) {
  if (!isObject(rawBoss)) return null;
  const id = slugify(rawBoss.id || rawBoss.name || `boss_${index + 1}`, `boss_${index + 1}`);
  const name = singleLine(rawBoss.name, DEFAULT_BOSS.boss_name, 64);
  return {
    id,
    name,
    title: singleLine(rawBoss.title, "Raid Entity", 80),
    lore: singleLine(rawBoss.lore, "No lore signal available.", 220),
    theme: singleLine(rawBoss.theme, "Unknown anomaly", 100),
    phase_1: singleLine(rawBoss.phase_1, "Normal form.", 180),
    phase_2: singleLine(rawBoss.phase_2, "Mutated form.", 180),
    phase_3: singleLine(rawBoss.phase_3, "Corrupted form.", 180),
    phase_4: singleLine(rawBoss.phase_4, "Final Nightmare form.", 180)
  };
}

function normalizeBossRegistry(rawRegistry) {
  const source = Array.isArray(rawRegistry) && rawRegistry.length ? rawRegistry : DEFAULT_BOSS_REGISTRY;
  const byId = new Map();
  for (const [index, rawBoss] of source.entries()) {
    const boss = normalizeBossDefinition(rawBoss, index);
    if (boss && !byId.has(boss.id)) {
      byId.set(boss.id, boss);
    }
  }
  return byId.size ? [...byId.values()] : deepClone(DEFAULT_BOSS_REGISTRY);
}

function bossById(registry, id) {
  return registry.find((boss) => boss.id === id) || registry[0] || DEFAULT_BOSS_REGISTRY[0];
}

function bossByName(registry, name) {
  const safeName = singleLine(name, "", 80).toLowerCase();
  return registry.find((boss) => boss.name.toLowerCase() === safeName) || null;
}

function phaseNumberForBoss(boss) {
  if (boss.phase === "Final Phase") return 4;
  const match = String(boss.phase || "").match(/Phase\s+([123])/i);
  return match ? Number(match[1]) : 1;
}

function phaseKeyForBoss(boss) {
  return `phase_${phaseNumberForBoss(boss)}`;
}

function bossImagePathFor(boss, forcePhaseNumber = null) {
  const id = slugify(boss.boss_id || boss.id || boss.boss_name, DEFAULT_BOSS.boss_id);
  const phaseNumber = forcePhaseNumber || phaseNumberForBoss(boss);
  return `assets/bosses/${id}_p${phaseNumber}.svg`;
}

function bossPhasePngPathFor(definition, phaseNumber) {
  const id = slugify(definition.id || definition.name, DEFAULT_BOSS.boss_id);
  return `../boss_phases/${id}_p${phaseNumber}.png`;
}

function bossPhaseAssetPath(bossOrDefinition, phaseNumber, extension) {
  const id = slugify(
    bossOrDefinition.boss_id || bossOrDefinition.id || bossOrDefinition.boss_name || bossOrDefinition.name,
    DEFAULT_BOSS.boss_id
  );
  return `assets/boss_phases/${id}_p${phaseNumber}.${extension}`;
}

function currentBossGifPathFor(boss) {
  return bossPhaseAssetPath(boss, phaseNumberForBoss(boss), "gif");
}

function bossPhasePngReadmePathFor(bossOrDefinition, phaseNumber) {
  return bossPhaseAssetPath(bossOrDefinition, phaseNumber, "png");
}

function bossFinalFormPngReadmePathFor(bossOrDefinition) {
  return bossPhasePngReadmePathFor(bossOrDefinition, 4);
}

function executionerBadgeForBoss(bossId, bossName) {
  const badges = {
    gpu_devourer: "GPU Slayer",
    hallucination_titan: "Titan Breaker",
    data_leak_hydra: "Hydra Hunter",
    gradient_vanisher: "Reality Anchor",
    overfitted_beast: "Beast Tamer",
    prompt_goblin: "Prompt Exorcist"
  };
  const id = slugify(bossId || bossName, DEFAULT_BOSS.boss_id);
  return badges[id] || `${singleLine(bossName, "Boss", 40).replace(/^The\s+/i, "")} Executioner`;
}

function defeatCardPathForExecution(execution) {
  const id = slugify(execution.boss_id || execution.boss_name, DEFAULT_BOSS.boss_id);
  const timestampSlug = singleLine(execution.timestamp, new Date(0).toISOString(), 40).replace(/[^0-9TZ]/g, "");
  const username = sanitizeUsername(execution.username);
  return `assets/defeats/${id}_${timestampSlug}_${username}.svg`;
}

function bossThreatLevel(boss) {
  const phaseNumber = phaseNumberForBoss(boss);
  const percent = hpPercent(boss);
  if (phaseNumber === 4 || percent <= 10) return "APOCALYPSE";
  if (phaseNumber === 3 || percent <= 40) return "SEVERE";
  if (phaseNumber === 2 || percent <= 70) return "ELEVATED";
  return "ACTIVE";
}

function corruptionLevel(boss) {
  return clamp(100 - hpPercent(boss), 0, 100);
}

function dangerMeter(boss, width = 24) {
  return progressBar(corruptionLevel(boss), width);
}

function phaseProgressLine(boss) {
  const current = phaseNumberForBoss(boss);
  return [1, 2, 3, 4].map((phaseNumber) => {
    const label = phaseNumber === 4 ? "Phase 4" : `Phase ${phaseNumber}`;
    if (phaseNumber < current) return `✓ ${label}`;
    if (phaseNumber === current) return `🔥 ${label}`;
    return `🔒 ${label}`;
  }).join(" → ");
}

function phasesRemaining(boss) {
  return Math.max(0, 4 - phaseNumberForBoss(boss));
}

function normalizeBoss(rawBoss, registry = DEFAULT_BOSS_REGISTRY) {
  const source = isObject(rawBoss) ? rawBoss : DEFAULT_BOSS;
  const registryMatch = source.boss_id
    ? bossById(registry, slugify(source.boss_id, DEFAULT_BOSS.boss_id))
    : bossByName(registry, source.boss_name);
  const bossId = registryMatch ? registryMatch.id : slugify(source.boss_id || source.boss_name || DEFAULT_BOSS.boss_id, DEFAULT_BOSS.boss_id);
  const bossName = registryMatch ? registryMatch.name : singleLine(source.boss_name, DEFAULT_BOSS.boss_name, 64);
  const maxHp = toInteger(source.max_hp, DEFAULT_BOSS.max_hp, 1, 10000000);
  const currentHp = toInteger(source.current_hp, maxHp, 0, maxHp);
  const boss = {
    boss_id: bossId,
    boss_name: bossName,
    max_hp: maxHp,
    current_hp: currentHp,
    phase: phaseForHp(currentHp, maxHp)
  };
  return boss;
}

function normalizeLeaderboard(rawLeaderboard) {
  const rows = Array.isArray(rawLeaderboard) ? rawLeaderboard : [];
  const byUser = new Map();

  for (const row of rows) {
    if (!isObject(row)) continue;
    const username = sanitizeUsername(row.username);
    const current = byUser.get(username) || {
      username,
      total_damage: 0,
      attacks: 0,
      last_attack_at: new Date(0).toISOString()
    };
    current.total_damage += toInteger(row.total_damage, 0, 0, 1000000000);
    current.attacks += toInteger(row.attacks, 0, 0, 1000000000);
    const timestamp = validTimestamp(row.last_attack_at);
    if (Date.parse(timestamp) > Date.parse(current.last_attack_at)) {
      current.last_attack_at = timestamp;
    }
    byUser.set(username, current);
  }

  return [...byUser.values()].sort((a, b) => (
    b.total_damage - a.total_damage || a.username.localeCompare(b.username)
  ));
}

function normalizeAttackRecord(rawAttack) {
  if (!isObject(rawAttack)) return null;
  const attackType = ATTACKS[rawAttack.attack_type] ? rawAttack.attack_type : "Unknown";
  const record = {
    timestamp: validTimestamp(rawAttack.timestamp),
    attacker: sanitizeUsername(rawAttack.attacker),
    attack_type: attackType,
    damage: toInteger(rawAttack.damage, 0, 0, 1000000000),
    applied_damage: toInteger(rawAttack.applied_damage, 0, 0, 1000000000),
    boss_name: singleLine(rawAttack.boss_name, DEFAULT_BOSS.boss_name, 48),
    phase_after_attack: singleLine(rawAttack.phase_after_attack, "Phase 1", 20),
    defeated: Boolean(rawAttack.defeated),
    issue_number: rawAttack.issue_number === null || rawAttack.issue_number === undefined
      ? null
      : toInteger(rawAttack.issue_number, 0, 0, 1000000000)
  };
  const loot = normalizeLootDrop(rawAttack.loot);
  if (loot) {
    record.loot = loot;
  }
  return record;
}

function normalizeAttacks(rawAttacks) {
  const rows = Array.isArray(rawAttacks) ? rawAttacks : [];
  return rows.map(normalizeAttackRecord).filter(Boolean);
}

function normalizeHallOfFame(rawHallOfFame) {
  const rows = Array.isArray(rawHallOfFame) ? rawHallOfFame : [];
  return rows.filter(isObject).map((entry) => ({
    boss_id: slugify(entry.boss_id || entry.boss_name, DEFAULT_BOSS.boss_id),
    boss_name: singleLine(entry.boss_name, DEFAULT_BOSS.boss_name, 48),
    boss_image: singleLine(entry.boss_image, bossImagePathFor({ boss_id: entry.boss_id || entry.boss_name, phase: "Final Phase" }, 4), 160),
    killer: sanitizeUsername(entry.killer),
    final_damage: toInteger(entry.final_damage, 0, 0, 1000000000),
    applied_damage: toInteger(entry.applied_damage, 0, 0, 1000000000),
    timestamp: validTimestamp(entry.timestamp || entry.defeated_at)
  }));
}

function normalizeLootDrop(rawLoot) {
  if (!isObject(rawLoot)) return null;
  const rarity = RARITIES.includes(rawLoot.rarity) ? rawLoot.rarity : null;
  const item = singleLine(rawLoot.item, "", 80);
  if (!rarity || !item) return null;
  return { item, rarity };
}

function normalizeLootRegistry(rawRegistry) {
  const source = isObject(rawRegistry) ? rawRegistry : DEFAULT_LOOT_REGISTRY;
  const sourceRates = isObject(source.drop_rates) ? source.drop_rates : DEFAULT_LOOT_REGISTRY.drop_rates;
  const sourceItems = isObject(source.items) ? source.items : DEFAULT_LOOT_REGISTRY.items;
  const dropRates = {};
  const items = {};

  for (const rarity of RARITIES) {
    const rate = Number(sourceRates[rarity]);
    dropRates[rarity] = Number.isFinite(rate) && rate >= 0
      ? Number(rate.toFixed(4))
      : DEFAULT_LOOT_REGISTRY.drop_rates[rarity];
    const configuredItems = Array.isArray(sourceItems[rarity]) ? sourceItems[rarity] : DEFAULT_LOOT_REGISTRY.items[rarity];
    const normalizedItems = configuredItems
      .map((item) => singleLine(item, "", 80))
      .filter(Boolean);
    items[rarity] = normalizedItems.length ? [...new Set(normalizedItems)] : DEFAULT_LOOT_REGISTRY.items[rarity];
  }

  const total = RARITIES.reduce((sum, rarity) => sum + dropRates[rarity], 0);
  if (total <= 0) {
    return deepClone(DEFAULT_LOOT_REGISTRY);
  }

  return {
    drop_rates: dropRates,
    items
  };
}

function normalizePlayerInventory(rawInventory) {
  const players = Array.isArray(rawInventory) ? rawInventory : [];
  const byUser = new Map();

  for (const player of players) {
    if (!isObject(player)) continue;
    const username = sanitizeUsername(player.username);
    const current = byUser.get(username) || { username, items: [] };
    const byItem = new Map(current.items.map((item) => [`${item.rarity}:${item.item}`, item]));
    const rawItems = Array.isArray(player.items) ? player.items : [];

    for (const rawItem of rawItems) {
      if (!isObject(rawItem)) continue;
      const rarity = RARITIES.includes(rawItem.rarity) ? rawItem.rarity : null;
      const item = singleLine(rawItem.item, "", 80);
      if (!rarity || !item) continue;
      const key = `${rarity}:${item}`;
      const existing = byItem.get(key) || {
        item,
        rarity,
        quantity: 0,
        first_obtained: validTimestamp(rawItem.first_obtained),
        last_obtained: validTimestamp(rawItem.last_obtained)
      };
      existing.quantity += toInteger(rawItem.quantity, 0, 0, 1000000000);
      const first = validTimestamp(rawItem.first_obtained);
      const last = validTimestamp(rawItem.last_obtained);
      if (Date.parse(first) < Date.parse(existing.first_obtained)) existing.first_obtained = first;
      if (Date.parse(last) > Date.parse(existing.last_obtained)) existing.last_obtained = last;
      byItem.set(key, existing);
    }

    current.items = [...byItem.values()]
      .filter((item) => item.quantity > 0)
      .sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || b.quantity - a.quantity || a.item.localeCompare(b.item));
    byUser.set(username, current);
  }

  return [...byUser.values()].sort((a, b) => {
    const aStats = inventoryStatsForPlayer(a);
    const bStats = inventoryStatsForPlayer(b);
    return bStats.totalItems - aStats.totalItems || bStats.uniqueItems - aStats.uniqueItems || a.username.localeCompare(b.username);
  });
}

function normalizeLegendaryDrops(rawDrops) {
  const drops = Array.isArray(rawDrops) ? rawDrops : [];
  return drops.filter(isObject).map((drop) => {
    const rarity = ["Legendary", "Mythic"].includes(drop.rarity) ? drop.rarity : null;
    const item = singleLine(drop.item, "", 80);
    if (!rarity || !item) return null;
    return {
      username: sanitizeUsername(drop.username),
      item,
      rarity,
      timestamp: validTimestamp(drop.timestamp),
      boss: singleLine(drop.boss, DEFAULT_BOSS.boss_name, 48)
    };
  }).filter(Boolean);
}

function normalizeExecutioners(rawExecutioners) {
  const rows = Array.isArray(rawExecutioners) ? rawExecutioners : [];
  return rows.filter(isObject).map((entry) => {
    const bossId = slugify(entry.boss_id || entry.boss_name, DEFAULT_BOSS.boss_id);
    const bossName = singleLine(entry.boss_name, DEFAULT_BOSS.boss_name, 64);
    const timestamp = validTimestamp(entry.timestamp);
    const normalized = {
      username: sanitizeUsername(entry.username),
      boss_id: bossId,
      boss_name: bossName,
      boss_title: singleLine(entry.boss_title, "Raid Entity", 80),
      final_damage: toInteger(entry.final_damage, 0, 0, 1000000000),
      timestamp,
      boss_phase: singleLine(entry.boss_phase, "Final Phase", 20),
      boss_image: singleLine(entry.boss_image, `assets/bosses/${bossId}_p4.svg`, 160),
      executioner_badge: singleLine(entry.executioner_badge, executionerBadgeForBoss(bossId, bossName), 80)
    };
    normalized.defeat_card = singleLine(entry.defeat_card, defeatCardPathForExecution(normalized), 180);
    return normalized;
  });
}

function normalizeState(state) {
  const bossRegistry = normalizeBossRegistry(state.bossRegistry);
  return {
    bossRegistry,
    boss: normalizeBoss(state.boss, bossRegistry),
    leaderboard: normalizeLeaderboard(state.leaderboard),
    attacks: normalizeAttacks(state.attacks),
    hallOfFame: normalizeHallOfFame(state.hallOfFame),
    executioners: normalizeExecutioners(state.executioners),
    lootRegistry: normalizeLootRegistry(state.lootRegistry),
    playerInventory: normalizePlayerInventory(state.playerInventory),
    legendaryDrops: normalizeLegendaryDrops(state.legendaryDrops)
  };
}

function loadState() {
  ensureDirs();
  return normalizeState({
    bossRegistry: readJson(BOSS_REGISTRY_PATH, DEFAULT_BOSS_REGISTRY),
    boss: readJson(BOSS_PATH, DEFAULT_BOSS),
    leaderboard: readJson(LEADERBOARD_PATH, []),
    attacks: readJson(ATTACKS_PATH, []),
    hallOfFame: readJson(HALL_OF_FAME_PATH, []),
    executioners: readJson(EXECUTIONERS_PATH, []),
    lootRegistry: readJson(LOOT_REGISTRY_PATH, DEFAULT_LOOT_REGISTRY),
    playerInventory: readJson(PLAYER_INVENTORY_PATH, []),
    legendaryDrops: readJson(LEGENDARY_DROPS_PATH, [])
  });
}

function saveState(state) {
  const normalized = normalizeState(state);
  writeJson(BOSS_REGISTRY_PATH, normalized.bossRegistry);
  writeJson(BOSS_PATH, normalized.boss);
  writeJson(LEADERBOARD_PATH, normalized.leaderboard);
  writeJson(ATTACKS_PATH, normalized.attacks);
  writeJson(HALL_OF_FAME_PATH, normalized.hallOfFame);
  writeJson(EXECUTIONERS_PATH, normalized.executioners);
  writeJson(LOOT_REGISTRY_PATH, normalized.lootRegistry);
  writeJson(PLAYER_INVENTORY_PATH, normalized.playerInventory);
  writeJson(LEGENDARY_DROPS_PATH, normalized.legendaryDrops);
}

function updateLeaderboard(leaderboard, attacker, damage, timestamp) {
  const username = sanitizeUsername(attacker);
  const row = leaderboard.find((entry) => entry.username === username);
  if (row) {
    row.total_damage += damage;
    row.attacks += 1;
    row.last_attack_at = timestamp;
  } else {
    leaderboard.push({
      username,
      total_damage: damage,
      attacks: 1,
      last_attack_at: timestamp
    });
  }
  leaderboard.sort((a, b) => b.total_damage - a.total_damage || a.username.localeCompare(b.username));
}

function rollLoot(lootRegistry) {
  const registry = normalizeLootRegistry(lootRegistry);
  const total = RARITIES.reduce((sum, rarity) => sum + registry.drop_rates[rarity], 0);
  let roll = Math.random() * total;
  let selectedRarity = RARITIES[0];

  for (const rarity of RARITIES) {
    roll -= registry.drop_rates[rarity];
    if (roll < 0) {
      selectedRarity = rarity;
      break;
    }
  }

  const items = registry.items[selectedRarity];
  const item = items[Math.floor(Math.random() * items.length)];
  return { item, rarity: selectedRarity };
}

function updateInventory(playerInventory, username, loot, timestamp) {
  const safeUsername = sanitizeUsername(username);
  const player = playerInventory.find((entry) => entry.username === safeUsername) || {
    username: safeUsername,
    items: []
  };
  if (!playerInventory.includes(player)) {
    playerInventory.push(player);
  }

  const item = player.items.find((entry) => entry.item === loot.item && entry.rarity === loot.rarity);
  if (item) {
    item.quantity += 1;
    item.last_obtained = timestamp;
    return item.quantity;
  }

  player.items.push({
    item: loot.item,
    rarity: loot.rarity,
    quantity: 1,
    first_obtained: timestamp,
    last_obtained: timestamp
  });
  player.items.sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || b.quantity - a.quantity || a.item.localeCompare(b.item));
  return 1;
}

function inventoryStatsForPlayer(player) {
  const items = Array.isArray(player.items) ? player.items : [];
  const counts = Object.fromEntries(RARITIES.map((rarity) => [rarity, 0]));
  let totalItems = 0;
  for (const item of items) {
    const quantity = toInteger(item.quantity, 0, 0, 1000000000);
    totalItems += quantity;
    if (RARITIES.includes(item.rarity)) {
      counts[item.rarity] += quantity;
    }
  }
  return {
    totalItems,
    uniqueItems: items.length,
    legendaryItems: counts.Legendary,
    mythicItems: counts.Mythic,
    counts
  };
}

function inventoryTotals(playerInventory) {
  const totals = Object.fromEntries(RARITIES.map((rarity) => [rarity, 0]));
  let totalItems = 0;
  let uniqueCollectors = 0;

  for (const player of playerInventory) {
    uniqueCollectors += 1;
    const stats = inventoryStatsForPlayer(player);
    totalItems += stats.totalItems;
    for (const rarity of RARITIES) {
      totals[rarity] += stats.counts[rarity];
    }
  }

  return { totalItems, uniqueCollectors, rarityTotals: totals };
}

function topCollectors(playerInventory, limit = 10) {
  return [...playerInventory].sort((a, b) => {
    const aStats = inventoryStatsForPlayer(a);
    const bStats = inventoryStatsForPlayer(b);
    return bStats.totalItems - aStats.totalItems
      || bStats.mythicItems - aStats.mythicItems
      || bStats.legendaryItems - aStats.legendaryItems
      || bStats.uniqueItems - aStats.uniqueItems
      || a.username.localeCompare(b.username);
  }).slice(0, limit);
}

function topExecutioners(executioners, limit = 10) {
  const byUser = new Map();
  for (const execution of executioners) {
    const username = sanitizeUsername(execution.username);
    const current = byUser.get(username) || {
      username,
      execution_count: 0,
      first_execution: execution.timestamp,
      latest_execution: execution.timestamp
    };
    current.execution_count += 1;
    if (Date.parse(execution.timestamp) < Date.parse(current.first_execution)) current.first_execution = execution.timestamp;
    if (Date.parse(execution.timestamp) > Date.parse(current.latest_execution)) current.latest_execution = execution.timestamp;
    byUser.set(username, current);
  }
  return [...byUser.values()].sort((a, b) => (
    b.execution_count - a.execution_count
    || Date.parse(b.latest_execution) - Date.parse(a.latest_execution)
    || a.username.localeCompare(b.username)
  )).slice(0, limit);
}

function spawnNextBoss(hallOfFameCount, bossRegistry = DEFAULT_BOSS_REGISTRY, defeatedBossId = null) {
  const registry = normalizeBossRegistry(bossRegistry);
  const defeatedIndex = registry.findIndex((boss) => boss.id === defeatedBossId);
  const index = defeatedIndex >= 0
    ? (defeatedIndex + 1) % registry.length
    : Math.max(0, hallOfFameCount) % registry.length;
  const bossDefinition = registry[index];
  const maxHp = 1000 + hallOfFameCount * 250;
  return {
    boss_id: bossDefinition.id,
    boss_name: bossDefinition.name,
    max_hp: maxHp,
    current_hp: maxHp,
    phase: "Phase 1"
  };
}

function repositorySlug() {
  if (process.env.GITHUB_REPOSITORY) {
    return process.env.GITHUB_REPOSITORY;
  }

  try {
    const remote = execSync("git config --get remote.origin.url", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    const match = remote.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/);
    return match ? match[1] : null;
  } catch (_error) {
    return null;
  }
}

function attackIssueUrl() {
  const slug = repositorySlug();
  return slug
    ? `https://github.com/${slug}/issues/new?template=attack.yml`
    : "../../issues/new?template=attack.yml";
}

function parseAttackType(issueBody) {
  const body = String(issueBody || "");
  const match = body.match(/^###\s*Attack Type\s*\r?\n+([\s\S]*?)(?=^\s*###\s|\s*$)/im);
  if (!match) {
    return null;
  }

  const candidate = match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => !line.startsWith("_No response_"));

  return candidate ? singleLine(candidate, "", 80) : null;
}

function applyAttack({ attacker, attackType, issueNumber }) {
  return withFileLock(() => {
    if (!ATTACKS[attackType]) {
      throw new Error(`Unsupported attack type "${singleLine(attackType, "missing", 80)}". Use Slash, Critical Strike, or Lucky Attack.`);
    }

    const state = loadState();
    const timestamp = new Date().toISOString();
    const username = sanitizeUsername(attacker);
    const bossBefore = { ...state.boss };
    const rolledDamage = rollDamage(attackType);
    const appliedDamage = Math.min(rolledDamage, state.boss.current_hp);
    const loot = rollLoot(state.lootRegistry);
    const inventoryCount = updateInventory(state.playerInventory, username, loot, timestamp);

    state.boss.current_hp = clamp(state.boss.current_hp - rolledDamage, 0, state.boss.max_hp);
    state.boss.phase = phaseForHp(state.boss.current_hp, state.boss.max_hp);
    updateLeaderboard(state.leaderboard, username, appliedDamage, timestamp);

    const defeated = state.boss.current_hp === 0;
    const attackRecord = {
      timestamp,
      attacker: username,
      attack_type: attackType,
      damage: rolledDamage,
      applied_damage: appliedDamage,
      boss_name: bossBefore.boss_name,
      phase_after_attack: state.boss.phase,
      defeated,
      issue_number: issueNumber ? toInteger(issueNumber, 0, 0, 1000000000) : null,
      loot
    };
    state.attacks.unshift(attackRecord);

    if (loot.rarity === "Legendary" || loot.rarity === "Mythic") {
      state.legendaryDrops.unshift({
        username,
        item: loot.item,
        rarity: loot.rarity,
        timestamp,
        boss: bossBefore.boss_name
      });
    }

    let defeatedBoss = null;
    let execution = null;
    if (defeated) {
      const bossDefinition = bossById(state.bossRegistry, bossBefore.boss_id);
      const executionerBadge = executionerBadgeForBoss(bossBefore.boss_id, bossBefore.boss_name);
      execution = {
        username,
        boss_id: bossBefore.boss_id,
        boss_name: bossBefore.boss_name,
        boss_title: bossDefinition.title,
        final_damage: rolledDamage,
        timestamp,
        boss_phase: bossBefore.phase,
        boss_image: bossImagePathFor(bossBefore, 4),
        executioner_badge: executionerBadge
      };
      execution.defeat_card = defeatCardPathForExecution(execution);
      state.executioners.unshift(execution);

      defeatedBoss = {
        boss_id: bossBefore.boss_id,
        boss_name: bossBefore.boss_name,
        boss_image: bossImagePathFor(bossBefore, 4),
        killer: username,
        executioner_badge: executionerBadge,
        defeat_card: execution.defeat_card,
        final_damage: rolledDamage,
        applied_damage: appliedDamage,
        timestamp
      };
      state.hallOfFame.unshift(defeatedBoss);
      state.boss = spawnNextBoss(state.hallOfFame.length, state.bossRegistry, bossBefore.boss_id);
    }

    saveState(state);
    renderAll(state);

    return {
      attacker: username,
      attackType,
      rolledDamage,
      appliedDamage,
      defeated,
      defeatedBoss,
      execution,
      bossBefore,
      bossAfter: state.boss,
      loot,
      inventoryCount
    };
  });
}

function renderReadme(state = loadState()) {
  const safeState = normalizeState(state);
  const boss = safeState.boss;
  const bossDefinition = bossById(safeState.bossRegistry, boss.boss_id);
  const percent = hpPercent(boss);
  const bossImage = currentBossGifPathFor(boss);
  const phaseDescription = bossDefinition[phaseKeyForBoss(boss)];

  return `${renderProfileHero()}

## Visitor Intro

${renderVisitorIntro()}

## About Me

${renderProfileAbout()}

# 🔥 GLOBAL RAID ACTIVE

## Current Boss

<p align="center">
  <img src="./${bossImage}" alt="${markdownCell(boss.boss_name)} raid encounter" width="100%">
</p>

## ${markdownCell(boss.boss_name.toUpperCase())}

### ${markdownCell(bossDefinition.title)}

**HP ${boss.current_hp} / ${boss.max_hp} (${percent}%)**  
\`${progressBar(percent)}\`

**${markdownCell(boss.phase)} of 4**  
${markdownCell(phaseDescription)}

<p align="center">
  <strong>⬇⬇⬇ RAIDERS, STRIKE NOW ⬇⬇⬇</strong>
</p>

<h1 align="center">
  <a href="${attackIssueUrl()}">⚔ ATTACK THIS BOSS ⚔</a>
</h1>

<p align="center">
  <strong>⬆⬆⬆ CLICK TO ROLL DAMAGE + CLAIM LOOT ⬆⬆⬆</strong>
</p>

Takes 10 seconds. Roll damage. Claim loot. Maybe land the killing blow.

## Raid Rules

${renderRaidRules(safeState)}

<details>
<summary>Loot Vault</summary>

${renderLootTease(safeState)}

### Hall of Relics

${renderHallOfRelics(safeState)}

### Latest Drops

${renderLatestDrops(safeState.attacks)}

### Legendary Discoveries

${renderDiscoveryTable(safeState.legendaryDrops, "Legendary")}

### Mythic Discoveries

${renderDiscoveryTable(safeState.legendaryDrops, "Mythic")}

### Top Collectors

${renderTopCollectors(safeState.playerInventory)}

### Recent Loot

${renderRecentLoot(safeState.attacks)}

</details>

## 🏆 TOP RAIDERS

${renderTopRaidersSection(safeState)}

## ⚔ RECENT COMBAT

${renderRecentCombatSection(safeState)}

## Live Pulse

${renderLivePulse(safeState)}

## Phase Evolution

${renderPhaseEvolutionStrip(boss, bossDefinition)}

## WORLD BOSS CAMPAIGN

${renderWorldBossCampaign(safeState)}

## NEXT THREAT

${renderNextThreat(safeState)}

## Executioners

${renderLatestExecutioner(safeState.executioners)}

<details>
<summary>Executioner Records</summary>

## 👑 Executioner Hall

${renderExecutionerHall(safeState.executioners)}

## Top Executioners

${renderTopExecutioners(safeState.executioners)}

</details>

## Hall of Fame

<details>
<summary>Defeated Bosses</summary>

${renderHallOfFame(safeState.hallOfFame)}

</details>

## Key Achievements

${renderProfileAchievements()}

## Featured Projects

${renderFeaturedProjects()}

## Tech Stack

${renderTechStack()}

## GitHub Stats

${renderGitHubStats()}

## Contact

${renderProfileContact()}

<!-- This README is generated by scripts/render_readme.js. -->
`;
}

function renderProfileHero() {
  return `<div align="center">

# RATISH OBEROI

### EX-CTO • AI/ML ENGINEER • SYSTEM BUILDER

**Raised ₹1 Cr+ Pre-Seed Funding**

Building AI systems, LLM infrastructure, developer platforms, and intelligent automation.

\`\`\`
AI SYSTEMS................................................[ ACTIVE ]
LLM INFRASTRUCTURE........................................[ BUILDING ]
AUTOMATION PLATFORMS......................................[ SHIPPING ]
PROFILE RAID..............................................[ LIVE ]
\`\`\`

</div>`;
}

function renderVisitorIntro() {
  return `This is not a traditional GitHub profile.

You are entering a live AI portfolio and interactive world boss raid. Fight bosses, earn loot, climb the leaderboard, and explore the systems, products, and AI engineering work behind the profile.`;
}

function renderProfileAbout() {
  return `I build AI systems, intelligent developer tools, automation platforms, and production-grade software from concept to deployment.

I am an **Ex-CTO**, **AI/ML Engineer**, **Full Stack Engineer**, and **System Builder** with experience raising **₹1 Cr+ in Pre-Seed funding** and building technical products end to end.

Current focus areas:

- Artificial Intelligence and Machine Learning systems
- LLM systems, RAG pipelines, and retrieval infrastructure
- Deep Learning, Computer Vision, and NLP
- AI infrastructure, automation systems, and developer platforms
- Full stack product engineering from architecture to deployment`;
}

function renderProfileAchievements() {
  return `- Raised **₹1 Cr+ Pre-Seed funding** for a technology venture.
- Operated as **CTO**, owning product architecture, engineering execution, and technical direction.
- Built AI/ML systems end to end across model development, backend services, automation, and deployment.
- Designed production automation systems using GitHub Actions, stateful workflows, and generated interfaces.
- Built a GitHub-native raid platform with dynamic README rendering, stateful gameplay, execution history, and campaign progression.`;
}

function renderFeaturedProjects() {
  return `### FORGE

**Flagship project: multi-model AI engineering platform.**

Forge focuses on multi-model orchestration, AI coding workflows, model routing, agentic execution, and LLM infrastructure for serious engineering work.

### REPOMIND AI

**AI-powered repository intelligence platform.**

RepoMind AI is designed for codebase understanding, repository analysis, AI search, developer productivity, and knowledge extraction from complex software systems.

### VERITAS RAG

**Production-grade Retrieval-Augmented Generation system.**

Veritas RAG focuses on RAG pipelines, document intelligence, semantic retrieval, vector search, and grounded knowledge generation.

### GITHUB BOSS RAID

**Interactive GitHub-native world boss campaign.**

GitHub Boss Raid uses GitHub Actions, issue forms, stateful gameplay, dynamic README generation, loot, executioners, and campaign progression entirely inside GitHub.`;
}

function renderTechStack() {
  return `### Languages

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![C++](https://img.shields.io/badge/C++-00599C?style=for-the-badge&logo=c%2B%2B&logoColor=white)
![Java](https://img.shields.io/badge/Java-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![SQL](https://img.shields.io/badge/SQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)

### AI / ML

![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)
![TensorFlow](https://img.shields.io/badge/TensorFlow-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)
![Hugging Face](https://img.shields.io/badge/Hugging%20Face-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)
![Transformers](https://img.shields.io/badge/Transformers-111827?style=for-the-badge)
![OpenCV](https://img.shields.io/badge/OpenCV-27338e?style=for-the-badge&logo=opencv&logoColor=white)
![Scikit--Learn](https://img.shields.io/badge/Scikit--Learn-F7931E?style=for-the-badge&logo=scikitlearn&logoColor=white)
![Pandas](https://img.shields.io/badge/Pandas-150458?style=for-the-badge&logo=pandas&logoColor=white)
![NumPy](https://img.shields.io/badge/NumPy-013243?style=for-the-badge&logo=numpy&logoColor=white)

### LLM / RAG

![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=for-the-badge)
![Vector Databases](https://img.shields.io/badge/Vector%20Databases-4F46E5?style=for-the-badge)
![Embeddings](https://img.shields.io/badge/Embeddings-7C3AED?style=for-the-badge)
![Retrieval Systems](https://img.shields.io/badge/Retrieval%20Systems-0F766E?style=for-the-badge)
![RAG Pipelines](https://img.shields.io/badge/RAG%20Pipelines-B91C1C?style=for-the-badge)

### Backend

![Django](https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

### Frontend

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)

### Databases

![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

### DevOps / Infrastructure

![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)
![Jenkins](https://img.shields.io/badge/Jenkins-D24939?style=for-the-badge&logo=jenkins&logoColor=white)
![Terraform](https://img.shields.io/badge/Terraform-844FBA?style=for-the-badge&logo=terraform&logoColor=white)
![MLflow](https://img.shields.io/badge/MLflow-0194E2?style=for-the-badge)
![Airflow](https://img.shields.io/badge/Airflow-017CEE?style=for-the-badge&logo=apacheairflow&logoColor=white)
![Prometheus](https://img.shields.io/badge/Prometheus-E6522C?style=for-the-badge&logo=prometheus&logoColor=white)
![Grafana](https://img.shields.io/badge/Grafana-F46800?style=for-the-badge&logo=grafana&logoColor=white)`;
}

function renderGitHubStats() {
  return `<div align="center">

<img src="https://github-profile-summary-cards.vercel.app/api/cards/profile-details?username=ratishoberoi&theme=github_dark" width="100%" alt="Ratish Oberoi GitHub profile summary" />

<img height="170" src="https://github-profile-summary-cards.vercel.app/api/cards/repos-per-language?username=ratishoberoi&theme=github_dark" alt="Ratish Oberoi repositories per language" />
<img height="170" src="https://github-profile-summary-cards.vercel.app/api/cards/most-commit-language?username=ratishoberoi&theme=github_dark" alt="Ratish Oberoi most committed languages" />

<img height="170" src="https://github-profile-summary-cards.vercel.app/api/cards/stats?username=ratishoberoi&theme=github_dark" alt="Ratish Oberoi GitHub stats" />
<img height="170" src="https://github-profile-summary-cards.vercel.app/api/cards/productive-time?username=ratishoberoi&theme=github_dark&utcOffset=5.5" alt="Ratish Oberoi productive time" />

</div>`;
}

function renderProfileContact() {
  return `<div align="center">

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/ratishoberoi)
[![LeetCode](https://img.shields.io/badge/LeetCode-Grind-FFA116?style=for-the-badge&logo=leetcode&logoColor=black)](https://leetcode.com/u/ratishoberoi/)
[![Email](https://img.shields.io/badge/Email-Signal-D14836?style=for-the-badge&logo=gmail&logoColor=white)](mailto:ratishoberoi3993@gmail.com)

</div>`;
}

function renderLivePulse(state) {
  const lastAttack = state.attacks[0];
  const latestLootAttack = state.attacks.find((attack) => attack.loot);
  const topRaider = state.leaderboard[0];
  const latestExecutioner = state.executioners[0];
  const latestKiller = state.hallOfFame[0];
  const executionSignal = latestExecutioner
    ? `${markdownUser(latestExecutioner.username)} (${markdownCell(latestExecutioner.executioner_badge)})`
    : latestKiller
      ? `${markdownUser(latestKiller.killer)} defeated ${markdownCell(latestKiller.boss_name)}`
      : "No boss has fallen yet.";

  return `**Last Attack:** ${lastAttack ? `${markdownUser(lastAttack.attacker)} hit for ${lastAttack.damage}` : "⚠ No one has attacked yet. Become the First Raider."}  
**Latest Loot:** ${latestLootAttack && latestLootAttack.loot ? `${markdownUser(latestLootAttack.attacker)} found ${markdownCell(latestLootAttack.loot.item)} (${markdownCell(latestLootAttack.loot.rarity)})` : "No relics discovered. The vault awaits."}  
**Top Raider:** ${topRaider ? `${markdownUser(topRaider.username)} with ${topRaider.total_damage} damage` : "⚠ No one has attacked yet. Become the First Raider."}  
**Boss Killer:** ${executionSignal}`;
}

function renderRaidRules(state) {
  return `### Attack Damage

| Attack | Damage |
| --- | ---: |
| Slash | 5-20 |
| Critical Strike | 0-100 |
| Lucky Attack | 1-500 |

### Drop Rates

${renderDropRates(state.lootRegistry, inventoryTotals(state.playerInventory))}

Every attack is processed by GitHub Actions. Damage is applied to the shared boss, loot rolls automatically, the README updates, and the attack issue closes with the result.`;
}

function renderTopRaidersSection(state) {
  return `${renderTopRaiderSpotlight(state.leaderboard)}

### Top 10 Attackers

${renderTopAttackersTable(state.leaderboard)}

### Current Record Holders

${renderRecordHolders(state)}`;
}

function renderTopRaiderSpotlight(leaderboard) {
  const medals = ["🥇", "🥈", "🥉"];
  const labels = ["#1 Raider", "#2 Raider", "#3 Raider"];
  const cards = [0, 1, 2].map((index) => {
    const entry = leaderboard[index];
    if (!entry) {
      return `> ### ${medals[index]} ${labels[index]}
> **Open Slot**
>
> **Total Damage:** 0  
> **Attacks:** 0`;
    }
    return `> ### ${medals[index]} ${labels[index]}
> **${markdownUser(entry.username)}**
>
> **Total Damage:** ${entry.total_damage}  
> **Attacks:** ${entry.attacks}`;
  });
  return cards.join("\n\n");
}

function renderTopAttackersTable(leaderboard) {
  const rows = leaderboard.slice(0, 10);
  if (!rows.length) {
    return "| Rank | Attacker | Total Damage | Attacks |\n| ---: | --- | ---: | ---: |\n| - | No attackers yet | 0 | 0 |";
  }
  return `| Rank | Attacker | Total Damage | Attacks |
| ---: | --- | ---: | ---: |
${rows.map((entry, index) => `| ${index + 1} | ${markdownUser(entry.username)} | ${entry.total_damage} | ${entry.attacks} |`).join("\n")}`;
}

function renderRecentCombatSection(state) {
  const rows = state.attacks.slice(0, 10);
  if (!rows.length) {
    return `### Last 10 Attacks

| Time | Attacker | Attack | Damage | Result |
| --- | --- | --- | ---: | --- |
| - | No attacks yet | - | - | - |`;
  }
  return `### Last 10 Attacks

| Time | Attacker | Attack | Damage | Result |
| --- | --- | --- | ---: | --- |
${rows.map((attack) => {
    const defeatedText = attack.defeated ? "Defeated boss" : markdownCell(attack.phase_after_attack);
    return `| ${markdownCell(attack.timestamp)} | ${markdownUser(attack.attacker)} | ${markdownCell(attack.attack_type)} | ${attack.damage} | ${defeatedText} |`;
  }).join("\n")}`;
}

function renderPhaseEvolutionStrip(boss, bossDefinition) {
  const current = phaseNumberForBoss(boss);
  const cells = [1, 2, 3, 4].map((phaseNumber) => {
    const status = phaseNumber < current ? "✓ CLEARED" : phaseNumber === current ? "🔥 CURRENT" : "🔒 LOCKED";
    const imagePath = bossPhasePngReadmePathFor(boss, phaseNumber);
    const width = phaseNumber === current ? 210 : 170;
    const imageStyle = phaseNumber > current ? ' style="opacity:0.42; filter:grayscale(1);"' : "";
    return `<td align="center" width="25%">
      <img src="./${imagePath}" alt="${markdownCell(boss.boss_name)} phase ${phaseNumber}" width="${width}"${imageStyle}>
      <br><strong>${status}</strong><br>
      <sub>Phase ${phaseNumber}</sub>
    </td>`;
  }).join("\n    ");
  return `<table>
  <tr>
    ${cells}
  </tr>
</table>

**${phaseProgressLine(boss)}**  
Current transformation: ${markdownCell(bossDefinition[phaseKeyForBoss(boss)])}  
Phases remaining: **${phasesRemaining(boss)}**`;
}

function renderWorldBossCampaign(state) {
  const currentId = slugify(state.boss.boss_id || state.boss.boss_name, DEFAULT_BOSS.boss_id);
  const executed = new Set([
    ...state.hallOfFame.map((entry) => slugify(entry.boss_id || entry.boss_name, "")),
    ...state.executioners.map((entry) => slugify(entry.boss_id || entry.boss_name, ""))
  ].filter(Boolean));
  const registryById = new Map(state.bossRegistry.map((boss) => [boss.id, boss]));
  const executionByBoss = new Map(state.executioners.map((execution) => [slugify(execution.boss_id || execution.boss_name, ""), execution]));
  const cells = BOSS_CAMPAIGN_ORDER.map((bossId, index) => {
    const definition = registryById.get(bossId) || { name: bossId.replace(/_/g, " ") };
    const current = bossId === currentId;
    const done = executed.has(bossId);
    const status = current ? "⚔ CURRENT" : done ? "☠ EXECUTED" : "🔒 LOCKED";
    const phaseNumber = current ? phaseNumberForBoss(state.boss) : done ? 4 : 1;
    const imagePath = bossPhasePngReadmePathFor(definition, phaseNumber);
    const style = done
      ? ""
      : current
        ? "border:2px solid #ffbf2e;"
        : "opacity:0.35; filter:grayscale(1);";
    const execution = executionByBoss.get(bossId);
    const extra = done && execution
      ? `<br><sub>Executed by:<br>${markdownUser(execution.username)}<br>Badge:<br>${markdownCell(execution.executioner_badge)}<br>${markdownCell(execution.timestamp)}</sub>`
      : current
        ? `<br><sub>HP ${state.boss.current_hp} / ${state.boss.max_hp}<br>${markdownCell(state.boss.phase)}</sub>`
        : "<br><sub>LOCKED</sub>";
    return `<td align="center" width="50%">
      <img src="./${imagePath}" alt="${markdownCell(definition.name)} campaign artwork" width="360" style="${style}">
      <br><strong>${status}</strong><br>
      <strong>Boss ${index + 1}: ${markdownCell(definition.name)}</strong>${extra}
    </td>`;
  });
  return `<table>
  <tr>
    ${cells.slice(0, 2).join("\n    ")}
  </tr>
  <tr>
    ${cells.slice(2, 4).join("\n    ")}
  </tr>
  <tr>
    ${cells.slice(4).join("\n    ")}
  </tr>
</table>`;
}

function renderNextThreat(state) {
  const currentId = slugify(state.boss.boss_id || state.boss.boss_name, DEFAULT_BOSS.boss_id);
  const executed = new Set([
    ...state.hallOfFame.map((entry) => slugify(entry.boss_id || entry.boss_name, "")),
    ...state.executioners.map((entry) => slugify(entry.boss_id || entry.boss_name, ""))
  ].filter(Boolean));
  const registryById = new Map(state.bossRegistry.map((boss) => [boss.id, boss]));
  const currentIndex = BOSS_CAMPAIGN_ORDER.indexOf(currentId);
  const nextBossId = BOSS_CAMPAIGN_ORDER.find((bossId, index) => index > currentIndex && bossId !== currentId && !executed.has(bossId));
  if (!nextBossId) {
    return "No locked campaign bosses remain. The next campaign threat has not been revealed.";
  }
  const definition = registryById.get(nextBossId) || { id: nextBossId, name: nextBossId.replace(/_/g, " "), lore: "Intel unavailable." };
  const imagePath = bossPhasePngReadmePathFor(definition, 1);
  return `<table>
  <tr>
    <td align="center" width="45%">
      <img src="./${imagePath}" alt="${markdownCell(definition.name)} locked next threat" width="360" style="opacity:0.45; filter:grayscale(1);">
    </td>
    <td width="55%">
      <strong>${markdownCell(definition.name)}</strong><br>
      ${markdownCell(definition.lore || "Intel unavailable.")}<br><br>
      <strong>Unlock Requirement:</strong> Execute ${markdownCell(state.boss.boss_name)}.
    </td>
  </tr>
</table>`;
}

function renderRecordHolders(state) {
  const mostDamage = state.leaderboard[0];
  const mostLoot = topCollectors(state.playerInventory, 1)[0];
  const mostExecutions = topExecutioners(state.executioners, 1)[0];
  return `**Most Damage:** ${mostDamage ? `${markdownUser(mostDamage.username)} (${mostDamage.total_damage})` : "No raiders yet"}  
**Most Loot:** ${mostLoot ? `${markdownUser(mostLoot.username)} (${inventoryStatsForPlayer(mostLoot).totalItems})` : "No collectors yet"}  
**Most Executions:** ${mostExecutions ? `${markdownUser(mostExecutions.username)} (${mostExecutions.execution_count})` : "No executions yet"}`;
}

function renderLootTease(state) {
  const latestDropAttack = state.attacks.find((attack) => attack.loot);
  const totals = inventoryTotals(state.playerInventory);
  const topCollector = topCollectors(state.playerInventory, 1)[0];
  const legendaryCount = state.legendaryDrops.filter((drop) => drop.rarity === "Legendary").length;
  const mythicCount = state.legendaryDrops.filter((drop) => drop.rarity === "Mythic").length;
  return `**Latest Drop:** ${latestDropAttack && latestDropAttack.loot ? `${markdownUser(latestDropAttack.attacker)} found ${markdownCell(latestDropAttack.loot.item)} (${markdownCell(latestDropAttack.loot.rarity)})` : "No relics discovered. The vault awaits."}  
**Vault:** ${totals.totalItems} relics held by ${totals.uniqueCollectors} collectors  
**Rare History:** ${legendaryCount} Legendary / ${mythicCount} Mythic  
**Top Collector:** ${topCollector ? `${markdownUser(topCollector.username)} (${inventoryStatsForPlayer(topCollector).totalItems} relics)` : "No collectors yet"}`;
}

function renderDropRates(lootRegistry, totals) {
  const rarityRows = RARITIES.map((rarity) => (
    `| ${rarity} | ${lootRegistry.drop_rates[rarity]}% | ${totals.rarityTotals[rarity]} | ${lootRegistry.items[rarity].length} |`
  )).join("\n");
  return `| Rarity | Drop Rate | Owned | Registry Items |
| --- | ---: | ---: | ---: |
${rarityRows}`;
}

function renderHallOfRelics(state) {
  const totals = inventoryTotals(state.playerInventory);
  const registry = state.lootRegistry;
  const rarityRows = RARITIES.map((rarity) => (
    `| ${rarity} | ${registry.drop_rates[rarity]}% | ${totals.rarityTotals[rarity]} | ${registry.items[rarity].length} |`
  )).join("\n");

  return `| Relic Signal | Value |
| --- | ---: |
| Total Relics Held | ${totals.totalItems} |
| Active Collectors | ${totals.uniqueCollectors} |
| Legendary Discoveries | ${state.legendaryDrops.filter((drop) => drop.rarity === "Legendary").length} |
| Mythic Discoveries | ${state.legendaryDrops.filter((drop) => drop.rarity === "Mythic").length} |

| Rarity | Drop Rate | Owned | Registry Items |
| --- | ---: | ---: | ---: |
${rarityRows}`;
}

function renderLatestDrops(attacks) {
  const drops = attacks.filter((attack) => attack.loot).slice(0, 10);
  if (!drops.length) {
    return "No loot discovered yet.";
  }
  const rows = drops.map((attack) => (
    `| ${markdownCell(attack.timestamp)} | ${markdownUser(attack.attacker)} | ${markdownCell(attack.loot.item)} | ${markdownCell(attack.loot.rarity)} |`
  )).join("\n");
  return `| Time | Collector | Relic | Rarity |
| --- | --- | --- | --- |
${rows}`;
}

function renderDiscoveryTable(legendaryDrops, rarity) {
  const drops = legendaryDrops.filter((drop) => drop.rarity === rarity).slice(0, 10);
  if (!drops.length) {
    return `No ${rarity.toLowerCase()} relics discovered yet.`;
  }
  const rows = drops.map((drop) => (
    `| ${markdownCell(drop.timestamp)} | ${markdownUser(drop.username)} | ${markdownCell(drop.item)} | ${markdownCell(drop.boss)} |`
  )).join("\n");
  return `| Time | Collector | Relic | Boss |
| --- | --- | --- | --- |
${rows}`;
}

function renderTopCollectors(playerInventory) {
  const collectors = topCollectors(playerInventory, 10);
  if (!collectors.length) {
    return "| Rank | Collector | Total Relics | Unique | Legendary | Mythic |\n| ---: | --- | ---: | ---: | ---: | ---: |\n| - | No collectors yet | 0 | 0 | 0 | 0 |";
  }
  const rows = collectors.map((player, index) => {
    const stats = inventoryStatsForPlayer(player);
    return `| ${index + 1} | ${markdownUser(player.username)} | ${stats.totalItems} | ${stats.uniqueItems} | ${stats.legendaryItems} | ${stats.mythicItems} |`;
  }).join("\n");
  return `| Rank | Collector | Total Relics | Unique | Legendary | Mythic |
| ---: | --- | ---: | ---: | ---: | ---: |
${rows}`;
}

function renderRecentLoot(attacks) {
  const drops = attacks.filter((attack) => attack.loot).slice(0, 10);
  if (!drops.length) {
    return "| Time | Collector | Drop | Rarity | Damage |\n| --- | --- | --- | --- | ---: |\n| - | No loot yet | - | - | - |";
  }
  const rows = drops.map((attack) => (
    `| ${markdownCell(attack.timestamp)} | ${markdownUser(attack.attacker)} | ${markdownCell(attack.loot.item)} | ${markdownCell(attack.loot.rarity)} | ${attack.damage} |`
  )).join("\n");
  return `| Time | Collector | Drop | Rarity | Damage |
| --- | --- | --- | --- | ---: |
${rows}`;
}

function renderLatestExecutioner(executioners) {
  if (!executioners.length) {
    return "No executioner yet. Land the final blow to claim the first crown.";
  }
  const execution = executioners[0];
  return `<p align="center">
  <img src="./${markdownCell(execution.defeat_card)}" alt="${markdownCell(execution.boss_name)} execution card" width="720">
</p>`;
}

function renderPhaseProgress(boss, bossDefinition) {
  const current = phaseNumberForBoss(boss);
  const rows = [1, 2, 3, 4].map((phaseNumber) => {
    const status = phaseNumber < current ? "✓ CLEARED" : phaseNumber === current ? "🔥 CURRENT" : "🔒 LOCKED";
    return `| ${status} | Phase ${phaseNumber} | ${markdownCell(bossDefinition[`phase_${phaseNumber}`])} |`;
  }).join("\n");
  return `**${phaseProgressLine(boss)}**

| Status | Phase | Transformation |
| --- | --- | --- |
${rows}

Phases remaining: **${phasesRemaining(boss)}**`;
}

function renderExecutionerHall(executioners) {
  if (!executioners.length) {
    return "| Boss | Executioner | Badge | Final Blow | Date |\n| --- | --- | --- | ---: | --- |\n| No executions yet | - | - | - | - |";
  }
  const rows = executioners.map((execution) => (
    `| ${markdownCell(execution.boss_name)} | ${markdownUser(execution.username)}<br>(${markdownCell(execution.executioner_badge)}) | ${markdownCell(execution.executioner_badge)} | ${execution.final_damage} | ${markdownCell(execution.timestamp)} |`
  )).join("\n");
  return `| Boss | Executioner | Badge | Final Blow | Date |
| --- | --- | --- | ---: | --- |
${rows}`;
}

function renderTopExecutioners(executioners) {
  const rows = topExecutioners(executioners, 10);
  if (!rows.length) {
    return "| Executioner | Execution Count | First Execution | Latest Execution |\n| --- | ---: | --- | --- |\n| No executions yet | 0 | - | - |";
  }
  return `| Executioner | Execution Count | First Execution | Latest Execution |
| --- | ---: | --- | --- |
${rows.map((row) => `| ${markdownUser(row.username)} | ${row.execution_count} | ${markdownCell(row.first_execution)} | ${markdownCell(row.latest_execution)} |`).join("\n")}`;
}

function renderHallOfFame(hallOfFame) {
  if (!hallOfFame.length) {
    return "No bosses defeated yet.";
  }
  const cards = hallOfFame.slice(0, 10).map((entry) => {
    const imagePath = bossFinalFormPngReadmePathFor(entry);
    const badge = entry.executioner_badge || executionerBadgeForBoss(entry.boss_id, entry.boss_name);
    return `<table>
  <tr>
    <td align="center" width="55%">
      <img src="./${imagePath}" alt="${markdownCell(entry.boss_name)} final form defeated" width="420">
    </td>
    <td width="45%">
      <h3>${markdownCell(entry.boss_name)}</h3>
      <strong>Executioner:</strong> ${markdownUser(entry.killer)}<br>
      <strong>Badge Earned:</strong> ${markdownCell(badge)}<br>
      <strong>Final Blow:</strong> ${entry.final_damage}<br>
      <strong>Execution Date:</strong> ${markdownCell(entry.timestamp)}
    </td>
  </tr>
</table>`;
  }).join("\n\n");
  return `### Cinematic Defeat Archive

${cards}`;
}

function renderSvg(state = loadState()) {
  const safeState = normalizeState(state);
  const boss = safeState.boss;
  const percent = hpPercent(boss);
  const barWidth = 520;
  const fillWidth = Math.round((percent / 100) * barWidth);
  const status = boss.current_hp <= 0 ? "DEFEATED" : "ACTIVE RAID TARGET";
  const lastAttack = safeState.attacks[0];
  const lastLine = lastAttack
    ? `Last hit: @${sanitizeUsername(lastAttack.attacker)} for ${lastAttack.damage}`
    : "Awaiting first attacker";
  const phaseLabels = ["Phase 1", "Phase 2", "Phase 3", "Final Phase"];
  const activePhase = phaseLabels.indexOf(boss.phase);
  const phaseNodes = phaseLabels.map((label, index) => {
    const x = 68 + index * 134;
    const active = index === activePhase;
    const fill = active ? "#ff2bd6" : "#061522";
    const stroke = active ? "#ffe95e" : "#21445c";
    const text = label === "Final Phase" ? "FINAL" : `P${index + 1}`;
    return `<rect x="${x}" y="286" width="112" height="28" rx="4" fill="${fill}" fill-opacity="${active ? "0.35" : "0.75"}" stroke="${stroke}"/>
  <text x="${x + 56}" y="305" text-anchor="middle" fill="${active ? "#ffe95e" : "#8db5c8"}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="14" font-weight="800">${text}</text>`;
  }).join("\n  ");
  const leaderboardRows = safeState.leaderboard.slice(0, 5).map((entry, index) => {
    const y = 142 + index * 31;
    return `<text x="647" y="${y}" fill="#c8d8ef" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="16">${index + 1}. @${escapeHtml(truncate(entry.username, 16))}</text>
  <text x="872" y="${y}" text-anchor="end" fill="#ffe95e" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="16">${entry.total_damage}</text>`;
  }).join("\n  ") || `<text x="647" y="142" fill="#8db5c8" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="16">No attackers yet</text>`;
  const collectorRows = topCollectors(safeState.playerInventory, 3).map((player, index) => {
    const y = 382 + index * 26;
    const stats = inventoryStatsForPlayer(player);
    return `<text x="647" y="${y}" fill="#c8d8ef" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="15">${index + 1}. @${escapeHtml(truncate(player.username, 13))}</text>
  <text x="872" y="${y}" text-anchor="end" fill="#ffe95e" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="15">${stats.totalItems} relics</text>`;
  }).join("\n  ") || `<text x="647" y="382" fill="#8db5c8" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="15">No collectors yet</text>`;
  const recentRows = safeState.attacks.slice(0, 4).map((attack, index) => {
    const y = 370 + index * 28;
    return `<text x="70" y="${y}" fill="#c8d8ef" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="15">@${escapeHtml(truncate(attack.attacker, 14))}</text>
  <text x="246" y="${y}" fill="#23f7dd" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="15">${escapeHtml(attack.attack_type)}</text>
  <text x="474" y="${y}" text-anchor="end" fill="#ffe95e" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="15">${attack.damage} dmg</text>`;
  }).join("\n  ") || `<text x="70" y="370" fill="#8db5c8" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="15">Awaiting combat telemetry</text>`;
  const latestLegendary = safeState.legendaryDrops.find((drop) => drop.rarity === "Legendary" || drop.rarity === "Mythic");
  const lootTotals = inventoryTotals(safeState.playerInventory);
  const latestDrop = safeState.attacks.find((attack) => attack.loot);
  const relicLine = latestLegendary
    ? `${latestLegendary.rarity}: ${latestLegendary.item}`
    : "No legendary signal yet";
  const latestDropLine = latestDrop && latestDrop.loot
    ? `${latestDrop.loot.rarity}: ${latestDrop.loot.item}`
    : "Awaiting first relic";

  return `<svg width="960" height="540" viewBox="0 0 960 540" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${escapeHtml(boss.boss_name)} raid boss</title>
  <desc id="desc">Current HP ${boss.current_hp} of ${boss.max_hp}. ${escapeHtml(boss.phase)}.</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="960" y2="540" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#08111f"/>
      <stop offset="0.52" stop-color="#12051c"/>
      <stop offset="1" stop-color="#061b22"/>
    </linearGradient>
    <linearGradient id="hp" x1="0" y1="0" x2="${barWidth}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#23f7dd"/>
      <stop offset="0.55" stop-color="#ff2bd6"/>
      <stop offset="1" stop-color="#ffe95e"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-80%" width="140%" height="260%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <pattern id="scan" width="8" height="8" patternUnits="userSpaceOnUse">
      <path d="M0 0H8" stroke="#23f7dd" stroke-opacity="0.08"/>
    </pattern>
    <style>
      @keyframes pulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
      @keyframes sweep { 0% { transform: translateX(-960px); } 100% { transform: translateX(960px); } }
      .pulse { animation: pulse 2.4s ease-in-out infinite; }
      .sweep { animation: sweep 5s linear infinite; }
    </style>
  </defs>
  <rect width="960" height="540" rx="24" fill="url(#bg)"/>
  <rect width="960" height="540" fill="url(#scan)"/>
  <rect class="sweep" x="0" y="0" width="180" height="540" fill="#23f7dd" fill-opacity="0.045"/>
  <path d="M0 90H960M0 180H960M0 270H960M0 360H960M0 450H960M120 0V540M240 0V540M360 0V540M480 0V540M600 0V540M720 0V540M840 0V540" stroke="#1cf7ff" stroke-opacity="0.08"/>
  <rect x="28" y="28" width="904" height="484" rx="18" stroke="#23f7dd" stroke-opacity="0.72" stroke-width="2"/>
  <rect x="42" y="42" width="876" height="456" rx="10" stroke="#ff2bd6" stroke-opacity="0.36"/>
  <path d="M614 68H894V266H614Z" fill="#030917" fill-opacity="0.82" stroke="#21445c"/>
  <path d="M614 292H894V472H614Z" fill="#030917" fill-opacity="0.82" stroke="#21445c"/>
  <path d="M52 338H508V472H52Z" fill="#030917" fill-opacity="0.82" stroke="#21445c"/>

  <text x="70" y="86" fill="#23f7dd" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="17" letter-spacing="3">${escapeHtml(status)}</text>
  <text x="70" y="145" fill="#f7fbff" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="48" font-weight="900">${escapeHtml(truncate(boss.boss_name, 20))}</text>
  <text x="70" y="188" fill="#ff2bd6" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="25" font-weight="800">${escapeHtml(boss.phase)}</text>

  <rect x="70" y="218" width="${barWidth}" height="38" rx="6" fill="#020713" stroke="#35516c"/>
  <rect class="pulse" x="70" y="218" width="${fillWidth}" height="38" rx="6" fill="url(#hp)" filter="url(#glow)"/>
  <path d="M174 218V256M278 218V256M382 218V256M486 218V256" stroke="#020713" stroke-opacity="0.55"/>
  <text x="610" y="247" fill="#f7fbff" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="24" font-weight="900">${boss.current_hp} / ${boss.max_hp}</text>
  <text x="70" y="274" fill="#c8d8ef" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="17">${percent}% HP // ${escapeHtml(truncate(lastLine, 44))}</text>
  ${phaseNodes}
  <text x="70" y="330" fill="#ffe95e" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="16">LOOT: ${lootTotals.totalItems} RELICS // ${lootTotals.uniqueCollectors} COLLECTORS</text>

  <text x="638" y="104" fill="#23f7dd" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="17" letter-spacing="2">TOP ATTACKERS</text>
  ${leaderboardRows}
  <text x="638" y="246" fill="#ff2bd6" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="15">LATEST DROP</text>
  <text x="638" y="268" fill="#ffe95e" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="15">${escapeHtml(truncate(latestDropLine, 28))}</text>

  <text x="638" y="326" fill="#23f7dd" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="17" letter-spacing="2">TOP COLLECTORS</text>
  <text x="638" y="350" fill="#ff2bd6" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="14">${escapeHtml(truncate(relicLine, 31))}</text>
  ${collectorRows}

  <text x="70" y="356" fill="#23f7dd" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="17" letter-spacing="2">RECENT ATTACKS</text>
  ${recentRows}

  <g transform="translate(558 410)">
    <rect x="-58" y="-58" width="116" height="116" fill="#061522" stroke="#23f7dd" stroke-width="3"/>
    <rect x="-38" y="-34" width="28" height="26" fill="#ff2bd6" fill-opacity="0.85"/>
    <rect x="10" y="-34" width="28" height="26" fill="#23f7dd" fill-opacity="0.85"/>
    <rect x="-30" y="18" width="60" height="10" fill="#ffe95e"/>
    <path d="M-58 -58L-82 -82M58 -58L82 -82M-58 58L-82 82M58 58L82 82" stroke="#ff2bd6" stroke-width="4"/>
    <circle class="pulse" cx="0" cy="0" r="78" stroke="#ffe95e" stroke-opacity="0.35" stroke-width="3"/>
  </g>
</svg>
`;
}

function bossPalette(bossId) {
  const palettes = {
    hallucination_titan: ["#23f7dd", "#ff2bd6", "#ffe95e"],
    gpu_devourer: ["#ff6b1a", "#ffe95e", "#23f7dd"],
    data_leak_hydra: ["#39ff88", "#ff2b4f", "#23f7dd"],
    gradient_vanisher: ["#b8f7ff", "#7a5cff", "#ff2bd6"],
    overfitted_beast: ["#ff3b6b", "#ffe95e", "#23f7dd"],
    prompt_goblin: ["#9dff28", "#ff2bd6", "#ffe95e"]
  };
  return palettes[bossId] || ["#23f7dd", "#ff2bd6", "#ffe95e"];
}

function bossPhaseName(phaseNumber) {
  return ["Normal Form", "Mutated Form", "Corrupted Form", "Final Nightmare Form"][phaseNumber - 1] || "Unknown Form";
}

function bossPhaseDescription(definition, phaseNumber) {
  return definition[`phase_${phaseNumber}`] || definition.phase_1;
}

function bossPhaseDisplayName(definition, phaseNumber) {
  const names = {
    gpu_devourer: ["Contained Predator", "Reactor Exposure", "City Destroyer", "World Eater"],
    data_leak_hydra: ["3 Heads", "5 Heads", "7 Heads", "9 Heads"],
    gradient_vanisher: ["Single Singularity", "Dual Singularity", "Reality Fracture", "Cosmic Collapse"],
    hallucination_titan: ["3 Faces", "10 Faces", "25 Faces", "100+ Faces"],
    overfitted_beast: ["Contained Beast", "Chains Breaking", "Mutation Surge", "Catastrophic Beast"],
    prompt_goblin: ["Prompt Thief", "Prompt Lord", "Prompt Warlock", "Reality Manipulator"]
  };
  return (names[definition.id] && names[definition.id][phaseNumber - 1]) || bossPhaseName(phaseNumber);
}

function repeatedNodes(count, renderer) {
  return Array.from({ length: count }, (_, index) => renderer(index)).join("\n    ");
}

function renderCracks(count, color, opacity = ".65") {
  return repeatedNodes(count, (index) => {
    const x = 80 + ((index * 137) % 790);
    const y = 70 + ((index * 83) % 380);
    return `<path class="corruption-pulse" d="M${x} ${y}L${x + 24} ${y + 34}L${x + 8} ${y + 72}L${x + 46} ${y + 118}" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${2 + (index % 3)}" fill="none"/>`;
  });
}

function renderEnergyRibbons(count, color, opacity = ".72") {
  return repeatedNodes(count, (index) => {
    const y = 80 + index * (380 / Math.max(1, count - 1));
    return `<path class="energy-movement" d="M-40 ${y}C160 ${y - 70} 330 ${y + 84} 520 ${y}C710 ${y - 84} 850 ${y + 68} 1000 ${y - 28}" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${3 + index % 4}" stroke-linecap="round" stroke-dasharray="30 24" fill="none"/>`;
  });
}

function renderParticles(count, className, color, opacity = ".7") {
  return repeatedNodes(count, (index) => {
    const x = 40 + ((index * 89) % 880);
    const y = 70 + ((index * 131) % 420);
    const r = 2 + (index % 4);
    return `<circle class="${className}" cx="${x}" cy="${y}" r="${r}" fill="${color}" fill-opacity="${opacity}"/>`;
  });
}

function renderBinaryWaterfalls(count, color) {
  return repeatedNodes(count, (index) => {
    const x = 84 + index * (792 / Math.max(1, count - 1));
    const bits = index % 2 ? "101101001" : "010011010";
    return `<text class="data-waterfall" x="${x}" y="${40 + (index % 3) * 34}" fill="${color}" fill-opacity=".66" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="${14 + (index % 3) * 2}" font-weight="900">${bits}</text>`;
  });
}

function renderLockIcons(count, color) {
  return repeatedNodes(count, (index) => {
    const x = 82 + ((index * 173) % 790);
    const y = 84 + ((index * 97) % 370);
    return `<g class="lock-drift" opacity=".72">
      <path d="M${x + 8} ${y + 20}V${y + 10}C${x + 8} ${y - 8} ${x + 36} ${y - 8} ${x + 36} ${y + 10}V${y + 20}" stroke="${color}" stroke-width="4" fill="none"/>
      <rect x="${x}" y="${y + 20}" width="44" height="34" rx="4" fill="#020713" fill-opacity=".38" stroke="${color}" stroke-width="4"/>
    </g>`;
  });
}

function renderSpellPages(count, color) {
  return repeatedNodes(count, (index) => {
    const x = 76 + ((index * 151) % 820);
    const y = 78 + ((index * 83) % 360);
    return `<g class="spell-page-drift">
      <path d="M${x} ${y}L${x + 42} ${y - 10}L${x + 54} ${y + 44}L${x + 10} ${y + 56}Z" fill="#f7fbff" fill-opacity=".16" stroke="${color}" stroke-width="3"/>
      <path d="M${x + 12} ${y + 16}H${x + 42}M${x + 14} ${y + 30}H${x + 38}" stroke="${color}" stroke-width="2"/>
    </g>`;
  });
}

function renderEyeGlowCluster(points, color) {
  return points.map(([x, y, r]) => (
    `<circle class="eye-glow-pulse" cx="${x}" cy="${y}" r="${r}" fill="${color}" fill-opacity=".86" filter="url(#glow)"/>`
  )).join("\n    ");
}

function renderPhaseEffects(definition, phaseNumber, colors) {
  const [primary, secondary, accent] = colors;
  const corruptionOpacity = (0.16 + phaseNumber * 0.11).toFixed(2);
  const common = `${renderEnergyRibbons(phaseNumber + 2, accent, ".42")}
    ${renderCracks(phaseNumber * 4, secondary, ".42")}
    <circle class="pulsing-glow" cx="482" cy="292" r="${122 + phaseNumber * 18}" fill="${accent}" fill-opacity=".12" filter="url(#glow)"/>
    ${renderEyeGlowCluster([[438, 226, 7 + phaseNumber], [522, 226, 7 + phaseNumber]], accent)}
    <circle class="reactor-flicker" cx="482" cy="292" r="${34 + phaseNumber * 14}" fill="${primary}" fill-opacity="${0.12 + phaseNumber * 0.05}" filter="url(#glow)"/>
    <circle class="corruption-pulse" cx="482" cy="292" r="${76 + phaseNumber * 22}" stroke="${secondary}" stroke-opacity="${corruptionOpacity}" stroke-width="${6 + phaseNumber}" fill="none"/>
    <path class="threat-indicator-pulse" d="M36 42H214L250 78H36Z" fill="#020713" fill-opacity=".78" stroke="${primary}" stroke-width="2"/>`;

  if (definition.id === "gpu_devourer") {
    const reactor = [38, 64, 92, 132][phaseNumber - 1];
    const jaw = [18, 38, 64, 96][phaseNumber - 1];
    return `${common}
    <circle class="reactor-flicker" cx="496" cy="300" r="${reactor}" fill="${primary}" fill-opacity=".44" filter="url(#glow)"/>
    <path class="eye-glow-pulse" d="M670 ${238 - jaw / 3}C748 ${196 - jaw} 842 ${204 - jaw / 2} 924 ${250}C842 ${298 + jaw / 2} 750 ${302 + jaw} 670 ${268 + jaw / 3}Z" fill="#050407" fill-opacity=".34" stroke="${secondary}" stroke-width="${3 + phaseNumber}"/>
    <path class="mouth-fire" d="M702 250C780 ${238 - jaw} 850 ${242 - jaw / 2} 930 250C842 ${278 + jaw / 2} 784 ${282 + jaw} 702 250Z" fill="${primary}" fill-opacity=".34" stroke="${accent}" stroke-width="${4 + phaseNumber}"/>
    ${renderParticles(18 + phaseNumber * 8, "ember-rise", primary, ".72")}
    <path class="heat-distortion" d="M92 132C244 80 380 172 520 128C650 88 760 118 906 84M78 394C230 344 366 438 522 382C664 330 798 350 930 306" stroke="${accent}" stroke-width="${3 + phaseNumber}" stroke-opacity=".38" stroke-dasharray="20 18" fill="none"/>
    <ellipse class="smoke-drift" cx="250" cy="106" rx="${88 + phaseNumber * 18}" ry="${18 + phaseNumber * 5}" fill="#c8d8ef" fill-opacity=".09"/>
    <ellipse class="smoke-drift" cx="680" cy="118" rx="${106 + phaseNumber * 22}" ry="${22 + phaseNumber * 5}" fill="#c8d8ef" fill-opacity=".08"/>
    <path class="energy-movement" d="M498 300C430 396 386 438 338 524M512 302C604 392 668 444 762 536" stroke="${primary}" stroke-width="${5 + phaseNumber * 2}" stroke-dasharray="22 16" fill="none"/>
    ${phaseNumber >= 3 ? `<path d="M34 502H928" stroke="${primary}" stroke-width="18" stroke-opacity=".34"/><path d="M70 500V448M132 500V414M206 500V456M772 500V422M846 500V392M908 500V450" stroke="${secondary}" stroke-width="12" stroke-opacity=".54"/>` : ""}
    ${phaseNumber === 4 ? `<circle class="reactor-flicker" cx="842" cy="252" r="126" fill="${primary}" fill-opacity=".20" filter="url(#glow)"/><circle class="threat-indicator-pulse" cx="842" cy="252" r="172" stroke="${secondary}" stroke-width="9" stroke-opacity=".34" fill="none"/>` : ""}`;
  }

  if (definition.id === "data_leak_hydra") {
    const heads = [3, 5, 7, 9][phaseNumber - 1];
    const eyes = repeatedNodes(heads, (index) => {
      const x = 144 + index * (672 / Math.max(1, heads - 1));
      const y = 132 + (index % 3) * 42;
      return `<circle class="eye-glow-pulse" cx="${x}" cy="${y}" r="${10 + phaseNumber}" fill="${accent}" filter="url(#glow)"/>
      <circle class="eye-glow-pulse" cx="${x + 34}" cy="${y + 4}" r="${10 + phaseNumber}" fill="${accent}" filter="url(#glow)"/>`;
    });
    const chains = repeatedNodes(5, (index) => {
      const x = 104 + index * 188;
      return `<path class="corruption-pulse" d="M${x} 38L${x + 40} 116L${x + 8} 190${phaseNumber >= 2 ? `M${x + 18} 234L${x + 54} 318` : `L${x + 48} 284`}" stroke="${secondary}" stroke-opacity=".7" stroke-width="7" stroke-dasharray="${phaseNumber >= 2 ? "24 24" : "8 8"}" fill="none"/>`;
    });
    return `${common}
    ${eyes}
    ${chains}
    ${renderBinaryWaterfalls(6 + phaseNumber * 4, accent)}
    ${renderLockIcons(phaseNumber + 2, secondary)}
    ${renderParticles(20 + phaseNumber * 10, "corruption-particle", secondary, ".58")}
    <path class="data-leak" d="M160 212C254 286 344 250 438 324C540 402 676 322 790 420" stroke="${primary}" stroke-width="${7 + phaseNumber}" stroke-opacity=".58" stroke-dasharray="12 12" fill="none"/>
    <path class="data-leak" d="M196 276C330 354 454 300 564 382C660 454 780 410 902 470" stroke="${secondary}" stroke-width="${5 + phaseNumber}" stroke-opacity=".50" stroke-dasharray="10 14" fill="none"/>
    ${renderEnergyRibbons(phaseNumber + 4, primary, ".64")}
    <path class="threat-indicator-pulse" d="M92 468C248 404 414 512 576 430C708 362 816 410 934 352" stroke="${accent}" stroke-width="${8 + phaseNumber}" stroke-opacity=".68" stroke-dasharray="18 14" fill="none"/>`;
  }

  if (definition.id === "gradient_vanisher") {
    const holes = [1, 2, 4, 7][phaseNumber - 1];
    const singularities = repeatedNodes(holes, (index) => {
      const x = 220 + ((index * 163) % 560);
      const y = 126 + ((index * 97) % 286);
      const r = 34 + phaseNumber * 9 + (index % 3) * 8;
      return `<circle class="reactor-flicker" cx="${x}" cy="${y}" r="${r}" fill="#010207" stroke="${accent}" stroke-width="5" filter="url(#glow)"/>
      <circle class="spin" cx="${x}" cy="${y}" r="${r + 20}" stroke="${secondary}" stroke-opacity=".58" stroke-width="4" stroke-dasharray="18 14" fill="none"/>`;
    });
    return `${common}
    ${singularities}
    <g class="orbiting-planet"><circle cx="642" cy="152" r="${8 + phaseNumber}" fill="${accent}"/><circle cx="702" cy="220" r="${5 + phaseNumber}" fill="${secondary}"/></g>
    <text class="rotating-equation" x="172" y="128" fill="${accent}" fill-opacity=".66" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="${22 + phaseNumber * 2}">∂L/∂x → 0</text>
    <text class="rotating-equation" x="610" y="430" fill="${secondary}" fill-opacity=".62" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="${18 + phaseNumber * 2}">Σ∇ collapse</text>
    ${renderParticles(16 + phaseNumber * 9, "void-particle-drift", accent, ".46")}
    <path class="corruption-pulse" d="M128 76L824 488M846 58L96 502M304 28L612 530M54 248L924 316" stroke="${secondary}" stroke-width="${4 + phaseNumber * 2}" stroke-opacity=".62" stroke-dasharray="16 18" fill="none"/>
    ${phaseNumber >= 3 ? `<path d="M0 0H960V540H0Z" fill="#000" fill-opacity=".16"/><path class="energy-movement" d="M96 166C280 92 396 238 518 178C684 96 804 124 960 66" stroke="${accent}" stroke-width="9" stroke-dasharray="20 18" fill="none"/>` : ""}`;
  }

  if (definition.id === "hallucination_titan") {
    const faces = [3, 10, 25, 110][phaseNumber - 1];
    const faceNodes = repeatedNodes(faces, (index) => {
      const cols = phaseNumber === 4 ? 15 : Math.ceil(Math.sqrt(faces));
      const x = 110 + (index % cols) * (740 / Math.max(1, cols - 1));
      const y = 82 + Math.floor(index / cols) * (370 / Math.max(1, Math.ceil(faces / cols) - 1));
      const size = phaseNumber === 4 ? 6 + (index % 3) : 11 + phaseNumber;
      return `<g class="eye-glow-pulse" opacity="${phaseNumber === 4 ? ".54" : ".72"}">
      <circle cx="${x}" cy="${y}" r="${size}" fill="${primary}" fill-opacity=".20" stroke="${accent}" stroke-width="2"/>
      <circle cx="${x - size / 2}" cy="${y - 1}" r="${Math.max(2, size / 4)}" fill="${secondary}"/>
      <circle cx="${x + size / 2}" cy="${y - 1}" r="${Math.max(2, size / 4)}" fill="${secondary}"/>
    </g>`;
    });
    return `${common}
    ${faceNodes}
    <g class="orbiting-face">${renderEyeGlowCluster([[720, 126, 12 + phaseNumber], [764, 170, 8 + phaseNumber], [680, 204, 7 + phaseNumber]], secondary)}</g>
    ${renderParticles(18 + phaseNumber * 10, "apparition-fade", primary, ".38")}
    ${repeatedNodes(8 + phaseNumber * 5, (index) => {
      const x = 78 + ((index * 113) % 812);
      const y = 70 + ((index * 67) % 390);
      return `<path class="memory-fragment" d="M${x} ${y}L${x + 36} ${y - 8}L${x + 48} ${y + 26}L${x + 8} ${y + 38}Z" fill="${index % 2 ? primary : secondary}" fill-opacity=".14" stroke="${accent}" stroke-width="2"/>`;
    })}
    <path class="spin" d="M150 282C278 34 684 28 818 282C680 530 278 530 150 282Z" stroke="${secondary}" stroke-width="${4 + phaseNumber}" stroke-opacity=".48" stroke-dasharray="24 18" fill="none"/>
    ${phaseNumber >= 3 ? renderEnergyRibbons(8, primary, ".54") : ""}`;
  }

  if (definition.id === "overfitted_beast") {
    const chains = repeatedNodes(7, (index) => {
      const x = 70 + index * 138;
      return `<path class="corruption-pulse" d="M${x} 42L${x + 68} 162${phaseNumber >= 2 ? `M${x + 90} 214L${x + 148} 360` : `L${x + 118} 320`}" stroke="${secondary}" stroke-opacity=".76" stroke-width="${8 + phaseNumber}" stroke-dasharray="${phaseNumber >= 2 ? "34 28" : "10 10"}" fill="none"/>`;
    });
    const mutation = repeatedNodes(phaseNumber * 6, (index) => {
      const x = 112 + ((index * 109) % 760);
      const y = 118 + ((index * 71) % 330);
      return `<path class="corruption-pulse" d="M${x} ${y}L${x + 46} ${y - 24}L${x + 82} ${y + 34}L${x + 16} ${y + 58}Z" fill="${primary}" fill-opacity=".18" stroke="${accent}" stroke-width="3"/>`;
    });
    return `${common}
    ${chains}
    ${mutation}
    <path class="moving-chain" d="M42 96C224 160 334 104 490 174C632 238 742 170 918 236" stroke="${secondary}" stroke-width="${8 + phaseNumber}" stroke-opacity=".55" stroke-dasharray="18 14" fill="none"/>
    <path class="lightning-arc" d="M128 82L210 166L178 238L286 330L230 436M832 76L742 164L782 248L672 346L728 466" stroke="${accent}" stroke-width="${4 + phaseNumber}" stroke-opacity=".78" fill="none"/>
    <path class="glowing-vein" d="M262 270C392 226 512 332 690 282M244 370C398 324 542 438 760 384" stroke="${primary}" stroke-width="${5 + phaseNumber}" stroke-opacity=".50" stroke-dasharray="16 14" fill="none"/>
    <path class="threat-indicator-pulse" d="M80 478C264 406 700 402 886 474" stroke="${primary}" stroke-width="${12 + phaseNumber * 3}" stroke-opacity=".45" fill="none"/>
    ${phaseNumber === 4 ? `<rect class="corruption-pulse" x="0" y="0" width="960" height="540" fill="${secondary}" fill-opacity=".10"/>` : ""}`;
  }

  const runeCount = [8, 16, 28, 44][phaseNumber - 1];
  const runes = repeatedNodes(runeCount, (index) => {
    const x = 86 + ((index * 91) % 800);
    const y = 64 + ((index * 53) % 420);
    const text = ["{}", "&&", "!!", "RUN", "SYS", ">>"][index % 6];
    return `<text class="energy-movement" x="${x}" y="${y}" fill="${index % 2 ? secondary : accent}" fill-opacity=".72" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="${16 + phaseNumber * 2}" font-weight="900">${escapeHtml(text)}</text>`;
  });
  return `${common}
    ${runes}
    <circle class="magic-circle-rotate" cx="480" cy="286" r="${122 + phaseNumber * 16}" stroke="${secondary}" stroke-width="${4 + phaseNumber}" stroke-opacity=".42" stroke-dasharray="18 14" fill="none"/>
    <circle class="magic-circle-rotate" cx="480" cy="286" r="${178 + phaseNumber * 20}" stroke="${accent}" stroke-width="4" stroke-opacity=".32" stroke-dasharray="28 20" fill="none"/>
    ${renderSpellPages(5 + phaseNumber * 3, accent)}
    ${repeatedNodes(8 + phaseNumber * 4, (index) => {
      const x = 72 + ((index * 127) % 816);
      const y = 86 + ((index * 59) % 376);
      const fragment = ["SYSTEM", "PROMPT", "OVERRIDE", "TOKEN"][index % 4];
      return `<text class="prompt-fragment" x="${x}" y="${y}" fill="${index % 2 ? primary : secondary}" fill-opacity=".62" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="${12 + phaseNumber}" font-weight="900">${fragment}</text>`;
    })}
    <path class="reactor-flicker" d="M188 476C312 348 646 348 780 476" stroke="${secondary}" stroke-width="${8 + phaseNumber * 2}" stroke-opacity=".56" fill="none"/>
    ${phaseNumber === 4 ? `<path class="corruption-pulse" d="M92 70C278 24 704 24 874 76C778 174 782 374 884 520C654 430 310 430 76 520C178 370 178 176 92 70Z" fill="${secondary}" fill-opacity=".14" stroke="${accent}" stroke-width="7"/>` : ""}`;
}

function renderBossPhaseSvg(definition, phaseNumber) {
  const colors = bossPalette(definition.id);
  const [primary, secondary, accent] = colors;
  const effects = renderPhaseEffects(definition, phaseNumber, colors);
  const phaseDescription = bossPhaseDescription(definition, phaseNumber);
  const phaseArt = bossPhasePngPathFor(definition, phaseNumber);
  const phaseLabel = bossPhaseDisplayName(definition, phaseNumber);

  return `<svg width="960" height="540" viewBox="0 0 960 540" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${escapeHtml(definition.name)} ${escapeHtml(phaseLabel)}</title>
  <desc id="desc">${escapeHtml(phaseDescription)}</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="960" y2="540" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#050b14"/>
      <stop offset=".48" stop-color="#12051c"/>
      <stop offset="1" stop-color="#061b22"/>
    </linearGradient>
    <radialGradient id="core" cx="50%" cy="46%" r="50%">
      <stop offset="0" stop-color="${primary}" stop-opacity=".32"/>
      <stop offset=".45" stop-color="${secondary}" stop-opacity=".16"/>
      <stop offset="1" stop-color="#020713" stop-opacity="0"/>
    </radialGradient>
    <pattern id="scan" width="9" height="9" patternUnits="userSpaceOnUse">
      <path d="M0 0H9" stroke="${primary}" stroke-opacity=".08"/>
    </pattern>
    <filter id="phaseImage">
      <feColorMatrix type="saturate" values="${1 + phaseNumber * 0.22}"/>
      <feComponentTransfer>
        <feFuncR type="linear" slope="${1 + phaseNumber * 0.06}"/>
        <feFuncG type="linear" slope="${1 + phaseNumber * 0.02}"/>
        <feFuncB type="linear" slope="${1 + phaseNumber * 0.04}"/>
      </feComponentTransfer>
    </filter>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="heavyGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="16" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <style>
      @keyframes pulseGlow { 0%,100% { opacity: .46; } 50% { opacity: 1; } }
      @keyframes energyMove { to { stroke-dashoffset: -260; transform: translateX(34px); } }
      @keyframes scanMove { 0% { transform: translateY(-540px); } 100% { transform: translateY(540px); } }
      @keyframes reactorFlicker { 0%,100% { opacity: .34; transform: scale(.94); } 40% { opacity: .92; transform: scale(1.08); } 70% { opacity: .58; transform: scale(1.02); } }
      @keyframes corruptionPulse { 0%,100% { opacity: .22; } 50% { opacity: .78; } }
      @keyframes eyeGlowPulse { 0%,100% { opacity: .56; } 50% { opacity: 1; } }
      @keyframes threatPulse { 0%,100% { opacity: .52; } 50% { opacity: 1; } }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes sweep { 0% { transform: translateX(-960px); } 100% { transform: translateX(960px); } }
      @keyframes emberRise { 0% { transform: translateY(60px); opacity: 0; } 35% { opacity: .9; } 100% { transform: translateY(-220px); opacity: 0; } }
      @keyframes mouthFire { 0%,100% { opacity: .28; transform: scaleX(.92); } 50% { opacity: .88; transform: scaleX(1.08); } }
      @keyframes heatDistort { 0%,100% { transform: translateX(-12px); opacity: .22; } 50% { transform: translateX(14px); opacity: .62; } }
      @keyframes smokeDrift { 0% { transform: translateX(-30px); opacity: .04; } 50% { opacity: .18; } 100% { transform: translateX(42px); opacity: .04; } }
      @keyframes dataFall { 0% { transform: translateY(-120px); opacity: 0; } 20% { opacity: .9; } 100% { transform: translateY(560px); opacity: 0; } }
      @keyframes lockDrift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(12px,-18px); } }
      @keyframes particleDrift { 0%,100% { transform: translate(0,0); opacity: .25; } 50% { transform: translate(20px,-26px); opacity: .8; } }
      @keyframes orbitPlanet { to { transform: rotate(360deg); } }
      @keyframes rotateEquation { 0%,100% { transform: rotate(-2deg); opacity: .34; } 50% { transform: rotate(3deg); opacity: .84; } }
      @keyframes voidDrift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-18px,16px); } }
      @keyframes apparitionFade { 0%,100% { opacity: .08; transform: scale(.92); } 50% { opacity: .46; transform: scale(1.08); } }
      @keyframes fragmentDrift { 0%,100% { transform: translateY(0) rotate(0deg); opacity: .18; } 50% { transform: translateY(-24px) rotate(8deg); opacity: .58; } }
      @keyframes chainMove { to { stroke-dashoffset: -180; } }
      @keyframes lightningFlash { 0%,100% { opacity: .15; } 45% { opacity: 1; } 52% { opacity: .25; } 60% { opacity: .9; } }
      @keyframes veinSurge { to { stroke-dashoffset: -140; } }
      @keyframes magicRotate { to { transform: rotate(360deg); } }
      @keyframes pageDrift { 0%,100% { transform: translate(0,0) rotate(0deg); opacity: .25; } 50% { transform: translate(18px,-24px) rotate(6deg); opacity: .74; } }
      @keyframes promptFloat { 0%,100% { transform: translateY(0); opacity: .25; } 50% { transform: translateY(-30px); opacity: .82; } }
      .pulsing-glow { animation: pulseGlow ${Math.max(0.9, 2.4 - phaseNumber * 0.22)}s ease-in-out infinite; }
      .energy-movement { animation: energyMove ${Math.max(1.8, 5.4 - phaseNumber * .48)}s linear infinite; }
      .scanline-movement { animation: scanMove ${Math.max(2.2, 5.8 - phaseNumber * .35)}s linear infinite; }
      .reactor-flicker { transform-box: fill-box; transform-origin: center; animation: reactorFlicker ${Math.max(.72, 1.8 - phaseNumber * .18)}s steps(3,end) infinite; }
      .corruption-pulse { animation: corruptionPulse ${Math.max(1.1, 2.8 - phaseNumber * .22)}s ease-in-out infinite; }
      .eye-glow-pulse { animation: eyeGlowPulse ${Math.max(.82, 2.1 - phaseNumber * .22)}s ease-in-out infinite; }
      .threat-indicator-pulse { animation: threatPulse ${Math.max(.72, 1.9 - phaseNumber * .18)}s ease-in-out infinite; }
      .spin { transform-origin: 480px 270px; animation: spin ${Math.max(6, 14 - phaseNumber * 2)}s linear infinite; }
      .sweep { animation: sweep ${Math.max(2.6, 6 - phaseNumber * .4)}s linear infinite; }
      .ember-rise { animation: emberRise ${Math.max(1.4, 3.4 - phaseNumber * .35)}s ease-out infinite; }
      .mouth-fire { transform-box: fill-box; transform-origin: center; animation: mouthFire ${Math.max(.55, 1.5 - phaseNumber * .18)}s ease-in-out infinite; }
      .heat-distortion { animation: heatDistort ${Math.max(1.0, 2.8 - phaseNumber * .24)}s ease-in-out infinite; }
      .smoke-drift { animation: smokeDrift ${Math.max(2.8, 5.8 - phaseNumber * .3)}s ease-in-out infinite; }
      .data-waterfall { animation: dataFall ${Math.max(1.8, 4.6 - phaseNumber * .38)}s linear infinite; }
      .lock-drift { animation: lockDrift ${Math.max(1.8, 4.2 - phaseNumber * .28)}s ease-in-out infinite; }
      .corruption-particle { animation: particleDrift ${Math.max(1.1, 3.2 - phaseNumber * .22)}s ease-in-out infinite; }
      .data-leak { animation: energyMove ${Math.max(1.4, 4.0 - phaseNumber * .34)}s linear infinite; }
      .orbiting-planet { transform-origin: 480px 270px; animation: orbitPlanet ${Math.max(4.8, 12 - phaseNumber * 1.2)}s linear infinite; }
      .rotating-equation { transform-box: fill-box; transform-origin: center; animation: rotateEquation ${Math.max(2.2, 5.0 - phaseNumber * .34)}s ease-in-out infinite; }
      .void-particle-drift { animation: voidDrift ${Math.max(1.5, 4.0 - phaseNumber * .3)}s ease-in-out infinite; }
      .orbiting-face { transform-origin: 480px 270px; animation: orbitPlanet ${Math.max(5, 13 - phaseNumber * 1.4)}s linear infinite; }
      .apparition-fade { animation: apparitionFade ${Math.max(1.2, 3.6 - phaseNumber * .22)}s ease-in-out infinite; }
      .memory-fragment { animation: fragmentDrift ${Math.max(1.7, 4.6 - phaseNumber * .26)}s ease-in-out infinite; }
      .moving-chain { animation: chainMove ${Math.max(1.2, 3.8 - phaseNumber * .28)}s linear infinite; }
      .lightning-arc { animation: lightningFlash ${Math.max(.62, 1.8 - phaseNumber * .16)}s steps(2,end) infinite; }
      .glowing-vein { animation: veinSurge ${Math.max(1.0, 3.2 - phaseNumber * .25)}s linear infinite; }
      .magic-circle-rotate { transform-origin: 480px 286px; animation: magicRotate ${Math.max(5, 14 - phaseNumber * 1.4)}s linear infinite; }
      .spell-page-drift { animation: pageDrift ${Math.max(1.8, 4.8 - phaseNumber * .3)}s ease-in-out infinite; }
      .prompt-fragment { animation: promptFloat ${Math.max(1.4, 3.8 - phaseNumber * .26)}s ease-in-out infinite; }
    </style>
  </defs>
  <rect width="960" height="540" fill="url(#bg)"/>
  <image href="${phaseArt}" x="0" y="0" width="960" height="540" preserveAspectRatio="xMidYMid slice" filter="url(#phaseImage)"/>
  <rect width="960" height="540" fill="url(#core)" opacity="${0.26 + phaseNumber * 0.08}"/>
  <rect class="corruption-pulse" width="960" height="540" fill="${secondary}" fill-opacity="${phaseNumber >= 3 ? ".12" : ".04"}"/>
  <rect width="960" height="540" fill="url(#scan)"/>
  <rect class="scanline-movement" x="0" y="-540" width="960" height="86" fill="${primary}" fill-opacity=".10"/>
  <rect class="sweep" x="0" y="0" width="${120 + phaseNumber * 46}" height="540" fill="${primary}" fill-opacity=".045"/>
  <path class="spin" d="M84 270C204 32 756 32 876 270C756 508 204 508 84 270Z" stroke="${secondary}" stroke-opacity=".16" stroke-width="${phaseNumber + 3}" stroke-dasharray="26 18" fill="none"/>
  <g filter="url(#heavyGlow)">
    ${effects}
  </g>
  <g filter="url(#glow)">
    <text x="58" y="66" fill="${accent}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="20" font-weight="900">PHASE ${phaseNumber}</text>
    <text x="58" y="92" fill="#f7fbff" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="16" font-weight="900">${escapeHtml(phaseLabel)}</text>
    <circle class="threat-indicator-pulse" cx="902" cy="58" r="${16 + phaseNumber * 3}" fill="${primary}" filter="url(#glow)"/>
  </g>
</svg>
`;
}

function renderDefeatCard(execution) {
  return `<svg width="960" height="540" viewBox="0 0 960 540" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Boss terminated: ${escapeHtml(execution.boss_name)}</title>
  <desc id="desc">${escapeHtml(execution.username)} earned ${escapeHtml(execution.executioner_badge)} with ${execution.final_damage} final damage.</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="960" y2="540" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#090704"/>
      <stop offset=".45" stop-color="#221404"/>
      <stop offset="1" stop-color="#050b14"/>
    </linearGradient>
    <linearGradient id="gold" x1="160" y1="0" x2="800" y2="540" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff4a3"/>
      <stop offset=".35" stop-color="#ffbf2e"/>
      <stop offset=".72" stop-color="#ff2bd6"/>
      <stop offset="1" stop-color="#23f7dd"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-40%" width="160%" height="180%">
      <feGaussianBlur stdDeviation="9" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <pattern id="scan" width="8" height="8" patternUnits="userSpaceOnUse">
      <path d="M0 0H8" stroke="#ffbf2e" stroke-opacity=".1"/>
    </pattern>
    <style>
      @keyframes pulse { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
      @keyframes sweep { 0% { transform: translateX(-960px); } 100% { transform: translateX(960px); } }
      @keyframes dash { to { stroke-dashoffset: -180; } }
      .pulse { animation: pulse 1.8s ease-in-out infinite; }
      .sweep { animation: sweep 4.6s linear infinite; }
      .dash { animation: dash 3.6s linear infinite; }
    </style>
  </defs>
  <rect width="960" height="540" rx="24" fill="url(#bg)"/>
  <rect width="960" height="540" fill="url(#scan)"/>
  <rect class="sweep" x="0" y="0" width="180" height="540" fill="#ffbf2e" fill-opacity=".065"/>
  <rect x="28" y="28" width="904" height="484" rx="18" stroke="url(#gold)" stroke-width="3"/>
  <rect x="52" y="52" width="856" height="436" rx="10" stroke="#ffbf2e" stroke-opacity=".45"/>
  <text x="80" y="106" fill="#ffbf2e" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="24" font-weight="900" letter-spacing="3">BOSS TERMINATED</text>
  <text x="80" y="170" fill="#f7fbff" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="48" font-weight="900">${escapeHtml(truncate(execution.boss_name, 24))}</text>
  <text x="80" y="220" fill="#23f7dd" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="24">${escapeHtml(execution.boss_title)}</text>
  <g filter="url(#glow)">
    <path class="pulse" d="M480 258L526 332L612 354L556 420L562 506L480 474L398 506L404 420L348 354L434 332Z" fill="url(#gold)" fill-opacity=".88"/>
    <circle cx="480" cy="388" r="74" fill="#020713" stroke="#ffbf2e" stroke-width="7"/>
    <text x="480" y="414" text-anchor="middle" fill="#ffbf2e" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="72" font-weight="900">👑</text>
  </g>
  <path class="dash" d="M78 260H882M78 456H882" stroke="#ffbf2e" stroke-width="5" stroke-dasharray="22 14"/>
  <text x="80" y="306" fill="#ffbf2e" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="20">EXECUTIONER</text>
  <text x="80" y="350" fill="#f7fbff" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="34" font-weight="900">@${escapeHtml(truncate(execution.username, 22))}</text>
  <text x="80" y="392" fill="#23f7dd" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="26">${escapeHtml(execution.executioner_badge)}</text>
  <text x="628" y="306" fill="#ffbf2e" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="20">FINAL DAMAGE</text>
  <text x="628" y="354" fill="#f7fbff" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="44" font-weight="900">${execution.final_damage}</text>
  <text x="628" y="404" fill="#c8d8ef" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="18">${escapeHtml(execution.timestamp)}</text>
</svg>
`;
}

function generateDefeatCards(executioners) {
  ensureDirs();
  for (const execution of normalizeExecutioners(executioners)) {
    const filePath = path.join(ROOT, execution.defeat_card);
    atomicWriteFile(filePath, renderDefeatCard(execution));
  }
}

function generateBossAssets(bossRegistry) {
  ensureDirs();
  for (const definition of normalizeBossRegistry(bossRegistry)) {
    for (let phaseNumber = 1; phaseNumber <= 4; phaseNumber += 1) {
      const filePath = path.join(BOSS_ASSET_DIR, `${definition.id}_p${phaseNumber}.svg`);
      atomicWriteFile(filePath, renderBossPhaseSvg(definition, phaseNumber));
    }
  }
}

function renderAll(state = loadState()) {
  ensureDirs();
  const safeState = normalizeState(state);
  saveState(safeState);
  generateBossAssets(safeState.bossRegistry);
  generateDefeatCards(safeState.executioners);
  atomicWriteFile(README_PATH, renderReadme(safeState));
  atomicWriteFile(SVG_PATH, renderSvg(safeState));
}

function formatAttackComment(result) {
  const attacker = markdownUser(result.attacker);
  const bossLine = result.defeated
    ? `${attacker} defeated **${markdownCell(result.defeatedBoss.boss_name)}** and became **${markdownCell(result.execution.executioner_badge)}**. A new boss has spawned: **${markdownCell(result.bossAfter.boss_name)}**.`
    : `**${markdownCell(result.bossAfter.boss_name)}** now has **${result.bossAfter.current_hp} / ${result.bossAfter.max_hp} HP** and is in **${markdownCell(result.bossAfter.phase)}**.`;

  const appliedLine = result.appliedDamage === result.rolledDamage
    ? ""
    : `\nApplied damage: **${result.appliedDamage}**`;

  return `## Raid Attack Result

Attacker: ${attacker}
Attack: **${markdownCell(result.attackType)}**
Attack dealt: **${result.rolledDamage} damage**${appliedLine}

Loot Found: **${markdownCell(result.loot.item)}**
Rarity: **${markdownCell(result.loot.rarity)}**
Inventory: **${result.inventoryCount} owned**

${bossLine}
`;
}

function validateStateInvariants(state) {
  const safeState = normalizeState(state);
  const errors = [];
  const boss = safeState.boss;

  if (!Number.isInteger(boss.max_hp) || boss.max_hp < 1) errors.push("boss.max_hp must be a positive integer");
  if (!Number.isInteger(boss.current_hp) || boss.current_hp < 0 || boss.current_hp > boss.max_hp) errors.push("boss.current_hp must be between 0 and max_hp");
  if (boss.phase !== phaseForHp(boss.current_hp, boss.max_hp)) errors.push("boss.phase does not match HP percentage");

  const users = new Set();
  for (const row of safeState.leaderboard) {
    if (users.has(row.username)) errors.push(`duplicate leaderboard user: ${row.username}`);
    users.add(row.username);
    if (!Number.isInteger(row.total_damage) || row.total_damage < 0) errors.push(`invalid total damage for ${row.username}`);
    if (!Number.isInteger(row.attacks) || row.attacks < 0) errors.push(`invalid attack count for ${row.username}`);
  }

  for (const attack of safeState.attacks) {
    if (!Number.isInteger(attack.damage) || attack.damage < 0) errors.push("attack damage must be a non-negative integer");
    if (!Number.isInteger(attack.applied_damage) || attack.applied_damage < 0) errors.push("applied damage must be a non-negative integer");
    if (attack.loot && (!RARITIES.includes(attack.loot.rarity) || !attack.loot.item)) errors.push("attack loot must have a valid rarity and item");
  }

  const rateTotal = RARITIES.reduce((sum, rarity) => sum + safeState.lootRegistry.drop_rates[rarity], 0);
  if (Math.abs(rateTotal - 100) > 0.0001) errors.push(`loot drop rates must total 100, got ${rateTotal}`);
  for (const rarity of RARITIES) {
    if (!Array.isArray(safeState.lootRegistry.items[rarity]) || safeState.lootRegistry.items[rarity].length === 0) {
      errors.push(`loot registry must include items for ${rarity}`);
    }
  }

  const inventoryUsers = new Set();
  for (const player of safeState.playerInventory) {
    if (inventoryUsers.has(player.username)) errors.push(`duplicate inventory user: ${player.username}`);
    inventoryUsers.add(player.username);
    const itemKeys = new Set();
    for (const item of player.items) {
      const key = `${item.rarity}:${item.item}`;
      if (itemKeys.has(key)) errors.push(`duplicate inventory item for ${player.username}: ${key}`);
      itemKeys.add(key);
      if (!RARITIES.includes(item.rarity)) errors.push(`invalid inventory rarity for ${player.username}: ${item.rarity}`);
      if (!Number.isInteger(item.quantity) || item.quantity < 1) errors.push(`invalid inventory quantity for ${player.username}: ${item.item}`);
    }
  }

  for (const drop of safeState.legendaryDrops) {
    if (!["Legendary", "Mythic"].includes(drop.rarity)) errors.push(`invalid legendary history rarity: ${drop.rarity}`);
  }

  const executionKeys = new Set();
  for (const execution of safeState.executioners) {
    const key = `${execution.boss_id}:${execution.timestamp}:${execution.username}`;
    if (executionKeys.has(key)) errors.push(`duplicate execution entry: ${key}`);
    executionKeys.add(key);
    if (!execution.executioner_badge) errors.push(`execution missing badge: ${key}`);
    if (!execution.boss_image) errors.push(`execution missing boss image: ${key}`);
    if (!execution.defeat_card) errors.push(`execution missing defeat card: ${key}`);
    if (!Number.isInteger(execution.final_damage) || execution.final_damage < 0) errors.push(`invalid execution final damage: ${key}`);
  }

  return errors;
}

module.exports = {
  ATTACKS,
  applyAttack,
  atomicWriteFile,
  formatAttackComment,
  loadState,
  normalizeState,
  parseAttackType,
  renderAll,
  renderBossPhaseSvg,
  renderDefeatCard,
  renderReadme,
  renderSvg,
  rollLoot,
  sanitizeUsername,
  validateStateInvariants
};
