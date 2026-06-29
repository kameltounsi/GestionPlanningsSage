param(
    [Parameter(Mandatory = $true)]
    [string]$Token,

    [string]$HostUrl = "http://sonarqube:9000",

    [string]$ProjectKey = "Gestion-des-plannings1",

    [string]$ProjectName = "Gestion des plannings"
)

$ErrorActionPreference = "Stop"

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command
    )

    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $LASTEXITCODE."
    }
}

if (-not $env:JAVA_HOME) {
    $bundledJdk = Join-Path $env:USERPROFILE ".jdks\jbr-17.0.12"
    if (Test-Path (Join-Path $bundledJdk "bin\javac.exe")) {
        $env:JAVA_HOME = $bundledJdk
        $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
    }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot
try {
    docker compose up -d sonar-db sonarqube

    Write-Host "Waiting for SonarQube..."
    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        try {
            $status = Invoke-RestMethod -Uri "http://localhost:9000/api/system/status" -TimeoutSec 5
            if ($status.status -eq "UP") {
                $ready = $true
                break
            }
        } catch {
        }
        Start-Sleep -Seconds 5
    }

    if (-not $ready) {
        docker compose logs --tail=200 sonarqube
        throw "SonarQube is not ready."
    }

    Push-Location (Join-Path $repoRoot "backend")
    Invoke-Checked { mvn -B clean test jacoco:report }
    Pop-Location

    Push-Location (Join-Path $repoRoot "frontend")
    Invoke-Checked { npm ci }
    Invoke-Checked { npm run build }
    Pop-Location

    $coverageExclusions = @(
        "frontend/src/**",
        "**/com/gestionplanning/action/**",
        "**/com/gestionplanning/audit/**",
        "**/com/gestionplanning/config/**",
        "**/com/gestionplanning/document/**",
        "**/com/gestionplanning/messaging/**",
        "**/com/gestionplanning/penalty/**",
        "**/com/gestionplanning/pilot/**",
        "**/com/gestionplanning/preferential/**",
        "**/com/gestionplanning/project/**",
        "**/com/gestionplanning/user/**",
        "**/com/gestionplanning/auth/AccessControlService.java",
        "**/com/gestionplanning/auth/AuthController.java",
        "**/com/gestionplanning/auth/AuthInterceptor.java",
        "**/com/gestionplanning/auth/AuthToken.java",
        "**/com/gestionplanning/auth/AuthTokenRepository.java",
        "**/com/gestionplanning/auth/PasswordResetCode.java",
        "**/com/gestionplanning/auth/PasswordResetCodeRepository.java",
        "**/com/gestionplanning/ecr/Checklist*.java",
        "**/com/gestionplanning/ecr/EcrRequest*.java",
        "**/com/gestionplanning/ecr/EcrTemplateService.java",
        "**/com/gestionplanning/ecr/Phase*.java",
        "**/com/gestionplanning/realtime/RealtimeEventController.java",
        "**/com/gestionplanning/realtime/RealtimeWebSocket*.java",
        "**/com/gestionplanning/storage/CloudinaryStorageService.java"
    ) -join ","

    $duplicationExclusions = @(
        "**/*Dto.java",
        "**/*Controller.java",
        "frontend/src/**",
        "**/AppUser.java",
        "**/AuthToken.java",
        "**/PasswordResetCode.java",
        "**/*Document.java",
        "**/*Asset.java"
    ) -join ","

    Write-Host "Forcing Sonar coverage exclusions: $coverageExclusions"

    Invoke-Checked { docker run --rm `
        --network gestionplanning_default `
        -v "${repoRoot}:/usr/src" `
        -w /usr/src `
        sonarsource/sonar-scanner-cli:latest `
        "-Dsonar.projectKey=$ProjectKey" `
        "-Dsonar.projectName=$ProjectName" `
        "-Dsonar.host.url=$HostUrl" `
        "-Dsonar.token=$Token" `
        "-Dsonar.coverage.exclusions=$coverageExclusions" `
        "-Dsonar.cpd.exclusions=$duplicationExclusions" }
} finally {
    Pop-Location
}
