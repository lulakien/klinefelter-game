# Agentflow Usage Guide for klinefelter-game

## What Agentflow Does

Agentflow is a **local CLI orchestrator** that runs AI coding agents through a structured workflow:

1. A **planner** picks the next small goal from your project.
2. A **builder** implements it.
3. A **reviewer** checks the diff.
4. A **judge** decides if the work is good enough.
5. If not, a **fixer** tries again (up to a configured max).
6. When approved, agentflow commits the changes.

Everything runs locally on your machine. Agentflow does **not** push to remote or phone home.

## What Agentflow Does NOT Do

- It does **not** push to GitHub/GitLab (push is disabled by default).
- It does **not** run without agents — the default `example` profile uses `echo` placeholders.
- It does **not** modify protected files (CLAUDE.md, DESIGN.md, README.md, etc.).
- It does **not** make network calls on its own — it just invokes whatever agent command you configure.

## Quick Reference

### Check Status

```bash
agentflow status
```

Shows the selected project, active run, current goal, git branch, and more.

### Open the Web UI (Recommended for daily use)

```bash
agentflow ui --port 3457
```

Opens a local web dashboard at `http://127.0.0.1:3457`.

The UI lets you:
- Initialize `.agentflow` for a new local project
- Add/select projects from the local registry
- Edit common safe config fields with automatic config backups
- Edit checks in the safe config panel
- Create profiles from role command fields, validate them, save them, and select them
- View/select workflows and validate routing against the selected profile
- See project, profile, workflow, git status, and current run at a glance
- Run doctor, rebuild memory, dry run, and start work with one click
- View safety warnings (dirty tree, placeholder agents, branch checks)
- Browse run history, reports, logs, tracked diffs, and untracked files
- Reset runtime state safely

**Safe first-use flow from the UI:**
1. Open **Project Setup** and confirm the selected project is `klinefelter-game`.
2. Check **Ready To Run Checklist** and fix any failed items.
3. Use **Safe Config** to adjust allowed branches, protected file patterns, checks, commit mode, and max fix attempts.
4. Use **Agent Profiles** to replace placeholder `echo` agents with real local commands.
5. Use **Workflows** to confirm the selected workflow routes to configured roles.
6. Click **Dry run** to preview.
7. Enter a goal and click **Start no-commit work**.
8. Review the diff and final report.
9. Only enable commit after you trust the workflow.

### Run Doctor

```bash
agentflow doctor
```

Checks that your setup is healthy: Node version, git repo, config, agent binaries, protected files, etc.

### Rebuild Memory

```bash
agentflow memory rebuild
```

Scans your project documents and rebuilds the memory index that agents use for context.

### Dry Run (No Changes)

```bash
agentflow work --dry-run
```

Shows what agentflow **would** do without making any changes. Use this first.

### Safe First Run (No Commit)

```bash
agentflow work \
  --goal "Inspect the project and make the smallest safe improvement. Do not edit protected docs." \
  --no-commit \
  --max-fix-attempts 1
```

This runs the full workflow but **does not commit**. You can inspect the diff afterward:

```bash
git diff
git status
```

### Review the Final Report

After a run completes, agentflow writes a report. Check:

```bash
ls .agentflow/reports/
cat .agentflow/reports/<latest-report>.json
```

The report includes the goal, verdict, commit hash (if committed), and next steps.

You can also view the latest report from the UI by clicking **Open latest report**.

### Undo a Bad Run

If agentflow made changes you don't want:

```bash
git restore .
git clean -fd
agentflow state reset --force
```

This:
1. Restores all tracked files to the last commit.
2. Removes untracked files created by the run.
3. Resets agentflow's internal state (active run, lock, etc.).

You can also click **Reset runtime state** in the UI.

## Why Use `--no-commit` at First

Until you've configured **real agents** (not `echo` placeholders), agentflow cannot do real work. The UI blocks real work with placeholder agents unless you explicitly allow a fake-agent test. Even with real agents, always use `--no-commit` for the first run to verify:

- The goal is reasonable.
- The diff looks correct.
- Protected files were not touched.

Only remove `--no-commit` once you trust the workflow.

## How Protected Files Work

Protected files are listed in `.agentflow/config.yaml` under `protectedFiles.patterns`. Agentflow will:

- **Auto-restore** them if an agent modifies them (before and after snapshot).
- **Block commits** if they were changed and can't be restored.

Current protected files:

- `documents/**`
- `.env`, `.env.*`
- `**/*.pem`, `**/*.key`
- `CLAUDE.md`, `AGENTS.md`, `DESIGN.md`, `HANDOFF.md`, `PROJECT.txt`, `README.md`

## Configuring Real Agents

The default `example` profile uses `echo` placeholders. To do real work, open the UI and use **Agent Profiles** to edit or create a profile. The UI validates role mappings, missing agent IDs, commands missing from `PATH`, placeholder commands, prompt delivery mismatches, and shell-execution warnings.

You can also edit the YAML manually:

```bash
.agentflow/agent-profiles/example.yaml
```

Each agent needs a `command` that:
- Reads a prompt from **stdin**.
- Writes output to **stdout**.
- Exits with **0** on success.

Generic command patterns:

| Prompt delivery | Args pattern |
|-----------------|--------------|
| `stdin` | no prompt placeholder required |
| `file` | include `{{promptFile}}` in args |
| `arg` | include `{{prompt}}` in args |

You can create multiple profiles (e.g., `fast.yaml`, `deep.yaml`) and switch between them:

```bash
agentflow agents list
agentflow agents select <profile-name>
```

The same selection can now be done from the UI.

## Git Safety

- `.agentflow/config.yaml`, workflows, profiles, and templates are **safe to commit**.
- `.agentflow/state/`, `runs/`, `logs/`, `reports/`, `memory/` are **gitignored** — they contain runtime data.
- Agentflow will **never** push. `git.push` is reserved/dead config and the implementation does not push.

## Command Cheat Sheet

```bash
# Setup
agentflow project add klinefelter-game .
agentflow project select klinefelter-game

# Check health
agentflow doctor
agentflow status

# Build memory
agentflow memory rebuild

# Safe testing
agentflow work --dry-run
agentflow work --goal "..." --no-commit --max-fix-attempts 1

# Inspect results
git diff
git status
cat .agentflow/reports/*.json

# Undo everything
git restore .
git clean -fd
agentflow state reset --force

# UI (recommended daily use)
agentflow ui --port 3457
```
