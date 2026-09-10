#!/usr/bin/env pwsh
# Workspace Startup Script
# Called by the "Agents: Workspace Startup" task on folder open

Write-Host '╔══════════════════════════════════════╗' -ForegroundColor Cyan
Write-Host '║    Agent Workspace — Initializing    ║' -ForegroundColor Cyan
Write-Host '╚══════════════════════════════════════╝' -ForegroundColor Cyan
Write-Host ''

Write-Host '[1/3] Syncing with remote...' -ForegroundColor Yellow
$hasRemote = git remote 2>&1
if ($LASTEXITCODE -eq 0 -and $hasRemote) {
    git pull --rebase 2>&1
}
else {
    Write-Host '  No remote configured — skipping pull' -ForegroundColor DarkGray
}
git status --short
Write-Host ''

Write-Host '[2/3] Checking environment...' -ForegroundColor Yellow
Write-Host 'Git: ' -NoNewline
git --version
Write-Host "PowerShell: $($PSVersionTable.PSVersion)"
Write-Host ''

Write-Host '[3/3] Checking GitHub CLI...' -ForegroundColor Yellow
$ghPath = Get-Command gh -ErrorAction SilentlyContinue
if ($ghPath) {
    Write-Host "  gh: $(gh --version | Select-Object -First 1)" -ForegroundColor Green
    $authResult = gh auth status 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host '  gh auth: authenticated' -ForegroundColor Green
    }
    else {
        Write-Host '  ⚠ gh auth: NOT authenticated' -ForegroundColor Red
        Write-Host '    Run: gh auth login' -ForegroundColor Yellow
        Write-Host '    GitHub Issue tracking requires authentication.' -ForegroundColor Yellow
        Write-Host '    All governance (Issues, PRs, milestones) will fail without it.' -ForegroundColor Yellow
    }
}
else {
    Write-Host '  ✗ gh CLI: NOT INSTALLED' -ForegroundColor Red
    Write-Host '    GitHub CLI is REQUIRED for governance tracking.' -ForegroundColor Red
    Write-Host '    Install: https://cli.github.com/' -ForegroundColor Yellow
    Write-Host '    - macOS:   brew install gh' -ForegroundColor Yellow
    Write-Host '    - Windows: winget install GitHub.cli' -ForegroundColor Yellow
    Write-Host '    - Linux:   sudo apt install gh' -ForegroundColor Yellow
    Write-Host '    - Container: rebuild to pick up devcontainer feature' -ForegroundColor Yellow
}
Write-Host ''

Write-Host 'Skills available:' -ForegroundColor Yellow
Get-ChildItem '.github/skills' -File -Filter '*.md' -ErrorAction SilentlyContinue |
ForEach-Object { Write-Host "  - $($_.BaseName)" }
Write-Host ''

Write-Host 'Workspace ready' -ForegroundColor Green
