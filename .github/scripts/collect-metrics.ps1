#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Collect measurable-validation metrics and refresh local quality dashboards.

.DESCRIPTION
    Reuses the governance MCP server's scorecard engine (no GitHub Actions / runners —
    fully local) to compute an advisory scorecard for every ring, then writes a roll-up
    into the quality dashboards between AUTO-GENERATED markers so re-runs are idempotent.

    Updated files:
      - docs/Quality/performance-dashboard.md
      - docs/Planning/lss/spc-dashboard.md   (when present)

    The scorecard is ADVISORY. It never changes a gate decision — human authority over
    ring transitions is always preserved.

.EXAMPLE
    pwsh -NoProfile -File .github/scripts/collect-metrics.ps1
#>
[CmdletBinding()]
param(
    [string]$WorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
)

$ErrorActionPreference = 'Stop'

$serverPath = Join-Path $WorkspaceRoot '.github/scripts/governance-mcp-server.js'
if (-not (Test-Path $serverPath)) {
    Write-Error "Governance MCP server not found at $serverPath"
    exit 1
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Error 'node is required to compute scorecards but was not found on PATH.'
    exit 1
}

Write-Host '=== Collecting measurable-validation metrics ===' -ForegroundColor Cyan

# One-shot Node invocation: load the server module (require.main guard keeps the stdio
# loop dormant) and emit every ring scorecard as a single JSON document on stdout.
$collector = @'
const server = require(process.argv[2]);
const rings = [];
for (let ring = 0; ring <= 5; ring++) {
  try {
    rings.push(server.getScorecard({ ring }));
  } catch (err) {
    rings.push({ ring, error: err.message });
  }
}
process.stdout.write(JSON.stringify({ generatedAt: new Date().toISOString(), rings }));
'@

$collectorFile = Join-Path ([System.IO.Path]::GetTempPath()) ("collect-metrics-" + [System.Guid]::NewGuid().ToString('N') + '.js')
Set-Content -Path $collectorFile -Value $collector -Encoding UTF8

try {
    Push-Location $WorkspaceRoot
    $json = & node $collectorFile $serverPath
}
finally {
    Pop-Location
    Remove-Item $collectorFile -Force -ErrorAction SilentlyContinue
}

if (-not $json) {
    Write-Error 'Scorecard collection produced no output.'
    exit 1
}

$data = $json | ConvertFrom-Json

$ringNames = @('Intake', 'Plan / WBS / Estimate', 'Dev / Managed Dev', 'IV&V', 'Release Management', 'Staged for Production')

$rows = foreach ($r in $data.rings) {
    if ($r.PSObject.Properties.Name -contains 'error') {
        "| Ring-$($r.ring) | $($ringNames[$r.ring]) | — | — | — | error: $($r.error) |"
        continue
    }
    $dims = if ($r.dimensionScores.PSObject.Properties.Count -gt 0) {
        ($r.dimensionScores.PSObject.Properties | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join ', '
    } else { '—' }
    $breaches = if ($r.breaches.Count -gt 0) { ($r.breaches -join '; ') } else { 'none' }
    $configured = if ($r.thresholdsConfigured) { 'yes' } else { 'advisory (defaults)' }
    "| Ring-$($r.ring) | $($ringNames[$r.ring]) | $($r.completenessPct)% | $($r.weightedScore) | $dims | $configured / $breaches |"
}

$section = @()
$section += '<!-- AUTO-GENERATED: measurable-validation scorecards. Do not edit by hand. -->'
$section += "_Last collected: $($data.generatedAt) — advisory only, human gate authority preserved._"
$section += ''
$section += '| Ring | Name | Completeness | Weighted | Dimensions | Thresholds / Breaches |'
$section += '|------|------|:-----------:|:--------:|------------|------------------------|'
$section += $rows
$section += '<!-- END AUTO-GENERATED -->'
$sectionText = ($section -join "`n")

function Update-DashboardSection {
    param([string]$Path, [string]$SectionText)
    if (-not (Test-Path $Path)) {
        Write-Host "  (skip) $Path not found" -ForegroundColor DarkGray
        return
    }
    $content = Get-Content -Path $Path -Raw
    $startMarker = '<!-- AUTO-GENERATED: measurable-validation scorecards. Do not edit by hand. -->'
    $endMarker = '<!-- END AUTO-GENERATED -->'
    if ($content -match [regex]::Escape($startMarker) -and $content -match [regex]::Escape($endMarker)) {
        $pattern = [regex]::Escape($startMarker) + '.*?' + [regex]::Escape($endMarker)
        $content = [regex]::Replace($content, $pattern, { param($m) $SectionText }, 'Singleline')
    }
    else {
        $content = $content.TrimEnd() + "`n`n## Measurable Validation Scorecards`n`n" + $SectionText + "`n"
    }
    Set-Content -Path $Path -Value $content -Encoding UTF8
    Write-Host "  updated $Path" -ForegroundColor Green
}

Update-DashboardSection -Path (Join-Path $WorkspaceRoot 'docs/Quality/performance-dashboard.md') -SectionText $sectionText
Update-DashboardSection -Path (Join-Path $WorkspaceRoot 'docs/Planning/lss/spc-dashboard.md') -SectionText $sectionText

Write-Host '=== Done ===' -ForegroundColor Cyan
