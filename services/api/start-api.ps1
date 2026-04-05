$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (Get-Command mvn -ErrorAction SilentlyContinue) {
    mvn -q spring-boot:run
    exit $LASTEXITCODE
}

if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "Maven not found; starting API via Docker (port 8080, data in ./data)." -ForegroundColor Yellow
    docker run --rm -it `
        -p 8080:8080 `
        -v "${PSScriptRoot}:/workspace" `
        -w /workspace `
        maven:3.9.9-eclipse-temurin-21-alpine `
        mvn -q spring-boot:run
    exit $LASTEXITCODE
}

Write-Error "Install Apache Maven 3.9+ or Docker to run the API. See README / docs/local-dev.md."
