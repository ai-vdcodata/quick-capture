# setup_claude.ps1
Write-Host "Setting up Claude Code for this repository..." -ForegroundColor Green

# 1. Create workflow directory
New-Item -ItemType Directory -Force -Path .github\workflows

# 2. Create the Claude workflow file
@'
name: Claude Code

on:
  issues:
    types: [opened, edited]
  issue_comment:
    types: [created, edited]
  pull_request:
    types: [opened, synchronize]
  pull_request_review_comment:
    types: [created, edited]
  workflow_dispatch:

jobs:
  claude:
    if: |
      (github.event_name == 'issues' && contains(github.event.issue.body, '@claude')) ||
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'pull_request' && contains(github.event.pull_request.body, '@claude')) ||
      (github.event_name == 'pull_request_review_comment' && contains(github.event.comment.body, '@claude')) ||
      github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
      pull-requests: write
      id-token: write
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Claude Code
        uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
'@ | Out-File -FilePath .github\workflows\claude.yml -Encoding utf8

# 3. Commit and push
git add .github/workflows/claude.yml
git commit -m "Add Claude Code GitHub Actions workflow"
git push

Write-Host "Workflow file created and pushed!" -ForegroundColor Green
Write-Host ""
Write-Host "Now complete these manual steps:" -ForegroundColor Yellow
Write-Host "1. Install GitHub App at: https://github.com/apps/claude" -ForegroundColor Cyan
Write-Host "   - Select this repository when installing" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Add API Key Secret:" -ForegroundColor Cyan
Write-Host "   - Go to: Settings, then Secrets and variables, then Actions" -ForegroundColor Gray
Write-Host "   - Add secret named: ANTHROPIC_API_KEY" -ForegroundColor Gray
Write-Host "   - Value: Your API key from https://console.anthropic.com" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Test with: gh issue create --title Test --body @claude hello" -ForegroundColor Cyan