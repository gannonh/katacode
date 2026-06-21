# Reviewing Pull Requests

Run a comprehensive code review on a PR and help the user address the findings.

## Objective

Understand what the PR does, run targeted reviewers against the actual diff, present findings by severity, and fix what the user wants fixed.
Output: Review findings addressed, PR quality improved, tests passing.

## Context

PR Number: $ARGUMENTS (auto-detect from current branch if not provided)

## Process

- [ ] Step 1: Gather PR Context
- [ ] Step 2: Fetch the Diff
- [ ] Step 3: Check for Existing Review Comments
- [ ] Step 4: Run Targeted Reviewers
- [ ] Step 5: Present Aggregated Findings
- [ ] Step 6: Apply Fixes
- [ ] Step 7: Validate and Report

### Step 1: Gather PR Context

Get the PR number (from args or current branch):

```bash
GH_PAGER= gh pr view --json number --jq '.number'
```

Then fetch full PR context — the reviewers need this to distinguish intentional changes from regressions:

```bash
GH_PAGER= gh pr view --json number,title,body,state,headRefName,baseRefName,url,labels,commits \
  --jq '{number, title, body, state, head: .headRefName, base: .baseRefName, url, labels: [.labels[].name], commits: [.commits[].messageHeadline]}'
```

If the PR is merged or closed, inform the user and exit.

Also check for linked issues — the PR body often references them:

```bash
GH_PAGER= gh pr view --json body --jq '.body' | grep -oE '(#[0-9]+|[A-Z]+-[0-9]+)' | sort -u
```

Read linked issue descriptions if any exist — they provide acceptance criteria the reviewers should know about.

### Step 2: Fetch the Diff

Get the actual PR diff — this is what the reviewers will examine:

```bash
GH_PAGER= gh pr diff
```

Also get the list of changed files with stats for scoping decisions in Step 4:

```bash
GH_PAGER= gh pr diff --stat
```

Save both to variables — you'll pass them to reviewers.

### Step 3: Check for Existing Review Comments

Run `<path-to-skill>/scripts/fetch_comments.py` to see if there are unresolved review threads.

If unresolved threads exist, briefly mention them to the user:

> "There are N unresolved review threads from previous reviews. I'll focus on a fresh code review now — use the 'address comments' workflow afterward if you want to work through existing feedback."

Do **not** address existing comments here — that's the Addressing workflow's job. Just acknowledge them so the user knows they exist.

### Step 4: Run Targeted Reviewers

Choose which reviewers to run based on the PR's scope. Not every PR needs all 6 reviewers — running irrelevant ones wastes time and produces noise.

**Scoping heuristics:**

| Reviewer                 | Run when...                                                                               | Skip when...                                           |
| ------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **code-reviewer**        | Always                                                                                    | Never — this is the baseline                           |
| **failure-finder**       | PR touches error handling, adds try/catch, modifies API boundaries, or changes async code | Docs-only, config-only, or pure styling changes        |
| **pr-test-analyzer**     | PR adds/modifies logic that should have tests                                             | Docs, config, or trivial changes (renames, formatting) |
| **code-simplifier**      | PR adds 100+ lines of new code, or touches complex logic                                  | Small PRs (<30 lines changed), or pure deletions       |
| **type-design-analyzer** | PR adds/modifies types, interfaces, or data models in typed languages                     | Untyped languages, or no type changes in diff          |
| **comment-analyzer**     | PR adds/modifies comments or docstrings                                                   | No comment changes in diff                             |

State which reviewers you're running and why you're skipping any.

**For each reviewer, construct a task that includes:**

1. The PR context from Step 1 (title, description, linked issues)
2. The full PR diff from Step 2
3. The reviewer's instructions from its reference file

**Example task prompt for a reviewer:**

```
You are reviewing PR #42: "Add retry logic to API client"

PR Description:
<paste PR body>

Linked issues: #38 (API calls fail silently on timeout)

Changed files:
<paste diff stat>

Full diff:
<paste diff>

Review instructions:
<paste contents of the reviewer's reference file>

Focus your review on the PR diff. Flag only issues in changed code unless existing code creates a clear bug when combined with the changes.
```

Run the selected reviewers in parallel when possible (sub-agents, agent teams). Fall back to sequential if parallel isn't available. The important thing is that each reviewer sees the same diff and PR context.

### Step 5: Present Aggregated Findings

Collect all findings from the reviewers and deduplicate — different reviewers sometimes flag the same issue.

Present findings in a structured format:

```
## PR Review: #[number] — [title]

### 🔴 Critical (must fix before merge)
1. [reviewer-name] **file:line** — Description of the issue
   → Suggested fix: ...

### 🟡 Important (should fix before merge)
2. [reviewer-name] **file:line** — Description
   → Suggested fix: ...
3. ...

### 💡 Suggestions (consider fixing)
4. [reviewer-name] **file:line** — Description
   → Suggested fix: ...

### ✅ Strengths
- [Notable things the PR does well]

---
Reviewers run: code-reviewer, failure-finder, pr-test-analyzer
Reviewers skipped: code-simplifier (small PR), type-design-analyzer (no type changes), comment-analyzer (no comment changes)
```

**Ask the user:** "Which issues should I address? You can reply with numbers, severity levels (e.g. 'all critical and important'), 'all', or 'none'."

Do not apply fixes until the user responds.

### Step 6: Apply Fixes

For each issue the user selected:

1. Make the code change
2. If the issue was also flagged in an existing review thread, resolve that thread with a reply explaining the fix

Commit changes:

```bash
git add -A
git commit -m "fix: address PR review findings"
```

### Step 7: Validate and Report

Discover the project's CI/test commands from AGENTS.md, package.json, Makefile, CI config files (.github/workflows/), or similar. Then:

1. **Lint** changed files
2. **Run tests** to confirm no regressions
3. Fix any failures, commit, and rerun until clean
4. **Push** to the branch

```
✅ PR Review Complete

PR #[number]: [title]
Branch: [branch]

Review Results:
- Critical: [N] found → [N] fixed
- Important: [N] found → [N] fixed
- Suggestions: [N] found → [N] fixed, [N] deferred

Validation:
- Lint: ✅
- Tests: ✅

[If unresolved review threads exist:]
Note: [N] unresolved review threads from previous reviews remain.
Run "address PR comments" to work through them.
```

## Success Criteria

- [ ] PR context gathered (description, linked issues)
- [ ] Diff fetched and passed to reviewers
- [ ] Appropriate reviewers selected and run
- [ ] Findings presented by severity
- [ ] User chose which to fix
- [ ] Selected fixes applied and validated
- [ ] Tests pass, changes pushed

## Critical Rules

- **Always fetch the PR diff** — reviewers examine the diff, not the working tree
- **Scope the reviewers** — don't run all 6 on every PR; choose based on what changed
- **Don't address existing review comments here** — mention them, point to the Addressing workflow
- **Present before fixing** — always show aggregated findings and wait for user direction
- **Include PR context in every reviewer task** — title, description, and linked issues give reviewers the "why" behind changes
- **Deduplicate across reviewers** — multiple reviewers flagging the same issue should appear once
