# Terrarium — instructions for the lead

You are the **Lead** of a small agent team building Terrarium. The main
Claude Code session is always the lead; the other agents are subagents in
`.claude/agents/` (`simulation`, `rendering`, `gpu`, `qa`).

## Agent briefs

The agent definitions live in `.claude/agents/`, with a copy in
`docs/agents/` so they are readable on GitHub. Keep the two the same: edit
`.claude/agents/`, then copy to `docs/agents/` in the same commit.

## Read first, every session

1. `docs/DESIGN.md` — what we are building and the rules. It wins every
   argument.
2. `docs/TASKS.md` — the board. Find the current milestone and the ready
   tasks.
3. `docs/JOURNAL.md` — decisions so far.

## The loop

1. Pick the ready tasks in the current milestone. Do the ones you own
   yourself (contracts in `src/shared/`, docs, merges).
2. Hand each other ready task to its owner with the Agent tool. The prompt is
   short: the task ID, "read its entry in docs/TASKS.md and DESIGN sections
   X, Y", and anything learned since that changes it. Never paste whole files
   into a prompt.
3. Run tasks with different owners in parallel when they don't depend on
   each other.
4. When an agent reports done, send the task to `qa` for review against its
   acceptance check. QA never reviews its own tasks; review those yourself.
5. On a pass: merge, set the task to `done` in `docs/TASKS.md`, and commit.
   On a fail: send QA's findings back to the owner once. If it fails twice,
   stop and decide yourself (change the task, split it, or note it in the
   journal).
6. When a milestone's last task is done, write
   `docs/checkpoints/M<n>.md` (what was built, the acceptance results, known
   gaps, the contact sheet path), push, and **stop**. Tell Faisal in five
   lines or fewer what to look at. Do not start the next milestone until he
   says *go on*.

## Git

- Repo: public on GitHub. One branch per task, `m<milestone>/<id>-<slug>`
  (e.g. `m0/2-sim-worker`). After QA passes, merge it into `main` locally
  with `git merge --squash <branch>` and one commit, then `git push`.
  Push the task branch too, so the history is visible on GitHub.
- Use plain `git` only. Do not use or install the GitHub CLI (`gh`); Faisal
  does anything on github.com that git cannot do (creating the repo,
  settings) in his browser. Git signs in through Git Credential Manager,
  which opens the browser on the first push.
- Commit messages say what changed and how it was checked.
- Never force-push `main`. Never commit `out/`, `node_modules/` or secrets.

## Rules for everyone (repeat them in prompts only when relevant)

- An agent edits only the folders it owns (DESIGN §12). `src/shared/` is
  yours alone; agents ask you for changes there.
- No `Math.random`, `Date.now`, `performance.now` or engine `Math.sin`/`exp`/
  `pow` inside `src/sim/` or `src/gpu/` (DESIGN rule 3; use `src/shared/dmath.ts`).
- No new dependency unless it is listed in DESIGN §8; add it there first.
- Everything must run on Windows from PowerShell: Node scripts via `tsx`,
  `path.join` for paths, no bash-only commands in `package.json`.
- Every task ends with `npm test` passing and, from M0-4 on, a fresh
  `npm run jar` contact sheet.

## Staying on task and cheap

- Agents read the task entry and the DESIGN sections it names, plus the
  files they will change — not the whole repo.
- Agent reports are 15 lines or fewer: what changed, how it was checked,
  anything the lead must decide.
- If a task turns out bigger than its entry suggests, stop and split it on
  the board rather than letting it grow.
- If DESIGN is wrong or silent, decide, update DESIGN, and add a dated line
  to `docs/JOURNAL.md` with the reason.

## Talking to Faisal

He reviews at checkpoints, not during tasks. Ask him only when a decision
changes what Terrarium *is* (its look, scope or rules); decide engineering
questions yourself and journal them.
