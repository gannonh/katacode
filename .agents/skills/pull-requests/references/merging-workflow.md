# Merging Pull Requests

Run CI checks and merge the PR.

## Objective

All review issues addressed, PR merged successfully.

## Context

PR Number: $ARGUMENTS (auto-detect from current branch if not provided)

## Process

Create a structured task list:

- [ ] Step 1: Identify PR to merge
- [ ] Step 2: Run CI Checks
- [ ] Step 3: Present Merge Readiness
- [ ] Step 4: Merge PR, checkout main, and pull latest
- [ ] Step 5: Present Next Steps

### Step 1: Identify PR to Merge

Get the PR number for the current branch:

```bash
GH_PAGER= gh pr view --json number --jq '.number'
```

Then get PR details:

```bash
GH_PAGER= gh pr view --json number,title,state,headRefName,url --jq '"PR #\(.number): \(.title)\nState: \(.state)\nBranch: \(.headRefName)\nURL: \(.url)"'
```

If PR is already merged or closed, inform user and exit.

### Step 2: Run CI Checks

Discover the project's CI/test commands from CLAUDE.md, package.json, Makefile, CI config files (.github/workflows/), or similar. Then run checks in this order:

#### Phase 1: Lint changed files

Run the project's linter on files changed in this branch.

#### Phase 2: Build the project

Run the project's build command.

#### Phase 3: Run unit tests

Run the project's unit test suite.

#### Phase 4: Check test coverage (if the project has coverage tooling)

Run coverage checks if the project has them configured.

#### Phase 5: Run relevant integration/UI tests (if applicable)

Run integration or UI tests that cover the functionality changed in this PR.

#### Phase 6: Fix all failures and violations

Fix all issues before continuing. Re-run checks until all pass.

**If all checks pass:**

```
✅ CI Checks Passed
- Lint: No violations
- Build: Successful
- Tests: All passing
- Coverage: Thresholds met (if applicable)
```

### Step 3: Present Merge Readiness

```
✅ Pre-merge Validation Complete

PR #[PR_NUMBER]: [Title]
Branch: [branch_name]

Validation Results:
- CI Checks: ✅ Passing

The PR is ready for merge. Would you like me to **merge it now, checkout main, and pull latest**?
```

### Step 4: Merge PR

**If user confirms, execute:**

```bash
gh pr merge --merge --delete-branch
git checkout main && git pull
```

### Step 5: Present Next Steps

```
✅ PR Merge Complete

PR #[PR_NUMBER]: [Title]
Branch: [branch_name]

Validation Results:
- PR merged successfully
- Now on main branch with latest updates
```

## Success Criteria

- [ ] PR identified and accessible
- [ ] All CI checks pass (lint, build, tests, coverage)
- [ ] PR merged successfully

## Critical Rules

- **Fix ALL issues** - Don't skip "minor" issues; they compound
- **Re-run after fixes** - Confirm issues are resolved before proceeding
- **Final validation required** - Confirm no regressions from fixes
