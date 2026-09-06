# Task 2: focused resume update contract

## Objective

Compress the verified story from task 1 into the exact project selected by the user in `src/data/resume.json`. Treat `feedback.md` only as editorial guidance; factual support must come from source evidence, the pre-existing selected resume object, task 1's evidence handoff, or explicit user confirmation.

## Allowed changes

- Update only the selected project's `summary`, `highlights`, and `tech` fields.
- Keep `highlights` between 3 and 5 concise, non-overlapping items unless the user explicitly requests otherwise.
- Align the profile `description` and the prose section titled `요약` only when task 1 supplies strong evidence that the selected project's new positioning makes an existing statement inaccurate or materially incomplete. If alignment is not necessary, leave them byte-for-byte unchanged.
- Do not modify another career group or project, the global `기술` section, contact details, dates, priorities, or unrelated formatting.

Preserve the resume's Korean tone and JSON style. Lead with problem, action or decision, and verified outcome. Keep meaningful constraints and differentiators; remove vague self-evaluation and duplication. Include technologies only when supported by implementation evidence. Do not add metrics, ownership, scale, or business results merely because a candidate phrase sounds stronger.

If task 1's handoff or the selected target is ambiguous, return `status: failed` with no edits rather than choosing a project yourself.

## Validation and commit

1. Parse `src/data/resume.json` as JSON and inspect the diff to confirm only allowed fields of the selected project changed, plus the narrowly permitted profile/summary alignment if justified in the handoff.
2. Run `npm run check`, then `npm run build` in the portfolio repository.
3. Confirm the source repository is unchanged and task 1's commit is still the immediate required predecessor among workflow commits.
4. Stage only `src/data/resume.json`. Verify unrelated staged paths remain preserved.
5. Create one path-limited commit with a concise `chore:` subject. Do not amend task 1.
6. Verify the commit changes exactly `src/data/resume.json`.

## Handoff

Return this structure to the root agent:

```yaml
status: completed | failed
commit_sha: null | <full SHA>
resume_path: src/data/resume.json
selected_project: <exact title>
changed_fields: []
profile_alignment_basis: null | <evidence-backed reason>
validation:
  json_parse: passed | failed
  npm_run_check: passed | failed | not_run
  npm_run_build: passed | failed | not_run
  source_unchanged: true | false
  commit_paths_exact: true | false
error: null | <concise failure>
```
