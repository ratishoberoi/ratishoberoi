# Final Profile Deployment Report

Generated: 2026-05-25

## Deployment Summary

Status: **BLOCKED FOR FULL PRODUCTION ATTACK VERIFICATION**

The profile raid migration was merged and pushed to production `main`, but the required post-merge live attack test could not be completed because the available `GH_TOKEN` cannot create GitHub issues.

This is a credential/access limitation, not a local code validation result.

## Commits

Pre-merge polish commit: `721e886`  
Merge commit pushed to production: `61fb6d8caedeffaa24b5156f1f9583fda2e61560`

## Production Repository Verification

Repository: `ratishoberoi/ratishoberoi`  
Default branch: `main`  
Production head verified by GitHub API: `61fb6d8caedeffaa24b5156f1f9583fda2e61560`

| Check | Result | Evidence |
| --- | --- | --- |
| Repository reachable | PASS | GitHub API returned `ratishoberoi/ratishoberoi`, `default_branch=main` |
| Raid workflow present | PASS | `.github/workflows/raid-attack.yml`, SHA `005f234b3d7f1398aee71e658ffdc4ee55a928c8` |
| Raid workflow active | PASS | GitHub API returned workflow `Raid Attack`, `state=active` |
| Attack issue template present | PASS | `.github/ISSUE_TEMPLATE/attack.yml`, SHA `33d5e8e31e3e485d49e93d282e6373aba8cb032a` |
| README deployed | PASS | Remote README title is `# RATISH OBEROI` |
| Visitor intro deployed | PASS | Remote README contains exactly one `## Visitor Intro` section |
| `NEURAL NEXUS` removed | PASS | Remote README grep count: `0` |
| HackerRank removed | PASS | Remote README grep count: `0` |
| Email button fixed | PASS | Remote README contains `mailto:ratishoberoi3993@gmail.com` |

## Contact + Stats Verification

| Item | Result | Evidence |
| --- | --- | --- |
| LinkedIn URL updated | PASS | `https://www.linkedin.com/in/ratishoberoi` present in generated README |
| LeetCode URL updated | PASS | `https://leetcode.com/u/ratishoberoi/` present in generated README |
| Email recipient | PASS | `mailto:ratishoberoi3993@gmail.com` present in generated README |
| GitHub profile summary image | PASS | HTTP `200`, `content-type: image/svg+xml` |
| Repos per language image | PASS | HTTP `200`, `content-type: image/svg+xml` |
| Most committed language image | PASS | HTTP `200`, `content-type: image/svg+xml` |
| GitHub stats image | PASS | HTTP `200`, `content-type: image/svg+xml` |
| Productive time image | PASS | HTTP `200`, `content-type: image/svg+xml` |

The previous `github-readme-stats.vercel.app` image source returned HTTP `503` with `x-vercel-error: DEPLOYMENT_PAUSED`, so it was replaced before merge.

## Attack Test Evidence

Required production test: create a real attack issue after merge and verify issue creation, workflow trigger, damage, loot, boss HP update, leaderboard update, recent combat update, live pulse update, README regeneration, issue comment, and auto-close.

Result: **FAIL - NOT EXECUTED**

Issue creation request:

```text
POST https://api.github.com/repos/ratishoberoi/ratishoberoi/issues
```

Response:

```json
{
  "message": "Resource not accessible by personal access token",
  "documentation_url": "https://docs.github.com/rest/issues/issues#create-an-issue",
  "status": "403"
}
```

GitHub response headers included:

```text
x-accepted-github-permissions: issues=write
```

No issue number, workflow run ID, damage value, loot value, README commit, issue comment, or issue close event exists for this production test because GitHub rejected issue creation before the attack pipeline could start.

## Workflow Evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Workflow exists on production default branch | PASS | `.github/workflows/raid-attack.yml` returned by GitHub contents API |
| Workflow active | PASS | GitHub workflows API returned `state=active` |
| Workflow trigger verified by real issue | NOT TESTABLE | Blocked by `GH_TOKEN` missing issue write capability |
| Workflow run ID | NOT AVAILABLE | No issue could be created |
| Workflow conclusion | NOT AVAILABLE | No workflow run could be triggered |

## Current Production Boss State

Remote `data/boss.json` on `main`:

```json
{
  "boss_id": "gradient_vanisher",
  "boss_name": "The Gradient Vanisher",
  "current_hp": 1476,
  "max_hp": 1500,
  "phase": "Phase 1"
}
```

Remote README current boss GIF:

```text
assets/boss_phases/gradient_vanisher_p1.gif
```

Old current-boss SVG wrapper references in remote README:

```text
0
```

## GIF Validation

Status: **PASS - LOCAL AND REMOTE PATH VALIDATION**

All 24 GIF assets exist locally after merge:

