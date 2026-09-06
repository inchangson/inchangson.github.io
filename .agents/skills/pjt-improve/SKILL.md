---
name: pjt-improve
description: Turn one verified software project into detailed portfolio blog drafts and a focused resume project update. Use when the user invokes $pjt-improve with a source-project path or asks to derive portfolio stories and resume bullets from a local implementation repository.
---

# PJT Improve

Use the current working directory as the portfolio repository and the single path supplied after `$pjt-improve` as the read-only source repository. Produce blog drafts first, then update the matching resume project. Keep the two deliverables in separate commits.

## Preconditions and interview

1. Require exactly one source-project path. Resolve it to an absolute path and verify that it exists, is readable, and is a Git worktree with inspectable history. Do not modify it. If the path is missing or invalid, stop with one concise correction request.
2. Verify that the portfolio worktree contains `src/data/resume.json`, `src/content.config.ts`, `src/content/posts/`, and the `check` and `build` package scripts. Record `git status --short` and the staged paths before changing anything. Treat every existing change—including untracked `feedback.md`—as user-owned.
3. Read the portfolio content schema, representative posts and series metadata, `src/data/resume.json`, and `feedback.md` when present. Read the source repository's structure and relevant Git history. Do not assume the source repository's README is complete evidence.
4. Ask the user to identify the exact project object in `resume.json` and the achievement(s) to improve. Ask only for material facts the repositories cannot establish, such as personal role, constraints, business outcome, or measurements. Never infer ownership or numbers from code authorship alone.

Do not start delegation until the inputs and required facts are sufficient. Summarize the selected resume object and evidence boundary in the task prompt.

## Sequential delegation

Run exactly two subagents sequentially. For each, use `fork_turns: "none"`, model `gpt-5.6-sol`, and reasoning effort `medium`. Give each agent the absolute portfolio and source paths, the baseline worktree status, the selected resume object, confirmed user facts, and the relevant contract below.

1. Read and give the first agent [references/task1-blog-agent.md](references/task1-blog-agent.md). Wait for its structured handoff. If it requests facts, ask the user and resume the same agent. If it fails, changes the source repository, or does not return a verifiable commit, stop; do not start task 2.
2. Verify task 1's commit exists, is newer than the recorded baseline, has a `docs:` subject, and contains only reported new post files plus necessary series metadata. Confirm the source repository is unchanged and the portfolio's pre-existing changes remain present.
3. Only then read and give the second agent [references/task2-resume-agent.md](references/task2-resume-agent.md), including task 1's full handoff. Wait for its result and verify its `chore:` commit changes only `src/data/resume.json`.

When an agent pauses for missing facts, continue that same agent after the user answers; do not replace it or start the next stage.

## Git and failure safety

- Agents may stage and commit only their own deliverables. Before committing, compare their intended paths with both the baseline and current staged-path lists. Use a path-limited commit so unrelated staged changes remain staged; never use a blanket `git add`, `git commit -a`, or stash.
- Do not amend, rebase, reset, clean, push, or alter Git configuration. Do not commit this skill, `feedback.md`, build output, dependency files, or unrelated changes.
- If ownership of an overlapping changed path is ambiguous, stop and report the collision instead of overwriting it.
- A failed `npm run check` or `npm run build`, unexpected diff, source-repository mutation, or failed commit verification blocks the next stage. Report the exact command and relevant error without attempting destructive recovery.
- The root agent does not rewrite either agent's deliverable. It verifies the two commits and reports their SHAs, paths, validation results, and any remaining draft facts.

Successful completion means exactly two new target commits exist after the baseline: one `docs:` blog commit followed by one `chore:` resume commit. Existing user changes need not be clean and must remain uncommitted unless they were already committed before this workflow.
