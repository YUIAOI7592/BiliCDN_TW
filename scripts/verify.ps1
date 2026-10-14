$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $ProjectRoot
try {
    & node scripts/verify.mts
    if ($LASTEXITCODE -ne 0) { throw 'Local verification failed.' }
} finally { Pop-Location }