```text
data_leak_hydra_p1.gif 3054048 bytes
data_leak_hydra_p2.gif 4901261 bytes
data_leak_hydra_p3.gif 4218746 bytes
data_leak_hydra_p4.gif 4350290 bytes
gpu_devourer_p1.gif 2410717 bytes
gpu_devourer_p2.gif 3101241 bytes
gpu_devourer_p3.gif 3383165 bytes
gpu_devourer_p4.gif 3560853 bytes
gradient_vanisher_p1.gif 3785988 bytes
gradient_vanisher_p2.gif 3589952 bytes
gradient_vanisher_p3.gif 4719479 bytes
gradient_vanisher_p4.gif 5552491 bytes
hallucination_titan_p1.gif 3204087 bytes
hallucination_titan_p2.gif 3666063 bytes
hallucination_titan_p3.gif 4538018 bytes
hallucination_titan_p4.gif 6162080 bytes
overfitted_beast_p1.gif 4858366 bytes
overfitted_beast_p2.gif 6016667 bytes
overfitted_beast_p3.gif 5693876 bytes
overfitted_beast_p4.gif 5233981 bytes
prompt_goblin_p1.gif 5806158 bytes
prompt_goblin_p2.gif 5296194 bytes
prompt_goblin_p3.gif 6338533 bytes
prompt_goblin_p4.gif 6536644 bytes
```

Production README references the current phase GIF path directly.

## Phase Validation

Status: **PASS - LOCAL RENDER VALIDATION; LIVE TRANSITION NOT TESTABLE**

Local render validation for The Gradient Vanisher:

| Phase | HP Used | Expected GIF | Result |
| --- | ---: | --- | --- |
| Phase 1 | 1500 | `gradient_vanisher_p1.gif` | PASS |
| Phase 2 | 1050 | `gradient_vanisher_p2.gif` | PASS |
| Phase 3 | 600 | `gradient_vanisher_p3.gif` | PASS |
| Final Phase | 150 | `gradient_vanisher_p4.gif` | PASS |

Live phase transition verification through real attacks was **not testable** because issue creation is blocked by token permissions.

## Boss Rotation Validation

Status: **PASS - LOCAL ISOLATED SIMULATION; LIVE ROTATION NOT TESTABLE**

An isolated local clone was used to force The Gradient Vanisher to `1 HP` and apply one attack.

Observed result:

| Check | Result | Evidence |
| --- | --- | --- |
| Gradient Vanisher defeated | PASS | `defeated=true` |
| Execution recorded | PASS | `production-rotation-simulation`, badge `Reality Anchor` |
| Hall of Fame updated | PASS | Hall of Fame contains Gradient Vanisher defeat record |
| Next boss spawned | PASS | `hallucination_titan` |
| Next boss HP reset | PASS | `1750 / 1750` |
| Next boss phase reset | PASS | `Phase 1` |
| Next boss GIF selected | PASS | README contains `hallucination_titan_p1.gif` |

Live boss rotation verification through production issues was **not testable** because issue creation is blocked by token permissions.

## Regression Validation

| Check | Result | Evidence |
| --- | --- | --- |
| JavaScript syntax | PASS | `node --check scripts/raid.js` exited `0` |
| State validation | PASS | `node scripts/validate_state.js` returned `validation ok` |
| README generated | PASS | `node scripts/render_readme.js` completed before merge |
| Gameplay files modified during final polish | PASS | Only `README.md` and `scripts/raid.js` profile-rendering sections changed before merge |
| Damage logic changed | PASS | No damage logic changes in final polish diff |
| Loot logic changed | PASS | No loot logic changes in final polish diff |
| Executioner logic changed | PASS | No executioner logic changes in final polish diff |
| Campaign/GIF assets changed | PASS | No GIF assets changed in final polish diff |

## Final Verdict

Deployment state: **PARTIALLY DEPLOYED, NOT FULLY PRODUCTION-VERIFIED**

The profile migration and branding polish are live on `main`. Static production checks pass. Workflow and issue template files are present on the default branch. Local render, state, GIF, phase, and isolated boss-rotation validations pass.

The required real end-to-end production attack test is blocked by the available `GH_TOKEN`, which lacks `issues=write` permission. A token that can create issues in `ratishoberoi/ratishoberoi` is required to complete:

- Issue Created
- Workflow Triggered
- Damage Rolled
- Loot Rolled
- Boss HP Updated
- Leaderboard Updated
- Recent Combat Updated
- Live Pulse Updated
- README Regenerated
- Issue Comment Posted
- Issue Auto Closed
- Live phase transition validation
- Live boss death and rotation validation

Final launch readiness: **BLOCKED**

Required next action: provide a GitHub token with `issues: write` access for `ratishoberoi/ratishoberoi`, then rerun the post-merge production attack test.
