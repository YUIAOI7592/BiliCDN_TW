param([string]$NodePath)
$ErrorActionPreference = 'Stop'
$SelectedNode = if ($PSBoundParameters.ContainsKey('NodePath')) {
    if ([string]::IsNullOrWhiteSpace($NodePath)) { throw 'NodePath must name an executable.' }
    $NodePath
} elseif ($env:BILICDN_NODE) {
    $env:BILICDN_NODE
} else {
    'node'
}
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $ProjectRoot
try {
    & $SelectedNode scripts/verify.mts
    $VerifyExitCode = $LASTEXITCODE
} finally { Pop-Location }
exit $VerifyExitCode
