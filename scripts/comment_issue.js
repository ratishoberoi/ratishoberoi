const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const resultPath = path.join(ROOT, "attack_result.md");
const metaPath = path.join(ROOT, "attack_result.json");

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function githubRequest(method, url, body) {
  const token = requiredEnv("GITHUB_TOKEN");
  const response = await fetch(url, {
    method,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${method} ${url} failed with ${response.status}: ${text}`);
  }

  return response;
}

async function main() {
  const repository = requiredEnv("GITHUB_REPOSITORY");
  const issueNumber = requiredEnv("ISSUE_NUMBER");
  const body = fs.readFileSync(resultPath, "utf8");
  const meta = fs.existsSync(metaPath)
    ? JSON.parse(fs.readFileSync(metaPath, "utf8"))
    : { close_issue: true };

  const issueUrl = `https://api.github.com/repos/${repository}/issues/${issueNumber}`;
  await githubRequest("POST", `${issueUrl}/comments`, { body });

  if (meta.close_issue !== false) {
    await githubRequest("PATCH", issueUrl, {
      state: "closed",
      state_reason: "completed"
    });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
