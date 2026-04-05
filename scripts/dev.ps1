$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

Write-Host "hNotebook — run each block in its own terminal (see docs/local-dev.md)." -ForegroundColor Cyan
Write-Host ""
Write-Host "1) API:" -ForegroundColor Yellow
Write-Host "   cd '$Root\services\api'; mvn spring-boot:run"
Write-Host ""
Write-Host "2) RAG:" -ForegroundColor Yellow
Write-Host "   cd '$Root\services\rag'; python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r requirements.txt; uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
Write-Host ""
Write-Host "3) Web:" -ForegroundColor Yellow
Write-Host "   cd '$Root\apps\web'; npm install; npm run dev"
Write-Host ""
Write-Host "Optional: uncomment Start-Process lines below to spawn three windows." -ForegroundColor DarkGray
# Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$Root\services\api'; mvn spring-boot:run"
# Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$Root\services\rag'; if (-not (Test-Path .venv)) { python -m venv .venv }; .\.venv\Scripts\Activate.ps1; pip install -r requirements.txt; uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
# Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$Root\apps\web'; npm install; npm run dev"
