# Profile Raid Migration Plan

Generated: 2026-05-25

Target repository:

```text
git@github.com:ratishoberoi/ratishoberoi.git
```

Migration branch:

```text
profile-raid-migration-20260525
```

## Goal

Move the GitHub Boss Raid experience from `github-boss-raid-dev` into the profile repository so the profile README becomes the battlefield, while keeping `github-boss-raid-dev` as the source/development repository.

## Files To Migrate

| Source | Target | Notes |
| --- | --- | --- |
| `README.md` generated structure | `README.md` | Replace the profile README with a combined profile + raid README in the requested order. |
| `.github/workflows/raid-attack.yml` | `.github/workflows/raid-attack.yml` | Preserve the attack automation workflow. |
| `.github/ISSUE_TEMPLATE/attack.yml` | `.github/ISSUE_TEMPLATE/attack.yml` | Preserve the attack issue form. |
| `scripts/*.js` | `scripts/*.js` | Preserve attack processing, README generation, validation, comments, and audits. |
| `data/*.json` | `data/*.json` | Preserve current boss state, campaign, leaderboard, attacks, executioners, loot, inventories, and hall of fame. |
| `assets/boss_phases/*.{gif,png}` | `assets/boss_phases/*.{gif,png}` | Preserve the canonical GIF/PNG boss phase visual system. |
| `assets/bosses/*.svg` | `assets/bosses/*.svg` | Preserve legacy/generated SVG wrappers used by scripts and historical records. |
| `assets/defeats/*.svg` | `assets/defeats/*.svg` | Preserve executioner defeat cards. |
| `assets/boss-card.svg` | `assets/boss-card.svg` | Preserve generated status card output. |

## Workflows To Migrate

| Workflow | Action |
| --- | --- |
| `.github/workflows/raid-attack.yml` | Add from dev repo. It processes raid attack issues, commits state, comments, and closes issues. |
| `.github/workflows/quest.yml` | Preserve existing profile workflow, but add a signal-only job guard so it does not close raid attack issues. |

## Issue Templates To Migrate

| Template | Action |
| --- | --- |
| `.github/ISSUE_TEMPLATE/attack.yml` | Add from dev repo. |
| `.github/ISSUE_TEMPLATE/config.yml` | Add with `blank_issues_enabled: true` so existing profile direct issue links for signal doors continue to work. |

## Assets To Migrate

Migrate only runtime assets required by the raid experience:

- `assets/boss_phases/*.gif`
- `assets/boss_phases/*.png`
- `assets/bosses/*.svg`
- `assets/defeats/*.svg`
- `assets/boss-card.svg`

Do not migrate local source videos from `assets/boss_videos/`; they are not required by the README or workflow runtime.

## Data To Migrate

Migrate all raid state JSON files:

- `data/boss.json`
- `data/boss_registry.json`
- `data/leaderboard.json`
- `data/attacks.json`
- `data/hall_of_fame.json`
- `data/executioners.json`
- `data/loot_registry.json`
- `data/player_inventory.json`
- `data/legendary_drops.json`

## Scripts To Migrate

Migrate the complete `scripts/` directory from the dev repo, then adjust README generation for profile layout.

Required script behavior after migration:

- Attack mechanics unchanged.
- Loot mechanics unchanged.
- Inventory mechanics unchanged.
- Executioner tracking unchanged.
- Campaign state unchanged.
- README output changes only to include profile sections in the requested order.

## Path Changes Required

Most asset and data paths remain repository-relative and do not need changes.

Required path/link changes:

- Attack CTA must point to `ratishoberoi/ratishoberoi` issue form when rendered in the profile repo.
- README generator must output profile sections around the raid sections.
- Existing profile issue links should continue targeting `ratishoberoi/ratishoberoi`.
- `.github/ISSUE_TEMPLATE/config.yml` must not disable blank issues, otherwise existing profile direct issue links may be blocked.

## GitHub Profile README Implications

Because this is the special `ratishoberoi/ratishoberoi` repository, `README.md` renders on the GitHub profile page.

Required visible order:

1. Hero Banner
2. About Me
3. 🔥 GLOBAL RAID ACTIVE
4. Current Boss
5. Attack CTA
6. Raid Rules
7. Top Raiders
8. Recent Combat
9. Live Pulse
10. Phase Evolution
11. World Boss Campaign
12. Executioners
13. Hall Of Fame
14. Key Achievements
15. Featured Projects
16. Tech Stack
17. GitHub Stats
18. Contact

## Rollback Plan

No changes are made to `main` during this migration.

If the branch is not approved:

```text
git push origin --delete profile-raid-migration-20260525
```

If the branch is merged later and rollback is needed:

1. Revert the merge commit on `main`.
2. Confirm `README.md`, `.github/workflows/quest.yml`, and previous profile content are restored.
3. Delete raid-specific files from profile repo only if they are not needed after revert.
4. Keep `github-boss-raid-dev` untouched as the source/development repository.

## Validation Plan

Before merge:

- Run `node --check scripts/raid.js`.
- Run `node scripts/validate_state.js`.
- Run `node scripts/render_readme.js`.
- Verify README section order.
- Verify all referenced assets exist.
- Verify attack issue form exists.
- Verify workflow YAML exists.
- Verify branch can be pushed.
- Attempt live issue test only if GitHub can trigger the branch workflow without touching `main`; otherwise report as not testable with evidence.
