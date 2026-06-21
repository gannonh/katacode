# Creating Pull Requests

Create a new branch (if needed), commit changes, push to origin, and open a PR.

## Context

- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Branch name (optional): $ARGUMENTS

## Process

1. **Create a new branch** if on main
   - Generate branch name from issue, e.g. `feature/39-day-status-tracking`.
     - If using Linear use the Linear MCP to get the suggested branch name from the issue.
     - If no issue context, generate a descriptive branch name based on the changes being made.
   - Otherwise use the provided branch name

2. **Commit any uncommitted changes** with an appropriate message
   - Follow conventional commits format
   - Use descriptive commit messages

3. **Run checks**
   - Discover the project's CI/test commands from CLAUDE.md, package.json, Makefile, CI config files (.github/workflows/), or similar
   - Run the appropriate local checks (lint, type-check, tests) for this project's toolchain
   - Fix and commit any issues until checks pass before pushing or creating the PR

4. **Capture session learnings**
   - Run `/claude-md-management:revise-claude-md` to update CLAUDE.md with any conventions, gotchas, or patterns discovered during this session.
   - Commit the CLAUDE.md changes before pushing.

5. **Push the branch to origin**

   ```bash
   git push -u origin $(git branch --show-current)
   ```

6. **Create a pull request** using the safe Python helper (never inline `--body`)
   - Always use `<path-to-skill>/scripts/create_pr_safe.py` with a file-backed body to prevent shell interpolation corruption.
   - Use a single-quoted heredoc (`<<'EOF'`) so markdown content is treated as literal text.

   ```bash
   python3 <path-to-skill>/scripts/create_pr_safe.py \
     --title "feat: <description>" \
     --base main \
     --head "$(git branch --show-current)" <<'EOF'
   ## Summary
   - <bullet points>

   ## Test Plan
   - <how to verify>
   EOF
   ```

   - The helper script will:
     - create the PR via `gh pr create --body-file`
     - verify the created body matches the source content
     - auto-repair with `gh pr edit --body-file` if mismatch is detected

7. **Report back** with a link to the PR

## Success Criteria

- [ ] Branch created (if needed)
- [ ] Changes committed
- [ ] Session learnings captured in CLAUDE.md via `/claude-md-management:revise-claude-md`
- [ ] Branch pushed to origin
- [ ] PR created and URL returned to user
- [ ] PR body verified (and auto-repaired if needed)
