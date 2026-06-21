---
name: pull-requests
description: Use this skill for pull request workflows - creating PRs (branch, commit, push, open), reviewing PRs (code quality, test coverage, issue fixing), addressing PR review comments (fix feedback, respond to reviewers), or merging PRs (CI checks, merge, cleanup). Handles the complete PR lifecycle via gh CLI. Triggers include "create PR", "open PR", "review PR", "merge PR", "address PR comments", "fix review feedback", "respond to reviewer", "push for review", "submit PR".
---

# Pull Request Workflows

This skill handles the complete PR lifecycle. Based on context and user intent, follow the appropriate workflow.

## Context

- Current git status: !`git status`
- Current branch: !`git branch --show-current`
- PR state (if exists): !`GH_PAGER= gh pr view --json number,title,state 2>/dev/null || echo "No PR for current branch"`
- Arguments: $ARGUMENTS

## Workflow Selection

**Determine which workflow to use based on context:**

### Use Creating Workflow when:

- User asks to "create a PR", "open a PR", "push for review"
- On a feature branch with uncommitted or unpushed changes
- No PR exists for the current branch

→ See `./references/creating-workflow.md`

### Use Reviewing Workflow when:

- User asks to "review PR", "check code quality", "run review"
- PR exists and is open
- Want a fresh code review against the PR diff using targeted reviewers
- This workflow does NOT address existing review comments — it runs its own analysis

→ See `./references/reviewing-workflow.md`

### Use Addressing Workflow when:

- User asks to "address comments", "fix review feedback", "respond to reviewer"
- PR exists with unresolved review comments from human reviewers or bots
- User wants to respond to specific existing feedback without running a fresh review

→ See `./references/addressing-workflow.md`

### Use Merging Workflow when:

- User asks to "merge PR", "complete PR", "finalize changes"
- PR exists, is reviewed, and ready for merge
- Need to run final CI checks and merge

→ See `./references/merging-workflow.md`

## Quick Reference

| Intent             | Workflow   | Key Actions                                                                  |
| ------------------ | ---------- | ---------------------------------------------------------------------------- |
| "Create PR"        | Creating   | Branch → Commit → Push → `<path-to-skill>/scripts/create_pr_safe.py`         |
| "Review PR"        | Reviewing  | Gather context → Fetch diff → Scope & run reviewers → Present findings → Fix |
| "Address comments" | Addressing | Fetch comments → User selects → Fix → Reply → Push                           |
| "Merge PR"         | Merging    | CI checks → Confirm ready → `gh pr merge` → Checkout main                    |
