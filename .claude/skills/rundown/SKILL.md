---
name: rundown
description: Draws a project map ("rundown") of the current git repo as one offline HTML page in .rundown/ - the main parts with status (done, in progress, not started, stuck), a codebase treemap, milestones and what is left before the next one, the suggested next step, what changed since the last run, a commit heatmap, branches and worktrees, and decisions waiting for the user with defaults. Use it whenever the user types /rundown (also "/rundown quick", "/rundown facts", "/rundown <path>"), says "rundown", "project map", "map this project", "where are we?", or wants a fast overview before a long autonomous stretch or after a milestone. In this repository the same map also shows in the office (Labs > Rundown).
---

# Rundown

Draw a map of the project the user is in, fast, and keep it current on later runs. The script
does the deterministic work (facts, layout, diff, page). You add the judgement: how the project
splits into parts, their status, the next step, and the decisions only the user can make.

All output goes to `<git top>/.rundown/`. Never change anything else in the project.

## The script

This repository builds the script from the office's own code (`src/server/rundown/`,
`src/shared/rundown/`), so the page here and the Rundown window in the office are the same.

- Working on Mergeline itself (this repo, with `src/server/rundown/cli.ts`) and
  `dist/rundown/rundown.mjs` exists: `RUNDOWN=dist/rundown/rundown.mjs`, so you map with the
  build you just made (`npm run build:rundown` after changing the collector or the page).
- Anywhere else: `RUNDOWN=~/.claude/skills/rundown/scripts/rundown.mjs` (the global copy;
  `npm run rundown:install` here puts this build and this file there).

Never run a `rundown.mjs` from some other repository's tree: that would be running its code.

Node 18 or newer, no dependencies. Every command takes `--root <dir>` (default: the current
folder) and `--no-gh` (skip GitHub). Give every Bash call a timeout (60 s is plenty).

| Command | What it does | Time |
| --- | --- | --- |
| `node $RUNDOWN collect` | Facts into `.rundown/facts.json`, and a summary | about 1 s |
| `node $RUNDOWN brief` | A compact digest for you to judge from | instant |
| `node $RUNDOWN render --mode full --open` | Facts + `judgement.json` + the markdown files, diffed, into the page | instant |
| `node $RUNDOWN quick --open` | Collect and render, with the last `judgement.json` | about 1 s |
| `node $RUNDOWN facts` | Collect only | about 1 s |

The script finds the git top itself (a worktree's own top inside a worktree), adds `/.rundown/`
to the common `.git/info/exclude` (never `.gitignore`), and on the first run copies
`milestones.md` and `decisions.md` from an old `.project-map/` and diffs against its `state.json`.

## Pick the mode from the user's words

- `/rundown`, "where are we", "project map": **full**, steps 1 to 5.
- `/rundown quick`, "refresh the map", or right after the user edited `milestones.md` or
  `decisions.md`: run `node $RUNDOWN quick --root <dir> --open` and reply (step 5). With no
  `.rundown/judgement.json` yet, do a full run instead.
- `/rundown facts`: `node $RUNDOWN facts --root <dir>` and relay its summary.
- A path after the command (`/rundown ~/code/api`) is the `--root`.

## Full run

### 1. Style

The page is dark with an orange accent (the saved project-map style in
`~/.claude/agent-memory/project-map/style.md`) and has a light toggle. Don't ask about style.

### 2. Collect and read

```
node $RUNDOWN collect --root <dir>
node $RUNDOWN brief --root <dir>
```

Read the brief, not `facts.json` whole. Then read just enough of the repo to judge it: the
README, the plans and docs it points at, agent files (CLAUDE.md, AGENTS.md), and the entry
points of the biggest folders. `gh issue list --state open --limit 30` is optional.

Stay read only: `git log`, `git show --stat`, `git diff --stat`, `ls`, `wc`. Never fetch,
check out, build, install, commit or push in the mapped project. Never open `.env*`, keys,
credential or secret files, dumps or logs (the collector counts them without opening them),
and never put secrets, emails or personal data in the judgement.

### 3. Write `.rundown/judgement.json`

Only these fields; the script computes the rest (metrics, sizes, the diff, the next milestone).

```json
{
  "description": "One or two sentences on what this project is (300 characters at most)",
  "parts": [
    {
      "id": "server",
      "name": "Server and API",
      "summary": "One line on what this part is",
      "paths": ["src/server/**", "src/shared/protocol/**"],
      "status": "in-progress",
      "waitingOn": null,
      "evidence": [{ "kind": "commit", "ref": "1683f05", "text": "Demo cut after review, 12 files" }]
    }
  ],
  "nextStep": { "text": "One concrete action", "why": "Why it moves the next milestone", "partId": "server", "milestoneId": "M2" },
  "milestones": [{ "id": "M1", "name": "...", "doneWhen": "...", "due": null, "items": [{ "text": "...", "done": false, "partId": "server" }] }],
  "decisions": [{ "id": "D1", "question": "...", "options": ["A", "B"], "default": "A, because ...", "raised": "YYYY-MM-DD", "partId": null }]
}
```

- **Parts:** 4 to 8 that make sense for this project, not one per folder. `paths` are
  repo-relative globs; the most specific glob wins a folder. Reuse the previous ids (the brief
  lists them). `status` is `done`, `in-progress`, `not-started` or `stuck`; a stuck part names
  in `waitingOn` exactly what it waits on (a person, a decision, a deploy, an outside party, a
  bug). Up to 6 evidence items each: `commit`, `file`, `test`, `doc`, `issue`, `pr`, `todo`, `note`.
- **Next step:** one concrete action that best moves the next milestone, and a one-line reason.
- **Milestones** (`.rundown/milestones.md`): when the file is missing, propose them in
  `milestones`; the script writes the file marked "Proposed: edit me". When it exists, leave
  `milestones` out and only tick items that are clearly done in the file, adding short notes.
  Never rewrite, reorder or delete what the user wrote. `(part: <id>)` at the end of an item
  links it to a part.
- **Decisions** (`.rundown/decisions.md`): only what the user must decide, each with options and
  a DEFAULT the map assumes meanwhile. New ones in `decisions` (new ids) are added to the file's
  Open section; the user's answers under `Answer:` are theirs.

### 4. Render and check

```
node $RUNDOWN render --root <dir> --mode full --open
```

It writes `rundown.json`, `map.html`, and `state.json` last (the old one goes to `history/`, 20
kept). If it prints `judgement.json left out: ...`, fix the file and render again. A part at 0
lines means its globs miss: fix them and render again. It's instant, so iterate.

### 5. Reply in about 10 lines

Take them from the printed summary: the path to `map.html`; parts by status, with what a stuck
one waits on; the next milestone and the items left; the next step; what changed (or "first
rundown"); and open decisions with their defaults. Say that answers go under `Answer:` in
`.rundown/decisions.md`, then `/rundown quick`.

## In the office

With Labs > Rundown on, the office shows each project's map in the inbox (avatar menu, Ctrl+K,
the Rundown button by the project picker) and as a city of light over the bridge's holo table. It
reads this skill's `.rundown/rundown.json` for the parts, statuses and next step, and the two
markdown files; without them it infers statuses from activity. See `docs/rundown.md`.
