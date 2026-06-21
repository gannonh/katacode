# Addressing PR Review Comments

Respond to existing PR review feedback without running a full review sweep.

## Objective

Address specific reviewer comments on an open PR: apply fixes, reply to threads, and push updates.

## Context

PR Number: $ARGUMENTS (auto-detect from current branch if not provided)

## Process

### Step 1: Identify PR

Get the PR number for the current branch:

```bash
GH_PAGER= gh pr view --json number --jq '.number'
```

Then get PR details:

```bash
GH_PAGER= gh pr view --json number,title,state,headRefName,url --jq '"PR #\(.number): \(.title)\nState: \(.state)\nBranch: \(.headRefName)\nURL: \(.url)"'
```

If PR is already merged or closed, inform user and exit.

### Step 2: Fetch Review Comments

Run `<path-to-skill>/scripts/fetch_comments.py` to get all comments and review threads on the PR.

**NOTE: the script lives under the skill's directory, not the current workspace.**

### Step 3: Present Findings and Get Direction

1. Number all unresolved review threads and comments
2. For each, provide a short summary of what the reviewer asked for and what fixing it would involve
3. **Ask the user:** "Which of these comments should I address? Reply with numbers, 'all', or 'none'."

Do not apply any fixes until the user has answered.

### Step 4: Apply Fixes

For each comment the user selected:

1. Make the requested code change
2. Reply to the review thread on GitHub explaining what you changed
3. Resolve the thread if the fix fully addresses the feedback

For comments the user chose not to address:

- Reply to reviewers with reasoning or ask for clarification

### Step 5: Validate and Push

If changes were made:

1. Discover the project's CI/test commands from CLAUDE.md, package.json, Makefile, CI config files (.github/workflows/), or similar
2. Run lint and tests on changed files to confirm no regressions
3. Commit with a message like `fix: address PR review feedback`
4. Push to the branch

### Step 6: Report

```
✅ PR Comments Addressed

PR #[PR_NUMBER]: [Title]
Branch: [branch_name]

- Addressed: [N] comments
- Skipped: [N] comments (replied with reasoning)
- Tests: ✅ Passing
```

## Success Criteria

- [ ] PR identified and accessible
- [ ] User chose which comments to address
- [ ] Selected comments fixed and threads resolved/replied
- [ ] Tests pass after changes
- [ ] Changes pushed

## Critical Rules

- **Always ask before fixing** — present findings and wait for user direction
- **Reply to every thread** — whether addressed or skipped, reviewers should see a response
- **Don't run a full review sweep** — this workflow is for responding to existing feedback only
