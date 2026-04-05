$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

Write-Host "Starting hNotebook (3 windows): API -> RAG -> Web" -ForegroundColor Cyan
Write-Host "Root: $Root`n"

Start-Process pwsh -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$Root\services\api'; .\start-api.ps1"
)
Start-Sleep -Seconds 2

Start-Process pwsh -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$Root\services\rag'; .\start-rag.ps1"
)
Start-Sleep -Seconds 1

Start-Process pwsh -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$Root\apps\web'; if (-not (Test-Path node_modules)) { npm install }; npm run dev"
)

Write-Host "Open http://127.0.0.1:5173 when Vite is ready." -ForegroundColor Green
