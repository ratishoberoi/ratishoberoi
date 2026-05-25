const fs = require("fs");
const path = require("path");
const { applyAttack, formatAttackComment, parseAttackType } = require("./raid");

const attacker = process.env.ATTACKER || "unknown";
const issueNumber = process.env.ISSUE_NUMBER || null;
const attackType = parseAttackType(process.env.ISSUE_BODY || "");
const resultPath = path.join(__dirname, "..", "attack_result.md");
const metaPath = path.join(__dirname, "..", "attack_result.json");

function writeResult(markdown, meta) {
  fs.writeFileSync(resultPath, markdown);
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
}

if (!attackType) {
  writeResult(
    "## Raid Attack Result\n\nNo attack type was found in this issue. Please use the Attack the Raid Boss issue form.\n",
    { close_issue: true, state_changed: false, ok: false }
  );
  process.exit(0);
}

try {
  const result = applyAttack({ attacker, attackType, issueNumber });
  writeResult(formatAttackComment(result), { close_issue: true, state_changed: true, ok: true });
} catch (error) {
  const unsupportedAttack = /^Unsupported attack type/.test(error.message);
  writeResult(
    `## Raid Attack Result\n\n${error.message}\n`,
    { close_issue: unsupportedAttack, state_changed: false, ok: false }
  );
  process.exit(0);
}
