# Task 1: evidence-based project blog contract

## Objective

Create one or more Korean portfolio posts from the selected project's implementation evidence. The source repository is strictly read-only. The portfolio repository is the only writable repository.

## Evidence and writing

- Inspect relevant source, tests, configuration, documentation, and Git history. Use history to understand decisions, but do not equate a commit author with the user's personal role.
- Maintain a small evidence ledger while working: each important claim should map to a source path, test, commit, existing resume statement, or user-confirmed fact. General technical explanation may rely on established knowledge, but label inference and uncertainty in the prose when material.
- Generalize company-internal identifiers, endpoints, schemas, package names, infrastructure names, secrets, and proprietary code. Do not reproduce source code or architecture details that identify the employer. Never invent scale, latency, percentages, responsibility, causality, or business impact.
- Split into multiple posts when the evidence contains independent problem–decision–validation arcs that are each substantial enough to stand alone. Do not split a single arc merely to increase post count.
- When posts form a sequence, reuse an appropriate existing series or add one JSON file under `src/content/series/`, following the repository schema. Give each post consistent `series`, unique nonnegative `seriesOrder`, and a useful `seriesLabel` when the local convention uses it.
- Follow `src/content.config.ts` and current content conventions. Every post must have `draft: true`. Use a date supported by the current task context, not a fabricated historical publication date.

Each post must make these ideas easy to locate, using natural headings rather than mechanically copying labels:

1. 배경과 사용자의 역할
2. 문제와 제약
3. 검토한 대안과 trade-off
4. 선택과 그 이유
5. 구현 및 검증 방법
6. 결과와 회고

Write enough implementation and decision detail to support follow-up interview answers. Prefer a precise narrative over generic lessons. Mermaid is optional and should appear only when it materially clarifies a multi-step flow or architecture.

## Pause conditions

Before writing or committing, return `status: needs_input` if a central narrative depends on an unverified personal role, constraint, alternative, result, or measurement. Include only the smallest set of concrete questions and identify which proposed claim each answer would support. Make no commit in this state.

Return `status: failed` without committing if evidence is insufficient for a responsible post, an intended path overlaps a baseline user change, the source repository changes, or validation cannot be completed.

## Validation and commit

1. Inspect the final diff for confidential identifiers and unsupported claims.
2. Run `npm run check`, then `npm run build` in the portfolio repository.
3. Recheck the source repository status against its initial status.
4. Stage only newly created post files and any necessary series JSON. Verify every staged path belongs to that set and that unrelated staged paths are preserved.
5. Create one path-limited commit with a concise `docs:` subject. Do not include `feedback.md`, this skill, generated output, lockfiles, or any pre-existing change.
6. Verify the commit with `git show --stat --name-status --format=fuller <sha>`.

## Handoff

Return this structure to the root agent:

```yaml
status: completed | needs_input | failed
commit_sha: null | <full SHA>
posts:
  - path: <portfolio-relative path>
    title: <title>
    narrative: <problem-decision-validation summary>
series_files: []
evidence:
  - claim: <material claim>
    basis: <source path, commit, resume text, or user-confirmed fact>
resume_candidates:
  summary: <optional concise candidate>
  highlights: []
  tech: []
validation:
  npm_run_check: passed | failed | not_run
  npm_run_build: passed | failed | not_run
  source_unchanged: true | false
questions: []
error: null | <concise failure>
```

Do not modify `src/data/resume.json`; that belongs to task 2.
