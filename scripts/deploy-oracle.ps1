param(
    [switch]$DataOnly,
    [string]$RemoteHost = $env:ORACLE_HOST
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$KeyPath = Join-Path $ProjectRoot ".secrets\oracle-cloud\ssh-key-2026-11-06.key"
$CredPath = Join-Path $ProjectRoot ".secrets\oracle-cloud\panel-credentials.txt"
$RemoteDir = "/home/ubuntu/financial-bi"

if (-not $RemoteHost -and (Test-Path $CredPath)) {
    $ipLine = Get-Content $CredPath | Where-Object { $_ -match "^IP Publico:\s*(.+)$" } | Select-Object -First 1
    if ($ipLine -match "^IP Publico:\s*(.+)$") {
        $RemoteHost = "ubuntu@$($matches[1].Trim())"
    }
}

if (-not $RemoteHost) {
    throw "Defina ORACLE_HOST ou preencha IP Publico em .secrets\oracle-cloud\panel-credentials.txt"
}

if (-not (Test-Path $KeyPath)) {
    throw "Chave SSH nao encontrada em: $KeyPath"
}

if ($DataOnly) {
    Write-Host "Sincronizando data/master.json com Oracle Cloud ($RemoteHost)..." -ForegroundColor Cyan
    scp -i $KeyPath (Join-Path $ProjectRoot "data\master.json") "${RemoteHost}:${RemoteDir}/data/master.json"
    Write-Host "Sincronizado com sucesso!" -ForegroundColor Green
    exit 0
}

Write-Host "Empacotando e enviando codigo + dados para Oracle Cloud ($RemoteHost)..." -ForegroundColor Cyan
$TempTar = Join-Path $env:TEMP "financial-bi-deploy.tar.gz"
if (Test-Path $TempTar) { Remove-Item $TempTar -Force }

Push-Location $ProjectRoot
try {
    tar -czf $TempTar `
        --exclude="node_modules" `
        --exclude="bot/node_modules" `
        --exclude=".next" `
        --exclude=".git" `
        --exclude=".secrets" `
        --exclude=".env" `
        --exclude=".env.*" `
        --exclude="scratch" `
        .
} finally {
    Pop-Location
}

scp -i $KeyPath $TempTar "${RemoteHost}:/tmp/financial-bi-deploy.tar.gz"
Remove-Item $TempTar -Force

ssh -i $KeyPath $RemoteHost "mkdir -p $RemoteDir && tar -xzf /tmp/financial-bi-deploy.tar.gz -C $RemoteDir && rm -f /tmp/financial-bi-deploy.tar.gz && cd $RemoteDir && docker compose up -d --build"
Write-Host "Deploy concluido com sucesso!" -ForegroundColor Green
