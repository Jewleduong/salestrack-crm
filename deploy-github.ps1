# SalesTrack CRM — push to GitHub + enable Pages
# Chạy: Right-click -> Run with PowerShell (hoặc mở terminal trong thư mục này)

$ErrorActionPreference = "Stop"
$env:Path = "C:\Program Files\Git\cmd;" + $env:Path
$git = "C:\Program Files\Git\cmd\git.exe"
$gh  = "C:\Program Files\GitHub CLI\gh.exe"
$repoName = "CRM"

Set-Location $PSScriptRoot

Write-Host "=== Kiem tra dang nhap GitHub ===" -ForegroundColor Cyan
& $gh auth status
if ($LASTEXITCODE -ne 0) {
  Write-Host "Chua dang nhap. Mo trinh duyet de xac thuc..." -ForegroundColor Yellow
  & $gh auth login --hostname github.com --git-protocol https --web
}

Write-Host "`n=== Tao repo va push code ===" -ForegroundColor Cyan
$remotes = & $git remote 2>$null
if ($remotes -notcontains "origin") {
  & $gh repo create $repoName --public --source=. --remote=origin --push
} else {
  & $git push -u origin HEAD
}

Write-Host "`n=== Bat GitHub Pages ===" -ForegroundColor Cyan
$branch = (& $git branch --show-current).Trim()
if (-not $branch) { $branch = "master" }
& $gh api -X POST "repos/{owner}/$repoName/pages" -f "build_type=legacy" -f "source[branch]=$branch" -f "source[path]=/" 2>$null
if ($LASTEXITCODE -ne 0) {
  & $gh api -X PUT "repos/{owner}/$repoName/pages" -f "build_type=legacy" -f "source[branch]=$branch" -f "source[path]=/" 2>$null
}

$pages = & $gh api "repos/{owner}/$repoName/pages" --jq ".html_url" 2>$null
Write-Host "`nXong! Site (doi 1-3 phut): $pages" -ForegroundColor Green
