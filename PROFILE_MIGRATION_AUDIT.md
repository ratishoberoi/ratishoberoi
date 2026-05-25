# Profile Migration Audit

Generated: 2026-05-25

Migration branch:

```text
profile-raid-migration-20260525
```

Target repository:

```text
git@github.com:ratishoberoi/ratishoberoi.git
```

## Scope

This audit verifies the branch implementation before any merge to `main`.

## Local Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Migration branch created | PASS | Current branch is `profile-raid-migration-20260525`. |
| README renders from generator | PASS | `node scripts/render_readme.js` completed and regenerated `README.md`. |
| Script syntax | PASS | `node --check scripts/raid.js` completed successfully. |
| State validation | PASS | `node scripts/validate_state.js` returned `validation ok`. |
| README profile order | PASS | Section-order check confirmed Hero Banner, About Me, Global Raid, Current Boss, CTA, Raid Rules, Top Raiders, Recent Combat, Live Pulse, Phase Evolution, World Boss Campaign, Executioners, Hall of Fame, Key Achievements, Featured Projects, Tech Stack, GitHub Stats, Contact. |
| Attack CTA points to profile repo | PASS | Generated CTA targets `https://github.com/ratishoberoi/ratishoberoi/issues/new?template=attack.yml`. |
| GIF hero path resolves | PASS | `assets/boss_phases/gradient_vanisher_p1.gif` exists. |
| README local asset references resolve | PASS | All `src=\"./...\"` README references exist locally. |
| Attack issue template exists | PASS | `.github/ISSUE_TEMPLATE/attack.yml` exists. |
| Issue template config preserves direct issue links | PASS | `.github/ISSUE_TEMPLATE/config.yml` sets `blank_issues_enabled: true`. |
| Raid workflow exists | PASS | `.github/workflows/raid-attack.yml` exists. |
| Existing signal workflow preserved | PASS | `.github/workflows/quest.yml` remains present. |
| Signal workflow conflict avoided | PASS | `quest.yml` now has `if: startsWith(github.event.issue.title, 'signal|')`, preventing it from closing raid attack issues. |
| Campaign state migrated | PASS | `data/boss.json`, `data/boss_registry.json`, `data/executioners.json`, and `data/hall_of_fame.json` exist. |
| Loot/inventory state migrated | PASS | `data/loot_registry.json`, `data/player_inventory.json`, and `data/legendary_drops.json` exist. |
| GIF system migrated | PASS | `assets/boss_phases` contains GIF and PNG phase assets. |
| Executioner defeat cards migrated | PASS | `assets/defeats` contains existing defeat cards. |

## README Section Order Evidence

```text
# NEURAL NEXUS
## About Me
# 🔥 GLOBAL RAID ACTIVE
## Current Boss
⚔ ATTACK THIS BOSS ⚔
## Raid Rules
## 🏆 TOP RAIDERS
## ⚔ RECENT COMBAT
## Live Pulse
## Phase Evolution
## WORLD BOSS CAMPAIGN
## Executioners
## Hall of Fame
## Key Achievements
## Featured Projects
## Tech Stack
## GitHub Stats
## Contact
```

## Files Changed

| Path | Change |
| --- | --- |
| `README.md` | Replaced profile README with profile + raid battlefield layout. |
| `.github/workflows/quest.yml` | Preserved existing workflow and added a signal-only guard. |
| `.github/workflows/raid-attack.yml` | Added raid attack workflow. |
| `.github/ISSUE_TEMPLATE/attack.yml` | Added raid attack issue form. |
| `.github/ISSUE_TEMPLATE/config.yml` | Added issue-template config with blank issues enabled. |
| `scripts/` | Added raid automation scripts. |
| `data/` | Added raid state JSON files. |
| `assets/` | Added raid visual assets. |
| `PROFILE_RAID_MIGRATION_PLAN.md` | Added migration plan. |
| `PROFILE_MIGRATION_AUDIT.md` | Added this audit. |

## Branch Live-Test Constraint

GitHub `issues` event workflows run from the repository default branch. Because this migration is intentionally not on `main`, a real issue attack cannot exercise `.github/workflows/raid-attack.yml` until the branch is merged or the workflow exists on `main`.

This will be documented in `PROFILE_LIVE_VERIFICATION.md`.
